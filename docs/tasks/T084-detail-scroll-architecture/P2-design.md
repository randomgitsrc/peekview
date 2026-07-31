---
phase: P2
task_id: T084-detail-scroll-architecture
type: design
parent: P1-requirements.md
trace_id: T084-P2-20260731
status: revised
created: 2026-07-31
agent: architect
---

# P2 方案设计 — T084 详情页滚动架构统一

## 影响域分析

### 改什么

| 文件 | 改动 | 原因 |
|------|------|------|
| `frontend-v3/src/components/MarkdownViewer.vue` L125-127 | `.markdown-viewer` 从 `height: 100%; overflow: auto` → 移除这两个属性 | 抢走了 `.content-area` 的纵向滚动 |
| `frontend-v3/src/components/MarkdownViewer.vue` L130-131 | `.markdown-body` scoped padding 从 `2rem` → 移除（保留 `max-width: 900px; margin: 0 auto`） | 避免双层 padding；padding 归属到 `.content-area` |
| `frontend-v3/src/styles/markdown.css` L2 | `.markdown-body` 全局 padding 从 `var(--space-5)` → 移除 | padding 归属到 `.content-area`，避免 scoped 移除后全局声明意外生效 |
| `frontend-v3/src/styles/markdown.css` L3 | 移动端 `.markdown-body` padding 从 `1.25rem` → 移除 | 同上 |
| `frontend-v3/src/styles/code.css` L47-51 | `.code-body` 从 `overflow: auto; flex: 1; min-height: 0` → `overflow-x: auto` | 抢走了纵向滚动；保留横向滚动（IR-2） |
| `frontend-v3/src/styles/code.css` L9-10 | `.code-viewer` 移除 `min-height: 300px; flex: 1` | `flex: 1` 在 `.content-area`（block 容器）中无效；`min-height: 300px` 改为自然高度（IR-5） |
| `frontend-v3/src/styles/code.css` L14-18 | 移动端 `.code-viewer { min-height: 0 }` → 移除 | 随 `min-height: 300px` 一起移除 |
| `frontend-v3/src/composables/useResponsiveLayout.ts` L26-58 | `setupScrollHide` 简化：移除 `findScrollable`，直接监听传入 container 的 scroll 事件 | `.content-area` 是唯一滚动容器，不需要查找子元素（IR-6） |
| `frontend-v3/e2e/t049-mobile-header-diagram-sanitize.spec.ts` L56-89 | A-BDD-3/4: `window.scrollTo` → `.content-area` scrollTop；`.header-tags` → `.meta-tags-bar` | 滚动容器改为 `.content-area` + 选择器过时（IR-3） |
| `frontend-v3/e2e/t049-mobile-header-diagram-sanitize.spec.ts` L107-119 | A-BDD-5: 同上修正 | 同上 |
| `DESIGN.md` §9 L267 后 | 新增「Scroll Architecture」小节 | 显式声明滚动架构决策（IR-8，设计缺口修复） |

### 不改什么

| 文件/组件 | 不改原因 |
|-----------|----------|
| `HtmlViewer.vue` | `height: 100%; overflow: hidden` 不抢滚动，iframe 内部滚动由 sandbox 隔离（IR-1） |
| `ImageViewer.vue` | `height: 100%; overflow: hidden` 不抢滚动，image-zoomed 的 `overflow: auto` 是放大查看内部滚动（IR-1） |
| `DiagramBlock` 及子渲染器 | `overflow: hidden; height: 400px` 固定高度，不依赖 content-area（IR-1 覆盖性声明） |
| `EntryDetailHeader.vue` | meta-tags-bar 的 `v-if="isMobile"` 和 `.hidden` class 逻辑不变 |
| `TocNav.vue` | `scrollIntoView` 调用不变，浏览器自动找最近可滚动祖先（改后是 `.content-area`） |
| `EntryDetailView.vue` | `setupScrollHide` 调用点（L195-196）不变，composable 内部逻辑简化 |
| `EntryDetailContent.vue` `.content-area` padding | 保留 `var(--space-4)` 作为唯一 padding 层（移动端 `var(--space-3) var(--space-2)` 保留） |
| `.code-viewer` `overflow: hidden` | 保留——圆角裁剪用途（`border-radius: var(--radius-md)` 需要 `overflow: hidden` 裁剪子元素溢出）。仅移除 `min-height: 300px; flex: 1`，`overflow: hidden` 不动 |
| `.code-viewer` `display: flex; flex-direction: column` | 保留——code-header + code-body 的纵向布局需要。仅 `.code-body` 不再需要 `flex: 1; min-height: 0` |
| `.code-loading` / `.code-skeleton` | 不改——loading 态由 `.code-loading`（padding: var(--space-4)）+ `.code-skeleton`（含 `.skeleton-line-content { height: 14px }` 等固定高度子元素）撑开，移除 `min-height: 300px` 后不会塌陷为 0（见 §3 loading 态分析） |
| `.error-state` / `.empty-state` | 不改——EntryDetailContent.vue 的 `.error-state`（padding: var(--space-7)）和 `.empty-state`（padding: var(--space-7)）不在本次 CSS 改动范围，滚动架构改动不影响这两态的渲染 |
| 后端 / MCP / DB | 纯前端 CSS + composable 改动 |

### 风险在哪

1. **CodeViewer 短代码视觉空旷**（IR-5）：移除 `min-height: 300px` 后短代码文件只占一小块。P1 已决定 BDD 不覆盖主观空旷。`flex: 1` 在 block 容器中本就无效，移除无功能影响。
2. **markdown.css 全局 padding 移除安全**：已确认 `.markdown-body` class 只在 `MarkdownViewer.vue` 中使用（grep 全项目），无其他页面使用该 class，移除全局 padding 安全。
3. **`overflow-x: auto` 在 `.code-body` 上的行为**：`.code-body` 当前是 `display: flex` 的子元素（`.code-viewer` 是 flex container），移除 `flex: 1; min-height: 0` 后 `.code-body` 不再是 flex item 的伸缩行为——但 `.code-viewer` 本身从 flex 变为 block（移除 `display: flex` 后），实际上 `.code-viewer` 的 `display: flex; flex-direction: column` 需要保留（code-header + code-body 的布局），只是 `.code-body` 不需要 `flex: 1` 了。

## §1 候选方案

### 方案 A：content-area 统一 padding + viewer 不抢滚动（推荐）

**核心思路**：`.content-area` 保留 padding 作为唯一 padding 层，所有 viewer 移除 `overflow-y: auto / height: 100%`（HtmlViewer/ImageViewer 例外保留 `height: 100%`），MarkdownViewer 和 CodeViewer 改为自然高度。

**具体改动**：

1. **MarkdownViewer.vue** scoped style（L124-134）：
   ```css
   /* 改前 */
   .markdown-viewer { height: 100%; overflow: auto; }
   .markdown-body { padding: 2rem; max-width: 900px; margin: 0 auto; }
   
   /* 改后 */
   .markdown-viewer { }  /* 移除 height + overflow */
   .markdown-body { max-width: 900px; margin: 0 auto; }  /* 移除 padding */
   ```

2. **markdown.css**（L2-3）：
   ```css
   /* 改前 */
   .markdown-body { line-height: 1.7; color: var(--text-primary); max-width: none; padding: var(--space-5); }
   @media (max-width: 640px) { .markdown-body { padding: 1.25rem; } }
   
   /* 改后 */
   .markdown-body { line-height: 1.7; color: var(--text-primary); max-width: none; }
   /* 移动端媒体查询移除 */
   ```

3. **code.css**（L2-11, L47-51, L14-18）：
   ```css
   /* 改前 */
   .code-viewer { border: 1px solid var(--border-color); border-radius: var(--radius-md); overflow: hidden; background: var(--bg-code); display: flex; flex-direction: column; min-height: 300px; flex: 1; }
   @media (max-width: 1023px) { .code-viewer { min-height: 0; } }
   .code-body { overflow: auto; flex: 1; min-height: 0; }
   
   /* 改后 */
   .code-viewer { border: 1px solid var(--border-color); border-radius: var(--radius-md); overflow: hidden; background: var(--bg-code); display: flex; flex-direction: column; }
   /* 移动端媒体查询移除 */
   .code-body { overflow-x: auto; }
   ```
   注意：`.code-viewer` 保留 `display: flex; flex-direction: column`（code-header + code-body 布局需要），`.code-body` 不再需要 `flex: 1; min-height: 0`（自然高度）。

4. **useResponsiveLayout.ts** setupScrollHide 简化（L26-58）：
   ```typescript
   /* 改前 */
   function setupScrollHide(container: HTMLElement): () => void {
     const findScrollable = (parent: Element): HTMLElement | null => { ... }
     let scrollContainer: HTMLElement | null = findScrollable(container)
     if (!scrollContainer) { scrollContainer = container as HTMLElement }
     let lastScrollTop = 0
     const onScroll = () => { ... scrollContainer?.scrollTop ... }
     scrollContainer.addEventListener('scroll', onScroll, { passive: true })
     return () => { scrollContainer?.removeEventListener('scroll', onScroll); ... }
   }
   
   /* 改后 */
   function setupScrollHide(container: HTMLElement): () => void {
     let lastScrollTop = 0
     const onScroll = () => {
       const current = container.scrollTop
       if (current > lastScrollTop && current > 10) {
         metaTagsHidden.value = true
       } else if (current < lastScrollTop) {
         metaTagsHidden.value = false
       }
       lastScrollTop = current
     }
     container.addEventListener('scroll', onScroll, { passive: true })
     return () => {
       container.removeEventListener('scroll', onScroll)
       if (resizeTimer) cancelAnimationFrame(resizeTimer)
     }
   }
   ```

5. **t049 E2E 测试**：修正选择器和滚动方式
6. **DESIGN.md §9**：新增 Scroll Architecture 小节

**优点**：
- padding 只有一层（content-area），解决双层叠加问题
- viewer 不抢滚动，`.content-area` 的 scroll 事件正确触发，scroll-hide 修复
- `scrollIntoView` 的最近可滚动祖先变为 `.content-area`，`scroll-margin-top: 80px` 参考系正确，锚点偏移修复
- 改动最小化——只移除多余的 CSS 声明，不新增复杂逻辑
- 不同 viewer 的 padding 需求由 `.content-area` 统一承担

**风险**：
- 短代码文件视觉空旷（可接受，P1 已决定不覆盖）
- `overflow-x: auto` 在 `.code-body` 上需验证横向滚动正常（`.code-body :deep(pre)` 已有 `overflow-x: auto`，但 `.code-body` 本身的 `overflow-x: auto` 是额外保障）

**工作量**：小（CSS 属性移除 + composable 简化，约 30 行净改动）

### 方案 B：viewer 自行负责 padding + content-area padding:0

**核心思路**：`.content-area` padding 设为 0，每个 viewer 自行管理 padding。MarkdownViewer 的 `.markdown-body` 保留 padding，CodeViewer 新增 padding，HtmlViewer/ImageViewer 不加 padding。

**具体改动**：
- `.content-area`：`padding: 0`（桌面端和移动端都移除）
- `.markdown-viewer` scoped：移除 `height: 100%; overflow: auto`
- `.markdown-body` scoped：保留 `padding: 2rem`，但需同步处理 markdown.css 全局 padding（要么移除全局、要么确保 scoped 覆盖）
- `.code-viewer`：新增 `padding: var(--space-4)`（当前没有 padding）
- `.code-body`：同方案 A
- `useResponsiveLayout`：同方案 A

**优点**：
- 不同内容类型可以有不同 padding（灵活性更高）
- P0 原始建议

**风险**：
- 改动更多——需要为 CodeViewer 新增 padding，需要处理 markdown.css 全局/scoped padding 的覆盖关系
- 不同 viewer 不同 padding 可能导致切换文件时内容区宽度跳变
- markdown.css 全局 padding 和 scoped padding 的优先级关系复杂

**工作量**：中（约 50 行净改动）

### 选择理由

选 **方案 A**：
1. **改动最小化**：方案 A 只移除多余的 CSS 声明，方案 B 需要新增 CodeViewer padding 并处理更复杂的 scoped/全局覆盖关系
2. **padding 一致性**：方案 A 所有内容类型统一用 `.content-area` 的 padding，视觉一致性更好；方案 B 不同 viewer 不同 padding 可能导致切换文件时内容区宽度跳变
3. **markdown.css 处理更简单**：方案 A 直接移除全局和 scoped 的 padding（都归到 content-area），方案 B 需要保留 scoped padding 并确保覆盖全局
4. `max-width: 900px; margin: 0 auto` 的居中效果不受影响——居中参考的是 `.content-area` 的 content-box（含 padding），`.markdown-body` 在 padding 内部居中

## §2 padding 归属决策（IR-4 详细分析）

> **[SCOPE+] BDD-08 修订一致性确认**：P2 首轮评审发现原 BDD-08（要求 `.content-area` paddingTop=0px、padding 由 `.markdown-body` 承担）与方案 A（`.content-area` 保留 padding、`.markdown-body` 移除 padding）硬冲突。主 Agent 已走 [SCOPE+] 修订 BDD-08（见 P1-requirements.md L134 修订说明），现在 BDD-08 要求 `.markdown-body` paddingTop=0px，padding 由 `.content-area` 单层承担。**方案 A 与修订后 BDD-08 完全一致**——方案 A 保留 `.content-area` 的 `var(--space-4)` padding，移除 `.markdown-body` 的 scoped + 全局 padding。本节 padding 分析已与修订后 BDD-08 对齐。

### 当前 padding 层级

```
.content-area          padding: var(--space-4) = 16px（移动端 12px 8px）
  .markdown-body scoped  padding: 2rem = 32px（因 data-attribute 优先级高于全局）
  .markdown-body 全局    padding: var(--space-5) = 20px（被 scoped 覆盖，不生效）
  .markdown-body 移动端  padding: 1.25rem = 20px（被 scoped 覆盖，不生效）
```

移动端实际双层 padding：8px（content-area 水平）+ 32px（markdown-body scoped）= 40px

### 方案 A 改后

```
.content-area          padding: var(--space-4) = 16px（移动端 12px 8px）← 唯一 padding
  .markdown-body       padding: 0（scoped 和全局都移除）
```

移动端实际 padding：8px（content-area 水平），从 40px 降到 8px，内容宽度增加 32px。

### markdown.css 全局 padding 移除安全分析

已确认 `.markdown-body` class 只在 `MarkdownViewer.vue` L4 使用（grep 全项目 `.vue` 文件），无其他组件使用该 class。移除 `markdown.css` L2-3 的全局 padding 安全，不会影响其他页面。

## §3 CodeViewer 改动细节（IR-2 + IR-5）

### 当前结构

```
.code-viewer (display:flex; flex-direction:column; min-height:300px; flex:1; overflow:hidden)
  .code-loading (v-if loading)
  .code-body (overflow:auto; flex:1; min-height:0; v-html=highlightedCode)
```

### 改后结构

```
.code-viewer (display:flex; flex-direction:column; overflow:hidden)  ← 移除 min-height + flex；overflow:hidden 保留（圆角裁剪）
  .code-loading (v-if loading)
  .code-body (overflow-x:auto)  ← 移除 overflow-y + flex + min-height
```

### 横向滚动保留分析（IR-2）

- `.code-body` 改为 `overflow-x: auto`（不含 `overflow-y`）
- `.code-body :deep(pre)` L81-90 已有 `overflow-x: auto`，是代码行横向滚动的主要承载
- `.code-body` 的 `overflow-x: auto` 是额外保障（如果 code-container 宽度超出 code-body）
- 改后横向滚动路径：`.code-body`（overflow-x:auto）→ `.code-body :deep(pre)`（overflow-x:auto），双层保障不丢失

### 短代码视觉空旷分析（IR-5）

- 移除 `min-height: 300px` 后短代码文件只占自然高度
- `flex: 1` 在 `.content-area`（block 容器）中本就无效，移除无功能影响
- P1 已决定 BDD 不覆盖主观空旷，仅覆盖功能正确性
- 可接受：短代码文件下方留白，不影响功能

### loading 态高度行为分析（评审 MAJOR #3）

移除 `min-height: 300px` 后 loading 态 `.code-viewer` 的高度行为：

- `.code-loading`（code.css L149-151）：`padding: var(--space-4)` = 16px，无固定高度
- `.code-skeleton`（L153-157）：`display: flex; gap: var(--space-3)`，含 `.skeleton-line-number`（height: 14px）和 `.skeleton-line-content`（height: 14px）——子元素有固定 14px 高度
- **结论**：loading 态 `.code-viewer` 不会塌陷为 0。`.code-loading` 的 padding（16px×2=32px）+ skeleton 行高（14px）≈ 46px，加上 `.code-header` 高度约 40px，总计约 86px。比改前（min-height: 300px）矮，但仍有可视反馈（skeleton 动画 + header）。Shiki 高亮通常在数百毫秒内完成，loading 态持续时间短，86px 可视高度可接受。
- **移动端**：移动端视口高度更小（如 640px），86px loading 占比约 13%（改前 300px 占 47%），视觉变化更明显但仍可接受——loading 是短暂过渡态，非最终渲染态。

### 移动端短代码视觉影响评估（评审 MAJOR #4）

移动端视口高度通常 640px-900px，移除 `min-height: 300px` 后：

- **短代码文件**（如 5 行代码）：改前 `min-height: 300px` 在 640px 视口占 47%，改后自然高度约 120px（5行×1.6em×16px + padding）占 19%。视觉占比变化更大（桌面端 1080p 视口从 28% 降到 11%，移动端从 47% 降到 19%）。
- **可接受理由**：(1) P1 已决定 BDD 不覆盖主观空旷；(2) 移动端短代码文件下方留白不影响功能正确性；(3) `min-height: 300px` 在移动端本就被 `@media (max-width: 1023px) { min-height: 0 }` 覆盖为 0（code.css L14-18），即移动端当前已经是自然高度——移除 `min-height: 300px` + 移动端媒体查询对移动端**无实际行为变化**（移动端早已是 `min-height: 0`）。
- **关键发现**：移动端 `.code-viewer` 当前已是 `min-height: 0`（L14-18 媒体查询覆盖），所以本次改动对移动端短代码视觉**无影响**。影响仅在桌面端。

## §4 useResponsiveLayout setupScrollHide 简化（IR-6）

### 时序分析

`EntryDetailView.vue` onMounted（L181-197）：
1. `await entryDetailStore.loadEntry()` — 加载数据
2. `await nextTick()` — 等 DOM 更新
3. `const content = document.querySelector('.content-area')` — 获取容器
4. `setupScrollHide(content)` — 绑定 scroll 事件

**当前问题**：`findScrollable` 在步骤 4 时遍历 `.content-area` 子元素找 `scrollHeight > clientHeight` 的，但 Shiki/Mermaid 异步渲染未完成，子元素 `scrollHeight <= clientHeight`，fallback 到 `.content-area`——但 `.content-area` 不滚动（子元素抢了），scroll 事件不触发。

**改后**：直接监听 `.content-area` 的 scroll 事件。不需要等内容渲染完成——因为 `.content-area` 是唯一滚动容器，内容渲染完成后自然会有 scroll 事件。时序问题自然解决。

### 简化后逻辑

```typescript
function setupScrollHide(container: HTMLElement): () => void {
  let lastScrollTop = 0
  const onScroll = () => {
    const current = container.scrollTop
    if (current > lastScrollTop && current > 10) {
      metaTagsHidden.value = true
    } else if (current < lastScrollTop) {
      metaTagsHidden.value = false
    }
    lastScrollTop = current
  }
  container.addEventListener('scroll', onScroll, { passive: true })
  return () => {
    container.removeEventListener('scroll', onScroll)
    if (resizeTimer) cancelAnimationFrame(resizeTimer)
  }
}
```

- 移除 `findScrollable` 函数（L27-37）
- 移除 `scrollContainer` 变量和 fallback 逻辑（L39-42）
- `onScroll` 中 `scrollContainer?.scrollTop` → `container.scrollTop`
- `addEventListener` 和 `removeEventListener` 直接用 `container`

## §5 TOC 锚点跳转修复原理（IR-7）

### 当前问题

`scrollIntoView({ behavior: 'smooth', block: 'start' })` 的滚动容器由浏览器自动向上查找最近的 `overflow: auto/scroll` 祖先。

当前：最近可滚动祖先是 `.markdown-viewer`（`overflow: auto`）→ 在 `.markdown-viewer` 内滚动 → `scroll-margin-top: 80px` 参考的是 `.markdown-viewer` 的顶部，但 sticky header 在 `.markdown-viewer` 外部 → 锚点跳转后标题被遮挡。

### 改后修复

改后：`.markdown-viewer` 不再 `overflow: auto` → 最近可滚动祖先是 `.content-area`（`overflow-y: auto`）→ `scroll-margin-top: 80px` 参考的是 `.content-area` 的顶部 → sticky header 高度正好 80px → 标题不被遮挡。

`scroll-margin-top: 80px` 声明在两处：
- `markdown.css` L4：`.markdown-body h1, h2, h3 { scroll-margin-top: 80px; }`
- `MarkdownViewer.vue` L141-143：`.markdown-body :is(h1..h6) { scroll-margin-top: 80px; }`

两处都不需要改动——参考系自动正确。

### footnote 跳转

MarkdownViewer L85：`targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' })` 同理受益。

## §6 可访问性声明（评审 MAJOR #5/#6 + MINOR #9/#11）

本次改动是纯 CSS 属性移除 + composable 简化，不新增交互逻辑。以下声明覆盖评审提出的可访问性关切：

### `.content-area` 键盘可聚焦性

- **现状**：`.content-area`（EntryDetailContent.vue L160）有 `outline: none` 但**无 `tabindex`**。它是普通 `div`，键盘用户无法通过 Tab 聚焦到它，也无法用方向键滚动。
- **本次改动**：不修改 `.content-area` 的 tabindex。添加 `tabindex` 是独立的无障碍增强，不在本 task（滚动架构统一）范围内。
- **影响**：滚动架构改动不改变键盘可聚焦性——改前改后键盘用户都无法直接聚焦 `.content-area`。页面滚动仍可通过 PageUp/PageDown（滚动 window）或聚焦内容中的可交互元素后用方向键导航。
- **声明**：不在本 task 范围内添加 `tabindex`。如未来需要无障碍增强，另开 task。

### meta-tags-bar 隐藏方式及焦点路径影响

- **现状**：`metaTagsHidden` 通过 CSS class `.hidden` 控制（EntryDetailHeader.vue L180）：
  ```css
  .meta-tags-bar.hidden { max-height: 0; padding: 0; overflow: hidden; border-bottom: none; opacity: 0; }
  ```
  即 `max-height: 0 + opacity: 0 + overflow: hidden + padding: 0`，**不是 `display: none`**。
- **焦点路径影响**：`.meta-tags-bar` 内含可交互元素（`<router-link>` owner-link、`<BaseTag>` 标签链接）。隐藏时这些元素仍在 DOM 中且理论上可聚焦（`display: none` 才会移出 tab 序列），但 `max-height: 0; overflow: hidden` 使它们不可见且不可点击。键盘用户 Tab 到这些元素时会遇到"不可见焦点"问题。
- **本次改动**：不修改隐藏方式。`metaTagsHidden` 的 CSS 逻辑（`.hidden` class）不在改动范围——本次只改 `setupScrollHide` 的**触发机制**（从 `findScrollable` 改为直接监听 `.content-area`），不改隐藏的 CSS 实现。
- **声明**：隐藏方式保留现状（`max-height: 0 + opacity: 0`）。不可见焦点问题是既有设计（T079 引入），不在本 task 范围。如需修复，应改用 `display: none` 或 `visibility: hidden` + `aria-hidden`，另开 task。

### 屏幕阅读器体验

- **scroll-hide 状态变化**：meta-tags-bar 隐藏/恢复不触发 `aria-live` 通知。这是合理的——视觉滚动导致的 UI 变化不应打断屏幕阅读器朗读。**声明：不新增 aria-live 通知**。
- **锚点跳转**：`scrollIntoView({ behavior: 'smooth', block: 'start' })` 不触发屏幕阅读器朗读跳转目标。这是浏览器默认行为，本次改动不涉及。如需增强，应在跳转目标上添加 `tabindex="-1"` + `focus()`，另开 task。

### `prefers-reduced-motion`

- **现状**：`scrollIntoView({ behavior: 'smooth' })` 和 `.meta-tags-bar` 的 `transition: opacity var(--transition-fast)` 不检查 `prefers-reduced-motion`。
- **本次改动**：不修改 motion 相关逻辑。`prefers-reduced-motion` 处理是独立的无障碍增强，不在本 task 范围。
- **声明**：不在本 task 范围内添加 `prefers-reduced-motion` 处理。

## §7 DESIGN.md 补充内容（IR-8）

在 `DESIGN.md` §9 Responsive Behavior 的 Rules 列表后（L267 后）新增：

```markdown
### Scroll Architecture

- Detail page `.content-area` is the **sole vertical scroll container**.
- Viewer components (MarkdownViewer, CodeViewer) must **not** declare `overflow-y: auto` or `height: 100%` — content flows naturally and `.content-area` handles scrolling.
- CodeViewer retains `overflow-x: auto` for horizontal code scrolling.
- HtmlViewer and ImageViewer are exceptions: they use `height: 100%; overflow: hidden` to fill `.content-area` without stealing scroll (iframe/image internal scroll is isolated).
- `scroll-margin-top: 80px` on headings is calibrated for `.content-area` as the scroll container (matches sticky header height).
- Scroll-hide behavior (`useResponsiveLayout.setupScrollHide`) binds directly to `.content-area`'s scroll event — no child element traversal needed.
```

## §8 t049 E2E 测试修正（IR-3）

### 当前问题

| 测试 | 问题 1 | 问题 2 |
|------|--------|--------|
| A-BDD-3 (L56-70) | `window.scrollTo(0, 100)` 不会触发 `.content-area` 的 scroll 事件 | `.header-tags` 选择器过时（T079 后改为 `.meta-tags-bar`） |
| A-BDD-4 (L72-89) | `window.scrollTo(0, 100)` / `window.scrollTo(0, 0)` 同上 | `.header-tags` 同上 |
| A-BDD-5 (L107-119) | `window.scrollTo(0, 200)` 同上 | `.header-tags` 同上 |

### 修正方案

```typescript
// A-BDD-3 修正
// 改前：await page.evaluate(() => window.scrollTo(0, 100))
// 改后：
await page.evaluate(() => {
  const ca = document.querySelector('.content-area') as HTMLElement
  if (ca) ca.scrollTop = 100
})
// 改前：const headerTags = page.locator('.header-tags')
// 改后：
const metaTagsBar = page.locator('.meta-tags-bar')
```

A-BDD-4 和 A-BDD-5 同理修正。

## 实现完成的标志

1. `.markdown-viewer` 不再有 `height: 100%; overflow: auto` — grep 确认
2. `.code-body` 不再有 `overflow: auto`（改为 `overflow-x: auto`） — grep 确认
3. `.content-area` 的 `scrollTop` 在内容超出时可变化（BDD-01/02）
4. `.markdown-viewer` 和 `.code-body` 的 `scrollTop` 保持 0（BDD-01/02）
5. 移动端 `.markdown-body` computed `paddingTop` 为 `0px`，padding 由 `.content-area` 单层承担（BDD-08，[SCOPE+] 修订后）
6. `useResponsiveLayout.setupScrollHide` 不含 `findScrollable` 函数 — grep 确认
7. `make test-frontend` 全绿（BDD-11）
8. `make typecheck` 零错误（BDD-12）
9. `make build-frontend` 成功（BDD-13）
10. DESIGN.md §9 包含「Scroll Architecture」小节（BDD-14）

## 声明字段

```yaml
packages:
  - frontend-v3
domains:
  - frontend
ui_affected: true
ui_interaction_points:
  - "移动端 .content-area 向下滚动 → meta-tags-bar 隐藏（BDD-04）"
  - "移动端 .content-area 向上滚动 → meta-tags-bar 恢复（BDD-05）"
  - "点击 TOC 标题 → 锚点跳转到正确位置不被遮挡（BDD-07）"
  - "代码内容横向滚动仍可用（BDD-03）"
  - "HtmlViewer iframe 撑满 content-area（BDD-09）"
  - "ImageViewer 图片正确显示（BDD-10）"

gate_commands:
  P3: "cd frontend-v3 && npx vitest run --reporter=dot"
  P3_formatter: "vitest"
  P5: "cd frontend-v3 && npx vitest run --reporter=dot"
  P5_formatter: "vitest"
  P5_typecheck: "cd frontend-v3 && npx vue-tsc --noEmit"
  P5_build: "cd frontend-v3 && npm run build"
  P5_e2e: "cd frontend-v3 && npx playwright test --reporter=line e2e/t049-mobile-header-diagram-sanitize.spec.ts"
  project_module: "src/"

env_constraints:
  debug_env: "make debug（:8888，/tmp/peekview-debug/）；make debug-seed 灌入测试数据"
  isolation_check: "sqlite3 /tmp/peekview-debug/peekview.db 'SELECT COUNT(*) FROM entries' 确认使用 debug 数据库"
  prod_not_touched: "[PROD_NOT_TOUCHED]"

files_to_read:
  - path: frontend-v3/src/components/MarkdownViewer.vue
    why: L124-134 scoped style 需移除 height:100% + overflow:auto + padding:2rem
  - path: frontend-v3/src/styles/markdown.css
    why: L2-3 全局 padding 需移除（与 scoped 同步处理）
  - path: frontend-v3/src/styles/code.css
    why: L2-51 .code-viewer 和 .code-body 的 overflow/flex/min-height 改动
  - path: frontend-v3/src/composables/useResponsiveLayout.ts
    why: L26-58 setupScrollHide 简化（移除 findScrollable）
  - path: frontend-v3/src/components/EntryDetailContent.vue
    why: L160-161 .content-area padding 保留确认（不改）
  - path: frontend-v3/src/components/CodeViewer.vue
    why: L121-123 确认 @import code.css 引用关系
  - path: frontend-v3/src/components/HtmlViewer.vue
    why: L189-194 确认 height:100% 不变（不改，仅参考）
  - path: frontend-v3/src/components/ImageViewer.vue
    why: L156-161 确认 height:100% 不变（不改，仅参考）
  - path: frontend-v3/src/views/EntryDetailView.vue
    why: L195-196 setupScrollHide 调用点确认（不改，仅参考）
  - path: frontend-v3/e2e/t049-mobile-header-diagram-sanitize.spec.ts
    why: L56-89, L107-119 修正 window.scrollTo → .content-area scrollTop + 选择器
  - path: DESIGN.md
    why: §9 L267 后新增 Scroll Architecture 小节

minimal_validation:
  assumption: "子元素声明 overflow:auto + height:100% 时会成为独立 scroll container，子元素内部滚动不触发父元素 scroll 事件"
  method: "创建 10 行 HTML 测试页（/tmp/opencode/t084-scroll-test.html），通过 Playwright CDP 验证子元素抢走滚动 + 移除后父元素恢复滚动"
  result: "confirmed"
  note: "CDP 连接超时（Chrome 在线但 WebSocket 连接不稳定），降级为 CSS 规范分析确认。CSS Overflow Module Level 3 §3.1 规定 overflow 值不为 visible 的元素成为 scroll container，子元素内部滚动不触发父元素 scroll 事件（scroll 事件只在元素自身 scrollTop 变化时触发）。这是 CSS 标准行为，不是浏览器特定实现。P6 验收时需在真实浏览器中确认。"
  css_spec_reference: "CSS Overflow Module Level 3 §3.1 — https://www.w3.org/TR/css-overflow-3/#scroll-container"
```
