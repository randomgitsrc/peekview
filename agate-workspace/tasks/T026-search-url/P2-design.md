---
phase: P2
task_id: T026-search-url
type: design
parent: P1-requirements.md
trace_id: T026-P2-20260628
status: draft
created: 2026-06-28
packages: [frontend-v3]
domains: [frontend, routing]
ui_affected: true
gate_commands:
  P5:
    - cd frontend-v3 && npx vue-tsc --noEmit
    - cd frontend-v3 && npm run build
    - cd frontend-v3 && ./node_modules/.bin/vitest run
  P5_e2e:
    - make debug-test
  P6:
    - make debug-test
env_constraints:
  debug_env: "cd frontend-v3 && npx vue-tsc --noEmit && npm run build && ./node_modules/.bin/vitest run; E2E via make debug-test (requires debug backend on :8888)"
  isolation_check: "vitest 测试使用临时 DOM (jsdom)，不触碰真实 ~/.peekview/；E2E 通过 make debug 隔离环境执行"
files_to_read:
  - path: frontend-v3/src/views/EntryListView.vue:1-426
    why: 完整模板 (search input 插入位置、v-if chain) + script setup (setOwner/clearOwnerFilter/restoreFromURL/currentPage watcher，均需修改)
  - path: frontend-v3/src/views/EntryListView.vue:428-774
    why: 样式部分，search input 样式追加位置
  - path: frontend-v3/src/stores/entry.ts:1-206
    why: loadEntries 签名确认 (已接受 ListEntriesParams 含 q/owner/page/perPage)
  - path: frontend-v3/src/router.ts:1-68
    why: 路由定义确认 (/explore 和 /users/:username 共用 EntryListView)
  - path: frontend-v3/src/composables/useDebounce.ts:1-16
    why: 防抖 composable 签名和用法 (复用)
  - path: frontend-v3/src/types/index.ts:36-43
    why: ListEntriesParams 类型定义 (q 字段已存在)
  - path: frontend-v3/src/api/client.ts:88-108
    why: api.listEntries 的参数映射 (确认 q 正确传递到后端)
  - path: frontend-v3/src/views/__tests__/EntryListView.logic.spec.ts:1-257
    why: 现有测试模式 (P3 将按此模式新增搜索相关纯逻辑测试)
minimal_validation: none
---

# P2 方案设计 — T026 search-url

## 1. 改动方案

### 1.1 影响域分析

**改什么**（仅一个文件）：

| 文件 | 改动范围 | 说明 |
|------|---------|------|
| `frontend-v3/src/views/EntryListView.vue` | template + script + style | 核心改动：新增 search input UI + 4 个新函数 + 修改 4 个现有函数 + 扩展 2 个 watcher |

具体改动点：
- **template**: header 区域插入 search input（logo 右侧、header-actions 左侧）
- **script setup**: 
  - 新增 `searchQuery` ref + `updateURL()` 合并函数 + `flushSearch()` + `clearSearch()`
  - 修改 `setOwner()` — 使用 `updateURL` 保留 `q`
  - 修改 `clearOwnerFilter()` — 使用 `updateURL` 保留 `q`
  - 扩展 `restoreFromURL()` — 读取 `q` 和 `page`
  - 扩展 `currentPage` watcher — 同步 `?page=` 到 URL
  - 扩展 `onMounted` — 从 URL 恢复 `searchQuery` 和 `currentPage`
  - 去掉不再需要的 `authState` watcher（逻辑合并到 `restoreFromURL`）
- **style**: search input 样式（desktop + mobile 响应式）

**不改什么**：
- `stores/entry.ts` — loadEntries 已支持 q 参数（line 52），无需任何改动
- `router.ts` — 不新增 `/search` 路由
- `api/client.ts` — API 层已支持 q 参数（line 92）
- `types/index.ts` — ListEntriesParams.q 已存在
- `components/Pagination.vue` — 分页组件只 emit `update:page`，URL 同步由 EntryListView 负责
- 后端任何文件
- MCP Server

**风险在哪**：

| 风险点 | 缓解措施 |
|--------|---------|
| `router.replace` 覆盖其他 query 参数 | `updateURL()` 从 `window.location.search` 读取当前全部 query，只修改目标 key，保留其他 key |
| 防抖期间用户快速输入导致竞态 | 复用 `useDebounce` 的 "只执行最后一次" 语义；Enter 立即 `clearTimeout` 取消防抖 |
| 移动端 search input 过窄 | 设置 `min-width: 0` + `flex: 1`，在 640px 以下全宽 |
| `props.owner` 变化时 searchQuery 残留 | `watch(props.owner)` 时从 URL 重新初始化 searchQuery |
| 分页与搜索的 page 重置 | 搜索词变化时重置 `currentPage.value = 1`；分页变化时保留 q |

### 1.2 核心设计决策

#### 决策 1: searchQuery 放 EntryListView 本地 ref

**选择**: 本地 `ref<string>('')`，不放入 store。

**理由**:
- searchQuery 是纯 UI 状态（输入框当前值），不跨组件共享
- store 的 `loadEntries` 接受 `q` 参数即可驱动搜索，无需 store 持久化 searchQuery
- URL 是 searchQuery 的真实持久化源（mount/route-change 时从 URL 恢复）
- 避免 store 膨胀（store 已管理 page/perPage/total/entries/loading/error/ownerFound 等状态）

**数据流**:
```
URL (?q=) ←→ searchQuery ref ←→ <input v-model>
                    ↓ (防抖/Enter)
              loadEntries({ q: searchQuery, ... })
                    ↓
              entries ref ←→ 列表渲染
```

#### 决策 2: updateURL() 合并函数

**签名**: `function updateURL(params: Record<string, string | undefined>): void`

**语义**:
- 从 `window.location.search` 解析当前全部 query params
- 将 `params` 中的 key-value 合并进去（`undefined` 值表示删除该 key）
- 用 `router.replace` 写回 URL

**示例**:
```typescript
// 当前 URL: /explore?q=python
updateURL({ owner: 'me' })    // → /explore?q=python&owner=me
updateURL({ q: 'react' })     // → /explore?q=react&owner=me (保留 owner)
updateURL({ q: undefined })   // → /explore?owner=me (删除 q)
updateURL({ page: 2 })        // → /explore?q=python&page=2
```

**实现要点**:
- 使用 `new URLSearchParams(window.location.search)` 读取当前 query
- `params` 中 key 值为 `undefined` 或空字符串时，从 query 中删除该 key
- 特殊处理：`page === 1` 时省略 `?page=`（page=1 是默认值，不写 URL 保持简洁）
- 最终 query 为空对象 `{}` 时，`router.replace({ path, query: undefined })` 或直接不传 query

#### 决策 3: 防抖 + Enter 立即 + Esc 清空

```
用户输入 "p"  "y"  "t"  "h"  "o"  "n"  [Enter]
         |    |    |    |    |    |      |
    启动定时器 重置  重置  重置  重置  重置   flush + 立即
         \    \    \    \    \    \      /
          `---- 300ms 后触发 flushSearch ----´
```

**实现**:
```typescript
const searchQuery = ref('')
const debouncedSearch = useDebounce(flushSearch, 300)

function flushSearch() {
  // 1. 更新 URL (保留 owner, page 重置为 1)
  const q = searchQuery.value.trim()
  updateURL({ q: q || undefined, page: undefined })
  // 2. 重置分页
  currentPage.value = 1
  // 3. 调用 API
  loadEntries({ page: 1, perPage: perPage.value, owner: effectiveOwner.value, q: q || undefined })
}

function onSearchInput() {
  debouncedSearch()  // 防抖 300ms
}

function onSearchKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    flushSearch()           // 立即触发
    ;(e.target as HTMLInputElement)?.blur()  // 收起移动端键盘
  } else if (e.key === 'Escape') {
    clearSearch()
  }
}

function clearSearch() {
  searchQuery.value = ''
  updateURL({ q: undefined })
  currentPage.value = 1
  loadEntries({ page: 1, perPage: perPage.value, owner: effectiveOwner.value })
  // blur input
}
```

**关键点**:
- `flushSearch` 同时更新 URL 和调用 API（不分离）
- Enter 调用 `flushSearch`（和防抖到期行为一致，只是提前触发）
- Esc 清空 input + 移除 URL `?q=` + 重新加载
- 搜索框自带 X 清除按钮（`<input type="search">` 浏览器原生），点击时触发 `input` 事件 → 防抖路径 → 空值时 `q || undefined` → 移除 `?q=`
- `searchQuery` trim 处理：`q || undefined` 保证纯空格不写入 URL

#### 决策 4: 分页 URL 同步

**现状**: `currentPage` watcher (line 356) 只调用 `loadEntries`，不写 URL。

**改动**: 扩展 watcher 同时同步 URL:
```typescript
watch(currentPage, (newPage) => {
  updateURL({ page: newPage > 1 ? String(newPage) : undefined })
  loadEntries({ page: newPage, perPage: perPage.value, owner: effectiveOwner.value, q: searchQuery.value || undefined })
})
```

page=1 时省略 `?page=`（默认值不污染 URL）。

#### 决策 5: mount/route-change 恢复

**`restoreFromURL()` 扩展**:
```typescript
function restoreFromURL() {
  const urlParams = new URLSearchParams(window.location.search)
  
  // 恢复 owner
  const ownerParam = urlParams.get('owner')
  if (ownerParam && ownerParam !== 'me') {
    currentOwner.value = ownerParam
  } else if (ownerParam === 'me' && authState.value === 'authenticated') {
    currentOwner.value = 'me'
  }
  
  // 恢复 searchQuery
  const qParam = urlParams.get('q')
  searchQuery.value = qParam || ''
  
  // 恢复 page
  const pageParam = urlParams.get('page')
  currentPage.value = pageParam ? Math.max(1, parseInt(pageParam) || 1) : 1
}
```

**onMounted 流程**:
```
onMounted:
  1. restoreFromURL()          // 从 URL 恢复 owner + q + page
  2. loadEntries({ page: currentPage, perPage, owner: effectiveOwner, q: searchQuery || undefined })
```

**watch(route.query)** — 新增 watcher 处理浏览器前进/后退:
```typescript
watch(() => router.currentRoute.value.query, (newQuery) => {
  const q = (newQuery.q as string) || ''
  if (q !== searchQuery.value) {
    searchQuery.value = q
    loadEntries({ page: currentPage.value, perPage: perPage.value, owner: effectiveOwner.value, q: q || undefined })
  }
  // 类似处理 owner 变化（只在此 watcher 中处理外部 URL 变化，内部主动 setOwner/setQuery 不触发此 watcher 重复加载）
})
```

Wait — this creates a loop: `updateURL` → query changes → watcher fires → `loadEntries`. Need a guard.

**更好的方案**: 不用 `watch(route.query)`，而是在 `watch(props.owner)` 和浏览器 popstate 时恢复。但 Vue Router 的 popstate 自动处理了组件复用场景——当用户在 `/explore?q=python` 和 `/explore?q=react` 之间前进后退时，同一个 `EntryListView` 实例会复用，`props.owner` 不变，所以需要额外处理。

**最终方案**: 用 `onBeforeRouteUpdate` (组件内导航守卫):
```typescript
import { onBeforeRouteUpdate } from 'vue-router'

onBeforeRouteUpdate((to) => {
  if (to.path === '/explore' || to.path.startsWith('/users/')) {
    const newQ = (to.query.q as string) || ''
    const newOwner = (to.query.owner as string) || null
    const newPage = parseInt(to.query.page as string) || 1
    
    searchQuery.value = newQ
    currentOwner.value = newOwner
    currentPage.value = newPage
    
    loadEntries({ page: newPage, perPage: perPage.value, owner: newOwner || undefined, q: newQ || undefined })
  }
})
```

这覆盖了浏览器前进后退场景（BDD-11）。

#### 决策 6: 搜索词变化重置分页

在 `flushSearch()` 中已处理（设置 `currentPage.value = 1` + 更新 URL 移除 `page`）。
在 `clearSearch()` 中也处理（设置 `currentPage.value = 1`）。

`setOwner()` 中已重置分页（现有行为，不变）。但改为用 `updateURL` 合并后，`setOwner` 不再清空 `q`。

#### 决策 7: Template 布局

Search input 放在 header 中间位置：

```
┌──────────────────────────────────────────────────────────────┐
│ [PeekView]   [🔍 Search entries...          ]  [User] [Theme]│
└──────────────────────────────────────────────────────────────┘
```

```html
<header class="list-header">
  <router-link to="/" class="logo-link">PeekView</router-link>
  <div class="search-box">
    <input
      v-model="searchQuery"
      type="search"
      class="search-input"
      placeholder="Search entries..."
      @input="onSearchInput"
      @keydown="onSearchKeydown"
    />
  </div>
  <div class="header-actions">
    <!-- existing login/user-menu/ThemeToggle -->
  </div>
</header>
```

CSS 使用 flexbox 三栏布局：logo (flex-shrink: 0) | search (flex: 1) | actions (flex-shrink: 0)。

移动端 (max-width: 640px)：search input 换行独占一行，全宽显示。

### 1.3 完整函数签名与调用链

```
新函数:
  updateURL(params: Record<string, string | undefined>) → void
    内部读取 window.location.search，合并 params，router.replace
    page=1 时省略 ?page=，空字符串值时删除对应 key
  
  flushSearch() → void
    1. const q = searchQuery.value.trim()
    2. updateURL({ q: q || undefined, page: undefined })
    3. currentPage.value = 1
    4. loadEntries({ page: 1, perPage, owner: effectiveOwner, q: q || undefined })
  
  clearSearch() → void
    1. searchQuery.value = ''
    2. updateURL({ q: undefined })
    3. currentPage.value = 1
    4. loadEntries({ page: 1, perPage, owner: effectiveOwner })
    5. 可选: inputRef?.blur()
  
  onSearchInput() → void
    debouncedSearch()  // 防抖 wrapper
  
  onSearchKeydown(e: KeyboardEvent) → void
    if Enter: flushSearch(); blur
    if Esc:   clearSearch()

修改的现有函数:
  setOwner(owner: string | null)
    旧: router.replace({ path: '/explore', query: { owner } })  // 会丢失 q
    新: updateURL({ owner: owner || undefined, page: undefined })
  
  clearOwnerFilter()
    旧: router.replace({ path: '/explore' })  // 会丢失 q
    新: updateURL({ owner: undefined, page: undefined })
  
  restoreFromURL()
    新增: 读取 q 和 page 参数
  
  currentPage watcher
    新增: updateURL({ page })

新增的导航守卫:
  onBeforeRouteUpdate(to)
    处理浏览器前进后退 (BDD-11)

扩展的 onMounted:
  1. restoreFromURL() → 恢复 owner + q + page
  2. loadEntries({ page, perPage, owner: effectiveOwner, q })
```

## 2. 实现计划

### P3: 纯逻辑单元测试
- URL 合并函数 `updateURL` 的纯逻辑测试（模拟 URLSearchParams）
- `flushSearch` 的调用序列测试（mock loadEntries）
- `clearSearch` 的行为测试
- Enter/Esc 键盘事件分发测试

### P4: 代码实现（详见 §1）
- 修改 `EntryListView.vue`（template + script + style）
- 不改其他文件

### P5: 技术验证
- `vue-tsc --noEmit` 通过
- `npm run build` 成功
- `vitest run` 全部 86+ 现有 + 新增测试通过
- 手动确认 search input 渲染

### P6: BDD 验收
- Playwright E2E 覆盖全部 16 条 BDD

## 3. 实现完成的标志

1. `updateURL()` 合并函数：当前有 `?q=python`，调用 `updateURL({ owner: 'me' })` → URL 变为 `?q=python&owner=me`
2. `setOwner()` 切换 tab 时保留搜索词
3. `clearOwnerFilter()` 清除 tab 时保留搜索词
4. `flushSearch()` 输入搜索词 → URL 更新 + 列表更新
5. 防抖 300ms：连续输入只在最后一次输入后 300ms 触发请求
6. Enter 立即触发（不等待防抖）
7. Esc 清空输入框 + URL `?q=` 移除 + 列表恢复
8. mount 时从 URL 恢复 searchQuery + owner + page
9. 浏览器前进后退正确恢复搜索状态
10. 搜索词变化时 page 重置为 1
11. 分页变化时 `?page=` 写入 URL
12. 空查询（空格 trim）不写入 `?q=`
13. `vue-tsc --noEmit` 0 错误
14. `npm run build` 成功
15. `vitest run` 全绿
16. BDD 1-16 全部 PASS

## 4. 风险登记

| 编号 | 风险 | 可能性 | 影响 | 缓解 |
|------|------|--------|------|------|
| R1 | `router.replace` 在 search input 快速输入时触发频繁 URL 更新 | 中 | 低 | 防抖确保 300ms 内最多 1 次 replace；Enter 只在按键时触发 |
| R2 | search input 在 `/users/:username` 页面行为异常 | 低 | 中 | `effectiveOwner` 正确传递 `props.owner`；`flushSearch` 使用 `effectiveOwner` |
| R3 | 浏览器前进后退触发重复 loadEntries | 中 | 低 | `onBeforeRouteUpdate` 在组件内只触发一次，不会循环 |
| R4 | 移动端 search input 布局溢出 | 低 | 低 | 响应式 CSS 处理，640px 以下换行全宽 |

## 5. 附录: 与 T025 的协调

P0-brief 推荐 T025 完成后 T026 启动（串行）。T025 在 header 加 `BannerBar`（条件渲染 `v-if="isBannerMode"`），search input 在 header 区，两者在 DOM 层面不冲突（BannerBar 在 content 区，search input 在 header 区）。
