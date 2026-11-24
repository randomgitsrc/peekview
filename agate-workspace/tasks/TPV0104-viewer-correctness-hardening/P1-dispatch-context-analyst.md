---
phase: P1
generated_by: agate-inject-card.py + 主 Agent
task_id: TPV0104
role: analyst
---

<dispatch_guide>
> ⚠️ 以下派发指引是本次任务的强制指令，不是参考信息。执行优先级：派发指引 > 客观查证信息 > 阶段卡片（参考规范）

### 目标

产出 `P1-requirements.md`：把 P0-brief 的 45 条 BDD 倾向细化为**可二值判定**的验收基线，补齐 P0 未决项，做同类扫描，声明 frontmatter 机器字段（risk_level/ceremony/phases/packages/domains/capability_requirements）。

P0 已完成三次范围扩展与一次概念修正，**不需要重新立项**——你的任务是收敛，不是重写。

### 约束

1. **BDD 数量与维度**：P0-brief 给了 45 条倾向。你必须逐条复核其**可判定性**——凡要求"性能断言或 spy 验证"的（如 P0 §V-03 第 39 条）必须换成具体可观测判据（例如 `parseRows` 构造的数组长度上限、`totalRows` 精确值断言），否则 P6 无法二值判定。
2. **人工体验路径 BDD（强制）**：本任务有用户可见页面且内容受 seed 数据影响 → 必须追加「Given seed 数据 → 页面有内容」型 BDD，不得只用 fixture/单测替代。
3. **UX 类别 BDD + 形态声明（强制，domains 含 frontend）**：至少一条 UX 类别 BDD，标题后缀写类别；按实际形态声明 `ui_render_shape` 与 `ui_ux_dimensions`。本任务为布局/交互型（非渲染引擎/WebGL），形态判定由你给出并说明依据。
4. **P0 未决项必须收敛，不得留在 P1**（这是本阶段最大风险，P0 已把它列为待清理项）：
   - 全屏按钮**具体位置**（Header 工具区 vs 新增轻量入口）+ 移动端不遮挡方案
   - 旧 `?firstFileId=` 链接**是否加重定向**（P0 §7.4.1 迁移影响）
   - `HtmlViewer.vue` 的 `>= 2MB` 边界（P0 决策 5 遗留：恰好 2MB 触发是否预期）
   - 注入预算**数值**（P0 决策 4 明确"数值待 P2 依实测确定，不拍脑袋"）→ 本阶段只需声明"数值由 P2 实测后冻结"，但 BDD 判据必须写成**不依赖具体数值**的形式（如"超预算时返回被跳过文件清单"）
5. **`[NEED_CONFIRM]` 最小化**：真无方向的人定夺项才标。有倾向的一律标 `[SUGGEST: 推荐 X，理由 Y]` 并自行采纳倾向（除非涉及破坏性变更/业务方向）。
6. **不得改 P0 已定决策**：V-01 只做轻量 resolver（不动 schema）、V-03 不引入 Web Worker、V-04 选隐藏而非让排序生效、V-05 只记录策略不改 CSP、V-06/07 建预算且超限显式反馈。若你实测发现有决策不可行，**停下来报告主 Agent**，不要自行推翻。
7. **能力声明硬要求**：frontend 任务的 `capability_requirements` 必须含 vision 视觉能力条目（`need` 中出现 visual 或 vision 字样），否则 `check-gate.py P1` 的 `_gate_p1_vision_capability` 直接 exit 1。本环境实测视觉能力可用（见 objective_info）。
8. **同类扫描（强制节，不得空白）**：对 7 项缺陷涉及的关键符号 grep 全仓，记录命中数 + 文件清单 + 逐条"本次处理 / 不处理 + 理由"。特别要扫：
   - `extractHeadings` / `slugify` / `headings.push` —— V-02 改动面是否被其它消费方引用（移动端 TOC、锚点滚动）
   - `files[0]` —— V-01 resolver 必须单点，全仓哪些地方还在自行取 `files[0]`
   - `query: {}` / `router.replace` —— V-01 URL 清理是否还有其它一锅端点
   - `content.length` —— V-08 字节数判断的同类点
   - `_MAX_INJECT_IDS` / `768 * 1024` —— V-06/V-07 预算同类常量
9. **P0 时效性质疑（强制第一步）**：P0-brief 立项于同日，但有三处**已实测并确认的事实变更**（P0 自己记录的），你需核实这些实测结论是否仍成立，并写下「已核对 P0-brief 时效性，无漂移」或带具体漂移点的 `[P0_STALE: ...]`。
10. **`phases:` 与 `pruned:` 必须互补**：`phases ∪ pruned == phase_universe`（P1..P8）。P2/P4/P5/P6 不可裁；P3 保留（本任务有可单测行为）；P7 保留（多文件跨前后端）；P8 保留（用户可见改动 + CHANGELOG）。
11. **`judge.enabled: true` 已在 `.state.yaml` 写好，你不需要动它**。
12. 产出末尾用 `agate-md-field-set` 写 frontmatter（先 `--list` 看清单），不要手写 frontmatter。

### 上游关联

- P0-brief（`P0-brief.md`）已含：8 项缺陷在 `9a47df77` 的逐条复验表、6 条设计决策、决策 7 的完整 URL/默认入口/全屏设计、§7.5 四处与现状冲突表、§7.4.1 `firstFileId` vs `file` 机制差异专节、已知风险 11 条、裁剪倾向。
- 主 Agent 已实测的四处冲突（见 objective_info），其中「全屏按钮不存在」「清 query 一锅端」「卡片/列表绕过 resolver」三条已由你复核源码确认。
- orchestrator-log 记录了 1 次 CORRECTION（概念错误：firstFileId ≠ file），**不要再把它当参数改名问题**。

### 输入文件

- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P0-brief.md`（主 Agent 任务简报，必读全文）
- `{project_root}/docs/notes/issues-20261124-1553.md`（默认入口与 `?file=` 完整设计，188 行，必读）
- `{project_root}/docs/notes/issues-20261124-1612.md`（全屏阅读入口，171 行，必读）
- `{project_root}/docs/notes/issus-20261124-1429.md`（V-01~V-08 核实报告，897 行，**按需读 V-01~V-08 对应节**，不需要全文精读）
- `{project_root}/docs/reviews/v04-truncated-header-controls-20261124.md`（V-04 源分析，51 行）
- `{project_root}/AGENTS.md`（项目约定：铁律、测试命令、环境隔离）
- `{project_root}/DESIGN.md`（视觉规范，全屏按钮的图标/位置必须遵循）

源码（复核现状用，按需读）：
- `frontend-v3/src/composables/useEntryDetailComputed.ts`（`extractHeadings` 独立解析）
- `frontend-v3/src/composables/useMarkdown.ts`（`slugify` + `headings.push`）
- `frontend-v3/src/stores/entryDetail.ts`（`files[0]` 兜底）
- `frontend-v3/src/views/EntryDetailView.vue`（`:234` 读 query / `:238` 清 query / `:239` f 键）
- `frontend-v3/src/components/EntryCard.vue:150` / `EntryListRow.vue:153`（无条件传 `files[0].id`）
- `frontend-v3/src/components/TableView.vue`（`.th-sort-btn` / `.th-filter` 无 v-if）
- `frontend-v3/src/components/HtmlViewer.vue`（`contentSize` 用 `content.length`）
- `frontend-v3/src/composables/useCsvParser.ts`（先全量 parse 再 slice）
- `frontend-v3/src/router.ts:59`（`/:slug/f` 路由，`meta.zen='locked'`）
- `backend/peekview/services/html_render_service.py`（`_MAX_INJECT_IDS=50` / `_BINARY_SIZE_LIMIT=768KB`）
- `backend/peekview/services/entry_service.py`（`get_entry_files` 无 order_by）
- `backend/peekview/api/files.py:41`（CSP `connect-src`）

测试（判断"现有契约不得擅改"的边界，按需读）：
- `backend/tests/` 下 `test_html_render.py`（含 `assert "https:" in csp` 契约）
- `frontend-v3/e2e/viewer.spec.ts` / `tpv0099-fullscreen-link-auth.spec.ts` / `t091-mobile-detail-visual-polish.spec.ts`（均引用 `firstFileId`，机制替换后需同步改）

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
- 环境状态（主 Agent 2026-11-24 实测）：
  - 协议 v0.83.3，AGATE_ROOT=`/home/kity/.agate/v0.83.3/agate`
  - git 工作树干净，HEAD=`899a9d43`（`wf(TPV0104): 修正概念错误`）
  - 后端 venv pytest 9.1.1 / 前端 vue-tsc 5.9.3 / vitest 1.6.1 / ruff 0.15.18 / MCP node_modules 就绪
  - 版本 `peekview=0.27.1`（VERSIONS.json 与 `peekview.__version__` 一致）
  - debug backend **已运行在 http://127.0.0.1:8888**（挂在后台 job 下托底），已 `make debug-seed`：19 entries + 24 seed 数据 / 用户 alice/bob/carol/dave（密码 testpass123，dave disabled）
  - 生产 `:8080` 不可达（000），全程零接触
  - Chrome CDP `localhost:18800` 在线（Chrome/158.0.8127.37），Playwright 截图实测成功
  - **视觉能力可用**：`vision-engine` skill 已就位；注意本沙箱 `~/.local/share` 只读，调用方式见下方"环境坑"
  - `make debug-seed` 后 DB 实际路径 `/tmp/peekview-debug/`（per-call tmpfs，**跨 bash 调用不可见**——不要在 bash 里直接 sqlite3 查它，走 HTTP API）

- 主 Agent 已实测的四处冲突（供你复核，不要照抄，要自己验证）：
  1. `firstFileId` 一次性种子：`EntryDetailView.vue:234` 读 query → `:236` 传给 `loadEntry` → `:238` 立即 `router.replace({ path: route.path, query: {} })` 清空**全部** query
  2. 详情页**无全屏按钮**：全仓 grep 只有 `EntryDetailView.vue:239` 的 `f` 键 keydown 与 `DiagramBlock.vue:177` 的图表全屏；`/:slug/f` 路由已存在（`router.ts:59-63`，`meta.zen='locked'`）
  3. 清 query 一锅端：见第 1 条 `query: {}`
  4. 卡片/列表无条件传 `files[0].id`：`EntryCard.vue:150-152` / `EntryListRow.vue:153-155` 都用 `props.entry.files?.[0]?.id` 拼 `firstFileId`
  5. `stores/entryDetail.ts:50-52` 兜底也是 `entry.files[0]`，无 README/index 优先级；后端 `entry_service.py:1425-1429` 的 `get_entry_files` 与 `:1423` 的 `entry.files=` 都**无 `order_by`**

- 其它实测：
  - `useCsvParser.ts:7` `const allRows = parseRows(cleaned, delimiter)` 在 `:12` slice 之前；`parseRows` 无上限参数
  - `TableView.vue` 25-31（`.th-sort-btn`）与 32-37（`.th-filter`）无 `v-if`；`:58` 的 `.table-controls` 有 `v-if="!parsed.truncated"`
  - `HtmlViewer.vue:92-94` `contentSize` = `props.content.length`；`SIZE_WARN=512KB` / `SIZE_BLOCK=2MB`；另有 `HTML_VIEWER_TEST_SIZE_KEY` 注入的测试后门
  - `html_render_service.py:17` `_MAX_INJECT_IDS = 50`、`:18` `_BINARY_SIZE_LIMIT = 768*1024`、`:19` `_CSS_RECURSION_LIMIT = 3`；`:72` `if len(result) >= _MAX_INJECT_IDS: break` 静默截断
  - `files.py:41` CSP `connect-src blob: data: https:`
  - e2e 中引用 `firstFileId` 的 3 个 spec：`viewer.spec.ts:21,214`、`tpv0099-fullscreen-link-auth.spec.ts:65,99,101`、`t091-mobile-detail-visual-polish.spec.ts:10,12,95,321`

- 环境坑（写 BDD/验收路径时必须考虑）：
  - **`npx tsx` 不可用**（`~/.npm` 只读，EROFS）。Playwright 脚本用 `/home/kity/oclab/deepseek-harness/node_modules/.bin/tsx` + `NODE_PATH=$(npm root -g)` 执行
  - **vision-engine 默认 HOME 不可写**（`~/.local/share/vision-engine/ratelimit` EROFS）。可用方式：`HOME=<项目>/.agate-tmp/vhome PYTHONPATH=/home/kity/.local/lib/python3.12/site-packages python3 <skill>/scripts/vision-analyze.py ...`（`.agate-tmp/vhome/.env` 已软链到 `~/.env` 提供 key）
  - 截图/临时产物落 `<项目根>/.agate-tmp/`（已 gitignore），**不要用 `/tmp`**（per-call tmpfs）
  - 服务存活跟随发起它的 bash 调用 → 主 Agent 已用后台 job 托底，但你每次用前**自行探活**：`curl -sf -m 3 http://127.0.0.1:8888/api/v1/entries?per_page=1`
</objective_info>
