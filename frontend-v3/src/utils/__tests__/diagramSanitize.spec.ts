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

  describe('mermaid — fix-keyword-case', () => {
    it('gitgraph → gitGraph', () => {
      const result = sanitize('gitgraph\n  commit id: "A"', 'mermaid')
      expect(result.startsWith('gitGraph')).toBe(true)
    })

    it('Graph TD → graph TD', () => {
      const result = sanitize('Graph TD\n  A --> B', 'mermaid')
      expect(result.startsWith('graph TD')).toBe(true)
    })

    it('SEQUENCEDIAGRAM → sequenceDiagram', () => {
      const result = sanitize('SEQUENCEDIAGRAM\n  A->>B: msg', 'mermaid')
      expect(result.startsWith('sequenceDiagram')).toBe(true)
    })

    it('sequencediagram → sequenceDiagram', () => {
      const result = sanitize('sequencediagram\n  A->>B: msg', 'mermaid')
      expect(result.startsWith('sequenceDiagram')).toBe(true)
    })

    it('Flowchart LR → flowchart LR', () => {
      const result = sanitize('Flowchart LR\n  A --> B', 'mermaid')
      expect(result.startsWith('flowchart LR')).toBe(true)
    })

    it('ClassDiagram → classDiagram', () => {
      const result = sanitize('ClassDiagram\n  class A\n    A : string name', 'mermaid')
      expect(result.startsWith('classDiagram')).toBe(true)
    })

    it('ErDiagram → erDiagram', () => {
      const result = sanitize('ErDiagram\n  CUSTOMER ||--o{ ORDER : places', 'mermaid')
      expect(result.startsWith('erDiagram')).toBe(true)
    })

    it('Gantt → gantt', () => {
      const result = sanitize('Gantt\n  title A\n  section S\n  Task :a, 2024-01-01, 1d', 'mermaid')
      expect(result.startsWith('gantt')).toBe(true)
    })

    it('Pie → pie', () => {
      const result = sanitize('Pie title Pets\n  "Dogs" : 50', 'mermaid')
      expect(result.startsWith('pie')).toBe(true)
    })

    it('StateDiagram-v2 → stateDiagram-v2', () => {
      const result = sanitize('StateDiagram-v2\n  [*] --> Active', 'mermaid')
      expect(result.startsWith('stateDiagram-v2')).toBe(true)
    })

    it('Journey → journey', () => {
      const result = sanitize('Journey\n  title My day', 'mermaid')
      expect(result.startsWith('journey')).toBe(true)
    })

    it('Mindmap → mindmap', () => {
      const result = sanitize('Mindmap\n  root((mindmap))', 'mermaid')
      expect(result.startsWith('mindmap')).toBe(true)
    })

    it('Timeline → timeline', () => {
      const result = sanitize('Timeline\n  title History', 'mermaid')
      expect(result.startsWith('timeline')).toBe(true)
    })

    it('Sankey-beta → sankey-beta', () => {
      const result = sanitize('Sankey-beta\n  A,B,10', 'mermaid')
      expect(result.startsWith('sankey-beta')).toBe(true)
    })

    it('QuadrantChart → quadrantChart', () => {
      const result = sanitize('QuadrantChart\n  title Test', 'mermaid')
      expect(result.startsWith('quadrantChart')).toBe(true)
    })

    it('Xychart-beta → xychart-beta', () => {
      const result = sanitize('Xychart-beta\n  title "Test"', 'mermaid')
      expect(result.startsWith('xychart-beta')).toBe(true)
    })

    it('Block-beta → block-beta', () => {
      const result = sanitize('Block-beta\n  columns 3', 'mermaid')
      expect(result.startsWith('block-beta')).toBe(true)
    })

    it('graph td → graph TD (direction uppercase)', () => {
      const result = sanitize('graph td\n  A --> B', 'mermaid')
      expect(result.startsWith('graph TD')).toBe(true)
    })

    it('correct keyword unchanged', () => {
      const code = 'graph TD\n  A --> B'
      const result = sanitize(code, 'mermaid')
      expect(result).toBe(code)
    })
  })

  describe('mermaid — fix-missing-newline', () => {
    it('graph TBsubgraph → graph TB\\nsubgraph', () => {
      const result = sanitize('graph TBsubgraph S\n  A --> B\nend', 'mermaid')
      expect(result).toBe('graph TB\nsubgraph S\n  A --> B\nend')
    })

    it('graph TDsubgraph → graph TD\\nsubgraph', () => {
      const result = sanitize('graph TDsubgraph S\n  A --> B\nend', 'mermaid')
      expect(result).toBe('graph TD\nsubgraph S\n  A --> B\nend')
    })

    it('graph LRsubgraph → graph LR\\nsubgraph', () => {
      const result = sanitize('graph LRsubgraph S\n  A --> B\nend', 'mermaid')
      expect(result).toBe('graph LR\nsubgraph S\n  A --> B\nend')
    })

    it('graph RLsubgraph → graph RL\\nsubgraph', () => {
      const result = sanitize('graph RLsubgraph S\n  A --> B\nend', 'mermaid')
      expect(result).toBe('graph RL\nsubgraph S\n  A --> B\nend')
    })

    it('graph BTsubgraph → graph BT\\nsubgraph', () => {
      const result = sanitize('graph BTsubgraph S\n  A --> B\nend', 'mermaid')
      expect(result).toBe('graph BT\nsubgraph S\n  A --> B\nend')
    })

    it('flowchart TBsubgraph → flowchart TB\\nsubgraph', () => {
      const result = sanitize('flowchart TBsubgraph S\n  A --> B\nend', 'mermaid')
      expect(result).toBe('flowchart TB\nsubgraph S\n  A --> B\nend')
    })

    it('flowchart LRsubgraph → flowchart LR\\nsubgraph', () => {
      const result = sanitize('flowchart LRsubgraph S\n  A --> B\nend', 'mermaid')
      expect(result).toBe('flowchart LR\nsubgraph S\n  A --> B\nend')
    })

    it('sequenceDiagramA → sequenceDiagram\\nA', () => {
      const result = sanitize('sequenceDiagramA->>B: msg', 'mermaid')
      expect(result).toBe('sequenceDiagram\nA->>B: msg')
    })

    it('gitGraphcommit → gitGraph\\ncommit', () => {
      const result = sanitize('gitGraphcommit id: "A"', 'mermaid')
      expect(result).toBe('gitGraph\ncommit id: "A"')
    })

    it('graph TDA[B] → graph TD\\nA[B]', () => {
      const result = sanitize('graph TDA[B] --> C', 'mermaid')
      expect(result).toBe('graph TD\nA[B] --> C')
    })

    it('already has newline unchanged', () => {
      const code = 'graph TD\n  A --> B'
      const result = sanitize(code, 'mermaid')
      expect(result).toBe(code)
    })
  })

  describe('mermaid — fix-fullwidth-syntax', () => {
    it('\uff08\uff09\u2192 () shape delimiter', () => {
      const result = sanitize('graph TD\n  A\uff08text\uff09--> B[text]', 'mermaid')
      expect(result).toBe('graph TD\n  A(text)--> B[text]')
    })

    it('\u3010\u3011\u2192 [] shape delimiter', () => {
      const result = sanitize('graph TD\n  A\u3010text\u3011--> B[text]', 'mermaid')
      expect(result).toBe('graph TD\n  A[text]--> B[text]')
    })

    it('\uff1a\u2192 : colon', () => {
      const result = sanitize('sequenceDiagram\n  A->>B\uff1a\u6d88\u606f', 'mermaid')
      expect(result).toBe('sequenceDiagram\n  A->>B:\u6d88\u606f')
    })

    it('\u2192 \u2192 --> arrow', () => {
      const result = sanitize('graph TD\n  A \u2192 B', 'mermaid')
      expect(result).toBe('graph TD\n  A --> B')
    })

    it('\u201c\u201d \u2192 "" quotes', () => {
      const result = sanitize('graph TD\n  A-->\u201cB\u201d', 'mermaid')
      expect(result).toBe('graph TD\n  A-->"B"')
    })

    it('\uff08\uff09 in label preserved', () => {
      const code = 'graph TD\n  A[\u6570\u636e\uff08\u4e2d\u6587\uff09] --> B'
      const result = sanitize(code, 'mermaid')
      expect(result).toBe(code)
    })

    it('\u3010\u3011 in label preserved', () => {
      const code = 'graph TD\n  A[\u6570\u636e\u3010\u4e2d\u6587\u3011] --> B'
      const result = sanitize(code, 'mermaid')
      expect(result).toBe(code)
    })

    it('\u201c\u201d in label preserved', () => {
      const code = 'graph TD\n  A[\u201c\u4e2d\u6587\u201d] --> B'
      const result = sanitize(code, 'mermaid')
      expect(result).toBe(code)
    })

it('nested shape A[(text)]', () => {
      const result = sanitize('graph TD\n  A[（数据）] --> B[(store)]', 'mermaid')
      expect(result).toBe('graph TD\n  A[（数据）] --> B[(store)]')
    })

    it('unclosed bracket kept as-is', () => {
      const result = sanitize('graph TD\n  A[text with \u3010bracket] --> B', 'mermaid')
      expect(result).toContain('\u3010')
    })

    it('placeholder no conflict', () => {
      const result = sanitize('graph TD\n  A[text1] --> B[text2] --> C[text3]', 'mermaid')
      expect(result).not.toContain('__PV_PH_')
    })
  })

  describe('mermaid — fix-arrows', () => {
    it('->> in graph \u2192 -->', () => {
      const result = sanitize('graph TD\n  A ->> B', 'mermaid')
      expect(result).toBe('graph TD\n  A --> B')
    })

    it('-->> in graph \u2192 -.->', () => {
      const result = sanitize('graph TD\n  A -->> B', 'mermaid')
      expect(result).toBe('graph TD\n  A -.-> B')
    })

    it('-> in graph \u2192 -->', () => {
      const result = sanitize('graph TD\n  A -> B', 'mermaid')
      expect(result).toBe('graph TD\n  A --> B')
    })

    it('=> in graph \u2192 -->', () => {
      const result = sanitize('graph TD\n  A => B', 'mermaid')
      expect(result).toBe('graph TD\n  A --> B')
    })

    it('-x> in graph \u2192 -x', () => {
      const result = sanitize('graph TD\n  A -x> B', 'mermaid')
      expect(result).toBe('graph TD\n  A -x B')
    })

    it('->>> in sequence \u2192 ->>', () => {
      const result = sanitize('sequenceDiagram\n  A->>>B: msg', 'mermaid')
      expect(result).toBe('sequenceDiagram\n  A->>B: msg')
    })

    it('--->> in sequence \u2192 -->>', () => {
      const result = sanitize('sequenceDiagram\n  A--->>B: msg', 'mermaid')
      expect(result).toBe('sequenceDiagram\n  A-->>B: msg')
    })

    it('no context \u2192 no change', () => {
      const code = 'A ->> B'
      const result = sanitize(code, 'mermaid')
      expect(result).toBe(code)
    })

    it('BOM + sequenceDiagram', () => {
      const result = sanitize('\uFEFFsequenceDiagram\n  A->>>B: msg', 'mermaid')
      expect(result).toBe('sequenceDiagram\n  A->>B: msg')
    })
  })

  describe('mermaid — strip-plantuml-markers', () => {
    it('@startuml removed', () => {
      const result = sanitize('@startuml\n  A --> B', 'mermaid')
      expect(result).toBe('\n  A --> B')
    })

    it('@enduml removed', () => {
      const result = sanitize('@startuml\n  A --> B\n@enduml', 'mermaid')
      expect(result).toBe('\n  A --> B\n')
    })
  })

  describe('mermaid — strip-null-bytes', () => {
    it('removes \\0', () => {
      const result = sanitize('graph TD\n  A --> \u0000B', 'mermaid')
      expect(result).toBe('graph TD\n  A --> B')
    })
  })

  describe('mermaid — normalize-arrows removed', () => {
    it('rule no longer replaces ->> with -->>', () => {
      const result = sanitize('graph TD\n  A ->> B', 'mermaid')
      expect(result).not.toContain('-->>')
      expect(result).toContain('-->')
    })
  })

  describe('mermaid — rule execution order', () => {
    it('fix-keyword-case before fix-missing-newline', () => {
      const result = sanitize('Graph TDsubgraph S\n  A --> B\nend', 'mermaid')
      expect(result).toBe('graph TD\nsubgraph S\n  A --> B\nend')
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

  describe('plantuml — fix-fullwidth-syntax', () => {
    it('\uff1a\u2192 :', () => {
      const result = sanitize('@startuml\nAlice \uff1ahello\n@enduml', 'plantuml')
      expect(result).toContain('Alice :hello')
    })

    it('\u2192 \u2192 ->', () => {
      const result = sanitize('@startuml\nAlice \u2192 Bob: hello\n@enduml', 'plantuml')
      expect(result).toContain('Alice -> Bob: hello')
    })
  })

  describe('svg — fix-fullwidth-syntax', () => {
    it('\u201c\u201d \u2192 ""', () => {
      const result = sanitize('<text fill=\u201cred\u201d>Hi</text>', 'svg')
      expect(result).toBe('<text fill="red">Hi</text>')
    })

    it('\uff1d \u2192 =', () => {
      const result = sanitize('<rect width\uff1d100 />', 'svg')
      expect(result).toBe('<rect width="100" />')
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
