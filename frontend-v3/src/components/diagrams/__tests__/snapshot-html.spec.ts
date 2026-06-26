import { describe, it, expect, vi } from 'vitest'
import { useMarkdown } from '@/composables/useMarkdown'
import { mount } from '@vue/test-utils'
import BaseDiagram from '../BaseDiagram.vue'

vi.mock('svg-pan-zoom', () => ({
  default: vi.fn(() => ({
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    reset: vi.fn(),
    center: vi.fn(),
    destroy: vi.fn(),
    resize: vi.fn(),
    fit: vi.fn(),
  })),
}))

const baseProps = {
  svgContent: '<svg><circle r="10"/></svg>',
  codeViewHtml: '<span>code</span>',
  blockId: 'block-0', blockIndex: 0,
  classPrefix: 'mermaid' as const, theme: 'light' as const, label: 'MERMAID',
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
    const source = result.sources.get(0)!;
    expect(source).toBeDefined()
    expect(source.code).not.toContain('<script')
    expect(source.code).not.toContain('onclick')
    expect(source.code.toLowerCase()).not.toContain('foreignobject')
  })
  
  it('5.7 mermaid codeViewHtml escapeHtml 同步', async () => {
    const { render } = useMarkdown()
    const result = await render('```mermaid\ngraph LR; A-->B\n```', 'github-light')
    const source = result.sources.get(0)!;
    expect(source).toBeDefined()
    expect(source.codeViewHtml).toBeDefined()
    expect(source.codeViewHtml).toContain('graph LR')
    expect(source.codeViewHtml).not.toContain('<script')
  })
  
  it('5.8 BaseDiagram 挂载后 innerHTML 结构快照', async () => {
    const props = { ...baseProps, label: 'MERMAID' }
    const wrapper = mount(BaseDiagram, { props })
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
