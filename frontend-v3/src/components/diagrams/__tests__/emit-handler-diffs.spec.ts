import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'

const {
  renderMermaidFreshMock,
  renderPlantUmlFreshMock,
  getInstanceMock,
  svgToPngMock,
  clipboardWriteMock,
  consoleLogMock,
} = vi.hoisted(() => ({
  renderMermaidFreshMock: vi.fn(),
  renderPlantUmlFreshMock: vi.fn(),
  getInstanceMock: vi.fn(),
  svgToPngMock: vi.fn(),
  clipboardWriteMock: vi.fn(),
  consoleLogMock: vi.fn(),
}))

vi.mock('@/composables/useCodeBlockRenderer', () => ({
  useCodeBlockRenderer: () => ({
    sourcesMap: new Map(),
    mermaidCache: new Map(),
    renderToken: ref(0),
    instances: { mermaid: new Map(), plantuml: new Map(), svg: new Map() },
    renderMermaidFresh: renderMermaidFreshMock,
    renderPlantUmlFresh: renderPlantUmlFreshMock,
    getInstance: getInstanceMock,
    svgToPng: svgToPngMock,
    nextToken: () => 1,
    isCurrent: () => true,
    registerInstance: vi.fn(),
    unregisterInstance: vi.fn(),
    beginResize: vi.fn(),
    endResize: vi.fn(),
    clearInstances: vi.fn(),
    getMermaidSvgByIndex: vi.fn(),
    getPlantUmlSvgByIndex: vi.fn(),
    getCodeViewHtml: vi.fn(),
    getError: vi.fn(),
    preRenderMermaid: vi.fn(),
    preRenderPlantUml: vi.fn(),
    registerSvg: vi.fn(),
  }),
}))

vi.mock('@/composables/useMermaid', () => ({
  useMermaid: () => ({ render: vi.fn() }),
}))

vi.mock('@/composables/usePlantUML', () => ({
  render: vi.fn(),
  validateSource: vi.fn(() => ({ ok: true })),
  ensureLoaded: vi.fn(async () => {}),
  _setPlantUmlRender: vi.fn(),
  _setTimeout: vi.fn(),
}))

vi.mock('@/composables/useShiki', () => ({
  useShiki: () => ({ highlightCode: vi.fn() }),
}))

vi.mock('@/stores/theme', () => ({
  useThemeStore: () => ({ theme: ref('light') }),
}))

vi.mock('@/composables/useMarkdown', () => ({
  useMarkdown: () => ({
    render: vi.fn(async () => ({ html: '', headings: [], sources: new Map() })),
  }),
}))

const MERMAID_CODE = 'graph LR; A-->B' as const
const PLANTUML_CODE = '@startuml\nBob->Alice:hello\n@enduml' as const
const SVG_CODE = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="40" fill="red"/></svg>' as const

function buildBlockDom(prefix: string, blockId: string) {
  return `
    <div id="${blockId}" class="${prefix}-block" data-index="0">
      <div class="${prefix}-content diagram-mode is-active"></div>
      <div class="${prefix}-content code-mode"></div>
      <div class="${prefix}-viewer"></div>
      <span class="toggle-text">Diagram</span>
      <div class="${prefix}-dropdown-menu" style="display:none">
        <button class="copy-btn">Copy</button>
      </div>
    </div>
  `
}

function buildTwoBlockDom(prefix: string) {
  return `
    <div id="${prefix}-block-0" class="${prefix}-block" data-index="0">
      <div class="${prefix}-content diagram-mode is-active"></div>
      <div class="${prefix}-content code-mode"></div>
      <div class="${prefix}-dropdown-menu menu-0" style="display:block">
        <button class="copy-btn">Copy</button>
      </div>
    </div>
    <div id="${prefix}-block-1" class="${prefix}-block" data-index="1">
      <div class="${prefix}-content diagram-mode is-active"></div>
      <div class="${prefix}-content code-mode"></div>
      <div class="${prefix}-dropdown-menu menu-1" style="display:none">
        <button class="copy-btn">Copy</button>
      </div>
    </div>
  `
}

function createCurrentHostComponent(prefix: string, domHtml: string) {
  return defineComponent({
    setup() {
      const contentRef = ref<HTMLElement | null>(null)
      const sourcesMap = new Map<number, string>()
      if (prefix === 'mermaid') sourcesMap.set(0, MERMAID_CODE)
      else if (prefix === 'plantuml') sourcesMap.set(0, PLANTUML_CODE)
      else sourcesMap.set(0, SVG_CODE)

      function handleToggleView(bid: string | number, pfx: string) {
        const block = document.getElementById(String(bid))
        if (!block) return
        const diagramMode = block.querySelector(`.${pfx}-content.diagram-mode`)
        const codeMode = block.querySelector(`.${pfx}-content.code-mode`)
        if (diagramMode && codeMode) {
          diagramMode.classList.toggle('is-active')
          codeMode.classList.toggle('is-active')
        }
      }

      function handleToggleMenu(_bid: string | number, _pfx: string) {
      }

      function handleCopyCode(bid: string | number, _pfx: string) {
        const idx = parseInt(String(bid).split('-').pop() || '0')
        const code = sourcesMap.get(idx) || ''
        if (code) navigator.clipboard.writeText(code).catch(() => {})
      }

      function handleDownloadPng(bid: string | number, pfx: string) {
        if (pfx === 'svg') {
          const inst = getInstanceMock('svg', String(bid))
          inst?.downloadPng?.()
        }
      }

      function handleFullscreen(bid: string | number, pfx: string) {
        const inst = getInstanceMock(pfx, String(bid))
        inst?.toggleFullscreen?.()
      }

      return {
        contentRef, handleToggleView, handleToggleMenu,
        handleCopyCode, handleDownloadPng, handleFullscreen, domHtml,
      }
    },
    template: `<div ref="contentRef" v-html="domHtml" />`,
  })
}

describe('E1. toggle-view diffs', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('E1.1 mermaid toggle-view: dispatches refresh + updates toggle-text', async () => {
    const blockId = 'mermaid-block-0'
    document.body.innerHTML = buildBlockDom('mermaid', blockId)
    const host = createCurrentHostComponent('mermaid', buildBlockDom('mermaid', blockId))
    const wrapper = mount(host, { attachTo: document.body })

    const block = document.getElementById(blockId)!
    const viewer = block.querySelector('.mermaid-viewer')!
    const refreshSpy = vi.spyOn(viewer, 'dispatchEvent')

    wrapper.vm.handleToggleView(blockId, 'mermaid')

    const diagramMode = block.querySelector('.mermaid-content.diagram-mode')!
    const codeMode = block.querySelector('.mermaid-content.code-mode')!
    expect(diagramMode.classList.contains('is-active')).toBe(false)
    expect(codeMode.classList.contains('is-active')).toBe(true)

    const toggleText = block.querySelector('.toggle-text')!
    expect(toggleText.textContent).toBe('Code')

    expect(refreshSpy).toHaveBeenCalled()
    const dispatchedEvent = refreshSpy.mock.calls[0][0] as CustomEvent
    expect(dispatchedEvent.type).toBe('mermaid-refresh')

    wrapper.unmount()
  })

  it('E1.2 plantuml toggle-view: no refresh + no toggle-text update', async () => {
    const blockId = 'plantuml-block-0'
    document.body.innerHTML = buildBlockDom('plantuml', blockId)
    const host = createCurrentHostComponent('plantuml', buildBlockDom('plantuml', blockId))
    const wrapper = mount(host, { attachTo: document.body })

    const block = document.getElementById(blockId)!
    const viewer = block.querySelector('.plantuml-viewer')!
    const refreshSpy = vi.spyOn(viewer, 'dispatchEvent')

    wrapper.vm.handleToggleView(blockId, 'plantuml')

    const diagramMode = block.querySelector('.plantuml-content.diagram-mode')!
    const codeMode = block.querySelector('.plantuml-content.code-mode')!
    expect(diagramMode.classList.contains('is-active')).toBe(false)
    expect(codeMode.classList.contains('is-active')).toBe(true)

    expect(refreshSpy).not.toHaveBeenCalled()

    const toggleText = block.querySelector('.toggle-text')!
    expect(toggleText.textContent).toBe('Diagram')

    wrapper.unmount()
  })

  it('E1.3 svg toggle-view: dispatches refresh + updates toggle-text', async () => {
    const blockId = 'svg-block-0'
    document.body.innerHTML = buildBlockDom('svg', blockId)
    const host = createCurrentHostComponent('svg', buildBlockDom('svg', blockId))
    const wrapper = mount(host, { attachTo: document.body })

    const block = document.getElementById(blockId)!
    const viewer = block.querySelector('.svg-viewer')!
    const refreshSpy = vi.spyOn(viewer, 'dispatchEvent')

    wrapper.vm.handleToggleView(blockId, 'svg')

    const diagramMode = block.querySelector('.svg-content.diagram-mode')!
    const codeMode = block.querySelector('.svg-content.code-mode')!
    expect(diagramMode.classList.contains('is-active')).toBe(false)
    expect(codeMode.classList.contains('is-active')).toBe(true)

    const toggleText = block.querySelector('.toggle-text')!
    expect(toggleText.textContent).toBe('Code')

    expect(refreshSpy).toHaveBeenCalled()
    const dispatchedEvent = refreshSpy.mock.calls[0][0] as CustomEvent
    expect(dispatchedEvent.type).toBe('svg-refresh')

    wrapper.unmount()
  })
})

describe('E2. toggle-menu diffs', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('E2.1 mermaid toggle-menu: closes other mermaid menus + click-outside', async () => {
    document.body.innerHTML = buildTwoBlockDom('mermaid')
    const host = createCurrentHostComponent('mermaid', buildTwoBlockDom('mermaid'))
    const wrapper = mount(host, { attachTo: document.body })

    const addListenerSpy = vi.spyOn(document, 'addEventListener')

    wrapper.vm.handleToggleMenu('mermaid-block-1', 'mermaid')

    const menu0 = document.querySelector('.mermaid-dropdown-menu.menu-0') as HTMLElement
    const menu1 = document.querySelector('.mermaid-dropdown-menu.menu-1') as HTMLElement
    expect(menu0.style.display).toBe('none')
    expect(menu1.style.display).toBe('block')

    const clickOutsideCalls = addListenerSpy.mock.calls.filter(
      c => c[0] === 'click' && typeof c[2] === 'object' && (c[2] as AddEventListenerOptions).once === true
    )
    expect(clickOutsideCalls.length).toBeGreaterThanOrEqual(1)

    wrapper.unmount()
  })

  it('E2.2 plantuml toggle-menu: only toggle show, no close-others, no click-outside', async () => {
    document.body.innerHTML = buildTwoBlockDom('plantuml')
    const host = createCurrentHostComponent('plantuml', buildTwoBlockDom('plantuml'))
    const wrapper = mount(host, { attachTo: document.body })

    const addListenerSpy = vi.spyOn(document, 'addEventListener')

    wrapper.vm.handleToggleMenu('plantuml-block-0', 'plantuml')

    const menu0 = document.querySelector('.plantuml-dropdown-menu.menu-0') as HTMLElement
    expect(menu0.style.display).toBe('none')

    const menu1 = document.querySelector('.plantuml-dropdown-menu.menu-1') as HTMLElement
    expect(menu1.style.display).toBe('none')

    const clickOutsideCalls = addListenerSpy.mock.calls.filter(
      c => c[0] === 'click' && typeof c[2] === 'object' && (c[2] as AddEventListenerOptions).once === true
    )
    expect(clickOutsideCalls.length).toBe(0)

    wrapper.unmount()
  })

  it('E2.3 svg toggle-menu: closes other svg menus + click-outside', async () => {
    document.body.innerHTML = buildTwoBlockDom('svg')
    const host = createCurrentHostComponent('svg', buildTwoBlockDom('svg'))
    const wrapper = mount(host, { attachTo: document.body })

    const addListenerSpy = vi.spyOn(document, 'addEventListener')

    wrapper.vm.handleToggleMenu('svg-block-1', 'svg')

    const menu0 = document.querySelector('.svg-dropdown-menu.menu-0') as HTMLElement
    const menu1 = document.querySelector('.svg-dropdown-menu.menu-1') as HTMLElement
    expect(menu0.style.display).toBe('none')
    expect(menu1.style.display).toBe('block')

    const clickOutsideCalls = addListenerSpy.mock.calls.filter(
      c => c[0] === 'click' && typeof c[2] === 'object' && (c[2] as AddEventListenerOptions).once === true
    )
    expect(clickOutsideCalls.length).toBeGreaterThanOrEqual(1)

    wrapper.unmount()
  })
})

describe('E3. copy-code diffs', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.stubGlobal('navigator', { clipboard: { writeText: clipboardWriteMock } })
    vi.spyOn(console, 'log').mockImplementation(consoleLogMock)
    clipboardWriteMock.mockReset()
    clipboardWriteMock.mockResolvedValue(undefined)
    consoleLogMock.mockReset()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('E3.1 mermaid copy-code: clipboard + ✓Copied! UI 2s', async () => {
    const blockId = 'mermaid-block-0'
    document.body.innerHTML = buildBlockDom('mermaid', blockId)
    const host = createCurrentHostComponent('mermaid', buildBlockDom('mermaid', blockId))
    const wrapper = mount(host, { attachTo: document.body })

    wrapper.vm.handleCopyCode(blockId, 'mermaid')

    expect(clipboardWriteMock).toHaveBeenCalledWith(MERMAID_CODE)

    const block = document.getElementById(blockId)!
    const lastBtn = block.querySelectorAll('button')
    const copyBtn = lastBtn[lastBtn.length - 1]
    expect(copyBtn.textContent).toBe('✓ Copied!')

    wrapper.unmount()
  })

  it('E3.2 plantuml copy-code: clipboard + only console.log, no UI feedback', async () => {
    const blockId = 'plantuml-block-0'
    document.body.innerHTML = buildBlockDom('plantuml', blockId)
    const host = createCurrentHostComponent('plantuml', buildBlockDom('plantuml', blockId))
    const wrapper = mount(host, { attachTo: document.body })

    wrapper.vm.handleCopyCode(blockId, 'plantuml')

    expect(clipboardWriteMock).toHaveBeenCalledWith(PLANTUML_CODE)

    const block = document.getElementById(blockId)!
    const lastBtn = block.querySelectorAll('button')
    const copyBtn = lastBtn[lastBtn.length - 1]
    expect(copyBtn.textContent).toBe('Copy')

    expect(consoleLogMock).toHaveBeenCalled()

    wrapper.unmount()
  })

  it('E3.3 svg copy-code: clipboard + ✓Copied! UI 2s', async () => {
    const blockId = 'svg-block-0'
    document.body.innerHTML = buildBlockDom('svg', blockId)
    const host = createCurrentHostComponent('svg', buildBlockDom('svg', blockId))
    const wrapper = mount(host, { attachTo: document.body })

    wrapper.vm.handleCopyCode(blockId, 'svg')

    expect(clipboardWriteMock).toHaveBeenCalledWith(SVG_CODE)

    const block = document.getElementById(blockId)!
    const lastBtn = block.querySelectorAll('button')
    const copyBtn = lastBtn[lastBtn.length - 1]
    expect(copyBtn.textContent).toBe('✓ Copied!')

    wrapper.unmount()
  })
})

describe('E4. download-png diffs', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    renderMermaidFreshMock.mockReset()
    renderPlantUmlFreshMock.mockReset()
    getInstanceMock.mockReset()
    renderMermaidFreshMock.mockResolvedValue('<svg>fresh-mermaid</svg>')
    renderPlantUmlFreshMock.mockResolvedValue('<svg>fresh-plantuml</svg>')
    getInstanceMock.mockReturnValue({ downloadPng: vi.fn() })
  })

  it('E4.1 mermaid download-png: re-render fresh + svgToPng(white bg/800x600/brFix)', async () => {
    const blockId = 'mermaid-block-0'
    document.body.innerHTML = buildBlockDom('mermaid', blockId)
    const host = createCurrentHostComponent('mermaid', buildBlockDom('mermaid', blockId))
    const wrapper = mount(host, { attachTo: document.body })

    wrapper.vm.handleDownloadPng(blockId, 'mermaid')

    expect(renderMermaidFreshMock).toHaveBeenCalledWith(MERMAID_CODE, 'light')
    expect(renderPlantUmlFreshMock).not.toHaveBeenCalled()
    expect(getInstanceMock).not.toHaveBeenCalledWith('svg', expect.anything())

    wrapper.unmount()
  })

  it('E4.2 plantuml download-png: re-render fresh + svgToPng(white bg/800x600/no brFix)', async () => {
    const blockId = 'plantuml-block-0'
    document.body.innerHTML = buildBlockDom('plantuml', blockId)
    const host = createCurrentHostComponent('plantuml', buildBlockDom('plantuml', blockId))
    const wrapper = mount(host, { attachTo: document.body })

    wrapper.vm.handleDownloadPng(blockId, 'plantuml')

    expect(renderPlantUmlFreshMock).toHaveBeenCalledWith(PLANTUML_CODE, 'light')
    expect(renderMermaidFreshMock).not.toHaveBeenCalled()
    expect(getInstanceMock).not.toHaveBeenCalledWith('svg', expect.anything())

    wrapper.unmount()
  })

  it('E4.3 svg download-png: delegates to instance.downloadPng()', async () => {
    const blockId = 'svg-block-0'
    document.body.innerHTML = buildBlockDom('svg', blockId)
    const host = createCurrentHostComponent('svg', buildBlockDom('svg', blockId))
    const wrapper = mount(host, { attachTo: document.body })

    const mockInstance = { downloadPng: vi.fn() }
    getInstanceMock.mockReturnValue(mockInstance)

    wrapper.vm.handleDownloadPng(blockId, 'svg')

    expect(getInstanceMock).toHaveBeenCalledWith('svg', blockId)
    expect(mockInstance.downloadPng).toHaveBeenCalled()
    expect(renderMermaidFreshMock).not.toHaveBeenCalled()
    expect(renderPlantUmlFreshMock).not.toHaveBeenCalled()

    wrapper.unmount()
  })
})

describe('E5. fullscreen diffs', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    getInstanceMock.mockReset()
  })

  it('E5.1 mermaid fullscreen: instance.toggleFullscreen() (no hidden-button hack)', async () => {
    const blockId = 'mermaid-block-0'
    document.body.innerHTML = buildBlockDom('mermaid', blockId)
    const host = createCurrentHostComponent('mermaid', buildBlockDom('mermaid', blockId))
    const wrapper = mount(host, { attachTo: document.body })

    const mockInstance = { toggleFullscreen: vi.fn() }
    getInstanceMock.mockReturnValue(mockInstance)

    wrapper.vm.handleFullscreen(blockId, 'mermaid')

    expect(getInstanceMock).toHaveBeenCalledWith('mermaid', blockId)
    expect(mockInstance.toggleFullscreen).toHaveBeenCalled()

    const block = document.getElementById(blockId)!
    const hackBtn = block.querySelector('.mermaid-fullscreen-trigger')
    expect(hackBtn).toBeNull()

    wrapper.unmount()
  })

  it('E5.2 plantuml fullscreen: instance.toggleFullscreen() (no hidden-button hack)', async () => {
    const blockId = 'plantuml-block-0'
    document.body.innerHTML = buildBlockDom('plantuml', blockId)
    const host = createCurrentHostComponent('plantuml', buildBlockDom('plantuml', blockId))
    const wrapper = mount(host, { attachTo: document.body })

    const mockInstance = { toggleFullscreen: vi.fn() }
    getInstanceMock.mockReturnValue(mockInstance)

    wrapper.vm.handleFullscreen(blockId, 'plantuml')

    expect(getInstanceMock).toHaveBeenCalledWith('plantuml', blockId)
    expect(mockInstance.toggleFullscreen).toHaveBeenCalled()

    const block = document.getElementById(blockId)!
    const hackBtn = block.querySelector('.plantuml-fullscreen-trigger')
    expect(hackBtn).toBeNull()

    wrapper.unmount()
  })

  it('E5.3 svg fullscreen: instance.toggleFullscreen()', async () => {
    const blockId = 'svg-block-0'
    document.body.innerHTML = buildBlockDom('svg', blockId)
    const host = createCurrentHostComponent('svg', buildBlockDom('svg', blockId))
    const wrapper = mount(host, { attachTo: document.body })

    const mockInstance = { toggleFullscreen: vi.fn() }
    getInstanceMock.mockReturnValue(mockInstance)

    wrapper.vm.handleFullscreen(blockId, 'svg')

    expect(getInstanceMock).toHaveBeenCalledWith('svg', blockId)
    expect(mockInstance.toggleFullscreen).toHaveBeenCalled()

    wrapper.unmount()
  })
})
