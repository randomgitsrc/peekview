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

  it('```svg 代码块渲染为 diagram block', async () => {
    const md = '```svg\n<svg xmlns="http://www.w3.org/2000/svg"><circle r="40" fill="red"/></svg>\n```'
    const result = await render(md, 'github-light')
    const svgBlocks = result.blocks.filter(b => b.type === 'diagram' && b.lang === 'svg')
    expect(svgBlocks).toHaveLength(1)
  })

  it('svg diagram block 含原始 SVG 源码', async () => {
    const svgSrc = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="40" fill="red"/></svg>'
    const md = '```svg\n' + svgSrc + '\n```'
    const result = await render(md, 'github-light')
    const svgBlocks = result.blocks.filter(b => b.type === 'diagram' && b.lang === 'svg')
    expect(svgBlocks).toHaveLength(1)
    const first = svgBlocks[0]
    if (first.type === 'diagram') {
      expect(first.code).toContain('<svg')
      expect(first.code).toContain('circle')
    }
  })
})

describe('useMarkdown 裸内嵌 SVG 提取保护（inline 插图直渲）', () => {
  const { render } = useMarkdown()

  it('裸 <svg>（含内部空行+单行 text 元素）块内容不被 DOMPurify 清空', async () => {
    const md = [
      '## 图一',
      '',
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="60">',
      '  <defs>',
      '    <marker id="a"><path d="M0,0 L10,5"/></marker>',
      '  </defs>',
      '',
      '  <rect width="100" height="60" fill="#eee"/>',
      '  <text x="50" y="30" text-anchor="middle">架构图</text>',
      '</svg>',
      '',
      '## 图二说明',
    ].join('\n')
    const result = await render(md, 'github-light')
    const htmlBlocks = result.blocks.filter(b => b.type === 'html')
    const allHtml = htmlBlocks.map(b => (b.type === 'html' ? b.html : '')).join('')
    // svg 内容存活（此前 rect 被清到只剩背景、text 全丢）
    expect(allHtml).toContain('<svg')
    expect((allHtml.match(/<rect/g) || []).length).toBe(1)
    expect(allHtml).toContain('架构图')
    // text 未被 <p> 包裹（foreign content breakout 根因）
    expect(allHtml).not.toContain('<p><text')
    // 后续标题存活
    expect(allHtml).toContain('图二说明')
  })

  it('裸 <svg> 后的章节/表格在 DOM 层存活（原吞内容场景）', async () => {
    const md = [
      '# 架构',
      '',
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">',
      '  <defs>',
      '    <marker id="m"><path d="M0,0"/></marker>',
      '  </defs>',
      '',
      '  <text x="5" y="5">T</text>',
      '</svg>',
      '',
      '## 2. 节点角色',
      '',
      '| 节点 | 角色 |',
      '| :--- | :--- |',
      '| 主 | dsh |',
      '',
      '## 3. 接入',
    ].join('\n')
    const result = await render(md, 'github-light')
    const html = result.blocks.map(b => (b.type === 'html' ? b.html : '')).join('')
    expect((html.match(/<h2/g) || []).length).toBe(2)
    expect(html).toContain('节点角色')
    expect(html).toContain('<table>')
    expect((html.match(/<svg/g) || []).length).toBe(1)
    expect(html).toContain('<text')
  })

  it('多个裸 <svg> 各自成块且互不影响', async () => {
    const md = [
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>',
      '',
      '<svg xmlns="http://www.w3.org/2000/svg"><circle r="1"/></svg>',
    ].join('\n')
    const result = await render(md, 'github-light')
    const html = result.blocks.map(b => (b.type === 'html' ? b.html : '')).join('')
    expect((html.match(/<svg/g) || []).length).toBe(2)
    expect(html).toContain('<rect')
    expect(html).toContain('<circle')
  })

  it('```svg fence 不受提取影响（仍走 diagram 通道）', async () => {
    const md = '```svg\n<svg xmlns="http://www.w3.org/2000/svg"><rect width="2" height="2"/></svg>\n```'
    const result = await render(md, 'github-light')
    expect(result.blocks.filter(b => b.type === 'diagram' && b.lang === 'svg')).toHaveLength(1)
    const html = result.blocks.map(b => (b.type === 'html' ? b.html : '')).join('')
    expect(html).not.toContain('<svg') // fence 内容不作为 inline html 块输出
  })

  it('代码块内含 <svg> 文本不被误提取', async () => {
    const md = [
      '## 示例',
      '',
      '```xml',
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>',
      '```',
      '',
      '## 之后',
    ].join('\n')
    const result = await render(md, 'github-light')
    const html = result.blocks.map(b => (b.type === 'html' ? b.html : '')).join('')
    // fence 内容走代码块路径（code-block-wrapper），svg 原文在 data-code 属性里
    expect(html).toContain('code-block-wrapper')
    expect(html).toContain('data-code="<svg')
    // 不产生 inline svg html 块
    expect(html).not.toContain('<!--RAW_SVG')
    expect(html).toContain('之后')
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
