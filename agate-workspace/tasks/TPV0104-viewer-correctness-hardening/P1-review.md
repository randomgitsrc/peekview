---
agent: requirements-review
phase: P1
task_id: TPV0104
type: review
parent: P1-requirements.md
trace_id: TPV0104-P1-review-r3-20261124
prod_touched: false
round: 3
reviewed_bdds:
- '01'
- '02'
- '03'
- '04'
- '05'
- '06'
- '07'
- 08
- 09
- '10'
- '11'
- '12'
- '13'
- '14'
- '15'
- '16'
- '17'
- '18'
- '19'
- '20'
- '21'
- '22'
- '23'
- '24'
- '25'
- '26'
- '27'
- '28'
- '29'
- '30'
- '31'
- '32'
- '33'
- '34'
- '35'
- '36'
- '37'
- '38'
- '39'
- '40'
- '41'
- '42'
- '43'
- '44'
- '45'
- '46'
- '47'
- '48'
- '49'
- '50'
- '51'
- '52'
- '53'
- '54'
status: approved
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
- peekview
- frontend-v3
- docs
domains:
- frontend
- backend
---
# P1 评审（第 3 轮 · 终审）— TPV0104 Viewer 正确性与资源边界加固

> **结论：`approved`。第 2 轮仅剩的 2 BLOCKER + 6 WARNING 全部闭环，未引入新的「判据不可执行」或「假 PASS」。**
>
> 本轮是**收口评审**，只核查 8 处改动。前两轮已确认通过的维度（需求方向、8 项缺陷源码事实、决策 A/B、同类扫描 9 组、P0 时效性质疑、裁剪声明、UX 形态声明与维度、能力三态、`risk_level`/`ceremony`/`packages`/`domains`、§11 的 12 条回归守护标签、第 1 轮 10 项已闭环 BLOCKER）**本轮不重做**，沿用第 2 轮的实测结论并在此逐项挂锚点（第六节）。
>
> 复核对象：`P1-requirements.md` 第 3 版（845 行 / **54 条 BDD** / 编号 01–54 连续无跳号）。`reviewed_bdds` 用脚本枚举核对 = `01`–`54`，与文件内 `#### BDD-NN:` 集合**严格相等**（零缺零溢）。
>
> 规模（54 条）不是打回理由；本轮亦未以「还能更好」为由继续打回——残留 2 项均为**文字/口径级 WARNING 且不影响 P6 判 PASS/FAIL**（第四节），按派发指引判定尺度第 1 条列入正文建议，不阻断出 P1。

---

## 一、B-NEW-1（`#### BDD-05` 取证通道）— 已闭环

**改法核对**：`#### BDD-05` 的 When 已由「vitest 层直接消费 `useMarkdown.render()` 返回的 `headings` 与 `html`」改为「**Playwright 层真实 DOM**（桌面 1280×800 + 幂等展开态），读取 `.toc-list a` 可见文本与 `.markdown-body` 对应 `<h2>` 的 `textContent`/`id`」；正文 `:143` 新增「**取证通道**」段，明写 `useMarkdown.ts:480` 是该渲染函数**唯一 return 点**、`html` 为**常量空串**、真实 HTML 在 `blocks[]`（`:414`）。Given `:139` 已补「`path` 与 `filename` **同时**给 `README.md`」。

**① 新 When 是否真的可执行（按字面跑一遍）**：**可执行**。我按字面实测（现造 entry，`path`+`filename` 同为 `README.md`，API 201）：

| 步骤（= When 字面） | 实测 |
|---|---|
| 桌面 1280×800 打开详情页 | `[aria-label="Table of Contents"]` 实测存在、`visible=true`、**`aria-expanded="true"`** |
| 读 `aria-expanded` 三分支 | 命中 `"true"` 分支 → **不做任何点击**（若照旧写法「点开 TOC」会把已展开的 TOC 关掉 → 假 FAIL，新表述正确规避） |
| 等待 `.toc-sidebar` / `.toc-list` 出现 | 两者均存在（`true`/`true`） |
| 读 `.toc-list a` 文本 + `.markdown-body h2` | TOC 文本 `**粗体**与[链接](other.md)`；正文 `textContent="粗体与链接"`、`id="粗体与链接othermd"`；TOC href `#粗体与链接othermd` |

造件坑亦已在 Given 内钉死（我实测：`path`+`filename` 同给 → `language="markdown"`、`.toc-list` 非空；与第 2 轮踩到的 `language=null` 退化路径一致）。

**② 断言②是否仍现状 FAIL（有区分力）**：**是**。Then①（id 字符串相等）实测 `true` → 现状 PASS；Then②（可见文本不含 `**`/`[`/`](`/`)`，且去空白后与正文 `<h2>` 逐字相等）实测文本含标记 = `true`、与正文逐字相等 = `false` → **现状 FAIL**。整条判据的区分力恰好由 Then② 承担，与第 2 轮判定一致。

**③ 有没有把「取证通道」限制误写成「实现约束」**：**没有**。新增文字只约束「在哪一层取证」（`render().html` 不可用 → 必须在真实 DOM 上验），未指定任何组件内部实现方式；`:103` 的「判据不绑定 CSS 类名/组件名/API 调用名，选择器仅为定位手段」总则仍然有效，`.toc-list`/`.markdown-body` 属定位手段而非要求。

→ **B-NEW-1 闭环**。

---

## 二、B-NEW-2（`#### BDD-35` 假 PASS）— 已闭环

**改法核对**：`#### BDD-35` 的 When 已删去「**既有返回值结构中的字段**」这一被明确许可的观测面，改为「以**本次改动新增暴露的「实际构造的数据行数」观测面**读取该量（见下方「观测面定义」，**不得**用 `rows.length`）」；`:336-341` 新增「观测面定义」三条硬约束（① 不得用 `rows.length` 及等价量并附实测 5 == maxRows 的假 PASS 依据；② 必须能区分「构造 1000 行再截 5 行」vs「只构造 5 行」，形态示例三种、**不写死签名**；③ 改动前该观测面不存在，附 `constructedRows`/`parsedRows`/`parsedCount`/`stats` 全 `undefined` 的实测）；Then 增正向对照「3 行数据 → == 3（排除恒返回 0）」。

**① 按新观测面，现状是否无法读数 → FAIL**：**是**。我独立实测现状 `parseCsv` 返回值：

| 观测面 | 现状 |
|---|---|
| `Object.keys(returned)` | `headers,rows,totalRows,truncated`（四字段，无构造计数） |
| `constructedRows` / `parsedRows` / `rowsParsed` / `parsedCount` / `stats` / `constructedCount` | **全部 `undefined`** |
| `rows.length`（被禁止的假 PASS 面） | 1000 数据行 + `maxRows=5` → **5**（≤ 5，现状即满足） |
| `totalRows` / `truncated` | `1001` / `true` |

→ 按字面执行时**无法读数**（该观测面不存在）→ BDD-35 现状 **FAIL**，符合「改动前 FAIL」要求。

**② 是否仍能把 `rows.length` 读法绕过去（P6 图省事仍用 `rows.length` 会不会又通过）**：**不会**。BDD-35 正文已用**禁止性条款**直接排除该字段及其等价量（「或任何等价于『返回了多少行』的量」），并在 §10 依赖表（`:745`，W-新 1 新增）二次兜底：「若 P4 未先落地该观测面，BDD-35 **判 FAIL**，不得回退用 `rows.length`」。我做了双实现对照实测，证实该排除是必要的：

| 观测手段 | 现状实现 | 只构造到上限的实现 | 可区分 |
|---|---|---|---|
| `rows.length` | 5 | 5 | **不可区分**（假 PASS 面，已被明文排除） |
| 「实际构造的数据行数」（spy 数 `rows.push` 次数 − 表头） | **1000** | **5** | **可区分**：断言①现状 FAIL / 修后 PASS |
| 正向对照（3 数据行，未达上限） | 3 | 3 | 两者均 == 3（排除「恒返回 0」也通过） |

**③ 有没有重新引入 W13（指定 P4 函数签名）**：**没有**。`:339` 明写「判据**不引入计时断言**」「`具体承载形态留给 P2`」，`:341` 明写「判据不指定函数签名（原写法指定 `parseRows(content, delimiter, maxRows)` 属掺入实现，W13）」；三种形态是**示例**（返回值新增字段 / 公开统计 / 可注入计数回调），不是要求。

**④ analyst 自报「与 BDD-36 的耦合」是否合理**：**合理，且我实测证实其非虚**。朴素「到上限就不再 push 行数组」的实现把 `totalRows` 从 **1001 砍到 6**（我实测修后实现 `totalRows=6`）→ `#### BDD-36`（`totalRows === 1001`）变红。这确实是两条的**联合约束**（计数与构造解耦），不是判据冲突，也不构成「判据不可执行」：P6 逐条按字面判，任一条被踩坏即该条 FAIL，语义自洽。BDD-36 仍标注「回归兼容」，其区分力声明（本来就不是新行为）未被污染。

→ **B-NEW-2 闭环**；顺带修正了第 2 轮指出的分布问题——§11「42 条改动前 FAIL」现在**真实成立**（原 41F + 1 条未标注假 PASS 已消除）。

---

## 三、6 项 WARNING 逐条核实（8 处核对完毕）

| # | 要求 | 落实情况 | 独立核实 |
|---|---|---|---|
| W-新 1 | 改 BDD-35 后同步 §10 依赖表 | **已落实** | `§10`（`:745`）新增行「V-03 依赖『构造行数观测面』先行」：写明现状返回值仅四字段、无构造计数 → 未先落地该观测面则 BDD-35 判 FAIL、**禁止回退 `rows.length`**；并补「BDD-36/37 不依赖该观测面」，口径与第二节实测一致 |
| W-新 2 | §3 幂等表述补 `aria-expanded === null` 第三分支 + 6 条 BDD 钉桌面视口 | **已落实** | `:107` 三分支齐备：「`"true"` 不点击 / `"false"` 点一次 / **`null` → 该视口不适用本条，改用桌面 1280×800 重跑**」；`:109` 另加实测依据段（移动端命中的是 `[data-testid="mobile-bar-toc-btn"]`、**无 `aria-expanded` 属性读得 `null`**、走 `showTocDrawer` 非 `.toc-sidebar` v-if 链）。Given 钉定实测 6/6：`#### BDD-01`/`#### BDD-02`/`#### BDD-03`/`#### BDD-04`/`#### BDD-06`/`#### BDD-52` 均含「桌面视口 1280×800」 |
| W-新 3 | `#### BDD-31` 排除 `title` + Given 补「正文不含图表」 | **已落实** | `:301` Given 补「**正文不含图表块**（无 mermaid/plantuml/d3 等 rich-render 块，避免 `DiagramBlock.vue:177` 的 `title="Fullscreen"` 被计入）」；`:303` 断言②补「名称口径与 ① 及 BDD-23/24 统一，**同样不含 `title` 属性**，即只取 `aria-label` 与可见文本」。与 `#### BDD-23`/`#### BDD-24` 口径完全统一。我实测桌面 `/k8s-deployment/f` 全页按该口径命中的 fullscreen/全屏 命名元素 = **0**（现状 FAIL，断言② `== 1` 有区分力） |
| W-新 4 | `#### BDD-53` 拆出 `.meta-tags-bar`（实测 DOM 0） | **已落实** | `:473` 已把四元素分两组陈述：`.detail-header`/`.mobile-sticky-header`/`[data-testid="mobile-bottom-bar"]` 走 `v-show="!zenMode"`；`.meta-tags-bar` **单独拆出**并注明「**实测 DOM 计数 == 0**（**非 `v-show`**）」。判据（四者可视计数 == 0）不变。我实测桌面 `/k8s-deployment/f`：`.detail-header` dom=1/visible=0、`.meta-tags-bar` **dom=0** ✓、`.file-sidebar` dom=1、`.toc-sidebar` dom=1、`.content-area` width=1280 == innerWidth → ③ 现状 FAIL、区分力在 ③ |
| W-新 5 | 4 处交叉引用改号（→43/43/13/47） | **已落实** | 逐处核对：`:95`（`>= 2MB` 左闭右开）→ **BDD-43** ✓；`:554`（§6.2 `order_by`/确定性排序连带面）→ **BDD-13** ✓；`:661`（P0_STALE 第 2 条，卡片/列表代码级断言）→ **BDD-47** ✓；`:662`（P0_STALE 第 3 条，`>= 2MB` 边界）→ **BDD-43** ✓。全文脚本枚举 203 处 `BDD-NN` 引用，**越界 0 处**（全落在 1–54） |
| W-新 6 | `#### BDD-50` Then ② 补 `known-failures.md` 前提 | **已落实** | `:450` 已加「**断言 ② 的前提（W-新 6）**：P5 已按本节 Given 的基线数字产出 `known-failures.md`（**逐 case** 列出，而非只写总数）；**缺失该文件时本条判 FAIL 而非 PASS**——『无法对照』不等于『没有 new failure』」。与 `:448` Then② 本体「按 case 名逐条对照已落盘的 known-failures 清单」形成闭合 |

**6/6 全部闭环，口径与 `#### BDD-23`/`#### BDD-24` 等既有条目统一。**

---

## 四、本轮新发现（2 项，均为文字/口径级 WARNING，不影响 P6 判 PASS/FAIL）

**W-r3-1（`#### BDD-35` 观测面定义第 ③ 条措辞绕）**：原文「取证时**不得**通过『对 `parseRows` 打 spy 数 push 次数』**以外**的间接手段推断；若选用 spy 方式，须同时给出 ② 的正向对照」。双重否定后语义可推出「spy 可用、其他间接手段不可用」，但字面读起来易被 P6 反向理解。**不影响判定**：② 与 ③ 已把「能区分两种实现」+「正向对照」写死，无论取何种取证方式，判据只认「该值现状不可读 → FAIL / 修后 ≤ maxRows 且未超限时 == 实际行数」。建议 P2 落形态时顺手改成肯定句（如「可用 spy 计 push 次数，或 P4 新增暴露的构造计数；二者择一并给出正向对照」）。

**W-r3-2（`#### BDD-53` ① 的 DOM 归宿描述与实际条件渲染来源不符）**：`:473` 称三元素「**DOM 保留（各 1）**、仅 `v-show` 隐藏」，并把 `.meta-tags-bar` 的缺失归因为「由 scoped CSS 规则所在分支的条件渲染决定」。我桌面 1280×800 实测：

| 元素 | DOM | 可视 | 实因 |
|---|---|---|---|
| `.detail-header` | 1 | 0 | `EntryDetailHeader.vue:13` `v-if="isDesktop"` + `v-show="!zenMode"` ✓ 与描述相符 |
| `.mobile-sticky-header` | **0** | 0 | `EntryDetailHeader.vue:3` 是 **`v-if="isMobile"`**，桌面下**根本不进 DOM**（非「DOM 保留各 1」） |
| `[data-testid="mobile-bottom-bar"]` | **0** | 0 | `EntryDetailMobileBar.vue:2` 同为 **`v-if="isMobile"`** |
| `.meta-tags-bar` | **0** | 0 | `EntryDetailContent.vue:24` 是 **`v-if="isMobile && currentEntry"`**（不是「scoped CSS 规则所在分支的条件渲染」） |

即：① 的**判据**（四者可视计数 == 0）完全成立且现状满足，本条整体仍是被正确标注的**回归守护**（区分力全部在 ③ `.file-sidebar`/`.toc-sidebar` 的 DOM 计数 == 0，我实测各为 1 → FAIL）；只是「DOM 归宿」这一**并列事实陈述**有一项不准确、两项归因不准。P6 只需测可视计数，**不依赖该陈述**。建议 P2/P4 顺手把三元素改为「`v-if="isDesktop"`/`v-if="isMobile"` 门控 + `v-show="!zenMode"`」并把 `.meta-tags-bar` 的归因改为 `v-if="isMobile && currentEntry"`。

> 判定依据：派发指引尺度第 1 条——「剩余问题**仅为文字/口径级 WARNING 且不影响 P6 判 PASS/FAIL** → 给 `approved`」。以上 2 项均属此列，无一项使判据变得不可执行或让改动前即通过。

---

## 五、54 条 BDD 判定沿用表（编号锚点全覆盖；仅标注本轮有变化者）

判据用词沿用第 2 轮：「有区分力」= 现状 FAIL、改后 PASS；「回归守护 / 约束型 / 不变守护」= 现状即满足但已在标题或注中显式标注理由。

| BDD 锚点 | 判定 | 本轮变化 |
|---|---|---|
| #### BDD-01 | 有区分力 | Given 已钉桌面视口 1280×800（W-新 2） |
| #### BDD-02 | 有区分力 | 同上 |
| #### BDD-03 | 有区分力 | 同上 |
| #### BDD-04 | 有区分力 | 同上 |
| #### BDD-05 | 有区分力 | **B-NEW-1 已闭环**：When 改 Playwright 真实 DOM，本轮按字面实跑可执行、Then② 现状 FAIL |
| #### BDD-06 | 回归守护 | Given 已钉桌面视口 1280×800（W-新 2）；`TocNav.vue:29` + `markdown.css:3` 依据保留 |
| #### BDD-07 | 有区分力 | 无 |
| #### BDD-08 | 有区分力 | 无 |
| #### BDD-09 | 有区分力 | 无 |
| #### BDD-10 | 有区分力 | 无 |
| #### BDD-11 | 有区分力 | 无 |
| #### BDD-12 | 有区分力 | 无 |
| #### BDD-13 | 有区分力 | §6.2 连带面引用已改为 BDD-13（W-新 5） |
| #### BDD-14 | 有区分力 | 无 |
| #### BDD-15 | 有区分力 | 无 |
| #### BDD-16 | 有区分力 | 无 |
| #### BDD-17 | 有区分力 | 无 |
| #### BDD-18 | 有区分力 | 无 |
| #### BDD-19 | 有区分力 | 无 |
| #### BDD-20 | 有区分力 | 无 |
| #### BDD-21 | 有区分力 | 无 |
| #### BDD-22 | 有区分力 | 无 |
| #### BDD-23 | 有区分力 | 无（`title` 排除口径自第 1 轮起成立） |
| #### BDD-24 | 有区分力 | 无 |
| #### BDD-25 | 有区分力 | 无 |
| #### BDD-26 | 有区分力 | 无 |
| #### BDD-27 | 回归守护 | 无 |
| #### BDD-28 | 有区分力 | 无（B1 的 DOM 不存在判据是本任务改造质量最高的一条） |
| #### BDD-29 | 约束型（决策 A） | 无 |
| #### BDD-30 | 回归守护 | 无 |
| #### BDD-31 | 有区分力 | **W-新 3 已闭环**：断言②不含 `title`、Given 补「正文不含图表块」 |
| #### BDD-32 | 有区分力 | 无 |
| #### BDD-33 | 回归守护 | 无 |
| #### BDD-34 | 有区分力 | 无 |
| #### BDD-35 | 有区分力 | **B-NEW-2 已闭环**：观测面改为新增暴露的「实际构造行数」，现状无法读数→FAIL；`rows.length` 明文排除；未重引入 W13 |
| #### BDD-36 | 回归守护 | 无（与 BDD-35 的联合约束已在 BDD-35 注内声明） |
| #### BDD-37 | 回归守护 | 无 |
| #### BDD-38 | 有区分力 | 无（造件路径第 2 轮已实跑证实可行） |
| #### BDD-39 | 有区分力 | 无 |
| #### BDD-40 | 有区分力 | 无 |
| #### BDD-41 | 回归守护 | 无 |
| #### BDD-42 | 有区分力 | 无 |
| #### BDD-43 | 回归守护 | `:95`/`:662` 引用已改为 BDD-43（W-新 5） |
| #### BDD-44 | 有区分力 | 无 |
| #### BDD-45 | 有区分力 | 无 |
| #### BDD-46 | 不变守护 | 无 |
| #### BDD-47 | 有区分力 | `:661` P0_STALE 引用已改为 BDD-47（W-新 5） |
| #### BDD-48 | 回归守护 | 无 |
| #### BDD-49 | 回归守护 | 无 |
| #### BDD-50 | 有区分力 | **W-新 6 已闭环**：Then② 补「缺失 `known-failures.md` 判 FAIL 而非 PASS」 |
| #### BDD-51 | 有区分力 | 无 |
| #### BDD-52 | 有区分力 | Given 已钉桌面视口 1280×800（W-新 2） |
| #### BDD-53 | 有区分力 | **W-新 4 已闭环**：`.meta-tags-bar` 拆出并注明 DOM 0；① 的 DOM 归宿陈述留有口径残留 → W-r3-2（不影响判据） |
| #### BDD-54 | 有区分力 | 无 |

**编号格式**：`^#### BDD-[0-9]+:` 54 条全部合规，01–54 连续、无跳号、无重复（脚本枚举）。每条只有一组 Given-When-Then。

---

## 六、前两轮已确认维度（本轮不重做，仅挂锚点）

| 维度 | 第 2 轮结论 | 本轮处置 |
|---|---|---|
| 需求方向 / 8 项缺陷源码事实 / 决策 A、B | 复核通过（第 2 轮复审第一节、§1） | 未重做；`#### BDD-29`（决策 A）、`#### BDD-03`（决策 B）判据未变 |
| 同类扫描 9 组（`§6.1`~`§6.10`） | 7 组实测值精确；`§6.5` 已把 `_BINARY_SIZE_LIMIT` 更正为死常量、`§6.6` 三层口径（27/88/9）精确 | 未重做；本轮仅核对 W-新 5 涉及的引用改号 |
| P0 时效性质疑 | 无严重漂移、3 处轻微漂移已留痕 | 未重做 |
| 裁剪声明 | `phases` P1–P8 全走、`pruned` 为空、各阶段理由非「任务简单」 | 未重做 |
| UX 形态声明 | `ui_render_shape: layout` + `ui_ux_dimensions` 三维度齐备；UX 类别 BDD 21 条；无主观词 | 本轮复核：主观词全文 **0 命中** |
| 能力三态 | 4 条 `status: available`（含 vision `caveat`）、`verification_env` 独立声明 | 未重做 |
| `risk_level: medium` / `ceremony: standard` / `packages` / `domains`（不含 security） | 与改动面匹配，`ceremony: standard` 下 `phases` 含 P7 逐信号核对通过 | 未重做；`git diff --cached` 仍为空（P1 未 `git add`），口径限制同上轮 |
| §11 的 12 条回归守护标签 | 逐条实测抽验，**无一条是假 PASS 换标签** | 未重做；自检表脚本解析 = 覆盖 54 条（42 F→P / 12 P→P），与 B-NEW-2 修好后的事实一致 |
| 第 1 轮 11 项 BLOCKER（B1–B6、B8–B11） | 全部闭环（B7 派生项已由本轮 B-NEW-1 收口） | 未重做 |
| P1 纯净性 / `[NO_NEED_CONFIRM]` | 未掺入解决方案设计；`[NO_NEED_CONFIRM]` 已声明；3 条 SUGGEST 有倾向 + 理由 | 未重做；本轮新增文字**未越过判据线**（第二节 ③、第三节） |

---

## 七、环境与隔离状态

`[PROD_NOT_TOUCHED]` — 全程零接触生产 `:8080`（实测 `curl` 返回 `000` 不可达，未对其发起任何有效请求），未触碰 `~/.peekview/`。所有实测在 debug `:8888` 完成；探针 entry 只经 debug HTTP API 创建（**禁 CLI**）、用完即刻 `DELETE`（返回 200，复查 GET 404）；临时脚本落 `<项目根>/.agate-tmp/r3/`（**未用 `/tmp`**）。

**本轮探针清单（1 个，已删除）**：`w6rv65`（BDD-05 新 When 字面执行用，`path`+`filename` 双给）。

**基线复核归位**：匿名 `GET /api/v1/entries?per_page=100` → `total == 15`（= seed 基线）、`summary` 含 `PROBE` 的条目 **0 个**；alice 登录后 → `total == 22`、`PROBE` **0 个**。第 2 轮的 14 个探针在上一轮已清理，本轮**无任何残留**。

**本轮的取证方式**：静态脚本枚举（BDD 总数/连续性/交叉引用越界/行首 PASS-FAIL/主观词）+ Playwright 真实 DOM（桌面 1280×800，`/k8s-deployment/f` 的 chrome DOM 与可视计数、BDD-05 探针的 TOC 文本与 `<h2>` id）+ TypeScript 实跑（`parseCsv` 现状观测面、双实现对照的构造行数）。

---

## 八、结论

- **`status: approved`**。
- 第 2 轮的 **2 BLOCKER（B-NEW-1 / B-NEW-2）+ 6 WARNING（W-新 1~6）全部闭环**，逐项附实测证据（第一、二、三节）。
- **未引入新的「判据不可执行」或「假 PASS」**：`#### BDD-35` 的假 PASS 面已被禁止性条款排除并经双实现对照证实必要；`#### BDD-05` 的取证通道已改到可执行且具区分力的一层。§11 的「42 条改动前 FAIL」现已名副其实。
- 残留 **2 项文字/口径级 WARNING（W-r3-1 / W-r3-2）**，均不影响 P6 逐条判 PASS/FAIL，建议 P2/P4 顺手处理，**不构成打回理由**。
- 54 条 BDD 逐条判定见第五节；前两轮已确认维度见第六节（本轮未重做）。
