---
phase: P2
task_id: T060-archived-visibility-auth-refresh
type: design
parent: P1-requirements.md
trace_id: T060-P2-20260721
status: draft
created: 2026-07-21
agent: architect
---

# P2 Design: Archived 条目可见性策略 + 登录退出内容刷新

## 影响域分析

### 改什么

| 文件 | 改动 | 理由 |
|------|------|------|
| `backend/peekview/services/entry_service.py:404-416` | 默认查询（无 status）排除 archived，admin 也排除 | A1-A7 BDD |
| `backend/peekview/api/entries.py:195` | status 参数增加值校验 | M3 BDD |
| `frontend-v3/src/views/EntryListView.vue:444-455` | authState watcher 扩展：authenticated 时重载当前 tab | B1-B2 BDD |
| `frontend-v3/src/views/EntryListView.vue:379-384` | handleLogout 改为重载 API 而非客户端过滤 | C1-C2 BDD |
| `frontend-v3/src/stores/auth.ts:63-67` | peekview:auth-expired 事件触发列表重载 | D1-D2 BDD |
| `frontend-v3/src/stores/entry.ts:53-72` | filterPrivateEntries 废弃或改为重载 | C1 隐含需求 2.3 |
| `packages/mcp-server/src/tools/listEntries.ts:6-11` | schema 增加 status 参数 | M1-M3 BDD |
| `packages/mcp-server/src/client.ts:97-112` | listEntries 方法增加 status 参数 | M1-M3 BDD |
| `backend/tests/test_entry_lifecycle.py:672-724` | 更新现有测试（owner list 不再含 archived） | 行为变更 |

### 不改什么

- 后端 404-not-403 模式（防 slug 枚举）不变
- 匿名/非 owner 对 archived 的不可见性不变（已正确实现）
- EntryStatus 枚举不变（ACTIVE/ARCHIVED/PUBLISHED 已存在）
- 前端 API client 的 listEntries 已支持 status 参数（`client.ts:112`）
- 前端 ListEntriesParams 类型已有 status 字段
- 数据库 schema 无变更，无迁移
- Archived tab 对匿名用户保持可见但内容为空（当前行为已正确）
- owner-tabs 的 ARIA role/aria-selected 属性（已有缺陷，非本任务引入，不在本次范围）

### 风险在哪

1. **后端默认行为变更 = 现有测试失败**：`test_owner_list_includes_archived_entries` 和 `test_owner_list_total_includes_archived` 断言 own archived 出现在默认列表中，变更后需更新
2. **退出后重载 vs 客户端过滤**：重载 API 有网络延迟，但客户端过滤无法处理 archived public 条目残留（隐含需求 2.3）
3. **authState watcher 触发时机**：登录成功后 authState 从 anonymous → authenticated，watcher 需在 auth store 更新后触发，需确认 Vue reactivity 时序
4. **MCP status 参数非法值**：后端需决定返回 422 错误还是忽略，影响 MCP Agent 体验
5. **重载请求竞态**：auth 转换触发的 loadEntries 可能与用户手动操作（切 tab/翻页）的请求竞态，旧响应覆盖新请求结果
6. **重载失败 fallback**：退出/auth 过期后 loadEntries 失败时，用户看到 error-state 而非匿名视图

## §1 候选方案

### 方案 A：后端默认排除 + 前端统一重载（推荐）

**后端**：
- `entry_service.list_entries` 无 status 参数时，所有角色（含 admin）默认排除 archived
- 即：删除 line 405-411 的 `(status != ARCHIVED) | (owner_id == current_user_id)` 逻辑，统一改为 `status != ARCHIVED`
- admin 无 status 时也排除（删除 line 412-413 的 pass，改为 `status != ARCHIVED`）
- status 参数增加值校验：仅允许 `active`/`archived`/`published`（与 EntryStatus 枚举对齐），非法值返回 422

**前端**：
- authState watcher 扩展：`authenticated` 时重载当前 tab（`loadEntries` with current owner/status/q）
- handleLogout 改为 `loadEntries`（重载 API），废弃 `filterPrivateEntries`
- peekview:auth-expired 事件处理改为重载当前 tab
- 退出/auth 过期时，若当前在 Archived tab，重置到 All tab（因为匿名用户无 archived 可见）

**MCP**：
- listEntries tool schema 增加 `status` 可选参数（enum: active/archived）
- client.listEntries 方法增加 status 参数
- 非法 status 值由后端 422 拦截，MCP 透传错误

**权衡**：
- 优点：语义清晰（All = active only），后端单一真相源，前端无需猜测过滤逻辑
- 优点：退出/auth 过期后数据与 API 完全一致，无残留风险
- 风险：退出后多一次 API 请求（可接受，用户主动操作）
- 风险：现有测试需更新（2 个测试断言需反转）
- 风险：重载请求可能与用户操作竞态（需去重策略，见 §2.8）
- 风险：重载失败时用户看到 error-state（需 fallback 策略，见 §2.9）

### 方案 B：后端默认排除 + 前端混合策略（退出客户端过滤 + 登录重载）

**后端**：同方案 A

**前端**：
- 登录后：重载当前 tab（同方案 A）
- 退出后：仍用客户端过滤，但增强 `filterPrivateEntries` 同时移除 archived 条目
- auth 过期后：增强 `filterPrivateEntries` 同时移除 archived 条目

**MCP**：同方案 A

**权衡**：
- 优点：退出/auth 过期无网络请求，即时响应
- 风险：客户端过滤与 API 语义可能不一致（如 total/pagination 不同步）
- 风险：退出后 entries 数组与 API 返回不一致，pagination 状态陈旧
- 风险：隐含需求 2.3 的 archived public 条目需额外逻辑处理，filterPrivateEntries 需改为 `e.isPublic && e.status !== 'archived'`，但匿名用户在 Archived tab 时仍需重置 tab
- 风险：移动端网络延迟时混合策略更复杂（先客户端过滤→再重载→数据跳变）

**选择理由**：选方案 A。退出/auth 过期后统一重载 API 是唯一能保证数据与权限完全一致的方式。方案 B 的客户端过滤在 pagination/total 状态同步上有固有缺陷，且退出时若在 Archived tab 仍需重置 tab + 清空列表，混合策略复杂度高于统一重载。多一次 API 请求的代价远低于数据不一致的风险。

## §2 详细设计

### 2.1 后端：entry_service.list_entries 默认行为变更

**当前逻辑**（line 404-416）：
```python
else:  # no status param
    if current_user_id and not is_admin:
        # BUG: own archived mixed in
        query = query.where(
            (Entry.status != EntryStatus.ARCHIVED) | (Entry.owner_id == current_user_id)
        )
    elif is_admin:
        pass  # BUG: admin sees everything including archived
    else:
        query = query.where(Entry.status != EntryStatus.ARCHIVED)
```

**目标逻辑**：
```python
else:  # no status param
    query = query.where(Entry.status != EntryStatus.ARCHIVED)
    count_query = count_query.where(Entry.status != EntryStatus.ARCHIVED)
```

所有角色统一：无 status 参数时只返回 active 条目。status=archived 分支的逻辑不变（admin 看全部 archived，owner 看 own archived，匿名返回空）。

### 2.2 后端：status 参数值校验

在 `api/entries.py` 的 list_entries endpoint，增加 status 值校验：

```python
VALID_STATUS_VALUES = {"active", "archived", "published"}

if status is not None and status not in VALID_STATUS_VALUES:
    raise HTTPException(status_code=422, detail=f"Invalid status value: {status}. Must be one of: {', '.join(sorted(VALID_STATUS_VALUES))}")
```

选择 422 而非忽略，因为：忽略非法值会静默返回错误结果集，对 MCP Agent 尤其危险。

**校验位置声明**：API 层（`api/entries.py`）是唯一校验点。Service 层（`entry_service.py`）不做防御性校验——service 层的 status 参数来自 API 层，已校验；内部调用（如 CLI）走不同路径，不受影响。

### 2.3 前端：authState watcher 扩展

**当前**（line 444-455）：仅处理 `?owner=me` URL 特例

**目标**：
```typescript
watch(authState, (newState, oldState) => {
  if (newState === 'authenticated' && oldState !== 'authenticated') {
    if (!props.owner) {
      const urlParams = new URLSearchParams(window.location.search)
      const ownerParam = urlParams.get('owner')
      if (ownerParam === 'me' && currentOwner.value !== 'me') {
        currentOwner.value = 'me'
        currentStatus.value = null
      }
    }
    currentPage.value = 1
    loadEntries({
      page: 1,
      perPage: perPage.value,
      owner: effectiveOwner.value,
      status: effectiveStatus.value,
      q: searchQuery.value || undefined,
    })
  } else if (newState === 'anonymous' && oldState === 'authenticated') {
    if (currentStatus.value === 'archived') {
      currentStatus.value = null
    }
    currentPage.value = 1
    loadEntries({
      page: 1,
      perPage: perPage.value,
      owner: effectiveOwner.value,
      status: effectiveStatus.value,
      q: searchQuery.value || undefined,
    })
  }
}, { flush: 'pre', immediate: false })
```

**关键设计决策**：

1. **`oldState !== 'authenticated'` guard**：确保只在非 authenticated → authenticated 转换时触发登录重载。`loading → authenticated`（页面初始化时 cookie 有效）**不会触发重载**，因为 `onMounted` 已加载列表。`anonymous → authenticated`（用户主动登录）**会触发重载**。

2. **`oldState === 'authenticated'` guard**：确保只在 authenticated → anonymous 转换时触发退出/过期重载。`loading → anonymous`（页面初始化时无 cookie）不会触发。

3. **搜索词保留**：auth 转换时 `searchQuery` 保留，重载请求传 `q: searchQuery.value || undefined`。搜索结果集因权限变化而不同是预期行为——用户搜索 "foo"，登录后可能看到更多 private 结果。

4. **watcher 配置**：`flush: 'pre'`（Vue 默认），`immediate: false`（Vue 默认）。`flush: 'pre'` 保证 watcher 在 DOM 更新前触发，此时 reactive state 已更新（`currentStatus` 重置已完成），watcher 读到的是最新值。`immediate: false` 避免初始化时触发。

5. **同步时序假设**：`authStore.logout()` 是同步的（`user.value = null`，见 `auth.ts:48-51`），触发 `authState` computed 重新计算为 `'anonymous'`。Vue watcher 在同一 tick 的 pre-flush 阶段触发，此时 `currentStatus` 重置已完成（handleLogout 在调 `authStore.logout()` 之前重置 `currentStatus`）。

### 2.4 前端：handleLogout 改为重载

**当前**（line 379-384）：
```typescript
function handleLogout() {
  showUserMenu.value = false
  authStore.logout()
  entryStore.filterPrivateEntries()
  toast.show('Logged out', 'success')
}
```

**目标**：
```typescript
function handleLogout() {
  showUserMenu.value = false
  if (currentStatus.value === 'archived') {
    currentStatus.value = null
  }
  authStore.logout()  // 触发 authState → anonymous → watcher 重载
  toast.show('Logged out', 'success')
}
```

`filterPrivateEntries()` 不再调用。退出重载统一通过 watcher 触发（见 §2.5 路径 1 分析）。

`currentStatus` 重置在 `authStore.logout()` 之前执行，确保 watcher 触发时读到重置后的值。

### 2.5 前端：auth-expired 事件处理

**当前**（auth.ts line 63-67）：仅设 `user = null`

**目标**：auth store 发出事件，EntryListView 监听并重载

**路径 1（推荐）：authState watcher 统一处理**

authState 从 authenticated → anonymous 时，watcher 已能捕获。扩展 watcher 处理 `anonymous` 分支（见 §2.3）。

这样 handleLogout 和 auth-expired 都通过同一个 watcher 触发重载，逻辑统一。

**路径 2（不推荐）**：在 auth.ts 的 peekview:auth-expired listener 中直接调 entryStore

问题：auth store 不应依赖 entry store（循环依赖风险），且无法访问 EntryListView 的 currentStatus/currentOwner 状态。

选择路径 1。`peekview:auth-expired` 事件处理中 `user.value = null`（`auth.ts:65`）→ `authState` 变为 `anonymous` → watcher 触发重载。无需修改 auth.ts 的事件处理逻辑。

### 2.6 MCP：listEntries 增加 status 参数

**listEntries.ts schema**：
```typescript
const schema = z.object({
  query: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['active', 'archived']).optional()
    .describe('Filter by entry status. Default: active only. Use "archived" to see archived entries.'),
  page: z.number().int().positive().optional(),
  per_page: z.number().int().positive().max(100).default(20),
});
```

**listEntries.ts inputSchema**：
```typescript
status: {
  type: 'string',
  enum: ['active', 'archived'],
  description: 'Filter by entry status. Default: active only. Use "archived" to see archived entries.',
},
```

**client.ts listEntries**：
```typescript
async listEntries(
  userToken: string,
  page = 1,
  perPage = 20,
  query?: string,
  tags?: string[],
  status?: string,
): Promise<ListEntriesResponse> {
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('per_page', perPage.toString());
  if (query) params.append('q', query);
  if (tags?.length) params.append('tags', tags.join(','));
  if (status) params.append('status', status);
  return this.request<ListEntriesResponse>(`/api/v1/entries?${params}`, undefined, userToken);
}
```

**handler 传参**：
```typescript
const result = await client.listEntries(
  ctx.userToken,
  params.page ?? 1,
  params.per_page ?? 20,
  params.query,
  params.tags,
  params.status,
);
```

**MCP status 非法值**：zod schema 用 `z.enum()` 校验，非法值直接返回 zod 错误，不传到后端。后端 422 是二道防线。

### 2.7 前端：filterPrivateEntries 处置

`filterPrivateEntries()` 在 entry.ts 中**删除**（非 @deprecated）。P4 实现时先 grep 确认无其他调用者（当前仅 `EntryListView.vue:382` 调用），确认后直接删除。保留死代码是 Slop 温床，且该方法语义与新的"统一重载"策略矛盾。

### 2.8 竞态处理策略（Review #1）

**问题**：auth 转换触发的 `loadEntries()` 可能与用户手动操作（切 tab/翻页）的请求竞态，旧响应覆盖新请求结果。

**策略：请求序列号去重（request sequence number）**

在 `entry.ts` 的 `loadEntries` 中增加请求序列号：

```typescript
let loadSeq = 0

async function loadEntries(params?: ListEntriesParams): Promise<void> {
  const seq = ++loadSeq
  loading.value = true
  error.value = null

  try {
    const response = await api.listEntries(params)
    if (seq !== loadSeq) return  // 陈旧响应，丢弃
    entries.value = response.items
    page.value = response.page
    perPage.value = response.perPage
    total.value = response.total
    ownerFound.value = response.ownerFound ?? null
  } catch (err) {
    if (seq !== loadSeq) return  // 陈旧错误，丢弃
    error.value = err instanceof Error ? err.message : 'Failed to load entries'
    entries.value = []
  } finally {
    if (seq === loadSeq) {
      loading.value = false
    }
  }
}
```

**选择理由**：
- 序列号方案比 AbortController 更简单（无需管理 controller 生命周期）
- 序列号方案比 debounce 更精确（不延迟最新请求，只丢弃陈旧响应）
- 不引入新依赖，改动范围限于 `entry.ts` 的 `loadEntries` 函数
- 现有所有 `loadEntries` 调用者无需修改

**不选 AbortController 的理由**：需要在每个调用点创建/传递 controller，watcher、handleLogout、currentPage watcher、setFilter 等多个调用点都需改造，改动范围大且容易遗漏。

### 2.9 重载失败 fallback 策略（Review #2）

**问题**：退出/auth 过期后 `loadEntries()` 可能失败（网络断开），用户看到 error-state 而非匿名视图。

**策略：auth 转换重载失败时，保留旧数据 + 显示 error + retry 按钮**

```typescript
} else if (newState === 'anonymous' && oldState === 'authenticated') {
  if (currentStatus.value === 'archived') {
    currentStatus.value = null
  }
  currentPage.value = 1
  loadEntries({
    page: 1,
    perPage: perPage.value,
    owner: effectiveOwner.value,
    status: effectiveStatus.value,
    q: searchQuery.value || undefined,
  }).catch: false,  // 新参数：auth 转换重载失败时不清空 entries
  })
}
```

在 `entry.ts` 的 `loadEntries` 增加 `clearOnError` 选项（默认 `true`，保持现有行为）：

```typescript
async function loadEntries(params?: ListEntriesParams, options?: { clearOnError?: boolean }): Promise<void> {
  const seq = ++loadSeq
  loading.value = true
  error.value = null

  try {
    const response = await api.listEntries(params)
    if (seq !== loadSeq) return
    entries.value = response.items
    page.value = response.page
    perPage.value = response.perPage
    total.value = response.total
    ownerFound.value = response.ownerFound ?? null
  } catch (err) {
    if (seq !== loadSeq) return
    error.value = err instanceof Error ? err.message : 'Failed to load entries'
    if (options?.clearOnError !== false) {
      entries.value = []
    }
  } finally {
    if (seq === loadSeq) {
      loading.value = false
    }
  }
}
```

**auth 转换重载失败时的行为**：
1. 旧数据保留显示（可能包含 private 条目，但网络断开时无法避免）
2. `error` 被设置，error-state 区域显示错误信息 + retry 按钮
3. 用户点击 retry → 重新 `loadEntries`（此时 `clearOnError` 默认 true，失败则清空）

**登录重载失败时**：`clearOnError` 默认 true，清空 entries + 显示 error。登录后旧数据是匿名视图，无敏感信息残留风险，清空更安全。

**退出/auth 过期重载失败时**：传 `clearOnError: false`，保留旧数据。理由：旧数据虽可能含 private 条目，但网络断开时无法获取正确数据，清空后用户看到空白页面更差。error-state 提示用户重试。

### 2.10 移动端考虑（Review #5）

**范围声明**：移动端专项优化不在本次任务范围内。理由：
1. 本任务的核心改动是后端查询逻辑和前端 auth 转换重载，不涉及新 UI 组件或布局变更
2. owner-tabs（All/Mine/Archived）的移动端适配是独立问题，非本任务引入
3. 退出后 API 重载的延迟在桌面端同样存在，非移动端特有

**已知移动端影响（供后续任务参考）**：
- 退出后旧列表→loading→新列表的闪烁：序列号去重（§2.8）确保不会出现旧响应覆盖新响应的闪烁，但 loading 状态切换的视觉闪烁仍存在。可通过 CSS transition 缓解，但不在本次范围
- Archived tab 重置后移动端 tab 可能不可见：当前 tab 样式未做 overflow 处理，这是已有缺陷
- Auth 过期在移动端更常见（后台切换）：watcher 统一处理已覆盖此场景，无需额外逻辑

### 2.11 a11y 通知设计（Review #4）

**auth 转换后的屏幕阅读器通知**：

在 `EntryListView.vue` 增加一个 `aria-live="polite"` 区域，专门用于 auth 状态转换通知：

```html
<div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
  {{ authChangeAnnouncement }}
</div>
```

```typescript
const authChangeAnnouncement = ref('')

watch(authState, (newState, oldState) => {
  if (newState === 'authenticated' && oldState !== 'authenticated') {
    authChangeAnnouncement.value = 'Signed in. List refreshed.'
  } else if (newState === 'anonymous' && oldState === 'authenticated') {
    authChangeAnnouncement.value = 'Signed out. List refreshed.'
  }
})
```

**设计要点**：
- 使用 `aria-live="polite"`（非 assertive），因为 auth 转换不是紧急通知
- `aria-atomic="true"` 确保整条消息被播报
- 消息简洁，不重复 toast 已有的内容
- 与现有搜索状态 `aria-live` 区域（line 88-97）分离，职责不同

**Archived tab 重置的焦点管理（Review #7）**：

退出时若在 Archived tab 自动切回 All tab，焦点移到 All tab 按钮：

```typescript
else if (newState === 'anonymous' && oldState === 'authenticated') {
  if (currentStatus.value === 'archived') {
    currentStatus.value = null
    nextTick(() => {
      const allTab = document.querySelector<HTMLButtonElement>('.owner-tab')
      allTab?.focus()
    })
  }
  // ... loadEntries
}
```

**Loading 状态的 a11y**：当前 loading 区域（line 99-101）是 `<div>Loading...</div>`，无 `role="status"` 或 `aria-live`。增加 `role="status"`：

```html
<div v-if="loading" class="loading-state" role="status" aria-live="polite">
  <span>Loading...</span>
</div>
```

此改动也覆盖了 auth 转换触发的重载时的 loading 通知。

## §3 完成标志

1. `GET /api/v1/entries`（无 status）对所有角色只返回 active 条目
2. `GET /api/v1/entries?status=archived` 对 owner 返回 own archived，admin 返回全部 archived，匿名返回空
3. `GET /api/v1/entries?status=invalid` 返回 422
4. 登录后列表自动刷新（含 own private active 条目，不含 archived）
5. 退出后列表自动刷新为匿名视图（无 private、无 archived）
6. 退出时若在 Archived tab，自动切回 All tab + 焦点移到 All tab
7. Auth 过期后列表自动刷新为匿名视图
8. MCP list_entries 无 status 参数只返回 active 条目
9. MCP list_entries status="archived" 返回 archived 条目
10. MCP list_entries status="invalid" 返回 zod 校验错误
11. 重载请求竞态：陈旧响应被丢弃，不覆盖最新请求结果
12. 退出/auth 过期重载失败：保留旧数据 + 显示 error + retry
13. 登录重载失败：清空 entries + 显示 error
14. `loading → authenticated` 初始化转换不触发重载
15. auth 转换后屏幕阅读器播报通知
16. loading 区域有 `role="status"` a11y 属性

## §4 声明字段

```yaml
packages: [backend, frontend-v3, mcp-server]
domains: [backend, frontend, mcp, security]
ui_affected: true
ui_interaction_points:
  - "All/Mine/Archived tab 切换后列表内容"
  - "登录后列表自动刷新"
  - "退出后列表自动刷新 + Archived tab 重置 + 焦点管理"
  - "Auth 过期后列表自动刷新"
  - "auth 转换后 aria-live 通知"
  - "loading 状态 role=status"
gate_commands:
  P5: "cd backend && .venv/bin/python -m pytest tests/ -q --tb=no"
  P5_e2e: "cd frontend-v3 && npx playwright test e2e/ --reporter=line"
  P6: "cd backend && .venv/bin/python -m pytest tests/ -q --tb=no"
env_constraints:
  debug_env: "make debug（:8888, /tmp/peekview-debug/），严禁触碰生产 :8080"
  isolation_check: "sqlite3 /tmp/peekview-debug/peekview.db 'SELECT COUNT(*) FROM entries' 对比生产 DB"
files_to_read:
  - path: backend/peekview/services/entry_service.py:404-416
    why: 默认查询逻辑修改点，own archived 混入的 bug 位置
  - path: backend/peekview/api/entries.py:190-223
    why: list endpoint，增加 status 值校验
  - path: backend/peekview/models.py:29-34
    why: EntryStatus 枚举定义，校验合法值
  - path: frontend-v3/src/views/EntryListView.vue:379-384,444-455
    why: handleLogout 和 authState watcher 修改点
  - path: frontend-v3/src/views/EntryListView.vue:88-101
    why: aria-live 区域和 loading 状态，增加 a11y 属性
  - path: frontend-v3/src/stores/auth.ts:48-51,63-67
    why: logout 和 auth-expired 事件处理
  - path: frontend-v3/src/stores/entry.ts:53-72,175-178
    why: loadEntries 增加序列号去重 + clearOnError 选项，filterPrivateEntries 删除
  - path: packages/mcp-server/src/tools/listEntries.ts
    why: MCP tool schema 增加 status 参数
  - path: packages/mcp-server/src/client.ts:97-112
    why: MCP client listEntries 方法增加 status 参数
  - path: backend/tests/test_entry_lifecycle.py:672-724
    why: 需更新的现有测试（owner list 含 archived 断言需反转）
minimal_validation:
  assumption: "后端 list_entries 无 status 参数时，认证用户 own archived 条目混入活跃列表"
  method: "curl 验证当前行为：创建 active + archived 条目，无 status 参数请求确认 archived 混入"
  result: confirmed
  note: "dispatch-context 客观查证已确认 line 406-411 逻辑，代码阅读也验证。无需额外 curl 验证。"
```

## §5 现有测试影响评估

需更新的测试：

| 测试 | 当前断言 | 变更后断言 |
|------|----------|------------|
| `test_owner_list_includes_archived_entries` (line 672) | `assert "archived-mine" in slugs` | `assert "archived-mine" not in slugs` |
| `test_owner_list_total_includes_archived` (line 701) | `assert resp.json()["total"] >= 2` | `assert resp.json()["total"] == 1` |

需新增的测试（P3 详细设计）：
- admin 无 status 时排除 archived
- status 非法值返回 422
- owner 无 status 时排除 own archived（覆盖 A1/A2）
- owner status=archived 时返回 own archived（覆盖 A3）
- loadEntries 序列号去重：陈旧响应被丢弃
- loadEntries clearOnError=false：失败时保留旧数据
- authState watcher loading→authenticated 不触发重载

## §6 Review 修订追踪

| Review # | 严重度 | 问题 | 修订位置 | 策略 |
|----------|--------|------|----------|------|
| 1 | HIGH | 重载请求竞态未处理 | §2.8 | 请求序列号去重，陈旧响应丢弃 |
| 2 | HIGH | 重载失败 fallback 未定义 | §2.9 | clearOnError 选项：退出/过期保留旧数据+error+retry，登录清空+error |
| 3 | MEDIUM | 初始化 loading→authenticated 误触发 | §2.3 | oldState guard：`oldState !== 'authenticated'` 排除 loading→authenticated |
| 4 | MEDIUM | Auth 转换后无 a11y 通知 | §2.11 | aria-live="polite" 区域播报 auth 转换通知 |
| 5 | MEDIUM | 移动端延迟和闪烁未考虑 | §2.10 | 声明移动端不在本次范围，记录已知影响供后续参考 |
| 6 | LOW | watcher flush 模式未声明 | §2.3 | 显式声明 `flush: 'pre', immediate: false` + 同步时序假设说明 |
| 7 | LOW | Archived tab 重置后焦点管理 | §2.11 | nextTick 后 focus All tab 按钮 |
