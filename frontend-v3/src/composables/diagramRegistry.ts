import DOMPurify, { type Config } from 'dompurify'

export interface DiagramTypeMeta {
  lang: string
  classPrefix: string
  label: string
  codeViewHighlighter: 'escape-html' | 'shiki-xml'
  sanitize?: (code: string) => string
}

const SVG_SANITIZE_CONFIG: Config = {
  ADD_ATTR: ['data-action', 'data-code', 'data-line', 'data-block-id', 'data-index', 'data-mode', 'target', 'rel'],
  ADD_TAGS: ['button'],
}

const diagramRegistry = new Map<string, DiagramTypeMeta>([
  ['mermaid', { lang: 'mermaid', classPrefix: 'mermaid', label: 'MERMAID', codeViewHighlighter: 'escape-html' }],
  ['plantuml', { lang: 'plantuml', classPrefix: 'plantuml', label: 'PLANTUML', codeViewHighlighter: 'escape-html' }],
  ['svg', {
    lang: 'svg',
    classPrefix: 'svg',
    label: 'SVG',
    codeViewHighlighter: 'shiki-xml',
    sanitize: (code: string) => DOMPurify.sanitize(code, SVG_SANITIZE_CONFIG),
  }],
])

export function registerDiagramType(meta: DiagramTypeMeta) {
  diagramRegistry.set(meta.lang, meta)
}

export function getDiagramType(lang: string): DiagramTypeMeta | undefined {
  return diagramRegistry.get(lang)
}

export function getAllDiagramTypes(): DiagramTypeMeta[] {
  return Array.from(diagramRegistry.values())
}

export { diagramRegistry }
