# P2: Mermaid UX Bug Fix Design

## 问题分析

### 问题1: SVG未铺满区域
**根本原因:**
- `.mermaid-content.diagram-mode` 没有明确高度设置
- `.mermaid-viewer-mount` 高度未定义
- Vue组件渲染后，父容器高度由内容决定，但svg-pan-zoom需要明确尺寸

**修复方案:**
```css
.mermaid-content.diagram-mode {
  height: 400px; /* 默认高度 */
  overflow: hidden;
}

.mermaid-viewer-mount {
  height: 100%;
  width: 100%;
}
```

### 问题2: Diagram/Code切换后内容消失
**根本原因:**
- 使用 `display: none` 切换会导致svg-pan-zoom实例失效
- 当重新显示时，SVG尺寸计算为0，因为容器是隐藏的

**修复方案:**
- 切换时调用 `panZoomInstance.resize()` 和 `fit()`
- 或者使用 `visibility: hidden` + 绝对定位代替 `display: none`

### 问题3: Fullscreen弹窗中图表小
**根本原因:**
- `.mermaid-modal-container` 使用flex居中
- 但 `.svg-wrapper` 的SVG有 `max-height: 100%`，而实际SVG高度由其自身决定

**修复方案:**
- 确保modal中的SVG使用 `fit: true` 初始化
- 容器需要明确尺寸

---

## 实现计划

### 1. CSS修复 (MarkdownViewer.vue)

```css
.mermaid-content.diagram-mode {
  height: 400px; /* 默认高度，可拖动调整 */
  min-height: 200px;
  overflow: hidden;
  position: relative;
}

.mermaid-viewer-mount {
  height: 100%;
  width: 100%;
}
```

### 2. Toggle修复 (MarkdownViewer.vue)

```typescript
// 在toggleMermaidView函数中
if (!isCurrentlyDiagram) {
  // Switch to diagram
  diagramMode.style.display = ''
  codeMode.style.display = 'none'
  
  // Trigger resize after display change
  requestAnimationFrame(() => {
    const instance = mermaidInstances.get(blockId)
    if (instance) {
      instance.resize()
      instance.fit()
      instance.center()
    }
  })
}
```

### 3. MermaidDiagram组件修复

```css
.svg-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.svg-container :deep(svg) {
  max-width: 100%;
  max-height: 100%;
}
```

### 4. 初始化时确保尺寸

```typescript
// 在initPanZoom中
await nextTick()
// 确保SVG有尺寸
const svg = svgContainer.value.querySelector('svg')
if (svg) {
  // Force layout recalculation
  svgContainer.value.style.height = '100%'
}
```

---

## 验收标准

- [ ] SVG填满整个.mermaid-content.diagram-mode区域
- [ ] Code切换到Diagram后正常显示图表
- [ ] Fullscreen弹窗中SVG填满modal-container
- [ ] 高度拖动调整仍然有效
- [ ] Pan-zoom功能正常工作
