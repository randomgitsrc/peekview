# P3 Progress — T085 test-designer

## 步骤 1: 读取 dispatch-context
- 完成。11 BDD（BDD-1~11），5 个缺陷修复，纯前端。
- ui_affected: true → 必须含 Playwright/E2E 用例
- BDD-9 必须用真实点击，禁止 selectOption()
- vitest mock hoisting 反模式：vi.mock() 回调只用字符串字面量

## 步骤 2: 读取角色定义 + 项目约定
- 完成。角色 test-designer，行为契约设计，BDD 1:1 映射。
- Playwright viewport 配置：desktop 1280x800 / mobile 390x844

## 步骤 3: 读取输入文件
- P1-requirements.md: 11 BDD 验收条件已读
- P2-design.md: 5 个缺陷方案已读，gate_commands 已确认
- useEntryDetailComputed.ts: isXml/isImage/isRichRenderable 现状已读
  - isSvg 未实现（当前不存在）
  - isRichRenderable 包含 isXml（未排除 SVG）
- EntryDetailContent.vue: 调度链 isCsv||isTsv||isJson||isYaml||isXml（未排除 SVG）
  - content-area CSS: padding var(--space-4), 无 overscroll-behavior
- code.css: .code-body {} 空规则（缺少 flex:1 + min-height:0）
- MarkdownViewer.vue: .markdown-body scoped style 只有 max-width:900px + margin:0 auto，无 padding
- markdown.css: .markdown-body max-width:none, 无 padding
- useResponsiveLayout.ts: setupScrollHide 无边界保护
- TableView.vue: 原生 select.per-page-select, 无自定义下拉
- EntryDetailHeader.vue: toggle 按钮 v-if="isRichRenderable"（SVG 需排除）
- EntryDetailMobileBar.vue: 同上 toggle 按钮 v-if="isRichRenderable"
- OverflowMenuDropdown.vue: 自定义下拉参照模式已读
- mime.ts: svg → 'image/svg+xml' 已确认
- variables.css: --space-5=24px, --space-6=32px, --space-4=16px, --space-3=12px

## 步骤 4: 测试用例设计（11 BDD 1:1 映射）

### vitest 单测（BDD-1/2/3/4/5/8/11 逻辑层可测）
- BDD-1: useEntryDetailComputed isSvg computed → isImage=true for .svg, 调度链排除
- BDD-2: useEntryDetailComputed isXml + isRichRenderable for .xml（防回归）
- BDD-3: isRichRenderable 排除 SVG（toggle 按钮门控逻辑）
- BDD-4: E2E（需真实滚动）+ vitest code.css .code-body flex:1 验证
- BDD-5: E2E（需真实滚动）+ vitest code.css .code-body flex:1 验证
- BDD-8: useResponsiveLayout setupScrollHide 底端边界保护
- BDD-11: TableView 自定义下拉键盘操作

### E2E/Playwright（BDD-1~11 全部）
- render-regression.spec.ts: 11 BDD 全覆盖

## 步骤 5: 写 P3-test-cases.md + P3-test-code/
完成。

测试文件（P3-test-code/ 为归档副本，实际运行文件已部署到 frontend-v3/）：
1. useEntryDetailComputed.svg.spec.ts → frontend-v3/src/composables/__tests__/
2. useResponsiveLayout.boundary.spec.ts → frontend-v3/src/composables/__tests__/
3. TableView.per-page.spec.ts → frontend-v3/src/components/__tests__/
4. render-regression.spec.ts → frontend-v3/e2e/

## 步骤 6: 自跑测试确认红灯

### vitest 结果
- useEntryDetailComputed.svg.spec.ts: 5 failed | 1 passed (6)
  - 失败原因: isSvg 未实现（undefined）→ 断言失败（B 类红灯）
  - 通过的 1 个: test_bdd_2_xml_still_has_toggle_button（XML isRichRenderable=true 已是现有行为）
- useResponsiveLayout.boundary.spec.ts: 2 failed | 4 passed (6)
  - 失败原因: 底端无边界保护 → metaTagsHidden 翻转（B 类红灯）
  - 通过的 4 个: 顶端保护（current<lastScrollTop 已有逻辑）+ 正常滚动（已有逻辑）
- TableView.per-page.spec.ts: 5 failed | 0 passed (5)
  - 失败原因: button.per-page-trigger 不存在（原生 select 仍在用）（B 类红灯）

### 全量 vitest 套件
- 87 passed | 3 failed (91 files)
- 1182 passed | 12 failed | 1 skipped (1199 tests)
- 12 failed 全部是 T085 新增测试，现有 1182 测试全绿
- 无 A 类错误（无 SyntaxError / 第三方 import 失败）

### E2E spec
- TypeScript 编译通过（npx tsc --noEmit --skipLibCheck）
- 需 debug backend 运行（P6 阶段执行）

### 红灯确认
所有 12 个 vitest 红灯均为 B 类（断言失败，实现未写），无 A 类（测试代码自身错误）。
E2E spec 语法正确，待 debug backend 运行验证。

## 步骤 7: 返回
路径 + 摘要
