# P2 Progress Log — T090

## 已读文件
- P0-brief.md：三个问题点、已核实代码现状、known_risks
- P1-requirements.md：12 条 BDD，[CORRECTION]（问题2是修复现有组件非新建）、[BASELINE_CHANGE]（DESIGN.md:219）、边界风险收口 4 项、follows_existing_pattern: OverflowMenuSheet.vue

## DESIGN.md 相关行
- L112-113: Container padding 32px desktop / 16px mobile (通用 container，非 markdown 专属)
- L218-219: Scroll-Hide Meta Bar 规则（待推翻）
- L263: Detail page primary actions → fixed bottom bar on mobile（已声明但实现未达标）
- L268-275: Scroll Architecture 约束（.content-area 唯一滚动容器，须保留）

## useResponsiveLayout.ts
- setupScrollHide(container) 绑定 scroll 事件到 container，判断 scrollTop 增/减控制 metaTagsHidden。与滚动位置无关，纯粹方向触发。需要整体移除（BDD-3 要求"完全由文档流位置决定"，不能有独立方向触发逻辑）。
- isMobile/isDesktop 基于 viewportWidth <= 640 计算，不改。

## EntryDetailHeader.vue
- L71-84: `.meta-tags-bar` 独立 v-show="isMobile" div，紧跟在 desktop header 之后（同级，非 content 内部），CSS L192-193 max-height 折叠是跳变根因。
- 组件内没有直接引用 `.content-area`，meta-tags-bar 数据依赖 currentEntry (owner/relativeTime/readStats/isPublic/tags) —— 都已作为 header 组件 props 传入或可传入。
- L166: `.detail-header` 是 desktop-only 容器（v-if="isDesktop"），meta-tags-bar 目前对 mobile 单独渲染，desktop 走 `.meta-row`（在 detail-header 内部，随 header 一起，不参与滚动隐藏问题，L219 规则只对 mobile）。

## EntryDetailContent.vue
- `.content-area` (L221)：`flex:1; overflow-y:auto; padding: var(--space-4)`；mobile media query（max-width:640px）L222 覆盖为 `padding: var(--space-3) var(--space-2)` = 12px 上下/8px左右。
- `<main class="content-area entry-content">` 是详情页唯一滚动容器，第一个子元素是 loading/error/empty-state 或 activeFile 内容（v-else-if 链），meta-tags-bar 若要嵌入内容流需要作为该 main 的第一个子节点（在 activeFile 内容渲染逻辑之前，与 fileLoading/fileError 分支同级或包裹整体）。
- viewer 组件全部走这个统一 content-area，不含各自 scroll 容器（HtmlViewer/ImageViewer 例外用 height:100%/overflow:hidden，但没有各自纵向滚动）。

## EntryDetailMobileBar.vue
- L2: `<div v-if="isMobile && currentEntry" v-show="!zenMode" class="mobile-bottom-bar">`，同级渲染在 EntryDetailView.vue 里，紧跟在 EntryDetailContent 后面（非嵌套于 content-area 内），当前 flex column 布局下靠 `.entry-detail{min-height:100vh}` 撑开让它排在最后一行“看起来固定”。
- L80-88 CSS：`.mobile-bottom-bar` 无 position:fixed，只有 padding/border-top，是问题 2 的直接改造对象。

## EntryDetailView.vue
- L250: `.entry-detail { display:flex; flex-direction:column; min-height:100vh; background:var(--c-bg); }` —— min-height:100vh 是 P1 [CORRECTION] 判定的根因（移动地址栏伸缩导致可视高度不稳定，伪固定底部栏被顶出视口）。
- L251-254 zen-mode 隐藏规则：`.zen-mode :deep(.detail-header/.mobile-sticky-header/.mobile-bottom-bar/.meta-tags-bar) { display:none }` —— 引用了 `.meta-tags-bar` class 名，若组件重构需保留此 class 名或同步改这里的 selector。
- setupScrollHide 挂载在 onMounted 里查询 `.content-area` 元素并绑定；若移除 scroll-hide 机制，这段（L215-216）及 metaTagsHidden/handleResize 相关引用需要一并清理，避免死代码。

## OverflowMenuSheet.vue（follows_existing_pattern 参照）
- L130-144：`.bottom-sheet { position:fixed; bottom:0; left:0; right:0; z-index:1001; padding-bottom: env(safe-area-inset-bottom, 0px); }` —— 已验证可用的 fixed+safe-area 模式，可直接套用到 `.mobile-bottom-bar`。

## MarkdownViewer.vue / variables.css
- L124-136：`.markdown-body { max-width:900px; margin:0 auto; padding: var(--space-5)(24px) }`；mobile media query 覆盖为 `margin:0 var(--space-4)(16px); padding: var(--space-4)(16px)`。
- variables.css 确认 `--space-1`=4px 是最小 token，无更小 token；`--space-2`=8px。
- 结论：content-area mobile 水平 padding(8px) + markdown-body margin(16px) + padding(16px) = 40px/侧。要达成 BDD-8 ≥75%缩减且不改 content-area（避免影响其他 viewer），数学上唯一可行是把 markdown-body 的 margin/padding 在 mobile 完全归零，只依赖 content-area 的 8px（80%缩减，达标）。任何非零额外层（哪怕最小 token 4px）会使总量达到12px=70%缩减，不满足75%门槛。

## 关键设计判断已形成
- 问题1：候选 A（内联迁移到 EntryDetailContent.vue）vs 候选 B（抽取新组件 EntryMetaTagsBar.vue 挂载在 content-area 内）——倾向选 B，理由见 design 正文。
- 问题2：候选 A（仅 position:fixed，不动 min-height）vs 候选 B（position:fixed + entry-detail min-height 改 100dvh 兜底）——需 CDP 最小验证后定稿。
- 问题3：候选 A（markdown-body mobile margin/padding 归零，完全依赖 content-area 8px）vs 候选 B（content-area 按 viewer 类型条件加 dense class）——倾向选 A，理由见 design 正文。

准备开始 minimal_validation（Playwright CDP）。

## minimal_validation 执行记录（Playwright CDP，Chrome 151.0.7922.76）

测试页：/tmp/.../scratchpad/t090-viewport-test.html（本地 http.server :18901 供 file 访问，因 WSL file:// 路径在 Windows Chrome 下不可达）
脚本：/tmp/.../scratchpad/t090-validate.ts
CDP device metrics override 模拟 iPhone 尺寸 390 宽，高度依次 844→800→700（代理"地址栏收起/展开"导致可视高度变化）。

结果：
1. position:fixed;bottom:0 元素：三次不同 scrollY（0/1000/3852）下 barBottom 恒等于 innerHeight（844），barTop 恒为 innerHeight-56，**完全不受 scroll 影响**——确认 fixed 定位脱离文档流，行为符合预期。
2. viewport height 从 844→800→700 变化时，bar 的 barBottom 立即等于新的 innerHeight（800/700），**自动贴合新可视区域底部，无需任何 JS 干预**——证明"改为真正 position:fixed"这一个改动本身就能解决 min-height:100vh 伪固定被顶出视口的问题，不依赖 dvh。
3. 100vh vs 100dvh 对比：在本 CDP 环境（Emulation.setDeviceMetricsOverride 直接整体改写 viewport 尺寸，而非模拟"最大视口不变、可视视口收缩"的真实地址栏动画）下，vhHeight 与 dvhHeight 在三次高度变化中始终相等（844/800/700 vs 844/800/700）——**CDP 环境无法复现真实移动浏览器 vh 与 dvh 的差异化行为**（vh 通常锁定"最大可视高度"，dvh 跟随"当前可视高度"，这个差异只在真实地址栏收起/展开动画、DOM 不重新布局的情况下才会体现，CDP override 是整体刷新视口尺寸，两者都会跟着变）。
4. `CSS.supports('height', '100dvh')` === true，确认 Chrome 151 语法支持 dvh。

结论：**候选"仅 position:fixed"已被验证充分解决 BDD-4/5 的核心问题**（bar 自动贴合当前视口底部，不依赖 min-height 单位选择）。100dvh 在本环境下测不出增量收益，且 CDP 无法验证其在真实移动地址栏场景下的差异化优势，采用 YAGNI 原则不引入未经验证收益的改动。`.entry-detail` 的 `min-height:100vh` 保持不变。

截图：/tmp/.../scratchpad/t090-validate-screenshot.png（可视确认 bar 位于视口底部）

## P2 完成
P2-design.md 已写出，含：6 候选方案（问题1/2/3 各2）+ 选择理由、四字段、files_to_read、minimal_validation（真实 CDP 验证结果）、DESIGN.md 修订文字（L218-219/L263/L275 + 新增 Markdown Body Spacing 小节）、data-testid 清单、实现完成标志。临时验证用的 http.server(18901) 已停止。

## plan-design-review 评审记录（P2-review.md）

- 读取 P2-design.md / P1-requirements.md / DESIGN.md / P0-brief.md，并逐一核实 dispatch-context 5 项重点检查项（读源码验证候选方案描述准确性）。
- 检查项 1（EntryMetaTagsBar 组件完整性）：发现 files_to_read 路径错误（`components/entryDetailKeys.ts` 应为 `composables/entryDetailKeys.ts`，已用 find 命令核实实际路径），以及候选 1-B 第 3 点援引先例不准确（`.mobile-sticky-header`/`.mobile-bottom-bar` 实际都有内部 `v-show="!zenMode"`，与文档描述"只靠父级 :deep()"不符；真正一致的先例是原 `.meta-tags-bar` 自身）。
- 检查项 2（[DESIGN_GAP 提示]引用）：确认全文无独立 `[DESIGN_GAP:]` 标记段落，且候选 1-B 第 3 点已实际回答该问题，读 `EntryDetailView.vue:254` 确认 `.zen-mode :deep(.meta-tags-bar)` 选择器确实已存在——结论为措辞遗留，非真实缺口。
- 检查项 3（padding-bottom/zen-mode override 选择器）：确认 calc 公式本身清楚，但 zen-mode override 缺具体选择器与落点文件，P4 需自行设计，判定为需要补充的具体缺口。
- 检查项 4（底部栏溢出风险）：用实际按钮集合估算宽度（300-340px < 375px 最小验证宽度），判定正常场景不会触发，建议补量化依据但不需要架构改动。
- 检查项 5（minimal_validation 推理链）：确认 CDP 模拟方法局限性文档已诚实说明，assumption_1→2 的推理链在 CSS 机制层面自洽，判定站得住。
- 额外发现（超出 dispatch 5 项）：loading/error/empty 状态下 content-area 新增的 padding-bottom 是纯 CSS 媒体查询、不依赖 bottom bar 是否渲染，会在这三种状态下产生多余留白，设计文档未提及；可访问性维度（DOM/Tab 顺序变化）全文未讨论，不满足 dispatch-context 显式要求。
- 判定：needs-revision（3 项必须补充 + 3 项建议），候选方案选型本身不需要重新评估。

## P2 修订第 1 轮（review needs-revision → 修复）

- 必须 1：files_to_read 第 46 行 `frontend-v3/src/components/entryDetailKeys.ts` 改为 `frontend-v3/src/composables/entryDetailKeys.ts`（已用 ls 核实实际路径只存在于 composables/ 下，components/ 下无此文件）。
- 必须 2：核实 `EntryDetailView.vue` 现有 zen-mode `:deep()` 块实际写法（bash grep 确认 L251-254 为 `.entry-detail.zen-mode :deep(.detail-header), .entry-detail.zen-mode :deep(.mobile-sticky-header), .entry-detail.zen-mode :deep(.mobile-bottom-bar), .entry-detail.zen-mode :deep(.meta-tags-bar) { display: none; }` 一个逗号分隔选择器列表）。因新规则属性是 `padding-bottom` 而非 `display`，不能合并进同一选择器列表，需单独一条 `.entry-detail.zen-mode :deep(.content-area) { padding-bottom: var(--space-3); }`，追加在候选 2-A 段落说明落点与写法，并写入第 5 节实现完成标志清单。
- 建议 1：候选 1-B 实现细节第 3 点先例引用修正为"与原 `.meta-tags-bar` 自身既有做法一致"，并补充说明 `.mobile-sticky-header`/`.mobile-bottom-bar` 实际是另一套 v-show+:deep() 并存机制，不是本条参照对象（已用 grep 核实三处组件 v-show 实际写法）。
- 建议 2：在"风险在哪"新增一条，说明 loading/error/empty 状态下 content-area 底部留白问题，给出显式取舍结论：接受留白、不引入 v-if 联动清零，并给出三点理由。
- 建议 3：在"风险在哪"新增一条，把评审已算好的按钮宽度估算（300-340px < 375px）原文补入，把"正常场景不会触发换行"从隐含变为显式。
- 必须 3：新增"可访问性影响"小节（第 1 节末尾，候选方案之前）。核实模板层级顺序（`EntryDetailView.vue:5-83`：Header→Banners→Content→MobileBar→Dialogs 顶层顺序不变）+ `EntryDetailMobileBar.vue:81-87` 改动前无 position 声明。给出两点判断：(1) meta-tags-bar 迁移后 Tab 顺序落点不变（仍在 header 结束/正文开始的衔接点），landmark 归属从 banner 变为 main 更准确，轻微正向；(2) mobile-bottom-bar 改 fixed 不影响 DOM/可访问性树顺序（position 只影响视觉渲染），且焦点常驻可见是正向改善。结论：无可访问性回归，不新增 aria 属性或专项验收项。

## P2 修订完成
6 处修复点（3 必须 + 3 建议）均已落实，候选方案选型文字（1-A/1-B/2-A/2-B/3-A/3-B）、minimal_validation、DESIGN.md 修订文字（第 3 节）、data-testid 清单（第 4 节）均未改动，仅在候选 2-A 段落内追加了落点说明、在第 5 节追加一条检查项、在"风险在哪"追加两条、新增"可访问性影响"小节。Header 保持不变，status 保持 draft。

## plan-design-review 第 2 轮复核记录（retry1）

- 按 dispatch-context 逐项复核清单，逐一读源码核实上轮 6 处修订，不重新评估候选方案本身。
- 必须 1（files_to_read 路径）：`ls` 核实 `frontend-v3/src/composables/entryDetailKeys.ts` 存在，`components/` 下不存在同名文件——修复属实。
- 必须 2（zen-mode override 选择器）：读 `EntryDetailView.vue:250-254` 逐字核对设计文档引用的现有 zen-mode 块内容，完全一致；新选择器 `.entry-detail.zen-mode :deep(.content-area) { padding-bottom: var(--space-3); }` 落点、写法、完成标志清单三处均已落实——修复属实。
- 必须 3（可访问性小节）：核实新增小节论证有具体文件行号支撑（`EntryDetailView.vue:5-83` 模板顺序、`EntryDetailMobileBar.vue:81-87` 改动前无 position 声明），非套话——修复属实。P1-requirements.md 未见额外可访问性专项 BDD 要求，本节覆盖已足够。
- 建议 1（先例引用）：grep 核实 `EntryDetailHeader.vue:72`（meta-tags-bar 无 v-show zenMode）、`EntryDetailHeader.vue:3`（mobile-sticky-header 有 v-show="!zenMode"）、`EntryDetailMobileBar.vue:2`（mobile-bottom-bar 有 v-show="!zenMode"）三处与设计文档新表述完全吻合——修复属实。
- 建议 2（loading/error/empty 留白）与建议 3（按钮宽度量化）：均已核实新增段落内容与上轮要求的取舍说明/量化依据一致，非空话。
- **新发现（超出复核清单，属于"修订过程是否引入新问题"检查范围）**：读 `EntryDetailContent.vue:221-222` 确认 `.content-area` 桌面端基础 padding-bottom 为 `var(--space-4)`(16px)，仅 mobile 断点内被覆写为 `var(--space-3)`(12px)。候选 2-A 给出的 zen-mode override 规则 `.entry-detail.zen-mode :deep(.content-area) { padding-bottom: var(--space-3); }` 未包裹 `@media (max-width: 640px)`，选择器特异性高于桌面基础规则，会导致"桌面端 + zen-mode 激活"这一组合下 padding-bottom 被意外从 16px 改为 12px。与既有 `display:none` 那组规则不同（那组规则的四个目标元素各自受 v-if 门控，不存在时加规则无副作用），`.content-area` 是桌面/移动共用的常驻元素，不受 v-if 门控，因此"照搬不加 media query"的既有写法在此处不安全。判定为建议级、非阻断（4px 纯视觉差异，未被 BDD-10/11/12 字面判定标准覆盖，P4 阶段追加一层 media query 包裹即可消除），不影响本轮 approved 判定，已在 P2-review.md 中记录并建议移交 P4 一并处理。
- 判定：approved（6 项修复全部核实属实，新发现问题严重度不构成阻断）。
- 产出：覆写 `docs/tasks/T090-mobile-detail-ux-polish/P2-review.md`（新增 `revised: 2026-08-09` header 字段），按角色定义给出完整 5 维度评分（8/9/9/8/9），status 从 needs-revision 改为 approved。
