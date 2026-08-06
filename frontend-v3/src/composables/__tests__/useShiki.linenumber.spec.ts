import { describe, it, expect, vi, beforeEach } from 'vitest'

// vitest mock hoisting: vi.mock() callbacks run before imports.
// Only string literals allowed inside the factory — no external vars.
// Mock the 'shiki' module so createHighlighter returns a fake highlighter
// whose codeToHtml mimics real Shiki 1.x behavior: it does NOT trim the
// trailing newline, so code.split('\n') produces a trailing empty line.
// This makes tests RED before P4 implementation (assertion failure = B class)
// and GREEN after P4 trims the code before feeding both codeToHtml and
// renderLineNumbers.
vi.mock('shiki', () => {
  const fakeHighlighter = {
    getLoadedLanguages: () => ['python', 'javascript', 'text'],
    loadLanguage: async () => {},
    codeToHtml: (code: string, _opts: { lang: string; theme: string }): string => {
      // Mimic real Shiki: do NOT trim trailing newline. Each split segment
      // becomes a .line, including the trailing empty string from a trailing \n.
      const lines = code.split('\n')
      const lineSpans = lines
        .map((l) => `<span class="line">${l}</span>`)
        .join('')
      return `<pre class="shiki"><code>${lineSpans}</code></pre>`
    },
  }
  return {
    createHighlighter: () => Promise.resolve(fakeHighlighter),
  }
})

import { useShiki } from '../useShiki'

// Parse the HTML returned by highlight()/highlightCode() and count elements
// matching a CSS selector within the .code-container root.
function countInContainer(html: string, selector: string): number {
  // jsdom DOMParser is available in the vitest jsdom environment.
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  return doc.querySelectorAll(`.code-container ${selector}`).length
}

describe('T087 BDD-1: trailing newline produces correct line count', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('highlight("a\\nb\\n") yields 2 line-numbers and 2 .line (both equal)', async () => {
    const { highlight } = useShiki()
    const html = await highlight('a\nb\n', 'python', 'github-dark')

    const lineNumbers = countInContainer(html, '.line-numbers .line-number')
    const lines = countInContainer(html, '.line')

    // Three-way alignment: line-number count == .line count == logical lines (2)
    expect(lineNumbers).toBe(2)
    expect(lines).toBe(2)
    expect(lineNumbers).toBe(lines)
  })
})

describe('T087 BDD-2: no trailing newline produces correct line count', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('highlight("a\\nb") yields 2 line-numbers and 2 .line (both equal)', async () => {
    const { highlight } = useShiki()
    const html = await highlight('a\nb', 'python', 'github-dark')

    const lineNumbers = countInContainer(html, '.line-numbers .line-number')
    const lines = countInContainer(html, '.line')

    expect(lineNumbers).toBe(2)
    expect(lines).toBe(2)
    expect(lineNumbers).toBe(lines)
  })
})

describe('T087 BDD-3: single line no newline produces correct line count', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('highlight("a") yields 1 line-number and 1 .line (both equal)', async () => {
    const { highlight } = useShiki()
    const html = await highlight('a', 'python', 'github-dark')

    const lineNumbers = countInContainer(html, '.line-numbers .line-number')
    const lines = countInContainer(html, '.line')

    expect(lineNumbers).toBe(1)
    expect(lines).toBe(1)
    expect(lineNumbers).toBe(lines)
  })
})

describe('T087 BDD-4: empty string at pure-function layer still aligns', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('highlight("") yields 1 line-number and 1 .line (both equal, aligned)', async () => {
    // CodeViewer component short-circuits empty content (doHighlight line 88-91),
    // so this path is not triggered in the app. At the pure-function layer,
    // "" must still produce aligned columns (1 == 1) per P1 [SUGGEST].
    const { highlight } = useShiki()
    const html = await highlight('', 'python', 'github-dark')

    const lineNumbers = countInContainer(html, '.line-numbers .line-number')
    const lines = countInContainer(html, '.line')

    expect(lineNumbers).toBe(1)
    expect(lines).toBe(1)
    expect(lineNumbers).toBe(lines)
  })
})

describe('T087 BDD-5: newline-only file produces correct line count', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('highlight("\\n") yields 1 line-number and 1 .line (both equal)', async () => {
    const { highlight } = useShiki()
    const html = await highlight('\n', 'python', 'github-dark')

    const lineNumbers = countInContainer(html, '.line-numbers .line-number')
    const lines = countInContainer(html, '.line')

    expect(lineNumbers).toBe(1)
    expect(lines).toBe(1)
    expect(lineNumbers).toBe(lines)
  })
})

describe('T087 BDD-6: mid empty line + trailing newline produces correct line count', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('highlight("a\\n\\n") yields 2 line-numbers and 2 .line (mid empty line preserved)', async () => {
    const { highlight } = useShiki()
    const html = await highlight('a\n\n', 'python', 'github-dark')

    const lineNumbers = countInContainer(html, '.line-numbers .line-number')
    const lines = countInContainer(html, '.line')

    // Logical lines: "a\n".split('\n') => ["a",""] => 2. Mid empty line
    // (the second \n) is preserved as line 2; only the trailing \n is trimmed.
    expect(lineNumbers).toBe(2)
    expect(lines).toBe(2)
    expect(lineNumbers).toBe(lines)
  })
})

describe('T087 BDD-7: Markdown code-block path aligns via highlightCode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('highlightCode("a\\nb\\n") yields 2 line-numbers and 2 .line (both equal)', async () => {
    const { highlightCode } = useShiki()
    const html = await highlightCode('a\nb\n', 'python', 'github-dark')

    const lineNumbers = countInContainer(html, '.line-numbers .line-number')
    const lines = countInContainer(html, '.line')

    expect(lineNumbers).toBe(2)
    expect(lines).toBe(2)
    expect(lineNumbers).toBe(lines)
  })
})

describe('T087 BDD-7b: highlightCode shares trim with highlight (no regression)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('highlightCode single-line no-newline aligns', async () => {
    const { highlightCode } = useShiki()
    const html = await highlightCode('a', 'python', 'github-dark')

    const lineNumbers = countInContainer(html, '.line-numbers .line-number')
    const lines = countInContainer(html, '.line')

    expect(lineNumbers).toBe(1)
    expect(lines).toBe(1)
    expect(lineNumbers).toBe(lines)
  })

  it('highlightCode newline-only aligns', async () => {
    const { highlightCode } = useShiki()
    const html = await highlightCode('\n', 'python', 'github-dark')

    const lineNumbers = countInContainer(html, '.line-numbers .line-number')
    const lines = countInContainer(html, '.line')

    expect(lineNumbers).toBe(1)
    expect(lines).toBe(1)
    expect(lineNumbers).toBe(lines)
  })
})
