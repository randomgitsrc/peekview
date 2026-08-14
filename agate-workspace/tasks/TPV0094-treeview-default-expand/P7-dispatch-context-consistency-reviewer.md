---
phase: P7
task_id: TPV0094-treeview-default-expand
type: consistency
parent: P2-design.md
trace_id: TPV0094-P7-20260815
status: draft
---

# P7 派发上下文 — consistency-reviewer

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
5. git add {AGATE_WORKSPACE}/tasks/{Txxx}/（含 .state.yaml + 产出文件，若 .gitignore 忽略需 git add -f）
   ⚠️ 此时 .state.yaml 的 phase 保持 P7，不要提前写 P8——phase = 本 commit 的产出阶段
6. git commit -m "wf({Txxx}-P7): {摘要}"（phase=P7，P7 产出含 P7-consistency.md）
7. P7 commit 完成后进入 P8：**phase 推进 P8 随 P8 产出 commit 一起**（P8-release.md 就绪后），不是单独 phase commit

## 如果是重试

→ 读 agate/rules/state-transitions.md 确认 retry 上限（P7 MAX=2）

## 前置条件

- [ ] P1-P6 全部产出文件就绪

## 执行方式

consistency-reviewer subagent 执行。检查清单：

1. **DESIGN_GAP 配对**：P4-implementation.md 中的 DESIGN_GAP 声明 → 必须在 P7-consistency.md 中逐条转抄 + 配 REVIEWED 标记。未配对 → gate 不通过
2. **SCOPE+ 闭环**：P1-requirements.md 有 [SCOPE_RESOLVED] 标记，确认所有 SCOPE+ 增补已纳入基线
3. **跨文件一致性**：P2 声明的 packages 与 P8 release 的 bump 范围一致？P1 的 BDD 和 P6 的验收结果数量匹配？P4 的实现路径和 P2 的方案设计吻合？
4. **未决项清零**：P1-requirements.md 无残留行首 [NEED_CONFIRM]（P6 不再有 NEED_CONFIRM）、[BLOCKER]、[DEVIATION-CRITICAL]

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

`blocker_count`/`deviation_count`/`deviation_critical_count`/`design_gap_count`/
`design_gap_reviewed_count` 写在文件头 **frontmatter**（`---` 分隔块），不写正文；正文
`[BLOCKER]`/`[DEVIATION-CRITICAL]`/`[DESIGN_GAP]`/`[DESIGN_GAP_REVIEWED]` 散文标记保留为
人类痕迹（不迁移），gate 判定改读 frontmatter 结构化计数。**可直接复制的完整样例**：
```yaml
---
phase: P7
task_id: TAG0001           # 替换为实际任务编号
type: consistency
parent: P2-design.md
trace_id: T001-P7-20260101 # {task_id}-P7-{YYYYMMDD}
status: draft
created: 2026-01-01
agent: consistency-reviewer
# ── v2.0 机器计数 ──
blocker_count: 0                  # int ≥0
deviation_count: 0                # int ≥0
deviation_critical_count: 0       # int ≥0
design_gap_count: 0                # int ≥0
design_gap_reviewed_count: 0       # int ≥0
---
```

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

## 目标

对 TPV0094 做跨文件一致性审查（P1↔P6↔P2↔P4），产出 `P7-consistency.md`（无 BLOCKER / 无 DEVIATION-CRITICAL / DESIGN_GAP 配对 / SCOPE+ 闭环）。

## 特别关注点（主 Agent 指定）

1. **[SCOPE+] 闭环**：P2-design.md §设计声明处有 `[SCOPE+] 新增 frontend-v3/scripts/measure-treeview-perf.ts（红线实测承载）`——但该文件**未在 frontend-v3/scripts/ 下创建**（P4 未写，P6 用 `P6-evidence/scripts/p6-redline-bench.ts` 临时脚本完成了红线实测，BDD-8 已 PASS）。
   - 判定：这是否构成 [DEVIATION]（P2 声明了脚本但未落地）？红线实测目标已达成（BDD-8 PASS + 证据 redline-results.json），脚本位置差异是否影响验收结论？
   - 处理建议：若判定为非核心偏差 → 标 `[DEVIATION]`（非阻塞）+ `[SUGGEST: 保留 P6-evidence/scripts/p6-redline-bench.ts 作为红线实测工具，P8 可不补 frontend-v3/scripts/ 正式脚本（除非未来调阈值需要）]` 或建议 P8 补正式脚本——由你判定
2. **P1 BDD ↔ P6 结果**：P1 有 8 条 BDD（BDD-1~8），P6 有 8 条 PASS——逐条核对内容映射正确（非仅数量）
3. **P2 packages ↔ P4 改动**：P2 packages 含 TreeView.vue + TreeView.spec.ts + e2e spec + measure-treeview-perf.ts；实际改动 = TreeView.vue（P4）+ TreeView.spec.ts/e2e spec（P3）+ P6-evidence 脚本——核对一致性
4. **实现路径 ↔ 设计**：P4 实现（resetExpansion 二分 + shouldCollapse + banner）vs P2 §2/§3 定稿——逐条核对（P4-review 已 approved，但 P7 独立复核）
5. **未决项清零**：P1 无残留 NEED_CONFIRM（[NO_NEED_CONFIRM] 已声明）；3 条 SUGGEST 均已在 P2 §3 定稿
6. **红线阈值**：P6 实测 2000（297ms）保持 DEFAULT_EXPAND_THRESHOLD=2000——与 P2 §8 判定标准一致

## 输入文件

1. `agate-workspace/tasks/TPV0094-treeview-default-expand/P1-requirements.md`（8 BDD + SUGGEST）
2. `agate-workspace/tasks/TPV0094-treeview-default-expand/P2-design.md`（§2 候选 A / §3 定稿 / §8 红线协议 / [SCOPE+] 声明）
3. `agate-workspace/tasks/TPV0094-treeview-default-expand/P3-test-cases.md`（测试映射）
4. `agate-workspace/tasks/TPV0094-treeview-default-expand/P4-implementation.md`（实现 + retry1 修复）
5. `agate-workspace/tasks/TPV0094-treeview-default-expand/P5-test-results/`（技术验证）
6. `agate-workspace/tasks/TPV0094-treeview-default-expand/P6-acceptance.md`（验收结果 + 红线实测）
7. `frontend-v3/src/components/TreeView.vue`（实际实现）
8. `AGENTS.md`

## 约束

1. 产出 `P7-consistency.md` 到 `agate-workspace/tasks/TPV0094-treeview-default-expand/`，Header：
   ---
   phase: P7
   task_id: TPV0094-treeview-default-expand
   type: consistency
   parent: P2-design.md
   trace_id: TPV0094-P7-20260815
   status: draft
   created: 2026-08-15
   agent: consistency-reviewer
   # ── v2.0 机器计数 ──
   blocker_count: 0
   deviation_count: 0
   deviation_critical_count: 0
   design_gap_count: 0
   design_gap_reviewed_count: 0
   ---
2. **实质锚点**：跨文件检查项引用源文件节名（P1§BDD / P2§2 / P4§impl / P6§验收 等）
3. 只读：不得修改任何产出文件
4. 状态标记 `[PROD_NOT_TOUCHED]`
5. 分阶段落盘：追加 `P7-progress.md`

## 返回

路径 + 一句话摘要（BLOCKER 数 / DEVIATION 数 / DESIGN_GAP 配对情况）。
