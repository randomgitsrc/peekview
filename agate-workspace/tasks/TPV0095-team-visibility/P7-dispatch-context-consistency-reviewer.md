---
phase: P7
task_id: TPV0095
type: consistency
parent: P2-design.md
trace_id: TPV0095-P7-consistency-20260902
status: draft
agent: consistency-reviewer
---

# P7 派发上下文 — consistency-reviewer（TPV0095 team-visibility）

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

<dispatch_guide>

### 目标

跨文件一致性审查 TPV0095 全链产出（P1-P6），产出 `P7-consistency.md`。无 [BLOCKER]/[DEVIATION-CRITICAL]、DESIGN_GAP 全配对。

### 约束

1. **角色定义**：`/home/kity/.agate/assets/execution-roles/consistency-reviewer.md`（P7 模式：批判第三方视角双向检查）。
2. **检查清单**：
   - **DESIGN_GAP 配对（强制）**：P4-implementation.md 有 **8 个 `[DESIGN_GAP:`**（backend 3：share 判别/全局 key/空文件 download + frontend 5：.status-tag 载体/UserMenu v-show/非 dropdown-item class/searchUrl undefined/URL 恢复 setup 期）——每条必须在 P7-consistency.md 转抄原始行 + `[DESIGN_GAP_REVIEWED: 已确认/已打回 P2]`。
   - **SCOPE+ 闭环**：P1-requirements.md 有 3 SCOPE_RESOLVED（raw team/CLI--user/restore）+ 1 SCOPE+（BDD-44 detail 三态 [BASELINE_CHANGE]）——确认已纳入基线。
   - **跨文件一致性**：P2 packages [backend/peekview, frontend-v3, packages/mcp-server] ↔ P8 release bump 范围；P1 BDD 44 ↔ P6 PASS 44 ↔ judge 44；P4 实现路径 ↔ P2 方案 A。
   - **未决项清零**：P1 无残留行首 [NEED_CONFIRM]；P4-implementation 的 DESIGN_GAP 全 REVIEWED。
3. **frontmatter 机器计数**：blocker_count/deviation_count/deviation_critical_count/design_gap_count=8/design_gap_reviewed_count=8（+ code_map 字段——骨架/CODE-MAP 未采用则省略）。
4. **产出格式**：正文标 `[OK]`/`[DEVIATION]`/`[EXTENSION]`；无 `[BLOCKER]`；DESIGN_GAP_REVIEWED 配对含 P4 原始行 + REVIEWED 行。
5. **环境隔离**：只读检查；禁碰生产。状态标记二值。

### 上游关联

- P4-implementation.md（8 DESIGN_GAP）
- P1-requirements.md（44 BDD + SCOPE 标记）
- P6-acceptance.md / P6.5-judge-verdict.md（44 PASS）
- P2-design.md（方案 A + packages）

### 输入文件

1. `P4-implementation.md`（DESIGN_GAP 来源）
2. `P1-requirements.md`（BDD + SCOPE）
3. `P2-design.md`（方案 + packages + files_to_read）
4. `P6-acceptance.md`（验收对照）
5. `P6.5-judge-verdict.md`（judge 对照）
6. `P5-test-results/`（验证对照）

### 产出

- `P7-consistency.md`（DESIGN_GAP 配对 + 跨文件核对 + frontmatter 计数）

### 返回

两行：① P7-consistency.md 路径；② 摘要（BLOCKER/DEVIATION 计数 + DESIGN_GAP 配对数，≤40 字）。
</dispatch_guide>
