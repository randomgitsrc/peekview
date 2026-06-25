---
phase: P4
task_id: T022-diagram-renderer-refactor
type: dispatch-context
parent: P2-design.md
trace_id: T022-P4-dispatch-context-20260625
created: 2026-06-25
---

# P4 派发上下文 — T022（实现代码导航）

> 主 Agent 已查证的客观信息，供实现 subagent 直接使用。
> 避免反复搜索 import 路径、猜测 API 调用方式。

## 1. 正确的 import 路径（实测确认）

```typescript
// ❌ P2-design 写的路径（错误，会导致 collection error）
// import { useMermaid } from '@/utils/useMermaid'
// import { usePlantUML } from '@/utils/usePlantUML'
// import { highlightCode } from '@/utils/shiki'

// ✅ 实际路径（grep 现有代码确认）
import { useMermaid } from '@/composables/useMermaid'        // MarkdownViewer.vue L12
import * as usePlantUML from '@/composables/usePlantUML'     // MarkdownViewer.vue L13（注意是 * as）
// highlightCode 不是独立导出，来自 useShiki()：
import { useShiki } from '@/composables/useShiki'
const { highlightCode } = useShiki()
```

## 2. useMermaid / usePlantUML 调用契约

```typescript
// useMermaid.render 签名（useMermaid.ts）
useMermaid.render(id: number, code: string, theme: string): Promise<string>
// 5s timeout + securityLevel:'strict'（P2 known_risks 保留）

// usePlantUML.render 签名（usePlantUML.ts，注意是 namespace import）
usePlantUML.render(code: string, theme: string): Promise<string>
// 模块级 renderQueue 串行（P1 I5 硬约束，禁 Promise.all）
```

## 3. highlightCode 调用方式

```typescript
// useMarkdown.ts L16: const { highlightCode } = useShiki()
// useMarkdown.ts L324: highlightCode(block.code, 'xml', theme) — 异步，返回 HTML string
// svg code 视图用 'xml' 语言高亮

// 在 useCodeBlockRenderer 中：
import { useShiki } from '@/composables/useShiki'
const { highlightCode } = useShiki()
// 然后：codeViewHtml = await highlightCode(code, 'xml', theme)
```

## 4. svgToPng 实现参照（MermaidDiagram.vue L290-330 现有代码）

P2-design 第 2.5 节 svgToPng 写了 `/* 见 2.5 */`。现有实现参照 MermaidDiagram.vue 的 downloadPng：

```typescript
// 参照 MermaidDiagram.vue 现有 PNG 导出逻辑（白底版本）
async function svgToPng(svgString: string, opts: {
  width: number; height: number;
  background: '#ffffff' | 'transparent';
  filename: string;
}): Promise<void> {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgString, 'image/svg+xml')
  const svgEl = doc.documentElement
  if (!svgEl.getAttribute('xmlns')) {
    svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  }
  const serializer = new XMLSerializer()
  const serialized = serializer.serializeToString(svgEl)
  const svgBase64 = btoa(unescape(encodeURIComponent(serialized)))
  const dataUrl = `data:image/svg+xml;base64,${svgBase64}`

  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = reject
    img.src = dataUrl
  })

  const canvas = document.createElement('canvas')
  canvas.width = opts.width
  canvas.height = opts.height
  const ctx = canvas.getContext('2d')!

  // ★ 差异点（P1 I2 / P2 known_risks）：
  //   mermaid/plantuml: background='#ffffff' → fillRect 白底
  //   svg: background='transparent' → 不调 fillRect（alpha=0 透明）
  if (opts.background !== 'transparent') {
    ctx.fillStyle = opts.background
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  ctx.drawImage(img, 0, 0, opts.width, opts.height)

  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = opts.filename
    a.click()
    URL.revokeObjectURL(url)
  }, 'image/png')
}
```

## 5. P2-design 实现代码位置索引

| 文件 | P2-design 节 | 行号范围 | 内容 |
|------|-------------|---------|------|
| useCodeBlockRenderer.ts | 4.3 | 552-671 | 完整函数实现（含 preRender/getter/instance）|
| BaseDiagram.vue | 2.1-2.4 | ~108-290 | props/slots/emits/defineExpose + modal 设计 |
| 三薄包装 | 3.1-3.3 | ~349-488 | MermaidDiagram/PlantUmlDiagram/SvgDiagram 差异 props |
| useMarkdown 注册模式 | 5.1-5.4 | ~760-870 | diagramRegistry + renderCodeView + DOMPurify |
| 事件委托迁移 | 6.2 | ~918-935 | 16 case handler 映射表 |

## 6. 行为保真铁律（P0-brief user_decisions 6）
- 重构后所有用户可见行为逐项一致
- 禁止"重构+优化"捆绑（一次只做一件事）
- PNG 路径统一（mermaid/plantuml fresh → composable.svgToPng）属结构迁移，输出字节级一致
- renderToken 防竞态保留（nextToken 递增 + isCurrent 二值）
- 串行约束保留（plantuml renderQueue，禁 Promise.all）
- DOMPurify 净化保留（T020 安全债）

## 7. 现有文件位置
- `frontend-v3/src/composables/useMarkdown.ts`（372 行，要改注册模式）
- `frontend-v3/src/composables/useMermaid.ts`（useMermaid.render）
- `frontend-v3/src/composables/usePlantUML.ts`（namespace import，renderQueue）
- `frontend-v3/src/composables/useShiki.ts`（useShiki().highlightCode）
- `frontend-v3/src/components/MarkdownViewer.vue`（1989 行，要瘦身 < 300）
- `frontend-v3/src/components/MermaidDiagram.vue`（598 行 → 薄包装 < 150）
- `frontend-v3/src/components/PlantUmlDiagram.vue`（416 行 → 薄包装 < 150）
- `frontend-v3/src/components/SvgDiagram.vue`（478 行 → 薄包装 < 150）
- stub 已在 `frontend-v3/src/components/diagrams/` 和 `frontend-v3/src/composables/`
