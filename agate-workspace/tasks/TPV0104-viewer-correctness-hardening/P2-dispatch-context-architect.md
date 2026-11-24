---
phase: P2
generated_by: agate-inject-card.py + 主 Agent
task_id: TPV0104
role: architect
---

<dispatch_guide>
> ⚠️ 以下派发指引是本次任务的强制指令，不是参考信息。执行优先级：派发指引 > 客观查证信息 > 阶段卡片（参考规范）

### 目标

产出 `P2-design.md`：把 P1 的 **54 条 BDD** 落成可实施方案。必须含影响面梳理（改/不改/风险）、≥2 候选方案 + 权衡、gate_commands（冻结）、dispatch_plan（拆批）、UI 设计节（`ui_affected: true` 必含）、minimal_validation。

**P1 已把需求收敛得很紧**——54 条 BDD 全部可二值判定、每条的区分力都经三轮评审实测确认。你的任务不是重新讨论需求，是给出**怎么实现**，且**不得削弱任何 BDD 的判据**。

### 约束

1. **候选方案 ≥2（必须）**：P1 未声明 `design_trivial` / `follows_existing_pattern`，故**不可**只写 1 个候选。至少 2 个候选 + 各自优点/风险/工作量 + 选择理由。诚实标注：不要写"真方案 + 明显更差的陪衬"。
2. **`candidate_count` 必填**且与正文候选数一致（gate 按此字段校验）。
3. **四字段必填**（frontmatter）：`packages` / `domains` / `ui_affected` / `candidate_count`。本任务 `ui_affected: true`（V-01/V-02/V-04/V-08 均用户可见改动）。
4. **`## UI 设计` 节必含**（gate 校验）：渲染形态声明 **必须与 P1 的 `ui_render_shape: layout` 一致**（gate 做规范化值比对，不一致 exit 1）+ `适用维度: 布局结构/交互行为/视觉呈现`（与 P1 `ui_ux_dimensions` 一致）+ 按布局型的三类 checklist（布局/交互/视觉）。
5. **`gate_commands` 是 P2 唯一冻结窗口**，后续阶段按此执行。用 `agate-md-field-set-gate-commands.py FILE <yaml>` 写入正文（**不要手写正文块**）。必须覆盖：
   - `P3`（测试运行器，供 `check-tdd-red.py` 读）
   - `P5`（后端+前端全量）
   - **`P5_e2e`（`ui_affected: true` 时必填）**——本任务必须写死的 spec 路径（见 objective_info 的"新增/改动 e2e"）
   - `P5_e2e_legacy`（若要跑既有 spec 作回归基线）
   - 各 `{key}_timeout_seconds`（E2E 是全量套件级耗时，须声明）
   - **架构适应度检查**：本项目有现成的 `make check-docs`（文档一致性）、`make typecheck`（vue-tsc）、`make lint`（ruff）——把它们纳入 P5 相关 key。
   - 注意 `gate_commands` 值写法两条约束：含引号的值建议整体同种引号包裹；未加引号的通配 pathspec 会被 shell 先展开（对 `git rm` 类危险）。
6. **`dispatch_plan`**：本任务跨前后端 + 8 项缺陷 + 54 条 BDD，属多子任务 → **必须拆批**（`mode: static-batch` 或 `parallel`）。硬规则：high 复杂度必须拆分；每批 `id` + `complexity`；批数 ≤ `parallel_limit`。切批按三条判据（Tracer Bullet / Vertical Slice / Architecture Fitness）。**同一文件不得跨批被改两轮**；跨批共享件（如 `entryDetail.ts` 的 resolver、字节数工具函数）须单列或明确归属唯一批次。
7. **`minimal_validation`**：本任务**依赖浏览器行为**（TOC 默认展开态、`/f` 下 DOM 计数、URL 刷新保留、`?file=` 持续态、`content.length` vs `file.size`），**必须做最小验证**并写入 `minimal_validation` 字段——不能声明"纯代码逻辑"。我已备好大量实测事实（见 objective_info），你可直接引用，但**关键选型须自己再验**。
8. **影响面梳理（强制节）**：改什么（逐文件到函数/小节 + 关联 BDD 编号）/ 不改什么（看起来该改但决定不改 + 理由）/ 风险在哪（每条配缓解措施）。要有客观证据（grep 命中、消费方代码、gate 校验口径），不凭印象。
9. **不得改 P1 基线**：54 条 BDD 的 Given/When/Then 语义不得修改。若发现某条 BDD 与实现现实冲突，**停下来报告主 Agent**，不要自行弱化。
10. **`packages: [peekview, frontend-v3, docs]`**（与 P1 一致，供 P8 多包发布消费）。**MCP 包不在范围**（P1 §6.2/§6.4 已判"不处理"）。

### 关键设计难点（P1 已把判据写死，你必须给出能通过它们的方案）

这些是 P2 必须解决的核心，逐条都对应硬判据：

- **BDD-35 的"观测面"**：判据要求「本次改动**新增暴露**的『实际构造的数据行数』，不得用 `rows.length`，且必须能区分『构造 1000 行再截 5』vs『只构造 5 行』」。→ 你必须设计**该观测面的具体承载形态**（返回值新增字段 / 解析统计 / 计数回调，择一并说明为何选它），这是 P4 的直接输入。
- **BDD-35 × BDD-36 的耦合**（analyst 自检发现）：朴素"到上限就不 push"会把 `totalRows` 从 1001 砍到 6 → BDD-36 变红。→ 方案必须做到**计数与构造解耦**。
- **BDD-37 的既有契约**：`useCsvParser.ts:57-59` 扫完全文才判 `inQuotes` 并 throw，`useCsvParser.spec.ts:68` 有 `expect(...).toThrow()` 契约。→ 提前终止**不得**破坏未闭合引号校验。
- **BDD-28 的 DOM 计数**：`/f` 下 `.file-sidebar` / `.toc-sidebar` 必须 **DOM 计数 == 0**（现状是 DOM 存在 + 全局 CSS 隐藏）。→ 必须改 `isFileTreeOpen` / `isTocOpen` 的 zen 分支逻辑，**不能只加 CSS**。
- **`?file=` 持续态机制替换**：`firstFileId` 是一次性种子（`EntryDetailView.vue:238` 消费即 `router.replace({query:{}})` 清空全部 query）。→ 必须换机制，且清 query 要**逐参数**（只删已消费的一次性凭证，保留 `file`/`share`）。
- **默认入口 resolver 单点**：三条路径（卡片/列表/直接访问）必须走同一个 `resolveDefaultFile`。注意**卡片/列表那条是死代码**（`transformListItem` 硬编码 `files: []`），BDD-47 要求**代码级断言**该分支不存在。
- **后端 `order_by`**：`get_entry_files` 与 `get_entry` 的 `entry.files=` 均无 `order_by` → 须补确定性排序（path + id tie-breaker）。注意 P1 §6.8 已扫出 6 处 `select(File)`，其中 4 处详情页分支须同一契约。
- **注入预算模型**：P1 §6.5 已确认——`_MAX_INJECT_IDS=50`（默认配置下休眠，因 `== max_entry_files`）、单文件**文本**注入上限**根本不存在**（`_BINARY_SIZE_LIMIT` 是死常量）、总字节预算**不存在**。→ 三个上限都是**新增**。且 BDD-38 要求「注入上限 < `max_entry_files` − 1」这一**代码级关系断言**（现状 50 < 49 不成立）。**数值由你在本阶段实测后冻结**（P1 明确把数值留给你）。
- **超限反馈形态**：BDD-38/39/40 要求「可机器解析的被跳过文件清单」——须设计具体形态（响应头 / JSON 注记 / HTML 注释块），并说明 P6 怎么读。
- **字节数工具单点**：`HtmlViewer.vue:92-94` 与 `TreeView.vue:75` 两处同型缺陷（同 2MB、同 `content.length`），须共用同一工具函数。`file.size` 已是真实字节数（我实测：API `size` 与 `wc -c` 逐项相同）。
- **V-02 接线**：`MarkdownViewer.vue:109-111` 已 `emit('headings', result.headings)` 但**无父组件监听**。→ 接线 + 补正文侧去重（TOC 侧去重已正常，正文侧没有）。且决策 B 要求 **h1 也生成 id 并纳入 TOC**（现 `useMarkdown.ts:332` 的 `level >= 2 && level <= 4` 过滤掉了 Setext 产生的 h1）。
- **`/f` 不引入退出按钮（约束型）**：BDD-29 要求保持 DESIGN.md:210-212 的既有 locked 语义，**不得**顺手加退出入口。

### 上游关联

- **P1 三轮评审收敛**：第 1 轮打回 11 BLOCKER + 14 WARNING，第 2 轮 2 BLOCKER + 6 WARNING，第 3 轮 approved。打回核心全是「判据缺区分力（假 PASS / 不可执行）」。
- **两项用户决策**（不得推翻）：A. `/f` 只读分享态不加退出按钮（`DESIGN.md:210-212` 既有意图）；B. Setext → h1 生成 id 并纳入 TOC（h1–h4）。
- **P1 已判"不处理"的项**（不要纳入范围）：MCP `getEntry.ts:88,90` 的同型缺陷（跨包，P1 建议登记 roadmap）、`_CSS_RECURSION_LIMIT`、`main.py:300` 主应用 CSP、CAP WASM 的 CSP 文档。
- **P1 §9 验收手段分层**：后端 V-06/V-07 走 pytest（fixture 可自建 app/DB）；V-04/V-03 须注入小 `maxRows`；V-01/`?file=` 须 debug `:8888` + 现造 entry + Playwright；V-08 须有走真实 `file.size` 的断言（**不能只用 `HTML_VIEWER_TEST_SIZE_KEY` 注入假值**，那是假 PASS）。
- **e2e 基线已红**（P5 必须知道）：`viewer.spec.ts` **18F/20P**、`t091` **12F/12P**、`tpv0099` **6P/0F**。前两者根因 = `markdown-test` 归 `frontend-team` 致匿名 404（TPV0095 遗留），**非本任务引入**。BDD-50 要求的是「失败集不劣于基线 + `firstFileId` 字面量归零」，不是"全绿"。**不要为了过 BDD-50 去改 `markdown-test` 可见性或加 storageState**（那是范围蔓延）。

### 输入文件

- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P1-requirements.md`（**核心输入，845 行 / 54 条 BDD**，必读全文）
- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P1-review.md`（第 3 轮终审，含 2 项残留 WARNING 建议）
- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P0-brief.md`（决策 1–7 + §7.5 冲突表更正段）
- `{project_root}/AGENTS.md`（铁律、环境隔离、Makefile 命令真相源）
- `{project_root}/DESIGN.md`（视觉规范；§6 Zen Mode:210-212、§7 Iconography、§9 Responsive、§10 A11y）
- 源码（按 BDD 逐条定位，P1 已给行号）：`frontend-v3/src/composables/{useMarkdown,useEntryDetailComputed,useCsvParser,useZenMode}.ts`、`frontend-v3/src/stores/entryDetail.ts`、`frontend-v3/src/views/EntryDetailView.vue`、`frontend-v3/src/components/{EntryDetailHeader,EntryDetailContent,EntryDetailMobileBar,MarkdownViewer,TocNav,TableView,TreeView,HtmlViewer,EntryCard,EntryListRow}.vue`、`frontend-v3/src/router.ts`、`backend/peekview/services/{entry_service,html_render_service}.py`、`backend/peekview/api/files.py`
- 测试（判断既有契约边界）：`frontend-v3/src/composables/__tests__/useCsvParser.spec.ts`、`frontend-v3/src/components/__tests__/HtmlViewer.spec.ts`、`backend/tests/test_html_render.py`

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
- 环境状态（主 Agent 实测）：
  - 协议 v0.83.3；git HEAD=`5548a380`（工作树干净）；debug backend `:8888` 在线、`anon total == 15`（seed 基线）；生产 `:8080` 不可达，零接触
  - 测试基线（改动前）：`make test-quick` **1205P/1F**/3 skipped（唯一失败 `test_cli_remote::test_config_set_remote_api_key`，根因 `OSError: [Errno 30] Read-only file system: '/home/kity/.peekview/config.yaml'`，沙箱只读，**与本任务无关**）；`make test-frontend` **119 files / 1456P / 4 skipped / 0F**；`make typecheck` exit 0；`make lint` exit 0；`make check-docs` exit 0
  - E2E 基线：`viewer.spec.ts` 18F/20P、`t091` 12F/12P、`tpv0099` 6P/0F

- **已备好的实测事实（可直接引用，不必重跑）**：
  - `/f`（1280×800）实测：`.file-sidebar` **DOM 1 + display:none**、`.toc-sidebar` **DOM 1 + display:none**、`.detail-header` DOM 1/可视 0、`.meta-tags-bar` **DOM 0**、`.mobile-sticky-header` **DOM 0**、`[data-testid="mobile-bottom-bar"]` **DOM 0**、`.content-area` 宽 1280/1280 = 1.00
  - **全局** zen 隐藏集 `frontend-v3/src/styles/layout.css:650-657`（`main.ts:8` 引入）：`.detail-header`/`.file-sidebar`/`.toc-sidebar`/`.mobile-actions`/`.mobile-sticky-header`/`.mobile-bottom-bar`
  - **scoped** zen 隐藏集 `EntryDetailView.vue:281-284`：`.detail-header`/`.mobile-sticky-header`/`.mobile-bottom-bar`/`.meta-tags-bar`（**不含** file-sidebar/toc-sidebar）
  - 桌面 TOC **默认已展开**（`EntryDetailView.vue:243-246`，`isDesktop = viewportWidth > 640`）；移动端默认不渲染，且移动端 TOC 按钮 `[data-testid="mobile-bar-toc-btn"]` **无 `aria-expanded`**（读得 `null`），走 `showTocDrawer` 非 `.toc-sidebar` v-if 链
  - TOC DOM：`.toc-sidebar` → `nav.toc-nav` → `ul.toc-list` → `li.toc-item.toc-level-{N}` → `a[href="#{id}"]`；**`.toc-level-1` 无 padding 规则**（只有 2/3/4——决策 B 扩 h1 后需补，属 P4 样式细节）
  - V-02 实测（现造 entry，含重复 `## 设计方案`×2 + 围栏内 `## 示例` + Setext `Setext 标题`）：正文两个 `<h2 id="设计方案">`（**重复**）；TOC href 为 `#设计方案` 与 `#设计方案-1`（**TOC 侧去重正常，正文侧没有**）；围栏内「示例（代码块内）」**误入 TOC**；Setext `<h1>` **id 为空串**、TOC 无该项
  - TOC 显示文本实测原样输出 markdown 标记：`.toc-list a` 文本 = `**粗体**与[链接](other.md)`，而正文 `.markdown-body h2` = `textContent: 粗体与链接`、`id: 粗体与链接othermd`
  - `useMarkdown.ts:480` 唯一 return 点：`{ blocks, headings, html: '', ... }` —— **`html` 是常量空串**，真实 HTML 在 `blocks[]`（`:414` `blocks.push({type:'html', html:segment})`）
  - `MarkdownViewer.vue:109-111` 已 `headings.value = result.headings` + `emit('headings', result.headings)`，但**全仓无父组件监听**（`grep "@headings"` 非测试代码零命中）。`useMarkdown.ts:67-75` 的 `slugify` 与 `useEntryDetailComputed.ts:57-63` 的 ID 算法**逐字符相同**，唯一差异是 TOC 侧有 `-N` 去重
  - `useCsvParser.ts:7` `parseRows(cleaned, delimiter)` 全量 → `:12` `dataRows.slice(0, maxRows)`；`:57-59` 扫完才 `if (inQuotes) throw`；`useCsvParser.spec.ts:68` 有 `expect(() => parseCsv('a,b\n"unclosed', ',')).toThrow()` 契约
  - `TableView.vue:127` `maxRows` 默认 **50000**，**全仓无任何 view 覆盖**；seed 最大 CSV 仅 61 行 → `TableView.spec.ts:184` 有传 `maxRows: 5` 的先例
  - `HtmlViewer.vue:92-94` `contentSize = props.content.length`；`SIZE_WARN=512KB`/`SIZE_BLOCK=2MB`；`HTML_VIEWER_TEST_SIZE_KEY` 测试注入后门。`HtmlViewer.spec.ts:338-350`（恰好 512KB 警告仍渲染）与 `:354-365`（恰好 2MB 不自动渲染）= **左闭右开是既有契约**
  - `TreeView.vue:73-75` `MAX_SIZE = 2*1024*1024` + `truncated = props.content.length > MAX_SIZE`（同型缺陷，props **不含 size**，须增传）
  - `file.size` 是**真实字节数**：`transformFile`（`client.ts:70-80`）已映射 `size`；后端 `entry_service.py:319` `size=len(content)`，`content = fi.get("content_bytes", b"")` 是 **bytes**。实测 `multi-format-demo` 四文件 API `size` 与 `wc -c` 逐项相同（466/335/255/756）
  - `html_render_service.py`：`:17` `_MAX_INJECT_IDS=50`、`:18` `_BINARY_SIZE_LIMIT=768*1024`（**该文件内仅定义行、零消费 = 死常量**）、`:19` `_CSS_RECURSION_LIMIT=3`；`:55-75` `parse_inject_ids` 只回 `list[int]`（丢失"截掉多少"）；`:72` `if len(result) >= _MAX_INJECT_IDS: break` 静默；`:177` `inject_resources(html, siblings)` 对 `text_siblings` **无任何大小检查**
  - `files.py:48` 另有一处 `_BINARY_SIZE_LIMIT`，`:272` 在**二进制 serving** 路径（`if file_record.is_binary and file_record.size > ...`），不在注入路径
  - `files.py:330-343` 是注入的唯一通道；`:345-355` 是 `Response(headers={CSP, Cache-Control, Referrer-Policy})`
  - 线上限额：`GET /api/v1/config/limits` → `max_file_size=20971520`、`max_entry_files=50`、`max_entry_size=104857600`；**`max_content_length=1048576` 未在服务层强制**（死配置）
  - `create_app` 接受 `config` 参数（`main.py:145-153`），实测 `PeekLimits(max_entry_files=60)` 可覆盖 → BDD-38 的超限分支**可真实 HTTP 触发**（评审已实跑：覆写 52 后 POST 51 sibling → 内联 50、无跳过清单）
  - `stores/entryDetail.ts:50-52` 兜底 `entry.files[0]`，无 README/index 优先级；`entry_service.py:1423/1425/1429` 等 `entry.files=` / `get_entry_files` **无 `order_by`**
  - `EntryDetailView.vue:234` 读 `route.query.firstFileId` → `:236` 传 `loadEntry` → `:238` `router.replace({path, query: {}})` **清空全部 query**；`:239` 有 `f` 键 keydown；`:244` `isMultiFile → isFileTreeOpen = true`、`:245` `isMarkdown && tocHeadings.length>0 → isTocOpen = true`（**均无 zen 分支**）
  - `useZenMode.ts:19` 在 `locked()`（`/f` 路由）时**首行 return**，`f`/`Escape` 全部失效；`EntryDetailHeader.vue:3/:13` 与 `EntryDetailMobileBar.vue:2` 均带 `v-show="!zenMode"` 或 `v-if="isMobile"`
  - `EntryDetailContent.vue:4` `<aside v-if="isFileTreeOpen && isMultiFile" class="file-sidebar">`；`:78` 的 `.toc-sidebar` 同型；`:24` `.meta-tags-bar` 是 `v-if="isMobile && currentEntry"`
  - `useEntryDetailComputed.ts:124-127` `handleNavigateFile(fileId)` → `entryDetailStore.selectFile(file)`（页内切换文件的**唯一入口**，`?file=` 同步的候选挂载点）
  - `client.ts:91-99` `transformListItem` **硬编码 `files: []`**；列表接口 `EntryListItem` 响应**无 `files` 字段**，只有 `file_count` → `EntryCard.vue:150` / `EntryListRow.vue:153` 的 `files?.[0]?.id` 是**死代码**（浏览器实测点卡片后 URL 无 `firstFileId`）
  - `DiagramBlock.vue:177` `<button class="diagram-action-btn fullscreen-btn" title="Fullscreen">⧉</button>` —— `title` 是 accessible name fallback，会命中宽松的"名称含 fullscreen"判据（故 BDD-23/24/31 均要求排除 `title`）
  - `--mobile-bar-height: 64px`（`styles/variables.css:13`）
  - e2e `firstFileId` 计数实测：`viewer.spec.ts` **2** / `t091` **4** / `tpv0099` **3** = **9 处**

- **本任务需要新增/改动的 e2e**（`P5_e2e` 该写哪个 spec）：
  - 新建 `frontend-v3/e2e/tpv0104-viewer-hardening.spec.ts`（建议名，覆盖 V-01/`?file=`/默认入口/全屏/多文件这些浏览器行为）
  - 迁移既有 `firstFileId` → `file`：`viewer.spec.ts`(2) / `t091`(4) / `tpv0099`(3)
  - 注意：既有 `viewer.spec` / `t091` 基线已红（见上），`P5_e2e_legacy` 若要跑它们须按"失败集不劣于基线"判，不能要求全绿

- 环境坑：`npx tsx` 不可用（`~/.npm` 只读 EROFS）→ 用 `/home/kity/oclab/deepseek-harness/node_modules/.bin/tsx` + `NODE_PATH=$(npm root -g)`；临时产物落 `<项目根>/.agate-tmp/`（**不用 `/tmp`**，per-call tmpfs）；造/删 entry 只经 debug HTTP API（**禁 CLI**）、**用完即删**、**造件须同时给 `path` 与 `filename`**（只给 path → `filename=untitled`、`language=null` → 前端退化 CodeViewer）；**DELETE 用 slug 不用 id**；数据在服务重启后会丢（`anon total==0` 时先 `make debug-seed`）。
</objective_info>
