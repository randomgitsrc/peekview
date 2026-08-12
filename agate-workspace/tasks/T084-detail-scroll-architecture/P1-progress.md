## analyst 启动
- 已读 P0-brief.md：任务核心是统一详情页滚动架构，content-area 唯一滚动容器
- 已读 dispatch-context：7 个输入文件待读，约束=不改后端/MCP/DB，桌面移动行为一致
- 已读 analyst 角色定义：需求质疑模式，识别隐含依赖，BDD 可二值判定
## 输入文件读取发现
### EntryDetailContent.vue
- `.content-area` 有 `overflow-y: auto; padding: var(--space-4)`（桌面16px），移动端 `padding: var(--space-3) var(--space-2)`（12px/8px）
- `.detail-content` 有 `overflow: hidden`（正确，不滚）
- content-area 内部直接渲染 viewer 组件，无额外包裹层
### useResponsiveLayout.ts
- `setupScrollHide` 用 `findScrollable` 遍历 container 子元素，找 overflowY=auto/scroll 且 scrollHeight>clientHeight 的
- 找不到时 fallback 到 container 本身
- 确认 P0-brief 描述准确：异步渲染导致 onMounted 时找不到可滚动子元素
### MarkdownViewer.vue
- `.markdown-viewer` 确认 `height: 100%; overflow: auto`（抢滚动）
- `.markdown-body` 有 `padding: 2rem`（32px）+ `max-width: 900px; margin: 0 auto`
- `scroll-margin-top: 80px` 在全局 style 中（非 scoped），作用于 `.markdown-body` 内的 h1-h6
- footnote 链接用 `scrollIntoView({ behavior: 'smooth', block: 'start' })`
### code.css
- `.code-body` 确认 `overflow: auto; flex: 1; min-height: 0`（抢滚动）
- `.code-viewer` 有 `min-height: 300px; flex: 1`
- `.code-body :deep(pre)` 有 `overflow-x: auto`（横向滚动，需保留）
- 移动端 `.code-viewer` 的 `min-height: 0`（允许收缩）
## 关键发现汇总
### EntryDetailHeader.vue
- `.meta-tags-bar` 是移动端 scroll-hide 目标，class `.hidden` 控制（max-height:0; opacity:0; overflow:hidden）
- `.mobile-sticky-header` 是 `position: sticky; top: 0`（固定在顶部）
- metaTagsHidden prop 由父组件 EntryDetailView 传入，来自 useResponsiveLayout
### EntryDetailView.vue
- onMounted 中 `document.querySelector('.content-area')` → `setupScrollHide(content)`
- scrollToHeading: `document.getElementById(heading.id)?.scrollIntoView({ behavior: 'smooth' })`
- scroll-margin-top:80px 在 MarkdownViewer 全局样式中
### HtmlViewer.vue
- `.html-viewer` 有 `height: 100%; overflow: hidden`（不抢纵向滚动，正确）
- `.html-frame-container` 有 `flex: 1; overflow: hidden`
- iframe 有 `overflow: auto`（内部滚动，sandbox 隔离，正确）
- ⚠️ HtmlViewer 用 `height: 100%` 依赖父容器有明确高度——如果 content-area 改为自然高度，iframe 可能塌陷
### ImageViewer.vue
- `.image-viewer` 有 `height: 100%; overflow: hidden`（不抢纵向滚动）
- `.image-container` 有 `flex: 1; overflow: hidden`，zoomed 时 `overflow: auto`
- ⚠️ 同样依赖 `height: 100%` 撑满父容器
### CodeViewer.vue + code.css
- `.code-viewer` 有 `min-height: 300px; flex: 1`（抢高度）
- `.code-body` 有 `overflow: auto; flex: 1; min-height: 0`（抢纵向滚动）
- `.code-body :deep(pre)` 有 `overflow-x: auto`（横向滚动需保留）
### scrollToHeading 实现
- `document.getElementById(heading.id)?.scrollIntoView({ behavior: 'smooth' })` — 无 block 参数，默认 'start'
- scroll-margin-top:80px 在全局样式中（非 scoped），作用于 h1-h6
- ⚠️ 如果 .markdown-viewer 自己滚动（现状），scroll-margin-top 参考的是 .markdown-viewer 的 viewport，不是 .content-area 的
### 现有 E2E 测试（t049）
- A-BDD-3/4 用 `window.scrollTo(0, 100)` 测试 scroll-hide
- ⚠️ 但实际滚动容器是 .content-area，不是 window——现有测试可能本身就有问题
- 选择器是 `.header-tags`（不是 `.meta-tags-bar`），可能是 T079 之前的旧组件名
- ⚠️ T084 改动后需验证 t049 是否仍通过
### DESIGN.md §9
- L218-219: Scroll-Hide Meta Bar 规则已定义
- L249-266: Responsive Behavior 有 breakpoints + rules，但无 Scroll Architecture 小节
- 确认 P0-brief 描述的"设计缺口"准确
### 隐含需求识别
1. HtmlViewer/ImageViewer 用 height:100% 依赖父容器有明确高度——content-area 改为自然高度后 iframe 可能塌陷
2. CodeViewer 短代码文件改为自然高度后视觉空旷（P0 已列风险）
3. t049 E2E 测试用 window.scrollTo，改为 .content-area 滚动后可能失效——需同步修改
4. MarkdownViewer 的 footnote scrollIntoView 也依赖滚动容器正确
5. code-body 的 overflow-x: auto（横向滚动）需保留，只移除纵向 overflow:auto
6. .markdown-body 的 max-width:900px + margin:0 auto 居中——padding 决策需考虑居中效果
7. useResponsiveLayout.setupScrollHide 的 findScrollable 逻辑简化后，需确保 onMounted 时序仍正确
## 产出完成
- P1-requirements.md 已写入，14 条 BDD（BDD-01 至 BDD-14），编号连续
- 8 个隐含需求（IR-1 至 IR-8）已识别
- [NO_NEED_CONFIRM] — 所有隐含需求有明确技术方向
- domains: frontend；risk_level: medium；phases: [P1-P8] 全走
- capability_requirements: browser-vision (available) + frontend-test-runner (available)
- requires_minimal_validation: true（P6 依赖浏览器行为）
- BDD 反模式自检：修正了 BDD-04/05 的 class 名绑定，改为"不可见/恢复可见"
- [PROD_NOT_TOUCHED]
