---
phase: P0
task_id: T068
task_name: account-settings
type: feature
trace_id: T068-P0-20260722
created: 2026-07-22
status: draft
parent: 用户实测 + T066 审计纠正（用户设置页从不存在）+ 产品主确认
---

task: 账户设置页——统一 /settings 路由，含 Profile（显示名编辑）/ Security（改密码）/ API Keys（现有功能迁入），暴露 T011 已交付的后端能力

## 设计决策（主 Agent 基于主流最佳实践 + 代码现状确定）

### 主流参考
GitHub Settings / Vercel Account / npm Profile — 开发者工具的设置页共性：**单页 tab 分区**（Profile / Security / Access Tokens），不用嵌套路由。PeekView 规模小，单页 tab 是正确粒度。

### 路由结构
- 新增 `/settings` → SettingsView（单页 tab 导航：Profile / Security / API Keys）
- 现有 `/settings/apikeys` → 302 重定向到 `/settings?tab=apikeys`（保持向后兼容，EntryListView:360 已有 `router.push('/settings/apikeys')`）
- 需 auth guard：未登录 → 重定向到 landing（当前 ApiKeyListView 无显式 guard，依赖用户已登录的隐式假设——新页面须补）

### Tab 1: Profile
| 字段 | 可编辑 | 来源 | 备注 |
|------|--------|------|------|
| Username | ❌ 只读 | User.username | 系统身份标识，改了会断所有 /users/:username 链接 |
| Display name | ✅ 可编辑 | User.displayName (nullable) | 需新增后端 `PATCH /auth/me` 端点（~15 行）|
| Role | ❌ 只读 | User.isAdmin | 显示 Admin / Member badge |
| Member since | ❌ 只读 | User.createdAt | 格式化日期 |

**后端新增**：`PATCH /api/v1/auth/me`，body `{ display_name?: string | null }`，需 require_auth，返回更新后的 UserResponse。这是本任务唯一的后端改动，极小（参照现有 change-password 端点模式）。

### Tab 2: Security
改密码表单：旧密码 + 新密码 + 确认新密码。提交调 `POST /auth/change-password`（T011 已交付，auth.py:228）。成功后显示 toast 反馈，不清空表单（防误操作）。

### Tab 3: API Keys
将现有 ApiKeyListView.vue 的功能（key 列表 / 创建 / 撤销 / 清理过期）迁入此 tab。ApiKeyListView.vue 保留但改为 SettingsView 的子组件或内联区块。

### 明确不含（v1 不做）
- **注销账号** — 级联删除危险（entries + 磁盘文件 + shares + API keys 全删，不可逆），Web UI 放一键清空按钮产品上不合理。已有 CLI `peekview user delete`，Web 端不补。若将来有真实需求需带保护设计（展示将删数量、冷静期、entry 转移）
- **管理员用户管理页** — admin 在 Web 上管理他人账号（列表/删除/重置密码），是独立需求，不混入个人设置
- **改 username** — 系统身份标识，改了断 /users/:username 路由 + 所有引用
- **头像/邮箱/OAuth/2FA/通知/账单** — PeekView 用户模型没有这些字段（User: id/username/displayName/isActive/isAdmin/createdAt）
- **忘记密码/密码重置流程** — 无邮箱字段，无法发重置链接；已有 CLI `peekview user reset-password`

## 机制交叉判定
本任务触及后端（新增 PATCH /auth/me）+ 前端（新页面 + 组件迁移 + 路由），≥2 个子系统交互 → **走完整 agate**（P1-P6）。

known_risks:
  - PATCH /auth/me 虽小但是安全敏感端点——须 require_auth + 输入校验（display_name max_length=64）+ 返回完整 UserResponse 让前端更新 authStore.user。P2 须参照 change-password 端点的安全模式
  - ApiKeyListView 迁入 settings 是组件重构——须保持所有现有功能（创建/撤销/清理过期/空状态/错误状态），P6 须回归验证
  - /settings/apikeys → /settings 重定向须更新 EntryListView:360 的 router.push 路径，否则断链
  - auth guard：当前 /settings/apikeys 无显式守卫，新 /settings 必须补（未登录→landing），否则匿名用户直接访问 /settings 会白屏
  - 改密码成功后 authState 不变（只改密码不换身份），不需要重新登录——但若后端使旧 JWT 失效则前端须处理 401 → 重新登录。P1 须确认 change-password 是否 invalidate 当前 token
  - 移动端：设置页须响应式。tab 在移动端可改为垂直分区或手风琴，P2 须出移动端适配方案
  - 与 T065（login-state-bug）非硬依赖——设置页通过显式导航进入，不依赖 Sign in 按钮显隐；但 T065 修好 authState 后整体体验更一致

executor_env:
  platform: opencode
  has_task_tool: true
  has_local_runtime: true
  network: full

env_constraints:
  debug_env: make debug-restart (127.0.0.1:8888, /tmp/peekview-debug/)
  seed_data: make debug-seed (alice/bob/carol, password testpass123)
  ui_affected: true（新设置页 + API Key 页重构，P6 需 Playwright 截图验证桌面+移动）
  backend_new_endpoint: PATCH /api/v1/auth/me（display_name 编辑，参照 POST /auth/change-password 模式）
  key_files: frontend-v3/src/views/ApiKeyListView.vue（迁入源）, frontend-v3/src/router.ts（:30 /settings/apikeys 路由）, frontend-v3/src/stores/auth.ts（user ref + fetchMe）, backend/peekview/api/auth.py（:186 GET /me, :228 change-password, 新增 PATCH /me）, backend/peekview/models.py（:106 display_name 字段）
  backend_test: make test-quick；frontend_test: make test-frontend；typecheck: make typecheck
  env_check: P1 启动前须跑 docs/process/env-check-protocol.md（涉及移动端，步骤 4-5 必检）

pruning_tendency: 适中 — 配置管道 / 组件迁移 follows_existing_pattern（ApiKeyListView 已有完整实现可参照），但新页面 + 新端点 + 路由重构涉及设计决策，P2 不可过度简化；UI 改动 P6 不可裁

phase_hint: [P1, P2, P3, P4, P5, P6]
