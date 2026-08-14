---
phase: P4
task_id: TPV0092-mcp-get-entry-fetch
type: review
parent: P4-implementation.md
trace_id: TPV0092-P4-lead-20260815
status: approved
created: 2026-08-15
agent: review
---

# P4 专家组评审汇总（组长：review）— TPV0092 MCP get_entry 直接读取任意 PeekView 链接

汇总对象：`P4-review-eng.md`（review 专家）+ `P4-review-cso.md`（cso 专家）。组长只汇总，不发表新意见。

## 专家组结论

| 专家 | 结论 | BLOCKER | 关键发现 |
|------|------|---------|----------|
| review（eng） | **approved** | 0 CRITICAL | 0 CRITICAL，7 项非阻断 INFORMATIONAL（I-1~I-7） |
| cso（安全官，retry1） | **approved** | 0 | 0 CRITICAL / 0 HIGH / 0 MEDIUM（上轮 M-1 已修复），残留 2 LOW + 2 INFO，不阻塞 |

**组长判定**：全票无 BLOCKER，无专家组分歧 → `status: approved`。

## 汇总核心结论

1. **实现忠实于 P2 方案 A 与 P2-review 锁定决策**：share 验证与 get_entry 端点逐行对齐（直通顺序、404 无泄露、私有+share 不设 cookie）；SSRF 防护 `redirect: 'manual'` 落地切断 302 绕过；凭据隔离（URL 形态恒匿名，裸 slug 才带 Bearer）边界无绕过。
2. **安全复审通过**：上轮唯一 MEDIUM（响应体大小无上限，内存 DoS）已修复——Content-Length 预检 + 流式累计兜底（超限 abort 先于 `chunks.push`）+ 30s 超时双保险，覆盖 `fetchEntryRaw` 与 `request()` 双路径；超限错误不含完整 URL/token（BDD-25）。
3. **测试证据**：后端 13 passed（test_purify + test_raw_share_purify）；MCP vitest 268/268 passed（cso 本机实测 client/entryRef/getEntry 54/54）。
4. **MCP 接口契约**：`{ref, file?}` schema 兼容裸 slug 路径；publish_files 输出 raw URL 与 Link 同源；TS 类型与后端模型字段逐一对应。

## 非阻断建议（供主 Agent 处置清单，不阻塞 gate）

**review（eng）I-1~I-7：**

- **[I-1] P4-implementation.md 记录陈旧**：声称的 DESIGN_GAP / SCOPE_GAP / 2 处 ruff 错误工作树实际已修复，记录与实际不一致，需主 Agent 校正（或 P7 吸收）。
- **[I-2] 残留旧契约调用（最重要 action）**：`packages/mcp-server/tests/e2e/mcp-e2e.test.ts:171` 与 `:271` 仍用旧 `{slug}` 契约，P6 `make debug-test-mcp` 真实后端在线时必失败。建议 P6 前让 P3 补修（`{slug}`→`{ref: slug}`），或明确该文件不在 P6 范围。
- **[I-3] assertRawResponse 允许 files 空数组**（client.ts:191-194）：设计 2.2 要求"files 非空"，实现仅 `Array.isArray`，设计忠实度 nit，非安全缺口。
- **[I-4] `_MD_IMAGE_RE` 潜在 O(n²)**（purify.py:17-20 / purify.ts:2）：大量未闭合 `![` 病理输入有回溯放大（低危）。建议 content 长度上限或 `[^\]]++` 原子组，可登记 DEBT0004 或另立条目。
- **[I-5] KB 舍入双端不一致**：后端 round-half-even vs TS toFixed round-half-away，.5 边界占位符 KB 值可能差 1（cosmetic）。建议统一 floor 或补 .5 边界用例。
- **[I-6] 测试副作用污染工作树**：运行后端测试会再生 `backend/zip-*.test.zip`（时间戳变化），P4 commit 前需排除这些二进制夹具。
- **[I-7] async 无新阻塞**：purify 同步线性 regex 大内容有短暂阻塞（可接受，非新引入）。

**cso（安全）LOW/INFO：**

- **[LOW-1] 阈值边缘功能取舍**：后端 `max_file_size` 默认 20MB，单文件恰 20MB 的 entry raw 响应含 JSON 开销会略超 `MAX_RESPONSE_BYTES` 被拒，属安全硬上限与功能的取舍，建议文档/DEBT 注明。
- **[LOW-2] 新代码路径无专项单测**：`readTextWithLimit`/`readJsonWithLimit`/超限分支未见对应测试，建议补 Content-Length 预检 + 流式超限各 1 例，记 DEBT。
- **[INFO-1] 阈值文档依据不实**：`P4-implementation.md:118` 引用"后端单文件截断线约 2MB"实际为前端 display 截断，需更正表述。
- **[INFO-2] `validateToken` 仍直接 `res.json()`**：仅面向配置实例受信小响应，无外部 host 攻击面，非新风险。

## 建议 P6 前优先处置

I-2（e2e 旧契约残留，P6 必失败）＞ I-1（记录校正）、I-6（zip 夹具排除出 commit）＞ 其余（I-3/I-4/I-5/I-7 + LOW-1/LOW-2 + INFO-1/INFO-2 记 DEBT，不阻塞）。

[PROD_NOT_TOUCHED]
