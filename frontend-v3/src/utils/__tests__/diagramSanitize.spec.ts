import { describe, it, expect, vi } from 'vitest'
import { sanitize, sanitizeWithRetry, registerRule } from '../diagramSanitize'

describe('sanitize — deterministic corrections', () => {
  describe('plantuml', () => {
    it('prepends @startuml and appends @enduml when both missing (B-BDD-4)', () => {
      const code = 'Alice -> Bob: hello'
      const result = sanitize(code, 'plantuml')
      expect(result).toContain('@startuml')
      expect(result).toContain('@enduml')
      expect(result.indexOf('@startuml')).toBeLessThan(result.indexOf('Alice'))
      expect(result.indexOf('@enduml')).toBeGreaterThan(result.indexOf('Bob'))
    })

    it('keeps existing @startuml (B-BDD-4)', () => {
      const code = '@startuml\nAlice -> Bob: hello'
      const result = sanitize(code, 'plantuml')
      expect(result.startsWith('@startuml')).toBe(true)
    })

    it('appends @enduml when @startuml present but @enduml missing (B-BDD-4)', () => {
      const code = '@startuml\nAlice -> Bob: hello'
      const result = sanitize(code, 'plantuml')
      expect(result.endsWith('@enduml')).toBe(true)
    })

    it('does not duplicate @startuml or @enduml (B-BDD-4)', () => {
      const code = '@startuml\nAlice -> Bob: hello\n@enduml'
      const result = sanitize(code, 'plantuml')
      const startumlCount = (result.match(/@startuml/g) || []).length
      const endumlCount = (result.match(/@enduml/g) || []).length
      expect(startumlCount).toBe(1)
      expect(endumlCount).toBe(1)
    })
  })

  describe('mermaid', () => {
    it('normalizes arrow syntax (B-BDD-4)', () => {
      const code = 'A ->> B: msg'
      const result = sanitize(code, 'mermaid')
      expect(result).not.toContain(' ->> ')
    })

    it('handles valid mermaid without changes (B-BDD-4)', () => {
      const code = 'graph TD\nA[Start] --> B[End]'
      const result = sanitize(code, 'mermaid')
      expect(result).toBe(code)
    })
  })

  describe('svg', () => {
    it('closes unclosed self-closing tags (B-BDD-4)', () => {
      const code = '<svg><rect width="100" height="50"><circle r="10"></svg>'
      const result = sanitize(code, 'svg')
      expect(result).toContain('/>')
    })

    it('fixes unquoted attribute values (B-BDD-4)', () => {
      const code = '<rect width=100 height=50 />'
      const result = sanitize(code, 'svg')
      expect(result).toContain('"100"')
      expect(result).toContain('"50"')
    })
  })

  describe('edge cases', () => {
    it('returns original code for unknown engine (P2 review)', () => {
      const code = 'anything at all'
      expect(sanitize(code, 'unknown')).toBe(code)
    })

    it('returns empty string for empty input (P2 review)', () => {
      expect(sanitize('', 'mermaid')).toBe('')
      expect(sanitize('', 'plantuml')).toBe('')
      expect(sanitize('', 'svg')).toBe('')
    })

    it('handles nullish engine gracefully', () => {
      const code = 'test'
      expect(sanitize(code, '' as any)).toBe(code)
    })
  })
})

describe('sanitizeWithRetry — two-phase pipeline', () => {
  it('returns original with appliedHeuristics=false on deterministic success (B-BDD-5)', () => {
    const code = 'graph TD\nA --> B'
    const result = sanitizeWithRetry(code, 'mermaid')
    expect(result.code).toBeTruthy()
    expect(result.appliedHeuristics).toBe(false)
  })

  it('applies heuristic corrections on deterministic failure then retries (B-BDD-5)', () => {
    const code = 'graph TD\nA ->> B: msg'
    const result = sanitizeWithRetry(code, 'mermaid')
    expect(result.appliedHeuristics).toBe(true)
    expect(result.code).not.toContain(' ->> ')
  })

  it('maximum two rounds: deterministic then heuristic (B-BDD-5)', () => {
    const code = 'A ->> B'
    const result = sanitizeWithRetry(code, 'mermaid')
    expect(result.code).toBeTruthy()
  })
})

describe('registerRule — extensible rule registry', () => {
  it('registers a deterministic rule and applies it (B-BDD-6)', () => {
    const myRule = (code: string) => code.replace(/foo/g, 'bar')
    registerRule('mermaid', 'myRule', myRule, 'deterministic')

    const result = sanitize('foo -> foo', 'mermaid')
    expect(result).toContain('bar -> bar')
  })

  it('registers a heuristic rule and applies on retry (B-BDD-6)', () => {
    const myHeuristic = (code: string) => code + '\nnote over A: fixed'
    registerRule('plantuml', 'heuristicTest', myHeuristic, 'heuristic')

    const result = sanitizeWithRetry('Alice -> Bob', 'plantuml')
    expect(result.appliedHeuristics).toBe(true)
    expect(result.code).toContain('note over A: fixed')
  })

  it('warns and skips on duplicate rule name (P2 review)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const rule1 = (c: string) => c
    const rule2 = (c: string) => c + 'x'

    registerRule('mermaid', 'dupRule', rule1, 'deterministic')
    registerRule('mermaid', 'dupRule', rule2, 'deterministic')

    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
