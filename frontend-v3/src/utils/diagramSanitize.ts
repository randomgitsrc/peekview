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

const MERMAID_ARROW_RE = /(\s*)->>(\s*)/g
const MERMAID_LEADING_WS_RE = /^ +/gm
const MERMAID_EMPTY_LINE_RE = /\n{3,}/g

registerRule('mermaid', 'normalize-arrows', (code: string) => {
  return code.replace(MERMAID_ARROW_RE, '$1-->>$2')
}, 'deterministic')

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

registerRule('plantuml', 'fix-whitespace', (code: string) => {
  return code.replace(/\r\n/g, '\n').replace(/\t/g, '  ')
}, 'heuristic')

registerRule('svg', 'fix-unquoted-attrs', (code: string) => {
  return code.replace(/(\w[\w-]*)=(\d+(?:\.\d+)?)/g, '$1="$2"')
}, 'deterministic')

registerRule('svg', 'close-unclosed-voids', (code: string) => {
  const voidTags = ['rect', 'circle', 'ellipse', 'line', 'path', 'polygon', 'polyline', 'use', 'image', 'text', 'tspan', 'g', 'defs', 'clipPath', 'mask', 'linearGradient', 'radialGradient', 'stop', 'filter', 'feGaussianBlur', 'feOffset', 'feMerge', 'feMergeNode', 'feFlood', 'feColorMatrix', 'feComposite', 'feBlend', 'feTile', 'feDropShadow']
  let result = code
  for (const tag of voidTags) {
    const re = new RegExp(`<${tag}([^>]*[^/])>`, 'g')
    result = result.replace(re, `<${tag}$1 />`)
  }
  return result
}, 'deterministic')
