
## orchestrator-log (2026-08-05)

- DECISION: T080 启动，走完整 agate P0-P8（跨后端+CLI+前端三端 + 权限模型，多子系统交互，不可裁剪）
- NEXT: P0 完成（brief 四字段齐全 + env 自检 PASS）→ P1 派发 analyst subagent 产出需求基线
- 派发前已写 P1-dispatch-context-analyst.md + agate-inject-card.sh 注入 P1 卡片
- 客观查证信息由 Explore agent 预先调研（admin.py/admin_service.py/models.py/auth.py/cli.py/router.ts/auth store 全部核实）
## P1 analyst 进度记录

### 文件 1: P0-brief.md（已在 dispatch 前读取）
- 任务：补齐 admin 用户管理能力（后端 disable/enable + promote/demote API + CLI disable/enable，前端 /admin 页面）
- agate 四字段已确认：task/known_risks/executor_env/env_constraints
- 已知风险：级联删除、JWT 软失效、前端守卫双保护、三端改动
- 约束：is_active 已存在、前端复用现有组件、MCP 不暴露 admin、Phase 1 范围明确

### 文件 2: backend/peekview/api/admin.py
- 现有 5 个端点：GET /stats、POST /cleanup、GET /users（支持 username 精确匹配 + 分页 page/per_page）、DELETE /users/{user_id}、POST /users/{user_id}/reset-password
- 全部 Depends(require_admin) 守卫
- delete_user 传 current_user_id=admin.id（防自删在 service 层）
- reset-password 接收 ResetPasswordRequest，返回 {"new_password": ...}
- 缺口：无 disable/enable 端点、无 promote/demote 端点

### 文件 3: backend/peekview/services/admin_service.py
- AdminService 方法：get_stats / cleanup_expired / list_users / delete_user / reset_password / backup / export_entry / restore
- list_users：username 精确匹配（==），分页 offset/limit，返回 UserResponse 列表（含 is_active/is_admin/created_at）
- delete_user：防自删（user_id == current_user_id → ValueError），级联删 entries（通过 entry_service.delete_entry）+ api_keys + user
- reset_password：hash_password 后存库，返回明文密码
- 缺口：无 set_active/disable/enable/promote/demote 方法
- 注意：delete_user 防自删用 ValueError，但无 LastAdmin 保护（最后一个 admin 可被删，若不是自删）

### 文件 4: backend/peekview/models.py（User 模型部分）
- UserBase：username(3-32, unique+index)、password_hash、display_name、is_active(default True)、is_admin(default False)
- User：id PK、created_at、updated_at(onupdate)、entries/api_keys relationships
- UserResponse schema：id/username/display_name/is_active/is_admin/created_at（已含 is_active，前端可用）
- ResetPasswordRequest 存在（reset-password 端点用）
- RESERVED_USERNAMES = {"default", "system", "admin"}
- 无审计字段（disabled_at/disabled_by/disabled_reason）、无 role 字段（仅布尔 is_admin）
- 关键：is_active 已存在且 auth 层已检查，无需 schema 变更即可实现 disable/enable

### 文件 5: backend/peekview/auth.py
- get_current_user（138 行）：JWT 解码后查库 → `if user is not None and user.is_active: return user`（177 行）
  → 禁用用户后，JWT 下次请求即返回 None（软失效，无黑名单）
- require_auth（191）：user is None → 401
- require_admin（203）：not user.is_admin → 403
- 链路：require_admin → require_auth → get_current_user（每请求查库验 is_active）
- API key 路径：apikey_service.verify_api_key → 返回 user（需确认是否也检查 is_active）

### 文件 6: backend/peekview/api/auth.py
- login（128）：`if user is None or not user.is_active: raise InvalidCredentialsError`（149 行）→ 禁用用户无法登录，通用 401 不暴露禁用信息
- delete_self（231）：LastAdminError 保护——最后一个 admin 删自己需 confirm_username（240-249 行），admin_count==1 时触发
- delete_self 调用 admin_service.delete_user(current_user.id, current_user_id=-1)（-1 绕过自删检查）
- 缺口：disable/enable 无对应端点；promote/demote 无对应端点

### 文件 7: backend/peekview/cli.py（user 命令组 1480-1747）
- user create：本地 DB 直写，首用户自动 admin
- user list：显示 [admin]/[disabled]/[active] 状态标记
- user promote/demote（1579-1620）：直接设 is_admin，**无 LastAdmin 保护**（最后一个 admin 可被 demote 导致无 admin）
- user delete（1623）：有 click 确认 prompt，本地走 admin_svc.delete_user(current_user_id=-1)，远程走 API
- user reset-password（1668）：本地+远程双模式，密码 ≥8 字符
- user change-password（1726）：仅远程模式
- 缺口：无 disable/enable 子命令
- 隐含需求：CLI promote/demote 应补 LastAdmin 保护（与 API 对齐）

### 文件 8: frontend-v3/src/router.ts
- 现有路由：/、/explore、/settings、/settings/apikeys、/users/:username、/:slug、404
- 无 /admin 路由
- beforeEach（75 行）：仅检查 authState（loading 等待、/ 重定向、/settings 需认证），**不检查 isAdmin**
- 缺口：需新增 /admin 路由 + admin 守卫（未登录→哪？非 admin→哪？）

### 文件 9: frontend-v3/src/stores/auth.ts
- isAdmin computed（17 行）：`user.value?.isAdmin ?? false`，仅展示用
- authState：loading/authenticated/anonymous
- 无 admin 相关 action
- 缺口：isAdmin 可直接用于路由守卫，无需新增 store 逻辑

### 文件 10: frontend-v3/src/api/client.ts
- transformUser（94-103）：已映射 is_active/is_admin
- 无 admin API 调用方法（无 listUsers/disableUser/enableUser/promoteUser/demoteUser/deleteUser/resetPassword）
- 401 拦截器：触发 auth-expired 事件 + logout
- 缺口：需新增 admin API 方法集

### 文件 11: frontend-v3/src/types/index.ts
- User 接口（103-110）：id/username/displayName/isActive/isAdmin/createdAt（已含 isActive，但前端从未用于逻辑）
- 无 admin 相关类型
- 缺口：可能需要 AdminUser 列表响应类型（含 total 分页元数据）

### 文件 12: DESIGN.md §6
- BaseButton：primary/secondary/ghost/danger 变体，default/small 尺寸
- BaseBadge：public/private/shared/archived/expired 变体（无 disabled/admin 变体，需扩展或复用）
- ConfirmDialog：destructive actions 必须 alertdialog role
- Toast：top-center，error 不自动消失
- OverflowMenu：desktop dropdown / mobile bottom sheet
- 用户菜单（212 行）：avatar+username → Settings/Logout，admin badge pill
- 缺口：用户列表页无现成组件规范，需复用 BaseButton/BaseBadge/Pagination + 表格/列表布局

## P1 analyst 重试 #1 修订进度

[PROD_NOT_TOUCHED] 本阶段为需求修订，只读代码 + 改 P1-requirements.md，未启动服务、未写代码、未触碰生产环境。

### 读取输入完成
- P1-dispatch-context-analyst-retry1.md：已决断 A（移除 confirm_username 旁路，绝对拒绝）+ B（admin 计数 = is_admin AND is_active）+ 6 个需修订项
- P1-review.md：6 个问题（#1-#4 必须修，#5-#6 建议修）
- P1-requirements.md：当前 19 条 BDD，待修订
- backend/peekview/api/auth.py:240-249：核实 confirm_username 旁路存在——admin_count==1 且 confirm_username != username 时抛 LastAdminError，输入正确用户名则旁路通过执行 delete_user。决策 A 移除此旁路确认可行（删掉 confirm_username 条件判断即可，所有路径统一绝对拒绝）。

### 修订计划
- 问题 #1：BDD-11 Given/When 改为覆盖自删+admin删别人双路径绝对拒绝；§4-2 声明移除旁路（破坏性变更）；§2.5 补兼容声明
- 问题 #2：新增 BDD-20（自 demote 被拒）+ BDD-21（自 delete 被拒）
- 问题 #3：§2.4 定义 admin 计数规则（is_admin AND is_active）；新增 BDD-22/BDD-23（2 admin 禁用边界）
- 问题 #4：新增 BDD-24（CLI disable 最后一个活跃 admin 被拒）
- 问题 #5：BDD-19 标题改为 "CLI demote 补 LastAdmin 保护"
- 问题 #6：§4-5 表述改为 "已有 min_length=8 校验，确认对齐 CLI"

### 问题 #1 修订完成
- BDD-11：Given/When/Then 改为绝对拒绝，覆盖自删 + admin 删别人双路径，显式声明即使提供 confirm_username 也被拒绝（移除旁路）
- §4-2：新增决策 A 声明（破坏性变更：移除 confirm_username 旁路，统一绝对拒绝）
- §4-2：新增决策 B 声明（admin 计数 = is_admin AND is_active），决策列表重编号 3→4,4→5,5→6,6→7
- §2.5：新增兼容声明（破坏性变更：delete_self 移除 confirm_username 旁路，依赖此行为的用户受影响）

### 问题 #6 修订完成（随 #1 一并）
- §4-6（现 §6 即第 6 条决策）：reset_password 表述改为"已有 min_length=8 校验（models.py:756），确认对齐 CLI"
- §2.4：空密码/弱密码项同步改为"已有 min_length=8 校验"

### 问题 #3 §2.4 修订完成
- §2.4：新增 admin 计数规则定义（is_admin=True AND is_active=True），2 admin 禁用边界说明
- §2.4：自操作保护项补 BDD 引用（BDD-06 自 disable / BDD-20 自 demote / BDD-21 自 delete）

### 问题 #2 修订完成
- 新增 BDD-20：admin 不能降级自己（多 admin 场景，自 demote 被拒）
- 新增 BDD-21：admin 不能删除自己（非 LastAdmin 场景，自 delete 被拒）

### 问题 #3 BDD 修订完成
- BDD-09：Given 改为"活跃 admin（is_admin=True AND is_active=True）"
- BDD-10：同上
- 新增 BDD-22：2 admin 场景禁用其中一个成功（B 不再算活跃 admin）
- 新增 BDD-23：禁用后剩余唯一活跃 admin 不能再被禁用/demote/delete

### 问题 #4 修订完成
- 新增 BDD-24：CLI disable 最后一个活跃 admin 被拒绝

### 问题 #5 修订完成
- BDD-19 标题改为"CLI demote 补 LastAdmin 保护"
- BDD-19 Given 改为"活跃 admin（is_admin=True AND is_active=True）"

### 附带修订
- §1 CLI 描述：promote/demote 对齐改为"统一绝对拒绝语义，对齐决策 A 移除旁路后的 delete_self"
- BDD-11 标题/Given 改为"活跃 admin"

### 自检
- BDD 编号连续：BDD-01..BDD-24，无跳号 ✓
- 无 [NEED_CONFIRM] ✓
- 8 个 CONFIRMED：原 6（§4 决策 1/2/4/5/6/7）+ 决策 A（§4-2 内）+ 决策 B（§4-3）✓
- [NO_NEED_CONFIRM] 声明保留在 §4 顶部 ✓
