---
phase: P4
task_id: T039-explore-ui-polish
type: implementation
trace_id: T039-P4-20260630
status: complete
created: 2026-06-30
---

## 修改文件清单

### 1. `frontend-v3/src/components/EntryCard.vue`

**改动**: BaseBadge 渲染添加 `v-if="isOwner"` 条件

- L35: `<div class="card-footer">` → `<div v-if="isOwner" class="card-footer">`
- isOwner prop 已存在（默认 false），调用方 EntryListView.vue 已通过 `authStore.isOwner(entry.ownerId)` 正确传递

**对应 BDD**: R1.1, R1.2

### 2. `frontend-v3/src/components/EntryListRow.vue`

**改动 A**: 删除 `.entry-summary` 行（summary 去重）

- 删除模板行: `<div v-if="entry.summary" class="entry-summary">{{ entry.summary }}</div>` (原 L12)
- 删除 CSS: `.entry-summary` 样式块 (原 L121-128)

**对应 BDD**: R2.1, R2.2

**改动 B**: BaseBadge 渲染添加 `v-if="isOwner"` 条件

- L22: `<BaseBadge :status="...">` → `<BaseBadge v-if="isOwner" :status="...">`
- isOwner prop 已存在（默认 false），调用方已正确传递

**对应 BDD**: R1.3, R1.4

**改动 C**: 标签不限数量

- 删除 `const TAG_LIMIT = 3`
- `visibleTags` 改为 `computed(() => props.entry.tags)`
- `remainingTagCount` 改为 `computed(() => 0)`

**对应 BDD**: R3.2

### 3. `frontend-v3/src/views/EntryDetailView.vue`

**改动**: 标签不限数量

- 删除 `const TAG_LIMIT = 3`
- `visibleTags` 改为 `computed(() => currentEntry.value?.tags ?? [])`
- `remainingTagCount` 改为 `computed(() => 0)`

**对应 BDD**: R3.3

### 4. `frontend-v3/src/components/__tests__/EntryListRow.spec.ts`（连带修改）

**改动**: Badge 测试加 isOwner 条件

- 原 "renders public badge for public entry" → 改为传 `isOwner: true`，改名加 "when owner"
- 原 "renders private badge for private entry" → 改为传 `isOwner: true`，改名加 "when owner"
- 新增 "hides badge when not owner" 测试：传 `isOwner: false`，断言 `.base-badge` 不存在

**对应 BDD**: R1.4（测试覆盖）

## BDD 覆盖矩阵

| BDD | 实现 | 验证 |
|-----|------|------|
| R1.1 Owner 看 EntryCard badge | EntryCard.vue: `v-if="isOwner"` on card-footer | 单测（EntryCard 无独立 spec，P6 截图验证） |
| R1.2 非 owner 看 EntryCard 无 badge | EntryCard.vue: `v-if="isOwner"` on card-footer | 同上 |
| R1.3 Owner 看 EntryListRow badge | EntryListRow.vue: `v-if="isOwner"` on BaseBadge | EntryListRow.spec.ts: "renders public/private badge when owner" |
| R1.4 非 owner 看 EntryListRow 无 badge | EntryListRow.vue: `v-if="isOwner"` on BaseBadge | EntryListRow.spec.ts: "hides badge when not owner" |
| R2.1 列表模式无 .entry-summary 节点 | EntryListRow.vue: 删除 summary 行 | P6 截图验证 |
| R2.2 列表模式 title 显示 summary | EntryListRow.vue: title 行 `entry.summary \|\| entry.slug` 不变 | 现有单测 "renders entry summary" |
| R3.1 卡片模式标签限 3 +N | EntryCard.vue: TAG_LIMIT=3 不变 | P6 截图验证 |
| R3.2 列表模式标签全部显示 | EntryListRow.vue: visibleTags 返回全部 tags | P6 截图验证 |
| R3.3 详情页标签全部显示 | EntryDetailView.vue: visibleTags 返回全部 tags | P6 截图验证 |
| R3.4 0 标签不显示标签区域 | 三个组件 v-if="entry.tags.length" 不变 | 现有行为不变 |

## 验证结果

- `npx vue-tsc --noEmit`: PASS（无错误）
- `./node_modules/.bin/vitest run`: 45 files, 606 tests PASS
- [PROD_TOUCHED]: 无
