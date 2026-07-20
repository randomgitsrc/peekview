import { describe, it, expect } from 'vitest'
import { useMarkdown } from '../useMarkdown'

describe('E1: KaTeX boundary cases', () => {
  const { render } = useMarkdown()

  it('TC04-B04: unclosed $ delimiter degrades to plain text', async () => {
    const result = await render('$x^2 unclosed', 'github-light')
    const html = result.blocks.map(b => b.type === 'html' ? b.html : '').join('')
    expect(html).not.toContain('class="katex"')
  })

  it('TC05-B05: undefined command renders visible red error', async () => {
    const result = await render('$\\undefinedcmd$', 'github-light')
    const html = result.blocks.map(b => b.type === 'html' ? b.html : '').join('')
    expect(html).toContain('katex')
    expect(html).toMatch(/#cc0000|color.*red|mathcolor/)
  })

  it('TC09-B09: inline code $var does not trigger math', async () => {
    const result = await render('`$var`', 'github-light')
    const html = result.blocks.map(b => b.type === 'html' ? b.html : '').join('')
    expect(html).toContain('<code>')
    expect(html).toContain('$var')
    expect(html).not.toContain('class="katex"')
  })

  it('TC28-B28: link text $100 does not trigger math', async () => {
    const result = await render('[$100](https://example.com)', 'github-light')
    const html = result.blocks.map(b => b.type === 'html' ? b.html : '').join('')
    expect(html).not.toContain('class="katex"')
    expect(html).toContain('100')
  })

  it('TC30-B30: katex output exists even without fonts (structure check)', async () => {
    const result = await render('$x$', 'github-light')
    const html = result.blocks.map(b => b.type === 'html' ? b.html : '').join('')
    expect(html).toContain('class="katex"')
  })
})

describe('E2: Task list boundary cases', () => {
  const { render } = useMarkdown()

  it('TC13-B13: checkbox has disabled attribute (non-interactive)', async () => {
    const result = await render('- [x] done', 'github-light')
    const html = result.blocks.map(b => b.type === 'html' ? b.html : '').join('')
    expect(html).toContain('disabled')
  })
})

describe('E3: Footnote boundary cases', () => {
  const { render } = useMarkdown()

  it('TC17-B17: undefined footnote degrades to plain text', async () => {
    const result = await render('Hello[^1]', 'github-light')
    const html = result.blocks.map(b => b.type === 'html' ? b.html : '').join('')
    expect(html).not.toContain('footnote-ref')
  })
})

describe('E4: Sup/Sub boundary cases', () => {
  const { render } = useMarkdown()

  it('TC24-B24: empty delimiter x^^ degrades to plain text', async () => {
    const result = await render('x^^', 'github-light')
    const html = result.blocks.map(b => b.type === 'html' ? b.html : '').join('')
    expect(html).not.toContain('<sup></sup>')
  })

  it('TC24-B24: empty subscript H~~O degrades to plain text', async () => {
    const result = await render('H~~O', 'github-light')
    const html = result.blocks.map(b => b.type === 'html' ? b.html : '').join('')
    expect(html).not.toContain('<sub></sub>')
  })
})
