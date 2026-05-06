# P1: Mermaid UX 优化设计文档

## 问题汇总

| # | 问题 | 优先级 | 解决方案 |
|---|------|--------|----------|
| 1 | 固定高度导致所有图表被压缩 | P0 | 自适应高度：根据SVG自然高度显示 |
| 2 | Header缺少Fullscreen按钮 | P0 | 添加⛶按钮，调用组件toggleFullscreen |
| 3 | PNG下载使用屏幕截图，易被截断 | P1 | 从原始SVG数据获取完整尺寸 |
| 4 | 移动端4个按钮换行 | P1 | 使用图标按钮+下拉菜单 |
| 5 | Diagram/Code可合并 | P1 | 改为单个toggle按钮 |
| 6 | Code切回Diagram空白 | P0 | 修复渲染逻辑，避免重复挂载 |
| 7 | 需要高度拖动调整 | P2 | 添加resize handle，支持拖动调整 |

---

## 详细设计

### 1. 自适应高度

**CSS修改:**
```css
.mermaid-content.diagram-mode {
  /* 移除固定max-height */
  min-height: 200px;
  /* 高度由内部SVG自然决定 */
}

.mermaid-viewer-mount {
  width: 100%;
  /* 高度由SVG内容决定 */
  min-height: 200px;
}

.svg-container {
  /* 不使用flex居中导致的高度收缩 */
  display: block;
}

.svg-container :deep(svg) {
  /* 保持原始比例，但限制最大宽度 */
  max-width: 100%;
  height: auto;
  display: block;
  margin: 0 auto;
}
```

### 2. Header 按钮重新设计

**桌面端:**
```
[MERMAID]  [Diagram/Code Toggle]  [⛶ Fullscreen]  [⋯ Menu]
                                    └─ PNG Download
                                    └─ Copy Code
```

**移动端:**
```
[MERMAID]  [Toggle Icon]  [⛶]  [⋯]
                          └─ Fullscreen
                          └─ PNG
                          └─ Copy
```

### 3. PNG下载修复

从原始SVG的viewBox或计算完整边界:

```typescript
function getSvgDimensions(svgElement: SVGElement) {
  // 优先使用viewBox
  const viewBox = svgElement.getAttribute('viewBox')
  if (viewBox) {
    const [, , width, height] = viewBox.split(' ').map(Number)
    return { width, height }
  }

  // 其次使用width/height属性
  const width = parseFloat(svgElement.getAttribute('width') || '0')
  const height = parseFloat(svgElement.getAttribute('height') || '0')
  if (width && height) {
    return { width, height }
  }

  // 最后使用bounding box
  const bbox = svgElement.getBBox()
  return { width: bbox.width, height: bbox.height }
}
```

### 4. Code/Diagram切换修复

问题分析: 当前toggle只是改变display，但可能导致Vue组件重新渲染时丢失状态。

修复方案:
- 使用CSS visibility/display切换
- 确保mountPoint不被销毁
- 检查SVG在显示时的状态

### 5. Resize Handle 实现

```css
.mermaid-resize-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 20px;
  height: 20px;
  cursor: se-resize;
  background: linear-gradient(-45deg, transparent 40%, var(--border-color) 40%, var(--border-color) 45%, transparent 45%);
  z-index: 10;
}
```

---

## 文件修改清单

1. **useMarkdown.ts** - Header按钮结构修改
2. **MermaidDiagram.vue** - 自适应高度、fullscreen暴露、resize handle
3. **MarkdownViewer.vue** - toggle修复、PNG下载修复、样式更新

---

## 验收标准

- [ ] 不同大小的Mermaid图表显示为自然高度
- [ ] Header有全屏按钮，点击可弹出全屏
- [ ] PNG下载包含完整图表（不被截断）
- [ ] 移动端按钮不换行，使用下拉菜单
- [ ] Diagram/Code切换正常，不空白
- [ ] 可拖动调整图表区域高度
