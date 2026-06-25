// STUB src/composables/diagramRegistry.ts - P3b 创建，P4 实现
export interface DiagramTypeMeta {
  lang: string
  classPrefix: string
  label: string
  codeViewHighlighter: 'escape-html' | 'shiki-xml'
  sanitize?: (code: string) => string
}

const diagramRegistry = new Map<string, DiagramTypeMeta>()

export function registerDiagramType(_meta: DiagramTypeMeta) {}   // STUB: 不写入

export function getDiagramType(_lang: string): DiagramTypeMeta | undefined { return undefined }

export function getAllDiagramTypes(): DiagramTypeMeta[] { return [] }

export { diagramRegistry }
