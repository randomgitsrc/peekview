---
phase: P7
task_id: T025-user-page
type: consistency
parent: P2-design.md
trace_id: T025-P7-20260628
created: 2026-06-28
---

# P7 一致性检查 — 用户公开页

## 方向 1：设计→实现（逐项对照 P2-design.md）

### 1. 后端：三阶段管线 + 所有构造点透传 owner_found

| 检查项 | 预期 | 实际 | 判定 |
|--------|------|------|------|
| Phase 1: resolve owner to user_id | 结构清晰的三阶段解耦 (#325-352) | entry_service.py:325-351 完整实现 | ✅ 一致 |
| Phase 2: apply owner filter | owner_user_id not None → where owner_id filter | entry_service.py:353-356 | ✅ 一致 |
| Phase 3: apply visibility filter | retain existing logic (is_admin / anonymous / authed) | entry_service.py:358-370 | ✅ 一致 |
| 构造点 1: owner="me" + 未登录 | `owner_found=None` | L333-336: `owner_found=None` | ✅ 一致 |
| 构造点 2: FTS 搜索无结果 | `owner_found=owner_found` (透传) | L391-394: `owner_found=owner_found` | ✅ 一致 |
| 构造点 3: 正常最终返回 | `owner_found=owner_found` (透传) | L438-441: `owner_found=owner_found` | ✅ 一致 |
| 构造点 4: username 不存在 | `owner_found=False` (提前 return) | L348-351: `owner_found=False` | ✅ 一致 |
| 大小写不敏感 | `func.lower(User.username) == owner.lower()` | L342: exact match | ✅ 一致 |
| Tags filter 保留 (不再提前 return) | WHERE-only, no early return | L372-377: unchanged | ✅ 一致 |
| FTS except:Exception 吞掉 | pass, 不提前 return | L395-397: `pass` | ✅ 一致 |
| Batch resolve usernames | 保持原有 N+1 解决方案 | L405-412: unchanged | ✅ 一致 |

**结论**：三阶段管线完整实现，4/4 个构造点全部显式传 `owner_found`。

---

### 2. EntryListResponse owner_found 字段定义

| 检查项 | 预期 | 实际 | 判定 |
|--------|------|------|------|
| 类型 | `bool \| None = Field(default=None, ...)` | models.py:436-441: exact match | ✅ 一致 |
| Field description | Tri-state 三行描述 (None/True/False) | exact match | ✅ 一致 |

---

### 3. 路由 /users/:username 正确插入

| 检查项 | 预期 | 实际 | 判定 |
|--------|------|------|------|
| 位置 | 在 `/:slug` 之前 | router.ts:16-22, 在 L24 `/:slug` 之前 | ✅ 一致 |
| 注释 | "Must appear before /:slug..." | router.ts:17 | ✅ 一致 |
| props 透传 | `(route) => ({ owner: route.params.username as string })` | router.ts:21: exact match | ✅ 一致 |
| name | `'user-entries'` | router.ts:19 | ✅ 一致 |

---

### 4. EntryListView owner prop 三态设计

| 检查项 | 预期 | 实际 | 判定 |
|--------|------|------|------|
| `isBannerMode` | `!!(props.owner) && props.owner !== 'me' && ownerFound.value !== false` | EntryListView.vue:233-235 | ✅ 一致 |
| `showTabs` | `authState === 'authenticated' && !isBannerMode` | EntryListView.vue:237-239 | ✅ 一致 |
| `showChip` | `!!currentOwner && currentOwner !== 'me' && !props.owner` | EntryListView.vue:241-243 | ✅ 一致 |
| `effectiveOwner` | `props.owner \|\| currentOwner \|\| undefined` | EntryListView.vue:245 | ✅ 一致 |
| v-if 链优先级 | loading → ownerFound=false → error → empty → grid | template:48-65, 顺序一致 | ✅ 一致 |
| user-not-found 条件 | `ownerFound === false && props.owner` | template:50 | ✅ 一致 |
| empty 双模板 | `ownerFound === true` vs 默认 | template:57-62 | ✅ 一致 |
| `restoreFromURL` | ownerParam !== 'me' → chip; === 'me' + authed → mine | EntryListView.vue:380-388 | ✅ 一致 |
| auth race watch | authenticated + !props.owner + URL ?owner=me + currentOwner !== 'me' → reload | EntryListView.vue:368-378 | ✅ 一致 |
| watch(props.owner) | newOwner → reset + load | EntryListView.vue:360-366 | ✅ 一致 |
| `clearOwnerFilter` | 数据→URL 顺序, `router.replace('/explore')` | EntryListView.vue:262-267 | ✅ 一致 |
| `setOwner` | 数据→URL 顺序, replace | EntryListView.vue:249-260 | ✅ 一致 |
| card-actions | 保留 `@click.stop` | template:77,84 | ✅ 一致 |

| 检查项 | 预期 | 实际 | 判定 |
|--------|------|------|------|
| onMounted 加载顺序 | banner模式跳过 loadEntries（懒加载 via watch） | banner模式也立即 loadEntries (L400-402) | ⚠️ 差异 |

> **onMounted 差异分析**：P2 设计期望 banner 模式下不立即 loadEntries，交由 `watch(props.owner)` 触发。实现中 banner 模式也在 onMounted 直接加载（`loadEntries({ page: 1, perPage: perPage.value, owner: props.owner })`）。这是**合理改进**——避免 mount→watch 空窗期闪白屏，两个模式加载路径对称一致。`watch(props.owner)` 仍保留处理路由内跳转（`/users/alice` → `/users/bob`）。

---

### 5. 嵌套 router-link 解决方案

| 检查项 | 预期 | 实际 | 判定 |
|--------|------|------|------|
| 外层 | `<div>` (非 `<router-link>`) | template:91 | ✅ 一致 |
| role="link" | 屏幕阅读器识别 | template:93 | ✅ 一致 |
| tabindex="0" | Tab 键可聚焦 | template:94 | ✅ 一致 |
| @click | `navigateToEntry(entry)` | template:95 | ✅ 一致 |
| @keydown.enter.prevent | Enter 键导航 | template:96 | ✅ 一致 |
| @keydown.space.prevent | Space 键导航 | template:97 | ✅ 一致 |
| meta-creator span | `@click.stop` 阻止冒泡 | template:102 | ✅ 一致 |
| 自己点击 | `/explore?owner=me` | template:104-107 | ✅ 一致 |
| 他人点击 | `/users/${entry.username}` | template:109-112 | ✅ 一致 |
| currentUserUsername | `user.value?.username ?? null` | EntryListView.vue:247 | ✅ 一致 |

---

### 6. BannerBar 组件

| 检查项 | 预期 | 实际 | 判定 |
|--------|------|------|------|
| props | `username: string` | BannerBar.vue:14 | ✅ 一致 |
| template 结构 | banner-bar > banner-back + banner-title | BannerBar.vue:2-10 | ✅ 一致 |
| "Back to Home" + "←" | `<router-link to="/explore">` | BannerBar.vue:3-6 | ✅ 一致 |
| title | `@` + username + `'s` entries | BannerBar.vue:7-9 | ✅ 一致 |
| 样式: desktop | flex row, gap-4, padding, bg-secondary | BannerBar.vue:18-25 | ✅ 一致 |
| 样式: @480px | flex-direction column, align-self flex-start, min-height 44px | BannerBar.vue:47-64 | ✅ 一致 |
| 样式: @360px | padding 缩小, font-size 缩小 | BannerBar.vue:66-69 | ✅ 一致 |

---

### 7. FilterChip 组件

| 检查项 | 预期 | 实际 | 判定 |
|--------|------|------|------|
| props | `label: string` (无 dismissible) | FilterChip.vue:9 | ✅ 一致 |
| emits | `dismiss` | FilterChip.vue:10 | ✅ 一致 |
| template | filter-chip > label + dismiss button `×` | FilterChip.vue:2-5 | ✅ 一致 |
| dismiss button | `aria-label="Remove filter"` | FilterChip.vue:4 | ✅ 一致 |
| 样式 | inline-flex, pill, accent-light, hover 加深 | FilterChip.vue:13-50 | ✅ 一致 |

---

### 8. API 层数据透传

| 检查项 | 预期 | 实际 | 判定 |
|--------|------|------|------|
| `api/types.ts` `EntryListApiResponse` | `owner_found?: boolean \| null` | api/types.ts:50 | ✅ 一致 |
| `types/index.ts` `EntryListResponse` | `ownerFound?: boolean \| null` | types/index.ts:33 | ✅ 一致 |
| `api/client.ts` `listEntries` | `ownerFound: response.data.owner_found ?? null` | api/client.ts:106 | ✅ 一致 |
| `stores/entry.ts` `ownerFound` ref | `ref<boolean \| null>(null)` | stores/entry.ts:17 | ✅ 一致 |
| `stores/entry.ts` 赋值 | `ownerFound.value = response.ownerFound ?? null` | stores/entry.ts:64 | ✅ 一致 |

---

### 9. improvement-backlog.md 记录 tech debt

| 检查项 | 预期 | 实际 | 判定 |
|--------|------|------|------|
| `TD-T025-perf` tech debt 条目 | `func.lower(User.username)` 无函数索引 | **未找到** — improvement-backlog.md 中无相关条目 | ⚠️ 差异 |

> P2 设计「实现完成标志」第 8 条和「影响域分析」表格明确要求记录该 tech debt。当前 improvement-backlog.md 共 19 个已编号条目，无 `TD-T025-perf` 或 `func.lower` 相关内容。

---

### 10. Tab URL 同步 (router.replace)

| 检查项 | 预期 | 实际 | 判定 |
|--------|------|------|------|
| setOwner('me') | `router.replace({ path: '/explore', query: { owner: 'me' } })` | EntryListView.vue:254 | ✅ 一致 |
| setOwner(username) | `router.replace({ path: '/explore', query: { owner } })` | EntryListView.vue:256 | ✅ 一致 |
| setOwner(null) | `router.replace({ path: '/explore' })` | EntryListView.vue:258 | ✅ 一致 |
| 数据→URL 顺序 | loadEntries 先, replace 后 | EntryListView.vue:249-260 | ✅ 一致 |

---

## 方向 2：实现→设计（检查设计文档中是否有不再适用的要求）

| 检查项 | 发现 | 判定 |
|--------|------|------|
| BDD-BE-8/9 (FTS+owner 组合) | 实现管线中 FTS 搜索在 Phase 3 visibility filter 之后、order/pagination 之前正确串联 | ✅ 设计仍适用 |
| `/explore?owner=me` 直接访问 auth race | `watch(authState)` + `restoreFromURL` 双重保障，正确实现 | ✅ 设计仍适用 |
| card div[role="link"] 键盘可访问性 | 所有属性正确实现 (`role`, `tabindex`, keydown handlers) | ✅ 设计仍适用 |
| 无 `<a>` 嵌套 `<a>` | 外层 `div` + 内层 `router-link` → 渲染为 `div > a`，合法 | ✅ 设计仍适用 |
| banner 移动端 | 3 个断点全部实现 (default / @480px / @360px) | ✅ 设计仍适用 |
| EntryDetailView 不改 | 确认未修改 | ✅ 设计仍适用 (不改) |
| MCP / CLI 不改 | 确认未修改 | ✅ 设计仍适用 (不改) |

---

## 综合评定

| 类别 | 数量 |
|------|------|
| ✅ 一致 | 51 |
| ⚠️ 差异 | 2 |
| ❌ BLOCKER | 0 |

### ⚠️ 差异详情

1. **onMounted 加载时机**：P2 设计只让 explore 模式在 onMounted 加载，banner 模式延迟到 `watch(props.owner)`。实现中两种模式都在 onMounted 立即加载。这是合理改进（避免闪白屏），`watch(props.owner)` 仍处理路由内跳转。
2. **improvement-backlog.md 缺失 TD-T025-perf**：P2 设计要求在 completion criteria #8 记录 `func.lower(User.username)` 无函数索引的 tech debt。条目未写入。

---

## BLOCKER 检查

无 [BLOCKER] 级别偏离。两个差异均不涉及删除方案要求的功能或修改未声明的接口。

---

## 附录：设计自身不一致 (P2 自身)

P2 设计 2.1 节标题说「5 个 EntryListResponse 构造点」，但详细表格列出 4 处构造点。实现遵循 4 处清单，全部正确。**此不一致在 P2 文档内部，不影响实现。**

---

## 返回给主 Agent

文件路径: `docs/tasks/T025-user-page/P7-consistency.md`

一致性比例: 51/53 ✅ 一致, 2 ⚠️ 差异, 0 ❌ BLOCKER。缺 improvement-backlog.md TD-T025-perf entry (实现完成标志 #8 未满足)。onMounted banner 模式立即加载是合理改进。
