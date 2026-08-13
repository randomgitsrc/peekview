---
phase: P7
task_id: TPV0090-cli-remote-xdist-fix
type: consistency
parent: P2-design.md
trace_id: TPV0090-P7-consistency-20260813
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
5. 更新 .state.yaml phase=P7 → P8
6. git add {AGATE_WORKSPACE}/tasks/{Txxx}/（含 .state.yaml + 产出文件，若 .gitignore 忽略需 git add -f）
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

## 目标

跨文件一致性审查 TPV0090（P1-P6 产出），产出 `P7-consistency.md`。

## 任务背景

修复 `test_cli_remote.py` 在 `pytest -n auto` 并发下失败。实现 = worker 动态端口（18888+worker_index）+ poll 死亡检测 + teardown 强化：
- 后端：`backend/tests/test_cli_remote.py`（`_server_port` 纯函数 + server_url fixture 改造）
- 测试：TestCLIRemoteFixture 6 用例（P3 新增）
- 改动面：**单文件**（SCOPE+ 后 packages 收敛为 [test_cli_remote.py]，Makefile/pyproject/ci.yml 零改动）

## 已知事实（P1-P6 已产出，勿重查）

- P1：4 BDD（BDD-1 -n auto 连续 3 次全绿 / BDD-2 make test-quick 全绿 / BDD-3 单跑不回归 / BDD-4 server 死亡快速失败含诊断），risk=low，phases 全走，domains=[backend]，8 隐含需求 I1-I8，SCOPE_RESOLVED（packages 收敛）
- P2：3 候选 → 选候选 1（动态端口）；minimal_validation 4 项（xdist_group 否决 / worker 端口唯一 / poll 快速 / 无 -n 无副作用）
- P3：6 用例（TC-B4a/d/b/c1/c2/TC-port）；check-tdd-red EXIT 0 真红灯
- P4：单文件 fixture 改造；主 Agent 验串行 23/23 + 并发 23/23 + ruff；review approved
- P5：P5_cli_remote 连续 4 次 23/23；全量 1078 passed/0 failed/3 skipped（预存失败消除）；ruff 通过
- P6：4/4 PASS（BDD-1 连续 5 次 / BDD-2 全量 / BDD-3 单跑 23 / BDD-4 死亡检测 2 passed）

## 检查清单（consistency-reviewer 角色）

1. **DESIGN_GAP 配对**：P4 无 DESIGN_GAP 声明 → 确认（design_gap_count: 0）
2. **SCOPE+ 闭环**：P1 有 SCOPE_RESOLVED（packages 收敛）→ 确认 P2 的 SCOPE+ 记录与 P1 标记一致
3. **跨文件一致性**：
   - P1 packages 声明（SCOPE_RESOLVED 后 [test_cli_remote.py]）与 P2/P4 实际改动面一致？（Makefile 确实零改动？）
   - P1 BDD 数（4）与 P6 验收数（4）匹配？
   - P4 实现与 P2 候选 1 规格吻合（_server_port/动态端口/poll 检测/teardown）？
   - P3 测试用例与 P6 验收覆盖一致（TC-B4a/d → BDD-4）？
4. **未决项清零**：P1 无残留 [NEED_CONFIRM]、[BLOCKER]、[DEVIATION-CRITICAL]
5. **耦合点核对**（单文件改动，但需确认）：
   - fixture 改造与 17 既有用例的耦合（行为不变）
   - `PYTEST_XDIST_WORKER` 环境变量依赖（xdist 行为耦合）
   - 端口范围 18888-18903 与项目其它端口（3000/8080/8888）无冲突
   - teardown 与残留进程（I6）

## 约束

1. 产出 `agate-workspace/tasks/TPV0090-cli-remote-xdist-fix/P7-consistency.md`
2. frontmatter 含：blocker_count / deviation_count / deviation_critical_count / design_gap_count / design_gap_reviewed_count
3. 正文必须含跨文件引用关键词（如 `P1§packages`、`P4§impl-path`、`P1§BDD`）
4. 无 [BLOCKER] / [DEVIATION-CRITICAL] 标记
5. 环境隔离：只读
6. 每读一个文件追加 progress 到 `P7-progress.md`

## 输入文件

1. `agate-workspace/tasks/TPV0090-cli-remote-xdist-fix/P1-requirements.md`
2. `agate-workspace/tasks/TPV0090-cli-remote-xdist-fix/P2-design.md`
3. `agate-workspace/tasks/TPV0090-cli-remote-xdist-fix/P3-test-cases.md`
4. `agate-workspace/tasks/TPV0090-cli-remote-xdist-fix/P4-implementation.md`
5. `agate-workspace/tasks/TPV0090-cli-remote-xdist-fix/P5-test-results/unit.md`
6. `agate-workspace/tasks/TPV0090-cli-remote-xdist-fix/P6-acceptance.md`
7. `backend/tests/test_cli_remote.py`（实现）

## 产出规格

P7-consistency.md 必须含：
- frontmatter（agent: consistency-reviewer + 机器计数）
- DESIGN_GAP 配对说明
- SCOPE+ 闭环说明
- 跨文件一致性逐项（引用 P1/P2/P3/P4/P5/P6 锚点）
- 耦合点核对
- 未决项清零检查
- 结论：无 [BLOCKER] 即可推进

## 返回

路径 + 一句话摘要（BLOCKER 数、DESIGN_GAP 配对、SCOPE 闭环、跨文件一致性结论）。
