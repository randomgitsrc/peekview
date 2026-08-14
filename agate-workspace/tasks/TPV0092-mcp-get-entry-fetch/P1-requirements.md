---
phase: P1
task_id: TPV0092-mcp-get-entry-fetch
type: problems
parent: P0-brief.md
trace_id: TPV0092-P1-20260815
status: draft
created: 2026-08-15
agent: analyst
# ── v2.0 机器字段 ──
risk_level: medium
phases: [P1, P2, P3, P4, P5, P6, P7, P8]
packages: [backend, packages/mcp-server]
domains: [backend, mcp, security]
capability_requirements: [p6-second-instance, purify-regex-tests, ssrf-validation-tests, share-creation]
---

# P1 需求基线 — TPV0092 MCP get_entry 直接读取任意 PeekView 链接

## 1. 需求复述

消除"agent 拿到 PeekView 链接却读不到"的摩擦。`get_entry`（MCP 工具）从"只认配置实例 slug、返回元数据文本列表"扩展为"**接受任意 PeekView 链接形态 → 跨 host 读取 → 返回净化后的结构化 JSON（含文件内容）**"。配套改动：

- `publish_files` 返回附带 `raw_url`
- 后端 raw 端点补 `?share=`（复用 get_entry 的 share 验证逻辑，私有分享一次访问读 raw）与 `?purify=`（base64 剥离）

## 2. 隐含需求识别

### 2.1 数据维度
- **无 schema 变更、无迁移**：全改动为 MCP 端逻辑（URL 解析/净化/返回策略）+ 后端 raw 端点只加可选 query 参数。已读代码确认：`EntryRawResponse`/`RawFileItem` 结构已存在（`models.py:527-549`），`files` 项含 `content`（文本）/`content=None`+`file_url`（二进制）。

### 2.2 前端维度
- **无 UI 变化**：纯 MCP + 后端 API 改动，无视觉/交互变化。P6 无 `ui_affected`，但仍有真实 URL 读取实测（需 :8889 跨 host）。

### 2.3 多端维度（重要）
- **[多端] get_entry 返回结构变化是向后兼容破坏**：现有 `getEntry.ts:25-41` 返回"元数据文本列表（不含文件内容）"，新需求要求返回"结构化 JSON 含净化后内容"。P0 已确认 agent 新会话可接受——**但 MCP `get_entry` 必须从 `get_entry` 端点（`/api/v1/entries/{slug}`，files 无 content）切换到 raw 端点（`/api/v1/entries/{slug}/raw`，files 含 content）才能拿到内容**。这是根因 3 之外的第二个"读不到内容"根因（已读 `client.ts:93-95` + `types.ts:29-46` 确认 get_entry 端点返回的 EntryResponse 不含 content）。
- **[多端] 裸 slug 兼容**：`get_entry(slug)` 在配置实例上继续可用（现有 getEntry 调用方不破坏），但其返回也要升级为含内容的结构化 JSON。
- **[多端] publish_files 返回加 raw_url**：`publishFiles.ts:539` 目前只返回 `Link: {publicUrl}/{slug}`，需加 `raw_url`（建议 `{publicUrl}/api/v1/entries/{slug}/raw`）。

### 2.4 安全维度（关键隐含，P0 只提 SSRF）
- **[安全] 跨 host 请求不得携带配置实例的 userToken/API key**：`client.ts:28-32` 的 `request()` 恒带 `Authorization: Bearer {userToken}`。若跨 host 读取复用该方法，**会把本实例用户 token 泄漏给外部 host**。跨 host 读取必须是**匿名**（仅公开 entry）或**仅携带分享链接中的 share token**（URL query，非 Header）。`[SUGGEST: 跨 host 走独立匿名 fetch 路径，不注入任何配置实例凭据]`
- **[安全] 分享 token 在 URL 中**：MCP 拼到 raw 请求的 URL query → 日志/中间件/错误消息不得打印完整 URL（只打 host/slug/有 token 标志）。<!-- [REV1: 承接 BDD-25 验收] -->
- **[安全] SSRF 防护双保险**：协议白名单（https 通配，http 仅 localhost/127.0.0.1）+ **响应结构校验**（请求后校验 JSON 含 slug/summary/files 字段，非 PeekView 响应拒绝且**不泄露响应体**，返回"无法识别为 PeekView entry"）。
- **[安全] 超时与限流**：跨 host fetch 必须有超时（现有 30s 超时机制可复用），避免挂起。<!-- [REV1: 承接 BDD-26 验收] -->

### 2.5 边界维度
- **URL 形态解析（parseEntryRef）**：页面链接 `https://host/slug` / raw 长链接 `https://host/api/v1/entries/{slug}/raw` / raw 短链接 `https://host/{slug}/raw`（main.py:526 已存在 302）/ 分享链接 `?share={token}` / 裸 slug（用配置实例）。share token 需透传到 raw URL `?share=`（本任务后端补上后 MCP 可直接用）。
- **单文件/多文件返回策略阈值**：单文件净化后全量 + >200KB 软警告；多文件总量 ≤32KB 全量，>32KB 清单+片段+`file=` 取单个。
- **[边界] get_entry 需新增 `file` 参数**：返回策略"`file=` 取单个"隐含 MCP get_entry 要有按文件名/路径取单个文件全量的能力（现有 schema 只有 slug）。`[SUGGEST: get_entry 增加可选 file 参数（文件名或路径），配合多文件清单返回]`
- **净化正则鲁棒性**：`data:image` 变体（大小写/空格/`<img>` 形式/`![alt](data:image...)` 形式）需测试覆盖；占位符保留 alt text。
- **二进制文件**：content=null，不进上下文（raw 响应已满足，MCP 侧无需额外处理但需测试确认）。

### 2.6 兼容维度
- get_entry 返回结构变化：已确认接受（agent 新会话）。
- raw `?purify=` 与 `?share=` 都是可选参数，缺省行为=现有行为，向后兼容。
- 现有 `getEntry(slug)` 语义保留（配置实例 + 兼容路径），扩展为"任意形态引用"。

## 3. BDD 验收条件

### 3.1 URL 形态解析

#### BDD-1: get_entry 接受页面链接并返回内容
- Given 一个公开 PeekView entry，已知其页面链接 `https://host/{slug}`
- When 调用 `get_entry` 传入该页面链接
- Then 返回该 entry 的结构化 JSON（含 summary、slug、净化后文件内容），且 PASS 判定为成功而非报错

#### BDD-2: get_entry 接受 raw 长链接并返回内容
- Given 一个公开 PeekView entry，已知其 raw 长链接 `https://host/api/v1/entries/{slug}/raw`
- When 调用 `get_entry` 传入该 raw 长链接
- Then 返回该 entry 的结构化 JSON（含文件内容），而非"无法识别"错误

#### BDD-3: get_entry 接受 raw 短链接并返回内容
- Given 一个公开 PeekView entry，已知其 raw 短链接 `https://host/{slug}/raw`
- When 调用 `get_entry` 传入该短链接
- Then 返回该 entry 的结构化 JSON（含文件内容），说明短链接 302 形态被正确解析

#### BDD-4: get_entry 接受裸 slug 并返回内容
- Given 一个配置实例上的公开 entry，已知其 slug
- When 调用 `get_entry` 传入裸 slug（无 URL 形态）
- Then 返回该 entry 的结构化 JSON（含文件内容），且该路径向后兼容现有 getEntry 调用方

#### BDD-5: get_entry 接受分享链接并返回私有 entry 内容
- Given 一个私有 entry 的有效分享链接 `https://host/{slug}?share={token}`
- When 调用 `get_entry` 传入该分享链接
- Then 返回该私有 entry 的结构化 JSON（含文件内容），证明 share token 被解析并透传

### 3.2 跨 host 读取

#### BDD-6: 跨 host 读取公开 entry
- Given 一个非 MCP 配置实例的 PeekView host（如 :8889 模拟实例）上的公开 entry
- When 调用 `get_entry` 传入该外部 host 的链接
- Then 返回该 entry 的结构化 JSON（含文件内容），证明不受配置实例限制

#### BDD-7: 跨 host 私有 entry 无 token 不可读
- Given 一个非配置实例 host 上的私有 entry（无分享链接，仅裸 slug 或页面链接）
- When 调用 `get_entry` 传入该链接
- Then 返回明确错误（不可读），且不泄露 entry 内容

#### BDD-8: 跨 host 请求不携带配置实例凭据
- Given 一个可观测请求头的外部 host（mock 服务器记录收到的 Authorization 头）
- When 调用 `get_entry` 读取该 host 上的公开 entry
- Then mock 服务器记录到请求不含配置实例的 Bearer token / API key，证明未泄漏本实例凭据

### 3.3 SSRF 防护

#### BDD-9: 非 PeekView 响应被拒绝
- Given 一个返回合法 HTTP 200 但 JSON 不含 PeekView EntryRawResponse 结构（缺 slug/summary/files 字段）的 URL
- When 调用 `get_entry` 传入该 URL
- Then 返回"无法识别为 PeekView entry"类错误，且错误消息不包含响应体内容

#### BDD-10: 非白名单协议被拒绝
- Given 一个 `ftp://`、`file://` 等非 http(s) 协议的 URL
- When 调用 `get_entry` 传入该 URL
- Then 在发起网络请求前即被拒绝，返回明确错误

#### BDD-11: http 非 localhost 被拒绝
- Given 一个 `http://`（非 https）且 host 非 localhost/127.0.0.1 的 URL
- When 调用 `get_entry` 传入该 URL
- Then 在发起网络请求前即被拒绝，返回明确错误

### 3.4 内容净化

#### BDD-12: 文本内 base64 图片替换为占位符并保留 alt
- Given 一个含 `![alt text](data:image/png;base64,<长串>)` 的 markdown 文件 entry
- When 调用 `get_entry` 读取并净化
- Then 返回内容中该 base64 图片被替换为 `[image: 名 (N KB, base64)]` 形式占位符，且保留 `alt text` 文本，长 base64 串不出现在返回内容中

#### BDD-13: 二进制文件保持 content=null
- Given 一个含二进制文件（如图片/压缩包）的 entry
- When 调用 `get_entry` 读取
- Then 返回 JSON 中该文件 `content` 为 null（或等价空值），不带 base64 内容进上下文

#### BDD-14: 无 base64 的普通文本原样返回
- Given 一个含普通代码/文本文件的 entry（无 data:image 内容）
- When 调用 `get_entry` 读取
- Then 返回内容与源文件一致，未被误净化（净化正则不误伤普通文本）

### 3.5 返回策略

#### BDD-15: 单文件 entry 返回全量内容
- Given 一个只含单个文本文件的 entry（大小 ≤200KB）
- When 调用 `get_entry` 读取
- Then 返回该文件完整内容（净化后）

#### BDD-16: 单文件超 200KB 返回全量并附软警告
- Given 一个单文件文本 entry，净化后大小 >200KB
- When 调用 `get_entry` 读取
- Then 仍返回完整内容，且返回中附带"文件较大（>200KB）"类软警告信息

#### BDD-17: 多文件总量 ≤32KB 返回全部文件全量
- Given 一个多文件 entry，各文件净化后总大小 ≤32KB
- When 调用 `get_entry` 读取
- Then 返回全部文件完整内容（净化后）

#### BDD-18: 多文件总量 >32KB 返回清单与片段
- Given 一个多文件 entry，净化后总大小 >32KB
- When 调用 `get_entry` 读取
- Then 返回文件清单（文件名/大小）+ 每文件内容片段，而非全部全量，且提示可用 `file=` 取单个

#### BDD-19: file= 参数取单个文件全量
- Given 一个多文件 entry（总量 >32KB），已知目标文件名
- When 调用 `get_entry` 传入该 entry 引用 + `file={文件名}`
- Then 返回该单个文件的完整内容（净化后），而不返回其他文件

### 3.6 publish_files 返回 raw_url

#### BDD-20: publish_files 返回附带 raw_url
- Given 发布文件到配置实例（public_url 已配置）
- When 调用 `publish_files`
- Then 返回结果中含 `raw_url`，其值为 `{public_url}/api/v1/entries/{slug}/raw`，且该 URL 可被 get_entry 直接读取

### 3.7 后端 raw 端点扩展

#### BDD-21: raw 端点支持 ?share= 读取私有分享 entry
- Given 一个私有 entry 的有效分享 token，已知其 raw 端点 `GET /api/v1/entries/{slug}/raw`
- When 以 `?share={token}` 访问该 raw 端点
- Then 返回 200 + 该 entry 的 EntryRawResponse（含文件内容），一次访问即可（无需两步设 cookie）

#### BDD-22: raw 端点 ?share= 无效 token 返回 404
- Given 一个私有 entry 的无效/已撤销/过期分享 token
- When 以 `?share={token}` 访问该 raw 端点
- Then 返回 404（与 get_entry 端点的 share 验证行为一致），不泄露 entry 存在性

#### BDD-23: raw 端点 ?purify= 剥离 base64 图片
- Given 一个含 `data:image/...;base64,<长串>` 文本内容的 entry
- When 以 `?purify=true`（或等价参数）访问该 raw 端点
- Then 返回 JSON 中文本内容被净化：base64 图片替换为占位符（保留 alt），响应体积显著减小

#### BDD-24: raw 端点缺省参数向后兼容
- Given 一个公开 entry
- When 以无 query 参数访问 raw 端点（现有调用方式）
- Then 返回与改动前一致的 EntryRawResponse（无净化、无 share），向后兼容不破坏

### 3.8 安全与边界 <!-- [REV1: 新增，承接评审打回缺口 1/2] -->

#### BDD-25: 错误消息不打印 share token 明文
- Given 一个私有 entry 的无效分享链接 `https://host/{slug}?share={token}`，token 为可辨识的已知字符串
- When 调用 `get_entry` 传入该链接，读取失败
- Then 返回的错误消息中不含该 token 明文，也不含完整 URL（只允许 host / slug / "有 token"标志）

#### BDD-26: fetch 超过超时阈值返回明确错误而非挂起
- Given 一个接受请求但永不返回的 host（mock 挂起服务器）
- When 调用 `get_entry` 传入该 host 的链接
- Then 在超时阈值内返回明确的超时/失败错误，而非无限挂起

## 4. 待确认清单

[NO_NEED_CONFIRM]

- [SUGGEST: 跨 host 读取走独立匿名 fetch 路径，不注入配置实例 userToken/API key（Bearer 只用于配置实例裸 slug/私有 entry 读取），理由：client.request 恒带 Bearer，直接复用会泄漏本实例凭据给外部 host]
- [SUGGEST: get_entry 增加可选 `file` 参数（文件名/路径）用于多文件清单后取单个全量，理由：返回策略"`file=` 取单个"必须有对应入参，文件名比 file_id 对 agent 更直观]
- [SUGGEST: 净化优先由后端 raw `?purify=` 参数实现（单一实现源），MCP 侧若后端不支持则降级本地净化，理由：避免双端两套正则漂移；P0 已定后端补 ?purify=]
- [SUGGEST: 错误消息/日志只输出 host + slug + "有 token"标志，不打印含 share token 的完整 URL，理由：known_risks 明确 token 在 URL 中]
- [SUGGEST: publish_files 的 raw_url 格式为 `{publicUrl}/api/v1/entries/{slug}/raw`（与后端 raw_url 自引用格式一致，`files.py:391`），理由：格式统一便于 agent 直接用]

## 5. 裁剪说明

- **phases: [P1, P2, P3, P4, P5, P6, P7, P8]**（全走，无裁剪）
  - **P2 不可裁**：跨端改动（后端 raw + MCP client/tools），安全边界（SSRF + 凭据隔离）需明确方案，不可单候选跳过
  - **P3 不可跳**：零现成测试覆盖（parseEntryRef / 净化正则 / raw ?share= / getEntry 单测均无），P0 明确不可跳
  - **P5 保留**：后端 pytest 全量 + MCP 单测 + typecheck
  - **P6 不可裁**：真实 URL 读取（需 :8889 第二实例跨 host）+ 净化效果 + 分享链接 + 非 PeekView 拒绝，均需实测；无 UI 视觉
  - **P7 不可裁**：跨后端 + MCP 双包多文件改动，需一致性检查
  - **P8 保留**：双包独立版本（backend + @peekview/mcp-server）
- **risk_level: medium**（安全边界 SSRF + 跨端改动，P0 已定）
- **design_trivial 不适用**：不可简化 P2

## 6. 能力需求声明

```yaml
capability_requirements:
  - need: p6-second-instance
    why: P6 验收需要第二个 debug 实例（:8889）模拟外部 PeekView host，验证跨 host 读取（BDD-6/7/8）
    available:
      - "后端 pytest/单测可先覆盖解析与净化逻辑"
      - "手动起第二个 debug 实例：PORT=8889 + PEEKVIEW_STORAGE__DATA_DIR=/tmp/peekview-debug2 + PEEKVIEW_DEBUG_MODE=1（dev-server.sh 硬编码 8888，需手动命令，参照 docs/process/debug-workflow.md 手动启动方式）"
    status: supplementable

  - need: purify-regex-tests
    why: 净化正则鲁棒性（data:image 变体/alt 保留/不误伤普通文本）需测试覆盖（BDD-12/14/23）
    available:
      - "后端 pytest（raw ?purify= 集成测试）"
      - "MCP vitest 单测（若净化在 MCP 端兜底）"
    status: available

  - need: ssrf-validation-tests
    why: 协议白名单 + 响应结构校验 + 凭据不泄漏需测试（BDD-8/9/10/11）
    available:
      - "后端/MCP 单测 + 集成测试（mock 非 PeekView 响应、mock 外部 host 抓 Authorization 头）"
    status: available

  - need: share-creation
    why: P6 需创建私有分享链接（BDD-5/21/22），后端已有 POST /api/v1/entries/{slug}/shares（api/shares.py）
    available:
      - "测试中调用现有 shares API 创建分享"
    status: available
```
