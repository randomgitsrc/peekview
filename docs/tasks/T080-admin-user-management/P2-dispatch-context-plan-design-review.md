# P2 dispatch-context: plan-design-review

## 目标

评审 P2-design.md 的前端设计维度（交互状态覆盖/AI Slop 风险/移动端/可访问性）。产出 P2-review.md，status: approved/rejected/needs-revision。

## 约束

- 只审不写
- Header status: approved / rejected / needs-revision
- agent=plan-design-review（≠main）
- 评审结论引用 P2-design.md 的具体设计点 + BDD 编号
- 严禁触碰生产环境

## 上游关联

- P2-design.md：候选方案 A（独立 POST 端点）+ 前端 /admin 路由 + AdminView.vue + OverflowMenu + ConfirmDialog + BaseBadge 新增 disabled/admin variant
- P1-requirements.md：24 BDD（前端相关：BDD-01/02/03/05/06/07/08/12/13/14/15/20/21）
- DESIGN.md §6：BaseButton/BaseBadge/OverflowMenu/ConfirmDialog 规范

## 输入文件

1. `docs/tasks/T080-admin-user-management/P2-design.md` — 待评审的方案设计
2. `docs/tasks/T080-admin-user-management/P1-requirements.md` — 需求基线（核对前端 BDD 覆盖）
3. `/home/kity/.agate/assets/review-roles/plan-design-review.md` — 评审角色定义
4. `DESIGN.md` — §6 组件规则、移动端/可访问性规范
5. `frontend-v3/src/router.ts` — 现有路由 + beforeEach（核对 /admin 路由设计）
6. `frontend-v3/src/components/` — 现有组件（核对 OverflowMenu/ConfirmDialog/BaseBadge 是否存在 + 复用可行性）

## 评审维度（0-10 评分）

1. **交互状态覆盖率**：P2 spec 有没有写清 loading/error/empty/edge case 的 UI（用户列表加载中/加载失败/空列表/无权限/操作中/操作失败）
2. **AI Slop 风险**：spec 有没有给设计留"随便搞"的空间（OverflowMenu 内容、Badge variant、确认弹窗文案是否明确）
3. **移动端考虑**：/admin 页面移动端布局（OverflowMenu mobile bottom sheet、列表响应式、分页移动端）
4. **可访问性**：键盘导航、屏幕阅读器、alertdialog role、focus management

## 特别关注

- /admin 路由顺序（须在 /:slug 前，否则被通配符截获）—— P2 已标注风险，评审确认
- 非 admin 跳 /explore、未登录跳 /（决策 3）—— 评审跳转目标合理性
- OverflowMenu 操作项（禁用/启用/promote/demote/重置密码/删除）—— 评审是否齐全 + 状态联动（disabled 用户显示"启用"，active 显示"禁用"）
- ConfirmDialog 用于破坏性操作（删除/禁用/重置密码）—— 评审文案 + 确认流程
- BaseBadge 新增 disabled/admin variant —— 评审是否符合 DESIGN.md §6
- 24 BDD 的前端覆盖（BDD-01 列表分页、BDD-02 状态标记、BDD-14/15 路由守卫等）

## 产出路径

`docs/tasks/T080-admin-user-management/P2-review.md`

## 产出要求

- Header: phase=P2, task_id=T080-admin-user-management, type=review, parent=P2-design.md, status=draft→approved/rejected/needs-revision, agent=plan-design-review
- 四维度评分（0-10）
- 引用 P2-design.md 具体设计点 + BDD 编号
- approved/rejected/needs-revision 明确结论

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