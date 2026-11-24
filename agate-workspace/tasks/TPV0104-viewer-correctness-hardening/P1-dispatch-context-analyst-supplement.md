---
phase: P1
generated_by: 主 Agent（dispatch-context 派发后冻结，故新增本补充文件，不修改已冻结的 P1-dispatch-context-analyst.md）
task_id: TPV0104
role: analyst
supersedes_nothing: true
---

# P1 派发补充指令（在 `P1-dispatch-context-analyst.md` 之后追加，同等强制力）

> ⚠️ 本文件与 `P1-dispatch-context-analyst.md` **具有同等强制力**，是对它的**追加**而非替换。
> 原因：原 dispatch-context 派发后已冻结（provenance 审计要求初始版本不变），后续新增的实测发现与用户决策写入本文件。
> 若两者冲突，**以本文件为准**（更新更晚、且含用户明确决策）。

## 一、用户已定夺的两项决策（**必须体现，不得推翻**）

这两项是 P0-brief 与 1553/1612 两份文档都**未覆盖**的空白，主 Agent 已请用户定夺，答案明确：

### 决策 A：`/{slug}/f` 全屏态 = **只读分享态**，不加退出按钮

- 不加任何退出全屏的按钮/浮层；退出靠浏览器后退。
- 依据（实测）：`useZenMode.ts:19` 在 `locked()`（即 `/f` 路由）时**首行 return**，`f`/`Escape` 全部失效；`EntryDetailHeader.vue:3/:13` 与 `EntryDetailMobileBar.vue:2` 都带 `v-show="!zenMode"`，一进全屏 header 即隐藏。所以现状本就是纯只读态。
- **P1 必须写一条 BDD 显式规定「`/f` 下不引入退出按钮」**——否则 P4 阶段可能有人"顺手加个按钮"，违反设计意图与本次决策。

### 决策 B：Setext 标题 → **给 h1 生成 id 并纳入 TOC**

- TOC 层级从 h2-h4 扩为 **h1-h4**；正文对**所有进 TOC 的层级统一生成 id、统一去重**。
- 依据（实测）：`useMarkdown.ts:332` 的 `level >= 2 && level <= 4` 过滤把 Setext（`===`）产生的 **h1** 排除 → **正文侧也没给 id**，不只是"TOC 收不到"。P0 BDD 已要求「Setext 标题 Then TOC 包含该项」，维持原过滤则该 BDD 永不成立。
- 副作用属预期、非缺陷：文档首个 h1 大标题会出现在目录中。
- 原 P1 若已按"仅 TOC 收不到"思路写 BDD，须改写为"正文与 TOC 双侧都正确"。

## 二、主 Agent 追加的实测证据（**每条都是亲自跑出来的，可直接引用**）

### E-1：V-02 三类缺陷全部实测复现（不再只是静态比对）

现造 entry（`probe.md`：重复 `## 设计方案`×2 + 围栏内 `## 示例` + Setext `Setext 标题`）后浏览器实读：

| 缺陷 | 实测结果 | 判定 |
|---|---|---|
| 重复标题 ID 不唯一 | 正文两个 `<h2 id="设计方案">`，**ID 完全相同** | 成立，第二个标题无法被锚点命中 |
| 围栏内标题误入目录 | TOC 含「示例（代码块内）」，正文 h2 列表**无此项** | 成立，TOC 条目指向不存在的锚点 |
| Setext 标题双侧皆缺 | 正文 `<h1>Setext 标题</h1>` **无 id**，TOC 也无此项 | 成立，比 P0 记录更严重 |

**TOC 的 DOM 结构（P6 判据要用）**：`.toc-sidebar` → `nav.toc-nav` → `h3.toc-title` + `ul.toc-list` → `li.toc-item.toc-level-{N}` → `a[href="#{id}"]`（`TocNav.vue:1-14`）。**默认 `.toc-sidebar` 不渲染**，必须先点 `[aria-label="Table of Contents"]` 按钮；关闭后整块从 DOM 消失。→ **任何 TOC 相关 BDD 的 When 必须写明"点开 TOC 后"**，否则判据会因元素不存在而假 FAIL。

### E-2：`/f` 全屏态现状 —— 文件树仍在，BDD「全屏无文件树」现状不成立

Playwright 实跑 `/k8s-deployment/f`（3 文件）：`.entry-detail` class = `entry-detail zen-mode`（zen 生效）、`.detail-header` 存在但 `display:none`、**文件树可见**、`.toc-sidebar` 存在。根因两条：① `EntryDetailView.vue:281-284` 的 zen CSS 只隐藏 header/mobile-bar/meta-tags，**没有文件树**；② `:244`/`:273` 在多文件 entry 下**自动** `isFileTreeOpen.value = true`，`:4` 的 `<aside v-if="isFileTreeOpen && isMultiFile">` 因此渲染。

→ 「全屏模式无文件树」是**新增需求**，不是回归守护。P1 须写成新增行为，且不能靠"现状已满足"的心态写判据。

### E-3：`firstFileId` 被消费后从 URL 消失（`file` 必须持续态的直接证据）

实跑 `/k8s-deployment/f?firstFileId=15`：**确实选中了第 3 个文件**（内容为 Service 的 `apiVersion...kind:Service...`），**但 URL 被清成 `/k8s-deployment/f`**。→ 若沿用 `firstFileId`，全屏分享链接无法表达"在看哪个文件"。这条是 P0 §7.4.1 论断的**运行时铁证**，可直接引用于 BDD 的 rationale。

### E-4：`EntryCard`/`EntryListRow` 的 `files[0]` 传递是**死代码**（推翻 P0 §7.5 冲突表第 4 行）

- 列表接口 `GET /api/v1/entries` 响应**无 `files` 字段**（实见响应体只有 `file_count`）
- `client.ts:91-99` `transformListItem` **硬编码 `files: []`**
- 两组件唯一挂载点 `EntryListView.vue:169/184`，`entries` 全部来自 `listEntries`
- 浏览器实测：点多文件 entry `multi-format-demo`（4 文件）卡片后 URL = `/multi-format-demo`，**无 `firstFileId`**

→ 移除该传递是**删除死代码 + 消除错误范式**，不是修复在生效的 bug。**BDD 判据必须改为代码级断言**（该分支不存在），不可用"点卡片看 URL 有没有参数"——现状本来就通过，会得到假 PASS。P0-brief §7.5 已由主 Agent 回写更正。

### E-5：验收手段分层（决定每条 BDD 该在哪一层验）

| 缺陷组 | 可验层级 | 关键约束 |
|---|---|---|
| V-06/V-07 注入预算 | **pytest 完全自足** | `test_html_render.py:27` 的 `client` fixture 用 `create_app()` + `mkdtemp()` 建独立临时 app/DB；`:45` `_create_entry` 可造任意多文件 entry |
| V-04 截断态控件 / V-03 提前终止 | **须注入 `maxRows` 小值** | `TableView.vue:127` 默认 **50000**，**全仓无任何 view 覆盖**；seed 最大 CSV 仅 61 行。单测可直接传 `maxRows: 5`（`TableView.spec.ts:184` 有先例） |
| V-01 / `?file=` 深链 | **须 debug `:8888` + 现造 entry** | seed **没有**「有 index.md 无 README」样本；刷新保留/切换同步是跨请求行为，mock router 证不了 |
| V-08 字节数 | 单测可证，**但有假 PASS 风险** | `HTML_VIEWER_TEST_SIZE_KEY` 注入会**绕开"从 file.size 取值"这个被测行为本身**，须另有一条走真实 `file.size` 的断言 |

→ **P1 必须把这些环境前提写进 BDD 或独立的环境约束节**，否则 P6 会在"以为能跑"时才发现跑不了。

### E-6：seed 素材清单（默认入口 BDD 直接依赖）

根目录**有** `README.md`：`k8s-deployment`(3 files) / `product-screenshots`(2) / `unicode-filenames`(8)
根目录**两者都无**：`edge-case-data`(6) / `markdown-test`(2) / `mermaid-charts`(3) / `multi-format-demo`(4) / `python-entry-service`(2) / `svg-icons`(2)
**有 `index.md` 无 `README.md`：seed 中不存在** → 该条 BDD 必须现造 entry（走 debug HTTP API，禁 CLI）

### E-7：V-02 的修复面比 P0 预估更窄（P0 决策 1 成立）

`MarkdownViewer.vue:109-111` 已 `headings.value = result.headings` **并 `emit('headings', result.headings)`**，正确的 headings 数组**已经流出组件**，但**全仓无父组件监听该事件**。`useMarkdown.ts:67-75` 的 `slugify` 与 `useEntryDetailComputed.ts:57-63` 的 ID 算法**逐字符相同**，唯一差异是 TOC 侧有 `-N` 去重。→ 可以是"接线 + 补去重"级改动。
（**一处自我更正**：`MarkdownViewer.vue:22-31` 的 `defineProps` 只有 `content/pathMap/slug` 三个，**没有 `headings` prop**；`:28` 是 `defineEmits` 的类型声明，`:37` 是内部 ref。三者无同名冲突。`EntryDetailContent.vue:56` 的 `:headings="tocHeadings"` 是无对应 prop 的**无效绑定**，若 P2 选"接线 emit"应一并清掉。）

## 三、P1 必须收敛的剩余待定项（原 4 项，现剩 2 项）

已由用户定夺、**不再是待定**：全屏按钮「是否加」及「`/f` 退出语义」（决策 A）、Setext/h1 处理（决策 B）。

仍需 P1 收敛：

1. **全屏按钮的具体落点 + 移动端不遮挡方案**：实测约束——`EntryDetailHeader.vue:13` 的 `.detail-header` 工具区（`.actions-area`，已有 Toggle file tree / TOC / Source / Star / Copy / Share / OverflowMenu 一排 `toggle-btn`/`icon-btn`）是 1612 指定的首要位置，但它带 `v-show="!zenMode"`，**只影响全屏态、普通态可见可用，符合要求**。移动端 `EntryDetailMobileBar.vue`（`data-testid="mobile-bottom-bar"`）同样带 `v-show="!zenMode"`，普通态可用。P1 须明确**桌面端放 `.actions-area`、移动端放底部栏**还是别的组合，并给出「不遮挡主要内容」的判据（可从既有 `--mobile-bar-height` 变量与 DESIGN.md §9「触控 ≥44px」取值）。
2. **旧 `?firstFileId=` 链接是否加重定向**：P0 §7.4.1 的迁移影响。注意 E-4——自动来源（卡片/列表）**本就不产生**该参数，所以剩余风险仅为用户手动收藏的链接。

另需明确但可留数值给 P2：**注入预算的具体数值**（P0 决策 4 说"待 P2 依实测确定"）。P1 只须保证 BDD 判据**不依赖具体数值**（如"超预算时返回被跳过文件清单"），并写明"数值由 P2 实测后冻结"。

## 四、仍然生效的原约束

`P1-dispatch-context-analyst.md` 的 12 条约束**全部继续有效**，特别是：BDD 必须可二值判定、必须含同类扫描节、必须含 P0 时效性质疑结论、`capability_requirements` 必须含 vision 条目（frontend 任务 check-gate 硬拦）、`phases ∪ pruned == {P1..P8}`、frontmatter 用 `agate-md-field-set.py` 写、无 NEED_CONFIRM 时写 `[NO_NEED_CONFIRM]`。

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
