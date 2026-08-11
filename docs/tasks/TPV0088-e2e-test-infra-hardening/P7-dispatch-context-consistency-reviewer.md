# P7 Dispatch Context — consistency-reviewer

## 任务目标

执行 TPV0088 的一致性交叉检查，产出 `P7-consistency.md`。对照 P1-P6 产出，确认实现未偏离设计、跨文件一致性、DESIGN_GAP 配对。

## 上游关联

- 输入文件（必读）：
  - `docs/tasks/TPV0088-e2e-test-infra-hardening/P0-brief.md`（环境约束）
  - `docs/tasks/TPV0088-e2e-test-infra-hardening/P1-requirements.md`（9 BDD + IMPL-S/D/B）
  - `docs/tasks/TPV0088-e2e-test-infra-hardening/P2-design.md`（方案）
  - `docs/tasks/TPV0088-e2e-test-infra-hardening/P3-test-cases.md`（测试契约）
  - `docs/tasks/TPV0088-e2e-test-infra-hardening/P4-implementation.md` + `P4-implementation-b.md`（实现 + 可能的 DESIGN_GAP）
  - `docs/tasks/TPV0088-e2e-test-infra-hardening/P5-test-results/`（技术验证 + 回退记录）
  - `docs/tasks/TPV0088-e2e-test-infra-hardening/P6-acceptance.md`（9 BDD 验收结果）
  - `frontend-v3/e2e/viewer.spec.ts`、`scripts/e2e-safety-check.sh`、`Makefile:628-650`（实现代码，交叉核对）

## 检查清单（按角色定义）

1. **DESIGN_GAP 配对**：P4-implementation.md/-b.md 中的 [DESIGN_GAP] 声明 → 逐条转抄 + [DESIGN_GAP_REVIEWED] 标记
2. **SCOPE+ 闭环**：P1 是否有 [SCOPE+]（如有）→ 确认已纳入基线
3. **跨文件一致性**：
   - P2 方案与 P4 实现吻合（viewer.spec.ts 修复点 / Check 6 实现 / Makefile env 传递）
   - P1 9 BDD 与 P6 9 PASS 数量匹配
   - P3 测试契约与 P4 实现对应
   - P5 回退记录（P4 重试轮）与最终实现一致
4. **未决项清零**：P1 无残留 [NEED_CONFIRM] / [BLOCKER] / [DEVIATION-CRITICAL]

## 关键背景（供核对）

- P1 基线 9 BDD；P6 验收 9/9 PASS
- P4 并行派发 2 implementer（子任务 A viewer.spec.ts / 子任务 B e2e-safety-check.sh + Makefile）
- P5 首轮 E2E 18 failed → 回 P4 重试轮修复 7 项（TC-005/010/011/012/020/022/023/030/040/050/002）→ 复跑 38/38
- P6 9/9 PASS（E2E 38/38 + grep + mtime 三态）

## 约束

- 只审不写：不直接改代码/文档，产出审查结论
- 产出文件必须含 frontmatter 机器计数 + Header status（approved/rejected/needs-revision）
- 结论必须引用实质锚点（源文件节名/BDD 编号），不得裸"一致"

## 产出要求

`docs/tasks/TPV0088-e2e-test-infra-hardening/P7-consistency.md`

文件 Header（直接复制）：
---
phase: P7
task_id: TPV0088-e2e-test-infra-hardening
type: consistency
parent: P2-design.md
trace_id: TPV0088-P7-20260812
status: draft
created: 2026-08-12
agent: consistency-reviewer
# ── v2.0 机器计数 ──
blocker_count: 0
deviation_count: 0
deviation_critical_count: 0
design_gap_count: 0
design_gap_reviewed_count: 0
---

评审完成后必须将 status 改为 approved / rejected / needs-revision。

## 返回给主 Agent

两行：产出文件路径 + 一句话摘要（BLOCKER=N，不超过 30 字）

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

<objective_info>
- 环境状态：P1-P6 产出齐全；debug backend :8888 已运行
- 关键标识：9 BDD ↔ 9 PASS；P4 并行实现 + P5 回退修复；viewer.spec.ts + e2e-safety-check.sh + Makefile 三文件
- 查证结果：P4-implementation.md/-b.md 是否有 DESIGN_GAP 需你核对
</objective_info>
