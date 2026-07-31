---
phase: P0
task_id: T084
task_name: detail-scroll-architecture
trace_id: T084
created: 2026-07-31
status: pending
parent: null
---

# T084: 详情页滚动架构统一

## 问题

详情页存在多层 `overflow: auto` 声明，导致滚动容器不明确，引发连锁问题：

### 现状

```
.detail-content          overflow: hidden     ← 外层容器不滚动（正确）
  .content-area          overflow-y: auto     ← 应该是唯一滚动容器
    .markdown-viewer     overflow: auto; height: 100%  ← 抢走了滚动！
      .markdown-body     padding: 2rem
    .code-body           overflow: auto; flex: 1       ← 也抢走了滚动！
    .html-frame          overflow: hidden（iframe 内部滚，正确）
```

### 连锁问题

1. **scroll-hide 失效**：`useResponsiveLayout.setupScrollHide()` 在 `onMounted` 时用 `findScrollable()` 查找 `.content-area` 的子元素，试图找到实际滚动的元素绑 scroll 事件。但子元素内容异步渲染（Shiki 高亮/Mermaid），`onMounted` 时 `scrollHeight <= clientHeight`，找不到可滚动子元素，fallback 到 `.content-area` 本身——但 `.content-area` 不滚动（子元素抢了），scroll 事件永远不触发。meta-tags-bar 始终显示。

2. **padding 双层叠加**：`.content-area` 有 `padding: 16px`，`.markdown-body` 又有 `padding: 2rem`（32px）。移动端内容区有效宽度 = 屏幕宽 - 16px（content-area）- 32px（markdown-body）= 375 - 48 = 327px，浪费了 13% 屏幕宽度。

3. **scroll-to-heading 锚点偏移**：`scrollIntoView()` 调用在 `.markdown-viewer` 内部滚动，但 `scroll-margin-top: 80px` 是为 `.content-area` 滚动设计的（sticky header 高度）。如果 `.markdown-viewer` 自己滚动，`scroll-margin-top` 的参考系不对，锚点跳转后标题可能被 sticky header 遮挡。

4. **CodeViewer 同理**：`.code-body` 也有 `overflow: auto; flex: 1`，自己滚动，不在 `.content-area` 的 scroll 事件覆盖范围内。

### DESIGN.md 关联

DESIGN.md §9 已定义规则：
- L218-219：「Scroll-Hide Meta Bar — On mobile detail page, metadata/tags bar hides on scroll-down, reappears on scroll-up.」
- L263：「Detail page: file tree → dropdown selector on mobile; TOC → right drawer on mobile; primary actions → fixed bottom bar on mobile.」

但 DESIGN.md 没有显式声明「谁应该滚动」——这是一个设计缺口。本 task 需要在 DESIGN.md 中补充滚动架构决策。

## 设计思路

### 核心原则：单一滚动容器

**`.content-area` 是唯一的滚动容器。** 所有 viewer 组件（MarkdownViewer / CodeViewer / HtmlViewer / ImageViewer）只负责内容渲染，不自己滚动。

### 目标架构

```
.detail-content          overflow: hidden     ← 不变
  .content-area          overflow-y: auto     ← 唯一滚动容器
    [viewer component]   不声明 overflow/height  ← 内容自然撑开
      [content]          padding 在这一层
```

### 具体改动

1. **MarkdownViewer**：
   - `.markdown-viewer` 从 `height: 100%; overflow: auto` 改为 `min-height: 100%`（不抢滚动）
   - `.markdown-body` padding 保留（这是内容层的 padding，合理）
   - `.content-area` 的 padding 移到这里（或在 content-area 保留，二选一——不能两层都有）
   - `scrollIntoView()` 不变（`.content-area` 滚动时 `scroll-margin-top` 正确生效）

2. **CodeViewer / code.css**：
   - `.code-body` 从 `overflow: auto; flex: 1; min-height: 0` 改为不抢纵向滚动
   - 保留 `.code-body` 的 `overflow-x: auto`（代码横向滚动仍然需要）
   - `.code-viewer` 的 `flex: 1` 和 `min-height: 300px` 需要调整为自然高度

3. **HtmlViewer**：
   - iframe 内部滚动不受影响（sandbox 隔离）
   - 但 `.html-frame-container` 的 `overflow: hidden` 需要确认 iframe 高度是否正确撑满 `.content-area`

4. **useResponsiveLayout**：
   - `setupScrollHide()` 简化：去掉 `findScrollable()` 逻辑，直接监听传入的 `.content-area` 的 scroll 事件
   - 方向感知逻辑保留（下滚隐藏/上滚显示）

5. **EntryDetailContent.vue**：
   - `.content-area` 的 padding 决策：保留一层 padding，在 `.content-area` 或 viewer 内二选一
   - 建议：`.content-area` 只做滚动容器（`padding: 0`），padding 由 viewer 内的 `.markdown-body` / `.code-viewer` / `.html-container` 各自负责（不同内容类型可以有不同 padding）

6. **DESIGN.md**：
   - §9 Responsive Behavior 补充「Scroll Architecture」小节：详情页 `.content-area` 是唯一纵向滚动容器，viewer 组件不声明 `overflow-y: auto / height: 100%`

### 风险

- CodeViewer 的 `flex: 1` + `min-height: 300px` 是为了让短代码文件也能撑满可视区——改为自然高度后，短代码文件可能只占一小块，视觉上空旷。需要评估是否可接受，或者用 `min-height: 100%` 而非固定 300px。
- HtmlViewer 的 iframe 高度依赖 `.html-frame-container` 的高度——如果 `.content-area` 的 padding 变了，iframe 高度可能需要调整。
- 现有测试 mock 了 `useResponsiveLayout`，改 `setupScrollHide` 签名不影响测试。但改 viewer 组件的 CSS 可能影响 snapshot 测试（如果有）。

## 约束

- 不改后端
- 不改 MCP server
- 不改数据库 schema
- 桌面端和移动端行为一致（都是 `.content-area` 滚动）
- 现有测试零回归
- DESIGN.md 补充滚动架构决策

## 四字段

```yaml
task: "统一详情页滚动架构：content-area 作为唯一滚动容器，viewer 组件不抢滚动，修复 scroll-hide / padding 叠加 / 锚点偏移三个连锁问题"
known_risks:
  - "CodeViewer 短代码文件改为自然高度后可能视觉空旷"
  - "HtmlViewer iframe 高度可能需调整"
  - "需要 DESIGN.md 补充滚动架构决策（设计缺口）"
  - "涉及 4 个组件 + 1 个 composable + 1 个 CSS 文件 + DESIGN.md"
executor_env:
  platform: "opencode"
  has_task_tool: true
  has_local_runtime: true
  network: "full"
env_constraints:
  debug_env: "make debug（:8888，/tmp/peekview-debug/）；make test-frontend（vitest）；make typecheck（vue-tsc）；make build-frontend"
```

## 验收标准（BDD 预览）

- Given 详情页有 markdown 内容，When 用户下滚动内容，Then meta-tags-bar 隐藏且内容上移补位
- Given meta-tags-bar 已隐藏，When 用户上滚动，Then meta-tags-bar 恢复显示
- Given 详情页有 markdown 内容，When 点击 TOC 标题锚点，Then 标题滚动到 sticky header 下方正确位置（不被遮挡）
- Given 详情页有代码内容，When 代码内容超出视口高度，Then .content-area 滚动（不是 .code-body 自己滚）
- Given 移动端详情页，When 查看 markdown 内容宽度，Then 只有一层 padding（不叠加）
- Given 桌面端详情页，When 查看任何类型内容，Then 滚动行为与移动端一致（content-area 滚动）
- Given 现有测试，When make test-frontend + make typecheck，Then 全部通过

## 关联

- DESIGN.md §9 Responsive Behavior（需补充 Scroll Architecture）
- T082 拆分的 EntryDetailContent.vue / useResponsiveLayout.ts
- T079 的 EntryDetailHeader.vue meta-tags-bar
