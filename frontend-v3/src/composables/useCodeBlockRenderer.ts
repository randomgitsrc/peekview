// STUB - P3b 创建，P4 实现
import { ref } from 'vue'

export interface BlockSource {
  lang: 'mermaid' | 'plantuml' | 'svg' | string
  code: string
  svgContent?: string
  codeViewHtml?: string
  error?: string
}

export function useCodeBlockRenderer() {
  const mermaidCache = new Map<string, string>()
  const sourcesMap = new Map<number, BlockSource>()
  const renderToken = ref(0)
  const instances = {
    mermaid: new Map<string, any>(),
    plantuml: new Map<string, any>(),
    svg: new Map<string, any>(),
  }
  const resizingBlock = ref<string | null>(null)
  const startY = ref(0)
  const startHeight = ref(0)

  function getMermaidSvgByIndex(_index: number): string { return '' }
  function getPlantUmlSvgByIndex(_index: number): string { return '' }
  function getCodeViewHtml(_index: number): string | undefined { return undefined }
  function getError(_index: number): string | undefined { return undefined }
  async function preRenderMermaid(_i: number, _c: string, _t: string, _cv: string): Promise<void> {}
  async function preRenderPlantUml(_i: number, _c: string, _t: string, _cv: string): Promise<void> {}
  async function registerSvg(_i: number, _c: string, _t: string): Promise<void> {}
  async function renderMermaidFresh(_c: string, _t: string): Promise<string> { return '' }
  async function renderPlantUmlFresh(_c: string, _t: string): Promise<string> { return '' }
  function nextToken(): number { return 0 }
  function isCurrent(_t: number): boolean { return false }
  function registerInstance(_l: string, _i: string, _inst: any) {}
  function unregisterInstance(_l: string, _i: string) {}
  function getInstance(_l: string, _i: string) { return undefined }
  function beginResize(_id: string, _y: number, _h: number) {}
  function endResize() {}
  function clearInstances() {}

  return {
    mermaidCache, sourcesMap, renderToken, instances,
    resizingBlock, startY, startHeight,
    getMermaidSvgByIndex, getPlantUmlSvgByIndex, getCodeViewHtml, getError,
    preRenderMermaid, preRenderPlantUml, registerSvg,
    renderMermaidFresh, renderPlantUmlFresh,
    nextToken, isCurrent,
    registerInstance, unregisterInstance, getInstance,
    beginResize, endResize, clearInstances,
  }
}
