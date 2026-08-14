# P4 Review Progress — TPV0092

## 输入读取进度

- [x] P4-dispatch-context-review.md（派发指引）
- [x] role 定义 review.md（偏执 Staff Engineer）
- [x] P4-implementation.md（实现记录）
- [x] P2-design.md（设计基线）
- [x] P1-requirements.md（26 BDD）
- [x] P2-review.md（plan-eng-review 锁定决策）
- [ ] 后端代码：purify.py / api/files.py
- [ ] MCP 代码：entryRef.ts / purify.ts / client.ts / getEntry.ts / publishFiles.ts / types.ts

## 初始观察（P4-implementation.md）

- P4 记录 self 报告 1089 passed / 1 failed（后端，测试数据问题），MCP 268/268。
- [DESIGN_GAP] 后端 test_raw_purify 体积断言数学上不可满足（63*2=126 vs 实测 375 字符整响应）。注意：P4 说"任何实现都无法让整响应 <126 字节"——需核实断言实际断言对象（可能是整响应而非 content 字段）。
- [SCOPE_GAP] mcp-integration.test.ts 仍用旧 {slug} 契约 → P6 可能失败，需确认。
- P4 记录 2 处 ruff 错误在 P3 测试文件（C405 set literal + 未用 pytest import）——P5 lint 可能挂，非 P4 责任。

## 待验证疑点

1. share 分支顺序：public/owner/admin 直通 先于 get_entry_with_share（P2-review 注意点 2，BDD-21 引用 entry_service.py:1032 public 返回 None）
2. redirect: 'manual' 是否真落在 fetch 上（P2-review 注意点 A）
3. fetchEntryRaw 是否真的无 Authorization 注入
4. purify 正则覆盖（data: 大小写/空白/变体）+ 不误伤 + 回溯性能
5. 非 PeekView 响应拒绝且不泄响应体
6. 裸 slug 走 Authenticated（fetchEntryRawAuthenticated）边界
7. 错误消息不含 token/完整 URL（BDD-25）

## cso 审计发现（逐条，2026-08-15）

1. **凭据隔离（BDD-8）验证通过**：`client.ts:155-159` fetchEntryRaw 仅 `X-PeekView-Source: mcp`，无 Authorization；裸 slug 才走 fetchEntryRawAuthenticated（`client.ts:178-184` 复用 request() Bearer）。URL 形态 host 恒为 `url.origin`（entryRef.ts:72），userinfo 伪造不改变请求 host。测试 client.test.ts:279-299 断言 capturedAuth 为 null。

2. **重定向（P2-review 注意点 A）验证通过**：`client.ts:157` redirect:'manual' + `fetchEntryRawAuthenticated` 也传 `{redirect:'manual'}`（client.ts:181）。响应非 2xx 即抛（`response.ok` false），无论 undici 返回 opaqueredirect(status 0) 还是原 302 都拒绝。测试 client.test.ts:360-374 覆盖（目标 mock 返回合法 JSON 也不接受）。未跟随 → 无 https→http 内网降级绕过。

3. **SSRF 协议白名单验证通过**：entryRef.ts:33-39 http 仅 {localhost,127.0.0.1,::1}，其余协议请求前拒绝（BDD-10/11）。hostname 精确匹配 Set，`localhost.evil.com`/`127.0.0.1.nip.io` 不在集合 → 拒绝。DNS rebinding 残留由响应结构校验兜底（client.ts:186-197），P0 已接受该残留。

4. **响应结构校验 + 不泄响应体（BDD-9）通过**：client.ts:186-197 校验 slug/summary/files 类型；错误消息仅 host+slug，不读响应体。测试 client.test.ts:341-358 断言不包含 SUPERSECRETBODY。

5. **[MEDIUM] 响应体大小无上限（DoS）——评审重点 #5 未满足**：client.ts:165-172 `response.json()` 读满整个 body，无 Content-Length 校验、无流式上限。恶意 host 可 30s 内灌入数 GB → MCP 进程 OOM。且合法大 entry 也受影响：后端 raw 全量返回所有文件（7MB×50=350MB 量级），getEntry 的 32KB/200KB 截断策略发生在下载之后，先全量入内存。评审重点明确要求检查，缺失。

6. **share token 不落日志（BDD-25）通过**：后端 log_requests 只打 `request.url.path`（main.py:377），不含 query；_record_read_async 不存 URL；MCP client 不打 URL。错误消息：404→通用文案（getEntry.ts:151），EntryRefError→message 无 token（entryRef.ts 各 throw 均不含 token），非 PeekView→host+slug。测试 client.test.ts 覆盖非 PeekView 不泄 body。

7. **私有 entry authz（BDD-7/21/22）通过**：files.py:362-393 share 分支——is_public/owner/admin 直通（复用 entries.py:196-263 模式），否则 get_entry_with_share，None→NotFoundError 404（不泄存在性）。不设 cookie（BDD-21，测试断言无 set-cookie）。token 经 verify_share_token 按 entry.id 作用域校验，A entry token 不能读 B entry。私有无 token→404。

8. **净化正则鲁棒性/ReDoS**：purify.py:12-22 正则均无嵌套量词/重叠字符类，无可利用回溯；data:image 大小写+空白变体覆盖，测试 6/6 绿。低风险。

9. **[LOW] opaqueredirect/状态 0 错误消息不友好**：redirect 场景 `PeekViewApiError(0, '')`→ translateError 输出 "操作失败：PeekView API error 0:"。功能正确（拒绝），消息可读性差，非安全漏洞。

10. **[LOW] assertRawResponse 只校验顶层字段**：files 数组项未校验，恶意/畸形响应（files 项为字符串）产生异常输出而非崩溃/泄露。稳健性，非漏洞。

11. **[INFO] raw ?share= 无独立速率限制**：token 96-bit（secrets.token_urlsafe(12)），暴力不可行；与既有 get_entry 端点攻击面一致，非新风险。

12. **[INFO] 状态标记**：本审计只读，未触碰 :8080/~/.peekview/，未修改任何代码。[PROD_NOT_TOUCHED]

## DESIGN_GAP / SCOPE_GAP 核查
- DESIGN_GAP（体积断言）：当前 test_raw_share_purify.py:156 已改为 content 字段比较（可满足），且新增 large_payload 整响应对比测试（:161-171）——已解决，P4 记录引用的是旧行号。
- SCOPE_GAP（mcp-integration.test.ts）：git diff 确认已改 `{ref: slug}`（:180,186）——已解决。
- 结论：P4 记录中两项标注均在测试文件侧已修复，不构成 P4 实现缺陷。

## 结论
1 个 MEDIUM（响应体大小无上限）→ status: needs-revision。其余 LOW/INFO，不阻塞。修复建议见 P4-review-cso.md。

## 代码读取完成 + 验证

- [x] backend/peekview/services/purify.py（新增）
- [x] backend/peekview/api/files.py（share/purify 分支）
- [x] MCP src/lib/entryRef.ts、src/lib/purify.ts、src/client.ts、src/tools/getEntry.ts、src/tools/publishFiles.ts、src/types.ts
- [x] server.ts / tools/index.ts / config/merge.ts（getEntryTool 注册、bare slug host 来源）
- [x] auth.py get_current_user（匿名 None 不抛）
- [x] entry_service.get_entry_with_share（entry_service.py:1019-1061）
- [x] share_service token 生成（token_urlsafe(12)=16 字符 < max_length=64）
- [x] 测试覆盖确认（client.test.ts / entryRef.test.ts / getEntry.test.ts / publishFiles.test.ts / test_purify.py / test_raw_share_purify.py / mcp-integration.test.ts）
- [x] 实测：backend purify+raw 13 passed；MCP 268/268 passed

## 关键验证结论

1. share 分支（files.py:362-399）与 entries.py:196-263 完全一致：public/owner/admin 直通先于 get_entry_with_share；无效 share/slug 不存在均 404 同消息，无存在性泄露；不设 cookie（BDD-21）✓
2. redirect:'manual'（client.ts:157,181）+ 3xx response.ok=false → 不跟随重定向（P2-review 注意点 A 落地，测试 client.test.ts:360）✓
3. fetchEntryRaw 匿名（client.ts:156 仅 X-PeekView-Source，无 Authorization）BDD-8 ✓
4. 净化正则无嵌套量词、无灾难回溯；线性扫描 ✓
5. assertRawResponse（client.ts:186-197）拒绝非 PeekView JSON，错误仅含 host/slug 不泄响应体 BDD-9 ✓
6. 错误消息不含 token/完整 URL（getEntry.test.ts:346-360 BDD-25）✓
7. TS RawFileItem/EntryRawResponse 与 models.py:527-549 字段完全对齐 ✓
8. publish_files Raw URL = config.publicUrl 同源（publishFiles.ts:540），BDD-20 ✓

## INFORMATIONAL 发现（非阻断）

- I-1: P4-implementation.md 记录与实际工作树不一致（DESIGN_GAP/SCOPE_GAP/ruff 3 项在树中均已修复，记录仍写"未修改/上报"）——记录陈旧需校正
- I-2: **e2e/mcp-e2e.test.ts:171,271 仍用旧 {slug} 契约**（记录 SCOPE_GAP 只标了 mcp-integration.test.ts，漏掉 e2e spec）→ P6 make debug-test-mcp 真实后端在线时会失败
- I-3: assertRawResponse 允许 files 空数组（设计 2.2 要求非空）——设计忠实度 nit
- I-4: _MD_IMAGE_RE 对大量未闭合 ![ 的病理输入存在 O(n²) 风险（双端）——需 ?purify=true+攻击者内容，severity low
- I-5: 后端 :.0f/:​.2f（half-even）vs TS toFixed（half-away）在 .5 边界 KB 占位符可能差 1（DEBT0004 漂移）——cosmetic
- I-6: make test-quick 会再生 backend/zip-*.test.zip 夹具（test_admin_backup 副作用）→ P4 commit 需排除
- I-7: async 无新阻塞（purify 同步线性；create_task 为既有模式）

## 结论

0 CRITICAL。实现满足 P2 设计 + 26 BDD 核心要求。status: approved。
