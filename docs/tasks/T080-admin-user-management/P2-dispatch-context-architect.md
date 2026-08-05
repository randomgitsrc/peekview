# P2 dispatch-context: architect

## 目标

把 P1 需求基线（24 BDD + 8 CONFIRMED 决策）转化为可实现的技术方案。产出 P2-design.md，含候选方案权衡、影响域、files_to_read、gate_commands、minimal_validation。

## 约束

- 跨后端 API + service + CLI + 前端四层改动，属多子系统交互
- 8 个 CONFIRMED 决策必须全部落地到设计：
  1. 审计字段 disabled_at/disabled_by/disabled_reason 纳入（schema 变更 + migration）
  2. LastAdmin 保护补齐 demote/disable/delete 三者（绝对拒绝）
  3. 非 admin 访问 /admin 跳 /explore
  4. list_users 改为 {items,total,page,per_page}
  5. reset_password 已有 min_length=8（确认对齐）
  6. 前端操作入口 OverflowMenu
  7. 决策 A：移除 delete_self confirm_username 旁路（破坏性变更）
  8. 决策 B：admin 计数 = is_admin AND is_active
- MCP 不暴露 admin 能力
- 严禁触碰生产环境（:8080 / ~/.peekview/），调试用 :8888
- gate_commands 用 Makefile target（make test-quick / make typecheck / make debug-test 等），不手写裸命令

## 上游关联

- P1-requirements.md：24 条 BDD + 8 CONFIRMED + domains=backend/frontend/cli/security + risk=medium-high
- P0-brief.md：环境约束 + 已知风险
- 现有代码（Explore agent 已调研）：
  - admin.py 5 端点（stats/cleanup/list_users/delete_user/reset_password）
  - admin_service.py 无 toggle 方法
  - models.py User 有 is_active/is_admin，无审计字段，无 role 字段
  - auth.py get_current_user 每请求查库验 is_active + require_admin
  - api/auth.py:240-249 delete_self 有 LastAdminError + confirm_username 旁路
  - cli.py:1480 user 命令组（promote/demote 无 LastAdmin 保护）
  - router.ts 无 /admin，beforeEach 不检查 isAdmin
  - auth store isAdmin computed 仅展示用

## 输入文件

1. `docs/tasks/T080-admin-user-management/P1-requirements.md` — 24 BDD + 8 CONFIRMED
2. `docs/tasks/T080-admin-user-management/P0-brief.md` — 环境约束
3. `backend/peekview/api/admin.py` — 现有 admin 端点
4. `backend/peekview/services/admin_service.py` — AdminService 现有方法（list_users/delete_user/reset_password）
5. `backend/peekview/models.py` — User 模型 + UserResponse + ResetPasswordRequest
6. `backend/peekview/auth.py` — require_admin / get_current_user / LastAdminError
7. `backend/peekview/api/auth.py` — delete_self 的 confirm_username 旁路（240-249，决策 A 要移除）
8. `backend/peekview/exceptions.py` — LastAdminError 定义
9. `backend/peekview/database.py` — migration 机制（审计字段要加 migration）
10. `backend/peekview/cli.py` — user 命令组（1480 行起，promote/demote/disable/enable）
11. `frontend-v3/src/router.ts` — 路由 + beforeEach 守卫
12. `frontend-v3/src/stores/auth.ts` — isAdmin computed
13. `frontend-v3/src/api/client.ts` — transformUser + API client 模式
14. `frontend-v3/src/types/index.ts` — User 接口
15. `frontend-v3/src/components/` — 现有 BaseButton/BaseBadge/ConfirmDialog/Pagination/OverflowMenu（如有）组件
16. `DESIGN.md` — §6 组件规则、OverflowMenu 规范

## 客观查证信息

- 后端无 toggle 端点（disable/enable/promote/demote API 全缺）
- User 无审计字段，需 migration（database.py 现有 migration 机制需 architect 确认模式）
- delete_self confirm_username 旁路在 api/auth.py:240-249，决策 A 要移除
- CLI promote/demote 无 LastAdmin 保护（cli.py:1579-1620）
- 前端无 /admin 路由/页面/API 调用/路由守卫
- list_users 返回 list[UserResponse] 无 total，决策 4 要改 {items,total,page,per_page}
- 现有组件：BaseButton/BaseBadge/ConfirmDialog/Pagination 应该都有（T075/T079 用过），OverflowMenu 需确认是否存在
- admin 计数规则（决策 B）：COUNT(is_admin=True AND is_active=True)

## 特别关注

- 候选方案：本任务属 follows_existing_pattern（admin 端点复用 require_admin + AdminService 模式，前端复用现有组件），可只写 1 个候选方案，但必须列出参照文件（admin.py 现有端点模式 + EntryListView 前端列表模式）。或写 2 个候选（如：disable/enable 用独立端点 vs 用 PATCH /users/{id} 统一端点）权衡。
- migration 设计：审计字段 disabled_at/disabled_by/disabled_reason 加到 User 表，database.py migration 怎么写（参照现有 migration 模式）
- LastAdmin 逻辑：抽成共享 helper（_check_last_active_admin(session, target_user_id)）供 demote/disable/delete 复用，避免重复
- 自操作保护：抽成 helper（_check_self_operation(admin_id, target_id, action)）
- delete_self confirm_username 旁路移除：api/auth.py:240-249 怎么改（绝对拒绝，移除 confirm_username 参数还是保留参数但忽略？ architect 决策）
- 前端路由守卫：/admin 路由 meta 加 requiresAdmin，beforeEach 检查
- 前端 API client：新增 admin API 方法（listUsers/disableUser/enableUser/promoteUser/demoteUser/resetPassword/deleteUser）
- gate_commands：
  - P3: `make test-quick`（后端 pytest）或分前后端
  - P5: `make test-quick && make test-frontend && make typecheck`
  - P5_e2e: `make debug-test`（Playwright，ui_affected=true）
- ui_affected: true（新增 /admin 页面 + 交互）
- minimal_validation：本任务主要是纯代码逻辑（API + CLI + 前端组件），但前端路由守卫 + 软失效依赖现有 auth 机制——声明"纯代码逻辑，依赖 get_current_user 查库验 is_active + require_admin 现有机制"，或对"禁用后 JWT 软失效"做最小验证（已有 BDD-04 覆盖，P2 可声明 not_needed 因 auth.py:177 已证实）

## 产出路径

`docs/tasks/T080-admin-user-management/P2-design.md`

## 产出要求

- Header: phase=P2, task_id=T080-admin-user-management, trace_id=T080, type=design, parent=P1-requirements.md, status=draft, agent=architect
- 候选方案（1 或 2 个，follows_existing_pattern 须列参照文件）
- 四字段：packages / domains / ui_affected / gate_commands
- files_to_read（实现导航，只列确实需要参考的，大文件标行号）
- env_constraints（确认/细化 P0-brief）
- minimal_validation
- 方案覆盖 P1 全部 24 BDD + 8 CONFIRMED

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P2

路径：phase-cards/P2-design.md
---
# P2 — 方案设计

> 当前状态：[首次 / 重试 #N / 裁剪跳阶]
> 裁剪跳阶 → P2 不可裁剪。design_trivial / follows_existing_pattern 可简化（1 个候选方案），不可省略。

## 如果是首次进入本阶段

1. 派发 architect subagent → 产出 P2-design.md
   1.1 写 P2-dispatch-context-architect.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
2. 按 C8 映射表派评审（见下方）
3. 评审通过 → P2-review.md status: approved
4. 预跑 check-gate.sh P2（脚本化检查）
5. 更新 .state.yaml phase=P2 → P3
6. git add docs/tasks/{Txxx}/（含 .state.yaml + 产出文件，若 .gitignore 忽略需 git add -f）
7. git commit -m "wf({Txxx}-P2): {摘要}"

## 如果是重试

确认上一轮失败原因（方案选择有误 / 候选方案不足 / 评审 rejected）
→ 读 agate/rules/state-transitions.md 确认 retry 上限（P2 MAX=3）

## 前置条件

- [ ] P1-requirements.md 含 domains / risk_level / phases 声明
- [ ] P0-brief.md env_constraints 可查阅

## 派发

- **角色**：architect（`{agate_root}/assets/execution-roles/architect.md`）
- **输入**：P1-requirements.md + P0-brief.md
- **输出**：P2-design.md
- **派发 prompt 追加**：

```
## P2 最小验证
方案设计前，先用最小验证确认关键假设（10 行 HTML 测试页 / curl 请求 / 20 行脚本）。
验证结果写入 P2-design.md 的 minimal_validation 字段。
- 方案依赖浏览器行为/安全模型/外部系统行为 → 必须做最小验证
- 纯代码逻辑 → 须在 minimal_validation 字段声明 `纯代码逻辑，无外部系统依赖`（须写明依赖了哪些内部函数/数据转换）
```

## 产出规格

P2-design.md 必须包含：
- **候选方案 ≥2** + 权衡 + 选择理由（design_trivial / follows_existing_pattern 时可只写 1 个，见下方）
- **四字段**：`packages:` `domains:` `ui_affected:` `gate_commands:`
- **files_to_read**：实现时需要参考的文件清单（控制 P4 implementer 上下文）
- **env_constraints**：确认/细化 P0-brief 的环境约束
- **minimal_validation**：验证结果 或 声明"纯代码逻辑，无外部系统依赖"（声明时须附理由）

候选方案简化（须附理由，无理由视为无效声明，要求 ≥2 候选方案）：
- `design_trivial: true` + 理由（为什么 trivial）→ 可只写 1 个候选方案（P2 仍不可省略）
- `follows_existing_pattern: [src/foo.py]`（列出参照文件路径）→ 可只写 1 个候选方案，参照已有模式（P2 仍不可省略）

## gate_commands 声明

gate_commands 在 P2 固化，后续阶段按此执行：

```yaml
gate_commands:
  P3: "pytest"                  # 可选：测试运行器（verbose 输出，供 check-tdd-red.sh 自动读取）
  P5: "pytest -q --tb=no"       # 紧凑输出模式
  P5_e2e: "playwright test --reporter=line tests/e2e/"  # ui_affected: true 时必填
```

## 评审派发（C8 机械映射）

按 P1 声明的 domains + risk_level 机械映射评审：

| domain | risk_level | 必须派的评审 |
|--------|------------|------------|
| frontend | 任意 | plan-design-review |
| 任意 | high | plan-eng-review（硬规则，必须派独立 subagent） |
| P1-requirements.md 含 [NEED_CONFIRM] 且涉及业务方向 | 任意 | plan-ceo-review |

多个评审角色 `专家组并行` → 组长汇总 → P2-review.md（status: approved / rejected）。
详见 `agate/rules/review-mapping.md`。

**并行派发**（多个评审角色时）：
1. 同时派发所有触发的评审 subagent（每个一个 task 调用）
   > **操作方式**：在一个 assistant 消息中连续发起多个 task 工具调用（每个评审角色一个）。
   > 不要等前一个 task 返回再发下一个——那是串行，不是并行。
   > 平台会并行执行多个 task，全部返回后再进入下一步（派发组长汇总）。
2. 每个评审 subagent 各写一个 dispatch-context + 各自产出文件（示例非穷举，按 C8 映射表触发）：
   - plan-eng-review → P2-review-eng.md
   - plan-design-review → P2-review-design.md
   - plan-ceo-review → P2-review-ceo.md
   - cso → P2-review-cso.md
3. 所有评审返回后，派发组长汇总 subagent（角色：review + 指定为「专家组组长」）
4. 组长输入：所有评审文件路径
5. 组长产出：P2-review.md（统一 status: approved / rejected）。**组长 subagent 产出的 P2-review.md 的 Header agent 字段必须是组长角色名（非 main）——check-gate.sh P2 硬拦截 agent=main 的 approved**
6. 组长规则：
   - 不发表新意见，只汇总
   - 任何专家标 BLOCKER → status: rejected
   - 多位专家分歧 → 标「专家组分歧」交人工
   - 全票无 BLOCKER → status: approved

**单评审角色时**：直接派发，无需组长汇总，产出直接写 P2-review.md。

review 不通过 → architect 修改方案 → 再 review → … → approved（⑩迭代循环，review 和 gate 重试共享 retry 预算）

## gate 规则

```bash
check-gate.sh P2 $TASK_DIR
```

- 候选方案数 ≥2（design_trivial / follows_existing_pattern 时可只写 1 个）
- P2-review.md 存在且 status: approved（agent≠main）— 不存在 → gate exit 1
- 四字段齐全（packages/domains/ui_affected/gate_commands）
- gate_commands.P3 可选（非 pytest 项目建议声明，供 check-tdd-red.sh 自动读取测试运行器）
- 候选方案 ≥2 时含权衡/选择理由

## 推进条件（全部满足才写 phase: P3）

- [ ] P2-design.md 候选方案 ≥2（或 design_trivial/follows_existing_pattern 须附理由时可只写 1 个）+ 四字段齐全
- [ ] P2-review.md 存在且 status: approved（agent≠main）
- [ ] gate_commands.P5_e2e 已声明（ui_affected: true 时）

## 常见错误

1. **忘了最小验证**：方案依赖外部系统行为（API MIME 类型、浏览器 CSP 等）但直接假设前提成立 → 到 P6 才发现不可行。跑一个 curl / 10 行 HTML 就能 5 分钟发现
2. **gate_commands.P5 只列单元测试**：UI 任务时缺少 P5_e2e → P5 不会跑端到端验证
3. **files_to_read 列太多文件**：把所有相关文件都列上 → P4 implementer 上下文爆炸。只列确实需要参考的
4. **忘了派评审**：按 C8 映射机械执行，不靠"觉得不需要"
5. **gate 不过 ≠ 你失败了**：红灯指向工作/设计的问题，不指向你。正确动作是诊断→退回/重试/PAUSED，不是修改产出让它变绿。

## 下游影响

- P4 依赖 files_to_read 导航代码阅读范围
- P5 依赖 gate_commands 执行验证命令
- P6 依赖 ui_affected 判断是否需要 vision-helper
- gate_commands 在 P2 固化后 P4-P6 不能改——设计阶段是声明验证契约的唯一窗口

> 完成 → 读 phase-cards/P3-tdd.md
<!-- AGATE_CARD_END -->