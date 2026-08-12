---
phase: P4
task_id: T025-user-page
type: implementation
parent: P2-design.md
trace_id: T025-P4-frontend-20260628
created: 2026-06-28
---

# P4 前端实现记录 — T025 user-page

## 概要

实现 P2 设计方案中所有前端改动，使 TDD P3 阶段的 18 个红灯测试全部变绿。

## 改动清单

### 1. `frontend-v3/src/api/client.ts` — ownerFound 透传

- `listEntries()` 返回对象增加 `ownerFound: response.data.owner_found ?? null`

### 2. `frontend-v3/src/stores/entry.ts` — ownerFound 状态存储

- 新增 `const ownerFound = ref<boolean | null>(null)`
- `loadEntries` 内存储：`ownerFound.value = response.ownerFound ?? null`
- 返回对象暴露 `ownerFound`

### 3. `frontend-v3/src/router.ts` — /users/:username 路由

- 在 `/:slug` 之前注册 `/users/:username` 路由
- name: `'user-entries'`，复用 `EntryListView.vue`
- `props: (route) => ({ owner: route.params.username as string })`
- 附带注释说明顺序的重要性

### 4. `frontend-v3/src/components/FilterChip.vue` — 新建完整组件

- Props: `label: string`
- Emits: `dismiss`
- 模板: `<span class="filter-chip">` 内含 label + dismiss 按钮（`aria-label="Remove filter"`）
- 样式: inline-flex pill，`var(--accent-light)` 背景，hover 加深

### 5. `frontend-v3/src/components/BannerBar.vue` — 新建完整组件

- Props: `username: string`
- 模板: `router-link` Back to Home + `<h1>` @username's entries
- 样式: flex 布局，响应式断点 480px（纵向堆叠）/360px（缩小字号）

### 6. `frontend-v3/src/views/EntryListView.vue` — 核心重构

**Props：**
- 新增 `owner?: string` prop

**Computed：**
- `isBannerMode`：`!!props.owner && props.owner !== 'me' && ownerFound !== false`
- `showTabs`：`authState === 'authenticated' && !isBannerMode`
- `showChip`：`!!currentOwner && currentOwner !== 'me' && !props.owner`
- `effectiveOwner`：`props.owner || currentOwner || undefined`
- `currentUserUsername`：`user.value?.username ?? null`

**函数变更：**
- `setOwner()` — 增加 `router.replace()` 同步 URL（先加载数据，后更新 URL）；"me" → `?owner=me`，用户名 → `?owner=username`，null → 无 query
- `clearOwnerFilter()` — 清除 filter + URL 回到 `/explore`
- `navigateToEntry(entry)` — `router.push(/${entry.slug})`
- `restoreFromURL()` — 从 URL query 恢复 owner 状态
- `onMounted()` — banner 模式跳过 URL 恢复，prop 权威
- `watch(authState)` — 修复 race condition：authenticated 后补检 `?owner=me`
- `watch(props.owner)` — prop 变化时重置并加载

**模板变更：**
- `<BannerBar>` — `v-if="isBannerMode"` 显示 banner
- 条件 tabs — `v-if="showTabs"` 替换 `v-if="authState === 'authenticated'"`
- `<FilterChip>` — `v-if="showChip"` 显示 dismissible chip
- v-if 链优先级：loading → user-not-found (`ownerFound===false`) → error → empty → grid
- 卡片重构：外层 `<router-link>` → `<div role="link" tabindex="0">` + `@click`/`@keydown`
- username 可点击：`<span @click.stop>` + 内部 `<router-link>`（自己 → `/explore?owner=me`，他人 → `/users/:username`）

**CSS 新增：**
- `.filter-chip-bar`, `.user-not-found`, `.creator-text`, `.username-link`
- `.card-body` 增加 `cursor: pointer`

## 测试修复

### `client.spec.ts`
- `beforeEach` 增加 `vi.resetModules()` — 解决模块缓存导致的 mock 实例不更新问题

### `BannerBar.spec.ts`
- 所有测试增加 `global.stubs: { 'router-link': routerLinkStub }` — 解决 vue-test-utils 无 router 实例时 `router-link` 不渲染 `<a>` 的问题
- 移除未使用的 `RouterLink` import

## 验证结果

| 校验项 | 结果 |
|--------|------|
| `vitest run` (T025 6 files) | 59/59 ✅ |
| `vitest run` (全量 34 files) | 429/429 ✅ (0 regression) |
| `vue-tsc --noEmit` | 0 errors ✅ |
| `npm run build` | 成功 ✅ |

## P6 回归修复（2026-06-28）

P6 验收发现 3 个 BDD FAIL，已修复：

| BDD | 根因 | 修复 |
|-----|------|------|
| FE-1 | `onMounted` banner 模式不调用 `loadEntries` | `onMounted` else 分支加 `loadEntries({ page: 1, perPage: perPage.value, owner: props.owner })` |
| FE-2 | 同上，连带导致 `ownerFound` 为 null、`isBannerMode` 误判 | 同上修复连带解决 |
| FE-7 | All tab `active` 条件 `currentOwner !== 'me'` 在 chip 模式误激活 | 改为 `currentOwner === null`（仅无 filter 时激活 All tab） |

修复后全量 vitest (429) + vue-tsc + build 均通过。

## 未改动文件

- `frontend-v3/src/api/types.ts` — `owner_found` 字段已存在（P3 阶段埋入）
- `frontend-v3/src/types/index.ts` — `ownerFound` 字段已存在（P3 阶段埋入）
- 后端文件 — 由后端 P4 子 Agent 负责
- `docs/roadmap/improvement-backlog.md` — 由后端子 Agent 添加 TD-T025-perf
