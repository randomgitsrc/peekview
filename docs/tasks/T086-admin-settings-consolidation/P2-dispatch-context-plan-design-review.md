---
phase: P2
task_id: T086-admin-settings-consolidation
type: dispatch-context
role: plan-design-review
trace_id: T086-P2-20260807
created: 2026-08-07
---

# P2 派发指引 — plan-design-review

## 目标

评审 `P2-design.md`（架构方案：SettingsView tab computed 化 + 三处统一 isAdmin 判断 + UserManagerTab 迁移 + UserMenu 动态落地 tab）。这是本任务唯一触发的评审角色（domain=frontend 触发 plan-design-review；risk_level=medium 不触发 plan-eng-review；P1 无涉及业务方向的 NEED_CONFIRM 不触发 plan-ceo-review），评审通过后直接产出 `P2-review.md`（不需要组长汇总）。

## 约束

- 按角色定义的 5 个评分维度逐项评分（交互状态覆盖率 / AI Slop 风险 / 移动端考虑 / 可访问性 / 组件完整性）
- 重点核查两处方案自己承认的风险点是否有足够缓解：
  1. §2"风险在哪"提到的"移动端多实例挂载放大"（admin 每次打开 /settings 会多触发一次 api.listUsers，即便只看 profile tab）——评审需判断这是否需要在本任务范围内处理，还是可以合理地记为 backlog（方案理由是"现状既有模式的自然延伸，非本任务引入的新问题类别"）
  2. §3.6 中标注的 `[DESIGN_GAP: t080 的 15b/15c 是 loading→resolve 时序测试，路由级迁移后是否还需要保留]`——这是方案主动暴露的未决点，留给 P4 implementer 判断 + P7 审查，评审需确认这个处理方式（留到 P4 而非现在解决）是否合理，而不是要求方案现在就给出答案
- 核查三处权限判断（桌面 tab-nav / 移动端堆叠 / activeTab 回退）是否真的复用同一数据源（§3.2 已给出代码片段，需要你独立判断这三处逻辑是否会同步失效或存在遗漏分支）
- 核查 BDD-11/12（UserMenu 入口）的设计（§3.4，复用 Settings 按钮但动态改变落地 tab）是否真的满足 P1-review 的 Advisory Note 硬性要求（落地 tab 必须是 user-manager）

## 上游关联

parent: P2-design.md（架构方案，本次评审对象）
祖先: P1-requirements.md（17 条 BDD）+ P1-review.md（Advisory Note 硬性要求）

## 输入文件（按顺序读取）

1. `docs/tasks/T086-admin-settings-consolidation/P2-design.md`（评审对象）
2. `docs/tasks/T086-admin-settings-consolidation/P1-requirements.md`（核对方案是否覆盖全部 17 条 BDD）
3. `docs/tasks/T086-admin-settings-consolidation/P1-review.md`（核对 Advisory Note 硬性要求是否被方案满足）
4. `frontend-v3/src/views/SettingsView.vue`（现状代码，核对方案描述的现状是否准确）
5. `frontend-v3/src/components/UserMenu.vue`（现状代码，核对 §3.4 改动描述是否准确）

## 客观查证信息

- 本任务 ui_affected: true，是纯前端改动，无 loading/error 网络状态的新增交互（UserManagerTab 迁移自 AdminView，网络请求逻辑不变），移动端布局在方案 §3.2 已给出具体 v-if 处理
- 可访问性维度：方案 §3.2 强调"DOM 中不存在"而非"仅样式隐藏"（对应 BDD-5/9/10/14 的硬性要求），这是本任务对可访问性/信息泄露维度的主要处理方式

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

**UI 测试选择器**：涉及前端时，P2 design 建议声明 UI 组件的稳定测试标识清单（如 `data-testid`，而非 class 命名）。P3 test-designer 用稳定标识定位元素，P4 implementer 按清单实现--class 命名可重构，稳定标识不变。具体方案由 P2 architect 决定。

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
