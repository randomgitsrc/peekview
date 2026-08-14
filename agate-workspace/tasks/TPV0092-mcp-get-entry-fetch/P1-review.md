---
phase: P1
task_id: TPV0092-mcp-get-entry-fetch
type: review
parent: P1-requirements.md
trace_id: TPV0092-P1-review-20260815
status: approved
created: 2026-08-15
agent: requirements-review
---

# P1 Review — TPV0092 MCP get_entry 直接读取任意 PeekView 链接（复审轮）

## 结论

**approved**：上轮打回 2 项（BDD-25 share token 不打印、BDD-26 fetch 超时）已全部落实。BDD 编号连续 1~26，frontmatter 机器字段未变，原 24 条 BDD 未改动，`[NO_NEED_CONFIRM]` 行首无反引号，无 NEED_CONFIRM，修订未引入新问题。26 条 BDD 全部可二值判定，覆盖数据/前端/多端/安全/边界/兼容六维度。

## 环境声明

- 本次复审仅读取代码与需求文件，未修改任何项目源码文件。
- `[PROD_NOT_TOUCHED]`

## 上轮打回项逐项核对（2/2 落实）

### R1/BDD-25（share token 不打印，安全）✅ 落实

- **修订落点**：`P1-requirements.md:194-199`（3.8 节）+ `:42`（隐含 2.4 标注 `[REV1: 承接 BDD-25 验收]`）。
- **逐条对上轮要求**：
  - 位置：新增于 3.8「安全与边界」节。✓
  - Given 私有 entry 的无效分享链接 + token 为可辨识已知字符串。✓
  - Then 错误消息不含 token 明文 + 不含完整 URL（只允许 host/slug/"有 token"标志）——与上轮打回意见措辞一致。✓
  - 可二值判定：错误消息中 token 字符串/完整 URL 存在与否可断言，无中间态。✓
  - 覆盖维度：安全✓（对齐隐含 2.4「日志/中间件/错误消息不得打印完整 URL」，known_risks 明示 token 在 URL 中）。
- 判定：满足上轮要求。

### R2/BDD-26（fetch 超时，安全/边界）✅ 落实

- **修订落点**：`P1-requirements.md:201-204`（3.8 节）+ `:44`（隐含 2.4 标注 `[REV1: 承接 BDD-26 验收]`）。
- **逐条对上轮要求**：
  - 位置：新增于 3.8 节。✓
  - Given 接受请求但永不返回的 host（mock 挂起服务器）。✓
  - Then 在超时阈值内返回明确超时/失败错误，而非无限挂起。✓
  - 可二值判定：超时阈值内返回明确错误 vs 无限挂起，可用 mock 挂起服务器 + 计时断言。✓
  - 覆盖维度：安全✓ 边界✓（对齐隐含 2.4「超时与限流」，client.ts 30s AbortController 机制可复用）。
- 判定：满足上轮要求。

## 回归性检查（未引入新问题）

- **BDD 编号连续 1~26**：grep `^#### BDD-` 确认连续无跳号（1,2,...,26）。✓
- **frontmatter 机器字段未变**：risk_level: medium / phases 全走 / packages: [backend, packages/mcp-server] / domains: [backend, mcp, security] / capability_requirements 4 项，与上轮一致。✓
- **原 24 条 BDD 未变**：BDD-1..24 内容与上轮评审逐条描述一致，无文字改动。✓
- **`[NO_NEED_CONFIRM]` 行首无反引号**：`:208` 为 `[NO_NEED_CONFIRM]`（行首，无前导反引号）。✓
- **无 NEED_CONFIRM**：grep `NEED_CONFIRM` 仅命中 NO_NEED_CONFIRM，无裸 NEED_CONFIRM。✓
- **修订标注**：3.8 节标题含 `[REV1: 新增，承接评审打回缺口 1/2]`，2.4 两处隐含需求各挂 `[REV1: 承接 BDD-NN 验收]` 注释，修订轨迹清晰。✓

## BDD 评审（26 条，全部可二值判定）

### 3.1 URL 形态解析

- **BDD-1**: 可判定。页面链接 `/{slug}` → 结构化 JSON。判定=成功非报错，明确。 覆盖维度：数据✓ 多端✓ 边界✓
- **BDD-2**: 可判定。raw 长链接 → 含文件内容。判定="非无法识别错误"，明确。 覆盖维度：数据✓ 边界✓
- **BDD-3**: 可判定。raw 短链接（302 已存在）→ 解析后返回内容。判定明确。 覆盖维度：边界✓
- **BDD-4**: 可判定。裸 slug → 含内容结构化 JSON + 向后兼容。 覆盖维度：多端✓ 兼容✓
- **BDD-5**: 可判定。分享链接 → 私有 entry 内容，share token 被解析透传。 覆盖维度：安全✓ 数据✓

### 3.2 跨 host 读取

- **BDD-6**: 可判定。跨 host 公开 entry（:8889）→ 返回内容。 覆盖维度：多端✓ 安全✓
- **BDD-7**: 可判定。跨 host 私有无 token → 明确错误 + 不泄露内容。 覆盖维度：安全✓ 边界✓
- **BDD-8**: 可判定 + 可实现。mock 服务器记录 Authorization 头 → 断言不含配置实例凭据。 覆盖维度：安全✓ 数据✓

### 3.3 SSRF 防护

- **BDD-9**: 可判定。HTTP 200 非 PeekView 结构 → "无法识别"错误 + 不含响应体。 覆盖维度：安全✓
- **BDD-10**: 可判定。`ftp://`/`file://` → 网络请求前拒绝。 覆盖维度：安全✓ 边界✓
- **BDD-11**: 可判定。`http://` 非 localhost → 请求前拒绝。 覆盖维度：安全✓ 边界✓

### 3.4 内容净化

- **BDD-12**: 可判定。base64 图片 → 占位符 + 保 alt + 长串缺失三断言。 覆盖维度：数据✓
- **BDD-13**: 可判定。二进制 content=null + 不进上下文。 覆盖维度：数据✓ 边界✓
- **BDD-14**: 可判定。普通文本原样返回不误伤。 覆盖维度：数据✓ 兼容✓

### 3.5 返回策略

- **BDD-15**: 可判定。单文件 ≤200KB 全量。 覆盖维度：数据✓ 边界✓
- **BDD-16**: 可判定。>200KB 全量 + 软警告文案可断言。 覆盖维度：数据✓ 边界✓
- **BDD-17**: 可判定。多文件 ≤32KB 全量。 覆盖维度：数据✓ 边界✓
- **BDD-18**: 可判定。>32KB 清单+片段+`file=` 提示。 覆盖维度：数据✓ 边界✓
- **BDD-19**: 可判定。`file=` 取单个全量。 覆盖维度：数据✓ 边界✓

### 3.6 publish_files 返回 raw_url

- **BDD-20**: 可判定。返回 `raw_url` = `{public_url}/api/v1/entries/{slug}/raw` + 可被 get_entry 直读。 覆盖维度：数据✓ 多端✓ 兼容✓

### 3.7 后端 raw 端点扩展

- **BDD-21**: 可判定。raw `?share=` → 200 + 含内容 + 一次访问。 覆盖维度：多端✓ 安全✓
- **BDD-22**: 可判定。无效/撤销/过期 share → 404 不泄露存在性。 覆盖维度：安全✓ 兼容✓
- **BDD-23**: 可判定。`?purify=` → 净化 + 保 alt + 体积显著减小。 覆盖维度：数据✓ 多端✓
- **BDD-24**: 可判定。raw 缺省参数 → 与改动前一致向后兼容。 覆盖维度：兼容✓

### 3.8 安全与边界（REV1 新增）

- **BDD-25**: 可判定。错误消息不含 share token 明文 + 不含完整 URL（只允许 host/slug/有 token 标志）。 覆盖维度：安全✓
- **BDD-26**: 可判定。mock 挂起服务器 → 超时阈值内返回明确错误而非挂起。 覆盖维度：安全✓ 边界✓

## 隐含需求覆盖（复审后）

- **数据维度**：✓ BDD-12/13/14（净化/二进制）、BDD-15..19（阈值策略）、BDD-23（?purify=）。无 schema 变更声明属实（models.py RawFileItem/EntryRawResponse 已存在）。
- **前端维度**：✓ 无 UI 影响，纯 MCP + 后端 API 改动。
- **多端维度**：✓ BDD-4（get_entry 端点切 raw 端点承接）、BDD-20（publish_files raw_url）、BDD-21..24（raw 扩展契约）、BDD-1/2/3（含内容断言）。
- **安全维度**：✓ 全覆盖（上轮 2 缺口已闭合）。凭据隔离（BDD-8）、私有无 token 不可读（BDD-7）、SSRF 白名单（BDD-10/11）、响应校验不泄露（BDD-9）、share 无效 404（BDD-22）、share 透传（BDD-5/21）、**share token 不打印（BDD-25，缺口 1 闭合）**、**fetch 超时（BDD-26，缺口 2 闭合）**。
- **边界维度**：✓ URL 形态（BDD-1/2/3/5）、二进制（BDD-13）、阈值（BDD-15..19）、净化鲁棒性（BDD-12/14）、**超时挂起（BDD-26）**。
- **兼容维度**：✓ BDD-4（裸 slug 语义）、BDD-24（raw 缺省）、BDD-14（净化不误伤）。

## 裁剪评审

- 跳过阶段：无（phases 全走 P1-P8）。
- P2 不可裁：跨端 + 安全边界。✓
- P3 不可跳：零现成覆盖。✓
- P6 不可裁：真实 URL 读取 + 净化 + 分享 + 非 PeekView 拒绝实测。✓
- P7 不可裁：跨双包多文件。✓
- risk_level=medium：与 SSRF + 跨端匹配。✓

## 能力需求三态核对

- **p6-second-instance = supplementable** ✓（:8889 手动起，dev-server.sh 硬编码 8888 属实）
- **purify-regex-tests = available** ✓
- **ssrf-validation-tests = available** ✓
- **share-creation = available** ✓（POST /api/v1/entries/{slug}/shares 已存在）

## BDD 跨条一致性

- 无矛盾：BDD-22 与 get_entry 端点 share 行为同源；BDD-25/26 与其他 BDD 无 Then 冲突。
- 阈值互斥：≤200KB/>200KB、≤32KB/>32KB 边界无重叠。
- 保护优先级：凭据隔离（BDD-8）→ 私有仅分享（BDD-5/7/21/22）→ SSRF 白名单（BDD-10/11）→ 响应校验（BDD-9）→ token 不打印（BDD-25）→ 超时（BDD-26），链路清晰。

## P1 纯净性

- 5 条 SUGGEST 均属需求级约束/新增入参，未构成 P2 方案设计。
- BDD 均描述用户/系统可见行为，无实现细节混入。

## 复审结论

上轮 2 项打回缺口全部落实：

1. **BDD-25**（3.8 节 + 2.4 标注）——错误消息不含 token 明文与完整 URL，可二值判定，覆盖安全维度。落实。
2. **BDD-26**（3.8 节 + 2.4 标注）——超时阈值内返回明确错误而非挂起，可二值判定，覆盖安全/边界维度。落实。

编号连续 1~26、frontmatter 未变、原 24 条未动、`[NO_NEED_CONFIRM]` 格式合规、无 NEED_CONFIRM。**通过，status: approved。**

## 自检

- status: approved 与结论一致。
- 复审结论逐项引用修订落点（BDD-25/26 + 行号 + 2.4 标注）。
- 26 条 BDD 逐条标注覆盖维度（数据/前端/多端/安全/边界/兼容）。
