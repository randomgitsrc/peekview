---
phase: P4
task_id: T082-arch-refactor
type: review
parent: P4-implementation-frontend.md
trace_id: T082-P4-20260730
status: approved
created: 2026-07-30
agent: design-review
---

# P4 Design Review — T082 前端重构（R5/R6/R7）

## 审查范围

R5 store 拆分 / R6 EntryDetailView 拆分 / R7 错误格式兼容，共 12 新建文件 + 6 修改文件。

## 审查方法

1. 逐行对比旧 `EntryDetailView.vue`（1003 行）与新主组件 + 5 子组件 + 4 composable
2. 逐行对比旧 `entry.ts`（223 行）与新 `entryList.ts` + `entryDetail.ts`
3. 对照 P2-design.md props/emit 契约表验证忠实度
4. 验证行数约束、AI Slop、交互状态、行为零回归
5. 运行 `make test-frontend`（1078 passed）+ `make typecheck`（pass）

## 1. AI Slop 检查

**PASS** — 无问题。

- 无紫色/violet 渐变（#6366f1, #8b5cf6 等）
- 无泛化文案（"Unlock the power of..."等）
- 所有文案均从旧组件原样迁移，无新增营销文案
- 布局层级清晰，非全部居中的模板布局

## 2. 交互状态检查

**PASS** — 交互状态保留。

| 状态 | 旧代码 | 新代码 | 结论 |
|------|--------|--------|------|
| hover | `.toggle-btn:hover`, `.icon-btn:hover`, `.expired-edit-btn:hover`, `.reactivate-btn:hover`, `.entry-owner-link:hover` | 全部迁移到对应子组件 scoped 样式 | ✓ |
| focus-visible | 全局 `layout.css` 定义 `.toggle-btn:focus-visible`, `.icon-btn:focus-visible`, `.bottom-btn:focus-visible` | 全局 CSS 仍生效（子组件使用相同 class 名） | ✓ |
| active | `.toggle-btn.active`（Header） | 迁移到 `EntryDetailHeader.vue:149` | ✓ |
| disabled | 无 disabled 状态（旧代码也无） | 无 | ✓ |
| loading | `entryStore.loading` → skeleton | `fileLoading` prop → skeleton | ✓ |
| error | `entryStore.error` → error-state | `fileError` prop → error-state | ✓ |
| empty | "Entry not found" / "Select a file" | 原样保留 | ✓ |

## 3. R5 Store 拆分审查

**PASS** — 忠实 P2 设计，行为零回归。

### 3.1 Pinia action 内引用模式

`entryList.ts:55-56`：`toggleVisibility` 内部 `useEntryDetailStore().syncVisibility(entry.slug, newPublic)` — 正确实现 P2 设计的跨 store 协调。

`entryList.ts:79-80`：`deleteEntry` 内部 `useEntryDetailStore().clearIfSlug(slug)` — 正确。

回滚路径（`entryList.ts:66-71`）：catch 块内回滚 list 状态 + 调用 `detailStore.syncVisibility(entry.slug, originalPublic)` 回滚 detail — 完整保留。

### 3.2 loadSeq 竞态防护

`entryList.ts:8`：`let loadSeq = 0` 模块级变量 — 保留。
`entryList.ts:20,26,33,39,41`：seq 检查逻辑完整迁移 — 行为零回归。

### 3.3 syncVisibility slug 匹配

`entryDetail.ts:101-105`：`if (currentEntry.value?.slug === slug)` — slug 检查正确。

**注意**：旧代码用 `id` 匹配（`currentEntry.value?.id === entry.id`），新代码用 `slug` 匹配。这是 P2 设计明确指定的（`syncVisibility(slug, isPublic)`）。`id` 和 `slug` 均唯一，实际行为等价。非回归。

### 3.4 loading/error 分离

`entryList.ts` 和 `entryDetail.ts` 各自维护独立的 `loading`/`error` ref — 消除了旧 store 中 list/detail 共享 loading 互相干扰的问题。改进，非回归。

### 3.5 向后兼容包装器

`entry.ts`：保留 `useEntryStore()` 兼容包装器，聚合两个 store 的状态/方法。确保未迁移的 import 不破。✓

## 4. R6 Component 拆分审查

**PASS** — 忠实 P2 设计，行为零回归。

### 4.1 行数约束

| 文件 | 行数 | 约束 | 结论 |
|------|------|------|------|
| `EntryDetailView.vue`（主组件） | 236 | < 300 | ✓ |
| `EntryDetailHeader.vue` | 170 | < 200 | ✓ |
| `EntryDetailBanners.vue` | 90 | < 200 | ✓ |
| `EntryDetailContent.vue` | 178 | < 200 | ✓ |
| `EntryDetailMobileBar.vue` | 131 | < 200 | ✓ |
| `EntryDetailDialogs.vue` | 82 | < 200 | ✓ |

### 4.2 Props/Emit 契约忠实度

逐条对照 P2-design.md 契约表：

| 子组件 | P2 定义 props 数 | 实现 props 数 | P2 定义 emits 数 | 实现 emits 数 | 偏差 | 结论 |
|--------|-----------------|--------------|-----------------|--------------|------|------|
| EntryDetailHeader | 17 | 18（+slug） | 5 | 5 | slug 为 ShareDialog 所需 | ✓ |
| EntryDetailBanners | 3 | 3 | 1 | 1 | 无 | ✓ |
| EntryDetailContent | 18 | 18 | 6 | 6 | 无 | ✓ |
| EntryDetailMobileBar | 11 | 11 | 4 | 4 | 无 | ✓ |
| EntryDetailDialogs | 8 | 8 | 6 | 6 | 无 | ✓ |

Header 额外 `slug` prop 是 ShareDialog `:entry-slug` 所需，合理增加。

### 4.3 provide/inject

`entryDetailKeys.ts`：定义 `ZenModeKey`/`IsMobileKey`/`ZenAriaTextKey` 三个 InjectionKey，类型正确（`Ref<boolean>` / `ComputedRef<boolean>` / `Ref<string>`）。

主组件 `provide()` 注入（`EntryDetailView.vue:140-142`），Header 和 MobileBar `inject()` 获取。与 P2 设计一致。✓

### 4.4 Composable 忠实度

P2 定义 2 个 composable（useZenMode, useResponsiveLayout），实现新增 2 个（useEntryDetailComputed, useEntryDetailActions）。

- `useZenMode.ts`（36 行）：zen mode 状态 + 键盘快捷键 — 忠实 P2 签名。生命周期由主组件管理（onMounted/onUnmounted 注册/移除监听）。✓
- `useResponsiveLayout.ts`（62 行）：viewport/isMobile/isDesktop + scroll hide — 忠实 P2 签名。`setupScrollHide` 返回 cleanup 函数。✓
- `useEntryDetailComputed.ts`（125 行，P2 未定义）：抽取 computed 和文件操作函数。合理——主组件需 < 300 行。
- `useEntryDetailActions.ts`（132 行，P2 未定义）：抽取 overflow/delete/visibility/expiresIn 操作。合理。

### 4.5 行为零回归验证

| 行为 | 旧代码 | 新代码 | 结论 |
|------|--------|--------|------|
| Zen mode 切换（f/Escape 键） | `handleZenKeydown` 直接在组件 | `useZenMode` composable + 主组件注册监听 | ✓ |
| Zen mode 隐藏 header/mobile-bar | `v-show="!zenMode"` + `:deep()` CSS | 相同（`v-show` 在子组件 + `:deep()` 在主组件） | ✓ |
| File tree toggle（desktop） | `isFileTreeOpen` ref + `v-if` | prop `isFileTreeOpen` + emit `toggle-file-tree` | ✓ |
| TOC toggle | `isTocOpen` ref + `v-if` | prop `isTocOpen` + emit `toggle-toc` | ✓ |
| Mobile file drawer | `showFileDrawer` ref + overlay/drawer | 主组件持有 ref + Content 渲染 drawer + MobileBar emit toggle | ✓ |
| Mobile TOC drawer | `showTocDrawer` ref + overlay/drawer | 同上 | ✓ |
| Drawer select→close | `selectFileAndCloseDrawer` / `selectTocAndCloseDrawer` | Content emit `select-file` + `close-file-drawer`（双 emit） | ✓ 行为等价 |
| Share dialog | `shareDialogOpen` ref + ShareDialog | Header 内部 `shareDialogModel` computed + emit `toggle-share-dialog` | ✓ |
| Share watermark | `v-if="isShareAccess"` | Dialogs 组件内 `v-if="isShareAccess"` | ✓ |
| Delete confirm | ConfirmDialog + `handleDelete` | Dialogs 组件内 ConfirmDialog + emit `confirm-delete` → `actions.handleDelete(router)` | ✓ |
| Expires-in dialog | ExpiresInDialog + `handleExpiresInUpdated` | Dialogs 组件内 + emit `expires-in-updated` → `actions.handleExpiresInUpdated(slug)` | ✓ |
| Login dialog | LoginDialog `v-model:visible="showLogin"` | Dialogs 组件内 + `update:show-login` emit | ✓ |
| Responsive layout | `viewportWidth` + `isMobile`/`isDesktop` computed | `useResponsiveLayout` composable | ✓ |
| Meta tags scroll hide | `scrollContainer` + `onScroll` + `tagsScrollHandler` cleanup | `setupScrollHide()` 返回 cleanup + `onUnmounted(setupScrollHide(...))` | ✓ |
| Raw link injection | `watch(currentEntry)` 创建 `<link rel=alternate>` | 相同 | ✓ |
| Desktop auto-open TOC/file tree | onMounted + watch(currentEntry) | 相同（两处均保留） | ✓ |
| Copy/download/pack | 直接函数 | `useEntryDetailComputed` composable | ✓ |
| Overflow menu items | computed in component | `useEntryDetailActions` composable | ✓ |
| `data-peekview-raw` link | watch 中创建/移除 | 相同 | ✓ |

### 4.6 样式迁移完整性

| 旧 scoped 样式 | 迁移目标 | 结论 |
|---------------|----------|------|
| `.entry-owner-link` | EntryDetailHeader.vue | ✓ |
| `.title-group` | EntryDetailHeader.vue | ✓ |
| `.expired-warning-banner` + `.expired-edit-btn` | EntryDetailBanners.vue | ✓ |
| `.archived-banner` + `.reactivate-btn` | EntryDetailBanners.vue | ✓ |
| `.share-btn` + `.share-badge` | EntryDetailHeader.vue | ✓ |
| `.bottom-btn.share-btn`（死代码） | 正确省略（MobileBar 无 share 按钮） | ✓ |
| `.share-watermark` | EntryDetailDialogs.vue | ✓ |
| `.share-error` | EntryDetailContent.vue | ✓ |
| `.meta-tag` | EntryDetailHeader.vue | ✓ |
| `.loading-state` + `.skeleton-*` | EntryDetailContent.vue | ✓ |
| `.entry-detail` + `.zen-mode :deep()` + `.sr-only` | EntryDetailView.vue（主组件） | ✓ |

全局 `layout.css` 中的 `.detail-header`, `.mobile-sticky-header`, `.mobile-bottom-bar`, `.meta-tags-bar`, `.drawer-*` 等样式仍生效（子组件使用相同 class 名）。部分子组件 scoped 样式与全局有重复，但不影响行为（无冲突属性）。

## 5. R7 错误格式兼容审查

**PASS** — 3 处改动正确。

| 文件 | 旧 | 新 | 结论 |
|------|----|----|------|
| `ExpiresInDialog.vue:66` | `e.response?.data?.detail` | `e.response?.data?.error?.message` | ✓ |
| `SecurityTab.vue:71` | `err?.response?.data?.detail` | `err?.response?.data?.error?.message` | ✓ |
| `ProfileTab.vue:74` | `err?.response?.data?.detail` | `err?.response?.data?.error?.message` | ✓ |

`LoginDialog.vue` 的 `e.detail`（DOM CustomEvent）不受影响 — 正确未改动。✓

## 6. 实现忠实度总结

P2-design.md 的 R5/R6/R7 方案被忠实实现：

- **R5**：2-store 拆分 + Pinia action 内引用 + loadSeq 保留 + 向后兼容包装器 — 完全匹配
- **R6**：5 子组件 + 2 composable（P2 定义）+ 2 额外 composable（合理增加以满足行数约束） + provide/inject + drawer 留主组件 — 完全匹配
- **R7**：3 处 `.detail` → `.error?.message` — 完全匹配

## 7. 发现（非 BLOCKER）

### 7.1 [INFO] scoped 样式与全局 CSS 重复

`EntryDetailHeader.vue` 的 `.meta-tags-bar` scoped 样式与 `layout.css` 中的全局定义重复。两者属性不冲突（scoped 有 `transition`/`opacity`，全局有 `display`/`padding`），但存在维护风险——改一处忘改另一处。

**影响**：无行为影响。维护性小提示。
**建议**：后续可统一到全局或移除 scoped 重复。

### 7.2 [INFO] onUnmounted 在 onMounted 内注册

`EntryDetailView.vue:196`：`onUnmounted(setupScrollHide(content as HTMLElement))` — 在 `onMounted` 回调内注册 `onUnmounted` 钩子。

**影响**：Vue 3 支持，功能正确。但不如在 setup 顶层注册 + 用 ref 存 cleanup 那样常规。
**建议**：可选重构——用 `let cleanup: (() => void) | null = null` 在 setup 顶层，onMounted 中赋值，onUnmounted 中调用。

### 7.3 [INFO] useEntryDetailComputed 内部直接访问 store

`useEntryDetailComputed.ts:15`：composable 内部 `useEntryDetailStore()` 获取 store 实例，同时主组件传入了 `currentEntry`/`activeFile` refs（来自同一 store 的 `storeToRefs`）。两条路径访问同一 store，功能正确但有轻微的认知冗余。

**影响**：无行为影响。
**建议**：可选——composable 可仅接收 refs 参数，不内部获取 store（但 `tocHeadings` 依赖 `entryDetailStore.fileContent`，需要 store 访问）。

## 8. 结论

**status: approved**

R5/R6/R7 前端重构忠实 P2-design.md 方案，行为零回归，行数约束全部满足，AI Slop 无问题，交互状态保留。3 条 INFO 级发现均非 BLOCKER，不阻断推进。

测试验证：`make test-frontend` 1078 passed | 1 skipped，`make typecheck` pass。

[PROD_NOT_TOUCHED]
