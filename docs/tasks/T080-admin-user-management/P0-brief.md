---
phase: P0
task_id: T080
task_name: admin-user-management
trace_id: T080
created: 2026-07-30
status: pending
parent: null
---

# T080: Admin 用户管理

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
