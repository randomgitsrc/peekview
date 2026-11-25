---
agent: design-review
phase: P4
task_id: TPV0104
type: review
parent: P4-implementation.md
status: approved
created: '2026-11-25'
trace_id: TPV0104-P4-review-design-20261125
---

# P4 设计评审（前端实现）— design-review

> **审的对象**：TPV0104 的**前端 P4 实现**（`git diff` 覆盖 8 改 + 4 新建，共 12 个文件），重点为 dispatch-context「本任务的设计评审重点」8 条。
> **形态分派**：P1 声明 `ui_render_shape: layout` → 加载**布局 / 交互 / 视觉**三维（本任务无画布/WebGL/时序动画，不启用渲染正确性与动效时序维）。
> **证据等级**：8 条 UI 判据**全部真实浏览器实测**（debug `:8888` + CDP Chrome `localhost:18800`，1280×800 / 1024 / 1100 / 1440 / 1920 / 360×844 / 375×844 / 390×844），不接受"读代码推断"。探针脚本落 `.agate-tmp/dr/probe1..21.ts`，量测快照落同目录 `out*.json` 与 13 张截图。

`[PROD_NOT_TOUCHED]` 全程只访问 debug `:8888`（实测 `:8080` 不可达，探针 `curl` 返回 `000`）；对 `~/.peekview/` **无任何写操作**（收尾仅做一次目录元数据 `ls`，未读库、未改文件）；未跑任何 CLI 写命令、未 commit、未改实现代码与测试。造 3 个临时 entry 用于截断态与多 h1 场景，**全部经 debug HTTP API 创建、经 slug `DELETE` 清理、复查均 404**（全库无 `dr-` 前缀残留）。

---

## 0. 结论

**`status: approved`**

dispatch-context 列出的 **8 条设计评审重点逐项实测全部成立**，其中两条最关键的"判据有无检出能力"项（TOC h1 的 active 反向断言、截断态表头不塌陷）都通过了——不是"读代码看起来对"，而是**在真实浏览器上把状态摆出来再读 `getComputedStyle`**。

**未发现任何 BLOCKER 或 MAJOR。** 4 项发现（F1–F4）分别为：2 项属 P2 已实测并明确接受的既定代价（F1 表头行高跃迁、F2 既有 38px 热区）、1 项属既有代码的失效声明（F3）、**1 项属校验方法的纠偏**（F4：`activeId` 恒 `null` 使"滚动点亮 active"在生产 UI 不可达，P6 若按 P2 括注行事会得到假阴性）。F4 不影响本任务任何判据的成立性，但**会让 P6 验收方法出错**，故单独提请主 Agent 转抄给 P6。

**AI Slop 零命中**：暗色 + 亮色双主题下遍历全 DOM 的 `color` / `backgroundColor` / `backgroundImage`，渐变 **0**、紫 violet **0**；新增文案全部为具体数值（`全屏阅读`、`数据量过大，已显示前 50,000 行，共 50,001 行`），无泛化措辞、无新增居中布局、无全同卡片。

### 0.1 8 条判据实测总表

| # | dispatch 判据 | 实测结论 | 关键实测数据 |
|---|---|---|---|
| 1a | TOC h1 非 active 可与 h2 区分 | 成立 | h1 `fw 600` / `rgb(233,238,244)`=`--c-text` / `mt 12px`；h2 `fw 400` / `rgb(154,167,180)` / `mt 4px`；两者 `x=1057` 同缩进（选定方案不靠缩进） |
| 1b | TOC h1 **active 仍保强调色 + 仍保 600** | 成立（暗/亮双主题各一次） | 暗：`rgb(77,141,255)`=`--accent-color` + `fw 600` + `mt 12px`；亮：`rgb(9,105,218)`=`--accent-color` + `fw 600` |
| 1c | 对比度过 WCAG AA | 成立 | 暗色 h1 **15.26:1**（与 P2 预测值逐位一致）、h2 7.26:1；亮色 h1 **15.8:1**、h2 5.25:1 |
| 2a | 全屏按钮可访问名称非 `title` | 成立 | 桌面 `aria-label="全屏阅读"`、`title=null`；移动 `aria-label="全屏阅读"`、`title=null` |
| 2b | 全页名称匹配「全屏\|fullscreen」== 1 | 成立，**且在图表块存在的页面上仍 == 1**（强于 BDD-31 的 Given） | `mermaid-charts`（13 个 DiagramBlock，各带 `title="Fullscreen"`）实测：按 `aria-label`/可见文本口径 **== 1**；被排除者恰是 `title="Fullscreen"` + 可见文本 `⧉` 的图表按钮 |
| 2c | 图标 16px（跟随兄弟，非 §7 的 18px） | 成立 | SVG `width/height="16"`、渲染盒 16×16；兄弟 `Copy`/`More` 均 16；**未改成 18px** |
| 2d | 无 `disabled`，用 `v-if` 让元素不存在 | 成立 | 桌面 `disabled=false`、`hasAttribute('disabled')=false`、`aria-disabled=null`；404 页按钮计数 **0** 而 `.actions-area` 仍为 1（R14 未复发） |
| 2e | 过渡继承 `.icon-btn`，无自定义 | 成立 | 新按钮 `transition: 0.15s`，与 `Copy`/`More`/`Star` **逐项相同** |
| 3 | 移动 360px：`scrollWidth <= clientWidth`、`height <= 64px` | 成立（5 素材 × 3 档 = 15 组全过） | @360/375/390 全部 `overflow=0`、`height=64`；@360 spacer 余 **5.39px**（与 P2 预测逐位一致）；最坏形态（含 wrap 按钮共 7 按钮）@360 仍 `overflow=0`，`overflow-trigger` 右缘 348 < 360 **未被裁** |
| 3b | 移动点击区域 ≥ 44px | 成立（新按钮） | 全屏按钮 44×44、`elementFromPoint` 命中自身；除既有 `overflow-trigger` 38px（本任务未改）外底栏所有按钮 ≥44px |
| 4 | 截断态表头不塌陷、文字仍可见 | 成立 | 50001 行 CSV：`thead 37.5px`、4 个 `th` 的 `.th-label` 文字非零宽高且 `color rgb(233,238,244)`；`.th-sort-btn` **0** / `.th-filter` **0**；垂直居中偏差 **−0.25px**（与 P2 预测一致）；非截断对照 `thead 65.5px` + sort 1/filter 1 |
| 5 | `/f` 下两侧栏 **DOM 0** | 成立（用**多文件** entry 测，排除单文件误导） | `k8s-deployment`（3 files）普通态 `.file-sidebar=1`/`.toc-sidebar=1` → `/f` 下**均 0**；`/f?file=14` 同样 0；`.detail-header` 保留 DOM 但 `display:none`（`v-show` 范式未破） |
| 6 | banner 文案含 `5` 与 `11` | 成立 | 单测 `maxRows:5` → `已显示前 5 行，共 11 行`（7P/0F 全绿）；生产路径 `已显示前 50,000 行，共 50,001 行` |

---

## 1. 检查清单逐项（角色要求的四组）

### 1.1 AI Slop（必查）

| 检查项 | 结果 | 证据 |
|---|---|---|
| 紫色 / violet 渐变（#6366f1 / #8b5cf6 等） | 无 | 遍历全 DOM 的 `color`/`backgroundColor`/`borderTopColor`，按「b>180 ∧ 90<r<190 ∧ g<r−30 ∧ b>g+60」判定 → **0 命中**；`backgroundImage` 含 gradient → **0 命中**（暗色、亮色各扫一次） |
| 泛化文案 | 无 | 新增两处文案均为具体数值：`全屏阅读`（动作名）、`数据量过大，已显示前 N 行，共 M 行`（含两个真实计数）。无 "Unlock the power of" / "Get started" 类 |
| 全居中 / 缺层级布局 | 无 | 详情页仍为既有三段式（左栏 / 正文 / 右栏）+ 顶栏两段式（title-group 弹性 + actions-area 固定）；新增按钮复用既有 `.icon-btn`（`DESIGN.md:162` stateless one-shot 档），未发明新变体/新层级 |
| 全同卡片 grid | 无 | 本任务未新增卡片或 grid |

### 1.2 Typography

| 检查项 | 结果 | 证据 |
|---|---|---|
| 字号层级清晰 | 成立 | 移动端正文 `16px/24px`、h1 `32/40`、h2 `24/30`；TOC 标题 `12/18`、TOC 条目 `14/21` —— 层级递进连续，新按钮无文字标签故**未新增字号层级** |
| 行高/字间距舒适 | 成立 | 正文 `lh = 1.5×fs`；TOC 条目 `21/14 = 1.5`；tooltip `11px` 与兄弟一致 |
| 移动端最小 16px | 成立（正文） | 正文与 `p` 均 `16px`；TOC 条目 `14px` 属**侧栏导航**（既有值，非本任务引入，见 F3 说明）；新增按钮为纯图标无文字 |
| h1 与 h2 在 TOC 内可区分 | 成立 | 见 §0.1 #1a/#1b —— 双信号（字重 600 vs 400 + 颜色主文字 vs 次要文字）+ 上间距 12px vs 4px |

### 1.3 Spacing

| 检查项 | 结果 | 证据 |
|---|---|---|
| 间距 scale 一致（4/8/16/24/32） | 成立 | 新规则只用 token：`--space-3`(12px) 上间距、底栏 `--space-1`(4px) 为 gap —— 未出现硬编码像素 |
| TOC 分组节奏 | 成立 | `title→h1 = 12px` 与 `h1→h2 = 4px`；多 h1 场景（3 个 h1）每个 h1 均 `mt 12px` 而相邻 h2 为 `4px` → 形成可读的章节分组（截图为证） |
| 移动端点击区域 ≥44px | 新按钮成立 | 全屏按钮 44×44；`min-width/min-height: 44px` 来自 `EntryDetailMobileBar.vue` scoped `.icon-btn` |
| 底栏不增高 | 成立 | 三档 `height` 恒 `64px`（`min-height: var(--mobile-bar-height)`）；`gap` 实测 `4px`（`--space-1`），与 P2 的 M1 落点一致 |
| 底栏不溢出 | 成立 | 15 组量测全 `overflow=0`；360 档余量 5.39px —— 属"刚好达标"（见 O1） |

### 1.4 交互状态

| 检查项 | 结果 | 证据 |
|---|---|---|
| hover | 成立 | 新按钮复用 `.icon-btn:hover`（`background`/`color`）；桌面 tooltip `hover` 后 `opacity=1` 且 `y=58` 在视口内、未被 `.detail-header` 裁切 |
| focus | 成立 | `:focus-visible` 落定后 `outline: 2px solid rgb(77,141,255)` + `offset 2px`，与 `Copy`/`Star`/`TOC`/`Source` **逐字节相同** |
| active | 成立 | `.icon-btn:active` 既有背景压深，未新增 |
| disabled | 不适用（有意） | 按 dispatch 要求用 `v-if` 让元素"不存在"：404 页按钮计数 0；不设 `disabled`/`aria-disabled` |
| `outline: none` 有替代 | 成立 | 未出现 `outline: none`；全局 `.icon-btn:focus-visible` 提供可见焦点 |
| loading / error / empty | 未回归 | 文件切换沿用既有 `fileLoading` 骨架 / `fileError` 错误态；无效 `?file=` 静默回退默认入口（实测 `?file=999999` → 回落 README，无 `.error-state`） |
| 键盘可达 | 成立 | 真实 Tab 序列：`logo → TOC → Source → Star → 全屏阅读 → Copy → More → …`，位于 Star 与 Copy 之间（与设计"Copy 之前"的语义簇分组相符，且 `<button>` 内建 Enter/Space） |

> **过渡读数陷阱（方法记录）**：`.icon-btn` 的 `transition: all 150ms` 会让 `classList.add('active')` 后的**首帧** `getComputedStyle` 读到过渡中间值。本轮首次测 TOC active 时，因未等待落定读到了 `rgb(233,238,244)`（看似"强调色被吃掉"），等 400ms 后复测为 `rgb(77,141,255)`。**P6 若做同类断言必须等过渡落定**，否则会得到假 FAIL（记入 F4 同族的方法风险）。

---

## 2. 发现清单

### F1 [INTERACTION] 截断态切换时表头行高跃迁 28px

```
文件：frontend-v3/src/components/TableView.vue:24 / :34 / :36
问题：未截断态 thead 高 65.5px（.th-sort-btn + 下方 .th-filter 两行），截断态降到 37.5px（仅一行文字）。
      表头文字与 tbody 首行同步上移 28px —— 不塌陷、不遮挡，但同一次数据状态变化里表头高度非连续。
```
**判定：非缺陷，属 P2 已实测并接受的既定代价（R12）**。P2 `R12` 明写"实测正面结论（保留）：截断态换成 `span.th-label` 后表头**不塌陷**——`thead` 高 −28px、`tbody` 首行 top 同步 −28px、标签垂直居中偏差 −0.25px"，本轮实测数值与其**逐位相同**（`65.5 → 37.5`、偏差 `−0.25px`）。表头文字左内边距实测 `xDelta = 12px` 两种状态相同 → **无横向跳动**。

`Fix`（不建议本任务做）：若要消除跃迁，需让 `.th-filter` 在截断态保留占位高度（`visibility: hidden`）——但那会违反 BDD-32「`input` 计数 == 0」的判据（`v-if` 是唯一满足方式）。**结论：保持现状正确**。

### F2 [INTERACTION] 底栏既有 `overflow-trigger` 热区 38×38 未达 44px

```
文件：frontend-v3/src/styles/layout.css:590-593（本任务未改动，diff 内不含 layout.css）
问题：.mobile-bottom-bar .overflow-trigger { width: 38px; height: 38px } → 低于 DESIGN.md §9「触控目标 ≥44px」。
```
**判定：既有偏差，不在本任务范围**。实测底栏 7 个按钮中唯它是 38px；P2 只要求**新增按钮**达标（M1/L1 的判据是 `scrollWidth <= clientWidth` 与 `height <= 64`），且 dispatch 明确「既有偏差本任务不修正（一致性优先）」的同类原则（针对 16px 图标）。若顺手改 38→44，@360 会新增 6px 占用直接破 M1 的 5.39px 余量 —— **改了反而更糟**。

`Fix`（记为后续 DEBT，不阻断）：移动底栏横向预算重排后再统一到 44px。

```diff
- .mobile-bottom-bar .overflow-trigger { width: 38px; height: 38px; border-radius: 8px; }
+ .mobile-bottom-bar .overflow-trigger { min-width: 44px; min-height: 44px; border-radius: 8px; }
```
（**前置条件**：先解决 @360 的 5.39px 余量，否则必溢出。故本条只登记，不建议在本任务执行。）

### F3 [VISUAL] `TocNav.vue` 保留一条 no-op 声明（无害）

```
文件：frontend-v3/src/components/TocNav.vue:45
问题：.toc-level-2 { padding-left: 0 } —— 与 P2 判定的"no-op"完全同型（该属性默认已 0）。
```
**判定：不是本任务引入的缺陷**。P2 的要求是"**不写** `.toc-level-1 { padding-left: 0 }`"，实现确实没写（实测 `.toc-level-1` 无 `padding-left` 声明、`li` 的 `paddingLeft` 计算值为 `0px`）；`:45` 这条是 h2 档的**既有行**，不在 diff 内。

`Fix`（可选清理，非本任务）：删掉该行；或反过来用它给 h2 一个真实缩进（但那属 W3 方案，P2 已否决）。

### F4 [INTERACTION] `activeId` 恒 `null` —— TOC 高亮在生产 UI 不可达，P2 的 P6 校验括注不成立

```
文件：frontend-v3/src/components/EntryDetailContent.vue:90 / :120（:activeId="null" 硬编码）
      frontend-v3/src/components/TocNav.vue:8（active 类由 activeId === heading.id 决定）
问题：全仓无任何滚动监听 / IntersectionObserver 驱动 TOC 高亮（实测 grep：`IntersectionObserver` 仅在
      t052-header-redesign 的 meta-tags-bar 用；滚动监听仅 ShareDialog）。故 `.toc-item.active` 在真实
      生产页面里恒不存在 —— 实测两条路由上 `document.querySelectorAll('.toc-item.active').length == 0`。
```
**这是既有事实，不是本任务引入的缺陷**：`git blame` 显示 `:activeId="null"` 落在 `T082-P4`（`59ab6f7e`），HEAD 与工作区一致。

**为什么仍要单独提**：P2 的 UI 校验点 ⑦ 反向断言括号里写「把 h1 条目置为 `.active`（**等价于滚到文章开头让 scroll-spy 点亮它**）后断言 …」。按实测，**这个等价关系不成立**——滚动不会点亮任何条目。P6 若照字面"滚到文章开头再看 color"，读到的仍是 `rgb(233,238,244)`（非 active 值），会**误判 R2-1 回归**（假 FAIL）。

**P6 应采用的方法**（本轮已用它证成 1b）：

```js
const h1 = [...document.querySelectorAll('.toc-item')].find(li => li.classList.contains('toc-level-1'))
h1.classList.add('active')
await page.waitForTimeout(400)            // 必须 > --transition-fast(150ms)，否则读到中间值
const cs = getComputedStyle(h1.querySelector('a'))
// 断言：cs.color === accent 解析值 且 cs.fontWeight !== '400'
h1.classList.remove('active')             // 还原，不污染后续用例
```

`Fix`（本任务**不做**，属范围外）：给 `EntryDetailContent` 接真实 `activeId`（scroll-spy）。这需要新增观察器与组件 API，属 P1 未声明的新需求 → 若要做得走 `[SCOPE+]` 回补基线，不应在 P4 评审批次里塞。

---

## 3. 非阻断观察（供 P6 / P8 参考，不要求改动）

**O1 — 360px 下底栏 spacer 余量仅 5.39px。** 7 个按钮（含 `wrap`）时左"浏览簇"与右"动作簇"的视觉分隔几近消失（spacer `5.39px`，< 一个 `--space-1`）。P2 布局组 L1 已实测并明确接受该代价（换来 @360 零溢出、且候选 L3 同样溢出但不解决 M1）。**不是实现偏差。** 建议 P8 CHANGELOG 不必提；但若后续再加底栏按钮，@360 会立刻破线。

**O2 — 截断态同时禁用排序与过滤且无"加载更多"。** 用户面对 5 万行时唯一出口是 Download。这是 P1 BDD-32 的明令（避免 5 万行客户端排序），不是实现选择。建议 P8 CHANGELOG 的措辞点明"截断态排序/过滤不可用"，避免用户当成 bug。

**O3 — 移动端 TOC 抽屉内的层级信号同样成立。** 390px 抽屉实测 h1 `fw 600` / `rgb(233,238,244)`、h2 `fw 400` / `rgb(154,167,180)` —— scoped 样式未遗漏抽屉分支。这是 dispatch 未点名但值得记的正向结论（移动端用户同样能分辨 h1）。

**O4 — 无 `.title-group` 截断风险。** 1024/1280/1440 三档 `.title-group` 的 `scrollWidth == clientWidth`（377/633/793）、`truncated=false`、`body` 无横向滚动；`.actions-area` 三档恒 `422.69px`。隐藏新按钮后基线为 `386.69px` → **新增按钮精确占 36px 且未挤压标题**（与 P2 V15 的"标题让出 36px"预测一致）。

---

## 4. 与 P2 设计的偏差核对

**实现无未申报偏差。** 逐项核 P2 `§0.1B` 的 UI 落点：

| P2 落点 | 实现 | 判定 |
|---|---|---|
| `TocNav` 三条规则**拆两条**（颜色挂 `:not(.active)`、字重不挂） | `TocNav.vue:42-44` 完全一致 | 一致，且 R16 的两向要求实测均成立 |
| 不写 `.toc-level-1 { padding-left: 0 }` | 未写（实测 `.toc-level-1` 无该声明） | 一致 |
| 桌面 `Maximize :size="16"` + `v-if="currentEntry && activeFile"` + 无 `disabled` + 无自定义过渡 | `EntryDetailHeader.vue:42-44` | 一致；404 页实测 0 |
| 移动 `aria-label` 不加 tooltip（跟既有 4 按钮 `tooltipCount=0`） | `EntryDetailMobileBar.vue:37-43` | 一致（实测底栏 7 按钮 tooltip 全 0） |
| 截断态 `v-if`/`v-else` 双分支 | `TableView.vue:24/34/36` | 一致（不是给既有 span 加条件） |
| 底栏 `gap: --space-2 → --space-1`，**不动** `layout.css:538` | `EntryDetailMobileBar.vue:116` = `--space-1`；`layout.css` 不在 diff 内 | 一致 |
| 两侧栏 `v-if` 加 `&& !zenMode` | `EntryDetailContent.vue:4` / `:78` | 一致 |

`[DESIGN_GAP]` 与 `[SCOPE+]` 方面与 P4-implementation.md 的申报**无冲突**：本评审不新增 gap；F4 是既有代码事实，不构成 P2 设计缺口（P2 未要求实现 scroll-spy）。

---

## 5. 环境与清理

- 端口：只用 `:8888`（实测 `200`）；`:8080` 实测不可达（`000`）→ `[PROD_NOT_TOUCHED]`
- CDP：`localhost:18800` 在线（`/json/version` 200），全程 `connectOverCDP` + `page.close()`，**未 `browser.close()`**
- 临时 entry（均 `path`+`filename` 齐备，均经 debug HTTP API 创建）：

  | slug | 用途 | 清理 |
  |---|---|---|
  | `dr-tpv0104-trunc-probe` | 12 行 CSV（首版，被 50001 行版替代） | `DELETE` → 200；复查 404 |
  | `dr-tpv0104-trunc-probe-2` | 50001 行 CSV（触发真实 `maxRows=50000` 截断） | `DELETE` → 200；复查 404 |
  | `dr-tpv0104-toc-multi-h1` | 3×h1 + 4×h2 + 1×h3（多 h1 分组观感） | `DELETE` → 200；复查 404 |

- 全库复查：`GET /api/v1/entries?limit=100` → 16 条，无 `dr-` 前缀残留
- 产物：探针 `.agate-tmp/dr/probe1..21.ts`、快照 `out1..21.json`、截图 13 张（均在 `.agate-tmp/`，未进仓库）
- 未 commit、未改实现代码与测试（本评审只新增 `P4-review-design.md` 与 `P4-progress-design-review.md`）

---

## 6. 返回给主 Agent

`File: {AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P4-review-design.md`
`Status: approved`

- 视觉/交互问题数：**4 项**（F1 表头行高跃迁 · P2 已接受；F2 既有 38px 热区 · 范围外；F3 no-op 声明 · 既有且无害；F4 `activeId` 恒 null · **校验方法纠偏，请转抄 P6**）
- 无 BLOCKER / 无 MAJOR → 无需回派 implementer
- **唯一下游动作**：把 F4 的 P6 校验方法（DOM 注入 `.active` + 等 ≥400ms 过渡落定）转抄进 P6 dispatch-context，否则 P6 按 P2 括注的"滚动点亮"会得到假 FAIL
