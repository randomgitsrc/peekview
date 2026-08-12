# P1 Progress — T085 render-regression-fix (analyst)

## 读取输入文件记录
1. [x] P1-dispatch-context-analyst.md — 5 缺陷转化 BDD，P5 必须真实点击验证
2. [x] analyst.md 角色定义 — 需求质疑优先，BDD 二值判定，隐含需求逐维度
3. [x] P0-brief.md — 5 缺陷根因已定位；范围声明含改/不改；env_constraints
4. [x] T075-retrospective-20260801.md — 教训：量化断言必须可从数据推导，禁止手写魔数；交互元素 a11y 用 button
5. [ ] EntryDetailContent.vue — 调度链现状
6. [ ] useEntryDetailComputed.ts — isXml/isImage 现状
7. [ ] code.css — .code-body 现状
8. [ ] MarkdownViewer.vue — padding 现状
9. [ ] useResponsiveLayout.ts — scroll-hide 现状
10. [ ] TableView.vue — per-page select 现状
11. [ ] DESIGN.md — §6 间距 + §9 滚动 + §10 可访问性
12. [ ] structured-data-viewer.spec.ts — BDD-19/20 selectOption 盲区
5. [x] EntryDetailContent.vue — 调度链：isHtml → isMarkdown → isCsv||isTsv||isJson||isYaml||isXml（含 CodeViewer/TreeView/TableView 子分支）→ isImage → CodeViewer fallback。注意：showSourceView 由 sourceViewMode || parseError 驱动。content-area padding var(--space-4)=16px，移动端 12px/8px
6. [x] useEntryDetailComputed.ts — 注意：isImage computed 已含 `mime==='image/svg+xml' → true`！SVG 问题的根因纯粹是 isXml 分支在调度链上先于 isImage 截获（P0-brief 一致）
7. [x] code.css — `.code-body {}` 空规则确认（T084 移除 flex:1/min-height:0）。`.code-viewer` 有 overflow:hidden + flex column。pre 有 overflow-x:auto 但无纵向滚动（content-area 承担）
8. [x] MarkdownViewer.vue — scoped `.markdown-body` 只有 max-width:900px + margin:0 auto，无 padding。markdown.css 全局 padding 待查
9. [x] useResponsiveLayout.ts — setupScrollHide：scroll down (current>lastScrollTop && current>10) → hide；scroll up → show。无底端/顶端边界保护，底部橡皮筋波动会触发切换 → 抖动
10. [x] TableView.vue — 原生 `<select class="per-page-select">`（50/100/500），onPerPageChange 设 perPage + page=1。默认 perPage=100。样式仅基础 padding/border
11. [x] E2E spec — 确认盲区：test_bdd_19 用 toHaveValue 只验证初始值；test_bdd_20 用 selectOption('50') 程序化设置。无真实点击路径。E2E 用 class 选择器（.table-view/.tree-view/.per-page-select/.code-viewer）——BDD 避免绑定这些 class（BDD 反模式），P3 test-designer 可用
12. [x] markdown.css — 无 `.markdown-body` padding 声明（全局 padding 已被移除，仅内联 line-height/color 等）
13. [x] DESIGN.md — §6 间距：Base Unit 4px；Container Padding 32px desktop / 16px mobile；§9 滚动：content-area 唯一纵向滚动容器，viewer 不得 overflow-y:auto/height:100%；§10 a11y：交互元素用 button、input 需 label/aria-label、focus 可见
14. [x] layout.css — 全局 .content-area 桌面 overflow:hidden；EntryDetailContent.vue scoped .content-area overflow-y:auto + padding var(--space-4)。两处声明并存（scoped 优先级高）
15. [x] DESIGN.md §10（line 261）Touch targets min 44px；§12 OverflowMenu 下拉组件
16. [x] 测试数据：markdown-test/rich-markdown.md 624 行（超视口，可验证滚动）；csv-employees/employees.csv（多列，>100 行？待确认行数）；svg-standalone/architecture.svg（独立 SVG）

## 关键发现（隐含需求 / 质疑点）
1. **P0-brief 声称「ImageViewer 已有 SVG 支持（可切换代码/预览）」与实际不符**：ImageViewer.vue 无任何源码/渲染切换逻辑；toggle 按钮（EntryDetailHeader/MobileBar）由 `isRichRenderable` 门控（含 isXml），而 isImage 分支不响应 sourceViewMode。若按方案 A 只改调度链（isXml && !isSvg），SVG 落入 isImage 后 toggle 按钮仍可见但无效 → 死按钮回归。→ [NEED_CONFIRM]（见 NC-1）
2. 调度链现状：isHtml → isMarkdown → (csv/tsv/json/yaml/xml) → isImage → fallback CodeViewer。isImage 已含 `mime==='image/svg+xml'→true`，SVG 缺陷纯粹是 isXml 分支先截获。
3. markdown.css / MarkdownViewer 已无 `.markdown-body` padding（T084 移除），content-area padding 16px/12px·8px，不达 DESIGN.md 32px/16px。
4. `.code-body {}` 空规则确认；`.code-viewer` overflow:hidden + flex column → 内容被裁剪。
5. setupScrollHide 无底端/顶端边界保护 → 底部橡皮筋触发 metaTagsHidden 翻转 → 抖动。
6. TableView per-page 用原生 select（aria-label="Rows per page"），E2E test_bdd_19/20 用 toHaveValue/selectOption 绕过真实点击（测试盲区确认）。
7. seed-data：markdown-test/rich-markdown.md 624 行（可验证滚动），csv-employees 仅 30 行（>100 行数据需 E2E 自建，同 T075 模式）。
8. DESIGN.md 参考：§6 Container Padding 32px/16px；§9 content-area 唯一纵向滚动容器，viewer 不得 overflow-y:auto；§10 Touch targets ≥44px、语义 HTML、input 需 aria-label。

## 隐含需求清单（写入 P1-requirements）
- SVG 源码/渲染切换行为一致性（NC-1）
- CodeViewer 全路径（toggle/fallback/parse-error 降级）滚动修复验证
- Markdown 边距修复仅影响 Markdown，不改变其他 viewer 布局
- scroll-hide 边界保护不破坏正常向上/向下滚动行为
- P5 必须真实点击验证（禁 selectOption）
- 现有 53+ E2E 断言防回归（XML tree、表格渲染等）

## P1-requirements.md 产出完成
- 11 条 BDD（P1: BDD-1/2/3，P2: BDD-4/5，P3: BDD-6/7，P4: BDD-8，P5: BDD-9/10/11）
- 1 个 [NEED_CONFIRM]（NC-1: SVG 修复后 toggle 按钮行为——P0-brief 对 ImageViewer 可切换源码的假设与实际不符）
- domains/packages/risk_level/phases/capability_requirements 已声明
- BDD 自检：无 CSS 类名/HTML 属性名绑定，数值断言源自 DESIGN.md（32/16px、44px），均可二值判定
- 状态：[PROD_NOT_TOUCHED]
