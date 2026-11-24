---
phase: P1
task_id: TPV0104
type: problems
parent: P0-brief.md
trace_id: TPV0104-P1-20261124
status: draft
created: '2026-11-24'
agent: analyst
risk_level: medium
ceremony: standard
phases:
- P1
- P2
- P3
- P4
- P5
- P6
- P7
- P8
packages:
- peekview
- frontend-v3
- docs
domains:
- frontend
- backend
ui_render_shape: layout
ui_ux_dimensions:
- 布局结构
- 交互行为
- 视觉呈现
prod_touched: false
---
# P1-requirements — TPV0104 Viewer 正确性与资源边界加固

> 本文件是需求基线（活基线）。P2–P8 不得直接修改；变更须主 Agent 批准并标 `[BASELINE_CHANGE: 理由]`。
> 输入：`P0-brief.md` + `P1-dispatch-context-analyst.md` + `P1-dispatch-context-analyst-supplement.md`（后者与前者同等强制力，冲突以其为准）。
> 产出范围：把 P0 的 45 条倾向细化为 **54 条可二值判定 BDD**，收敛全部待定项，做全仓同类扫描。第 2 轮按 `P1-review.md` 的 11 BLOCKER + 14 WARNING 修订（核心是**判据区分力**：每条改动过的 BDD 在改动前须 FAIL、改动后 PASS）。

`[NO_NEED_CONFIRM]`

---

## 1. 需求复述

把 Peekview Viewer 的 **8 项已确认缺陷**修好，使其「用户看到的内容与导航可靠、大产物不拖垮浏览器/服务端、HTML 边界被明确记录」，并补齐 1553/1612 两份设计文档要求的**多文件默认入口 + `?file=` 深链 + 全屏阅读入口**闭环。

按三批交付：

| 批次 | 内容 | 缺陷编号 |
|---|---|---|
| 一、正确性 | Markdown 标题与目录单一来源；多文件默认入口 resolver + `?file=` 持续态深链 + 全屏阅读入口；截断态表头控件 | V-02、V-01（含决策 7）、V-04 |
| 二、资源边界 | CSV 提前终止解析；HTML sibling 注入统一预算；注入超限显式反馈；大小判断改用真实字节数 | V-03、V-06、V-07、V-08 |
| 三、安全边界 | 定义「安全预览 / 交互式 Demo」两档并记录当前默认（**不改 CSP**） | V-05 |

> **V-07 的事实口径（第 2 轮澄清，影响判据可执行性）**：V-07 原始描述「注入 50 个上限静默截断」在当前默认配置下**不会实际发生**——`_MAX_INJECT_IDS(50) == max_entry_files(50)` 且主文件占 1 名额 → 最多 49 个 sibling，`break` 分支是**休眠代码**。本任务的处理是**让该保护真正生效**（调低注入数量上限使超限可达，见 §3.7 的 B8 结论与 BDD-38），而不是承认它不存在；因此 BDD-38 同时包含「行为断言」与「代码级可达性关系断言」，后者在改动前即为 FAIL。

**明确不做**（P0 已定，P1 不改）：不新增 `is_primary`/`main_file` schema 字段（roadmap #57）、不引入 Web Worker/虚拟滚动、不改 HTML CSP 默认策略、不做文件版本管理/跨实例稳定文件身份。

**P1 阶段由用户定夺的两项决策（本文件必须体现，不得推翻）**：

- **决策 A（`/f` 是只读分享态，不加退出按钮）**：`/{slug}/f` 保持既有「Zen locked」语义——不引入任何退出全屏的按钮或浮层，退出靠浏览器后退/改 URL。依据：`DESIGN.md:210-212` 原文已规定 "Zen is **locked** — `f` / `Escape` change nothing... Leaving requires editing the URL"；实测 `useZenMode.ts:19` 在 `locked()` 时首行 return，`EntryDetailHeader.vue:13` / `EntryDetailMobileBar.vue:2` 均带 `v-show="!zenMode"`。→ 该决策是**既有设计意图的确认**，P1 写成**约束型 BDD**（BDD-29），不是新功能。
- **决策 B（Setext 标题 → h1 也生成 id 并纳入 TOC）**：TOC 层级由 h2–h4 扩为 **h1–h4**；正文对所有进 TOC 的层级统一生成 id、统一去重。依据：`useMarkdown.ts:332` 的 `level >= 2 && level <= 4` 过滤使 Setext（`===`）产生的 **h1 在正文侧也没有 id**（不只是 TOC 收不到）。副作用（文档首个 h1 出现在目录中）属预期，非缺陷。

---

## 2. 隐含需求识别

用户/P0 没说但技术上必须做的，逐维度过。

### 2.1 数据与顺序契约

- **文件列表顺序必须先有确定性契约，默认入口才有意义**：前端 resolver 依赖「稳定排序」兜底，而 `entry_service.py:1423`/`:1429` 的 `select(File)` **无 `order_by`** → 顺序 = SQLite rowid（= 插入顺序）。故后端补确定性排序是 V-01 的**前置条件**，不是可选项。→ BDD-13。
- **现有测试不得因排序变更而漂移**：`backend/tests/test_html_render.py` 等大量用 `files[0]["id"]` 取主 HTML 文件；这些 fixture 的文件顺序即构造顺序。补 `order_by` 后若顺序改变，这些测试会连带变红——须在 P4 验证（本次同类扫描已登记，见 §6.8）。
- **无 schema 变更** → 无数据迁移，但「旧 `?firstFileId=` 收藏链接」的语义变化须显式处理（见 2.4）。

### 2.2 前端

- **§7.4.1 是机制替换不是改名**：`firstFileId` 是一次性种子（`EntryDetailView.vue:238` 加载完即 `router.replace({query:{}})` 清除、页内切换从不更新、刷新即丢）；`file` 要求持续态（刷新保留、切换同步、切回默认才移除）。→ 必须换掉机制，不能保留清除逻辑。
- **清 query 必须逐参数处理**：现状 `query: {}` 一锅端**会误删 `file`/`share`**。→ BDD-22。
- **全屏入口不存在，必须新增**：全仓仅 `EntryDetailView.vue:239` 的 `f` 键与 `DiagramBlock.vue:177` 的**图表**全屏，页面级全屏无按钮（1612 明确要求新增）。
- **`/f` 隐藏 chrome 由两处规则共同决定，隐藏集不同（第 2 轮更正）**：① **全局** `frontend-v3/src/styles/layout.css:650-657`（`main.ts:8` 引入）：`.detail-header` / `.file-sidebar` / `.toc-sidebar` / `.mobile-actions` / `.mobile-sticky-header` / `.mobile-bottom-bar`；② **scoped** `frontend-v3/src/views/EntryDetailView.vue:281-284`：`.detail-header` / `.mobile-sticky-header` / `.mobile-bottom-bar` / `.meta-tags-bar`。→ **`.file-sidebar` 与 `.toc-sidebar` 只由全局那处隐藏**（第 1 轮只查 scoped 规则，误判"zen 不隐藏文件树"，本轮更正）。
- **但「全屏无文件树」仍是新增需求**：现状多文件 entry 下 `EntryDetailView.vue:244`/`:273` 会自动 `isFileTreeOpen = true`，`EntryDetailContent.vue:4` 的 `<aside v-if="isFileTreeOpen && isMultiFile">` 因此**渲染进 DOM**，只是被全局 CSS `display:none` 隐藏 → 判据若写"可视计数 0"现状即通过（假 PASS），必须断言 **DOM 不存在**。→ BDD-28、BDD-53 ③。
- **TOC 的默认展开态是分视口的（第 2 轮更正）**：`EntryDetailView.vue:243-246` + `useResponsiveLayout.ts:20`（`isDesktop = viewportWidth > 640`）→ **桌面端默认展开**（多文件/有标题时 `isTocOpen = true`），**移动端默认不渲染**。故所有 TOC 判据的 When 必须写**幂等表述**（读 `aria-expanded`，`"false"` 才点击），写「点开 TOC」会在桌面端把已展开的 TOC **关掉**，造成假 FAIL。
- **`EntryDetailContent.vue:56` 的 `:headings="tocHeadings"` 是无效绑定**（`MarkdownViewer` 的 `defineProps` 只有 `content/pathMap/slug`，无 `headings` prop；`:28` 是无监听者的 `defineEmits` 类型声明）→ 若 P2 选「接线 emit」路线，须一并清掉该无效绑定。

### 2.3 多端

- **MCP / CLI 不受 V-01 影响**：`packages/mcp-server/src/tools/getEntry.ts:88` 的 `files[0]` 是「单文件 entry 直接输出」语义（入口已按 `raw.files.length === 1` 前置判定），与默认入口无关；CLI 只遍历 `entry.files` 打印。→ 本次不处理（见 §6.2）。
- **`raw` 接口 `files` 顺序**沿用同一查询路径，补 `order_by` 后随之确定（对 Agent 读路径是改进，无契约破坏）。

### 2.4 边界与兼容

- **旧 `?firstFileId=` 链接**：自动来源（卡片/列表）**本就不产生该参数**（E-4：列表接口无 `files` 字段、`transformListItem` 硬编码 `files: []`），剩余风险仅为用户手动收藏的链接。→ 见 §4 待确认清单（已用 SUGGEST 采纳）。
- **`>= 2MB` 边界语义是既有契约**：`HtmlViewer.spec.ts:338-350`（恰好 512KB → 警告但仍渲染）与 `:354-365`（恰好 2MB → 不自动渲染 + 手动触发按钮）配对确立**左闭右开**语义。→ 本项**不再是待定项**，写成回归 BDD-43。⚠️ 但这些用例全部用 `HTML_VIEWER_TEST_SIZE_KEY` 注入假值，**从不走真实 `file.size`** → 必须新增走真实 `file.size` 的断言（BDD-42），否则假 PASS。
- **V-03 与既有解析契约的硬冲突**：`useCsvParser.ts:57-59` 是「扫完全文才 `if (inQuotes) throw`」，`useCsvParser.spec.ts:68` 有明确契约 `expect(() => parseCsv('a,b\n"unclosed', ',')).toThrow()`。「到上限即停止构造数组」与「必须扫完全文才能判引号闭合」必须共存——正解是只限制「push 进 `rows` 数组」而不 `break` 出状态机。→ BDD-37 锁死该回归。
- **V-08 是两处同型缺陷**：`HtmlViewer.vue:94` 与 `TreeView.vue:75`（`MAX_SIZE = 2 * 1024 * 1024`，作用于 JSON/YAML/XML 树视图截断判断）**同一错误范式、同一数值** → V-08 修复面是两处共用同一字节数工具，`TreeView` 的 props 目前不含 `size`，须增传。

---

## 3. BDD 验收条件

共 **54 条**（BDD-01 ~ BDD-54，编号连续、全局唯一）。每条独立可二值判定（PASS / FAIL），且**判据必须在「改动前的实现」下 FAIL、改动后 PASS**——现状即满足的条目一律显式标注「回归兼容：」（属设计意图守护，不冒充新行为）。判据**不绑定** CSS 类名 / 组件名 / 具体 API 调用名作为语义要求（出现的选择器/端点仅为**定位手段**）；UX 类别写入标题后缀（`布局结构` / `交互行为` / `视觉呈现`，与本文件 `ui_ux_dimensions` 声明一致）。

> **证据分层前提**（决定每条 BDD 在哪一层验，见 §9）：纯前端逻辑走 vitest；浏览器 DOM/URL 走 debug `:8888` + Playwright；后端注入预算走 pytest（`test_html_render.py` 的 `client` fixture 自建临时 app/DB）。
>
> **TOC 展开态的幂等表述（全文统一，替代「点开 TOC」）**：桌面视口下 TOC **默认已展开**（`EntryDetailView.vue:243-246` + `useResponsiveLayout.ts:20` 的 `isDesktop = viewportWidth > 640`），直接点按钮会把它**关掉**。故凡 TOC 判据，When 一律写：**「确保 TOC 处于展开态——读 `[aria-label="Table of Contents"]` 的 `aria-expanded`，按三分支处理：若为 `"true"` 则不做任何点击；若为 `"false"` 则点击一次；若为 `null`（该视口不适用本条，改用桌面 1280×800 视口重跑）；最终等待 `.toc-sidebar` 与 `.toc-list` 出现在 DOM 中」**。违反此表述的按字面点击会造成假 FAIL。
>
> **`aria-expanded === null` 分支的实测依据（W-新 2）**：TOC 入口**分视口走不同控件**——桌面是 `.toc-sidebar` 的开关（带 `aria-expanded`，实测 `"true"`）；移动端（390×844）命中的是 `[data-testid="mobile-bar-toc-btn"]`（`EntryDetailMobileBar.vue:14-16`），该按钮**根本没有 `aria-expanded` 属性**（实测读得 `null`），且移动端 TOC 走抽屉（`showTocDrawer`），与 `.toc-sidebar` **不是同一条 v-if 链**（实测移动端 `.toc-sidebar` 的 `display:none`、`rect.width === 0`，链路不生效）。故 TOC 类判据一律**钉定桌面视口 1280×800**；读到 `null` 说明当前不是桌面视口，不得解释为"已展开"或"需点击"。

### 3.1 V-02 Markdown 标题与目录单一来源

**判定基线**：探针 markdown（`probe.md`）内容为——两个 `## 设计方案`（中间一段文字）、一个围栏块内含 `## 示例`、一个 Setext 标题（`Setext 标题` 下一行 `===`）。现造 entry 经 debug HTTP API 写入（禁 CLI）。实测锚点：正文两个 `<h2 id="设计方案">` **ID 完全相同**；TOC 侧 href 为 `#设计方案` 与 `#设计方案-1`（TOC 侧去重正常，缺陷在正文侧不去重）；围栏内 `## 示例` **误入 TOC**；Setext h1 正文 `id` 为空串且 TOC 无此项。

#### BDD-01: 正确性：重复同名标题在正文侧获得互不相同的锚点 ID
- Given 一个 markdown 文件含三个同名二级标题 `## 中文标题`（三次重名场景已覆盖两次重名场景，原 BDD-06 合并入本条）；**桌面视口 1280×800**
- When 打开该 entry 的详情页；**确保 TOC 处于展开态（幂等表述见 §3 开头）**
- Then 正文中 `h2` 元素恰好 3 个，三者 `id` 均非空且**两两不同**（`id` 集合大小 == 3）；TOC 中 3 条 `a[href^="#"]` 的 href 目标各自在正文中 `getElementById` 命中**恰好 1 个**元素

#### BDD-02: 正确性：代码围栏内的标题不进入目录（正反双向）
- Given markdown 含一个围栏代码块（块内含 `## 示例`），且围栏外另有 `## 真实标题` 作为对照；**桌面视口 1280×800**
- When 打开详情页；**确保 TOC 处于展开态**
- Then ① TOC 内**不存在**文本含「示例」的条目；② TOC 内**存在**文本含「真实标题」的条目（第二断言排除「TOC 整体为空」也能通过的假绿）
- 说明：原 BDD-02 的第二断言「TOC 条目数 == 正文 h1–h4 总数」属层级覆盖，由 BDD-03/BDD-04 独立覆盖，且 Setext h1 未入 TOC 时会与「围栏排除」无关地变红 → 已删除（W4）

#### BDD-03: 正确性：Setext 标题在正文与目录两侧都生成锚点
- Given markdown 含 Setext 一级标题（`Setext 标题` + 下一行 `===`）；**桌面视口 1280×800**
- When 打开详情页；**确保 TOC 处于展开态**
- Then 正文存在 `h1` 元素其 `id` **非空**，且 TOC 中存在一条 `a[href="#<该 id>"]`，其目标 `getElementById` 命中该 `h1`

> 该 BDD 是决策 B 的判据：仅改 TOC 侧不改正文侧（现 `useMarkdown.ts:332` 的 `level >= 2 && level <= 4` 过滤）时，`id` 为空串（实测）→ FAIL。

#### BDD-04: 正确性：目录层级覆盖 h1–h4 且排除 h5
- Given markdown 依次含 h1、h2、h3、h4、h5 标题各一个；**桌面视口 1280×800**
- When 打开详情页；**确保 TOC 处于展开态**
- Then TOC 条目数 **== 4**，且 4 条的层级（`toc-level-{N}` 的 N，或 href 目标元素的 tagName 数字）分别为 1/2/3/4，h5 文本**不出现**在 TOC 中

#### BDD-05: 正确性：标题含内联强调与链接时，TOC 条目可见文本已剥离标记且与正文一致
- Given 一个 markdown 文件（`path` 与 `filename` **同时**给 `README.md`，否则 `language=null` → 正文退化为 CodeViewer、`.toc-list` 为空），正文含标题 `## **粗体**与[链接](other.md)`
- When 打开该 entry 的详情页（**桌面视口 1280×800**）；**确保 TOC 处于展开态（幂等表述见 §3 开头）**，然后读取 `.toc-list a` 中对应条目的**可见文本**与 `.markdown-body` 中对应 `<h2>` 的 `textContent` / `id`
- Then ① 该 `<h2>` 的 `id` 与 TOC 条目的 `href`（去掉 `#`）**字符串相等**、非空且不含空格；② TOC 条目的**可见文本** `textContent` **不含** `**`、`[`、`](`、`)` 等 markdown 标记字符，且去空白后与正文该 `<h2>` 的 `textContent` 逐字相等

> **取证通道（B-NEW-1，判据不留到 P2）**：本条**必须在 Playwright 层的真实 DOM 上验**，不得在 vitest 层消费 `useMarkdown.render()` 的 `html`——`useMarkdown.ts:480` 是该渲染函数的**唯一 return 点**，返回 `html: ''`（**常量空串，永远为空**）；真实 HTML 全在 `blocks[]`（`:414` `blocks.push({ type: 'html', html: segment })`）。故 `render().html` 不可作为取证通道（照字面取会得 `html === ''`，退化成"断言空串"而**静默失去区分力**）。
>
> 实测反假 PASS 依据（按上述 When 字面执行，2026-11-24 现造 entry 实测）：正文 `<h2 id="粗体与链接othermd">粗体与链接</h2>`、TOC `<a href="#粗体与链接othermd">**粗体**与[链接](other.md)</a>`——**两侧 id 已相等**（故旧的"id 相等"单断言现状即通过），真缺陷在 TOC **可见文本原样输出 markdown 标记**，故断言 ② 是区分力所在（现状 **FAIL**）。

#### BDD-06: 回归兼容：点击目录条目后目标标题进入视口
- Given 详情页 TOC 已处于展开态，页面含 ≥ 2 个可跳转条目；**桌面视口 1280×800**
- When 点击 TOC 中第 2 条
- Then **2 秒内**该条目标元素的 `getBoundingClientRect().top` 落在 `[0, 200]` 区间（容纳 `scroll-margin-top: 80px` 与标题高度）；超时仍未落入区间判 FAIL

> 现状已满足（`TocNav.vue` 的 `scrollIntoView({behavior:'smooth'})` + `markdown.css:3` 的 `scroll-margin-top: 80px`）→ 属 **V-02 改造后仍须成立**的回归守护（W6）。

#### BDD-07: 正确性：目录数据源单点，不存在第二套逐行正则扫描
- Given 仓库源码
- When 检查目录数据来源
- Then `useEntryDetailComputed.ts` 中**不再存在**「`split('\n')` 后对每行套 `/^(#{1,6})\s+/` 正则」的独立标题扫描（代码级断言：该正则模式在上述文件中的命中数 == 0，且存在从 render 返回值到 TOC 的单一数据通路）

### 3.2 V-01 默认入口 resolver

**判定基线**：seed 数据**不能**覆盖全部条件（E-6）——根目录有 `README.md` 的只剩 `k8s-deployment`/`product-screenshots`/`unicode-filenames`，且它们恰好 README 字典序最小（`R`=82 < 小写字母），故用它们只能得假 PASS。→ 默认入口判据**一律用现造 entry**（BDD-08~12 全部现造，无例外；走 debug `:8888` HTTP API，`files[].path` 支持子目录）。**素材选择通则**：凡依赖「排序首个」的判据，构造素材必须使「排序首个 ≠ 期望值」，且排序首个必须是**非 README/index** 的普通文件名——`aaa.txt` 这类以 `a`(97) 起头的小写名**排不到** `README.md`(`R`=82) 之前，会与「README 优先」结果重合；须改用大写起头名（实测 `sorted(['AAA.txt','README.md']) == ['AAA.txt','README.md']`，`A`=65 < `R`=82）。

#### BDD-08: 正确性：根目录 README.md 优先于排序更靠前的其他文件
- Given 现造一个多文件 entry，`files` 为 `[AAA.txt, README.md]`（实测按路径字典升序 `AAA.txt` 在前：`A`=65 < `R`=82）
- When 匿名打开 `/{slug}`
- Then 详情页当前展示文件为 `README.md`（活跃文件名 == `README.md`，**不是**排序首个的 `AAA.txt`）

> 原 Given 用 `aaa.txt` 属假 PASS（`sorted(['aaa.txt','README.md']) == ['README.md','aaa.txt']`，README 本就是排序首个，"优先"与"回落"不可区分）→ 已换素材（B3）。

#### BDD-09: 正确性：无 README 时根目录 index.md 优先
- Given 现造 entry，`files` 为 `[aaa.md, index.md]`（实测排序首个为 `aaa.md`）
- When 匿名打开 `/{slug}`
- Then 当前展示文件为 `index.md`

#### BDD-10: 正确性：README 与 index 均无时回落到稳定排序后的第一个文件
- Given 现造 entry，`files` 为 `[bbb.txt, aaa.txt]`（**构造顺序** bbb 在前）
- When 匿名打开 `/{slug}`
- Then 当前展示文件为 `aaa.txt`（排序后首个，**非**构造首个 `bbb.txt`）

#### BDD-11: 正确性：只匹配根目录，子目录的 README.md 不被选中
- Given 现造 entry，`files` 为 `[sub/README.md（path=sub）, aaa.md]`
- When 匿名打开 `/{slug}`
- Then 当前展示文件为 `aaa.md`，**不是** `sub/README.md`

#### BDD-12: 正确性：默认入口文件名匹配大小写不敏感
- Given 现造 entry，**构造顺序**为 `[AAA.txt, readme.md（全小写）]`
- When 匿名打开 `/{slug}`
- Then 当前展示文件为 `readme.md`

> 原 Given 构造序为 `[readme.md, AAA.txt]`，而现状兜底正是 `entry.files[0]` = `readme.md` → 期望值恰等于现状值，假 PASS（B3）。改为 `AAA.txt` 构造在前，现状兜底得 `AAA.txt`、改后得 `readme.md`，有区分力。

#### BDD-13: 正确性：后端文件列表顺序具有确定性契约（构造序 ≠ 字典序）
- Given 现造一个当前时刻创建的 entry，`files` 按**构造顺序**为 `[zzz.txt, aaa.txt, mmm.txt]`（与字典序 `[aaa.txt, mmm.txt, zzz.txt]` 不同；实测现状返回构序 `[zzz.txt, aaa.txt, mmm.txt]`）
- When 连续两次请求 `GET /api/v1/entries/{slug}`
- Then 两次响应的 `files` 数组顺序**逐元素相同**，且等于按「`path` 非空取 `path`、否则取 `filename`」字典升序、同键按 `id` 升序排序的结果（即 `[aaa.txt, mmm.txt, zzz.txt]`）

> 原 Given 用 seed 的 `multi-format-demo`，其返回顺序恰好等于字典序 → 三断言现状全满足，假 PASS（B3）。改现造 entry 且构造序 ≠ 字典序后，现状 FAIL。

### 3.3 `?file=` 深链与 URL 状态一致性

**判定基线**：`k8s-deployment`（3 文件，顺序 `README.md`(id 13) / `deployment.yaml`(14) / `service.yaml`(15)）——`deployment.yaml` 为非默认文件。`fileId` 一律**动态解析**（勿硬编码，先例 `tpv0099-fullscreen-link-auth.spec.ts:65`）。
**成对对照通则（适用于 BDD-16/17/18）**：现状 `?file=` **完全不被读取**（`EntryDetailView.vue:234` 只读 `firstNameId` 的前身 `firstFileId`），因此任何"无效 id → 回退默认入口"的断言在现状下都**碰巧成立**。故这三条一律在**同一测试内**先断言「有效 id **确实**切换」（前置校验，不成立即整条 FAIL），再断言「无效 id **不**切换」，用对照关系证明"回退逻辑存在"而非"参数从未被读"。

#### BDD-14: 交互行为：`?file=` 打开指定文件且该参数在加载后仍保留在 URL
- Given `/{slug}?file=<deployment.yaml 的 id>`
- When 匿名打开并等待加载完成
- Then 当前展示文件为 `deployment.yaml`，且 `window.location.search` **仍包含** `file=<该 id>`

#### BDD-15: 交互行为：`/f?file=` 同时进入全屏并打开指定文件
- Given `/{slug}/f?file=<service.yaml 的 id>`
- When 匿名打开
- Then 全屏态生效（`.entry-detail` 的 class 含 `zen-mode`）**且**展示文件为 `service.yaml`（正文含 `kind: Service`），URL 的 `file` 参数仍在

#### BDD-16: 交互行为：不存在的 file id 安全回退默认入口（成对对照）
- Given `k8s-deployment`（默认入口 `README.md`，非默认文件 `deployment.yaml`），同一测试内依次访问两个 URL
- When ① 访问 `/{slug}?file=<deployment.yaml 的 id>`（有效）② 访问 `/{slug}?file=999999`（不存在）
- Then ① **前置校验**：有效 id 时当前展示文件 == `deployment.yaml`（此步不成立即整条 FAIL——证明 `file` 参数确被读取）；② 无效 id 时展示文件为默认入口 `README.md`，页面**无**错误横幅、不白屏；③ ①与②的活跃文件**不同**

#### BDD-17: 安全边界：其他 entry 的 file id 被拒绝并回退，不跨 entry 读取（成对对照）
- Given 现造 entry A（默认入口 `README.md`，另含非默认文件）与 entry B（其某文件含独有字符串 Z）
- When 同一测试内 ① 访问 `A?file=<A 自己的非默认文件 id>`（有效）② 访问 `A?file=<B 的该文件 id>`（跨 entry）
- Then ① **前置校验**：有效 id 时 A 的内活跃文件 == 该非默认文件；② 跨 entry id 时活跃文件 == A 的默认入口 `README.md`，且正文**不含** Z，页面无错误横幅

#### BDD-18: 交互行为：非数字 file 参数安全回退默认入口（成对对照）
- Given `k8s-deployment`，同一测试内依次访问
- When ① 访问 `/{slug}?file=<deployment.yaml 的 id>`（有效数字）② 访问 `/{slug}?file=abc`（非数字）
- Then ① **前置校验**：有效 id 时展示 `deployment.yaml`；② 非数字时展示默认入口 `README.md`，页面无错误横幅

#### BDD-19: 交互行为：页内切换文件后 URL 同步更新且不新增历史记录
- Given 详情页已加载（当前为默认文件），且文件树可见
- When 记录 `history.length`，然后在文件树中点击 `deployment.yaml`
- Then ① 切换完成后 `window.location.search` 含 `file=<deployment.yaml 的 id>` ② 当前展示文件为该文件 ③ `history.length` **不增加**（URL 更新走 replace 语义）
- 说明：原 BDD-24（独立断言"不新增历史"）现状即通过——页内切换完全不改 URL，`history.length` 天然不增 → 已作为第二断言并入本条（B5），由 ① 提供区分力。

#### BDD-20: 交互行为：切回默认文件后 `file` 参数被移除
- Given 当前已通过 `?file=<非默认 id>` 打开非默认文件
- When 在文件树中点击默认入口文件
- Then 切换完成后 `window.location.search` **不含** `file=`

#### BDD-21: 交互行为：刷新后仍打开 URL 指定的文件
- Given 已通过 `?file=<deployment.yaml 的 id>` 打开该文件
- When 执行页面 reload
- Then 加载完成后仍展示 `deployment.yaml`（不回落默认文件），且 URL 的 `file` 参数仍在

#### BDD-22: 交互行为：`file` 与 `share` 共存时各自生效，清理不误删
- Given 一个私有 entry 的有效 share token S 与非默认 file id F，URL `/{slug}?share=S&file=F`
- When 打开该 URL
- Then ① 分享凭证生效（不出现 share 失效错误、能读到内容）② 展示文件为 F ③ 加载完成后 URL 仍同时含 `share` 与 `file` 两个参数（没有任何一个被清理逻辑抹掉）

### 3.4 全屏阅读入口

#### BDD-23: 布局结构：桌面普通态存在可发现的「全屏阅读」入口且不依赖展开文件树
- Given 桌面视口（1280×800）匿名打开 `/{slug}`，文件树处于**收起**状态，**且当前正文不含图表块**（无 Mermaid/DiagramBlock，排除 `DiagramBlock.vue:177` 的图表级全屏按钮干扰）
- When 检查页面可交互元素
- Then 存在**恰好 1 个**可点击元素，其 `aria-label` 或可见文本（**不含 `title` 属性**——`title` 仅作 a11y 名称 fallback，按它判会命中图表按钮造成假 PASS）包含「全屏」或 `fullscreen`（大小写不敏感）；该元素 `offsetParent` 非 null、`getBoundingClientRect()` 与视口有交集，且位于页面 header 的工具区内（`.actions-area`）

#### BDD-24: 布局结构：移动端入口在底部操作栏内且不遮挡正文
- Given 移动视口（390×844）匿名打开 `/{slug}`（正文同样不含图表块）
- When 检查底部操作栏与正文区
- Then ① 全屏入口元素的可点击热区完全落在底部操作栏矩形内；② 底部操作栏的 `getBoundingClientRect().height` **≤ 64px**（既有 `--mobile-bar-height` 值，不因新增入口增高；实测现状恰 64px）；③ 正文滚动到底部时，正文最后一个块元素的 `rect.bottom` **≤** 操作栏 `rect.top`（不重叠）

#### BDD-25: 交互行为：当前为默认文件时点击全屏入口进入 `/{slug}/f`（不带 file 参数）
- Given 桌面普通态，当前展示文件为默认入口文件
- When 点击全屏入口
- Then 导航后 `window.location.pathname` == `/{slug}/f`，且 `window.location.search` **不含** `file=`

#### BDD-26: 交互行为：当前为非默认文件时点击全屏入口进入 `/{slug}/f?file=<当前 id>`
- Given 桌面普通态，当前展示文件为 `deployment.yaml`（非默认）
- When 点击全屏入口
- Then 导航后 pathname == `/{slug}/f` 且 search 含 `file=<deployment.yaml 的 id>`，全屏态展示该文件

#### BDD-27: 交互行为：手动追加 `/f` 直接进入全屏并展示默认文件
- Given 浏览器直接访问 `/{slug}/f`（不经过任何界面操作）
- When 加载完成
- Then 全屏态生效（`.entry-detail` class 含 `zen-mode`）且展示文件为默认入口文件

> 现状已满足（实测 `/k8s-deployment/f` 的 class 含 `zen-mode`、默认文件 `README.md`；P0 验收基线第 19 条本就是回归项）→ 回归守护（W6'）。

#### BDD-28: 布局结构：全屏态不展示文件树（新增需求）
- Given 多文件 entry（3 文件）的 `/{slug}/f`
- When 加载完成并等待 ≥ 2s（避开 `EntryDetailView.vue:244/:273` 的异步自动展开）
- Then `document.querySelectorAll('.file-sidebar').length === 0`（**DOM 中不存在**，非仅 `display:none`），且页面**无**文件选择器/下拉选择文件控件

> **区分力来源**：现状是「DOM **存在** 1 个 + 全局 `styles/layout.css:650-657` 把它 `display:none`」——若断言写成"可视计数 0"则现状即通过（假 PASS）。故本条的判据是**DOM 不存在**，现状 FAIL。
> **两处隐藏集并列引用（B1 更正）**：`/f` 下的 chrome 隐藏由**两处**共同决定，二者隐藏集不同，缺一即误判——① **全局** `frontend-v3/src/styles/layout.css:650-657`（`main.ts:8` 引入）：`.detail-header` / `.file-sidebar` / `.toc-sidebar` / `.mobile-actions` / `.mobile-sticky-header` / `.mobile-bottom-bar`；② **scoped** `frontend-v3/src/views/EntryDetailView.vue:281-284`：`.detail-header` / `.mobile-sticky-header` / `.mobile-bottom-bar` / `.meta-tags-bar`。**`.file-sidebar` 与 `.toc-sidebar` 只由全局那处隐藏**，scoped 规则不含它们（P1 第 1 轮仅查 scoped 规则而误判"zen 不隐藏文件树"，本次更正）。

#### BDD-29: 交互行为：全屏态不引入退出入口，`f`/`Escape` 不改变视图（约束型）
- Given `/{slug}/f` 已加载
- When ① 检查页面可交互元素 ② 连续按 `f`、按 `Escape`
- Then ① 不存在任何可点击元素的名称（`aria-label`/可见文本/`title`）匹配「退出」「返回」「关闭全屏」「exit」「close fullscreen」（大小写不敏感）② 按键后 `.entry-detail` 的 class 仍含 `zen-mode`，且 `window.location.pathname` 不变

> 决策 A + `DESIGN.md:210-212`：`/f` 是只读分享态（`useZenMode.ts:19` 在 `locked()` 时首行 return，`f`/`Escape` 全部失效）。该条同时守护「不得顺手加退出按钮」。

#### BDD-30: 回归兼容：普通态按 `f` 仅切换纯前端 zen，不改 URL（P0 已知风险收敛）
- Given 普通态详情页 `/{slug}`（**非** `/f` 路由），`.entry-detail` 的 class **不含** `zen-mode`
- When 按一次 `f` 键
- Then `.entry-detail` 的 class **含** `zen-mode`，且 `window.location.pathname` 仍为 `/{slug}`（**不追加** `/f`）、`window.location.search` 不变
- 说明：P0「已知风险」列的「全屏 `f` 键的 URL 同步（按键是否也跳转路由）」在此收敛——**普通态 `f` 保持纯前端 zen 切换、不改 URL**（`DESIGN.md:210-212` 只规定 locked 态行为，未要求按键跳路由；且改 URL 会让"按一下 `f` 就产生可分享链接"变成隐式契约）。本条为**回归守护**，若 P4 擅自把 `f` 改成跳路由则本条变红。

#### BDD-31: 布局结构：文件树内每个文件条目不存在独立的全屏按钮（1612 §2.1 第 3 条）
- Given 多文件 entry 的普通详情页（桌面视口），文件树已展开；**正文不含图表块**（无 mermaid/plantuml/d3 等 rich-render 块，避免图表自带的 `title="Fullscreen"` 按钮被计入下条断言）
- When 检查文件树每个叶子条目内的可点击元素，以及全页面级全屏入口的计数
- Then ① 每个文件条目内可点击元素的可访问名称（`aria-label` 或可见文本，**不含 `title`**）**均不**匹配 `fullscreen|全屏`；② **全页面**中名称匹配 `fullscreen|全屏` 的可点击元素总数 **== 1**（只有页面级那一个；名称口径与 ① 及 BDD-23/24 统一，**同样不含 `title` 属性**，即只取 `aria-label` 与可见文本）
- 说明：断言 ② 提供区分力（现状页面级入口为 0 → FAIL），断言 ① 是 1612 明文禁止项的长期守护。`DiagramBlock.vue:177` 的 `<button ... title="Fullscreen">⧉</button>` 带 `title` 但不带 `aria-label`、可见文本仅 `⧉` → 按上述口径不计入；若正文含图表块则会命中 → 计数 2 → 假 FAIL，故 Given 已钉「正文不含图表块」。

### 3.5 V-04 截断态表头控件

**判定基线**：`TableView.vue:127` 的 `maxRows` 默认 **50000**，全仓无任何 view 覆盖，seed 最大 CSV 仅 61 行 → 判据须在单测层传小 `maxRows`（先例 `TableView.spec.ts:184` 传 `maxRows: 5`）。源码事实：`.th-sort-btn`（`:23-31`）与 `.th-filter`（`:32-37`）**无 `v-if`，始终渲染**；截断分支遍历 `parsed.rows`（原始数据），正常分支才用 TanStack 的行模型。

#### BDD-32: 视觉呈现：数据超 maxRows 时表头不渲染排序按钮与过滤输入框
- Given 挂载 TableView，`maxRows: 5`，CSV 含 10 数据行
- When 渲染完成
- Then 表头区域内**不存在**排序按钮（可切换排序的可点击表头控件计数 == 0）与**不存在**过滤输入框（`input` 计数 == 0）

#### BDD-33: 回归兼容：数据未超限时排序与过滤控件存在且生效
- Given 挂载 TableView，`maxRows: 50`，CSV 含 10 数据行
- When 点击首列表头排序一次，再在首列过滤框输入一个只匹配部分行的子串
- Then ① 排序后表格首行数据与排序前不同且顺序符合升降序语义 ② 过滤后表体行数**小于**过滤前行数且 ≥ 1 ③ 表头控件均存在

> 现状即满足（未超限时控件已存在且生效）→ 回归守护（W5），守护「修 V-04 时不得把未截断态的控件一并干掉」。

#### BDD-34: 视觉呈现：截断提示可见且行数为实际总行数
- Given CSV 含 10 数据行，`maxRows: 5`
- When 渲染完成
- Then 截断提示元素存在，其文本含数字 `5`（已显示行数）与数字 `11`（`totalRows` = 表头 + 10 数据行）

> 现状文案只有 `maxRows`（`TableView.vue:5`：`` `数据量过大，已显示前 ${props.maxRows.toLocaleString()} 行` ``），**无 totalRows** → 现状 FAIL，且属**用户可见文案变更**（已同步登记到 §5 的 P8 理由，W7）。

### 3.6 V-03 CSV 解析成本

#### BDD-35: 资源边界：解析达到行数上限后不再构造数据行数组
- Given 一个含 1000 数据行的 CSV 文本与 `maxRows = 5`
- When 以**本次改动新增暴露的「实际构造的数据行数」观测面**读取该量（见下方「观测面定义」，**不得**用 `rows.length`）
- Then ① 该观测值上界 **≤ maxRows（== 5）**；② 正反双向：用 3 行数据的输入（`maxRows = 5`，未达上限）跑同一观测面，该值 **== 3**（排除"恒返回 0"也通过）

> **观测面定义（B-NEW-2，必须满足全部三条，否则本条无区分力）**：
> 1. **不得**以返回结果中的 `rows.length`（或任何等价于「返回了多少行」的量）作为观测面——现状 `useCsvParser.ts:12` 的 `rows = dataRows.slice(0, maxRows)` **天然保证** `rows.length ≤ maxRows`（实测 1000 数据行 + `maxRows=5` → `rows.length = 5`），用它判会得**假 PASS**。
> 2. 观测面必须能区分「**构造 1000 行再截 5 行**」与「**只构造 5 行**」这两种实现。可用形态（P2 选一，本条不指定函数签名）：解析器**新增暴露**的构造行数（返回值新增字段 / 公开的解析统计 / 可注入的计数回调）。该观测面在**改动前不存在**——实测现状返回值仅 `headers,rows,totalRows,truncated` 四个字段，`constructedRows`/`parsedRows`/`parsedCount`/`stats` 类字段实测均为 `undefined`。
> 3. 取证时**不得**通过"对 `parseRows` 打 spy 数 push 次数"以外的间接手段推断；若选用 spy 方式，须同时给出 ② 的正向对照。判据**不引入计时断言**（P0 原文「可用性能断言或 spy 验证」中的计时部分不可二值判定）。
>
> 判据不指定函数签名（原写法指定 `parseRows(content, delimiter, maxRows)` 属掺入实现，W13）；具体承载形态留给 P2。本条的区分力来源：观测面①在现状**不存在**（无法读数 → FAIL），②可排除造假通过。
>
> **与 BDD-36 的耦合（自检发现）**：按上述观测面自检时，一个"到上限就不再 push 行数组"的朴素实现会把数据行数一并砍掉，导致 `totalRows` 从 1001 掉到 6 → **BDD-36 变红**。这不是判据冲突，而是两条的联合约束：**必须在不构造多余行数组的前提下仍精确统计总行数**（计数与构造解耦）。P4 若只满足 BDD-35 而踩坏 BDD-36，按 BDD-36 判 FAIL。

#### BDD-36: 回归兼容：截断时 totalRows 仍为精确总行数
- Given 同 BDD-35 的输入（1000 数据行 + 1 表头行，`maxRows = 5`）
- When 以任意可观测方式读取解析结果
- Then `totalRows === 1001` 且 `truncated === true` 且返回的数据行数 == 5

> 现状即满足（`rows = dataRows.slice(0, maxRows)` 已保证长度）→ 本质是「截断后计数仍精确」的回归守护，**不是新增能力**；新行为判据（构造数组长度上界）全部压在 BDD-35（B6）。

#### BDD-37: 回归兼容：超限且引号未闭合时仍抛出解析错误
- Given CSV 文本含未闭合引号且数据行数远大于 `maxRows`（如 `'a,b\n"unclosed'` 前置 1000 行合法数据）
- When 以 `maxRows = 5` 解析该文本
- Then **仍然抛出**解析错误（与既有契约 `useCsvParser.spec.ts:68` 的 `expect(() => parseCsv('a,b\n"unclosed', ',')).toThrow()` 一致），不得因提前终止而静默吞掉该错误

> 新证据：`useCsvParser.ts:57-59` 是扫完全文才判 `inQuotes`；若 P4 图省事直接 `break` 出状态机，该契约会被静默破坏。

### 3.7 V-06/V-07 注入预算与显式反馈

**判定基线**：`backend/tests/` 全仓 grep `MAX_INJECT|parse_inject_ids|budget` **零命中** → 纯新增覆盖，无既有契约要迁就。插入点唯一：`api/files.py:330-343`（`parse_inject_ids(inject, file_id)` → `get_files_by_ids` → `inject_resources`）。**预算数值由 P2 依实测冻结**；以下判据一律**不依赖具体数值**，只依赖**可代码级断言的关系**。

**B8 需求层结论（二选一已定：选「使超限分支可达」）**：
- 事实：`_MAX_INJECT_IDS = 50`（`html_render_service.py:17`）**恰等于** `max_entry_files = 50`（`config.py:46`，`GET /api/v1/config/limits` 实测 = 50），而主 HTML 文件自身占 1 个名额 → 真实配置下一个 entry 最多只有 **49** 个 sibling，`if len(result) >= _MAX_INJECT_IDS: break`（`:72`）**永不触发**。
- **决定（需求层，不留 P2）**：**调整注入数量上限，使其严格小于 `max_entry_files − 1`**，从而「超限」在真实配置下可达、可被真实 HTTP 请求触发验证。现状 `50 < 50 − 1` 不成立 → 该关系本身即断言（现状 FAIL）。
- 理由（为何不选另一支）：若承认不可达并把 V-07 降为纯构造性单测，则「超限必须显式告知」这条**用户可观测需求整条失去可验形态**——P6 只能用 mock 证明一个用户永远不会遇到的路径，而 1553/1612 与 P0 决策 4 的核心诉求是"用户看到渲染成功但资源不全的假象"必须被消除。选可达后，一旦未来 `max_entry_files` 被调小，该保护**立即生效**而非继续休眠。
- 具体数值（上限取多少、超限按「跳过并在响应中给出清单」还是「HTTP ≥400 报错」）仍由 **P2 依实测冻结**；P1 只锁定上述**关系**与**反馈形态**（BDD-38/40）。

#### BDD-38: 资源边界：超过数量上限的文件进入「被跳过清单」而非静默丢弃（构造路径可达）
- Given 一个 HTML entry：主 HTML 文件 + **N 个 sibling**，且 **N = 注入数量上限 + 1**（即 N > 上限，必然有 1 个及以上被跳过）。造件路径（**明确**）：测试内 `app = create_app(config=PeekConfig(limits=PeekLimits(max_entry_files=N + 1)))` —— 因 entry 总文件数 = 1(主) + N = N+1，恰好等于覆写后的限额（`main.py:152` 的 `create_app` 接受 `config` 参数，实测 `PeekLimits(max_entry_files=...)` 可覆盖成功；用默认 50 时 `POST` 51 文件会被 `entry_service.py:1230` 以 413 `Too many files` 拒绝，故**必须**覆写）
- When 请求 render 路由，`?inject=` 携带全部 N 个 sibling id
- Then ① 响应中存在**可机器解析**的「被跳过文件」清单（结构化字段/JSON/可解析的响应头或注释块，脚本可读出文件名列表）② 清单**非空**，且清单条目数 == N − 响应中实际内联的 sibling 数 ③ 清单中每一项可对应到具体文件名 ④ **仓库默认配置下的代码级关系断言**（独立于上面的覆写，读源码常量而非测试配置）：`_MAX_INJECT_IDS`（`html_render_service.py:17`）< `PeekLimits.max_entry_files` 默认值（`config.py:46`）− 1；现状 `50 < 49` 不成立 → FAIL（该关系不成立时，真实配置下 `if len(result) >= _MAX_INJECT_IDS: break` 永不触发、①~③ 在真实请求中也无法被触发）

#### BDD-39: 资源边界：新增「单文件文本注入上限」，超限的文本 sibling 被跳过并记录
- Given 一个 HTML entry，其中某个 sibling **文本**文件的真实字节数超过**本任务新增的单文件文本注入上限**（该上限是**新增需求**：现有代码对**文本** sibling 没有任何大小检查——`html_render_service.py:18` 的 `_BINARY_SIZE_LIMIT` 在该文件内从未被读取，`inject_resources()`（`:177`）对 `text_siblings` 不做大小判断。**[BASELINE_CHANGE: P2 第 2 轮实测更正]** `api/files.py:272` 的 `file_record.size > _BINARY_SIZE_LIMIT` **不是** serving 路径——它在 `_build_sibling_data` 体内、唯一调用方为 `render_html_file`，即**注入路径上的二进制** sibling 检查；它管的是「二进制」，与本条要新增的「**文本**上限」仍是两件事，故本条结论不变）
- When 请求 render 路由携带该 id（与一个未超限的文本 sibling 的 id）
- Then 该超限文件的文本内容**不出现**在响应中（未内联），且其文件名出现在跳过清单中；**对照**：同 entry 内未超限的那个文本 sibling **仍被正常内联**（正反双向）

> 该上限是**新增需求**，不是"把现有上限纳入统一预算"。常量命名与数值由 P2 定（可新增独立常量，也可复用既有值，但必须显式选择并记录理由）。

#### BDD-40: 资源边界：sibling 累计大小超总预算时必须有可机器解析的反馈（合取断言，不分路线）
- Given 多个 sibling 使累计注入字节超过总预算
- When 请求 render 路由
- Then **同时成立**（P6 无需知道 P2 选了哪条路线）：① 响应中存在**可机器解析的跳过清单**（结构化字段/JSON）**或**（HTTP 状态 ≥ 400 且 `error.message` 非空）；② **不存在**「响应成功（2xx）但静默缺少某请求的 sibling 且无任何记录」的情形——即：请求的 sibling 集合中**未被内联的每一个**，都必须在 ① 的清单或错误体中可查；③ 响应中不出现被截断的、语义不完整的资源内容（半截 CSS/JS/文本）

> 原写法是双分支判据（"若 P2 选超限报错则断言错误响应"），P6 只读 BDD 无法判定 → 已收口为可同时成立的合取断言（B11）。预算数值仍留 P2。

#### BDD-41: 回归兼容：未超任何预算时注入行为与现状等价
- Given 一个 HTML + 一个 CSS sibling + 一个 JS sibling（均远小于任何上限）
- When 请求 render 路由
- Then 响应中 CSS 被内联为 `<style>`、JS 被内联为 `<script>`（既有行为），且跳过清单为空或不存在；既有 `test_html_render.py` 注入类用例全绿

### 3.8 V-08 真实字节数判断

#### BDD-42: 正确性：大 HTML 按后端真实 `file.size`（字节）判定，而非 JS 字符数（中文素材 + 真实 size，原 BDD-42 与 BDD-43 已合并）
- Given 一个**中文为主体**的 HTML 文件，同时满足：经 `GET /api/v1/entries/{slug}` 的 `files[].size` 核实**真实字节数 ≥ 2MB**，**且** `content.length`（JS 字符数）**< 2MB**（中文 UTF-8 下字节 ≈ 3×字符，两者可同时成立；**造件已实测**：正文重复 `中文测试内容` 至 `chars=700084 / bytes=2100088`，经 debug `POST /api/v1/entries` 201 成功且响应 `size=2100088`）
- When 匿名打开该 entry 并在文件树选中该 HTML 文件（**不注入** `HTML_VIEWER_TEST_SIZE_KEY`，走真实 `file.size`）
- Then 页面显示手动渲染按钮且**不存在** iframe（若仍按 `content.length` 判断则会自动渲染 → FAIL）

> **合并与钉定说明（W2）**：原 BDD-42（"真实字节 ≥2MB"）与原 BDD-43（"中文、字符 <2MB 但字节 ≥2MB"）判据高度重复；且若素材为 ASCII（chars≈bytes），`content.length` 也 ≥2MB，现状**同样**通过 → 无区分力。合并后**钉定** `字节 ≥2MB ∧ content.length <2MB`，本条与既有 `HtmlViewer.spec.ts:338-365` 边界用例的区别**仅在素材类型与取值来源**（中文多字节 + 真实 `file.size` vs ASCII + 注入假值）。

#### BDD-43: 回归兼容：512KB 与 2MB 的左闭右开边界语义不变
- Given 既有边界用例（`HtmlViewer.spec.ts:338-350` 恰好 512KB → 显示警告且仍自动渲染；`:354-365` 恰好 2MB → 不自动渲染且显示手动触发按钮）
- When 运行前端单测
- Then 两条用例均**通过**（`>=` 触发、左闭右开语义不被破坏）；若阈值数值被调整，两条边界断言须同步更新而非只改实现

#### BDD-44: 正确性：TreeView 的截断判断同样改用真实字节数
- Given 一个 JSON（或 YAML）文件，其字符数 < 2MB 但字节数 ≥ 2MB
- When 匿名打开该 entry 并选中该文件（经 API 核实 `size` ≥ 2MB）
- Then 树视图显示截断提示；且对字节数 < 2MB 的同型文件不显示截断提示（正反两向）

### 3.9 V-05 安全边界（只记录策略，不改 CSP）

#### BDD-45: 安全边界：两种 HTML 权限模式与当前默认已被文档化（落点唯一）
- Given 仓库文档，落点**唯一钉定**为 `docs/architecture/html-preview-security-modes.md`（新建）
- When 检索该文件
- Then 该文件同时包含：①「安全预览」与「交互式 Demo」两档的**定义**（各自目标与默认权限）②明确声明**当前默认档**是后者（允许脚本与外部网络）③明确声明「当前仍允许 `connect-src https:` 外传，收紧属独立决策、需同步调整测试契约」——三项要素在该文件内可逐项 grep 计数非零

> 原 Given 写「`docs/architecture/` 或 `DESIGN.md`」，"或"使落点不确定（实测两档定义只在 `docs/notes/issus-20261124-1429.md:553-554` 的报告里，`DESIGN.md` 无、`docs/architecture/` 当前只有 `sqlite-concurrency.md`）→ 已钉定唯一落点（W12）。

#### BDD-46: 安全边界：CSP 契约与沙箱属性不变
- Given `backend/tests/test_html_render.py` 与 render 路由实现
- When 运行该测试文件并读取 render 响应头
- Then `assert "https:" in csp` 的用例**仍存在且通过**；render 响应的 `Content-Security-Policy` 字符串与改动前**逐字符相同**；iframe 的 sandbox 属性仍为 `allow-scripts allow-forms`（**不含** `allow-same-origin`）

### 3.10 回归、迁移与旧链接

#### BDD-47: 回归兼容：卡片与列表的导航不再引用 files[0]（代码级断言）
- Given 仓库源码
- When 检查 `EntryCard.vue` 与 `EntryListRow.vue` 的导航函数
- Then 两文件中 `files[0]` / `files?.[0]` 的命中数 **== 0**，且两者导航目标为 `/{slug}`（不附加任何文件参数）

> 判据必须是**代码级**：E-4 已证明该分支是死代码（列表接口无 `files` 字段、`transformListItem` 硬编码 `files: []`），浏览器点卡片看 URL **现状本来就通过** → 会得假 PASS。

#### BDD-48: 回归兼容：单文件 entry 的详情页行为不变
- Given 单文件 seed entry（`dsh-architecture`，1 文件）
- When 匿名打开
- Then 展示该唯一文件、不渲染文件树/文件下拉、TOC 可展开、URL 不含 `file` 参数

#### BDD-49: 回归兼容：Share 链接的权限行为不变
- Given 一个私有 entry 的有效 share token
- When 用该 token 访问
- Then 能读到内容（不出现 share 失效错误）；**无**该 token 的匿名访问仍返回 404（私有 entry 对非 owner 不泄露存在性）

#### BDD-50: 回归兼容：迁移后的 3 个 e2e spec 与改动前基线**回归等价**且不再依赖 `firstFileId`
- Given `frontend-v3/e2e/viewer.spec.ts`、`t091-mobile-detail-visual-polish.spec.ts`、`tpv0099-fullscreen-link-auth.spec.ts`（三文件 `firstFileId` 字面量共 **9 处**：viewer=2、t091=4、tpv0099=3），以及**改动前实测基线**（debug `:8888`，`E2E_SPEC=` 定向）：`viewer.spec.ts` **18 failed / 20 passed**、`t091` **12 failed / 12 passed**、`tpv0099` **6 passed / 0 failed**；根因实测为 `markdown-test` 的 `meta.json` 写 `team_id: frontend-team` → 被强制 `is_public=false`（`entry_service.py:200`）→ 匿名 `GET` 404，且 `playwright.config.ts` 无 `storageState`（**属 TPV0095 的既有回归，非本任务引入**）
- When 迁移为 `file` 参数后，针对运行中的 debug `:8888` 逐个 spec 运行
- Then ① 三个文件内 `firstFileId` 字面量出现次数 **== 0**；② 每个 spec 的失败集合**不劣于**上述基线（按 case 名逐条对照已落盘的 known-failures 清单，**不得出现基线之外的 new failure**，也不得因改认证/可见性而改变基线——那是范围蔓延）

> **断言 ② 的前提（W-新 6）**：P5 已按本节 Given 的基线数字产出 `known-failures.md`（**逐 case** 列出，而非只写总数）；**缺失该文件时本条判 FAIL 而非 PASS**——"无法对照"不等于"没有 new failure"，不得以默认通过处理。

> 原写法「3 spec 全部通过（0 failed）」**基线不可达**且与 `firstFileId`→`file` 迁移无因果关系（B10）→ 改为回归等价性。基线数字须在 P5 落盘为 `known-failures.md` 条目（逐 case 列出），否则 P5 会把既有红算作本任务引入。

#### BDD-51: 交互行为：旧 `?firstFileId=` 链接安全回退默认入口且不报错
- Given `/{slug}?firstFileId=15`（旧格式收藏链接）
- When 匿名打开
- Then 页面正常渲染并展示默认入口文件（`README.md`），无错误横幅、无白屏；**不**额外做 302/路由重写（该参数被忽略而非被支持）

> 现状有区分力（实测 `?firstFileId=15` 会选中 `service.yaml` 且 URL 旋即被清空），改后为默认入口。

### 3.11 人工体验路径与纯内容定位

#### BDD-52: 人工体验：按文档 seed 后详情页有内容且默认入口为 README
- Given 按项目文档执行 `make debug-quick`（或 `make debug-start` + `make debug-seed`），seed 数据来自 `scripts/seed-data/`；**桌面视口 1280×800**（TOC 条目数断言依赖桌面视口，见 §3 开头 `aria-expanded === null` 分支）
- When 匿名用浏览器打开 `http://127.0.0.1:8888/k8s-deployment`
- Then 页面渲染出 `README.md` 的内容（正文含字符串 `K8s 部署清单`），且**确保 TOC 处于展开态**后条目数 **== 4**（实测该文件含 1 个 h1 + 3 个 h2；**决策 B 生效后 h1 也入目录**，故不是 3）

> 该条不得用 fixture / 单测替代：它验证的是「用户按文档 seed 后，人工体验路径下页面确实有内容」。

#### BDD-53: 视觉呈现：全屏态为纯内容（v-show 类 chrome 回归守护 + 侧栏 DOM 移除）
- Given `/{slug}/f` 已加载（桌面视口，多文件 entry）
- When 测量各 chrome 元素
- Then ① `.detail-header`、`.mobile-sticky-header`、`[data-testid="mobile-bottom-bar"]`（三者走组件内 `v-show="!zenMode"`）与 `.meta-tags-bar`（走 scoped CSS `EntryDetailView.vue:284`）的**可视计数**均为 0——但四者的 DOM 归宿**不同**：前者三项 **DOM 保留（各 1）、仅 `v-show` 样式隐藏**（真属 `v-show` 范式）；`.meta-tags-bar` 则是**实测 DOM 计数 == 0**（**非 `v-show`**，元素根本不进 DOM，由 scoped CSS 规则所在分支的条件渲染决定）。本断言三项 + 一项统一按「**可视计数 == 0**」判定，属**回归守护**，现状即满足 ② 内容区可见且 `rect.width` ≥ 视口宽度的 0.95 ③ `.file-sidebar` 与 `.toc-sidebar` 的 **DOM 计数为 0**（属**新增需求**，与 BDD-28 同源；现状为「DOM 存在 + 全局 `layout.css:650-657` 隐藏」→ FAIL）

> 本条的区分力全部来自 ③；①② 明确标注为回归守护，不冒充新行为（B1 三选一中采用「保留并明确标注」+ 把新增需求落在 ③）。

#### BDD-54: 交互行为：全屏态下正文内的文件链接仍可切换文件且 URL 同步
- Given `unicode-filenames/f`（8 文件；实测 id 31=`README.md`、34=`english-notes.txt`，README 正文含 `[English attachment](images/english-notes.txt)`，该文件以 basename 匹配到 id 34）
- When 在全屏态点击正文中「English attachment」链接
- Then 当前展示文件切换为 `english-notes.txt`（正文含独有字符串 `English attachment placeholder`），且 `window.location.search` 含 `file=34`；**且**全屏态仍生效（`.entry-detail` 的 class 仍含 `zen-mode`）

> 该条承接 1553 §4.3「Markdown 正文中的文件链接仍然可以正常切换文件」与 P0 验收基线第 25 条。`unicode-filenames` 是 seed 中**唯一**正文含跨文件相对路径链接的多文件 entry（其余 seed 的链接指向图片/自身），故 Given 钉定它。

---

## 4. 待确认清单

P0 遗留 4 项，**全部在本阶段收敛**（补充文件已把「全屏按钮是否加」与「Setext 处理」交用户定夺完毕）：

| # | P0 遗留待定 | P1 结论 | 依据 |
|---|---|---|---|
| 1 | 全屏按钮**具体位置** + 移动端不遮挡方案 | **桌面端放 header 工具区（`.actions-area`，与 Copy/Share 同排，`Maximize` 图标 + 可访问名称「全屏阅读」）；移动端放底部操作栏（`mobile-bottom-bar`）** | 见下方 SUGGEST-1 |
| 2 | 旧 `?firstFileId=` 链接**是否加重定向** | **不加重定向**，参数被忽略并安全回退默认入口 | 见下方 SUGGEST-2 |
| 3 | `HtmlViewer.vue` 的 `>= 2MB` 边界是否预期 | **是，左闭右开是既有契约**（`HtmlViewer.spec.ts:338-365` 两条配对的边界用例已固化），写成回归 BDD-43；**不再作为待定项** | 主 Agent 实测既有用例 |
| 4 | 注入预算**数值** | **数值由 P2 依实测冻结**；BDD-38~41 判据一律不依赖具体数值，但**判定形态与可达性已在 P1 收口**（B8 选「调低上限使超限分支可达」+ B11 收口为合取断言） | P0 决策 4 |
| 5 | **P0 已知风险**：全屏 `f` 键的 URL 同步（按键是否也跳转路由） | **普通态 `f` 保持纯前端 zen 切换、不改 URL**（`pathname` 不变、不追加 `/f`）；仅 `/{slug}/f` 路由进入 locked 态。→ BDD-30 锁定该选择 | `DESIGN.md:210-212` 只规定 **locked 态**行为（"`f` / `Escape` change nothing... Leaving requires editing the URL"），从未要求普通态按键跳路由；且让 `f` 改 URL 会把"按一下键"变成隐式产生可分享链接的契约，属行为扩张而非修复 |

- [SUGGEST: 推荐「桌面 `.actions-area` + 移动 `mobile-bottom-bar`」的位置组合，理由：① 1612 的首要位置就是「当前文件阅读区的 Header / 工具栏」，`.actions-area` 已是 Copy/Share/TOC/Source 的同类 `icon-btn`/`toggle-btn` 聚集处，新增一个同类按钮不引入新的视觉层级，符合 `DESIGN.md` §6「不得发明新按钮变体」；② 该区域带 `v-show="!zenMode"`，只在全屏态隐藏——普通态完全可用，正合要求；③ 移动端 `mobile-bottom-bar` 同样是 1612 所说的「可触达入口」，且 `.content-area` 已用 `padding-bottom: calc(var(--mobile-bar-height) + env(safe-area-inset-bottom))` 预留净空，新增按钮只要不增高该栏（flex 同行排布，其 `min-height: var(--mobile-bar-height)` = 64px 已定）就不遮挡正文——故「不遮挡」判据取「栏高 ≤ 64px + 正文末元素底 ≤ 栏顶」（BDD-24），可二值判定；④ 排除「只在文件树里放」与「给每个文件加按钮」是 1612 的明文禁止项，且文件树默认收起]
- [SUGGEST: 推荐「旧 `?firstFileId=` 不加兼容重定向」，理由：① 自动来源（卡片/列表）本就不产生该参数（E-4 实测死代码），剩余仅用户手动收藏的链接；② `firstFileId` 语义是「一次性种子」，把它重定向成 `file` 会让一个**语义不同**的参数长期寄生在新契约上，与 §7.4.1 的机制替换意图冲突，后续维护者极易再犯「机制 vs 改名」的混淆；③ 不加重定向的代价可控——旧链接仍能正常打开页面（只是回到默认入口），不报错不白屏（BDD-51 锁死这点）；④ roadmap #58 已登记该 URL 契约变更「需评估兼容性」，把兼容策略留作该条目的独立决策更清晰]
- [SUGGEST: 推荐「`TreeView` 新增 `size` prop 以走真实字节数」，理由：V-08 的同型缺陷在 `TreeView.vue:75`（同 2MB、同 `content.length` 范式，作用于 JSON/YAML/XML 树视图截断判断），若只改 `HtmlViewer` 则「字节 vs 字符」的错误范式仍在仓库里留着可被复制；且两处共用同一字节数工具函数即可，边际成本极低。`TreeView` 当前 props 不含 `size`，需由 `EntryDetailContent.vue` 透传 `activeFile.size`]

`[NO_NEED_CONFIRM]` —— 无阻塞项。

---

## 5. 裁剪说明

**`phases: [P1, P2, P3, P4, P5, P6, P7, P8]`，`pruned` 为空**（P1..P8 全走，`phases ∪ pruned == phase_universe`）。

| 阶段 | 保留理由 |
|---|---|
| P1 | 不可裁（协议硬约束；本任务跨前后端 + 安全边界 + 54 条 BDD 需独立评审） |
| P2 | **不可裁**（协议硬约束）。V-02 单一来源重构的接线方式、注入预算的四级模型与承载形态（header vs body 注记）都是设计核心，且 `domains` 含 backend + frontend → 按 C8 需 plan-eng-review + plan-design-review |
| P3 | 保留：本任务有大量可单测行为（`parseCsv` 行数上界与 totalRows、`resolveDefaultFile`、headings 一致性、`TableView` 控件条件渲染、`TreeView` 字节判断），且 BDD-35/36/37/43 本身即单测级判据——不走 TDD 红灯会失去它们 |
| P4 | 不可裁 |
| P5 | **不可裁**：后端资源限额（注入预算）与 CSV/HTML 大文件行为须实跑；前端 `make test-frontend` + `make typecheck` 是 CI 门禁 |
| P6 | **不可裁**：54 条 BDD 逐条实跑 + UI 改动（全屏入口、截断态控件、TOC）需 Playwright 实跑 + 截图 + vision 核对；用户可见页面且内容受 seed 影响 → 人工体验路径 BDD-52 必须真跑。**须逐条记录「改动前 PASS/FAIL → 改动后 PASS/FAIL」**，凡改动前也为 PASS 的条目只算回归守护、不得计入新行为 |
| P7 | 保留：改动跨 `frontend-v3/src`（8+ 文件）、`backend/peekview`（2 文件）、`frontend-v3/e2e`（3 spec）、`docs`（1 文档）、`CHANGELOG` → 属多文件跨前后端 |
| P8 | 保留：V-01/V-02/V-04/V-08 均为用户可见改动 → CHANGELOG `[Unreleased]` 必写。**逐项列明用户可见变更**：① 全屏阅读入口新增（桌面 `.actions-area` + 移动底部栏）② TOC 层级扩至 h1–h4（Setext h1 入目录）③ TOC 条目文本剥离 markdown 标记 ④ `?file=` 深链新增 ⑤ 旧 `?firstFileId=` 链接回退默认入口 ⑥ 截断提示**文案新增总行数**（BDD-34：由仅 `maxRows` 变为含 `totalRows`）⑦ 截断态表头控件隐藏；V-05 须在文档中显式说明「当前仍允许外传，收紧属独立决策」，否则会被误读为"已修复安全风险" |

**`ceremony: standard`**（不薄化：`risk_level: medium` + 跨前后端多文件，不满足 thin 的适用条件）。

**`risk_level: medium`**：跨前后端、含 URL 契约与安全边界记录；但**无 schema 变更、无数据迁移、不改 CSP 默认策略**，故不评 high。

**`domains: [frontend, backend]`**（不声明 `security`）：V-05 的产出明确限定为**文档 + 测试**、不改任何 CSP 指令或 sandbox 属性（BDD-46 反向锁死 CSP 逐字符不变）；按 `review-mapping.md`，声明 `security` 会触发 P4 cso 评审，而本任务无安全面改动 → 声明它属误导。**若 P2/P4 发现实际改动了 CSP/沙箱策略，须回补 `domains: security` 并派 cso**（此约束对下游生效）。

**`packages: [peekview, frontend-v3, docs]`**：后端（`peekview` 含 `services/`、`api/`、`tests/`）、前端（`frontend-v3` 含 `src/`、`e2e/`）、文档（`docs/` + `DESIGN.md` + `CHANGELOG.md`）。MCP 包（`packages/mcp-server`）**不在范围内**（见 §6.2/§6.4 不处理判定）。

---

## 6. 同类扫描结论（强制节）

扫描手段：`grep` 工具（ripgrep 语义）跨 `backend/`、`frontend-v3/`、`packages/`、`docs/`、`DESIGN.md` 全仓；命中数为实测值。**机械门禁实测**：本任务**不新增/改名 `agate/scripts/` 下任何脚本或文件** → `agate/scripts/README.md`「新增脚本登记面」的实测要求**不适用**（显式声明，非跳过）。

### 6.1 `extractHeadings` / `slugify` / `headings.push` —— 10 命中 / 6 文件

| 文件:行 | 内容 | 判定 |
|---|---|---|
| `useEntryDetailComputed.ts:51,77,132` | `extractHeadings` 定义 + 唯一消费 + 导出 | **本次处理**：改为消费 render 返回的 `headings`（BDD-07） |
| `useMarkdown.ts:67,337,339` | `slugify` 定义 + 唯一调用 + `headings.push` | **本次处理**：补去重、层级扩到 h1-h4（BDD-01/03/04） |
| `components/__tests__/t031-entry-detail-view.spec.ts:130`、`t067-detail-framework.spec.ts:143` | 测试 mock 里 stub 了 `extractHeadings` | **本次处理（P4 连带）**：`extractHeadings` 若不再导出，两处 mock 须同步调整，否则测试报错 |
| `e2e/teams-page.spec.ts:147` | 注释里的 `_slugify`（fixture 名映射） | **不处理**：同名不同物，与标题锚点无关 |

**结论**：`extractHeadings` **无第二个生产消费方**（移动端 TOC 与桌面 TOC 都走同一个 `tocHeadings` computed，`EntryDetailContent.vue:78-119` 两处 sidebar/drawer 共用），V-02 改动面与 P0 决策 1 一致（收窄），4 处需同步：2 生产 + 2 测试 mock。

### 6.2 `files[0]` 系列 —— 94 命中（生产代码 5 处 + MCP 1 处，其余为测试/文档）

| 文件:行 | 内容 | 判定 |
|---|---|---|
| `stores/entryDetail.ts:51,52` | `entry.files.find(...) ?? entry.files[0]` / `: entry.files[0]` | **本次处理**：接入 `resolveDefaultFile`（BDD-08~12） |
| `components/EntryCard.vue:150` | `props.entry.files?.[0]?.id` → `?firstFileId=` | **本次处理**：删死代码（BDD-47） |
| `components/EntryListRow.vue:153` | 同上 | **本次处理**：删死代码（BDD-47） |
| `packages/mcp-server/src/tools/getEntry.ts:88` | `const f = raw.files[0]` | **不处理**：前置已判定 `raw.files.length === 1`，语义是「取唯一文件」，与默认入口无关；MCP 也不做「默认入口」概念（Agent 读路径按需指定 `file=`） |
| `backend/tests/**`（`test_html_render.py` 14 处、`test_entry_service.py` 2、`test_file_service.py` 2、`test_client.py` 2、`test_fts_content.py` 1、`test_team_migration.py` 1） | fixture 内按构造顺序取第 0 个文件 | **不处理**（但**须观察**）：这些断言依赖「构造顺序 == 返回顺序」，补 `order_by`（BDD-13）后若顺序变化会变红 → P4/P5 必须实跑 `make test-quick` 确认。属 §6.8 的连带面 |
| `frontend-v3/src/**/__tests__/t067-detail-framework.spec.ts:233,248,429` | `mockActiveFile.value = entry.files[0]` | **不处理**：测试里手工设活跃文件，不经 resolver |
| `frontend-v3/e2e/**`（`viewer.spec.ts:16`、`t091:10`、`tpv0102:51,484`） | 注释/说明 | **不处理**：仅注释 |
| 文档 `docs/roadmap/improvement-backlog.md:417-449` | #57/#58 的历史表述 | **不处理**：历史记录不改；P8 可评估把 #58 标为已完成 |

### 6.3 `query: {}` / `router.replace` —— 13 命中 / 6 文件（生产代码 5 处）

| 文件:行 | 内容 | 判定 |
|---|---|---|
| `views/EntryDetailView.vue:238` | `router.replace({ path: route.path, query: {} })` **一锅端** | **本次处理**：改为逐参数清理（BDD-22） |
| `views/SettingsView.vue:92` | `router.replace({ query: { tab } })` | **不处理**：Vue Router 的 `replace({query})` **合并**而非替换其余参数，且该页只操作 `tab`，不构成一锅端 |
| `views/StarManageView.vue:228` | `router.replace({ query: { filter: key } })` | **不处理**：同上 |
| `views/LandingView.vue:229,234` | `router.replace('/explore')` | **不处理**：无 query 语义 |
| 测试 mock（4 文件） | `query: {}` 的 router stub | **不处理** |

**结论**：全仓**仅 `EntryDetailView.vue:238` 一处**是一锅端清理，「只改这一处」是有据的结论而非懒判。

### 6.4 `content.length` / `contentSize` —— 28 命中（生产代码 3 处 + MCP 1 处）

| 文件:行 | 内容 | 判定 |
|---|---|---|
| `components/HtmlViewer.vue:92-94,98,104,105` | `contentSize = props.content.length`，阈 512KB/2MB | **本次处理**：改用 `file.size`（BDD-42，中文素材）/ `size` 优先（BDD-43 边界回归） |
| `components/TreeView.vue:75` | `truncated = props.content.length > MAX_SIZE`（`MAX_SIZE = 2 * 1024 * 1024`） | **本次处理**：同型缺陷，同数值同范式，改用真实字节（BDD-44）；需给 `TreeView` 增传 `size` |
| `composables/useCsvParser.ts:23` | `while (i < content.length)` | **不处理**：扫描游标，非大小判断 |
| `packages/mcp-server/src/tools/getEntry.ts:90` | `f.content.length > MAX_SINGLE_FULL`（>200KB 提示） | **不处理**：同属「字符 vs 字节」范式，但后果不同（MCP 给 Agent 的返回体提示，不是浏览器渲染阻塞），且跨包超出本任务 scope。**建议主 Agent 登记 roadmap**（与 V-08 同源，独立评估） |

### 6.5 `_MAX_INJECT_IDS` / `768 * 1024` —— 4 命中 / 2 文件

> **第 2 轮更正（B9）**：第 1 轮把 `_BINARY_SIZE_LIMIT` 当成「活跃的单文件二进制上限」纳入预算，属**把死代码当活跃机制**。本轮逐条实测修正如下。

| 文件:行 | 内容 | 判定 |
|---|---|---|
| `services/html_render_service.py:17,72` | `_MAX_INJECT_IDS = 50` + `if len(result) >= _MAX_INJECT_IDS: break` | **本次处理**：调低上限使超限分支可达 + 超限显式反馈（BDD-38）。**实测该 break 在真实配置下永不触发**：`_MAX_INJECT_IDS(50) == max_entry_files(50)`，主文件占 1 名额 → 最多 49 个 sibling。`parse_inject_ids` 现只回 `list[int]`、丢失「截掉多少」→ 一并扩展签名 |
| `services/html_render_service.py:18` | `_BINARY_SIZE_LIMIT = 768 * 1024` | **本次处理（更正为：死常量、零消费；注入路径无单文件上限 → 本任务新增）**。实测 `grep -c _BINARY_SIZE_LIMIT` 在该文件 == **1**（仅定义行），`inject_resources()`（`:177`）对 `text_siblings` **无任何大小检查** → 该常量在本文件内从未被读取。→ BDD-39 声明「**新增**单文件文本注入上限」为新需求 |
| `api/files.py:48` + `:272` | `_BINARY_SIZE_LIMIT = 768 * 1024` **重复定义**同一常量 | **本次处理**：收敛为单点。判定补充（**[BASELINE_CHANGE: P2 第 2 轮实测更正——原判「属 serving 路径、不在注入路径上」失实，仅更正实现层附注，BDD-40 的 Then 语义不变]**）：`:272` 的 `file_record.size > _BINARY_SIZE_LIMIT` **就在注入路径上**——该行位于 `def _build_sibling_data`（`:270`）体内，唯一调用方是 `render_html_file`（`:336`）；`_BINARY_SIZE_LIMIT` 在全仓**只有这一个消费点**（`files.py:48` 定义 / `:272` 消费），`download_file`/`get_file_content`（`:185-268`）内 `grep -c size` 均为 **0** → 全仓**不存在**「按大小挡二进制的 serving 逻辑」。→ 它是**既有的、静默丢弃 oversized 二进制 sibling 的唯一路径**（docstring 自述 "None if skipped (oversized binary)"），本任务必须把它并入 `skipped` 记账（对应 BDD-40「每个未内联的都必须可查」），不能当作"serving 侧豁免" |
| `services/html_render_service.py:19,140` | `_CSS_RECURSION_LIMIT = 3` | **不处理**：CSS `@import` 递归深度限制，与字节/数量预算不同维度，且已有测试覆盖 |

**结论（更正后）**：注入侧**只有 2 个真实生效的常量**——数量上限 50（因 `50 == max_entry_files` 而休眠）与 `_BINARY_SIZE_LIMIT=768KB`（**在注入路径上**，静默丢弃 oversized 二进制 sibling）；单文件**文本**上限、总字节预算、最终 HTML 上限**三者都不存在**，属本任务**新增能力**（P0 决策 4）。`_BINARY_SIZE_LIMIT` 在两文件重复定义，收敛为单点；它**不是死常量**，而是既有静默丢弃路径，须纳入 `skipped` 记账（[BASELINE_CHANGE: 同上]）。`_CSS_RECURSION_LIMIT` 保持独立。

### 6.6 `firstFileId` —— 27 行命中 / 8 文件（口径已声明；三个 e2e spec 内 9 处）

**扫描口径（W10 要求声明，两轮数字差异由此解释）**：
- **口径 A（本表采用）**：`frontend-v3/src` + `frontend-v3/e2e` + `backend` + `packages` + `docs`，文件类型 `*.ts` / `*.vue` / `*.md`，**按行计** → **27 行 / 8 文件**。
- **口径 B（评审全仓实测）**：在上述范围上再加 Playwright 运行产物（`frontend-v3/test-results/**/error-context.md`，每次跑 E2E 都会重写）→ **88 行**。产物里的命中是失败快照转述，不是需迁移的代码。
- **口径 C（第 1 轮旧的「15 命中 / 5 文件」）**：**无法复现**——实测三层口径分别为 27 / 88 / 9，故**该旧数字作废**，勿再引用。
- **三个 e2e spec 内 `firstFileId` 字面量 = 9 处**（`viewer.spec.ts` **2** / `t091` **4** / `tpv0099` **3**）。第 1 轮正文两处写的「共 8 处」**是错的**（`review` 已实测纠正，主 Agent 亦确认此前「复核一致（8 处）」有误）→ 一律以 **9** 为准。

| 文件:行 | 判定 |
|---|---|
| `views/EntryDetailView.vue:234,238`（3 行） | **本次处理**：改读 `file` + 逐参数清理（BDD-14/22） |
| `components/EntryCard.vue:150-152`（3 行）、`EntryListRow.vue:153-155`（3 行） | **本次处理**：删死代码（BDD-47） |
| `e2e/tpv0099-fullscreen-link-auth.spec.ts:65,99,101`（**3**）、`t091-mobile-detail-visual-polish.spec.ts:10,12,95,321`（**4**）、`viewer.spec.ts:21,214`（**2**） | **本次处理（迁移）**：共 **9 处**，改为 `file` 参数（BDD-50 锁死「字面量归零 + 失败集合不劣于基线」） |
| `docs/roadmap/improvement-backlog.md:67,417,418,439,441,448,449`（7 行）、`docs/notes/issues-20261124-1553.md:49,120`（2 行） | **不处理**：历史记录/需求文档 |

### 6.7 `truncated` —— 15 命中 / 7 文件

| 文件:行 | 判定 |
|---|---|
| `components/TableView.vue:4,44,60,155,183` | **本次处理**：`:23-39` 的排序按钮与过滤输入框补条件渲染（BDD-32/33） |
| `components/TreeView.vue:4,75,117` | **本次处理**：截断判据换真实字节（BDD-44） |
| `components/DiagramBlock.vue:129,232` | **不处理**：图表渲染错误文本，与本次无关 |
| `types/structured-data.ts:15` | **不处理**：类型字段 |
| 测试 2 处 | **不处理** |

### 6.8 `select(File)` 无 `order_by` —— `select(File)` 11 命中 / 4 文件

| 文件:行 | 判定 |
|---|---|
| `services/entry_service.py:1423,1429`（`get_entry` 的 `entry.files=` / `get_entry_files`） | **本次处理**：补确定性 `order_by`（BDD-13）——默认入口的前置条件 |
| `services/entry_service.py:432,950,1083,1374`（其他 `get_entry` 分支路径） | **本次处理（同一契约）**：详情页响应统一走同一排序，避免不同分支顺序不一致 |
| `services/entry_service.py:134`（`~File.is_binary`，FTS 用）、`:1436`（`get_files_by_ids`） | **不处理**：前者不进详情响应；后者按 id 集合取，消费方按 id 匹配不依赖顺序 |
| `api/entries.py:87`、`admin_service.py:630`、`database.py:668` | **不处理**：share cookie 分支与管理/FTS 路径；不影响默认入口（但 P4 若统一收敛到一处 helper 则顺带覆盖，不算范围扩张） |

### 6.9 `connect-src` —— 6 命中（生产 2 处）

| 位置 | 判定 |
|---|---|
| `api/files.py:41`（render CSP `connect-src blob: data: https:`） | **不处理（P0 决策 6）**：只加文档 + 测试（BDD-45/46），不改策略 |
| `main.py:300`（主应用 CSP `connect-src 'self'`） | **不处理**：与 HTML render 独立 |
| `tests/test_html_render.py:170` | **不处理**：这是**契约**（`assert "https:" in csp`），BDD-46 反向锁死其不变 |
| `docs/guides/cap-captcha-integration-guide.md` 3 处 | **不处理**：CAP WASM 的 CSP 说明，另一子系统 |

### 6.10 回归拦截（防同类问题未来新增）

不是一次性修完就结束——以下新增拦截手段转化为 BDD，防止同类范式再被复制：

| 拦截手段 | 对应 BDD | 说明 |
|---|---|---|
| 代码级 grep 断言测试（`files[0]` 在卡片/列表归零、`extractHeadings` 逐行正则归零） | BDD-47、BDD-07 | 仓库已有源码扫描型测试先例（`t080-admin-route-guard.test.ts`、`t082-store-split.spec.ts`、`backend/tests/test_dependency_guard.py`） |
| 单一字节数工具 + 两处共用 | BDD-42、BDD-44 | 新增第三处 `content.length` 大小判断时，工具函数的调用点即为审查锚点 |
| 默认入口 resolver 单点（三条路径同一入口） | BDD-08~12 + BDD-47 | 卡片/列表不再自带文件参数，「绕过 resolver」的结构性入口被删除 |
| 参数清理逐项化 | BDD-22 | 「新增临时参数」时必须显式决定是否清理，不能再靠 `query: {}` 一把梭 |
| 预算超限显式反馈 | BDD-38~40 | 后续任何新限额都须带跳过清单，不能静默 |

---

## 7. P0-brief 时效性质疑

**逐条对照 P0 卡片判据（严重 1-3 / 轻微 4-5）**：

1. `task` 的目标方案是否仍成立 → **成立**。在 `9a47df77`（P0 复验基准）与当前 `HEAD=899a9d43` 之间，`git diff --stat 9a47df77 HEAD -- frontend-v3/src backend/peekview` 输出为空（`9a47df77` 是 `HEAD` 的祖先，期间 3 个 commit 全在 `agate-workspace/` 下）→ **8 项缺陷的源码事实全部未漂移**，P1 逐条亲自复验（见 §6 各命中行）。
2. `executor_env` 的平台/运行时前提是否仍成立 → **成立**。本机实测：协议 v0.83.3、`backend/.venv/bin/ruff` / `frontend-v3/node_modules/.bin/{vitest,vue-tsc}` 就位、debug backend `:8888` 在线（`GET /api/v1/entries?per_page=1` → 200）、生产 `:8080` → **000（不可达，全程零接触）**、版本 `peekview=0.27.1`（VERSIONS.json 与 P0 一致）。
3. `known_risks` 的「已解决前提」是否已失效/被他人解决 → **无此情形**。11 条风险无一条被标为"已解决"，全部仍待本任务处理。

→ **不命中严重漂移，不回 P0**。但存在 **3 处轻微漂移**，逐条记录：

- [P0_STALE: `已知风险` 段写「本次 BDD 从 19 条增至 40 条」，而 `验收基线` 实际编号为 1..45（`.state.yaml` 的 history 亦记「BDD 44→45」）——数值陈述滞后于正文。已更新方式：P1 以本文件的 54 条为唯一基线，并在 §3 显式说明 P0 的 45 条倾向如何映射（45 条 → 54 条：其中 V-03 的"性能断言"条被替换为数组长度上界 + totalRows 精确值两条；新增 `/f` 无退出按钮、h1 入目录、死代码代码级断言、e2e 迁移等价性、TreeView 同型、旧链接不重定向等条目）。P0-brief 正文未改（属主 Agent 产出，P1 不擅改）]
- [P0_STALE: `§7.5 冲突表第 4 行`「卡片/列表无条件传 `files[0].id` 会让 README 优先规则失效」表述不准确——该分支在当前代码路径下**从不生效**（列表接口无 `files` 字段；`client.ts:91-99` `transformListItem` 硬编码 `files: []`）。已更新方式：主 Agent 已在工作树回写 §7.5 的 8 行更正说明（`git diff -- P0-brief.md` 可见），P1 据此把相关判据改为**代码级断言**（BDD-47），不用"点卡片看 URL"（现状即通过 → 假 PASS）]
- [P0_STALE: `决策 5` 遗留「`>= 2MB` 是否预期，P1 确认」已有确定答案——`HtmlViewer.spec.ts:338-350`（恰好 512KB）与 `:354-365`（恰好 2MB）两条配对的既有边界用例已把**左闭右开**固化为契约。已更新方式：该项从 §4 待确认清单**移出**，改写为回归 BDD-43，不再占用待定名额]

另记一处**事实更正**（非漂移，属 P0 未记录的新增需求）：P0 隐含前提「全屏模式无文件树」**现状不成立**——`EntryDetailView.vue:281-284` 的 zen 隐藏集只含 header/mobile-sticky-header/mobile-bottom-bar/meta-tags，且 `:244`/`:273` 在多文件 entry 下自动展开文件树。→ 「全屏无文件树」按**新增需求**写（BDD-28 / BDD-53 ③），判据须断言 **DOM 不存在**而非「可视计数 0」，不得按"现状已满足"的心态写判据。

**结论行**：已核对 P0-brief 时效性——**无严重漂移（不阻塞）**，3 处轻微漂移已按上述方式更新/替代并留痕。

---

## 8. 能力需求声明

```yaml
capability_requirements:
  - need: visual / vision 视觉能力（截图分析与渲染结果核对）
    why: "domains 含 frontend 且本任务有用户可见改动（全屏阅读入口、移动端底部栏、截断态表头、TOC 层级）——P6 需对桌面/移动两套视口的截图做视觉核对，确认入口可发现、不遮挡正文、TOC 层级呈现正确"
    available:
      - "vision-engine skill（本环境实测可用；调用需重定向 HOME 与 ratelimit 目录，属调用方式而非能力缺失）"
      - "Playwright CDP（Chrome :18800，本环境实测在线）+ mcp__pwtest__* 截图"
      - "vision-helper subagent 作为补充"
    status: available
    note: "沙箱 ~/.local/share 只读 → 用 HOME=<项目>/.agate-tmp/vhome + PYTHONPATH=/home/kity/.local/lib/python3.12/site-packages 方式调用；截图产物落 <项目根>/.agate-tmp/"
    caveat: "**默认 role 链不可用**（实测 `alibaba/qwen3-vl-flash` 404、`google-free/gemini-flash-latest` 503、`xrouter/nx-vision` 50s+ 抖动）→ 必须显式 `--model` 钉模型才可用。P6 不得因本条 status=available 就假定「能力可用 ⇒ 视觉验收一定跑得通」，须先做一次钉定模型的连通性探针"

  - need: browser-automation 真实浏览器交互与 URL 状态观测
    why: "BDD-14~22 全部依赖真实 URL/路由/刷新行为（mock router 证不了刷新保留与历史记录），BDD-23~31/53/54 依赖真实布局与 rect 测量，BDD-52 依赖真实 seed 后页面"
    available:
      - "mcp__pwtest__*（干净无登录态，默认）"
      - "Playwright CDP :18800（WSL/GPU 场景）"
      - "frontend-v3/e2e 既有 Playwright spec（43 个 *.spec.ts，可 E2E_SPEC= 定向跑；baseURL 由 make debug-test 注入 :8888）"
    status: available

  - need: debug-backend 隔离环境（造 entry / 造 share token / 造子目录文件）
    why: "BDD-08~13 的 seed 覆盖不足（无「有 index.md 无 README」、且 README 恰好字典序最小会假 PASS），必须在 debug :8888 现造 entry；BDD-22 需现造 share token；BDD-11 需带 path 的子目录文件"
    available:
      - "make debug-quick / make debug-start + make debug-seed（数据目录 /tmp/peekview-debug/，与生产隔离）"
      - "POST /api/v1/entries（FileCreate 支持 path/filename/content/content_base64）"
    status: available

  - need: source-scan assertion 源码级断言（grep 型测试）
    why: "BDD-07 / BDD-47 必须是代码级断言（运行时已验证现状通过，浏览器断言会假 PASS）"
    available:
      - "vitest + fs.readFileSync 源码扫描（既有先例：t080-admin-route-guard.test.ts、t082-store-split.spec.ts、styles/__tests__/zebra-stripe.spec.ts）"
      - "pytest 源码扫描（既有先例：backend/tests/test_dependency_guard.py、test_t082_di.py）"
    status: available
```

**`verification_env` 声明**（运行环境，不是能力三态）：

```yaml
verification_env: "debug backend http://127.0.0.1:8888（make debug-quick 或 make debug-start + make debug-seed，数据目录 /tmp/peekview-debug/）+ Chrome CDP localhost:18800 + backend/.venv（pytest 9.1.1）+ frontend-v3/node_modules（vue-tsc 5.9.3 / vitest 1.6.1）"
verification_env_budget: "止损轮次 2（独立计数，不占 retries[P5]）；轮次追踪由主 Agent 在 dispatch-context 记录"
```

**环境隔离铁律（本任务全程适用）**：只用 `:8888`；**严禁**接触生产 `:8080`；**严禁**触碰 `~/.peekview/`；**严禁** `pip3 install --break-system-packages`；测试 entry 只经 debug HTTP API 创建（**禁** CLI `peekview create`）；临时产物落 `<项目根>/.agate-tmp/`（**不用 `/tmp`**，per-call tmpfs 跨调用不可见）。
**状态标记**（二值格式）：

[PROD_NOT_TOUCHED] P1 全程只读代码 / grep 全仓 / 读 debug `:8888` 的 API 与探活；实测生产 `:8080` → 000 不可达，零接触，未触碰 `~/.peekview/`，未跑任何写生产数据的命令。

**是否需要 `requires_minimal_validation: true`**：**不需要**。本任务无「实现方式不可推断、须先做浏览器/外部系统行为探针」的选型——V-02 的接线方式、预算承载形态均可在既有组件与测试内确定；唯一涉浏览器不确定项（TOC 默认不渲染、`/f` 现状有文件树）已由主 Agent 实测澄清并写入判据前提。

---

## 9. 验收手段分层与环境前提（P6 必读）

来源：E-5（主 Agent 实测）+ 本轮亲自复核。

| 缺陷组 | 可验层级 | 硬约束（不满足就"以为能跑"却跑不了） |
|---|---|---|
| V-06 / V-07 注入预算 | **pytest 完全自足** | `test_html_render.py:27` 的 `client` fixture 用 `create_app()` + `mkdtemp()` 建独立临时 app/DB；`:45` `_create_entry` 可造任意多文件 entry。**零既有覆盖**，纯新增 |
| V-04 截断态控件 / V-03 提前终止 | **vitest，须注入小 `maxRows`** | `TableView.vue:127` 默认 **50000**，**全仓无任何 view 覆盖**；seed 最大 CSV 仅 61 行 → 单测传 `maxRows: 5`（先例 `TableView.spec.ts:184`） |
| V-01 默认入口 / `?file=` 深链 / URL 状态 | **debug `:8888` + 现造 entry + Playwright** | seed 无「有 `index.md` 无 `README.md`」样本；刷新保留/切换同步/历史记录是跨请求行为，mock router 证不了 |
| V-08 字节数 | vitest 可证但**有假 PASS 风险** | `HTML_VIEWER_TEST_SIZE_KEY` 注入会绕过「从 `file.size` 取值」这一被测行为 → 必须有 BDD-42/44 走真实 `size` |
| V-02 标题/目录 | vitest（headings 一致性）+ Playwright（DOM 锚点/去重/层级） | TOC 展开态**分视口**：桌面（>640px）**默认已展开**、移动端默认不渲染；统一用幂等表述（读 `aria-expanded`，为 `"false"` 才点击），`.toc-sidebar` 关闭后整块从 DOM 消失。按字面「点开 TOC」会在桌面端把它**关掉** → 假 FAIL |
| V-05 安全边界 | pytest + 文档 grep | 不改 CSP，故无行为变更可验；文档三要素可 grep |

**造件能力核实**（本轮实测）：debug `:8888` 的 `GET /api/v1/config/limits` 返回 `max_file_size=20971520`、`max_entry_files=50`、`max_entry_size=104857600` → **可在 debug 现造 ≥2MB 的 HTML/JSON 文件**（`max_content_length` 1MB 未在服务层强制，`_validate_limits` 只校验单文件/总大小/文件数），故 BDD-42/44 的造件路径可行（BDD-42 的「字节 ≥2MB ∧ `content.length` <2MB」需中文多字节素材，已在 BDD-42 的 Given 内附实测数值）。

---

## 10. 依赖与前置条件

| 依赖 | 说明 |
|---|---|
| V-01 依赖「后端顺序确定性」先行 | BDD-13 是 BDD-08~12 的前置（无 `order_by` 则 resolver 的兜底不可判定） |
| V-03 依赖「构造行数观测面」先行 | BDD-35 的判据要求「实际构造的数据行数」**本次新增暴露**（现状返回值仅 `headers,rows,totalRows,truncated`，无任何构造计数）→ 若 P4 未先落地该观测面，BDD-35 无法取证（判 FAIL，不得回退用 `rows.length`：现状 `slice` 已保证其上界，用它判等于假 PASS）。BDD-36/37 不依赖该观测面 |
| `?file=` 机制替换依赖 BDD-22 的逐参数清理 | 否则收尾清理会抹掉 `file`，BDD-14/21 必红 |
| 全屏入口（BDD-25/26）依赖 resolver | 「是否默认文件」必须由 `resolveDefaultFile` 判定，不得假定 `files[0]` |
| e2e 迁移（BDD-50）依赖 `file` 机制落地 | 3 个 spec 是 `firstFileId` 生效期的证据；迁移后判据为**回归等价性**（失败集合不劣于落盘基线），不是全绿 |
| BDD-52 依赖 seed 可用 | `k8s-deployment` 匿名 200（实测）；注意 `markdown-test` 属 `frontend-team`，**匿名 404**（实测），不得用作人工体验路径样本 |

---

## 11. 变更记录

- 2026-11-24 首版（analyst）：基于 `P0-brief.md`（工作树版，含 §7.5 第 4 行更正）+ 两份 dispatch-context，产出 55 条 BDD；收敛 P0 的 4 项待定（2 项由用户定夺、1 项由既有契约定、1 项数值留 P2）；同类扫描 9 组；P0 时效性核对无严重漂移 + 3 处轻微漂移留痕。
- 2026-11-24 第 2 版（analyst，按 `P1-review.md` 的 11 BLOCKER + 14 WARNING 原地修订）：需求方向、8 项缺陷源码事实、决策 A/B、同类扫描骨架、裁剪声明、`risk_level`/`ceremony`/`packages`/`domains`/`capability_requirements`、P0_STALE 三条**均未改**。本轮只改**判据区分力**与失实陈述，BDD 总数 55 → **54**（编号全局重排）。

  **① 11 BLOCKER 处置**：
  | 编号 | 处置 |
  |---|---|
  | B1 | 采「(a) 判据改为断言 DOM 不存在」：BDD-28 断言 `.file-sidebar` / `.toc-sidebar` 的 **DOM 计数 == 0**（现状 DOM 存在 + 全局 CSS `display:none` → FAIL）；BDD-53 拆为「①② 回归守护 + ③ 新增需求」。§2.2 与 BDD-28 注**并列引用** scoped（`EntryDetailView.vue:281-284`）与 global（`styles/layout.css:650-657`）两处隐藏集，并说明 `.file-sidebar`/`.toc-sidebar` 只由全局那处隐藏。 |
  | B2 | 全文统一**幂等 When 表述**（读 `aria-expanded`，为 `"false"` 才点击），覆盖 BDD-01/02/03/04/52；§2.2 与 §9 把「TOC 默认不渲染」更正为「**移动端默认不渲染、桌面端默认已展开**」。 |
  | B3 | BDD-08 素材 `aaa.txt`→**`AAA.txt`**（`A`=65<`R`=82）；BDD-12 构造序改 `[AAA.txt, readme.md]`；BDD-13 改现造 entry 且构造序 `[zzz,aaa,mmm]` ≠ 字典序。§3.2 判定基线补「素材选择通则」。 |
  | B4 | BDD-16/17/18 各加**成对对照**：同一测试内先断言「有效 id 确实切换」（前置校验，不成立即整条 FAIL）再断言「无效 id 不切换」，并比较两侧活跃文件不同。 |
  | B5 | 原 BDD-24（history 不增）**合并入** BDD-19 作第三断言，由「URL 同步」提供区分力。 |
  | B6 | BDD-36 标题改「**回归兼容**：截断时 totalRows 仍为精确总行数」，新行为判据全部压在 BDD-35。 |
  | B7 | BDD-05 增第二断言：TOC 条目**可见文本不含** `**`/`[`/`](` 等标记且去空白后与正文 `<h2>` 的 `textContent` 逐字相等（现状 FAIL）。 |
  | B8 | **二选一选 (a)「调低上限使超限分支可达」**（理由见下）。BDD-38 写明造件路径 `create_app(config=PeekConfig(limits=PeekLimits(max_entry_files=N+1)))`，并加**代码级关系断言**「数量上限 < `max_entry_files` − 1」（现状 50 == 50 → FAIL）。 |
  | B9 | BDD-39 **显式声明「新增单文件文本注入上限」是新需求**；§6.5 把 `_BINARY_SIZE_LIMIT` 由「活跃机制」更正为「**死常量、零消费**；`files.py:272` 属二进制 serving 路径、不在注入路径上」，并注明三者（单文件文本/总字节/最终 HTML）**均不存在**。 |
  | B10 | BDD-50 Then 改**回归等价性**：三 spec 内 `firstFileId` 字面量 == 0，且每个 spec 失败集合**不劣于**改动前基线（`viewer` 18F/20P、`t091` 12F/12P、`tpv0099` 6P/0F，根因 TPV0095 既有回归）。§6.6 补登基线与 `firstFileId` = **9 处**。 |
  | B11 | BDD-40 收口为**可同时成立的合取断言**（可机器解析的跳过清单 **或** HTTP ≥400 且 `error.message` 非空；且不存在"成功但静默缺少 sibling 且无记录"），预算数值仍留 P2，**判定形态不留**。 |

  **② B8 为何选 (a)「调低上限使超限分支可达」（需求层结论，非「P2 再定」）**：`_MAX_INJECT_IDS = 50`（`html_render_service.py:17`）**恰等于** `max_entry_files = 50`（`config.py:46`）而主文件占 1 名额 → 真实配置下最多 49 个 sibling，`if len(result) >= _MAX_INJECT_IDS: break`（`:72`）**永不触发**（上线至今从未生效）。选 (a) 调低上限使分支可达：保住「超限必须显式告知」这条**用户可观测需求**的可验形态（否则 P6 只能用 mock 证明用户永不遇到的路径，而 P0 决策 4 的核心诉求正是消除"渲染成功但资源不全"的假象），且一旦 `max_entry_files` 被调小保护立即生效。P1 锁定**关系**（上限 < `max_entry_files` − 1）与**反馈形态**；具体数值与「跳过清单 vs 报错」的路线仍由 P2 依实测冻结。备选 (b) 的代价已在 §3.7 与本节记录。

  **③ 14 WARNING 处置**：W1→BDD-23/24 判据排除 `title` 属性且 Given 钉定「正文不含图表」；W2→原 BDD-42/43 **合并**为新 BDD-42（钉定 `字节 ≥2MB ∧ content.length <2MB`，并声明与既有 `HtmlViewer.spec.ts:338-365` 边界用例的区别仅在素材类型与取值来源）；W3→原 BDD-06 **并入** BDD-01（保留三次中文场景）；W4→BDD-02 删「条目数 == 总数」后半、改正反双向断言；W5→BDD-33 加「回归兼容：」；W6→BDD-06 加「回归兼容：」；W6'→BDD-27 加「回归兼容：」并注明依据；W7→§5 P8 行补「截断提示文案新增总行数（BDD-34）」及另 6 项用户可见变更；W8/W10→§6.6 重写为 **9 处** + 声明三层扫描口径（27 行/8 文件、88 行含 Playwright 产物、旧「15 命中/5 文件」作废）；W9→§4 新增第 5 行结论 + **新增 BDD-30** 锁定「普通态 `f` 不改 URL」；W11→**新增 BDD-31** 约束「文件树逐文件无全屏按钮」；W12→BDD-45 落点钉定为 `docs/architecture/html-preview-security-modes.md`；W13→BDD-35 去掉函数签名、改行为描述；W14→§8 vision 条目补「须显式 `--model` 钉模型，默认 role 链不可用」。

  **④ BDD 编号重排映射（55 → 54）**：`01←01+06(合并)`、`02~05` 不变、`06←07`、`07←08`、`08~11←09~12`、`12←13`、`13←14`、`14~19←15~20`、`19` 并含原 24 的第二断言、`20←21`、`21←22`、`22←23`、`23~27←25~29`、**新增 30（普通态 f 键）**、**新增 31（逐文件无全屏按钮）**、`28←30(改写)`、`29←31`、`32~41←32~41`、`42←42+43(合并)`、`43←44`、`44←45`、`45←46`、`46←47`、`47~52←48~53`、`53←54(改写)`、`54←55`。**全文交叉引用（§1/§2/§4/§5/§6.1~6.10/§7/§8/§9/§10）已同步**。

  **⑤ 区分力自检（每条改动过的 BDD 在「改动前的实现」下）**：
  | BDD | 改动前 | 改动后 | 说明 |
  |---|---|---|---|
  | 01 | **FAIL** | PASS | 3 个同名 h2 现状 id 全等 `中文标题` → 集合大小 1 ≠ 3 |
  | 02 | **FAIL** | PASS | 围栏内 `## 示例` 现状误入 TOC |
  | 03 | **FAIL** | PASS | Setext h1 现状 `id` 为空串 |
  | 04 | **FAIL** | PASS | 现状 TOC 3 条（h1 未入）≠ 4 |
  | 05 | **FAIL** | PASS | 断言②：TOC 可见文本现状输出 `**粗体**与[链接](other.md)`（Playwright 真实 DOM 实测，桌面 1280×800；Then① 现状 PASS、Then② FAIL → 整条 FAIL） |
  | 06 | PASS | PASS | **回归兼容**（`scrollIntoView` 已生效），已显式标注 |
  | 07 | **FAIL** | PASS | `useEntryDetailComputed.ts:51` 逐行正则现状命中数 1 |
  | 08 | **FAIL** | PASS | 现状 resolver 不存在，兜底取 `files[0]` → 得 `AAA.txt` |
  | 09 | **FAIL** | PASS | 现状兜底取 `aaa.md` |
  | 10 | **FAIL** | PASS | 现状得构造首个 `bbb.txt` |
  | 11 | **FAIL** | PASS | 现状得 `sub/README.md`（构造首个） |
  | 12 | **FAIL** | PASS | 现状得构造首个 `AAA.txt` |
  | 13 | **FAIL** | PASS | 现状返回构序 `[zzz,aaa,mmm]` ≠ 字典序 |
  | 14/15 | **FAIL** | PASS | 现状 `?file=` 完全不被读取 |
  | 16/17/18 | **FAIL** | PASS | 加了前置校验：「有效 id 确实切换」现状不成立 → 整条 FAIL |
  | 19 | **FAIL** | PASS | 断言①：页内切换现状不改 URL |
  | 20/21/22 | **FAIL** | PASS | 同上机理 |
  | 23/24 | **FAIL** | PASS | 全屏入口现状不存在（唯一 `title="Fullscreen"` 是图表按钮，已被排除） |
  | 25/26 | **FAIL** | PASS | 入口不存在 → 无法点击 |
  | 27 | PASS | PASS | **回归兼容**（`/f` 现状已 zen + 默认文件），已显式标注 |
  | 28 | **FAIL** | PASS | 断言 DOM 计数 == 0，现状 1 |
  | 29 | PASS | PASS | **约束型**（决策 A），现状通过属设计意图 |
  | 30 | PASS | PASS | **回归兼容**：现状按 `f` 本就只切 zen 不改 URL；本条锁定该行为防 P4 改成跳路由 |
  | 31 | **FAIL** | PASS | 断言②：页面级全屏入口现状计数 0 ≠ 1 |
  | 32 | **FAIL** | PASS | `.th-sort-btn`/`.th-filter` 无 `v-if` |
  | 33 | PASS | PASS | **回归兼容**（未超限时控件已生效），已显式标注 |
  | 34 | **FAIL** | PASS | 文案现状仅 `maxRows`，无 `totalRows` |
  | 35 | **FAIL** | PASS | 以「实际构造的数据行数」为观测面：现状先全量构造 1000 行再 slice（实测构造值 **1000** > 5 → FAIL），且现状**无该观测面**（字段全 `undefined`）；修后构造值 5 → PASS。`rows.length` 侧现状 5 == 修后 5（不可区分，已排除） |
  | 36 | PASS | PASS | **回归兼容**（`slice` 已保证长度），已显式标注 |
  | 37 | PASS | PASS | **回归兼容**（扫完全文才 throw），已显式标注 |
  | 38 | **FAIL** | PASS | 断言④：现状 `50 == 50`，关系「上限 < 50−1」不成立；且无跳过清单 |
  | 39 | **FAIL** | PASS | 现状注入路径对文本 sibling 无任何大小检查 |
  | 40 | **FAIL** | PASS | 现状无跳过清单/错误体（静默 `break`） |
  | 41 | PASS | PASS | **回归兼容**（既有注入行为），已显式标注 |
  | 42 | **FAIL** | PASS | 现状按 `content.length` 判 → 自动渲染（iframe 存在） |
  | 43 | PASS | PASS | **回归兼容**（既有边界契约），已显式标注 |
  | 44 | **FAIL** | PASS | `TreeView.vue:75` 按 `content.length` → 不截断 |
  | 45 | **FAIL** | PASS | 落点文件现状不存在 |
  | 46 | PASS | PASS | **不变守护**（CSP 逐字符不变），已显式标注 |
  | 47 | **FAIL** | PASS | 两组件 `files[0]` 现状命中数各 1 |
  | 48/49 | PASS | PASS | **回归兼容**，已显式标注 |
  | 50 | **FAIL** | PASS | 三 spec `firstFileId` 字面量现状 9 ≠ 0 |
  | 51 | **FAIL** | PASS | 现状 `?firstFileId=15` 会选中 `service.yaml` |
  | 52 | **FAIL** | PASS | TOC 条目数现状 3 ≠ 4（h1 未入） |
  | 53 | **FAIL** | PASS | 断言③：`/f` 下 sidebars 的 DOM 计数现状各 1 |
  | 54 | **FAIL** | PASS | `handleNavigateFile` 现状只 `selectFile` 不改 URL |
  汇总：**54 条中 42 条改动前 FAIL**（有区分力）；**12 条为显式标注的回归兼容 / 约束型 / 不变守护**——BDD-06、27、29、30、33、36、37、41、43、46、48、49（逐条已在标题或注中标注理由，非新增行为），无一条属未标注的假 PASS。

  **⑥ 新增 / 删除 / 合并**：另在 §1 增「V-07 事实口径」注、§3.7 增 B8 结论段、§9 增 TOC 分视口前提与 BDD-42 造件实测数值、§8 增 vision `--model` 约束（W14）。新增 **BDD-30**（普通态 `f` 不改 URL，W9）、**BDD-31**（文件树逐文件无全屏按钮，W11）；合并 2 处（06→01、24→19）；合并 1 处（42+43→42）；删除 0 条独立需求（BDD-02 的后半断言删除属拆分冗余，语义由 03/04 覆盖）。总数 55 → 54。

- 2026-11-24 第 3 版（analyst，按 `P1-review.md` 第 2 轮复审的 **2 BLOCKER + 6 WARNING** 原地修订）：**只改这 8 处 + 本节**。第 1 轮 11 项 BLOCKER 中已闭环的 10 项、需求方向、8 项缺陷源码事实、决策 A/B、同类扫描 9 组、P0 时效性质疑、裁剪声明、能力三态、§11 的 12 条回归守护标签**均未动**；BDD 总数保持 **54**、编号未变。

  **① 2 BLOCKER**：
  | 编号 | 处置 |
  |---|---|
  | B-NEW-1 | BDD-05 的 When 取证通道由「vitest 层直接消费 `render()` 的 `headings` 与 `html`」改为「**Playwright 层真实 DOM**（桌面 1280×800 + 幂等展开态），读取 `.toc-list a` 可见文本与 `.markdown-body h2` 的 `textContent`/`id`」。理由与实测写进正文：`useMarkdown.ts:480` 是该渲染函数**唯一 return 点**，`html` 为**常量空串**，真实 HTML 在 `blocks[]`（`:414`）→ 照字面取会得 `html === ''`，退化成"断言空串"而静默失去区分力。Given 补「`path` 与 `filename` 同时给」（只给 `path` 会得 `language=null` → 正文退化 CodeViewer、`.toc-list` 为空）。断言①②语义不变。 |
  | B-NEW-2 | BDD-35 删去「**既有返回值结构中的字段**」这一被明确许可的观测面（现状 `useCsvParser.ts:12` 的 `slice(0, maxRows)` 已保证 `rows.length ≤ maxRows`，实测 1000 行 + `maxRows=5` → `rows.length=5` → Then 现状即满足 = **假 PASS**），改为「以本次改动**新增暴露**的『实际构造的数据行数』观测面」，并新增**观测面定义**三条硬约束：① 不得用 `rows.length` ② 必须能区分「构造 1000 行再截 5 行」vs「只构造 5 行」（形态示例：返回值新增字段 / 公开解析统计 / 可注入计数回调，**不写死签名**，未重新引入 W13）③ 该观测面改动前不存在（实测 `constructedRows`/`parsedRows`/`parsedCount`/`stats` 均 `undefined`）。Then 加正向对照（3 数据行 → == 3，排除"恒返回 0"）。 |

  **② 6 WARNING**：W-新 1→§10 新增「V-03 依赖『构造行数观测面』先行」行（缺该观测面则 BDD-35 判 FAIL，不得回退 `rows.length`）；W-新 2→§3 开头的 TOC 幂等表述**补第三分支 `null`**（该视口不适用 → 改用桌面重跑）+ 加「实测依据」段（移动端 `mobile-bar-toc-btn` 无 `aria-expanded`、走 `showTocDrawer` 非 `.toc-sidebar` v-if 链），BDD-01/02/03/04/06/52 的 Given 全部钉定「桌面视口 1280×800」；W-新 3→BDD-31 断言② 名称口径补「同样**不含 `title` 属性**」（与 ①/BDD-23/24 统一）+ Given 补「**正文不含图表块**」（`DiagramBlock.vue:177` 的 `title="Fullscreen"` 会致计数 2 → 假 FAIL）；W-新 4→BDD-53 断言① 把 `.meta-tags-bar` 从「四项 DOM 保留、仅样式隐藏」并列中**拆出**，注明「实测 DOM 计数 **0**、非 `v-show`」（`.detail-header` 等三项才是 DOM 1 / 可视 0），**判据不变**；W-新 5→4 处交叉引用改号：L95 与 P0_STALE 第 3 条的 `BDD-44`→**BDD-43**（`>= 2MB` 左闭右开）、§6.2 的 `BDD-14`→**BDD-13**（`order_by`/确定性排序）、P0_STALE 第 2 条的 `BDD-48`→**BDD-47**（卡片/列表代码级断言）；W-新 6→BDD-50 Then② 补前提「P5 已按本节 Given 基线产出 `known-failures.md`（逐 case）；**缺失该文件时本条判 FAIL 而非 PASS**」。

  **③ 本轮新增的联合约束（自检发现，非评审要求）**：BDD-35 的说明补一段「与 BDD-36 的耦合」——按新观测面自检时，朴素「到上限就不再 push 行数组」的实现会把 `totalRows` 从 1001 砍到 6 → BDD-36 变红。这是**计数与构造解耦**的联合约束，非判据冲突；P4 只满足一条而踩坏另一条时，按被踩坏的那条判 FAIL。

  **④ 本轮自检（按新判据字面执行，均实测）**：B-NEW-1——现造 entry 先在移动 390×844 读得 `aria-expanded === null` 走第三分支 ✓，改桌面 1280×800 后 `"false"` → 点击一次 → TOC 出现 → **Then① PASS / Then② FAIL → 整条现状 FAIL**（判据可执行且有区分力）；B-NEW-2——双实现对照（现状 vs 模拟修好）：`rows.length` 现状 5 / 修后 5（**不可区分**，证实假 PASS 面），「实际构造行数」现状 **1000** / 修后 **5** → 断言①现状 **FAIL** ✓、修后 PASS，正向对照两侧均 **3** ✓。全文：BDD 总数 **54**、编号 01–54 连续、交叉引用无越界（1–54）、每条 GWT 齐全。探针 entry 已全部 DELETE，anon total 恢复 15；[PROD_NOT_TOUCHED]。

