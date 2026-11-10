---
phase: P7
generated_by: agate-inject-card.py + 主 Agent
task_id: TPV0102
role: consistency-reviewer
---

<dispatch_guide>
> ⚠️ 以下派发指引是本次任务的强制指令，不是参考信息。执行优先级：派发指引 > 客观查证信息 > 阶段卡片（参考规范）

### 目标

产出 `P7-consistency.md`——对 P1~P6 产出做**跨文件一致性审查**，重点是 **18 条 `[DESIGN_GAP]` 逐条转抄 + 配 `DESIGN_GAP_REVIEWED` 标记**（这是 P7 gate 的硬校验：未配对 → exit 1）。

### 约束

**核心任务一：18 条 `[DESIGN_GAP]` 逐条配对（最易漏，gate 硬校验）**

主 Agent 已精确统计：`P4-implementation.md` 里 `[DESIGN_GAP` **共 18 条**，分布如下：

| 节 | 条数 | 行号 |
|---|---|---|
| `[frontend-shared]` 前端共享叶子件 | **5** | 121–124（+ 第 119 行是节标题） |
| `[mount-explore]` Explore 挂载 | **4** | 180–184 |
| `[mount-detail]` 详情页挂载 | **3** | 225–229 |
| `[docs-changelog]` CHANGELOG/升级说明 | **3** | 299–301 |
| `[rev1-fix]` 前端评审修复 | **3** | 326–330 附近 |

> ⚠️ **你自己重新 grep 一遍确认条数**（`grep -n "\[DESIGN_GAP" P4-implementation.md`），不要只信上表；条数必须以实际为准，且 **P7 的 `design_gap_count` 必须等于 P4 的实际条数**。

**每条都要做**：
1. **转抄**该 gap 的实质内容（一句话说清"实现与 P2 设计的偏差是什么"）
2. **判定**：`accepted`（可接受）/ `needs-fix`（需修）/ `rejected`（驳回）
3. 给 `checked_against`（对照了哪个源文件的哪节，如 `P2 §3.5`）
4. 给 `basis`（依据，如 `in_bdd` / `not_in_scope` / `implementation_detail`）
5. **配 `DESIGN_GAP_REVIEWED` 标记**（行内必须有这个词，gate 据此判定）

**frontmatter 必须含**（TAG0050 批 E 成对声明，非 legacy 任务）：
```yaml
design_gap_count: 18              # 必须等于 P4 实际条数
design_gap_reviewed_count: 18     # 必须等于 design_gap_count
design_gap_reviews:
  - {gap: DG1, verdict: accepted, checked_against: [P2 §3.4], basis: implementation_detail}
  # ... 18 条全列
```

**核心任务二：SCOPE+ 闭环**

主 Agent 已查：**P1-requirements.md 里没有任何 `scope_resolved` / `scope_plus` 字段**，但 `P4-implementation.md` 有 **2 处 `[SCOPE+]` 登记**：
- ① `[SCOPE+]` （约第 188 行）：`t031-entry-card.spec.ts` / `t031-entry-list-row.spec.ts` 的 BDD-7 用例因 D7/D9 事件改名连带失效，P2 §6.4 的 11 项更新面未列这两个文件
- ② `[SCOPE+]` （约第 305 行）：CHANGELOG `### 变更` 第 4 条（详情页 `.status-tag` 可见性文案消失 + overflow 菜单四项移除）源自 P2 §12 裁决 1 与 §1.1 D8，P1 四项需求未单列

**判定**：这两条都是**实现期发现的连带更新面**，implementer 已按"覆盖点不删、只改定位与断言"处理，并声明"无需回补 P1 基线"。你要判断：
- 它们是否**真的**只是测试断言/文档的连带更新（不改功能语义）→ 若是，判 `resolved`，说明"无需回补 P1"
- 若某条实质上扩展了 P1 的验收范围 → 必须要求回补 P1（写 `[BASELINE_CHANGE]`）

**并在 P1-requirements.md 补写 `scope_resolved`**（若判定为已解决）——P7 卡要求「P1 有 `[SCOPE_RESOLVED]`」，当前缺失。补写方式：用 `agate-md-field-set.py set scope_resolved "<描述1>|<描述2>"` 或在正文加行首 `[SCOPE_RESOLVED]` 标记（**先确认工具支持哪种**，不要手写 frontmatter）。

**核心任务三：跨文件一致性（含锚点关键词，缺则 WARNING）**

逐项核对并在正文引用**源文件节名**（如 `P1§BDD`、`P2§packages`、`P4§impl`、`P6§acceptance`）：

| 检查项 | 核对方法 |
|---|---|
| BDD 数量匹配 | P1 的 `#### BDD-NN:` 数（应 **30**）= P6-acceptance 的 PASS+FAIL 行数（应 30）= P6.5 verdict 的 `criteria_total`（30） |
| packages 一致 | P2 frontmatter `packages`（`peekview` / `frontend-v3` / `docs`）vs P8 计划 bump 范围 |
| 实现路径吻合 | P4 的实现是否覆盖 P2 §3 的详细设计（逐节对照） |
| 声明与实际 | P1 声明 `phases` 全 8 阶段 / `risk_level: medium` / `ceremony: standard` vs 实际走完的阶段 |
| E2E spec 文件名 | P2 的 `gate_commands.P5_e2e` 写死 `e2e/tpv0102-explore-card-list-ux.spec.ts` vs P3/P4 实际创建的文件名 |

**核心任务四：未决项清零**

grep `P1-requirements.md` 确认无残留行首 `[NEED_CONFIRM]` / `[BLOCKER]` / `[DEVIATION-CRITICAL]`（P1 当时写了 `[NO_NEED_CONFIRM]`，验证它成立）。

**核心任务五：CODE-MAP 与架构决策**

- `{AGATE_WORKSPACE}/agents/CODE-MAP.md` **可能不存在**（先确认）→ 不存在则跳过并说明
- `{AGATE_WORKSPACE}/decisions/` **不存在**（主 Agent 已确认）→ 跳过并说明；但本任务产生了 3 条**跨任务架构决策**值得登记，你判断是否需要：
  - ① UTC 序列化的唯一落点是叶响应模型 + `UtcSerializeMixin`（表模型严禁）
  - ② tooltip 必须自定义 DOM 元素（原生 `title` / CSS `::after` 不可断言）
  - ③ 可见性菜单 Teleport 与容器 `overflow` 的取舍（本任务选了去 `overflow:hidden`）

### 必须一并转抄的既有债与判据瑕疵（P7 是最后一处收口）

以下 4 条已在 P6/P6.5 发现，属**既有债或判据瑕疵**（非本任务引入，但必须留痕）：

| # | 项 | 性质 |
|---|---|---|
| 1 | 卡片长标题与右上 hover 操作区重叠（最坏 34px） | **既有视觉债**；pre-task `.card-actions` 60px 覆盖 332px → 本任务 48px 覆盖 211px，**减轻 121px**。不在任何 BDD/VC 判据内 |
| 2 | `BaseBadge` 的 label 在 setup 期求值一次 → 可见性切换后徽章文字 stale（刷新才对） | **既有缺陷**（该文件本任务零改动） |
| 3 | BDD-25 后半条对有文件 entry **不可测**（`loadEntry` 恒选 `files[0]` → `empty-select-file` 不可达） | **P1 判据瑕疵**（写了一条产品里不可达的场景） |
| 4 | P2 VC-5 的 `<=2px` 基线几何上不可满足（280px 卡宽 + 207px 绝对时间下 en-US 桌面 20/20 卡都换行） | **P2 判据瑕疵** |

**判定建议**：4 条都记 `findings`（`severity: note`，`status: resolved` 或 `deferred` + resolution），并在正文说明去向（登记技术债 / 留 P8 / 转 roadmap）。**不要**把既有债写成本任务缺陷。

### 产出规格（逐字遵守）

**`P7-consistency.md` frontmatter**：
```yaml
---
phase: P7
task_id: TPV0102
type: consistency
parent: P2-design.md
trace_id: TPV0102-P7-20261111
status: draft
created: 2026-11-11
agent: consistency-reviewer
blocker_count: 0
deviation_count: N
deviation_critical_count: 0
design_gap_count: 18              # = P4 实际条数
design_gap_reviewed_count: 18     # = design_gap_count
prod_touched: false
design_gap_reviews: [...]
findings: [...]
---
```

**正文**：逐条检查结果 + `[DESIGN_GAP_REVIEWED]` 标记 + 跨文件引用关键词（`P1§` / `P2§` / `P4§` / `P6§` 等）

### 只读纪律（强制）

- **禁止** `git checkout -- .` / `restore` / `reset` / `stash` / `clean` / `add` / `commit` / `switch -f` / 直接编辑被审查的实现/测试文件
- **禁止**运行写类 agate 工具（`agate-inject-card.py` / `agate-state-set.py` / `agate-task-init.py`）
- **例外**：允许对 `P1-requirements.md` 补写 `scope_resolved`（这是 P7 的既定动作），用 `agate-md-field-set.py`
- 允许写入：`P7-consistency.md` + 你的 progress
- 临时产物落 `.agate-tmp/`，不要用 `/tmp`
- 结束前 `git status --porcelain` 核验

### 环境
- 严禁触碰生产 `:8080` 与 `~/.peekview/`（应 000）
- 状态标记二值：`[PROD_NOT_TOUCHED]`

### 输入文件（P7 是输入数量豁免特例，全部要读）
- `P1-requirements.md`（30 条 BDD + 声明）
- `P2-design.md`（§3 详细设计 / packages / gate_commands / §12 裁决）
- `P4-implementation.md`（**18 条 DESIGN_GAP + 2 处 SCOPE+**，核心输入）
- `P4-review.md`（26 条约束 T-1~T-26）
- `P6-acceptance.md`（30 条 BDD 验收结果）
- `P6.5-judge-verdict.md`（judge 30/30 + 6 项非阻断观察）
- `known-failures.md`（2 条预存失败）
- `AGENTS.md` / `DESIGN.md`
- `{agate_root}/assets/review-roles/consistency-reviewer.md`（角色定义）

### 门槛（什么算完成）
- `P7-consistency.md` 存在，frontmatter 计数齐全
- **18 条 DESIGN_GAP 全部转抄 + 配 `DESIGN_GAP_REVIEWED`**（`design_gap_reviewed_count == design_gap_count == 18`）
- 2 处 SCOPE+ 已判定 + P1 已补 `scope_resolved`
- 跨文件检查含源文件节名关键词
- 4 条既有债/判据瑕疵已记入 `findings`
- 正文 `[BLOCKER]` = 0、`[DEVIATION-CRITICAL]` = 0

### 返回给我

只返回四行：
  1. 产出文件路径
  2. 一句话摘要（不超过 40 字）
  3. 计数：`design_gap_count` / `design_gap_reviewed_count` / `blocker_count` / `deviation_critical_count` / SCOPE+ 判定结果
  4. files_modified: [...]
**绝对不要返回文件全文。**

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
# ── TAG0050 批 E 成对声明（非 legacy 任务；跨文件聚合后逐条核对）──
# design_gap_reviews:
#   - {gap: DG1, verdict: accepted, checked_against: [P2 §3], basis: in_bdd}
# code_map_reviewed:
#   - {file: agate/scripts/x.py}
# findings:
#   - {id: F1, severity: note, text: "...", status: resolved, resolution: "...", evidence: "..."}
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