# P4 Progress — T085 implementer

## 环境隔离
[PROD_NOT_TOUCHED]

## 步骤记录

### 1. 读取输入文件 — 完成
- dispatch-context: 5 个缺陷修复方案（P1-P5）
- P2-design: files_to_read 已全部读取
- P3-test-code: 4 个测试文件已读取，了解选择器契约
- 源代码文件已读取：useEntryDetailComputed.ts, EntryDetailContent.vue, code.css, MarkdownViewer.vue, markdown.css, useResponsiveLayout.ts, TableView.vue, OverflowMenuDropdown.vue, EntryDetailView.vue

### 关键发现（测试选择器契约）
- vitest `TableView.per-page.spec.ts`: `button.per-page-trigger` + `aria-haspopup="listbox"` + `[role="listbox"]` + `[role="option"][data-value="50"]` + Enter/ArrowDown/Escape 键盘
- vitest `useResponsiveLayout.boundary.spec.ts`: scrollHeight=1000, clientHeight=400, scrollTop=600 为底端边界，598/599 不翻转
- vitest `useEntryDetailComputed.svg.spec.ts`: 需要 `isSvg` 从 composable 返回，`isRichRenderable` 排除 SVG

### 2. 实现 5 个修复 — 完成

#### P1: SVG 调度修复
- useEntryDetailComputed.ts: 新增 isSvg computed，isRichRenderable 排除 SVG (isXml && !isSvg)
- EntryDetailContent.vue: 调度链 isXml → (isXml && !isSvg)，新增 isSvg prop
- EntryDetailView.vue: 传递 isSvg prop，解构 isSvg

#### P2: 源码视图滚动
- code.css: .code-body 恢复 flex:1; min-height:0

#### P3: Markdown 边距
- MarkdownViewer.vue: .markdown-body scoped style 加 padding: var(--space-5)
- markdown.css: 全局移动端 media query padding: var(--space-4)

#### P4: 滚动抖动
- EntryDetailContent.vue: content-area 加 overscroll-behavior: y none
- useResponsiveLayout.ts: setupScrollHide 加底端/顶端边界保护（atBottom 状态追踪 + isTop 强制显示）

#### P5: per-page 下拉框
- TableView.vue: 原生 select → 自定义下拉组件（button.per-page-trigger + role=listbox + role=option）
  - 触达目标 ≥44px, 键盘 Enter/Space/ArrowDown/ArrowUp/Escape, 外部点击关闭
  - @keydown.enter.prevent.stop 阻止冒泡到 ul 的 onListboxKeydown

### 3. 测试文件复制 — 完成
- useEntryDetailComputed.svg.spec.ts → src/composables/__tests__/
- useResponsiveLayout.boundary.spec.ts → src/composables/__tests__/
- TableView.per-page.spec.ts → src/components/__tests__/
- render-regression.spec.ts → e2e/

### 4. 现有测试适配 — 完成
- structured-data-viewer.spec.ts BDD-19/20: selectOption → 真实点击自定义下拉
- TableView.spec.ts BDD-19/20: select.per-page-select → button.per-page-trigger + role=option

[DESIGN_GAP: P2-design 列出了 structured-data-viewer.spec.ts 和 TableView.spec.ts 的 BDD-19/20 改动，但 dispatch-context 说"不改测试代码"。这些旧测试断言已移除的 select.per-page-select，不更新会导致测试失败。按 P2-design 改动清单执行。]

### 5. 自查结果
- vitest（新增 3 文件）: 17 passed
- vitest（TableView.spec.ts BDD-19/20）: 2 passed
- vue-tsc --noEmit: 零错误
- npm run build: 成功
