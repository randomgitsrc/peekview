---
phase: P2
generated_by: agate-inject-card.py + 主 Agent
task_id: TPV0104
role: plan-design-review
---

<dispatch_guide>
> ⚠️ 以下派发指引是本次任务的强制指令，不是参考信息。执行优先级：派发指引 > 客观查证信息 > 阶段卡片（参考规范）

### 目标

独立评审 `P2-design.md` 的**设计质量**，产出 **`P2-review-design.md`**（`status: approved / rejected / needs-revision`，`agent: plan-design-review`，**≠ main**）。

角色定位：在 spec 阶段抓设计问题——比实现后再改便宜 10 倍。

### 约束

1. **只审不写 `P2-design.md`**。
2. **形态分派（先做这一步）**：本任务 P1 声明 `ui_render_shape: layout`（常规布局型）→ 加载**布局 / 交互 / 视觉三组**维度评分细则。**不启用**渲染正确性/动效时序维度（避免打分噪音）。
3. **评分维度（0-10）按角色定义给出**，至少覆盖：交互状态覆盖率、AI Slop 风险、移动端考虑、可访问性/键盘可达、组件完整性、视觉设计（布局一致性 0-2 / 颜色对比度 0-3 含 WCAG AA / 字体间距 0-3 / 组件一致性 0-2）、交互设计细节（输入态反馈 0-4 / 键盘可达与焦点 0-3 / 过渡与禁用态 0-3）。
4. **⚠️ 每个启用维度评审时，布局/视觉/交互方案须给出 ≥2 候选 + 权衡说明**（架构级 `candidate_count` 下沉到 UI 布局层）。**单一候选或无权衡说明 → 打回补充**。这是本角色的硬要求，不要放过。
5. **七维边界注（防 double count）**：「交互状态覆盖率」= 状态**存在性**（loading/error/empty/edge 是否被 spec 覆盖）；「交互设计细节」= 状态内**实现质量**。同一问题不得跨两维重复打分。
6. **必须含 `status` 字段**。你是专家组之一，最终 `P2-review.md` 由组长汇总。
7. **禁用行首 `- PASS` / `- FAIL`**。
8. frontmatter 用 `agate-md-field-set.py` 写（先 `--list`）。

### 本任务的设计评审重点

本任务的 UI 改动集中在**详情页 chrome 与全屏态**，请重点核：

1. **UI 设计节是否真含三组 checklist**（布局/交互/视觉），且 **渲染形态声明与 P1 的 `layout` 一致**（P2 gate 做规范化值比对，不一致 exit 1）。
2. **新「全屏阅读」入口的完整组件 spec**（BDD-23/24/25/26/27/28）：
   - 桌面放 header `.actions-area`、移动放 `mobile-bottom-bar`——但**移动端按钮无 `aria-expanded`**，且移动端 bottom-bar 已挤（Files / TOC / Source / Star / 分享 / …），新增按钮**是否会导致溢出**？方案有没有交代？
   - **可访问件名称**：BDD-23/24/31 均要求**排除 `title` 属性**（`DiagramBlock.vue:177` 的 `title="Fullscreen"` 会污染计数）→ 方案必须用 `aria-label` 或可见文本。
   - BDD-26 要求「底部操作栏高度 **≤ 64px**（`--mobile-bar-height`，不因新增入口增高）」+「正文末元素底 ≤ 栏顶」→ 方案有没有说明如何在**不增高**的前提下塞进新按钮？
   - 图标+文字：`Maximize` / 「全屏阅读」（1612 文档要求，P0 决策 7.3）。桌面端是 `icon-btn`（仅图标 + tooltip）还是带文字？**方案要与 DESIGN.md §7 Iconography（18/20px）对齐**。
3. **TOC 扩到 h1 的视觉后果**（决策 B）：`.toc-level-1` **当前无 padding 规则**（只有 2/3/4）→ 方案有没有补？h1 出现在 TOC 顶部是否破坏「On this page」的层级可读性？
4. **截断态隐藏表头控件**（BDD-32/33）：`.th-sort-btn` / `.th-filter` 隐藏后，表头行**会不会塌陷/错位**？截断 banner 的文案要新增 `totalRows`（BDD-34，是**用户可见文案变更**）→ 方案有没有给文案？
5. **`/f` 全屏态**（BDD-28/53）：要求 DOM 计数 == 0（不只是 CSS 隐藏）。→ 涉及 `isFileTreeOpen`/`isTocOpen` 的 zen 分支，**会不会影响普通态的默认展开行为**（桌面 TOC 默认展开是既有体验，不能被破坏）？
6. **交互态覆盖**：`?file=` 无效/非本 entry 时的**安全回退**（BDD-16/17/18）有没有给用户反馈？还是静默回退？静默是否可接受（P1 BDD 只要求"不报错回退"）？
7. **AI Slop 风险**：方案有没有给实现者留"随便搞"的空间（如"参照现有风格"这类模糊表述）？
8. **视觉契约可量化**：视觉呈现维度的断言是否为**可量化 DOM 度量**（宽度/高度/对齐/重叠/溢出五类），而非主观词（美观/协调）？P1 的 54 条 BDD 里 UX 类 23 条，请核对是否存在主观词。

### 上游关联

- **P1 三轮评审收敛**（11→2→0 BLOCKER）。P1 终审已确认：54 条 BDD 全部可二值判定、UX 形态声明 `layout` + 三维度合规、**23 条 UX BDD、零主观词**。
- **两项用户决策（不得推翻）**：
  - **A. `/f` 只读分享态，不加退出按钮** —— 依据 `DESIGN.md:210-212`「Zen is **locked** — `f` / `Escape` change nothing… Leaving requires editing the URL」。BDD-29 是**约束型**（要求"保持既有语义"），**不是**新功能。若方案出现"加退出按钮"或"放开 f 键"即为偏离设计意图 → 打回。
  - **B. Setext → h1 生成 id 并纳入 TOC**（h1–h4）。
- **1612 文档的五条禁止项**（P0 决策 7.3）：不得只放文件树 / 不得每个文件单独加按钮 / 不得加文件选择器 / 不遮挡主要内容 / 不得假定 `files[0]`。
- **DESIGN.md 关键条款**：§6 Zen Mode（`:210-212`）、§7 Iconography（Lucide，18/20px 按钮）、§9 Responsive（≤640px 移动端、触控 ≥44px、主操作→固定底部栏 + `--mobile-bar-height`）、§10 A11y。
- **P1 §9 验收分层**：UI 类 BDD 必须在**真实浏览器**（debug `:8888` + Playwright）验，不能用单测替代。

### 输入文件

- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P2-design.md`（**评审对象**）
- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P1-requirements.md`（845 行 / 54 条 BDD，尤其 UX 类 23 条）
- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P1-review.md`（终审）
- `{project_root}/DESIGN.md`（**必读**：§6 Zen Mode、§7 Iconography、§9 Responsive、§10 A11y）
- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P0-brief.md`（决策 7.3 全屏入口要求）
- 源码按需：`EntryDetailHeader.vue`、`EntryDetailMobileBar.vue`、`EntryDetailContent.vue`、`TocNav.vue`、`TableView.vue`、`styles/variables.css`

</dispatch_guide>

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P2

路径：phase-cards/P2-design.md
---
# P2 — 方案设计

> 当前状态：[首次 / 重试 #N / 裁剪跳阶]
> 裁剪跳阶 → P2 不可裁剪。design_trivial / follows_existing_pattern 可简化（1 个候选方案），不可省略。

## 如果是首次进入本阶段

1. 派发 architect subagent → 产出 P2-design.md
   1.1 写 P2-dispatch-context-architect.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
2. 按 C8 映射表派评审（见下方）
3. 评审通过 → P2-review.md status: approved
4. 预跑 check-gate.py P2（脚本化检查）
5. git add {AGATE_WORKSPACE}/tasks/{Txxx}/（含 .state.yaml + 产出文件，若 .gitignore 忽略需 git add -f）
   ⚠️ 此时 .state.yaml 的 phase 保持 P2，不要提前写 P3——phase = 本 commit 的产出阶段。
   推进（`agate-next`）亦**不预写**下一阶段（TAG0042 批 1）：它只输出「下一阶段建议」并记
   `state_transition` 证据，phase 由 P3 产出 commit 时写入。
6. git commit -m "wf({Txxx}-P2): {摘要}"（phase=P2，P2 产出含 P2-design.md + P2-review.md）
7. P2 commit 完成后进入 P3：**phase 推进 P3 随 P3 产出 commit 一起**（P3-test-cases.md 就绪后），不是单独 phase commit

## 如果是重试

确认上一轮失败原因（方案选择有误 / 候选方案不足 / 评审 rejected）
→ 读 agate/rules/state-transitions.md 确认 retry 上限（P2 MAX=3）

## 前置条件

- [ ] P1-requirements.md 含 domains / risk_level / phases 声明
- [ ] P0-brief.md env_constraints 可查阅
- [ ] 若项目存在 `{AGATE_WORKSPACE}/decisions/`，已读取其中既有决策（见下节「项目侧架构决策」）

## 项目侧架构决策（decisions/，TAG0036）

项目内**跨任务的架构决策**（影响不止本任务、后续任务也会依赖的取舍）落在 `{AGATE_WORKSPACE}/decisions/`，与协议自身的 `adr.md`（agate 协议层决策）分开。具体文件名与模板不作规定，由项目自定。

- **P2 开始前读取既有决策**：写候选方案之前先读 `decisions/` 下的既有决策，方案不得在不知情的情况下与之冲突；有冲突时在 P2-design.md 说明取舍。
- **写入时机**：P2 定稿后，若方案含新的跨任务架构决策，将其写入 `{AGATE_WORKSPACE}/decisions/`（P7 一致性检查阶段亦可核对）。
- **前提被证伪时就地标注**：发现某条既有决策的前提已被后续变更证伪，在该条决策原处标注「已过时 + 被什么取代」，**不删除**（保留决策史）。
- 这是读取与登记的约定，不由 gate 校验，也不设自动过期机制。

## 派发

- **角色**：architect（`{agate_root}/assets/execution-roles/architect.md`）
- **输入**：P1-requirements.md + P0-brief.md
- **输出**：P2-design.md
- **派发 prompt 追加**：

```
## P2 最小验证
方案设计前，先用最小验证确认关键假设（10 行 HTML 测试页 / curl 请求 / 20 行脚本）。
验证结果写入 P2-design.md 的 minimal_validation 字段。
- 方案依赖浏览器行为/安全模型/外部系统行为 → 必须做最小验证
- 纯代码逻辑 → 须在 minimal_validation 字段声明 `纯代码逻辑，无外部系统依赖`（须写明依赖了哪些内部函数/数据转换）
```

## 产出规格

P2-design.md 必须包含：
- **候选方案 ≥2** + 权衡 + 选择理由（design_trivial / follows_existing_pattern 时可只写 1 个，见下方）
- **`candidate_count: N` 必填**：本方案候选方案数（≥2，design_trivial/follows_existing_pattern 时可 1），gate 按此字段校验，不再解析标题。你写几个候选就填几个，与正文一致。
- **四字段**：`packages:` `domains:` `ui_affected:` `gate_commands:`
- **files_to_read**：实现时需要参考的文件清单（控制 P4 implementer 上下文）
- **env_constraints**：确认/细化 P0-brief 的环境约束
- **minimal_validation**：验证结果 或 声明"纯代码逻辑，无外部系统依赖"（声明时须附理由）

`candidate_count`/`packages`/`domains`/`ui_affected` 写在文件头 **frontmatter**（`---` 分隔块），
不写正文；`gate_commands:`/`files_to_read:`/`env_constraints:`/`minimal_validation:` 留正文。
**可直接复制的完整样例**：
```yaml
---
phase: P2
task_id: TAG0001           # 替换为实际任务编号
type: design
parent: P1-requirements.md
trace_id: T001-P2-20260101 # {task_id}-P2-{YYYYMMDD}
status: draft
created: 2026-01-01
agent: architect
# ── v2.0 机器字段 ──
candidate_count: 2                # int ≥1，必填
packages: [pkg-a]                 # list，必填
domains: [backend, cli]           # list，必填
ui_affected: false                # bool，必填
ui_design_section: true           # bool，可选（presence 语义：ui_affected: true 时声明已含 UI 设计节）
# ── TAG0050 批 F 结构化 UI 维度（非 legacy 任务，ui_affected: true 时）──
# ui_design:
#   shape: layout               # 必填维度由快照 shape_dimensions 决定（layout→布局/交互/视觉）
#   dimensions:
#     布局: {status: covered}
#     交互: {status: na, reason: "本任务无交互"}   # status: na 必须带 reason
#     视觉: {status: covered}
---
```

**UI 设计节（`ui_affected: true` 时必含，P2 gate 校验）：** `ui_affected: true` 的 P2-design.md
正文必须包含 `## UI 设计` 节，节内含**渲染形态声明**（`渲染形态:` 声明行，复用 P1 frontmatter
`ui_render_shape` 的规范形态值 + 中文注释，gate 按规范化值比对校验 P1-P2 一致；无 P1 声明时按
布局型默认）+ **维度选择**（`适用维度:` 声明行）+ **按形态适配的 checklist**（常规布局型 =
布局/交互/视觉三类；渲染组件/时序特效型 = 渲染正确性/动效时序等适用维度 checklist；不适用的维度
显式声明"维度不适用"）。缺 UI 设计节 / 缺形态声明 / 缺按形态 checklist / P1-P2 形态声明不一致 →
P2 gate exit 1。结构规格见 `assets/execution-roles/architect.md`「UI 设计节」节（由 architect
兼任产出，不新增 designer 角色）。

**骨架产出（`project_phase: bootstrap` 时必含，P2 gate 校验）：** P1-requirements.md frontmatter
声明 `project_phase: bootstrap`（0→1 新项目；缺省 `established` 不触发）的任务，P2 architect 除
P2-design.md 外，还须在 task 目录下产出 `P2-skeleton.md`（须含 `## 骨架声明` 标题）。骨架内容以
「候选目录集合 + 项目侧声明」的参数化形式表达（不写死具体语言/框架目录名），模板见
`assets/templates/skeleton-template.md`，结构规格见 `assets/execution-roles/architect.md`
「骨架设计职责」节（由 architect 兼任产出，不新增专属角色）。`project_phase` 字段缺失或非
`bootstrap` 时不检查（向后兼容，行为与改动前一致）。

候选方案简化（须附理由，无理由视为无效声明，要求 ≥2 候选方案）：
- `design_trivial: true` + 理由（为什么 trivial）→ 可只写 1 个候选方案（P2 仍不可省略）
- `follows_existing_pattern: [src/foo.py]`（列出参照文件路径）→ 可只写 1 个候选方案，参照已有模式（P2 仍不可省略）

## dispatch_plan 机器字段（可选，TAG0014）

> 本字段是 P2 对**后续阶段编排方案**的机器声明（评估 + 编排模式，见 dispatch-protocol「派发编排机制」），由 architect 在"批次设计"节（execution-roles/architect.md）产出，P2 gate 校验其合法性。

方案含多个独立子任务（多包/多模块/high 复杂度）时，P2-design.md frontmatter 应声明 `dispatch_plan:`（单行 flow YAML，与 candidate_count 同级，**不入 frontmatter-check schema**，缺省不校验）：

```yaml
# ── v2.0 派发编排字段（可选）──
dispatch_plan: {mode: static-batch, parallel_limit: 3, batches: [{id: pkg-a, complexity: medium}, {id: pkg-b, complexity: low}]}
```

字段契约（gate 校验口径）：
- `mode` ∈ {single, static-batch, parallel, recon-then-split, serial}——编排模式（单发/静态拆批/并行/先理解后拆/串行链）
- `parallel_limit` 可选，≥1 整数——并行上限（缺省 3）
- `batches` 可选——mode ∈ {static-batch, parallel} 时每批须含 `id` + `complexity` ∈ {low, medium, high}；批数 ≤ parallel_limit
- 缺字段 / frontmatter 坏 YAML（字段不可读）→ P2 gate 跳过校验（向后兼容，不误拦）；**字段存在但值非合法 JSON / 解析结果非对象 → P2 gate ERROR + exit 1**（RM-AG0090 / DEBT0043 修复 fail-open——原实现两种情形都 `return None`，与调用点「None=无错误」语义重合而静默放行）

### batches[] 可选键：tests_filter / output 与批切分判据（TAG0036）

> 本小节是 `tests_filter` / `output` 写法的**权威定义**（architect 角色文件只写"如何选"并引用本节，不复述契约）。两个键都嵌套在 `dispatch_plan.batches[]` 内，不新增 frontmatter 顶层键。

`batches[]` 的每一批除 `id` + `complexity` 外，可再声明两个**可选**键（`tests_filter` 与 `output`）：

```yaml
dispatch_plan: {mode: static-batch, parallel_limit: 3, batches: [{id: order-cancel, complexity: medium, tests_filter: "python -m pytest tests/unit/test_order_cancel.py -q", output: [src/order/cancel.py, src/order/api.py]}, {id: order-refund, complexity: low}]}
```

- **`tests_filter`（可选）**：该批**绿灯确认**用的测试命令，写在 P2-design.md 的 frontmatter，值须用**双引号**包裹（值内含引号/空格的 node id 同理保持双引号可解析）。**只覆盖该批交付面**的测试，**禁止全量**套件、不含后续批才交付的测试——全量回归属 `gate_commands.P5`，不属批级过滤。**缺省**（不写）时 gate 行为不变，该批只是不产生批级证据，不会被拦截。
- **平台中立**：`tests_filter` 示例写 `python -m pytest …` 形态，不裸 `python3`（不同平台解释器名不同，Windows 无 `make`/`python3`）；实际解释器名以本项目 `AGATE_PYTHON` / `probe_python` 探测为准，示例仅示意。
- **`expected_red` 声明位置**：该批确有设计上应红的测试（属后续批交付面，但已落在本批 `tests_filter` 命中范围内）时，由运行者在证据日志 `P4-evidence/{batch}.log` 的 `expected_red` 键里声明，不写进 P2-design.md。`{batch}` 即该批的 `id`，须匹配 `[A-Za-z0-9._-]+`（filename-safe，不含空格、斜杠、`..`），因为它直接拼成证据文件名。
- **`output`（可选）**：该批预期改动的文件路径列表（如上例）。**仅供** `check-mvwu.py --observe` 做 boundary / commit 形态比对时读取，**不新增 gate 校验**——缺省、写错都不影响任何阶段 gate；`agate-frontmatter-check.py` 与 `check-structure-consistency.py` 均不因这两个键而改动（嵌套键，不触碰顶层白名单）。

  > **深度豁免说明（DEBT0068）**：`dispatch_plan`（含 `batches[].output`，嵌套深度 4）**不受** `agate-frontmatter-check.py::MAX_DEPTH=3` 约束——该键是**不入 checker schema** 的机器字段，其结构校验走 `agate-md-field-get dispatch_plan` + `json.loads`（P2 gate）。故 checker 对 `dispatch_plan` **单键**豁免深度上限；其余字段的深度校验不变。

**批切分判据**（写 `batches[]` 时按以下三条判断怎么切；三条均是判据式引导，不是 gate 规则；`Walking Skeleton` 见判据一）：

1. **判据一：Tracer Bullet（曳光弹）**——触发条件：任务含 ≥2 个批，且存在可端到端验证的关键路径。此时首个批应为该路径的端到端最小打通，其 `tests_filter` 覆盖该路径的**冒烟**级验证（"路径确实通"），而不是该批的完整单元测试。目的：在投入全部实现之前先取得"管道确实通"的反馈。**与 P3 红灯批的边界**：tracer bullet 只是**首个批的切法**，不替代 P3 完整红灯批（任务级红灯基线仍由 `gate_commands.P3` 承担），后续批仍按常规批级验证走。`Walking Skeleton` 中"骨架先跑通"的部分**吸收**进本判据；其自动化部署/CI 配置部分**拒绝**（技术栈中立，见 `adr.md` ADR-003）。这**不是**既有 `P2-skeleton.md`「骨架声明」（`project_phase: bootstrap` 的目录布局声明）——二者是不同机制，本判据不新增字段、gate 或模板文件。
2. **判据二：Vertical Slice（垂直切片）**——批 / 包**优先按业务能力切**：一个批 = 一条端到端可交付的能力，而不是一个技术层。判据式自检：批 `id` 应能回答"这个批交付了什么能力"，而不是"动了哪层代码"。若必须按技术层切，须在 P2-design.md **写明理由**（不禁止、也没有任何 gate 拦截）。与判据一的关系：端到端批天然是垂直切片，二者是同一决策的两个面。
3. **判据三：Architecture Fitness Functions（架构适应度）**——`gate_commands` 除功能测试外，还应为本任务涉及的架构约束配置适应度检查，见下方「gate_commands 声明」节的「架构适应度检查」小节。

## 影响面梳理（强制节）

**写候选方案之前**先做影响面梳理——方案的取舍取决于它牵动多大面，先设计再补影响面等于反过来给方案找理由。P0 卡片的「同类/影响面预判」给量级、P1 卡片的「同类扫描」给清单，P2 在这两者基础上做**候选方案级**的影响域分析，三处同源、逐级细化，不重复劳动。

P2-design.md 正文必须含影响面梳理节，覆盖三部分：

1. **改什么（Modify）**：逐文件/逐模块列出改动点 + 关联 BDD 编号；改动落点必须落到"哪个文件的哪个小节/函数"，不写"相关代码"这种模糊表述
2. **不改什么（Not Modify）**：显式列出**看起来该改但决定不改**的文件/范围 + 理由。这一栏比"改什么"更容易漏，也是 P4 implementer 判断范围边界的依据（避免"顺手改进"）
3. **风险在哪（Risk）**：每条风险配一条缓解措施；跨模块引用、双源同步（权威源 + 副本）、schema 变更、并发/资源竞争是高频风险项

梳理动作要有客观证据：grep/rg 命中清单、读过的消费方代码、既有 gate 脚本的校验口径——不是凭印象列。P1 已声明 `follows_existing_pattern` 的任务同样要做（沿用既有模式不等于影响面为零）。

4. **登记面（新增/改名 `agate/scripts/` 下文件时必填）**：按 `agate/scripts/README.md`「新增脚本登记面」节逐项判定，并**实测**（把文件真放进仓库跑一遍），不凭推理。该节已区分**机械门禁**与**团队约定**：真门禁只有 ① **CHECK 9 覆盖**与 ② **SG.6**（两处共用同一判据 `uncovered_gate_scripts()`），其余为约定——**不要**按旧印象把观测型脚本硬塞进锚点表。**③ `CHECK 10`（协议文档脚本名引用漂移）方向相反，不是新增脚本的登记面**——它只报「协议文档引用了**不存在**的脚本」，新增脚本文件本身不触发，**改名/退役**脚本时才要看。三处点名齐（CHECK 9 / SG.6 / CHECK 10）才算法定结论完整。实测结论写进影响面梳理节（"实际哪一处变红/告警"）。

> **为什么强调"实测"**：TAG0036 M18 是本仓库的实证——P1 同类扫描凭推理判"本次不处理"，直到 P2 评审实跑才由绿转红。同类扫描没有强制实测时，这个坑会重复出现（DEBT0046 登记的直接动因）。

## gate_commands 声明

gate_commands 在 P2 固化，后续阶段按此执行。

> **写入工具（别手写正文块）**：`agate-md-field-set-gate-commands.py FILE <yaml块或@文件路径>` ——
> 写入 P2-design.md **正文**的 `gate_commands` 多行 YAML 块，逐 key 用
> `agate_common.is_legal_gate_key()` 校验（与 `check-gate.py::_reconcile_p2_fields` **同一函数**，
> 非重写）。`gate_commands` 是**正文**（非 frontmatter），故不归 `agate-md-field-set.py`（它只写
> frontmatter 字段）——两个工具分工不同，都需要时分别调用。

```yaml
gate_commands:
  P3: "pytest"                  # 可选：测试运行器（verbose 输出，供 check-tdd-red.py 自动读取）
  P5: "pytest -q --tb=no"       # 紧凑输出模式
  P5_e2e: "playwright test --reporter=line tests/e2e/"  # ui_affected: true 时必填
  P5_timeout_seconds: 120       # 可选：该 key 命令的预期耗时上限（秒），见下方字段规则
  P5_e2e_timeout_seconds: 300   # 可选：per-key 声明，不同命令类型各自取档
```

### 命令值写法约束（引号与通配 pathspec）

`gate_commands` 的值是**交给 shell 执行的一条命令字符串**，两条写法约束（RM-AG0092 / DEBT0047，均来自实测）——**① 为建议（读取器已容错），② 为硬约束**：

1. **含引号的值建议整体加引号**：值内含单/双引号（如 `pytest -k 'foo'`）时，**建议**用**同种引号整体包裹**该值（如 `P5: "pytest -k 'foo'"`）——这是安全惯例（**非硬需求**：读取器已能正确处理含引号但不包裹的值；含空格的值本就不需要引号，实测 `P5: pytest -q --tb=no` 读回正确）。读取器（`agate-read-p5-commands.py`）只剥**成对**的首尾引号——首尾同种才剥除，**不成对则原样保留**（读取器从不吞引号）；故请确保引号成对或整体包裹。（本约束的由来：旧读取器曾**各自**剥首尾引号，把**成对**值 `"pytest -k 'foo'"` 读成 `pytest -k 'foo`，致命令语法破损。）
2. **未加引号的通配 pathspec 会被 shell 先展开**：命令里的通配路径（如 `git add *.py` / `git rm docs/*.md`）在值未加引号时，会由 shell 先行展开为匹配到的文件名列表——对「删除」类变更（`git rm` / `git clean`）尤其危险：当前工作区无匹配文件时通配符可能展开为空，导致**应删除的文件漏检**。须对通配符**反斜杠转义**（如 `git rm docs/\*.md`）或**给通配符部分加引号**（如 `git rm "docs/*.md"`——注意是**通配符所在的那一段**加引号，**不是**整条命令值加引号；`"git rm docs/*.md"` 整值引号会让 shell 把整串当一个命令名 ⇒ exit 127），把展开交给命令自身。

### `{key}_timeout_seconds` 字段规则

`timeout_seconds` 是 `gate_commands` 块内的**可选声明性字段**，用来给每条 gate 命令声明"预期耗时上限"，供跑命令的一方（主 Agent / subagent）据此设置 shell 层超时。四点规则：

1. **排除 P3**：`gate_commands.P3` 继续走既有 `AGATE_TDD_TIMEOUT` 环境变量机制（默认 120s，由 `agate_common.py` 的 `run_test_with_formatter()` 消费、`check-tdd-red.py` 读取，exit 124 → 超时 JSON，区分 A/B 类错误）。`timeout_seconds` **只服务 P5 / P6 / 其他非 P3 key**，不覆盖 P3。两层不合并：P3 层是运行时代码真实消费的超时，`timeout_seconds` 是给人和 subagent 读的静态声明
2. **per-key 声明**：写成 `{key}_timeout_seconds`（如 `P5_timeout_seconds` / `P5_e2e_timeout_seconds`），每条 key 各自声明，**不设整体共享默认**——单元测试与 E2E 的耗时差 2.5 倍以上，共享一个值起不到分类阈值的作用。命名与既有 `{key}_formatter` / `{key}_e2e` 的 per-key 惯例一致
3. **三档默认基准表**（**建议档位，需按命令类型手动声明，不是自动推断**——没有任何代码去"猜"命令属于哪一类）：

   | 命令类型 | 建议档位 | 依据 |
   |---------|---------|------|
   | 单元测试类（pytest / vitest 等） | 120s | 与 `AGATE_TDD_TIMEOUT` 默认值对齐，同类命令的既有锚点 |
   | E2E 类（Playwright / CDP） | 300s | 覆盖页面加载 + 多步操作；比脚本内部硬超时（HARD 90s/180s）更大——外层命令级预期时长必须留够内层完整走完的余量 |
   | 构建类（编译 / 安装依赖 / 打包） | 600s | 覆盖 `npm install` / 编译等长操作。宁可档位定高，也不要让长命令被误判失败（TPV0093 教训：`make test-quick` 挂 188 分钟） |

4. **向后兼容**：缺字段 → 行为等同现状（沿用 `dispatch_plan` 的"缺字段 / frontmatter 坏 YAML → gate 跳过校验；字段存在但值非合法 JSON → ERROR"口径），不新增强制阻断，老任务无需回填

与运行时超时纪律的关系：本字段是**静态声明**（层级 1），subagent 执行命令时真正去设 shell timeout 的是**层级 4** 的「命令超时兜底」（取值 = 预期耗时 ×1.5；本字段已声明时"预期耗时"直接取该值）。四层超时机制的完整分层见 dispatch-protocol.md「命令超时兜底与既有超时机制的分层关系」。

### env_constraints 与 gate_commands 的边界（不等价）

`env_constraints` 是**声明性字段**——它只做信息确认/注入（写清楚环境约束是什么，供 P4/P8 读取参考），本身不会被自动执行，也没有任何 gate 脚本会去校验 `env_constraints` 里写的条件是否真的成立。真正被执行的机制是 `gate_commands`：P5/P6 只会去跑 `gate_commands` 里声明的命令，不会去"执行" `env_constraints` 的内容。二者不等价，不能互相替代。

**因此**：任何需要被强制执行的约束，必须落到 `gate_commands`（有命令可跑、有 exit code 可判定），或者落到 P4/P8 阶段卡片里的明确 checklist 条目（有人工自查动作可执行）。只写进 `env_constraints` 而不落 `gate_commands`/checklist 的约束，等于没有强制力——architect 设计时若发现某条环境约束必须被强制执行，不要止步于写进 `env_constraints`。

### 架构适应度检查（Fitness Functions，TAG0036）

这是批切分判据三（Architecture Fitness Functions，判据一、二见「dispatch_plan 机器字段」节）：`gate_commands` 除功能测试外，**应为本任务涉及的架构约束**再配置适应度检查——把"架构约束不被破坏"变成有 exit code 的命令，而不是只靠评审目测。示例维度（取与本任务相关的至少几项即可，不必全配）：

- **依赖方向**：低层模块不得反向依赖高层模块
- **分层边界**：跨层调用只走约定的接口，不穿层
- **循环依赖**：模块 / 包之间无环
- **公共 API 稳定性**：对外暴露的接口签名不被无意改动

约束：

- **agate 不规定具体工具**——用什么工具做这些检查由项目自选；命令仍经 `gate_commands` 注入（独立 key，遵守下方「`--strict` 反模式」的一 key 一命令规则），P5 照常执行。
- 只要求"该维度存在"：本任务涉及某条架构约束时，对应检查应在 `gate_commands` 里有位置；不要求覆盖所有维度，也不由 gate 校验其存在。
- 项目判定本任务无架构约束时，在 P2-design.md 写明"本任务无架构适应度检查"即可，不强制。

### `--strict` 反模式：不要放进 `&&` 链路中间

`gate_commands` 的每个 key 声明的是**一条完整命令**，若把多个校验命令用 `&&` 拼接成一条命令串塞进同一个 key，会有短路问题——只要前一个命令非零退出，后面的命令（包括 `--strict` 校验）根本不会跑，看似"全部声明了"，实际后半段从未被执行过，问题被掩盖。

**反例（不要这样写）**：
```yaml
gate_commands:
  P5: "pytest -q --tb=no && check-protocol-consistency.py --strict && shellcheck scripts/*.sh"
```
上面这条命令一旦 `pytest` 失败就短路退出，`--strict` 校验和 `shellcheck` 都不会执行，历史上 TAG0004 等任务已经在这类写法上吃过亏。

**正确做法**：把每个校验拆成独立的 key 分别声明，各自独立跑、独立记录 pass/fail，不共享短路关系：
```yaml
gate_commands:
  P5: "pytest -q --tb=no"
  P5_consistency: "check-protocol-consistency.py --strict-errors-only"
  P5_shellcheck: "shellcheck scripts/*.sh"
```
`--strict-errors-only`（仅 ERROR 判失败）适合日常任务默认使用；`--strict`（WARNING-only 也判失败）保留给专门做 WARNING 债务清理的任务主动选用。

### `P3_xxx` 禁止声明（P2 卡禁令，BDD-6）

`gate_commands` 的测试命令键只允许裸 `P3`（`check-tdd-red.py` 只收集精确键
`key == "P3"`）。禁止声明 `P3_xxx` 检测键：旧解析器曾用 `startswith("P3")`
静默收集辅助键，致 TDD 误执行非测试命令。白名单后缀清单（不收集为检测命令）：
`_formatter` / `_timeout_seconds`（元键，`is_gate_meta_key` 豁免）+ `_e2e`
（E2E 形态，P5_e2e 消费，P3 永不收集）+ 历史 `_js` / `_html`（已退役，
不得复用为检测键；未来多栈回归走协议修订登记收集后缀，不走静默收集）。

### CHECK / 扫描面上线流程（DEBT0025：先全量扫描存量）

`check-platform-assumptions.py` 新增 CHECK / 扫描面上线时，先全量扫描存量
测试树登记命中清单，有命中先登记再启用常驻阻断，避免存量命中阻断正常开发。

## 评审派发（C8 机械映射）

按 P1 声明的 domains + risk_level 机械映射评审：

| domain | risk_level | 必须派的评审 |
|--------|------------|------------|
| backend | 任意 | plan-eng-review（P2 方案评审） |
| frontend | 任意 | plan-design-review |
| 任意 | high | plan-eng-review（硬规则，必须派独立 subagent） |
| 任意 | full（tier=full 或声明 ceremony: full）| plan-eng-review（硬规则，必须派独立 subagent）+ cso（security 域）+ P7 不可裁 |
| P1-requirements.md 含 [NEED_CONFIRM] 且涉及业务方向 | 任意 | plan-ceo-review |

> **去重说明**：同一任务命中多行且触发同一评审角色时，去重只派发一次（如 backend + high 均命中 plan-eng-review，只派 1 个 plan-eng-review，不重复派发）。

多个评审角色 `专家组并行` → 组长汇总 → P2-review.md（status: approved / rejected）。
详见 `agate/rules/review-mapping.md`。

**并行派发**（多个评审角色时）：
1. 同时派发所有触发的评审 subagent（每个一个 task 调用）
   > **操作方式**：在一个 assistant 消息中连续发起多个 task 工具调用（每个评审角色一个）。
   > 不要等前一个 task 返回再发下一个——那是串行，不是并行。
   > 平台会并行执行多个 task，全部返回后再进入下一步（派发组长汇总）。
2. 每个评审 subagent 各写一个 dispatch-context + 各自产出文件（示例非穷举，按 C8 映射表触发）：
   - plan-eng-review → P2-review-eng.md
   - plan-design-review → P2-review-design.md
   - plan-ceo-review → P2-review-ceo.md
   - cso → P2-review-cso.md
3. 所有评审返回后，派发组长汇总 subagent（角色：review + 指定为「专家组组长」）
4. 组长输入：所有评审文件路径
5. 组长产出：P2-review.md（统一 status: approved / rejected）。**组长 subagent 产出的 P2-review.md 的 Header agent 字段必须是组长角色名（非 main）——check-gate.py P2 硬拦截 agent=main 的 approved**
6. 组长规则：
   - 不发表新意见，只汇总
   - 任何专家标 BLOCKER → status: rejected
   - 多位专家分歧 → 标「专家组分歧」交人工
   - 全票无 BLOCKER → status: approved

**单评审角色时**：直接派发，无需组长汇总，产出直接写 P2-review.md。

review 不通过 → architect 修改方案 → 再 review → … → approved（⑩迭代循环，review 和 gate 重试共享 retry 预算）

**UI 测试选择器**：涉及前端时，P2 design 建议声明 UI 组件的稳定测试标识清单（如 `data-testid`，而非 class 命名）。P3 test-designer 用稳定标识定位元素，P4 implementer 按清单实现--class 命名可重构，稳定标识不变。具体方案由 P2 architect 决定。

## gate 规则

```bash
check-gate.py P2 $TASK_DIR
```

- 候选方案数 ≥2（design_trivial / follows_existing_pattern 时可只写 1 个）
- P2-review.md 存在且 status: approved（agent≠main）— 不存在 → gate exit 1
- 四字段齐全（packages/domains/ui_affected/gate_commands）
- gate_commands.P3 可选（非 pytest 项目建议声明，供 check-tdd-red.py 自动读取测试运行器）
- 候选方案 ≥2 时含权衡/选择理由

## 推进条件（全部满足才写 phase: P3）

- [ ] P2-design.md 候选方案 ≥2（或 design_trivial/follows_existing_pattern 须附理由时可只写 1 个）+ 四字段齐全
- [ ] 含「影响面梳理」节（改什么 / 不改什么 / 风险在哪 三部分齐全，且写在候选方案之前）
- [ ] P2-review.md 存在且 status: approved（agent≠main）
- [ ] gate_commands.P5_e2e 已声明（ui_affected: true 时）

## 常见错误

1. **忘了最小验证**：方案依赖外部系统行为（API MIME 类型、浏览器 CSP 等）但直接假设前提成立 → 到 P6 才发现不可行。跑一个 curl / 10 行 HTML 就能 5 分钟发现
2. **gate_commands.P5 只列单元测试**：UI 任务时缺少 P5_e2e → P5 不会跑端到端验证
3. **files_to_read 列太多文件**：把所有相关文件都列上 → P4 implementer 上下文爆炸。只列确实需要参考的
4. **忘了派评审**：按 C8 映射机械执行，不靠"觉得不需要"
5. **gate 不过 ≠ 你失败了**：红灯指向工作/设计的问题，不指向你。正确动作是诊断→退回/重试/PAUSED，不是修改产出让它变绿。

## 下游影响

- P4 依赖 files_to_read 导航代码阅读范围
- P5 依赖 gate_commands 执行验证命令
- P6 依赖 ui_affected 判断是否需要 vision-helper
- gate_commands 在 P2 固化后 P4-P6 不能改——设计阶段是声明验证契约的唯一窗口

> 完成 → 读 phase-cards/P3-tdd.md
<!-- AGATE_CARD_END -->

<objective_info>
- 环境状态：debug `:8888` 在线、anon 15；生产 `:8080` 零接触。
- 关键 UI 实测事实（可直接引用，不必重跑）：
  - `/f`（1280×800）：`.file-sidebar` DOM 1 + `display:none`、`.toc-sidebar` DOM 1 + `display:none`、`.detail-header` DOM 1/可视 0、`.meta-tags-bar` **DOM 0**、`.mobile-sticky-header` **DOM 0**、`[data-testid="mobile-bottom-bar"]` **DOM 0**、`.content-area` 宽 1280 / innerWidth 1280 = 1.00
  - 全局 zen 隐藏集 `styles/layout.css:650-657`：`.detail-header`/`.file-sidebar`/`.toc-sidebar`/`.mobile-actions`/`.mobile-sticky-header`/`.mobile-bottom-bar`
  - scoped zen 隐藏集 `EntryDetailView.vue:281-284`：`.detail-header`/`.mobile-sticky-header`/`.mobile-bottom-bar`/`.meta-tags-bar`（不含 file-sidebar/toc-sidebar）
  - 桌面 TOC **默认已展开**（`EntryDetailView.vue:243-246`，`isDesktop = viewportWidth > 640`）；点 `[aria-label="Table of Contents"]` 会**关掉**它
  - 移动端 TOC 按钮 = `[data-testid="mobile-bar-toc-btn"]`，**无 `aria-expanded`（读得 null）**，走 `showTocDrawer` 非 `.toc-sidebar` v-if 链
  - TOC DOM：`.toc-sidebar` → `nav.toc-nav` → `ul.toc-list` → `li.toc-item.toc-level-{N}` → `a[href="#{id}"]`
  - **`.toc-level-1` 无 padding 规则**（仅 `.toc-level-2/3/4` 有）
  - TOC 显示文本实测原样输出 markdown 标记：`.toc-list a` = `**粗体**与[链接](other.md)`，正文 `.markdown-body h2` = `textContent: 粗体与链接`、`id: 粗体与链接othermd`
  - `--mobile-bar-height: 64px`（`styles/variables.css:13`）
  - `DiagramBlock.vue:177` `<button class="diagram-action-btn fullscreen-btn" title="Fullscreen">⧉</button>` —— `title` 是 accessible name fallback，会污染"名称含 fullscreen"的计数
  - `EntryDetailMobileBar.vue` 现有按钮（`data-testid` 可定位）：`mobile-bar-filetree-btn`（Files）/ `mobile-bar-toc-btn`（TOC）/ `mobile-bar-source-toggle-btn`（Source）+ StarToggle + 分享等
  - `EntryDetailHeader.vue:21` 的 `.actions-area` 现有：Toggle file tree / TOC / Source / StarToggle / Copy / Share / OverflowMenu / AuthButton / UserMenu / ThemeToggle
- 环境坑：`npx tsx` 不可用 → `/home/kity/oclab/deepseek-harness/node_modules/.bin/tsx` + `NODE_PATH=$(npm root -g)`；临时产物落 `.agate-tmp/`（不用 `/tmp`）；造/删 entry 只经 debug API、用完即删、须同时给 `path` 与 `filename`（否则 `language=null` → 前端退化 CodeViewer、`.toc-list` 为空）、DELETE 用 slug。
</objective_info>
