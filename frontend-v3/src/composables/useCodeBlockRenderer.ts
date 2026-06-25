import { ref } from 'vue'
import { useMermaid } from '@/composables/useMermaid'
import * as usePlantUML from '@/composables/usePlantUML'
import { useShiki } from '@/composables/useShiki'

export interface BlockSource {
  lang: 'mermaid' | 'plantuml' | 'svg' | string
  code: string
  svgContent?: string
  codeViewHtml?: string
  error?: string
}

export function useCodeBlockRenderer() {
  const { highlightCode } = useShiki()

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

  function getMermaidSvgByIndex(index: number): string {
    return sourcesMap.get(index)?.svgContent ?? ''
  }
  function getPlantUmlSvgByIndex(index: number): string {
    return sourcesMap.get(index)?.svgContent ?? ''
  }
  function getCodeViewHtml(index: number): string | undefined {
    return sourcesMap.get(index)?.codeViewHtml
  }
  function getError(index: number): string | undefined {
    return sourcesMap.get(index)?.error
  }

  async function preRenderMermaid(index: number, code: string, theme: string, codeViewHtml: string): Promise<void> {
    const key = `${theme}-${code}`
    try {
      let svg = mermaidCache.get(key)
      if (!svg) {
        const { render: renderMermaid } = useMermaid()
        svg = await renderMermaid(String(index), code, theme.includes('dark') ? 'dark' : 'light')
        mermaidCache.set(key, svg)
      }
      sourcesMap.set(index, { lang: 'mermaid', code, svgContent: svg, codeViewHtml })
    } catch (err) {
      console.error('Mermaid render failed:', err)
      sourcesMap.set(index, { lang: 'mermaid', code, codeViewHtml, error: 'Failed to render diagram' })
    }
  }
  async function preRenderPlantUml(index: number, code: string, theme: string, codeViewHtml: string): Promise<void> {
    try {
      const svg = await usePlantUML.render(code, theme.includes('dark') ? 'dark' : 'light')
      sourcesMap.set(index, { lang: 'plantuml', code, svgContent: svg, codeViewHtml })
    } catch (err) {
      console.error('PlantUML render failed:', err)
      sourcesMap.set(index, { lang: 'plantuml', code, codeViewHtml, error: 'plantuml-validate-failed' })
    }
  }
  async function registerSvg(index: number, code: string, theme: string): Promise<void> {
    let codeViewHtml = ''
    try {
      codeViewHtml = await highlightCode(code, 'xml', theme.includes('dark') ? 'github-dark' : 'github-light')
    } catch (err) {
      console.error('SVG Shiki highlight failed:', err)
    }
    sourcesMap.set(index, { lang: 'svg', code, svgContent: code, codeViewHtml })
  }

  async function renderMermaidFresh(code: string, theme: string): Promise<string> {
    const { render: renderMermaid } = useMermaid()
    return await renderMermaid(String(Date.now()), code, theme.includes('dark') ? 'dark' : 'light')
  }
  async function renderPlantUmlFresh(code: string, theme: string): Promise<string> {
    return await usePlantUML.render(code, theme.includes('dark') ? 'dark' : 'light')
  }

  async function svgToPng(svgString: string, opts: {
    width: number; height: number;
    background: '#ffffff' | 'transparent';
    filename: string;
  }): Promise<void> {
    const parser = new DOMParser()
    const doc = parser.parseFromString(svgString, 'image/svg+xml')
    const svgEl = doc.documentElement
    if (!svgEl.getAttribute('xmlns')) {
      svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    }
    const serializer = new XMLSerializer()
    const serialized = serializer.serializeToString(svgEl)
    const svgBase64 = btoa(unescape(encodeURIComponent(serialized)))
    const dataUrl = `data:image/svg+xml;base64,${svgBase64}`

    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = reject
      img.src = dataUrl
    })

    const canvas = document.createElement('canvas')
    canvas.width = opts.width
    canvas.height = opts.height
    const ctx = canvas.getContext('2d')!

    if (opts.background !== 'transparent') {
      ctx.fillStyle = opts.background
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }

    ctx.drawImage(img, 0, 0, opts.width, opts.height)

    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = opts.filename
      a.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }

  function nextToken(): number { return ++renderToken.value }
  function isCurrent(token: number): boolean { return token === renderToken.value }

  function registerInstance(lang: string, id: string, inst: any) {
    instances[lang as keyof typeof instances].set(id, inst)
  }
  function unregisterInstance(lang: string, id: string) {
    instances[lang as keyof typeof instances].delete(id)
  }
  function getInstance(lang: string, id: string) {
    return instances[lang as keyof typeof instances].get(id)
  }

  function beginResize(id: string, y: number, h: number) {
    resizingBlock.value = id; startY.value = y; startHeight.value = h
  }
  function endResize() { resizingBlock.value = null }

  function clearInstances() {
    instances.mermaid.clear(); instances.plantuml.clear(); instances.svg.clear()
  }

  return {
    mermaidCache, sourcesMap, renderToken, instances,
    resizingBlock, startY, startHeight,
    getMermaidSvgByIndex, getPlantUmlSvgByIndex, getCodeViewHtml, getError,
    preRenderMermaid, preRenderPlantUml, registerSvg,
    renderMermaidFresh, renderPlantUmlFresh, svgToPng,
    nextToken, isCurrent,
    registerInstance, unregisterInstance, getInstance,
    beginResize, endResize, clearInstances,
  }
}
