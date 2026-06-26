---
phase: P3
task_id: T022-diagram-renderer-refactor
type: dispatch-context
parent: P3-test-cases.md
trace_id: T022-P3-error-context-20260626
created: 2026-06-26
---

# error-handling-mount.spec.ts 测试上下文

## 任务
写 `frontend-v3/src/components/diagrams/__tests__/error-handling-mount.spec.ts`（5 测试点，错误处理）

## 关键现实
错误处理分两层：
- **preRender 阶段**（composable）：mermaid/plantuml render 抛错 → sourcesMap.set error 标记（不操作 DOM）
- **mount 阶段**：BaseDiagram 渲染时检测到 error → 显示错误 UI

emit 迁移后 mountPoint 改为 block 本身（不是 viewer-mount），所以错误处理也针对 block 本身。

## 5 个测试点（调整为测实际行为）

| # | 测什么 | 断言 |
|---|--------|------|
| 6.1 | preRenderMermaid 抛错标记 error 不操作 DOM | mock useMermaid.render 抛错 → 调用 preRenderMermaid → sourcesMap.get(0).error === 'Failed to render diagram'，无 throw |
| 6.2 | preRenderPlantUml 抛错标记 error | 同上，error === 'plantuml-validate-failed' |
| 6.3 | svg sanitize 失败不阻断（保真原行为）| diagramRegistry sanitize 抛错 → catch，code 仍存入 |
| 6.4 | preRender error 标记 sourcesMap.error（不操作 DOM）| 测 useCodeBlockRenderer 的 error getter 返回 error 字符串 |
| 6.5 | getError(index) 返回 error 标记 | useCodeBlockRenderer().getError(0) === 'Failed to render diagram' |

## 骨架

```typescript
import { describe, it, expect, vi } from 'vitest'
import { useCodeBlockRenderer } from '../useCodeBlockRenderer'
import * as usePlantUML from '@/composables/usePlantUML'

// Mock useMermaid 的 render 抛错
vi.mock('@/composables/useMermaid', () => ({
  useMermaid: () => ({
    render: vi.fn().mockRejectedValue(new Error('mermaid render failed'))
  })
}))

describe('6. 错误处理', () => {
  it('6.1 preRenderMermaid 抛错标记 error 不操作 DOM', async () => {
    const renderer = useCodeBlockRenderer()
    await renderer.preRenderMermaid(0, 'graph LR', 'light', '<code>')
    expect(renderer.getError(0)).toBe('Failed to render diagram')
  })
  
  it('6.2 preRenderPlantUml 抛错标记 error', async () => {
    vi.spyOn(usePlantUML, 'render').mockRejectedValue(new Error('plantuml failed'))
    const renderer = useCodeBlockRenderer()
    await renderer.preRenderPlantUml(0, '@startuml\nA->B\n@enduml', 'light', '<code>')
    expect(renderer.getError(0)).toBe('plantuml-validate-failed')
  })
  
  it('6.3 svg sanitize 失败不阻断', async () => {
    const renderer = useCodeBlockRenderer()
    // 正常 svg code 应该通过
    await renderer.registerSvg(0, '<svg><circle r="10"/></svg>', 'light')
    const err = renderer.getError(0)
    expect(err).toBeUndefined()
    expect(renderer.sourcesMap.get(0)?.code).toBe('<svg><circle r="10"/></svg>')
  })
  
  it('6.4 preRender error 标记 sourcesMap.error 不操作 DOM', async () => {
    const renderer = useCodeBlockRenderer()
    await renderer.preRenderMermaid(0, 'graph LR', 'light', '<code>')
    const src = renderer.sourcesMap.get(0)
    expect(src?.error).toBeDefined()
    expect(src?.error).toBe('Failed to render diagram')
  })
  
  it('6.5 getError(index) 返回 error 标记', async () => {
    const renderer = useCodeBlockRenderer()
    await renderer.preRenderMermaid(5, 'graph', 'light', '<code>')
    expect(renderer.getError(5)).toBe('Failed to render diagram')
    expect(renderer.getError(99)).toBeUndefined()
  })
})
```

## 关键
1. useCodeBlockRenderer 的 preRender 函数已经实现，直接测
2. mock useMermaid/usePlantUML 的 render 抛错
3. getError(index) 从 sourcesMap 取 error 字段
4. 不需要 mount 整个 MarkdownViewer——纯 composable 测试足够覆盖错误标记逻辑

## 返回
只返回两行：1. 文件路径 2. 一句话摘要（5 测试点，X passed / Y failed）