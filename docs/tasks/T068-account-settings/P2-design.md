---
phase: P2
task_id: T068-account-settings
type: design
parent: P1-requirements.md
trace_id: T068-P2-20260723
status: draft
created: 2026-07-23
agent: architect
---

## 影响域分析

### 改什么

| 层 | 文件 | 改动 |
|----|------|------|
| backend | `api/auth.py` | 新增 `PATCH /me` 端点 (~15 行) |
| backend | `models.py` | 新增 `UpdateProfileRequest` schema (~5 行) |
| frontend | `views/SettingsView.vue` | **新增** — 单页 tab 组件 (~400 行) |
| frontend | `views/ApiKeyListView.vue` | 保留文件，改为从 SettingsView 引用的子组件（去掉独立 header） |
| frontend | `router.ts` | 新增 `/settings` 路由 + `/settings/apikeys` 重定向 + auth guard |
| frontend | `stores/auth.ts` | 新增 `updateProfile()` action |
| frontend | `api/client.ts` | 新增 `updateProfile()` 方法 |
| frontend | `views/EntryListView.vue` | L377: `navigateToApiKeys()` 路径更新为 `/settings?tab=apikeys` |

### 不改什么

- `models.py` User table schema — `display_name` 字段已存在，无需 DB 迁移
- `auth.py` JWT 逻辑 — 改密码不 invalidate token，无需改动
- `api/client.ts` 现有 API 方法 — 只新增，不改现有
- MCP server — 不涉及 user profile
- CLI — 不涉及
- 主题/样式变量系统 — 复用现有 CSS 变量

### 风险在哪

1. **ApiKeyListView 迁移**：现有组件有独立 header + 完整生命周期，迁移时须保持所有功能（创建/撤销/清理过期/空状态/错误状态/一次性 key 展示）。风险：遗漏边界状态
2. **auth guard**：router.ts beforeEach 逻辑需正确处理匿名→settings 的重定向，且不影响其他路由
3. **旧路由兼容**：`/settings/apikeys` 须 302 到 `/settings?tab=apikeys`，两步重定向（先路由层、再 auth guard）须正确串联
4. **PATCH /auth/me 安全**：需 require_auth + 输入校验 + 返回完整 UserResponse 让前端刷新 authStore

## §1 候选方案

follows_existing_pattern: [backend/peekview/api/auth.py:228 (change-password), frontend-v3/src/views/ApiKeyListView.vue (API key 管理完整实现)]

### 方案 A：单组件 + 条件渲染 tab (推荐)

**结构**：一个 `SettingsView.vue`，内部用 `activeTab` ref 切换三个条件渲染区块（Profile / Security / API Keys）。API Keys 区块直接内联 ApiKeyListView 的逻辑（提取为无 header 的子组件 `ApiKeySettingsTab.vue`）。

**后端**：
- 新增 `UpdateProfileRequest(display_name: str | None = None, max_length=64)` schema
- 新增 `PATCH /api/v1/auth/me`：`require_auth` → trim `display_name` → 空字符串/null 清空 → `session.get(User, id)` → `user.display_name = value` → commit → return `UserResponse`
- 空请求体 `{}` 返回 200 + 当前 UserResponse（无变更）

**前端**：
- `SettingsView.vue`：统一 header（logo + "Settings" 标题 + theme toggle）+ tab 导航栏 + 条件渲染内容区
- Profile tab：只读字段 + display_name input + Save 按钮
- Security tab：旧密码 + 新密码 + 确认密码 + Change Password 按钮
- API Keys tab：提取 `ApiKeySettingsTab.vue`（ApiKeyListView 去 header 后的核心逻辑），保持所有现有功能
- Tab 与 URL query param `?tab=` 双向同步
- 移动端（<640px）：tab 导航变为垂直分区，三个区域堆叠显示
- auth guard：`router.beforeEach` 中对 `/settings` 路径检查 `authState !== 'authenticated'` → redirect `/`
- 旧路由：`/settings/apikeys` 路由 → redirect `{ path: '/settings', query: { tab: 'apikeys' } }`

**优点**：
- 单页面、单组件，状态管理简单（一个 `activeTab` ref）
- URL query param 同步 tab 状态，支持书签和直接链接
- API Keys 迁移为独立子组件，功能完整保留
- 移动端垂直分区实现简单（CSS media query 显示/隐藏 tab bar + 堆叠内容）
- 符合 GitHub/Vercel 设置页主流模式

**风险**：
- SettingsView 会较大（~400 行），但 tab 内容拆为子组件后可控制在合理范围
- ApiKeySettingsTab 提取需要仔细处理生命周期（onMounted 的 authState watch）

**工作量**：中等 — 后端 ~20 行新增 + 前端 ~400 行新组件 + ~50 行子组件提取 + 路由/守卫修改

### 方案 B：嵌套路由 + 异步组件

**结构**：`/settings` 作为父路由，`/settings/profile`、`/settings/security`、`/settings/apikeys` 作为子路由，每个 tab 是独立异步组件。

**优点**：
- 每个 tab 完全独立，代码分割更彻底
- 路由天然管理 tab 状态

**风险**：
- 违反 P0-brief 明确选定的"单页 tab"模式（GitHub/Vercel 共性）
- 嵌套路由增加 router.ts 复杂度（4 条路由 vs 1 条）
- 旧路由 `/settings/apikeys` → 新路由 `/settings/apikeys` 重定向与子路由冲突
- tab 切换时组件重新挂载/销毁，API Keys 状态丢失（或需 keep-alive）
- 移动端垂直分区与嵌套路由矛盾（需要同时渲染多个 tab）

**工作量**：较高 — 需重构路由结构 + 更多组件文件 + keep-alive 处理

### 选择理由

选择方案 A：
1. P0-brief 已明确选定单页 tab 模式（GitHub Settings / Vercel Account 参照）
2. 嵌套路由对 3 个 tab 过度设计，增加复杂度且与移动端垂直分区矛盾
3. ApiKeyListView 已有完整实现可参照（follows_existing_pattern），提取为子组件风险可控
4. 单组件 + 条件渲染在 PeekView 规模下完全合适

## §2 详细设计

### 后端：PATCH /auth/me

```
@router.patch("/me")
async def update_profile(
    data: UpdateProfileRequest,
    request: Request,
    current_user: User = Depends(require_auth),
) -> UserResponse:
    engine = request.app.state.engine
    with Session(engine) as session:
        user = session.get(User, current_user.id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        if data.display_name is not None:
            trimmed = data.display_name.strip()
            user.display_name = trimmed if trimmed else None
        session.add(user)
        session.commit()
        session.refresh(user)
    return UserResponse(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        is_active=user.is_active,
        is_admin=user.is_admin,
        created_at=user.created_at,
    )
```

关键设计点：
- `UpdateProfileRequest` 用 `display_name: str | None = None`，`None` 表示不修改（PATCH 语义）
- 清空 display_name：发送 `display_name: ""` 或 `display_name: "   "` → 后端 trim 后为空 → 设为 `None`
- 空请求体 `{}` → display_name 为 None → 不修改 → 返回当前 UserResponse
- max_length=64 在 schema 层校验，与 User 模型一致
- require_auth 确保未认证请求返回 401

### 前端：SettingsView.vue 结构

```
SettingsView.vue
├── header (logo + "Settings" + theme toggle)
├── tab-nav (desktop: 横向 tab bar; mobile: hidden)
│   ├── Profile
│   ├── Security
│   └── API Keys
├── tab-content (desktop: 条件渲染; mobile: 三个区域堆叠)
│   ├── ProfileTab: username(readonly) + display_name(input) + role(badge) + member-since + Save
│   ├── SecurityTab: old_password + new_password + confirm_password + Change Password
│   └── ApiKeySettingsTab: (extracted from ApiKeyListView, no header)
└── mobile-stacked (mobile only: 三个区域垂直堆叠)
```

### Tab 与 URL 同步

```typescript
const route = useRoute()
const router = useRouter()
const validTabs = ['profile', 'security', 'apikeys'] as const
type TabName = typeof validTabs[number]

const activeTab = computed<TabName>({
  get: () => {
    const tab = route.query.tab as string
    return validTabs.includes(tab as TabName) ? (tab as TabName) : 'profile'
  },
  set: (tab: TabName) => {
    router.replace({ query: { tab } })
  }
})
```

### 移动端适配 (<640px)

- 隐藏 tab 导航栏
- 三个区域垂直堆叠，每个区域有标题分隔
- 与 EntryDetailView 的 `isMobile` 模式一致（`viewportWidth <= 640`）

### auth guard

在 router.ts `beforeEach` 中新增：

```typescript
if (to.path === '/settings') {
  const authStore = useAuthStore()
  if (authStore.authState !== 'authenticated') {
    return '/'
  }
}
```

注意：须在 `authStore.initializing` 为 false 后判断（与现有 `/ → /explore` 守卫一致，依赖 authState 初始为 'loading'，fetchMe 完成后才变为 'authenticated' 或 'anonymous'）。

### 旧路由重定向

```typescript
{
  path: '/settings/apikeys',
  redirect: { path: '/settings', query: { tab: 'apikeys' } },
}
```

此重定向在 auth guard 之前执行（Vue Router redirect 先于 beforeEach），所以未登录用户访问 `/settings/apikeys` 会先被重定向到 `/settings?tab=apikeys`，再被 auth guard 拦截到 `/`。

### authStore 扩展

```typescript
async function updateProfile(displayName: string | null): Promise<void> {
  const updated = await api.updateProfile(displayName)
  user.value = updated
}
```

PATCH /auth/me 返回 UserResponse → 前端更新 `authStore.user` → header 显示名自动刷新。

### api/client.ts 扩展

```typescript
async updateProfile(displayName: string | null): Promise<User> {
  const response = await this.client.patch<UserApiResponse>('/auth/me', {
    display_name: displayName,
  })
  return this.transformUser(response.data)
}
```

### Profile tab 提交逻辑

- display_name input 初始值 = `authStore.user?.displayName || ''`
- 空字符串提交 → 发送 `display_name: ""` → 后端 trim 后清空为 null
- 提交期间 Save 按钮 disabled（重复提交防护）
- 成功后 toast + authStore.user 自动更新（header 联动刷新）

### Security tab 提交逻辑

- 调用已有 `POST /auth/change-password`
- 前端校验：新密码 >= 8 字符 + 确认密码匹配
- 提交期间 Change Password 按钮 disabled
- 成功后 toast + 清空三个字段（BDD-05: "所有密码字段清空"）
- 旧密码错误 → 显示 "Old password is incorrect"（BDD-06）
- 改密码后不 invalidate JWT → 不需要重新登录（BDD-07）

### ApiKeySettingsTab 提取

从 `ApiKeyListView.vue` 提取：
- 保留：`<div class="page-content">` 内所有内容（key list / create dialog / revoke dialog / cleanup button / empty/error/loading states）
- 保留：所有 script 逻辑（loadKeys / handleCreate / handleRevoke / handleCleanup / formatRelativeTime / isExpired）
- 去掉：`<header>` 区域（logo + theme toggle）— SettingsView 统一提供
- 去掉：`.apikey-page` wrapper 和 `.apikey-header` 样式
- Props: 无（内部自管理，与 ApiKeyListView 一致）
- 事件: 无（toast 由内部 useToast 处理）

## §3 完成标准

1. `PATCH /api/v1/auth/me` 端点工作：未认证返回 401，超长输入返回 422，合法输入更新 display_name，空请求体返回当前 UserResponse
2. `/settings` 页面三个 tab 均可交互：Profile 展示+编辑、Security 改密码、API Keys 全功能
3. Tab 切换与 URL `?tab=` 双向同步
4. `/settings/apikeys` → 302 重定向到 `/settings?tab=apikeys`
5. 未登录访问 `/settings` → 重定向到 landing
6. 移动端 (<640px) 垂直分区显示
7. display_name 编辑后 header 显示名实时刷新
8. API Keys 功能完整保留（创建/撤销/清理过期/空状态/错误状态/一次性 key 展示）

## §4 声明字段

```yaml
packages:
  - peekview (backend)

domains:
  - backend
  - frontend
  - security

ui_affected: true
ui_interaction_points:
  - /settings Profile tab: display_name 编辑 + 保存
  - /settings Security tab: 改密码表单提交
  - /settings API Keys tab: 创建/撤销/清理过期 key
  - /settings 未登录重定向
  - /settings/apikeys → /settings?tab=apikeys 重定向
  - 移动端 (<640px) 垂直分区布局

gate_commands:
  P5: "make test-quick"
  P5_e2e: "E2E_SPEC=e2e/settings.spec.ts make debug-test"
  P6: "make test-quick && make typecheck"

env_constraints:
  debug_env: "make debug-start (127.0.0.1:8888, /tmp/peekview-debug/)"
  seed_data: "make debug-seed (alice/bob/carol, password testpass123)"
  isolation_check: "sqlite3 /tmp/peekview-debug/peekview.db 'SELECT COUNT(*) FROM users' — should match seed count"

files_to_read:
  - path: backend/peekview/api/auth.py:186-248
    why: GET /me + change-password 端点模式，PATCH /me 参照此实现
  - path: backend/peekview/models.py:101-145
    why: User 模型定义 + UserResponse schema，UpdateProfileRequest 加在 ChangePasswordRequest 附近
  - path: backend/peekview/models.py:725-728
    why: ChangePasswordRequest schema 位置，UpdateProfileRequest 加在同区域
  - path: backend/peekview/auth.py:1-30
    why: require_auth 导入确认
  - path: frontend-v3/src/views/ApiKeyListView.vue
    why: 完整 API Key 管理逻辑，提取为 ApiKeySettingsTab 子组件
  - path: frontend-v3/src/router.ts
    why: 路由配置 + beforeEach 守卫，新增 /settings 路由和 auth guard
  - path: frontend-v3/src/stores/auth.ts
    why: authStore 结构，新增 updateProfile action
  - path: frontend-v3/src/api/client.ts:175-213
    why: auth API 方法区域，新增 updateProfile
  - path: frontend-v3/src/views/EntryListView.vue:370-390
    why: navigateToApiKeys() 路径更新
  - path: frontend-v3/src/views/EntryListView.vue:1-30
    why: header + user menu 模式参考
  - path: frontend-v3/src/views/EntryDetailView.vue:1-95
    why: header 布局模式参考（logo + actions + theme toggle）
  - path: frontend-v3/src/types/index.ts:103-118
    why: User 类型定义，确认 displayName 字段

minimal_validation:
  assumption: "Vue Router redirect 先于 beforeEach 执行"
  method: "读 Vue Router 源码文档确认 redirect 与 navigation guard 的执行顺序"
  result: "confirmed"
  note: "Vue Router navigation guard 执行顺序: 1) 全局 beforeEach 2) 路由配置的 beforeEnter 3) 组件守卫。但 redirect 是路由配置级别的，当路由配置了 redirect，beforeEach 中 to.path 已经是重定向后的路径。验证: /settings/apikeys 配置 redirect → beforeEach 收到的 to.path 是 /settings?tab=apikeys → auth guard 正常拦截。这与 BDD-10 的两步行为一致: 先 302 到 /settings?tab=apikeys，再被 guard 重定向到 /"

coupling_checklist:
  - [api-schema: checked] — 新增 UpdateProfileRequest + PATCH /auth/me，返回 UserResponse，与 GET /me 一致
  - [auth-state: checked] — Profile 编辑后更新 authStore.user，header 联动刷新，不重新登录
  - [router: checked] — 新增 /settings，旧 /settings/apikeys → redirect，auth guard 拦截
  - [component-migration: checked] — ApiKeyListView → ApiKeySettingsTab 功能等价，去掉 header
  - [css-scope: checked] — SettingsView scoped style，复用现有 CSS 变量
