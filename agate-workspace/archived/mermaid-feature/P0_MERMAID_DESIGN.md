# P0: Mermaid 优化设计文档

## 现状分析

### 当前结构问题

```
.markdown-body
└── .code-block-wrapper.mermaid-wrapper
    ├── .code-block-header (MERMAID + Diagram/Code toggle + Copy)
    ├── .mermaid-view.diagram-view (包含原始 <pre><code>)
    │   └── Vue MermaidDiagram 组件挂载替换
    │       ├── .mermaid-toolbar (嵌套层级 1)
    │       ├── .mermaid-container (嵌套层级 2)
    │       │   └── .svg-wrapper (嵌套层级 3)
    │       └── .mermaid-modal (全屏)
    └── .mermaid-view.code-view
```

**问题：**
1. 4 层嵌套导致实际可视区域很小
2. svg-pan-zoom 初始化时容器尺寸计算错误
3. 工具栏在组件内部，占用图表空间

---

## 新设计方案

### 简化结构

```
.markdown-body
└── .mermaid-block (单层 wrapper)
    ├── .mermaid-header (悬浮/固定工具栏)
    │   ├── MERMAID label
    │   ├── [Diagram] [Code] toggle
    │   └── Floating toolbar: [⬇PNG] [+] [-] [⟲] [⛶]
    ├── .mermaid-content.diagram-mode
    │   └── MermaidViewer 组件 (无嵌套 wrapper)
    │       └── svg (直接渲染，pan-zoom 初始化)
    └── .mermaid-content.code-mode (hidden by default)
        └── Shiki highlighted code
```

### 工具栏位置方案

| 方案 | 描述 | 适用场景 |
|------|------|----------|
| **A: Header 固定** | 工具栏在 header 最右侧，常驻显示 | 桌面端默认 |
| **B: 悬浮** | 工具栏默认隐藏，hover 时显示在图表右上角 | 桌面端可选 |
| **C: 移动端底部** | 工具栏固定在底部，方便触摸 | 移动端 |

**选定：A + B 结合**
- 桌面：Header 显示 toggle + Download，hover 显示完整工具栏覆盖在图表上
- 移动：Header 显示所有按钮（触控设备无 hover）

---

## 组件设计

### 1. MermaidViewer.vue (简化版)

**职责：** 纯 SVG 渲染 + pan-zoom 初始化

```vue
<template>
  <div class="mermaid-viewer" ref="container">
    <div class="svg-container" v-html="svgContent"></div>
  </div>
</template>

<script setup>
// Props: svgContent, theme
// Methods: zoomIn, zoomOut, reset, getSvgElement, exportPng
// Lifecycle: init pan-zoom on mount, destroy on unmount
</script>
```

**关键修复：**
- 移除内部 toolbar
- 移除嵌套 wrapper
- 使用 ResizeObserver 确保 SVG 尺寸正确
- pan-zoom 配置 `fit: true, center: true`

### 2. 修改 useMarkdown.ts

**当前：**
```typescript
// 复杂嵌套，组件替换 DOM
const mermaidBlock = `<div class="mermaid-wrapper">
  <div class="diagram-view">
    <pre class="language-mermaid"><code>...</code></pre>
  </div>
</div>`
// 然后 Vue 组件替换 .diagram-view 内容
```

**新设计：**
```typescript
// 直接生成最终结构，Vue 组件负责交互
const mermaidBlock = `<div class="mermaid-block" data-index="${i}">
  <div class="mermaid-header">...</div>
  <div class="mermaid-content" data-mode="diagram">
    <div class="mermaid-viewer-mount"></div>
  </div>
  <div class="mermaid-content code" style="display:none">
    <pre>${highlightedCode}</pre>
  </div>
</div>`
```

### 3. MarkdownViewer.vue 集成

```typescript
async function renderMermaidBlocks() {
  for (const block of mermaidBlocks) {
    // 1. 渲染 mermaid 获取 SVG
    const svg = await renderMermaid(code, theme)
    
    // 2. 创建 MermaidViewer 组件实例
    const viewer = createApp(MermaidViewer, { 
      svgContent: svg,
      onZoomIn: () => viewer.zoomIn(),
      onZoomOut: () => viewer.zoomOut(),
      onReset: () => viewer.reset(),
      onDownloadPng: () => downloadPng(viewer.getSvgElement())
    })
    
    // 3. 挂载到对应容器
    viewer.mount(block.querySelector('.mermaid-viewer-mount'))
    
    // 4. 绑定 header 按钮事件
    bindToolbarEvents(block, viewer)
  }
}
```

---

## PNG 下载实现

### 方案对比

| 方案 | 实现 | 优缺点 |
|------|------|--------|
| A: canvg 库 | 使用 canvg 将 SVG 转 Canvas | 兼容性好，但有依赖 |
| **B: 原生浏览器 API** (推荐) | `XMLSerializer` + `Blob` + `Image` + `Canvas` | 无依赖，现代浏览器支持好 |

### 实现步骤

```typescript
async function exportMermaidToPng(svgElement: SVGElement): Promise<Blob> {
  // 1. 克隆 SVG 并内联样式
  const clonedSvg = svgElement.cloneNode(true) as SVGElement
  
  // 2. 序列化为字符串
  const serializer = new XMLSerializer()
  const svgString = serializer.serializeToString(clonedSvg)
  
  // 3. 创建 Blob URL
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  
  // 4. 加载到 Image
  const img = new Image()
  await new Promise((resolve, reject) => {
    img.onload = resolve
    img.onerror = reject
    img.src = url
  })
  
  // 5. 绘制到 Canvas
  const canvas = document.createElement('canvas')
  const rect = svgElement.getBoundingClientRect()
  canvas.width = rect.width * 2  // 2x for retina
  canvas.height = rect.height * 2
  
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = getComputedStyle(svgElement).backgroundColor || '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  
  // 6. 导出 PNG
  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob!), 'image/png')
  })
}
```

---

## 样式设计

### CSS 结构

```css
/* Block container */
.mermaid-block {
  margin: 1rem 0;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
}

/* Header - flex layout */
.mermaid-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
}

/* Toggle buttons */
.mermaid-toggle {
  display: flex;
  gap: 4px;
}

.mermaid-toggle button {
  padding: 4px 12px;
  font-size: 12px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  cursor: pointer;
}

.mermaid-toggle button.active {
  background: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
}

/* Floating toolbar (desktop hover) */
.mermaid-toolbar {
  position: absolute;
  top: 8px;
  right: 8px;
  display: none;
  gap: 4px;
  padding: 4px;
  background: rgba(0, 0, 0, 0.8);
  border-radius: var(--radius-sm);
}

.mermaid-block:hover .mermaid-toolbar {
  display: flex;
}

/* Content area */
.mermaid-content {
  position: relative;
  min-height: 100px;
  max-height: 600px; /* Increased */
  overflow: hidden;
}

.mermaid-viewer {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mermaid-viewer svg {
  max-width: 100%;
  max-height: 100%;
}

/* Mobile: always show toolbar */
@media (max-width: 768px) {
  .mermaid-toolbar {
    display: flex;
    position: static;
    background: transparent;
    margin-left: auto;
  }
}
```

---

## 全屏模式

### 设计

```
┌─────────────────────────────────────────────────────┐
│ [Title]                    [⬇PNG] [+] [-] [⟲] [×] │  ← 顶部工具栏
├─────────────────────────────────────────────────────┤
│                                                     │
│                                                     │
│                    SVG Diagram                     │  ← 可缩放拖动
│              (pan-zoom enabled)                     │
│                                                     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**实现：**
- 复用 MermaidViewer 组件
- Modal 内独立 pan-zoom 实例
- 更大 max-height (90vh)
- 单独 zoom 状态管理

---

## 实现计划

### Phase 1: 修复嵌套和裁剪 (Task #10)

1. **简化 useMarkdown.ts**
   - 移除嵌套 wrapper
   - 生成扁平结构

2. **重写 MermaidViewer.vue**
   - 移除内部 toolbar
   - 修复 ResizeObserver 和 pan-zoom 初始化
   - 添加 exportPng 方法

3. **修复 MarkdownViewer.vue 集成**
   - 更新挂载逻辑
   - 确保尺寸计算正确

### Phase 2: 工具栏重构 (Task #8)

1. **Header 工具栏**
   - 移动 toggle 按钮到 header
   - 添加悬浮工具栏样式

2. **移动端适配**
   - Header 显示所有按钮
   - 增大触摸目标 (44px min)

### Phase 3: PNG 下载 (Task #7)

1. 实现 exportMermaidToPng 函数
2. 绑定下载按钮
3. 处理主题背景色

### Phase 4: 全屏优化

1. 复用组件到 Modal
2. 独立 zoom 状态
3. 关闭时销毁实例

---

## 验收标准

- [ ] 单页 Mermaid 图表可视区域 > 60% 屏幕高度
- [ ] 无嵌套层级，结构扁平
- [ ] SVG 完整显示，无裁剪
- [ ] pan-zoom 可正常缩放/拖动
- [ ] Header 工具栏常驻显示
- [ ] 悬浮工具栏 hover 显示 (桌面)
- [ ] PNG 下载功能正常
- [ ] 移动端按钮可正常触摸
- [ ] 全屏模式功能完整
- [ ] 切换 Diagram/Code 无闪烁
