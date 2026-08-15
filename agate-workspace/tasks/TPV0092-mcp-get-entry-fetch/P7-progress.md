# P7 一致性审查进度（consistency-reviewer）

## 2026-08-15 进度

- [x] 读 P7-dispatch-context-consistency-reviewer.md（派发指引 7 项特别关注点已明确）
- [x] 读角色定义 architect.md（P7 模式：批判第三方视角、双向一致性检查、DESIGN_GAP 转抄配对）
- [x] 读 P1-requirements.md（26 BDD：BDD-1~26；[NO_NEED_CONFIRM] 有；5 SUGGEST；无 NEED_CONFIRM 残留）
  - BDD 分段：URL 形态解析 BDD-1~5 / 跨 host BDD-6~8 / SSRF BDD-9~11 / 净化 BDD-12~14 / 返回策略 BDD-15~19 / publish_files BDD-20 / raw 扩展 BDD-21~24 / 安全边界 BDD-25~26
  - SUGGEST：S1 匿名 fetch 不注入凭据 / S2 get_entry 加 file 参数 / S3 净化后端主实现 / S4 错误消息不打完整 URL / S5 raw_url 格式
- [x] 读 P2-design.md（候选方案 A 选定；§2 详细设计 2.1~2.6；[SCOPE+] 无；packages=[backend, packages/mcp-server]；ui_affected=false；gate_commands 固化）
  - P2 设计文件清单：files.py + purify.py(新增) + entryRef.ts(新增) + purify.ts(新增) + client.ts + types.ts + getEntry.ts + publishFiles.ts
  - P2 关键决策：不经 302 直连 API / publicUrl 一致性 / 凭据隔离（匿名 fetch）/ 净化后端主实现 MCP 兜底
  - P2 注意：env_constraints 里 dev-server.sh 硬编码 8888，P6 第二实例需手动命令（→ P7 关注 infra 改动判定）
- [x] 读 P3-test-cases.md（40 用例：26 BDD 1:1 映射 + P2-review 采纳 4 项 #37~40；契约锚点：purify.py 签名 / files.py share+purify 参数 / entryRef / purify / client fetchEntryRaw+Authenticated / getEntry schema / publishFiles Raw URL；DEBT0004 共用净化样例双端逐字一致；#20/#35 为回归守卫）
- [x] 读 P4-implementation.md
  - [DESIGN_GAP: backend test_raw_purify_strips_base64_image 体积断言数学不可满足]（已标注"闭环：P3 retry1/retry2 修复"：content 级断言 + 新增大 fixture 整响应测试，1091 passed）
  - [SCOPE_GAP: mcp-integration.test.ts 仍用旧 {slug} 契约]（已标注闭环：改 {ref: slug} + mcp-e2e.test.ts:171,271 补漏，268 passed）
  - 2 处 ruff 测试文件错误已修；.gitignore 例外 `!packages/mcp-server/src/lib/` 已加
  - retry1 修复：M-1 响应体上限（MAX_RESPONSE_BYTES=20MB / MAX_ERROR_BYTES=1MB / readTextWithLimit 流式兜底）+ I-3 files 非空校验 + I-5 KB 舍入不修（cosmetic DEBT）
  - redirect: 'manual' 采纳（P2-review 注意点 A）
- [x] 读 P5-test-results/（unit.md + fail-list.txt：后端 1091 passed（第 1 轮 1 预存 flaky test_admin_backup 已排除）；MCP 268 passed；typecheck 过；ruff 过；debug-test-mcp 留给 P6）
- [x] 读 P6-acceptance.md（26/26 PASS，0 FAIL；ui_affected=false；gate debug-test-mcp：unit 268 + integration 过 + 前端 e2e 3 失败=预存 DEBT0005 移动端 FileTree；BDD 逐条含证据文件）
- [x] 读实现代码（只读审查）
  - backend/peekview/services/purify.py：purify_content 纯函数，MD/IMG/DATA 三层正则，占位符 `[image: {alt} ({kb} KB, base64)]`，普通文本原样
  - backend/peekview/api/files.py:352-524：resolve_entry_raw(share/purify) + get_entry_raw(Query) 实现与 P2§2.6 一致；share 分支先 public/owner/admin 直通再 get_entry_with_share；purify 仅非二进制文本；raw_url 用 request.base_url；main.py:599-601 调用兼容（缺省参数）
  - packages/mcp-server/src/lib/entryRef.ts：5 形态 + 协议白名单（http 仅 localhost/127.0.0.1/::1）+ 路径穿越拒绝，kind 归一 'url'（P3 允许）
  - packages/mcp-server/src/lib/purify.ts：与后端正则逐字同构（DEBT0004）
  - client.ts：fetchEntryRaw 匿名（无 Authorization）+ redirect:manual + 超时 + 响应结构校验（含 I-3 files 非空）；fetchEntryRawAuthenticated 复用 request() Bearer + redirect:manual；M-1 readTextWithLimit（20MB/1MB）
  - getEntry.ts：schema {ref,file?}，返回策略 5 场景，file= path+filename 优先，404→"无法读取"，EntryRefError 直返 message
  - publishFiles.ts:540：Raw URL 用 config.publicUrl
  - types.ts：EntryRawResponse/RawFileItem 已加
  - .gitignore:79 `!packages/mcp-server/src/lib/`（git ls-files 确认 entryRef/purify 被跟踪）；Makefile debug-extra/stop/status + dev-server.sh PORT 参数化（**均未 commit，工作区 M**）
- [x] 基础设施改动判定：.gitignore 必要修复（否则 P4 产出缺文件）；Makefile/dev-server.sh 测试基础设施（P6 :8889 需要）。均非 [DEVIATION]/[SCOPE+]。⚠️ 但 Makefile + dev-server.sh 改动尚未 commit，需主 Agent 随 P7 commit 纳入
- [x] 验证 P3 retry 闭环：test_raw_share_purify.py 体积断言改 content 级 + 新增 large payload 整响应测试；mcp-integration.test.ts:180,187 + mcp-e2e.test.ts:171,271 均改 {ref: ...}
- [x] P6 证据核验：bdd 日志 26 项 + debug-test-mcp.log（268 unit + 12 integration + 11 passed/3 failed Mobile FileTree）+ DEBT0005 已登记 + EXIT_CODE:0
- [x] 未决项：P1 [NO_NEED_CONFIRM]，5 SUGGEST 全部落地（S1 匿名 fetch/S2 file 参数/S3 后端主实现/S4 不打 URL/S5 publicUrl 格式）
- [x] 产出 P7-consistency.md
