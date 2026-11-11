---
phase: P1
generated_by: agate-inject-card.py + 主 Agent
task_id: TPV0103
role: analyst
---

<dispatch_guide>
> ⚠️ 以下派发指引是本次任务的强制指令，不是参考信息。执行优先级：派发指引 > 客观查证信息 > 阶段卡片（参考规范）

### 目标

产出 `P1-requirements.md`——把「时间主显格式修正」转化为**可二值判定的需求基线**。

**本任务的特殊性：这不是新功能，是反转 TPV0102 的验收判据。** TPV0102 的 BDD-01 写的是「主显**必须含 `GMT±N`**」，本次要改成「主显**不得含时区偏移**」。你的核心工作是把这条反转做实、且**不再犯同类错误**。

### 约束

**必须理解的背景（P0-brief 有完整记录，务必先读）**

TPV0102 立项时我定了「**强制带时区名**」，理由只有一句：「消除'这是哪里的时间'的歧义，无需任何配置」。用户看到 v0.27.0 实际效果后质疑「这样的 GMT+8 应该出现在普通用户界面么？为什么其他网站都没有？」

**质疑成立**，三条：

1. **「消除歧义」的前提不成立**：主显时间由浏览器时区决定，**就是用户本地的现在时间**——用户看自己的手表时间不需要标注时区
2. **「无需配置」无区分力**：所有候选方案都不需要配置
3. **`GMT+8` 是机器可读格式**：ISO 8601 / HTTP header 需要偏移（要在无上下文下传输）；用户界面有浏览器时区这一上下文，偏移是噪音。业界 GitHub / Gmail / Twitter 主显均不带偏移

**这次写 BDD 时的硬要求：每条判据必须能回答「为什么是这个标准」，不能只写「应该这样」。** 上一轮的失败正是因为「消除歧义」这种说法听起来合理、实则未经推敲就被当成判据。

**范围（严格，不得扩张）**

| 改 | 不改 |
|---|---|
| 主显格式（`formatFullDate`） | `formatTooltip`（悬停，保持完整偏移 + IANA 名） |
| 受影响的 BDD 判据 | 相对时间逻辑（`3h` / `in 3h` 已由 TPV0102 定型） |
| `upgrading.md` + CHANGELOG | 文件数显隐 / 可见性菜单 / 0 文件空态 |
| — | 后端 / API / MCP（**零改动**） |

**已实测的输出形态（主 Agent 实跑，可直接引用；需要扩展时自行复验）**

`Asia/Shanghai` + `2026-11-10T09:43:00Z`，`toLocaleString` 去掉 `timeZoneName` 与 `second`：

| locale | 输出 |
|---|---|
| `zh-CN` | `2026/11/10 17:43` |
| `en-US` | `11/10/2026, 05:43 PM`（12 小时制） |
| `ja-JP` | `2026/11/10 17:43` |
| `de-DE` | `10.11.2026, 17:43` |
| `undefined`（跟随系统） | `2026/11/10 17:43` |

正则验证：`zh-CN` 输出对 `/GMT|UTC|[+-]\d/` **无命中**。

若加 `hour12: false` → `en-US` 变 `11/10/2026, 17:43`。**主 Agent 建议不加**（会覆盖用户 locale 习惯，与"靠浏览器"本意相悖），但这是**你需要在 P1 判定并写明理由的决策点**——不能默认接受。

**P0-brief 时效性质疑（强制）**

P0 是今天（2026-11-11）写的，同日开工。仍须逐条核对严重 3 条判据。无漂移 → 写一行「已核对 P0-brief 时效性，无漂移」。

**同类扫描（强制节）**

必须扫清「还有哪里在显示时间且格式需要一同检查」：
- `grep` 全仓 `toLocaleString` / `formatFullDate` / `formatTooltip` / `GMT` / `shortOffset` / `longOffset`
- **重点**：`ApiKeySettingsTab.vue` / `ApiKeyListView.vue` 有 `formatRelativeTime` 的**本地重复实现**（TPV0102 已登记为技术债、本次不合并）——它们的时间显示是否也受影响？逐条判定「本次处理 / 不处理 + 理由」
- `expires.ts` / `StarManageView.vue` / `PublishResultPanel.vue` 等消费时间的地方，是否依赖主显格式？
- **结论写进正文**，即使「已确认只此一处」也要显式写

**BDD 设计要求（关键，别踩 TPV0102 的坑）**

TPV0102 的 BDD-04 硬编码了 `17:43:00` 字面量，在 `en-US` 下**必然假 FAIL**（12 小时制）；BDD-02 要求「IANA 名形如 `Area/City`」，在 `TZ=UTC` 下也是假 FAIL（`"UTC"` 无斜杠）。**这次必须避免同类问题**：

- **不要硬编码时间字面量**（`17:43` 在 en-US 下是 `05:43`）→ 用**形态匹配**（如 `/\d{2}:\d{2}/` 且不含秒）或**显式固定 locale**
- 若某条 BDD 需要跨 locale 验证，**Given 里必须写清 locale/时区前提**，不能留空
- 每条 BDD 的 Then 必须可**二值判定**，禁止主观词（"简洁"/"美观"/"清晰"）
- 编号格式 `#### BDD-NN:`（两位零填充），连续不跳号

**UX 类别 BDD（domains 含 frontend 时必做）**
- frontmatter 声明 `ui_render_shape: layout` + `ui_ux_dimensions`（建议 `[布局结构, 交互行为, 视觉呈现]`）
- 至少一条 UX 类别 BDD，类别写进标题后缀

**人工体验路径 BDD（强制）**
- 页面内容受 seed 数据影响 → 必须有一条「Given 按文档 seed → Explore 页时间显示正确形态」的 BDD

**能力声明（硬要求）**
- `domains` 含 `frontend` → `capability_requirements` **必须**有 `need` 含 `visual`/`vision` 的条目，`status` ∈ available/supplementable/GAP。缺 → P1 gate exit 1
- **vision 能力实测 available**：主 Agent 上轮验证 8 个模型 alive。调用方式：拷 skill 到 `.agate-tmp/ve/`（把 `ratelimit.py` 的 `_BASE_DIR` 指向可写路径），跑 `PYTHONPATH=/home/kity/.local/lib/python3.12/site-packages python3 .agate-tmp/ve/scripts/vision-analyze.py -i <图> -r quick`

**裁剪声明**
本任务 `risk_level: low`（纯前端展示层、无 schema/API/权限变更）、`follows_existing_pattern: [frontend-v3/src/composables/useRelativeTime.ts]`、`design_trivial` 候选。
**P1/P2/P4/P5/P6 不可裁；P3 保留**（`formatFullDate` 有可单测形态行为 + 26 处断言需 TDD 红灯确认）；P7 保留（跨 4+ 文件）；P8 保留（已发布行为变更 → bump）。各阶段写明理由。

**环境约束**
- 严禁触碰生产 `:8080` 与 `~/.peekview/`；调试只用 `make debug`（`:8888`）
- 严禁 `uvicorn` 直接启动；严禁 `pip3 install --break-system-packages`
- **严禁**在 `backend/tests/` 或 `frontend-v3/src/` 留 scratch 探针
- 状态标记二值：`[PROD_NOT_TOUCHED]`
- 任何 bash 命令外层 `timeout`；临时产物落 `.agate-tmp/`

**标注纪律**
- 真无方向用 `[NEED_CONFIRM]`（阻塞）；有倾向用 `[SUGGEST: 推荐 X，理由 Y]`（不阻塞）
- 无待确认项行首写 `[NO_NEED_CONFIRM]`

### 上游关联

- TPV0102 已发布 v0.27.0（commit `4541ea31`、tag `v0.27.0`）
- 本任务 P0 已 commit `17d6c7bc`
- **TPV0102 的 P1/P2 判据是本任务的"反面参照"**：读它的 `P1-requirements.md` 里 BDD-01/03/04/26 + P2 的 §UI 设计，理解哪些判据要反转、哪些要保留（尤其 tooltip 判据 BDD-02 **不变**）
- 26 处受影响的断言分布（主 Agent 已 grep）：`time-display.spec.ts` 6 / `useRelativeTime.spec.ts` 6 / `tpv0102-*.spec.ts` 6 / `filter-tabs.test.ts` 4 / `expired-warning.test.ts` 4

### 输入文件

- `{AGATE_WORKSPACE}/tasks/TPV0103-time-format-mainline/P0-brief.md`（**主输入**，含决策推翻声明 + 实测输出 + 风险）
- `{AGATE_WORKSPACE}/tasks/TPV0102-explore-card-list-ux/P1-requirements.md`（**反面参照**：要反转的 BDD-01/03/04/26，以及要保留的 BDD-02）
- `{AGATE_WORKSPACE}/tasks/TPV0102-explore-card-list-ux/P2-design.md`（§3.4 时间显示 + §5 UI 设计，理解现有结构与约束）
- `frontend-v3/src/composables/useRelativeTime.ts`（当前实现，约 80 行）
- `AGENTS.md`（项目约定）
- `{agate_root}/assets/execution-roles/analyst.md`（角色定义）

### 产出文件字段

用 `FILE={AGATE_WORKSPACE}/tasks/TPV0103-time-format-mainline/P1-requirements.md agate-md-field-set --list` 查字段，再逐个写入。

已确定值（直接复制）：phase=P1, task_id=TPV0103, parent=P0-brief.md, trace_id=TPV0103-P1-20261111, agent=analyst, status=draft, created=2026-11-11

由你判定：`risk_level`（建议 low）、`phases`、`packages`、`domains`、`ceremony`、`ui_render_shape`、`ui_ux_dimensions`、`follows_existing_pattern`、`design_trivial`

**主动 set `prod_touched false`**（TPV0102 连续 4 个阶段被此字段拦过）

⚠️ 工具坑：list 字段按**空白拆分**，不要写 `"[a, b]"`；非 legacy 任务**不得**在 `.state.yaml` 写 `status`。

返回前跑 `check-frontmatter.py`，exit 0 再返回。
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

**仓库状态**：HEAD `17d6c7bc`（TPV0103 P0 已提交），工作树干净。

**已实测的事实（可直接使用）**
- 上述 locale 输出表（`zh-CN` 无 GMT 命中）
- `useRelativeTime.ts` 现有结构：`FULL_DATE_OPTIONS`（含 `second: '2-digit'`）/ `formatOffsetDate(date, timeZoneName)` / `formatFullDate`（传 `shortOffset`）/ `formatTooltip`（传 `longOffset` + IANA 名）
- TPV0102 已实测确立：`dateStyle`/`timeStyle` 与 `timeZoneName` **不能共存**（`TypeError`）；时区名位置随 locale 变 → **禁止字符串拼接**

**未查证（需你自查，不要凭记忆断言）**
- `ApiKeySettingsTab.vue` / `ApiKeyListView.vue` 的本地 `formatRelativeTime` 是否也显示绝对时间、是否受影响
- `expires.ts` / `StarManageView.vue` / `PublishResultPanel.vue` 等是否依赖主显格式
- TPV0102 的 BDD-01/03/04/26 原文（务必读原文，不要凭本说明推断）

</objective_info>

> 注：该文件禁止包含 PASS/FAIL 预判——否则被 `check-p6-provenance.py` 审计失败。

---

## 主 Agent 追加实测（派发后补，可直接使用）

**同类扫描的部分事实已替你查证**：

| 位置 | 现状 | 与本次改动的判断 |
|---|---|---|
| `ApiKeySettingsTab.vue:270` | `new Date(dateStr).toLocaleDateString()`（**无 timeZoneName**） | **不受影响**：它本来就不带时区名 → **恰好是"业界做法"的仓内旁证**，说明项目其他地方从来不加偏移 |
| `ApiKeyListView.vue:285` | 同上 | 同上 |
| 两处的本地 `formatRelativeTime`（`ApiKeySettingsTab.vue:273` / `ApiKeyListView.vue:288`） | 各自本地实现，与 `composables/useRelativeTime.ts` 重复 | TPV0102 已登记为技术债、**本次不合并**（P1 需写清"不处理 + 理由"） |

> 这条事实值得写进 P1：**同一仓库里 API Key 的时间显示一直是 `toLocaleDateString()`（无偏移）**，只有 TPV0102 新引入的主显加了 `GMT+8`。这从仓内惯例角度进一步支持本次修正。
