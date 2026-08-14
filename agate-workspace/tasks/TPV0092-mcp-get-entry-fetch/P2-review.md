---
phase: P2
task_id: TPV0092-mcp-get-entry-fetch
type: review
parent: P2-design.md
trace_id: TPV0092-P2-eng-review-20260815
status: approved
created: 2026-08-15
agent: plan-eng-review
---

# P2-review — plan-eng-review

评审对象：`P2-design.md`（MCP get_entry 直接读取任意 PeekView 链接）。范围：后端 raw `?share=`/`?purify=` + MCP parseEntryRef 匿名直读 + 净化 + 返回策略。

## 一、6 维度评估

### 1. 数据流（清晰，无阻断）

- 链路：parseEntryRef 解析 5 形态 → 匿名 fetch raw → 响应结构校验 → 净化 → 返回策略。每个环节异常路径均有定义（设计 2.1/2.2/2.3/2.4）。
- **302 旁路成立**：`main.py:526-528` raw 短链接 302 仅拼路径丢 query（已读代码确认），设计关键决策 1（parseEntryRef 直连 API 不经 302）正确；minimal_validation 已 curl 实证。
- 页面链接 `/{slug}` 返回 HTML（SPA catchall `main.py:585-614`），设计明确 MCP 解析 slug 直连 raw、不解析 HTML——正确。
- 二进制 content=null（`files.py:398-410` 已确认）+ 响应校验字段 slug/summary/files 与 models.py L527-549 一致。
- 异常路径完备：解析失败（形态表兜底"无法识别"）、协议拒绝、404 私有、非 PeekView 响应、超时（AbortController 30s 复用现有模式）均有定义。

### 2. 接口契约（明确，向后兼容设计合理）

- MCP `get_entry({ref, file?})` ↔ 后端 raw `?share=&purify=`，契约字段清单在 设计 3。
- 裸 slug 语义保留（BDD-4）：裸 slug 走配置实例 + Bearer（`fetchEntryRawAuthenticated`），返回同样升级为结构化 JSON 含 content——返回结构变化符合 P0 已接受的向后兼容预期。
- 老后端兼容：无 `?purify=` → MCP 本地 purify.ts 兜底（设计 2.3）；`?share=` 是老后端没有的功能（当前 404 实测确认）→ 设计以"本任务后端先补"为前提，MCP 对私有分享链接依赖新版后端，可接受（backend + MCP 同版本线发布）。
- raw_url 一致性（P1-review 附注必答）：publish_files 用 `config.publicUrl`（BDD-20 断言 `{public_url}/.../raw`），后端 raw 自引用保持 `request.base_url`（BDD-24 向后兼容）——两处语义正确，开发/生产分离有意义，设计 2.5 明确。

### 3. 错误边界（SSRF 防护合格，2 个注意点非阻塞）

- **协议白名单**（设计 2.1，BDD-10/11）：https 任意 + http 仅 localhost/127.0.0.1/::1，请求前拒绝——正确。
- **响应结构校验**（设计 2.2，BDD-9）：res.ok + JSON + slug/summary/files 非空，错误消息不含响应体——正确。可伪造性：攻击者搭 http 服务已被 http-仅-localhost 限制；伪造 https 服务返回伪 JSON 需其自身控域，且响应校验不防"伪 PeekView 内容"（内容本身来自任意 host，属用户主动读取场景），符合设计意图。
- **[注意点 A] 重定向跟随**：Node fetch 默认跟随重定向。https 源 URL 可 302 → http 内网地址，绕过 http-仅-localhost 白名单。缓解：P0 主防线是响应结构校验（非 PeekView JSON 不泄露响应体）+ 匿名（无 Bearer 可泄露）；DNS rebinding 同理，最终以响应校验兜底。**建议**：P4 在 fetch 加 `redirect: 'manual'`/`'error'`（或跟随后校验最终 host），P3 补一个重定向场景测试。非阻塞。
- **凭据隔离**（设计 2.2，BDD-8）：URL 形态一律匿名无 Authorization，仅裸 slug 走 Bearer——正确且写死，防 host 判定绕过注入凭据。
- **token 不落日志**（BDD-25）：设计 2.1"请求 URL 构造只拼 query 不进日志"，错误消息只输出 host/slug/有 token 标志——满足。
- **404 私有不泄露存在性**（BDD-7/22）：raw 私有无 token 404，翻译为"无法读取（私有 entry，需分享链接）"——正确。
- **超时**（BDD-26）：30s AbortController 复用——满足。

### 4. 测试策略（完备，P3 覆盖确认）

- P3 gate（设计 5）：`make test-quick && make test-mcp-unit`。设计 §6 完成标志覆盖：parseEntryRef 5 形态 / 匿名 fetch 无 Bearer / 净化兜底 / 返回策略 / file= / publish_files raw_url / 后端 raw ?share=/?purify=/purify_content。
- 缺口提示（非阻塞）：P3 未显式列出 SSRF 白名单测试（BDD-10/11）与重定向场景（注意点 A）、以及 file= 匹配的"无匹配/多匹配"错误路径——建议 P3 测试用例明确包含，P6 real_urls 已覆盖跨 host 实测（BDD-6/7/8）。
- 净化正则测试（BDD-12/13/14/23）明确覆盖变体与不误伤——完备。

### 5. 技术债（净化双实现漂移）

设计 0 风险区已识别"净化双实现正则漂移"，但**未登记 DEBT**。按角色定义，存在"后续应重构/架构债"须用标准 DEBT 格式。净化主实现单点在后端，MCP 兜底仅老后端触发，漂移风险低但真实存在。**建议登记 DEBT**（条目见下，待主 Agent 落盘 `agate-workspace/debt/tech-debt.md`，当前 id 已至 DEBT0003）。

### 6. 多方案探索 + 实现就绪度

- **候选方案 A vs B 权衡真实**：B 非稻草人——B 有真实优点（净化/SSRF/响应校验 Python 单实现点、MCP 代码最少），被安全边界否决（新增后端开放端点 = 扩大 SSRF 攻击面 + 认证设计 + config 实例 egress 依赖）理由自洽充分，符合 P0/P1 既定方向。candidate_count=2 与正文一致。
- **实现就绪度**：设计方案细化到函数签名（fetchEntryRaw 签名、get_entry_raw 参数、resolve_entry_raw 分支流程）、返回策略表、形态解析表——implementer 无需步骤计划可自主实现。
- **files_to_read** 覆盖：后端 files.py:352-471 / entries.py:196-263 / entry_service.py:1019-1061 / share_service.py:188-240 / models.py:527-549 + MCP getEntry.ts / client.ts / publishFiles.ts / types.ts / merge.ts / 现有测试 / main.py:522-528——实现所需全部上下文已覆盖。

### 7. P2 最小验证（充分）

minimal_validation 字段含 assumption/method/result confirmed：curl 实证 302 丢 query、?share= 当前 404、?purify= 被忽略、二进制 content=null、页面链接 HTML、share_url host 可能非请求 host。验证充分且全部影响设计结论（302 旁路、后端补参数必要性、purify 主实现位置）。

## 二、架构问题

### 阻塞级
无。

### 非阻塞级

1. **[安全·建议] 重定向跟随**（设计 2.2）：Node fetch 默认跟随重定向，https 源可重定向到 http 内网绕过 http-仅-localhost 白名单。主防线（响应结构校验）兜底不泄露响应体，故非阻塞。建议 P4 加 `redirect: 'manual'`/`'error'` 或跟随后校验最终 host；P3 补重定向拒绝测试。引用：P1 BDD-9/10/11、P2-design 2.2。
2. **[实现顺序·注意] raw ?share= 分支顺序**：`get_entry_with_share` 对 public entry 返回 None（`entry_service.py:1032`）。设计 2.6 已写"或 public/owner/admin 直通（对齐 entries.py:196-263）"——P4 必须严格按 entries.py 顺序：先 public/owner/admin 直通，再 `get_entry_with_share`，否则 public+?share= 会误判 404。引用：P1 BDD-21、P2-design 2.6。
3. **[测试·建议] P3 补充**：SSRF 白名单拒绝（BDD-10/11）、重定向场景、file= 无匹配/多匹配错误路径的显式测试用例。引用：P1 BDD-10/11/19、P2-design 5 gate_commands.P3。

## 三、DEBT 建议（待主 Agent 落盘）

```yaml
id: DEBT0004
category: technical
title: 净化正则双实现（后端 purify.py + MCP purify.ts 兜底）可能漂移
status: open
priority: low
evidence:
  - path: agate-workspace/tasks/TPV0092-mcp-get-entry-fetch/P2-design.md
  - note: 净化主实现单点在后端 ?purify=，MCP 兜底仅老后端（不支持 ?purify=）触发；两套正则跨语言（Python/TS）需保持一致
impact: 老后端场景下净化行为可能偏离后端主实现；正则修复需双端同步
recommendation: 净化逻辑以 P3 正则测试为契约锚点，双端共用同一组测试用例；待后端版本统一支持 ?purify= 后评估移除 MCP 兜底
closure_criteria:
  - P3 双端净化测试共用同一数据样例
  - 后端所有支持 ?purify= 后 MCP 兜底路径被标记 deprecated 或移除
source: review
created_at: 2026-08-15
task_id: TPV0092-mcp-get-entry-fetch
```

## 四、锁定决策

- 跨 host 匿名直读路径固化：URL 形态一律匿名（含配置实例自身页面链接也匿名，私有须分享链接）——凭据隔离边界写死，防 host 判定绕过。
- 302 短链接不经由：parseEntryRef 直连 `/api/v1/entries/{slug}/raw`，不依赖 302 透传 query。
- 净化主实现后端、MCP 兜底仅老后端；raw_url 双语义（publish_files=publicUrl 对外 / raw 自引用=base_url）。

## 五、结论

**status: approved**。0 阻塞。候选方案权衡真实、凭据隔离边界清晰、SSRF 双层防护合格（响应结构校验兜底重定向/DNS rebinding 残留风险）、minimal_validation 充分、实现就绪。3 项非阻塞建议 + 1 条 DEBT 建议待主 Agent 处置。

[PROD_NOT_TOUCHED]
