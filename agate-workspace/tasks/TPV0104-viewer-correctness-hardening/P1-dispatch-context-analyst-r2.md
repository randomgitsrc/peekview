---
phase: P1
generated_by: agate-inject-card.py + 主 Agent
task_id: TPV0104
role: analyst
round: 2
---

<dispatch_guide>
> ⚠️ 以下派发指引是本次任务的强制指令，不是参考信息。执行优先级：派发指引 > 客观查证信息 > 阶段卡片（参考规范）

### 目标

按 `P1-review.md` 的 **11 项 BLOCKER + 14 项 WARNING** 修订 `P1-requirements.md`，使 `P1` gate 可过。这是 **P1 第 2 轮**（`retries[P1]` 计 1，上限 3）。

**不是重写**。需求方向、8 项缺陷的源码事实、决策 A/B、同类扫描 9 组骨架、裁剪声明、能力三态、UX 形态声明**都已获评审认可**，不要动这些。只改判据与失实的陈述。

### 约束

1. **首要原则：修"区分力"，不是修"条数"**。评审打回的根因是**假 PASS**（判据在现状/错前提下也能通过）与**两条不可执行的 Given**。每改一条，先问自己：**改动前这条会 PASS 吗？会 → 这条没有区分力，必须改到"改动前 FAIL、改动后 PASS"**。

2. **11 项 BLOCKER 逐条处理（全部已实测复现，不要重新论证，直接改）**：
   - **B1**：`/f` 下 `.file-sidebar` 与 `.toc-sidebar` **已由全局 `styles/layout.css:650-657` 隐藏**（`display:none`），我只查了 `EntryDetailView.vue:281-284` 的 scoped 规则 → 漏判。**BDD-30 / BDD-54 现状即通过 = 假 PASS**。改法（三选一并说明理由）：(a) 判据改为断言 `/f` 下 `.file-sidebar` **不存在于 DOM**（现状是"DOM 在 + CSS 隐藏"，有区分力）；(b) 认为不构成需求 → 按 `[BASELINE_CHANGE]` 降级并删除；(c) 保留但明确标注为回归守护。**同时修正 §2.2 的 E-2 表述**（须并列引用 scoped 与 global 两处隐藏集）。
   - **B2**：桌面视口 TOC **默认已展开**（`EntryDetailView.vue:243-246`，`isDesktop = viewportWidth > 640`）；点 `[aria-label="Table of Contents"]` 会**关掉**它。6 条 BDD（01/02/03/04/06/53）的 When「点开 TOC」须改为**幂等表述**：`确保 TOC 处于展开态（aria-expanded === "true"；若为 "false" 则点击，再等 .toc-sidebar 出现）`。并修正「TOC 默认不渲染」的说法为「**移动端默认不渲染，桌面端默认渲染**」。
   - **B3**：三条 Given 无区分力——**BDD-09** `sorted(['aaa.txt','README.md'])` 实为 `['README.md','aaa.txt']`（`R`=82 < `a`=97），README 本就是排序首个 → 改用 `AAA.txt`（`A`=65 < `R`=82）；**BDD-13** 构造序 `[readme.md, AAA.txt]` 现状兜底恰得 `readme.md` → 改为 `[AAA.txt, readme.md]`；**BDD-14** 用 `multi-format-demo` 顺序恰等于字典序 → 改为现造 entry 且**构造序 ≠ 字典序**（评审已实测 `POST files=[zzz.txt, aaa.txt, mmm.txt]` → 返回构造序，有效）。
   - **B4**：BDD-17/18/19 是"无效 `?file=` 安全回退"，但现状 `?file=` **根本不被读取** → "回退"碰巧成立。须加前置「`?file=<有效 id>` 已能生效」作为同测试内的前置校验（不成立即 FAIL），或改为**成对对照断言**（有效 id 确实切换 + 无效 id 不切换，同一测试内）。
   - **B5**：BDD-24 单条会假绿，须与 BDD-20 捆绑为同一测试（先断言切换后 `search` 含 `file=<id>`，再断言 `history.length` 未增），或合并进 BDD-20 作第二断言。
   - **B6**：BDD-36 三个断言现状全满足（`rows = dataRows.slice(0, maxRows)` 已保证长度）→ **标题改「回归兼容：」**，把"新行为"判据全部压到 BDD-35（构造数组长度上界）。
   - **B7**：BDD-05 现状即通过（两侧 id 已相等），但**真缺陷未覆盖**：TOC 条目**显示文本**直接输出 markdown 原文 `**粗体**与[链接](other.md)`（未剥离内联标记）。须增可判定 Then：「TOC 该条目**可见文本**不含 `**`/`[`/`](` 等标记字符，且等于正文该 h2 的 `textContent`（去空白后逐字相等）」——现状 FAIL，有区分力。
   - **B8**：BDD-38 的 Given 造不出素材（`POST` 51 文件 → **413** `Too many files: 51 > 50`，`entry_service.py:1230`），且 `_MAX_INJECT_IDS=50` **恰等于** `max_entry_files=50`、主文件占 1 名额 → 真实配置下最多 49 sibling，`if len(result) >= 50` **永不触发 = 死路径**。你必须在**需求层回答二选一**：(a) 调低 `_MAX_INJECT_IDS` 使分支可达；或 (b) 承认不可达、把它降为**构造性单测**（不经 HTTP）。**这不是"留 P2 定"能打发的问题**。Given 须写明造件路径（`create_app(config=...)` 覆写 `PeekLimits(max_entry_files=...)`，`main.py:152` 支持，我已实测可覆盖）。
   - **B9**：BDD-39 的前提机制**不存在**——`html_render_service.py:18` 的 `_BINARY_SIZE_LIMIT` **只有定义、零消费**（死常量），`inject_resources()` 对文本 sibling **无任何大小检查**；`files.py:272` 在**二进制 serving** 路径不在注入路径。→ 须**显式声明这是新增需求**（新增单文件文本注入上限），并修正 §6.5 第 2 行的失实判定（把死代码当活跃机制）。
   - **B10**：BDD-51「3 spec 全部通过」**基线不可达**，实测改动前：`viewer` **18F/20P**、`t091` **12F/12P**、`tpv0099` **6P/0F**（根因 `markdown-test` team 可见致匿名 404、`playwright.config.ts` 无 storageState）。→ Then 改为**回归等价性**：「三个 spec 内 `firstFileId` 字面量 == 0，且失败集合**不劣于**改动前基线（基线逐 case 落盘为 known-failures）」。并在 §3.10/§6.6 补登该基线事实。
   - **B11**：BDD-40 是**双分支判据**（"若 P2 选超限报错则断言错误响应"），违反"只读 BDD 即可判定"。→ 收口为**可同时成立的合取断言**（如「响应中必须存在可机器解析的跳过清单或结构化错误体（HTTP≥400 时 `error.message` 非空），且不存在"成功但静默缺少 sibling 且无记录"」）；**预算数值可留 P2，判定形态不可留**。

3. **14 项 WARNING 本轮一并处理**（不阻塞但会累积成下一轮的债）。逐条见 `P1-review.md §三`，重点：
   - **W1（与 B5 同源，务必改）**：BDD-25 判据须**排除 `title` 属性**（`DiagramBlock.vue:177` 的 `title="Fullscreen"` 会命中致假 PASS），Given 须写明「正文不含图表」，或断言元素位于 `.actions-area` 内。
   - **W8/W10（我的错，你照改）**：`firstFileId` 实为 **9 处**（`viewer.spec.ts`=2 / `t091`=4 / `tpv0099`=3），不是 8；「15 命中 / 5 文件」的口径须声明（全仓实测 88 行命中）。**我（主 Agent）此前"复核一致（8 处）"是错的**，已更正，你不要沿用 8。
   - **W9**：P0 已知风险「全屏 `f` 键是否也跳转路由」**未被收敛** → 在 §4 增一行结论（推荐：普通态 `f` 保持纯前端 zen 切换、不改 URL，理由 `DESIGN.md:210-212` 只规定 locked 态行为），并加判据锁定。
   - **W11**：1612 §2.1 第 3 条「不给文件树每个文件单独加全屏按钮」**未转成 BDD** → 增一条约束型 BDD。
   - **W3**：BDD-01/06 同构可合并（保留 3 次中文场景即可覆盖 2 次场景）——**这是允许的合并，不是规模问题**，可降 P6 成本。
   - **W4**：BDD-02 的 Then 混装两断言且后半会因 h1 未入 TOC 而与"围栏排除"无关 → 删后半或拆两个 probe。
   - **W2**：BDD-42 与 BDD-43 高度重复且 BDD-42 若用 ASCII 素材会现状即通过 → 合并或给 BDD-42 钉定「字节 ≥2MB 且 `content.length` < 2MB」并说明区别仅素材类型。
   - **W5/W6/W6'**：BDD-33/07/29 现状即通过，标题加「回归兼容：」前缀。
   - **W7**：§5 的 P8 行补「截断提示文案新增总行数（BDD-34）」——BDD-34 要求含 `totalRows`（11）而现状文案只有 `maxRows`，属用户可见变更。
   - **W13**：BDD-35 指定了 P4 函数签名 `parseRows(content, delimiter, maxRows)`（轻度越界）→ 改为行为描述。
   - **W12/W14**：见 review §三 原表。

4. **不要改的东西**：需求方向、8 项缺陷的源码事实表、决策 A/B 的表述、同类扫描的 9 组结构与命中清单（除 §6.5 需按 B9 修正、§6.6 需按 W8/W10 修正）、裁剪声明、`risk_level: medium` / `ceremony: standard` / `packages` / `domains`（评审已判定合规）、`capability_requirements`、P0_STALE 三条。

5. **改完必须自检区分力**：对每条修改过的 BDD，写出「改动前的实现下该条会 PASS 还是 FAIL」。会 PASS 的说明仍无区分力，继续改。这是本轮的核心交付，不是可选项。

6. **frontmatter 保持原值**（`risk_level: medium` 等），用 `agate-md-field-set.py`；不要动 `status`（P1 gate 只看 P1-review.md 的 status）。

7. **`P1-requirements.md` 是需求基线**，本轮由你（analyst）修订属正常迭代（评审 needs-revision），不需 `[BASELINE_CHANGE]`；但**改动的每一处要能在 §11 变更记录里追溯**（已有该节，追加本轮条目）。

### 上游关联

- 第 1 轮产出（55 条 BDD / 689 行）已获评审**部分肯定**：方向、源码事实、决策 A/B、同类扫描骨架、裁剪、能力三态、UX 形态、`risk_level`/`ceremony`/`packages`/`domains` 全部合规。**评审明确说"规模（55 条）不是打回理由"**。
- 打回集中在**判据区分力（假 PASS）**与**两条不可执行 Given（B8/B10）**，与派发时的预判吻合，评审实测复现了其中 8 例。
- 我（主 Agent）在本轮被评审纠正了 4 处错误，**已全部确认并以我的名义更正**：① `/f` 下文件树其实已被全局 CSS 隐藏（我只看 scoped 规则）；② `_BINARY_SIZE_LIMIT` 是死常量；③ `firstFileId` 是 9 处不是我说的 8 处；④ TOC 桌面端默认展开（我探针点了一次把默认态关掉了才发现"空"）。→ **凡与我这 4 条旧记录冲突，以评审实测为准。**
- B7 的实测证据：TOC 条目文本实测输出 `**粗体**与[链接](other.md)`（未剥离标记），而正文 h2 的 id 为 `粗体与链接othermd` —— 两侧 id 相等（所以原 BDD-05 假 PASS），缺陷在**显示文本**。

### 输入文件

- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P1-review.md`（**本轮核心输入，11 BLOCKER + 14 WARNING，逐条处理**）
- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P1-requirements.md`（你要改的文件）
- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P0-brief.md`（约束，含 §7.5 更正段）
- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P1-dispatch-context-analyst-supplement.md`（第 1 轮的补充指令，仍有效）
- `{project_root}/AGENTS.md`（铁律、环境隔离）
- 需要复核源码时按 review 给出的行号直接读（review 里每个 BLOCKER 都给了文件:行）

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
- 环境状态（主 Agent 2026-11-24 19:05 实测）：
  - debug backend 在线 `http://127.0.0.1:8888`（后台 job 托底，已 seed 22 entries）；生产 `:8080` 不可达，零接触
  - 协议 v0.83.3；git HEAD=`899a9d43`（工作区有未提交的 P0/P1 产出，**不要 commit**）
  - 测试基线（改动前）：`make test-quick` 1205P/1F（预存 `test_cli_remote` 沙箱只读）；`make test-frontend` 119 files/1456P/0F；typecheck exit 0；lint exit 0；check-docs exit 0
  - **E2E 基线（评审实跑，P5 要用）**：`viewer.spec.ts` 18F/20P、`t091` 12F/12P、`tpv0099` 6P/0F。前两者失败根因 = `markdown-test` 归 `frontend-team`（`team_id` 强制 `is_public=false`）致匿名 404，**是 TPV0095（2026-09-03）的既有回归，非本任务引入**

- 关键实测事实（供你改写判据时直接引用，不必重跑）：
  - `/f` 下：`.file-sidebar` **在 DOM 但 display:none**、宽 0；`.toc-sidebar` 同样 display:none；`.content-area` 宽 == innerWidth（1280/1280）
  - **全局** zen 隐藏集在 `styles/layout.css:650-657`（含 `.file-sidebar` / `.toc-sidebar` / `.mobile-actions`）；**scoped** 在 `EntryDetailView.vue:281-284`（只含 header/mobile-bar/meta-tags）——两处不同，须并列引用
  - 桌面 TOC 默认展开（`EntryDetailView.vue:243-246`，`isDesktop = viewportWidth > 640`）；`.toc-sidebar` → `nav.toc-nav` → `ul.toc-list` → `li.toc-item.toc-level-{N}` → `a[href="#{id}"]`
  - `.toc-level-1/2/3/4` 中**只有 2/3/4 有 padding 规则**，`.toc-level-1` 无样式（决策 B 扩 h1 后属 P4 样式细节，不影响 BDD 判据）
  - V-02 实测：两个同名 `##` → 正文 id 均 `设计方案`（重复）、TOC href 为 `#设计方案` 与 `#设计方案-1`（**TOC 侧去重正常，缺陷在正文侧不去重**）；围栏内 `## 示例` 误入 TOC；Setext h1 正文 id 为空串
  - `sorted(['aaa.txt','README.md'])` → `['README.md','aaa.txt']`；`sorted(['AAA.txt','README.md'])` → `['AAA.txt','README.md']`；`sorted(['aaa.md','index.md'])` → `['aaa.md','index.md']`
  - `_BINARY_SIZE_LIMIT`：`html_render_service.py:18` 纯定义零消费；`files.py:48` 定义 + `:272` 在二进制 serving 路径
  - `_MAX_INJECT_IDS = 50`（`html_render_service.py:17`）== `max_entry_files = 50`（`config.py:46`）
  - `firstFileId` e2e 处数：`viewer.spec.ts` 2 / `t091` 4 / `tpv0099` 3 = **9**

- 环境坑：
  - `npx tsx` 不可用（`~/.npm` 只读 EROFS），须 `/home/kity/oclab/deepseek-harness/node_modules/.bin/tsx` + `NODE_PATH=$(npm root -g)`
  - vision-engine 须 `HOME=<项目>/.agate-tmp/vhome PYTHONPATH=/home/kity/.local/lib/python3.12/site-packages`，且**用 `--model` 钉模型**（默认链会 404/503/超时）
  - 临时产物落 `<项目根>/.agate-tmp/`（已 gitignore），**不用 `/tmp`**（per-call tmpfs）
  - 造/删测试 entry 只经 debug HTTP API（`POST/DELETE /api/v1/entries`），**禁 CLI**；用完即删，勿留残留
</objective_info>
