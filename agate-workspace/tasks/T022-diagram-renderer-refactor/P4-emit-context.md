# P4 emit 迁移 dispatch-context — T022

## 改动概述
3 个文件协调改动，实现 data-action → Vue emit 迁移（P2 第 6 节）。

## 文件 1：useMarkdown.ts — block HTML 简化为占位容器

### 当前（完整 HTML 含 header+按钮+content）
mermaid block HTML 含完整结构（header/toggle/fullscreen/menu/content/resize-handle/code-mode）。

### 改为（占位容器）
block HTML 简化为：
```typescript
const blockHtml = `<div class="${classPrefix}-block" data-block-id="${blockId}" data-index="${block.index}" data-lang="${block.lang}"></div>`
```
**不再生成 header/按钮/content**——这些迁入 BaseDiagram template。
sourcesMap 仍存 code + codeViewHtml。

### 三族统一
mermaid/plantuml/svg 三族都用相同的占位容器结构（只是 classPrefix 不同）。
plantuml 无 resize-handle（由 BaseDiagram resizeEnabled=false 控制）。
svg code 视图异步 Shiki（codeViewHtml 初始空，preRender 填）。

## 文件 2：BaseDiagram.vue — template 加 header + content + resize

### 新 template 结构
```html
<template>
  <div :class="classPrefix + '-block'" :data-block-id="blockId" :data-index="blockIndex">
    <!-- header（从 useMarkdown HTML 迁入组件模板）-->
    <div :class="classPrefix + '-header'">
      <span :class="classPrefix + '-label'">{{ label }}</span>
      <div :class="classPrefix + '-header-actions'">
        <button :class="classPrefix + '-view-toggle'" @click="emit('toggle-view', blockId)" title="Toggle Diagram/Code">
          <span class="toggle-icon">◫</span>
          <span class="toggle-text" v-if="toggleTextUpdates">{{ isCodeView ? 'Code' : 'Diagram' }}</span>
        </button>
        <button :class="classPrefix + '-action-btn fullscreen-btn'" @click="emit('fullscreen', blockId)" title="Fullscreen">⧉</button>
        <div :class="classPrefix + '-dropdown'">
          <button :class="classPrefix + '-action-btn menu-btn'" @click="emit('toggle-menu', blockId)" title="More actions">⋯</button>
          <div :class="classPrefix + '-dropdown-menu'" v-if="menuOpen">
            <button @click="emit('download-png', blockId)">⬇ Download PNG</button>
            <button @click="emit('copy-code', blockId)">⧉ Copy Code</button>
          </div>
        </div>
      </div>
    </div>
    <!-- content -->
    <div :class="classPrefix + '-content diagram-mode'" :class="{ 'is-active': !isCodeView }" :data-mode="'diagram'">
      <div ref="containerRef" :class="classPrefix + '-viewer'" @wheel="onWheel">
        <div ref="svgContainer" :class="classPrefix + '-container'" v-html="svgContent"></div>
      </div>
      <div v-if="resizeEnabled" :class="classPrefix + '-resize-handle'" @mousedown="onResizeStart"></div>
    </div>
    <div :class="classPrefix + '-content code-mode'" :class="{ 'is-active': isCodeView }" :data-mode="'code'">
      <pre class="shiki"><code v-html="codeViewHtml"></code></pre>
    </div>
  </div>
  <!-- modal（已有，不变）-->
  <Teleport to="body">...</Teleport>
</template>
```

### 新增状态
```typescript
const isCodeView = ref(false)  // diagram/code 切换
const menuOpen = ref(false)    // 下拉菜单
```

### label prop
BaseDiagram 需要 `label` prop（'MERMAID'/'PLANTUML'/'SVG'）用于 header 显示。

## 文件 3：MarkdownViewer.vue — emit handler 替代 data-action

### 删除
- `handleDelegatedAction` 函数（L340-363）
- `handleDelegatedResize` 函数（L365-369）
- `addEventListener('click', handleDelegatedAction)` / `removeEventListener`
- 各分族的 toggle/copy/menu/download/fullscreen 函数（toggleMermaidView 等）

### 新增 emit handler
挂载薄包装时用 `onToggleView` / `onFullscreen` / `onCopyCode` / `onDownloadPng` / `onToggleMenu` / `onStartResize`：
```typescript
const vNode = h(MermaidDiagram, {
  blockIndex: index, blockId: `mermaid-block-${index}`,
  svgContent: svg, codeViewHtml: '', theme: ...,
  onToggleView: (blockId) => handleToggleView(blockId, 'mermaid'),
  onFullscreen: (blockId) => handleFullscreen(blockId, 'mermaid'),
  onCopyCode: (blockId) => handleCopyCode(blockId, 'mermaid'),
  onDownloadPng: (blockId) => handleDownloadPng(blockId, 'mermaid'),
  onToggleMenu: (blockId) => handleToggleMenu(blockId, 'mermaid'),
  onStartResize: (blockId, startY) => handleStartResize(blockId, startY, 'mermaid'),
})
```

### 统一 handler（按 classPrefix 分族差异）
```typescript
function handleToggleView(blockId, prefix) {
  const block = document.getElementById(blockId)
  if (!block) return
  const diagramMode = block.querySelector(`.${prefix}-content.diagram-mode`)
  const codeMode = block.querySelector(`.${prefix}-content.code-mode`)
  if (diagramMode && codeMode) {
    diagramMode.classList.toggle('is-active')
    codeMode.classList.toggle('is-active')
  }
  // 差异：mermaid/svg dispatch refresh + 更新 toggle-text；plantuml 不做
  // 但 toggle-text 在 BaseDiagram 内部（toggleTextUpdates prop 控制）
  // refresh 由 BaseDiagram dispatch（refreshOnToggle prop 控制）
}
```

## 行为保真要点
1. **toggle-text 差异**：mermaid/svg 的 toggle-text 在 "Diagram"↔"Code" 间切换；plantuml 不更新。由 BaseDiagram 的 `toggleTextUpdates` prop 控制。
2. **refresh 差异**：mermaid/svg toggle 后 dispatch refreshEventName；plantuml 不 dispatch。由 `refreshOnToggle` prop 控制。
3. **copy 反馈差异**：mermaid/svg 显示 "✓ Copied" 2s；plantuml 仅 console.log。由 `copyFeedback` prop 控制。
4. **menu 差异**：mermaid/svg 关闭其他同族菜单 + click-outside；plantuml 不做。由 `menuClickOutside`/`menuCloseOthers` prop 控制。
5. **resize 差异**：mermaid/svg 有 resize-handle；plantuml 无。由 `resizeEnabled` prop 控制。

## SvgBlock.spec.ts 影响
P1 L128 已标注：`SvgBlock.spec.ts L139` 断言 `[data-action="toggle-svg-view"]` 将失效。需同步更新为断言 `.svg-view-toggle` class + click。
