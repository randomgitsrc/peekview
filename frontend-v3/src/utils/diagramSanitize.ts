type RuleFn = (code: string) => string
type RuleType = 'deterministic' | 'heuristic'

interface RuleEntry {
  name: string
  fn: RuleFn
  type: RuleType
}

interface SanitizeResult {
  code: string
  appliedHeuristics: boolean
}

const rules: Record<string, RuleEntry[]> = {}

function ensureEngine(engine: string): void {
  if (!rules[engine]) {
    rules[engine] = []
  }
}

export function registerRule(engine: string, name: string, fn: RuleFn, type: RuleType): void {
  ensureEngine(engine)
  const existing = rules[engine].find(r => r.name === name)
  if (existing) {
    console.warn(`[diagramSanitize] Rule "${name}" already registered for engine "${engine}", skipping`)
    return
  }
  rules[engine].push({ name, fn, type })
}

function applyRules(code: string, engine: string, type: RuleType): string {
  const engineRules = rules[engine]
  if (!engineRules) return code
  let result = code
  for (const rule of engineRules) {
    if (rule.type === type) {
      result = rule.fn(result)
    }
  }
  return result
}

export function sanitize(code: string, engine: string): string {
  if (!code) return ''
  if (!rules[engine]) return code
  return applyRules(code, engine, 'deterministic')
}

export function sanitizeWithRetry(code: string, engine: string): SanitizeResult {
  if (!code) return { code: '', appliedHeuristics: false }
  if (!rules[engine]) return { code, appliedHeuristics: false }

  const deterministic = applyRules(code, engine, 'deterministic')
  const changedByDeterministic = deterministic !== code

  if (!changedByDeterministic) {
    const heuristic = applyRules(deterministic, engine, 'heuristic')
    const changedByHeuristic = heuristic !== deterministic
    return { code: heuristic, appliedHeuristics: changedByHeuristic }
  }

  const heuristic = applyRules(deterministic, engine, 'heuristic')
  return { code: heuristic, appliedHeuristics: true }
}

const KEYWORD_MAP: Record<string, string> = {
  'graph': 'graph',
  'flowchart': 'flowchart',
  'sequencediagram': 'sequenceDiagram',
  'classdiagram': 'classDiagram',
  'erdiagram': 'erDiagram',
  'gantt': 'gantt',
  'pie': 'pie',
  'statediagram-v2': 'stateDiagram-v2',
  'journey': 'journey',
  'mindmap': 'mindmap',
  'timeline': 'timeline',
  'sankey-beta': 'sankey-beta',
  'quadrantchart': 'quadrantChart',
  'xychart-beta': 'xychart-beta',
  'block-beta': 'block-beta',
  'gitgraph': 'gitGraph',
}

const DIRECTION_RE = /^(graph|flowchart)\s+(tb|td|bt|lr|rl)\b/i
const KEYWORD_LINE_RE = /^(graph|flowchart|sequenceDiagram|classDiagram|erDiagram|gantt|pie|stateDiagram-v2|journey|mindmap|timeline|sankey-beta|quadrantChart|xychart-beta|block-beta|gitGraph)\b/i

registerRule('mermaid', 'fix-keyword-case', (code: string) => {
  const lines = code.split('\n')
  if (lines.length === 0) return code
  let firstLine = lines[0]

  const keywordMatch = firstLine.match(KEYWORD_LINE_RE)
  if (!keywordMatch) return code

  const wrongKeyword = keywordMatch[1]
  const lowerKeyword = wrongKeyword.toLowerCase()
  const correctKeyword = KEYWORD_MAP[lowerKeyword]
  if (!correctKeyword) return code

  firstLine = firstLine.replace(wrongKeyword, correctKeyword)

  const dirMatch = firstLine.match(DIRECTION_RE)
  if (dirMatch) {
    const dir = dirMatch[2].toUpperCase()
    firstLine = firstLine.replace(dirMatch[2], dir)
  }

  lines[0] = firstLine
  return lines.join('\n')
}, 'deterministic')

registerRule('mermaid', 'fix-missing-newline', (code: string) => {
  code = code.replace(/^(graph|flowchart)\s+(TB|TD|BT|LR|RL)([^\n\S]*)(\S)/im, '$1 $2\n$4')
  code = code.replace(/^(sequenceDiagram|gitGraph)([^\n\S]*)(\S)/im, '$1\n$3')
  return code
}, 'deterministic')

function extractLabels(code: string): { code: string; placeholders: Map<string, string> } {
  const placeholders = new Map<string, string>()
  let counter = 0

  // Step 1: Extract labeled shapes whose content may include fullwidth
  // characters. We protect the entire shape so fix-fullwidth-syntax does
  // not touch the label content (per P1 analysis: fullwidth chars inside
  // labels are valid mermaid syntax).
  const shapeRe = /\{[^{}]*\}/g
  code = code.replace(shapeRe, (match) => {
    const key = `__PV_PH_${counter}__`
    placeholders.set(key, match)
    counter++
    return key
  })

  // Step 2: Extract bracket pairs [...] and (...) by scanning from the
  // inside out. We use a single-pass stack-based extraction: for each
  // open char, find the next matching close char, and if there is
  // content between them, replace the span with a placeholder.
  //
  // To prevent the extracted content (which itself may contain brackets)
  // from being re-matched against outer brackets, we walk from right to
  // left — innermost pairs are extracted first, so outer scans see the
  // placeholders (which contain no brackets) and skip them safely.
  const pairs: [string, string][] = [['[', ']'], ['(', ')']]
  for (const [open, close] of pairs) {
    let iter = 0
    while (iter < 10000) {
      iter++
      // Find the rightmost `close` that has a matching `open` to its left.
      let openIdx = -1
      let closeIdx = -1
      let depth = 0
      for (let i = code.length - 1; i >= 0; i--) {
        const c = code[i]
        if (c === close) {
          if (closeIdx === -1) closeIdx = i
          depth++
        } else if (c === open) {
          depth--
          if (depth === 0) {
            openIdx = i
            break
          }
        }
      }
      if (openIdx === -1 || closeIdx === -1) break
      if (openIdx + 1 < closeIdx) {
        const inner = code.substring(openIdx + 1, closeIdx)
        const key = `__PV_PH_${counter}__`
        placeholders.set(key, open + inner + close)
        counter++
        code = code.substring(0, openIdx) + key + code.substring(closeIdx + 1)
      } else {
        // Empty pair (e.g. []) — erase it from `code` to prevent the
        // outer scan from re-matching it.
        code = code.substring(0, openIdx) + code.substring(openIdx + 2)
      }
    }
  }

  return { code, placeholders }
}

function restoreLabels(code: string, placeholders: Map<string, string>): string {
  const keys = Array.from(placeholders.keys()).sort((a, b) => {
    const numA = parseInt(a.match(/(\d+)/)?.[1] || '0')
    const numB = parseInt(b.match(/(\d+)/)?.[1] || '0')
    return numB - numA
  })
  for (const key of keys) {
    code = code.replace(key, placeholders.get(key)!)
  }
  return code
}

const MERMAID_FULLWIDTH_MAP: Record<string, string> = {
  '\uff08': '(',
  '\uff09': ')',
  '\u3010': '[',
  '\u3011': ']',
  '\uff1a': ':',
  '\u2192': '-->',
  '\u201c': '"',
  '\u201d': '"',
}

registerRule('mermaid', 'fix-fullwidth-syntax', (code: string) => {
  const { code: extracted, placeholders } = extractLabels(code)
  let result = extracted
  for (const [fw, ascii] of Object.entries(MERMAID_FULLWIDTH_MAP)) {
    result = result.split(fw).join(ascii)
  }
  result = restoreLabels(result, placeholders)
  return result
}, 'deterministic')

registerRule('mermaid', 'fix-arrows', (code: string) => {
  // Always strip BOM and leading blank lines when we recognize a diagram
  // type — otherwise downstream first-line checks (e.g. fix-keyword-case
  // on a different rule) will see BOM as the first character.
  let result = code

  let stripped = code.replace(/^\uFEFF/, '').replace(/^\n+/, '')
  const firstLine = stripped.split('\n')[0] || ''
  const isSequence = /^(sequenceDiagram|sequence-diagram)/i.test(firstLine)
  const isGraph = /^(graph|flowchart)\s/i.test(firstLine)

  if (!isSequence && !isGraph) return code

  result = result.replace(/^\uFEFF/, '').replace(/^\n+/, '')

  if (isGraph) {
    // Normalize `-->>` (3-char malformed) to `-.->` (dotted open arrow)
    // BEFORE protecting `-->`, so we don't accidentally re-interpret
    // part of `-->>` as a valid `-->`.
    result = result.replace(/-->>/g, '\u0000D\u0000')
    // Protect remaining already-correct arrows with sentinels.
    const PROTECT = '\u0000A\u0000'
    const DASHED = '\u0000B\u0000'
    result = result.replace(/-->/g, PROTECT)
    result = result.replace(/-\.->/g, DASHED)
    // Normalize malformed arrows to `-->` (solid link).
    result = result.replace(/->>?=?/g, '-->')
    result = result.replace(/=+>/g, '-->')
    result = result.replace(/-x>+/g, '-x')
    // Restore protected arrows.
    result = result.replace(new RegExp(PROTECT, 'g'), '-->')
    result = result.replace(new RegExp(DASHED, 'g'), '-.->')
    result = result.replace(/\u0000D\u0000/g, '-.->')
  }

  if (isSequence) {
    result = result.replace(/->>>/g, '->>')
    result = result.replace(/--->>/g, '-->>')
  }

  return result
}, 'deterministic')

registerRule('mermaid', 'strip-plantuml-markers', (code: string) => {
  return code.replace(/@startuml\b/gi, '').replace(/@enduml\b/gi, '')
}, 'deterministic')

registerRule('mermaid', 'strip-null-bytes', (code: string) => {
  return code.replace(/\0/g, '')
}, 'deterministic')

const MERMAID_LEADING_WS_RE = /^ +/gm
const MERMAID_EMPTY_LINE_RE = /\n{3,}/g

registerRule('mermaid', 'strip-leading-whitespace', (code: string) => {
  return code.replace(MERMAID_LEADING_WS_RE, '').replace(MERMAID_EMPTY_LINE_RE, '\n\n')
}, 'heuristic')

registerRule('plantuml', 'ensure-start-end', (code: string) => {
  const trimmed = code.trim()
  const hasStart = /^@start\w+/m.test(trimmed)
  const hasEnd = /^@end\w+/m.test(trimmed)

  let result = code
  if (!hasStart) {
    result = `@startuml\n${result}`
  }
  if (!hasEnd) {
    result = `${result}\n@enduml`
  }
  return result
}, 'deterministic')

const PLANTUML_FULLWIDTH_MAP: Record<string, string> = {
  '\uff1a': ':',
  '\u2192': '->',
}

registerRule('plantuml', 'fix-fullwidth-syntax', (code: string) => {
  let result = code
  for (const [fw, ascii] of Object.entries(PLANTUML_FULLWIDTH_MAP)) {
    result = result.split(fw).join(ascii)
  }
  return result
}, 'deterministic')

registerRule('plantuml', 'fix-whitespace', (code: string) => {
  return code.replace(/\r\n/g, '\n').replace(/\t/g, '  ')
}, 'heuristic')

const SVG_FULLWIDTH_MAP: Record<string, string> = {
  '\u201c': '"',
  '\u201d': '"',
  '\uff1d': '=',
}

registerRule('svg', 'fix-fullwidth-syntax', (code: string) => {
  let result = code
  for (const [fw, ascii] of Object.entries(SVG_FULLWIDTH_MAP)) {
    result = result.split(fw).join(ascii)
  }
  return result
}, 'deterministic')

registerRule('svg', 'fix-unquoted-attrs', (code: string) => {
  return code.replace(/(\w[\w-]*)=(\d+(?:\.\d+)?)/g, '$1="$2"')
}, 'deterministic')

registerRule('svg', 'close-unclosed-voids', (code: string) => {
  const voidTags = ['rect', 'circle', 'ellipse', 'line', 'path', 'polygon', 'polyline', 'use', 'image', 'tspan', 'g', 'defs', 'clipPath', 'mask', 'linearGradient', 'radialGradient', 'stop', 'filter', 'feGaussianBlur', 'feOffset', 'feMerge', 'feMergeNode', 'feFlood', 'feColorMatrix', 'feComposite', 'feBlend', 'feTile', 'feDropShadow']
  let result = code
  for (const tag of voidTags) {
    const re = new RegExp(`<${tag}([^>]*[^/])>`, 'g')
    result = result.replace(re, `<${tag}$1 />`)
  }
  return result
}, 'deterministic')
