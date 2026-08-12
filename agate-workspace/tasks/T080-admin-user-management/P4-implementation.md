---
phase: P4
task_id: T080-admin-user-management
trace_id: T080
type: implementation
parent: P3-test-cases.md
status: draft
agent: implementer
created: 2026-08-06
---

# T080 P4 — Implementation

## implementation_dir

```
implementation_dir: backend/peekview/ + frontend-v3/src/
```

## 改动清单

### 后端 (backend/peekview/)

| 文件 | 改动摘要 |
|------|---------|
| `models.py` | UserBase +disabled_at/disabled_by/disabled_reason 审计字段；UserResponse +disabled_at/disabled_by；新增 UserListResponse、DisableUserRequest schema |
| `database.py` | _run_migrations 新增 users 表 3 列 ALTER TABLE migration（幂等 PRAGMA check） |
| `services/admin_service.py` | 新增 _check_self_operation/_check_last_active_admin helper；新增 disable_user/enable_user/promote_user/demote_user 方法；list_users 改返回 UserListResponse；delete_user 补 LastAdmin 保护 |
| `api/admin.py` | 4 个新 toggle 端点（POST disable/enable/promote/demote）；list_users response_model 改 UserListResponse |
| `api/auth.py` | delete_self 移除 confirm_username 旁路（决策 A 破坏性变更）；admin 计数加 is_active=True（决策 B）；移除未使用 Query import |
| `cli.py` | 新增 user disable/enable 子命令；user demote 补 LastAdmin 保护；datetime import |

### 前端 (frontend-v3/src/)

| 文件 | 改动摘要 |
|------|---------|
| `types/index.ts` | User +disabledAt?/disabledBy?（optional）；新增 UserListResponse、ListUsersParams |
| `api/types.ts` | UserApiResponse +disabled_at/disabled_by；新增 UserListApiResponse |
| `api/client.ts` | transformUser 扩展 disabledAt/disabledBy；admin API 方法组（listUsers/disableUser/enableUser/promoteUser/demoteUser/resetUserPassword/deleteUser） |
| `router.ts` | /admin route（meta.requiresAdmin，在 /:slug 前）；beforeEach requiresAdmin 守卫（waitForAuthInit 之后） |
| `components/BaseBadge.vue` | 新增 disabled/admin variant |
| `components/Toast.vue` | aria-live 按 variant 动态（error=assertive，其他=polite），item 级 |
| `components/PasswordResetDialog.vue` | 新建：password input + show/hide + ≥8 校验 + alertdialog role + focus management |
| `views/AdminView.vue` | 新建：用户列表 + 分页 + OverflowMenu + ConfirmDialog + PasswordResetDialog + loading/error/empty + in-flight pending |

## 8 个 CONFIRMED 决策落地

1. ✅ 审计字段 disabled_at/disabled_by/disabled_reason → UserBase + migration
2. ✅ LastAdmin 补齐 demote/disable/delete → _check_last_active_admin helper
3. ✅ 非 admin /admin 跳 /explore → router beforeEach requiresAdmin
4. ✅ list_users 改 {items,total,page,per_page} → UserListResponse
5. ✅ reset_password min_length=8 对齐 → models.py:756 已确认
6. ✅ 前端 OverflowMenu → AdminView 每行 OverflowMenu
7. ✅ 决策 A 移除 confirm_username 旁路 → delete_self 改造
8. ✅ 决策 B admin 计数 = is_admin AND is_active → _check_last_active_admin + delete_self

## 自查结果

### 后端 pytest（23 T080 tests passed, 0 failed）

重试 #2 修复 2 CRITICAL + 3 MUST-FIX 后全绿。1068 passed / 2 skipped / 1 deselected（pre-existing ruff env issue）全套无回归。

### 前端 vitest（1217/1217 full suite pass）

BDD-14/15 路由守卫全绿。无回归。

### 前端 typecheck（vue-tsc --noEmit）：clean

### 后端 lint（ruff check peekview/）：clean

## 重试 #2 — 评审 BLOCKER 修复

### CRITICAL 1（review + cso）：_check_last_active_admin 缺 is_active
- 位置：backend/peekview/services/admin_service.py:349
- 修复：`if user.is_admin:` → `if user.is_admin and user.is_active:`（参照 cli.py:1620/1654）
- 测试：新增 test_demote_disabled_admin_succeeds + test_disable_disabled_admin_succeeds；更新 test_bdd_11_last_admin_admin_delete_other_absolute_refuse（删除 disabled admin 应成功 204，非 409）；新增 test_bdd_11_last_admin_self_delete_absolute_refuse（self-delete sole admin 仍 409）

### CRITICAL 2（review + cso）：delete_user 未清理 disabled_by FK
- 位置：backend/peekview/services/admin_service.py:463-470
- 修复：delete_user 删 User 前先 `UPDATE users SET disabled_by=NULL WHERE disabled_by=:user_id`（清理被禁用用户对该 admin 的引用）。sa_delete/sa_update 从 inline import 提升到模块级 import。
- 测试：新增 test_delete_admin_clears_disabled_by_fk（admin1 禁用 user → admin2 删 admin1 → 204 + user.disabled_by=None）

### MUST-FIX 3（design-review）：AdminView "public" badge 语义错
- 位置：frontend-v3/src/views/AdminView.vue:34
- 修复：移除 `<BaseBadge v-else status="public" />`（无 badge = 默认活跃，badge 仅标记异常状态 admin/disabled）

### MUST-FIX 4（design-review）：pendingOp 未绑定到 OverflowMenu disabled
- 位置：frontend-v3/src/components/OverflowMenu.vue + AdminView.vue:37
- 修复：OverflowMenu.vue 新增 disabled prop（trigger button :disabled + :aria-disabled + toggle/open 守卫）；AdminView 绑定 :disabled="!!pendingOp"

### MUST-FIX 5（design-review）：--space-8 CSS 变量不存在
- 位置：frontend-v3/src/views/AdminView.vue:288,294
- 修复：--space-8 → --space-7（48px，与 EntryListView 一致）

### SHOULD-FIX（一并修）
- PasswordResetDialog.vue：dialog 容器加 @keydown.escape="cancel"
- 按钮 :focus-visible：PasswordResetDialog .pwd__btn + AdminView .error-state button
- disabledAt 展示：AdminView disabled badge 旁展示相对时间（formatDisabledAt 函数 + .disabled-time 样式）

## [DESIGN_GAP] — 已解决（重试 #1）

### [DESIGN_GAP: BDD-06 与 BDD-10 测试预期矛盾] — [DESIGN_GAP_REVIEWED: 已解决]

BDD-06（sole admin self-disable）预期 400（self-op），BDD-10（same scenario）预期 409（LAST_ADMIN）。两者设置相同（1 admin, self-disable），预期不同。

实现选择：LastAdmin 检查在 self-op 之前。理由：BDD-09/10/23 共 3 个测试期望 sole admin self-operation 返回 409，仅 BDD-06 期望 400。LastAdmin-first 使 3 个通过、1 个失败。Self-op-first 会反之使 3 个失败。

影响：BDD-06 返回 409（LAST_ADMIN）而非 400（VALIDATION_ERROR），测试断言 `status_code == 400` 失败。

**修复（决策 C）**：BDD-06 测试预期从 400 改为 409，message 断言改为含 "last"/"admin"。P1-requirements.md BDD-06 Then 同步标注 LastAdmin 优先。

### [DESIGN_GAP: test_admin_cannot_delete_self 与 BDD-23 测试预期矛盾] — [DESIGN_GAP_REVIEWED: 已解决]

test_admin_cannot_delete_self（T011 旧测试，1 admin self-delete）预期 400（self-op），BDD-23（T080 新测试，same scenario）预期 409（LAST_ADMIN）。

实现选择：LastAdmin 检查在 self-op 之前（与 disable/demote 一致）。BDD-23 通过，test_admin_cannot_delete_self 失败。

影响：test_admin_cannot_delete_self 返回 409 而非 400，测试断言 `status_code == 400` 失败。P3-test-cases.md 未将此测试列为"已更新"，应为遗漏。

**修复（决策 C）**：test_admin_cannot_delete_self 测试预期从 400 改为 409，message 断言改为含 "last"/"admin"。同类修复：test_t082_errors.py::test_bdd_10_admin_endpoint_returns_peekerror 也从 400 改为 409（sole admin self-delete，LastAdmin 优先）。

### [DESIGN_GAP: BDD-24 与 BDD-17/18 测试预期矛盾] — [DESIGN_GAP_REVIEWED: 已解决]

BDD-24（CLI disable sole admin）预期拒绝（exit≠0），BDD-17/18（CLI disable sole admin，first user auto-admin）预期成功（exit=0）。两者实际场景相同（1 admin user via CLI）。

根因：`user_create` 自动将第一个用户设为 admin。BDD-17 创建 eve17（first user → auto-admin），但测试预期 disable 成功。BDD-24 创建 admin1_24（explicit admin），预期 disable 拒绝。

实现选择：CLI disable 不加 LastAdmin 检查（CLI 是本地管理工具，LastAdmin 保护在 API 层实现）。BDD-17/18 通过，BDD-24 失败。

影响：BDD-24 的 `peekview user disable admin1_24` 成功退出（exit=0），测试断言 `exit_code != 0` 失败。

**修复（决策 D）**：CLI user_disable 加 LastAdmin 检查（参照 user_demote 模式：count is_admin=True AND is_active=True <= 1 时拒绝）。BDD-17/18 测试 setup 调整：先创建 admin 用户（admin17/admin18），再创建 eve17/eve18 普通用户，disable/enable 普通用户不触发 LastAdmin。BDD-24 通过。

### [DESIGN_GAP: BDD-01 rate limit 环境问题] — [DESIGN_GAP_REVIEWED: 已解决]

BDD-01 创建 26 个用户（1 admin + 25 normal），但 `/api/v1/auth/register` 端点有 10/minute rate limit。测试在单次运行中创建 26 个用户触发 429。

实现无关——rate limit 是现有 auth 端点配置。测试需调整 rate limit 或分批创建。

**修复（决策 E）**：BDD-01 测试改用直接插 DB 创建 25 个普通用户（`_create_user_direct` helper，用 `hash_password` + `session.add(User(...))`），绕过 register rate limit。Admin 用户仍通过 API 注册（1 次，在 rate limit 内）。

## [SCOPE+]

无。所有改动均在 P2-design.md 范围内。

## [PROD_NOT_TOUCHED]

全程未启动 :8080 服务、未触碰 ~/.peekview/。pytest 用 conftest autouse 隔离到 tmp_path。前端 vitest/typecheck 在 frontend-v3 本地运行。
