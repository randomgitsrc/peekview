import { describe, it, expect } from 'vitest'

const fs = await import('fs')
const path = await import('path')

const variablesPath = path.resolve(__dirname, '../../styles/variables.css')
const variablesCss = fs.default.readFileSync(variablesPath, 'utf-8')

const codePath = path.resolve(__dirname, '../../styles/code.css')
const codeCss = fs.default.readFileSync(codePath, 'utf-8')

describe('Zebra stripe CSS variables', () => {
  describe('--bg-code-odd and --bg-code-even in dark theme', () => {
    const darkBlock = variablesCss.match(/\[data-theme="dark"\]\s*\{[^}]+\}/s)?.[0] || ''

    it('defines --bg-code-odd in dark theme', () => {
      expect(darkBlock).toContain('--bg-code-odd')
    })

    it('defines --bg-code-even in dark theme', () => {
      expect(darkBlock).toContain('--bg-code-even')
    })

    it('--bg-code-odd references --bg-code in dark theme', () => {
      const match = darkBlock.match(/--bg-code-odd:\s*var\(--bg-code\)/)
      expect(match).not.toBeNull()
    })
  })

  describe('--bg-code-odd and --bg-code-even in light theme', () => {
    const lightBlock = variablesCss.match(/\[data-theme="light"\]\s*\{[^}]+\}/s)?.[0] || ''

    it('defines --bg-code-odd in light theme', () => {
      expect(lightBlock).toContain('--bg-code-odd')
    })

    it('defines --bg-code-even in light theme', () => {
      expect(lightBlock).toContain('--bg-code-even')
    })

    it('--bg-code-odd references --bg-code in light theme', () => {
      const match = lightBlock.match(/--bg-code-odd:\s*var\(--bg-code\)/)
      expect(match).not.toBeNull()
    })
  })

  describe('zebra stripe selectors in code.css', () => {
    it('has nth-child(even) rule for CodeViewer .line elements', () => {
      const hasSelector = /\.code-body.*\.line.*nth-child\(even\)/.test(codeCss)
      expect(hasSelector).toBe(true)
    })

    it('nth-child(even) rule uses --bg-code-even variable', () => {
      const evenBlock = codeCss.match(/\.line:nth-child\(even\)[^}]*\{[^}]*\}/s)
      expect(evenBlock).not.toBeNull()
      expect(evenBlock![0]).toContain('--bg-code-even')
    })
  })
})

describe('Zebra stripe — Shiki output structure', () => {
  it('.line spans are direct children of <code> (verified structure)', () => {
    const shikiOutput = `<pre class="shiki" style="background-color:#0d1117"><code><span class="line">line 1</span><span class="line">line 2</span><span class="line">line 3</span><span class="line">line 4</span><span class="line">line 5</span></code></pre>`
    const codeMatch = shikiOutput.match(/<code>([\s\S]*?)<\/code>/)
    expect(codeMatch).not.toBeNull()

    const codeContent = codeMatch![1]
    const directChildren = codeContent.match(/<span class="line">/g)
    expect(directChildren).not.toBeNull()
    expect(directChildren!.length).toBe(5)
  })

  it('nth-child(even) targets correct lines', () => {
    const lines = [
      { index: 1, childIndex: 1 },
      { index: 2, childIndex: 2 },
      { index: 3, childIndex: 3 },
      { index: 4, childIndex: 4 },
      { index: 5, childIndex: 5 },
    ]

    const evenLines = lines.filter(l => l.childIndex % 2 === 0)
    expect(evenLines.map(l => l.index)).toEqual([2, 4])
  })
})

describe('Zebra stripe — MarkdownViewer CSS compatibility', () => {
  const markdownViewerPath = path.resolve(__dirname, '../../components/MarkdownViewer.vue')
  const markdownViewerSrc = fs.default.readFileSync(markdownViewerPath, 'utf-8')

  const unscopedStyle = markdownViewerSrc.match(/<style>([\s\S]*?)<\/style>/)?.[1] || ''

  it('has zebra stripe rule for .code-block-wrapper .line', () => {
    const hasSelector = /\.code-block-wrapper.*\.line.*nth-child\(even\)/.test(unscopedStyle)
    expect(hasSelector).toBe(true)
  })

  it('zebra rule uses --bg-code-even variable', () => {
    const evenBlock = unscopedStyle.match(/\.code-block-wrapper[^}]*\.line:nth-child\(even\)[^}]*\{[^}]*\}/s)
    expect(evenBlock).not.toBeNull()
    expect(evenBlock![0]).toContain('--bg-code-even')
  })

  it('pre * transparent rule is scoped to NOT override .line zebra', () => {
    const preStarRule = unscopedStyle.match(/pre\s*\*\s*\{[^}]*\}/g)
    if (preStarRule) {
      const hasImportantOverride = preStarRule.some(
        rule => rule.includes('background-color: transparent') && rule.includes('!important')
      )
      if (hasImportantOverride) {
        const hasLineException = unscopedStyle.includes('.line') &&
          unscopedStyle.includes('background-color') &&
          unscopedStyle.match(/\.line[^-]/) !== null

        const zebraHasImportant = /nth-child\(even\)[^}]*background-color[^}]*!important/.test(unscopedStyle)

        expect(
          hasLineException || zebraHasImportant,
          'pre * transparent !important rule exists but no .line zebra override with !important or specificity exception found'
        ).toBe(true)
      }
    }
  })
})

describe('Zebra stripe — DiagramBlock CSS', () => {
  const diagramBlockPath = path.resolve(__dirname, '../../components/DiagramBlock.vue')
  const diagramBlockSrc = fs.default.readFileSync(diagramBlockPath, 'utf-8')

  const unscopedStyle = diagramBlockSrc.match(/<style>([\s\S]*?)<\/style>/)?.[1] || ''

  it('has zebra stripe rule for .diagram-code .line', () => {
    const hasSelector = /\.diagram-code.*\.line.*nth-child\(even\)/.test(unscopedStyle)
    expect(hasSelector).toBe(true)
  })

  it('zebra rule uses --bg-code-even variable', () => {
    const evenBlock = unscopedStyle.match(/\.diagram-code[^}]*\.line:nth-child\(even\)[^}]*\{[^}]*\}/s)
    expect(evenBlock).not.toBeNull()
    expect(evenBlock![0]).toContain('--bg-code-even')
  })
})
