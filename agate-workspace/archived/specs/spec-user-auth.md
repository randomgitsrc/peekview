# PeekView 用户认证与条目权限 技术设计文档

> 版本: 2.1
> 日期: 2026-05-16
> 状态: 二轮评审修订版
> 关联: 用户需求 — 条目权限控制 + 用户登录
> 评审: 安全评审 ×2 + 架构评审 ×2 + 前端 UX 评审 ×2

---

## 1. 需求背景

### 1.1 当前状态

PeekView 当前是纯公开服务：
- 所有条目任何人可见，无用户概念
- Entry 模型有 `user_id` 字段但固定为 `"default"`，未实际使用
- 认证仅有 API Key（服务级），无用户级登录

### 1.2 目标状态

- 条目有 public/private 两种可见性
- 首页只显示 public 条目；登录后可见自己的 private 条目
- 用户名+密码登录，保持登录状态，可退出
- 登录用户可在卡片上切换 visibility 和删除条目
- 首页卡片显示创建者、创建时间

---

## 2. 设计目标

| 目标 | 说明 |
|------|------|
| **简单优先** | 轻量级服务，不引入角色/权限矩阵，所有注册用户权限相同 |
| **向后兼容** | 现有条目默认 public，无 owner 的条目任何已登录用户可操作 |
| **双认证共存** | API Key（服务级）+ JWT（用户级）互不干扰，用不同 header |
| **安全默认** | private 条目返回 404 而非 403，避免信息泄露 |
| **类型一致** | user_id 统一为 INTEGER + FK，迁移旧数据 |

---

## 3. 技术方案

### 3.1 整体架构

```
┌───────────────────────────────────────────────────┐
│  Frontend (Vue 3)                                 │
│  ┌──────────┐  ┌───────────┐  ┌───────────────┐  │
│  │ LoginBtn │  │ AuthStore │  │ EntryCard     │  │
│  │ (Header) │  │ (Pinia)   │  │ +visibility   │  │
│  └──────────┘  └─────┬─────┘  │ +delete       │  │
│                      │ JWT     │ +creator/time │  │
└──────────────────────┼─────────┴───────────────┘──┘
                       │
┌──────────────────────┼────────────────────────────┐
│  Backend (FastAPI)   │                            │
│  ┌───────────┐  ┌────┴─────┐  ┌──────────────┐  │
│  │ Auth API  │  │ JWT Dep  │  │ Entry API    │  │
│  │ /auth/*   │  │ get_user │  │ visibility   │  │
│  └───────────┘  └──────────┘  │ ownership    │  │
│                                └──────────────┘  │
│  ┌──────────┐  ┌──────────────────────────────┐  │
│  │ User表   │  │ Entry表 (+is_public, owner_id)│ │
│  └──────────┘  └──────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### 3.2 认证机制：JWT

**选择 JWT 而非 Session Cookie 的原因：**
- SQLite-only 约束：session 存储增加复杂度（GC、schema 管理）
- JWT 无状态，前端 axios 支持 interceptor 注入 token

**Token 规范：**
- 算法：HS256
- Payload：`{"sub": <user_id>, "exp": <timestamp>, "iat": <timestamp>}`
- 有效期：7 天（可配置 `PEEKVIEW_AUTH__TOKEN_EXPIRE_DAYS`）
- 前端存储：localStorage `peekview_token`
- 无 refresh token —— 轻量服务，过期重新登录即可

**v1.0 评审修订：**
- JWT 中只存 `sub`（user_id），不存 `username`（避免过期数据问题）
- 每次请求从数据库解析用户（确保 `is_active` 实时生效）
- 添加 `iat`（签发时间），为未来 token 作废预留

### 3.3 数据模型

**新增 `users` 表：**

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK, AUTO | 主键 |
| username | VARCHAR(32) | UNIQUE, NOT NULL | 登录名（字母数字下划线中划线，3-32位） |
| password_hash | VARCHAR(128) | NOT NULL | bcrypt 哈希（rounds=12） |
| display_name | VARCHAR(64) | NULL | 显示名（可选，回退到 username） |
| is_active | BOOLEAN | DEFAULT 1 | 是否启用（禁用后无法登录） |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 更新时间 |

**`entries` 表变更：**

| 新字段 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| is_public | BOOLEAN | DEFAULT 1 | 可见性，现有条目全部 public |
| owner_id | INTEGER | NULL, FK → users.id ON DELETE CASCADE | 条目所有者（替代 user_id） |

**v1.0 评审修订 — user_id 类型问题：**

原设计 `entries.user_id` 是 `str` 类型（默认值 `"default"`），与 `users.id` (INTEGER) 不匹配，无法建立 FK 约束和 JOIN 查询。

**解决方案：新增 `owner_id` 字段（INTEGER, FK），保留 `user_id` 向后兼容**

- `owner_id`: INTEGER, NULL, FOREIGN KEY REFERENCES users(id) ON DELETE SET NULL
- `user_id`: 保留原字段（str），不再使用
- 迁移时：`owner_id` 默认为 NULL（表示匿名/旧条目）
- API 响应使用 `owner_id` 和 `username`（JOIN 查询）

这样做的好处：
1. 不破坏现有 `user_id` 字段的任何代码
2. 新字段有正确的 FK 约束
3. 迁移安全——只是添加新列

### 3.4 可见性规则

| 操作 | 匿名 | 已登录（非 owner） | Owner |
|------|------|-------------------|-------|
| 列出条目 | 仅 public | public + 自己的全部 | public + 自己的全部 |
| 查看条目 | 仅 public | public 或自己的 private | 全部 |
| 创建条目 | 允许（owner_id=NULL，强制 public） | 允许，设置 owner_id | — |
| 修改可见性 | 不允许 | 不允许 | 允许 |
| 删除条目 | 不允许 | 不允许（owner_id=NULL 仅 API Key 可删） | 允许 |

**向后兼容**：`owner_id=NULL` 的条目，任何已登录用户可删除（保持旧行为）。匿名用户不可删除。

**v2.1 评审修订 — owner_id=NULL 删除规则：**

原设计"任何已登录用户可删 owner_id=NULL 条目"有风险：新注册用户可删除所有旧条目。修订为：
- `owner_id=NULL` 的条目仅通过 API Key（服务级认证）可删除，JWT 用户不可删
- 这保护了旧数据不被新注册用户误删
- CLI 本地模式不受限（直接操作数据库）

**v1.0 评审修订：**
- 匿名用户不可创建 private 条目（服务层强制 `is_public=True`）
- **双重防护**：API 路由层（强制 is_public=True）+ 服务层（拒绝 is_public=False 当 owner_id=NULL）
- 所有 PATCH 操作需要 owner 身份，不存在"部分权限"
- `is_active=false` 用户无法登录（返回 `INVALID_CREDENTIALS`，不泄露禁用信息）

### 3.5 首用户引导

两种方式同时支持：

1. **API 自动开放**：users 表为空时，`/api/v1/auth/register` 始终可用（无论 `allow_registration` 配置）
2. **CLI 命令**：`peekview user create <username>` 直接写本地数据库

**v1.0 评审修订 — TOCTOU 竞态：**

首用户注册的"空表检查"存在 TOCTOU 竞态。修复：依赖 `username UNIQUE` 约束作为主要守卫，"空表"检查仅作为提示。用 `INSERT ... ON CONFLICT` 检查受影响行数。

### 3.6 API Key 与 JWT 共存

**v1.0 评审修订 — Authorization header 冲突：**

原设计中 API Key 和 JWT 都使用 `Authorization: Bearer` 头，会互相冲突。

**解决方案：分离 header**

| 认证方式 | Header | 用途 |
|----------|--------|------|
| API Key | `X-API-Key: <key>` | 服务级认证（程序访问） |
| JWT | `Authorization: Bearer <jwt>` | 用户级认证（交互登录） |

- API Key 中间件改为读取 `X-API-Key` header
- 保持向后兼容：同时支持 `Authorization: Bearer <api_key>` 旧格式（仅当 token 不像 JWT 时）
- 新代码统一使用 `X-API-Key` 传递 API Key

---

## 4. API 设计

### 4.1 认证端点

**POST `/api/v1/auth/register`**

```json
// Request
{ "username": "alice", "password": "secret123", "display_name": "Alice" }

// Response 201
{ "access_token": "eyJ...", "token_type": "bearer", "user": { ... } }

// 400 (注册失败 — 不区分用户名是否已存在，防止枚举)
{ "error": { "code": "REGISTRATION_FAILED", "message": "Registration failed. Please try a different username." } }

// 403 (registration disabled & not first user)
{ "error": { "code": "REGISTRATION_DISABLED", "message": "Registration is disabled" } }
```

**v1.0 评审修订：**
- 返回 `201 Created` 而非 `200 OK`
- 不返回 `USERNAME_TAKEN` 错误（防止用户名枚举），统一返回 `REGISTRATION_FAILED`
- 密码最小长度 8 位（`min_length=8`）
- 用户名规则：字母数字下划线中划线，3-32 位，保留名 `default`, `system`, `admin` 不可用

**POST `/api/v1/auth/login`**

```json
// Request
{ "username": "alice", "password": "secret123" }

// Response 200
{ "access_token": "eyJ...", "token_type": "bearer", "user": { ... } }

// 401 (统一错误，不区分用户名/密码错误)
{ "error": { "code": "INVALID_CREDENTIALS", "message": "Invalid username or password" } }
```

**POST `/api/v1/auth/logout`**

```
// Response 204 No Content (无服务端操作，前端清 token)
```

**GET `/api/v1/auth/me`**（需 JWT）

```json
// Response 200
{ "id": 1, "username": "alice", "display_name": "Alice", "is_active": true, "created_at": "..." }

// 401
{ "error": { "code": "NOT_AUTHENTICATED", "message": "Authentication required" } }
```

### 4.2 条目端点变更

**GET `/api/v1/entries`**

- 请求头 `Authorization: Bearer <jwt>` 可选
- 有 JWT：返回 public 条目 + 该用户的所有条目
- 无 JWT：仅返回 public 条目

**Response 变更**：`EntryListItem` 新增 `is_public`, `owner_id`, `username` 字段

**POST `/api/v1/entries`**

- 新增 `is_public` 字段：`true` (默认) | `false`
- 有 JWT：`owner_id` 设为当前用户 ID
- 无 JWT：`owner_id=NULL`，`is_public` 强制为 `true`

**v1.0 评审修订：**
- 统一使用 `is_public: bool` 而非 `visibility: "public"|"private"`（与 DB 列名和 PATCH 一致）
- 列表返回 `username` 字段（LEFT JOIN users 表）

**PATCH `/api/v1/entries/{slug}`**

- 接受 `is_public` 字段
- **所有** PATCH 操作需要 owner 身份（非 owner 返回 404）

**DELETE `/api/v1/entries/{slug}`**

- 仅 owner 可删除（`owner_id=NULL` 的条目任何已登录用户可删）
- 匿名不可删除任何条目

### 4.3 文件端点可见性

**v1.0 评审修订 — 新增专门章节：**

文件端点（`GET /{slug}/files/{file_id}`, `GET /{slug}/files/{file_id}/content`）必须同步检查条目可见性：

- 如果条目 `is_public=true`：允许任何人访问
- 如果条目 `is_public=false`：仅 owner 可访问
- 未知或无权限：返回 404（非 403）

文件端点添加 `current_user = Depends(get_current_user)` 依赖，复用 entry 可见性检查逻辑。

---

## 5. 前端设计

### 5.1 Auth Store (`stores/auth.ts`)

```typescript
export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(localStorage.getItem('peekview_token'))
  const initializing = ref(true)  // 防止刷新时登录按钮闪烁
  const authLoading = ref(false)  // 登录/注册请求进行中

  const authState = computed<'loading' | 'authenticated' | 'anonymous'>(() => {
    if (initializing.value) return 'loading'
    if (token.value && user.value) return 'authenticated'
    return 'anonymous'
  })

  async function login(username: string, password: string) { ... }
  async function register(username: string, password: string, displayName?: string) { ... }
  function logout() { token.value = null; user.value = null; localStorage.removeItem('peekview_token') }
  async function fetchMe() { ... }  // 启动时验证 token
  return { user, token, initializing, authLoading, authState, login, register, logout, fetchMe }
})
```

**v1.0 评审修订：**
- 添加 `initializing` 状态防止刷新时 UI 闪烁
- `authState` 三态：loading / authenticated / anonymous
- `toggleVisibility` 和 `deleteEntry` 放在 entry store 中，不在 auth store（职责分离）
- 401 拦截时显示 toast 提示 "会话已过期，请重新登录"

### 5.2 API Client 变更

- Request interceptor：从 localStorage 读取 JWT 注入 `Authorization: Bearer <token>` 头
- Response interceptor：401 时清 token + 显示 toast + 保留当前列表不静默切换
- 新增方法：`login()`, `register()`, `getMe()`, `updateEntry()`, `deleteEntry()`

**v2.1 评审修订：**
- **Toast 系统**：需新建 `Toast.vue` + `useToast.ts`（当前代码库无 toast 系统）
- 401 拦截需区分：启动时 fetchMe 的 401（静默清 token，不弹 toast）vs 中途 401（弹 toast）
- fetchMe 放在 `main.ts`（Pinia 初始化后、app.mount 前），避免 App.vue 耦合

### 5.3 Toast 组件 (`components/ui/Toast.vue` NEW)

**v2.1 评审新增：**

- 固定定位（顶部居中或右上角）
- 支持 `success` / `warning` / `error` 三种变体
- 自动消失（3秒）
- 堆叠显示
- 全局容器在 `App.vue` 中
- `useToast.ts` composable：`show(message, variant)`

### 5.4 ConfirmDialog 组件 (`components/ConfirmDialog.vue` NEW)

**v2.1 评审新增：**

通用确认对话框组件（不复用 LoginDialog）：
- Props：`title`, `message`, `confirmLabel`, `confirmVariant`(destructive)
- ARIA：`role="alertdialog"`, `aria-labelledby`, `aria-describedby`
- 焦点：Cancel 按钮获得初始焦点（安全默认值）
- 键盘：Escape = 取消
- 用于：删除条目确认

### 5.5 LoginDialog 组件

**v1.0 评审修订：**

- **不使用标签页切换**，改用单表单 + 文字链接切换：
  - 默认 Login 表单：用户名 + 密码
  - 底部 "没有账号？注册" 链接 → 切换为 Register 表单（添加确认密码、display_name）
  - 注册不可用时隐藏链接
- **添加 ARIA 属性**：`role="dialog"`, `aria-modal="true"`, `aria-labelledby`
- **焦点管理**：打开时聚焦第一个输入框，Tab 循环，Escape 关闭，关闭后焦点返回触发按钮
- **Loading 状态**：提交时禁用按钮，显示加载指示器
- **客户端验证**：用户名 3-32 位字母数字、密码最少 8 位、注册时密码确认匹配
- **密码显示切换**：`type="password"` 输入框 + 显示/隐藏按钮

### 5.6 EntryListView 变更

**Header 区域：**
```
[PeekView]  [spacer]  [Login/UserMenu] [ThemeToggle]
```
- `authState === 'loading'`：不显示登录按钮（避免闪烁）
- `authState === 'anonymous'`：显示 "Login" 按钮
- `authState === 'authenticated'`：显示用户头像首字母 + 用户名 + 下拉菜单（Logout）
- 移动端：Login 缩为图标按钮，用户名缩为头像首字母

**卡片增强 — v1.0 评审修订：**

原设计中操作按钮放在 `<router-link>` 内部会导致点击冲突。新设计：

```html
<div class="entry-card">
  <div class="card-actions" @click.stop>  <!-- 阻止冒泡到 router-link -->
    <button class="visibility-toggle" aria-label="...">...</button>
    <button class="delete-btn" aria-label="Delete entry">...</button>
  </div>
  <router-link :to="`/${entry.slug}`" class="card-body">
    <h3>{{ entry.summary }}</h3>
    <div class="entry-meta">
      <span>3 files · python, cli</span>
      <span>by alice · 2 hours ago</span>
    </div>
  </router-link>
</div>
```

- `card-actions` 使用 `@click.stop` 阻止事件冒泡
- visibility toggle：使用 `🔒 Private` / `🌐 Public` 文字标签 + `aria-label`
- delete 按钮：点击弹出确认对话框（非直接删除）
- `owner_id=NULL` 的条目不显示 "by" 行（匿名条目无创建者）
- 移动端：卡片操作收进 "..." 菜单

**v2.1 评审修订：**

- **卡片 CSS 布局**：`.entry-card` 使用 `position: relative`，`.card-actions` 使用 `position: absolute; top; right`
- **card-actions 可见性**：桌面端 owner 始终可见，移动端通过 "..." 按钮展开
- **移动端 "..." 菜单**：使用底部弹出面板（bottom sheet，与现有 drawer 模式一致），包含 toggle visibility 和 delete 选项
- **Tab 顺序**：`card-body`（router-link）应在 `card-actions` 之前，确保主要操作（查看条目）是第一个 tab stop。使用 DOM 顺序 + CSS 视觉定位实现
- **toggleVisibility 乐观更新**：立即切换 UI → API 成功保持 → 失败回滚 + toast 错误提示
- **Logout 后列表处理**：立即客户端过滤 private 条目 → 后台静默 reload 确保一致性
- `owner_id=NULL` 的条目不显示 "by" 行

### 5.7 EntryDetailView 变更

- Header 操作区增加：visibility toggle + delete 按钮（owner 可见）
- Delete 需确认对话框（使用 ConfirmDialog 组件）
- 显示条目元信息：创建时间、创建者、可见性状态
- 元信息放在标题下方区域：`by alice · 2 hours ago · 🔒 Private`

---

## 6. CLI 变更

### 6.1 `peekview create` 新增选项

```bash
peekview create file.txt -s "Private code" --visibility private
```

### 6.2 新增 `peekview user` 命令组

```bash
peekview user create <username>           # 交互式输入密码
peekview user create <username> -p <pwd>  # 直接指定密码
peekview user list                        # 列出用户
```

### 6.3 `peekview list` 新增过滤

```bash
peekview list --visibility public    # 仅公开
peekview list --visibility private   # 仅私有
peekview list --visibility all       # 全部
```

### 6.4 远程模式用户认证

**v1.0 评审修订 — 新增：**

CLI 远程模式需要用户级认证才能创建 private 条目。添加 `peekview login` 命令：

```bash
# 交互式登录（JWT 存储到 ~/.peekview/config.yaml 或独立凭证文件）
peekview login --remote-url https://peek.example.com
# → 输入用户名和密码
# → Token 存储到配置

# 登录后，远程 CLI 自动附带 JWT
peekview create file.txt -s "Private" --visibility private --remote-url https://peek.example.com
```

实现方式：`PeekClient` 优先使用存储的 JWT token（如 `config.remote.token`），其次使用 API Key。

---

## 7. 配置项

### 新增环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PEEKVIEW_AUTH__SECRET_KEY` | 自动生成并持久化 | JWT 签名密钥 |
| `PEEKVIEW_AUTH__TOKEN_EXPIRE_DAYS` | `7` | JWT 有效天数 |
| `PEEKVIEW_AUTH__ALLOW_REGISTRATION` | `true` | 是否开放注册 |

**v1.0 评审修订：**
- `SECRET_KEY` 空时不再每次重启随机生成（会导致所有 session 失效）
- 改为：首次启动时自动生成，持久化到 `~/.peekview/.secret_key` 文件
- 生产环境建议通过环境变量显式设置

### 配置文件示例

```yaml
auth:
  secret_key: "your-stable-secret-key-for-production"
  token_expire_days: 7
  allow_registration: false  # 生产环境可关闭
```

---

## 8. 数据库迁移

迁移逻辑在 `database.py` 中：

```python
def _run_migrations(engine: Engine) -> None:
    with engine.connect() as conn:
        columns = {row[1] for row in conn.execute(text("PRAGMA table_info(entries)"))}

        if "is_public" not in columns:
            conn.execute(text("ALTER TABLE entries ADD COLUMN is_public BOOLEAN DEFAULT 1"))

        if "owner_id" not in columns:
            conn.execute(text("ALTER TABLE entries ADD COLUMN owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE"))

        conn.commit()
```

- `users` 表由 `SQLModel.metadata.create_all()` 自动创建
- **关键顺序**：`_run_migrations()` 必须在 `create_all()` 之后执行，因为 `ALTER TABLE entries ADD owner_id REFERENCES users(id)` 需要 `users` 表已存在
- 现有条目 `is_public=1`（public），`owner_id=NULL`（匿名），向后兼容
- 保留 `user_id` 字段不动，不破坏现有代码
- FTS5 无需重建（is_public 和 owner_id 不是搜索字段）
- 新增复合索引：`idx_entries_is_public_status_created` (is_public, status, created_at DESC)

---

## 9. 安全考虑

| 项目 | 策略 |
|------|------|
| 密码存储 | bcrypt 哈希（passlib, rounds=12），永不存明文，限制密码最长 72 字节（bcrypt 限制） |
| JWT 密钥 | 自动生成并持久化到 `~/.peekview/.secret_key`（**0600 权限，O_CREAT\|O_EXCL 原子写入**），生产建议通过环境变量设置 |
| JWT payload | 只存 `sub`(user_id) + `exp` + `iat`，不存 username（避免过期数据） |
| is_active 检查 | 每次请求从 DB 查用户并验证 is_active（确保禁用用户立即失效） |
| Private 条目 | 返回 404（非 403），避免 slug 枚举 |
| 注册安全 | 不返回 USERNAME_TAKEN 错误（防止枚举），统一返回 REGISTRATION_FAILED |
| 文件端点 | 同步检查 entry 可见性，防止绕过条目直接访问文件 |
| API Key 分离 | API Key 用 `X-API-Key` header，JWT 用 `Authorization: Bearer`，互不冲突 |
| XSS 防护 | JWT 存 localStorage，v1 可接受；CSP header 减少风险；未来迁移 HttpOnly cookie |
| Token 过期 | 401 时前端 toast 提示 + 保留列表状态，不静默切换 |
| 密码策略 | 最小 8 位，用户名 3-32 位字母数字下划线中划线，保留名禁用 |
| is_public 双重防护 | API 路由层（匿名强制 is_public=True）+ 服务层（拒绝 owner_id=NULL 且 is_public=False） |
| owner_id=NULL 删除 | 仅 API Key 认证可删，JWT 用户不可删（防止新用户删旧数据） |
| 登录限速 | **v1 实现**：in-memory 滑窗计数，每用户名 5 次/15 分钟，每 IP 20 次/15 分钟 |
| ON DELETE | owner_id FK 使用 `ON DELETE CASCADE`（用户删除时条目一起删除，避免孤儿条目） |

**v1.0 评审标注（未在 v1 实现的安全项）：**

| 项目 | 状态 | 说明 |
|------|------|------|
| Token 吊销 | v2 | 需要 denylist 表或 iat + password_changed_at 检查 |
| HttpOnly Cookie | v2 | 从 localStorage 迁移，需加 CSRF 防护 |
| 审计日志 | v2 | 登录/可见性变更/删除记录 |
