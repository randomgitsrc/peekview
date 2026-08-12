---
phase: P2
task_id: T082-arch-refactor
type: review
parent: P2-design.md
trace_id: T082-P2-20260730
status: approved
created: 2026-07-30
agent: plan-design-review
---

# P2 设计评审 — 前端部分（R5/R6/R7）— 第二轮

> 评审范围：P2-design.md 的 R5（store 拆分）、R6（component 拆分）、R7（前端错误格式兼容）。
> 评审维度：交互状态覆盖率、AI Slop 风险、移动端考虑、可访问性。
> 第一轮状态：needs-revision（2 BLOCKER + 6 WARNING）。
> 第二轮状态：**approved** — 2 BLOCKER 已修复，6 WARNING 已处理，3 个新 WARNING（不阻塞）。

[PROD_NOT_TOUCHED]

## 评分总览

| 维度 | 第一轮 | 第二轮 | 变化 | 说明 |
|------|--------|--------|------|------|
| 交互状态覆盖率 | 6 | 8 | +2 | 跨 store 协调机制已明确 Pinia action 内引用模式，含完整代码 |
| AI Slop 风险 | 5 | 9 | +4 | 5 子组件完整 props/emit 契约表，composable 签名+返回值定义 |
| 移动端考虑 | 7 | 8 | +1 | drawer 状态所有权明确（主组件 props+emit），provide/inject key 定义 |
| 可访问性 | 7 | 8 | +1 | aria-live 区域归属明确（主组件），composable 生命周期管理定义 |

---

## 1. BLOCKER 修复确认

### 1.1 [BLOCKER-2 已修复] 跨 store 协调机制

**第一轮问题**：R5 方案将 `toggleVisibility` 和 `deleteEntry` 保留在 `entryList` store，要求 `entryDetail` store 暴露 `syncVisibility(slug, isPublic)` 和 `clearIfSlug(slug)`，但未说明 `entryList` 如何获取 `entryDetail` store 实例。

**修复确认**：P2-design.md:375-454 现在包含完整的 Pinia action 内引用模式代码：

- `entryList.ts` 在 action 内部调用 `useEntryDetailStore()` 获取 detail store 实例（:400, :423）
- `toggleVisibility` action 内：乐观更新 list → 调用 `detailStore.syncVisibility(slug, newPublic)` → API 调用 → 失败时回滚 list + detail（:388-417）
- `deleteEntry` action 内：API 调用 → 移除 list → 调用 `detailStore.clearIfSlug(slug)`（:419-429）
- `entryDetail.ts` 定义 `syncVisibility(slug, isPublic)` 和 `clearIfSlug(slug)`，均含 `currentEntry.value?.slug === slug` 匹配检查（:438-448）
- view 层调用方式不变：`entryListStore.toggleVisibility(entry)` / `entryListStore.deleteEntry(slug)`，无需 view 层手动协调（:454）

**验证**：
- 对照源码 entry.ts:148-178（`toggleVisibility`）和 entry.ts:180-191（`deleteEntry`），R5 代码正确映射了乐观更新+回滚逻辑
- 对照源码 entry.ts:157-159（`currentEntry.value?.id === entry.id` 同步检查），R5 的 `syncVisibility` 用 slug 匹配是等价的安全检查
- Pinia action 内引用是官方推荐的 store 间协调模式，方案选择正确

**结论**：**FIXED** — 跨 store 协调机制已明确，含完整代码示例，implementer 可直接遵循。

### 1.2 [BLOCKER-3 已修复] props/emit 契约表

**第一轮问题**：R6 方案列出了 5 个子组件的职责但未给出 props/emit 契约，用"等"字模糊处理，留了 AI Slop 空间。

**修复确认**：P2-design.md:596-707 现在包含完整的 5 子组件 props/emit 契约表：

| 子组件 | props 数 | emits 数 | 完整性 |
|--------|----------|----------|--------|
| EntryDetailHeader | 15 | 5 | ✓ 覆盖 entryTitle/relativeTime/fullTime/isExpiredButActive/metaTagsHidden/isFileTreeOpen/isTocOpen/isMarkdown/tocHeadings/isMultiFile/canCopy/showShareButton/shareDialogOpen/activeShareCount/overflowItems/authState/currentEntry |
| EntryDetailBanners | 3 | 1 | ✓ 覆盖 isExpiredButActive/isArchived/isOwner |
| EntryDetailContent | 17 | 6 | ✓ 覆盖 isFileTreeOpen/isTocOpen/showFileDrawer/showTocDrawer/currentEntry/activeFile/fileContent/fileLoading/fileError/shareErrorState/slug/isMarkdown/isHtml/isImage/isBinary/pathMap/tocHeadings/siblingFileIds/wrapEnabled/canWrap/isMultiFile |
| EntryDetailMobileBar | 10 | 4 | ✓ 覆盖 isMultiFile/isMarkdown/tocHeadings/isBinary/canWrap/canCopy/wrapEnabled/showFileDrawer/showTocDrawer/overflowItems/currentEntry |
| EntryDetailDialogs | 7 | 6 | ✓ 覆盖 showConfirmDelete/deleteMessage/showExpiresInDialog/showLogin/isShareAccess/slug/isArchived/sharedBy |

**验证**：
- 对照 EntryDetailView.vue 模板实际使用（:1-335），契约表中的 props 和 emits 与模板中的 `v-if`/`v-show`/`@click`/`:prop` 绑定一一对应
- `overflowItems` 留在主组件 computed，通过 prop 传入 Header 和 MobileBar — 消除了第一轮的歧义
- `v-model:visible` pattern 正确用于 dialogs（`update:show-confirm-delete` 等）
- 无"等"字残留

**结论**：**FIXED** — 5 子组件 props/emit 契约完整，无模糊空间。

---

## 2. WARNING 处理确认

### 2.1 [WARNING-1 已处理] storeToRefs 拆分方式

P2-design.md:460-467 明确展示了拆分后的 `storeToRefs` 使用方式：从 `entryDetailStore` 取 `currentEntry`/`activeFile`/`fileContent`/`wrapEnabled`/`loading`/`error`，`entryListStore` 直接调用方法。

**结论**：ADDRESSED

### 2.2 [WARNING-2 已处理] provide/inject key 和类型

P2-design.md:565-584 定义了完整的 provide/inject 规范：
- Symbol keys：`ZenModeKey`/`IsMobileKey`/`ZenAriaTextKey`（:571-573）
- InjectionKey 类型：`Ref<boolean>` / `ComputedRef<boolean>` / `Ref<string>`（:571-573）
- provide 的位置：主组件（:576-578）
- inject 的子组件：Header（v-show）、MobileBar（v-show）、Content（isMobile 分支）（:580-583）
- aria-live `<span>` 留在主组件（:584）

**结论**：ADDRESSED

### 2.3 [WARNING-3 已处理] composable 函数签名和返回值

P2-design.md:709-740 定义了两个 composable 的完整接口：

**useZenMode**（:712-721）：
- 返回值：`zenMode: Ref<boolean>` / `zenAriaText: Ref<string>` / `handleZenKeydown: (event: KeyboardEvent) => void` / `updateZenAria: (zen: boolean) => void`
- 生命周期：主组件在 onMounted/onUnmounted 管理 addEventListener/removeEventListener，composable 不自行注册

**useResponsiveLayout**（:724-739）：
- 返回值：`viewportWidth: Ref<number>` / `isMobile: ComputedRef<boolean>` / `isDesktop: ComputedRef<boolean>` / `metaTagsHidden: Ref<boolean>` / `handleResize: () => void` / `setupScrollHide: (container: HTMLElement) => () => void`
- 生命周期：主组件在 onMounted 注册 resize + scroll listener，onUnmounted 清理

**对照验证**：现有 composable `useRelativeTime` 在内部使用 `onMounted`/`onUnmounted`，而新 composable 将生命周期委托给主组件。两种模式在 Vue 3 中都合法——composable 在 `setup()` 调用时可以使用生命周期钩子，也可以将注册/清理返回给调用者。新 composable 的"主组件控制生命周期"模式更显式，不是回归。

**结论**：ADDRESSED

### 2.4 [WARNING-4 已处理] drawer 状态所有权

P2-design.md:586-592 明确定义：
- `showFileDrawer`/`showTocDrawer` 留在主组件（持有 ref）
- EntryDetailContent 接收作为 props，渲染 drawer overlay + drawer 内容
- EntryDetailMobileBar emit `@toggle-file-drawer`/`@toggle-toc-drawer`，主组件接收后切换 ref
- EntryDetailContent emit `@close-file-drawer`/`@close-toc-drawer`（点击 overlay 或选择后关闭）

**验证**：对照 EntryDetailView.vue:281-307（drawer 渲染）和 :255-264（MobileBar 触发按钮），此 props+emit 模式正确映射了现有行为。主组件作为状态协调者，Content 和 MobileBar 通过 props/emit 通信。

**结论**：ADDRESSED

### 2.5 [WARNING-5 已处理] aria-live 区域归属

P2-design.md:584 明确："aria-live `<span>` 留在主组件模板中（渲染 `zenAriaText`，主组件直接从 useZenMode 获取）"。

**验证**：对照 EntryDetailView.vue:3 `<span class="sr-only" aria-live="polite">{{ zenAriaText }}</span>`，留在主组件合理——主组件持有 `useZenMode` 返回值，直接渲染。

**结论**：ADDRESSED

### 2.6 [WARNING-6 已处理] 测试迁移计划

P2-design.md:474-479 包含测试迁移计划：
- `entryList.spec.ts`：测试 loadEntries/toggleVisibility（list 侧）/deleteEntry（list 侧）/loadSeq，toggleVisibility 需 mock `useEntryDetailStore`
- `entryDetail.spec.ts`：测试 loadEntry/selectFile/syncVisibility/clearIfSlug
- `entry-store-auth.spec.ts` 和 `t031-entry-store.spec.ts`：import 改为 `useEntryListStore` 或 `useEntryDetailStore`
- `t031-entry-detail-view.spec.ts`：mock 路径改为 `@/stores/entryList` + `@/stores/entryDetail`

**结论**：ADDRESSED（但有遗漏，见 §3 新 WARNING）

---

## 3. 新发现 WARNING（不阻塞）

### 3.1 [NEW-WARNING] 测试迁移计划遗漏两个测试文件

**问题**：设计中的测试迁移计划（P2-design.md:474-479）提到了 4 个测试文件，但遗漏了 2 个也 mock 了 `@/stores/entry` 的测试文件：

1. **`t067-detail-framework.spec.ts`**（575 行）：mock `@/stores/entry` → `useEntryStore`，mount `EntryDetailView.vue`，测试 zen mode/sign in/brand/reads count 等行为。需要迁移 mock 路径为 `@/stores/entryList` + `@/stores/entryDetail`。

2. **`t031-entry-list-view.spec.ts`**（141 行）：mock `@/stores/entry` → `useEntryStore`，mount `EntryListView.vue`，测试 search placeholder/skeleton loading。需要迁移 mock 路径为 `@/stores/entryList`。

**影响**：P4 implementer 如果只按设计的测试迁移计划操作，可能遗漏这两个文件，导致测试失败。

**建议**：在测试迁移计划中补充这两个文件，或注明"所有 mock `@/stores/entry` 的测试文件都需迁移"。

### 3.2 [NEW-WARNING] t067-detail-framework.spec.ts 使用 wrapper.setData({ zenMode: true })

**问题**：`t067-detail-framework.spec.ts:544` 使用 `await wrapper.setData({ zenMode: true })` 来测试 zen mode 行为。R6 拆分后 `zenMode` 移至 `useZenMode` composable 并通过 provide/inject 传递，`wrapper.setData` 可能无法直接设置 provide 的值。

**影响**：测试需要改用 mock `useZenMode` composable 或通过 provide 注入 mock ref 的方式来控制 zen mode 状态。

**建议**：P4 implementer 注意 `wrapper.setData` 在 composable + provide/inject 模式下的替代方案。

---

## 4. BDD 覆盖验证（第二轮）

| BDD | 方案覆盖 | 第二轮评审 |
|-----|----------|------------|
| BDD-17 (list/detail 不同 store) | R5 方案 A | OK |
| BDD-18 (每个 store < 150 行) | R5 行数预估 ~100/~130 | OK |
| BDD-19 (loadSeq 保留) | R5 明确保留在 entryList.ts | OK |
| BDD-20 (loadSeq 竞态防护) | R5 保留逻辑 | OK |
| BDD-21 (searchUrl.logic.ts) | R5 纯函数不变 | OK |
| BDD-22 (URL 参数恢复) | R5 EntryListView 改用 useEntryListStore | OK |
| BDD-23 (主组件 < 300 行) | R6 行数预估 ~270 行 | OK，契约表已补充不会溢出 |
| BDD-24 (子组件 < 200 行) | R6 行数预估各 < 180 | OK |
| BDD-25-38 (行为零回归) | R6 拆分方案 + 契约表 | OK，契约表确保 implementer 不偏 |
| BDD-39 (错误格式兼容) | R7 方案 | OK |
| BDD-40-41 (测试+类型检查) | gate_commands | OK |

---

## 5. R7 错误格式兼容（不变）

R7 方案与第一轮评审一致，3 个文件 `.detail` → `.error?.message`，改动量 3 行，正确识别 LoginDialog.vue 的 `e.detail` 是 DOM CustomEvent 不受影响。无阻塞问题。

---

## 6. 总结

### BLOCKER 修复状态

| # | 第一轮 BLOCKER | 修复状态 | 验证依据 |
|---|----------------|----------|----------|
| 1 | 跨 store 协调机制 | **FIXED** | P2-design.md:375-454 含完整 Pinia action 内引用代码 |
| 2 | props/emit 契约表 | **FIXED** | P2-design.md:596-707 含 5 子组件完整契约表 |

### WARNING 处理状态

| # | 第一轮 WARNING | 处理状态 | 验证依据 |
|---|----------------|----------|----------|
| 3 | storeToRefs 拆分 | **ADDRESSED** | P2-design.md:460-467 |
| 4 | provide/inject key/类型 | **ADDRESSED** | P2-design.md:565-584 |
| 5 | composable 签名/返回值 | **ADDRESSED** | P2-design.md:709-740 |
| 6 | drawer 状态所有权 | **ADDRESSED** | P2-design.md:586-592 |
| 7 | aria-live 归属 | **ADDRESSED** | P2-design.md:584 |
| 8 | 测试迁移计划 | **ADDRESSED** | P2-design.md:474-479（有遗漏，见新 WARNING） |

### 新 WARNING（不阻塞 P4）

| # | 新 WARNING | 严重性 | 建议 |
|---|------------|--------|------|
| 9 | 测试迁移计划遗漏 t067-detail-framework.spec.ts | WARNING | 补充到测试迁移计划 |
| 10 | 测试迁移计划遗漏 t031-entry-list-view.spec.ts | WARNING | 补充到测试迁移计划 |
| 11 | wrapper.setData({ zenMode: true }) 在 composable+provide 模式下可能失效 | WARNING | P4 注意替代方案 |

### 亮点（第二轮新增）

- R5 代码示例完整可执行，toggleVisibility 的乐观更新+回滚逻辑正确映射了现有实现
- R6 契约表中 `v-model:visible` pattern 正确用于 dialogs
- provide/inject 使用 Symbol key + InjectionKey 类型，遵循 Vue 3 最佳实践
- composable 生命周期管理委托给主组件，比内部 onMounted 更显式可控
- drawer 状态 props+emit 模式清晰定义了 Content 和 MobileBar 的跨子组件协调

### 最终结论

**status: approved**

2 个 BLOCKER 已修复（含完整代码示例），6 个 WARNING 已处理。3 个新 WARNING 均为测试迁移计划的细节遗漏，不影响设计方案的正确性，P4 implementer 可在实现时补充。设计方案已消除所有模糊空间，implementer 可直接遵循。