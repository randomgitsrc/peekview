# P4e 派发上下文 — MarkdownViewer 迁移

## 核心策略：最小改动，行为保真

**不迁出状态到 composable**（mermaidCache/三 Map/renderToken 保留在 MarkdownViewer）
**不改事件委托**（data-action 16 case switch 保留）
**只改 2 件事**：import 路径 + 挂载新薄包装组件

理由：旧测试 152 passed 证明现有行为正确。迁出状态/改事件委托是"重构+优化捆绑"，违反行为保真铁律。新薄包装组件接入后，旧三胞胎组件可以后续删除。

## 改动 1：import 路径（L17-19）

### 当前（旧三胞胎）
```typescript
import MermaidDiagram from '@/components/MermaidDiagram.vue'
import PlantUmlDiagram from '@/components/PlantUmlDiagram.vue'
import SvgDiagram from '@/components/SvgDiagram.vue'
```

### 改为（新薄包装）
```typescript
import MermaidDiagram from '@/components/diagrams/MermaidDiagram.vue'
import PlantUmlDiagram from '@/components/diagrams/PlantUmlDiagram.vue'
import SvgDiagram from '@/components/diagrams/SvgDiagram.vue'
```

## 改动 2：挂载逻辑传 props（3 处）

新薄包装的 props 接口与旧组件不同。旧组件只接收 `{ svgContent, id }`，新薄包装需要 `{ blockIndex, blockId, svgContent, codeViewHtml, theme }`。

### 2a. mermaid 挂载（L459-463）
当前：
```typescript
const vNode = h(MermaidDiagram, {
  svgContent: svg,
  id: `mermaid-${index}`,
})
```
改为：
```typescript
const vNode = h(MermaidDiagram, {
  blockIndex: index,
  blockId: `mermaid-block-${index}`,
  svgContent: svg,
  codeViewHtml: '',
  theme: theme.value === 'dark' ? 'dark' : 'light',
})
```

### 2b. plantuml 挂载（L510-514）
当前：
```typescript
const vNode = h(PlantUmlDiagram, {
  svgContent: svg,
  id: `plantuml-${index}`,
})
```
改为：
```typescript
const vNode = h(PlantUmlDiagram, {
  blockIndex: index,
  blockId: `plantuml-block-${index}`,
  svgContent: svg,
  codeViewHtml: '',
  theme: theme.value === 'dark' ? 'dark' : 'light',
})
```

### 2c. svg 挂载（L562-566）
当前：
```typescript
const vNode = h(SvgDiagram, {
  svgContent: cleanSvg,
  id: `svg-${index}`,
})
```
改为：
```typescript
const vNode = h(SvgDiagram, {
  blockIndex: index,
  blockId: `svg-block-${index}`,
  svgContent: cleanSvg,
  codeViewHtml: '',
  theme: theme.value === 'dark' ? 'dark' : 'light',
})
```

## 不改的部分（行为保真）

1. **状态变量**（L34-42）：mermaidCache/三 Map/renderToken/三 instances 全部保留
2. **事件委托**（L340-363）：16 case switch + data-action 全部保留
3. **renderContent 流程**（L381-429）：render → sources 拆分 → 三族挂载 全部保留
4. **mermaidInstances 的 toggleFullscreen hack**（L468-475）：保留（新薄包装 re-expose toggleFullscreen，但旧 hack 先不动避免行为变化）
5. **DOMPurify svg 净化**（L555-558）：保留
6. **错误处理**（L476-479/L524-535/L572-575）：保留

## 新薄包装 props 接口（供参照）

三个薄包装都接收：
```typescript
defineProps<{
  blockIndex: number
  blockId: string | number
  svgContent?: string
  codeViewHtml?: string
  theme: 'light' | 'dark'
}>()
```
注意：新薄包装没有 `id` prop（旧组件有）。传 `id` 会被当作 fallthrough attr，无害但不需要。
