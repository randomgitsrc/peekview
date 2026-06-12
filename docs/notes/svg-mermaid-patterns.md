# SVG/Mermaid 组件开发经验总结

> 记录于 2026-05-06 - Mermaid 图表显示修复

## 问题回顾

修复了三个相关问题：
1. SVG 图表只在容器内显示为细长条（未填满）
2. Code/Diagram 切换后图表消失（空白）
3. Fullscreen 模态框未铺满窗口

---

## 核心原则

### 原则 1：永远不要对 SVG/Canvas 使用 `display: none`

**原因**：`display: none` 会导致元素失去布局信息，破坏 svg-pan-zoom 等库的内部状态（无法正确计算尺寸、矩阵不可逆等）。

**正确做法**：使用 CSS clip 或 visibility 方案：

```css
/* ❌ 错误 - 破坏布局 */
.hidden { display: none; }

/* ✅ 正确 - 保留布局 */
.hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* 或 visibility 方案（占用空间） */
.hidden {
  visibility: hidden;
  position: absolute;
}
```

---

### 原则 2：Mermaid SVG 有内联样式陷阱

Mermaid 生成的 SVG 带有内联样式，优先级高于外部 CSS：

```html
<!-- Mermaid 输出 -->
<svg style="max-width: 177px; ...">
```

**必须**在初始化时强制重置（CSS 无法覆盖）：

```typescript
// 在 initPanZoom() 中必须执行
svg.removeAttribute('width')
svg.removeAttribute('height')
svg.style.width = '100%'
svg.style.height = '100%'
svg.style.maxWidth = '100%'
svg.style.maxHeight = '100%'
```

---

### 原则 3：可视化组件测试必须验证实际填充比例

**❌ 错误测试**（只测容器）：
```typescript
expect(containerHeight).toBeGreaterThan(200)  // 容器够高就行？
```

**✅ 正确测试**（测实际填充）：
```typescript
const svgBox = await svg.boundingBox()
const containerBox = await container.boundingBox()
const fillRatio = (svgBox.width / containerBox.width) * 100

expect(fillRatio).toBeGreaterThan(90)  // 至少填充90%
```

---

## 调试模板

遇到 SVG/Mermaid 显示问题时，按此顺序检查：

```typescript
// 1. 检查容器尺寸
console.log('Container:', element.getBoundingClientRect())

// 2. 检查 SVG 属性（attribute vs style）
console.log('SVG width attr:', svg.getAttribute('width'))  // 可能被内联
console.log('SVG style:', svg.style.cssText)              // 内联样式

// 3. 检查计算样式（最终生效值）
console.log('Computed width:', getComputedStyle(svg).width)

// 4. 检查 svg-pan-zoom 状态
console.log('PanZoom instance:', container.__panZoomInstance)
console.log('PanZoom zoom:', panZoomInstance.getZoom())

// 5. 浏览器控制台检查
// - 是否有 SVGMatrix inverse 错误？
// - 是否有 viewBox 解析错误？
```

---

## 相关代码位置

### 文件变更

**MarkdownViewer.vue** (`src/components/`)
- 切换逻辑：使用 `.is-active` class 替代 `display: none`
- CSS 定义：隐藏元素的 clip 方案

**MermaidDiagram.vue** (`src/components/`)
- `initPanZoom()`: 强制设置 SVG 尺寸
- `initModalPanZoom()`: 模态框 SVG 尺寸设置

**useMarkdown.ts** (`src/composables/`)
- 初始 HTML 生成：添加 `is-active` class

---

## 测试命令

```bash
# 运行 Mermaid E2E 测试
cd frontend-v3
npx tsx e2e/mermaid-full-test.ts

# 查看截图
ls -la /tmp/mermaid-test-results/
```

---

## 下次遇到类似问题先问

1. **是 `display:none` 相关吗？** → 换成 CSS clip 方案
2. **是内联样式覆盖吗？** → 检查 `svg.style.cssText`
3. **实际渲染尺寸 vs 容器尺寸？** → 测量填充比例
4. **第三方库内部状态损坏？** → 需要重新初始化/销毁重建

---

## 参考链接

- [Mermaid.js 官方文档](https://mermaid.js.org/)
- [svg-pan-zoom GitHub](https://github.com/bumbu/svg-pan-zoom)
- [CSS clip 属性 MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/clip)
