---
agent: plan-design-review
phase: P2
task_id: TPV0104
type: review
parent: P2-design.md
trace_id: TPV0104-P2-review-design-r2-20261125
created: '2026-11-25'
status: approved
---
# P2 设计评审批次（第 2 轮 · 复审）— plan-design-review

> **评的对象**：`P2-design.md`（925 行 / 151211B），重点 `## UI 设计`（`:486-574`）、`D5`（`:332-352`）、`§11 修订记录`（`:817-925`）。
> **本轮性质**：复审。不开从零评审——先核我第 1 轮打回的 2 BLOCKER + 2 MAJOR + MINOR 是否闭环，再核"有没有改坏"，最后仍按角色要求给满 7 维评分。
> **形态分派**：P1 声明 `ui_render_shape: layout`（`P1-requirements.md:28`）→ 加载**布局 / 交互 / 视觉**三组维度；**不启用**渲染正确性 / 动效时序（本任务无画布、无 WebGL、无时序动画，与 P2 `:491-492` 的 `渲染形态: layout` + `适用维度: 布局结构 / 交互行为 / 视觉呈现` 一致）。
> **证据等级**：本轮所有"闭环/未闭环"判定都基于**真实浏览器实测**（debug `:8888` + CDP Chrome `localhost:18800`，Chrome/158）+ **源码逐个函数核对**，不接受文字承诺。探针脚本落 `.agate-tmp/r2d/probe{A,B2,C,D,E,F,G,H,I}.mts`。

[PROD_NOT_TOUCHED] 全程只读源码 + 只访问 debug `:8888`（未造/未删任何 entry——复用既有 seed 数据，anon 可见 15 条与派发口径一致）+ CDP Chrome 只读测量（DOM 注入均在 `remove()` / `deleteRule()` 还原后结束，未写持久状态）+ `frontend-v3/node_modules/.bin/vue-tsc` 做一次性类型探针（`src/__probe_guard*.vue` 已删，`ls` 确认不存在）。**未接触生产 `:8080`**，**未触碰 `~/.peekview/`**，未跑 CLI，未 commit，未改 `P2-design.md`。

---

## 0. 结论

**`status: approved`**

第 1 轮我打回的 **2 BLOCKER 均已实质闭环**（不是形式满足），2 MAJOR 中 **M2 方向已闭环但落到具体组件时缺一处作用域声明**、**M3–M7 六项全部落地**，MINOR 两项均已显式声明。同时本轮实测发现 **2 处新缺口（R2-1 / R2-2）**——两者都**不是**"判据不可执行"也**不会让 P4 静默出事**，且我已给出**一行级、已验证有效**的修复处方，故按 dispatch 判定尺度取 `approved` 并列为本轮 MUST-FIX。

### 0.1 复核总表

| # | 第 1 轮等级 | 本轮判定 | 关键实测证据 |
|---|---|---|---|
| **D-1** | BLOCKER | **已闭环** | UI 节 `:494-534` 三组布局层候选（L/V/I 各 3 个），非架构级；L2/I2 的否决理由我独立验证成立（`OverflowMenuSheet.vue:2` `Teleport to="body"`、`OverflowMenu.vue:22` `v-if="isOpen && variant === 'dropdown'"`） |
| **D-2** | BLOCKER | **已闭环**（核心目标达成）| `padding-left: 0` no-op 论证删净；选定 W1+W2 产生真实可测差异（我实测 `fw 600 / color #e9eef4 / marginTop 12px`，h1 与 h2 首次可区分）；P4 判据三项全真。**但引入新缺口 R2-1** |
| **D-3** | MAJOR | **已闭环** | 逐位复现 V14（@360 `8px→溢10` / `4px→溢0 spacer 5.39`；@375 `44.39→0` / `20.39`；@390 `59.39→7.39` / `35.39`；barH 恒 64）；落点唯一性我独立确认 |
| **M2** | MAJOR | **部分闭环 → 见 R2-2** | 守卫已写进 4 处；但 `activeFile` 在 `EntryDetailHeader.vue` **当前不存在**（grep 0 命中、无 prop、无 store 引入），spec 未声明如何获取 |
| **M3** | MAJOR | 已闭环 | `§7 compact=18px` 的原话已核实（`DESIGN.md:239`）；改为"跟随既有 `.icon-btn`"并显式声明既有偏差不修正（`:572`、`:336`） |
| **M4** | MAJOR | 已闭环 | 字面文案 `已显示前 ${constructedRows} 行，共 ${totalRows} 行`，10 数据行 / maxRows=5 → `5` 与 `11` 同时出现（`:849`） |
| **M5** | MAJOR | 已闭环 | 过渡继承 `--transition-fast`（我核实 `layout.css:270` 确有 `transition: all var(--transition-fast)`）；禁用态用 `v-if` 而非 `disabled` 并给两条理由（`:338-339`） |
| **M6** | MAJOR | 已闭环 | 移动无 tooltip 的取舍 + 三条理由（`:342`） |
| **M7** | MAJOR | 已闭环 | `title-group` 的 `scrollWidth <= clientWidth` 三档校验点已补（`:574` ⑥）；**但我实测该判据对 h1 无区分力，见 R2-3 建议** |
| MINOR 1 | 移动抽屉残开 | 已闭环 | N5 在 D5 末段声明"不处理 + 三条理由"（`:352`） |
| MINOR 2 | 静默回退权衡 | 已闭环 | N6 在 D4 末段补三条理由 + 明确记录代价（`:330`） |

### 0.2 我第 1 轮三处自我更正是否被回退

| 第 1 轮更正 | 本轮状态 |
|---|---|
| 桌面 `.actions-area` **不溢出**（`scrollWidth` 含尾槽 gap 的误读更正） | **未回退**。我本轮独立重测 1024/1280/1440：`aa.clientW == aa.scrollW`（423→459）、`bodyScrollW == bodyClientW`、`title-group` 三档 `scrollWidth == clientWidth`（`377→341` / `633→597` / `793→757`），与 V15 逐位一致 |
| probe7 与 probe3 的**归因混用**更正（截断态表头不塌陷的正面结论） | **未回退**。R12 保留正面结论（`:902`） |
| `?file=` 静默回退**是 P1 要求、非缺陷** | **未回退**。设计改为补权衡说明而非改行为（`:330`） |

### 0.3 D-3 的最终等级（dispatch 点名要求明确）

**定为 `MAJOR`，不计入 BLOCKER。**

理由：第 1 轮我在 §0 主表标 MAJOR、§5 又把它列进"通过前必须补"的 BLOCKER 节，两处口径不一致是我的问题。本轮统一为一处：**它属 MAJOR 而非 BLOCKER**，因为——

1. 它**不影响 P1 任何 BDD 的可执行性**（BDD-24 的 Given 钉死 390×844，按字面跑不会红）；
2. 它的危害是**功能损失**（`overflow-menu-trigger` 右缘 370 > 360 被裁 → 用户失去"更多操作"入口），但只在 360px 这一 P1 未覆盖的宽度上发生；
3. 它**可由设计层单点声明 + 一行 `gap` 改动闭环**，本轮已闭环。

BLOCKER 我留给"判据不可执行"或"方案方向性错误"。D-3 两者都不是——它是**覆盖不足**，不是**方案错误**。**本轮已闭环，不需要在 P3 之前再做任何处置**（三档断言已绑死 `P5_e2e_mobile_widths`）。

---

## 1. 七维评分（7 个启用维度，0-10）

| # | 维度 | 第 1 轮 | **本轮** | 一句话依据 |
|---|---|---|---|---|
| 1 | 交互状态覆盖率 | 8 | **9** | 抽屉残开态已声明"不处理 + 三条理由"、禁用态已定义（`v-if` 即禁用态）、loading/error/empty/截断四类仍全覆盖；扣 1 分在**组合态**未穷举（见 R2-4 建议） |
| 2 | AI Slop 风险 | 9 | **9** | 模糊词 grep（`参照\|类似\|适当\|酌情\|风格\|视情况\|合理`）= **0**；UI 节从"零候选"变为三组带实测数据的真分叉；扣 1 分在 R2-1——W1 的风险栏自己写了"active 应覆盖"，但选定选择器实现不了，说明**风险栏未被回验** |
| 3 | 移动端考虑 | 5 | **9** | 最小支持宽度已声明（360 + 理由）、三档实测表、独立 spec + 独立 gate key、落点唯一性可核；扣 1 分在 `gap 4px` 下 `.toggle-badge`（`top/right: -2px`，宽 14px）在 4px 间距下相邻徽标**恰好相触**，设计未评 |
| 4 | 可访问性 / 键盘可达 | 8 | **9** | `aria-label="全屏阅读"` 保留（不含 `title`）、`:focus-visible` 实测 3px solid 继承、原生 `<button>`、M6 取舍已显式声明；扣 1 分在 h1 active 态的语义区分**只靠颜色**（`DESIGN.md §10` "Color alone must not convey meaning"，虽属既有形态，但本轮新增的 h1 规则放大了该偏差） |
| 5 | 组件完整性 | 7 | **8** | M3 论证已修正、`§6:162` Selection rule 已引用（`DESIGN.md:162` 原文核实）、过渡继承已写明；扣 2 分在 **R2-2**：桌面按钮的输入（`activeFile` 来源）与输出（`$emit('fullscreen')` 的接收方）在本组件作用域内**一处都不存在**，spec 未给 I/O 闭合方式 |
| 6 | 视觉设计（合计 0-10） | 7 | **9** | 布局一致性 2/2 ／ 颜色对比度 3/3 ／ **字体间距 2/3**（第 1 轮 1/3）／ **组件一致性 2/2**（第 1 轮 1/2）——分项见 §2.6 |
| 7 | 交互设计细节（合计 0-10） | 6 | **9** | 输入态反馈 4/4（第 1 轮 3/4）／ 键盘焦点 3/3 ／ **过渡与禁用态 2/3**（第 1 轮 0/3）——分项见 §2.7 |

> **七维边界声明（防 double count）**：「交互状态覆盖率」只判**状态存在性**（loading/error/empty/disabled/抽屉等状态是否被 spec 到）；「交互设计细节」只判**状态内实现质量**（输入反馈/过渡/禁用态写得够不够好）。R2-1（h1 active 组合态）计入**维度 7 的"过渡与禁用态"**（它是状态内的实现质量，不是状态缺失）；R2-2（I/O 未闭合）计入**维度 5**；R2-3/R2-4 只作建议、不扣分。同一问题不跨两维重复打分。

---

## 2. 逐维评审详情

### 2.1 交互状态覆盖率 — 9/10（状态存在性）

**第 1 轮唯一的扣分点已闭环。** 我第 1 轮指"移动抽屉残开态（`showTocDrawer`/`showFileDrawer`）无 spec"，本轮 D5 末段（`:352`）显式声明**不处理 + 三条理由**：① 不属 P1 任何 BDD 范围；② `/f` 下底栏 `v-show="!zenMode"` 不可见故无法新开抽屉；③ 若 P6 可稳定复现且影响 BDD-53 再回补。这满足了我第 1 轮 §5-MINOR-10 的要求（"声明不处理 + 理由即可"），且理由②是**技术上可核的**（`EntryDetailMobileBar.vue:2` 确为 `v-if="isMobile && currentEntry" v-show="!zenMode"`）。

**另三处状态定义本轮更完整**：
- **禁用态**：明确"不设 `disabled`，用 `v-if` 让元素不存在"，并给两条理由（无 activeFile 时是"无从全屏"而非"暂不可用"；BDD-31 的全页计数口径会被灰按钮复杂化）。这是**可执行的状态定义**，不是"看着办"。
- **截断态**：`v-if` / `v-else` 双分支写清（`:862`），且明确了"`.th-label` 已存在于 `.th-sort-btn` 内部 → 给 button 加 `v-if` 会连它一起消失，故是另一分支再写一份"这个陷阱。
- **空/错/载入**：`fileLoading` 骨架屏 / `fileError` / `empty-state` 三条分支沿用，未被改动。

**扣 1 分：组合态未穷举。** 设计覆盖了"每个状态各自存在"，但没覆盖**状态 × 交互的组合**——最典型的就是 R2-1 的 `toc-level-1` × `.active`（h1 条目被 scroll-spy 点亮时）。设计给了 h1 的默认态样式、也给了 active 的既有样式，但**没有把两者放在一起验**，结果是默认态规则把 active 的色吃掉。同类未覆盖组合还有"h1 条目 × hover"（`.toc-item a:hover` 是 `--text-primary`，与新规则的 `--c-text` 同值，无冲突，但设计未声明已知悉）。**这不影响任何单状态用例的可执行性**，故只扣 1 分并列入建议。

### 2.2 AI Slop 风险 — 9/10

**维持 9 分，扣分理由换了一处。**

正面（本轮明显加强，必须写入）：
- **模糊词 grep = 0**（`参照|类似|适当|酌情|风格|视情况|合理` 全文 0 命中），与第 1 轮一致。
- **UI 节从"零候选"变为真分叉**：三组候选各带**可核的实测数据列**（不是形容词），且每条"不选理由"都指向一个**可验证的约束**——L2 被否决是因为 `Teleport to="body"` 让元素不属底栏（我核实 `OverflowMenuSheet.vue:2` 确为 `<Teleport to="body">`）；I2 被否决是因为 dropdown 收起时 DOM 不存在（我核实 `OverflowMenu.vue:22` 确为 `v-if="isOpen && variant === 'dropdown'"`）。这是**用事实否决**而非**用偏好否决**，是我第 1 轮 §3 想要的东西。
- 常量、阈值、落点仍全部到"哪个文件哪一行哪个函数"；`files_to_read` 逐项带 `why`。

**扣 1 分：风险栏未被回验（R2-1 的根因）。** W1 候选的风险栏（`:514`）原文写「须与 `.toc-item.active a`（`--accent-color`）**和平共存（active 应覆盖）**」——这说明设计者**知道**这个约束。但选定的选择器 `.toc-item.toc-level-1 a` 编译后是 `.toc-item.toc-level-1 a[data-v-x]`（0,4,1），与既有 `.toc-item.active a[data-v-x]`（0,4,1）**特异性完全相同**，而新规则在源码中必然写在 active 规则**之后**（`:41` vs 新增在 `:42-44` 区域）→ 源码顺序让新规则胜出 → **active 的色被吃掉**。我实测确认（§2.7）。这不是"没写清"，而是"写清了约束却没验自己的选择器满足它"——属 Slop 的弱形态（自述与实现脱节），故扣 1 分。

### 2.3 移动端考虑 — 9/10

**第 1 轮 5 分 → 本轮 9 分，这是全篇进步最大的一维。**

我第 1 轮要求的三件事，逐条核：

1. **声明最小支持宽度 + 理由** —— 已做（`:541-543`）：定 **360px**，理由「`DESIGN.md §9` 只给 `<= 640px` 上界、未给下界；360dp 是 Android Galaxy S 系列等主流设备逻辑宽度」。我核实 `DESIGN.md:112-116` 的 Breakpoints 表**确实只有 `Mobile <= 640px` 这一行、无下界**，理由成立。
2. **若定 360，须给"7 按钮塞进 360"的方案候选** —— 已做，且是本轮最硬的一处：候选项不止"缩间距"，还包括"缩按钮"（实测 38px 仍溢 4px、40px 仍溢 6px，且违反 `§9` 触控 ≥44px → 否决）与"新按钮在 ≤375 时进 overflow"（实测移走 wrap 后 @360 仍溢 10px → 否决，因为代价由"多一个 44px 按钮"本身决定）。排除路径都用**实测数字**关掉了，不是嘴上说不选。
3. **`P5_e2e` 绑死到明确宽度档** —— 已做，且做得比要求更细：新增**独立 gate key** `P5_e2e_mobile_widths` + 独立 spec `e2e/tpv0104-mobile-bar-widths.spec.ts` + per-key timeout 600s，并在 `:678` 给了"为什么独立 key 而不塞进 `P5_e2e`"的三条理由（失败含义不同 / 360 属 P1 未覆盖的守护面 / 可单跑）。我用 `agate_common.is_legal_gate_key` 实测该 key **合法**（23 key 全 True）。

**逐位复现 V14（我自己重跑，不采信文字）**：

| 视口 | 插入 44px 按钮后 `gap: 8px` | 插入后 `gap: 4px` | 栏高 |
|---|---|---|---|
| **360** | `scrollW 370 / clientW 360` → **溢 10**，spacer 0 | `scrollW 360 / clientW 360` → **溢 0**，spacer **5.39** | 64 |
| **375** | `375 / 375` → 0，spacer **0**（恰好用尽） | `375 / 375` → 0，spacer **20.39** | 64 |
| **390** | `390 / 390` → 0，spacer **7.39** | `390 / 390` → 0，spacer **35.39** | 64 |

与设计 `:550-554` 的表**逐格一致**（含 5.39 / 20.39 / 35.39 三个小数）。基线（不插按钮）三档 `overflow=0`、`gap` computed 实测 **8px**。

**落点唯一性我独立确认成立**：`EntryDetailMobileBar.vue` 的 scoped `.mobile-bottom-bar { gap: var(--space-2) }` 是生效值（实测 computed `gap: 8px`），`layout.css:536-540` 的同名规则 `gap: 4px` 被组件 scoped 规则覆盖（Vue SFC scoped 规则注入更晚且带 `[data-v]` 提升特异性）→ **只改 scoped、不动 `layout.css` 是对的**，且设计明确写了"改它既无渲染效果又扩大 diff"。这个判断很准。

**扣 1 分：`gap 4px` 下徽标相邻性未评。** `.toggle-badge`（`:118-131`）是 `position: absolute; top: -2px; right: -2px; min-width: 14px`，即向右溢出 2px。底栏左簇里 Files 按钮带徽标、旁边是 TOC 按钮——`gap` 从 8px 收到 4px 后，徽标右溢 2px + 相邻按钮起点 = **间距只剩 2px**，视觉上徽标会几乎贴上相邻按钮的图标。设计在 L1 的风险栏只写了"底栏所有相邻控件间距同步变紧 4px（视觉密度上升）"，**没把这唯一的绝对定位溢出项算进去**。不阻塞（不是缺陷，是观感），但属"改了间距却没评所有受影响元素"。建议见 §4-S1。

### 2.4 可访问性 / 键盘可达 — 9/10

**第 1 轮 8 分 → 9 分。** M6 闭环带来 +1。

做对的（第 1 轮已肯定、本轮未回退）：
- **`aria-label="全屏阅读"` 而非 `title`** —— 保留（`:111`/`:340`）。这条比 P1 的 Given 更强：不依赖"正文不含图表"这个脆弱前提。
- `:focus-visible` 由既有类提供，实测 `layout.css:277-279` 有 `.icon-btn:focus-visible { outline: 2px solid var(--c-accent); outline-offset: 2px }`。
- 原生 `<button>` → `Enter`/`Space` 内建；tab 顺序自然（桌面 Copy 之后、移动左簇末位）。
- **决策 A 未被推翻**：未出现"加退出按钮"或"放开 f 键"。

本轮新增的正面：
- **M6 闭环**：移动端无 tooltip 的取舍从"沉默"变为**三条显式理由**（触屏无 hover / 360px 横向预算已用尽 / 一致性优先），并明确可发现性由 `aria-label` + 图标语义承担。这满足了我第 1 轮 §5-MAJOR-8 的要求。理由②与 M1 的结论**互相支撑**（横向预算确实在 360 下用尽），不是空话。

**扣 1 分：h1 active 态只靠颜色传达。** `DESIGN.md:212` 明文「Color alone must not convey meaning; pair with icons or text」。既有 TOC 的 active 态已经只靠颜色（`--accent-color` + `--accent-light` 背景 + 左边框），属既有形态、不在本任务范围；但本轮**新增的 h1 规则**把 h1 条目的默认态从 `--text-secondary` 改成 `--c-text`，使"active vs inactive"的**色差反而变小**（`#9aa7b4 → #e9eef4` 的默认基线被抬高后，active 的 `#4d8dff` 与默认的对比不如从前明显）。再叠加 R2-1（active 色被覆盖成 `--c-text`），h1 条目的 active 态在**文本色维度上完全消失**，只剩背景 tint + 左边框两条颜色通道。属 a11y 的弱化，故扣 1 分。

### 2.5 组件完整性 — 8/10

**第 1 轮 7 分 → 8 分。** M3 闭环 +1，R2-2 新增 -2（从 9 的基线算）。

M3 已闭环（我逐字核实）：
- `DESIGN.md:239` 原文确为「**Sizes**: 16px (inline), **18px (compact buttons)**, 20px (buttons/lists), 24px (navigation), 48px (hero/empty states)」——即我第 1 轮指出的"引用错"成立，§7 的 compact 档确是 18px。
- 设计改为「**跟随既有 `.icon-btn` 内的兄弟按钮**（实测 `CopyIcon :size="16"` / `Share2Icon :size="16"` / `StarToggle` 的 `Star :size="16"`），**不是** `DESIGN.md §7` 的规定」，并显式声明「既有代码与 §7 本就存在偏差，**本任务不修正它**（一致性优先）」——这正是我第 1 轮 §5-MAJOR-5 要的表述。
- 我核实 `EntryDetailHeader.vue` 里 `CopyIcon :size="16"` / `Share2Icon :size="16"` 确实存在，`StarToggle` 内部也用 16 —— 论证的事实基础成立。
- 并补了 `DESIGN.md:162` 的 Selection rule 作为"为何用 `.icon-btn` 而非 `.toggle-btn`"的官方口径（我核实 `DESIGN.md:162` 原文确为 stateless one-shot → `.icon-btn`）——这是**主动堵住 P4 疑问**的好实践。

**扣 2 分：R2-2 —— 桌面按钮的输入与输出在该组件作用域内都不存在。**

设计在 4 处（`:111`、`:335`、`:168`、`:590`）都要求 `v-if="currentEntry && activeFile"`，并给出 404 页的复现依据（`.actions-area` DOM 1、其余按钮各自 `v-if` 已撤）。**守卫的方向完全正确**，我第 1 轮提的 TypeError 风险确实被认到了。

但落到 `EntryDetailHeader.vue` 这个具体组件时：

| 符号 | 现状（我 grep + 读源码核实） | 设计是否声明如何获得 |
|---|---|---|
| `currentEntry` | **已有**（`:127` `currentEntry: Entry \| null` prop） | 不需声明 |
| `activeFile` | **不存在**。`grep -n "activeFile" EntryDetailHeader.vue` → **0 命中**；`<script setup>` 只 import `ZenModeKey`/`IsMobileKey`，**无 pinia store、无 storeToRefs**；`EntryDetailView.vue:5-36` 传给 Header 的 24 个 prop **不含 `:active-file`**（该 prop 传给了 `EntryDetailContent`，见 `:51`） | **零字** |
| `'fullscreen'` emit | **未声明**。`defineEmits`（`:54-63`）8 个事件里**无** `fullscreen`；设计 `:111` 直接写 `@click="$emit('fullscreen')"` | **零字**（§0.1B 的 `EntryDetailView` 行 `:109` 也未列"在 `<EntryDetailHeader>` 上加 `@fullscreen`") |

**这不是我的推断，是 vue-tsc 实测**。我用 `frontend-v3/node_modules/.bin/vue-tsc --noEmit` 跑了一份直译自设计原文的最小 SFC（`src/__probe_guard2.vue`，跑完即删、`ls` 确认不存在）：

```
src/__probe_guard2.vue(3,35): error TS2339: Property 'activeFile' does not exist on type
  'CreateComponentPublicInstanceWithMixins<ToResolvedProps<__VLS_Props, {...}>, ...>'
src/__probe_guard2.vue(3,79): error TS2345: Argument of type '"fullscreen"' is not assignable
  to parameter of type '"copy-content"'
```

即**按设计字面实现，`make typecheck` 会红**（`gate_commands.P5_typecheck` 会抓到）。

**为什么这仍只扣分不打回**：① 守卫**意图**无歧义（entry 存在且有 active file 才渲染），P4 只有一个合理解法；② 不是**静默**出事——`P5_typecheck` 是独立 gate key，会红；③ §3 完成标志 #2 已经写了「新 props 的类型闭合」，说明设计者**预期**会加新 prop，只是 §0.1B/D5/R14 三处都没写出"加哪个、从哪来"；④ 修复是**两行声明级**的（见 §4-R2-2 处方），不需要重做设计。故判 MAJOR 级 spec 缺口，列为 MUST-FIX。

### 2.6 视觉设计 — 9/10（分项 2+3+2+2）

#### 布局一致性 2/2 ✓
三栏结构、断点归属、zen 态"只留中区"与实测一致。新增按钮落在既有 flex 容器内，未引入新层级（I3 已被正确否决，理由"属 `DESIGN.md §6` 不得发明新层级的边界"）。

**我本轮独立重测桌面三档（不采信 V15 文字）**：

| 视口 | `.actions-area` 插按钮前 → 后 | `title-group` 插按钮前 → 后 | 标题截断 | 文档级横向滚动 |
|---|---|---|---|---|
| 1024 | `423 → 459`，前后 `clientW == scrollW` | `377 → 341`，前后 `scrollW == clientW` | 否 | `bodyScrollW == bodyClientW` |
| 1280 | 同上 | `633 → 597` | 否 | 同上 |
| 1440 | 同上 | `793 → 757` | 否 | 同上 |

与 `:880` 的 V15 **逐位一致**。第 1 轮我关于"4px 差是 flex `gap` 尾槽、不是裁切"的更正**成立且未被回退**，设计在 `:901` 明确保留。

#### 颜色与对比度 3/3 ✓
- 新增按钮沿用 `.icon-btn`（默认 `--c-text-secondary`、hover `--c-text`），不引入新颜色。
- TOC h1 选定 `color: var(--c-text)`。我按 `variables.css:49/50` 的暗色值手算：`#e9eef4` on `--c-surface #121822` = **15.26:1**（与设计自报**完全吻合**）；on `--c-bg #0a0d13` = 16.67:1（实测 TOC nav 背景为 transparent、落 body 上）。两者都远超 AA 4.5:1。
- 既有 token 的 AA 结论不变（`.icon-btn` 亮 5.25 / 暗 7.26、`.toggle-btn` 5.19 / 5.57），第 1 轮已实测、本轮无改动。

#### 字体与间距 2/3（第 1 轮 1/3）
**D-2 的核心目标已达成**——h1 与 h2 现在**真的可区分**了。我用**忠实模拟 P4** 的方式验证（不是注入 `<style>`，而是往**真实编译后的 scoped 样式表**里 `insertRule` 设计原文的编译形态 `.toc-item.toc-level-1 a[data-v-842c3118]`）：

| 指标 | h1 条目 | h2 条目 | 可区分 |
|---|---|---|---|
| `fontWeight` | **600** | 400 | ✓ |
| `color` | `rgb(233,238,244)`（`--c-text`） | `rgb(154,167,180)`（`--text-secondary`） | ✓ |
| `marginTop` | **12px** | 4px | ✓ |
| `x` / 宽度 | 1057 / 207 | 1057 / 207 | 缩进不变（符合"不重排缩进"的选型） |
| 高度 | 29 | 29 | — |

第 1 轮"h1 与 h2 逐项相同、视觉无法区分"的缺陷**已消除**。`padding-left: 0` 的 no-op 论证我已确认**删净**（`:522` 明写"**不写** `.toc-level-1 { padding-left: 0 }`"，其余出现处均为"不得再用"的反面引用），"与 h2 对齐"这类消灭层级的错误论证也已不存在。

**扣 1 分：R2-1 —— 新规则把 `.active` 的颜色吃掉了。**

设计的 W1 风险栏自己要求"active 应覆盖"，但选定选择器**实现不了**。我实测（`probeH`，关掉过渡避免读数抖动）：

| 场景 | h1 条目色 | h2 条目色 |
|---|---|---|
| 仅既有规则，两者都 `.active` | `rgb(77,141,255)` 强调色 ✓ | `rgb(77,141,255)` ✓ |
| **加上设计选定的两条规则**，两者都 `.active` | **`rgb(233,238,244)`**（`--c-text`，❌ 强调色丢了） | `rgb(77,141,255)` ✓ |

根因是**特异性相同 + 源码顺序**：编译后新规则 `.toc-item.toc-level-1 a[data-v-x]` 与既有 `.toc-item.active a[data-v-x]` 都算 (0,4,1)，而新规则必然写在 active 规则之后（设计说加在 `TocNav.vue:42-44` 的 `.toc-level-*` 区域，位于 `:41` 的 active 规则**之后**）→ 顺序让新规则胜出。

**影响面**：只有"h1 条目正处于 active"这一个组合态，且 active 仍可从背景 tint（实测 `rgba(77,141,255,0.14)` 保留）+ 左边框（实测 `rgb(77,141,255)` 保留）识别 → **不是完全丢失，是文本色维度丢失**。而 scroll-spy 下 h1 条目在滚到文章开头时**正是 active**，用户会看到"当前所在章节的 h1 目录项不是强调色、而 h2 目录项是"。属真实可见的不一致。

**为什么不判 BLOCKER**：D-2 的**目标**（h1 可区分）已达成，这条是实现的**副作用**，且修复是**一行选择器**（我已实测把新规则改成 `.toc-item.toc-level-1:not(.active) a` 后，active 时 h1 恢复 `rgb(77,141,255)` ✓、inactive 时仍是 `#e9eef4` + `600` ✓，两个方向都对）。`margin-top` 那条不受影响（它只在 li 上，与 active 无冲突）。不给 P4 埋静默缺陷，故列为 MUST-FIX。

#### 组件一致性 2/2（第 1 轮 1/2）
- ✓ 用 `Maximize`（Lucide）、`.icon-btn` 既有类、`data-testid` 命名与既有 `detail-*` / `mobile-bar-*` 一致。
- ✓ **图标尺寸论证已修正**（M3）：16px 归因为"跟随既有兄弟按钮"，不再错引 `§7`，且显式声明既有偏差不修正。
- ✓ **变体选择的官方口径已补**：引用 `DESIGN.md:162` 的 Selection rule 论证"stateless one-shot → `.icon-btn`"，同时堵住 P4"为什么不给 active 态"的疑问。
- ✓ 底栏按钮复用 `.mobile-bottom-bar .icon-btn`（`min-width/min-height: 44px`，满足 `§9` 触控 ≥44px）——我核实 `EntryDetailMobileBar.vue:164-170` 确有 44px。

### 2.7 交互设计细节 — 9/10（分项 4+3+2）

#### 输入态反馈 4/4（第 1 轮 3/4）
第 1 轮唯一的扣分点已闭环：`?file=` 静默回退的权衡已补（`:330`），三条理由（P1 未要求 / 深链失效多来自转发截断、用户更需要内容 / 加横幅会造成"分享链接打开多一条黄条"的新观感问题）+ **明确记录代价**（"用户不会知道自己请求的具体文件不存在"）。这满足了我第 1 轮 §5-MINOR-11 的要求，且"明确记录代价"是主动的诚实，不是辩解。

`?file=` 的输入态本身仍扎实：`Number.isInteger` 校验、`find ?? resolveDefaultFile` 回退、URL 归一抽纯函数 `normalizeFileQuery` 供单测（三例断言：默认→无 `file` 键 / 非默认→`file=<id>` / `share` 恒保留），且明确不做"为测试开导出"的反模式。

#### 键盘可达与焦点 3/3 ✓
原生 `<button>` + 既有 `:focus-visible`（实测 3px solid）+ Tab 顺序自然（桌面 Copy 后、移动左簇末位）+ `Enter`/`Space` 内建。无扣分。

#### 过渡与禁用态 2/3（第 1 轮 0/3）
**从"完全缺失"到"基本齐备"**：
- **过渡**：显式声明**继承**既有 `.icon-btn` 的 `transition: all var(--transition-fast)`（150ms，`DESIGN.md §8` Fast 档），并明确"不加自定义过渡"。我核实 `layout.css:270` 确有 `transition: all var(--transition-fast)` —— 继承声明**有事实基础**。
- **禁用态**：明确"不设 `disabled`，用 `v-if`" + 两条理由，且理由与 BDD-31 的计数口径挂钩（灰按钮会让"名称匹配 == 1"的断言复杂化）。这是把禁用态**接到可执行判据**上，不是泛泛而谈。

**扣 1 分：新规则与既有 `.toc-item a` 过渡的交互未评（R2-1 的过渡侧面）。** `TocNav.vue:39` 的 `.toc-item a` 带 `transition: all var(--transition-fast)`（150ms）。R2-1 的颜色覆盖在**静态**下已实测（§2.6），而在 **scroll-spy 切 active 的瞬间**，h1 条目的 color 会在 150ms 内从 `--c-text` 过渡到……**仍是 `--c-text`**（因为目标值被 R2-1 覆盖），即"过渡存在但终点色不对"，用户看到的是一次**无意义的过渡**（起点终点同色）而 h2 条目正常过渡到强调色。设计声明了"继承过渡"却未验"新加的规则是否还让过渡有意义"，故扣 1 分。这与 §2.6 的 R2-1 是**同一根因的两个面**（静态色 / 动态过渡），但按七维边界只在本维记"过渡质量"、在 §2.6 记"字体间距与色值"，不重复计分。

---

## 3. D-1 的专项核对（角色硬要求：≥2 候选 + 权衡）

角色定义（`plan-design-review.md:27-29`）原文要求「每个启用维度评审时，布局/视觉/交互方案须给出 **≥2 候选 + 权衡说明**（架构级 `candidate_count` 下沉 UI 布局层）」。

dispatch 点名要核 4 点，逐条给结论：

| # | 要核的 | 结论 | 证据 |
|---|---|---|---|
| ① | 是否真是**布局层**候选（不是又一批架构级） | ✓ **是** | 三组候选的分叉点分别是"移动入口放哪"、"h1 怎么视觉区分"、"桌面入口放哪"——全是 UI 布局/视觉/交互决策，不含"锚点生成点落在哪一层"这类架构分叉 |
| ② | 每组是否 ≥2 候选 + 权衡 + 选择理由 | ✓ **每组 3 个 + 三维权衡表 + 显式选择段** | L1/L2/L3（`:500-504`）、W1/W2/W3（`:512-516`）、I1/I2/I3（`:528-532`），每组后跟独立"选 X"段（`:506` / `:518-524` / `:534`）逐条说"为什么不选另两个" |
| ③ | 三组是否覆盖布局/视觉/交互 | ✓ **一一对应** | 布局组 L（布局结构）、视觉组 V（视觉呈现）、交互组 I（交互行为）——与 P1 的 `ui_ux_dimensions: 布局结构/交互行为/视觉呈现` 三组对齐 |
| ④ | 是否"补文档凑数"（形式满足但无实质分叉） | ✗ **不是** | 两个否决项都有**独立可核的**硬约束：L2 被否决因 `Teleport to="body"`（我核实 `OverflowMenuSheet.vue:2`）使元素不属底栏 → BDD-24 ① FAIL；I2 被否决因 dropdown 收起时 DOM 不存在（我核实 `OverflowMenu.vue:22` `v-if="isOpen && variant === 'dropdown'"`）→ BDD-23 的"可点击元素 `offsetParent` 非 null + 计数 == 1"FAIL。**否决理由是 BDD 判据，不是个人偏好** |

**额外肯定一处**：L1 的选择把"D-3 的 360px 溢出"和"入口位置"两件事**合并成一次决策**（收窄 `gap` 同时解 360），而不是各打各的补丁。这比我在 §3 表里建议的"移入 OverflowMenu"更好——因为后者会让 BDD-24 ① FAIL，而设计明确了"不改 P1 基线"这条约束。**它找到了我没看到的第三条路**。

`candidate_count: 6` 与正文一致（`:10` frontmatter / `:176` 与 `:496` 两处说明 / `:839` 修订记录），未出现"正文 3 组、字段写 6"的口径漂移。

---

## 4. 本轮 MUST-FIX / 建议（给 P4 与下一轮修订）

> 按 dispatch 判定尺度，"只剩文字/口径级 WARNING 或建议 → approved，列建议即可"。以下 R2-1 / R2-2 是**规格层缺口**（不是判据不可执行），各给**已验证的一行级处方**，P4 可照方实现；若主 Agent 选择再走一轮 architect，也应只落这两条。

### 4.1 MUST-FIX（P4 实现时必须按处方处理，否则会红或埋缺陷）

**R2-1（MAJOR）—— h1 新规则吃掉 `.active` 的强调色**

- **实测**：加设计选定的两条规则后，h1 条目在 `.active` 时 color = `rgb(233,238,244)`（`--c-text`）而非 `rgb(77,141,255)`（强调色）；h2 条目正常。
- **根因**：`.toc-item.toc-level-1 a[data-v]` 与 `.toc-item.active a[data-v]` 特异性同为 (0,4,1)，新规则源码位置在后 → 顺序胜出。
- **已验证处方（一行）**：把颜色/字重那条加上 `:not(.active)`：

  ```css
  .toc-item.toc-level-1:not(.active) a { font-weight: 600; color: var(--c-text); }
  .toc-item.toc-level-1 { margin-top: var(--space-3); }
  ```

  我实测修正后：`.active` 时 h1 → `rgb(77,141,255)` ✓（与 h2 一致）；非 active 时 h1 → `#e9eef4` + `600` ✓（层级仍成立）。`margin-top` 那条无需改动。
- **连带**：`:574` 校验点 ⑦ 与 `:589` 完成标志 #10 的判据**应加一条反向断言**——"h1 条目被置 `.active` 时 `color` 等于 `--c-accent`"，否则本缺陷不被任何判据捕获（现状 ⑦ 只断 `fontWeight !== '400'` + `marginTop === '12px'` + `x` 相等，R2-1 存在时**三项全真**，即判据漏检）。这条比修 CSS 更重要——它补的是**判据的检出能力**。

**R2-2（MAJOR）—— 桌面按钮的 `activeFile` 与 `fullscreen` 在组件作用域内不存在**

- **实测**：`grep activeFile EntryDetailHeader.vue` → 0 命中；`defineEmits`（`:54-63`）无 `'fullscreen'`；`EntryDetailView.vue:5-36` 未传 `:active-file`。vue-tsc 对直译最小复现报 `TS2339`（activeFile 不存在）+ `TS2345`（'fullscreen' 不在 emits）→ **按设计字面实现 `make typecheck` 必红**。
- **处方（二选一，都需在 §0.1B 写清）**：
  - **(a) 加 prop（推荐，与既有 `currentEntry` 同风格）**：`EntryDetailHeader.vue` 的 `defineProps` 加 `activeFile: File | null`；`EntryDetailView.vue` 的 `<EntryDetailHeader>` 加 `:active-file="activeFile"`。同时 `defineEmits` 加 `'fullscreen': []`，`<EntryDetailHeader>` 加 `@fullscreen="handleFullscreen"`（处理体即 D5 `:345-349` 那段）。
  - **(b) 组件内 inject/store**：在 Header 内取 store 的 `activeFile` —— 但既有两个 `inject` key（`ZenModeKey`/`IsMobileKey`）里没有它，需新增 key，改动面比 (a) 大，且与"Header 全部状态走 props"的既有形态不一致，**不推荐**。
- **注意**：`:111`/`:335` 的 `v-if` 文本本身**不用改**，改的是"这些符号从哪来"的声明缺失。

### 4.2 建议（不阻塞，P4/P6 可选吸收）

**R2-3（建议，MINOR）—— 校验点 ⑥ 对 `h1.title` 无区分力，只能复核 `title-group`**

我实测 `:574` ⑥ 的判据（`.title-group` 的 `scrollWidth <= clientWidth`）在**故意塞 360 字超长标题**时**仍然为真**（`tgScrollW 757 == tgClientW 757`、`tgJudge true`），因为 `.title-group` 是 `flex:1; min-width:0`、真正承载裁切的是内层 `h1.title`（`overflow:hidden` + `-webkit-line-clamp:2`，实测超长标题下 `h1.scrollHeight 384 > clientHeight 48`、高恒 48 = 2 行）。

- **含义**：⑥ 作为"标题未被截断"的判据**偏弱**——它能证明"标题容器没有被压缩到溢出"，但**不能**证明"标题文字没被 clamp 掉"。三档正常标题下两者都为真，所以不会假 FAIL；但若 P4 引入更长的 entry 标题，⑥ 会**假 PASS**。
- **建议**：⑥ 保留（它验的确实是"按钮占位没挤坏容器"），另加一条**可选**强判据：`h1.title` 的 `scrollHeight <= clientHeight`（或 `-webkit-line-clamp` 未生效的等价判定，如 `h1.scrollHeight <= 2 * lineHeight`）。**不建议**直接改成只判 `h1` ——因为现有三档实测 `h1Judge` 也为真，改判不影响结论，只是增强检出。

**R2-4（建议，MINOR）—— 组合态建议在 P6 补一条人工复核**

R2-1 暴露的是"单状态各自正确、组合起来冲突"这一类问题。除 R2-1 的处方外，建议 P6 在视觉复核时**额外看一眼**这两个组合：① h1 条目 active（滚到文章开头）；② h1 条目 hover 且 active（`transition: all` 下会不会出现中间色跳变）。成本极低、无需写断。

**S1（建议，MINOR）—— `gap 4px` 下 `.toggle-badge` 相邻性**

`.toggle-badge` 是 `position:absolute; top:-2px; right:-2px`（`EntryDetailMobileBar.vue:118-131`），向右溢 2px。`gap 8→4px` 后，带徽标的 Files 按钮与相邻 TOC 按钮的间距只剩 **2px**（4 − 2），视觉上徽标会几乎贴上相邻图标。建议：① 要么接受并记录（属观感、不违反任何 `DESIGN.md` 条款）；② 要么 `gap` 收到 `--space-1` 时把徽标 `right` 调到 `0`。**不影响 360px 的溢出结论**（徽标是 absolute，不参与 flex 宽度计算），所以不是 D-3 的回归。

---

## 5. 做得好的地方（避免下一轮改坏）

1. **L1 把两个问题合成一次决策**：用收窄 `gap` 同时解"移动入口位置"与"360px 溢出"，并明确拒绝了我第 1 轮建议的"移入 OverflowMenu"（因会让 BDD-24 ① FAIL）。**它找到了我没看到的第三条路**，且理由可核。
2. **`candidate_count` 的分层口径写清了**：`:496` 明写"6 = 3 架构 + 3 布局层（每组择一后计入）"，不是含糊地把 3 说成 6。这种"把字段口径摊开"的做法值得保留。
3. **M3 的自我修正很干净**：不只改数字，而是把"错引 §7"改成"跟随既有代码 + 显式声明与 §7 的既有偏差本任务不修正"，并**主动补了 `§6:162` 的 Selection rule** 堵 P4 的疑问。
4. **M5 把"禁用态"接到可执行判据上**：不是泛泛说"用 v-if"，而是给"灰按钮会让 BDD-31 的计数口径复杂化"这个**具体的判据理由**。
5. **`P5_e2e_mobile_widths` 独立成 key 的三条理由**（失败含义不同 / 360 属 P1 未覆盖的守护面 / 可单跑）——这是"为什么不是塞进大 spec"的正面回答，符合 `--strict` 反模式倡导的"一 key 一命令、失败可归因"。
6. **§11.5 逐条自查锁定项**（13 条，含"桌面不溢出保持"、"截断态表头不塌陷保持"）——这是主动防"改 A 坏 B"的机制，本轮我复核**无一被推翻**。
7. **§11.7 主动上报 P1 措辞失实**：发现 `P1-requirements.md:589` 的实现层附注失实（`_BINARY_SIZE_LIMIT` 的唯一消费点就在注入路径上），且**没有擅自改 P1**，而是上报主 Agent 决策。这个边界守得很好（虽然属 eng 域，不是我的维度，但作为"修订者不越界"的证据值得记）。
8. **§11.4 给的是"重做/新增"而非"我相信"**：6 项新实测（V9 重做 / V14 / V15 / TOC 候选 / M2 复现 / BDD-38④ 断言形态），其中 V9 的**重做**是对我未提出、eng 提出的问题的响应，且它自己发现了"低特异性写法零效果"这个陷阱并写进设计——**主动发现自身方案的风险**是高质量修订的标志。

---

## 6. 本轮证据边界（诚实声明）

**我做了什么**：
- 真实浏览器（CDP Chrome + debug `:8888`）实测 7 组：移动底栏三档 × 两 `gap` 值（probeA）、桌面三档 `.actions-area`/`title-group`（probeC）、TOC h1 候选效果（probeB2/E/G）、TOC h1 × active 组合态（probeH）、标题截断判据区分力（probeI）、`.active` 基线（probeH 内）。
- 源码逐函数核对：`TocNav.vue`(45 行全文)、`EntryDetailMobileBar.vue`(template + scoped style)、`EntryDetailHeader.vue`(template + script + `:54-63` emits)、`EntryDetailView.vue:1-60`、`OverflowMenu.vue:22`、`OverflowMenuSheet.vue:2`、`layout.css:265-280/536-600/658-675`、`variables.css:4-13/49-52/113-116/140-147`、`DESIGN.md §6:155-170 / §7:235-241 / §8:244-255 / §9 / §10`。
- 工具核对：`agate_common.is_legal_gate_key` 逐个实测 23 个 gate key **全 True**、无 `P3_*` 违规键；`agate-read-gate-commands.py`（带 `GATE_FILE`）读回 `P3 = "make test-frontend"` + `formatter = vitest.sh` + `project_module = src/`，符合 §5.1 的裁决；`check-gate.py P2` 唯一红灯为 `P2-review.md` 尚未 approved（属评审轮，非本角色职责）；`vue-tsc --noEmit` 做 R2-2 的类型判定（探针文件已删）。
- 模糊词 grep = 0；`P2-design.md` 行首 `PASS/FAIL` 计数 = 0（本文件同样遵守）。

**我没做什么**：
- 未重新评审 eng 域（锚点生成点 / 注入预算 / `P3` 裁决 / `dispatch_plan`），那些不在我的维度内；`plan-eng-review` 的 B4 与我无重叠，我不表态。
- 未实跑任何 E2E / vitest / pytest（本轮不给 P5/P6 背书）。
- 未验证 375 以外的临界宽度（如 320px，属 `DESIGN.md §9` 未定义的档，设计已把 360 定为下界，320 明确不在支持范围）。
- 未对 `?file=` 的真实路由行为重跑探针（第 1 轮已验，本轮设计未改该部分行为）。

**关于 `status` 的判定依据**：dispatch 给的尺度是「只剩文字/口径级 WARNING 或建议 → `approved`；仅当出现新的实质缺陷（判据不可执行 / P4 会真出事）→ `rejected`」。本轮 R2-1 / R2-2 均**不满足** `rejected` 的两条判据——① 判据仍可执行（R2-1 的三项判据实测全真、R2-2 由 `P5_typecheck` 兜住）；② 不会静默出事（R2-2 会被 typecheck 抓到）。两者都有我已验证的一行级处方。故取 `approved`，并把两条列为 §4.1 MUST-FIX 交由 P4 按处方落地——这比再走一轮修设计更快，且不耗 `retries[P2]` 的最后 1 次预算。

> **给组长的一句话**：本轮 UI 层判 `approved`；`P2-review.md` 的最终 `status` 请按「任一专家 BLOCKER → rejected」汇总（eng 的 B4 在我域外，我不为它背书也不替它否决）。若组长决定因 B4 退回，请把 §4.1 的 R2-1 / R2-2 一并列入修订清单，**两者都是本文档已处方、可直接落地的一行级改动**。
