---
phase: P0
task_id: T080
task_name: admin-user-management
trace_id: T080
created: 2026-07-30
updated: 2026-08-05
status: pending
parent: null
---

# T080: Admin 用户管理

## agate 四字段

```yaml
task: "补齐 admin 用户管理能力：后端 disable/enable + promote/demote API + CLI disable/enable，前端新增 /admin 路由与用户管理页面（列表/禁用启用/删除/重置密码/角色变更）"
known_risks:
  - "删除用户是级联操作（删所有 entries/files/API keys），需确认流程"
  - "禁用用户后其活跃 JWT 是否立即失效——当前 JWT 无状态，禁用后需等 token 过期或加黑名单机制"
  - "admin 页面需 admin 权限守卫：前端路由守卫 + 后端 require_admin 双重保护"
  - "跨前后端 + CLI 三端改动，属多子系统交互，必须走完整 agate 不可裁剪"
executor_env:
  platform: "claude-code"
  has_task_tool: false
  has_local_runtime: true
  network: "full"
env_constraints:
  debug_env: "make debug (127.0.0.1:8888, 独立数据目录 /tmp/peekview-debug/)"
  test_backend: "cd backend && .venv/bin/python -m pytest tests/ -q"
  test_frontend: "cd frontend-v3 && ./node_modules/.bin/vitest run"
  lint: "make lint (ruff 系统 python3)"
  typecheck: "make typecheck (vue-tsc, CI 强制)"
  cdp: "Chrome CDP :18800 + playwright-cdp skill + vision-engine skill（UI 验收用）"
```

## 问题

Admin 登录后缺少用户管理能力：
- 后端 API 有 list_users / delete_user / reset_password，但缺 disable/enable 和 promote/demote
- CLI 有 user promote/demote，但缺 user disable/enable
- 前端无 /admin 页面，admin 只能通过 CLI 操作

## 约束

- 后端 `User` model 已有 `is_active` 字段，auth 层已检查 `is_active`，只缺 toggle 端点
- 前端 admin 页面复用现有组件（BaseButton, BaseBadge, Pagination 等），遵循 DESIGN.md 规则
- MCP 不需要暴露 admin 能力（决策：admin 操作通过 Web UI 或 CLI，不通过 MCP）
- Phase 1 范围：用户列表 + 禁用/启用 + 删除 + 重置密码 + promote/demote。backup/restore/export 保留 CLI-only

## 已知风险

- 删除用户是级联操作（删除所有 entries/files/API keys），需确认确认流程
- 禁用用户后其活跃 session/JWT 是否立即失效？当前 JWT 是无状态的，禁用后需等 token 过期或加黑名单
- admin 页面需要 admin 权限守卫，前端路由守卫 + 后端 require_admin 双重保护

## 关联

- 后端 API: `/api/v1/admin/*` (admin.py)
- 后端 Service: admin_service.py
- CLI: `peekview admin` / `peekview user` 命令组
- 前端路由: 需新增 `/admin` route

## P0 质量自检（office-hours 六问）

1. 需求真实性：admin 目前只能 CLI 操作用户，无 Web UI，多用户场景下管理成本高——真实需求
2. 现状：admin 用 `peekview user delete/disable` 等 CLI 命令，无可视化、无批量操作、无远程操作
3. 绝望的具体性：部署在服务器上的 PeekView 实例管理员，无 SSH 便捷访问时无法管理用户
4. 最窄切入点：列表 + 禁用/启用 + 删除 + 重置密码 + promote/demote（Phase 1 已定义）
5. 亲眼观察：基于现有 admin API 缺口和前端空白
6. 未来契合：admin Web UI 是多用户平台的标配，长期成立
