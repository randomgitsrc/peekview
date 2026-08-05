# P7 dispatch-context: consistency-reviewer

## 目标
跨文件一致性审查 P1-P6 产出，产出 P7-consistency.md。检查 DESIGN_GAP 配对 + SCOPE+ 闭环 + 跨文件一致性 + 未决项清零。

## 约束
- 以批判第三方视角，假设 P2 设计可能有错
- 逐项找实现与设计偏差
- 严禁碰 :8080/~/.peekview/
- [PROD_NOT_TOUCHED]

## 检查清单
1. DESIGN_GAP 配对：P4-implementation.md 4 个 DESIGN_GAP → P7 逐条转抄 + [DESIGN_GAP_REVIEWED: 已解决]
2. SCOPE+ 闭环：P1-requirements.md 无 [SCOPE+]（P4 报告无 SCOPE+），确认无增补
3. 跨文件一致性：
   - P2 packages (backend/peekview, frontend-v3) vs P8 release 范围
   - P1 24 BDD vs P6 24 PASS 数量匹配
   - P4 实现路径 vs P2 方案设计吻合
4. 未决项清零：全阶段无残留 [NEED_CONFIRM]/[BLOCKER]/[DEVIATION-CRITICAL]，[NO_NEED_CONFIRM] 存在

## P4 的 4 个 DESIGN_GAP（须配对 REVIEWED）
1. [DESIGN_GAP: BDD-06 与 BDD-10 测试预期矛盾] → 决策 C LastAdmin 优先，已解决
2. [DESIGN_GAP: test_admin_cannot_delete_self 与 BDD-23 矛盾] → 决策 C，已解决
3. [DESIGN_GAP: BDD-24 与 BDD-17/18 矛盾] → 决策 D CLI 加 LastAdmin，已解决
4. [DESIGN_GAP: BDD-01 rate limit 环境问题] → 决策 E 直接插 DB，已解决

## 输入文件
1. P1-requirements.md（24 BDD + 8 CONFIRMED + [NO_NEED_CONFIRM]）
2. P2-design.md（候选方案 A + packages + gate_commands）
3. P4-implementation.md（实现清单 + 4 DESIGN_GAP + [DESIGN_GAP_REVIEWED: 已解决]）
4. P5-test-results/unit.md + e2e.md
5. P6-acceptance.md（24/24 PASS）
6. P4-review.md + P4-review-*.md（3 评审 + review-lead approved）

## 产出
docs/tasks/T080-admin-user-management/P7-consistency.md
Header: phase=P7, type=consistency, parent=P6-acceptance.md, status=draft, agent=consistency-reviewer

双向检查：设计→实现 + 实现→设计。每条 DESIGN_GAP 原始标记行 + REVIEWED 标记行。

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P7

路径：phase-cards/P7-consistency.md
---
# P7 — 一致性检查

> 当前状态：[首次 / 重试 #N / 裁剪跳阶]
> 裁剪跳阶 → 确认 P1 phases 不含 P7 + 源文件数 ≤5 + 无 implicit_coupling + 有 coupling_checklist（须列出至少 2 个已检查的耦合点，空清单不合规）→ 跳过，读 P8 卡片
> ⑨ P7 subagent 化

## 如果是首次进入本阶段

1. 主 Agent 派发 consistency-reviewer subagent 执行交叉检查
   1.1 写 P7-dispatch-context-consistency-reviewer.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
2. 对照 P1-P6 产出做跨文件一致性审查
3. 产出 P7-consistency.md
4. 预跑 check-gate.sh P7
5. 更新 .state.yaml phase=P7 → P8
6. git add docs/tasks/{Txxx}/（含 .state.yaml + 产出文件，若 .gitignore 忽略需 git add -f）
7. git commit -m "wf({Txxx}-P7): {摘要}"

## 如果是重试

→ 读 agate/rules/state-transitions.md 确认 retry 上限（P7 MAX=2）

## 前置条件

- [ ] P1-P6 全部产出文件就绪

## 执行方式

consistency-reviewer subagent 执行。检查清单：

1. **DESIGN_GAP 配对**：P4-implementation.md 中的 DESIGN_GAP 声明 → 必须在 P7-consistency.md 中逐条转抄 + 配 REVIEWED 标记。未配对 → gate 不通过
2. **SCOPE+ 闭环**：P1-requirements.md 有 [SCOPE_RESOLVED] 标记，确认所有 SCOPE+ 增补已纳入基线
3. **跨文件一致性**：P2 声明的 packages 与 P8 release 的 bump 范围一致？P1 的 BDD 和 P6 的验收结果数量匹配？P4 的实现路径和 P2 的方案设计吻合？
4. **未决项清零**：全阶段产出文件中无残留的 [NEED_CONFIRM]、[BLOCKER]、[DEVIATION-CRITICAL]；检查 `[NO_NEED_CONFIRM]` 存在性

## 实质锚点要求（N3⑨）

| gate 断言 | 实质锚点（P7 产出须包含） |
|-----------|--------------------------|
| BLOCKER=0 | DESIGN_GAP 配对项 + REVIEWED 标记 |
| CRITICAL=0 | 跨文件检查项 + 源文件节名 |
| SCOPE+ 闭环 | 条目 + SCOPE_RESOLVED |

gate 脚本校验说明：
- DESIGN_GAP_REVIEWED：P4 声明的每条 DESIGN_GAP 在 P7 产出中须有对应行含 `DESIGN_GAP_REVIEWED`
- 跨文件引用关键词：P7 产出中须含源文件节名（如 `P2§packages`、`P4§impl-path`），否则 WARNING

## 产出规格

- P7-consistency.md：一致性审查结论
- 逐条检查结果，无 [BLOCKER] 标记

## gate 规则

```bash
check-gate.sh P7 $TASK_DIR
```

- [BLOCKER] 存在 → exit 1
- [DEVIATION-CRITICAL] 存在 → exit 1
- DESIGN_GAP 未配对（P4 有但 P7 无 REVIEWED）→ exit 1
- 含 DESIGN_GAP_REVIEWED 但缺跨文件引用关键词 → WARNING（不改变 exit code）
- 全部通过 → exit 0

BLOCKER → consistency-reviewer 修改 → 再验 gate → … → 通过（⑩迭代循环，review 和 gate 重试共享 retry 预算）

## 推进条件（全部满足才写 phase: P8）

- [ ] P7-consistency.md 存在
- [ ] 无 [BLOCKER] / [DEVIATION-CRITICAL]
- [ ] DESIGN_GAP 全部 REVIEWED 配对
- [ ] SCOPE+ 闭环（P1 有 [SCOPE_RESOLVED]）

## P7 输入文件数量

P7 是输入文件数量限制的例外，不拆分。原因：
1. 跨文件一致性比较需要全部源文件同时可见
2. 角色文件（consistency-reviewer）已列出所需输入清单
3. dispatch-context 为 subagent 提供摘要，无需逐文件全文注入

## 常见错误

1. **漏转抄 P4 的 DESIGN_GAP**：P4 implementer 声明了实现偏差但 P7 没转抄 → gate 拦截
2. **一致性检查只看标题不对内容**：P1 BDD 数 = 15，P6 PASS 数 = 15 → 数量对，但 BDD-8 的内容在 P6 里被映射到错误的验收结果
3. **裸 'BLOCKER=0' 不引用锚点**：未做实质交叉检查，只写 '一致' → gate WARNING 提醒

gate 不过 ≠ 你失败了。红灯指向工作/设计的问题，不指向你。正确动作是诊断→退回/重试/PAUSED，不是修改产出让它变绿。

## 下游影响

- P8 发布前最后一道质量门——P7 通过后进入机械发布步骤

> 完成 → 读 phase-cards/P8-release.md
<!-- AGATE_CARD_END -->