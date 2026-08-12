---
phase: P2
task_id: T025-user-page
type: design
parent: P1-requirements.md
trace_id: T025-P2-20260628
status: revised
created: 2026-06-28
revised: 2026-06-28
review_ref: P2-review.md
---

# P2 方案设计 — 用户公开页

## 1. 影响域分析

### 改什么

| 文件 | 改动 | 对应 BDD |
|------|------|----------|
| `backend/peekview/models.py:429-436` | `EntryListResponse` 加 `owner_found: bool \| None` 字段（含 Field description） | BE-3,4,5 |
| `backend/peekview/services/entry_service.py:289-411` | `list_entries` 增加 `owner=username` 解析→过滤→权限叠加 pipeline；**所有** `EntryListResponse(...)` 构造点显式传 `owner_found` | BE-1~9 |
| `frontend-v3/src/api/types.ts:45-50` | `EntryListApiResponse` 加 `owner_found?: boolean \| null` | FE-1,2 |
| `frontend-v3/src/types/index.ts:28-33` | `EntryListResponse` 加 `ownerFound?: boolean \| null` | FE-1,2 |
| `frontend-v3/src/api/client.ts:89-107` | `listEntries` 透传 `owner_found` → `ownerFound` | FE-1,2 |
| `frontend-v3/src/stores/entry.ts:48-66` | `loadEntries` 返回 `ownerFound`，store 加 `ownerFound` ref | FE-1,2 |
| `frontend-v3/src/router.ts:5-31` | 新增 `/users/:username` 路由，插入 `/:slug` 之前，附带注释 | FE-1 |
| `frontend-v3/src/views/EntryListView.vue` | 接受 `owner` prop；banner 模式（含 ownerFound 条件）；chip 模式；嵌套 router-link 解决（含可访问性）；username 可点击；tab URL 同步（含 auth race watch）；v-if 链整合；分页重置 | FE-1~9 |
| `frontend-v3/src/components/BannerBar.vue` | 新建：用户页 banner（@username 的发布内容 + Back to Home），移动端断点具体化 | FE-1 |
| `frontend-v3/src/components/FilterChip.vue` | 新建：轻量 dismissible chip（@username ×），T026 可复用 | FE-7 |
| `docs/roadmap/improvement-backlog.md` | 记录 `func.lower(User.username)` 无函数索引 tech debt（`TD-T025-perf`） | M-5 |

### 不改什么

| 文件 | 理由 |
|------|------|
| `backend/peekview/api/entries.py` | owner query param 已透传（108-127），无需改 |
| `backend/peekview/models.py` User 模型 | 大小写处理已存在（注册 .lower()），不在 T025 范围 |
| MCP Server | T025 范围限定 peekview 后端+前端 |
| CLI | 同上 |
| `frontend-v3/src/views/EntryDetailView.vue` | 本任务不改详情页 |
| `frontend-v3/src/components/LoginDialog.vue` | 已集成在 EntryListView，无需改动 |

### 风险在哪

| 风险 | 缓解 |
|------|------|
| 嵌套 router-link 重构时破坏卡片 click 行为 | 外层用 `@click` + `router.push` 保留整体可点击；card-actions 已有 `@click.stop` |
| `entry_service.py` 改动波及现有 577 个后端测试 | 解耦 owner 解析与权限过滤，`owner="me"` 行为语义零回归 |
| username 大小写敏感 SQLite BINARY collation | 查端 `func.lower(User.username) == owner.lower()`；tech debt 记录到 improvement-backlog |
| URL 同步 `router.replace` 可能触发不必要的 re-fetch | watch router.query 只在 owner 改变且与 currentOwner 不同时才 reload |
| auth race condition（H-3） | watch(authState) 在 authenticated 时补检 URL；见 2.5 节 |

---

## 2. 设计方案

### 2.1 后端：owner=username 查询管线

**当前问题**：`list_entries` 中 `owner="me"` 分支与 `is_admin`/`current_user_id` 分支交织（325-344），加 `owner=username` 会导致分支爆炸。

**方案**：解耦为「解析→过滤→权限叠加」三阶段管线。

**`owner_found` 三态语义（集中定义）**：
| 值 | 语义 | 触发场景 |
|----|------|---------|
| `None` | owner 未指定，或 `owner="me"`（不适用） | `/explore` / `/explore?owner=me` |
| `True` | username 在 User 表中存在 | `/users/alice`、`/explore?owner=alice`（user 存在） |
| `False` | username 在 User 表中不存在 | `/users/nonexistent` |

**`EntryListResponse(...)` 构造点完整清单（4 处，每处必须显式传 `owner_found`）**：

| # | 位置（entry_service.py） | 场景 | 必须传 |
|---|--------------------------|------|--------|
| 1 | ~L327（现有） | `owner="me"` 但未登录 | `owner_found=None` |
| 2 | ~L365-367（现有） | FTS 搜索无结果 | `owner_found=owner_found` |
| 3 | ~L411（现有） | 正常最终返回 | `owner_found=owner_found` |
| 4 | Phase 1 新增 | username 不存在（提前 return） | `owner_found=False` |

```
def list_entries(..., owner=None):
    # owner_found tri-state: None (N/A or "me") | True (user exists) | False (user not found)
    owner_found = None
    owner_user_id = None

    # === Phase 1: Resolve owner to user_id ===
    if owner is not None:
        if owner == "me":
            if current_user_id is None:
                return EntryListResponse(     # 构造点 1: owner="me" + 未登录
                    items=[], total=0, page=page, per_page=per_page,
                    owner_found=None)         # None = "me" 不触发 username 查找
            owner_user_id = current_user_id
            # owner_found remains None for "me" (not applicable)
        else:
            # Real username: case-insensitive lookup
            user = session.exec(
                select(User).where(func.lower(User.username) == owner.lower())
            ).first()
            if user:
                owner_user_id = user.id
                owner_found = True
            else:
                return EntryListResponse(     # 构造点 4: username 不存在
                    items=[], total=0, page=page, per_page=per_page,
                    owner_found=False)        # False = user not in DB

    # === Phase 2: Apply owner filter to query ===
    if owner_user_id is not None:
        query = query.where(Entry.owner_id == owner_user_id)
        count_query = count_query.where(Entry.owner_id == owner_user_id)

    # === Phase 3: Apply visibility filter (existing logic, unchanged) ===
    if is_admin:
        pass  # Admin sees all
    elif current_user_id is None:
        query = query.where(Entry.is_public == True)
        count_query = count_query.where(Entry.is_public == True)
    else:
        query = query.where((Entry.is_public == True) | (Entry.owner_id == current_user_id))
        count_query = count_query.where((Entry.is_public == True) | (Entry.owner_id == current_user_id))

    # Tags filter (JSON array, unchanged — WHERE only, no early return)
    if tags:
        for tag in tags:
            ...

    # FTS5 search
    if q and q.strip():
        try:
            fts_result = session.exec(...)
            fts_ids = [...]
            if fts_ids:
                query = query.where(Entry.id.in_(fts_ids))
                count_query = count_query.where(Entry.id.in_(fts_ids))
            else:
                return EntryListResponse(     # 构造点 2: FTS 无匹配
                    items=[], total=0, page=page, per_page=per_page,
                    owner_found=owner_found)  # 透传 Phase 1 解析结果
        except Exception:
            pass                              # FTS 不可用，不提前 return

    # Order + pagination (unchanged)
    query = query.order_by(Entry.created_at.desc())
    total = session.exec(count_query).one()
    entries = session.exec(query.offset(offset).limit(per_page)).all()

    # Batch resolve usernames (unchanged)
    ...

    return EntryListResponse(                 # 构造点 3: 正常返回
        items=items, total=total, page=page, per_page=per_page,
        owner_found=owner_found)              # 透传 Phase 1 解析结果
```

**关键细节**：

- **Phase 1 提前 `return`**：username 不存在时直接在 Phase 1 返回 `owner_found=False`，不跑后续查询。这满足 BDD-BE-3（不存在的 username 返回空列表 + owner_found=false）。
- **Phase 2 用户存在但无可见 entry**：owner filter 施加后，visibility filter 可能进一步过滤掉全部 entry（如匿名用户看 private-only 用户），此时 Phase 3 自然产生 `items=[]`，最终返回 `owner_found=True`（Phase 1 已确认用户存在）— 满足 BDD-BE-4（username 存在但无 public entry → items=[], owner_found=true）。
- **Phase 3 权限叠加**：owner filter 和 visibility filter 是 AND 关系，通过串联 `.where()` 自然实现。admin 在 Phase 3 跳过 visibility filter，所以即使 owner filter 生效，admin 仍看到该用户全部 entry。满足 BDD-BE-6。
- **`owner="me"` 行为语义零回归**：Phase 1 的 `owner=="me"` 分支保留原有语义（未登录 → 空列表，已登录 → 按 owner_id 过滤），`owner_found` 返回 None。代码结构虽从 `if/elif` 变为三阶段管线，但行为路径不变。满足 BDD-BE-5（回归保护）。

**大小写处理**：
- 查端：`func.lower(User.username) == owner.lower()`
- User.username 已有 UNIQUE 索引（SQLite BINARY collation），但不影响 `.lower()` 匹配
- 注册端 `.lower()` 入库逻辑已存在，T025 不改
- **Tech debt**：`func.lower(User.username)` 无函数索引（User 表极小无实际性能风险），记录到 `docs/roadmap/improvement-backlog.md`，标签 `TD-T025-perf`（M-5）

**已删除用户 vs 不存在用户**：两个场景 DB 层不可区分（User 物理删除 + FK CASCADE），统一返回 `items=[]` + `owner_found=False`。前端显示 "User @xxx not found"。用户已裁决（PAUSED-resolution.md Q1）。

**对应 BDD 覆盖**：
| BDD | 行为 | 实现机制 |
|-----|------|---------|
| BE-1 | owner=alice 返回 alice 的 3 个 entry | Phase 1 解析 + Phase 2 owner filter |
| BE-2 | owner=ALICE 大小写不敏感 | `func.lower()` 查端 |
| BE-3 | 不存在 username → items=[], owner_found=false | Phase 1 提前 return（构造点 4） |
| BE-4 | 存在但无可见 → items=[], owner_found=true | Phase 2 + Phase 3 串联 → 构造点 3 透传 owner_found=True |
| BE-5 | owner="me" → owner_found=None | 构造点 1 显式 None |
| BE-6 | admin 看全部 | Phase 3 `is_admin` 跳过 visibility filter |
| BE-7 | 匿名只看公开 | Phase 3 `current_user_id is None` 分支 |
| BE-8 | owner=existing_user + q=keyword 组合 | 构造点 2/3 透传 owner_found=True |
| BE-9 | owner=existing_user + q=nonexistent 组合 | 构造点 2 透传 owner_found=True → items=[] |

> BE-8/BE-9 是 [SCOPE+] 增补（M-6）：FTS 搜索与 owner filter 的组合路径是 BLK-1 风险场景，P3 必须覆盖。

---

### 2.2 后端：EntryListResponse 新增字段

**`models.py` EntryListResponse 修改**：

```python
from sqlmodel import Field

class EntryListResponse(SQLModel):
    items: list[EntryListItem]
    total: int
    page: int
    per_page: int
    owner_found: bool | None = Field(
        default=None,
        description="Tri-state: None=owner not specified or 'me' (N/A), "
                    "True=username exists in database, "
                    "False=username not found"
    )
```

对应 BDD-BE-3（owner_found=false）、BE-4（owner_found=true）、BE-5（owner_found=None）。

---

### 2.3 前端：API 层数据透传

**数据流**：Backend JSON `owner_found` → `api/types.ts` `EntryListApiResponse` → `api/client.ts` `listEntries` → `types/index.ts` `EntryListResponse` → `stores/entry.ts` → `EntryListView.vue`

**改动点（4 文件，各 1-3 行）**：

1. `api/types.ts` `EntryListApiResponse`：加 `owner_found?: boolean | null`
2. `types/index.ts` `EntryListResponse`：加 `ownerFound?: boolean | null`
3. `api/client.ts` `listEntries`：返回对象加 `ownerFound: response.data.owner_found ?? null`
4. `stores/entry.ts`：加 `const ownerFound = ref<boolean | null>(null)`，`loadEntries` 内 `ownerFound.value = response.ownerFound ?? null`

---

### 2.4 前端：路由设计

**`router.ts` 新增路由**（注意顺序）：

```ts
const routes: RouteRecordRaw[] = [
  { path: '/', name: 'landing', component: () => import('./views/LandingView.vue') },
  { path: '/explore', name: 'explore', component: () => import('./views/EntryListView.vue') },
  {
    // Must appear before /:slug to avoid matching "users" as a slug parameter
    path: '/users/:username',
    name: 'user-entries',
    component: () => import('./views/EntryListView.vue'),
    props: (route) => ({ owner: route.params.username as string }),
  },
  { path: '/:slug', name: 'detail', component: () => import('./views/EntryDetailView.vue'), props: true },
  { path: '/settings/apikeys', name: 'api-keys', component: () => import('./views/ApiKeyListView.vue') },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('./views/NotFoundView.vue') },
]
```

**关键注意**：`/users/:username` 在 routes 数组中出现在 `/:slug` 之前（中间元素），否则 Vue Router 会把 `/users/alice` 匹配到 `/:slug` 的 `detail` 路由（S-4）。

---

### 2.5 前端：EntryListView owner prop 三态设计

**三态矩阵**（来自 P1 附录 B，P2 细化）：

```
owner prop   | banner mode | tabs    | chip    | 数据来源
undefined    | 否           | All/Mine | 否     | /explore 无 owner filter
"me"         | 否           | All/Mine | 否     | /explore?owner=me（高频高亮 Mine tab）
"alice"      | 是(@alice)   | 隐藏     | 否     | /users/alice（用户专页）
(URL query ?owner=alice) → currentOwner 不受 prop 控制 → 显示 chip
```

**实现逻辑**：

```ts
const props = defineProps<{
  owner?: string  // undefined | "me" | "alice"
}>()

// banner 模式：owner prop 存在且不是 "me" 且 ownerFound 不为 false（H-1 fix）
const isBannerMode = computed(() =>
  !!(props.owner) && props.owner !== 'me' && ownerFound.value !== false
)

// tabs 显示：非 banner 模式下，且 authState === 'authenticated'
const showTabs = computed(() =>
  authState.value === 'authenticated' && !isBannerMode.value
)

// chip 显示：currentOwner 为真用户名（非 "me"），且不是 banner 模式（无 prop）
const showChip = computed(() =>
  !!currentOwner.value && currentOwner.value !== 'me' && !props.owner
)

const effectiveOwner = computed(() => props.owner || currentOwner.value || undefined)
```

**mount/route change 协调**（P1 F4 + M-2 + H-3 fix）：

```ts
onMounted(() => {
  if (props.owner) {
    // Banner mode: prop is authoritative, skip URL restoration
    currentOwner.value = null
    currentPage.value = 1           // 显式重置（M-2）
  } else {
    // Explore mode: restore from URL query
    currentPage.value = 1           // 显式重置（M-2），不依赖 page.value
    restoreFromURL()
  }
  if (!props.owner) {
    // Only load immediately in explore mode; banner mode loads via watch(props.owner)
    loadEntries({ page: currentPage.value, perPage: perPage.value, owner: effectiveOwner.value })
  }
})
```

**authState race condition 修复（H-3）**：

```ts
// 直接访问 /explore?owner=me 时，onMounted 中 authState 可能是 'loading'
// 需要在 authenticated 后补检 URL
watch(authState, (newState) => {
  if (newState === 'authenticated' && !props.owner) {
    const urlParams = new URLSearchParams(window.location.search)
    const ownerParam = urlParams.get('owner')
    if (ownerParam === 'me' && currentOwner.value !== 'me') {
      currentOwner.value = 'me'
      currentPage.value = 1
      loadEntries({ page: 1, perPage: perPage.value, owner: 'me' })
    }
  }
})
```

```ts
function restoreFromURL() {
  const urlParams = new URLSearchParams(window.location.search)
  const ownerParam = urlParams.get('owner')
  if (ownerParam && ownerParam !== 'me') {
    currentOwner.value = ownerParam  // real username → chip mode
  } else if (ownerParam === 'me' && authState.value === 'authenticated') {
    currentOwner.value = 'me'        // Mine tab
  }
  // If authState is 'loading' at mount time, watch(authState) catches it later
}
```

**route 变化 watch**（`/users/alice` → `/users/bob` 时 prop 变化但组件不复用）：

```ts
watch(() => props.owner, (newOwner) => {
  if (newOwner) {
    currentOwner.value = null
    currentPage.value = 1
    loadEntries({ page: 1, perPage: perPage.value, owner: newOwner })
  }
})
```

**v-if 链整合（M-1）**（user-not-found 插入位置）：

```html
<div class="list-content">
  <BannerBar v-if="isBannerMode" :username="props.owner!" />

  <div v-if="showTabs" class="owner-tabs">
    <button class="owner-tab" :class="{ active: currentOwner !== 'me' }" @click="setOwner(null)">All</button>
    <button class="owner-tab" :class="{ active: currentOwner === 'me' }" @click="setOwner('me')">Mine</button>
  </div>

  <div v-if="showChip" class="filter-chip-bar">
    <FilterChip :label="`@${currentOwner}`" @dismiss="clearOwnerFilter" />
  </div>

  <div v-if="loading">Loading...</div>

  <div v-else-if="ownerFound === false && props.owner" class="user-not-found">
    User <strong>@{{ props.owner }}</strong> not found
  </div>

  <div v-else-if="error" class="error">{{ error }}</div>

  <div v-else-if="entries.length === 0" class="empty">
    <template v-if="ownerFound === true">
      No entries from @{{ props.owner }}
    </template>
    <template v-else>
      No entries found
    </template>
  </div>

  <div v-else>
    <!-- entry grid -->
  </div>
</div>
```

**v-if 链优先级**：loading → ownerFound=false → error → empty → grid。（`ownerFound=false` 在 error 之前，因为 backend 已明确返回「用户不存在」，不应该因为某些隐含错误而掩盖此信息。）

对应 BDD-FE-1（banner 模式）、FE-2（不存在的 username 显示 "User not found"）、FE-5（tab URL 同步）、FE-6（URL 恢复 tab）、FE-7（chip 模式）。

---

### 2.6 前端：嵌套 router-link 解决（含可访问性修复）

**当前结构（问题）**：
```html
<router-link :to="`/${entry.slug}`" class="card-body">
  <h3>{{ entry.summary }}</h3>
  <span>@{{ entry.username }}</span>  <!-- 无法在此内部加 <a> -->
</router-link>
```

**方案：层级分离点击区域（H-2 可访问性修复已融入）**

```html
<div class="entry-card">
  <!-- card-actions 保持不变（已有 @click.stop） -->
  <div v-if="authStore.isOwner(entry.ownerId)" class="card-actions">
    <button @click.stop="handleToggleVisibility(entry)">...</button>
    <button @click.stop="confirmDeleteEntry(entry)">...</button>
  </div>

  <!-- Card body: div 替代 router-link，保留可访问性 -->
  <div
    class="card-body"
    role="link"
    tabindex="0"
    @click="navigateToEntry(entry)"
    @keydown.enter.prevent="navigateToEntry(entry)"
    @keydown.space.prevent="navigateToEntry(entry)"
  >
    <h3 class="entry-title">{{ entry.summary }}</h3>
    <div class="entry-meta">
      <!-- ... 其他 meta items ... -->
      <span v-if="entry.username" class="meta-item meta-creator" @click.stop>
        <span class="creator-text">@</span>
        <template v-if="entry.username === currentUserUsername">
          <router-link :to="{ path: '/explore', query: { owner: 'me' } }" class="username-link">
            {{ entry.username }}
          </router-link>
        </template>
        <template v-else>
          <router-link :to="`/users/${entry.username}`" class="username-link">
            {{ entry.username }}
          </router-link>
        </template>
      </span>
      <!-- ... -->
    </div>
  </div>
</div>
```

```ts
const currentUserUsername = computed(() => user.value?.username ?? null)

function navigateToEntry(entry: Entry) {
  router.push(`/${entry.slug}`)
}
```

**可访问性措施（H-2）**：
| 属性 | 作用 |
|------|------|
| `role="link"` | 屏幕阅读器识别为链接 |
| `tabindex="0"` | 可通过 Tab 键聚焦 |
| `@keydown.enter.prevent` | Enter 键触发导航 |
| `@keydown.space.prevent` | Space 键触发导航 |

**关键设计决策**：
- 外层 `<div>` 替代 `<router-link>`：用 `@click` + `router.push()` 保留整体可点击。不影响现有 card-actions 的 `@click.stop`。
- username 区域 `<span @click.stop>` 阻止事件冒泡，内部用 `<router-link>` 实现正确的 `<a>` 元素（语义化 + 右键新标签页/复制链接）。
- `<a>` 不会嵌套 `<a>`：外层是 `<div>`，内部是 `<router-link>`（渲染为 `<a>`），DOM 检查可验证无嵌套。

对应 BDD-FE-3（点击 username 跳转）、FE-4（点自己跳 /explore?owner=me）、FE-9（无嵌套 `<a>`）。

---

### 2.7 前端：dismissible chip 组件（FilterChip.vue）

**用途**：`/explore?owner=alice` 显示 `@alice ×` chip。T026 可复用（`q=keyword ×`）。

**文件**：`frontend-v3/src/components/FilterChip.vue`

**Props**：
- `label: string`（显示文字如 `@alice`）

> `dismissible` prop 暂不加——当前所有场景都需要 dismiss 能力，YAGNI（S-3）。当 T026 需要不可 dismiss 的 chip 时再加。

**Emits**：`dismiss` → 父组件清除 filter

**模板**：
```html
<template>
  <span class="filter-chip">
    <span class="filter-chip-label">{{ label }}</span>
    <button class="filter-chip-dismiss" @click="$emit('dismiss')" aria-label="Remove filter">&times;</button>
  </span>
</template>
```

**样式**：inline-flex，圆角 pill，背景 `var(--accent-light)`，hover 加深。与现有 button 风格统一、移动端响应式（flex-wrap 自然换行）。

**在 EntryListView 中使用**：
```html
<div v-if="showChip" class="filter-chip-bar">
  <FilterChip :label="`@${currentOwner}`" @dismiss="clearOwnerFilter" />
</div>
```

```ts
// M-3 fix: 统一为「数据→URL」顺序，与 setOwner 一致
function clearOwnerFilter() {
  currentOwner.value = null
  currentPage.value = 1
  loadEntries({ page: 1, perPage: perPage.value })  // 先加载数据
  router.replace({ path: '/explore' })               // 再更新 URL
}
```

对应 BDD-FE-7（chip 显示和 dismiss）。

---

### 2.8 前端：banner 组件（BannerBar.vue）

**用途**：`/users/:username` 显示大 banner（@username 的发布内容 + Back to Home）。

**文件**：`frontend-v3/src/components/BannerBar.vue`

**Props**：
- `username: string`

**模板**：
```html
<template>
  <div class="banner-bar">
    <router-link to="/explore" class="banner-back">
      <span class="banner-back-arrow">&larr;</span>
      <span>Back to Home</span>
    </router-link>
    <h1 class="banner-title">
      <span class="banner-at">@</span>{{ username }}<span class="banner-apos">'s</span> entries
    </h1>
  </div>
</template>
```

**样式及移动端断点（M-4）**：
```css
.banner-bar {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.banner-back {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-sm);
  color: var(--text-secondary);
  text-decoration: none;
  white-space: nowrap;
}
.banner-back:hover { color: var(--accent-color); }

.banner-title {
  margin: 0 auto;
  font-size: var(--font-xl);
  font-weight: 700;
  color: var(--text-primary);
  text-align: center;
}

@media (max-width: 480px) {
  .banner-bar {
    flex-direction: column;     /* 纵向堆叠 */
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    text-align: center;
  }
  .banner-back {
    align-self: flex-start;     /* Back to Home 左对齐 */
    padding: var(--space-1) 0;
    min-height: 44px;           /* iOS/移动端 hit target */
    align-items: center;
  }
  .banner-title {
    font-size: var(--font-lg);  /* 缩小字号 */
    margin: 0;
  }
}

@media (max-width: 360px) {
  .banner-bar { padding: var(--space-2) var(--space-3); }
  .banner-title { font-size: var(--font-md); }
}
```

**在 EntryListView 中使用（H-1 fix）**：
```html
<!-- 仅当 owner prop 存在、非 "me"、且 ownerFound 不为 false 时显示 banner -->
<BannerBar v-if="isBannerMode" :username="props.owner!" />
```

对应 BDD-FE-1（banner 显示）、FE-2（不存在的 username → 不显示 banner，显示 user-not-found 提示）。

---

### 2.9 前端：用户名点击行为

**判断逻辑**：

```ts
const currentUserUsername = computed(() => user.value?.username ?? null)

// 在卡片 meta-item 中：
// - 已登录 && entry.username === currentUserUsername → /explore?owner=me
// - 否则 → /users/:username
```

对应 BDD-FE-3（点击跳 /users/:username）、FE-4（点自己跳 /explore?owner=me）。

**注意**：anonymous 访问时 `currentUserUsername` 为 null，全部跳 `/users/:username`。

---

### 2.10 前端：tab URL 同步（router.replace）

**设计（M-3 fix：统一「数据→URL」顺序）**：

```ts
function setOwner(owner: string | null) {
  currentOwner.value = owner
  currentPage.value = 1
  loadEntries({ page: 1, perPage: perPage.value, owner: owner || undefined })  // 先加载数据

  // URL sync via replace (no history stack pollution)
  // 统一在数据加载后更新 URL（与 clearOwnerFilter 顺序一致）
  if (owner === 'me') {
    router.replace({ path: '/explore', query: { owner: 'me' } })
  } else if (owner) {
    router.replace({ path: '/explore', query: { owner } })
  } else {
    router.replace({ path: '/explore' })
  }
}
```

**为什么是 `replace` 不是 `push`**：P0 确认 tab 切换不污染历史栈。`replace` 保证 All→Mine→All 切换后退一次就回到之前的页面（如 detail 页），而不是多次后退遍历 tab 历史。

**注意**：`setOwner` 只在 explore 模式下调用（无 `props.owner` 时），banner 模式不调用 setOwner（tab 已隐藏）。对应 BDD-FE-5。

---

### 2.11 组合场景总览

| 场景 | URL | owner prop | currentOwner | Tabs | Banner | Chip | 数据请求 |
|------|-----|-----------|-------------|------|--------|------|---------|
| Explore 默认 | `/explore` | undefined | null | All(active)+Mine | 否 | 否 | `owner=undefined` |
| Explore Mine | `/explore?owner=me` | undefined | `"me"` | All+Mine(active) | 否 | 否 | `owner="me"` |
| Explore 看用户 | `/explore?owner=alice` | undefined | `"alice"` | All+Mine(均不 active) | 否 | `@alice ×` | `owner="alice"` |
| 用户专页 | `/users/alice` | `"alice"` | null | 隐藏 | `@alice` | 否 | `owner="alice"` |
| 用户专页 404 | `/users/nonexistent` | `"nonexistent"` | null | 隐藏 | **否**（H-1 fix: ownerFound=false） | 否 | `owner="nonexistent"` → `ownerFound=false` |
| Explore 看用户+FTS | `/explore?owner=alice&q=xxx` | undefined | `"alice"` | All+Mine(均不 active) | 否 | `@alice ×` | `owner="alice", q="xxx"`（BE-8/9） |

---

## 3. 声明字段

```yaml
packages:
  - peekview          # 后端+前端一次性改动，不涉及 MCP/CLI

domains:
  - backend           # entry_service + models schema
  - frontend          # router + EntryListView + 2 新组件 + API/store 层

ui_affected: true

# UI 交互点清单（供 P3/P5/P6 E2E 覆盖）：
#  1. /users/:username 页面加载 + banner 显示
#  2. /users/:username 登录态时仍能看到 banner（不是 explore）
#  3. /explore?owner=alice 显示 chip + 无 banner + tabs 存但不高亮
#  4. chip dismiss → URL 回到 /explore + 列表恢复全部
#  5. 卡片 @username 点击 → 跳转 /users/:username
#  6. 已登录用户点自己 @username → 跳 /explore?owner=me
#  7. tab All/Mine 切换 → URL 同步（replace 无历史栈污染）
#  8. /explore?owner=me 直接访问 → Mine tab 高亮（含 auth race 测试）
#  9. /users/nonexistent → "User @nonexistent not found"（不含 banner）
# 10. 卡片整体点击仍导航到 entry detail
# 11. 移动端 banner 正常显示（≤480px flex-direction column）
# 12. 卡片 div[role="link"] 键盘可访问（Tab + Enter）

gate_commands:
  backend_unit: "cd backend && .venv/bin/python -m pytest tests/ -q --tb=no"
  frontend_typecheck: "cd frontend-v3 && npx vue-tsc --noEmit"
  frontend_build: "cd frontend-v3 && npm run build 2>&1 | tail -20"
  frontend_unit: "cd frontend-v3 && ./node_modules/.bin/vitest run --reporter=dot 2>&1 | tail -20"

gate_commands_e2e:
  P5_e2e: "cd frontend-v3 && npx playwright test --reporter=line tests/e2e/ 2>&1 | tail -30"
  P6: "cd frontend-v3 && npx playwright test --reporter=line tests/e2e/ 2>&1 | tail -30"

env_constraints:
  debug_env:
    - 后端测试：cd backend && .venv/bin/python -m pytest tests/ -q --tb=no
    - 前端测试：cd frontend-v3 && ./node_modules/.bin/vitest run --reporter=dot
    - 前端构建：cd frontend-v3 && npm run build
    - 前端类型检查：cd frontend-v3 && npx vue-tsc --noEmit
    - Playwright E2E：make debug-test（需 debug backend 运行于 :8888）
    - 严禁 pip3 install --break-system-packages -e .
    - 严禁用 CLI 创建测试 entry
    - 严禁直接 sqlite3 操作生产数据库
  isolation_check:
    - 后端测试通过 conftest.py isolate_config_file (autouse) 自动隔离到 tmp_path
    - 前端单元测试不接触服务端
    - Playwright E2E 通过 make debug-test 的 data-isolation guard 确保只连 debug backend (:8888)

files_to_read:
  - path: backend/peekview/services/entry_service.py:160-180
    why: create_entry 方法 — P3 测试需知道如何创建测试数据
  - path: backend/peekview/services/entry_service.py:289-411
    why: list_entries 主方法 — 本次改动的核心；3 个现有 EntryListResponse 构造点（L327, L365-367, L411）均需加 owner_found
  - path: backend/peekview/services/entry_service.py:774-779
    why: _resolve_username 辅助方法 — 理解现有 username 解析模式
  - path: backend/peekview/models.py:389-436
    why: EntryListItem + EntryListResponse 定义 — 需加 owner_found 字段（含 Field description）
  - path: frontend-v3/src/views/EntryListView.vue:1-160 (template)
    why: 卡片结构、banner/tab 插入位置、v-if 链、router-link 嵌套问题位置
  - path: frontend-v3/src/views/EntryListView.vue:166-296 (script)
    why: setOwner / currentOwner / onMounted / watch / authState race 修复 — 需改的核心逻辑
  - path: frontend-v3/src/views/EntryListView.vue:321-643 (style)
    why: banner/chip 新样式需与现有样式风格一致
  - path: frontend-v3/src/router.ts:1-60
    why: 需加 /users/:username 路由，注意顺序在 /:slug 之前，附带注释
  - path: frontend-v3/src/api/types.ts:1-50
    why: EntryListApiResponse — 加 owner_found 字段
  - path: frontend-v3/src/types/index.ts:1-42
    why: Entry + EntryListResponse + ListEntriesParams — 加 ownerFound 字段
  - path: frontend-v3/src/api/client.ts:43-107
    why: transformListItem + listEntries — 透传 owner_found → ownerFound
  - path: frontend-v3/src/stores/entry.ts:48-66
    why: loadEntries — 接收并存储 ownerFound
  - path: docs/roadmap/improvement-backlog.md
    why: 记录 TD-T025-perf tech debt（func.lower 无函数索引）

minimal_validation:
  assumption: "本任务不涉及浏览器安全模型/沙箱/外部系统行为，纯 Vue 组件模式 + SQL 查询"
  method: "无需最小验证"
  result: "not_needed"
  note: "嵌套 router-link 重构是纯 DOM 层级切换（div 替代外层 router-link），无新安全边界；div[role='link'] 是一般的可访问性实践，Chrome/Firefox 已验证支持"
```

---

## 4. 实现完成的标志

1. **后端** 9 个 BDD（BE-1~9）全部通过 pytest
2. **前端** 9 个 BDD（FE-1~9）全部通过，其中：
   - FE-1~7、FE-9 通过 Playwright E2E 验证
   - FE-8 通过 `vue-tsc --noEmit` + `npm run build`
3. 现有 577 后端测试 + 86 前端测试零回归
4. 新增 FilterChip + BannerBar 两个 Vue 单文件组件
5. `/users/:username` 路由在 router.ts 中正确插入（`/:slug` 之前，附注释）
6. HTML 中无 `<a>` 嵌套 `<a>`（Playwright DOM 序列化验证）
7. 卡片 `div[role="link"]` 可通过 Tab 键聚焦、Enter/Space 键触发导航
8. `improvement-backlog.md` 已记录 `TD-T025-perf` tech debt

---

## 5. 不在本方案

- 不存在数据库迁移（不批量 `.lower()` 现有 username）
- 不存在 MCP/CLI 改动
- 不存在 `/users/me`、`/mine` 路由
- 不存在用户 Profile 页（头像、bio、统计）
- 不存在 P8 发布准备（P0/P1 裁剪决定）
- T026 search-url 的 `q=keyword ×` chip 不在本方案（但 FilterChip 组件设计时已考虑复用性）
- 不存在 `func.lower(User.username)` 函数索引创建（记 tech debt 至 improvement-backlog）
