import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const mocks = vi.hoisted(() => {
  const mermaidRenderMock = vi.fn()
  const plantUmlRenderMock = vi.fn()
  const highlightCodeMock = vi.fn()

  const useMermaidMock = vi.fn(() => ({ render: mermaidRenderMock }))
  const usePlantUmlMock = {
    render: plantUmlRenderMock,
    validateSource: vi.fn(() => ({ ok: true })),
    ensureLoaded: vi.fn(async () => {}),
    _setPlantUmlRender: vi.fn(),
    _setTimeout: vi.fn(),
  }
  const useShikiMock = vi.fn(() => ({ highlightCode: highlightCodeMock }))
  const svgPanZoomMock = vi.fn(() => ({ destroy: vi.fn(), zoomIn: vi.fn(), zoomOut: vi.fn(), reset: vi.fn(), center: vi.fn() }))
  const useThemeStoreMock = vi.fn(() => ({
    theme: ref('light'),
    $id: 'theme',
  }))
  const useMarkdownMock = vi.fn(() => ({
    render: vi.fn(async () => ({
      html: '<div class="mermaid-block" data-index="0" data-block-id="mermaid-block-0"><div class="mermaid-content diagram-mode is-active"><div class="mermaid-viewer-mount"></div></div><div class="mermaid-content code-mode"><pre>code</pre></div></div>',
      headings: [],
      sources: new Map([[0, { lang: 'mermaid' as const, code: 'graph TD', svgContent: '<svg>mock</svg>', codeViewHtml: '<pre>code</pre>' }]]),
    })),
  }))
  const useCodeBlockRendererMock = vi.fn(() => ({
    mermaidCache: new Map(),
    sourcesMap: new Map(),
    renderToken: ref(0),
    instances: { mermaid: new Map(), plantuml: new Map(), svg: new Map() },
    resizingBlock: ref<string | null>(null),
    startY: ref(0),
    startHeight: ref(0),
    getMermaidSvgByIndex: vi.fn(() => ''),
    getPlantUmlSvgByIndex: vi.fn(() => ''),
    getCodeViewHtml: vi.fn(() => undefined),
    getError: vi.fn(() => undefined),
    preRenderMermaid: vi.fn(async () => {}),
    preRenderPlantUml: vi.fn(async () => {}),
    registerSvg: vi.fn(async () => {}),
    renderMermaidFresh: vi.fn(async () => '<svg>fresh</svg>'),
    renderPlantUmlFresh: vi.fn(async () => '<svg>fresh</svg>'),
    svgToPng: vi.fn(async () => {}),
    nextToken: vi.fn(() => 1),
    isCurrent: vi.fn(() => true),
    registerInstance: vi.fn(),
    unregisterInstance: vi.fn(),
    getInstance: vi.fn(),
    beginResize: vi.fn(),
    endResize: vi.fn(),
    clearInstances: vi.fn(),
  }))

  return {
    mermaidRenderMock, plantUmlRenderMock, highlightCodeMock,
    useMermaidMock, usePlantUmlMock, useShikiMock, svgPanZoomMock,
    useThemeStoreMock, useMarkdownMock, useCodeBlockRendererMock,
  }
})

vi.mock('@/composables/useMermaid', () => ({ useMermaid: mocks.useMermaidMock }))
vi.mock('@/composables/usePlantUML', () => mocks.usePlantUmlMock)
vi.mock('@/composables/useShiki', () => ({ useShiki: mocks.useShikiMock }))
vi.mock('svg-pan-zoom', () => ({ default: mocks.svgPanZoomMock }))
vi.mock('@/stores/theme', () => ({ useThemeStore: mocks.useThemeStoreMock }))
vi.mock('@/composables/useMarkdown', () => ({ useMarkdown: mocks.useMarkdownMock }))
vi.mock('@/composables/useCodeBlockRenderer', () => ({ useCodeBlockRenderer: mocks.useCodeBlockRendererMock }))

const sourcePath = resolve(__dirname, '../../MarkdownViewer.vue')
const sourceCode = readFileSync(sourcePath, 'utf-8')

describe('markdown-viewer-degeneration', () => {
  beforeEach(() => {
    mocks.mermaidRenderMock.mockReset()
    mocks.plantUmlRenderMock.mockReset()
    mocks.highlightCodeMock.mockReset()
    mocks.mermaidRenderMock.mockResolvedValue('<svg>mock</svg>')
    mocks.plantUmlRenderMock.mockResolvedValue('<svg>plantuml</svg>')
    mocks.highlightCodeMock.mockResolvedValue('<shiki>highlighted</shiki>')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('TC-D1: MarkdownViewer uses useCodeBlockRenderer state', () => {
    it('D1.1 does not hold mermaidSourcesMap/plantumlSourcesMap/svgSourcesMap local variables', () => {
      const hasMermaidSources = /\bmermaidSourcesMap\b/.test(sourceCode)
      const hasPlantumlSources = /\bplantumlSourcesMap\b/.test(sourceCode)
      const hasSvgSources = /\bsvgSourcesMap\b/.test(sourceCode)
      expect(hasMermaidSources).toBe(false)
      expect(hasPlantumlSources).toBe(false)
      expect(hasSvgSources).toBe(false)
    })

    it('D1.2 does not hold mermaidCache local variable', () => {
      const hasMermaidCache = /\bmermaidCache\b/.test(sourceCode)
      expect(hasMermaidCache).toBe(false)
    })

    it('D1.3 does not hold mermaidInstances/plantumlInstances/svgInstances local variables', () => {
      const hasMermaidInstances = /\bmermaidInstances\b/.test(sourceCode)
      const hasPlantumlInstances = /\bplantumlInstances\b/.test(sourceCode)
      const hasSvgInstances = /\bsvgInstances\b/.test(sourceCode)
      expect(hasMermaidInstances).toBe(false)
      expect(hasPlantumlInstances).toBe(false)
      expect(hasSvgInstances).toBe(false)
    })

    it('D1.4 does not hold renderToken local variable', () => {
      const hasRenderToken = /\blet\s+renderToken\b/.test(sourceCode)
      expect(hasRenderToken).toBe(false)
    })
  })

  describe('TC-D2: MarkdownViewer unified mount loop', () => {
    it('D2.1 does not have renderMermaidDiagrams/renderPlantUmlDiagrams/renderSvgBlocks independent functions', () => {
      const hasRenderMermaid = /function\s+renderMermaidDiagrams\b/.test(sourceCode)
      const hasRenderPlantUml = /function\s+renderPlantUmlDiagrams\b/.test(sourceCode)
      const hasRenderSvg = /function\s+renderSvgBlocks\b/.test(sourceCode)
      expect(hasRenderMermaid).toBe(false)
      expect(hasRenderPlantUml).toBe(false)
      expect(hasRenderSvg).toBe(false)
    })

    it('D2.2 mount loop routes via wrapperRegistry to correct thin wrapper', async () => {
      const { default: MarkdownViewer } = await import('@/components/MarkdownViewer.vue')
      const wrapper = mount(MarkdownViewer, {
        props: { content: '```mermaid\ngraph TD\n```' },
        global: {
          stubs: {
            MermaidDiagram: { template: '<div class="stub-mermaid" />' },
            PlantUmlDiagram: { template: '<div class="stub-plantuml" />' },
            SvgDiagram: { template: '<div class="stub-svg" />' },
          },
        },
      })
      await nextTick()
      const vm = wrapper.vm as any
      const hasWrapperRegistry = typeof vm.wrapperRegistry === 'object' && vm.wrapperRegistry !== null
      expect(hasWrapperRegistry).toBe(true)
      if (hasWrapperRegistry) {
        expect(vm.wrapperRegistry.mermaid).toBeTruthy()
        expect(vm.wrapperRegistry.plantuml).toBeTruthy()
        expect(vm.wrapperRegistry.svg).toBeTruthy()
      }
      wrapper.unmount()
    })

    it('D2.3 mount loop uses h(Component, props) + vueRender (not <component :is>)', () => {
      const usesComponentIs = /<component\s+:is/.test(sourceCode)
      expect(usesComponentIs).toBe(false)
      const usesHAndVueRender = /\bh\(/.test(sourceCode) && /vueRender\(/.test(sourceCode)
      expect(usesHAndVueRender).toBe(true)
    })

    it('D2.4 mount loop preserves dataset.rendered dedup', () => {
      const hasDatasetRendered = /dataset\.rendered/.test(sourceCode)
      expect(hasDatasetRendered).toBe(true)
    })

    it('D2.5 mount loop preserves two-phase flow (v-html → nextTick → mount)', () => {
      const hasVhtml = /v-html/.test(sourceCode)
      const hasNextTick = /await\s+nextTick\(\)/.test(sourceCode)
      const hasVueRender = /vueRender\(/.test(sourceCode)
      expect(hasVhtml).toBe(true)
      expect(hasNextTick).toBe(true)
      expect(hasVueRender).toBe(true)
    })
  })

  describe('TC-D3: MarkdownViewer emit handler per-classPrefix differentiation', () => {
    async function mountViewer() {
      const { default: MarkdownViewer } = await import('@/components/MarkdownViewer.vue')
      return mount(MarkdownViewer, {
        props: { content: '```mermaid\ntest\n```' },
        attachTo: document.body,
        global: {
          stubs: {
            MermaidDiagram: {
              template: '<div class="stub-diagram" />',
            },
            PlantUmlDiagram: {
              template: '<div class="stub-diagram" />',
            },
            SvgDiagram: {
              template: '<div class="stub-diagram" />',
            },
          },
        },
      })
    }

    it('D3.1 handleToggleView mermaid: toggles is-active + updates toggle-text + dispatches refresh', async () => {
      const wrapper = await mountViewer()
      const vm = wrapper.vm as any

      const block = document.createElement('div')
      block.id = 'mermaid-block-0'
      const diagramMode = document.createElement('div')
      diagramMode.className = 'mermaid-content diagram-mode is-active'
      const codeMode = document.createElement('div')
      codeMode.className = 'mermaid-content code-mode'
      const toggleText = document.createElement('span')
      toggleText.className = 'toggle-text'
      toggleText.textContent = 'Diagram'
      const viewer = document.createElement('div')
      viewer.className = 'mermaid-viewer'
      block.appendChild(diagramMode)
      block.appendChild(codeMode)
      block.appendChild(toggleText)
      block.appendChild(viewer)
      document.body.appendChild(block)

      const dispatchSpy = vi.spyOn(viewer, 'dispatchEvent')

      vm.handleToggleView('mermaid-block-0', 'mermaid')

      expect(diagramMode.classList.contains('is-active')).toBe(false)
      expect(codeMode.classList.contains('is-active')).toBe(true)
      expect(toggleText.textContent).toBe('Code')
      expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'mermaid-refresh' }))

      block.remove()
      wrapper.unmount()
    })

    it('D3.2 handleToggleView plantuml: only toggles is-active, no refresh, no toggle-text update', async () => {
      const wrapper = await mountViewer()
      const vm = wrapper.vm as any

      const block = document.createElement('div')
      block.id = 'plantuml-block-0'
      const diagramMode = document.createElement('div')
      diagramMode.className = 'plantuml-content diagram-mode is-active'
      const codeMode = document.createElement('div')
      codeMode.className = 'plantuml-content code-mode'
      const toggleText = document.createElement('span')
      toggleText.className = 'toggle-text'
      toggleText.textContent = 'Diagram'
      const viewer = document.createElement('div')
      viewer.className = 'plantuml-viewer'
      block.appendChild(diagramMode)
      block.appendChild(codeMode)
      block.appendChild(toggleText)
      block.appendChild(viewer)
      document.body.appendChild(block)

      const dispatchSpy = vi.spyOn(viewer, 'dispatchEvent')

      vm.handleToggleView('plantuml-block-0', 'plantuml')

      expect(diagramMode.classList.contains('is-active')).toBe(false)
      expect(codeMode.classList.contains('is-active')).toBe(true)
      expect(dispatchSpy).not.toHaveBeenCalled()
      expect(toggleText.textContent).toBe('Diagram')

      block.remove()
      wrapper.unmount()
    })

    it('D3.3 handleToggleView svg: toggles is-active + updates toggle-text + dispatches refresh', async () => {
      const wrapper = await mountViewer()
      const vm = wrapper.vm as any

      const block = document.createElement('div')
      block.id = 'svg-block-0'
      const diagramMode = document.createElement('div')
      diagramMode.className = 'svg-content diagram-mode is-active'
      const codeMode = document.createElement('div')
      codeMode.className = 'svg-content code-mode'
      const toggleText = document.createElement('span')
      toggleText.className = 'toggle-text'
      toggleText.textContent = 'Diagram'
      const viewer = document.createElement('div')
      viewer.className = 'svg-viewer'
      block.appendChild(diagramMode)
      block.appendChild(codeMode)
      block.appendChild(toggleText)
      block.appendChild(viewer)
      document.body.appendChild(block)

      const dispatchSpy = vi.spyOn(viewer, 'dispatchEvent')

      vm.handleToggleView('svg-block-0', 'svg')

      expect(diagramMode.classList.contains('is-active')).toBe(false)
      expect(codeMode.classList.contains('is-active')).toBe(true)
      expect(toggleText.textContent).toBe('Code')
      expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'svg-refresh' }))

      block.remove()
      wrapper.unmount()
    })

    it('D3.4 handleCopyCode mermaid/svg: clipboard + Copied UI feedback', async () => {
      const wrapper = await mountViewer()
      const vm = wrapper.vm as any

      const writeTextMock = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: writeTextMock }, writable: true, configurable: true })

      const block = document.createElement('div')
      block.id = 'mermaid-block-0'
      const menuBtn = document.createElement('button')
      menuBtn.className = 'mermaid-dropdown-menu-button'
      menuBtn.textContent = 'Copy Code'
      block.appendChild(menuBtn)
      document.body.appendChild(block)

      vm.handleCopyCode('mermaid-block-0', 'mermaid')

      expect(writeTextMock).toHaveBeenCalled()
      expect(menuBtn.textContent).toBe('✓ Copied!')

      block.remove()
      wrapper.unmount()
    })

    it('D3.5 handleCopyCode plantuml: clipboard + only console.log, no Copied UI feedback', async () => {
      const wrapper = await mountViewer()
      const vm = wrapper.vm as any

      const writeTextMock = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: writeTextMock }, writable: true, configurable: true })
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation()

      const block = document.createElement('div')
      block.id = 'plantuml-block-0'
      const menuBtn = document.createElement('button')
      menuBtn.className = 'plantuml-dropdown-menu-button'
      menuBtn.textContent = 'Copy Code'
      block.appendChild(menuBtn)
      document.body.appendChild(block)

      vm.handleCopyCode('plantuml-block-0', 'plantuml')

      expect(writeTextMock).toHaveBeenCalled()
      expect(menuBtn.textContent).toBe('Copy Code')
      expect(consoleSpy).toHaveBeenCalled()

      block.remove()
      consoleSpy.mockRestore()
      wrapper.unmount()
    })
  })

  describe('TC-D4: Theme switch triggers re-render', () => {
    it('D4.1 theme change triggers renderContent', async () => {
      const themeRef = ref<string>('light')
      mocks.useThemeStoreMock.mockReturnValue({
        theme: themeRef,
        $id: 'theme',
      })

      const renderFn = vi.fn(async () => ({
        html: '<div class="mermaid-block" data-index="0" data-block-id="mermaid-block-0"></div>',
        headings: [],
        sources: new Map(),
      }))
      mocks.useMarkdownMock.mockReturnValue({ render: renderFn })

      const { default: MarkdownViewer } = await import('@/components/MarkdownViewer.vue')
      const wrapper = mount(MarkdownViewer, {
        props: { content: '```mermaid\ngraph TD\n```' },
        global: {
          stubs: {
            MermaidDiagram: true,
            PlantUmlDiagram: true,
            SvgDiagram: true,
          },
        },
      })

      await nextTick()
      const callsAfterMount = renderFn.mock.calls.length
      expect(callsAfterMount).toBeGreaterThanOrEqual(1)

      themeRef.value = 'dark'
      await nextTick()
      await nextTick()

      expect(renderFn.mock.calls.length).toBeGreaterThan(callsAfterMount)

      wrapper.unmount()
    })
  })
})
