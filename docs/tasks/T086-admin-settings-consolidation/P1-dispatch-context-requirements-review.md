---
phase: P1
task_id: T086-admin-settings-consolidation
type: dispatch-context
role: requirements-review
trace_id: T086-P1-20260807
created: 2026-08-07
---

# P1 派发指引 — requirements-review

## 目标

独立评审 `P1-requirements.md`（17 条 BDD，覆盖 admin/settings 信息架构收敛的功能对等、权限边界、路由删除、入口发现、移动端呈现、测试资产迁移、遗留引用回归 7 个分组）。重点核查：BDD 是否可二值判定、隐含需求维度是否覆盖完整、裁剪理由是否充分、risk_level 是否匹配实际风险。

## 约束

- 只审不写，不直接改 P1-requirements.md
- 结论必须引用具体 BDD 编号锚点（`#### BDD-NN:` 格式），裸 "approved" 不合格
- 重点核查以下两处 analyst 自行发现的、不在原始 dispatch-context 范围内的补充点是否合理：
  1. BDD-15/16 涉及的测试文件实际数量（analyst 声称 e2e/admin.spec.ts 实际是 8 个 test 而非 P0-brief 声称的 27 个；t080-admin-route-guard.test.ts 是 P0-brief 未提及的新发现文件）——需要你独立核实这个数字是否准确，而非直接采信 analyst 的复述
  2. 3 条 [SUGGEST] 倾向项是否确实不涉及业务方向判断、可由主 Agent 直接采纳（router.ts 死代码清理放 P4 / t080 测试文件重写而非新建删旧 / UserMenu 入口复用 Settings 而非新增按钮）

## 上游关联

parent: P1-requirements.md（analyst 产出，本次评审对象）
祖先: P0-brief.md（含用户已拍板的三点决策，评审时核对 BDD 是否忠实转译了这三点决策，而非引入新解读）

## 输入文件（按顺序读取）

1. `docs/tasks/T086-admin-settings-consolidation/P1-requirements.md`（评审对象）
2. `docs/tasks/T086-admin-settings-consolidation/P0-brief.md`（核对 BDD 是否忠实于用户已拍板决策）
3. `docs/tasks/T086-admin-settings-consolidation/P1-dispatch-context-analyst.md`（核对 analyst 是否覆盖了派发指引要求的所有隐含需求维度）
4. `frontend-v3/e2e/admin.spec.ts`（独立核实 test 数量，不要直接采信 P1-requirements.md 的复述）
5. `frontend-v3/src/__tests__/t080-admin-route-guard.test.ts`（独立核实其测试的是路由级 guard 而非 tab 级）
6. `frontend-v3/src/router.ts`（核对 BDD-8/9/10 关于 /admin 一律 404 的判断是否与当前路由结构一致）

## 客观查证信息

- 用户在 P0 阶段已拍板三点：①完全合并 ②删除 /admin 不做 redirect ③tab 可见性 isAdmin 判断 + 非 admin 回退 profile。评审时核对 P1 的 17 条 BDD 是否忠实转译了这三点，没有引入偏离拍板方向的新解读
- risk_level 声明为 medium，理由是路由守卫从路由级迁移到组件级 + 跨 7 个文件 + 双重测试资产语义级迁移，需评估这个定级是否合理（是否应该是 high，因为涉及权限边界；或是否 medium 已经足够）

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

**NEED_CONFIRM 分级**：
- `[SUGGEST: 推荐 X，理由 Y]` - 有倾向但求确认。主 Agent 可自行采纳倾向（除非涉及破坏性变更/业务方向），不必问用户
- `[NEED_CONFIRM]` - 真无方向需人定夺。阻塞推进，主 Agent 问用户

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


## P1 基线保护

P1-requirements.md 是需求基线，后续阶段（P2-P8）不应直接修改。如需变更（如 P4 发现 BDD 矛盾需补充注释），必须：
1. 主 Agent 显式批准
2. 在变更处标注 `[BASELINE_CHANGE: 理由]`
3. 不改 BDD 的 Given/When/Then 语义（只补充注释/优先级说明）
<!-- AGATE_CARD_END -->
