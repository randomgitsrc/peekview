# PeekView 用户认证与条目权限 实现计划

> 版本: 2.1
> 日期: 2026-05-16
> 关联设计文档: `docs/specs/spec-user-auth.md` v2.1
> 评审修订：安全评审 ×2 + 架构评审 ×2 + 前端 UX 评审 ×2

---

## 目标

实现用户认证系统和条目可见性控制，使首页仅显示 public 条目，登录用户可管理 private 条目。

---

## 评审修订摘要

| 修订项 | 原设计 | 修订后 | 原因 |
|--------|--------|--------|------|
| user_id 类型 | str("default") | 新增 owner_id (INTEGER FK) | 类型不匹配，无法 JOIN/FK |
| API 命名 | visibility("public"|"private") | is_public (bool) | 与 DB 列和 PATCH 一致 |
| API Key header | Authorization: Bearer | X-API-Key | 避免 JWT 冲突 |
| 注册错误 | USERNAME_TAKEN (409) | REGISTRATION_FAILED (400) | 防止用户名枚举 |
| 登录对话框 | 标签页切换 | 单表单 + 文字链接 | 避免 tab 混淆 |
| 卡片结构 | 操作按钮在 router-link 内 | 独立 div + @click.stop | 防止点击冲突 |
| Auth 初始化 | isAuthenticated 双值 | authState 三态(loading/auth/anon) | 防止刷新闪烁 |
| Auth Store | 含 toggleVisibility/deleteEntry | 仅认证逻辑，操作放 entry store | 职责分离 |
| Secret Key | 每次重启随机 | 持久化到 ~/.peekview/.secret_key | 避免重启 session 失效 |
| is_active 检查 | 无 | 每次请求查 DB | 确保禁用用户立即失效 |
| 删除操作 | 无确认 | 确认对话框 | 防止误操作 |
| CLI 远程认证 | 无 | peekview login 命令 | 远程模式创建 private 需要 |
| 密码策略 | 无要求 | 最少 8 位 | 防止弱密码 |
| is_public 双重防护 | 仅 API 层 | API 层 + 服务层 | 防止绕过 |
| owner_id=NULL 删除 | 任何已登录用户 | 仅 API Key 可删 | 防止新用户删旧数据 |
| ON DELETE | SET NULL | CASCADE | 避免孤儿条目 |
| 登录限速 | v2 | v1 实现 | 防暴力破解 |
| Secret key 文件 | 无权限要求 | 0600 + O_CREAT\|O_EXCL | 防止密钥泄露和竞态 |
| Toast 系统 | 不存在 | 新建 Toast.vue + useToast.ts | 认证 UX 必需 |
| ConfirmDialog | 复用 LoginDialog | 独立 ConfirmDialog.vue | 不同交互模式 |
| fetchMe 位置 | App.vue | main.ts（mount 前） | 避免 UI 闪烁 |
| 移动端卡片操作 | 未指定 | bottom sheet + "..." 按钮 | 触屏友好 |
| 卡片 CSS 布局 | 未指定 | position: relative + absolute | 操作按钮不干扰链接 |
| 乐观更新回滚 | 未指定 | 失败回滚 + toast | toggleVisibility 可靠性 |
| Logout 列表处理 | 未指定 | 客户端过滤 + 后台 reload | 即时反馈 + 一致性 |

---

## 任务清单

### T1: 数据模型与数据库迁移 (`models.py`, `database.py`, `pyproject.toml`)

**目标**: 新增 User 模型，Entry 添加 is_public + owner_id 字段，添加依赖。

**实现步骤**:
- [ ] 1.1 `models.py` 新增 `User` 模型（users 表）：id, username, password_hash, display_name, is_active, created_at, updated_at
- [ ] 1.2 `models.py` Entry 添加 `is_public: bool = True`（`server_default="1"`）
- [ ] 1.3 `models.py` Entry 添加 `owner_id: int | None = None`（FK → users.id, ON DELETE CASCADE）
- [ ] 1.4 `models.py` 新增 Pydantic schemas：`UserRegister`(username 3-32位字母数字, password min_length=8), `UserLogin`, `UserResponse`, `AuthResponse`
- [ ] 1.5 `models.py` 更新 `EntryListItem` / `EntryResponse` 添加 `is_public`, `owner_id`, `username`
- [ ] 1.6 `models.py` 更新 `CreateEntryRequest` 添加 `is_public: bool = True`
- [ ] 1.7 `models.py` 更新 `EntryUpdate` 添加 `is_public: bool | None`
- [ ] 1.8 `database.py` 添加 `_run_migrations()` 函数：ALTER TABLE 添加 is_public 和 owner_id 列。**关键**：必须在 `SQLModel.metadata.create_all()` 之后调用，因为 owner_id REFERENCES users(id) 需 users 表已存在。`init_db()` 调用顺序：create_all → _run_migrations → setup_fts5
- [ ] 1.9 `pyproject.toml` 添加依赖：`passlib[bcrypt]`, `python-jose[cryptography]`
- [ ] 1.10 添加索引 `idx_entries_is_public`, `idx_entries_is_public_status_created`

**验收标准**:
```python
user = User(username="test", password_hash="...")
assert user.is_active == True

entry = Entry(slug="test", summary="test")
assert entry.is_public == True
assert entry.owner_id is None

# 现有数据库迁移后 is_public=1, owner_id=NULL
```

---

### T2: 认证配置与服务 (`config.py`, `auth.py` NEW)

**目标**: 新增认证配置项，创建 JWT 工具函数和 FastAPI 依赖。

**实现步骤**:
- [ ] 2.1 `config.py` 新增 `PeekAuth` 类：`secret_key`, `token_expire_days=7`, `allow_registration=True`
- [ ] 2.2 `config.py` 在 `PeekConfig` 中添加 `auth: PeekAuth`
- [ ] 2.3 Secret key 持久化逻辑：空时自动生成，存 `~/.peekview/.secret_key`
- [ ] 2.4 `auth.py` 新建文件：
  - `hash_password(password) -> str`（bcrypt rounds=12）
  - `verify_password(password, hash) -> bool`
  - `create_access_token(user_id, secret_key, expire_days) -> str`（payload: sub, exp, iat）
  - `get_current_user(request) -> User | None`（从 JWT 解析 user_id，查 DB 验证 is_active）
  - `require_auth(user) -> User`（必须认证，否则 401）

**验收标准**:
```python
hash = hash_password("secret")
assert verify_password("secret", hash)
assert not verify_password("wrong", hash)

token = create_access_token(1, "secret", 7)
payload = jwt.decode(token, "secret")
assert payload["sub"] == 1
assert "iat" in payload
```

---

### T3: 条目可见性逻辑 (`services/entry_service.py`)

**目标**: 在服务层实现可见性过滤和所有权检查。

**注意**：T3 在 T4（Auth API）之前完成，便于独立测试。

**实现步骤**:
- [ ] 3.1 `list_entries(current_user_id=None)`：已登录 → `is_public=True OR owner_id=user_id`；匿名 → 仅 `is_public=True`
- [ ] 3.2 `list_entries` 的 count 查询同样应用可见性过滤
- [ ] 3.3 `list_entries` 的 FTS5 搜索结果与可见性过滤组合
- [ ] 3.4 `get_entry(slug, current_user_id=None)`：private 条目仅 owner 可见，否则 404
- [ ] 3.5 `create_entry(is_public=True, current_user_id=None)`：匿名强制 is_public=True；已登录设置 owner_id
- [ ] 3.6 `update_entry(is_public=None, current_user_id=None)`：仅 owner 可修改，否则 404
- [ ] 3.7 `delete_entry(current_user_id=None)`：仅 owner 可删除；owner_id=NULL 的条目任何已登录用户可删；匿名不可删
- [ ] 3.8 `_retry_with_slug_suffix` 传递 current_user_id 和 is_public 参数
- [ ] 3.9 `list_entries` 批量查询 username（LEFT JOIN users 或子查询），解决 N+1 问题

**验收标准**:
```python
# 匿名列出 → 仅 public
entries = service.list_entries(current_user_id=None)
assert all(e.is_public for e in entries.items)

# 用户列出 → public + 自己的 private
entries = service.list_entries(current_user_id=1)
assert any(not e.is_public for e in entries.items)

# 匿名访问 private → 404
with pytest.raises(EntryNotFoundError):
    service.get_entry("private-slug", current_user_id=None)

# 匿名创建 → 强制 public
entry = service.create_entry(summary="test", is_public=False, current_user_id=None)
assert entry.is_public == True
```

---

### T4: 认证 API 端点 (`api/auth.py` NEW, `main.py`)

**目标**: 实现注册、登录、登出、获取当前用户接口。

**实现步骤**:
- [ ] 4.1 `api/auth.py` 新建文件，创建 `router = APIRouter(prefix="/api/v1/auth")`
- [ ] 4.2 实现 `POST /register`：
  - 首用户例外（users 表空时始终开放）
  - 用户名验证（3-32位，字母数字下划线中划线，保留名 default/system/admin 禁用）
  - 密码 min_length=8
  - 统一返回 `REGISTRATION_FAILED`（不区分用户名已存在 vs 其他错误，防枚举）
  - 返回 `201 Created` + JWT
- [ ] 4.3 实现 `POST /login`：
  - 统一 `INVALID_CREDENTIALS` 错误（不区分用户名/密码错误）
  - is_active=false 用户无法登录
  - 返回 200 + JWT
- [ ] 4.4 实现 `POST /logout`：返回 `204 No Content`
- [ ] 4.5 实现 `GET /me`：需 JWT，返回 UserResponse
- [ ] 4.6 `main.py` 注册 auth_router
- [ ] 4.7 `main.py` API Key 中间件：
  - 跳过 `/api/v1/auth/*`
  - 改为读取 `X-API-Key` header（向后兼容 `Authorization: Bearer` 旧格式）

---

### T5: 条目 API 路由变更 (`api/entries.py`, `api/files.py`)

**目标**: 路由层注入用户认证，传递给服务层。

**实现步骤**:
- [ ] 5.1 所有条目路由添加 `current_user: User | None = Depends(get_current_user)`
- [ ] 5.2 `create_entry` 接受 `is_public: bool = True`，传递 owner_id
- [ ] 5.3 `update_entry` 接受 `is_public`，仅 owner 可修改（非 owner → 404）
- [ ] 5.4 `delete_entry` 检查 owner
- [ ] 5.5 `get_entry` / `list_entries` 传递 current_user_id
- [ ] 5.6 `files.py` 所有文件端点添加可见性检查（复用 entry 可见性逻辑）
- [ ] 5.7 list 返回 `username` 字段（LEFT JOIN users 或 owner_id 查询）

---

### T6: CLI 变更 (`cli.py`, `client.py`)

**目标**: create 支持 is_public，新增 user 和 login 命令。

**实现步骤**:
- [ ] 6.1 `peekview create` 添加 `--visibility public|private` 选项（映射到 is_public）
- [ ] 6.2 新增 `peekview user` 命令组
- [ ] 6.3 `peekview user create <username>` 命令（交互式密码输入）
- [ ] 6.4 `peekview list` 添加 `--visibility` 过滤选项
- [ ] 6.5 `peekview login` 命令：交互式用户名密码，JWT 存到配置
- [ ] 6.6 `PeekClient` 优先使用 JWT token（config.remote.token），其次 API Key
- [ ] 6.7 远程模式：create 传递 is_public，login 存 token

---

### T7: 前端 Auth Store 与 API Client (`stores/auth.ts` NEW, `api/client.ts`, `types/index.ts`)

**目标**: 创建认证状态管理，更新 API 客户端。

**实现步骤**:
- [ ] 7.1 `stores/auth.ts` 新建：useAuthStore（user, token, initializing, authLoading, authState）
  - `authState` 三态 computed：loading / authenticated / anonymous
  - 仅含认证逻辑：login, register, logout, fetchMe
  - 不含 toggleVisibility / deleteEntry（放在 entry store）
- [ ] 7.2 `api/client.ts` 添加 request interceptor（注入 JWT）
- [ ] 7.3 `api/client.ts` 添加 response interceptor（401 时清 token + toast 提示 "会话已过期"）
- [ ] 7.4 `api/client.ts` 新增方法：login, register, getMe
- [ ] 7.5 `stores/entry.ts` 添加 toggleVisibility, deleteEntry 方法
- [ ] 7.6 `types/index.ts` 更新 Entry 类型添加 isPublic, ownerId, username
- [ ] 7.7 `types/index.ts` 新增 User, AuthResponse, AuthError 类型
- [ ] 7.8 `main.ts` 或 `App.vue` 启动时调用 fetchMe()

---

### T8: 前端 LoginDialog 组件 (`components/LoginDialog.vue` NEW)

**目标**: 登录/注册模态对话框。

**实现步骤**:
- [ ] 8.1 创建 LoginDialog.vue：模态框 + 单表单（Login 为默认）
- [ ] 8.2 底部 "没有账号？注册" 文字链接切换到 Register 模式
- [ ] 8.3 Login 表单：用户名 + 密码
- [ ] 8.4 Register 表单：用户名 + 密码 + 确认密码 + 可选 display_name
- [ ] 8.5 客户端验证（用户名 3-32 位、密码 ≥8 位、注册时密码确认匹配）
- [ ] 8.6 ARIA 属性：role="dialog", aria-modal="true", aria-labelledby
- [ ] 8.7 焦点管理：打开聚焦第一个输入，Tab 循环，Escape 关闭
- [ ] 8.8 Loading 状态：提交时禁用按钮 + 加载指示器
- [ ] 8.9 注册不可用时隐藏注册链接

---

### T9: 前端 EntryListView 变更 (`views/EntryListView.vue`)

**目标**: Header 添加登录按钮，卡片增加元信息和操作。

**实现步骤**:
- [ ] 9.1 Header 布局：`[PeekView] [spacer] [Login/UserMenu] [ThemeToggle]`
- [ ] 9.2 `authState === 'loading'`：不显示登录按钮
- [ ] 9.3 `authState === 'anonymous'`：显示 "Login" 按钮（移动端为图标按钮）
- [ ] 9.4 `authState === 'authenticated'`：显示头像首字母 + 用户名 + Logout 下拉
- [ ] 9.5 卡片结构重构：card-actions(@click.stop) + router-link(card-body)
- [ ] 9.6 卡片元信息：创建时间（相对时间）、创建者（username 或不显示 owner_id=NULL 的）
- [ ] 9.7 Owner 卡片 visibility toggle：`🔒 Private` / `🌐 Public` + aria-label
- [ ] 9.8 Owner 卡片 delete 按钮 + 确认对话框
- [ ] 9.9 切换 visibility 调用 entry store 的 toggleVisibility（乐观更新）
- [ ] 9.10 移动端：卡片操作收进 "..." 菜单

---

### T10: 前端 EntryDetailView 变更 (`views/EntryDetailView.vue`)

**目标**: 详情页增加 owner 控制和元信息。

**实现步骤**:
- [ ] 10.1 Header 操作区增加 visibility toggle（owner 可见）
- [ ] 10.2 Header 操作区增加 delete 按钮 + 确认对话框（owner 可见）
- [ ] 10.3 显示条目元信息：创建时间、创建者、可见性状态

---

### T11: 测试

**目标**: 覆盖认证和可见性的关键路径。

**实现步骤**:
- [ ] 11.1 新建 `test_auth.py`：注册（含首用户例外）、登录（含 is_active 检查）、JWT 验证、密码哈希
- [ ] 11.2 更新 `test_api.py`：可见性过滤、owner 检查、private 条目 404、文件端点可见性
- [ ] 11.3 更新 `test_cli.py`：`--visibility` 选项、`user create` 命令、`login` 命令
- [ ] 11.4 E2E 测试：登录流程、visibility 切换、private 条目不可见、文件访问受限

---

## 关键文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `backend/peekview/models.py` | 修改 | User 模型、is_public + owner_id 字段、新 schemas |
| `backend/peekview/database.py` | 修改 | 迁移逻辑（is_public + owner_id） |
| `backend/peekview/config.py` | 修改 | PeekAuth 配置 + secret key 持久化 |
| `backend/peekview/auth.py` | 新建 | JWT 工具（sub+exp+iat）、FastAPI 依赖 |
| `backend/peekview/api/auth.py` | 新建 | 认证 API 路由（register/login/logout/me） |
| `backend/peekview/api/entries.py` | 修改 | 注入 user、可见性过滤、is_public 参数 |
| `backend/peekview/api/files.py` | 修改 | 可见性检查 |
| `backend/peekview/services/entry_service.py` | 修改 | 可见性逻辑 + username 查询 |
| `backend/peekview/cli.py` | 修改 | --visibility、user 命令、login 命令 |
| `backend/peekview/client.py` | 修改 | JWT token 支持 |
| `backend/peekview/main.py` | 修改 | auth_router 注册、API Key 中间件改为 X-API-Key |
| `backend/pyproject.toml` | 修改 | 新增依赖 |
| `frontend-v3/src/stores/auth.ts` | 新建 | Auth Pinia Store（三态 authState） |
| `frontend-v3/src/stores/entry.ts` | 修改 | 添加 toggleVisibility, deleteEntry |
| `frontend-v3/src/api/client.ts` | 修改 | JWT interceptor、auth 方法 |
| `frontend-v3/src/types/index.ts` | 修改 | Entry + User 类型 |
| `frontend-v3/src/components/LoginDialog.vue` | 新建 | 登录对话框（ARIA + 焦点管理） |
| `frontend-v3/src/views/EntryListView.vue` | 修改 | 登录按钮、卡片重构 |
| `frontend-v3/src/views/EntryDetailView.vue` | 修改 | Owner 控制 |
| `frontend-v3/src/main.ts` | 修改 | 启动时 fetchMe |

---

## 验证流程

1. `cd backend && python -m pytest tests/ -v` — 所有后端测试通过
2. `make debug-build && make debug-start` — 启动调试服务
3. 浏览器访问 http://127.0.0.1:8888 — 首页只显示 public 条目
4. 点击 Login → 注册用户 → 登录 → 看到 public + 自己的 private 条目
5. 卡片上切换 public/private → 刷新后状态保持
6. 删除条目 → 确认对话框 → 确认后条目消失
7. 退出登录 → 仅看到 public 条目，private 消失
8. `peekview user create bob` — CLI 创建用户
9. `peekview create test.py -s "Private" --visibility private` — 创建 private 条目
10. `make debug-test` — E2E 测试通过
