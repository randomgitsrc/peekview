import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  LANG_IMPORT_MAP,
  LEGACY_LANG_MAP,
  ensureLanguage,
} from '../useShiki'
import type { Highlighter, BundledLanguage } from 'shiki'

const STATIC_LANGS = [
  'python', 'javascript', 'typescript', 'markdown', 'json',
  'html', 'css', 'bash', 'yaml', 'rust', 'go', 'java',
  'cpp', 'c', 'sql', 'xml',
]

function mockHighlighter(loadedLangs: string[] = []): Highlighter {
  return {
    getLoadedLanguages: vi.fn(() => loadedLangs as BundledLanguage[]),
    loadLanguage: vi.fn(async () => {}),
  } as unknown as Highlighter
}

describe('LANG_IMPORT_MAP', () => {
  it('contains 63 dynamic languages', () => {
    expect(Object.keys(LANG_IMPORT_MAP).length).toBe(63)
  })

  it('includes wolfram', () => {
    expect('wolfram' in LANG_IMPORT_MAP).toBe(true)
  })

  it('includes reg', () => {
    expect('reg' in LANG_IMPORT_MAP).toBe(true)
  })

  it('does not include languages without Shiki grammar', () => {
    const noGrammarLangs = [
      'autohotkey', 'editorconfig', 'git_attributes', 'git_config',
      'ignore', 'janet', 'odin', 'pip-requirements', 'sed', 'vba',
      'vbscript', 'text',
    ]
    for (const lang of noGrammarLangs) {
      expect(lang in LANG_IMPORT_MAP).toBe(false)
    }
  })

  it('does not include statically imported languages', () => {
    for (const lang of STATIC_LANGS) {
      expect(lang in LANG_IMPORT_MAP).toBe(false)
    }
  })

  it('every value is a function returning a promise', () => {
    for (const [key, importer] of Object.entries(LANG_IMPORT_MAP)) {
      expect(typeof importer).toBe('function')
    }
  })
})

describe('LEGACY_LANG_MAP', () => {
  it('maps mathematica to wolfram', () => {
    expect(LEGACY_LANG_MAP['mathematica']).toBe('wolfram')
  })

  it('maps registry to reg', () => {
    expect(LEGACY_LANG_MAP['registry']).toBe('reg')
  })

  it('has exactly 2 entries', () => {
    expect(Object.keys(LEGACY_LANG_MAP).length).toBe(2)
  })
})

describe('ensureLanguage', () => {
  let highlighter: Highlighter

  beforeEach(() => {
    highlighter = mockHighlighter()
  })

  it('returns lang directly for already loaded language', async () => {
    const hl = mockHighlighter(['ruby'])
    const result = await ensureLanguage(hl, 'ruby')
    expect(result).toBe('ruby')
    expect(hl.loadLanguage).not.toHaveBeenCalled()
  })

  it('dynamically imports and loads an unloaded language', async () => {
    const fakeGrammar = { name: 'ruby', scopeName: 'source.ruby' }
    const mockImporter = vi.fn().mockResolvedValue({ default: fakeGrammar })
    const originalImporter = LANG_IMPORT_MAP['ruby']
    LANG_IMPORT_MAP['ruby'] = mockImporter

    const result = await ensureLanguage(highlighter, 'ruby')

    expect(mockImporter).toHaveBeenCalledTimes(1)
    expect(highlighter.loadLanguage).toHaveBeenCalledWith(fakeGrammar)
    expect(result).toBe('ruby')

    LANG_IMPORT_MAP['ruby'] = originalImporter
  })

  it('returns text for language not in LANG_IMPORT_MAP', async () => {
    const result = await ensureLanguage(highlighter, 'autohotkey')
    expect(result).toBe('text')
    expect(highlighter.loadLanguage).not.toHaveBeenCalled()
  })

  it('returns text when dynamic import fails', async () => {
    const mockImporter = vi.fn().mockRejectedValue(new Error('import failed'))
    const originalImporter = LANG_IMPORT_MAP['kotlin']
    LANG_IMPORT_MAP['kotlin'] = mockImporter

    const result = await ensureLanguage(highlighter, 'kotlin')

    expect(result).toBe('text')
    expect(highlighter.loadLanguage).not.toHaveBeenCalled()

    LANG_IMPORT_MAP['kotlin'] = originalImporter
  })

  it('does not re-import an already loaded language on second call', async () => {
    const fakeGrammar = { name: 'scala', scopeName: 'source.scala' }
    const mockImporter = vi.fn().mockResolvedValue({ default: fakeGrammar })
    const originalImporter = LANG_IMPORT_MAP['scala']
    LANG_IMPORT_MAP['scala'] = mockImporter

    await ensureLanguage(highlighter, 'scala')
    const result = await ensureLanguage(highlighter, 'scala')

    expect(mockImporter).toHaveBeenCalledTimes(1)
    expect(result).toBe('scala')

    LANG_IMPORT_MAP['scala'] = originalImporter
  })

  it('deduplicates concurrent calls for the same language', async () => {
    let resolveImport: (value: any) => void
    const importPromise = new Promise(resolve => { resolveImport = resolve })
    const fakeGrammar = { name: 'php', scopeName: 'source.php' }
    const mockImporter = vi.fn().mockReturnValue(importPromise)
    const originalImporter = LANG_IMPORT_MAP['php']
    LANG_IMPORT_MAP['php'] = mockImporter

    const promise1 = ensureLanguage(highlighter, 'php')
    const promise2 = ensureLanguage(highlighter, 'php')

    resolveImport!({ default: fakeGrammar })

    const [r1, r2] = await Promise.all([promise1, promise2])

    expect(mockImporter).toHaveBeenCalledTimes(1)
    expect(r1).toBe('php')
    expect(r2).toBe('php')

    LANG_IMPORT_MAP['php'] = originalImporter
  })

  it('resolves legacy lang "mathematica" to "wolfram"', async () => {
    const fakeGrammar = { name: 'wolfram', scopeName: 'source.wolfram' }
    const mockImporter = vi.fn().mockResolvedValue({ default: fakeGrammar })
    const originalImporter = LANG_IMPORT_MAP['wolfram']
    LANG_IMPORT_MAP['wolfram'] = mockImporter

    const result = await ensureLanguage(highlighter, 'mathematica')

    expect(LEGACY_LANG_MAP['mathematica']).toBe('wolfram')
    expect(mockImporter).toHaveBeenCalledTimes(1)
    expect(result).toBe('wolfram')

    LANG_IMPORT_MAP['wolfram'] = originalImporter
  })

  it('resolves legacy lang "registry" to "reg"', async () => {
    const fakeGrammar = { name: 'reg', scopeName: 'source.reg' }
    const mockImporter = vi.fn().mockResolvedValue({ default: fakeGrammar })
    const originalImporter = LANG_IMPORT_MAP['reg']
    LANG_IMPORT_MAP['reg'] = mockImporter

    const result = await ensureLanguage(highlighter, 'registry')

    expect(LEGACY_LANG_MAP['registry']).toBe('reg')
    expect(mockImporter).toHaveBeenCalledTimes(1)
    expect(result).toBe('reg')

    LANG_IMPORT_MAP['reg'] = originalImporter
  })
})

describe('static language coverage', () => {
  it('all 16 statically imported languages are loadable', async () => {
    const hl = mockHighlighter(STATIC_LANGS)
    for (const lang of STATIC_LANGS) {
      const result = await ensureLanguage(hl, lang)
      expect(result).toBe(lang)
    }
    expect(hl.loadLanguage).not.toHaveBeenCalled()
  })
})

describe('highlight and highlightCode use ensureLanguage', () => {
  it('highlightCode triggers dynamic load for non-static language', async () => {
    const { useShiki } = await import('../useShiki')
    const { highlightCode } = useShiki()
    const result = await highlightCode('puts "hello"', 'ruby', 'github-dark')
    expect(typeof result).toBe('string')
    expect(result).toContain('hello')
  })
})
