# P7-dispatch-context-consistency-reviewer — TPV0100

---
phase: P7
task_id: TPV0100
role: consistency-reviewer
generated_by: 主 Agent
---

> ⚠️ 以下派发指引是本次任务的强制指令，不是参考信息。执行优先级：派发指引 > 客观查证信息 > 阶段卡片（参考规范）

## 你的任务（目标）

作为 **consistency-reviewer**，对「网页发布入口」P1–P6 的全部产出做**跨文件一致性审查**，产出 `P7-consistency.md`。

## 角色定义

`~/.agate/v0.77.0/agate/assets/execution-roles/consistency-reviewer.md`（先读）

## 输入文件（必读）

1. `agate-workspace/tasks/TPV0100-web-publish/P1-requirements.md` —— 30 条 BDD 基线
2. `agate-workspace/tasks/TPV0100-web-publish/P2-design.md` —— 方案设计（§1 影响面 M1–M14 / §5 gate_commands / §9 [SCOPE+]）
3. `agate-workspace/tasks/TPV0100-web-publish/P4-implementation.md` —— 实现清单 + **3 条 `[DESIGN_GAP]`**
4. `agate-workspace/tasks/TPV0100-web-publish/P6-acceptance.md` —— 30/30 PASS 验收结果
5. `agate-workspace/tasks/TPV0100-web-publish/P6.5-judge-verdict.md` —— judge 独立复核
6. `agate-workspace/tasks/TPV0100-web-publish/P3-test-cases.md` —— 测试设计

## 检查清单（逐条给结论 + 证据）

1. **DESIGN_GAP 配对（硬门）**：P4 `P4-implementation.md` 有 **3 条 `[DESIGN_GAP]`**（§2.5 limits 双拼写 / §2.6 UserMenu 类名冲突 / §4 BDD-22 端点）→ **每条必须转抄 + 配 `[DESIGN_GAP_REVIEWED: ...]` 标记**，并说明主 Agent 裁决结论与落地情况。P4 另有 2 条 `[DESIGN_GAP_RESOLVED]`（主 Agent 裁决已落地）——请一并转抄并 REVIEWED。
   - **主 Agent 已给的裁决事实**（供你核对，非让你重新裁决）：
     - §2.5：校验层接受 snake_case 优先、兼容 camelCase 双拼写；`getLimits()` 返回 camelCase。已落地。
     - §2.6：Publish 项**回归 `.dropdown-item`**（附 `.dropdown-item-publish` 语义类），下拉 3→4；`UserMenu.spec.ts`/`T079-entry-detail-header.spec.ts` 断言同步更新。已落地。
     - §4：BDD-22 端点由 `/raw` 改为 `GET /api/v1/entries/{slug}`（`EntryResponse` 含 owner_id）。已落地。
2. **SCOPE+ 闭环**：P2 §9 有 2 处 `[SCOPE+]`（R3 错误体形状 / R4 结果态链接源）→ 核对是否已在 P2 设计/P4 实现中吸收、是否需新增 BDD。**主 Agent 已知事实**：两处均在 P2/P4 吸收，未新增 BDD（P1 保持 30 条）；P1 无 `[SCOPE_RESOLVED]` 标记（因无行首 `[SCOPE+]` 触发闭环要求）。请核对并记录结论。
3. **跨文件一致性**：
   - P1 BDD 数（30） == P6 PASS 数（30）== judge criteria_total（30）
   - P2 §1 声明的 M1–M14 落点 vs P4 §1 改动清单是否吻合
   - P2 `packages` 声明（`peekview-frontend, docs`）vs P8 bump 范围（本任务不 bump 版本，仅前端 + DESIGN.md）
4. **未决项清零**：P1 无残留 `[NEED_CONFIRM]`/`[BLOCKER]`/`[DEVIATION-CRITICAL]`
5. **CODE-MAP 核对**：`agate-workspace/agents/CODE-MAP.md` 不存在 → 机制未采用，跳过（frontmatter 两字段留 0 或不填）
6. **决策落点核对**：`agate-workspace/decisions/` 不存在 → 无跨任务架构决策需核对，跳过

## 产出格式

`agate-workspace/tasks/TPV0100-web-publish/P7-consistency.md`

```yaml
---
phase: P7
task_id: TPV0100
type: consistency
parent: P2-design.md
trace_id: TPV0100-P7-20261002
status: draft
created: 2026-10-02
agent: consistency-reviewer
blocker_count: 0
deviation_count: 0
deviation_critical_count: 0
design_gap_count: 3
design_gap_reviewed_count: 3
code_map_new_files_count: 0
code_map_reviewed_count: 0
---
```

正文：逐条检查结果 + **跨文件引用关键词**（如 `P1§BDD`、`P2§packages`、`P4§设计偏差`、`P6§验收`——gate 检测到 `DESIGN_GAP_REVIEWED` 但缺这些关键词会 WARNING）。
`[DESIGN_GAP_REVIEWED: ...]` 每条独立成行转抄 + 配对说明。

## 约束

- **只审不改**——不改任何上游产出、不改代码
- `[BLOCKER]`/`[DEVIATION-CRITICAL]` 出现 → 如实标（gate 会拦，交主 Agent 处理）
- 所有 shell 命令显式带超时
- 只读；勿碰生产 `:8080` / `~/.peekview/`

## 返回给我（重要）

只返回两行：
1. `P7-consistency.md` 路径 + blocker/deviation_critical/design_gap_reviewed 计数
2. 一句话摘要（≤40 字）

绝对不要返回文件全文。

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
6. **架构决策落点与过时标注核对**：核对 `{AGATE_WORKSPACE}/decisions/` 是否已写入本任务应落的跨任务架构决策，且被本任务证伪的既有决策已就地标注「已过时 + 被什么取代」而非删除。仅核对，不在 P7 撰写决策正文（缺失项记为待办，由决策的提出方在下一次 P2 前补写入 `decisions/`；见 DEBT0039）

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
