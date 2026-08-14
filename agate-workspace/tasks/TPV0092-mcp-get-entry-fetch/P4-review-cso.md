---
phase: P4
task_id: TPV0092-mcp-get-entry-fetch
type: review
parent: P4-implementation.md
trace_id: TPV0092-P4-cso-20260815
status: approved
created: 2026-08-15
agent: cso
---

# P4 安全复审（cso / 安全官，retry1）— TPV0092 MCP get_entry 直接读取任意 PeekView 链接

**范围**：复审 cso 上轮判定的唯一 MEDIUM（M-1 响应体大小无上限，内存 DoS）是否修复。审计对象 = `packages/mcp-server/src/client.ts`（retry1 修复）+ `P4-implementation.md` retry1 说明 + 回归抽查既有安全边界。

**只读审计，未修改任何代码、未触碰 `:8080` / `~/.peekview/`。** `[PROD_NOT_TOUCHED]`

## 0. 结论摘要

| 严重级别 | 数量 | 是否阻塞 |
|----------|------|----------|
| CRITICAL | 0 | — |
| HIGH | 0 | — |
| MEDIUM | 0 | —（上轮 M-1 已修复） |
| LOW | 2 | 不阻塞 |
| INFO | 2 | 建议记录 |

**Status: `approved`**。上轮唯一 MEDIUM（M-1 响应体大小无上限）已正确修复：Content-Length 预检 + 流式累计兜底 + abort 双保险，覆盖 `fetchEntryRaw` 与 `request()`（含 `fetchEntryRawAuthenticated`）两条路径；超限错误语义清晰且不含完整 URL/token（BDD-25）；既有安全边界（凭据隔离 / SSRF / authz / 净化）无回归。测试全绿。

## 1. 复审重点逐项核验（上轮 MEDIUM 修复情况）

### 1.1 响应体大小上限 — 修复满足

**落点**：`client.ts:16-17`（`MAX_RESPONSE_BYTES = 20MB` / `MAX_ERROR_BYTES = 1MB`）、`client.ts:77-119`（`readTextWithLimit`）、`client.ts:121-128`（`readJsonWithLimit`）、`client.ts:55/71/231-236`（接入点）。

- **Content-Length 预检**（`client.ts:83-87`）：`content-length` 存在且 `> maxBytes` → `controller.abort()` + 抛 `PeekViewApiError("响应体过大…")`。`Number(null)=0`、`Number('abc')=NaN` 均被 `Number.isFinite` 正确排除，不会因 header 缺失/畸形误判。
- **流式累计兜底**（`client.ts:93-110`）：`response.body.getReader()` 逐 chunk 累计 `total`，**超限发生在 `chunks.push` 之前**（`client.ts:101-105`），故已读内存恒 ≤ maxBytes（+单 chunk），`reader.cancel()` + `controller.abort()` 双释放。伪造/缺失 Content-Length 的 chunked 响应同样被中断。30s 超时（`client.ts:212-213`）保留为第二道防线。
- **覆盖范围**：`fetchEntryRaw`（URL 形态，`client.ts:231-236`）与 `request()`（`fetchEntryRawAuthenticated` 及 create/get/list/delete 全部复用，`client.ts:71`）均接入；错误响应体另以 1MB 上限读取（`client.ts:55`），超限回退 `statusText`，不影响既有 401/403/404 翻译。上轮"`response.json()` 读满 body"缺口已消除。
- **内存边界确认**：最坏保留内存约 20MB + JSON.parse 结果，为可接受硬边界；不再存在"恶意 host 30s 内灌入数 GB 打爆进程"的攻击面。

**阈值合理性（20MB）**：主要依据正确——远大于 getEntry 返回策略阈值（单文件 200KB / 多文件 32KB），作为"防内存 DoS 硬上限"而非内容策略，不误杀正常 entry。**但实现文档引用的"后端单文件截断线约 2MB"与事实不符**：后端无 2MB content 截断线，2MB 是前端 TreeView 的 display 截断（`TreeView.spec.ts:229`），后端实际 `max_file_size=20MB`（`config.py:38-41`）、`max_content_length=1MB`。修正后评估：单文件 entry 的 raw 响应在 ~20MB 边界（20MB 文件 + JSON 开销会略超上限被拒），属边缘功能取舍，非安全漏洞（见 3.1 LOW-1），不阻塞本轮。

### 1.2 超限错误语义 — 满足（BDD-25）

- 超限抛 `PeekViewApiError(status, "响应体过大（{context}）")`，context 为 `host={base}, slug={slug}`（`client.ts:234-235`）或 `response`/`error response`——**不含完整 URL、不含 `share` token、不含 Bearer**。与既有"无法识别为 PeekView entry（host, slug）"错误风格一致，BDD-25 保持满足。
- 错误路径 1MB 超限被 `try/catch` 捕获回退 `response.statusText`（`client.ts:53-58`），错误翻译链不因恶意大 error body 而破坏。

### 1.3 无新问题引入 — 通过（回归抽查）

- **凭据隔离**：`fetchEntryRaw` 仍仅 `X-PeekView-Source: mcp`，无 Authorization（`client.ts:217`）；`request()` 仅配置实例 Bearer。未变。
- **SSRF**：`redirect: 'manual'`、协议白名单、host 判定逻辑未动；本次改动只在响应体读取层。
- **Authz**：raw share 分支 / 私有 404 未动。
- **净化**：`purify_content` / `purify.ts` 未动。
- **测试回归**：`client.test.ts`(21) + `entryRef.test.ts`(15) + `getEntry.test.ts`(18) 共 54/54 绿（本机实测）；implementer 自查全量 268/268 绿。

## 2. STRIDE 矩阵（复审）

| STRIDE | 审计点 | 结论 | 证据 |
|--------|--------|------|------|
| **DoS** | 响应体大小上限 | **已修复（上轮 MEDIUM）** | `client.ts:77-119,16-17`；评审重点 #5 |
| **DoS** | 超时兜底 | 通过 | `client.ts:212-213`（30s AbortController） |
| **Info Disclosure** | 超限错误不泄完整 URL/token | 通过 | `client.ts:234-235` context 仅 host/slug；BDD-25 |
| **Tampering** | Content-Length 伪造绕过 | 通过（流式兜底） | `client.ts:97-107` 逐 chunk 累计独立于 header |
| **Spoofing** | 响应结构校验 | 通过 | `client.ts:252-264`（未改） |
| **Authz / 凭据 / SSRF / 净化** | 上轮审计结论 | 无回归 | 见 §1.3 |

## 3. 严重性分级清单（复审后残留）

### 3.1 LOW（2）— 不阻塞

- **LOW-1 阈值边缘功能取舍**：后端 `max_file_size` 默认 20MB（`config.py:38-41`），单文件恰在 20MB 的 entry 其 raw 响应含 JSON 开销会略超 `MAX_RESPONSE_BYTES` 被拒。属安全硬上限与"读超大 entry"的功能取舍，非漏洞；getEntry 内容策略本身面向摘要/片段。建议后续在文档/DEBT 注明。
- **LOW-2 新代码路径无专项单测**：`readTextWithLimit`/`readJsonWithLimit`/超限分支未见对应测试（`rg "响应体过大|Content-Length|readTextWithLimit" tests/` 无命中，仅 publishFiles 20MB 二进制测试）。现有 mock 响应体远小于阈值故未触发，功能正确性由 code review 保证。建议补 1-2 个"Content-Length 超限 / 流式超限"单测，作为 DEBT。

### 3.2 INFO（2）

- **INFO-1 阈值文档依据不实**：`P4-implementation.md:118` 引用"后端单文件截断线约 2MB"，实际为前端 display 截断；阈值本身合理，仅文档表述需更正。
- **INFO-2 `validateToken` 仍直接 `res.json()`**（`client.ts:140`）：仅面向配置实例（受信）的 `/auth/me` 小响应，无外部 host 攻击面，非新风险。

## 4. 上轮 MEDIUM 关闭条件核对

上轮 M-1 三项建议：①请求后查 Content-Length 超限直接 abort ✓（`client.ts:83-87`）；②无 Content-Length 的 chunked 流式累计超限 abort ✓（`client.ts:97-107`）；③上限在 getEntry 返回策略前生效 ✓（raw 下载即限制，`client.ts:231-236`）。**MEDIUM 关闭。**

## 5. 建议动作

1. 更正 `P4-implementation.md` 阈值依据（2MB 截断线→实际后端 max_file_size=20MB），DEBT 记录即可，不阻断。
2. 补 `readTextWithLimit` 超限单测（Content-Length 预检 + 流式兜底各 1 例），记 DEBT。
3. 其余边界维持上轮通过结论，无需重审。

## 6. 自检

- [x] 逐项核对上轮 MEDIUM 的三条修复建议（落点 文件:行号）
- [x] 阈值合理性评估（含对实现文档依据的纠偏）
- [x] BDD-25 错误语义确认
- [x] 回归抽查既有安全边界 + 本机实测 54/54 测试绿
- [x] Header status 字段 = `approved`，与结论一致
- [x] 状态标记 `[PROD_NOT_TOUCHED]`
