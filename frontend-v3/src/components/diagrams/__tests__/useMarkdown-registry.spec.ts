/**
 * useMarkdown 注册表 + DOMPurify 单测（P3b-1，文件 2）
 *
 * 纯函数单测：调 useMarkdown().render()，断言输出 html/sources 结构，不 mount。
 * diagramRegistry stub 空 → 新功能（registry/sources/sanitize/data-lang）红灯。
 * 旧 useMarkdown.render 保真项（html/headings/内联 svg）绿灯。
 *
 * 依据：P3-test-cases.md 第 2 节文件 2（12 测试点）+ P2-design.md 第 5 节。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── mock useShiki：避免真实 Shiki 加载（macrotask），返回可控高亮 HTML ──
const { highlightCodeMock } = vi.hoisted(() => ({
  highlightCodeMock: vi.fn(),
}))

vi.mock('@/composables/useShiki', () => ({
  useShiki: () => ({ highlightCode: highlightCodeMock }),
}))

import { useMarkdown } from '@/composables/useMarkdown'
import {
  registerDiagramType,
  getDiagramType,
  getAllDiagramTypes,
} from '@/composables/diagramRegistry'

describe('useMarkdown 注册表 + DOMPurify', () => {
  beforeEach(() => {
    highlightCodeMock.mockReset()
    highlightCodeMock.mockImplementation(
      async (code: string, lang: string) =>
        `<pre class="shiki" data-lang="${lang}"><code>${code}</code></pre>`
    )
  })

  // ── 2.1-2.2 注册表 ──────────────────────────────────────────────────────
  it('2.1 diagramRegistry 含 mermaid/plantuml/svg 三 meta', () => {
    const types = getAllDiagramTypes()
    const langs = types.map((m) => m.lang)
    expect(langs).toContain('mermaid')
    expect(langs).toContain('plantuml')
    expect(langs).toContain('svg')
    expect(getDiagramType('mermaid')?.classPrefix).toBe('mermaid')
    expect(getDiagramType('svg')?.codeViewHighlighter).toBe('shiki-xml')
    expect(getDiagramType('plantuml')?.codeViewHighlighter).toBe('escape-html')
  })

  it('2.2 registerDiagramType 新增 d2 类型 1 行注册', () => {
    registerDiagramType({
      lang: 'd2',
      classPrefix: 'd2',
      label: 'D2',
      codeViewHighlighter: 'escape-html',
    })
    const meta = getDiagramType('d2')
    expect(meta).toBeDefined()
    expect(meta?.classPrefix).toBe('d2')
    expect(meta?.label).toBe('D2')
  })

  // ── 2.3-2.4 fence 路由 ──────────────────────────────────────────────────
  it('2.3 fence lang=mermaid 命中走 diagram 分支（占位容器，按钮迁组件）', async () => {
    const { render } = useMarkdown()
    const result = await render('```mermaid\ngraph TD\nA-->B\n```', 'github-light')
    expect(result.html).toContain('mermaid-block')
    // 新结构：占位容器无 data-action 按钮（按钮迁 BaseDiagram 模板）
    expect(result.html).not.toContain('data-action="toggle-mermaid-view"')
    // 新结构：占位容器含 data-lang
    expect(result.html).toContain('data-lang="mermaid"')
  })

  it('2.4 未知 lang(python) 走默认 code block', async () => {
    const { render } = useMarkdown()
    const result = await render('```python\nprint("hi")\n```', 'github-light')
    expect(result.html).toContain('code-block-wrapper')
    expect(result.html).not.toContain('mermaid-block')
    expect(result.html).not.toContain('svg-block')
    expect(result.html).not.toContain('plantuml-block')
  })

  // ── 2.5-2.6 render 返回契约 ────────────────────────────────────────────
  it('2.5 render 返回 sources Map（合并三 Map）', async () => {
    const { render } = useMarkdown()
    const md = [
      '```mermaid', 'graph TD', 'A-->B', '```', '',
      '```plantuml', '@startuml', 'A->B', '@enduml', '```', '',
      '```svg', '<svg><circle/></svg>', '```',
    ].join('\n')
    const result = await render(md, 'github-light')
    expect(result.sources).toBeInstanceOf(Map)
    expect(result.sources?.size).toBe(3)
    expect(result.sources?.get(0)?.lang).toBe('mermaid')
    expect(result.sources?.get(1)?.lang).toBe('plantuml')
    expect(result.sources?.get(2)?.lang).toBe('svg')
  })

  it('2.6 render 返回 html + headings 契约不变', async () => {
    const { render } = useMarkdown()
    const result = await render('## Title\n\n```mermaid\ngraph TD\n```', 'github-light')
    expect(typeof result.html).toBe('string')
    expect(result.html.length).toBeGreaterThan(0)
    expect(Array.isArray(result.headings)).toBe(true)
    expect(result.headings.length).toBeGreaterThan(0)
    expect(result.headings[0].text).toBe('Title')
  })

  // ── 2.7-2.9 svg sanitize（T020 安全债）────────────────────────────────
  it('2.7 svg sanitize 剥除 <script>', async () => {
    const { render } = useMarkdown()
    const svgWithScript =
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><circle r="40"/></svg>'
    const result = await render('```svg\n' + svgWithScript + '\n```', 'github-light')
    const storedCode =
      result.sources?.get(0)?.code || ''
    expect(storedCode).not.toContain('<script>')
    expect(storedCode).not.toContain('</script>')
    expect(storedCode).not.toContain('alert(1)')
  })

  it('2.8 svg sanitize 剥除 onclick 保留合法元素', async () => {
    const { render } = useMarkdown()
    const svgWithOnclick =
      '<svg xmlns="http://www.w3.org/2000/svg"><circle onclick="alert(1)" r="40" fill="red"/></svg>'
    const result = await render('```svg\n' + svgWithOnclick + '\n```', 'github-light')
    const storedCode =
      result.sources?.get(0)?.code || ''
    expect(storedCode).not.toContain('onclick')
    expect(storedCode).toContain('<circle')
    expect(storedCode).toContain('r="40"')
    expect(storedCode).toContain('fill="red"')
  })

  it('2.9 svg sanitize 剥除 foreignObject（大小写不敏感）', async () => {
    const { render } = useMarkdown()
    const svgWithForeign =
      '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div>x</div></foreignObject><circle r="40"/></svg>'
    const result = await render('```svg\n' + svgWithForeign + '\n```', 'github-light')
    const storedCode =
      result.sources?.get(0)?.code || ''
    expect(storedCode.toLowerCase()).not.toContain('foreignobject')
  })

  // ── 2.10 DOMPurify ADD_ATTR 白名单 ─────────────────────────────────────
  it('2.10 整体 HTML 末尾 DOMPurify ADD_ATTR 白名单保留（新结构 data-lang）', async () => {
    const { render } = useMarkdown()
    const result = await render('```mermaid\ngraph TD\n```', 'github-light')
    // 白名单属性保留（新旧均有）
    expect(result.html).toContain('data-block-id')
    expect(result.html).toContain('data-index')
    // 新结构占位容器含 data-lang（旧无 → 红灯）
    expect(result.html).toContain('data-lang="mermaid"')
  })

  // ── 2.11 内联 svg 不走 registry ─────────────────────────────────────────
  it('2.11 内联 svg 不走 registry 路由', async () => {
    const { render } = useMarkdown()
    const inlineSvg = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="40"/></svg>'
    const result = await render('Inline: ' + inlineSvg, 'github-light')
    expect(result.html).not.toContain('svg-block')
    expect(result.sources.size).toBe(0)
    expect(result.sources?.size ?? 0).toBe(0)
  })

  // ── 2.12 codeViewHighlighter 差异 ──────────────────────────────────────
  it('2.12 codeViewHighlighter escape-html(同步) vs shiki-xml(异步)', async () => {
    const { render } = useMarkdown()
    const md = ['```mermaid', 'graph TD', '```', '', '```svg', '<svg/>', '```'].join('\n')
    const result = await render(md, 'github-light')
    // mermaid: escape-html 同步（codeViewHtml 存 sources，无 Shiki 包装）
    const mermaidSource = result.sources?.get(0)
    expect(mermaidSource?.codeViewHtml).toBeDefined()
    expect(mermaidSource?.codeViewHtml).not.toContain('class="shiki"')
    expect(mermaidSource?.codeViewHtml).toContain('graph TD')
    // svg: shiki-xml 异步（含 Shiki 输出）
    const svgSource = result.sources?.get(1)
    expect(svgSource?.codeViewHtml).toBeDefined()
    expect(svgSource?.codeViewHtml).toContain('shiki')
  })
})
