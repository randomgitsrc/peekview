# P7-dispatch-context-consistency-reviewer-rev1 — TPV0099（**P7 复审轮**）

---
phase: P7
generated_by: agate-inject-card.py + 主 Agent
task_id: TPV0099
role: consistency-reviewer
retry: 1
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

> 本文件是 **P7 复审轮**的派发指令。你上一轮产出 `P7-consistency.md` 判 **BLOCKER = 1**；主 Agent 已按你的建议完成处置，现请你**复审**。
>
> **本轮范围极小**：**只验证你那 1 条 BLOCKER 是否闭环** + 一次"未回退"抽查。你上一轮已逐条核实通过的六项（DESIGN_GAP 2/2 配对、19=19=19=19/19、P4↔P2 §1.1、gate_commands 6/6、CODE-MAP/decisions N/A）**只做未回退确认，不重审**。

---

## 一、先说你上一轮做对的一件关键事（主 Agent 已独立复现并采纳）

你指出：主 Agent 派发指引里引作闭环证据的「`check-scope-resolved.py` exit 0 ✓」**是真空通过**——因为 `P2-design.md:120` 的形态是 `**[SCOPE+]** 发现：…`（粗体包裹、行首非 `[`），脚本正则 `^\s*-?\s*\[SCOPE\+\]` 匹配不到 → `_scan_scope_plus` 返回空 → 脚本走「无 SCOPE+ → 早退 0」分支，**从未进入 `[SCOPE_RESOLVED]` 判定分支**。

**主 Agent 已独立复现你的论证**：对该行实测 `re.search(r'^\s*-?\s*\[SCOPE\+\]', line)` → **False** ✓；并逐文件扫描（排除 dispatch-context/progress）→ **无任何文件含行首 `[SCOPE+]`** ✓。**你的判断成立**——我把"exit 0"当成了闭环证据，而它对本例**恒真、不检测即通过**。

**你不采信我的结论、去读脚本正则逐字复算，才发现我的证据是空的**——这正是独立复核的价值。请在本轮复审里**继续按此标准**。

## 二、BLOCKER → 本轮验证点

**BLOCKER（你上一轮）**：`P1-requirements.md` 全文无 `[SCOPE_RESOLVED]` 标记，而产出含 `[SCOPE+]`（`P2-design.md:120`）→ 违反 `dispatch-protocol.md` 明文与 P7 卡推进条件。

**主 Agent 的处置**：采纳你的**建议 ①**——已在 `P1-requirements.md` **正文首部**（`# P1 需求基线…` 标题与 `[NO_NEED_CONFIRM]` 之后）追加 **1 行 `[SCOPE_RESOLVED: …]`** 闭环标记。依据：
- **协议明文**：`dispatch-protocol.md`「产出含 `[SCOPE+]` 时，**主 Agent 必须**在 `P1-requirements.md` 增补对应条目并标记 `[SCOPE_RESOLVED: 来源文件]`」→ 该动作**属主 Agent 职责**
- **先例 `TPV0096`**（commit `f5bc4b6b`，同为"P7 阶段补 SCOPE_RESOLVED 闭环标记"）
- 标记内容含：来源（`P2-design.md:120`）/ 裁决（**不采纳、不增补 BDD、不改隐藏集**+ 三条理由）/ **落地证据链**（P2 §1.2 N12 + §1.3 R-04 + §6.5 → P4 零范围外改动 → P6 19/19 + BDD-3 三态 0/3/1 → P6.5 judge 确认）/ **缺口登记 DEBT0013** / 尾注 `[BASELINE_CHANGE: 主 Agent 批准的闭环标记——纯闭环记录，未改 BDD、未改语义]`

**请独立复核（不要采信本文件的自述）**：
1. `P1-requirements.md` 确实含 `[SCOPE_RESOLVED` 标记，且**形态符合脚本正则**（行首，允许可选 `- ` 列表前缀）
2. **⚠️ 关键——本轮必须做"非真空"验证**：不能只看 `check-scope-resolved.py` 的 exit code（**上轮的教训就是 exit 0 可能是真空通过**）。请**证明该脚本这次真的进入了 `[SCOPE_RESOLVED]` 判定分支**，或至少独立证明"若标记缺失则会 FAIL"（即该检查对本案**有区分力**）
   - 建议做法：读 `check-scope-resolved.py` 源码确认其分支逻辑，并在**临时副本**上做反向对照（去掉标记 → 观察是否 FAIL）。**临时副本放 `.agate-tmp/`，不要改任务目录下的真文件**
3. `P1-requirements.md` 的 **BDD 总数仍为 19**、frontmatter 仍合法（`check-frontmatter.py` exit 0）——即标记追加**未改 BDD、未改语义**
4. `check-gate.py P7` 是否已从 exit 1 转为通过（**请你亲自跑真实 CLI**）

## 三、你上一轮 5 条 DEVIATION → 主 Agent 逐条复核结论（**供你核对，不要求你照抄**）

主 Agent 已逐条独立复核（不采信自述），结论如下：

| # | 你的判定 | 主 Agent 复核结论 |
|---|---|---|
| **D1** | `P6-acceptance.md:92` BDD-17 尺寸写「24×24」与 `:46` 自相矛盾 | **成立**。主 Agent 实测 `assert-bdd-17.json` → `w=800 / h=600`（`naturalWidth=800`/`naturalHeight=600`），`seed_choice` 明写取 `svg-standalone`；**24×24 是未被采用的 `svg-icons`** → 属 P6 产出笔误 |
| **D2** | `P4-implementation.md` 称"未改动任何测试文件"但同 commit 改了 auth spec | **成立**。主 Agent `git show --stat f1cfd5c3` 实证 auth spec **+43/-10** → P4 产出集自身不自洽（成因：首轮确实未改测试，**后续修正轮**改了，该句未随之更新） |
| **D3** | P5 残留扫描自述 `limit=200` 但后端无该参数 | **成立**。该 API 只有 `per_page`（默认 20）→ 你**如实标注不确定性**（无法区分"被截断"vs"可见集合变化"）**做法是对的**；主 Agent 确认**影响为零**（残留 0 已由 P6 与 P6.5 judge 各自独立证实） |
| **D4** | P2 声明的 `P6`/`P6_typecheck` 两键在 P6 无执行留痕 | **成立（此前主 Agent 未注意到）**。主 Agent `grep` `P6-evidence/test-output.log` → `test-frontend\|typecheck` 命中 **0** ✓ → P6 只跑了 E2E 与截图类验证。风险低（P5 已在前一 commit 跑过同样两条且全绿，且 `f1dfd5c3`→P6 间零产品码改动） |
| **D5** | `check-p6-provenance.py` "exit 1 至今未清" | **已过时（你判错，主 Agent 纠正）**。该缺陷**已在 P6 gate 前由主 Agent 修复**（把 `P6-dispatch-context-verifier.md` 的格式样例改为不以判定词起首）→ 主 Agent 实测当前 **exit 0**。你的依据是 `P6-progress.md:58` 的**过程自记**（记录的是**修复前的中间态**）→ **把过程记录当成了当前事实**（与本任务多次"时点快照被当成普遍事实"同族）。**不苛责**：你按"只审不写"未改文件，且该 note 确实存在 |

**D1/D2/D4 的处置决定（主 Agent，供你登记）**：**本轮不修改** `P6-acceptance.md` / `P4-implementation.md`。理由：① 三者均为**产出内文字/记录级偏差**，**不影响任何 gate 判据**（P6 PASS 判定、P4 实现、P6.5 judge 结论均不依赖该文字）② 修改已 commit 的他人阶段产出**需重开该阶段**（P4/P6 已过、P6.5 已判），对笔误级项不成比例 ③ **先例 `TPV0096` 的 2 条笔误级 DEVIATION 也是"记录不修"**。→ 请在 P7 里**如实登记为 DEVIATION**（保持 `deviation_count` 计数）。

## 四、未回退抽查（只确认，不重审）

抽查确认你上一轮已核实通过的内容**未被本轮修复破坏**：
- `P7-consistency.md` 的 `design_gap_count: 2` / `design_gap_reviewed_count: 2` 仍配对（`check-gate.py` 的 P4/P7 交叉核对仍须通过）
- `P4-implementation.md` **未被本轮修改**（除 `P1-requirements.md` 外，本轮无其他任务文件改动）
- 跨文件引用关键词仍在（`P1…BDD` / `P2…packages` / `P4…implementation` 形态）

## 五、产出（**就地更新** `P7-consistency.md`）

- **frontmatter 更新**：`blocker_count` 应改为 **0**（BLOCKER 已闭环）；`deviation_count` / `deviation_critical_count` / `design_gap_count` / `design_gap_reviewed_count` 按你复核后的实况填写；`status` 相应更新（你的判定）
- 正文：**追加本轮复审节**（记录 BLOCKER 闭环验证 + 你对 D5 过时的确认或反驳 + 非真空验证的做法与结果）；**保留**上一轮的六项检查结论与 5 条 DEVIATION 登记
- ⚠️ **不要再引入行首 `- PASS` / `- FAIL`**（P7 阶段虽无该扫描，但保持一致性）

## 六、环境与纪律（强制）

- **只审不写**：除 `P7-consistency.md` 外不改任何文件（含 `P1-requirements.md`）
- 不启动服务、不跑 E2E；如需反向对照，**临时副本放 `/home/kity/oclab/peekview/.agate-tmp/`**
- **严禁**触碰生产 `:8080` 与 `~/.peekview/`；标记 `[PROD_NOT_TOUCHED]`
- **任何 bash 命令设 `timeout 180s <cmd>`**
- 子派发能力：不启用

## 七、返回给我（只三行）

1. 产出文件路径
2. **一句话结论**（BLOCKER / DEVIATION-CRITICAL / DEVIATION 计数 + `check-gate.py P7` 的 exit code）
3. **非真空验证的做法与结果**（你如何证明该检查对本案有区分力）

**不要返回文件全文。**

> 本文件不含通过/失败预判。
