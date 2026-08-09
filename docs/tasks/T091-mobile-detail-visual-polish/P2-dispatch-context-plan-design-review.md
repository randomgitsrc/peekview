---
phase: P2
task_id: T091-mobile-detail-visual-polish
role: plan-design-review
---

# 派发指引 — T091 P2 方案设计评审（C8 机械映射：domains=[frontend] 触发）

## 目标

评审 `P2-design.md`（1 个 `follows_existing_pattern` 候选，5 处 DESIGN.md 精确修订，T090 遗留 E2E 处理决定）。方案本身已在 P0-brief/P1 与用户定型，评审重点是技术执行细节是否经得起推敲。

## 必读输入文件

1. `docs/tasks/T091-mobile-detail-visual-polish/P2-design.md`（待评审主文件）
2. `docs/tasks/T091-mobile-detail-visual-polish/P1-requirements.md`（核对候选方案是否真的覆盖全部 13 条 BDD）
3. `frontend-v3/e2e/t090-mobile-detail-ux-polish.spec.ts` L285-326（核对第 4 节声称的 BDD-7/BDD-8 断言冲突是否真实存在）
4. `scripts/run-e2e-tests.sh`（核对 `E2E_SPEC=e2e/t09` 子串匹配这个 gate_commands 决定是否真的按架构师描述的方式工作）
5. `frontend-v3/src/components/EntryDetailHeader.vue`（核对 `.icon-btn` 的 tooltip 行为，见下方重点检查项 4）

## 重点检查项

1. **T090 遗留 E2E 冲突判断是否准确**：第 4 节声称 BDD-7（Wrap class 断言）和 BDD-8（markdown-body inset 缩减比例断言）会被本次改动直接证伪，请读源码核实这个判断是否站得住（不是走个形式，是真的去读 t090 spec 那两段代码，确认断言逻辑和声称的一致）
2. **`E2E_SPEC=e2e/t09` 子串匹配方案是否可靠**：架构师核实了 `run-e2e-tests.sh` L89 用相对路径子串匹配、且当前目录内只有 t090/t091 两个文件匹配 `t09` 前缀——请独立核实这个判断（`ls frontend-v3/e2e/` 看一眼实际文件列表），并评估这种"子串匹配"策略本身的脆弱性是否可以接受（比如未来如果加了 `t092-xxx.spec.ts` 也会被误匹配进来，这是否算作可接受的技术债，还是应该要求更精确的写法如 `{t090,t091}` glob 或分号分隔的显式列表）
3. **Copy 按钮 tooltip 行为是否遗漏**：DESIGN.md 的 Icon Buttons 章节（L158-159）明确"Use `.icon-btn` (square)... Tooltip on hover"，但 P2-design.md 新增本地 `.icon-btn` 的设计里，第 1 节改动清单没有明确提到是否包含 hover tooltip（对照 `EntryDetailHeader.vue` 桌面端 `.icon-btn` 是有 `.tooltip` span 配套的）——核实这是设计遗漏还是移动端场景本来就不需要 hover tooltip（移动端没有 hover 概念，这个理由如果成立需要在设计文档里明确写出来，不能是隐含假设）
4. **minimal_validation 的 svg-standalone 替代决定是否真的不构成 [BASELINE_CHANGE]**：核实这个论证（"测试 entry 选择是 P2/P4 实现细节，不是 P1 需求本身"）是否站得住，不要想当然接受
5. **candidate_count=1 的理由是否充分**：核实"5 个子改动共享同一设计原则，作为单一候选呈现"这个论证是否合理，还是应该按问题点拆分成多个独立候选（哪怕最终选择都一样）

## 评分维度（角色定义已列出，逐项打分）

- 交互状态覆盖率、AI Slop 风险、移动端考虑、可访问性、组件完整性

## 门槛（什么算完成）

- 产出 P2-review.md，Header `status:` 字段准确反映结论
- 5 项重点检查逐一核实
- 若 approved，需说明以上重点检查均已核实通过

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
- **`candidate_count: N` 必填**：本方案候选方案数（≥2，design_trivial/follows_existing_pattern 时可 1），gate 按此字段校验，不再解析标题。你写几个候选就填几个，与正文一致。
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
