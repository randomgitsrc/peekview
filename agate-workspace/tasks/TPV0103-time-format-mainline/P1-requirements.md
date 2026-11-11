---
phase: P1
task_id: TPV0103
type: problems
parent: P0-brief.md
trace_id: TPV0103-P1-20261111
status: draft
created: '2026-11-11'
agent: analyst
risk_level: low
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
- frontend-v3
- docs
domains:
- frontend
ui_render_shape: layout
ui_ux_dimensions:
- 布局结构
- 交互行为
- 视觉呈现
follows_existing_pattern:
- frontend-v3/src/composables/useRelativeTime.ts
design_trivial: true
prod_touched: false
scope_plus:
- id: TPV0103:P1-requirements:SP1
  text: 改动面计数由「主显偏移断言 8 处」更正为「主显断言 ≥9 处（8 偏移 + 1 秒级 e2e:401）」，并新增 5 处 FOUR_DIGIT_YEAR
    断言的替换与 3 处常量删除（见 §6.1 / §6.1.1）。原清单低估了 1 处必红断言、漏判了 5 处静默恒真断言。
- id: TPV0103:P1-requirements:SP2
  text: backend/tests/test_utc_serialization.py 进入验收面（BDD-10 ⑤：须保持全绿），但不修改该文件——为 §2.3「后端零改动」声明补一个零成本的既有守护点。
scope_resolved:
- id: TPV0103:P1-requirements:SP1
  note: 两条 [SCOPE+] 均源自 P1-review 第 1 轮，已在**本 P1 文件内**落地：SP1 的 ≥9 处计数与 §6.1 分类表、§6.1.1
    的 5 处逐条判定、3 处常量删除均已写入正文；SP2 已写入 BDD-10 ⑤ 与 §10。故 P1 阶段即判 resolved，无需 P7 回补。 改动文件集合未变（5
    个测试文件 + 1 个生产文件 + 2 个文档），属清单精度修正而非范围扩张。
- id: TPV0103:P1-requirements:SP2
  note: 已落地为 BDD-10 ⑤「backend/tests/test_utc_serialization.py 全部用例保持绿」+ §10「改」段落的说明。
    该文件本次不修改，故无实现面残留；P6 验收时按 ⑤ 复核其全绿状态。
---

# P1 需求基线 — 时间主显格式修正（去时区偏移 + 去秒）

[NO_NEED_CONFIRM]

> **本文件的性质**：这不是新增功能的需求，是**反转 TPV0102 的验收判据**。TPV0102 的 BDD-01/03/04/26 断言「主显必须含 `GMT±N`」，本条线断言「主显不得含时区偏移」；TPV0102 的 BDD-02（tooltip 含相对 + 完整偏移 + IANA 名）**保持有效，本任务不得改动其语义**。
>
> **P0 时效性**：已核对，**无严重漂移**；命中 1 处轻微漂移（P0 的跨 locale 正则外推不成立），见第 7 节。
>
> **同类扫描**：见第 6 节（含 ApiKey 两处本地实现的逐条判定）。
>
> **UX 类别 BDD**：`ui_render_shape: layout`（布局型），`ui_ux_dimensions: [布局结构, 交互行为, 视觉呈现]`；UX 类别写入 BDD 标题后缀。
>
> **人工体验路径验收**：见 BDD-12（Given 按文档 seed → Explore 页有内容且时间主显符合新规则），不以 fixture / 单测断言替代。
>
> **本文件不含 PASS/FAIL 预判**——判定结果属 P6。
>
> **修订记录（retry 3）**：按 `P1-review.md` 第 3 轮的 **1 BLOCKER（C）+ 2 MINOR** 修订。
>
> - **BLOCKER-C（时区轴不同源 → 正确实现假 FAIL）**：这是 BLOCKER-A 的**同一失效类别换了一条轴**。retry 2 只把「参考值须与实现同源」修到了 **locale 轴**，漏了**时区轴**——`FIVE_FIELDS` 模板 pin 了 `timeZone:'Asia/Shanghai'`，而被测实现 `useRelativeTime.ts:17-19` 的 options **不含 `timeZone`**（跟随运行时）。后果：宿主 `TZ=Asia/Shanghai` 恰好 PASS（本机永远绿），`TZ=UTC`（CI 常态）与 `America/New_York` 上正确实现**假 FAIL**（`09:43` / `04:43` vs `17:43`）；且本项目 `ci.yml` 不跑 vitest，属「本地绿、他机红」的不可自查陷阱。
>   **修法选方案 1**：`FIVE_FIELDS` **去掉 `timeZone`**（参考值跟随运行时，与实现同源）；需要固定时区时唯一手段是 `test.use({ timezoneId })`（e2e context 级）与**进程启动前**的 `TZ` env（vitest，运行时赋值 `process.env.TZ` 实测无效）。改动落点 4 处：FIX-A 模板、FIX-B 模板、vitest 代码块、**§6.1.1 #2 的「显式传 locale+timeZone」错误指令**（已改写为「locale 显式传 + timeZone 不传」）。新增「同源两条轴」表、BLOCKER-C 三宿主实测表、`e2e:248`/`e2e:410` 两个 describe 无 `locale`/`timezoneId` 的前提说明、以及**验收口径「`TZ=UTC` 下 vitest 与 e2e 均全绿」**（`TZ=Asia/Shanghai` 下的绿不构成有效证据）。
> - **MINOR-1**：BDD-06 判据②的 locale 漏判数由 **7/32** 更正为 **8/32**（补上 `bn-IN` → `GMT +০৮:০০`：`GMT` 与 `+` 之间有空格、数字为孟加拉文）。三处引用（BDD-06 正文、BDD-12 ③、§5.2 表）同步更正，**方向结论不变**（该字面量必须固定 `zh-CN` 才判定）。
> - **MINOR-2**：§8 边界说明原称「浏览器侧唯一增量是 ICU 版本」——**不完整**，实际有**两项**增量：① ICU/CLDR 版本差异 ② **时区来源不同源**（与 BLOCKER-C 同源）。已改为两项分列表，并说明二者修法不同（① 靠同引擎现算吸收，② 靠「模板不 pin 时区 + context 统一」，FIX-A 不能替代 ②）。
> - **未改动**：BLOCKER-A（FIX-A/FIX-B 的写法与实测结论）、BLOCKER-B（256 格分布与「段数不可作判据」）、5 项已闭合（01/02/03/04/07）、12 条 BDD 编号与主题结构、反转方向、决策 D1 与「BDD-04 是 `hour12` 唯一守护点」、retry 2 自主发现的两处坑（参考值须同源 / 对照 locale 用 `sv-SE` vs `en-US`）、frontmatter。
>
> > **关于 `hour12` 的方向**：BDD-01 实测边界表（「`hour12: false` → 判 PASS 的 locale 数 4/5，仅 `en-US` 抓到」）经第 3 轮评审独立复测确认为**正确方向**——`hour12: false`（强制 24 小时制）在 `zh-CN`/`ja-JP`/`de-DE`/`sv-SE` 上输出与正确实现完全相同（4 个逃逸），仅 12 小时制的 `en-US` 可辨。决策 D1 要防的正是这条「强制 24 小时制」的过修路径，故守护点归 BDD-04 不变。
>
> **修订记录（retry 2）**：按 `P1-review.md` 第 2 轮的 2 BLOCKER + 4 MINOR 修订。
>
> - **BLOCKER-A（判据在正确实现上假 FAIL）**：BDD-01「判定方法」代码块原在 **Node 侧**用 `toLocaleString(undefined, …)` 现算参考值，而 `test.use({ locale })` 只改浏览器 context、**不改 Node 进程 locale** → 正确实现实测 3/5～4/5 假 FAIL（宿主 `zh-CN` → 2/5；宿主 `en_US` → 1/5）。改为 **FIX-A（浏览器内 `page.evaluate` 现算，e2e 首选）+ FIX-B（Node 侧显式传 locale 字符串）**，两种写法实测均 5/5 全过；并删除上一版「写法 A……天然一致」这一**错误断言**，明确「同源」= **显式同源**而非「都跟随环境」。另补 vitest 侧实测约束：实现硬编码 `undefined` 且 jsdom 无 context，运行时改 `process.env.LANG` **不生效**（Intl 缓存 resolved locale），故参考值须取 `resolvedOptions().locale` 再显式传。
> - **BLOCKER-B（段数命题为假 + 统计错）**：① §5.1「含任意 `timeZoneName` 恒 ≥6 段」为假，改为 256 格 × 8 变体的实测分布（`long` 恒 5 段、`shortGeneric`/`longGeneric` 各 224 格 5 段、`short` 自身即 `{5:50,6:112,7:94}`），并给出准确命题「主显恒 5 段；含 `second` 恒 ≥6；`timeZoneName` 段数随「取值×locale×时区」变化，故不可作判据」；② `timeZoneName` 合法取值 **6 种**（`none`/`offset`/`generic` 抛 `RangeError`），变体数 **6×5×2 = 60**（原「7 种 / 65 变体」两个数皆错）；③ §8 去掉残留的旧判据描述「段数、去 GMT/UTC、子序列」，改为按 BDD 分开表述。
> - **4 MINOR**：MINOR-01 ICU 稳定性论证限定到 BDD-07（BDD-01 的跨 ICU 鲁棒性来自「参考值与实现同源现算」而非判据性质，已列表区分）；MINOR-02 §9 的 `ui_affected` 引用改为正文表述（该字段由 P2 声明，P6 provenance 只读 P2）；MINOR-03 补结构化 `scope_plus` / `scope_resolved`（SP1/SP2，P7 机械检查读结构化字段，不读散文）；MINOR-04 §5.2 去掉 option 名 `longOffset`，改为语义表述。
> - **未改动**：5 项已闭合 BLOCKER（01/02/03/04/07）、12 条 BDD 编号与主题结构、反转方向、决策 D1、上一轮自主发现的两处坑（参考值须同源；对照 locale 不选 `zh-CN`/`ja-JP`）。
>
> **修订记录（retry 1）**：按 `P1-review.md` 的 7 BLOCKER 修订。核心变更：BDD-01 从「数字段数==5 ∧ 不含 `GMT`/`UTC`」改为「与该 locale 的五字段参考格式化输出**逐字符相等**」——原判据被实测证伪（`timeZoneName: long`/`shortGeneric`/`longGeneric` 输出 5 段且无 `GMT`/`UTC`），属「用文本特征反推实现参数」这一不可靠路径；新判据实测对 **60** 个错误变体全部 FAIL（retry 2 更正：原记 65，算术错，合法 `timeZoneName` 为 6 种）。相关连带修改：BDD-07 删除错误宣称并声明能力边界、BDD-08 空串项据实改写、BDD-11 ② 改为 P6 可判形态、BDD-12 固定 locale/时区、BDD-05/10 同步、改动面由 8 处更正为 ≥9 处并新增 §6.1.1（5 处 `FOUR_DIGIT_YEAR` 逐条判定）、§5.1 段数由 7/8 更正为 6/7。

---

## 1. 需求复述

**要解决什么问题**（不是「要实现什么」）：

PeekView 网页界面的时间主显（Explore 卡片、Explore 列表行、详情页桌面头部、详情页移动元信息条四处，共用 `TimeDisplay.vue`）在 v0.27.0 显示为 `2026/11/10 GMT+8 17:43:00` 这样的形态。用户在看到实际效果后质疑：这类带 `GMT+8` 偏移与秒的串不该出现在普通用户界面。

**为什么这构成缺陷（而不是风格偏好）**：

1. **主显时间由浏览器时区决定，就是用户本地的当前时间**——用户看自己所在地的墙上时间，不存在「这是哪里的时间」这个待澄清项。TPV0102 立项理由「带时区名以消除歧义」的前提因此不成立。
2. **`GMT+8` 是机器可读格式**：ISO 8601 / HTTP `Date` header 需要偏移，因为要在**无上下文**下传输时刻；用户界面自带浏览器时区这一上下文，偏移在扫视场景里是纯噪音。业界同类界面（GitHub / Gmail / Twitter 的时间主显）均不带偏移。
3. **秒对「这个 entry 什么时候发的」无信息量**：用户在扫视列表时不关心第几秒，而且秒使主显与悬停提示显得重复且不一致。

**修正后的信息分层**：

| 位置 | 内容 | 场景性质 |
|---|---|---|
| 主显（扫视） | 日期 + 时:分（跟随浏览器 locale，含其 12/24 小时制偏好） | 快速判断新旧 |
| 悬停 tooltip（主动查询） | 相对时间 · 精确到秒的绝对时间 · 完整偏移 `GMT±HH:MM` · IANA 时区名 | 跨时区协作、需要完备信息时 |

**换言之**：本次需求是「把机器可读格式从人读界面撤回，只在用户主动查询时才展开」，**不是**「砍掉时区信息」。

---

## 2. 隐含需求识别

逐维度过一遍，每条写明「为什么必须」。

### 2.1 数据维度

| 隐含需求 | 为什么必须 |
|---|---|
| 无数据迁移、无 schema 变更 | 主显是纯渲染期格式化，`created_at` 等字段的存储形态（naive-UTC）与序列化出口（带 `Z`）均不变。若误改序列化层会重演 TPV0102 的破坏性变更 |
| 无效/缺失时间值的降级行为不得回退 | 现有 `formatFullDate` 对无法解析值返回 `—`、`formatTooltip` 返回 `Invalid date`。少传两个字段后若不慎用 `dateStyle` 等被禁 options 会抛 `TypeError`，整块时间渲染崩掉 |

### 2.2 前端维度

| 隐含需求 | 为什么必须 |
|---|---|
| 四处渲染点必须同步生效（不是三处） | `TimeDisplay.vue` 被 `EntryCard` / `EntryListRow` / `EntryDetailHeader` / `EntryMetaTagsBar` 四个组件消费（实测 grep）。P0-brief 第 112 行写「三处渲染点」但括号里列了**四项**（卡片 / 列表 / 详情页桌面 / 详情页移动），TPV0102 P2 §3.4 亦写「三处」。按消费方实测为**四个**（`EntryCard` / `EntryListRow` / `EntryDetailHeader` / `EntryMetaTagsBar`），BDD-05 按四处验证。主显逻辑本身只在一处，但「改一处即全生效」不等于「四处都渲染到了」 |
| tooltip 的 DOM 结构与可见性机制不得被顺手改动 | TPV0102 为此付过代价：`opacity: 0` 隐藏会被 `isVisible()` 判为可见、原生 `title` 属性在 Playwright 下不可断言。本次只改格式化参数，**不得**触碰 tooltip 结构 |
| 12/24 小时制必须继续跟随 locale 偏好 | 若为「统一好看」而加 `hour12: false`，`en-US` 用户会看到 `17:43`，等于用界面覆盖用户的地区习惯——这与「主显就该是用户本地习惯的时间」这一**本次修正的立论基础**直接冲突（见第 4 节决策 D1） |
| 时间文本宽度会变短，不得触发新的溢出/折行 | 主显从 `2026/11/10 GMT+8 17:43:00`（25 字符）缩短到 `2026/11/10 17:43`（16 字符），`en-US` 由 `11/10/2026, 05:43:00 PM GMT+8`（29）缩到 `11/10/2026, 05:43 PM`（20），理论上更宽松；但四处容器不同（卡片 meta 行、列表行、详情头 `meta-row`、移动 `flex-wrap` 条），需 P6 截图确认无回归 |

**P0 点名的 TPV0102 视觉契约 VC-1 / VC-3：已核对，本次无需反转**（P0-brief 第 102 行提出该问题，此处给结论）：

| 契约 | TPV0102 原义 | 本次是否受影响 | 理由 |
|---|---|---|---|
| **VC-1** | tooltip 不横向溢出 viewport | **不受影响** | 本任务**不改 tooltip** 的内容、结构与样式（BDD-06 反向守护其不得回归）。tooltip 文本长度、盒宽、定位方式全部与 TPV0102 一致，溢出风险面无变化 |
| **VC-3** | 卡片元信息行不因时间文本**变长**而溢出 | **方向相反，不需反转** | 该契约防的是「文本变长导致溢出」。本次主显是**变短**：`zh-CN` 25→16 字符、`en-US` 29→20。即 VC-3 原本要防的压力被解除，不存在需要加强的检查项。但**「变短」有新风险**：`flex` 布局下元素收缩后可能出现对齐偏移或间距塌陷——这不是 VC-3 的语义，故单列在 §2.2 上一行（由 P6 四处截图确认），不冒充 VC-3 的延续 |

**结论**：P0 提到的 VC-1/VC-3 均**不需要**在本次改动中反转或新增断言；P6 的视觉核对按上表分工执行（tooltip 形态复用 TPV0102 既有结论；主显变短后的布局塌陷为本次新增的截图检查点，已由 §2.2 交付）。

### 2.3 多端维度

| 隐含需求 | 为什么必须 |
|---|---|
| 后端 / API / MCP **零改动**，且必须显式声明零改动 | 这是本次改动**不**破坏任何 API 消费者契约的唯一依据。API 的 `created_at`（带 `Z`）必须保持：那是机器读场景，偏移正是它需要的——与「人读界面不要偏移」是同一条原则的两面 |
| MCP `createEntry.ts` 回显的 `Created: <ISO(Z)>` 必须保留 | 实测该处直接打印 API 原始 ISO 串。若有人把「去偏移」误理解为全局策略而波及此处，会让 Agent 侧丢失时刻语义 |
| CLI `--json` 输出不受影响 | 同属机器读出口 |

### 2.4 边界维度

| 隐含需求 | 为什么必须 |
|---|---|
| 午夜边界（00:00 / 12:00 AM） | 实测 `2026-11-09T16:00:00Z` + `Asia/Shanghai` → `zh-CN` `2026/11/10 00:00`、`en-US` `11/10/2026, 12:00 AM`。若判据写成「不含 `00`」或「不含 `12`」会假 FAIL |
| 24 小时制 locale 的午夜是否出现 `24:00` | 实测 32 locale 均不出现（`ja-JP` 亦为 `00:00`）。此边界**无需**额外处理，但 P3 若写边界断言须以实测为准 |
| 非整小时时区偏移（`+05:30` / `+13:45` / `+12:45`） | tooltip 判据若硬编码 `GMT±N`（无分钟）会在 `Asia/Kolkata` 等时区漏判；TPV0102 已用 `GMT[+-]\d{2}:\d{2}` 处理，本次不动。**与段数判据的关联**：非整小时时区下 `shortOffset` 输出带分钟（实测 `Asia/Kolkata` `2026/11/10 GMT+5:30 15:13`、`Pacific/Chatham` `GMT+13:45`、`Australia/Adelaide` `GMT+10:30`），数字段数为 **7** 而非 6——即同一 option 的段数随时区而变。这也是段数不可作为实现参数判据的又一实证（见 §5.1 / §5.2） |
| 夏令时时区 | 主显不含偏移 → DST 完全由浏览器处理，无待判项；tooltip 的偏移随 DST 变（`GMT-5` ↔ `GMT-4`），BDD 必须固定到无 DST 时区（`Asia/Shanghai`）才可写死字面量 |

### 2.5 兼容维度

| 隐含需求 | 为什么必须 |
|---|---|
| 已发布行为变更 → CHANGELOG `[Unreleased]` + `upgrading.md` | 用户可见的输出改了；UPGRADING 是「跨版本升级注意事项」的唯一落点（项目约定：不写进 CHANGELOG 的 `[Unreleased]` 正文，避免 bump 时错位） |
| 版本号判定留到 P8（patch vs minor） | 修正已发布行为、无 API 变更。P1 不预定版本号，但需求要写明「必须有版本发布」，否则 P8 会漏 |
| 既有偏移断言必须**按行号穷举**后反向修改 | 「只改生产代码不改测试」会让 CI 立刻红；「改测试但不留记录」则是 TPV0102 的反面教训（曾漏 `EntryListRow.spec.ts` 一处致静默丢覆盖点）。P0 的「26 处」是未区分方向的粗估。**实测改动面（两类分开计数）**：需反转的**主显偏移断言 8 处**（e2e 6 + spec 2）＋**主显秒级断言 1 处**（`e2e/tpv0102-explore-card-list-ux.spec.ts:401`，`toContain('HH:MM:SS')`，其期望值由同 test 内 `:394` 的 `second: '2-digit'` 算出）＝ **主显断言合计 ≥9 处**；另**常量声明 3 处**需删除、**tooltip 偏移断言 5 处**须保留。另有 `FOUR_DIGIT_YEAR`（4 位年份）主显断言 5 处使用点，逐条判定见 6.1.1。故本需求要求 P3 以行号穷举、P7 逐条核对 |
| 不得把「去偏移」扩大为「去时区能力」 | tooltip 的三段完整信息是本次改动的**配套保留物**，不是被移除物。若 P4 顺手把 tooltip 也简化，等于把缺陷修成了另一个缺陷 |
| 「三处渲染点」的表述偏差需在基线里更正 | P0-brief 与 TPV0102 均称三处，实测为**四个消费点**（卡片 / 列表行 / 详情页桌面头部 / 详情页移动元信息条）。P1 按四处建基线，避免 P6 只截三处 |

---

## 3. BDD 验收条件

共 **12 条**（BDD-01 ~ BDD-12，编号连续）。每条独立可二值判定（PASS / FAIL）。

**判据设计的共同纪律**（四条均来自实测，不是偏好）：

1. **不硬编码时间字面量**。`17:43` 在 `en-US` 下是 `05:43 PM`。凡需字面量，Given **必须**显式固定 locale 与时区；无法固定时（人工体验路径），期望值改为**运行时现算的参考文本**。
2. **不用「文本特征」反推「实现传了什么参数」**。`/GMT|UTC|[+-]\d/` 这类正则既会在 `sv-SE` / `lt-LT` / `nl-NL` / `en-CA` 4/32 locale 假 FAIL（日期分隔符 `-`，实测 `sv-SE` → `2026-11-10 17:43`），也会在 `zh-CN` / `en-US` / `ja-JP` / `de-DE` 上假 PASS（完全不命中 = 对错误实现无保护力）；而「数字段数 == 5 ∧ 不含 `GMT`/`UTC`」会被 `timeZoneName: long` / `shortGeneric` / `longGeneric` 假 PASS。**正确做法是与参考格式化的输出逐字符相等**（BDD-01），而不是在文本上继续追加特征条件。
3. **不用「4 位年份」判据**。`fa-IR` 输出波斯历 `۱۴۰۵/۰۸/۱۹, ۱۷:۴۳`，`/\d{4}/` 不匹配且数字非 ASCII；且它在 `en-US` 新形态下恒真，是恒绿死断言。仓库现存 5 处使用点按 6.1.1 全部替换。
4. **段数（`\p{Nd}+` 计数）只能用于「自检判据自身」或「弱存在性」，不能用于判定实现参数**。主显恒 5 段这一点是稳的（256/256 格），但「5 段」既不排除无数字偏移的时区名，也不能区分 6 段来自秒还是时区名（§5.1）。

### 3.1 主显格式（前端）

#### BDD-01: 布局结构：主显与该 locale 的「五字段参考格式化」输出逐字符相等

- Given 浏览器时区固定为 `Asia/Shanghai`，locale 依次取 `zh-CN`、`en-US`、`de-DE`、`ja-JP`、`sv-SE`（每个 locale **独立判定一次**），一个 `created_at` 为 `2026-11-10T09:43:00Z` 的 entry
- When 读取该 entry 卡片的时间主显文本，并在**同一运行环境**（同一引擎、同一 ICU、同一 locale、同一时区）内，用只声明「年 / 月 / 日 / 时 / 分」五种数值字段的参考格式化现算该时刻的参考文本
- Then 对上述**每一个** locale 同时满足：① 主显文本与**该 locale 的参考文本逐字符相等**（全串相等，不做子串或形态猜测）② 参考文本自身通过自检：连续 Unicode 十进制数字段（`\p{Nd}+`）恰为 5 段、且不含 `GMT`/`UTC` ③ 参考文本对 locale 敏感：在**同一个测试内**用枚举方式算出 `sv-SE` 与 `en-US` 两个 locale 的五字段参考文本，二者**互不相等**（证明期望值不是 locale 无关的常量，从而「硬编码一种形态」的实现不可能同时通过 5 个 locale 的判定）

> ③ 特意选 `sv-SE` 与 `en-US` 作对照，**不选 `zh-CN` 与 `ja-JP`**：实测这两个 locale 的五字段输出**完全相同**（均为 `2026/11/10 17:43`），用它们做对照会得到「相等」而误判 ③ 失败。这不是 bug 而是 ICU 的真实行为——多个 locale 共享同一日期时间模板是正常的，故 ③ 只能选一对**实测不同**的 locale。

**判定方法（P6 可照抄，变量名不约束实现）**：

> ⚠️ **参考值不得写成「Node 侧 `toLocaleString(undefined, …)`」**。`test.use({ locale })` 只设定**浏览器 context** 的 locale，**不改变 Node 测试进程的 locale**——在 Node 侧用 `undefined` 求参考值会取到宿主 locale，与实现（浏览器 locale）**永不相等**。实测正确实现在此写法下 3/5～4/5 假 FAIL（宿主 `zh-CN` → 2/5 PASS；宿主 `en_US.UTF-8` → 1/5 PASS，`r2-a-probe.mjs`）。以下两种写法均实测 5/5 全过，**择一**。
>
> ⚠️ **同时注意「同源」是两条轴，不止 locale**：参考值模板里**不得出现 `timeZone`**。被测实现的 options 不含 `timeZone`（跟随运行时时区），模板一旦 pin 时区（例如 `timeZone:'Asia/Shanghai'`），在宿主 `TZ=UTC` 的 CI runner 上正确实现即**假 FAIL**（`09:43` vs `17:43`）。固定时区只能用 `test.use({ timezoneId })`（e2e context 级）或进程启动前的 `TZ` env（vitest）。详见下方「同源有两条轴」表与 BLOCKER-C 实测表。

**FIX-A（e2e 首选）：参考值在浏览器内现算——与实现同处一个 JS 环境**

```js
// 每个 locale 是一个独立 test 用例（Playwright 的 locale 是 context 级 fixture，不能在同一 test 内切换）
test.use({ locale: 'sv-SE', timezoneId: 'Asia/Shanghai' })   // 逐个 locale 参数化

// ⚠️ 模板不得含 timeZone：实现（useRelativeTime.ts:17-19）不传 timeZone，参考值亦不得 pin
// 需要固定时区时，唯一手段是 test.use({ timezoneId })（context 级），不是往模板里加 timeZone
const FIVE_FIELDS = { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }

// ① 参考值在浏览器内用同一引擎现算（locale 参数同样传 undefined → 取浏览器 context locale；
//    时区不传 → 取浏览器 context timezoneId，与实现同源）
const ref = await page.evaluate(
  ([createdAt, five]) => new Date(createdAt).toLocaleString(undefined, five),
  [created_at, FIVE_FIELDS],
)
const mainText = (await page.locator(...).textContent()).trim()   // 被测实现的主显
const segCount = (ref.match(/\p{Nd}+/gu) || []).length            // ② 自检：必须 == 5
expect(mainText).toBe(ref)                                        // ① 逐字符相等

// ③ 参考值对 locale 敏感（同 test 内可做，无需跨 test 状态）
const d = new Date(created_at)
expect(d.toLocaleString('sv-SE', FIVE_FIELDS)).not.toBe(d.toLocaleString('en-US', FIVE_FIELDS))
```

**FIX-B（无浏览器环境用 / 交叉核算用）：Node 侧显式传 locale 字符串，不用 `undefined`；且模板不 pin `timeZone`**

```js
// 时区不显式传 → 与实现的「不传 timeZone」同源（跟随 Node 运行时时区）
const FIVE_FIELDS = { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }
const locale = page ? await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().locale) : 'sv-SE'
const ref = new Date(created_at).toLocaleString(locale, FIVE_FIELDS)   // 显式传 locale，时区跟随运行时
expect(mainText).toBe(ref)
```

**两种写法的适用场景与实测结果**：

| 写法 | 参考值 locale 来源 | 实测（正确实现） | 何时用 |
|---|---|---|---|
| ~~Node 侧 `undefined`~~ | 跟随 **Node 进程** locale | **假 FAIL**（`zh-CN` 宿主 2/5、`en_US` 宿主 1/5） | **禁止** |
| **FIX-A** | 与实现**同一个**浏览器 JS 环境，locale 与 timeZone 均同传 `undefined` | **5/5 PASS**（`TZ=Asia/Shanghai`/`UTC`/`America/New_York` 三种宿主均如此） | e2e / P6 验收（首选） |
| **FIX-B** | Node 侧**显式**传 locale 字符串，`timeZone` 不传 | **5/5 PASS**（三种宿主均如此） | 无浏览器环境；或 e2e 之外的交叉核算 |

**FIX-A 与 FIX-B 的差别只在实际强度，不在是否可用**：FIX-A 的参考值与实现在**同一引擎实例**内求值，故连「浏览器与 Node 的 ICU 版本差异」这一维度也被自动吸收（本轮实测 Node ICU 78.3 与 Chromium 148 在 16 locale 上五字段输出逐字符全等、0 差异，但这是当下事实而非常量前提）；FIX-B 依赖「Node 侧 ICU 与浏览器侧 ICU 对该 locale 模板一致」，多一个隐含前提。因此 **e2e 用 FIX-A**，FIX-B 用于没有浏览器进程的场合（如 Node 脚本核算）。

**「同源」有两条轴，缺一不可（locale 轴 + 时区轴，BLOCKER-C）**：

| 轴 | 实现的实际来源（`useRelativeTime.ts:17-19`） | 参考值的合法写法 | 错误写法及其后果 |
|---|---|---|---|
| **locale** | `toLocaleString` 的 locale 参数**硬编码 `undefined`** → 跟随运行时 locale | e2e：FIX-A 同传 `undefined`（取浏览器 context locale）；Node：取 `resolvedOptions().locale` 后**显式**传 | Node 侧直写 `undefined` → 取宿主进程 locale ≠ 浏览器 locale → 假 FAIL（BLOCKER-A） |
| **timeZone** | options **不含 `timeZone`** → 跟随运行时时区 | **模板里不写 `timeZone`**；需要固定时区时用 `test.use({ timezoneId })`（e2e context 级）或**进程启动前**的 `TZ` env（vitest） | 模板里 pin `timeZone:'Asia/Shanghai'` → 非上海宿主上正确实现假 FAIL（BLOCKER-C，实测见下） |

**BLOCKER-C 的实测证据（本轮自跑，三种宿主 TZ × 真实 vitest 1.6 + 真实 Playwright 1.60）**：

| 宿主 `TZ` | 实现输出 | 缺陷版参考值（模板 pin `Asia/Shanghai`） | 判定 | 修正后参考值（模板不 pin） | 判定 |
|---|---|---|---|---|---|
| `Asia/Shanghai` | `2026/11/10 17:43` | `2026/11/10 17:43` | PASS（**恰好**，故本机永远绿） | `2026/11/10 17:43` | PASS |
| **`UTC`**（CI 常态） | `2026/11/10 09:43` | `2026/11/10 17:43` | ❌ **假 FAIL** | `2026/11/10 09:43` | ✅ PASS |
| **`America/New_York`** | `2026/11/10 04:43` | `2026/11/10 17:43` | ❌ **假 FAIL** | `2026/11/10 04:43` | ✅ PASS |

判别力不受影响（方案 1 实测，5 locale × 8 错误变体 = 40 组，浏览器内实跑，三种宿主 TZ 结果一致）：**正确实现 5/5 PASS（0 假 FAIL）；错误变体抓到 36/40**——其中 `second` 5/5、6 种 `timeZoneName` 各 5/5（共 30/30）、`hour12:false` **1/5**（仅 `en-US`，其余 4 locale 与正确形态完全相同，本就不该被这条抓）；参考值 `segCount` 恒 5。`hour12:false` 的守护点是 **BDD-04**，不是本条。

**验收口径的自跑记录（retry 3，`TZ=UTC` 为硬验收条件）**：

| 侧 | 探针 | `TZ=UTC` 结果 | `TZ=America/New_York` | `TZ=Asia/Shanghai` |
|---|---|---|---|---|
| vitest（`environment: node`，真实 vitest 1.6，逐行照抄本节最终代码块） | `.agate-tmp/r3/final-acceptance.spec.ts` | **10 passed**（impl `2026/11/10 09:43` === ref `2026/11/10 09:43`） | **10 passed**（`04:43` === `04:43`） | **10 passed**（`17:43` === `17:43`） |
| Playwright（真实 1.60，`test.use` 语义复刻 FIX-A） | `.agate-tmp/r3/pw-final.mjs` | **未 pin 时区的 describe PASS / 已 pin 的 describe PASS / 正确实现 5/5 / 错误变体 35-35 全抓 → 全绿** | **同上，全绿** | 全绿 |
| 缺陷版对照（旧模板 pin `Asia/Shanghai`） | 同上 | **假 FAIL 复现**（`09:43` vs `17:43`） | **假 FAIL 复现**（`04:43` vs `17:43`） | PASS（**恰好**同区，故缺陷在此宿主不可见） |

即：**`TZ=UTC` 下正确实现不假 FAIL、错误实现不假 PASS，vitest 与 e2e 两侧均成立**（`TZ=Asia/Shanghai` 的绿是「恰好」而非证据，已在上行显式标注）。

**因此固定的时区只允许来自「context / 进程级」，不允许来自「参考值模板」**：
- e2e：`test.use({ locale, timezoneId })` 设在 describe 级，参考值与实现同处该 context。**特别注意 `e2e:248`（`TPV0102 时间显示基础形态`）与 `e2e:410`（`TPV0102 详情页`）两个 describe 既无 `locale` 也无 `timezoneId`**——BDD-01 的参考值替换落在其后（`e2e:258/267/426`）时，模板一旦 pin 时区，CI（UTC runner）上这三处必红。
- vitest：`TZ` 必须在**进程启动前**由环境给定；实测在测试代码里运行时赋值 `process.env.TZ` **无效**（`resolvedOptions().timeZone` 不随其变化，与 locale 侧的 Intl resolvers 缓存同理）。
- 结论句：**「显式传 `timeZone`」不是正确做法**——实现的 options 里没有 `timeZone`，参考值也不得有。参考值只能「跟随同一运行时的时区」，靠 context/进程环境统一，不靠往模板里加字段。


**③ 为什么这样写而不是「跨 locale 直接比较主显文本」**：Playwright 的 `locale` 是 context 级 fixture，同一个 test 内无法切换，因此「把 5 个 locale 的主显放在一起两两比较」需要跨 test 传状态，既脆弱又依赖执行顺序。改为在**同一 test 内**验证「两个 locale 的**参考值**不相等」——这足以排除「期望值是 locale 无关常量」的情形：若期望值不随 locale 变，则「硬编码单一形态」的实现会 5/5 全过；一旦期望值随 locale 变（③ 成立），该实现最多只能过其中 1 个。故 ③ 用一个局部可算的断言，达到了原「跨 locale 对照」要防的失效模式。

**求参考值时必须与实现**显式同源**（否则是判据自身造成的假 FAIL）**：被测实现 `useRelativeTime.ts:17-19` 调用 `toLocaleString` 时 locale 参数**硬编码为 `undefined`**（即「跟随运行时 locale」），options 里**不含 `timeZone`**（即「跟随运行时时区」）。因此参考值的 **locale 轴与时区轴都必须与实现同源**：locale 不能自行写死，时区也不能自行 pin。**漏掉任一轴都是判据自身造成的假 FAIL**（漏 locale 轴 = BLOCKER-A，漏时区轴 = BLOCKER-C）。

**「同源」的正确含义是「显式同源」，不是「都跟随环境」**（这是 retry 1 的错误断言，此处改正）：

| 场景 | 实现的实际 locale / 时区来自 | 参考值合法写法 |
|---|---|---|
| e2e（Playwright） | 浏览器 context 的 `test.use({ locale, timezoneId })` | **FIX-A**：`page.evaluate` 内 locale 与 timeZone 均不传（`undefined`）→ 取到**同一个**浏览器 context 的 locale 与时区；时区需要固定就在 `test.use` 里固定，**不进模板** |
| e2e（不现算时） | 同上 | **FIX-B**：先用 `page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().locale)` 读出浏览器 locale，再把它作为**显式字符串**传给 Node 侧参考值；`timeZone` 仍不传（Node 侧时区须与该测试的浏览器时区一致——故此法仅在「未 pin `timezoneId` 且宿主时区与浏览器一致」或「两侧已显式 pin 同一时区」时可用） |
| vitest / jsdom（无浏览器 context） | **Node 进程** locale 与时区（`test.use` 在此**不生效**） | **FIX-B**：`Intl.DateTimeFormat().resolvedOptions().locale` 取进程 locale 后**显式**传参，`timeZone` **不传**（见下）；需要固定时区只能靠**进程启动前**的 `TZ` env |

**为什么「两边都传 `undefined`」在 e2e 下不等于同源**：`undefined` 在两侧解析到的是**两个不同的 locale 来源**——浏览器内的 `undefined` 取浏览器 context locale，Node 侧的 `undefined` 取宿主进程 locale。二者的值通常不同（实测 `zh-CN` 宿主 vs `sv-SE` 浏览器），于是「都写 `undefined`」看似对称、实际错配。**必须让两侧指向同一个被显式确定的值**，或干脆让参考值在实现所处的那个环境内求值（FIX-A）。时区轴同理，只是它的错配在**宿主时区恰好与目标时区相同**时不会显形（本机 `Asia/Shanghai` 就是这种「恰好」），比 locale 轴更隐蔽。

**vitest 侧的额外约束（实测，`r2-vitest2.mjs` + 本轮 `.agate-tmp/r3/verify.spec.ts`）**：实现既硬编码 `undefined`，jsdom 又无浏览器 context，故 vitest 下**无法把实现固定到任意 locale**——`process.env.LANG = 'en_US.UTF-8'` 在运行时赋值后 `resolvedOptions().locale` **仍是 `zh-CN`**（Intl resolvers 缓存，不随 env 变化）。时区同理：运行时赋值 `process.env.TZ` 后 `resolvedOptions().timeZone` 不变。因此 vitest 的参考值只能写成「取进程 locale 显式传 + 模板不 pin 时区」：

```js
const LOC = Intl.DateTimeFormat().resolvedOptions().locale      // 与 impl 的 undefined 同源
// timeZone 不传（不 pin）：与 impl 的「不传 timeZone」同源，宿主 TZ 为 UTC/纽约时同样成立
const FIVE_FIELDS = { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }
const ref = new Date(created_at).toLocaleString(LOC, FIVE_FIELDS)
expect(formatFullDate(created_at)).toBe(ref)                    // 三种宿主 TZ 下均成立
```

若误写成 `toLocaleString('en-US', …)` 写死一个 locale，则宿主为 `zh-CN` 时 impl=`2026/11/10 17:43` vs ref=`11/10/2026, 05:43 PM` → **假 FAIL**。若误把 `timeZone:'Asia/Shanghai'` 写进模板，则宿主为 `UTC` 时 impl=`2026/11/10 09:43` vs ref=`2026/11/10 17:43` → **假 FAIL**（BLOCKER-C）。

> **若确实需要把某个测试固定在某个时区**（例如 BDD-04 的 `en-US` + 上海字面量）：vitest 侧**只有**「进程启动前设 `TZ`」（`TZ=Asia/Shanghai npx vitest run …` 或 `package.json` script 前缀），**不能**在测试代码内运行时改 `process.env.TZ`（实测无效）。

**验收口径（P3/P6 必须按此判定，写死在此处防再漂移）**：**`TZ=UTC` 下 vitest 与 e2e 均全绿**。`TZ=UTC` 是 CI runner 的常态，而本机宿主为 `Asia/Shanghai`——两者恰好同区的巧合会让时区轴错配在本地永远不显形（本项目 `ci.yml` 不跑 vitest，本地绿 ≠ 可移植），故 `TZ=UTC` 是唯一有意义的判定条件，`TZ=Asia/Shanghai` 下的绿**不构成**有效证据。

**vitest 单 locale / 单时区断言的诚实边界**：由于实现与参考同源，vitest 只能判「实现输出等于**当前宿主 locale + 当前宿主时区**的正确形态」——在 `zh-CN` 宿主下，一个「硬编码 `zh-CN`」的错误实现也能通过（实测 true）；同理，一个「硬编码 `Asia/Shanghai` 时区」的错误实现在上海宿主上也能通过。这两个失效模式都由 **e2e 的 5 locale 参数化**承担（`zh-CN` 宿主下硬编码 locale 的实现最多过 1/5；`TZ=UTC` 宿主下硬编码时区的实现同样最多过 1/5），故 P3 不得以「vitest 已绿」替代 e2e 的跨 locale/跨时区判定。

本条判据的判定对象是「两者相等」，故任何一侧的 locale/时区来源错配都会表现为红灯——P3 必须让两边的来源**两条轴都显式同源**，这是判据可用性的前提（不是实现要求）。

**为什么是这个标准（本条是本次反转的核心，必须回答设问）**：

- **为什么彻底放弃「段数 + `¬GMT`/`¬UTC`」这套判据**：它用「文本长什么样」反推「实现传了什么参数」，而这条推论**不完备**——`timeZoneName` 有 **6 种**合法取值，其中 3 种（`long` / `shortGeneric` / `longGeneric`）在多数 locale 下的输出既没有数字偏移、也不含 `GMT`/`UTC`，段数仍是 5。实测 `zh-CN` + `Asia/Shanghai`：`short`=6 段、`long`=**5 段**、`shortOffset`=6 段、`longOffset`=7 段、`shortGeneric`=**5 段**、`longGeneric`=**5 段**；`2026/11/10 中国标准时间 17:43`（5 段、无 `GMT`）→ 旧判据**假 PASS**；`en-US` 同型 `11/10/2026, 05:43 PM China Standard Time` 亦假 PASS。**堵漏不能靠在文本上追加特征条件**（每加一条都有新的漏法），只能换判据类型。段数的完整事实见 §5.1。
- **为什么「逐字符相等」能堵住**：不与文本特征博弈，直接与**参考实现的输出**比对。参考值由测试在运行时按「只有五个数值字段」现算——任何多传 `timeZoneName`（6 种合法取值之一）或多传 `second` 的实现，输出必然与参考值不同。**实测判别力**：5 locale × 6 种 `timeZoneName` × 有/无 `second` = **60 个错误变体，假 PASS = 0**；正确形态 **5/5 PASS，假 FAIL = 0**（`.agate-tmp/r2-power.mjs`，浏览器内实跑）。
- **为什么不再需要单独断言「不含 `GMT`/`UTC`」**：逐字符相等**蕴含**该结论（参考值本身不含偏移标识，被断言文本等于参考值）。若继续单列它，反而会重新引入「某条文本特征能代表参数」的错觉。故该结论降级为参考值自检项 ② 的一个附带输出，**不再作为反推实现参数的判据**。
- **为什么 ② 的段数检查保留、但对象换成参考值**：它的职责从「判实现」变成「判判据自身没写错」——若有人把参考值改成含秒或含偏移字段，② 立即红，避免出现「参考值与实现同时错、于是相等」的假绿。这是把段数用在它能胜任的地方。
- **`sv-SE` 为什么必须在清单里**：旧判据 `/GMT|UTC|[+-]\d/` 在 `zh-CN`/`en-US`/`ja-JP`/`de-DE` 四 locale 上全部不命中（实测 4/4），即这 4 个 locale 完全落在该退化判据的假 PASS 侧；只有 `sv-SE`（`2026-11-10 17:43`，日期分隔符为 `-`）会让该正则命中 `-10` 而**假 FAIL**。把 `sv-SE` 纳入清单后，任何试图把判据退化回「正则查符号」的改动都会立刻在 `sv-SE` 上变红——这是本清单对「判据退化」这一失效模式的唯一有效钉子。逐字符相等方案下该 locale 无任何副作用（其参考值同样是 5 段）。
- **判据不绑定实现**：断言对象是**用户能看到的主显文本**与**同一环境下现算的参考文本**，不涉及类名、函数名，也不要求实现必须写成何种形式——只要输出正确就相等。

**本条判据的实测边界（诚实申报，避免 P6 误判覆盖强度）**：对 8 种实现形态在 5 locale 下实跑「①逐字符相等」的判定结果（`.agate-tmp/r2-fixa-wrong.mjs`）：

| 实现形态 | 判 PASS 的 locale 数 | 说明 |
|---|---|---|
| 正确（五字段） | **5/5** | 应全过 |
| 多传 `second` | **0/5** | 全抓 |
| 多传 `timeZoneName`（`short`/`long`/`shortOffset`/`longOffset`/`shortGeneric`/`longGeneric` 全 6 种） | **0/5** | 全抓（6×5 = 30 组，0 假 PASS） |
| 多传 `hour12: false` | **4/5** | **仅 `en-US` 抓到**——`zh-CN`/`de-DE`/`ja-JP`/`sv-SE` 本就是 24 小时制，两种实现的输出完全相同 |

最后一行是本条的**已知弱项**：`hour12: false` 只在 12 小时制 locale 上可辨。该失效模式由 **BDD-04**（固定 `en-US`，正断言 `05:43 PM` 且明确否定 `17:43`）补上，故「加 `hour12: false`」这一过修有守护点，但守护点**不在本条**。P6 不得因本条 4/5 而认为该风险已被 BDD-01 覆盖。

**「判实现正确」与「判 locale 适配」两个目标如何在本条内并存（不拆成两条 BDD 的理由）**：逐字符相等看似只能判「固定 locale 下实现正确」，与「跨 locale 适配」有张力。解法是**参考值随 locale 参数化**：每个 locale 用**它自己的**参考文本作期望值（①），并用 ③ 保证这些参考文本彼此不同、主显各自跟随——于是同一条判据同时判了「实现正确」（①对每个 locale 逐字符相等）与「locale 适配真实发生」（③不同 locale 期望值不等且各自命中）。若拆成两条独立 BDD（一条固定 locale 判实现、一条多 locale 判形态合理），「形态合理」那条会重新退化为特征猜测（即本次被否定的判据类型），反而重新打开假 PASS 口子；且本任务要求 12 条 BDD 编号不变，故在 BDD-01 内以参数化闭环解决。

#### BDD-02: 布局结构：主显无秒、悬停提示保留秒（精度分工）

- Given 浏览器 locale 固定为 `zh-CN`，时区固定为 `Asia/Shanghai`，一个 `created_at` 为 `2026-11-10T09:43:00Z` 的 entry
- When 分别读取该 entry 的时间主显文本与其悬停提示全文
- Then ① 主显文本**不**含子串 `17:43:00` ② 悬停提示全文**含**子串 `17:43:00`

**为什么是这个标准**：本次需求是**信息分层**，不是「删掉秒」。若只断言主显无秒（①），一个把 tooltip 秒也删掉的实现同样会 PASS——那会悄悄削弱跨时区协作场景所需的确切时刻。②使其成为双向约束。固定 `zh-CN` + `Asia/Shanghai` 是因为 `17:43:00` 这一字面量只在 24 小时制 locale 且无 DST 的时区下稳定（`en-US` 下为 `05:43:00 PM`）。

#### BDD-03: 布局结构：已知 UTC 时刻在固定 locale/时区下主显为去秒去偏移的形态

- Given 浏览器 locale 固定为 `zh-CN`，时区固定为 `Asia/Shanghai`，一个 `created_at` 为 `2026-11-10T09:43:00Z` 的 entry
- When 读取该 entry 的时间主显文本
- Then 该文本**等于** `2026/11/10 17:43`（即 UTC 时刻 +8 小时后的墙上时间，去秒、去偏移；既不含 `17:43:00` 也不含 `GMT+8`）

**为什么固定 locale 而不写「任意 locale 均含 `17:43`」**：`toLocaleString` 的墙上时间随 locale 变（实测同一时刻 `en-US` → `05:43 PM`、`de-DE` → `10.11.2026, 17:43`、`zh-TW` → `2026/11/10 下午05:43`）。不固定 locale 的绝对时刻断言会在实现完全正确时假 FAIL——TPV0102 的 BDD-04 正是因此被修订过一次。**本条与其跨 locale 姊妹条 BDD-01 分工**：BDD-01 管「形态不含偏移」，本条管「值换算正确」，二者互不替代。

#### BDD-04: 布局结构：12 小时制 locale 下主显跟随 locale 显示 AM/PM，不强制 24 小时制

- Given 浏览器 locale 固定为 `en-US`，时区固定为 `Asia/Shanghai`，一个 `created_at` 为 `2026-11-10T09:43:00Z` 的 entry
- When 读取该 entry 的时间主显文本
- Then 该文本**等于** `11/10/2026, 05:43 PM`，判定按 `^11\/10\/2026, 05:43[\s\u202f]PM$` 匹配（`:` 与 `PM` 之间允许 U+0020 SPACE 或 U+202F NARROW NO-BREAK SPACE）；且该文本**不**等于 `11/10/2026, 17:43`（即不是 24 小时制）

**为什么用 `[\s\u202f]` 而不是写死字面量**：本轮逐码点确认（`.agate-tmp/an-cp.mjs`）当前 Node v24.22.1 输出为 `...0032 0033 0020 0050 004d`，即 `:43` 与 `PM` 之间是 **U+0020 SPACE**，故此刻字面全串相等能通过。但 ICU 的规范倾向是改用 **U+202F NARROW NO-BREAK SPACE**（部分 ICU 版本已在 `en-US` 时间格式上切换），届时 `toBe('11/10/2026, 05:43 PM')` 会**假 FAIL**——那是一次与实现无关的、纯属说明符变化的红灯。用 `[\s\u202f]` 把两种空格都接受，既保留「12 小时制 + AM/PM」这一真正要守的语义，又不把判据绑到 ICU 的排版细节上。**断言对象仍是用户可见文本**，不涉及 option 名或类名，故不违反 §3 纪律。

**为什么把这个看似「不好看」的行为写成必须通过的判据**：本条是决策 D1 的验收锚。立论链条是——本次修正的**唯一理由**是「主显就该是用户本地的时间」（所以偏移无意义）。若同时在代码里强制 `hour12: false`，就等于用实现覆盖用户的地区时间习惯，属于**在与自己的立论相反的方向上加干预**。两种做法（跟随 / 强制 24 小时）不可能都被认为是「符合用户本地习惯」；选择跟随，就必须有一条 BDD 挡住后来者顺手加 `hour12: false`。若未来产品决定统一 24 小时制，那是一次新的决策，应由新任务推翻本条，而不是在实现里悄悄改。

### 3.2 渲染一致性与悬停提示

#### BDD-05: 视觉呈现：四个渲染点的主显形态一致

- Given 浏览器 locale 固定为 `zh-CN`，时区固定为 `Asia/Shanghai`，一个 `created_at` 已知的 entry，且当前用户为该 entry 的 owner
- When 依次读取①Explore 卡片模式的时间主显 ②Explore 列表模式的时间主显 ③详情页桌面头部的时间主显 ④移动视口下详情页元信息条的时间主显
- Then 四处主显文本**两两相等**，且每一处都满足 BDD-01 的判据（与该 locale 的参考文本逐字符相等）

**为什么是四处而不是三处**：实测 `TimeDisplay.vue` 的消费方为 `EntryCard.vue` / `EntryListRow.vue` / `EntryDetailHeader.vue` / `EntryMetaTagsBar.vue` 四个组件（P0 与 TPV0102 均写作「三处」，把桌面头部与移动元信息条算作同一处）。四处共用同一组件是「规则一致」的机制保证，但**验证仍须逐点**——组件被正确复用与四处都实际渲染出该组件是两件事。

#### BDD-06: 交互行为：悬停提示的三段内容不因本次改动而回归

- Given 浏览器 locale 固定为 `zh-CN`，时区固定为 `Asia/Shanghai`
- When 鼠标悬停到某个 entry 的时间主显上，读取提示全文
- Then 提示以 ` · ` 分隔为恰 3 段，且：① 第 1 段匹配 `just now` / `N(m|h|d|w|mo|y) ago` / `in N(m|h|d|w|mo|y)` 之一 ② 第 2 段匹配 `GMT+08:00`（完整到分钟的偏移，而非 `GMT+8`）③ 第 3 段**等于**运行时 `Intl.DateTimeFormat().resolvedOptions().timeZone` 的值

**为什么这条要保持不变且必须显式写出**：tooltip 承载的是本次改动**保留**的信息（跨时区协作时需要知道对方时区），而 hover 是主动查询动作，完备性在此有价值。若不写这条 BDD，一个「把偏移彻底删掉」的过修实现不会有任何断言拦住——需求里出现过的「配套保留物」必须有自己的验收锚。

**为什么第 3 段写成「等于运行时解析值」而不是「形如 `Area/City`」**：TPV0102 实测 `TZ=UTC` 时运行时返回 `"UTC"`（不含 `/`），CI runner 常为 UTC，写形态会假 FAIL。保持 TPV0102 已修正的写法，**不**为过测试放宽语义。

**为什么本条的偏移与秒判据必须固定 locale**：实测 `/GMT[+-]\d{2}:\d{2}/` 在 **8/32 locale 漏判**——`fr-FR` → `UTC+08:00`、`fi-FI`/`da-DK`/`id-ID` → `GMT+08.00`（点号分隔）、`he-IL` → `GMT‎+08:00‎`（含 bidi 控制字符）、`ar-EG`/`fa-IR` → 本地化词 + 非 ASCII 数字、`bn-IN` → `GMT +০৮:০০`（`GMT` 与 `+` 之间有空格且数字为孟加拉文）。这些 locale 下实现正确而判据 FAIL（本轮实测：32 locale 中命中 24、漏判 8）。故本条的判据②在**固定 `zh-CN`** 下判定，不声称「任意 locale 均成立」。

#### BDD-07: 交互行为：主显与悬停提示表达的是同一时刻（不因精度差异而矛盾）

- Given 浏览器时区固定为 `Asia/Shanghai`，locale 依次取 `zh-CN`、`en-US`、`de-DE`、`ja-JP`，一个 `created_at` 已知的 entry
- When 读取该 entry 的主显文本与悬停提示全文
- Then 对每一个 locale，**主显的数字段序列（按出现顺序）是提示全文数字段序列的子序列**

**为什么用「子序列」而不是「字符串相等/包含」**：两者精度不同（主显到分、提示到秒且含偏移），字面比较必然不等；而偏移在提示中的**位置随 locale 变**（实测 `zh-CN` 偏移在前 `2026/11/10 GMT+08:00 17:43:00`，`en-US` 偏移在后 `11/10/2026, 05:43:00 PM GMT+08:00`），故不能用「去掉最后 N 个字符」这类位置假设。子序列判据对四个实测 locale 均成立，**它能判的是「两处指同一时刻」**：日期/时分不一致、或主显用 12 小时而提示用 24 小时（`05:43` vs `17:43`）都会破坏子序列。

**本条的能力边界（不得被当作「主显不许多出秒/偏移」的守护点）**：实测主显若加回 `second`，段序列 `[2026,11,10,17,43,00]` 仍是提示 `[…,43,00,08,00]` 的**子序列**；若加回含分钟的偏移，`[2026,11,10,08,00,17,43]` 亦然——**子序列判据对这两类过修实现返回 true**。只有裸偏移（`GMT+8` 的 `8` 与提示的 `08` 不等）会被抓住。故「主显不得多出秒或偏移」这一职责由 **BDD-01 独担**（逐字符相等对全部 60 个错误变体都 FAIL），本条不提供第二重保护。写明这一边界是为了避免 P6 误以为同一缺陷有两道断言而放松 BDD-01。

### 3.3 回归保护

#### BDD-08: 交互行为：无效时间值不产生 NaN 文本

- Given 三种「无有效时刻」的 entry（测试构造）：① `created_at` 为无法解析的字符串（如 `not-a-date`）② `created_at` 为空串 `''` ③ `created_at` 为 `null`
- When 分别渲染其卡片时间主显与悬停提示
- Then 三种情况下任何位置的时间文本均**不含**子串 `NaN`，且：
  - ① 无法解析字符串：主显为 `—`、提示为 `Invalid date`（**均为非空占位**）
  - ②③ 空串 / `null`：主显与提示**均为空串**（组件不渲染任何时间文本）

**为什么空串 / `null` 判「渲染为空串」而不是「渲染占位」（这是对现状的据实描述，不是放宽标准）**：实测 `useRelativeTime.ts:67` 是 **falsy 守卫** `if (dateStr.value)`——空串与 `null` 走 `else` 分支把 `relative`/`full`/`absolute` 三个 ref 直接置 `''`，**根本不会调用** `formatFullDate`/`formatTooltip`，故不存在「占位符 `—`」这一输出（实测：`absolute === ''`、`full === ''`）。若判据写成「空串时主显为 `—`」，P6 必然 FAIL，而要让其 PASS 就得改动该守卫的分支逻辑——那是改动 composable 的空值处理语义，超出 §10 声明的范围（本任务只改主显 options，不动守卫）。**故此处选择据实描述现状**：一个从未有过时间戳的 entry 不显示时间文本是合理的（显示 `—` 会让人以为「时间解析失败」，而实际是「没有时间」），两个语义不应混同。若未来产品希望空串也显示占位，那是独立的一次行为变更，须新开任务并同步改守卫与本节。

**为什么仍要保留本条**：本次改动的实现方式是「少传两个 option」。若实现者改用 `dateStyle`/`timeStyle` 组合（看起来更简洁），会命中实测过的 `TypeError: Invalid option`（`dateStyle`/`timeStyle` 与 `timeZoneName` 不能共存）——异常发生在渲染期，界面上表现为整块时间消失或 `NaN`。本条是该风险的兜底，且**已按输入类型分成三条独立断言**（可解析失败 / 空 / `null`），每一类各自二值判定。

#### BDD-09: 交互行为：相对时间逻辑不受本次改动影响

- Given 三个 `created_at` 分别为「当前时间 - 3 小时」「当前时间 - 45 分钟」「当前时间 + 3 小时」的 entry
- When 分别读取其悬停提示中的相对时间段（第 1 段）
- Then 三者依次为 `3h ago`、`45m ago`、`in 3h` 形态（第 3 个**不**显示为 `just now`）

**为什么写**：相对时间不在本次改动范围内（TPV0102 已定型）。加这条是因为相对时间与主显共用同一个 composable——`formatTooltip` 内部会调用 `formatRelativeTime`，任何对该文件的改动（哪怕是「顺手重构」）都可能波及它，而本需求不会因为「不在范围内」就自动获得保护。

#### BDD-10: 视觉呈现：测试判据中不再存在「主显必须含 `GMT±N`」的断言

- Given 仓库中前端单测与 E2E 源码（`frontend-v3/src/**` 与 `frontend-v3/e2e/**`），以及后端既有契约测试
- When 检索所有针对主显（`formatFullDate` 返回值、`useRelativeTime().absolute`、`.time-display__main` 文本、或四渲染点主显文本）的断言
- Then 同时满足五项：① 不存在「要求主显**包含** `GMT`/`UTC`/偏移形态」的断言 ② 不存在「要求主显**包含秒**」的断言（含 `HH:MM:SS` 形态的 `toContain` 与含 `second: '2-digit'` 构造的主显期望值）③ 针对悬停提示（`formatTooltip` 返回值、`[data-testid="time-tooltip"]` 文本）的断言中**仍存在**偏移形态判据 ④ 主显断言中不再存在 `FOUR_DIGIT_YEAR`（`/\d{4}/`）这类恒绿的弱形态断言，主显形态由「等于参考文本」承担 ⑤ **`backend/tests/test_utc_serialization.py` 全部用例保持绿**（该文件是「机器读出口仍带偏移」的既有守护点，见下）

**为什么这条必须是 BDD 而不只是「P3 记得改」**：本任务的缺陷形态是「判据与实现对不上」。若只改实现不改断言，CI 红；若改了断言但把 tooltip 的偏移判据一并删掉，则 BDD-06 失去机器守护点而无人察觉——这正是「静默丢覆盖点」的复发路径（TPV0102 曾漏 `EntryListRow.spec.ts` 一处）。这条把「两个方向都不能删错」变成可 grep 的二值判定，也是同类扫描要求的**回归拦截手段**。

**② 与 ④ 为什么必须进入本条的检索口径**：`e2e:401` 的秒级断言在新形态下**必红**（非静默，但会返工），而 5 处 `FOUR_DIGIT_YEAR` 在新形态下**静默恒真**（`11/10/2026` 命中 `\d{4}`）——前者是响亮的失败，后者是无声的覆盖丢失，后者更危险。只查「含 `GMT`」的检索式对这 6 处全部漏检（它们不含 `GMT` 字样），故检索口径必须按**断言对象**（主显文本）而非**断言文本**（是否含 `GMT`）来定义。

**⑤ 为什么「后端零改动」需要一个验收锚（§2.3 的显式声明不能只有散文）**：§2.3 把「后端 / API / MCP / CLI 零改动」作为「不破坏 API 消费者契约的唯一依据」，但如果 P4 有人把「去偏移」误扩大（例如顺手改 `timefmt.py` 或 `createEntry.ts`），12 条 BDD 里原本**没有任何一条会变红**——「零改动」是需求里最该被守住却又最无保护的一类声明。`backend/tests/test_utc_serialization.py`（20 个用例，TPV0102 引入）正是该契约的既有守护点：它断言叶响应模型的 datetime 字段在 JSON 输出中均以 `Z` 结尾、CLI `--json` 时间字段带时区标记等。**故本条不新增测试，只要求该文件保持全绿**——零新增成本，且把「机器读出口带偏移」从散文变成可执行断言。MCP 侧 `createEntry.ts:118` 的 ISO 回显本次无自动化守护（MCP 单测未覆盖该行输出），列为已知残余风险，由 P7 人工核对 + §6.1 扫描 E 的行号清单兜底。

### 3.4 文档

#### BDD-11: 视觉呈现：CHANGELOG 与升级指南记录了本次格式变更

- Given 本次改动完成后的仓库
- When 检查 `CHANGELOG.md` 的 `[Unreleased]` 区与 `docs/process/upgrading.md`
- Then ①`CHANGELOG.md` 的 `[Unreleased]` 区含一条描述「时间主显去掉时区偏移与秒」的变更条目 ②`docs/process/upgrading.md` 含一节**标题匹配 `^## v\d+\.\d+\.\d+ → v\d+\.\d+\.\d+`（版本号可以是占位值，格式必须匹配）**，且该节正文明确说明**悬停提示的偏移与时区名保持不变**

**为什么 ② 只判「标题格式匹配」而不判「版本号等于某个确切值」**：版本号（patch / minor）由 P8 依据 `bump-version` 与实际发布决定，而 P6 验收发生在 P8 **之前**（`phases: [P1, P2, P3, P4, P5, P6, P7, P8]`）。若在 P6 断言确切版本号，该条在 P6 处于「不可判定」中间态，违背「每条 BDD 必须 PASS 或 FAIL」的要求。故 P6 只判**结构形态**（章节存在 + 标题符合项目既有 `## vX.Y.Z → vX.Y.Z` 惯例 + 正文含指定语义），「版本号确切值与其 `VERSIONS.json` 一致性」交给 P8 的版本一致性检查（该检查已是项目既有门禁，不属本任务新增）。这样 P6 与 P8 各判各的，无交叠、无空档。

**为什么升级指南要写明「tooltip 不变」**：升级指南的读者是运维与下游用户，他们会据以判断「我的界面上还会不会看到 `GMT+8`」。只写「去掉了时区偏移」会让人误以为跨时区信息已消失；写明保留位置才能让人作出正确判断。

### 3.5 人工体验路径

#### BDD-12: 交互行为：按文档 seed 数据后 Explore 页有内容且时间主显符合新规则

- Given 按项目文档执行 `make debug-quick`（或 `make debug-start` + `make debug-seed`）灌入 `scripts/seed-data/` 数据，并用 seed 用户登录 debug 站点（`127.0.0.1:8888`）；**浏览器 locale 固定为 `zh-CN`、时区固定为 `Asia/Shanghai`**（Playwright 用 `test.use({ locale: 'zh-CN', timezoneId: 'Asia/Shanghai' })`；人工验收时用浏览器语言与时区设置固定到这两项，或在验收记录里写明实际使用的 locale/时区并按该 locale 现算参考值）
- When 人工打开 Explore 页以卡片模式浏览，并悬停任一卡片的时间
- Then ①页面渲染出多于 1 张 entry 卡片（非空列表）②每张卡片的时间主显均与该 locale 的**参考格式化文本逐字符相等**（判据同 BDD-01，`zh-CN` + `Asia/Shanghai` 下参考值为 `YYYY/MM/DD HH:MM` 形态）且不含 `ago` / `just now` ③悬停后的提示同时含相对时间、**与该 locale 的完整偏移参考输出逐字符相等**的偏移段、以及 IANA 时区名

**为什么 ③ 不再写死 `GMT±HH:MM` 字面量**：BDD-06 已实测 `/GMT[+-]\d{2}:\d{2}/` 在 **8/32 locale 漏判**（`fr-FR` → `UTC+08:00`、`fi-FI`/`da-DK`/`id-ID` → `GMT+08.00`、`he-IL` 含 bidi、`ar-EG`/`fa-IR` 本地化词 + 非 ASCII 数字、`bn-IN` → `GMT +০৮:০০`），故同一份基线里不能在无 locale 约束处使用该字面量。本任务的解法与 BDD-01 一致：**期望值由运行时参考格式化现算**（参考值 = 声明六种数值字段 + 「完整到分钟的时区偏移」这一**语义**所对应的输出；本文出现的说明符取值仅为实测取数用，不构成实现要求），而非硬编码形态——这样人工验收者若浏览器恰为 `fr-FR`，参考值自动是 `UTC+08:00`，实现正确即 PASS。同时 Given 已显式固定 `zh-CN`/`Asia/Shanghai` 作为**默认判定条件**，给出确定性的验收路径；两者不冲突（固定时有字面参考，未固定时按实际 locale 现算）。

**为什么不能只用 fixture/单测代替**：单测里 `created_at` 是构造值，能验证格式化函数，但验证不了「用户按文档 seed 之后打开页面到底看见什么」——包括 `TimeDisplay` 是否被四处正确挂载、seed 数据是否被正确解析成时间字段。这条是用户在真实体验路径上的验收锚。

---

## 4. 决策点与理由

### 决策 D1：不强制 `hour12: false`，12/24 小时制继续跟随 locale

**决策**：主显 options 只去掉 `timeZoneName` 与 `second`，**不加** `hour12: false`。

**理由**（三条，均可核验，不是偏好）：

1. **与本次修正的立论同源**。本次修正之所以成立，是因为「主显时间由浏览器时区决定，就是用户本地时间」。12/24 小时制同样是**用户在系统里设定的地区习惯**。既然承认「本地习惯即正确语境」，就不应在同一处否决它的另一半。
2. **加了会制造新的不一致**：`hour12: false` 只影响主显口径；tooltip 仍走 `toLocaleString` 的 locale 默认（`en-US` 为 12 小时制）。实测 `en-US` 主显会变成 `11/10/2026, 17:43` 而 tooltip 是 `11/10/2026, 05:43:00 PM GMT+08:00`——同一界面里两个口径，反而比现状更难解释。要统一就得连 tooltip 一起强制，那是对「tooltip 保持不变」这一范围约束的越界。
3. **不构成缺陷**：`en-US` 用户看到 `11/10/2026, 05:43 PM` 是其系统设定的正常呈现，不是本任务要修的问题。用户的原始质疑只针对 `GMT+8`，未涉及小时制。

**验收锚**：BDD-04（正断言 12 小时制形态）＋ BDD-01（两者都不得含偏移）。

**若未来要改**：应作为独立任务、以「统一 24 小时制」为需求重写 BDD-04，而不是在实现里顺手加参数。

### 决策 D2：tooltip 的「秒」保留，主显与 tooltip 的分工写进需求（而非留给实现）

**决策**：主显到分；tooltip 到秒。二者分工是本需求的一部分，不是实现自由度。

**理由**：

1. **两个场景性质不同**：扫视（判断新旧）不需要秒；主动查询（对齐跨时区协作时刻）需要秒与偏移。
2. **若不写进需求，会被当作残留冗余删掉**：主显既然去秒，「tooltip 也去秒保持一致」听起来同样合理——但这会让 tooltip 失去「精确时间」这一唯一存在理由。故须以 BDD 固定（BDD-02 ②、BDD-06 ②）。

### 决策 D3：本轮不合并 ApiKey 两处的本地时间实现

`[SUGGEST: 推荐本轮不合并 ApiKeySettingsTab.vue / ApiKeyListView.vue 的本地 formatRelativeTime，理由：它们只输出相对时间、不显示任何绝对时间，与主显格式无交集；合并属重构，会把「反转一个验收判据」的小改动扩成跨模块重构，并使回归面从 5 个测试文件扩散到账号设置页。TPV0102 已把它登记为技术债，应在独立任务中处理]`

判定依据见第 6 节。

---

## 5. 判据设计的实测依据（可复核）

以下数据为本轮在 Node v24.22.1（ICU full）实测所得，用于支撑第 3 节的判据选择，不是引用记忆。

**基准样本**：`2026-11-10T09:43:00Z`，时区 `Asia/Shanghai`。

### 5.1 五字段（去秒、去偏移）输出

| locale | 输出 | 数字段数 | `/GMT\|UTC/` | `/GMT\|UTC\|[+-]\d/`（旧判据） |
|---|---|---|---|---|
| `zh-CN` | `2026/11/10 17:43` | 5 | 无命中 | **无命中**（→ 旧判据假 PASS 侧） |
| `en-US` | `11/10/2026, 05:43 PM` | 5 | 无命中 | **无命中**（同上） |
| `ja-JP` | `2026/11/10 17:43` | 5 | 无命中 | **无命中**（同上） |
| `de-DE` | `10.11.2026, 17:43` | 5 | 无命中 | **无命中**（同上） |
| `sv-SE` | `2026-11-10 17:43` | 5 | 无命中 | **命中**（`-10` 被当作偏移 → 旧判据假 FAIL） |

**32 locale × 8 时区（256 格）矩阵实测**（本轮自跑 `.agate-tmp/r2-seta.mjs`；时区集 `Asia/Shanghai`/`UTC`/`America/New_York`/`Europe/London`/`Asia/Kolkata`/`Pacific/Chatham`/`Australia/Adelaide`/`Asia/Tokyo`）：

| 变体 | `Asia/Shanghai` 下 5 locale | 256 格分布 |
|---|---|---|
| 五字段（主显） | **5 段**（5/5） | **5 段 × 256，0 例外** |
| 含 `second` | **6 段** | 6 段 × 256 |
| `timeZoneName: short` | **6 段**（5/5） | **5 段 × 50 + 6 段 × 112 + 7 段 × 94** |
| `timeZoneName: long` | **5 段**（5/5） | **5 段 × 256** |
| `timeZoneName: shortOffset`（整小时时区） | **6 段** | 6 段 × 160 |
| `timeZoneName: shortOffset`（非整小时时区） | — | **7 段 × 96**（`Asia/Kolkata` `GMT+5:30`、`Pacific/Chatham` `GMT+13:45`、`Australia/Adelaide` `GMT+10:30`） |
| `timeZoneName: longOffset` | **7 段**（5/5） | **7 段 × 256** |
| `timeZoneName: shortGeneric` | **5 段**（5/5） | **5 段 × 224 + 6 段 × 32** |
| `timeZoneName: longGeneric` | **5 段**（5/5） | **5 段 × 224 + 7 段 × 32** |

**可引用的准确命题（替代上一版的「5/6/7/8 互不重叠」与再上一版的「任意 `timeZoneName` 恒 ≥6 段」）**：

> 主显恒为 **5** 段（256/256 格无一例外）；**含 `second` 恒 ≥6 段**（实测恒为 6）。但 **`timeZoneName` 的段数随「取值 × locale × 时区」三者共同变化，不能作为「是否传了 `timeZoneName`」的判据**：
> - 按**取值**看（`zh-CN` + `Asia/Shanghai`）：`short`=6、`shortOffset`=6、`longOffset`=7，而 **`long` / `shortGeneric` / `longGeneric`=5**（与主显段数相同）；
> - 按**时区**看：`shortOffset` 在整小时时区为 6 段、非整小时时区（带分钟）为 7 段；`longGeneric` 在 `UTC` 上为 7 段（`GMT+00:00`）而在其余时区为 5 段；`shortGeneric` 在 `UTC` 上为 6 段；
> - 按 **locale** 看：`en-US` 的 `short` 在 `UTC`/`America/New_York`/`Europe/London` 上输出 `UTC`/`EST`/`GMT`（无数字偏移）→ 仅 5 段。
>
> 因此「段数 == 5」**既不是**「无 `timeZoneName`」的充分条件（`long` 全 256 格为 5 段、`shortGeneric` 224/256、`longGeneric` 224/256），**也不是**必要条件（主显之外的任何组合都可能恰好落在 5）。它唯一稳定成立的用途见 §3 纪律 4：只能用于「自检判据自身」或弱存在性，不能反推实现参数。这正是 BDD-01 改用参考文本逐字符相等的原因。

> **上一版错误更正（同一事实第二次被写错，故显式记录）**：上一版把「5/6/7/8 互不重叠」改成「含 `second` 或含**任意** `timeZoneName` 恒 ≥6 段」，该命题为假——`long`/`shortGeneric`/`longGeneric` 在 32 locale 上多数为 5 段。根因是**只看了 `shortOffset`/`longOffset` 两个取值就外推到全部**。本轮 256 格 × 8 变体全矩阵实测后才发现 `short` 自身还随时区在 5/6/7 间跳（`{5:50, 6:112, 7:94}`），故本版不再给「某取值 = 某固定段数」这类断言。

### 5.2 四个「看起来能用、实测不成立」的判据（避免踩坑）

| 候选判据 | 实测结果 | 结论 |
|---|---|---|
| 对 `/GMT\|UTC\|[+-]\d/` 无命中即「无偏移」 | **4/32 locale 假 FAIL**：`sv-SE` → `2026-11-10 17:43`、`lt-LT` → 同、`nl-NL` → `10-11-2026, 17:43`、`en-CA` → `2026-11-10, 05:43 p.m.`（日期分隔符 `-` 被当作偏移符号） | **弃用**。不仅因假 FAIL，更因它在本文件原 locale 清单的 4 个 locale 上全不命中（假 PASS 侧）——两个方向都错。改由参考文本逐字符相等（BDD-01） |
| 「数字段数 == 5」∧「不含 `GMT`/`UTC`」判「无偏移无秒」 | **假 PASS**：`timeZoneName: long` → `2026/11/10 中国标准时间 17:43`（5 段、无 `GMT`）；`shortGeneric` → `2026/11/10 中国时间 17:43`（同）；`longGeneric` → 同 `long`。`en-US` 同型 `11/10/2026, 05:43 PM China Standard Time` 亦 5 段无 `GMT` | **弃用**。用「文本长什么样」反推「传了什么参数」这条推论不完备：`timeZoneName` 有 **6 种**合法取值，其中 3 种在多数 locale 下输出既无数字偏移也无 `GMT`/`UTC`。改由参考文本逐字符相等（BDD-01，实测 **60/60** 错误变体全部 FAIL，假 PASS = 0） |
| `/\d{4}/` 判「含 4 位年份」 | `fa-IR` → `۱۴۰۵/۰۸/۱۹, ۱۷:۴۳`（波斯历 + 波斯数字）不匹配；且在 `en-US` 新形态下恒真（`11/10/2026` 命中）→ 静默死断言 | **弃用**。仓库现存 5 处使用点全部替换（见 6.1.1） |
| tooltip 偏移 `/GMT[+-]\d{2}:\d{2}/`（任意 locale） | **8/32 locale 漏判**：`fr-FR` `UTC+08:00`；`fi-FI`/`da-DK`/`id-ID` `GMT+08.00`；`he-IL` 含 bidi 控制字符；`ar-EG`/`fa-IR` 本地化词 + 非 ASCII 数字；`bn-IN` `GMT +০৮:০০` | 语义保留，但**必须固定 `zh-CN`** 才判定（BDD-06）；人工路径处改为与「完整到分钟的偏移」参考输出逐字符相等（BDD-12 ③，参考值由运行时按该语义现算，不在需求层指定任何 option 取值） |

### 5.3 其它确认项

- **`dateStyle`/`timeStyle` 与 `timeZoneName` 共存**：复测仍抛 `TypeError: Invalid option`——TPV0102 确立的约束继续有效，实现必须逐字段写。
- **午夜边界**：`2026-11-09T16:00:00Z` + `Asia/Shanghai` → `zh-CN` `2026/11/10 00:00`、`en-US` `11/10/2026, 12:00 AM`、`ko-KR` `2026. 11. 10. 오전 12:00`。32 locale 均不出现 `24:00`。
- **`hour12: false` 的效果**：`en-US` 由 `11/10/2026, 05:43 PM` 变为 `11/10/2026, 17:43`（决策 D1 的对照数据）。
- **`05:43 PM` 的空格码点**：本轮逐码点确认（`.agate-tmp/an-cp.mjs`）——`...0032 0033 0020 0050 004d`，`:43` 与 `PM` 之间是 **U+0020 SPACE**（无 U+202F / U+00A0）。故 BDD-04 当前可按字面全串相等判定；ICU 若改用 U+202F 的处置见 BDD-04 正文说明。
- **主显与 tooltip 的数字段序列**：四个实测量 locale 下主显段序列均为提示段序列的子序列（BDD-07 依据）。
- **参考文本相等的判别力**（`.agate-tmp/r2-power.mjs`，Playwright 浏览器内实跑）：5 locale × **6 种**合法 `timeZoneName` × 有/无 `second` = **60 个错误变体，假 PASS = 0**；正确形态 **5/5 PASS，假 FAIL = 0**。这是 BDD-01 选型的依据。
- **`timeZoneName` 的合法取值只有 6 种**（`.agate-tmp/r2-b.mjs`）：`short` / `long` / `shortOffset` / `longOffset` / `shortGeneric` / `longGeneric`；`none` / `offset` / `generic` 均抛 `RangeError: Value … out of range`。故变体数按 6 计为 **60**（不是 65，也不是 70）。
- **时区轴同源（retry 3 新增实测，`.agate-tmp/r3/`）**：`FIVE_FIELDS` 去掉 `timeZone` 后，真实 vitest 1.6（`environment: node`，`TZ` 由进程给）与真实 Playwright 1.60（`locale`/`timezoneId` 由 context 给）在 `TZ=Asia/Shanghai`/`UTC`/`America/New_York` 三种宿主下**正确实现均不假 FAIL**（`17:43`/`09:43`/`04:43` 各自与同源参考值逐字符相等）；而保留 `timeZone:'Asia/Shanghai'` 的旧模板在 `UTC`/`America/New_York` 下**必假 FAIL**。
- **运行时改 `process.env.TZ` 无效**（本轮实测）：与 locale 侧的 Intl resolvers 缓存同理，`resolvedOptions().timeZone` 不随运行时赋值变化；vitest 要固定时区**只能**在进程启动前由环境给定。
- **`ci.yml` 不跑 vitest**（本轮实测 grep `vitest`/`test-frontend` 于 `.github/workflows/` → 仅 `publish-npm.yml` 命中 MCP 单测，`ci.yml` 零命中）：因此「本机 `TZ=Asia/Shanghai` 全绿」**不构成**可移植性证据，验收口径必须取 `TZ=UTC`。

---

## 6. 同类扫描结论

扫描对象：仓库内所有显示时间的位置，以及所有断言时间格式的位置。**结论：同类问题（人读界面滥用机器可读格式）除主显一处外，仓库内没有第二处。** 其余命中逐条已判：格式化调用 12 处 = 8 处生产/组件代码 + 4 处测试代码；其中 8 处生产代码里 1 处本次处理、1 处 tooltip 保留、2 处构成仓内旁证（ApiKey）、3 处「不处理 + 理由」（PublishResultPanel / UserManagerTab / ProfileTab）、1 处非时间用途（TableView 数字千分位）；`GMT` 字面 37 行中 9 行是假命中（协议条目编号）、1 行是已发布历史记录（不改）。

### 6.1 扫描动作与命中

**扫描 A**：`toLocaleString` / `toLocaleDateString` / `toLocaleTimeString` / `Intl\.DateTimeFormat` @ `frontend-v3/src` → **12 命中**（逐行 grep 实测；含 4 处测试代码与 1 行注释）

| 命中位置 | 现状 | 判定 |
|---|---|---|
| `composables/useRelativeTime.ts:18`（`formatOffsetDate`） | 主显与 tooltip 共用同一函数，传入六字段 + 时区名 | **本次处理**：主显只声明「年/月/日/时/分」五种数值字段（去秒、去时区名）；tooltip 路径**保留完整到分钟的偏移**（形态随 locale，不在需求层指定具体说明符取值） |
| `composables/useRelativeTime.ts:58`（`formatTooltip` 第三段） | `Intl.DateTimeFormat().resolvedOptions().timeZone`（IANA 名） | **本次不改**（tooltip 保留物，BDD-06 ③ 保护） |
| `components/PublishResultPanel.vue:56` | `new Date(expiresAt).toLocaleString()`（默认 options → 含秒、**不含**时区名） | **本次不处理**：发布结果页的过期时刻是「一次性确认信息」，与扫视型主显场景不同；且它本来就不带偏移，不属于本缺陷（见下方 SUGGEST） |
| `components/settings/ApiKeySettingsTab.vue:270` | `new Date(dateStr).toLocaleDateString()`（无 `timeZoneName`） | **不受影响**——**这是仓内旁证**（见 6.2） |
| `views/ApiKeyListView.vue:285` | 同上 | 同上 |
| `components/settings/UserManagerTab.vue:162` | `d.toLocaleDateString()` | **不处理**：管理页禁用时间，仅日期，无偏移 |
| `components/settings/ProfileTab.vue:59` | `toLocaleDateString(undefined, {year,month,day})` | **不处理**：仅日期 |
| `components/TableView.vue:5` | `props.maxRows.toLocaleString()` | **非时间**（数字千分位） |
| `composables/__tests__/useRelativeTime.spec.ts:12` | 注释描述旧契约 | **本次处理**（P3 更新判据载体） |
| `composables/__tests__/useRelativeTime.spec.ts:42` | 测试辅助 `RUNTIME_TZ()` | **不改**（tooltip 判据依赖，保持） |
| `composables/__tests__/useRelativeTime.spec.ts:64` | 用例标题文字 | **本次处理**（标题随判据改） |
| `components/__tests__/time-display.spec.ts:80` | `expect(parts[2]).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone)` | **不改**（tooltip 判据③，保持） |

[SUGGEST: 推荐为 `PublishResultPanel.vue:56` 的默认 `toLocaleString()` 单开一个后续小任务，与 ApiKey 两处统一为显式 options，理由：默认 options 含秒属同类「机器味」表现，但那是发布结果页的一次性确认信息、无偏移、无用户投诉，改动面独立——并入本轮会把「反转一个验收判据」扩成多点格式化重构]

> 上表 12 行即扫描 A 的全部命中，逐条已判。**另** `components/TimeDisplay.vue:10-14` 自身不含格式化调用（只透传 `absolute`/`full`），不属命中，但它是四个渲染点的唯一实现载体 → **本次不改代码**；「参数一改即自动生效」不等于「四处都真的渲染了」，故一致性由 BDD-05 逐点验证。

**扫描 B**：`GMT` @ `frontend-v3/{src,e2e}` + `docs` + `CHANGELOG.md`（排除 `node_modules` / `dist` / `backend/peekview/static`）→ **7 文件 / 37 行**

| 文件 | GMT 行数 | 主显断言 | tooltip 断言 | 判定 |
|---|---|---|---|---|
| `frontend-v3/src/components/__tests__/time-display.spec.ts` | 4（`:5,27,28,44`） | 1（`:49` `toMatch(SHORT_OFFSET)`）＋1 处 `FOUR_DIGIT_YEAR`（`:50`） | 1（`:79` `toMatch(FULL_OFFSET)`） | **本次处理**：删主显偏移断言与 `SHORT_OFFSET` 常量（`:27`）、`:50` 换为参考文本相等（6.1.1 #1，`FOUR_DIGIT_YEAR` 常量 `:29` 一并删）；保留 `:79` 与 `FULL_OFFSET`（`:28`） |
| `frontend-v3/src/composables/__tests__/useRelativeTime.spec.ts` | 8（`:5,19,36,37,38,39,52,83`） | 1（`:54`）＋1 处 `FOUR_DIGIT_YEAR`（`:55`） | 2（`:84`、`:93`） | **本次处理**：删 `:54` 与 `SHORT_OFFSET`（`:39`）及描述它的注释（`:19,38,52`）、`:55` 换为参考文本相等（6.1.1 #2，`FOUR_DIGIT_YEAR` 常量 `:40` 一并删）；保留 `:84`/`:93` 与 `FULL_OFFSET`（`:37`） |
| `frontend-v3/e2e/tpv0102-explore-card-list-ux.spec.ts` | 11（`:25,45,46,257,266,379,381,425,438,910,915`） | **偏移 6**（`:257,266,381,425,438,915`；其中 `:381` 是 `toContain('GMT+8')`）＋**秒级 1**（`:401`）＋**`FOUR_DIGIT_YEAR` 3**（`:258,267,426`） | 2（`:290`、`:432`） | **本次处理**：6 处偏移断言反转；`:401` 改为断言主显**不含** `HH:MM:SS`（期望值构造 `:387-397`/`:394` 同步调整）；`:258,267,426` 换为参考文本相等（6.1.1 #3/#4/#5，`FOUR_DIGIT_YEAR` 常量 `:47` 一并删）；删/改 `GMT_OFFSET`（`:45`）与注释（`:25,379,910`）；保留 `:290`/`:432` 与 `FULL_OFFSET`（`:46`） |
| `frontend-v3/src/__tests__/filter-tabs.test.ts` | 2（`:18,78`） | 0（`:77` 为 `toBe('2026-07-07 14:30')`，**已无偏移无秒**） | 1（`:78`） | **不改**：mock 值与 tooltip 断言均无需改动（见 6.4） |
| `frontend-v3/src/__tests__/expired-warning.test.ts` | 2（`:18,78`） | 0（`:77` 同上） | 1（`:78`） | **不改**：同上 |
| `CHANGELOG.md:18` | 1 | — | — | **不改历史条目**（v0.27.0 已发布记录是历史事实），只在 `[Unreleased]` 加新条目（BDD-11） |
| `docs/reviews/T082-T083-T079-retrospective-20260731.md` | 9（`:146,163,176,198,207,208,273,276,279`） | — | — | **假命中**：全部是 `P-MGMT-N` / `FIX-MGMT-N` 这类**协议经验条目编号**（MGMT = management），与时间格式无关 |

**改动面精确统计（两类断言分开计，`e2e:401` 属秒级不属偏移）**：

| 类别 | 处数 | 位置 | 处置 |
|---|---|---|---|
| 主显**偏移**断言 | **8**（spec 2 + e2e 6） | `time-display.spec:49`、`useRelativeTime.spec:54`、`e2e:257,266,381,425,438,915` | 反转/删除 |
| 主显**秒级**断言 | **1** | `e2e/tpv0102-explore-card-list-ux.spec.ts:401`（`toContain(HH:MM:SS)`，期望值由 `:394` 的 `second:'2-digit'` 算出，另 `:387-397` 构造该期望值） | 反转：改为断言主显**不含**该 `HH:MM:SS`（与新「主显无秒」一致，BDD-02 ①） |
| 主显**4 位年份**断言（`FOUR_DIGIT_YEAR`） | **5** | `time-display.spec:50`、`useRelativeTime.spec:55`、`e2e:258,267,426` | 逐条判定：**5 处全部替换**为参考文本相等断言（见 6.1.1） |
| 常量声明 | **3** | `time-display.spec:27` / `useRelativeTime.spec:39` / `e2e:45` | 删除 |
| tooltip 偏移断言 | **5**（spec 1 + composable 2 + e2e 2） | `time-display.spec:79`、`useRelativeTime.spec:84,93`、`e2e:290,432` | 保留 |

**主显断言合计需改 ≥9 处**（8 偏移 + 1 秒级），另 5 处 4 位年份断言按 6.1.1 处置。

> **与 P0 的「26 处」口径差异（须记录，防误导）**：P0-brief 的 26 处是按文件粗数的「GMT / 秒级相关断言数」，把注释行、常量声明行、mock 值、tooltip 断言一并计入且未区分方向。按本文件逐行实测：GMT 相关共 37 行（含 9 行假命中与 1 行历史 CHANGELOG），其中**真正需反转的主显偏移断言为 8 处，另有 1 处秒级断言**（`e2e:401`）与 5 处 4 位年份断言须判定。P3 必须以**行号**穷举，不得沿用 26 或 37 这类粗估数——两者都会导致「改多了」或「漏改了」。这里「P0 数偏大」与「TPV0102 曾漏一处致静默丢覆盖」是**两个相反方向的同一风险**（清单不精确），故扫清清单是本需求的显式要求（BDD-10）。

**扫描 C**（dispatch 明确要求）：`ApiKeySettingsTab.vue:273` 与 `ApiKeyListView.vue:288` 的本地 `formatRelativeTime`

| 项 | 实测内容 | 判定 |
|---|---|---|
| 输出内容 | 仅 `just now` / `Nm ago` / `Nh ago` / `Nd ago` 四种 | **与主显格式无交集**——它不显示任何绝对时间，故不存在「带不带偏移」的问题 |
| 是否受影响 | 否。它不调用 `useRelativeTime`，本次对 `formatFullDate` 的参数改动不会传导 | **本次不处理** |
| 是否合并 | 与 `composables/useRelativeTime.ts` 逻辑重复（技术债，TPV0102 已登记） | **本次不合并**：合并是重构，会把「反转一个验收判据」扩成跨模块重构，回归面从 5 个测试文件扩到账号设置页。见决策 D3 |

**扫描 D**：其它时间消费方（是否依赖主显格式）

| 位置 | 输出形态 | 是否依赖主显格式 |
|---|---|---|
| `utils/expires.ts:formatExpiresIn` | `in 3d` / `in 5h` / `expired`（相对） | 否 |
| `utils/expires.ts:isExpired` / `isExpiringSoon` | 布尔 | 否 |
| `views/StarManageView.vue:273 formatDate` | 手拼 `YYYY-MM-DD`（本地时区） | 否 |
| `components/StarToggle.vue:106 formatCnDate` | 手拼 `YYYY 年 M 月 D 日` | 否 |
| `components/EntryDetailHeader.vue:65` | `Expires {{ formatExpiresIn(...) }}` | 否 |
| `components/settings/*`、`views/ApiKeyListView.vue` | `Created/Expires` + 仅日期 | 否 |

**扫描 E**：后端与 MCP

| 位置 | 现状 | 判定 |
|---|---|---|
| `backend/peekview/**` | 零处本地化时间格式化（仅 `strftime` 生成备份文件名与 ISO 输出） | **零改动**（且必须零改动） |
| `backend/peekview/timefmt.py` | UTC → ISO `Z` | **不改**：机器读出口需要偏移 |
| `packages/mcp-server/src/tools/createEntry.ts:118` | `Created: ${entry.created_at}`（原始 ISO `Z`） | **不改**：Agent 读场景需要偏移，与「人读界面不要偏移」同源 |
| `packages/mcp-server/**` | 无 `toLocale*` | 零改动 |
| `frontend-v3/e2e/**`（除 tpv0102 spec） | 无时间格式断言 | 零改动 |

### 6.1.1 `FOUR_DIGIT_YEAR` 5 处使用点的逐条判定（与 §3 纪律 3 的冲突如何解决）

`FOUR_DIGIT_YEAR = /\d{4}/` 是「主显含 4 位年份」的判据。§3 纪律 3 说「不用 4 位年份判据」，理由是 `fa-IR` 输出波斯历 + 波斯数字（`۱۴۰۵/۰۸/۱۹`）时 `/\d{4}/` 不匹配。**这两者并不矛盾，但必须区分用途**：纪律 3 禁止的是**把 `\d{4}` 当作「主显形态正确」的判据**（它既不能证明格式对、又会在合法 locale 下假 FAIL）；而 `FOUR_DIGIT_YEAR` 现存 5 处如果仅作为「看起来像绝对时间、不是相对时间」的**弱存在性断言**（与 `not.toMatch(/ago/)` 配对使用），则它从未承担形态判据职责——问题是**它在新形态下会静默恒真**（`en-US` 默认 `11/10/2026` 命中 `\d{4}`），从而变成一条永绿的死断言。

| # | 位置 | 上下文 | 判定 | 理由 |
|---|---|---|---|---|
| 1 | `time-display.spec.ts:50` | 与 `:49` `toMatch(SHORT_OFFSET)` 同一用例「主显文本含 GMT±N 与 4 位年份」 | **替换** | 同用例的形态职责已移交 `:49`↔BDD-01 的新参考相等判据；`:50` 留下即是一条恒绿死断言。该用例标题须同步改为「主显等于五字段参考文本」 |
| 2 | `useRelativeTime.spec.ts:55` | 与 `:54` `toMatch(SHORT_OFFSET)` 同一用例「formatFullDate 含 GMT±N 与 4 位年份」 | **替换** | 同上；该用例改为 `expect(formatFullDate(KNOWN_UTC)).toBe(参考值)`。**参考值的两轴取法（BLOCKER-C 修正，勿照旧版写）**：`locale` 取 `Intl.DateTimeFormat().resolvedOptions().locale` 后**显式传**（vitest 无浏览器 context，与实现同源）；`timeZone` **不传**——实现不传 `timeZone`，参考值亦不得 pin 时区。**不要写「显式传 locale+timeZone」**：`timeZone` 一旦 pin 成 `Asia/Shanghai`，在 `TZ=UTC` 的 CI runner 上该用例对正确实现假 FAIL（实测 `09:43` vs `17:43`） |
| 3 | `e2e:258`（卡片模式） | 与 `:257` `toMatch(GMT_OFFSET)` 同一断言块 | **替换** | `:257` 反转为主显不含偏移后，`:258` 成为该块唯一残留的形态断言且恒绿。改为「主显 === 参考文本」（BDD-01）；同块 `:259` `not.toMatch(/ago\|just now/)` 保留 |
| 4 | `e2e:267`（列表模式） | 与 `:266` 同一断言块 | **替换** | 同上，逐点对齐 BDD-05 的四处一致性 |
| 5 | `e2e:426`（详情页） | 与 `:425` 同块 | **替换** | 同上；`:433` `toMatch(FULL_OFFSET)`（tooltip）不动 |

**结论**：5 处全部**替换**为参考文本相等断言（不是保留、也不是删除）——因为「主显有年份」这一语义已被更强的「等于参考文本」蕴含，保留原断言只会留下恒绿死断言。**常量声明 3 处（`time-display.spec:29`、`useRelativeTime.spec:40`、`e2e:47`）随使用点消失一并删除**，不留未使用的常量。

**#3/#4/#5 三处 e2e 替换点的时区前提（BLOCKER-C 的关键落点，P3 必须读）**：

| 替换点 | 所在 describe | describe 的 `test.use` | 参考值模板要求 |
|---|---|---|---|
| `e2e:258`（卡片） | `e2e:248` `TPV0102 时间显示基础形态` | **无** `locale`、**无** `timezoneId` → 两者跟随宿主/runner | **模板不得写 `timeZone`**（方案 1）。此时参考值与实现同处一个 context，`TZ=UTC` 的 CI runner 上两者都是 `09:43`，PASS |
| `e2e:267`（列表） | 同上 | 同上 | 同上 |
| `e2e:426`（详情页） | `e2e:410` `TPV0102 详情页` | **无** `locale`、**无** `timezoneId` | 同上 |

这三个 describe 是该文件里**唯一**未 pin 时区的、却又要用参考值判定的位置（其余 `e2e:361` 的 `时区固定（BDD-04）` 已 `test.use({ locale:'zh-CN', timezoneId:'Asia/Shanghai' })`）。若照旧版把 `timeZone:'Asia/Shanghai'` 写进 `FIVE_FIELDS`，则：实现跟 runner 走（`09:43`）、参考值被 pin（`17:43`）→ **这三处必假 FAIL**。故「模板不 pin 时区」不是代码风格，而是这三处能否通过的前提。**替代做法（方案 2，更繁琐，不推荐）**：给 `e2e:248` / `e2e:410` 各补 `test.use({ timezoneId: 'Asia/Shanghai' })`——但那样就必须同时保证 vitest 侧也在进程启动前设 `TZ`，两条链路都要人工维护。


**与纪律 3 的关系（显式结论）**：本次处置使 `FOUR_DIGIT_YEAR` **在仓库中归零**，纪律 3 从此无现存违例；跨 locale 形态由 BDD-01 的参考相等覆盖（`fa-IR` 下参考值即波斯历输出，实现正确即相等——纪律 3 想保护的正是这一点）。

### 6.2 仓内旁证：项目从来不给时间加偏移

`ApiKeySettingsTab.vue:270` 与 `ApiKeyListView.vue:285` 的 `toLocaleDateString()` **一直**是不带时区名的形态，且这两处代码早于 TPV0102 存在。也就是说：**同一个仓库里，账号设置与 API Key 页面的时间显示从来没有出现过 `GMT+8`；只有 TPV0102 新引入的主显加了它。**

这条从仓内惯例角度进一步支持本次修正——TPV0102 的 `GMT+8` 不是「项目一贯做法的延伸」，而是**单点引入的异类**。

### 6.3 回归拦截手段

同类问题若未来会新增（有人又给某个时间显示加偏移），需求要求：

1. **BDD-10** 以可 grep 的二值判据约束「主显断言不得要求偏移」＋「tooltip 断言不得丢失偏移」，覆盖两个方向；
2. P3 对 `SHORT_OFFSET` / `GMT_OFFSET` 这类主显偏移常量采取**删除**（而不是改成永假断言或反转成 `not.toMatch`），避免留下误导性死代码；`FULL_OFFSET` 必须保留（tooltip 判据依赖）；
3. 本节的扫描命令作为 P7 复核口径。

### 6.4 扫描暴露的耦合点（交 P2）

- `TimeDisplay.vue` 不改代码即自动生效（它只透传 `absolute`/`full`）——但这也意味着**「改一处全生效」与「四处都真的渲染了」是两件事**，故 BDD-05 要求逐点验证（含移动视口）。
- `filter-tabs.test.ts` / `expired-warning.test.ts` 用 `vi.mock` 提供 `absolute: '2026-07-07 14:30'`（已无偏移、已无秒），这两个 mock 值恰好与新目标一致 → 它们的**主显断言无需改动**，只有 tooltip 断言（`full` 值）与本任务无关。P3 若误把这两个 mock 一并改动，会是无谓改动。

---

## 7. P0-brief 时效性质疑结论

**核对结论：无严重漂移；命中 1 处轻微漂移。**

逐条核对 P0 卡的严重判据（3 条）：

| 严重判据 | 核对结果 |
|---|---|
| `task` 的目标方案不再成立 | **不命中**。P0 的目标（主显去偏移去秒、tooltip 不变）在现状代码上仍成立：实测 `toLocaleString(undefined, {year,month,day,hour,minute})` 在 32 locale 下均输出无偏移、无秒形态，方案可行 |
| `executor_env` 平台前提不再成立 | **不命中**。P0 未声明特定 `executor_env`；当前平台（Linux / Node v24.22.1 / Chromium 可用）与立项时一致 |
| `known_risks` 的「已解决前提」实际未解决或已被他任务解决 | **不命中**。P0 的风险（en-US 12 小时制、字面量脆弱性、版本号待 P8、断言清单易漏）**全部仍然存在**——其中「字面量脆弱性」的实测范围比 P0 描述更大（P0 只提 `17:43` 随 locale 变，实测连 P0 自己引用的 `/GMT\|UTC\|[+-]\d/` 正则也跨不过 locale，见轻微漂移） |

**轻微漂移（1 处）**：

[P0_STALE: P0-brief「决策 2」的正则验证结论「zh-CN 输出对 `/GMT|UTC|[+-]\d/` 无命中 → 确认去时区名后不再含任何偏移标识」只在 zh-CN 成立，不能外推为跨 locale 判据——实测该正则在 sv-SE / lt-LT / nl-NL / en-CA 四 locale 因日期分隔符 `-` 被误命中（假 FAIL）]

- **判定为轻微的理由**：P0 原文只对 `zh-CN` 做了陈述，字面未错；错在它作为 BDD 判据来源时会被外推。目标方案、范围、风险清单均不因此改变，不需要回 P0 重新立项。
- **已更新的字段**：P0-brief 由主 Agent 持有，**本文件未改动它**；漂移点改以本文件第 5 节实测表 + 第 3 节判据纪律为准（BDD-01 已改用「与五字段参考格式化输出逐字符相等」，不再依赖任何文本特征正则）。**是否回写 P0-brief 交主 Agent 决定**——不影响 P1 推进。

---

## 8. 能力需求声明

```yaml
capability_requirements:
  - need: visual / vision 截图分析
    why: 本任务 domains 含 frontend 且改动是用户可见的时间文本——P6 需对 Explore 卡片、列表行、详情页桌面头部、移动元信息条四处主显做截图核对（形态无偏移、与相邻元信息对齐、缩短后无溢出），并对悬停 tooltip 展开态截图，确认三段信息仍完整可读
    available:
      - "vision-engine skill（DSH 侧 ~/.dsh/skills/vision-engine；主 Agent 上轮实测 self-test 8 个模型 alive）"
      - "调用方式：拷 skill 到项目内 .agate-tmp/ve/ 并把 ratelimit.py 的 _BASE_DIR 指向可写路径，再 PYTHONPATH=/home/kity/.local/lib/python3.12/site-packages python3 .agate-tmp/ve/scripts/vision-analyze.py -i <png> -r quick"
      - "Playwright 截图（mcp__pwtest__* / CDP :18800）"
    status: available
    note: "沙箱下 ~/.local/share/vision-engine 只读会使 record_usage() 崩溃——这是调用方式问题，不是能力缺失"

  - need: browser-automation 真实浏览器交互
    why: 主显文本由浏览器的 Intl/ICU 生成，与 Node 侧不完全等价；tooltip 需真实 hover（visibility 切换）才能验证
    available:
      - "mcp__pwtest__*（干净无登录态，默认）"
      - "frontend-v3/e2e/ Playwright specs（定向用 E2E_SPEC=… make debug-test）"
    status: available

  - need: locale-controlled-execution 浏览器 locale 固定执行
    why: 墙上时间与 12/24 小时制随 locale 变（实测同一时刻：zh-CN `2026/11/10 17:43`、en-US `11/10/2026, 05:43 PM`、de-DE `10.11.2026, 17:43`）。BDD-03/04/06 断言字面量、BDD-01/07 跨 locale 参数化，均须显式固定 locale 才可二值判定；本项目 playwright.config.ts 的 use 块未设 locale
    available:
      - "Playwright 每个 test 显式 test.use({ locale: 'zh-CN' })（仓库已有 test.use({ timezoneId }) 先例）"
      - "vitest 侧用显式 locale 参数直接调 formatFullDate/formatTooltip"
    status: available

  - need: timezone-controlled-execution 时区固定执行
    why: BDD-02/03/06 的字面量（`17:43`、`17:43:00`、`GMT+08:00`）要求浏览器时区固定为 Asia/Shanghai（无 DST）；BDD-01/07 需跨时区验证判据鲁棒性。**注意（BLOCKER-C）**：固定时区只允许在「context / 进程」级进行，不得通过给参考值模板传 `timeZone` 来「固定」——被测实现不传 `timeZone`，模板一 pin 即造成时区轴不同源
    available:
      - "Playwright context 的 timezoneId 选项（test.use({ timezoneId: 'Asia/Shanghai' })）——唯一合法的 e2e 固定手段"
      - "vitest 侧：`TZ=Asia/Shanghai` 在进程启动前由环境/script 给定（运行时赋值 process.env.TZ 实测无效）"
      - "参考值模板：不传 timeZone，跟随上述 context/进程时区（与实现同源）"
    status: available
```

**verification_env 声明**：

```yaml
verification_env: "debug backend http://127.0.0.1:8888（make debug-quick 或 make debug-start + make debug-seed）+ 数据目录 /tmp/peekview-debug/ + scripts/seed-data/ 数据"
verification_env_budget: "止损轮次 2（独立计数，不占 retries[P5]）；轮次追踪由主 Agent 在 dispatch-context 记录"
```

**边界说明**：本任务不需要 `requires_minimal_validation: true`——格式化行为可在 Node/vitest 环境直接断言（本轮 P1 已在 Node v24.22.1 实跑全部 32 locale × 8 时区矩阵）。浏览器侧相对 Node 侧的增量**有两项，不是一项**：

| # | 增量 | 性质 | 处置 |
|---|---|---|---|
| 1 | **ICU / CLDR 版本差异**（Node ICU 78.3 vs Chromium 148） | 引擎内建数据不同 → 同一 locale 的模板排版可能不同 | 由「参考值与实现在同一引擎内现算」吸收（FIX-A）。本轮实测 16 locale 五字段输出**逐字符全等、0 差异**，但这是当下事实、不是常量前提 |
| 2 | **时区来源不同源**（Node 进程 `TZ` vs 浏览器 context `timezoneId`） | 不是版本问题，是**两侧默认时区取值来源不同** | 属判据写法问题，必须靠「模板不 pin 时区 + 由 context 统一」（BLOCKER-C）。**此项与 ICU 版本无关，换任何 Node/Chromium 版本都不会自愈**；反而在宿主时区恰为目标时区时不显形，最易漏判 |

原表述「浏览器侧唯一增量是 ICU 版本」**不完整**：它把第 2 项遗漏了，而第 2 项正是 BLOCKER-C 的根因。两项的修法不同（1 靠同引擎现算，2 靠不 pin 时区 + context 统一），不能合并成一句「用 FIX-A 就都解决了」——FIX-A 只保证同引擎，若模板里仍 pin 了 `timeZone`，FIX-A 照样在 `TZ=UTC` 下假 FAIL（实测：`page.evaluate` 内 pin 时区 → `09:43` vs `17:43`）。


**该差异对两条判据的影响不同，须分开表述（不得笼统称「判据在 ICU 版本间稳定」）**：

| BDD | 判据性质 | 跨 ICU 版本/引擎的稳定性 |
|---|---|---|
| **BDD-07** | 数字段序列的**子序列**关系 | **判据本身版本无关**：子序列是结构与顺序的性质，不依赖任何格式模板的排版细节；`fr-FR` 加空格、`fa-IR` 换数字系统、ICU 改分隔符都不改变「主显段序列是提示段序列的子序列」这一关系。故 BDD-07 单独可称「在 ICU 版本间稳定」 |
| **BDD-01** | 与五字段参考输出**逐字符相等** | **判据本身不具备版本无关性**——它的正确性前提是「参考值与实现在同一 ICU 模板下求值」。这个前提**由写法保证**（FIX-A 同引擎内现算 / FIX-B 两侧指向同一 locale 且同源），**不是由判据性质保证**。即：BDD-01 的跨 ICU 鲁棒性来自「两边同源现算」，一旦参考值改成硬编码字面量或跨引擎取值，ICU 一升级就假 FAIL |

只有 BDD-03/04/06 的字面量（`2026/11/10 17:43`、`05:43 PM`、`GMT+08:00`）需要固定 locale+时区——这两个条件都由 Playwright 显式给定，不依赖「实现不可推断」的情形。

**BDD-01 的判据不再包含「段数」与「不含 `GMT`/`UTC`」**（上一版此处残留旧判据描述，已更正）：这两项已降级为**参考值自检项 ②**（判「判据自身没写错」），不是对实现的判据；对实现的唯一判据是 ①「主显文本 === 该 locale 的参考文本」。请勿据本节旧表述反推 BDD-01 仍在用段数判实现。

---

## 9. 裁剪说明

**全部 8 个阶段均保留**（`phases: [P1, P2, P3, P4, P5, P6, P7, P8]`），无裁剪，故不涉及「跳过风险」评估项。

| 阶段 | 保留理由 |
|---|---|
| P1 | 不可裁（核心阶段） |
| P2 | 不可裁。虽 `design_trivial: true` + `follows_existing_pattern`（可将候选方案收敛为 1 个），但本任务属 **UI 可见改动**（`ui_render_shape: layout` + 四处渲染点的时间主显文本变更），P2 需产出 UI 设计节（其渲染形态声明须复用本文件 `layout`），该节由 P2 自身声明 `ui_affected`；且需承接 6.4 的耦合点 |
| P3 | 保留。`formatFullDate` 有明确可单测的形态行为；**≥9 处主显断言**（8 偏移 + 1 秒级）+ **5 处 `FOUR_DIGIT_YEAR`** + **3 处常量声明**的反转/替换/删除必须经 TDD 红灯确认（否则变成「自改标准 + 自判通过」） |
| P4 | 不可裁 |
| P5 | 不可裁。**本轮新增验收口径**：vitest 与 e2e 必须在 **`TZ=UTC`** 下均全绿（本机宿主 `Asia/Shanghai` 会让时区轴错配不显形，且 `ci.yml` 不跑 vitest，本地绿不构成可移植性证据） |
| P6 | 不可裁。UI 改动 → 需四处渲染点 + tooltip 展开态截图与 vision 核对（BDD-01/05/06/12）。e2e 判定同样须在 `TZ=UTC` 下跑一次 |
| P7 | 保留。改动跨「生产代码 1 文件 + 5 个测试文件 + 2 个文档」，且本任务的性质是**判据反转**，一致性核对（主显断言已删净 / tooltip 断言未误删）是主要风险面 |
| P8 | 保留。已发布行为变更 → CHANGELOG `[Unreleased]` + `upgrading.md` + bump（patch/minor 由 P8 判，P1 不预定） |

**风险等级**：`low`——纯前端渲染层，无 schema / 无 API / 无权限变更；`domains: [frontend]` 单一域。

**已声明的可选字段**：`ceremony: standard`（默认档，不薄化）、`design_trivial: true`（P2 可仅 1 个候选方案）、`follows_existing_pattern: [frontend-v3/src/composables/useRelativeTime.ts]`（结构不变，只调 options）、`ui_render_shape: layout` + `ui_ux_dimensions`、`prod_touched: false`。

---

## 10. 范围声明与不做的事

`packages: [frontend-v3, docs]`、`domains: [frontend]`（已写入 frontmatter，此处不重复）。

**改**：

- `frontend-v3/src/composables/useRelativeTime.ts`（主显 options：去 `second`、去 `timeZoneName`）
- 受影响的主显断言（见 6.1 + 6.1.1，P3 须出具穷举行号清单）。**参考值的两条轴都必须与实现同源**：locale 按 FIX-B 显式传，**`timeZone` 不传**（见 §3.1 BLOCKER-C 表与 §6.1.1 #2）
- `CHANGELOG.md` 的 `[Unreleased]`
- `docs/process/upgrading.md`

[SCOPE+ from P1-review] `TPV0103:P1-requirements:SP1` — 改动面计数由「主显偏移断言 8 处」更正为「主显断言 ≥9 处（8 偏移 + 1 秒级 `e2e:401`）」，并新增 5 处 `FOUR_DIGIT_YEAR` 断言的替换与 3 处常量删除（见 6.1 / 6.1.1）。原清单低估了 1 处必红断言、漏判了 5 处静默恒真断言；这是清单精度问题，不是范围扩张——改的文件集合未变（仍是 5 个测试文件 + 1 个生产文件 + 2 个文档）。**结构化登记见 frontmatter `scope_plus` / `scope_resolved`（P7 机械检查读该字段，不读本行散文）。**

[SCOPE+ from P1-review] `TPV0103:P1-requirements:SP2` — `backend/tests/test_utc_serialization.py` 进入验收面（BDD-10 ⑤：须保持全绿），但**不修改该文件**。同一 §2.3「后端零改动」声明此前无任何验收锚，此处补一个零成本的既有守护点。**结构化登记见 frontmatter `scope_plus` / `scope_resolved`。**

**不改（明确排除，防范围蔓延）**：

- `formatTooltip` 的任何行为（秒、完整偏移、IANA 名三者全部保留）
- 相对时间逻辑（`Nm ago` / `in Nh` 已由 TPV0102 定型）
- `TimeDisplay.vue` 的 DOM 结构与 tooltip 可见性机制
- 后端 / API / MCP / CLI（零改动；`timefmt.py`、`createEntry.ts` 的 ISO 输出必须保留）
- 文件数显隐 / 可见性菜单 / 0 文件空态（TPV0102 的其它改动面）
- ApiKey 两处本地 `formatRelativeTime`（决策 D3）
- `PublishResultPanel.vue` 的默认 `toLocaleString()`（见 6.1，另立后续任务）

---

## 11. 状态标记

[PROD_NOT_TOUCHED]

- 未触碰生产 `:8080`；未读写 `~/.peekview/`。
- 本轮实测全部在 `/home/kity/oclab/peekview/.agate-tmp/` 下的临时 Node/vitest 脚本中进行（retry 3 的探针在 `.agate-tmp/r3/`：`verify.spec.ts` / `final-acceptance.spec.ts` / `pw-verify.mjs` / `pw-final.mjs` / `bdd06-32.mjs` / `icu-tz-axis.mjs`，`node_modules` 为指向 `frontend-v3/node_modules` 的软链），未在 `backend/tests/` 或 `frontend-v3/src/` 留下任何探针文件。
- 未执行 `uvicorn` 直启、未执行任何 `pip install`；未启动任何 backend（`TZ` 变化只作用于本地探针进程）。
