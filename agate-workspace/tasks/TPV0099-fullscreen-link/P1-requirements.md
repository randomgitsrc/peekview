---
phase: P1
task_id: TPV0099
type: problems
parent: P0-brief.md
trace_id: TPV0099-P1-20260928
status: draft
created: '2026-09-28'
agent: analyst
risk_level: medium
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
- frontend-v3
- docs
domains:
- frontend
ui_render_shape: layout
ui_ux_dimensions:
- 布局结构
- 交互行为
- 视觉呈现
---
# P1 需求基线 — 全屏模式链接 `/{slug}/f`（TPV0099）

[NO_NEED_CONFIRM]

[SCOPE_RESOLVED: from P2-design.md:120（§1.3 R-04 / §10 遗留表第 1 项）——P2 阶段识别的 `[SCOPE+]`：`.archived-banner` / `.expired-warning-banner` 在 zen/全屏视图下仍可见且构成满宽顶部横条（实测 1280×49、top=0），且不在 zen 隐藏集、不在 BDD-3 的 A/B 排除集内。**主 Agent 2026-09-28 裁决：本任务不采纳、不增补 BDD、不改隐藏集**，理由三条：① `/{slug}/f` 复用 zen 类 → banner 在**今天的 zen 态就已可见**（既有行为、早于立项）→ 本任务对其视觉状态**增量为零**，纳入即等于为"实现前后逐像素一致"背书（虚假验收面）② 匿名不可达该状态（`legacy-deploy` 匿名 404、需 alice），与"分享给匿名接收者"的核心用户故事不相交 ③ `status: archived` 系 `seed-debug.py:204-209` 的有意设计，非环境劣化。**落地证据链**：P2 §1.2 N12（Not Modify）+ §1.3 R-04（含双向缓解）+ §6.5（BDD-1/2/3 钉定非归档 seed `dsh-architecture`）→ P4 零范围外改动（`git show --stat f1cfd5c3` 仅前端 3 文件 + 文档）→ P6 验收 19/19 PASS 且 BDD-3 三态负向对照 0/3/1 闭环 → P6.5 judge 独立复核确认。**缺口已登记为 DEBT0013**（`agate-workspace/debt/tech-debt.md`，status: open），待后续任务处理。[BASELINE_CHANGE: 主 Agent 批准的闭环标记——纯闭环记录，未改 BDD、未改语义]]

> **修订轮说明（rev1）**：本文件按 `P1-review.md` 的 8 项必修 + 8 项建议修订（`needs-revision` → 本轮）。修订只针对被点名的问题，未被点名的节保持原样；**未削弱任何 BDD 的判定强度**（BDD-3 的改法是排除容器链而非放宽阈值；被换掉的 seed 都补写了前提或改用匿名可达者）。三个 P0 锁定决策未重开。修订后 **BDD 总数 = 19 条**（BDD-1~BDD-19 连续），详见第 3 节导语。
>
> **人工体验路径验收**：见 BDD-16（Given seed 数据 → 页面有内容）。本任务产出用户可见页面且内容受 seed 数据影响，故按 P1 卡强制节追加该 BDD，不以 fixture / 单测断言替代。
>
> **P0 时效性**：已核对，命中一处**已就地更正**的漂移点，见第 5 节 `[P0_STALE: ...]` 记录。

## 1. 需求复述

分享场景下，发送者把 `https://host/{slug}/f` 交给接收者；接收者打开后**直接进入锁定的纯内容视图**——只剩 entry 主体内容，且页内没有任何退出全屏的出口。

三个设计决策已由用户在 P0 阶段裁决锁定，P1 只转成验收条件，不重开：

1. **URL 形态 = 路径后缀 `/{slug}/f`**（否决 `?f` query 形态）
2. **完全锁死**：`f` 与 `Escape` 均不改变视图，**无页内出口**（用户明示接受"键盘用户需手动改 URL"的代价）
3. **元信息条一并隐藏**（外观目标 = "只剩纯内容"）

范围边界（P1 复核后确认，非新增决策）：

- 现有全部渲染格式（markdown / 代码 / 表格 / 图表 / 图片等）在全屏视图下照常工作——本任务不新增渲染能力，只改变 chrome 的可见性与键盘语义
- 后端**是否**为 `/{slug}/f` 增加 JSON-accept 分支由 P2 决策；P1 只登记该边缘（第 8 节），不在需求基线里定方案
- 不改动既有 f 键 zen 视图的外观与语义（第 3.5 节回归组）

## 2. 隐含需求识别

### 2.1 锁死语义必须与"内容区内的 Escape 消费方"划清边界

现有 zen 的键盘处理挂在 `document`（`EntryDetailView.vue:216` 的 `document.addEventListener('keydown', handleZenKeydown)`），而内容区内的组件各自处理 Escape：

| Escape 消费方 | 绑定位置（rev1 更正，建议 16） | 是否在内容区内 |
| --- | --- | --- |
| `TableView` 分页下拉 | 元素级 `@keydown`（`TableView.vue:68,77`；Escape 分支在 `:227` / `:243`） | 是（表格类 entry 正文） |
| `ShareDialog` | **`document` 级** `document.addEventListener('keydown', onGlobalKeydown)`（`ShareDialog.vue:218`） | 否（入口在 header / mobile bar，全屏下不可达） |
| `OverflowMenu` | **`document` 级** `document.addEventListener('keydown', handleKeydown)`（`OverflowMenu.vue:150`） | 否（入口在 header） |
| `EntryListView` 搜索框 | 元素级 | 否（不同页面） |

- **绑定层级事实更正（rev1，建议 16）**：`ShareDialog` 与 `OverflowMenu` 的监听均为 **`document` 级**（非"元素级"，原表未标注层级，易让 P2 误判锁死短路的影响面）。二者的实际冲突风险仍不成立——`ShareDialog.onGlobalKeydown` 仅在 `isOpen.value` 为真时消费 Escape，而全屏下其入口在 header / mobile bar（已隐藏）→ 无从打开；结论（不构成冲突面）不变，但**影响面判定必须知道它们是 `document` 级**：若锁死实现为"在 `handleZenKeydown` 里对 Escape 一律 `preventDefault` + `stopPropagation`"，被影响的就不只是元素级处理者，而是所有 `document` 级监听（含两个未打开也注册着的组件）。

- **为什么必须**：「完全锁死」若实现为"锁死态下 `handleZenKeydown` 一律吞掉 f/Escape 并 `preventDefault`"，会同时吞掉内容区组件的 Escape 行为——而 P0 验收基线第 8 条要求"图表类 entry 全屏下内置全屏按钮正常"。若内容区内存在依赖 Escape 关闭的浮层而被吞掉，就产生**需求内部矛盾**。P1 因此把它拆成独立 BDD（BDD-7），明确锁死的边界是"不改变全屏视图状态"，而不是"吞掉所有 Escape 事件"。
- **核查结论（降低该风险的事实基础）**：图表全屏弹层（`MermaidRenderer.vue` / `SvgRenderer.vue` / `PlantUmlRenderer.vue` 的 `.diagram-modal`）**当前没有任何 Escape 监听**——它只支持点遮罩与点 × 关闭（`@click.self="closeFullscreen"`）。`e2e/t022-diagram-refactor.spec.ts:77-93` 的 "Escape closes modal" 断言所依赖的类名（`.mermaid-action-btn` / `.diagram-modal-overlay`）在 TPV0096 已被判定为死选择器，该断言早已失效。故锁死与图表弹层**当前不冲突**，但边界仍须由 BDD-7 显式锁住，防止实现期扩大 `preventDefault` 范围。

### 2.2 URL 是公开契约 → 文档与 Changelog 同步面

`/{slug}/f` 与 `/{slug}/raw` 同级，属对外发布即承诺的公开 URL。P0-brief「关键约束」已指出这一点，P1 把受影响面做实：

| 承诺面 | 现状 | 本任务必须同步 |
| --- | --- | --- |
| `DESIGN.md:210-211`「Zen Mode」节 | 只写 `f` 进入 / `Escape` 退出 | 需补全屏链接入口（既有 f 键语义不变） |
| `CHANGELOG.md` `[Unreleased]` | 无本任务条目 | 用户可见功能，P4 完成后立即写入（铁律 8） |
| `docs/roadmap/improvement-backlog.md:388-401` | 已登记 #56，状态 🔄 TPV0099，方案描述含一条**已被证伪的前提**（"zen 外观统一…同时影响现有 f 键 zen，P1 确认"） | 收尾时把状态改为已完成，并更正该条表述 |
| `README.md` / `AGENTS.md` 技术要点 | `raw` 短链有描述，`/f` 无 | 若 P8 判定为对外可见入口则补一行；不补也可接受（P8 决策） |

- **为什么必须**：URL 契约一旦发布无法回收，文档与实际不符会让后续使用者把"全屏链接"当作可选项而漏用/误用；roadmap 里那条被证伪的前提若不更正，会再次误导未来的分析（本次 P0 自检已因此消耗一轮核对）。

### 2.3 「mode 保态」依赖既有机制，不需要额外的 URL 处理

P0 决策依据称"切文件（firstFileId）天然不丢"，P1 核实机制后确认该结论成立，但机制与描述略有差异：

- 内容区内的文件间跳转走 `MarkdownViewer` 的 `navigate-file` 事件 → `useEntryDetailComputed.handleNavigateFile` → `entryDetailStore.selectFile`，**全程不调用 router**（`stores/entryDetail.ts:73-87` 为纯 store 操作）
- 只有**列表页进入详情页**时才带 `?firstFileId=`（`EntryCard.vue:148-152`、`EntryListRow.vue:146-150`），且 `EntryDetailView.vue:215` 在消费后 `router.replace({ path: route.path, query: {} })` 清掉 query

- **为什么必须**：这决定了 `/{slug}/f` 下的"保态"是**天然成立**（path 不变、query 被清但 path 保留），而不是"需要额外把 f 写进每次内部跳转"。BDD-8 据此只需断言"切文件后仍处于全屏视图且内容已切换"。
- **两件事必须分开（rev1，必修 3）**：本节的结论只覆盖"**保态成立**"（切换动作**完成后**不丢全屏）；它**不**证明"**切换动作可达**"——全屏视图下 `.file-sidebar` 被隐藏、抽屉触发控件位于同样被隐藏的 header / mobile bar，**并无通用文件切换 UI**，入口只能来自正文内的同 entry 文件链接。BDD-8 的 Given 因此必须选用正文内含文件间链接的 seed（见 BDD-8 修订说明）。
- **待 P2 取舍（rev1，必修 8，原为方案排除结论）**：`selectFile` / `useMarkdown` 的链接生成逻辑是否需要改动，由 P2 依据其影响面分析自行取舍。P1 只登记本节的事实（路径是纯 store 操作、`router` 不参与；query 仅用于列表页进入详情页且进入后被清），**不预先排除**任何改动面——若 P2 论证出这两处需要改动才能满足 BDD-8，以 P2 结论为准。

### 2.4 边界情形（逐条已核实，非新增决策）

| 边界 | 现状实测（debug :8888，v0.24.1） | 要求 |
| --- | --- | --- |
| slug 恰为 `f` 的 entry | `GET /f` → 200（走单段 `/:slug`） | 与 `/:slug/f` 无冲突，回归保持 |
| 不存在的 slug + `/f` | `GET /nonexistent-slug-xyz/f` → 200，渲染**路由级 NotFoundView**（根节点 `.not-found` 存在、文案 `Page not found`） | 与 BDD-18 同一判据：须走详情视图的条目缺失/错误态而非路由级 NotFoundView（见 BDD-18 的判据依据——不要求它必须命中 `Entry not found` 空态） |
| 不存在的 slug（无 `/f`） | `GET /nonexistent-slug-xyz` → 200，详情视图**错误提示态**（`.error-state`，文案 `Request failed with status code 404`），**不是** `.empty-state` 的 `Entry not found` | 作为 BDD-18 的对照基线（两条路径的解析语义应一致） |
| 中段路径 `/{slug}/f/<未知段>` | `GET /dsh-architecture/f/xyz` 类 URL 同样返回 200（catch-all） | BDD-19 拦截"新路由误匹配导致渲染 entry 内容"；不要求改为真 404 |
| JSON-accept 客户端访问 `/{slug}/f` | `Accept: application/json` → **404** | P1 登记为风险，P2 决策；不影响浏览器路径 |
| `/{slug}/f?share=token` | 组合天然可用（`?share=` 是 query，与 path mode 正交） | BDD-10 覆盖 |
| 已登录但无权限访问 `/{slug}/f` | 实测 `bob` 访问 `csv-employees`（`team_id: backend-solo`）→ **404**，与匿名一致 | 与匿名同判据；登记为"错误链接静默 404"的变体，无独立 BDD |
| 两段路径冲突 | 现存两段路由仅 `/settings/apikeys`（静态 redirect）与 `/users/:username` | 无冲突；未来新增 `/{slug}/xxx` 类路由须查冲突表（BDD-19 为可执行拦截） |
| **seed 可见性前提（rev1 新增，建议 15）** | **`is_public: true` ≠ 匿名可达**——带 `team_id` 的 entry 即使 `is_public: true`，匿名访问 `raw` 也是 **404**（实测：`csv-employees`/`markdown-test`/`mermaid-charts` 三条） | 所有 BDD 引用的 seed 必须写明可匿名访问或写明登录前提；本轮已逐条实测（见 3 节各条说明） |

- **数据面事实（rev1，建议 15）**：`team_id` 由 commit `59182590`（「给 seed entry 指派团队」，TPV0095）于 2026-09-03 引入，此后"公开 entry"不再等价于"匿名可见"。查询可见性以 `is_public` 单字段判断会在 E2E 中产生"匿名跑出 404 错误态"的假失败——本任务评审即因此发现 5 条 BDD 中 4 条的 seed 不可匿名达。

### 2.5 隐含需求清单（逐维度）

| 维度 | 结论 |
| --- | --- |
| 数据 | **无（就后端数据模型而言）**。不涉及 schema、不涉及存量数据迁移，后端零改动（P2 若决定处理 JSON 边缘，也只增分支不改表）。**但测试数据可用性是数据面的一部分（rev1 更正）**：BDD 引用的 seed 必须实测匿名可达或写明登录前提（`is_public: true` ≠ 匿名可达，见 2.4 末两行）；这一区分原版遗漏，是 5 条 BDD 中 4 条 Given 不可达的根因 |
| 前端 | **有**。`domains: frontend`——路由注册、zen 初始态与锁定语义、aria 公告文本三处；改动面见第 4 节同类扫描 |
| 多端 | **MCP / CLI / API 不同步**。MCP 的 `parseEntryRef`（`packages/mcp-server/src/lib/entryRef.ts:56-64`）只识别 `/raw` 后缀与单段 slug，传入 `/{slug}/f` 会抛 `EntryRefError('无法识别为 PeekView 链接')`。判定"本次不处理"：全屏链接是**人看**入口，Agent 读路径本就承诺 `/{slug}/raw`（P0-brief 已述），把 `/f` 纳入 MCP 反而会扩大契约面。**但须在本节显式登记**，避免下次有人把它当漏项 |
| 边界 | 见 2.4；核心是"错误链接静默 200"（BDD-13 正向 / BDD-18 负向 / BDD-19 中段路径）与"锁死不吞内容区 Escape"（BDD-7） |
| 兼容 | **不改现有行为**：`/{slug}` 与 f 键 zen 均须回归不变（BDD-11 / BDD-12）。风险点在"锁死态"判定若误写成全局 zen 状态，会把 f 键 zen 一起锁死——这是本任务最可能的实现期回归，故 BDD-4 与 BDD-12 成对设计 |

- **包声明口径（rev1，必修 7）**：`packages: [frontend-v3, docs]`、`domains: [frontend]`——与本节"后端零改动"结论一致，且为仓库实际路径式包名（先例：TPV0093 `[backend/peekview, frontend-v3]`、TPV0096 `[frontend-v3, docs]`）。R1（JSON-accept 边缘）**不在本次范围声明内**；若 P2 决定处理该边缘，须按 `[BASELINE_CHANGE]` 授权把 `backend/peekview` 加回 `packages` 与 `domains`（条件性声明，本基线默认不含）。

## 3. BDD 验收条件

> **修订后 BDD 总数：19 条（BDD-1 ~ BDD-19，连续不跳号）**——供 P6 全量核对，P6 的 PASS/FAIL 总数必须 ≥ 19。相对上轮（16 条）的变化：**新增 3 条**（BDD-17 = 原 BDD-15 的"独立 SVG"一半拆出；BDD-18 = 原 BDD-13 的负向判据拆出；BDD-19 = 中段路径静默 200 边界，新增判据），**无删除、无编号复用**（原 BDD-15 保留为 mermaid 一条、原 BDD-13 保留为正向一条）。

判定口径：以下每条均为 PASS / FAIL 二值判定，不接受"调整 / 跳过 / 覆盖"。证据锚点仅用于说明可观测位置，不构成 Then 子句的判定条件。
凡 Given 依赖 seed 数据者，均已实测其可访问性并写明前提（匿名可达 / 须登录），见各条说明与 §2.4 末两行。

### 3.1 全屏视图形态

#### BDD-1: 全屏视图形态：`/{slug}/f` 直入纯内容视图

- Given 一份公开 entry（seed 数据 `dsh-architecture`，多文件 markdown）与**桌面视口 1280×800**
- When 接收者访问 `/{slug}/f`
- Then 页面呈现该 entry 的主体内容（标题与正文文本可见），且标题栏、作者与时间信息区、文件侧栏、目录侧栏、移动端顶部条、移动端底部条**均不可见**
- 证据锚点：`.entry-detail` 根节点带 zen 类；上述 chrome 元素的 `getBoundingClientRect()` 高度为 0 或元素不在渲染树中
- 视口口径（rev1，建议 11）：本条按**桌面 1280×800** 判定。理由：「作者与时间信息区」（`.meta-tags-bar`）在桌面端**本就不渲染**（`EntryDetailContent.vue:24` 的 `v-if="isMobile"` + `layout.css:624-626` 的 `@media (min-width: 768px){display:none}` 双重隐藏），若不在 Given 指明视口，该子句在桌面下恒真、构成弱判据。移动端口径由 BDD-14 单独承担（390×844，该视口下 meta 条在非全屏态可见、全屏态须不可见）。

#### BDD-2: 布局结构：全屏视图下内容区占满视口可用区

- Given 全屏视图已加载完成
- When 测量唯一可见的顶层内容容器（`data-testid="content-area"`）的位置与尺寸
- Then 其顶边纵坐标与视口顶边之差 ≤ 1 px，且其高度 ≥ 视口高度 − 1 px
- 证据锚点：`getBoundingClientRect()` 的 `top` / `height` 与 `window.innerHeight` 比对

#### BDD-3: 视觉呈现：桌面端全屏视图无任何满宽顶部横条

- Given 桌面视口 1280×800，全屏视图已加载完成
- When 遍历页面内可见元素（可见性前置条件：bounding box 宽高均 > 0、`display ≠ none`、`visibility ≠ hidden`、`opacity ≠ 0`），按下列**两组互为不对称的排除规则**剔除后得到候选集，并统计候选集中位于视口顶边起 100 px 区间内的元素：
  - **A 组（结构链）**：`html`、`body`、`#app`、`.entry-detail` —— 逐元素排除**其自身与其全部祖先**，**不含其后代**。（关键：`.detail-header`/`.title-row`/`.meta-row` 等 chrome 恰是 `.entry-detail` 的**后代**，若连后代一起排除，真实横条会被一并排掉、判据恒真失效；`html` 若取其**后代**则等于排除整个文档，同样失效。）
  - **B 组（内容流容器链）**：`.detail-content`、`.content-area`、`.markdown-viewer`、`.code-viewer`、`.table-view`、`.image-viewer`、`.html-viewer`、`.empty-state`、`.error-state`、`.loading-state` —— 逐元素排除**其自身与其全部后代**（整棵子树）。理由：这些是"正文内容流"的载体，其内部任何满宽块级元素都属于内容本身而非 chrome，不应计入拦截目标。
  - 两组规则**不可互换、不可统一写成"祖先/后代"**：A 组取祖先、B 组取后代，是本条判据成立的全部要点。
- Then 候选集内不存在宽度 ≥ 视口宽度 90% 且高度 ≥ 8 px 的可见横条元素，且内容区左右边界与视口边界之差各 ≤ 1 px
- 证据锚点：遍历可见元素 bounding box 计数；桌面端本就不渲染 meta 条（`v-if="isMobile"` + `@media(min-width:768px)` 双重隐藏），故该条同时是"视觉呈现无回归"的基线
- 修订说明（rev1，必修 1）：原判据未排除容器/根元素，与 BDD-2 直接互斥——BDD-2 要求内容区 `top=0` 且高 = 视口高，而满足该要求的 `.content-area`（1280×800）本身就命中原判据的禁项。本轮改法为**排除全屏视图的内容流容器链**（而非限定 `position: fixed|sticky`），因为「满宽横条」在 CSS 上是布局特征而非定位特征，限定定位类型会给实现期引入"横条不能是 static/fixed 之外的定位方式"这类无依据约束。
- 修订说明（rev2，必修 1 二次修订）：rev1 把"上述任一元素的**祖先/后代**"**无差别套用到全部候选元素**，而候选元素含 `html` → `html` 的后代 = 整个文档 → 候选集恒为空 → **Then 恒真、拦截力归零**（实测：正确实现与两种失败态命中数均为 0）。本轮按上列 A/B 两组把传播方向拆开（A 组取祖先、B 组取后代）后，判据**既通过正确实现、又能拦下两种失败态**。rev1 自证第 3 点（"排除集外仍真实存在满宽横条……会造成 ≥ 1 命中 → FAIL"）在该错误写法下**已被实测证伪**，现按新写法重新自证于下。
- **负向对照实测自证（rev2，Playwright/CDP，桌面 1280×800，debug :8888 v0.24.1，seed `dsh-architecture`，zen 态；`/{slug}/f` 路由尚未实现，故以既有 f 键 zen 作为"正确全屏实现"的控制组）**——三态均按上列 A/B 规则实测：
  1. **① 正确实现（chrome 全隐藏）→ 命中 0（PASS）**：页面内可见且满宽（≥ 90% 视口宽，即 ≥ 1152 px）、高 ≥ 8 px 的元素，**全文档口径共 7 个**——`html`/`body`/`#app`/`.entry-detail.zen-mode`/`.detail-content`/`.content-area` 各 1280×800（top=0）、`.markdown-viewer` **1238×4399**（top=16）；其中位于 `.entry-detail` 子树内者 4 个。这 7 个**全部落入排除集**（前 3 个按 A 组自身+祖先，`.entry-detail`/`.detail-content`/`.content-area` 分别按 A 组自身、B 组自身+后代，`.markdown-viewer` 按 B 组自身+后代）→ 候选集 = 0 个元素 → 命中数 **0**。
  2. **② 失败态 A：`.detail-header` 强制恢复可见 → 命中 3（FAIL，拦截力已恢复）**：以 CDP 注入 `display:flex!important` 覆盖 zen 隐藏规则后，出现 3 个满宽可见横条，**均不在排除集内**——`header.detail-header`（1280×107，top=0）、`.title-row`（1232×44，top=12）、`.meta-row`（1232×26，top=68）。三者均落在视口顶边起 100 px 区间内 → 命中数 **3 ≥ 1 → FAIL**。（对照：rev1 错误写法下同一状态命中数为 **0**，即"应 FAIL 却判 PASS"。）
  3. **③ 失败态 B：注入一条未纳入隐藏集的满宽横条 → 命中 1（FAIL）**：在 `.entry-detail` 内注入 `#bespoke-bar`（`position:fixed; top:0; width:100%; height:40px`，实测 1280×40、top=0，不在任何隐藏规则与排除集内）→ 命中数 **1 ≥ 1 → FAIL**。（对照：rev1 错误写法下同一状态命中数为 **0**。）
  4. **结论**：①=0 / ②=3 / ③=1 三态构成闭环——判据对正确实现判 PASS、对"chrome 未隐藏"与"新造未纳入隐藏集的横条"两种失败态均判 FAIL。**仅验①不足以证明判据有效**（rev1 的失效正是只验了"正确实现下为 0"）；②③ 是本条保留拦截力的实测证据。判据保持二值判定，且不再与 BDD-2 互斥。
  5. **数字口径说明（rev2 自测，非沿用任何他方数字）**：rev1 自证第 2 点写"实测只有 **4** 个元素（`.markdown-viewer` **1248×4431**）"——本轮复核：**4** 是 `.entry-detail` **子树内**的计数，全文档口径为 **7**；`.markdown-viewer` 实测为 **1238×4399**（宽 1238 = 1280 − 内容区左右各 21 px 内边距）。此处以本轮全文档口径的 7 个 / 1238×4399 为准。

### 3.2 锁定语义与无页内出口

#### BDD-4: 交互行为：全屏视图内按 f 不改变视图

- Given 已通过 `/{slug}/f` 进入全屏视图
- When 依次按 `f`、`F`、`Ctrl+f`
- Then 视图状态不变——chrome 可见性、内容区位置尺寸、URL 三者均与按键前一致
- 证据锚点：按键前后各取一次 chrome 可见性 + content-area bounding box + `location.pathname` 快照并逐项比对

#### BDD-5: 交互行为：全屏视图内按 Escape 不改变视图

- Given 已通过 `/{slug}/f` 进入全屏视图
- When 按 `Escape`
- Then 视图状态不变（chrome 仍不可见、内容区位置尺寸与 URL 均不变）
- 证据锚点：同 BDD-4
- **优先级（rev1，建议 9）**：本条只约束"全屏视图**状态**"（chrome 可见性 / 内容区几何 / URL）；当内容区内嵌组件自身正在消费该 Escape 时（如分页浮层打开中），其消费**优先**，视图状态同样保持不变——即"内嵌组件消费 Escape"与"本条无变化"可同时成立，优先级的可执行判据见 BDD-7。

#### BDD-6: 交互行为：全屏视图不向用户宣告任何退出方式

- Given 已通过 `/{slug}/f` 进入全屏视图
- When 读取屏幕阅读器公告区（`aria-live` 区域）文本，并枚举**全屏视图自身 chrome 范围内**的全部可聚焦元素
- Then 公告文本既不包含"退出方式"提示词组「`Press f or Escape to exit`」「`按 f 退出`」中的任何一项，也不包含子串 `Escape` 或 `exit`；且该范围内不存在标签或标题（`textContent` / `aria-label` / `title` 三者任一）命中**退出词表**「`退出`」「`返回`」「`exit`」「`关闭全屏`」「`退出全屏`」「`Exit fullscreen`」「`Close fullscreen`」，且激活后能离开全屏视图的可聚焦控件
- **作用域（rev1，建议 10）**：本条的枚举范围限定为"全屏视图**自身** chrome"（根节点 `.entry-detail` 内、但**排除内容区及其后代**）。理由：内容区内的内嵌组件自带自己的弹层控件（如图表全屏弹层的关闭按钮，标签为 `Close`），它们关闭的是**组件自己的弹层**、不改变全屏视图状态，不与本条冲突；把作用域写清可避免与 BDD-15 的弹层关闭控件产生措辞层面的偶发互斥。
- 证据锚点：公告区 `textContent` 断言 + 可聚焦元素清单（`button, a[href], [tabindex]:not([tabindex="-1"])` 且 bounding box 高 > 0）逐项按词表核对
- 修订说明（rev1，建议 10）：原 Then 的"……语义"为主观判定，本轮改为**枚举式词表**（上列退出词表为闭集，命中任一即 FAIL）；同时限定作用域为全屏视图自身 chrome。
- **本轮实测（alice 登录，zen 态，seed `mermaid-charts` — 该 seed 的图表工具栏是全屏视图内可聚焦元素最多的一例）**：公告区仅 1 个 `.sr-only[aria-live]`，文本为 `Zen mode on. Press f or Escape to exit.`（锁死态下必须改掉，否则本条 FAIL）；内容区**之外**的可聚焦元素计数 0——实测的 3 个（`Toggle Diagram/Code`、`Fullscreen`、`More actions`）全部位于内容区内，按本作用域不计入；故锁死态下本条的可执行判据是"公告文本改掉 + 该范围可聚焦元素为 0 或无一命中词表"。

#### BDD-7: 交互行为：锁死不吞掉内容区内嵌组件的 Escape 行为

- Given 通过 `/{slug}/f` 进入含表格的 entry 全屏视图（seed `tsv-server-metrics`，**匿名可见，无需登录**）
- When 打开内容区内的分页选择浮层后按 `Escape`
- Then 该浮层关闭，且全屏视图仍保持（chrome 仍不可见、URL 不变）
- **优先级（显式声明，rev1 建议 9）**：内容区内嵌组件自身的 Escape 消费（元素级 `@keydown`）**优先于**锁死短路；锁死只约束"全屏视图**状态**"（chrome 可见性 / 内容区几何 / URL 三者不变），不约束内容区内嵌浮层的开合。即：本条与 BDD-5 的判定对象不同，逻辑上不冲突——BDD-5 管"视图状态"，本条管"内容区内的浮层"。
- 证据锚点：浮层元素从可见转为不可见 + 全屏视图快照未变；该浮层为元素级键盘处理（`TableView.vue:227` 的 `@keydown` → `onTriggerKeydown`，`:243` 分支消费 Escape），不被 `document` 级锁死短路吞掉
- 修订说明（rev1，必修 2）：原 Given 用 seed `csv-employees`，实测其 `meta.json` 虽为 `is_public: true` 但带 `team_id: backend-solo` → **匿名 404**（carol=owner 200 / alice=admin 200），Given 隐含"需登录"未写明。本轮改换为**匿名可见**的 `tsv-server-metrics`（本轮实测：匿名 `raw` 200、表体 60 行、`.per-page-trigger` 可见且 `perPage` 默认 100 下不触发截断）。
- **本轮实测（匿名，zen 态，seed `tsv-server-metrics`）**：表体 `tbody tr` = 60、`.per-page-trigger` 计数 1 且可见；点击后 `.per-page-listbox` 出现（高度 134，含 `50/100/500` 三项）；按 `Escape` 后 listbox 从 DOM 消失，而全屏视图保持（URL 无变化）——注意：本轮该次操作是在「按 `f` 进入的 zen 态」下做的，故 Escape 同时退出了 zen；`/{slug}/f` 下锁死态的正确行为是"浮层关闭、zen 保持"，这正是本条要拦截的实现期回归（对应 R4）。

### 3.3 mode 保态与内容能力

#### BDD-8: 多文件 entry 内切换文件保持全屏

- Given 通过 `/{slug}/f` 打开多文件 entry（seed `unicode-filenames`，**匿名可见**；内容区正文内含指向同 entry 其它文件的相对链接）
- When 在内容区内点击该文件间链接（切换到另一个文件）
- Then 全屏视图保持不变（chrome 仍不可见、URL 的 `/f` 后缀仍在），且内容区显示的正文文本已切换为新文件的内容
- 证据锚点：切换前后 `location.pathname` 一致 + 内容区正文文本变化（切换前为 `README.md` 的渲染正文，切换后为被链接文件的正文）
- **两件事分开表述（rev1，必修 3）**：本条由两个**独立**性质组成，不可混同——(a) **切换动作可达**：全屏视图内确实存在可操作的文件切换入口；(b) **保态成立**：切换动作完成后仍处于全屏视图且内容已切换。(a) 是本条 Given 的前置条件（全屏下 `.file-sidebar` 被隐藏、抽屉触发控件位于同样被隐藏的 header / mobile bar，故**并无通用的文件切换 UI**，入口只能来自正文内的文件间链接）；(b) 是 Then 的判据。原 §2.3 证明的是 (b)，却把它当作 (a) 成立的依据，本轮已分开。
- 修订说明（rev1，必修 3）：原 Given 用 seed `multi-format-demo`，实测其 4 个文件（`config.json`/`data.csv`/`docker-compose.yml`/`notes.md`）**互相之间 0 个 markdown 链接**、`data-peekview-file-id` 计数为 0 → 全屏视图内**无任何文件切换入口**，When 不可执行。本轮改用本轮实测可用的 `unicode-filenames`。
- **本轮实测（匿名，zen 态，seed `unicode-filenames`）**：内容区内 `a[data-peekview-file-id]` = 2（`中文附件下载` → id 37、`English attachment` → id 34，均可见可点）；点击第一个后，`path` 仍为 `/unicode-filenames`、zen 类仍在，正文由 `README.md`（8 个标题、347 字符）切换为被链接文件的正文（49 字符，首行为"这是中文文件名附件的占位内容…"）→ (a)(b) 均可执行且成立。

#### BDD-9: markdown entry 带目录时无目录侧栏且锚点滚动正常

- Given 通过 `/{slug}/f` 打开含标题层级与**正文内标题锚点链接**的 markdown entry——**前置条件：须以 alice 或 bob 身份登录**（seed `markdown-test` 的 `rich-markdown.md`，该 seed 为 `is_public: true` 但带 `team_id: frontend-team`，匿名 404，详见 2.4）；为打开该文件须带 `?firstFileId`（本轮实测该 md 的文件 id = 43）
- When 点击正文内的一条 `](#...)` 标题锚点链接（触发路径 = 浏览器默认的锚点跳转）
- Then 目录侧栏不可见；且**滚动容器 `.content-area` 自身**（`data-testid="content-area"`，`overflow-y: auto`）的 `scrollTop` 在点击后增加 > 0
- 证据锚点：目录侧栏 bounding box 高度为 0 / `display: none`；**容器限定为 `.content-area`**（该页面的滚动发生在这个自身可滚动的容器内，与 window 滚动是两套，`window.scrollY` 恒为 0，不可作为判据）；`scrollTop` 前后差值
- 触发路径说明（本轮实测）：`MarkdownViewer.handleLinkClick`（`MarkdownViewer.vue:78-93`）对普通 `](#heading)` 链接**既不 `preventDefault` 也不 `scrollIntoView`**（仅 footnote 链接才拦截），实际滚动由浏览器默认锚点行为完成；`TocNav.scrollTo` 是另一条路径（且全屏下目录侧栏不可见、不可点）。故本条**必须**用"点击正文内链接"这条路径，不得用 TOC 点击。
- 修订说明（rev1，必修 4）：原 Given 用 seed `dsh-architecture`，实测其 `ARCHITECTURE.md` 正文 `](#` 锚点链接数 = **0**（仅 2 条 http 外链）→ **无对象可点**；且原 Then 的 `scrollTop` 未绑定滚动容器与触发路径，P6 无法二值复现。本轮换用真正含正文锚点链接的 seed 并写明登录前提，同时绑定容器与触发路径。
- **本轮实测（alice 登录，zen 态，seed `markdown-test` + `?firstFileId=43`）**：点击前 `.content-area` = `{scrollTop: 0, scrollHeight: 15626, clientHeight: 800}`、正文内 `a[href^="#"]` = 10 条；点击第 7 条（`#7-安全策略`）后 `scrollTop` = **10341**（差值 10341 > 0）、`location.pathname` 仍为 `/markdown-test`、zen 类仍在、`.toc-sidebar` 的 bounding box 高度 = 0 且 `display: none`（目录侧栏不可见）→ 判据可达。

### 3.4 分享与私有 entry

#### BDD-10: 私有 entry + share token 组合可用

- Given 一份私有 entry 及其有效 share token（E2E 内自建，slug 带 `e2e-` 前缀，不依赖 seed 私有数据的既有 token）
- When 访问 `/{slug}/f?share=<token>`
- Then 全屏视图成立（chrome 均不可见）且私有内容主体文本可见（不出现鉴权失败或无权限提示）
- 证据锚点：内容区出现该 entry 的特征文本 + chrome 可见性断言
- 清理钩子（rev1，建议 13，对齐 TPV0096 规范）：本条自建的 entry 必须在 `afterEach` 中清理（删除该 entry），不留残留数据；与 BDD-10 配套的 E2E 用例不得依赖前一条用例的残留状态。

### 3.5 回归

#### BDD-11: 回归：`/{slug}`（无 f）现有行为不变

- Given 一份公开 markdown entry
- When 访问 `/{slug}`
- Then 完整页面形态成立——**主体判据：标题栏与内容区在桌面视口下同时可见，且 chrome 未隐藏**（内容区顶边纵坐标 = 该 `/{slug}/f` 全屏视图下无法观测的完整页形态）
- 辅助证据（rev1，建议 12，不单独构成判定）：响应头仍带 `/api/v1/entries/{slug}/raw` 的 alternate Link
- 证据锚点：桌面端标题栏元素可见 + 内容区可见；`Link` 响应头存在（实测控制组已确认该头存在：`link: </api/v1/entries/{slug}/raw>; rel="alternate"; type="application/json"`）
- 修订说明（rev1，建议 12）：原 Then 把响应头判据与可见性判据并列为判定条件，但该响应头是**服务端响应头**且与全屏链接无关（`/{slug}` 不变则头自然不变），属弱判据 → 本轮降为辅助证据，主体判据用可见性断言。

#### BDD-12: 回归：既有 f 键 zen 视图外观与语义不变

- Given 打开 `/{slug}`（无 f）
- When 按 `f` 进入 zen，再按 `Escape` 退出
- Then 进入后 chrome 与元信息条的可见性、内容区位置尺寸与 `/{slug}/f` 全屏视图一致；退出可正常恢复完整页面；公告文本在进入时仍宣告可用 `f` 或 `Escape` 退出
- 证据锚点：按 f 后与全屏视图逐项比对快照 + 退出后标题栏恢复可见；本任务**不得**改动既有 zen 的外观与 `Escape` 退出能力
- 说明：本条是 P0 时效性更正（第 5 节）直接产出的回归项——被更正掉的是"外观需要统一"，留下的是"既有外观不得被破坏"

#### BDD-13: 回归：`/{slug}/f` 不再静默渲染路由级 NotFoundView

- Given 一份**存在**的公开 entry（seed `dsh-architecture`）
- When 访问 `/{slug}/f`
- Then 页面不出现路由级 NotFoundView 的"Page not found"文案，而是进入全屏内容视图（BDD-1 的形态）
- 证据锚点：页面文本不含路由级 NotFoundView 的标题 `/Page not found/`，且根节点 `.not-found` 不存在（实测现状为存在时命中该文案：`GET /yaml-docker-compose/f` → 200 + `Page not found`）
- 修订说明（rev1，必修 6）：原条把"存在 slug"与"不存在 slug"两个**不同 Given** 打包在同一 BDD（负向判据以"补充"形式写在 Then 之后），违反"每条 BDD 只有一条 Given-When-Then"。本轮把负向判据拆出为独立编号 **BDD-18**，本条只保留正向判据。

### 3.6 移动端

#### BDD-14: 移动端全屏视图无移动端 chrome 且内容区占满视口

- Given 移动视口 390×844（Pixel 5 等效）
- When 访问 `/{slug}/f`
- Then 移动端顶部条、移动端底部条、元信息条**均不可见**，且内容区顶边与视口顶边之差 ≤ 1 px、高度 ≥ 视口高度 − 1 px，页面在内容超出时仍可纵向滚动到正文末尾
- 证据锚点：三类 chrome 元素的 bounding box 高度为 0 或不在渲染树；内容区 bounding box 与 `innerHeight` 比对；滚动到 `scrollHeight` 后末段正文文本可见
- 说明：P0-brief 已登记"移动端 zen 布局此前未在锁死状态下验证"为风险，本条为该风险的验收出口

### 3.7 图表类内容

#### BDD-15: 图表类 entry（mermaid）全屏下渲染与内置查看能力正常

- Given 通过 `/{slug}/f` 打开含 mermaid 代码块的 markdown entry（seed `mermaid-charts`）——**前置条件：须以 alice 或 bob 身份登录**（该 seed 为 `is_public: true` 但带 `team_id: frontend-team`，匿名访问 404，详见 2.4）
- When 等待渲染完成，并点击图表工具栏的全屏按钮
- Then 图表 SVG 已渲染（画布尺寸大于 0），全屏弹层可见，且弹层的关闭控件可将其关闭并回到内联视图
- 证据锚点：SVG 元素 bounding box 宽高 > 0；弹层可见性由不可见转可见再转不可见
- 说明：本条不要求 Escape 关闭弹层（当前实现无此能力，且 t022 的 Escape 断言所依赖选择器已死）——只要求既有的关闭路径可用，避免把"实现新能力"混入本任务。**本轮实测（alice 登录，zen 态）**：`.diagram-block` = 1、`.fullscreen-btn` = 1、内联 SVG = 1（850×400）；点击后 `.diagram-modal` 高度 800，点其 `.close-btn` 后弹层消失、内联 SVG 恢复且 URL 仍为 `/{slug}`（`/f` 形态下同理，URL 不含 query）。
- 修订说明（rev1，必修 5）：原 Given 用"and"把 `mermaid-charts` 与 `svg-icons` 两个**性质不同、可见性不同**的 entry 串成一条，且事实有误——`mermaid-charts` 不含 svg（3 个 `.md` 全是 mermaid 代码块），`svg-icons` 走的是 `ImageViewer` 路径、**不存在**全屏按钮。本轮按性质拆为 BDD-15（mermaid）与 BDD-17（独立 SVG，见 3.9 节）。

### 3.8 人工体验路径

#### BDD-16: 人工体验路径：按文档 seed 后全屏链接页面有内容

- Given 开发者按项目文档执行 `make debug-start` + `make debug-seed` 得到干净 debug 环境（:8888，seed 数据）
- When 人工（或等价脚本）在浏览器打开任一公开 seed entry 的全屏链接，例如 `/dsh-architecture/f`
- Then 页面在无需额外构造数据的前提下即呈现该 entry 的正文内容（正文文本非空、图表类 entry 的图表可见），全屏形态成立
- 证据锚点：截图 + 内容区文本长度 > 0；本条**不得**只用 fixture 或单测断言替代
- 说明：seed 中公开 entry 共 15 条（匿名可见口径），可用于本条；私有 seed entry 不适用

### 3.9 图表类（独立 SVG）与边界回归（rev1 新增编号，接在 BDD-16 之后）

#### BDD-17: 图表类 entry（独立 SVG 文件）全屏下图片正常渲染

- Given 通过 `/{slug}/f` 打开一份**独立的 SVG 文件 entry**（匿名可见，seed `svg-icons` 或 `svg-standalone`；二者实测匿名 `raw` 均 200）
- When 等待渲染完成
- Then 内容区出现该 SVG 以 `img` 元素渲染的图片，且其 bounding box 宽高均 > 0；同时全屏形态成立（chrome 不可见、URL 的 `/f` 后缀保留）
- 证据锚点：内容区 `img` 元素计数 ≥ 1 且 bounding box 宽高 > 0；chrome 可见性与 `location.pathname` 断言
- 说明（本轮实测，zen 态）：`svg-standalone` → `img` 1 个（800×600，naturalWidth 800）；`svg-icons` → `img` 1 个（24×24，图标原始尺寸）。二者均**不渲染内联内容区 SVG**（`contentAreaSvg` = 0），也**不存在**图表工具栏的 `.fullscreen-btn`（计数 0）——本条因此只断言图片渲染与全屏形态，**不要求**全屏按钮/弹层（该能力属图表渲染组件路径，见 BDD-15）。
- 修订说明（rev1，必修 5）：本条由原 BDD-15 的"独立 SVG"一半拆出，更正了"`svg-icons` 是含 svg 图表的 markdown entry"这一事实错误（它是 `ImageViewer` 路径的独立 SVG 文件 entry），并把两个 entry 各自的可匿名访问性写明；据此新增编号 BDD-17，置于 BDD-16 之后，保持 BDD-1~BDD-19 连续不跳号。

#### BDD-18: 边界：不存在的 slug + `/f` 不落路由级 NotFoundView

- Given 一个在 seed 中**不存在**的 slug（如 `nonexistent-slug-xyz`）
- When 访问 `/{slug}/f`
- Then 页面**不**呈现路由级 NotFoundView（根节点 `.not-found` 不存在，且文本不含 `Page not found`），而是呈现详情视图的条目缺失/错误态（`.entry-detail` 与内容区 `data-testid="content-area"` 均存在）
- 证据锚点：`.not-found` 选择器计数 = 0；`.entry-detail` 存在。实测现状（`/nonexistent-slug-xyz/f` → HTTP 200 + `Page not found` + `.not-found` 存在）在本条下为 FAIL，即本条用于拦截"实现后仍落 catch-all"。
- 判据依据（避免"未定义行为被写成硬要求"的质疑）：本条**不新增**产品行为定义，而是要求 `/{slug}/f` 与既有的 `/{slug}` 单段路由在**同一不存在 slug** 上解析语义一致——`/f` 只是同一详情视图的模式后缀，不应改变路由解析结果。判定边界（P1 不裁定、交 P2）：不存在 slug 时详情视图是呈现 `Entry not found` 空态还是错误提示态，取决于 P2 如何让 `/f` 路由在取不到 entry 时自处（沿用现状 404→错误提示即可）；**唯一硬性要求是不落路由级 NotFoundView**。
- 修订说明（rev1，必修 6）：本条由原 BDD-13 的"补充（负向判据）"拆出为独立编号，使 BDD-13 恢复"每条一组 Given-When-Then"。

#### BDD-19: 边界：中段路径不误匹配并渲染 entry 内容

- Given 一份存在的公开 entry（seed `dsh-architecture`）
- When 访问其**中段路径**「`/{slug}/f/<未知段>`」（如 `/dsh-architecture/f/xyz`）
- Then 页面不渲染该 entry 的详情内容（内容区不出现该 entry 的正文特征文本、`.entry-detail` 详情骨架不成立）
- 证据锚点：页面文本不含该 entry 的正文特征串（如 `总体架构`）；`.not-found` 存在或页面为错误态
- 说明（实测现状，登记为"静默 200"观察）：该类 URL 当前与 `/{slug}/f` 一样返回 **HTTP 200**（`serve_spa_catchall` 返回 index.html → NotFoundView）。本条**不要求**改成真 404（那属后端行为变更，超出本任务范围），只要求在新增 `/:slug/f` 路由后**不得**变成"渲染该 entry 内容"——即新路由的段数匹配必须严格。
- 判据依据：本条把 §2.4「两段路径冲突」与 §4.4 的冲突表约定从散文登记升级为可执行判据，用于拦截"把 `/:slug/f` 写成带通配/前缀匹配导致中段路径误命中"的实现期回归。
- 新增编号声明（rev1）：本条为修订轮**新增**（对应 review 第三节"边界维度"中"错误链接静默 404/200 的变体"未被 BDD 覆盖的缺口），主 Agent 可裁掉；编号接在 BDD-18 之后以保持连续。

## 4. 同类扫描结论

扫描范围：`frontend-v3/src`（产品代码）、`frontend-v3/e2e`、`backend/peekview`、`packages/mcp-server/src`、根级文档与 `CHANGELOG.md`。`agate-workspace/` 为流程记录、`frontend-v3/dist` 与 `backend/peekview/static` 为构建产物，均不纳入判定。

### 4.1 逐符号命中清单与判定

| 扫描目标 | 命中数（文件数） | 命中文件 | 判定 |
| --- | --- | --- | --- |
| `zen-mode`（CSS 隐藏集） | 13（2） | `styles/layout.css`(7)、`views/EntryDetailView.vue`(6) | **本次处理**（改动的遗漏面核心）：隐藏集分布在两文件，见 4.2 |
| `meta-tags-bar` | 13（6） | `EntryMetaTagsBar.vue`(2)、`layout.css`(6)、`EntryDetailView.vue`(1)、3 个测试文件(4) | **本次不处理**（已天然满足，零 CSS 改动）；仅作 BDD-12 回归对象 |
| `ZenModeKey` | 11（6） | `entryDetailKeys.ts`(1)、`EntryDetailView.vue`(2)、`EntryDetailHeader.vue`(2)、`EntryDetailMobileBar.vue`(2)、2 个组件测试(4) | **本次处理**（事实面）：锁死态信息**必须**经由这个 provide 面到达两个消费方组件（它们据 zen 态决定自身 chrome 的显示）——**承载方式（新增状态字段 / 改类型 / 其他）待 P2 取舍**；消费方 2 个组件需随 P2 选定方式一并核对 |
| `zenAriaText` | 9（5） | `useZenMode.ts`(3)、`entryDetailKeys.ts`(1)、`EntryDetailView.vue`(3)、2 个组件测试(2) | **本次处理**：BDD-6 的直接对象（锁死态文案不得宣告退出方式）；**文案分支形态待 P2 取舍** |
| `updateZenAria` | 6（3） | `useZenMode.ts`(4)、2 个组件测试(2) | **本次处理**（事实面）：锁死态与既有 zen 态的公告文本要求不同，故此函数的行为须随状态区分；**实现位置与分支形态待 P2 取舍**；两个测试文件（`useZenMode` 相关）的用例需随 P2 选定方式同步 |
| `zenMode`（状态变量） | 26（9） | `useZenMode.ts`(7)、`EntryDetailView.vue`(3)、`EntryDetailHeader.vue`(3)、`EntryDetailMobileBar.vue`(2)、`entryDetailKeys.ts`(1)、4 个测试文件(10) | **本次处理**：锁死语义的落点；测试 mock 面须同步 |
| `shouldHandleZenShortcut` | 44（5） | `utils/zen-shortcut.ts`(1)、`composables/useZenMode.ts`(2)、`utils/zen-shortcut.spec.ts`(16)、`utils/__tests__/zen-shortcut.spec.ts`(24)、`components/__tests__/t067-detail-framework.spec.ts`(1) | **本次不处理**（事实面）：该纯函数只判"是否该处理快捷键"、不持有 zen 状态，故锁死短路**不需要**改它；若有实现把它当作短路位置则属 P2 的取舍，P1 不预设 |
| `redirectFocusIfHidden` | 16（5） | `utils/zen-shortcut.ts`(1)、`useZenMode.ts`(1)、两个 spec(14) | **本次不处理**（同上，签名不变） |
| `/:slug/f` 两段路由 | 0（0） | 无 | **本次新增**（唯一一处，无既有实例）；两段路由现存 `/settings/apikeys`、`/users/:username` 均无冲突 |

### 4.2 zen 隐藏集的完整分布（P0 事实 B 的做实与更正）

P0-brief 与 dispatch-context 记的是"三处机制 / 第 7 项"，P1 全量扫描后**更正为 8 项隐藏规则 + 3 处独立机制**：

| 序 | 选择器 | 位置 | P0/事实 B 是否已列 |
| --- | --- | --- | --- |
| 1 | `.detail-header` | `layout.css:649` | 是 |
| 2 | `.file-sidebar` | `layout.css:650` | 是 |
| 3 | `.toc-sidebar` | `layout.css:651` | 是 |
| 4 | `.mobile-actions` | `layout.css:652` | 是（**死选择器**：`src` 内无任何组件渲染该类，仅 `zen-shortcut.ts:16` 的焦点判断仍引用它，见 4.3） |
| 5 | `.mobile-sticky-header` | `layout.css:653` | 是 |
| 6 | `.mobile-bottom-bar` | `layout.css:654` | 是 |
| 7 | `.meta-tags-bar` | `EntryDetailView.vue:260`（scoped `:deep()`） | 是（第 7 项） |
| 8 | `.resize-handle` | `layout.css:208` | **否——P1 新发现**，不在 P0 所列 6 项、也不在 dispatch 事实 B 的"第 7 项"叙述内 |
| 补充 | 移动端 chrome 的 `v-show="!zenMode"` 兜底 | `EntryDetailHeader.vue:3,13`、`EntryDetailMobileBar.vue:2` | 是（第三处机制） |
| **补登（rev1，建议 14）** | `.expired-warning-banner` / `.archived-banner` | `EntryDetailBanners.vue`（渲染在 `.entry-detail` 内、`EntryDetailContent` **之外**） | **否——本轮补登**：二者**不在任何 zen 隐藏规则中**（`layout.css` 与 `EntryDetailView.vue` 的 scoped 块均无这两个选择器）。当前 seed 无过期/归档 entry，故**不构成本任务 BDD 失败**；但本节用途是"给 P2 划定完整改动面清单"，P2 若选择"不复用 zen 类而新造隐藏规则"，必须把这两条一并纳入评估 |

- **影响判定（rev1 修正）**：本任务若按"零 CSS 改动"实施，则第 8 项与上述"双文件分布"都不构成改动面；但**它是 BDD-2 / BDD-12 的判定前提**——若实现期为锁死态另立一套隐藏规则，则第 7 项（scoped）、第 8 项（`.resize-handle`）与补登的两条 banner 选择器都需纳入覆盖清单，否则会在全屏视图残留。**是否复用 zen 类属 P2 取舍**，本节只提供"无论怎么选都必须覆盖的完整清单"。故本节结论的用途是**给 P2 的改动面划定完整清单**，而非要求现在改它们。
- **另一处未列入 P0 的隐藏**：`.meta-tags-bar` 在桌面端另有 `@media (min-width: 768px) { display: none }`（`layout.css:624-626`）——即第 7 项已有两道隐藏（组件级 `v-if="isMobile"` + 桌面媒体查询）。这是 BDD-3 把断点定在桌面 1280×800 的依据。

### 4.3 扫描顺带发现的三处存量问题（本次判定：不处理 + 理由）

1. **死选择器 `.mobile-actions`**：`src` 内 0 个组件渲染该类（唯一引用是 `zen-shortcut.ts:16` 的 `closest()` 判断与 `layout.css:133-162` 的样式定义）。本次不处理——它被 `layout.css:652` 的隐藏规则与 `zen-shortcut.ts` 的焦点兜底引用，删除会同时触碰两处与本任务无关的逻辑；且保留无功能危害（无害的多余选择器）。
2. **重复的 zen-shortcut 测试文件**：`src/utils/zen-shortcut.spec.ts`（180 行）与 `src/utils/__tests__/zen-shortcut.spec.ts`（238 行）同时存在，内容高度重复（后者多出 T044 的修饰键用例 TC-15~TC-21）。本次不处理——`zen-shortcut.ts` 本身不改（见 4.1），重复文件不构成本任务的回归面；但 P4 若有任何改动触及该 util，两处都需同步，**在此显式登记以免遗漏**。
3. **`meta-tags-bar` 的死 CSS 与假绿测试**：`.meta-tags-bar.hidden { opacity: 0 }`（`layout.css:480`）在全仓无任何代码添加该 class；`src/__tests__/t052-header-redesign.test.ts:141` 的 "meta-tags-bar uses IntersectionObserver" 断言体为 `expect(true).toBe(true)`（恒真）。本次不处理——与本任务无关，且在有意保留测试面积的前提下改它属于范围外改动。

### 4.4 回归拦截手段（同类问题未来复发的拦截）

- BDD-13 与 BDD-11 覆盖路由层：新增两段路由若再被 catch-all 静默放行，E2E 将失败
- BDD-12 覆盖既有 zen 外观：任何扩大锁死范围导致 f 键 zen 被一起锁住的实现，会被该条拦截
- 冲突表约定（写入 P2/P7 文档，非代码 gate）：新增 `/{slug}/xxx` 类两段路由前须检查与 `/:slug` 系列的匹配顺序，本次已确认现存两段路由无冲突

## 5. P0-brief 时效性核对

[P0_STALE: P0-brief 决策 ③「元信息条一并隐藏」与 known_risks 第 1 条的前提为假——`.meta-tags-bar` 自 T082-P4（commit 59ab6f7e，2026-07-30，早于本任务立项 09-16）起已在 zen 下被 `display: none` 隐藏，不存在"zen 外观统一"的取舍；已更新 P0-brief 的 task 决策 ③、known_risks 第 1 条、实现要点第 4 条，并在 known_risks 追加"/{slug}/f 静默落 NotFoundView"新风险项]

**严重性判定（P1 复核结论：轻微，不重开 P0）**：

- 按 P0 卡三条严重判据逐条核对：判据 1（`task` 目标方案仍成立）✅、判据 2（`executor_env` 平台前提仍成立）✅、判据 3 命中的是一条**被当作待决取舍的风险项**，实核后证明是**前提事实错误**而非"未解决前提"
- 更正后任务目标、URL 方案（path 后缀）、锁死语义、后端零改动四项**全部不变**，仅**范围缩小**（去掉无意义的 CSS 分支与用户确认项）→ 不构成"目标方案不再成立"
- 主 Agent 已于 2026-09-28 就地更新 P0-brief 字段并标注 `[P0_STALE]`；P1 独立复核其证据链（DOM 实测 `display:none`/h=0、vision 独立复核"顶部无窄横条"、git 溯源 59ab6f7e）**均成立**

**P1 本轮独立时效性核查（2026-09-28，debug :8888 = v0.24.1）——初始核查项无漂移，但**后续新增两处事实更正**（rev1，建议 15）**：

| 核查项 | 结果 |
| --- | --- |
| debug :8888 在线与版本 | `/health` → 200，`version: 0.24.1` ✅ |
| seed 数据量 | 匿名可见 **15** 条；alice 登录后 **22** 条（rev1 实测 `total=22`；初始轮的"19"为当时口径/时点差异，非漂移——两者都是"alice 可见总数"口径，仅计数时点不同）→ **澄清"15 vs 19/22"不一致**：P0-brief 例外叙述的"seed 15 entries"是匿名可见（公开）口径，登录后的数字是 alice 可见总数。两处都对，非漂移，仅口径不同 |
| `/yaml-docker-compose/f` 现状 | 200 + `text/html`，渲染 NotFoundView ✅（与 P0 实核一致） |
| 不存在的 slug + `/f` | 200（同样落 NotFoundView）→ 强化 BDD-18 的判据 |
| JSON-accept 访问 `/{slug}/f` | 404 ✅（与 P0 事实 D 一致） |
| `/{slug}`（控制组） | 200 且带 `link: </api/v1/entries/{slug}/raw>; rel="alternate"` → BDD-11 的辅助证据判据有实测基础 |
| `/f` 单段（slug=f） | 200，走 `/:slug` ✅（无冲突） |
| 代码事实 A~F 复核 | 全部与 dispatch-context 一致；唯一**补充**见 4.2 第 8 项（`.resize-handle`）与补登的两条 banner 选择器，属"遗漏面扩大"而非"事实矛盾" |

**本轮（rev1）新增登记的两项事实更正（原版"无新增漂移"措辞过强，据此修正）**：

1. **`image-gallery` / `legacy-deploy` 两个 seed 目录不在常规可见清单内——但成因不同（rev1 独立复核，更正 review 的合并叙述）**：
   - `image-gallery`：目录内**只有 `meta.json`、无内容文件** → seed 脚本走 `SKIP {slug}: no content files`（`scripts/seed-debug.py:184`），**确实未入库**（本轮实测：匿名与 alice 直查均 `NOT_FOUND`）。
   - `legacy-deploy`：目录内**有内容文件 `deploy.sh`**（207 字节），seed 脚本正常入库（`OK legacy-deploy: ...`），随后按 `seed-debug.py:204-209` 的专用分支 **`PATCH status: archived`** → 因此不出现在默认列表、`raw` 匿名 404；但**它确实在 debug DB 中**（本轮实测：以 alice 直查得 `id=9, status=archived, files=[deploy.sh]`；`raw` 以 alice 请求返回 200）。
   - **判定：非漂移、不阻塞**——无任何 BDD 引用这两个 slug；二者不构成"P0 之后新增的事实"意义上的前提失效（`legacy-deploy` 的 archived 态是 seed 脚本的**有意设计**，非环境劣化）。**据此更正 review 的"二者均未落入 debug DB / 无 SKIP 输出"合并叙述**：对 `image-gallery` 成立，对 `legacy-deploy` 不成立。
2. **`is_public: true` ≠ 匿名可达（`team_id` 使然）**：由 commit `59182590`（TPV0095，2026-09-03）引入 `team_id` 后，`csv-employees` / `markdown-test` / `mermaid-charts` 三条即使 `is_public: true`，匿名访问 `raw` 也返回 404。这是 P0 之后才可观察的事实，**已按建议 15 登记入 §2.4 与新版 BDD 的 Given 前提**；它对原版 4 条 BDD 的 Given 可达性有直接影响（本轮已逐条修复）。

> 综合判定：以上两项均为**事实补记/前提更正**，不改变任务目标、URL 方案、锁死语义、后端零改动四项前提 → 仍为**轻微，不重开 P0**；但原版"无新增漂移"的措辞已按建议 15 修正为"初始核查项无漂移 + 新增两项事实更正"。

## 6. 能力需求与验证环境声明

### 6.1 能力需求（capability_requirements）

```yaml
capability_requirements:
  - need: browser-visual-verification
    why: BDD-1/2/3/14 的判定依赖真实浏览器中的元素可见性、bounding box 与视口几何；BDD-16 的人工体验路径须截图取证
    available:
      - "vision-engine skill（本项目实测可实调，quick role 验证成功，作为首选）"
      - "vision-analyst（agate 内置执行角色，作为补充）"
      - "playwright-cdp skill（Chrome CDP :18800，作为补充）"
    status: available
    note: "DSH 沙箱下调用 vision-engine 需 HOME 重定向至可写目录 + PYTHONPATH 指向 site-packages（本项目环境约束，见 P0-brief 末节）"
```

三态判定说明：视觉能力为 `available`（环境有真实可用的视觉分析路径，本项目已实测），非 `supplementable` / `GAP`，故不触发 `[CAPABILITY_GAP]`，P6 走真实视觉验收路径。

### 6.2 验证环境声明（verification_env）

本任务全部 BDD 依赖运行中的 debug 服务，属**环境问题**（换谁来做都得先把服务起起来），按边界判断树走 `verification_env` 而非 `supplementable`：

```yaml
verification_env: "debug backend http://127.0.0.1:8888（make debug-start / make debug-quick + make debug-seed，独立数据目录，与生产 :8080 隔离）"
verification_env_budget: "止损轮次 2（独立计数，不占 retries[P5/P6]）；轮次追踪由主 Agent 在 dispatch-context 记录"
```

准备职责：该环境可由主 Agent 用项目标准操作（`make debug-*`）准备，按 dispatch-protocol「环境准备职责边界」执行，无需人工介入。已知约束：DSH 沙箱下后台服务须挂持续 running 的后台 job 托底，`/tmp` 跨调用不共享，临时产物落 `{project_root}/.agate-tmp/`。

**不需要声明的能力**：不需要外部网络（无 CDN 依赖类验收）、不需要 MCP 运行时（本任务不改 MCP）。

## 7. 裁剪说明

| 阶段 | 决定 | 理由 |
| --- | --- | --- |
| P1 | 保留（本阶段） | URL 契约 + 锁死语义是需求核心，BDD 须独立评审 |
| P2 | 保留 | 路由注册位置、锁死状态承载方式（新增字段 vs 复用 zen 状态）、后端 JSON 边缘三处均有取舍，须方案对比 |
| P3 | 保留 | 锁定语义有可单测行为（"锁死态下按键不改变视图 + 公告文本不宣告退出方式"，落点由 P2 决定），且既有 zen 相关单测基础已存在 |
| P4 | 保留 | 实现阶段 |
| P5 | 保留 | 前端单测 + typecheck 须全绿（`make test-frontend` / `make typecheck`） |
| P6 | 保留（不可裁） | **19 条** BDD 逐条实跑；UI 任务必须 Playwright 实跑 + 截图 + 人工体验路径（BDD-16）；BDD-9/BDD-15 的 Given 须先满足登录前提（见各条说明） |
| P7 | 保留 | 改动跨 `router.ts` / `useZenMode.ts` / `entryDetailKeys.ts` / `EntryDetailView.vue` 及文档，多文件一致性检查必要 |
| P8 | 保留 | 用户可见功能 + 公开 URL 契约 → 须 bump-version（bump_type 交 P2 判定，倾向 minor）+ `CHANGELOG.md` `[Unreleased]` |

无裁剪阶段，故不声明 `跳过风险` / `coupling_checklist` / `internal_only`；`ceremony` 缺省 standard。

## 8. 待确认清单与风险登记

[NO_NEED_CONFIRM]

说明：P0-brief 原列的"zen 外观统一确认项"已因前提消失而自然消解（第 5 节），不构成方向性分叉；三个设计决策已由用户裁决锁定。以下为**风险登记**（非待确认项，交下游阶段决策，不阻塞推进）：

| 编号 | 风险 / 开放点 | 现状与建议方向 | 归属 |
| --- | --- | --- | --- |
| R1 | JSON-accept 客户端访问 `/{slug}/f` 返回 404（走 `resolve_entry_raw("slug/f")`） | 实测确认 404。是否新增后端分支（如把 `slug/f` 归入 `_is_frontend_route`）属方案选择，P1 不裁定 | P2 决策 |
| R2 | 移动端 zen 布局此前未在锁死态验证 | P0-brief 已登记；由 BDD-14 兜底（内容区占满视口 + 可滚到正文末尾） | P5/P6 验证 |
| R3 | 锁死实现若误改全局 zen 状态，会把 f 键 zen 一起锁死 | 由 BDD-4 与 BDD-12 成对拦截；P2 设计须显式区分"锁死态"与"zen 态" | P2 设计 + P4 实现 |
| R4 | 锁死若扩大 `preventDefault` 范围会吞掉内容区内嵌组件的 Escape | 由 BDD-7 拦截；当前图表弹层无 Escape 监听，冲突面仅 `TableView` 分页浮层 | P2 设计 + P4 实现 |
| R5 | zen 隐藏集双文件分布 + 第 8 项 `.resize-handle` 的遗漏风险 | 见 4.2；P2 的改动面清单须以该表为准 | P2 设计 |
| R6 | 重复的 `zen-shortcut.spec.ts` 两处 | 见 4.3；本任务不改该 util，故不构成改动面，但改动触及该 util 时须同步两处 | P4（仅当触及） |
