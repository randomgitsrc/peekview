---
phase: P2
task_id: T080-admin-user-management
trace_id: T080
type: design
parent: P1-requirements.md
status: draft
agent: architect
created: 2026-08-06
---

# T080 P2 — 方案设计：Admin 用户管理

## 声明字段

```yaml
packages:
  - backend/peekview        # 主包（API + service + models + database + cli + auth）
  - frontend-v3             # 前端独立构建产物（不独立发版，但 typecheck/build 独立 gate）
domains:
  - backend
  - frontend
  - cli
  - security
ui_affected: true
ui_interaction_points:
  - "/admin 路由访问 + 路由守卫（非 admin→/explore，未登录→/）"
  - "用户列表渲染（分页 Pagination + 状态 BaseBadge）"
  - "每行 OverflowMenu（dropdown desktop / sheet mobile）操作菜单"
  - "禁用/启用 promote/demote 操作（直接执行 + toast 反馈）"
  - "重置密码 PasswordResetDialog（输入新密码 + show/hide + ≥8 校验 + 确认 disabled + alertdialog role + focus）"
  - "删除用户 ConfirmDialog（destructive，alertdialog role，文案 spec 见 §7）"
  - "禁用用户 ConfirmDialog（destructive，alertdialog role，文案 spec 见 §7）"
  - "禁用后该用户 JWT 软失效（BDD-04，后端行为，前端无交互）"
gate_commands:
  P3: "make test-quick"
  P5: "make test-quick && make test-frontend && make typecheck"
  P5_e2e: "make debug-test"
  project_module: "peekview"
env_constraints:
  debug_env: "make debug / make debug-start（127.0.0.1:8888，独立数据目录 /tmp/peekview-debug/，captcha 自动禁用）"
  isolation_check: "make debug-verify-isolation（依赖 :8080 在线；不在线时 sqlite3 /tmp/peekview-debug/peekview.db 手动验证）"
  prod_not_touched: "[PROD_NOT_TOUCHED] P2 只读代码 + 写产出文件，未启动服务、未写实现代码、未触碰 :8080 / ~/.peekview/"
```

### gate_commands 说明

- `make test-quick`：后端 pytest（venv，conftest autouse 隔离）。Makefile 是测试命令唯一真相源（AGENTS.md 要求）。
- `make test-frontend`：前端 vitest run（非 watch，失败报错）。
- `make typecheck`：vue-tsc --noEmit（CI 强制）。
- `make debug-test`：Playwright E2E（CDP :18800），ui_affected=true 必填 P5_e2e。
- 紧凑输出模式：Makefile target 内部已封装 `-q`/`--tb=no` 等安静模式。

## minimal_validation

```yaml
minimal_validation:
  assumption: "纯代码逻辑，无外部系统依赖"
  method: "not_needed"
  note: >
    本任务为 API + CLI + 前端组件的纯代码逻辑。关键假设均已由现有代码证实：
    1. JWT 软失效：auth.py:177 get_current_user 每请求查库验 is_active，
       False 时返回 None（require_auth→401）。禁用用户 JWT 即时失效，无需黑名单。
       BDD-04 由此后端机制覆盖，P2 无需额外验证。
    2. require_admin：auth.py:203-217 非admin→ForbiddenError(403)，
       新端点复用 Depends(require_admin) 即获 403 守卫（BDD-16）。
    3. migration 机制：database.py:39-157 _run_migrations 用
       PRAGMA table_info + ALTER TABLE ADD COLUMN 模式，users 表已有
       is_admin migration 先例（:84-98）。审计字段照此模式，无需实测。
    4. 级联删除：admin_service.py:328-349 delete_user 已实现
       entries→files→apikeys 级联删除，本任务复用。
    5. check_schema：database.py:172-204 启动时比对 model vs 实际列，
       缺列→SchemaMismatchError。model 字段与 migration 必须同步，
       否则启动失败——这是自检机制，无需额外验证。
    依赖的内部函数/数据转换：get_current_user（查库验 is_active）、
    require_admin（验 is_admin）、hash_password（bcrypt）、
    _run_migrations（ALTER TABLE）、delete_user（级联删除）。
```

## 影响域分析

### 改什么

**后端**：
- `models.py`：UserBase 新增 `disabled_at`/`disabled_by`/`disabled_reason` 审计字段；UserResponse 新增 `disabled_at`/`disabled_by`（前端展示用）；新增 `UserListResponse` schema（{items,total,page,per_page}，参照 EntryListResponse）。
- `database.py`：`_run_migrations` 新增 users 表三个审计字段的 ALTER TABLE migration（参照 :84-98 is_admin 模式）。
- `services/admin_service.py`：新增 `disable_user`/`enable_user`/`promote_user`/`demote_user` 方法；`list_users` 改返回 `UserListResponse`（含 total）；`delete_user` 补 LastAdmin 保护；新增共享 helper `_check_last_active_admin` + `_check_self_operation`。
- `api/admin.py`：新增 4 个 toggle 端点（disable/enable/promote/demote）；`list_users` response_model 改 `UserListResponse`；`delete_user` 增加 LastAdmin 错误透传。
- `api/auth.py:231-251`：`delete_self` 移除 `confirm_username` 旁路，改为绝对拒绝最后一个活跃 admin（决策 A，破坏性变更）；修正 admin 计数加 `is_active=True` 条件（决策 B）。
- `cli.py`：user 命令组新增 `disable`/`enable` 子命令；`demote` 补 LastAdmin 保护（参照 service helper 或本地复算）；`delete`（local 模式）补 LastAdmin 保护。

**前端**：
- `router.ts`：新增 `/admin` route（meta.requiresAdmin，须在 `/:slug` 之前）；`beforeEach` 增加守卫逻辑（非 admin→/explore，未登录→/）。
- `views/AdminView.vue`：新增页面（用户列表 + 分页 + OverflowMenu 操作 + ConfirmDialog）。
- `api/client.ts`：新增 admin API 方法组（listUsers/disableUser/enableUser/promoteUser/demoteUser/resetPassword/deleteUser）；transformUser 扩展 disabledAt。
- `types/index.ts`：User 扩展 disabledAt；新增 UserListResponse。
- `components/BaseBadge.vue`：新增 `disabled` + `admin` variant（DESIGN.md §6 约定 admin badge pill，disabled 需新增）。

### 不改什么

- MCP server（`packages/mcp-server/`）：不暴露 admin 能力（决策已定）。
- JWT 机制：不引入黑名单/token 版本号（现状软失效足够）。
- `get_current_user` / `require_admin` / `require_auth` 核心逻辑不变（只复用）。
- backup/restore/export：保留 CLI-only，不纳入（restore merge 创建 User 不带审计字段，兼容性 OK——审计字段 nullable，旧数据无审计信息正常）。
- Entry/File/ApiKey 模型不变。
- 前端 auth store 的 isAdmin computed 不变（路由守卫直接消费）。
- CSP / html_render / share / read_tracking 不变。

### 风险在哪

1. **`/admin` 路由顺序**：必须在 `/:slug` 之前，否则 `admin` 被当 slug 匹配到 EntryDetailView。router.ts:6-43 现有顺序 / → /explore → /settings → /users/:username → /:slug → 404，/admin 插在 /settings 之后、/users/:username 之前。
2. **delete_self 破坏性变更**（决策 A）：现有依赖 confirm_username 旁路自删的最后一个 admin 将受影响。CHANGELOG 必须记录（铁律 8）。
3. **admin 计数一致性**：现有 delete_self（api/auth.py:243）count admins 未加 is_active 条件——这是 bug，决策 B 统一修正为 `is_admin=True AND is_active=True`。所有 LastAdmin 检查点（demote/disable/delete + delete_self + CLI）必须用同一 helper 或同一查询，避免分叉。
4. **migration 幂等性**：ALTER TABLE ADD COLUMN 需先 PRAGMA table_info 检查列是否存在（参照现有模式），否则重启报错。
5. **list_users 返回结构变更**：response_model 从 `list[UserResponse]` 改 `UserListResponse`。CLI user list 不走 API（直接查库），不受影响。但需检查是否有其他 API 消费者（grep 确认无）。
6. **CLI demote 补保护是行为变更**：之前可 demote 最后一个 admin，之后不可——属 bug 修复，非破坏性，但 CHANGELOG 建议提及。

## 候选方案

本任务属 `follows_existing_pattern`：
- 后端 admin 端点复用 `require_admin` + `AdminService` 方法 + `request.app.state.admin_service` DI 模式（admin.py:20-71 现有 5 端点）。
- 前端列表复用 `EntryListView` + `Pagination` + `OverflowMenu` + `ConfirmDialog` 模式。
- migration 复用 `_run_migrations` ALTER TABLE 模式。

参照文件：
- `backend/peekview/api/admin.py`（端点模式）
- `backend/peekview/services/admin_service.py:307-359`（list_users/delete_user/reset_password 模式）
- `backend/peekview/database.py:39-157`（migration 模式）
- `frontend-v3/src/views/EntryListView.vue`（列表 + 分页模式）
- `frontend-v3/src/api/client.ts:107-126`（分页 API client 模式）

按 architect.md「设计模式」场景，探索 2 个候选方案（disable/enable/promote/demote 端点形态），权衡后选择。

### 候选方案 A：独立 POST 端点（每操作一端点）

**设计**：
- `POST /api/v1/admin/users/{id}/disable`（可选 body: `{reason?: string}`）
- `POST /api/v1/admin/users/{id}/enable`
- `POST /api/v1/admin/users/{id}/promote`
- `POST /api/v1/admin/users/{id}/demote`

每个端点：`Depends(require_admin)` → 调 `admin_service.<op>_user(user_id, current_user_id=admin.id, ...)` → 返回更新后的 `UserResponse`。

**优点**：
- 语义明确，每个端点单一职责，RESTful 动作语义清晰。
- 与现有 `POST /users/{id}/reset-password` 模式一致（admin.py:61-71）。
- 权限/审计逻辑按操作隔离，disable 记审计字段、promote 不记（或单独记 role_changed）。
- 前端 API client 一一映射，类型清晰。
- LastAdmin/self-operation 检查在 service 层按操作定制（disable/demote/delete 检查，enable/promote 不检查）。

**缺点**：
- 端点数多（4 个新端点），但每个都很薄。
- 无统一 PATCH 端点的"部分更新"灵活性（但本任务不需要 partial update）。

**风险**：低。完全复用现有模式。

### 候选方案 B：统一 PATCH 端点

**设计**：
- `PATCH /api/v1/admin/users/{id}`，body: `{is_active?: bool, is_admin?: bool, reason?: string}`
- 单端点处理所有 toggle，service 层根据 body 字段分发。

**优点**：
- 端点数少（1 个），理论上更 RESTful（资源部分更新）。
- 前端单一 API 方法。

**缺点**：
- 语义模糊：PATCH 同时改 is_active 和 is_admin 时，LastAdmin 检查顺序复杂（先 demote 还是先 disable？两者都触发保护时哪个优先？）。
- 审计字段记录不一致：disable 记 disabled_at，promote 记什么？PATCH 无法区分"disable"和"enable 清空审计"的语义，需额外 flag 字段。
- 与现有 `POST /users/{id}/reset-password` 模式不一致（现有用独立 POST 而非 PATCH）。
- 前端需构造 patch body，类型复杂度上升。
- AGENTS.md 记载"MCP 不暴露 updateEntry 的理由"——PeekView 定位是"发布快照"而非"协作编辑"，partial update 语义不被鼓励。admin 用户管理同理：每个操作是明确的动作（disable/enable/promote/demote），不是字段编辑。
- self-operation / LastAdmin 保护需在 service 层按字段组合判断，逻辑分支爆炸。

**风险**：中。语义复杂度 + 保护逻辑分叉。

### 选择：候选方案 A（独立 POST 端点）

**理由**：
1. follows_existing_pattern：与现有 reset-password 端点模式一致，admin.py 全是独立动作端点。
2. 语义清晰：每个操作是明确动作，符合 PeekView"动作而非编辑"的设计哲学。
3. 保护逻辑简洁：disable/demote/delete 检查 LastAdmin + self-op，enable/promote 不检查，按端点隔离无分叉。
4. 审计字段记录自然：disable 端点记 disabled_at/disabled_by/disabled_reason，enable 端点清空。
5. 前端 API client 一一映射，类型简单。

## 详细设计

### 1. 后端 schema 变更（models.py）

**UserBase 新增审计字段**（models.py:101-108 后追加）：
```
disabled_at: datetime | None = Field(default=None)
disabled_by: int | None = Field(default=None, foreign_key="users.id")
disabled_reason: str | None = Field(default=None, max_length=500)
```
- nullable，旧数据无值正常。
- `disabled_by` 记执行禁用的 admin user_id（非 username，避免改名后失联）。
- enable 时三个字段清空为 None。

**UserResponse 扩展**（models.py:640-648）：
- 新增 `disabled_at: datetime | None`、`disabled_by: int | None`（前端展示禁用时间 + 操作者 ID；操作者 username 前端可不展示或单独查，P1 未要求展示操作者，仅展示 disabled_at 即可满足 BDD-02 disabled 标记）。

**新增 UserListResponse**（参照 EntryListResponse 模式，types/index.ts:43-49 是前端镜像）：
```
class UserListResponse(SQLModel):
    items: list[UserResponse]
    total: int
    page: int
    per_page: int
```

**promote/demote 审计**：P1 §4-1 声明"promote/demote 审计由 P2 评估"。决策：**Phase 1 不纳入 promote/demote 审计字段**（YAGNI）。理由：P1 BDD 无一条要求展示 role 变更历史；disabled_at 已满足"禁用审计"需求；新增 role_changed_at/by 会扩大 schema + migration + 前端展示范围，超出 P1 基线。若未来需要，再补 migration（ALTER TABLE 是增量安全的）。

### 2. migration（database.py:_run_migrations）

在 `_run_migrations` users 表块（:81-98 之后）追加，参照 is_admin 模式：
```
for col, col_type in [("disabled_at", "DATETIME"), ("disabled_by", "INTEGER"), ("disabled_reason", "VARCHAR(500)")]:
    if col not in user_columns:
        conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} {col_type} DEFAULT NULL"))
        conn.commit()
        logger.info(f"Migration: added {col} column to users")
```
- 幂等：PRAGMA table_info 检查后再 ADD。
- check_schema（:172-204）会自动校验 model 与实际列一致，model 字段与 migration 必须同步。

### 3. AdminService 新方法（admin_service.py）

**共享 helper**（模块级或类方法，供 demote/disable/delete 复用）：

`_check_self_operation(admin_id: int, target_id: int, action: str) -> None`：
- `admin_id == target_id` → raise `ValidationError(f"Cannot {action} yourself")`
- 复用现有 delete_user 的自删检查模式（admin_service.py:329）。

`_check_last_active_admin(session, target_user_id: int, action: str) -> None`：
- 查 target user：`session.get(User, target_user_id)`，不存在→`NotFoundError`。
- 若 target `is_admin=True AND is_active=True`：
  - count = `SELECT COUNT(*) FROM users WHERE is_admin=1 AND is_active=1`（决策 B）
  - count == 1 → raise `LastAdminError(f"Cannot {action} the last active admin")`
- 否则（target 非 admin 或已禁用）→ 不触发保护（非最后一个活跃 admin）。

**新方法**：

`disable_user(user_id, current_user_id, reason=None) -> UserResponse`：
1. `_check_self_operation(current_user_id, user_id, "disable")`（BDD-06）
2. session 内：`_check_last_active_admin(session, user_id, "disable")`（BDD-10/23/24）
3. user.is_active=False, disabled_at=now, disabled_by=current_user_id, disabled_reason=reason
4. commit, return UserResponse

`enable_user(user_id) -> UserResponse`：
1. 无 self-op / LastAdmin 检查（启用不破坏）
2. user.is_active=True, disabled_at=None, disabled_by=None, disabled_reason=None
3. commit, return UserResponse

`promote_user(user_id) -> UserResponse`：
1. 无 self-op（允许 admin promote 自己？无意义但无害，is_admin 已 True）— 不检查
2. 无 LastAdmin 检查（promote 增加 admin，不破坏）
3. user.is_admin=True, commit, return UserResponse

`demote_user(user_id, current_user_id) -> UserResponse`：
1. `_check_self_operation(current_user_id, user_id, "demote")`（BDD-20）
2. `_check_last_active_admin(session, user_id, "demote")`（BDD-09/19/23）
3. user.is_admin=False, commit, return UserResponse

**现有方法改造**：

`list_users(username, page, per_page) -> UserListResponse`：
- 查 users + count(total)（参照 listEntries 后端分页模式）
- 返回 `UserListResponse(items=[...], total=total, page=page, per_page=per_page)`
- UserResponse 构造补 disabled_at/disabled_by

`delete_user(user_id, current_user_id)`：
- 现有自删检查保留（:329）
- **新增**：`_check_last_active_admin(session, user_id, "delete")`（BDD-11/21/23）
- LastAdminError 透传到 API 层（admin.py delete_user 端点需 catch LastAdminError 或让它走全局异常处理）

### 4. API 端点（api/admin.py）

新增 4 端点，参照 reset-password 模式（admin.py:61-71）：
```
@router.post("/users/{user_id}/disable")
async def disable_user(user_id, request, admin=Depends(require_admin)) -> UserResponse:
    body: DisableRequest | None  # {reason?: str}
    return admin_service.disable_user(user_id, admin.id, body.reason if body else None)

@router.post("/users/{user_id}/enable")  # 类似
@router.post("/users/{user_id}/promote")  # 类似
@router.post("/users/{user_id}/demote")   # 类似
```
- `list_users` response_model 改 `UserListResponse`
- `delete_user` 端点：LastAdminError 走全局异常处理（已有 status 409），无需特殊 catch；现有 ValueError→ValidationError 保留（self-op）。

**DisableRequest schema**（models.py）：`reason: str | None = Field(default=None, max_length=500)`

### 5. delete_self 改造（api/auth.py:231-251，决策 A）

**改前**（:240-249）：
```python
if current_user.is_admin:
    admin_count = ... select(User).where(User.is_admin.is_(True))  # 未加 is_active
    admin_count = len(...)
    if admin_count == 1 and confirm_username != current_user.username:
        raise LastAdminError(..., details={"confirm_required": True})
admin_service.delete_user(current_user.id, current_user_id=-1)
```

**改后**（绝对拒绝）：
```python
if current_user.is_admin:
    with Session(engine) as s:
        count = s.exec(select(func.count()).where(User.is_admin.is_(True), User.is_active.is_(True))).one()
    if count == 1:  # 最后一个活跃 admin
        raise LastAdminError("Cannot delete the last active admin")
admin_service.delete_user(current_user.id, current_user_id=-1)
```
- 移除 `confirm_username` 参数（Query 删除）— **破坏性变更**，CHANGELOG 记录。
- admin 计数加 `is_active=True`（决策 B，修 bug）。
- `current_user_id=-1` 绕过 delete_user 自删检查（delete_self 是合法自删，但受 LastAdmin 保护）。

### 6. CLI 改造（cli.py user 命令组）

**新增 disable/enable 子命令**（参照 promote/demote 模式 :1579-1620）：
```
@user_cmd.command(name="disable")
@click.argument("username")
@click.option("--reason", "-r", default=None, help="Disable reason")
def user_disable(username, reason):
    config = PeekConfig(); engine = init_db(config.db_path); check_schema(engine)
    with Session(engine) as session:
        user = session.exec(select(User).where(User.username == username)).first()
        if not user: error exit
        # LastAdmin 检查（本地复算或调共享 helper）
        if user.is_admin and user.is_active:
            count = session.exec(select(func.count()).where(User.is_admin==True, User.is_active==True)).one()
            if count == 1: click.echo("Error: last active admin"); sys.exit(1)
        user.is_active = False; user.disabled_at = now; user.disabled_by = None  # CLI 无 admin id
        session.commit()
    click.echo(f"✓ Disabled {username}")
```
- CLI 无 current_user_id（非交互 admin 上下文），disabled_by 记 None（CLI 操作标记）。
- enable 类似，清空审计字段。
- 注意：`make debug` 下 PeekConfig() 自动隔离到 /tmp/peekview-debug/（PEEKVIEW_DEBUG_MODE）。

**demote 补 LastAdmin 保护**（:1601-1620）：
- 在 `user.is_admin = False` 前，加 LastAdmin 检查（count is_admin AND is_active == 1 → refuse）。
- 无 self-op 检查（CLI 无 current_user 上下文，且 CLI demote 自己属管理员有意操作，LastAdmin 已兜底）。

**delete（local 模式）补 LastAdmin 保护**：
- user_delete local 分支（:1646+）在删除前加 LastAdmin 检查。

**注意**：共享 helper `_check_last_active_admin` 在 AdminService 类内，CLI 直接用 Session 不走 service。决策：CLI 本地复算 count（3 行 SQL），不强行复用 service helper（避免 CLI 依赖 service 层）。逻辑一致性靠 P3 测试覆盖（BDD-19/24）。

### 7. 前端设计

**router.ts**：
- 新增 route（插在 /settings 块之后、/users/:username 之前）：
```
{
  path: '/admin',
  name: 'admin',
  component: () => import('./views/AdminView.vue'),
  meta: { requiresAdmin: true },
}
```
- beforeEach 扩展（:75-86，建议修 8 显式声明顺序）：

现有 beforeEach（router.ts:75-86）结构：`authState === 'loading'` 时 `await waitForAuthInit(authStore, 5000)`，然后处理 `/` 和 `/settings`。requiresAdmin 检查**必须在此 waitForAuthInit 之后追加**，复用现有 loading 等待逻辑，避免 authState=loading 时误判未登录跳 `/`。

修订后 beforeEach 完整逻辑：
```
router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  if (authStore.authState === 'loading') {
    await waitForAuthInit(authStore, 5000)  // 现有逻辑，必须先等 auth 初始化
  }
  if (to.path === '/') {
    if (authStore.authState === 'authenticated') return '/explore'
  }
  if (to.path === '/settings') {
    if (authStore.authState !== 'authenticated') return '/'
  }
  // 新增：requiresAdmin 检查（在 waitForAuthInit 之后，authState 已确定）
  if (to.meta.requiresAdmin) {
    if (authStore.authState !== 'authenticated') return '/'
    if (!authStore.isAdmin) return '/explore'  // 决策 3：非 admin 跳 /explore
  }
})
```
- 关键：requiresAdmin 块在 waitForAuthInit 之后，此时 authState 已从 loading 转为 authenticated/unauthenticated，不会误跳。实现者不得将 requiresAdmin 检查抽成独立 beforeEach 或放在 waitForAuthInit 之前。
- 路由顺序：/admin 必须在 /:slug 之前（已确保，因 /admin 插在 /users/:username 前，而 /:slug 在其后）。

**AdminView.vue**（参照 EntryListView 列表 + 分页模式）：
- 状态：users ref, page, perPage=20, total, loading, error
- 挂载/分页变化调 `api.listUsers({page, perPage})` → {items, total, page, perPage}
- 列表渲染：每行 username + displayName + BaseBadge(active/disabled/admin) + OverflowMenu
- OverflowMenu variant 响应式切换（建议修 6）：`<OverflowMenu :variant="isMobile ? 'sheet' : 'dropdown'" :items="menuItems" />`，`isMobile` 来自 `useResponsiveLayout()`（useResponsiveLayout.ts:21，viewportWidth<=640）。参照 DESIGN §9 "dropdown on desktop, bottom sheet on mobile"。
- OverflowMenu items：
  - 禁用/启用（根据 isActive 切换）
  - Promote/Demote（根据 isAdmin 切换）
  - 重置密码 → 打开 PasswordResetDialog（见下，不复用 ConfirmDialog）
  - 删除（variant: 'danger'）→ 打开 ConfirmDialog 确认
- 操作 in-flight 禁用防重复点击（建议修 4）：每个操作维护 `pendingOp: Ref<string | null>`（如 `'disable'`/`'delete'`），操作发起时置值、响应后清空。OverflowMenu 触发器 `:disabled="!!pendingOp"`（全局禁用，防止操作中打开另一个菜单）；当前操作对应的菜单项 `:disabled="item.actionKey === pendingOp"`（或 items 构造时按 pendingOp 标记 disabled）。参照 OverflowMenu.vue:4-16 触发器 button 支持 disabled 属性。
- 列表 loading/error/empty 状态 UI（建议修 3，参照 EntryListView.vue:98/118/122 模式）：
  - `loading=true` → `<div class="loading-state" role="status" aria-live="polite">加载中...</div>`（或 skeleton rows，参照 EntryListView.vue:98-112）
  - `error` 非空（列表初次加载失败，如 403/500）→ `<div class="error-state">{{ error }} <button @click="fetchUsers">重试</button></div>`（参照 EntryListView.vue:118-120）
  - 列表空（users.length === 0 且非 loading/error）→ `<EmptyState icon="Users" heading="暂无用户" />`（参照 EntryListView.vue:122-126 EmptyState 组件）
  - 注意：`error` ref 仅用于列表加载失败；操作失败（disable/delete 等）走 toast，不写 error ref，避免列表 error-state 误显。
- 分页边界（建议修 5）：删除/禁用后刷新列表时，若当前 page 的数据已空（如第 2 页删除唯一用户后 total 变化导致该页无数据），回退 `page.value = Math.max(1, page.value - 1)` 后重新 fetch。参照 EntryListView 分页 state 管理（EntryListView.vue:152-156）。或更简单：删除后重新计算 `totalPages = Math.ceil(total / perPage)`，若 `page > totalPages` 则 `page = totalPages` 再 fetch。
- /admin 移动端列表布局（建议修 7）：移动端（isMobile）列表单列，每行布局 `username + BaseBadge 一行 + OverflowMenu 触发器右对齐`。参照 DESIGN §9 "Multi-column grids collapse to 1 column on mobile"。CSS：`flex-direction: row; align-items: center; justify-content: space-between;`，username/badge 块 `flex: 1`，OverflowMenu 固定右侧。桌面端可双列（username+displayName 左，badge 中，OverflowMenu 右）。
- 分页移动端形态：复用 Pagination 组件（参照 EntryListView），移动端表现同 EntryListView（Pagination 组件自身已适配），无需额外处理。
- 操作后刷新列表（或本地更新对应 user）
- 错误处理：toast（useToast），LastAdmin/self-op 错误显示后端 message
- 焦点恢复：复用 OverflowMenu 现有 close() 焦点恢复机制（OverflowMenu.vue:116-119 `triggerRef.value?.focus()`），无需额外代码。spec 显式声明以避免实现者误改。

**PasswordResetDialog.vue**（新建组件，BLOCKER BDD-12，不复用 ConfirmDialog）：

不复用 ConfirmDialog 的理由：ConfirmDialog props 只有 title/message/confirmLabel/variant（ConfirmDialog.vue:30-35），无 input/slot 机制；密码输入是表单交互（需校验、show/hide、disabled 联动），语义与确认弹窗（二元选择）不同。强行扩展 ConfirmDialog 加 input slot 会破坏其单一确认语义。

组件 spec：
- Props: `visible: boolean`（v-model）, `username: string`（展示"重置 {username} 的密码"）
- Emits: `confirm(newPassword: string)`, `cancel`
- 结构（参照 ConfirmDialog alertdialog + focus 模式，ConfirmDialog.vue:1-61）：
  - `<Teleport to="body">` + `<Transition name="dialog">` + overlay（`@click.self="cancel"`）
  - `<div role="alertdialog" aria-labelledby="pwd-title" aria-describedby="pwd-desc">`
  - 标题 `<h3 id="pwd-title">重置密码</h3>`
  - 描述 `<p id="pwd-desc">为用户 {username} 设置新密码</p>`
  - `<label for="pwd-input">新密码</label>` + `<input id="pwd-input" type="password" v-model="password" :aria-invalid="error ? 'true' : undefined" :aria-describedby="error ? 'pwd-error' : undefined" autocomplete="new-password" />`
  - show/hide toggle 按钮：`<button type="button" @click="showPwd = !showPwd" :aria-label="showPwd ? '隐藏密码' : '显示密码'">{{ showPwd ? '🙈' : '👁' }}</button>`，toggle 时 input `:type="showPwd ? 'text' : 'password'"`
  - 长度校验：`password.length > 0 && password.length < 8` → 显示 `<p id="pwd-error" class="pwd-error">密码至少 8 个字符</p>`（对齐 ResetPasswordRequest min_length=8，models.py:756）
  - 确认按钮 `<button :disabled="password.length < 8" @click="confirm">确认</button>`（密码为空或 <8 字符时 disabled）
  - 取消按钮 `<button @click="cancel">取消</button>`
- focus management（参照 ConfirmDialog.vue:45-49）：`watch(visible, async (v) => { if (v) { password.value = ''; await nextTick(); pwdInputRef.value?.focus() } })`——打开时清空输入并聚焦 password input（非 cancel 按钮，因主交互是输入）
- 移动端键盘弹起保持可见：弹窗容器用 `max-height: 90vh; overflow-y: auto;` + `margin: auto`（flex center 在键盘弹起时自动收缩）。参照 ConfirmDialog.vue:79-80 `max-width: 400px; width: 90%`，补 `max-height` + `overflow-y`。或用 `100dvh` viewport 单位（dynamic viewport height，键盘弹起时自动调整）。
- confirm 逻辑：`emit('confirm', password)` 后 AdminView 调 `api.resetUserPassword(id, password)`，成功 toast"密码已重置"，失败 toast 显示后端 message，最后关闭弹窗（密码重置不改变列表数据，可不刷新列表）。

**ConfirmDialog 文案 spec**（建议修 2，删除/禁用两组；重置密码改用 PasswordResetDialog 不走 ConfirmDialog）：

删除用户（破坏性）：
- title: `删除用户 {username}？`
- message: `此操作不可撤销，将删除该用户及其所有 entries、files、API keys。`
- confirmLabel: `删除`
- variant: `destructive`

禁用用户（非破坏性，但需确认）：
- title: `禁用用户 {username}？`
- message: `该用户将被禁用，无法登录。已签发的 JWT 即时失效。可随时重新启用。`
- confirmLabel: `禁用`
- variant: `destructive`

（promote/demote/enable 为非破坏性直接执行 + toast 反馈，不走 ConfirmDialog。）

**api/client.ts**：
- transformUser 扩展 `disabledAt: user.disabled_at`
- 新增方法：
  - `listUsers(params?: {page?, perPage?, username?}): Promise<UserListResponse>`
  - `disableUser(id, reason?): Promise<User>`
  - `enableUser(id): Promise<User>`
  - `promoteUser(id): Promise<User>`
  - `demoteUser(id): Promise<User>`
  - `resetUserPassword(id, newPassword): Promise<{newPassword: string}>`（现有后端返回 {new_password}）
  - `deleteUser(id): Promise<void>`

**types/index.ts**：
- User 扩展 `disabledAt: string | null`
- 新增 `UserListResponse { items: User[]; total: number; page: number; perPage: number }`

**BaseBadge.vue**：
- 新增 `disabled` variant（灰色/警告色，参照 archived 色调但区分）
- 新增 `admin` variant（对齐 DESIGN §6:212 "admin badge pill when is_admin"）
- status prop 类型扩展：`'public'|'private'|'shared'|'archived'|'expired'|'disabled'|'admin'`

**Toast.vue aria-live 声明**（建议修 9）：

现状：Toast.vue:2 toast 容器 `<div class="toast-container" aria-live="polite">`——所有 toast 都用 polite。问题：error toast（如 LastAdmin 拒绝、删除失败）用 polite 会被屏幕阅读器低优先级播报，用户可能错过关键错误。

修订 spec：
- Toast.vue 容器改为按 toast variant 动态设置 aria-live：error toast `aria-live="assertive"`，success/warning toast `aria-live="polite"`。
- 实现：容器级无法按 toast 区分（aria-live 是容器属性），改为每个 toast item 自带 aria-live：
  ```
  <div v-for="toast in messages" :key="toast.id"
       :aria-live="toast.variant === 'error' ? 'assertive' : 'polite'"
       role="status">
    {{ toast.message }}
  </div>
  ```
  容器 `aria-live` 可移除（移到 item 级），或容器保留 `aria-live="polite"` 作为默认，error item 覆盖为 assertive。
- useToast.ts（:3-8 ToastMessage 接口）不变，variant 字段已区分 success/warning/error，前端渲染时按 variant 映射 aria-live。
- AdminView 所有操作错误（disable/enable/promote/demote/delete/resetPassword 失败）走 `toast.error(message)` → 自动 assertive；成功走 `toast.success(message)` → polite。

## BDD 覆盖映射（24 条）

| BDD | 覆盖组件 |
|-----|---------|
| BDD-01 列表分页 | AdminView + listUsers + Pagination + UserListResponse |
| BDD-02 状态标记 | AdminView + BaseBadge(disabled/admin) + UserResponse.disabled_at |
| BDD-03 禁用后无法登录 | disable_user + get_current_user:177 软失效 |
| BDD-04 禁用后 JWT 失效 | get_current_user:177（现有机制，无需新代码） |
| BDD-05 启用后可登录 | enable_user |
| BDD-06 不能禁用自己 | _check_self_operation in disable_user |
| BDD-07 promote | promote_user + AdminView OverflowMenu |
| BDD-08 demote 另一 admin | demote_user |
| BDD-09 最后admin不能demote | _check_last_active_admin in demote_user |
| BDD-10 最后admin不能disable | _check_last_active_admin in disable_user |
| BDD-11 最后admin不能删除 | _check_last_active_admin in delete_user + delete_self 改造 |
| BDD-12 重置密码 | reset_password（现有）+ AdminView PasswordResetDialog（新建，password input + show/hide + ≥8 校验 + 确认 disabled + alertdialog role + focus） |
| BDD-13 删除级联 | delete_user（现有级联）+ AdminView ConfirmDialog（文案 spec 见 §7，destructive alertdialog） |
| BDD-14 非admin访问/admin拒绝 | router beforeEach + isAdmin（requiresAdmin 检查在 waitForAuthInit 之后） |
| BDD-15 未登录访问/admin拒绝 | router beforeEach + authState（waitForAuthInit 先于 requiresAdmin 检查，避免 loading 误跳） |
| BDD-16 后端403 | require_admin（现有，新端点复用） |
| BDD-17 CLI disable | cli user disable |
| BDD-18 CLI enable | cli user enable |
| BDD-19 CLI demote LastAdmin | cli user demote 补保护 |
| BDD-20 不能demote自己 | _check_self_operation in demote_user |
| BDD-21 不能删除自己 | delete_user 现有自删检查（admin.py delete_user 端点） |
| BDD-22 2admin禁用成功 | disable_user（LastAdmin count=2 时不拒绝） |
| BDD-23 禁用后剩余唯一admin受保护 | _check_last_active_admin（count=1 时拒绝） |
| BDD-24 CLI disable LastAdmin | cli user disable 补保护 |

## 8 个 CONFIRMED 决策落地

1. ✅ 审计字段 disabled_at/disabled_by/disabled_reason → UserBase + migration（§1/§2）
2. ✅ LastAdmin 补齐 demote/disable/delete → _check_last_active_admin helper（§3）
3. ✅ 非 admin /admin 跳 /explore → router beforeEach（§7）
4. ✅ list_users 改 {items,total,page,per_page} → UserListResponse（§1/§3/§4）
5. ✅ reset_password min_length=8 对齐 → models.py:756 已确认（§1）
6. ✅ 前端 OverflowMenu → AdminView 每行 OverflowMenu（§7）
7. ✅ 决策 A 移除 confirm_username 旁路 → delete_self 改造（§5）
8. ✅ 决策 B admin 计数 = is_admin AND is_active → _check_last_active_admin + delete_self（§3/§5）

## files_to_read（实现导航）

```yaml
files_to_read:
  - path: backend/peekview/api/admin.py
    why: 端点模式参照（require_admin DI + admin_service 调用 + 错误透传），新增 4 toggle 端点 + list_users response_model 改造
  - path: backend/peekview/services/admin_service.py:307-359
    why: list_users/delete_user/reset_password 现有实现，新增 toggle 方法 + helper + list_users 改返回结构
  - path: backend/peekview/models.py:101-145
    why: UserBase/User 模型，新增审计字段；UserResponse:640-648 扩展；新增 UserListResponse
  - path: backend/peekview/models.py:755-756
    why: ResetPasswordRequest min_length=8 已确认对齐
  - path: backend/peekview/database.py:39-157
    why: _run_migrations 模式，新增 users 表审计字段 migration
  - path: backend/peekview/auth.py:164-217
    why: get_current_user 软失效机制（BDD-04）+ require_admin（BDD-16），新端点复用
  - path: backend/peekview/api/auth.py:231-251
    why: delete_self confirm_username 旁路移除（决策 A）+ admin 计数加 is_active（决策 B）
  - path: backend/peekview/exceptions.py:237-252
    why: LastAdminError(409) + ForbiddenError(403) + ValidationError(400) 复用
  - path: backend/peekview/cli.py:1480-1620
    why: user 命令组模式，新增 disable/enable + demote 补 LastAdmin
  - path: frontend-v3/src/router.ts:60-88
    why: 新增 /admin route + beforeEach 守卫（waitForAuthInit 顺序参照，requiresAdmin 检查须在 waitForAuthInit 之后）
  - path: frontend-v3/src/stores/auth.ts:11-17
    why: isAdmin computed + authState + initializing，路由守卫消费
  - path: frontend-v3/src/api/client.ts:94-126
    why: transformUser + listEntries 分页 API client 模式参照，新增 admin API 方法组
  - path: frontend-v3/src/types/index.ts:43-49,103-110
    why: EntryListResponse 分页结构模板 + User 接口扩展
  - path: frontend-v3/src/components/OverflowMenu.vue:76-119,132-139
    why: OverflowMenuItem 接口（variant: default|danger, action）+ variant prop（dropdown|sheet）+ close() 焦点恢复（:116-119）+ Escape/Tab 关闭（:132-139），AdminView 操作菜单
  - path: frontend-v3/src/components/ConfirmDialog.vue:1-61
    why: PasswordResetDialog 参照——alertdialog role + aria-labelledby/describedby（:7-9）+ Teleport/Transition + focus management（:45-49 watch visible→focus）+ overlay @click.self cancel + max-width/width 移动端适配（:79-80）
  - path: frontend-v3/src/components/Pagination.vue:1-60
    why: Pagination props(page,perPage,total) + v-model:page，AdminView 分页
  - path: frontend-v3/src/components/BaseBadge.vue
    why: 新增 disabled + admin variant
  - path: frontend-v3/src/components/Toast.vue:1-30
    why: toast 容器 aria-live 现状（:2 polite），改为按 toast variant 动态（error=assertive, 其他=polite），item 级 aria-live
  - path: frontend-v3/src/composables/useResponsiveLayout.ts:1-67
    why: isMobile computed（:21 viewportWidth<=640），OverflowMenu variant 响应式切换 + 移动端布局判断
  - path: frontend-v3/src/composables/useToast.ts:1-38
    why: ToastMessage 接口（variant: success|warning|error）+ show/success/error 方法，AdminView 操作反馈
  - path: frontend-v3/src/views/EntryListView.vue:98-126,152-156,236,253,411
    why: 列表 loading-state（:98 role=status）+ error-state（:118-120）+ EmptyState（:122-126）+ Pagination + 分页 state 管理模式参照
  - path: DESIGN.md:149-213
    why: §6 组件规则（OverflowMenu/ConfirmDialog/BaseBadge/admin badge pill）+ §9 移动端（dropdown/sheet 切换、单列布局）
```

## 实现完成的标志

1. 后端：`make debug-start` 后 `curl POST /api/v1/admin/users/{id}/disable` 返回 UserResponse(is_active=False, disabled_at set)；非 admin 调用返回 403；最后一个活跃 admin disable/demote/delete 返回 409。
2. CLI：`peekview user disable <username>` 成功；`peekview user demote <last_admin>` 报错拒绝。
3. 前端：`make build-frontend` + 访问 /admin（admin 登录）显示用户列表 + 分页 + OverflowMenu 操作；列表 loading/error/empty 状态正确；非 admin 访问 /admin 跳 /explore；未登录跳 /；重置密码打开 PasswordResetDialog（input + show/hide + <8 字符确认 disabled + alertdialog role）；删除/禁用打开 ConfirmDialog（文案 spec 正确）；操作 in-flight 按钮禁用；移动端 OverflowMenu sheet variant + 单列布局；toast error aria-live=assertive。
4. delete_self：最后一个活跃 admin DELETE /api/v1/auth/me 返回 409（无论是否带 confirm_username）。
5. `make test-quick && make test-frontend && make typecheck` 全绿。
6. `make debug-test`（Playwright）覆盖 BDD-01/02/03/05/06/07/08/12/13/14/15。BDD-12 验证 PasswordResetDialog 密码输入 + ≥8 校验 + 确认按钮 disabled 联动；BDD-13 验证 ConfirmDialog destructive 文案 + alertdialog role；BDD-14/15 验证路由守卫（含 waitForAuthInit 顺序，authState=loading 不误跳）。
7. CHANGELOG 记录 delete_self 破坏性变更（confirm_username 旁路移除）。

## [SCOPE+] 检查

无。P2 设计中未发现 P1 未预见的必须做的事。所有 8 CONFIRMED 决策已落地，24 BDD 已覆盖。
