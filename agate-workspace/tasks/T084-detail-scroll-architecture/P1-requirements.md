---
phase: P1
task_id: T084-detail-scroll-architecture
type: problems
parent: P0-brief.md
trace_id: T084-P1-20260731
status: revised
created: 2026-07-31
agent: analyst
---

# P1 需求基线 — T084 详情页滚动架构统一

## 1. 需求复述

详情页（EntryDetailView）存在多层 `overflow: auto` 声明，导致滚动容器不明确。`.content-area` 设计为唯一纵向滚动容器，但 `.markdown-viewer`（`height: 100%; overflow: auto`）和 `.code-body`（`overflow: auto; flex: 1; min-height: 0`）各自抢走了纵向滚动，引发三个连锁问题：

1. **scroll-hide 失效**：`useResponsiveLayout.setupScrollHide()` 的 `findScrollable()` 在 `onMounted` 时因内容异步渲染（Shiki/Mermaid）找不到 `scrollHeight > clientHeight` 的子元素，fallback 到 `.content-area`，但 `.content-area` 实际不滚动（子元素抢了），scroll 事件不触发，meta-tags-bar 始终显示。
2. **padding 双层叠加**：`.content-area` 有 `padding: var(--space-4)`（16px），`.markdown-body` 又有 `padding: 2rem`（32px），移动端有效内容宽度减少约 13%。
3. **TOC 锚点偏移**：`scrollIntoView()` 触发的滚动发生在 `.markdown-viewer` 内部，但 `scroll-margin-top: 80px` 是为 `.content-area` 滚动设计的（sticky header 高度），参考系不匹配导致锚点跳转后标题被遮挡。

**目标**：`.content-area` 作为唯一纵向滚动容器，所有 viewer 组件不声明 `overflow-y: auto / height: 100%`（保留必要的 `overflow-x: auto` 横向滚动），修复上述三个问题。

## 2. 隐含需求识别

### IR-1: HtmlViewer / ImageViewer 的 height:100% 依赖问题

**现状**：HtmlViewer（`.html-viewer { height: 100%; overflow: hidden }`）和 ImageViewer（`.image-viewer { height: 100%; overflow: hidden }`）都依赖父容器有明确高度来撑满。`.content-area` 有 `flex: 1`，在 flex 布局中有明确高度，所以 `height: 100%` 子元素能正确撑满。

**隐含需求**：这两个组件不抢纵向滚动（`overflow: hidden` 是对的），但如果 P0 方案将 viewer 组件改为"自然高度"，HtmlViewer 的 iframe（`height: 100%`）可能塌陷为 0——因为 iframe 没有内容撑开高度。HtmlViewer 和 ImageViewer 必须保持 `height: 100%` 模式（撑满 content-area），不能改为自然高度。只有 MarkdownViewer 和 CodeViewer 需要改为自然高度。

**覆盖性声明**：DiagramBlock 及其子渲染器（MermaidRenderer/SvgRenderer/PlantUmlRenderer）不受本次改动影响。`.diagram-viewer` 有 `overflow: hidden; height: 400px` 固定高度，子渲染器的 `height: 100%` 参考的是 `.diagram-viewer` 的 400px，不依赖 content-area 高度，不抢纵向滚动，无需改动。

### IR-2: CodeViewer 横向滚动保留

**现状**：`.code-body` 有 `overflow: auto`（双向），`.code-body :deep(pre)` 有 `overflow-x: auto`。

**隐含需求**：移除 `.code-body` 的纵向 `overflow: auto` 时，必须保留横向滚动能力（`overflow-x: auto`）。代码行超出宽度时仍需横向滚动，不能因为统一滚动架构而丢失。

### IR-3: t049 E2E 测试的 scroll-hide 验证方式

**现状**：t049 的 A-BDD-3/A-BDD-4 用 `window.scrollTo(0, 100)` 测试 scroll-hide，选择器是 `.header-tags`（T079 之前的旧组件名）。

**隐含需求**：T084 改动后，滚动发生在 `.content-area` 而非 `window`，`window.scrollTo` 不会触发 `.content-area` 的 scroll 事件。现有 t049 测试可能本身就在测一个不工作的行为（因为 scroll-hide 当前就失效）。P6 验收需用 `.content-area` 的 scroll 事件验证，t049 测试需同步修正或标为已知问题。

### IR-4: padding 归属决策

**现状**：`.content-area` 有 `padding: var(--space-4)`（16px），`.markdown-body` 的 padding 有**两处声明**：

1. `MarkdownViewer.vue` L130-131 scoped style：`.markdown-body { padding: 2rem; }`（32px，因 scoped data 属性优先级更高，实际生效）
2. `markdown.css` L2 全局样式：`.markdown-body { padding: var(--space-5); }`（20px，被 scoped 覆盖，scoped 移除后会生效）
3. `markdown.css` L3 移动端媒体查询：`@media (max-width: 640px) { .markdown-body { padding: 1.25rem; } }`（20px，移动端覆盖全局）

两层 padding 叠加（content-area 16px + markdown-body 32px = 48px）。

**隐含需求**：必须决定 padding 归属在哪一层。P0 建议 `.content-area` 只做滚动容器（`padding: 0`），padding 由各 viewer 自行负责（不同内容类型可以有不同 padding）。但 MarkdownViewer 的 `.markdown-body` 有 `max-width: 900px; margin: 0 auto` 居中——如果 padding 在 `.markdown-body`，居中效果不受影响；如果 padding 在 `.content-area`，居中参考的是 content-area 的 content-box，也合理。需确保最终只有一层 padding。

**额外约束**：padding 统一改动时，`markdown.css` 中的全局 `.markdown-body` padding 声明（L2 + L3 移动端）也需同步处理——否则 scoped padding 移除后全局声明会生效，padding 从 2rem 变为 var(--space-5)（20px），引入非预期行为变化。P2 需决定是清理 markdown.css 全局声明还是保留并由 scoped 覆盖。

### IR-5: CodeViewer 短代码文件的视觉空旷

**现状**：`.code-viewer` 有 `min-height: 300px; flex: 1`，短代码文件也会撑满可视区。

**隐含需求**：改为自然高度后，短代码文件只占一小块，下方留白。P0 已列此风险。需决定是否可接受，或用 `min-height: 100%`（不是固定 300px）让短代码至少撑满 content-area。这影响 BDD 验收条件的设计——如果决定可接受空旷，则不需要 BDD 覆盖；如果用 `min-height: 100%`，则需验证短代码文件不出现 content-area 内的额外滚动条。

### IR-6: useResponsiveLayout 的 setupScrollHide 简化

**现状**：`setupScrollHide` 用 `findScrollable` 遍历子元素找可滚动元素，找不到时 fallback 到 container 本身。

**隐含需求**：统一滚动架构后，`.content-area` 就是滚动容器，`findScrollable` 逻辑可移除，直接监听传入的 container 的 scroll 事件。但需确保 `onMounted` 时序正确——EntryDetailView 的 `onMounted` 在 `await entryDetailStore.loadEntry()` 和 `await nextTick()` 之后才调用 `setupScrollHide`，此时内容可能还在异步渲染（Shiki 高亮）。简化后的 `setupScrollHide` 直接绑 `.content-area` 的 scroll 事件，不需要等内容渲染完成，时序问题自然解决。

### IR-7: footnote 锚点跳转

**现状**：MarkdownViewer 中 footnote 链接用 `targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' })`。

**隐含需求**：统一滚动架构后，`scrollIntoView` 触发的滚动发生在 `.content-area`（因为 `.markdown-viewer` 不再自己滚动），`scroll-margin-top: 80px` 的参考系变为 `.content-area`，sticky header 遮挡问题自然修复。需验证 footnote 跳转也受益。

### IR-8: DESIGN.md 滚动架构决策补充

**现状**：DESIGN.md §9 有 Responsive Behavior 规则，但无 Scroll Architecture 小节。

**隐含需求**：需在 DESIGN.md §9 补充「Scroll Architecture」小节，显式声明 `.content-area` 是详情页唯一纵向滚动容器，viewer 组件不声明 `overflow-y: auto / height: 100%`（HtmlViewer/ImageViewer 例外，保留 `height: 100%` 撑满但不抢滚动）。这是设计缺口的文档化修复。

## 3. BDD 验收条件

### 滚动容器统一

#### BDD-01: MarkdownViewer 内容超出视口时由 content-area 滚动
- Given 详情页打开一个 markdown 文件，且内容高度超过视口
- When 用户在内容区域向下滚动
- Then `.content-area` 的 `scrollTop` 增大（`.markdown-viewer` 的 `scrollTop` 保持 0）

#### BDD-02: CodeViewer 内容超出视口时由 content-area 滚动
- Given 详情页打开一个代码文件，且代码行数超过视口高度
- When 用户在内容区域向下滚动
- Then `.content-area` 的 `scrollTop` 增大（`.code-body` 的 `scrollTop` 保持 0）

#### BDD-03: CodeViewer 保留横向滚动
- Given 详情页打开一个代码文件，且某行代码宽度超过视口
- When 用户在代码区域横向滚动
- Then 代码内容可以横向滚动查看（`.code-body` 或 `pre` 的 `scrollLeft` 增大）

### scroll-hide 行为

#### BDD-04: 移动端向下滚动隐藏 meta-tags-bar
- Given 移动端（<=640px）详情页，meta-tags-bar 可见，内容高度超过视口
- When 用户在 `.content-area` 上向下滚动超过 10px
- Then meta-tags-bar 不可见（高度坍缩为 0 或 opacity 为 0）

#### BDD-05: 移动端向上滚动恢复 meta-tags-bar
- Given 移动端详情页，meta-tags-bar 已不可见
- When 用户在 `.content-area` 上向上滚动
- Then meta-tags-bar 恢复可见（高度和 opacity 恢复正常）

#### BDD-06: 桌面端不渲染 meta-tags-bar 且 scroll-hide 不触发
- Given 桌面端（>640px）详情页
- When 页面渲染完成并检查 DOM
- Then `.meta-tags-bar` 元素不在 DOM 中（`document.querySelector('.meta-tags-bar')` 返回 null），且 `metaTagsHidden` 响应式状态保持初始值 false（scroll-hide 逻辑未触发）

### TOC 锚点跳转

#### BDD-07: 点击 TOC 标题锚点滚动到正确位置
- Given 详情页打开一个有多级标题的 markdown 文件，内容超出视口，TOC 可见
- When 用户点击 TOC 中的某个标题
- Then 对应标题可见且不被 sticky header 遮挡（标题顶部距 `.content-area` 顶部的偏移量在 `80px ± 5px` 范围内，即 `75px ≤ offsetTop ≤ 85px`）

### padding 统一

#### BDD-08: 移动端 markdown 内容只有一层 padding
- Given 移动端详情页打开一个 markdown 文件
- When 检查 `.content-area` 和 `.markdown-body` 的 computed padding
- Then `.markdown-body` 的 `paddingTop` 为 `0px`（`getComputedStyle(.markdown-body).paddingTop === '0px'`），padding 仅由 `.content-area` 单层承担

> [SCOPE+ from P2] BDD-08 修订：P2 设计评审发现原 BDD-08（要求 content-area paddingTop=0px）与方案 A（content-area 保留 padding、markdown-body 移除 padding）矛盾。P0-brief 原建议 content-area padding:0，但 architect 论证方案 A（content-area 保留 padding）改动更小、padding 一致性更好（不同 viewer 切换时宽度不跳变）。主 Agent 确认方案 A 方向，修订 BDD-08 使 padding 归属与方案 A 一致。
- [SCOPE_RESOLVED] BDD-08 已修订为与方案 A 一致（markdown-body paddingTop=0px，padding 由 content-area 承担）

### HtmlViewer / ImageViewer 不受影响

#### BDD-09: HtmlViewer iframe 仍正确撑满
- Given 详情页打开一个 HTML 文件
- When 页面渲染完成
- Then iframe 撑满 `.content-area` 的 content-box（iframe 高度等于 `.content-area` clientHeight 减去 padding，即 `height: 100%` 的标准行为）

> [SCOPE+ from P6] BDD-09 修订：P6 验收发现原措辞"iframe 高度等于 clientHeight"在技术上不正确——CSS `height: 100%` 永远等于父元素 content-box height 而非 clientHeight（含 padding）。HtmlViewer 未被 T084 改动，这是标准 CSS 行为。修订为"撑满 content-box"使验收条件可达。
- [SCOPE_RESOLVED] BDD-09 已修订为"撑满 content-box"，与 CSS height:100% 标准行为一致

#### BDD-10: ImageViewer 图片仍正确显示
- Given 详情页打开一个图片文件
- When 图片加载完成
- Then 图片在 `.content-area` 可视区域内居中显示（不因滚动架构改动而塌陷或溢出）

### 回归保障

#### BDD-11: 现有前端单测全部通过
- Given 当前 vitest 测试套件（1125 passed | 1 skipped）
- When 执行 `make test-frontend`
- Then 所有测试通过（0 failed）

#### BDD-12: 类型检查零错误
- Given 当前 vue-tsc 零错误状态
- When 执行 `make typecheck`
- Then 类型检查通过（0 errors）

#### BDD-13: 前端构建成功
- Given 所有代码改动完成
- When 执行 `make build-frontend`
- Then 构建成功，产物输出到 `backend/peekview/static/`

### DESIGN.md 文档补充

#### BDD-14: DESIGN.md 包含 Scroll Architecture 决策
- Given 所有代码改动完成
- When 检查 DESIGN.md §9 Responsive Behavior
- Then 包含「Scroll Architecture」小节，显式声明 `.content-area` 是详情页唯一纵向滚动容器

## 4. 待确认清单

[NO_NEED_CONFIRM]

所有隐含需求均有明确的技术方向，不涉及业务判断：
- IR-1（HtmlViewer/ImageViewer 保持 height:100%）→ 技术约束，无歧义
- IR-4（padding 归属）→ P0 已建议 content-area padding:0 + viewer 自行负责，方向明确
- IR-5（短代码视觉空旷）→ P0 已列为风险，BDD 不覆盖"视觉空旷"（主观），仅覆盖功能正确性

## 5. 裁剪说明

```yaml
phases: [P1, P2, P3, P4, P5, P6, P7, P8]
```

- **P1**（需求基线）：本文件，不可裁
- **P2**（方案设计）：不可裁——涉及 4 个组件 + 1 个 composable + 1 个 CSS 文件 + DESIGN.md，需明确改动边界和 padding 决策
- **P3**（TDD 测试）：保留——`useResponsiveLayout` 的 `setupScrollHide` 签名/逻辑变化有可测试行为，viewer 组件 CSS 变化虽难单测但 composable 可测
- **P4**（代码实现）：核心实现阶段
- **P5**（技术验证）：保留——需验证 vitest + vue-tsc + build 全绿
- **P6**（验收）：不可裁——UI 交互改动（滚动/scroll-hide/锚点）必须 Playwright 实跑 + 截图验证
- **P7**（一致性检查）：保留——涉及多文件改动（4 组件 + 1 composable + 1 CSS + DESIGN.md），需交叉核对
- **P8**（发布准备）：保留——产出文件，主 Agent gate 后 bump-version

**risk_level: medium** — 涉及 4 个组件的 CSS/布局改动，可能影响 HtmlViewer/ImageViewer 的 height:100% 依赖关系，且需同步修改 E2E 测试。不是 high（不改后端/DB/schema/安全），不是 low（多组件布局联动）。

## 6. 范围声明

```yaml
domains:
  - frontend
packages:
  - frontend-v3/src/components/EntryDetailContent.vue
  - frontend-v3/src/components/MarkdownViewer.vue
  - frontend-v3/src/components/CodeViewer.vue
  - frontend-v3/src/components/HtmlViewer.vue
  - frontend-v3/src/components/ImageViewer.vue
  - frontend-v3/src/composables/useResponsiveLayout.ts
  - frontend-v3/src/styles/code.css
  - frontend-v3/src/styles/markdown.css
  - frontend-v3/src/views/EntryDetailView.vue
  - DESIGN.md
  - frontend-v3/e2e/t049-mobile-header-diagram-sanitize.spec.ts
```

## 7. 能力需求声明

```yaml
capability_requirements:
  - need: browser-vision
    why: P6 验收需截图验证 scroll-hide 行为、锚点跳转位置、padding 宽度、iframe 撑满等 UI 交互
    available:
      - "playwright-cdp skill（CDP 连接 Chrome :18800，截图 + DOM 检查）"
      - "vision-engine skill（分析截图内容）"
    status: available
    requires_minimal_validation: true

  - need: frontend-test-runner
    why: P5 需运行 vitest + vue-tsc + build 验证回归
    available:
      - "make test-frontend（vitest）"
      - "make typecheck（vue-tsc）"
      - "make build-frontend（vite build）"
    status: available
```

`requires_minimal_validation: true` — P6 验收依赖浏览器行为（scroll 事件、scrollIntoView、CSS overflow），P2 architect 需产出 `minimal_validation:` 块确认浏览器环境可用。
