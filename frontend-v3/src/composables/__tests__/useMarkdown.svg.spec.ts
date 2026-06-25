import { describe, it, expect } from 'vitest'
import DOMPurify from 'dompurify'
import { useMarkdown } from '../useMarkdown'
import { useShiki } from '../useShiki'

const PURIFY_CONFIG = {
  ADD_ATTR: ['data-action', 'data-code', 'data-line', 'data-block-id', 'data-index', 'data-mode', 'target', 'rel'],
  ADD_TAGS: ['button'],
}

describe('useMarkdown svg 代码块识别', () => {
  const { render } = useMarkdown()

  it('```svg 代码块渲染为 .svg-block 容器', async () => {
    const md = '```svg\n<svg xmlns="http://www.w3.org/2000/svg"><circle r="40" fill="red"/></svg>\n```'
    const result = await render(md, 'github-light')
    expect(result.html).toContain('svg-block')
  })

  it('result.sources 是 Map 且含原始 SVG 源码', async () => {
    const svgSrc = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="40" fill="red"/></svg>'
    const md = '```svg\n' + svgSrc + '\n```'
    const result = await render(md, 'github-light')
    expect(result.sources).toBeInstanceOf(Map)
    expect(result.sources.size).toBeGreaterThan(0)
    const first = Array.from(result.sources.values())[0]
    expect(first.code).toContain('<svg')
    expect(first.code).toContain('circle')
  })
})

describe('useShiki xml 高亮', () => {
  const { highlightCode } = useShiki()

  it('xml 代码高亮输出含 shiki class', async () => {
    const html = await highlightCode('<svg></svg>', 'xml', 'github-light')
    expect(html).toContain('class="shiki')
  })

  it('xml 代码被真正分词（多个着色 span）而非 text 回退', async () => {
    const html = await highlightCode('<svg></svg>', 'xml', 'github-light')
    const colorSpans = html.match(/style="color:/g) || []
    expect(colorSpans.length).toBeGreaterThanOrEqual(3)
  })
})

describe('DOMPurify SVG 净化（默认行为）', () => {
  it('剥离 <script>', () => {
    const raw = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><circle r="40"/></svg>'
    const out = DOMPurify.sanitize(raw, PURIFY_CONFIG)
    expect(out).not.toContain('<script>')
    expect(out).not.toContain('alert(1)')
  })

  it('剥离 onclick 事件处理器', () => {
    const raw = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="40" onclick="alert(1)"/></svg>'
    const out = DOMPurify.sanitize(raw, PURIFY_CONFIG)
    expect(out).not.toContain('onclick')
    expect(out).toContain('circle')
  })

  it('剥离 foreignObject', () => {
    const raw = '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div>x</div></foreignObject></svg>'
    const out = DOMPurify.sanitize(raw, PURIFY_CONFIG)
    expect(out.toLowerCase()).not.toContain('foreignobject')
  })

  it('保留合法 SVG 元素 path/circle/rect/text/g', () => {
    const raw = '<svg xmlns="http://www.w3.org/2000/svg"><g><path d="M0 0"/><circle r="1"/><rect/><text>x</text></g></svg>'
    const out = DOMPurify.sanitize(raw, PURIFY_CONFIG)
    expect(out).toContain('<path')
    expect(out).toContain('<circle')
    expect(out).toContain('<rect')
    expect(out).toContain('<text')
    expect(out).toContain('<g')
  })
})
