---
phase: P4
task_id: TPV0092-mcp-get-entry-fetch
type: review
parent: P4-implementation.md
trace_id: TPV0092-P4-review-20260815
status: approved
created: 2026-08-15
agent: review
---

# P4 实现评审（偏执 Staff Engineer）— TPV0092 MCP get_entry 直接读取任意 PeekView 链接

评审对象：P4-implementation.md + 后端 `services/purify.py` / `api/files.py` + MCP `lib/entryRef.ts` / `lib/purify.ts` / `client.ts` / `tools/getEntry.ts` / `tools/publishFiles.ts` / `types.ts`。对照 P2-design.md（方案 A）+ P2-review.md（3 项非阻塞注意点 + 锁定决策）+ P1 26 BDD。

实测验证：`backend/tests/test_purify.py + test_raw_share_purify.py` 13 passed；MCP vitest 268/268 passed。

## Pass 1 — CRITICAL（0 个）

逐项核对，无阻断问题。核验结论如下。

### 1. raw 端点 share 验证（files.py:362-399）— 通过

- 顺序与 `entries.py:196-263` 完全一致：先 public/owner/admin 直通（`files.py:377-388`，owner_id/admin 判定对齐 entries.py），后 `get_entry_with_share`（`files.py:390-393`）。P2-review 注意点 2（public+?share= 不得误判 404）满足。
- 无效 share / slug 不存在 → 同为 `NotFoundError("Entry not found")`（`files.py:375,392`），404 不泄露存在性（BDD-22）。
- 私有+有效 share → 200 且**不设 cookie**（一次访问，BDD-21）；对比 entries.py:238-244 的 set_cookie，raw 分支刻意省略，正确。
- `share` 参数 `max_length=64`（`files.py:520`）> 实际 token 长度（`share_service.py:81` `token_urlsafe(12)`=16 字符），无截断误杀。

### 2. SSRF 防护（entryRef.ts:33-39 + client.ts:157）— 通过

- 协议白名单：`https:` 任意 host；`http:` 仅 `{localhost,127.0.0.1,::1}`（`entryRef.ts:10`）；ftp/file 等请求前抛 EntryRefError（BDD-10/11）。hostname 精确字符串比对，排除了 `localhost.evil.com`、十进制/十六进制 IP 等别名绕过。
- **重定向不跟随**（P2-review 注意点 A）：`redirect: 'manual'` 双路径落地（`client.ts:157` fetchEntryRaw、`client.ts:181` fetchEntryRawAuthenticated 经 request() options 透传）。manual 下 3xx 作为实际响应返回、`response.ok=false` → 直接抛错，302 目标即使返回合法 PeekView JSON 也拒绝（测试 `client.test.ts:360-370` 显式断言）。https→http 内网重定向绕过白名单的路径被切断。
- 响应结构校验兜底：`assertRawResponse`（`client.ts:186-197`）拒绝缺 slug/summary/files 的 JSON（BDD-9）。

### 3. 凭据隔离（client.ts:156 + getEntry.ts:131-136）— 通过

- `fetchEntryRaw` headers 仅 `X-PeekView-Source: mcp`，无 Authorization（`client.ts:156`）。测试 `client.test.ts:279` + `getEntry.test.ts:179` 断言 mock 收到请求不含配置实例 Bearer（BDD-8）。
- URL 形态（kind='url'）恒走匿名；裸 slug（kind='slug'）才走 `fetchEntryRawAuthenticated`（`client.ts:178-184` 带 Bearer）。
- **边界无绕过**：kind='slug' 的判定（`entryRef.ts:18`：无 `://` 且无 `/`）保证任何 URL 形态输入（含 `host/slug` 无 scheme 的畸形输入）都进入 URL 解析分支并被拒绝或解析为 url，永不落入认证路径。shareToken 只在匿名 fetch 的 query 中透传。

### 4. 净化正则（purify.py + purify.ts）— 通过

- 变体覆盖：Markdown `![alt](data:...)`（`purify.py:17-20`）、`<img src="data:...">` 含/无 alt（`purify.py:31-40`）、`Data:IMAGE` 大小写、`data: image/` 空白变体（IGNORECASE + `\s*`）；裸 data URI 兜底（`purify.py:54`）。测试 `test_purify.py` 6 用例覆盖全部变体 + BDD-14 不误伤。
- 字符类无嵌套量词，无灾难回溯；`_IMG_TAG_RE`/`_DATA_IMAGE_RE` 均为线性扫描。
- 净化仅对非二进制文本文件应用（`files.py:472-477`），二进制 content=None 跳过（BDD-13）。

### 5. 响应校验与错误消息（client.ts:161-197 + getEntry.ts:146-163）— 通过

- 非 PeekView JSON / 非 JSON content-type → 错误仅含 host/slug（`client.ts:167,195`），**响应体不进入错误消息**（BDD-9）。
- 404 → 通用文案"该 entry 为私有…或 slug 不存在"（`getEntry.ts:147-155`），不含 share token / 完整 URL（BDD-25；测试 `getEntry.test.ts:346-360` 断言不含 `share=KNOWNTOKEN123`）。非 404 错误经 `translateError`（utils.ts），message 仅 `PeekView API error {status}: {statusText}`，statusText 非响应体。
- 超时：AbortController 30s 默认 + finally clearTimeout（`client.ts:150-175`），AbortError 翻译为明确错误而非挂起（BDD-26；测试 `client.test.ts:386`）。

## Pass 2 — INFORMATIONAL（7 项，均非阻断）

- **[I-1] P4-implementation.md 记录陈旧**：`P4-implementation.md:77-87` 声称 DESIGN_GAP（体积断言不可满足）、SCOPE_GAP（集成测试旧契约）、2 处 ruff 错误"未修改/上报"。但工作树实际已全部修复：`test_raw_share_purify.py:156` 改为 content 长度断言 + 新增 `test_raw_purify_large_payload_shrinks_whole_response`（L161-172，大 fixture 比较整响应体积）、`test_purify.py` 删除未用 `import pytest`、C405 set literal 已修（`test_raw_share_purify.py:122`）、`mcp-integration.test.ts:180,186` 已改 `{ref: slug}`。记录与实际不一致，需主 Agent 校正（或 P7 一致性阶段吸收）。
- **[I-2] 残留旧契约调用（最重要 action）**：`packages/mcp-server/tests/e2e/mcp-e2e.test.ts:171`（`handler({slug:'zufvwz'})`）与 `:271`（`handler({slug:'nonexistent-entry-e2e-test'})`）仍用旧 `{slug}` 契约。zod `z.object({ref:...})`（`getEntry.ts:17`）默认剥离未知键 → 解析为 `{}` → ref undefined → schema.parse 抛错 → 返回 isError。该 spec 在 P6 `make debug-test-mcp` 真实后端在线时（itIfReady）必失败。P4 记录 SCOPE_GAP 只标了 `mcp-integration.test.ts`，**漏掉 e2e spec**。建议主 Agent 在 P6 前让 P3 补修（`{slug}`→`{ref: slug}`），或明确该文件不在 P6 范围。
- **[I-3] assertRawResponse 允许 files 空数组**（`client.ts:191-194`）：设计 2.2 要求"files 非空"，实现仅 `Array.isArray`。非安全缺口（内容来自用户选读 host，空数组只返回"entry 没有文件"），设计忠实度 nit。
- **[I-4] `_MD_IMAGE_RE` 潜在 O(n²)**（`purify.py:17-20` / `purify.ts:2`）：对大量未闭合 `![` 的病理输入，每个 `![` 起点做 O(剩余长度) 回溯 → 大文件 DoS。触发条件：?purify=true + entry 内容被攻击者控制（低危，无放大）。建议对 content 设长度上限或改用 `[^\]]++` 原子组（Python 3.11+ `re` 支持 possessive）。可登记进 DEBT0004 或另立条目。
- **[I-5] KB 舍入双端不一致**：后端 `f"{kb:.0f}"`/`:.2f`（Python round-half-even）vs TS `toFixed`（round-half-away），在 .5 边界占位符 KB 值可能差 1。DEBT0004 契约锚点仅保证共享样例一致，边界值会漂移（cosmetic）。建议统一为 floor 或共享样例补 .5 边界用例。
- **[I-6] 测试副作用污染工作树**：运行后端测试会再生 `backend/zip-*.test.zip`（`test_admin_backup.py:543-594` 写夹具，时间戳变化）→ P4 commit 前需排除这些二进制夹具（git checkout 或确认忽略）。
- **[I-7] async 无新阻塞**：`resolve_entry_raw` 内 purify 为同步线性 regex（大内容有短暂阻塞，可接受，非新引入）；`asyncio.create_task` read tracking 为既有模式（`files.py:497`）。

## MCP 接口契约评审

- **get_entry schema `{ref, file?}` 兼容性**：裸 slug 兼容路径保留（`getEntry.ts:131-132` 走 fetchEntryRawAuthenticated；BDD-4；单测 `getEntry.test.ts:121-130` 与 `tools.test.ts:121`）。向后兼容破坏面（返回结构变化）已按 P0/P1 确认接受。唯一残留：I-2 的 e2e 测试文件旧契约。
- **publish_files Raw URL**：`config.publicUrl`（merge.ts:135 已去尾斜杠）+ `/api/v1/entries/{slug}/raw`（`publishFiles.ts:540`），与 Link 同源（BDD-20；测试 `publishFiles.test.ts:464` 断言 `http://localhost:8080/api/v1/entries/pub-test/raw`）。
- **TS 类型与后端模型一致**：`RawFileItem`（types.ts:55-65）/ `EntryRawResponse`（types.ts:67-74）与 `models.py:527-549` 字段逐一对应（id/filename/path/language/is_binary/size/content/content_encoding/file_url + slug/summary/tags/created_at/files/raw_url）。
- **注册链路**：`getEntryTool(client)` 无 config（`tools/index.ts:17`）→ `effectiveConfig = {peekviewUrl: client.getBaseUrl()}`（`getEntry.ts:107`），裸 slug 解析与认证 fetch 均指向配置实例，一致。

## 结论

**0 CRITICAL。status: approved。** 实现忠实于 P2 方案 A 与 P2-review 锁定决策：share 验证与 get_entry 端点逐行对齐（直通顺序、404 无泄露、不设 cookie）；`redirect: 'manual'` 落地切断 302 绕过；凭据隔离边界无绕过；净化正则变体覆盖且无灾难回溯；响应校验不泄响应体；错误消息不含 token/完整 URL。双端测试 13+268 全绿。

非阻断 action（建议主 Agent 在 P6 前处置）：I-2（e2e 旧契约残留，P6 会失败）、I-1（记录校正）、I-6（zip 夹具排除出 commit）。

[PROD_NOT_TOUCHED]
