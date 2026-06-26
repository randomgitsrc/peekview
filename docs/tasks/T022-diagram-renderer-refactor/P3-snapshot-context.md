---
phase: P3
task_id: T022-diagram-renderer-refactor
type: dispatch-context
parent: P3-test-cases.md
trace_id: T022-P3-snapshot-context-20260626
created: 2026-06-26
---

# snapshot-html.spec.ts 测试上下文

## 任务
写 `frontend-v3/src/components/diagrams/__tests__/snapshot-html.spec.ts`（8 测试点，快照/字符级一致）

## 关键现实
emit 迁移后，useMarkdown 输出的 html 是占位容器（`<div class="xxx-block" data-block-id data-index data-lang></div>`），不再含完整 header+按钮+content。所以：
- 5.1-5.5：HTML 快照测的是占位容器结构
- 5.6：svg sanitize 应在 useMarkdown 层做（meta.sanitize），测试 source.code 不含 script/onclick/foreignObject
- 5.7：mermaid codeViewHtml（escapeHtml 同步）
- 5.8：BaseDiagram 渲染的 innerHTML 结构快照

## 8 个测试点

| # | 测什么 | 断言 |
|---|--------|------|
| 5.1 | mermaid block 占位容器 HTML | render 出含 `<div class="mermaid-block"` 的占位 div |
| 5.2 | plantuml block 占位容器 HTML | 同上 classPrefix='plantuml' |
| 5.3 | svg block 占位容器 HTML | 同上 classPrefix='svg' |
| 5.4 | 三族混合 render 输出三个独立占位容器 | render → 含 mermaid/plantuml/svg 三种 block |
| 5.5 | 默认 code block（python）走 Shiki 高亮 | render 含 code-block-wrapper |
| 5.6 | svg 源码含 script 经 sanitize 后不含 | source.code 不含 `<script`/`onclick`/`foreignobject` |
| 5.7 | mermaid codeViewHtml escapeHtml 同步 | source.codeViewHtml 含 escapeHtml 后的 code |
| 5.8 | BaseDiagram 挂载后 innerHTML 结构快照 | html 含 mermaid-block/header/label/content/两 mode |

## 骨架（直接照抄到测试文件）

```typescript
import { describe, it, expect } from 'vitest'
import { useMarkdown } from '@/composables/useMarkdown'
import { mount } from '@vue/test-utils'
import BaseDiagram from '../BaseDiagram.vue'

const baseProps = {
  svgContent: '<svg><circle r="10"/></svg>',
  codeViewHtml: '<span>code</span>',
  blockId: 'block-0', blockIndex: 0,
  classPrefix: 'mermaid', theme: 'light' as const, label: 'MERMAID',
  pngBackground: '#ffffff' as const, pngViewBoxFallback: 'g-root-getBBox' as const,
  pngFinalSize: { width: 800, height: 600 }, pngBrFix: true, pngFilenamePrefix: 'mermaid-diagram',
  panZoomMinZoom: 0.1, panZoomMaxZoom: 10, panZoomInitTryCatch: false,
  touchEnabled: true, resizeEnabled: true,
  refreshEventName: 'mermaid-refresh', modalTitle: 'Mermaid Diagram',
  toggleTextUpdates: true, refreshOnToggle: true, copyFeedback: true,
  menuClickOutside: true, menuCloseOthers: true,
}

describe('5. HTML 快照与字符级一致', () => {
  it('5.1 mermaid block 占位容器 HTML', async () => {
    const { render } = useMarkdown()
    const result = await render('```mermaid\ngraph LR; A-->B\n```', 'github-light')
    expect(result.html).toContain('<div class="mermaid-block"')
    expect(result.html).toContain('data-block-id="mermaid-block-0"')
    expect(result.html).toContain('data-lang="mermaid"')
  })
  
  it('5.2 plantuml block 占位容器 HTML', async () => {
    const { render } = useMarkdown()
    const result = await render('```plantuml\n@startuml\nA->B\n@enduml\n```', 'github-light')
    expect(result.html).toContain('<div class="plantuml-block"')
  })
  
  it('5.3 svg block 占位容器 HTML', async () => {
    const { render } = useMarkdown()
    const result = await render('```svg\n<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>\n```', 'github-light')
    expect(result.html).toContain('<div class="svg-block"')
  })
  
  it('5.4 三族混合 render 输出三个独立占位容器', async () => {
    const { render } = useMarkdown()
    const md = '```mermaid\ngraph LR\n```\n\n```plantuml\n@startuml\nA->B\n@enduml\n```\n\n```svg\n<svg></svg>\n```'
    const result = await render(md, 'github-light')
    expect(result.html).toContain('mermaid-block')
    expect(result.html).toContain('plantuml-block')
    expect(result.html).toContain('svg-block')
  })
  
  it('5.5 默认 code block（python）走 Shiki 高亮', async () => {
    const { render } = useMarkdown()
    const result = await render('```python\nprint("hello")\n```', 'github-light')
    expect(result.html).toContain('code-block-wrapper')
  })
  
  it('5.6 svg sanitize 剥除 script/onclick/foreignObject', async () => {
    const { render } = useMarkdown()
    const evilSvg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><circle onclick="alert(1)" r="10"/><foreignObject>bad</foreignObject></svg>'
    const md = '```svg\n' + evilSvg + '\n```'
    const result = await render(md, 'github-light')
    const source = result.sources.get(0)
    expect(source).toBeDefined()
    expect(source.code).not.toContain('<script')
    expect(source.code).not.toContain('onclick')
    expect(source.code.toLowerCase()).not.toContain('foreignobject')
  })
  
  it('5.7 mermaid codeViewHtml escapeHtml 同步', async () => {
    const { render } = useMarkdown()
    const result = await render('```mermaid\ngraph LR; A-->B\n```', 'github-light')
    const source = result.sources.get(0)
    expect(source).toBeDefined()
    expect(source.codeViewHtml).toBeDefined()
    expect(source.codeViewHtml).toContain('graph LR')
    expect(source.codeViewHtml).not.toContain('<script')
  })
  
  it('5.8 BaseDiagram 挂载后 innerHTML 结构快照', async () => {
    const wrapper = mount(BaseDiagram, { props: baseProps })
    const html = wrapper.html()
    expect(html).toContain('mermaid-block')
    expect(html).toContain('mermaid-header')
    expect(html).toContain('mermaid-label')
    expect(html).toContain('MERMAID')
    expect(html).toContain('mermaid-view-toggle')
    expect(html).toContain('mermaid-content')
    expect(html).toContain('data-mode="diagram"')
    expect(html).toContain('data-mode="code"')
  })
})
```

## 返回
只返回两行：1. 文件路径 2. 一句话摘要（8 测试点，X passed / Y failed）