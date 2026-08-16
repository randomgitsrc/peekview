---
phase: P7
task_id: TPV0093-star-lifecycle
type: consistency
parent: P2-design.md
trace_id: TPV0093-P7-20260816
status: ready
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
check-gate.py P7 $TASK_DIR
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

对 TPV0093 P1-P6 全部产出做跨文件一致性审查，产出 P7-consistency.md。**只审不写，不修改任何产出文件。**

## 上游关联

- P1-requirements.md（28 BDD，risk=high，packages=[backend/peekview, frontend-v3]，domains=[backend,frontend,security]）
- P2-design.md（方案：archive_delete_at / tombstone_id 绑定 / get_entry 单点权限 / 数据幂等 backfill；dispatch_plan static-batch）
- P3-test-cases.md + P3-test-code/
- P4-implementation-backend.md + P4-implementation-frontend.md（含 DESIGN_GAP 声明 + REVIEWED）
- P5-test-results/（unit/e2e）
- P6-acceptance.md（28/28 PASS）+ P6-evidence/

## 输入文件（必读）

1. `agate-workspace/tasks/TPV0093-star-lifecycle/P1-requirements.md`
2. `agate-workspace/tasks/TPV0093-star-lifecycle/P2-design.md`
3. `agate-workspace/tasks/TPV0093-star-lifecycle/P4-implementation-backend.md` + `P4-implementation-frontend.md`
4. `agate-workspace/tasks/TPV0093-star-lifecycle/P6-acceptance.md`
5. `agate-workspace/tasks/TPV0093-star-lifecycle/P0-brief.md`（裁剪声明对照）

## 检查清单

1. **DESIGN_GAP 配对**：P4 声明的 DESIGN_GAP（backend 1 处：test_star_lifecycle entry_id 捕获时机；frontend 3 处：TC-BDD2 fixture/DG-2 二次确认/DG-3 类型修复——均已 REVIEWED）→ P7 逐条转抄 + 配 `[DESIGN_GAP_REVIEWED: ...]` 标记
2. **SCOPE+ 闭环**：P1-requirements.md 有 `[SCOPE_RESOLVED]`（backup/restore 已知限制 → DEBT0006）——确认
3. **跨文件一致性**：
   - P2 packages=[backend/peekview, frontend-v3] ↔ P4 实现路径 ↔ P8 发布范围（P8 未做，声明预期）
   - P1 BDD 28 ↔ P6 PASS 28 数量与编号匹配（BDD-1..28 全覆盖）
   - P4 实现路径 ↔ P2 方案设计吻合（尤其：archive_delete_at 绝对到期点 / tombstone_id 事务绑定 / get_entry 短路 is_public / 数据幂等 backfill 不复用 user_version / star API 授权 BLOCKER-2）
   - P2 dispatch_plan（static-batch backend+frontend）↔ P3/P4 实际拆分
   - P6 验收过程回退 P4 修复（BUG-1/BUG-2）↔ P2 设计兼容性
4. **未决项清零**：P1 无残留 [NEED_CONFIRM]；无 [BLOCKER]/[DEVIATION-CRITICAL]

## 约束

- 只审不写（不修改任何产出文件）
- 结论引用具体锚点（P1 BDD 编号 / P2 章节 / P4 文件 / P6 PASS 行）
- frontmatter：blocker_count / deviation_count / deviation_critical_count / design_gap_count / design_gap_reviewed_count
- 状态标记：`[PROD_TOUCHED]`/`[PROD_NOT_TOUCHED]`

## 产出

`agate-workspace/tasks/TPV0093-star-lifecycle/P7-consistency.md`

## 门槛

- 文件存在且非空；frontmatter 计数齐全
- DESIGN_GAP 全部 REVIEWED 配对（P4 的 4 处 → P7 有 4 条 DESIGN_GAP_REVIEWED）
- 无 [BLOCKER] / [DEVIATION-CRITICAL]
- 跨文件检查含源文件节名引用（如 `P1§BDD`、`P2§packages`、`P4§impl-path`、`P6§pass`）
