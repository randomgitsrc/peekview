---
phase: P0
task_id: T086
task_name: admin-settings-consolidation
trace_id: T086
created: 2026-08-06
status: pending
parent: none
---

# P0-brief — T086 admin/settings 信息架构收敛

## task

将独立的 `/admin` 用户管理页面合并进 `/settings` 作为 `?tab=user-manager` 选项卡，UserMenu 给 admin 角色显式加入口，删除 `/admin` 路由（不做 redirect，旧书签 404）。后端 API 零改动。

## known_risks

- 路由守卫迁移：从 `meta.requiresAdmin`（路由级）迁到 tab 级（`isAdmin` 才显示 tab + SettingsView 内守卫回退 profile），权限边界不能漏
- E2E 回归：T080 的 admin.spec.ts 27 个用例基于 `/admin` 路由 + data-testid，需迁移到 `/settings?tab=user-manager`
- 移动端：settings 移动端是堆叠式全展示，user-manager tab 在移动端的呈现需确认（是否也堆叠，还是单独 tab）
- 旧书签 404：用户拍板不做 redirect，`/admin` 直接 404，需确认无其他地方硬编码 `/admin` 链接
- 无后端改动（`/api/v1/admin/*` 全部保留）

## executor_env

platform: claude-code
has_task_tool: true
has_local_runtime: true
network: full

## env_constraints

debug_env: "make debug-quick（:8888，/tmp/peekview-debug/ 隔离）；前端测试 make test-frontend（vitest 非 watch）；typecheck: cd frontend-v3 && ./node_modules/.bin/vue-tsc --noEmit；E2E: make debug-test（admin.spec.ts）"
lint: "make lint（ruff，后端无改动可跳）；前端无 lint gate，typecheck 是 CI 强制项"
prod_isolation: "严禁触碰 :8080 生产服务与 ~/.peekview/；测试只走 debug backend :8888"

## 代码审计结果（UX/信息架构类 P0 输入）

### 现状（已由 Explore agent 核查确认）

| 维度 | settings | admin |
|------|----------|-------|
| 路由 | `/settings`（router.ts:18-21）| `/admin`（router.ts:27-31，`meta.requiresAdmin`）|
| 组件 | `SettingsView.vue` | `AdminView.vue`（~285 行，自包含）|
| 结构 | **已是 `?tab=` 机制**（profile/security/apikeys，第 73-81 行）| 单页用户管理，无 tab |
| 权限 | 登录即可（guard 按 `to.path` 字符串匹配）| `requiresAdmin` guard（router.ts:92-95）|
| 入口 | UserMenu → "Settings" → `/settings?tab=apikeys` | **无 UI 入口，只能手敲 URL** |
| 后端 | `/api/v1/...` | `/api/v1/admin/users/...`（全 require_admin，auth.py:203-217）|

### 关键发现

1. **settings 已是 tab 结构** → 合并机制上完全契合，不需要改造容器
2. **admin 入口在 UI 里根本没暴露** → UserMenu.vue 只有 Settings/Logout，admin 登录后只显示徽章。这是真正 UX 缺陷
3. AdminView 自包含，依赖通用组件（OverflowMenu/Pagination/ConfirmDialog/PasswordResetDialog/BaseBadge/EmptyState），迁移成本低
4. SettingsView tab 机制：`activeTab` computed 读 `route.query.tab`，set 调 `router.replace({query:{tab}})`；`validTabs` = [profile, security, apikeys]；无效 tab 回退 profile（第 76 行）
5. 有 redirect 先例：`/settings/apikeys` → `/settings?tab=apikeys`（router.ts:22-25）

### 用户决策（已拍板）

- **完全合并**：AdminView 内容迁成 `UserManagerTab.vue`，作为 settings 第 4 个 tab
- **删除 `/admin` 路由**：不做 redirect，旧书签 404
- **tab 可见性**：`isAdmin` 才显示 user-manager tab；非 admin 手敲 `?tab=user-manager` 在 SettingsView 守卫回退 profile

### 改动清单（P2 细化，P0 只记录方向）

前端：
1. 新建 `frontend-v3/src/components/settings/UserManagerTab.vue`（从 AdminView.vue 迁移内容）
2. `SettingsView.vue`：tabs 数组加 user-manager（v-if isAdmin 显示），validTabs 加 user-manager，activeTab 守卫（非 admin 访问 user-manager 回退 profile）
3. `UserMenu.vue`：isAdmin 时加 "用户管理" 入口 → `/settings?tab=user-manager`（或保留 "Settings" 入口，admin 登录后 tab-nav 里有 user-manager）
4. `router.ts`：删除 `/admin` 路由定义
5. `AdminView.vue`：删除（内容已迁走）
6. E2E：`admin.spec.ts` 迁移路由 + selector

后端：零改动。

## 裁剪倾向

- P2：`follows_existing_pattern`（settings 已有 tab 机制 + redirect 先例），单候选方案，可简化
- P3：保留——tab 守卫逻辑 + isAdmin 可见性需红灯
- P6：保留——UI 改动必须 Playwright 截图（admin 登录看 tab / 非 admin 看不到 tab / 移动端）
- P7：保留——多文件改动（router/SettingsView/UserMenu/UserManagerTab/AdminView 删除/E2E）
- 风险：medium（动路由守卫 + E2E + 权限边界，但不碰后端）

## 排期

T087（行号 bug）完成后接 T086。两者独立，无依赖。
