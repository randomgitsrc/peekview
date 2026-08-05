# P1 dispatch-context: analyst

## 目标

为 T080 Admin 用户管理建立需求基线。产出 P1-requirements.md，含 BDD 验收条件、domains/packages/risk_level/phases 声明、能力需求声明、隐含需求识别。

## 约束

- 跨后端 + CLI + 前端三端改动，属多子系统交互，必须走完整 agate（P0-P8），不可裁剪
- MCP 不暴露 admin 能力（决策已定：admin 操作通过 Web UI 或 CLI，不通过 MCP）
- Phase 1 范围：用户列表 + 禁用/启用 + 删除 + 重置密码 + promote/demote。backup/restore/export 保留 CLI-only（已存在，不纳入）
- 后端 User.is_active 字段已存在且 auth 层已检查（登录 + JWT 每请求查库 + API key），只缺 toggle 端点
- 前端复用现有组件（BaseButton/BaseBadge/Pagination），遵循 DESIGN.md §6 规则
- 禁用用户后 JWT 靠每次查库软失效（无 token 黑名单/版本号）——这是现状，Phase 1 不引入黑名单机制，靠现有软失效即可
- 严禁触碰生产环境（:8080 / ~/.peekview/），调试用 :8888

## 上游关联

- P0-brief.md：任务简报 + agate 四字段 + 已知风险 + office-hours 六问自检
- DESIGN.md §6：BaseButton（primary/secondary/ghost/danger 变体）、BaseBadge（public/private/shared/archived/expired 变体）、用户菜单（avatar+username → Settings/Logout，admin 徽章 pill）
- 现有 admin API（admin.py）：stats / cleanup / list_users / delete_user / reset_password 五端点，均 require_admin 守卫
- 现有 auth 链：require_admin → require_auth → get_current_user（每请求查库验 is_active）
- 现有 CLI（cli.py:1480 user 命令组）：create/list/promote/demote/delete/reset-password/change-password，缺 disable/enable

## 输入文件

1. `docs/tasks/T080-admin-user-management/P0-brief.md` — 任务简报 + 环境约束 + 已知风险
2. `backend/peekview/api/admin.py` — 现有 admin 端点（5 个）
3. `backend/peekview/services/admin_service.py` — AdminService 现有方法
4. `backend/peekview/models.py` — User 模型（is_active/is_admin 字段，无审计字段）
5. `backend/peekview/auth.py` — require_admin / get_current_user / is_active 检查逻辑
6. `backend/peekview/api/auth.py` — 登录时 is_active 检查 + LastAdminError（delete_self 第 240-249 行）
7. `backend/peekview/cli.py` — user 命令组（第 1480 行起，promote/demote 第 1579-1620 行）
8. `frontend-v3/src/router.ts` — 现有路由（无 /admin）
9. `frontend-v3/src/stores/auth.ts` — isAdmin computed（第 17 行，仅展示用，未用于路由守卫）
10. `frontend-v3/src/api/client.ts` — transformUser（第 94-103 行，无 admin API 调用）
11. `frontend-v3/src/types/index.ts` — User 接口（第 103-110 行，含 isActive/isAdmin）
12. `DESIGN.md` — §6 组件规则、用户菜单规范

## 客观查证信息（已由 Explore agent 核实）

**后端现状**：
- admin.py 5 端点：GET /stats、POST /cleanup、GET /users、DELETE /users/{id}、POST /users/{id}/reset-password
- AdminService 无 set_active/disable/enable/promote/demote 方法
- User 模型无 disabled_at/disabled_by/disabled_reason 审计字段，无 role 字段（仅布尔 is_admin）
- auth.py:177 get_current_user 每请求查库验 is_active → 禁用后 JWT 下次请求即 401（软失效，无黑名单）
- api/auth.py:149 登录时 is_active=False → 通用 401（不暴露禁用信息）
- api/auth.py:240-249 delete_self 有 LastAdminError 保护（最后一个 admin 不能删自己）
- cli.py:1579-1620 promote/demote 直接设 is_admin，无 LastAdmin 保护、无审计

**前端现状**：
- router.ts 无 /admin 路由，beforeEach 仅检查 authState 不检查 isAdmin
- 无 admin 页面/API 调用，isAdmin 仅用于 UserMenu 徽章 + ProfileTab 角色标签
- types/index.ts User 接口已含 isActive/isAdmin，但 isActive 从未用于逻辑

**关键缺口（需在 BDD 覆盖）**：
1. 后端无 disable/enable 端点（API + service 层）
2. 后端无 promote/demote 端点（API 层，CLI 有但无 LastAdmin 保护）
3. CLI 无 disable/enable 子命令
4. 前端无 /admin 路由 + 页面 + API 调用 + 路由守卫

## 特别关注

- BDD 要覆盖（用户行为视角，非 API 调用）：
  - admin 在 /admin 页面看到用户列表（分页）
  - admin 禁用用户 → 该用户下次请求/JWT 失效 → 无法登录
  - admin 启用用户 → 该用户可登录
  - admin promote 用户为 admin / demote admin 为普通用户
  - admin 不能禁用/删除/降级自己（防自锁）
  - 最后一个 admin 不能被降级/删除/禁用（LastAdmin 保护，对齐 delete_self 现有逻辑）
  - 非 admin 访问 /admin → 跳转/拒绝（前端路由守卫 + 后端 403）
  - admin 重置用户密码 → 返回新密码
  - admin 删除用户 → 级联删除其 entries/files/apikeys
  - 禁用用户的状态在列表中可见（disabled 标记）
  - CLI `peekview user disable/enable <username>` 可用
- 隐含需求检查：
  - disable/enable/promote/demote 是否需要审计字段（disabled_at/disabled_by）？Phase 1 是否纳入？→ 标记让 P2 决策
  - promote/demote 的 LastAdmin 保护是否要同步补到 CLI 现有 promote/demote？
  - admin 禁用自己 vs 删除自己：现有 delete_user 防自删，disable 也应防自禁
  - 前端 /admin 路由守卫：未登录跳哪？已登录非 admin 跳哪？404 还是 /explore？
  - 用户列表是否需要搜索/过滤（现有 list_users 仅支持 username 精确匹配）？
  - 禁用用户后其已发布的 public entries 是否仍可见？（应仍可见，禁用只影响登录，不删内容）
  - 操作确认流程：删除/禁用是否需要二次确认弹窗？
- capability_requirements: 需要 Playwright CDP + vision 验证 /admin 页面交互（available，已自测）
- domains: backend / frontend / cli / security（多端 + 权限模型，security 必含）
- risk_level: medium-high（涉及权限模型 + 级联删除 + 多端，但 is_active 字段已存在降低 schema 风险）

## 产出路径

`docs/tasks/T080-admin-user-management/P1-requirements.md`

## 产出要求

- Header: phase=P1, task_id=T080-admin-user-management, trace_id=T080, type=requirements, parent=P0-brief.md
- BDD 验收条件 ≥1 条（Given/When/Then，可二值判定，编号格式 #### BDD-NN:）
- domains / packages / risk_level / phases 声明
- capability_requirements 声明（三态）
- 隐含需求识别节
- 待确认清单：拿不准的标 [NEED_CONFIRM]，无则 [NO_NEED_CONFIRM]
- 裁剪说明：phases 列表，本任务不裁剪（P0-P8 全走），写明理由

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P1

路径：phase-cards/P1-requirements.md
---
# P1 — 需求基线

> 当前状态：[首次 / 重试 #N]
> P1 不可裁剪（核心阶段）

## 如果是首次进入本阶段

1. 派发 analyst subagent → 产出 P1-requirements.md
   1.1 写 P1-dispatch-context-analyst.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
2. 主 Agent 确认：BDD 验收条件 ≥1 条 + 无未决 NEED_CONFIRM
2.5 派发 requirements-review subagent（角色文件：{agate_root}/assets/review-roles/requirements-review.md）
     2.5.1 写 P1-dispatch-context-requirements-review.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
    输入：P1-requirements.md
    产出：P1-review.md（agent≠main，含 BDD 编号引用 + 覆盖维度标注）
    review 不通过 → analyst 修改 → 再 review → … → approved（⑩迭代循环）
3. 预跑 check-gate.sh P1（exit 2，主 Agent 自判）
4. 更新 .state.yaml phase=P1 → P2
5. git add docs/tasks/{Txxx}/（含 .state.yaml + 产出文件，若 .gitignore 忽略需 git add -f）
6. git commit -m "wf({Txxx}-P1): {摘要}"

## 如果是重试

确认上一轮失败原因（BDD 不完整 / domains 声明错 / NEED_CONFIRM 未处理）
→ review 不通过时：analyst 修改需求 → 重派 requirements-review → 共享 retry 预算
→ 读 agate/rules/state-transitions.md 确认 retry 上限（P1 MAX=3）

## 前置条件

- [ ] P0-brief.md 完成（四字段齐全）

## 派发

- **角色**：analyst（`{agate_root}/assets/execution-roles/analyst.md`）
- **输入**：P0-brief.md（env_constraints / known_risks / executor_env）
- **输出**：P1-requirements.md
- **派发 prompt 模板**：`{agate_root}/assets/templates/dispatch-prompt.md`

## 产出规格

P1-requirements.md 必须包含：
- BDD 验收条件（至少 1 条，Given/When/Then 格式）
- `domains:` 声明（backend / frontend / mcp / security）
- `packages:` 声明（受影响的包/模块）
- `risk_level:` 声明（low / medium / high）→ 决定 P2 评审强度
- `phases:` 裁剪声明（跳过哪些阶段 + 理由）
- `capability_requirements:` 能力需求声明（available / supplementable / GAP 三态）
- 无未决 `[NEED_CONFIRM]`（有则 PAUSED）；无待确认项时写 `[NO_NEED_CONFIRM]`

## gate 规则

check-gate.sh P1 → P1-review.md 存在 + status:approved + agent≠main + 含 BDD 编号锚点 → exit 2（BDD 编号格式为 `#### BDD-NN:`）；缺 P1-review.md / agent=main / 无锚点 → exit 1
P1 评审不可裁——所有任务都走独立 requirements-review，无例外

## 推进条件（全部满足才写 phase: P2）

- [ ] P1-requirements.md 含 BDD ≥1 条
- [ ] domains / packages / risk_level / phases 已声明
- [ ] 无 [NEED_CONFIRM] 标记
- [ ] 无 status: GAP（supplementable 不阻，GAP 阻）
- [ ] P1-review.md status: approved（agent≠main，含 BDD 编号锚点）

## 常见错误

1. **BDD 写成技术实现而非用户行为**：BDD 应该描述"用户能看到什么/系统应该做什么"，不是"调用哪个 API"
2. **domains 声明不全**：漏了某个受影响域 → P2 不派该域的评审 → 实现方向错误
3. **capability_requirements 漏声明**：P6 验收时才发现需要但不可用的能力 → 返工
4. **gate 不过 ≠ 你失败了**：红灯指向工作/设计的问题，不指向你。正确动作是诊断→退回/重试/PAUSED，不是修改产出让它变绿。

## 下游影响

- P2 设计依赖 domains + risk_level 决定评审角色
- P6 验收逐条对照 P1 的 BDD（PASS/FAIL 总数必须 ≥ P1 BDD 总数）
- P7 一致性检查依赖 packages 声明做跨文件交叉核对

## 评审

P1 评审通用必有（所有任务都走 requirements-review），P2/P4 评审是 C8 域触发（见 review-mapping.md）——二者在"是否通用"上不对称，仅在"独立 subagent、agent≠main"上类比。P1 评审不可裁剪。
review 不通过 → analyst 修改需求 → 再 review（⑩迭代循环），直至 approved。

> 完成 → 读 phase-cards/P2-design.md
<!-- AGATE_CARD_END -->
