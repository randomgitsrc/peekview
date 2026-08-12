---
phase: P4
task_id: T085-render-regression-fix
type: implementation
parent: P3-test-cases.md
trace_id: T085-P4-20260802
status: draft
created: 2026-08-02
agent: implementer
---

# P4 代码实现 — T085 详情页渲染回归修复

## implementation_dir

```
frontend-v3/
```

## 环境隔离

[PROD_NOT_TOUCHED]

## 改动文件清单

| 文件 | 缺陷 | 改动摘要 |
|------|------|---------|
| `frontend-v3/src/composables/useEntryDetailComputed.ts` | P1 | 新增 isSvg computed；isRichRenderable 排除 SVG；返回 isSvg |
| `frontend-v3/src/components/EntryDetailContent.vue` | P1/P4 | 调度链 isXml → (isXml && !isSvg)；新增 isSvg prop；content-area 加 overscroll-behavior: y none |
| `frontend-v3/src/views/EntryDetailView.vue` | P1 | 传递 isSvg prop；解构 isSvg |
| `frontend-v3/src/styles/code.css` | P2 | .code-body 恢复 flex:1; min-height:0 |
| `frontend-v3/src/components/MarkdownViewer.vue` | P3 | .markdown-body scoped style 加 padding: var(--space-5) |
| `frontend-v3/src/styles/markdown.css` | P3 | 全局移动端 media query padding: var(--space-4) |
| `frontend-v3/src/composables/useResponsiveLayout.ts` | P4 | setupScrollHide 加底端/顶端边界保护（atBottom 状态追踪） |
| `frontend-v3/src/components/TableView.vue` | P5 | 原生 select → 自定义下拉组件（button.per-page-trigger + role=listbox + role=option + 键盘/外部点击） |

## 测试文件

| 文件 | 来源 | 覆盖 BDD |
|------|------|---------|
| `frontend-v3/src/composables/__tests__/useEntryDetailComputed.svg.spec.ts` | P3-test-code（不改内容） | BDD-1/2/3 |
| `frontend-v3/src/composables/__tests__/useResponsiveLayout.boundary.spec.ts` | P3-test-code（不改内容） | BDD-8 |
| `frontend-v3/src/components/__tests__/TableView.per-page.spec.ts` | P3-test-code（不改内容） | BDD-11 |
| `frontend-v3/e2e/render-regression.spec.ts` | P3-test-code（不改内容） | BDD-1~11 |

## 现有测试适配

| 文件 | 改动原因 |
|------|---------|
| `frontend-v3/e2e/structured-data-viewer.spec.ts` BDD-19/20 | 旧测试断言已移除的 `select.per-page-select`，改为自定义下拉真实点击流程 |
| `frontend-v3/src/components/__tests__/TableView.spec.ts` BDD-19/20 | 同上，select.setValue → trigger click + option click |

## 实现细节

### P1: SVG 调度修复

**useEntryDetailComputed.ts**:
- 新增 `isSvg: ComputedRef<boolean> = computed(() => guessMimeType(activeFile.value?.filename ?? '') === 'image/svg+xml')`
- `isRichRenderable` 改为 `isCsv || isTsv || isJson || isYaml || (isXml && !isSvg) || isMarkdown`
- 返回值新增 `isSvg`

**EntryDetailContent.vue**:
- 调度链 `v-else-if="isCsv || isTsv || isJson || isYaml || isXml"` → `v-else-if="isCsv || isTsv || isJson || isYaml || (isXml && !isSvg)"`
- props 新增 `isSvg: boolean`

**EntryDetailView.vue**:
- 解构 `isSvg` from useEntryDetailComputed
- 传递 `:is-svg="isSvg"` 给 EntryDetailContent

### P2: 源码视图滚动

**code.css**:
```css
.code-body {
  flex: 1;
  min-height: 0;
}
```
不恢复 overflow:auto（让 content-area 作为唯一滚动容器，符合 DESIGN.md §9）。

### P3: Markdown 边距

**MarkdownViewer.vue** scoped style:
```css
.markdown-body {
  max-width: 900px;
  margin: 0 auto;
  padding: var(--space-5);
}
```

**markdown.css** 全局移动端 media query:
```css
@media (max-width: 640px) {
  .markdown-body { padding: var(--space-4); }
}
```
- 桌面: content-area 16px + .markdown-body 32px = 48px ≥ 32px ✓
- 移动: content-area 8px + .markdown-body 16px = 24px ≥ 16px ✓

### P4: 滚动抖动

**EntryDetailContent.vue**:
```css
.content-area { ... overscroll-behavior: y none; }
```

**useResponsiveLayout.ts** setupScrollHide 边界保护:
- `atBottom` 状态追踪：首次到达底端仍执行正常逻辑（隐藏），后续在底端附近的微小变化跳过（不翻转）
- `isTop`（scrollTop <= 5）：强制 metaTagsHidden=false
- 正常滚动行为不受影响

### P5: per-page 下拉框

**TableView.vue** 自定义下拉组件:
- 触发按钮 `button.per-page-trigger`（aria-haspopup="listbox", aria-expanded）
- 选项列表 `ul[role="listbox"]` / `li[role="option"][data-value]`
- 触达目标 min-height: 44px
- 键盘：Enter/Space 打开 → ArrowDown/ArrowUp 导航 → Enter 选择 → Escape 关闭
- 外部点击关闭（document click listener）
- `@keydown.enter.prevent.stop` 在 `<li>` 上阻止冒泡到 `<ul>` 的 onListboxKeydown（避免重复选择）

## 自查结果

| 命令 | 结果 |
|------|------|
| `npx vitest run` (新增 3 测试文件) | 17 passed |
| `npx vitest run` (TableView.spec.ts BDD-19/20) | 2 passed |
| `npx vue-tsc --noEmit` | 零错误 |
| `npm run build` | 成功 (13.07s) |

## [DESIGN_GAP]

P2-design 列出了 `structured-data-viewer.spec.ts` 和 `TableView.spec.ts` 的 BDD-19/20 改真实点击的改动，但 dispatch-context 说"不改测试代码（P3 测试不改，只改实现让测试变绿）"。这两个旧测试断言已移除的 `select.per-page-select`，不更新会导致测试失败。按 P2-design 改动清单执行，更新为自定义下拉的真实点击流程。P3-test-code/ 的新测试文件不改内容，只复制到实际位置。

## [SCOPE+] 检查

无新隐含需求。
