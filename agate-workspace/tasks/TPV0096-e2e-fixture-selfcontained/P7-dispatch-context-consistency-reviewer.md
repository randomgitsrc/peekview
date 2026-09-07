# P7-dispatch-context-consistency-reviewer — TPV0096

---
phase: P7
generated_by: agate-inject-card.py + 主 Agent
task_id: TPV0096
role: consistency-reviewer
---

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
4. 预跑 check-gate.py P7
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
5. **CODE-MAP 核对**：对照 `{AGATE_WORKSPACE}/agents/CODE-MAP.md` 与 P4「新增文件核对表」逐条核对，发现依赖方向偏离标 `[CODE_MAP_DRIFT:]`（WARNING 级，不阻断）；核对通过标 `[CODE_MAP_SYNC:]`

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
`design_gap_reviewed_count`/`code_map_new_files_count`/`code_map_reviewed_count` 写在文件头
**frontmatter**（`---` 分隔块），不写正文；正文
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
code_map_new_files_count: 0        # int ≥0（可选，仅骨架/CODE-MAP 机制已采用时填）
code_map_reviewed_count: 0         # int ≥0（可选，语义对应 design_gap_reviewed_count）
---
```

## gate 规则

```bash
check-gate.py P7 $TASK_DIR
```

- [BLOCKER] 存在 → exit 1
- [DEVIATION-CRITICAL] 存在 → exit 1
- DESIGN_GAP 未配对（P4 有但 P7 无 REVIEWED）→ exit 1
- CODE-MAP 未配对（code_map_reviewed_count < code_map_new_files_count，或 P4 实际标记数 > code_map_new_files_count）→ exit 1（两字段均缺失时机制未采用，跳过）
- 含 DESIGN_GAP_REVIEWED 但缺跨文件引用关键词 → WARNING（不改变 exit code）
- 全部通过 → exit 0

BLOCKER → consistency-reviewer 修改 → 再验 gate → … → 通过（⑩迭代循环，review 和 gate 重试共享 retry 预算）

## 推进条件（全部满足才写 phase: P8）

- [ ] P7-consistency.md 存在
- [ ] 无 [BLOCKER] / [DEVIATION-CRITICAL]
- [ ] DESIGN_GAP 全部 REVIEWED 配对
- [ ] SCOPE+ 闭环（P1 有 [SCOPE_RESOLVED]）

## P7 输入文件数量

P7 是输入文件数量限制的例外（模式 1 单发 + 输入数量豁免特例，见 dispatch-protocol「派发编排机制」全阶段适用表），不拆分。原因：
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

跨文件一致性审查（P1→P6.5 全链产出），产出 P7-consistency.md（frontmatter 机器计数 + 正文散文标记）。

## 约束

- 检查清单（P7 卡五项 + 本任务特定锚点）：
  1. **DESIGN_GAP 配对**：P4-implementation.md 明文声明「无 [DESIGN_GAP:]」——核对属实后 design_gap_count: 0 / design_gap_reviewed_count: 0；如发现 P4 正文另有散落的 DESIGN_GAP 类标记则逐条转抄配对
  2. **SCOPE+ 闭环**：P1 §2.1 有 [SCOPE+ from P1]（死选择器）与行首 [SCOPE_RESOLVED: …]（主 Agent 2026-09-07 采纳，含 [BASELINE_CHANGE] 闭环标注）——核对标记存在、指向一致、P2/P4/P6 落点可追溯（P2 §1.1 M1/M3 表 → P4 改动 → P6 BDD-7 PASS → P6.5 复核）
  3. **跨文件一致性**：P1 BDD 总数（13）= P6-acceptance PASS+FAIL 行数（13）；P2 packages [frontend-v3, docs] 与实际改动文件（3 spec + debug-workflow.md）一致；P2 §6 gate_commands 与 P5-test-results 执行记录、P6-evidence 引用同源；P8 预期无 bump（纯测试改动）——核对 P1 §7 裁剪声明、P0 裁剪倾向、P6 frontmatter 三处口径一致
  4. **未决项清零**：P1/P6 无行首 [NEED_CONFIRM]（P1 为 [NO_NEED_CONFIRM]）、无 [BLOCKER]、无 [DEVIATION-CRITICAL]
  5. **CODE-MAP**：查 {AGATE_WORKSPACE}/agents/CODE-MAP.md 是否存在——存在则按 P4 新增文件核对表逐条核对（本任务预计无新增文件，只有改造）；不存在则标机制未采用，跳过
  6. **收尾闭环核对（主 Agent 指定）**：debt/tech-debt.md 新增 DEBT0011（t022/verify-mermaid 同型缺陷延后 = P1 SUGGEST-4 闭环）、DEBT0012（seed 422 预存缺陷 = P6.5 judge 保留项②闭环）——核对两条登记与 P1 §8.4 延后倾向、judge verdict 第 4 节保留项的对应关系
- 只审不写（debt/tech-debt.md 由主 Agent 已写好，你只核对）；产出 P7-consistency.md
- 发现不一致 → [BLOCKER]/[DEVIATION-CRITICAL]（正文标记 + frontmatter 计数）；轻微偏离 → [DEVIATION]（deviation_count）
- 跨文件引用必须带节名锚点（如 `P2§packages`、`P6§frontmatter`），否则 gate WARNING
- 纯文档审查：不跑测试、不启服务；允许 grep/read/git log（timeout 30s）
- 严禁 :8080 与 ~/.peekview/；子派发能力：不启用

## 上游关联

- P6.5 judge passed 13/13（commit 04e0456e）；judge 保留项①（BDD-3 run2 退出码链截断，组合证据判定）已在 verdict 第 4 节留痕——如你认定需 [DEVIATION] 记录，计入 deviation_count 并给理由
- 主 Agent 已完成：P1 [SCOPE_RESOLVED] 闭环标记、DEBT0011/0012 登记

## 输入文件

- agate-workspace/tasks/TPV0096-e2e-fixture-selfcontained/ 下 P0/P1/P2/P3/P4/P5-test-results/P6/P6.5 全部产出
- agate-workspace/debt/tech-debt.md（DEBT0011/0012）
- git -C /home/kity/oclab/peekview log --oneline -15（阶段 commit 链：98fda6a8→5cb65177→a05e381f→13594c9f→333f5209→fb7e6c71→04e0456e）
- /home/kity/oclab/agateon/agate/assets/execution-roles/consistency-reviewer.md（角色定义）

## 产出

- agate-workspace/tasks/TPV0096-e2e-fixture-selfcontained/P7-consistency.md
- frontmatter 机器计数（--list 先看）：phase: P7 / task_id: TPV0096 / parent: P6-acceptance.md（以 --list 为准）/ trace_id: TPV0096-P7-20260907 / agent: consistency-reviewer / status: draft / blocker_count / deviation_count / deviation_critical_count / design_gap_count / design_gap_reviewed_count（agent 被拒则手写记录）
