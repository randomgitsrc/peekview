
## P4 progress (implementer) — 2026-08-15

- 已读 P4-dispatch-context-implementer.md：实现清单明确（后端 purify.py + files.py；MCP entryRef.ts/purify.ts/client.ts/getEntry.ts/publishFiles.ts/types.ts），约束=只实现 P2 方案、不改测试、P2-review 非阻塞建议落实（redirect manual、不打印 token/URL、public 先直通）。
- 已读 implementer.md 角色定义：最小实现原则；SCOPE_GAP/DESIGN_GAP 上报机制；自查≠gate。
- 已读 P0-brief.md / P2-design.md / P2-review.md / P3-test-cases.md：契约锚点已掌握。
- 已读 P3 后端测试 test_purify.py（6 用例）+ test_raw_share_purify.py（7 用例）：契约锚点 = purify_content(content)->str + get_entry_raw 加 share/purify 参数，share 分支 public/owner/admin 先直通再 get_entry_with_share。
- 已读 P3 MCP 测试 entryRef.test.ts / purify.test.ts / getEntry.test.ts / client.test.ts / publishFiles.test.ts / tools.test.ts：契约锚点 = parseEntryRef(ref, config)->{kind,host,slug,shareToken?} / purifyContent / fetchEntryRaw(+Authenticated) / getEntryTool(client, config) schema {ref,file?} / publish_files Raw URL。
- 注意：getEntry.test.ts 用 getEntryTool(client, config) 双参调用；tools.test.ts 用 getEntryTool(client) 单参——实现签名需兼容（config 可选）。

- 已读 backend files.py:340-471（resolve_entry_raw/get_entry_raw 结构）、entries.py:1-279（share 分支模式 196-263 + _check_share_cookie）、entry_service.py:323-372+1010-1069（get_entry/get_entry_with_share）、models.py:527-549（EntryRawResponse/RawFileItem）、main.py:207-236（app.state.share_service 恒存在）。
- 已读 MCP getEntry.ts/client.ts/publishFiles.ts/types.ts/merge.ts/utils.ts/index.ts/config.ts：getEntryTool 现签名 (client)，index.ts 调 getEntryTool(client)；tests 用 (client, config) 双参 → 签名改 (client, config?) 兼容，config 缺省时用 client 内部 baseUrl（需加 getBaseUrl() getter）。
- 关键实现点：share 分支严格按 entries.py:196-263 顺序（先 public/owner/admin 直通，再 get_entry_with_share）；raw 不设 cookie；purify 只净化非二进制文本。

- 后端实现完成：purify.py 新增 + files.py 加 share/purify 参数 + share 分支（先 public/owner/admin 直通再 get_entry_with_share）+ purify 净化后段。test_purify.py 6/6 绿。
- 后端 7 个 raw_share_purify 测试 6 绿 1 红：test_raw_purify_strips_base64_image 的 `len(resp.text) < len(MARKDOWN_WITH_IMAGE)*2`（<126）断言对 63 字符样例数学上不可满足——净化后 JSON envelope 本身约 375 字符。属测试数据/断言矛盾（P3 文档自己的红灯判定规则明确此属"测试代码 bug"），P4 禁改测试 → 上报，不静默跳过。

- MCP 实现完成：types.ts 加 EntryRawResponse/RawFileItem；新增 src/lib/entryRef.ts + src/lib/purify.ts；client.ts 加 getBaseUrl()/fetchEntryRaw(匿名+redirect:manual+purify恒带+响应校验)/fetchEntryRawAuthenticated(复用request Bearer)；getEntry.ts 重写 schema {ref,file?} + parseEntryRef → 匿名/认证 fetch → 返回策略 → JSON；publishFiles.ts Link: 后加 Raw URL 行。
- MCP make test-mcp-unit：268/268 全绿（17 文件）。typecheck 通过。
- lint：实现文件（backend/peekview/ + packages/mcp-server/src/）ruff 全过；2 个错误均在 P3 测试文件（test_purify.py 未用 pytest import；test_raw_share_purify.py C405 set literal）——P4 禁改测试，上报主 Agent。
- 待办：写 P4-implementation.md；确认文件落盘（grep 自查）。

- P4-implementation.md 已写入。含 implementation_dir 声明、改动摘要、测试结果、[DESIGN_GAP]×1（raw 体积断言不可满足）、[SCOPE_GAP]×1（集成测试旧契约）。
- 最终自查：make test-quick 1089 passed 1 failed（唯一失败=P3 测试数据问题）；make test-mcp-unit 268/268 全绿；typecheck 过；实现文件 lint 干净。

## P4 progress (implementer retry1) — 2026-08-15

- 已读 P4-dispatch-context-implementer-retry1.md（修复目标：cso MEDIUM 响应体无上限 + I-3 files 非空）、P4-review-cso.md（M-1 详情）、P4-review-eng.md（I-3/I-5）。
- 已读 client.ts 当前实现（request/fetchEntryRaw 均用 response.json() 无上限）、client.test.ts 全量（fetchEntryRaw 302/超时/匿名/404/非PeekView mock 均小响应）、getEntry.ts（32KB/200KB 策略、SNIPPET 2000）。
- 阈值核验：后端 config.py 默认 max_file_size=20MB、max_entry_size=100MB、FTS 每 entry 1MB；前端 TreeView 2MB 截断（display）。dispatch 指定 20MB 硬上限（10 倍富余于合法体积），采纳。
- M-1 实现完成：client.ts 新增 MAX_RESPONSE_BYTES=20MB / MAX_ERROR_BYTES=1MB + readTextWithLimit（Content-Length 预检 + 流式累计兜底）+ readJsonWithLimit；request() 成功/错误路径 + fetchEntryRaw 成功路径全部接入；错误消息含 host/slug 不含 URL/token（BDD-25）。
- I-3 实现完成：assertRawResponse 追加 files.length===0 拒绝，对齐 P2-design §2.2。
- 自查：make test-mcp-unit 268/268 全绿；MCP tsc --noEmit 过；ruff（系统 python3）All checks passed；make typecheck（vue-tsc）过。eslint 未安装为预存环境问题。
- 待办：写 P4-implementation.md retry1 修复说明（含阈值理由）；grep 自查上限逻辑落盘。
