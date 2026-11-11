---
phase: P1
generated_by: agate-inject-card.py + 主 Agent
task_id: TPV0103
role: requirements-review
retry: 3
review_round: 4
---

<dispatch_guide>
> ⚠️ 以下派发指引是本次任务的强制指令，不是参考信息。执行优先级：派发指引 > 客观查证信息 > 阶段卡片（参考规范）

### 目标

产出 `P1-review.md`——独立审查 `P1-requirements.md`，判定 `approved` / `needs-revision` / `rejected`。**只审不写**。

### 本任务的特殊性

**这不是新功能，是反转 TPV0102 的验收判据。** TPV0102 的 BDD-01 写「主显**必须含 `GMT±N`**」，本次改为「主显**不得含时区偏移**」；BDD-02（tooltip）保持不变。

你的核心判断：**这次反转是否做对了**——既要真的去掉偏移，又不能把 tooltip 的信息完备性一起削弱。

### 本轮是第 4 轮复审（终审）

analyst 已按你上轮 **BLOCKER-C + 2 MINOR** 修订。**A/B 及 5 项已闭合项（01/02/03/04/07）你上轮已确认闭合，本轮不要重新挑刺**——除非发现被破坏。

**主 Agent 已用真实 vitest 独立复验 BLOCKER-C（本阶段唯一硬验收）**

探针放进 `frontend-v3/src/composables/__tests__/`（vitest `include` 不扫 `../`），跑真实 vitest 1.6.1：

| 宿主 `TZ` | 实现 | 参考值 | 结果 |
|---|---|---|---|
| **`UTC`（CI 常态）** | `2026/11/10 09:43` | `2026/11/10 09:43` | **5/5 passed** |
| `America/New_York` | `2026/11/10 04:43` | `2026/11/10 04:43` | **5/5 passed** |
| `Asia/Shanghai`（本机） | `2026/11/10 17:43` | `2026/11/10 17:43` | **5/5 passed** |

四个关键验证点全过：① 正确实现不假 FAIL ② 参考值段数恒 5 ③ pin `Asia/Shanghai` 的错误实现在非 Shanghai 宿主下与参考值**不等**（有判别力）④ 多传 `second` 与参考值不等（不假 PASS）。

**三宿主都自动同源 = 方案 1 正确的直接证据**（参考值不 pin 时区 → 随宿主自然对齐）。

**你要做的终审核验**

| # | 你上轮的要求 | analyst 声称 | 核验点 |
|---|---|---|---|
| **C**（唯一阻塞） | `FIVE_FIELDS` pin 了 `timeZone` → `TZ=UTC` 宿主假 FAIL；§6.1.1 #2「显式传 timeZone」是错误方向 | 选方案 1：`FIVE_FIELDS` 去 `timeZone`；固定时区只用 `test.use({timezoneId})` / 进程启动前 `TZ`；§6.1.1 #2 已改写 | ① 全文**是否还有任何地方 pin 了 `timeZone` 到参考值**（grep `timeZone:` 逐处看）② §6.1.1 #2 及所有相关表述是否彻底不再教「显式传 timeZone」③ 验收口径「`TZ=UTC` 下 vitest + e2e 全绿」是否已写进 P1 |
| MINOR-1 | 7/32 → 8/32（补 `bn-IN`） | 已改，三处引用同步（BDD-06 / BDD-12 ③ / §5.2） | 核对三处是否都改了 |
| MINOR-2 | §8「浏览器侧唯一增量是 ICU 版本」不准确 | 改为两项增量表（ICU 版本 / 时区来源不同源），说明修法不同 | 核对 |

**复查"必须保持不变"**：12 条 BDD 编号结构、反转方向、决策 D1、BDD-04 是 `hour12` 唯一守护点、P1 第 311 行「4/5、仅 en-US 抓到」（**这条是 analyst 原文正确表述，主 Agent 上轮判错已澄清，不要改**）、A/B 的判据写法、frontmatter。

### 判定纪律

- **这是 P1 retry 3/3 用尽后的终审**：若 C 真闭合且无新硬缺陷 → `status: approved`
- **不要因为"我上轮建议的是另一种写法"就打回**（analyst 选的方案 1 正是你推荐的，且主 Agent 已实测三宿主全绿）
- 若仍有硬缺陷，必须明确指出"哪条 / 缺什么 / 为什么是硬缺陷而非软问题"

### 产出文件字段（本轮覆盖写）

**覆盖写** `P1-review.md`，保持：phase=P1, task_id=TPV0103, trace_id=TPV0103-P1-review-20261111, agent=requirements-review, created=2026-11-11, prod_touched=false
`reviewed_bdds` = `01`–`12`（先 grep 确认）


### 约束

**必须重点核对的 5 项（含主 Agent 已实测的对照数据）**

#### ① 数字段数判据的数字准确性（**主 Agent 已实测，analyst 正文有一处错**）

analyst 的 BDD-01 用「`\p{Nd}+` 数字段数恰为 5」作为"无偏移"的指纹。它的正文写：

> 实测 32 locale **无一例外**变成 7 段（`shortOffset`）或 8 段（`longOffset`）；一旦加回 `second`，变成 6 段

**主 Agent 亲自实测 32 locale 的分布是**：

| 变体 | 数字段数 |
|---|---|
| 主显（无 timeZoneName / 无 second） | **5 段 × 32 locale** |
| 含 second | **6 段 × 32** |
| shortOffset | **6 段 × 32** |
| longOffset | **7 段 × 32** |

→ analyst 写的「shortOffset 7 段 / longOffset 8 段」**实测为 6 / 7 段**，数字有误。

**你要判定**：这个数字错误是否影响判据有效性？
- 主 Agent 的判断：**不影响**——关键结论是「5 段唯一，且与 6/7 互不重叠」，这个成立（5 ≠ 6 ≠ 7）
- 但正文数字**必须更正**，否则后人照它写断言会按 7/8 去判、导致漏判

#### ② 判据是否真的可二值判定（跨 locale）

analyst 的 BDD-01 覆盖 `zh-CN` / `en-US` / `ja-JP` / `de-DE` 四个 locale。你要判断：
- 这四个是否足以代表"日期分隔符为 `-`"的风险场景？（主 Agent 实测 `sv-SE` / `lt-LT` / `nl-NL` / `en-CA` 用 `-`，正是 P0 原判据假 FAIL 的 4 个 locale）
- **是否需要把带 `-` 分隔符的 locale 纳入 BDD-01 的 locale 清单**（否则该 BDD 无法防止判据退化回原样）

#### ③ BDD-06 的固定 locale 要求是否必要

analyst 报：TPV0102 的 tooltip 偏移判据 `/GMT[+-]\d{2}:\d{2}/` 在 **7/32 locale 漏判**（`fr-FR` 用 `UTC+08:00`、`fi-FI`/`da-DK`/`id-ID` 用 `GMT+08.00`、`he-IL` 有 bidi 字符、`ar-EG`/`fa-IR` 用本地化词），故 BDD-06 必须在固定 `zh-CN` 下判定。

**你自己验一遍**（这是实质锚点，不能只看它的说法），并判断：在固定 `zh-CN` 下判定，是否会**漏掉"实现把 tooltip 的 timeZoneName 也去掉"这个错误**？

#### ④ 判据反转的完整性

TPV0102 受影响的有 BDD-01 / 03 / 04 / 26 + 视觉契约。核对 analyst 的 12 条 BDD 是否**完整覆盖**：
- 主显无偏移（原 BDD-01）
- 主显无秒（新增精度分工）
- 三处→**四处**渲染点一致（原 BDD-03，主 Agent 已确认 `TimeDisplay` 有 4 个消费方：`EntryCard` / `EntryListRow` / `EntryDetailHeader` / `EntryMetaTagsBar`）
- 时区正确性（原 BDD-04 要反向：`Asia/Shanghai` 下 `09:43Z` 应显示 `17:43` 且**不带秒**）
- seed 人工体验路径（原 BDD-26）
- **tooltip 判据必须保留**（原 BDD-02 不变）

**特别检查**：BDD-04 是否正确处理了 locale 依赖（TPV0102 曾硬编码 `17:43:00` 在 `en-US` 下假 FAIL）？analyst 说「BDD-04 正断言 `en-US` 必须显示 `11/10/2026, 05:43 PM`」——判断这个正断言是**有价值的防退化护栏**，还是**过度绑定实现细节**。

#### ⑤ 改动面数字

analyst 报精确为「需反转的主显断言 **8 处** / 需删常量 **3 处** / 须保留的 tooltip 断言 **5 处**」，修正 P0 的「26 处」粗估。

**你自己 grep 核对**（受影响的 5 个测试文件：`time-display.spec.ts` / `useRelativeTime.spec.ts` / `tpv0102-*.spec.ts` / `filter-tabs.test.ts` / `expired-warning.test.ts`），判断这个分类是否准确、是否有遗漏（TPV0102 曾漏掉 `EntryListRow.spec.ts` 一处致静默丢覆盖点）。

### 检查清单（角色定义要求，逐项做实）

1. **BDD 可二值判定**：每条能否明确判 PASS/FAIL；`#### BDD-NN:` 格式；编号连续
2. **BDD 反模式**：Then 是否绑定 CSS 类名 / HTML 属性名 / 组件名 / 具体实现细节；是否含主观词
3. **隐含需求覆盖**：数据 / 前端 / 多端 / 边界（含 locale、时区）/ 兼容
4. **frontend UI/UX 机制**：UX 类别 BDD 齐备；`ui_render_shape` / `ui_ux_dimensions` 声明；vision 条目三态
5. **裁剪合理性**：`risk_level: low` 是否匹配；跳过的阶段理由
6. **审声明**：`risk_level` / `ceremony` / `phases` 与实际改动是否匹配
7. **P1 纯净性**：有无掺入解决方案设计

### 实质锚点要求（硬性）

review 结论**必须**引用具体锚点：
- approved → 逐条列出**每个 BDD 编号** + 覆盖维度标注
- 审声明通过 → 引用 `git diff` 证据
- 裸 "approved" 或 "BLOCKER=0" 极可能是假完成

### 产出 frontmatter 硬要求

`P1-review.md` 的 frontmatter **必须**声明 `reviewed_bdds`（= P1 里 `#### BDD-N:` 集合，**逐条相等**）。注意本任务 BDD 可能是**一位数或两位数**编号——**先 grep 取准实际编号再填**，填错 gate 直接 exit 1。

### 只读纪律（强制）

- **禁止** `git checkout -- .` / `restore` / `reset` / `stash` / `clean` / `add` / `commit` / `switch -f` / 直接编辑被评审文件
- **禁止**对真实仓库运行写类工具（`agate-inject-card.py` / `agate-md-field-set.py` / `agate-state-set.py` / `agate-task-init.py`）
- 唯一允许写入的是你自己的产出文件 `P1-review.md` + progress
- 需要跑验证只在仓外或可丢弃副本上做；scratch 失败如实上报
- **严禁**在 `backend/tests/` 或 `frontend-v3/src/` 留 scratch 探针（改用 `.agate-tmp/`）
- 结束前 `git status --porcelain` 核验

### 环境约束
- 严禁触碰生产 `:8080` 与 `~/.peekview/`
- 状态标记二值：`[PROD_NOT_TOUCHED]`
- 任何 bash 命令外层 `timeout`
- 临时产物落 `.agate-tmp/`

### 输入文件
- `{AGATE_WORKSPACE}/tasks/TPV0103-time-format-mainline/P1-requirements.md`（**被评审对象**）
- `{AGATE_WORKSPACE}/tasks/TPV0103-time-format-mainline/P0-brief.md`（决策推翻声明 + 实测 + 风险）
- `{AGATE_WORKSPACE}/tasks/TPV0102-explore-card-list-ux/P1-requirements.md`（**反面参照**：要反转的判据原文）
- `frontend-v3/src/composables/useRelativeTime.ts`
- `AGENTS.md`
- `{agate_root}/assets/review-roles/requirements-review.md`（角色定义）

### 产出文件字段

用 `FILE={AGATE_WORKSPACE}/tasks/TPV0103-time-format-mainline/P1-review.md agate-md-field-set --list` 查字段。

已确定值（直接复制）：phase=P1, task_id=TPV0103, parent=P1-requirements.md, trace_id=TPV0103-P1-review-20261111, agent=requirements-review, created=2026-11-11

由你判定：`status`（approved / needs-revision / rejected）、`reviewed_bdds`（**先 grep 取准实际编号**）

**主动 set `prod_touched false`**
</dispatch_guide>

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P1

路径：phase-cards/P1-requirements.md
---
# P1 — 需求基线

> 当前状态：[首次 / 重试 #N]
> P1 不可裁剪（核心阶段）

## 如果是首次进入本阶段

1. 派发 analyst subagent → 产出 P1-requirements.md
   1.1 写 P1-dispatch-context-analyst.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
2. 主 Agent 确认：BDD 验收条件 ≥1 条 + 无未决 NEED_CONFIRM
2.5 派发 requirements-review subagent（角色文件：{agate_root}/assets/review-roles/requirements-review.md）
     2.5.1 写 P1-dispatch-context-requirements-review.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
    输入：P1-requirements.md
    产出：P1-review.md（agent≠main，含 BDD 编号引用 + 覆盖维度标注）
    review 不通过 → analyst 修改 → 再 review → … → approved（⑩迭代循环）
3. 预跑 check-gate.py P1（exit 2，主 Agent 自判）
4. git add {AGATE_WORKSPACE}/tasks/{Txxx}/（含 .state.yaml + 产出文件，若 .gitignore 忽略需 git add -f）
   ⚠️ 此时 .state.yaml 的 phase 保持 P1，不要提前写 P2——phase = 本 commit 的产出阶段
5. git commit -m "wf({Txxx}-P1): {摘要}"（phase=P1，P1 产出含 P1-requirements.md + P1-review.md）
6. P1 commit 完成后进入 P2：**phase 推进 P2 随 P2 产出 commit 一起**（P2-design.md + P2-review.md 就绪后），不是单独 phase commit

## 如果是重试

确认上一轮失败原因（BDD 不完整 / domains 声明错 / NEED_CONFIRM 未处理）
→ review 不通过时：analyst 修改需求 → 重派 requirements-review → 共享 retry 预算
→ 读 agate/rules/state-transitions.md 确认 retry 上限（P1 MAX=3）

## 前置条件

- [ ] P0-brief.md 完成（四字段齐全）

## 派发

- **角色**：analyst（`{agate_root}/assets/execution-roles/analyst.md`）
- **输入**：P0-brief.md（env_constraints / known_risks / executor_env）
- **输出**：P1-requirements.md
- **派发 prompt 模板**：`{agate_root}/assets/templates/dispatch-prompt.md`

## 复杂需求编排（模式 4，条件触发）

需求复杂（多来源 / 多模块 / 无法预先拆清范围）时，P1 可先派**侦察 subagent**（模式 4 先理解后拆，见 dispatch-protocol「派发编排机制」）读全貌后再拆需求：

1. 侦察 subagent 读 P0-brief + 相关上下文，产出拆分方案（拆成哪些子需求、各子需求的输入/产出/依赖）
2. 按方案派 analyst（并行或串行）分别产出需求基线
3. 合并时定义**合并语义**（在侦察产出中声明，P7 一致性检查依赖）：
   - **BDD 全局编号**：各子需求承接的 BDD 编号全局唯一（`#### BDD-NN:`），不允许各子需求各自从 1 编号
   - **包归属去重**：每个 BDD 明确归属唯一包，跨包的共享件单独列出，不允许两个子需求各写一份

## 产出规格

P1-requirements.md 必须包含：
- BDD 验收条件（至少 1 条，Given/When/Then 格式）
- `domains:` 声明（backend / frontend / mcp / security）
- `packages:` 声明（受影响的包/模块）
- `risk_level:` 声明（low / medium / high）→ 决定 P2 评审强度
- `ceremony:` 声明（thin / standard / full）→ 仪式深度档位（可选，缺省 standard，fail-closed：不声明或声明要素不满足一律按 standard 处理，不做薄化）
- `phases:` 裁剪声明（跳过哪些阶段 + 理由）
- `judge:` 启用声明（RM-AG0039 强制）：机制后新任务（P1 `created` ≥ `judge_required_since`，见 `agate/rules/dispatch.yaml`）P1 初始化须在 `.state.yaml` 写 `judge.enabled: true`——check-gate P1 机械校验（缺失/未启用 → exit 1）；历史任务（created < 截止或未声明）缺块 → 跳过
- `capability_requirements:` 能力需求声明（available / supplementable / GAP 三态）
- 无未决 `[NEED_CONFIRM]`（有则 PAUSED）；无待确认项时写 `[NO_NEED_CONFIRM]`

`risk_level`/`phases`/`packages`/`domains` 写在文件头 **frontmatter**（`---` 分隔块），不写正文。
**可直接复制的完整样例**：
```yaml
---
phase: P1
task_id: TAG0001           # 替换为实际任务编号
type: problems
parent: P0-brief.md
trace_id: T001-P1-20260101 # {task_id}-P1-{YYYYMMDD}
status: draft
created: 2026-01-01
agent: analyst
# ── v2.0 机器字段 ──
risk_level: low             # low / medium / high，必填
ceremony: standard          # thin / standard / full，可选；缺省 standard（fail-closed）
phases: [P1, P4, P5, P6, P8]   # list of P\d+，必填
packages: [pkg-a]           # list，必填
domains: [backend, frontend]  # list，必填
# 可选字段：override / implicit_coupling / coupling_checklist / internal_only /
# internal_only_reason / 跳过风险 / design_trivial / follows_existing_pattern
# ── RM-AG0039 judge 启用声明（写在 .state.yaml，非 P1 frontmatter）──
# 机制后新任务（P1 created ≥ judge_required_since，rules/dispatch.yaml "2026-08-22"）必须
# 在 .state.yaml 写 judge.enabled: true——check-gate P1 机械校验，缺失/未启用 → exit 1
# ── v2.0 refactor 任务类型声明（可选，缺省 = 功能任务）──
# change_type: refactor   # 当前仅支持 refactor；枚举非法值由 frontmatter schema 拦截
# ── TAG0007 项目阶段声明（可选，缺省 = established，向后兼容）──
# project_phase: bootstrap   # bootstrap（0→1 新项目）/ established（既有项目，缺省值）；
#                             # bootstrap 时 P2 architect 需额外产出 P2-skeleton.md（骨架声明）
# ── TAG0006 UI/UX 渲染形态声明（可选，presence 语义：缺失 = 常规布局型默认，不红基线）──
# ui_render_shape: render_component   # str，规范形态值：layout（布局型）/ render_component
#                                     # （渲染组件型，仅举例 OpenGL/WebGL/Canvas/图表/模型/特效/
#                                     #  地图/数字地球）/ temporal_effects（时序特效型）；开放集合可扩
# ui_ux_dimensions: [渲染正确性, 动效时序]  # list，从 UX 分类框架选适用维度；渲染组件/时序特效
#                                     # 类形态必填，常规布局型可省略
# ── v2.0 标记"已解决/已确认"状态（可选，仅标记存在时写）──
# need_confirm_resolved: []   # list[str]：已解决的 NEED_CONFIRM 项描述（逐条匹配正文）
# suggest_resolved: []        # list[str]：已采纳的 SUGGEST 项描述
# scope_resolved: []          # list[str]：已解决的 SCOPE+ 项描述
# ── TAG0050 批 E/F 结构化字段（非 legacy 任务）──
# scope_plus: [{id: SP1, text: "增补项"}]   # list；P7 聚合，须被 scope_resolved 覆盖
# pruned: [{phase: P3, reason: "low 风险可裁", risk: low}]  # 跳过阶段；phases ∪ pruned == phase_universe（恒检）
---
```

**UX 类别 BDD 与分类框架（domains 含 frontend 时必做）**：frontend 任务的 P1 必须含至少一条
UX 类别 BDD，并按实际 UI/渲染形态声明 `ui_render_shape` + 从 **UX 分类框架**（布局结构/
渲染正确性/交互行为/动效时序/视觉呈现等示例性开放集合）选 `ui_ux_dimensions` 维度，类别写入
BDD 标题后缀（如 `#### BDD-3: 渲染正确性：...`）。判据必须可量化（渲染正确性 → 渲染结果对比 +
diff 阈值或输出断言；时序 → 帧/时间戳对齐；动效 → 过渡/动画关键帧与结束状态断言；手势交互 →
动作输入的坐标/参数量化），禁主观词。缺失形态声明/维度选择/UX BDD → requirements-review 打回，
P1 gate 在"声明了形态但维度为空"或"维度不在分类框架且未在 BDD 标题声明"时 exit 1。

**人工体验路径验收（强制节）**：任务产出含**用户可见页面**且**页面内容受 seed 数据影响**时，
P1 必须追加一条**人工体验** BDD，句式强制为「Given seed 数据 → 页面有内容」（验证用户按文档 seed 后
页面在人工体验路径下确实渲染出内容）；不得只用 fixture 或单测断言替代人工体验路径验收。

**NEED_CONFIRM 分级**：
- `[SUGGEST: 推荐 X，理由 Y]` - 有倾向但求确认。主 Agent 可自行采纳倾向（除非涉及破坏性变更/业务方向），不必问用户
- `[NEED_CONFIRM]` - 真无方向需人定夺。阻塞推进，主 Agent 问用户

## ceremony fail-closed 声明 checklist（TAG0019，BDD-7/8/9）

`ceremony:` 声明仪式深度档位（thin / standard / full），缺省 standard（fail-closed——不声明或声明要素不满足一律按 standard 处理）。声明 **thin**（薄仪式）时，P1 必须连同以下四要素一起声明，缺一 → check-routing exit 1，档位回退 standard：

1. **申请**：`ceremony: thin` 显式声明
2. **逐信号 checklist**：`coupling_checklist: [...]` 流式声明（判据 `^coupling_checklist:\s*\[`，复用 check-pruning）
3. **跳过风险评估**：`跳过风险:` 声明（复用 check-pruning 判据）
4. **P5/P6 保留**：`phases` 含 P5 与 P6（薄化仪式不薄化验证，P5/P6 由 check-routing / check-pruning 双闸兜底）

不声明（存量/新任务缺 ceremony 字段）→ standard，不拦截。`ceremony: full` 的任务 `phases` 必须含 P7（P7 不可裁，缺失由 requirements-review 审声明拦截，BDD-14）。

### M3 验收锚度量协议（BDD-12，机制文档供提取）

thin 档跳过 LLM 评审的 M3 验收锚四要素：

1. **评审轮数**指标：任务在 P2/P4 阶段派发的 LLM 评审 subagent 轮数（含重试轮）
2. **真实发现数**指标：评审产出中被采纳或阻止了真实问题的条数（排除非阻塞建议、排除机械检查可抓项）
3. **TAG0018 基线值**：4 场 LLM 评审 ≈0 净收益（17 条非阻塞 + 1 条真实发现且机械检查可抓）
4. **不达标决策规则**：「LLM 评审真实发现 ≈ 0 且机械 gate 已覆盖 → 回滚 standard」

## 同类扫描（强制节）

需求基线必须含一次**同类扫描**结论——被报告的那一处几乎从来不是唯一的一处。P0 卡片的「同类/影响面预判」给出粗粒度量级，P1 在此基础上把清单做实：

1. **扫描动作**：对问题涉及的关键符号（函数名、字段名、配置键、协议节标题、错误文案）用 grep/rg 扫全仓，记录**命中数量 + 文件清单**
2. **逐条判定**：每个命中标"本次处理 / 本次不处理 + 理由"。本次不处理的同类实例要么进 roadmap，要么写清为何不构成同一问题
3. **回归拦截**：若同类问题未来还会新增（不是一次性修完的存量），需求里要声明拦截手段（新增测试 / gate 脚本 / 文档约定），并转成对应 BDD
4. **结论落盘**：扫描结论写进 P1-requirements.md 正文（不是只写在 progress 里）；即使结论是"已确认只此一处"也要显式写出，空白不算做过
5. **机械门禁必须实测，不得推理**：凡本任务**新增或改名 `agate/scripts/` 下的脚本/文件**，除逻辑上的同类扫描外，还须对「**既有测试与 gate 是否会因这个新文件被触发**」做**实测**——把文件真放进仓库，跑一遍相关测试与 consistency，记录**实际**变红/告警的面。「凭推理判『不处理』」在本仓库已被证伪（TAG0036 M18：P1 推理判"不处理"，P2 评审实测才发现 SG.6 由绿转红）。登记面权威清单见 `agate/scripts/README.md`「新增脚本登记面」节（该节已区分**机械门禁**与**团队约定**，照单登记前先看类型列）。

同类扫描缺失 → requirements-review 打回（"只修被报告的那一处"是 agate 反复复发的反模式）。P2 的「影响面梳理」在本节结论上继续做候选方案级的影响域分析，三处（P0 预判 / P1 同类扫描 / P2 影响面梳理）同源、逐级细化，不重复劳动。

## verification_env vs supplementable 边界判断树

`capability_requirements` 三态（available / supplementable / GAP）和 `verification_env`（运行环境声明）经常被混用——TAG0009 的 11.7 小时就是把一个环境问题错标成 `supplementable` 导致的。P1 声明时按下面的判断树走：

```
先问：缺的是能力还是环境？
├─ 缺的是「agent 侧的能力」（看不见图 / 不会用某工具 / 没有某技能）
│   └─ 走 capability_requirements 三态：
│      ├─ 当前就有 ................................. available
│      ├─ 当前没有，但能通过派发子角色 / 注入 skill / 换工具补上 ... supplementable
│      │   （必须在需求里写清补充方式，否则等同 GAP）
│      └─ 当前没有且补不上 ......................... GAP（阻塞，PAUSED 交人工）
└─ 缺的是「运行环境」（服务没起 / 端口没通 / 数据库没建 / 依赖没装 / 平台不支持）
    └─ 走 verification_env 声明（不是 supplementable）：
       ├─ 环境可由主 Agent 用标准操作准备好 → P1 声明 verification_env，
       │   由主 Agent 按 dispatch-protocol.md「环境准备职责边界」统一准备
       └─ 环境本质不可得（权限/凭据/平台原生不支持）→ 这是不可重试类，
           按 dispatch-protocol.md「verification_env 失败处理协议」立即升级人工
```

**判别口诀**：换个更强的模型/角色就能做 → 能力问题（supplementable）；换谁来做都得先把服务起起来 → 环境问题（verification_env）。**把环境问题标成 `supplementable` 属于机制误用**，不算"环境故障"，不消耗验证轮次预算，应立即改正声明方式。

**环境验证轮次预算占位声明位**：声明了 `verification_env` 的任务，P1 需求里留一行轮次预算占位（默认止损轮次 = 2 轮，与阶段 `retries[Pn]` 独立计数），供 P5/P6 派发时由主 Agent 在 dispatch-context 中接续记录"当前第几轮 + 历次已排除假设"。数值与完整规则的权威定义在 dispatch-protocol.md「verification_env 失败处理协议」，本卡片不重写：

```yaml
verification_env: "debug server http://127.0.0.1:3001 + tests/fixtures/test.db"
verification_env_budget: "止损轮次 2（独立计数，不占 retries[P5]）；轮次追踪由主 Agent 在 dispatch-context 记录"
```

## P0-brief 时效性质疑

analyst 拿到 P0-brief 后不默认它仍然成立——立项与实际启动之间可能已经漂移（跨会话恢复、任务搁置后重启、从 PAUSED 恢复）。P1 阶段必须做一次时效性质疑，判据（严重 3 条 / 轻微 2 条）的权威定义见 P0 卡片「P0-brief 时效性自检（漂移判据）」，本节只定标记规则与处理方式：

**标记格式**（行首声明，一个漂移点一行，必须写出**具体漂移点**，不允许只写标记裸词）：

```
[P0_STALE: executor_env 声明的 CI 镜像已下线，当前实际跑在 ubuntu-24.04]
[P0_STALE: task 描述的 .sh 路线已全量 Python 化，目标方案本身不再成立]
```

**阻塞 / 记录二选一**（按漂移严重程度分流，不允许"既不阻塞也不记录"地含糊推进）：

| 漂移程度 | 处理 | 落盘 |
|---------|------|------|
| **严重**（命中 P0 卡判据 1-3 任一条） | **阻塞**：停止 P1，回 P0 重新立项 / 重做可行性分析 | P1-requirements.md 写 `[P0_STALE: 具体漂移点]` + 说明为何判定严重；主 Agent 按 PAUSED 或回 P0 流程处理 |
| **轻微**（不命中判据 1-3） | **记录**：更新 P0-brief 对应字段后继续 P1，不阻塞 | P1-requirements.md 写 `[P0_STALE: 具体漂移点]` + 已更新哪个字段 |
| 无间隔 / 已核对无漂移 | 继续 | 写一行"已核对 P0-brief 时效性，无漂移"，空白不算做过 |

## gate 规则

check-gate.py P1 → P1-review.md 存在 + status:approved + agent≠main + 含 BDD 编号锚点 → exit 2（BDD 编号格式为 `#### BDD-NN:`）；缺 P1-review.md / agent=main / 无锚点 → exit 1
P1 评审不可裁——所有任务都走独立 requirements-review，无例外

## 推进条件（全部满足才写 phase: P2）

- [ ] P1-requirements.md 含 BDD ≥1 条
- [ ] 含「同类扫描」结论（命中清单 + 逐条处理判定，"只此一处"也要写出）
- [ ] 若本任务新增/改名 `agate/scripts/` 下文件：登记面已按 `agate/scripts/README.md`「新增脚本登记面」节**实测**过（不是推理），并记下实际变红/告警的面
- [ ] P0-brief 时效性已质疑：无漂移则记录已核对；有漂移则含 `[P0_STALE: 具体漂移点]` 且已按阻塞/记录二选一处理
- [ ] domains / packages / risk_level / phases 已声明
- [ ] 无 [NEED_CONFIRM] 标记
- [ ] 无 status: GAP（supplementable 不阻，GAP 阻）
- [ ] P1-review.md status: approved（agent≠main，含 BDD 编号锚点）

## 常见错误

1. **BDD 写成技术实现而非用户行为**：BDD 应该描述"用户能看到什么/系统应该做什么"，不是"调用哪个 API"
2. **domains 声明不全**：漏了某个受影响域 → P2 不派该域的评审 → 实现方向错误
3. **capability_requirements 漏声明**：P6 验收时才发现需要但不可用的能力 → 返工。**frontend 任务
   漏声明 vision 视觉能力条目（need 含 visual/vision）→ P1 gate exit 1 硬拦**（check-gate.py
   `_gate_p1_vision_capability`）；声明形态但漏选维度 / 形态声明与 UI/渲染形态不符 →
   同样 exit 1
4. **gate 不过 ≠ 你失败了**：红灯指向工作/设计的问题，不指向你。正确动作是诊断→退回/重试/PAUSED，不是修改产出让它变绿。

## 下游影响

- P2 设计依赖 domains + risk_level 决定评审角色
- P6 验收逐条对照 P1 的 BDD（PASS/FAIL 总数必须 ≥ P1 BDD 总数）
- P7 一致性检查依赖 packages 声明做跨文件交叉核对

## 评审

P1 评审通用必有（所有任务都走 requirements-review），P2/P4 评审是 C8 域触发（见 review-mapping.md）——二者在"是否通用"上不对称，仅在"独立 subagent、agent≠main"上类比。P1 评审不可裁剪。
review 不通过 → analyst 修改需求 → 再 review（⑩迭代循环），直至 approved。

> 完成 → 读 phase-cards/P2-design.md


## P1 基线保护

P1-requirements.md 是需求基线，后续阶段（P2-P8）不应直接修改。如需变更（如 P4 发现 BDD 矛盾需补充注释），必须：
1. 主 Agent 显式批准
2. 在变更处标注 `[BASELINE_CHANGE: 理由]`
3. 不改 BDD 的 Given/When/Then 语义（只补充注释/优先级说明）
4. **隐含扩展同样要授权**（TAG0025 教训）：P3/P4 的实现细节若事实上扩展了 P1 验收标准的范围（新增豁免条件、放宽/收紧某条 BDD 的判定边界等），即使当下未产生"矛盾"，也视为需要`[BASELINE_CHANGE]` 授权的情形——授权内容必须回写 P1-requirements.md 正文，不得只存在于下游阶段的 dispatch-context 口头引用中
<!-- AGATE_CARD_END -->

<objective_info>

**仓库状态**：HEAD `17d6c7bc`（TPV0103 P0 已提交）。`P1-requirements.md` 未提交（未跟踪）。

**主 Agent 已实测的事实（可直接使用；需扩展时自行复验）**

- **32 locale 的数字段数分布**（`Asia/Shanghai` + `2026-11-10T09:43:00Z`）：
  - 主显（无 timeZoneName / 无 second）→ **5 段 × 32**
  - 含 second → **6 段 × 32**
  - shortOffset → **6 段 × 32**
  - longOffset → **7 段 × 32**
- **P0 原判据的假 FAIL 实例**：`sv-SE` `2026-11-10 17:43` / `lt-LT` `2026-11-10 17:43` / `nl-NL` `10-11-2026, 17:43` / `en-CA` `2026-11-10, 05:43 p.m.` —— 全部因日期分隔符 `-` 被 `/GMT|UTC|[+-]\d/` 的 `[+-]\d` 误命中
- **主显实测输出**：`zh-CN` `2026/11/10 17:43` / `en-US` `11/10/2026, 05:43 PM` / `de-DE` `10.11.2026, 17:43` / `fr-FR` `10/11/2026 17:43` / `fi-FI` `10.11.2026 klo 17.43`
- `TimeDisplay` 的**四个消费方**：`EntryCard.vue` / `EntryListRow.vue` / `EntryDetailHeader.vue` / `EntryMetaTagsBar.vue`
- `ApiKeySettingsTab.vue:270` 与 `ApiKeyListView.vue:285` 用 `toLocaleDateString()`（**无 timeZoneName**）→ 不受本次改动影响，且是"仓内本来就不加偏移"的旁证

**未查证（需你自查）**
- analyst 报的「7/32 locale 漏判 tooltip 偏移」是否准确（自己验）
- 改动面「8 / 3 / 5」的分类是否准确（自己 grep 核对）
- P1 的 12 条 BDD 是否完整覆盖 TPV0102 的 BDD-01/03/04/26 + VC 契约

</objective_info>

> 注：该文件禁止包含 PASS/FAIL 预判——否则被 `check-p6-provenance.py` 审计失败。
