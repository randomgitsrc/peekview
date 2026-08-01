# P3 progress — T075 frontend test-designer

## 2026-08-01
- 已读：P3-dispatch-context-frontend-test-designer.md、execution-roles/test-designer.md、P0-brief.md
- 已读：P1-requirements.md（BDD-07~53 前端 47 条）、P2-design.md（§3.2~3.13 设计 + gate_commands）
- 待读：useEntryDetailComputed.ts、EntryDetailContent.vue、Pagination.vue、CodeViewer.vue、Pagination.spec.ts、useShiki.spec.ts
- 已读：useEntryDetailComputed.ts（现有 isMarkdown/isHtml/isImage/isBinary，无 isCsv 等 → 新测试 import 失败红灯）
- 已读：EntryDetailContent.vue（调度链 isHtml→isMarkdown→isImage→CodeViewer，无 TableView/TreeView）
- 已读：Pagination.vue（props: page/perPage/total, emit: update:page）
- 已读：CodeViewer.vue（props: content/filename/language/wrap/canWrap/loading）
- 已读：Pagination.spec.ts（mount + props/emit 断言模式）
- 已读：useShiki.spec.ts L1-40（composable 测试模式）

## [T075-P3] backend test-designer 分阶段落盘（2026-08-01）

### 输入文件已读
1. P3-dispatch-context-backend-test-designer.md — 目标：BDD-01~06 后端测试，红灯；约束：只碰 backend/tests/test_language.py，不改 language.py
2. test-designer.md 角色定义 — 1:1 BDD→测试映射，测试名引用 BDD 编号
3. P0-brief.md — env_constraints：debug_env=make debug；[PROD_NOT_TOUCHED]
4. P1-requirements.md — BDD-01~06（后端语言检测）：csv→csv / tsv→tsv / json→json / yaml→yaml / yml→yaml / xml→xml
5. P2-design.md §3.1 — language.py:69 `.tsv: "csv"`→`"tsv"`，PLAIN_TEXT_LANGS 加 tsv，count 14→15
6. backend/peekview/language.py — L69 `.tsv: "csv"`（bug 确认）；L255-270 PLAIN_TEXT_LANGS=14 无 tsv
7. backend/tests/test_language.py — TestDetectLanguage（test_xxx_file 模式）+ TestPlainTextLanguages.test_plain_text_langs_count 断言 14

### 关键事实
- 现有 test_json_file / test_yaml_file 已覆盖 BDD-03/04/05 功能，但无 BDD 编号命名，按派发指引补 BDD 命名测试
- 红灯来源：test_bdd_02_tsv_returns_tsv（当前 .tsv→'csv'）、test_plain_text_langs_count（14≠15）、test_contains_tsv（无 tsv）

### 产出完成
- backend/tests/test_language.py 改动落盘：BDD-01~06 六个方法加入 TestDetectLanguage + test_contains_tsv 加入 TestPlainTextLanguages + test_plain_text_langs_count 14→15
- 实测 pytest：3 failed / 60 passed（test_bdd_02_tsv_returns_tsv / test_contains_tsv / test_plain_text_langs_count）— 真红灯确认
- 产出 P3-test-cases-backend.md（BDD→测试映射表 + 红灯原因 + 实测结果）
- [PROD_NOT_TOUCHED]（全程仅读源码/改测试文件，未接触生产服务与数据库）

## 测试设计与红灯验证完成
- 产出 6 个测试文件（P3-test-code/ 规范副本 + frontend-v3 运行副本）：
  - useEntryDetailComputed.structured.spec.ts（6 用例：BDD-07~11 + isRichRenderable）
  - useCsvParser.spec.ts（9 用例：BDD-14/15/16/22/23/49 + BOM/TSV）
  - useTreeData.spec.ts（11 用例：BDD-24/25/26/29/32/36）
  - TableView.spec.ts（13 用例：BDD-12~22/23/49）
  - TreeView.spec.ts（13 用例：BDD-24~36）
  - structured-data-viewer.spec.ts（E2E 42 用例：BDD-12~53）
- 红灯确认（npx vitest run）：5 failed files | 6 failed tests | 1129 passed | 1 skipped
  - 4 个文件 B 类红灯（import 失败：TableView/TreeView/useCsvParser/useTreeData 不存在）
  - 1 个文件 classic 红灯（6 个断言失败：isCsv 等未返回 → expected undefined to be true）
  - 既有 1129 测试全绿，无回归
- 教训记录：vi.hoisted 内不能引用静态 import 的 `ref`（TDZ ReferenceError），改用 vi.doMock + vi.resetModules + await import() 动态 mock 模式（dispatch 推荐）
- E2E spec esbuild 语法校验通过；P3 阶段无法运行（需 debug backend），P5/P6 用 E2E_SPEC=... make debug-test

## 自检完成
- P3-test-cases.md 含 test_code_dir 声明 ✓
- P3-test-code/ 6 个文件非空（52 vitest + 42 E2E = 94 用例）✓
- BDD-07~53 全部 1:1 覆盖（grep 校验无缺失）✓
- UI 任务 Playwright E2E 用例存在（42 条）✓
- 红灯确认：5 failed files | 6 failed tests | 1129 passed | 1 skipped，无回归 ✓
- 未修改任何实现代码（git status 仅新增测试文件 + docs）✓
- [PROD_NOT_TOUCHED]
