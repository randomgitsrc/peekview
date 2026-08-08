---
phase: P0
task_id: T090
task_name: mobile-detail-ux-polish
trace_id: T090
created: 2026-08-08
status: pending
parent: 用户报告（会话内插播，T089 P1 派发前打断）
---

# P0-brief — T090 移动端详情页 UX 打磨

## task

修复移动端详情页三处体验问题，均集中在 `EntryDetailHeader.vue` / `EntryDetailContent.vue` / 各 viewer 组件的移动端布局与 DESIGN.md 移动端规则：

1. **meta-tags-bar 滚动隐藏引发跳变**：上滑隐藏、下滑重新出现的机制通过 `max-height` 折叠实现，导致内容区随之整体位移（跳变）。用户要求把 metadata 条嵌入正文 content 区随内容一起滚动，不再做独立的显示/隐藏切换。
2. **移动端"底部操作栏"显示不稳定**：不同浏览器地址栏位置不同（Chrome Android 顶部、Safari iOS 可能底部且自动收起）导致底部区域可见性不一致。用户要求操作栏固定在视口底部持续可见，同时不与浏览器自身地址栏冲突/被遮挡（safe-area 兼容）。
3. **移动端 markdown 正文边距过大**：桌面端边距体验良好，移动端建议缩减到当前的 1/4 甚至更小。

## 现象（用户报告，原话摘录）

> 移动端，页面往上滑的时候，因为要把那个 metadata 那一横条给隐掉，就会产生了一个滑动过程的一个向上的一个跳变，页面往下滚动、那一条就又出来了。这个体验很不好，建议 metadata 那一条嵌入到正文 content 区，上滑时直接划走。下滑时也不用刻意显示出来，保持一致性。这个不止涉及 markdown 视图，代码等其他视图都存在这个问题。
>
> 移动端视图下，底部操作栏没显示出来，有时能显示出来。因为有的浏览器导航地址栏组件有的是在上面有的在下面。我建议一直在页面视图下面显示底部操作栏，但是不要与浏览器本身的地址栏有冲突、或被遮盖。这个兼容性要做好。
>
> 移动端视图下，markdown 页面，边框还是很大。桌面端视图还可以。建议移动端的边距缩减到现在的 1/4 甚至更小，你看看怎么合适。涉及 DESIGN.md，但你要有所设计。

## 已核实的代码现状（orchestrator 只读排查，非猜测，供 P1 analyst 起点，不代替 P1 质疑）

### 问题 1：meta-tags-bar 跳变
- 机制在 `frontend-v3/src/composables/useResponsiveLayout.ts` 的 `setupScrollHide()`：绑定 `.content-area` 的 scroll 事件，向下滚动置 `metaTagsHidden.value = true`，向上滚动置 `false`
- 渲染消费在 `frontend-v3/src/components/EntryDetailHeader.vue:72`：`<div v-show="isMobile" class="meta-tags-bar" :class="{ hidden: metaTagsHidden }">`
- CSS（同文件 L192-193）：`.meta-tags-bar.hidden { max-height: 0; padding: 0; overflow: hidden; ... }` —— 这是"跳变"的直接根因：`max-height` 折叠会改变文档流高度，`.content-area` 内容随之整体上移/下移
- **DESIGN.md 现有条款直接冲突**：`DESIGN.md:219` 写着"On mobile detail page, metadata/tags bar hides on scroll-down, reappears on scroll-up"——这是 T084/T085 阶段定的规则，用户现在要求的是相反方向的体验（不做独立显示/隐藏，嵌入内容流），P2 设计阶段需要显式产出 `[BASELINE_CHANGE]`修订 DESIGN.md 这一条，不能绕过
- **影响面确认不止 markdown**：`EntryDetailHeader.vue` 是详情页公共 header，所有 viewer（Markdown/Code/Table/Tree/Image/HTML）共用同一个 header 和 meta-tags-bar，跳变问题天然是跨 viewer 的，不需要每个 viewer 单独改

### 问题 2：底部操作栏
- **当前实际实现与 DESIGN.md 规则不一致**：`DESIGN.md:263` 写"Detail page: ... primary actions → fixed bottom bar on mobile."，但 `EntryDetailHeader.vue` 的实际实现是 `.mobile-sticky-header`（L163：`position: sticky; top: 0;`）——操作按钮（file-tree/toc/source-toggle/copy/share）全部在**顶部**吸顶栏，代码库里**没有**找到真正意义上的"移动端固定底部操作栏"组件
- 即用户描述的"有时显示有时不显示"的底部操作栏，在当前代码里并非独立组件——需要 P1 analyst 进一步确认用户所指是否就是这个顶部操作区（体感上被浏览器地址栏顶到看不见/位置漂移），还是历史上确实有独立底部条实现后来被移除，或用户期望的是全新组件。这是本任务范围判定的关键，**建议 P1 标 `[NEED_CONFIRM]` 或至少 `[SUGGEST]`** 但方向倾向：新建/迁移为真正的 `position: fixed; bottom: 0` 操作栏，使用 `env(safe-area-inset-bottom)` 做安全区适配，与 DESIGN.md:263 已声明的目标对齐
- 已有 safe-area 先例可参考：`OverflowMenuSheet.vue:141` 已用 `padding-bottom: env(safe-area-inset-bottom, 0px);`，说明项目里已有解决同类兼容问题的既有模式（`follows_existing_pattern` 候选）
- 移动端浏览器 UI 变化（地址栏收起/展开）会改变 `100vh` 的实际可视高度——这是已知的 web 平台问题（`100vh` vs `100dvh` / `visualViewport` API），P2 需要在候选方案里明确处理方式

### 问题 3：markdown 正文边距
- 当前移动端（`max-width: 640px`）叠了三层间距：
  - `EntryDetailContent.vue:222`：`.content-area { padding: var(--space-3) var(--space-2); }` = 12px 上下 / 8px 左右
  - `MarkdownViewer.vue:131-136`：`.markdown-body { margin: 0 var(--space-4); padding: var(--space-4); }` = 16px margin + 16px padding（左右各叠加 32px）
  - 三层叠加后左右合计约 40px（8 + 16 + 16），这是用户感知"边距很大"的直接原因
  - `--space-4` = 16px（`frontend-v3/src/styles/variables.css:7`）
- DESIGN.md 目前没有单独针对 markdown-body 在移动端的间距 token 规则，只有通用的"Padding: 32px desktop, 16px mobile"（L113，语境是别处，非明确 markdown 专属）——P2 需要设计新的移动端间距 token 或直接调整该组件局部样式，并同步 DESIGN.md

## known_risks

- **[BASELINE_CHANGE] 需要**：DESIGN.md:219（meta-tags-bar 滚动隐藏行为）与用户新要求方向相反，P1/P2 必须显式标注变更并给出理由，不能静默覆盖
- **底部操作栏范围不确定**：问题 2 可能是"新建组件"（改动面更大，需要 P2 认真评估与顶部 header 的功能重叠/迁移策略）而非"修复现有组件"，P1 analyst 必须先到代码库核实清楚再定 BDD，不能假设
- **跨 viewer 回归风险**：meta-tags-bar 和 header 是详情页公共组件，任何改动影响全部 viewer（Markdown/Code/Table/Tree/Image/HTML/PlantUML/Mermaid），P6 验收必须覆盖至少 markdown + 1 种非 markdown viewer（如 code），不能只测 markdown
- **与 T084（详情页滚动架构统一）/T085（渲染回归修复）历史决策冲突**：这两个已完成任务定下了当前的 `.content-area` 单一滚动容器架构和 scroll-hide 机制，本任务是在此基础上调整而非推翻，P2 设计需明确"保留 `.content-area` 单一滚动容器"这一约束（DESIGN.md:270-275），只调整 meta-tags-bar 的呈现方式，不应重新引入多层 overflow
- **`100vh`/浏览器地址栏兼容性是已知复杂点**：iOS Safari / Chrome Android 对可视视口高度处理不同，纯 CSS `position: fixed; bottom: 0` 在部分浏览器历史版本上有已知坑（键盘弹出、地址栏收起/展开抖动），P2 若判定需要 `100dvh` 或 `visualViewport` API，必须先做最小验证（10 行测试页）
- **验收需要真机/多浏览器视角**：P6 建议至少用 Playwright CDP 模拟 mobile viewport（如 iPhone/Android 尺寸）截图验证三处改动，无法用桌面浏览器窗口缩小简单代替（涉及 safe-area/viewport 单位，需要正确的 device emulation）

## executor_env

platform: claude-code
has_task_tool: true
has_local_runtime: true
network: full

## env_constraints

debug_env: "make debug-quick（:8888，/tmp/peekview-debug/ 隔离）；Playwright CDP 移动端 viewport 模拟验证"
lint: "cd frontend-v3 && npx vue-tsc --noEmit（CI 强制）"
prod_isolation: "严禁触碰 :8080 生产服务与 ~/.peekview/"

## 裁剪倾向

- P1：BDD 需覆盖三个独立问题点，且需覆盖 markdown + 至少一种非 markdown viewer（跨 viewer 影响面）；需明确 `[BASELINE_CHANGE]` 覆盖 DESIGN.md:219；底部操作栏范围需先核实现状再定 BDD，不确定处标 `[NEED_CONFIRM]`
- P2：**不可裁**（design_trivial 不适用）——涉及 DESIGN.md 变更 + 至少 2 个候选方案对比（如底部操作栏用 fixed+env(safe-area) vs sticky+visualViewport；meta-tags-bar 嵌入内容流的具体实现方式）
- P3：不建议跳过——涉及可测试的 DOM/CSS 行为变化（scroll 事件处理、class 切换逻辑），且改动是多文件跨组件，风险 risk_level 倾向 medium
- P6：需 Playwright 移动端 viewport 模拟 + 截图，验证三处问题点均有对应视觉/交互证据；需覆盖至少 2 种 viewer 类型
- 风险：medium（跨多个公共组件、涉及 DESIGN.md 决策变更、涉及浏览器兼容性已知坑点，不是单文件小改动）

## 排期

T090（本任务）：用户明确要求优先于 T089 执行。T089 保持 phase=P0/status=pending 不动，待 T090 完成后继续。T090 与 T084/T085 有历史耦合但无阻塞依赖（T084/T085 均已 DONE）。
