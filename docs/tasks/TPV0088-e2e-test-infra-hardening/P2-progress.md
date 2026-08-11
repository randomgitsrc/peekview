# P2 progress — TPV0088-e2e-test-infra-hardening

## 读取记录

- [x] P2-dispatch-context-architect.md（派发指引：两个子任务，候选可单方案 follows_existing_pattern，四字段必填，minimal_validation 验证 mtime 比对）
- [x] architect.md（角色定义：P2 产出方案设计+实现导航 files_to_read；四字段写 frontmatter；minimal_validation 必须声明）
- [x] P0-brief.md（环境约束 + 代码审计：子任务 A 20 用例（P1 修正为 19），子任务 B debug-test 前置检查加 mtime 校验）
- [x] P1-requirements.md（9 BDD + IMPL-S1~S12 死选择器 + IMPL-D1~D4 数据依赖 + IMPL-B1~B3 mtime 边界）
- [x] P1-review.md（approved：19 用例计数一致，mtime 口径统一 src-vs-static/index.html）
- [x] frontend-v3/e2e/viewer.spec.ts（315 行，6 describe 19 用例，hash 路由 + lu4prg/ngajri slug + 死选择器逐一可见）
- [x] scripts/e2e-safety-check.sh（114 行，Check 1-5，Check 2 用 curl /health，新增 Check 6 位置在 Check 2 之后）
- [x] Makefile:540-650（debug-quick/debug-build/debug-test；debug-test Step1 调 e2e-safety-check.sh，E2E_GUARD_ENABLED=1 NONINTERACTIVE=1）
- [x] AGENTS.md（铁律 7：前端 URL 是 /{slug}；debug-test/E2E 约定；测试隔离）
- [x] 前端组件核实：router.ts createWebHistory；EntryDetailMobileBar.vue data-testid(mobile-bottom-bar/mobile-bar-filetree-btn/mobile-bar-toc-btn/mobile-bar-wrap-btn/mobile-bar-copy-btn)；EntryDetailContent.vue file-sidebar/toc-sidebar/drawer；TocNav toc-nav/toc-item；TreeNodeItem file-item/file-name/active；ThemeToggle.theme-toggle；EntryDetailHeader.detail-header + button[aria-label=Copy]；EntryListView /explore + entry-card；LandingView ThemeToggle；useEntryDetailComputed download 动态 a 标签(86-97)
- [x] seed-data 核实：json-api-config(单文件 config.json,public,bob)；python-entry-service(entry_service.py 8 def + requirements.txt,public,alice)；markdown-test(rich-markdown.md h1-h3 + architecture.svg,public,alice)；mermaid-charts(flowchart/gantt/sequence.md 含 mermaid,public,alice)
- [x] minimal_validation：mtime 比对 find 命令行为验证（含 -type f 与目录 mtime 边界的发现，见 P2-design.md）

## 产出

- [x] P2-design.md 已写入（270 行）
  - candidate_count: 1（follows_existing_pattern: [viewer.spec.ts, e2e-safety-check.sh, Makefile]，理由：修复既有测试资产非新功能）
  - 四字段齐全：packages [frontend-v3, makefile, scripts] / domains [test-infra, frontend] / ui_affected false / gate_commands（P3 --test-mtime, P5 test-quick, P5_typecheck, P5_e2e）
  - 子任务 A：17 处 hash 路由 + 8 条 slug 映射（IMPL-D1~D4）+ IMPL-S1~S12 逐条死→活选择器替换（含 mermaid 实测 `.diagram-viewer svg` 修订）
  - 子任务 B：Check 6 函数 + --test-mtime 自检模式 + Makefile 传绝对路径 env；三态验收 BDD-6/7/8
  - minimal_validation：mtime 行为 confirmed_with_refinement（-type f 规避目录假阳性、static 缺失需先判 [ -f ]）
  - files_to_read：15 项上下文地图（含行号标注）
