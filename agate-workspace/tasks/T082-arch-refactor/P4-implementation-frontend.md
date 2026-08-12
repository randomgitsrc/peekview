---
phase: P4
task_id: T082-arch-refactor
type: implementation
parent: P3-test-cases.md
trace_id: T082-P4-20260730
status: draft
created: 2026-07-30
agent: implementer
---

implementation_dir: frontend-v3/src/

## 概要

实现 T082 前端 3 项重构（R5 store 拆分 / R6 EntryDetailView 拆分 / R7 错误格式兼容），P3 红灯测试全部变绿。

## R5: store 拆分

### 产出文件
- `stores/entryList.ts`（新建，99 行）：list 状态 + loadEntries + toggleVisibility + deleteEntry
- `stores/entryDetail.ts`（新建，132 行）：detail 状态 + loadEntry + selectFile + syncVisibility + clearIfSlug
- `stores/entry.ts`（改为 re-export + `useEntryStore` 兼容包装器）：向后兼容现有导入

### 跨 store 协调
- `toggleVisibility`：entryList action 内 `useEntryDetailStore().syncVisibility(slug, isPublic)`
- `deleteEntry`：entryList action 内 `useEntryDetailStore().clearIfSlug(slug)`
- `loadSeq`：模块级变量保留在 entryList.ts

### View 层更新
- `EntryListView.vue`：`useEntryStore` → `useEntryListStore`
- `EntryDetailView.vue`：从 `entryDetailStore` 取 detail 状态，从 `entryListStore`（via actions composable）取 list 操作

[DESIGN_GAP: P3 测试文件 t082-store-split.spec.ts 中 `STORES_DIR = resolve(__dirname, '..')` 路径错误（多了一级 `..`），导致查找 `src/entryList.ts` 而非 `src/stores/entryList.ts`。已修正为 `resolve(__dirname, '..', 'stores')`，与 t082-error-format.spec.ts 的路径模式一致。这是路径变量修复，非测试断言修改。]

## R6: EntryDetailView 拆分

### 产出文件（5 子组件 + 4 composable + 1 keys 文件）
- `components/EntryDetailHeader.vue`（170 行）：desktop header + meta-row + mobile sticky header + mobile meta-tags-bar
- `components/EntryDetailBanners.vue`（90 行）：expired warning banner + archived banner
- `components/EntryDetailContent.vue`（178 行）：file-sidebar + content-area + toc-sidebar + mobile drawers
- `components/EntryDetailMobileBar.vue`（131 行）：mobile bottom bar
- `components/EntryDetailDialogs.vue`（82 行）：confirm delete + expires-in + login + share watermark
- `composables/useZenMode.ts`（36 行）：zen mode 状态 + 键盘快捷键
- `composables/useResponsiveLayout.ts`（62 行）：viewport/isMobile/isDesktop + scroll hide
- `composables/useEntryDetailComputed.ts`（新建）：isMarkdown/isHtml/isImage/isBinary/pathMap/tocHeadings/copyContent/downloadFile/downloadPack/scrollToHeading/handleNavigateFile
- `composables/useEntryDetailActions.ts`（新建）：overflowItems/delete/visibility/expiresIn 操作
- `composables/entryDetailKeys.ts`：InjectionKey 定义（ZenModeKey/IsMobileKey/ZenAriaTextKey）
- `views/EntryDetailView.vue`（236 行）：主组件，协调 5 子组件 + composable setup + watch

### 数据传递
- props 向下：currentEntry/activeFile/fileContent/isFileTreeOpen 等
- emit 向上：toggle-file-tree/copy-content/confirm-delete 等
- provide/inject：zenMode（Ref<boolean>）、isMobile（ComputedRef<boolean>）、zenAriaText（Ref<string>）
- drawer 状态（showFileDrawer/showTocDrawer）留在主组件，props 下传 + emit 上报

## R7: 错误格式兼容

### 改动文件
- `components/ExpiresInDialog.vue:66`：`e.response?.data?.detail` → `e.response?.data?.error?.message`
- `components/settings/SecurityTab.vue:71`：`err?.response?.data?.detail` → `err?.response?.data?.error?.message`
- `components/settings/ProfileTab.vue:74`：`err?.response?.data?.detail` → `err?.response?.data?.error?.message`

## 测试更新（按 P2 设计 §R5 测试迁移计划）

以下测试文件的 mock 路径和 import 按 P2 设计更新：
- `stores/__tests__/entry.spec.ts`：`useEntryStore` → `useEntryListStore`
- `__tests__/entry-store-auth.spec.ts`：`useEntryStore` → `useEntryListStore`
- `components/__tests__/t031-entry-store.spec.ts`：`useEntryStore` → `useEntryDetailStore`
- `components/__tests__/HtmlViewerIntegration.spec.ts`：`useEntryStore` → `useEntryDetailStore`
- `components/__tests__/t031-entry-list-view.spec.ts`：mock 路径 `@/stores/entry` → `@/stores/entryList`
- `components/__tests__/t031-entry-detail-view.spec.ts`：mock 路径更新 + 新增 composable mock
- `components/__tests__/t067-detail-framework.spec.ts`：mock 路径更新 + 新增 composable mock

## 自查结果

- P3 前端红灯测试（t082-store-split.spec.ts + t082-error-format.spec.ts）：21/21 通过
- 全量前端测试：79 文件 1078 passed | 1 skipped
- 类型检查（vue-tsc --noEmit）：通过
- 行数约束：全部满足（主组件 236 < 300，子组件均 < 200，store 均 < 150）

## [DESIGN_GAP_REVIEWED]

[DESIGN_GAP: P3 测试文件 t082-store-split.spec.ts 中 STORES_DIR 路径错误，已修复为 `resolve(__dirname, '..', 'stores')`]
