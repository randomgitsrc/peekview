# P2 progress log — architect

- [x] P1-requirements.md — 24 BDD + 8 CONFIRMED 确认。关键：审计字段必纳入(migration)、LastAdmin 三者补齐(绝对拒绝)、admin 计数=is_admin AND is_active、list_users 改 {items,total,page,per_page}、OverflowMenu、delete_self 移除 confirm_username 旁路(破坏性)、非 admin /admin 跳 /explore
- [x] P0-brief.md — env_constraints: make debug :8888 隔离 /tmp/peekview-debug；test_backend=pytest -q; test_frontend=vitest run; typecheck=vue-tsc; cdp :18800。风险：级联删除、JWT 软失效、双重守卫
- [x] api/admin.py — 5 端点(stats/cleanup/list_users/delete_user/reset-password)。模式：@router + Depends(require_admin) + admin.id 传 service。list_users response_model=list[UserResponse]（需改）。delete_user ValueError→ValidationError。无 toggle 端点。
- [x] services/admin_service.py — list_users 返回 list[UserResponse] 手工构造(无 total)。delete_user 防自删(user_id==current_user_id→ValueError) + 级联删 entries/files/apikeys。reset_password 直接 hash_password 写库。无 toggle 方法、无 LastAdmin 保护、无审计字段记录。restore merge 创建 User 不带审计字段(兼容性注意)。
- [x] models.py:101-145 — UserBase(is_active/is_admin 已存在,server_default) + User(table, id/created_at/updated_at/relationships)。审计字段需加到 UserBase 或 User。UserResponse:640-648(id/username/display_name/is_active/is_admin/created_at) 无审计字段,需扩展 disabled_at。ResetPasswordRequest:755-756 min_length=8 max_length=72 已确认对齐。
- [x] auth.py — get_current_user:164-178 每请求查库,JWT 路径验 user.is_active,False→返回 None(软失效确认)。require_admin:203-217 非admin→ForbiddenError(403)。require_auth→401。无 LastAdmin 逻辑在此文件。
- [x] api/auth.py:231-251 — delete_self: confirm_username Query(None), is_admin 时 count admins(用 select User.is_admin=True, 未加 is_active 条件→bug), admin_count==1 且 confirm_username!=username→LastAdminError。否则调 delete_user(id, current_user_id=-1)。决策 A: 移除 confirm_username 旁路→绝对拒绝。注意现有 count 未加 is_active(决策 B 要修)。
- [x] exceptions.py — LastAdminError:237-244 status=409 code=LAST_ADMIN。ForbiddenError:178-185 status=403。ValidationError:34-43 status=400。NotFoundError:66-73 status=404。复用 LastAdminError 即可。
- [x] database.py:39-157 — _run_migrations 模式: with engine.connect() → PRAGMA table_info(table) → set of columns → if col not in columns: ALTER TABLE ADD COLUMN + commit + logger.info。users 表已有 is_admin migration:84-98。审计字段 disabled_at/disabled_by/disabled_reason 照此模式加。注意 check_schema:172-204 会比对 model vs 实际列,缺列→SchemaMismatchError(启动时),所以 model 字段和 migration 必须同步。
- [x] cli.py:1480-1621 — user 命令组: create/list/promote/demote/delete/reset_password/change_password/login。promote:1579-1598 无 LastAdmin(不需, promote 不触发保护)。demote:1601-1620 直接设 is_admin=False,无 LastAdmin 保护→需补。user_list:1554-1576 直接查库(不走API),已显示 admin/disabled flags。user_delete:1627 remote 模式走 backend API, local 模式直接 DB。需新增 disable/enable 命令。CLI 用 PeekConfig() 无参→生产配置,但 P0 说 debug 模式自动隔离。
- [x] router.ts — routes: /, /explore, /settings, /users/:username, /:slug, 404。beforeEach:75-86 处理 / (authenticated→/explore) 和 /settings (non-auth→/)。需新增 /admin route + meta.requiresAdmin + beforeEach 检查 isAdmin→否则 /explore。/admin 必须在 /:slug 之前(否则 admin 被当 slug)。waitForAuthInit 等 initializing。
- [x] stores/auth.ts — isAdmin computed:17 (user.isAdmin)。authState: loading/authenticated/anonymous。需在路由守卫消费 isAdmin + authState。
- [x] types/index.ts:103-110 — User {id,username,displayName,isActive,isAdmin,createdAt}。EntryListResponse:43-49 {items,total,page,perPage} 是 list_users 改造的参照模板。需扩展 User 加 disabledAt/disabledBy/disabledReason?(决策:审计字段后端记录,前端展示 disabledAt 即可) + 新增 UserListResponse {items,total,page,perPage}。
- [x] api/client.ts:94-103 — transformUser 映射 snake→camel。listEntries:107-126 是分页 API client 模式参照({items,total,page,perPage})。需新增 admin API 方法组:listUsers/disableUser/enableUser/promoteUser/demoteUser/resetPassword/deleteUser。
- [x] components/ — OverflowMenu.vue 存在(items: OverflowMenuItem[], variant: dropdown|sheet, item.variant: 'default'|'danger', item.action)。OverflowMenuDropdown/Sheet 子组件。Pagination.vue 存在(props: page,perPage,total,maxVisible; v-model:page)。BaseBadge.vue 存在(variants: public/private/shared/archived/expired — 无 disabled/admin,需扩展或复用 archived 表 disabled)。BaseButton.vue 存在(primary/secondary/ghost/danger)。ConfirmDialog.vue 存在(alertdialog role)。
- [x] DESIGN.md §6:149-222 — OverflowMenu:178-179 desktop dropdown/mobile sheet。ConfirmDialog:172-173 destructive 需 alertdialog role。BaseBadge:166-167 variants 列举无 disabled/admin(需新增 variant 或复用)。Navigation:210-213 admin badge pill when is_admin(已有约定)。新增 disabled variant 属设计扩展,P2 建议加 disabled + admin 两个 variant(对齐 DESIGN admin badge pill 约定)。

## P2 重试 #1 — architect 修订前端设计节（开始）
时间: $(date -u +%Y-%m-%dT%H:%M:%SZ)
输入: P2-review.md (1 BLOCKER + 9 建议修)
现状核实:
- ConfirmDialog.vue:30-35 props 无 input/slot → BLOCKER 成立
- ConfirmDialog.vue:7-9 alertdialog role + :45-49 focus cancel → 参照模式
- OverflowMenu.vue:88-93 variant prop 非响应式 → 需 useResponsiveLayout
- OverflowMenu.vue:116-119 close() 已 focus trigger → 焦点恢复已有
- EntryListView.vue:98 loading-state+role=status / :118 error-state / :122 EmptyState → 参照模式
- useResponsiveLayout.ts:21 isMobile = viewportWidth<=640
- Toast.vue:2 aria-live=polite（全 polite，error 未 assertive）→ 建议修 9 成立
- router.ts:75-86 beforeEach: loading 时 waitForAuthInit → 顺序须显式声明

## P2 重试 #1 — architect 修订完成
时间: $(date -u +%Y-%m-%dT%H:%M:%SZ)
修订文件: P2-design.md §7 前端设计节（Edit，非整体重写）

### BLOCKER 修复
- BDD-12: 新建 PasswordResetDialog.vue spec（行 415-434）
  - 不复用 ConfirmDialog（输入语义不同）
  - password input + show/hide toggle + aria-label
  - ≥8 字符校验（对齐 models.py:756）+ 确认按钮 disabled
  - alertdialog role + aria-labelledby/describedby
  - focus management（打开聚焦 password input，参照 ConfirmDialog:45-49）
  - 移动端键盘弹起保持可见（max-height + overflow-y / dvh）

### 9 建议修全部纳入
1. (BLOCKER 已含) PasswordResetDialog 新建
2. ConfirmDialog 文案 spec（删除/禁用两组，行 436-449）
3. 列表 loading/error/empty 状态 UI（行 403-407，参照 EntryListView:98/118/122）
4. 操作 in-flight 禁用防重复点击（行 402，pendingOp + disabled）
5. 分页边界（行 408，删除后页码回退）
6. OverflowMenu variant 响应式切换（行 396，useResponsiveLayout isMobile）
7. /admin 移动端列表布局（行 409，单列 + 右对齐）
8. beforeEach waitForAuthInit 顺序显式声明（行 365-389，requiresAdmin 在 waitForAuthInit 之后）
9. toast aria-live 声明（行 472-487，error=assertive 其他=polite，item 级）

### 同步更新
- ui_interaction_points: 重置密码改 PasswordResetDialog + 补禁用 ConfirmDialog（行 31-33）
- BDD 覆盖映射: BDD-12/13/14/15 行更新（行 505-508）
- files_to_read: 补充 ConfirmDialog.vue/Toast.vue/useResponsiveLayout.ts/useToast.ts + 行号扩展（行 553-577）
- 实现完成标志: 第 3/6 条补充 PasswordResetDialog + 状态覆盖 + waitForAuthInit 顺序验证（行 584-587）

### 自检
- BLOCKER 修复: ✅
- 9 建议全纳入: ✅（grep 验证全部命中）
- files_to_read 补充 PasswordResetDialog 参照: ✅（ConfirmDialog.vue:1-61）
- 候选方案 A 不变: ✅（未动 §1-§6 后端设计）
- 后端设计不变: ✅（只改 §7 + 声明字段 + BDD 映射 + files_to_read + 完成标志）

[PROD_NOT_TOUCHED]
