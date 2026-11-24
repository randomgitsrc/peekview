---
phase: P1
generated_by: agate-inject-card.py + 主 Agent
task_id: TPV0104
role: analyst
round: 3
---

<dispatch_guide>
> ⚠️ 以下派发指引是本次任务的强制指令，不是参考信息。执行优先级：派发指引 > 客观查证信息 > 阶段卡片（参考规范）

### 目标

**P1 第 3 轮（最后一轮修订，`retries[P1]` 计 2 / 上限 3）**：只修第 2 轮复审剩下的 **2 项 BLOCKER + 6 项 WARNING**，使 `P1-review.md` 可给出 approved。

**极重要：只改这 8 处，不要动其它任何内容。** 第 1 轮 11 项 BLOCKER 中 **10 项已被第 2 轮评审实测确认闭环**（B1/B2/B3/B4/B5/B6/B8/B9/B10/B11），需求方向、8 项缺陷源码事实、决策 A/B、同类扫描 9 组、P0 时效性质疑、裁剪声明、UX 形态声明、能力三态、§11 那 12 条回归守护标签——**全部复核通过**。改动面过大将触发第三轮重试，预算只剩 1 次。

### 必须修的两项 BLOCKER

#### B-NEW-1 — `BDD-05` 的 When 不可执行（`render().html` 恒为空串）

- **事实**：`frontend-v3/src/composables/useMarkdown.ts:480` 是该渲染函数的**唯一 return 点**，返回 `{ blocks, headings, html: '', ... }`——**`html` 是常量空串，永远为空**。真实 HTML 全在 `blocks[]`（`:414` `blocks.push({ type: 'html', html: segment })`）。
- **后果**：BDD-05 的 When 写「vitest 层直接消费 `render()` 返回的 `headings` 与 `html`」→ P6 照字面写会拿到 `html === ''`，要么测试报错，要么退化成"断言空串"**静默失去区分力**（而断言②正是本条唯一区分力来源）。
- **推荐改法（评审也推荐）**：把断言②**移到 Playwright 层真实 DOM**。该判据**已被我和评审双方独立实测确认可执行且现状 FAIL**：
  - 现造 entry 含 `## **粗体**与[链接](other.md)` → `.toc-list a` 文本 = `**粗体**与[链接](other.md)`；`.markdown-body h2` 的 `textContent` = `粗体与链接`、`id` = `粗体与链接othermd`
  - 即：断言「TOC 可见文本不含 `**`/`[`/`](` 且去空白后与正文 `h2.textContent` 逐字相等」→ **现状 FAIL，有区分力**
- **备选改法**：vitest 层改为消费 `blocks` 中 `type === 'html'` 的段拼接后再取 `<h2>`。你若选这条，须写明确切取值路径。
- **改完须自检**：「P6 按新 When 写测试，能取到 HTML 吗？」答不出确切路径就选推荐改法。

#### B-NEW-2 — `BDD-35` 假 PASS（观测面含现状已满足的字段）

- **事实**：BDD-35 的 When 允许「**既有返回值结构中的字段**」作为观测面，而现状 `useCsvParser.ts:12` 的 `rows = dataRows.slice(0, maxRows)` **已保证 `rows.length ≤ maxRows`**。实测（1000 数据行 + `maxRows=5`）：`rows.length = 5`（≤5 成立）、`totalRows=1001`、`truncated=true` → **Then 现状全满足 = 假 PASS**。
- **后果**：V-03 的真缺陷是「先全量构造二维数组再 slice」（`useCsvParser.ts:7` 的 `const allRows = parseRows(cleaned, delimiter)` 在 `:12` slice 之前）——**该缺陷完全未被验证**。这与第 1 轮 B6 指出 BDD-36 假绿是同一陷阱，搬到 BDD-35 时被一并搬过去了。
- **改法要求**：把观测面收窄到**只能反映"构造了多少行"而非"返回了多少行"**。例如：
  - 要求解析器**显式暴露**"实际构造的数据行数"（如导出函数返回值 / 解析统计 / 可注入计数回调），并明确 `rows.length` **不可作为观测面**（因为 slice 后天然满足）；
  - 或断言「`parseRows` 内部构造的数组长度上界」这类**只有改实现才能满足**的量。
- **注意**：不要重新引入 W13（指定 P4 函数签名）。可以用"解析器必须暴露某事"的行为描述，而不是写死签名。
- **改完须自检**：用现状实现跑一遍该 When 的观测方式，若能量出「≤ maxRows」→ 仍是假 PASS，继续收窄。
- **连带**：同步 §10 依赖表的「V-03 依赖」行（W-新 1）。

### 6 项 WARNING（一并修，都很小）

| # | 位置 | 改法 |
|---|---|---|
| W-新 2 | §3 的 TOC 幂等表述 + BDD-01/02/03/04/06/52 | **补 `aria-expanded === null` 分支**。实测移动端（390×844）的 TOC 入口是 `[data-testid="mobile-bar-toc-btn"]`，其 **`aria-expanded` 不存在（读得 `null`）**，且移动端 TOC 走 drawer（`showTocDrawer`）与 `.toc-sidebar` 不是同一条 v-if 链。→ §3 幂等表述补第三分支（`null` → 该视口不适用本条，改用桌面视口重跑）；6 条 BDD 的 Given 明确「桌面视口 1280×800」 |
| W-新 3 | BDD-31 断言② | 补「（同样**不含 `title` 属性**）」，与 BDD-23/24 口径统一；Given 补「正文不含图表块」。理由：`DiagramBlock.vue:177` 有 `title="Fullscreen"`，正文含图表时会计数 2 → 假 FAIL |
| W-新 4 | BDD-53 断言① 的事实依据 | 把 `.meta-tags-bar` 从「DOM 保留、仅样式隐藏」的并列中**拆出**，注明「实测 DOM 计数 **0**（非 `v-show`）」。`.detail-header` 才是 DOM 1 / 可视 0。**判据不变** |
| W-新 5 | 4 处交叉引用错位 | L95 与 L649 的 `BDD-44` → **`BDD-43`**；L541 的 `BDD-14` → **`BDD-13`**；L648 的 `BDD-48` → **`BDD-47`**。（行号以当前文件为准，请按语境核对后再改） |
| W-新 6 | BDD-50 Then ② | 补「前提：P5 已按本节 Given 的基线数字产出 `known-failures.md`（逐 case）；**缺失该文件时本条判 FAIL 而非 PASS**」 |
| W-新 1 | BDD-35 / §10 | 改 BDD-35 后同步 §10「V-03 依赖」行 |

### 约束

1. **不要改**：需求方向、8 项缺陷源码事实表、决策 A/B 表述、同类扫描 9 组结构与命中清单（§6.5/§6.6 已在第 2 轮修正，保持）、裁剪声明、`risk_level: medium` / `ceremony: standard` / `packages` / `domains` / `capability_requirements` / `ui_render_shape` / `ui_ux_dimensions`、P0_STALE 三条、`[NO_NEED_CONFIRM]`。
2. **不要重新编号**（保持 01–54）。若必须改某条编号，须同步全部交叉引用并在 §11 记录。
3. **不要动 `P1-review.md`**（评审产出）。
4. frontmatter 用 `agate-md-field-set.py` 写；`status` 保持 `draft`。
5. §11 变更记录追加第 3 轮条目（简短即可）。
6. BDD 编号格式保持 `#### BDD-NN: {类别}：{标题}`。
7. **改完自检**：① BDD 总数仍 54、编号 01-54 连续；② 全文交叉引用无越界（≤54）；③ 两条 BLOCKER 的新 When 你**自己按字面跑一遍**能取到观测值（B-NEW-1 可造 entry 实测，B-NEW-2 可用现状实现验证"能否区分"）。

### 上游关联

- 第 2 轮 `P1-review.md`（43783B）是本次核查清单：**2 BLOCKER（B-NEW-1/B-NEW-2）+ 6 WARNING（W-新 1~6）**，其余全部复核通过。
- 三轮的错误与更正已达共识，**不要再重新论证已闭环的 10 项**。
- 主 Agent 与你双方已各自独立复现两条 BLOCKER 的事实（`useMarkdown.ts:480` 空串 / `parseCsv` slice 已保证上界），可直接引用。

### 输入文件

- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P1-review.md`（**第 2 轮复审，本轮唯一核查清单**）
- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P1-requirements.md`（你要改的文件，817 行/54 条）
- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P0-brief.md`
- `{project_root}/AGENTS.md`
- 源码按需：`frontend-v3/src/composables/useMarkdown.ts`（:410-485）、`frontend-v3/src/composables/useCsvParser.ts`（全文）、`frontend-v3/src/components/EntryDetailMobileBar.vue`（:9-17）、`frontend-v3/src/components/DiagramBlock.vue`（:177）

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
- 环境状态（主 Agent 2026-11-24 21:10 实测）：debug backend `:8888` 在线、`alice total == 22`、`anon total == 15`（seed 基线）。生产 `:8080` 不可达，零接触。git HEAD=`899a9d43`，工作区有未提交产出（**不要 commit**）。
- 已确认事实（可直接引用，不必重跑）：
  - `useMarkdown.ts:480`：`return { blocks, headings, html: '', mermaidSources: ..., plantumlSources: ..., svgSources: ... }` —— `html` 常量空串；真实 HTML 在 `blocks[]`（`:414`）
  - `useCsvParser.ts:7` `const allRows = parseRows(cleaned, delimiter)`；`:11` `truncated = totalRows > maxRows`；`:12` `rows = dataRows.slice(0, maxRows)` → **`rows.length` 现状天然 ≤ maxRows**
  - 现状实测（1000 数据行 + maxRows=5）：`rows.length=5`、`totalRows=1001`、`truncated=true`
  - `EntryDetailMobileBar.vue:9-17` 的 `[data-testid="mobile-bar-toc-btn"]` **无 `aria-expanded` 属性**
  - `DiagramBlock.vue:177` `<button class="diagram-action-btn fullscreen-btn" ... title="Fullscreen">⧉</button>`
  - TOC 实测（桌面 1280×800，现造 entry 含 `## **粗体**与[链接](other.md)`）：`.toc-list a` 文本 = `**粗体**与[链接](other.md)`；`.markdown-body h2` = `textContent: 粗体与链接`、`id: 粗体与链接othermd`
- 环境坑：`npx tsx` 不可用（用 `/home/kity/oclab/deepseek-harness/node_modules/.bin/tsx` + `NODE_PATH=$(npm root -g)`）；临时产物落 `.agate-tmp/`（不用 `/tmp`）；造/删 entry 只经 debug HTTP API 且**用完即删**；**造件须同时给 `filename`**（只给 `path` 会得 `filename=untitled`、`language=null`）。
</objective_info>
