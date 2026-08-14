
## 2026-08-15 P3 test-designer 启动
- 已读：P3-dispatch-context-test-designer.md、test-designer.md（角色定义）
- 已读：P2-design.md（方案 A：MCP 解析 + 匿名直读 + 后端补参数）、P1-requirements.md（26 BDD）、P2-review.md（3 项非阻塞建议）、P0-brief.md
- 关键结论：
  - 双端测试：后端 pytest（raw ?share=/?purify= + purify_content）+ MCP vitest（entryRef/purify/getEntry）
  - 26 BDD 1:1 映射表在 dispatch-context 已给，直接沿用
  - 净化共用样例：data:image 变体（![alt]/<img>/大小写/空白）作为双端契约锚点（DEBT0004 closure_criteria）
  - P2-review 非阻塞采纳：重定向拒绝测试 + SSRF 白名单测试（BDD-10/11）+ file= 无匹配/多匹配错误路径
- 待读：backend files.py、MCP getEntry.ts/client.ts、tests/tools.test.ts、backend/tests/ 结构

## 2026-08-15 P3 test-designer 输入读取
- 已读：backend files.py:352-471（raw 端点现状：无 share/purify 参数，resolve_entry_raw 直接 get_entry + cookie 兜底）、entries.py:180-263（get_entry share 分支：public/owner/admin 直通优先，再 get_entry_with_share）、entry_service.py:1019-1061（get_entry_with_share 已存在）、share_service.py:188-240（verify_share_token：SHA256 hash 校验 + view_count+1）
- 已读：MCP getEntry.ts（schema={slug} 元数据文本列表）、client.ts（request() 恒带 Bearer + AbortController 30s 模式）、publishFiles.ts:539（Link: 行，无 Raw URL）、types.ts、tools/index.ts（getEntryTool(client) 单参）、config.ts/merge.ts（publicUrl）
- 已读测试先例：test_raw_api.py（client fixture + _create_public/private_entry 模式）、test_share_create.py（register→private entry→create share→token 从 share_url 提取）、tools.test.ts/client.test.ts/publishFiles.test.ts（msw setupServer + makeConfig + SessionContext）
- **关键发现**：`make test-mcp-unit` = `npm run test:unit`，package.json 里 test:unit 是**显式文件列表**——新增 entryRef.test.ts/purify.test.ts/getEntry.test.ts 必须登记进 package.json 才会被跑。这是测试接线必需的最小 package.json 改动（非实现文件），已记录将在此 task 内执行
- 关键发现：getEntry 新契约需裸 slug 解析 peekviewUrl → 测试按 `getEntryTool(client, config)` 调用（与 publishFilesTool 同模式；若 P4 保持单参，额外参数运行时被忽略，mock host 仍是 localhost:8080 不敏感）

## 2026-08-15 P3 产出落盘
- P3-test-cases.md 已写（Write 工具）：test_code_dir 声明 + 26 BDD 1:1 映射（40 条用例含 P2-review 采纳项）+ 净化共用样例契约锚点 + 红灯确认方式
- 测试代码已写：
  - backend/tests/test_purify.py（purify_content 单测，共用样例，import 失败红灯）
  - backend/tests/test_raw_share_purify.py（raw ?share=/?purify= 集成，BDD-21/22/23/24 + 二进制结构）
  - packages/mcp-server/tests/entryRef.test.ts（parseEntryRef 5 形态 + 白名单 + EntryRefError）
  - packages/mcp-server/tests/purify.test.ts（purifyContent 共用样例）
  - packages/mcp-server/tests/getEntry.test.ts（getEntry handler BDD-1~19/25 全套 msw mock）
  - packages/mcp-server/tests/client.test.ts（扩展 fetchEntryRaw/fetchEntryRawAuthenticated：BDD-5/7/8/9/13/26 + 302 重定向）
  - packages/mcp-server/tests/publishFiles.test.ts（扩展 BDD-20 Raw URL）
  - packages/mcp-server/tests/tools.test.ts（get_entry describe 改写为新契约 {ref} + JSON 输出）
- package.json test:unit 已登记 3 个新文件（测试接线必需，非实现文件）——git diff 确认已生效
- 下一步：自跑确认红灯（先 targeted 后 make 目标）

## 2026-08-15 P3 红灯自跑确认（完成）
- 后端 `make test-quick`：**3 failed + 1 error**（1081 passed 无回归）
  - test_purify.py → ImportError: No module named 'peekview.services.purify'（B 类）
  - test_raw_share_purify.py → BDD-21 valid share 404（应 200）/ BDD-23 purify 未剥离（B 类断言）
  - ⚠️ 调试中发现测试代码 bug：owner client 带 JWT cookie → 私有无 token 也 200（owner 直通掩盖 share 行为）→ 已改用匿名 client 发起 share 请求（修正后红灯为真红灯）
- MCP `make test-mcp-unit`：**28 failed | 219 passed**（全为新/改测试，B 类）
  - entryRef/purify.test.ts → Failed to load url (模块不存在)
  - client.test.ts fetchEntryRaw → TypeError not a function
  - getEntry.test.ts / tools.test.ts → ZodError（handler 未接受 ref）
  - publishFiles BDD-20 → 缺 Raw URL
  - ⚠️ 调试中发现：测试文件顶部 `import * as http` 会破坏 msw 拦截（全部请求 5s 超时）→ 移除该静态导入，BDD-26 改用 msw never-resolving handler（已实证 msw 尊重 AbortController → AbortError）
- 全部红灯为 B 类（模块未实现/方法不存在/断言与未实现行为矛盾），无"断言与测试数据矛盾"类测试代码 bug 残留
- 状态标记：[PROD_NOT_TOUCHED]（仅临时 HOME/tmp_path/msw mock，未触碰 :8080 与 ~/.peekview/）
