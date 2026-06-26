import { describe, it, expect, vi, beforeEach } from 'vitest'
import { h, render as vueRender, defineComponent, type Component } from 'vue'
import path from 'path'
import fs from 'fs'

const {
  mermaidRenderMock,
  plantUmlRenderMock,
  highlightCodeMock,
} = vi.hoisted(() => ({
  mermaidRenderMock: vi.fn(),
  plantUmlRenderMock: vi.fn(),
  highlightCodeMock: vi.fn(),
}))

vi.mock('@/composables/useMermaid', () => ({
  useMermaid: () => ({ render: mermaidRenderMock }),
}))

vi.mock('@/composables/usePlantUML', () => ({
  render: plantUmlRenderMock,
  validateSource: vi.fn(() => ({ ok: true })),
  ensureLoaded: vi.fn(async () => {}),
  _setPlantUmlRender: vi.fn(),
  _setTimeout: vi.fn(),
}))

vi.mock('@/composables/useShiki', () => ({
  useShiki: () => ({ highlightCode: highlightCodeMock }),
}))

vi.mock('svg-pan-zoom', () => ({
  default: vi.fn(() => ({
    zoomIn: vi.fn(), zoomOut: vi.fn(), reset: vi.fn(), center: vi.fn(),
    destroy: vi.fn(), resize: vi.fn(), fit: vi.fn(), on: vi.fn(),
    getZoom: vi.fn(() => 1), zoom: vi.fn(), panBy: vi.fn(),
    getPan: vi.fn(() => ({ x: 0, y: 0 })),
  })),
}))

import { useCodeBlockRenderer } from '@/composables/useCodeBlockRenderer'

const MockMermaid = defineComponent({ name: 'MockMermaid', props: ['blockIndex','blockId','svgContent','codeViewHtml','theme'], template: '<div class="mock-mermaid"/>' })
const MockPlantUml = defineComponent({ name: 'MockPlantUml', props: ['blockIndex','blockId','svgContent','codeViewHtml','theme'], template: '<div class="mock-plantuml"/>' })
const MockSvg = defineComponent({ name: 'MockSvg', props: ['blockIndex','blockId','svgContent','codeViewHtml','theme'], template: '<div class="mock-svg"/>' })

type MountCall = { component: Component; props: Record<string, unknown> }

function createMountLoopHarness() {
  const hCalls: MountCall[] = []

  const wrapperRegistry = new Map<string, Component>([
    ['mermaid', MockMermaid],
    ['plantuml', MockPlantUml],
    ['svg', MockSvg],
  ])

  function mountAllDiagrams(
    sourcesMap: Map<number, { lang: string; code: string; svgContent?: string; codeViewHtml?: string }>,
    container: HTMLElement,
    token: number,
    isCurrentFn: (t: number) => boolean,
    registerInstanceFn: (lang: string, id: string, inst: any) => void,
  ) {
    for (const [index, source] of sourcesMap) {
      if (!isCurrentFn(token)) return

      const Wrapper = wrapperRegistry.get(source.lang)
      if (!Wrapper) continue

      const prefix = source.lang as 'mermaid' | 'plantuml' | 'svg'
      const blockId = `${prefix}-block-${index}`
      const mountPoint = container.querySelector(`.${prefix}-block[data-index="${index}"]`) as HTMLElement
      if (!mountPoint || (mountPoint as HTMLElement).dataset.rendered === 'true') continue

      const vNode = h(Wrapper, {
        blockIndex: index,
        blockId,
        svgContent: source.svgContent ?? '',
        codeViewHtml: source.codeViewHtml ?? '',
        theme: 'light' as const,
      })
      hCalls.push({ component: Wrapper, props: vNode.props as Record<string, unknown> })
      vueRender(vNode, mountPoint)

      const inst = (vNode as any).component?.exposed ?? (vNode as any).component?.proxy
      registerInstanceFn(source.lang, blockId, inst)

      ;(mountPoint as HTMLElement).dataset.rendered = 'true'
    }
  }

  return { hCalls, wrapperRegistry, mountAllDiagrams }
}

function readMarkdownViewerSrc(): string {
  return fs.readFileSync(path.join(__dirname, '..', '..', 'MarkdownViewer.vue'), 'utf8')
}

describe('mount-loop-unified', () => {
  beforeEach(() => {
    mermaidRenderMock.mockReset()
    plantUmlRenderMock.mockReset()
    highlightCodeMock.mockReset()
    mermaidRenderMock.mockResolvedValue('<svg>mock-mermaid</svg>')
    plantUmlRenderMock.mockResolvedValue('<svg>mock-plantuml</svg>')
    highlightCodeMock.mockResolvedValue('<shiki>highlighted</shiki>')
    document.body.innerHTML = ''
  })

  describe('TC-M1: unified mount loop routing', () => {
    it('M1.1 mount loop routes via wrapperRegistry; MarkdownViewer no longer has three separate render functions', () => {
      const { hCalls, mountAllDiagrams } = createMountLoopHarness()
      const registerInstanceFn = vi.fn()
      const isCurrentFn = vi.fn().mockReturnValue(true)

      const sourcesMap = new Map<number, { lang: string; code: string; svgContent?: string; codeViewHtml?: string }>([
        [0, { lang: 'mermaid' as const, code: 'graph TD', svgContent: '<svg>m</svg>', codeViewHtml: '<pre>m</pre>' }],
        [1, { lang: 'plantuml' as const, code: '@startuml\nA->B\n@enduml', svgContent: '<svg>p</svg>', codeViewHtml: '<pre>p</pre>' }],
        [2, { lang: 'svg' as const, code: '<svg><circle/></svg>', svgContent: '<svg>s</svg>', codeViewHtml: '<pre>s</pre>' }],
      ])

      const container = document.createElement('div')
      container.innerHTML = `
        <div class="mermaid-block" data-index="0"></div>
        <div class="plantuml-block" data-index="1"></div>
        <div class="svg-block" data-index="2"></div>
      `
      document.body.appendChild(container)

      mountAllDiagrams(sourcesMap, container, 1, isCurrentFn, registerInstanceFn)

      expect(hCalls.length).toBe(3)
      expect(hCalls[0]!.component).toBe(MockMermaid)
      expect(hCalls[0]!.props.blockIndex).toBe(0)
      expect(hCalls[1]!.component).toBe(MockPlantUml)
      expect(hCalls[1]!.props.blockIndex).toBe(1)
      expect(hCalls[2]!.component).toBe(MockSvg)
      expect(hCalls[2]!.props.blockIndex).toBe(2)

      const src = readMarkdownViewerSrc()
      const hasThreeSeparate = src.includes('renderMermaidDiagrams') || src.includes('renderPlantUmlDiagrams') || src.includes('renderSvgBlocks')
      expect(hasThreeSeparate).toBe(false)
      expect(src).toContain('wrapperRegistry')
    })

    it('M1.2 unknown lang skips mount without error', () => {
      const { hCalls, mountAllDiagrams } = createMountLoopHarness()
      const registerInstanceFn = vi.fn()
      const isCurrentFn = vi.fn().mockReturnValue(true)

      const sourcesMap = new Map<number, { lang: string; code: string; svgContent?: string; codeViewHtml?: string }>([
        [0, { lang: 'python' as const, code: 'print("hi")', codeViewHtml: '<pre>py</pre>' }],
      ])

      const container = document.createElement('div')
      container.innerHTML = `<div class="python-block" data-index="0"></div>`
      document.body.appendChild(container)

      expect(() => {
        mountAllDiagrams(sourcesMap, container, 1, isCurrentFn, registerInstanceFn)
      }).not.toThrow()

      expect(hCalls.length).toBe(0)
    })

    it('M1.3 registerInstance called after successful mount', () => {
      const { mountAllDiagrams } = createMountLoopHarness()
      const registerInstanceFn = vi.fn()
      const isCurrentFn = vi.fn().mockReturnValue(true)

      const sourcesMap = new Map<number, { lang: string; code: string; svgContent?: string; codeViewHtml?: string }>([
        [0, { lang: 'mermaid' as const, code: 'graph TD', svgContent: '<svg>m</svg>', codeViewHtml: '<pre>m</pre>' }],
      ])

      const container = document.createElement('div')
      container.innerHTML = `<div class="mermaid-block" data-index="0"></div>`
      document.body.appendChild(container)

      mountAllDiagrams(sourcesMap, container, 1, isCurrentFn, registerInstanceFn)

      expect(registerInstanceFn).toHaveBeenCalledWith(
        'mermaid',
        'mermaid-block-0',
        expect.anything(),
      )
    })
  })

  describe('TC-M2: renderToken race guard checkpoints', () => {
    it('M2.1 renderContent uses nextToken + isCurrent after async render', () => {
      const r = useCodeBlockRenderer()

      const myToken = r.nextToken()
      expect(typeof myToken).toBe('number')
      expect(r.isCurrent(myToken)).toBe(true)

      r.nextToken()
      expect(r.isCurrent(myToken)).toBe(false)
    })

    it('M2.2 mount loop checks isCurrent before each block mount', () => {
      const { hCalls, mountAllDiagrams } = createMountLoopHarness()
      const registerInstanceFn = vi.fn()

      const sourcesMap = new Map<number, { lang: string; code: string; svgContent?: string; codeViewHtml?: string }>([
        [0, { lang: 'mermaid' as const, code: 'graph TD', svgContent: '<svg>m0</svg>', codeViewHtml: '<pre>m0</pre>' }],
        [1, { lang: 'mermaid' as const, code: 'graph LR', svgContent: '<svg>m1</svg>', codeViewHtml: '<pre>m1</pre>' }],
        [2, { lang: 'svg' as const, code: '<svg><rect/></svg>', svgContent: '<svg>s</svg>', codeViewHtml: '<pre>s</pre>' }],
      ])

      const container = document.createElement('div')
      container.innerHTML = `
        <div class="mermaid-block" data-index="0"></div>
        <div class="mermaid-block" data-index="1"></div>
        <div class="svg-block" data-index="2"></div>
      `
      document.body.appendChild(container)

      let callCount = 0
      const isCurrentFn = vi.fn(() => {
        callCount++
        return callCount <= 2
      })

      mountAllDiagrams(sourcesMap, container, 1, isCurrentFn, registerInstanceFn)

      expect(isCurrentFn.mock.calls.length).toBeGreaterThanOrEqual(3)
      expect(hCalls.length).toBeLessThan(3)
    })

    it('M2.3 rapid theme switch invalidates old render via isCurrent returning false', () => {
      const { hCalls, mountAllDiagrams } = createMountLoopHarness()
      const registerInstanceFn = vi.fn()
      const isCurrentFn = vi.fn().mockReturnValue(false)

      const sourcesMap = new Map<number, { lang: string; code: string; svgContent?: string; codeViewHtml?: string }>([
        [0, { lang: 'mermaid' as const, code: 'graph TD', svgContent: '<svg>m</svg>', codeViewHtml: '<pre>m</pre>' }],
      ])

      const container = document.createElement('div')
      container.innerHTML = `<div class="mermaid-block" data-index="0"></div>`
      document.body.appendChild(container)

      mountAllDiagrams(sourcesMap, container, 1, isCurrentFn, registerInstanceFn)

      expect(hCalls.length).toBe(0)
      expect(registerInstanceFn).not.toHaveBeenCalled()
    })
  })

  describe('TC-M3: PlantUML serial constraint + mermaid cache', () => {
    it('M3.1 plantuml renders serially (not Promise.all)', async () => {
      const renderOrder: number[] = []

      plantUmlRenderMock.mockImplementation(async (code: string) => {
        const idx = code.includes('A->B') ? 0 : 1
        renderOrder.push(idx)
        await new Promise(r => setTimeout(r, 10))
        return `<svg>plantuml-${idx}</svg>`
      })

      const r = useCodeBlockRenderer()

      await r.preRenderPlantUml(0, '@startuml\nA->B\n@enduml', 'light', '<code>0</code>')
      await r.preRenderPlantUml(1, '@startuml\nC->D\n@enduml', 'light', '<code>1</code>')

      expect(renderOrder).toEqual([0, 1])
      expect(plantUmlRenderMock).toHaveBeenCalledTimes(2)
    })

    it('M3.2 mermaid cache hit skips render call', async () => {
      mermaidRenderMock.mockResolvedValue('<svg>cached-mermaid</svg>')

      const r = useCodeBlockRenderer()

      await r.preRenderMermaid(0, 'graph TD', 'light', '<code>0</code>')
      const callsAfterFirst = mermaidRenderMock.mock.calls.length
      expect(callsAfterFirst).toBe(1)

      await r.preRenderMermaid(1, 'graph TD', 'light', '<code>1</code>')
      expect(mermaidRenderMock.mock.calls.length).toBe(callsAfterFirst)

      expect(r.getMermaidSvgByIndex(1)).toBe('<svg>cached-mermaid</svg>')
    })
  })
})
