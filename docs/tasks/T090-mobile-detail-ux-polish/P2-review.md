---
phase: P2
task_id: T090-mobile-detail-ux-polish
type: review
parent: P2-design.md
trace_id: T090-P2-review-20260809
status: approved
created: 2026-08-09
revised: 2026-08-09
agent: plan-design-review
---

# P2-review — T090 移动端详情页 UX 打磨（第 2 轮复核）

## 复核范围声明

本轮为第 2 轮复核，按 dispatch-context 指令：候选方案本身（1-A/1-B、2-A/2-B、3-A/3-B）已在第 1 轮确认合格，不重新评估；只复核上轮 3 处「必须」+ 3 处「建议」共 6 处修订是否真正落实，并核查修订过程是否意外破坏已通过部分或引入新问题。

---

## 逐项复核结论

### 1（必须）files_to_read 路径 —— 已修复，核实通过

P2-design.md 第 46 行现为 `frontend-v3/src/composables/entryDetailKeys.ts`。已用 `ls` 直接核验文件系统：该路径存在，`frontend-v3/src/components/entryDetailKeys.ts` 不存在。与 `EntryDetailHeader.vue:99` 的 `import { ZenModeKey, IsMobileKey } from '@/composables/entryDetailKeys'` 一致。**修复属实。**

### 2（必须）zen-mode padding-bottom override 选择器 —— 已修复，核实通过，但发现一处新的次要缺口（见下方「新发现」）

P2-design.md 候选 2-A 正文给出明确选择器与落点：

```css
.entry-detail.zen-mode :deep(.content-area) { padding-bottom: var(--space-3); }
```

并注明"追加到 `EntryDetailView.vue:251-254` 现有 zen-mode 块之后，不修改已有内容"。已实读 `EntryDetailView.vue:250-254` 源码核实：

```
250: .entry-detail { display: flex; flex-direction: column; min-height: 100vh; background: var(--c-bg); }
251: .entry-detail.zen-mode :deep(.detail-header),
252: .entry-detail.zen-mode :deep(.mobile-sticky-header),
253: .entry-detail.zen-mode :deep(.mobile-bottom-bar),
254: .entry-detail.zen-mode :deep(.meta-tags-bar) { display: none; }
```

行号、选择器列表、`display: none` 内容与设计文档引用**逐字一致**，不是臆造。该 override 规则也已被写入第 5 节"实现完成的标志"清单（"新增一条独立规则……且原有 `display: none` 那条选择器列表未被误改"）。**上轮要求的"具体选择器写法 + 落点文件 + 完成标志清单"三点均已落实。**

### 3（必须）可访问性影响说明 —— 已修复，核实通过

新增独立"可访问性影响"小节（第 100-116 行），逐一回应上轮指出的两点：

- **meta-tags-bar 迁移的 DOM/Tab 顺序影响**：给出了具体依据——读取 `EntryDetailView.vue:5-83` 模板确认顶层子组件顺序不变，且论证"作为 header 最后一个子节点"与"作为 main 第一个子节点"在文档线性顺序上落在同一个衔接点，因此 Tab/朗读顺序位置不变；并指出唯一实质变化是 landmark 归属从 `banner` 变为 `main`，属于更准确的语义调整。这是有具体文件行号支撑的论证，不是空话。
- **`.mobile-bottom-bar` 改为 `position: fixed` 的 Tab 焦点影响**：给出了正确的 CSS 常识依据（`position` 只影响视觉渲染层，不改变 DOM 树/可访问性树顺序），并进一步论证 `position: fixed` 反而带来焦点始终可见的正向改善。论证链完整、有具体机制依据。

结论明确："两处改动均不引入可访问性回归"，并说明了为何不新增 aria 属性或专项无障碍测试。**这是实质性分析，非套话，修复属实。**（另：核实 P1-requirements.md 未见额外的可访问性专项 BDD 要求，本节覆盖已足够回应 dispatch-context 的要求。）

### 4（建议）先例引用修正 —— 已修复，核实通过

候选 1-B 实现细节第 3 点现表述为"与原 `.meta-tags-bar` 自身既有做法一致（`EntryDetailHeader.vue:72` 现状只有 `v-show="isMobile"`，没有内部 zenMode 判断，完全靠外部 `:deep()` 隐藏）"，并新增脚注明确指出 `.mobile-sticky-header`/`.mobile-bottom-bar` 实际上同时带有内部 `v-show="!zenMode"` 与父级 `:deep()`（两套机制并存），不是本条要参照的先例。

已实读源码逐一核验：
- `EntryDetailHeader.vue:72` `<div v-show="isMobile" class="meta-tags-bar" :class="{ hidden: metaTagsHidden }">` —— 确认无内部 zenMode 判断。
- `EntryDetailHeader.vue:3` `<div v-if="isMobile" v-show="!zenMode" class="mobile-sticky-header">` —— 确认有 `v-show="!zenMode"`。
- `EntryDetailMobileBar.vue:2` `<div v-if="isMobile && currentEntry" v-show="!zenMode" class="mobile-bottom-bar">` —— 确认有 `v-show="!zenMode"`。

三处与设计文档新表述**完全吻合**。**修复属实，且比上轮更准确（新增脚注避免 P4 误采信旧先例）。**

### 5（建议）loading/error/empty 留白取舍说明 —— 已修复，核实通过

"风险在哪"一节新增独立条目，明确指出该状态下 content-area 底部留白问题的成因（padding-bottom 是纯 CSS 规则不随 `currentEntry` 状态联动），并给出显式"接受"结论 + 三点理由（短暂/低频状态、联动清除引入的耦合复杂度不成比例、BDD 未要求）。与 zen-mode 场景的取舍差异（用户主动触发的高频持续状态 vs 过渡态）也做了对比说明，不是简单跳过。**修复属实，非空话。**

### 6（建议）按钮宽度量化依据 —— 已修复，核实通过

"风险在哪"一节新增量化估算：单个 icon 按钮 44px、文字按钮 70-90px，五控件场景（含间隙、内边距）合计落在 300-340px，小于 BDD-9 规定的 375px 验证宽度，据此得出"正常场景不会触发换行"的结论，并明确划出真正会触发的场景（浏览器文字缩放等无障碍设置）为已知限制、不新增自动化验证，与 iOS 虚拟键盘已知限制的处理方式对齐。**修复属实，从隐含变为显式量化。**

---

## 新发现（修订过程引入的次要问题，非上轮 6 项范围内）

**`.entry-detail.zen-mode :deep(.content-area) { padding-bottom: var(--space-3); }` 缺少 mobile 断点媒体查询保护，会意外影响桌面端。**

- 已读 `EntryDetailContent.vue:221-222` 确认 `.content-area` 的基础 padding 规则：桌面端 `padding: var(--space-4)`（16px，含 padding-bottom）；仅在 `@media (max-width: 640px)` 内才被覆写为 `padding: var(--space-3) var(--space-2)`（12px/8px）。候选 2-A 新增的 `padding-bottom: calc(var(--mobile-bar-height) + env(...))` 净空补偿也明确声明只加在 mobile 断点内。
- 但候选 2-A 给出的 zen-mode override 规则本身**没有 `@media` 包裹**，选择器 `.entry-detail.zen-mode :deep(.content-area)` 的特异性（两个 class）高于桌面端基础规则 `.content-area`（一个 class），因此只要 `.entry-detail` 带 `zen-mode` class，无论桌面还是移动端都会生效，把 `.content-area` 的 `padding-bottom` 从桌面端原本的 `var(--space-4)`(16px) 强制改成 `var(--space-3)`(12px)。
- 这与既有的 `display: none` 那组规则（`.detail-header`/`.mobile-sticky-header`/`.mobile-bottom-bar`/`.meta-tags-bar`）不同——那组规则天然安全，因为四个目标元素本身各自受 `v-if="isDesktop"` 或 `v-if="isMobile"` 门控，不存在的元素上加 `display:none` 无副作用；而 `.content-area` 是桌面/移动共用的**同一个**常驻元素，不受 v-if 门控，因此照搬"不加 media query"的既有写法在这里并不安全。
- **影响面**：仅限"桌面端 + zen-mode 同时激活"这一组合，产生 4px 的 padding-bottom 差异，纯视觉、无功能性破坏，未被 BDD-10/11/12 的字面判定标准覆盖（BDD-10/11/12 关注 scroll-hide 行为/markdown padding/bottom-bar 出现与否，未涉及 zen-mode padding-bottom 数值），但与设计文档自身反复强调的"不改桌面端"原则方向相悖，且发生在受关注度较低的角落（桌面 zen-mode 组合），有被 P4/P6 遗漏的风险。
- **严重度判断**：不构成阻断性缺陷，不影响本任务 BDD 12 条的可验证判定标准，P4 只需追加一层 `@media (max-width: 640px) { }` 包裹（或改写为更高特异性但仅限 mobile 的选择器）即可消除；不需要重新选型或推翻候选 2-A。判定为**建议级**，不阻塞本轮通过，但应在 P4 派发说明或代码 review 阶段提醒关注。

---

## 评分维度（按角色定义完整给出）

### 1. 交互状态覆盖率（loading/error/empty/edge case）—— 8/10

loading/error/empty 留白取舍（上轮建议项 5）、极小屏 375px（BDD-9）、按钮换行边界（上轮建议项 6，已量化）均有明确落点。扣分：本轮新发现的桌面 zen-mode 组合缺少覆盖说明（非上轮要求范围，但仍是一处未列出的 edge case）。

### 2. AI Slop 风险（spec 有没有给实现留"随便搞"的空间）—— 9/10

上轮唯一的"P4 需自行设计选择器"缺口（zen-mode override）已用具体选择器 + 落点文件 + 完成标志清单方式补齐，其余数值/选择器/组件边界均已具体化。扣分：新发现的 media query 缺失若被 P4 逐字照抄会产生一个未声明的桌面端副作用，说明这条规则本身还有一丝可以更"钉死"的空间。

### 3. 移动端考虑 —— 9/10（维持上轮评分，未发现新问题影响此维度）

safe-area 兼容、100vh/100dvh 权衡、地址栏收起展开模拟验证、极小屏、touch target 尺寸、断点两端行为均有详尽设计，上轮已给高分，本轮修订未削弱此维度。

### 4. 可访问性（键盘导航/屏幕阅读器）—— 8/10

上轮 3/10 的缺失（完全空缺）已被独立小节实质性填补，两点具体影响（DOM/Tab 顺序变化、fixed 定位对焦点体验的影响）均给出了有文件行号支撑的论证与结论，非套话。未打满分是因为论证停留在静态推理层面，未提及是否有计划通过实际键盘遍历/屏幕阅读器人工抽检做最终确认（P6 阶段可考虑，非本阶段设计缺陷）。

### 5. 组件完整性（`EntryMetaTagsBar.vue` 等）—— 9/10

上轮的路径错误（缺陷 A）与先例引用错误（缺陷 B）均已核实修复，且修复准确（逐字比对源码一致）。未打满分是因为新发现的 zen-mode override media query 缺口，虽不属于组件完整性范畴本身，但反映出该处 CSS 规范交代得还不够"钉死到不会出错"。

---

## Status

**approved**

候选方案（1-A/1-B、2-A/2-B、3-A/3-B）维持第 1 轮确认结论，不重新评估。上轮 3 处必须项 + 3 处建议项经逐一核实源码/文件系统，**全部修复属实**，无一处敷衍或文字游戏。修订过程中新发现一处次要问题（zen-mode `.content-area` padding-bottom override 缺少 mobile 断点 `@media` 保护，导致桌面端 zen-mode 下产生非预期的 4px padding-bottom 差异），判定为建议级、非阻断，不影响本轮通过，移交 P4 阶段实现时一并处理（建议追加 `@media (max-width: 640px)` 包裹该条 override 规则）。
