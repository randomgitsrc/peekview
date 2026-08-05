---
phase: P3
task_id: T080-admin-user-management
trace_id: T080
type: test-cases
parent: P2-design.md
status: draft
agent: test-designer
created: 2026-08-06
---

# T080 P3 — 测试用例清单

## test_code_dir 声明

```yaml
test_code_dir:
  backend_pytest:
    - backend/tests/test_t080_admin_user_mgmt.py      # BDD-01/02/03/04/05/06/07/08/09/10/11/12/13/16/20/21/22/23
    - backend/tests/test_t080_cli_user_disable.py      # BDD-17/18/19/24
    - backend/tests/test_admin_user_api.py             # UPDATED: BDD-11 absolute refuse + list_users structure
  frontend_vitest:
    - frontend-v3/src/__tests__/t080-admin-route-guard.test.ts  # BDD-14/15
  frontend_e2e:
    - frontend-v3/e2e/admin.spec.ts                    # BDD-01/02/06/12/14/15/20/21 (multi viewport)
evidences_dir: docs/tasks/T080-admin-user-management/evidences/
```

## 红灯状态

- 后端 pytest: 22 failed, 11 passed — B 类红灯（405 Method Not Allowed / assertion 204!=409 / CLI No such command），无 A 类 syntax/import 错误
- BDD-12 后端测试通过（reset-password 端点已存在，属现有行为回归）— BDD-12 的 TDD 红灯由 E2E 承担（PasswordResetDialog 未实现）
- 前端 vitest: 预期 B 类红灯（路由守卫 requiresAdmin 逻辑未实现）
- Playwright E2E: 预期 B 类红灯（/admin 路由 + AdminView 组件未实现）— P3 阶段可接受

## 24 BDD 测试用例映射

### 后端 pytest — backend/tests/test_t080_admin_user_mgmt.py

| BDD | 测试函数 | 预期（实现后） | 当前红灯类型 |
|-----|---------|--------------|-------------|
| BDD-01 | `test_bdd_01_list_users_returns_paginated_structure` | GET /admin/users?page=1&per_page=20 返回 {items:20, total:26, page:1, per_page:20}；page=2 返回 items:6 | assertion（当前返回 list 非 dict，data["items"] KeyError） |
| BDD-02 | `test_bdd_02_disable_sets_disabled_at_audit_field` | disable 后 UserResponse.is_active=False 且 disabled_at 非 null | assertion（405 + disabled_at None） |
| BDD-03 | `test_bdd_03_admin_disable_user_cannot_login` | POST disable → 200 is_active=False；alice login → 401 | 405 Method Not Allowed |
| BDD-04 | `test_bdd_04_disabled_user_jwt_soft_invalidated` | disable 前 GET /auth/me → 200；disable 后 GET /auth/me → 401 | 405 |
| BDD-05 | `test_bdd_05_admin_enable_user_can_login` | POST enable → 200 is_active=True；login → 200 access_token | 405 |
| BDD-06 | `test_bdd_06_admin_cannot_disable_self` | POST disable self → 400 message 含 self/yourself；DB is_active=True | 405 |
| BDD-07 | `test_bdd_07_admin_promote_user` | POST promote → 200 is_admin=True；DB is_admin=True | 405 |
| BDD-08 | `test_bdd_08_admin_demote_another_admin` | POST demote → 200 is_admin=False；demoted admin GET /admin/stats → 403 | 405 |
| BDD-09 | `test_bdd_09_last_active_admin_cannot_demote` | POST demote self（唯一 admin）→ 409 LAST_ADMIN；DB is_admin=True | 405 |
| BDD-10 | `test_bdd_10_last_active_admin_cannot_disable` | POST disable self（唯一 admin）→ 409 LAST_ADMIN；DB is_active=True | 405 |
| BDD-11a | `test_bdd_11_last_admin_delete_self_absolute_refuse` | DELETE /auth/me 无 confirm → 409；有 confirm → 409；DB user 仍存在 | assertion 204!=409（旧 confirm_username 旁路） |
| BDD-11b | `test_bdd_11_last_admin_admin_delete_other_absolute_refuse` | admin 删唯一活跃 admin（adminB disabled）→ 409 LAST_ADMIN | assertion（delete_user 无 LastAdmin 保护） |
| BDD-12 | `test_bdd_12_admin_reset_password` | POST reset-password → 200/204；new password login 200；old password login 401 | 通过（端点已存在） |
| BDD-13 | `test_bdd_13_admin_delete_user_cascade` | DELETE → 204；entries 404；login 401；list 不含 dave | 通过（级联已存在）+ list 结构变更 |
| BDD-16 | `test_bdd_16_non_admin_admin_endpoints_403` | 8 个 admin 端点（含新 disable/enable/promote/demote）非 admin → 403 | assertion（新端点 405 非 403） |
| BDD-20 | `test_bdd_20_admin_cannot_demote_self` | POST demote self（多 admin）→ 400 self/yourself；DB is_admin=True | 405 |
| BDD-21 | `test_bdd_21_admin_cannot_delete_self` | DELETE self（多 admin）→ 400 self/yourself；DB user 存在 | 通过（自删检查已存在） |
| BDD-22 | `test_bdd_22_two_admins_disable_one_succeeds` | POST disable adminB（2 admins）→ 200 is_active=False；adminB is_admin=True is_active=False；adminA is_active=True | 405 |
| BDD-23 | `test_bdd_23_remaining_sole_admin_protected` | BDD-22 后 disable/demote/delete adminA → 409 LAST_ADMIN；DB adminA is_active=True is_admin=True | 405 |

### 后端 pytest — backend/tests/test_admin_user_api.py（更新现有测试）

| BDD | 测试函数 | 变更说明 | 当前红灯类型 |
|-----|---------|---------|-------------|
| BDD-11 | `test_unique_admin_delete_self_requires_confirm` | 更新为绝对拒绝：confirm_username 旁路移除，带 confirm 也返回 409 | assertion 204!=409 |
| — | `test_admin_list_users_by_username` | 适配 UserListResponse：data["items"][0] | assertion（当前 list[0]） |
| — | `test_admin_delete_user_cascade` | 适配 UserListResponse：list_items[0]["id"] | assertion |

### 后端 pytest — backend/tests/test_t080_cli_user_disable.py

| BDD | 测试函数 | 预期 | 当前红灯类型 |
|-----|---------|------|-------------|
| BDD-17 | `test_bdd_17_cli_disable_user_cannot_login` | `peekview user disable eve17` exit 0 输出含 disabled/✓；DB is_active=False | CLI No such command 'disable' |
| BDD-18 | `test_bdd_18_cli_enable_user_can_login` | `peekview user enable eve18` exit 0；DB is_active=True | CLI No such command 'enable' |
| BDD-19 | `test_bdd_19_cli_demote_last_admin_refused` | `peekview user demote admin1_19` exit!=0 输出含 last/admin；DB is_admin=True | assertion（当前 exit 0，无 LastAdmin 保护） |
| BDD-24 | `test_bdd_24_cli_disable_last_admin_refused` | `peekview user disable admin1_24` exit!=0；DB is_active=True | CLI No such command 'disable' |

### 前端 vitest — frontend-v3/src/__tests__/t080-admin-route-guard.test.ts

| BDD | 测试函数 | 预期 | 当前红灯类型 |
|-----|---------|------|-------------|
| BDD-14 | `test_bdd_14: authenticated non-admin redirected to /explore` | non-admin push /admin → /explore | assertion（requiresAdmin 守卫未实现，停在 /admin） |
| BDD-14 | `test_bdd_14b: admin user can access /admin` | admin push /admin → /admin | assertion |
| BDD-15 | `test_bdd_15: unauthenticated redirected to /` | anonymous push /admin → / | assertion |
| BDD-15 | `test_bdd_15b: loading state resolves then unauthenticated redirects to /` | loading→anonymous push /admin → / | assertion |
| BDD-15 | `test_bdd_15c: loading state resolves to admin user, access granted` | loading→admin push /admin → /admin | assertion |

### Playwright E2E — frontend-v3/e2e/admin.spec.ts

多 viewport：desktop 1280x800 + mobile 390x844

| BDD | 测试（每 viewport） | 预期 | 当前红灯类型 |
|-----|-------------------|------|-------------|
| BDD-01 | `BDD-01: admin sees paginated user list on /admin` | /admin 显示用户列表（≤20 行）+ 分页组件 | B 类（/admin 路由不存在，404/redirect） |
| BDD-02 | `BDD-02: user list shows status badges` | 列表行显示 active/disabled/admin badge | B 类 |
| BDD-06 | `BDD-06: admin cannot disable self` | 自禁用 → toast 含 self/yourself/cannot | B 类 |
| BDD-12 | `BDD-12: reset password dialog` | PasswordResetDialog alertdialog + input + confirm disabled(<8) + enabled(≥8) | B 类（组件不存在） |
| BDD-20 | `BDD-20: admin cannot demote self` | 自降级 → toast 含 self/cannot | B 类 |
| BDD-21 | `BDD-21: admin cannot delete self` | 自删除 → toast 含 self/cannot | B 类 |
| BDD-14 | `BDD-14: non-admin redirected from /admin` | bob 登录后访问 /admin → /explore | B 类（守卫未实现） |
| BDD-15 | `BDD-15: unauthenticated redirected from /admin to /` | 匿名访问 /admin → / | B 类 |

截图：P6 阶段由 vision-analyst 消费，存 `docs/tasks/T080-admin-user-management/evidences/{desktop_1280x800.png, mobile_390x844.png}`。P3 不产出截图（页面未实现）。

## 覆盖自检

- 24 BDD 全覆盖（1:1 映射）：BDD-01..24 每条至少一个测试用例
- 测试名引用 BDD 编号：`test_bdd_NN_*`（后端）+ `BDD-NN: ...`（E2E）+ `test_bdd_NN_*`（vitest）
- Playwright 多 viewport：desktop 1280x800 + mobile 390x844（VIEWPORTS 数组循环）
- 红灯预期：后端 22 failed（B 类），E2E B 类（页面/路由不存在）
- BDD-11 决策 A 落地：test_unique_admin_delete_self_requires_confirm 更新为绝对拒绝（confirm_username 旁路移除）
- BDD-22/23 admin 计数 = is_admin AND is_active：BDD-22 disable adminB 后 adminA 唯一活跃，BDD-23 adminA 受保护
- vitest mock 用字符串字面量（T079 教训）：vi.mock('@/api/client', () => ({ api: { listUsers: vi.fn(), ... } })) 全字面量
- [PROD_NOT_TOUCHED] 全程未启动 :8080 服务、未触碰 ~/.peekview/，pytest 用 conftest autouse 隔离到 tmp_path
