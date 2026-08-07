---
phase: P2
task_id: T086-admin-settings-consolidation
type: dispatch-context
role: architect
trace_id: T086-P2-20260807
created: 2026-08-07
---

# P2 派发指引 — architect

## 目标

为 T086（17 条 BDD，见 P1-requirements.md）设计实现方案：AdminView.vue 内容迁移为 UserManagerTab.vue（settings 第 4 个 tab）、路由守卫从路由级迁移到组件级、UserMenu 加 admin 入口、删除 /admin 路由、迁移 admin.spec.ts 和 t080-admin-route-guard.test.ts 两个测试资产。

## 约束

- P1 已声明 `follows_existing_pattern`（settings 已有 `?tab=` 机制 + `/settings/apikeys` redirect 先例），**可只写 1 个候选方案**，但仍需按方案探索方法论过一遍（列 2-3 个可能方向，说明为什么选定这个而非其他），不能跳过探索直接下笔
- gate_commands 在本阶段固化，后续阶段不得修改。`ui_affected: true`（本任务是纯 UI/路由改动），`gate_commands.P5_e2e` 必填
- P1-review.md 的 Advisory Note 已指出一个需要在方案里明确落地的点：无论 UserMenu 入口是新增按钮还是复用现有 "Settings" 跳转项，admin 用户点击后的**落地 tab 必须是 user-manager**（对应 BDD-11 硬性验收点），方案中必须显式处理，不能因为采纳"复用 Settings 入口"的 SUGGEST 而弱化这一点
- P1-review.md 已标注 3 条 SUGGEST 中 2 条可直接采纳（router.ts 死代码清理放本任务一并处理；t080-admin-route-guard.test.ts 原地重写而非新建删旧），architect 设计时按此采纳，不必重新论证
- 权限边界是本任务核心风险点（BDD-4/5/6/12/13/14）：桌面 tab-nav 可见性、移动端堆叠区块可见性、非 admin 手动访问 tab 的回退，三处判断逻辑必须一致（同一个 isAdmin 来源，不要出现三处独立判断导致不同步的风险）
- minimal_validation：本任务是否需要最小验证由你判断——若认为纯代码逻辑（Vue 组件结构调整 + 路由配置删除），声明"纯代码逻辑，无外部系统依赖"并写明依赖的内部函数/数据（如 authStore.isAdmin 的来源）；若认为涉及浏览器路由行为需要验证，则做最小验证

## 上游关联

parent: P1-requirements.md（需求基线，17 条 BDD）
祖先: P0-brief.md（含用户已拍板三点决策 + 现状审计表）

## 输入文件（按顺序读取）

1. `docs/tasks/T086-admin-settings-consolidation/P1-requirements.md`（需求基线，17 条 BDD + 隐含需求表 + 范围声明）
2. `docs/tasks/T086-admin-settings-consolidation/P1-review.md`（评审意见，尤其 Advisory Note 和 Correction Note）
3. `docs/tasks/T086-admin-settings-consolidation/P0-brief.md`（现状审计表 + 改动清单方向）
4. `frontend-v3/src/router.ts`（当前路由定义 + requiresAdmin guard 实现）
5. `frontend-v3/src/views/SettingsView.vue`（现有 tab 机制：activeTab computed / validTabs / 移动端堆叠区块结构）
6. `frontend-v3/src/views/AdminView.vue`（待迁移的完整内容）
7. `frontend-v3/src/components/UserMenu.vue`（当前 dropdown 结构）
8. `frontend-v3/e2e/admin.spec.ts`（8 个既有测试场景，迁移时的断言变化点）
9. `frontend-v3/src/__tests__/t080-admin-route-guard.test.ts`（5 个 it，迁移为 tab 级守卫测试）
10. `frontend-v3/src/stores/auth.ts`（确认 isAdmin 的权威来源，供三处可见性判断复用同一数据源）

## 客观查证信息（已由 P1 核实，直接引用不需重新验证）

- e2e/admin.spec.ts 实际是 8 个 test() 调用点（非 P0-brief 声称的 27 个），desktop+mobile 两个 viewport 循环运行 6 个，独立运行 2 个（BDD-14/15）
- t080-admin-route-guard.test.ts 实际是 5 个 it()（非 P1-requirements.md 隐含需求表声称的 4 个），自建 mock router 不依赖真实 router.ts
- 后端 `/api/v1/admin/*` 全部保留 `require_admin`，本任务不改后端——即使前端可见性判断有缺陷，后端仍是纵深防御的最后一道（P1-review.md 用此论证 risk_level=medium 而非 high 的合理性）
- CSS 变量：AdminView.vue 用旧命名（`--text-primary` 等），SettingsView.vue 用新命名（`--c-text` 等），已确认旧命名是新命名的完整别名层，迁移时组件样式可直接沿用

## 裁剪倾向（P1 已声明，architect 据此设计）

- P3：保留，权限边界逻辑（BDD-4/5/6/12/13/14）需要红灯
- P6：不可省，UI 改动必须 Playwright 截图（admin/非admin/移动端）
- P7：保留，7 个文件级改动点

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
