# P7-dispatch-context-consistency-reviewer — TPV0099

---
phase: P7
generated_by: agate-inject-card.py + 主 Agent
task_id: TPV0099
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

> ⚠️ 以下派发指引是本次任务的强制指令，不是参考信息。执行优先级：派发指引 > 客观查证信息 > 阶段卡片（参考规范）。
> **只审不写**：不修改任何 P1~P6 产出文件。

## 目标

对 TPV0099（全屏模式链接 `/{slug}/f`）做 **P7 一致性检查**：对照 P1~P6 产出做跨文件一致性审查，产出 `P7-consistency.md`。

## 输入文件

1. `P1-requirements.md`（19 条 BDD 基线 + §4.2 zen 隐藏集 + §8 风险登记）
2. `P2-design.md`（方案 + §1.1 改动清单 M1~M9 + §6 gate_commands + §6.1 E2E 映射 + §7 files_to_read）
3. `P3-test-cases.md`（19 条 BDD 1:1 映射）
4. `P4-implementation.md`（**含 §8 两条 `[DESIGN_GAP]` 声明** —— 你必须逐条转抄并配对 REVIEWED）
5. `P4-review.md` / `P5-test-results/` / `P6-acceptance.md` / `P6.5-judge-verdict.md`
6. `known-failures.md`（预存失败登记）
7. `/home/kity/.agate/v0.76.0/agate/phase-cards/P7-consistency.md`（本阶段规范）

---

## ⚠️ 产出格式（**gate 按结构化字段判定，格式错会 exit 1**）

`P7-consistency.md` frontmatter **必须**含以下字段（主 Agent 已核 `check-gate.py` 的 `gate_p7` 实现）：

```yaml
---
phase: P7
task_id: TPV0099
parent: P6-acceptance.md
trace_id: TPV0099-P7-20260929
status: draft
created: 2026-09-29
agent: consistency-reviewer
blocker_count: 0
deviation_count: <int>
deviation_critical_count: 0
design_gap_count: 2              # ← 必须 ≥ P4 声明的 [DESIGN_GAP] 条数（本任务 = 2）
design_gap_reviewed_count: 2     # ← 必须 ≥ design_gap_count（否则 gate exit 1）
---
```

⚠️ **`design_gap_count` 与 `design_gap_reviewed_count` 是本阶段最关键的字段**：
- `check-gate.py` 硬校验 `design_gap_reviewed_count >= design_gap_count`，否则 **exit 1**
- **另有 P4/P7 交叉核对**：P7 转抄的条数**必须 ≥ P4 实际声明数**（本任务 P4 声明 **2** 条），否则 exit 1（"architect 遗漏转抄"）

正文中每条 `[DESIGN_GAP]` 须**逐条转抄**并**配一条 `[DESIGN_GAP_REVIEWED]` 标记**（含你的审查结论）。

**另**：gate 会在 `design_gap_reviewed_count > 0` 时检查正文是否含**跨文件引用关键词**（`P1...BDD` / `P2...packages` / `P4...implementation` 形态）——缺则 WARNING（"review 可能未做实质性交叉检查"）→ 请确保正文有**实质的跨文件引用**。

---

## 检查清单（P7 卡六项 + 本任务实证）

### 1. DESIGN_GAP 配对（**硬校验，必做**）

`P4-implementation.md` §8 声明了 **2 条 `[DESIGN_GAP]`**（主 Agent 已 `grep` 确认 = 2）。两条均为**测试代码缺陷**、实现无损：

| # | 位置 | 缺陷本质 | 已确认的处置 |
|---|---|---|---|
| DG-1 | `e2e/tpv0099-fullscreen-link-auth.spec.ts:151` | BDD-9 的 `pathname` 断言期望 `/markdown-test`，但该用例 Given 自己导航到 `/markdown-test/f`（期望值搬自 P1 一次**在 `/{slug}` 上用 f 键**的测量，且与 BDD-2/8/13/14/18 的"保留 `/f`"互斥） | 已修正为锚定 `/${SLUG_MD}/f` |
| DG-2 | 同 spec `:288` | BDD-10 匿名基线用**已登录的 `request` context** 发请求（alice 的 `Set-Cookie` 残留）→ 得 200 而非 404 | 已改用独立匿名 `pwRequest.newContext()` |

→ **请在 P7 逐条转抄这两条 + 各配 `[DESIGN_GAP_REVIEWED]`**，并写明你的独立审查结论（可含"已由 test-designer 修正并经验证"）。

⚠️ **注意**：`P4-implementation.md` 的 §4.2/§4.5 记录的 E2E 结果（4 failed / 2 passed）是**P4 时点的事实**；两条 DESIGN_GAP 的所指断言**已在 committed spec 中修正**（P5/P6 实测 auth spec **6 passed / 0 failed**）。**P4 文档不是错的**——它记录的是当时的真实状态。请勿把它当作"文档失实"来报。

### 2. SCOPE+ 闭环

主 Agent 已跑 `check-scope-resolved.py` → **exit 0** ✓。

**背景（供你核对）**：`P2-design.md:120` 有一处 `[SCOPE+]` 声明——发现 `.archived-banner` / `.expired-warning-banner` 在全屏视图下仍可见且构成满宽横条。**P2 已裁决「本任务不采纳、仅登记」**（理由：`/{slug}/f` 复用 zen 类 → banner 在**今天的 zen 态就已可见** = 既存行为，本任务对其视觉状态**增量为零**；且匿名不可达该状态）。已登记为 **DEBT0013**。

→ 请确认该 SCOPE+ 的处置链路完整（P2 裁决理由 + P4/P6 未擅自扩大范围 + DEBT0013 已登记）。

### 3. 跨文件一致性（**须给源文件节名**）

- **P2 `packages` ↔ P8 release 的 bump 范围**：P2 声明 `packages: [frontend-v3, docs]` → 请核对 P4 实际改动是否落在该范围（不含 `backend/`）
- **P1 的 BDD 数 ↔ P6 验收结果数**：P1 = **19**，P6 = **19**（19 PASS / 0 FAIL），P6.5 judge = **19/19 passed** → 三者须一致
- **P4 的实现路径 ↔ P2 的方案设计**：P2 §1.1 的 M1~M9 ↔ P4 实际落点（`router.ts` 路由 / `useZenMode.ts` 形态 / `EntryDetailView.vue` 调用点 / 三处文档）
- **P3 测试 ↔ P6 证据**：19 条 BDD 1:1 映射是否在 P6 逐条有证据
- **P2 `gate_commands` ↔ P5 实跑**：6 条命令（`P5`/`_typecheck`/`_lint`/`_docs`/`_e2e`/`_e2e_auth`）是否全部执行且 exit 0

### 4. 未决项清零

确认 `P1-requirements.md` 无残留行首 `[NEED_CONFIRM]`、`[BLOCKER]`、`[DEVIATION-CRITICAL]`。

### 5. CODE-MAP 核对

本项目 **`{AGATE_WORKSPACE}/agents/CODE-MAP.md` 不存在**（主 Agent 已确认）→ 按 P7 卡"机制未采用则跳过"处理。**`code_map_new_files_count`/`code_map_reviewed_count` 两字段可省略**（gate 对两字段均缺失时跳过校验）。

（本任务 P4 的「新增文件核对表」：`P4-implementation.md` 未声明 `P2-skeleton.md` 机制，故该表不适用。）

### 6. 架构决策落点与过时标注

本项目 **`{AGATE_WORKSPACE}/decisions/` 目录不存在**（主 Agent 已确认）→ 无既有决策可核对、也无须在本阶段撰写。请在 P7 记一句"无 `decisions/` 目录，本项不适用"。

---

## 本任务实证背景（供你判断，**不是让你照抄**）

主 Agent 在 P1~P6 全程记录了若干"验证失效"实例，供你判断跨文件一致性时留意：
- 本任务**九次**出现"验证声明需要被验证"的形态（判据恒真/恒假、探针降级 stub、根因标签张冠李戴、并行评审互相污染、评审者踩被验证对象的坑、守卫效力被高估、分页参数截断、派发模板自违其规）
- **`/entries` API 的 `limit` 参数不生效**（用 `per_page`，默认 20）——本任务曾因此"扫描面被静默截断、以为看全了"
- **两条已知 flaky 单测**（`DiagramBlock.spec.ts` / `TableView.spec.ts`）+ **两条预存失败**（`test_cli_remote.py::TestCLIRemoteConfig::test_config_set_remote_api_key` 沙箱只读、`test_admin_backup.py` 竞态）——均与本任务无关，已登记 `known-failures.md`
- **backend 零改动**（本任务仅前端 3 文件 + 文档），故任何后端失败在因果上均与本任务无关

**若你发现实质不一致** → 按 P7 规范标 `[BLOCKER]` / `[DEVIATION]` / `[DEVIATION-CRITICAL]` 并计入 frontmatter 计数（**不要为了好看而清零**）。gate 只硬拦 `BLOCKER>0` 与 `DEVIATION-CRITICAL>0`；`DEVIATION` 非零不阻断但须如实记录。

## 环境与纪律（强制）

- **只审不写**：不改任何 P1~P6 产出。**`P7-consistency.md` 之外一律不改**
- 不启动服务、不跑 E2E；如需复核可跑**只读**命令（`grep`/`git log`/只读 API）
- **严禁**触碰生产 `:8080` 与 `~/.peekview/`；返回标注 `[PROD_NOT_TOUCHED]`
- 临时产物（若有）落 `/home/kity/oclab/peekview/.agate-tmp/`
- **任何 bash 命令设 `timeout 180s <cmd>`**
- 子派发能力：不启用

## 产出

- `agate-workspace/tasks/TPV0099-fullscreen-link/P7-consistency.md`
- frontmatter：见上方"产出格式"节（**`design_gap_count: 2` / `design_gap_reviewed_count: 2` 必填**）
- 正文：六项检查逐条结论 + DESIGN_GAP 逐条转抄 + `[DESIGN_GAP_REVIEWED]` 配对 + **跨文件引用关键词**（含 `P1…BDD` / `P2…packages` / `P4…implementation` 形态）

## 返回给我（只三行）

1. 产出文件路径
2. **一句话结论**（BLOCKER / DEVIATION-CRITICAL / DEVIATION 计数）
3. **若有 BLOCKER**：逐条列出

**不要返回文件全文。**

> 本文件不含通过/失败预判。
