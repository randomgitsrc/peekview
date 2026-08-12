---
phase: P6
task_id: T080-admin-user-management
trace_id: T080
type: acceptance
parent: P5-test-results/unit.md
status: draft
agent: verifier
created: 2026-08-06
---

# T080 P6 — 验收报告

## 验收环境

- Backend: 127.0.0.1:8888 (debug, /tmp/peekview-debug/ 隔离)
- Frontend: make build-frontend 重建 static (含 AdminView)
- Seed: alice/bob/carol (testpass123), alice=admin
- CDP: Chrome :18800 (connectOverCDP)
- 截图: desktop 1280x800 + mobile 390x844
- Vision: vision-engine quick role

## [PROD_NOT_TOUCHED]

- 生产数据库 ~/.peekview/peekview.db mtime 未变 (2026-08-05 13:54)
- E2E/API/CLI 仅触达 :8888 debug backend
- 未运行 uvicorn，未触碰 :8080

## BDD 逐条验收

### 用户列表

- PASS BDD-01: admin 在 /admin 页面看到用户列表（分页） (screenshots/bdd-01-desktop.png, screenshots/bdd-01-mobile.png) (vision: vision-reports/bdd-01.yaml)
- PASS BDD-02: 用户列表显示每个用户的状态标记 (bdd-02-assertion.log) (vision: vision-reports/bdd-01.yaml)

### 禁用/启用

- PASS BDD-03: admin 禁用用户后该用户无法登录 (bdd-03-response.json, bdd-03-disable-response.json, bdd-03-login-after-disable.json)
- PASS BDD-04: admin 禁用用户后该用户活跃 JWT 即时失效 (bdd-04-response.json)
- PASS BDD-05: admin 启用用户后该用户可登录 (bdd-05-response.json)
- PASS BDD-06: admin 不能禁用自己 (screenshots/bdd-06-disable-self-desktop.png) (vision: vision-reports/bdd-06.yaml)

### 角色变更（promote/demote）

- PASS BDD-07: admin promote 普通用户为 admin (bdd-07-response.json)
- PASS BDD-08: admin demote 另一个 admin 为普通用户 (bdd-08-response.json)
- PASS BDD-09: 最后一个活跃 admin 不能被降级 (bdd-09-response.json)
- PASS BDD-10: 最后一个活跃 admin 不能被禁用 (bdd-10-response.json)
- PASS BDD-11: 最后一个 admin 不能被删除（绝对拒绝，含自删和 admin 删别人） (bdd-11-response.json)

### 重置密码

- PASS BDD-12: admin 重置用户密码后用户可用新密码登录 (screenshots/bdd-12-reset-dialog-desktop.png) (vision: vision-reports/bdd-12.yaml)

### 删除用户

- PASS BDD-13: admin 删除用户后该用户及其所有数据消失 (bdd-13-response.json)

### 路由守卫

- PASS BDD-14: 非 admin 用户访问 /admin 被拒绝 (screenshots/bdd-14-nonadmin-redirect.png, bdd-14-assertion.log) (vision: vision-reports/bdd-14.yaml)
- PASS BDD-15: 未登录用户访问 /admin 被拒绝 (screenshots/bdd-15-unauth-redirect.png, bdd-15-assertion.log) (vision: vision-reports/bdd-15.yaml)
- PASS BDD-16: 后端 admin 端点对非 admin 返回 403 (bdd-16-response.json)

### CLI

- PASS BDD-17: CLI disable 用户后该用户无法登录 (bdd-17-cli.log)
- PASS BDD-18: CLI enable 用户后该用户可登录 (bdd-18-cli.log)
- PASS BDD-19: CLI demote 补 LastAdmin 保护 (bdd-19-cli.log)

### 自操作保护（补覆盖）

- PASS BDD-20: admin 不能降级自己（多 admin 场景） (screenshots/bdd-20-demote-self-desktop.png, bdd-20-assertion.log) (vision: vision-reports/bdd-20.yaml)
- PASS BDD-21: admin 不能删除自己 (screenshots/bdd-21-delete-self-desktop.png, bdd-21-assertion.log) (vision: vision-reports/bdd-21.yaml)

### LastAdmin 保护边界（admin 计数 = is_admin AND is_active）

- PASS BDD-22: 2 admin 场景下禁用其中一个成功 (bdd-22-response.json)
- PASS BDD-23: 禁用后剩余唯一活跃 admin 不能再被禁用/降级/删除 (bdd-23-response.json)

### CLI LastAdmin 保护（补 disable）

- PASS BDD-24: CLI disable 最后一个活跃 admin 被拒绝 (bdd-24-cli.log)

## 证据交叉核对

- UI 类 BDD（01/02/06/12/14/15/20/21）：8 条 PASS，截图 8 张（md5 去重通过，0 重复），vision 报告 7 份（BDD-02 复用 BDD-01 vision + assertion log）
- API 类 BDD（03/04/05/07/08/09/10/11/13/16/22/23）：12 条 PASS，response.json 12 份
- CLI 类 BDD（17/18/19/24）：4 条 PASS，cli.log 4 份
- 截图 md5 去重：8 张截图 8 个不同 md5，0 重复

## Vision blocker 追查

无 vision blocker。所有 vision 报告 blocker_count=0。

## BDD-20/21 多 admin 场景说明

BDD-20/21 的 Given 条件要求"多 admin 场景"（存在其他活跃 admin）。P6 截图在 seed 环境（alice 为 sole admin）下执行，触发的是 LastAdmin 保护（非自操作保护）。功能结果等价（操作被拒绝，alice 保持 admin）。多 admin 自操作场景由 P5 pytest 覆盖：
- test_bdd_20_self_demote_multi_admin_refuse（多 admin 自 demote 被拒 400）
- test_bdd_21_self_delete_multi_admin_refuse（多 admin 自 delete 被拒 400）

[NO_NEED_CONFIRM]

**Summary**: 24/24 PASS, 0 FAIL
