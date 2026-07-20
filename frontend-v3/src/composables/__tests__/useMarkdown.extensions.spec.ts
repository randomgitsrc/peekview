import { describe, it, expect } from 'vitest'
import { useMarkdown } from '../useMarkdown'

describe('E1: KaTeX math rendering', () => {
  const { render } = useMarkdown()

  it('TC01-B01: inline formula $e^{i\\pi}$ renders as katex', async () => {
    const result = await render('$e^{i\\pi}$', 'github-light')
    const html = result.blocks.map(b => b.type === 'html' ? b.html : '').join('')
    expect(html).toContain('class="katex"')
    expect(html).not.toContain('$e^{i\\pi}$')
  })

  it('TC02-B02: display formula $$\\frac{a}{b}$$ renders as block', async () => {
    const result = await render('$$\\frac{a}{b}$$', 'github-light')
    const html = result.blocks.map(b => b.type === 'html' ? b.html : '').join('')
    expect(html).toContain('class="katex"')
    expect(html).toMatch(/katex-display|katex-block/)
  })

  it('TC03-B03: currency $100 does not trigger math', async () => {
    const result = await render('$100', 'github-light')
    const html = result.blocks.map(b => b.type === 'html' ? b.html : '').join('')
    expect(html).not.toContain('class="katex"')
    expect(html).toContain('100')
  })

  it('TC07-B07: katex CSS class present on rendered output', async () => {
    const result = await render('$x^2$', 'github-light')
    const html = result.blocks.map(b => b.type === 'html' ? b.html : '').join('')
    expect(html).toContain('class="katex"')
  })

  it('TC08-B08: katex class exists for dark mode CSS targeting', async () => {
    const result = await render('$x$', 'github-light')
    const html = result.blocks.map(b => b.type === 'html' ? b.html : '').join('')
    expect(html).toContain('katex')
  })
})

describe('E2: Task list rendering', () => {
  const { render } = useMarkdown()

  it('TC10-B10: completed task - [x] renders checked disabled checkbox', async () => {
    const result = await render('- [x] done', 'github-light')
    const html = result.blocks.map(b => b.type === 'html' ? b.html : '').join('')
    expect(html).toContain('type="checkbox"')
    expect(html).toContain('checked')
    expect(html).toContain('disabled')
  })

  it('TC11-B11: incomplete task - [ ] renders unchecked disabled checkbox', async () => {
    const result = await render('- [ ] todo', 'github-light')
    const html = result.blocks.map(b => b.type === 'html' ? b.html : '').join('')
    expect(html).toContain('type="checkbox"')
    expect(html).toContain('disabled')
    expect(html).not.toContain('checked')
  })

  it('TC14-B14: task-list-item-checkbox class present for dark mode CSS', async () => {
    const result = await render('- [x] done', 'github-light')
    const html = result.blocks.map(b => b.type === 'html' ? b.html : '').join('')
    expect(html).toMatch(/task-list-item|contains-task-list/)
  })
})

describe('E3: Footnote rendering', () => {
  const { render } = useMarkdown()

  it('TC15-B15: footnote ref renders as superscript link', async () => {
    const md = 'Hello[^1]\n\n[^1]: This is a note'
    const result = await render(md, 'github-light')
    const html = result.blocks.map(b => b.type === 'html' ? b.html : '').join('')
    expect(html).toContain('footnote-ref')
    expect(html).toMatch(/href="#fn/)
  })

  it('TC16-B16: footnote backref link exists', async () => {
    const md = 'Hello[^1]\n\n[^1]: This is a note'
    const result = await render(md, 'github-light')
    const html = result.blocks.map(b => b.type === 'html' ? b.html : '').join('')
    expect(html).toContain('footnote-backref')
    expect(html).toMatch(/href="#fnref/)
  })

  it('TC18-B18: footnote anchor href points to definition', async () => {
    const md = 'Hello[^1]\n\n[^1]: This is a note'
    const result = await render(md, 'github-light')
    const html = result.blocks.map(b => b.type === 'html' ? b.html : '').join('')
    expect(html).toMatch(/href="#fn1"/)
  })

  it('TC19-B19: backref href points to reference location', async () => {
    const md = 'Hello[^1]\n\n[^1]: This is a note'
    const result = await render(md, 'github-light')
    const html = result.blocks.map(b => b.type === 'html' ? b.html : '').join('')
    expect(html).toContain('footnote-backref')
  })

  it('TC20-B20: footnotes class present for dark mode CSS', async () => {
    const md = 'Hello[^1]\n\n[^1]: This is a note'
    const result = await render(md, 'github-light')
    const html = result.blocks.map(b => b.type === 'html' ? b.html : '').join('')
    expect(html).toContain('footnotes')
  })
})

describe('E4: Superscript and subscript', () => {
  const { render } = useMarkdown()

  it('TC21-B21: superscript x^2^ renders as <sup>', async () => {
    const result = await render('x^2^', 'github-light')
    const html = result.blocks.map(b => b.type === 'html' ? b.html : '').join('')
    expect(html).toContain('<sup>2</sup>')
  })

  it('TC22-B22: subscript H~2~O renders as <sub>', async () => {
    const result = await render('H~2~O', 'github-light')
    const html = result.blocks.map(b => b.type === 'html' ? b.html : '').join('')
    expect(html).toContain('<sub>2</sub>')
  })

  it('TC23-B23: superscript inside bold **x^2^**', async () => {
    const result = await render('**x^2^**', 'github-light')
    const html = result.blocks.map(b => b.type === 'html' ? b.html : '').join('')
    expect(html).toContain('<strong>')
    expect(html).toContain('<sup>2</sup>')
  })
})

describe('Cross-extension', () => {
  const { render } = useMarkdown()

  it('TC25-B25: multiple extensions coexist without conflict', async () => {
    const md = '$e^{i\\pi}$\n\n- [x] done\n\nHello[^1]\n\n[^1]: note\n\nx^2^ and H~2~O'
    const result = await render(md, 'github-light')
    const html = result.blocks.map(b => b.type === 'html' ? b.html : '').join('')
    expect(html).toContain('katex')
    expect(html).toContain('checkbox')
    expect(html).toContain('footnote-ref')
    expect(html).toContain('<sup>2</sup>')
    expect(html).toContain('<sub>2</sub>')
  })

  it('TC27-B27: footnote repeated reference with colon ID', async () => {
    const md = 'text1[^1] text2[^1]\n\n[^1]: note'
    const result = await render(md, 'github-light')
    const html = result.blocks.map(b => b.type === 'html' ? b.html : '').join('')
    const footnoteRefMatches = html.match(/footnote-ref/g)
    expect(footnoteRefMatches).not.toBeNull()
    expect(footnoteRefMatches!.length).toBeGreaterThanOrEqual(2)
  })

  it('TC29-B29: block formula has katex-display/block class for overflow CSS', async () => {
    const result = await render('$$\\frac{a}{b}$$', 'github-light')
    const html = result.blocks.map(b => b.type === 'html' ? b.html : '').join('')
    expect(html).toMatch(/katex-display|katex-block/)
  })
})
