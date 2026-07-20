import { describe, it, expect } from 'vitest'
import DOMPurify from 'dompurify'
import { useMarkdown } from '../useMarkdown'

const PURIFY_CONFIG = {
  ADD_ATTR: ['data-action', 'data-code', 'data-line', 'data-block-id', 'data-index', 'data-mode', 'data-peekview-file-id', 'target', 'rel'],
  ADD_TAGS: ['button'],
}

describe('DOMPurify + KaTeX interaction', () => {
  const { render } = useMarkdown()

  it('TC06-B06: DOMPurify preserves katex output structure', async () => {
    const result = await render('$\\frac{a}{b}$', 'github-light')
    const html = result.blocks.map(b => b.type === 'html' ? b.html : '').join('')
    expect(html).toContain('class="katex"')
    expect(html).toMatch(/class="katex-html"|class="katex-mathml"/)
  })

  it('TC06-B06: katex class attributes survive DOMPurify', async () => {
    const result = await render('$x^2$', 'github-light')
    const html = result.blocks.map(b => b.type === 'html' ? b.html : '').join('')
    const katexClassMatches = html.match(/class="[^"]*katex[^"]*"/g)
    expect(katexClassMatches).not.toBeNull()
    expect(katexClassMatches!.length).toBeGreaterThanOrEqual(1)
  })

  it('TC06-B06: katex style attributes survive DOMPurify', async () => {
    const result = await render('$\\frac{a}{b}$', 'github-light')
    const html = result.blocks.map(b => b.type === 'html' ? b.html : '').join('')
    expect(html).toMatch(/style="[^"]*"/)
  })
})

describe('DOMPurify + Task list interaction', () => {
  it('TC12-B12: DOMPurify preserves checkbox with checked and disabled', () => {
    const raw = '<input type="checkbox" checked disabled class="task-list-item-checkbox">'
    const out = DOMPurify.sanitize(raw, PURIFY_CONFIG)
    expect(out).toContain('type="checkbox"')
    expect(out).toContain('checked')
    expect(out).toContain('disabled')
  })

  it('TC12-B12: DOMPurify preserves unchecked checkbox', () => {
    const raw = '<input type="checkbox" disabled class="task-list-item-checkbox">'
    const out = DOMPurify.sanitize(raw, PURIFY_CONFIG)
    expect(out).toContain('type="checkbox"')
    expect(out).toContain('disabled')
    expect(out).not.toContain('checked')
  })
})

describe('DOMPurify + existing features (regression)', () => {
  const { render } = useMarkdown()

  it('TC26-B26: table rendering unaffected by new plugins', async () => {
    const md = '| a | b |\n|---|---|\n| 1 | 2 |'
    const result = await render(md, 'github-light')
    const html = result.blocks.map(b => b.type === 'html' ? b.html : '').join('')
    expect(html).toContain('<table')
    expect(html).toContain('<td')
  })

  it('TC26-B26: strikethrough rendering unaffected', async () => {
    const md = '~~deleted~~'
    const result = await render(md, 'github-light')
    const html = result.blocks.map(b => b.type === 'html' ? b.html : '').join('')
    expect(html).toMatch(/<s>deleted<\/s>|<del>deleted<\/del>/)
  })

  it('TC26-B26: code block rendering unaffected', async () => {
    const md = '```python\nprint("hello")\n```'
    const result = await render(md, 'github-light')
    const codeBlocks = result.blocks.filter(b => b.type === 'html')
    expect(codeBlocks.length).toBeGreaterThanOrEqual(1)
    const html = codeBlocks.map(b => b.html).join('')
    expect(html).toContain('code-block-wrapper')
  })
})
