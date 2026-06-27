import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick, ref } from 'vue'

const mockZoom = vi.fn()
const mockGetZoom = vi.fn(() => 1)
const mockDestroy = vi.fn()
const mockResize = vi.fn()
const mockFit = vi.fn()
const mockCenter = vi.fn()
const mockZoomIn = vi.fn()
const mockZoomOut = vi.fn()
const mockReset = vi.fn()
const mockPanBy = vi.fn()

const svgPanZoomMock = vi.fn((_svg: SVGSVGElement, _opts: Record<string, unknown>) => ({
  zoom: mockZoom,
  zoomIn: mockZoomIn,
  zoomOut: mockZoomOut,
  reset: mockReset,
  center: mockCenter,
  fit: mockFit,
  resize: mockResize,
  panBy: mockPanBy,
  getZoom: mockGetZoom,
  destroy: mockDestroy,
}))

vi.mock('svg-pan-zoom', () => ({
  default: svgPanZoomMock,
}))

function makeContainer(): { ref: ReturnType<typeof ref<HTMLElement | undefined>>; el: HTMLElement } {
  const el = document.createElement('div')
  document.body.appendChild(el)
  return { ref: ref<HTMLElement | undefined>(el), el }
}

function makeSvgContainer(): { ref: ReturnType<typeof ref<HTMLElement | undefined>>; el: HTMLElement } {
  const el = document.createElement('div')
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('width', '100')
  svg.setAttribute('height', '100')
  el.appendChild(svg)
  document.body.appendChild(el)
  return { ref: ref<HTMLElement | undefined>(el), el }
}

describe('useDiagramViewer', () => {
  beforeEach(() => {
    svgPanZoomMock.mockClear()
    mockZoom.mockClear()
    mockGetZoom.mockClear()
    mockDestroy.mockClear()
    mockResize.mockClear()
    mockFit.mockClear()
    mockCenter.mockClear()
    mockPanBy.mockClear()
  })

  it('returns expected functions', async () => {
    const { useDiagramViewer } = await import('../useDiagramViewer')
    const containerRef = ref<HTMLElement | undefined>(undefined)
    const svgContainerRef = ref<HTMLElement | undefined>(undefined)
    const viewer = useDiagramViewer({ containerRef, svgContainerRef })
    expect(typeof viewer.initPanZoom).toBe('function')
    expect(typeof viewer.destroyPanZoom).toBe('function')
    expect(typeof viewer.refreshPanZoom).toBe('function')
    expect(typeof viewer.onWheel).toBe('function')
    expect(typeof viewer.setupTouchListeners).toBe('function')
    expect(typeof viewer.removeTouchListeners).toBe('function')
    expect(typeof viewer.setupResizeObserver).toBe('function')
    expect(typeof viewer.setupRefreshListener).toBe('function')
    expect(typeof viewer.cleanup).toBe('function')
  })

  it('initPanZoom creates svg-pan-zoom instance and stores on container', async () => {
    const { useDiagramViewer } = await import('../useDiagramViewer')
    const container = makeContainer()
    const svgContainer = makeSvgContainer()
    const viewer = useDiagramViewer({
      containerRef: container.ref,
      svgContainerRef: svgContainer.ref,
    })
    await viewer.initPanZoom()
    expect(svgPanZoomMock).toHaveBeenCalledTimes(1)
    expect((container.el as any).__panZoomInstance).toBeDefined()
    viewer.cleanup()
    svgContainer.el.remove()
    container.el.remove()
  })

  it('onWheel calls preventDefault and delegates to panZoomInstance.zoom', async () => {
    const { useDiagramViewer } = await import('../useDiagramViewer')
    const container = makeContainer()
    const svgContainer = makeSvgContainer()
    const viewer = useDiagramViewer({
      containerRef: container.ref,
      svgContainerRef: svgContainer.ref,
      maxZoom: 10,
      minZoom: 0.1,
    })
    await viewer.initPanZoom()
    await nextTick()

    const event = new WheelEvent('wheel', { deltaY: 100, cancelable: true })
    const spy = vi.spyOn(event, 'preventDefault')
    mockGetZoom.mockReturnValue(5)

    viewer.onWheel(event)

    expect(spy).toHaveBeenCalled()
    expect(mockZoom).toHaveBeenCalledWith(expect.any(Number))
    // deltaY > 0 -> delta 0.9 -> 5 * 0.9 = 4.5
    expect(mockZoom).toHaveBeenCalledWith(4.5)

    viewer.cleanup()
    svgContainer.el.remove()
    container.el.remove()
  })

  it('onWheel clamps to maxZoom', async () => {
    const { useDiagramViewer } = await import('../useDiagramViewer')
    const container = makeContainer()
    const svgContainer = makeSvgContainer()
    const viewer = useDiagramViewer({
      containerRef: container.ref,
      svgContainerRef: svgContainer.ref,
      maxZoom: 10,
      minZoom: 0.1,
    })
    await viewer.initPanZoom()
    await nextTick()

    const event = new WheelEvent('wheel', { deltaY: -100, cancelable: true })
    vi.spyOn(event, 'preventDefault')
    mockGetZoom.mockReturnValue(20)

    viewer.onWheel(event)

    // deltaY < 0 -> delta 1.1 -> 20 * 1.1 = 22 -> clamp to 10
    expect(mockZoom).toHaveBeenCalledWith(10)

    viewer.cleanup()
    svgContainer.el.remove()
    container.el.remove()
  })

  it('enableTouch:false does not add touch listeners', async () => {
    const { useDiagramViewer } = await import('../useDiagramViewer')
    const container = makeContainer()
    const svgContainer = makeSvgContainer()
    const viewer = useDiagramViewer({
      containerRef: container.ref,
      svgContainerRef: svgContainer.ref,
      enableTouch: false,
    })
    const spy = vi.spyOn(container.el, 'addEventListener')
    viewer.setupTouchListeners()
    expect(spy).not.toHaveBeenCalled()
    viewer.cleanup()
    svgContainer.el.remove()
    container.el.remove()
  })

  it('enableTouch:true (default) adds touch listeners', async () => {
    const { useDiagramViewer } = await import('../useDiagramViewer')
    const container = makeContainer()
    const svgContainer = makeSvgContainer()
    const viewer = useDiagramViewer({
      containerRef: container.ref,
      svgContainerRef: svgContainer.ref,
    })
    const spy = vi.spyOn(container.el, 'addEventListener')
    viewer.setupTouchListeners()
    const types = spy.mock.calls.map((c) => c[0])
    expect(types).toContain('touchstart')
    expect(types).toContain('touchmove')
    expect(types).toContain('touchend')
    viewer.cleanup()
    svgContainer.el.remove()
    container.el.remove()
  })

  it('enableResize:false does not create ResizeObserver', async () => {
    const { useDiagramViewer } = await import('../useDiagramViewer')
    const container = makeContainer()
    const svgContainer = makeSvgContainer()
    const viewer = useDiagramViewer({
      containerRef: container.ref,
      svgContainerRef: svgContainer.ref,
      enableResize: false,
    })
    const origRO = globalThis.ResizeObserver
    const roSpy = vi.fn()
    const roCtor = vi.fn(() => ({ observe: roSpy, disconnect: vi.fn() }))
    ;(globalThis as any).ResizeObserver = roCtor
    viewer.setupResizeObserver()
    expect(roCtor).not.toHaveBeenCalled()
    ;(globalThis as any).ResizeObserver = origRO
    viewer.cleanup()
    svgContainer.el.remove()
    container.el.remove()
  })

  it('enableResize:true (default) creates ResizeObserver observing container', async () => {
    const { useDiagramViewer } = await import('../useDiagramViewer')
    const container = makeContainer()
    const svgContainer = makeSvgContainer()
    const viewer = useDiagramViewer({
      containerRef: container.ref,
      svgContainerRef: svgContainer.ref,
    })
    const origRO = globalThis.ResizeObserver
    const observeSpy = vi.fn()
    const roCtor = vi.fn(() => ({ observe: observeSpy, disconnect: vi.fn() }))
    ;(globalThis as any).ResizeObserver = roCtor
    viewer.setupResizeObserver()
    expect(roCtor).toHaveBeenCalledTimes(1)
    expect(observeSpy).toHaveBeenCalledWith(container.el)
    ;(globalThis as any).ResizeObserver = origRO
    viewer.cleanup()
    svgContainer.el.remove()
    container.el.remove()
  })

  it('setupRefreshListener adds listener for refreshEventName', async () => {
    const { useDiagramViewer } = await import('../useDiagramViewer')
    const container = makeContainer()
    const svgContainer = makeSvgContainer()
    const viewer = useDiagramViewer({
      containerRef: container.ref,
      svgContainerRef: svgContainer.ref,
      refreshEventName: 'diagram-refresh',
    })
    const spy = vi.spyOn(container.el, 'addEventListener')
    viewer.setupRefreshListener()
    expect(spy).toHaveBeenCalledWith('diagram-refresh', expect.any(Function))
    viewer.cleanup()
    svgContainer.el.remove()
    container.el.remove()
  })

  it('refreshPanName configurable (mermaid-refresh)', async () => {
    const { useDiagramViewer } = await import('../useDiagramViewer')
    const container = makeContainer()
    const svgContainer = makeSvgContainer()
    const viewer = useDiagramViewer({
      containerRef: container.ref,
      svgContainerRef: svgContainer.ref,
      refreshEventName: 'mermaid-refresh',
    })
    const spy = vi.spyOn(container.el, 'addEventListener')
    viewer.setupRefreshListener()
    expect(spy).toHaveBeenCalledWith('mermaid-refresh', expect.any(Function))
    viewer.cleanup()
    svgContainer.el.remove()
    container.el.remove()
  })

  it('destroyPanZoom destroys and nulls instance', async () => {
    const { useDiagramViewer } = await import('../useDiagramViewer')
    const container = makeContainer()
    const svgContainer = makeSvgContainer()
    const viewer = useDiagramViewer({
      containerRef: container.ref,
      svgContainerRef: svgContainer.ref,
    })
    await viewer.initPanZoom()
    viewer.destroyPanZoom()
    expect(mockDestroy).toHaveBeenCalled()
    // After destroy, onWheel should be a no-op (no zoom call)
    mockZoom.mockClear()
    const event = new WheelEvent('wheel', { deltaY: 100, cancelable: true })
    vi.spyOn(event, 'preventDefault')
    viewer.onWheel(event)
    expect(mockZoom).not.toHaveBeenCalled()
    svgContainer.el.remove()
    container.el.remove()
  })

  it('refreshPanZoom reuses instance and calls resize+fit+center', async () => {
    const { useDiagramViewer } = await import('../useDiagramViewer')
    const container = makeContainer()
    const svgContainer = makeSvgContainer()
    const viewer = useDiagramViewer({
      containerRef: container.ref,
      svgContainerRef: svgContainer.ref,
    })
    await viewer.initPanZoom()
    expect(svgPanZoomMock).toHaveBeenCalledTimes(1)
    await viewer.refreshPanZoom()
    // Refresh reuses the existing instance — svg-pan-zoom's instancesStore
    // returns the same broken instance if we re-init the same SVG.
    expect(svgPanZoomMock).toHaveBeenCalledTimes(1)
    expect(mockFit).toHaveBeenCalled()
    expect(mockCenter).toHaveBeenCalled()
    expect(mockResize).toHaveBeenCalled()
    viewer.cleanup()
    svgContainer.el.remove()
    container.el.remove()
  })
})

describe('useModalPanZoom', () => {
  beforeEach(() => {
    svgPanZoomMock.mockClear()
    mockZoom.mockClear()
    mockGetZoom.mockClear()
    mockDestroy.mockClear()
    mockZoomIn.mockClear()
    mockZoomOut.mockClear()
    mockReset.mockClear()
    mockCenter.mockClear()
  })

  it('returns expected functions', async () => {
    const { useModalPanZoom } = await import('../useDiagramViewer')
    const modalSvgWrapperRef = ref<HTMLElement | undefined>(undefined)
    const modal = useModalPanZoom({ modalSvgWrapperRef })
    expect(typeof modal.initModalPanZoom).toBe('function')
    expect(typeof modal.destroyModalPanZoom).toBe('function')
    expect(typeof modal.onWheelModal).toBe('function')
    expect(typeof modal.zoomInModal).toBe('function')
    expect(typeof modal.zoomOutModal).toBe('function')
    expect(typeof modal.resetZoomModal).toBe('function')
  })

  it('initModalPanZoom creates instance with default maxZoom 20', async () => {
    const { useModalPanZoom } = await import('../useDiagramViewer')
    const wrapper = makeSvgContainer()
    const modal = useModalPanZoom({ modalSvgWrapperRef: wrapper.ref })
    await modal.initModalPanZoom()
    expect(svgPanZoomMock).toHaveBeenCalledTimes(1)
    const opts = svgPanZoomMock.mock.calls[0][1] as any
    expect(opts.maxZoom).toBe(20)
    modal.destroyModalPanZoom()
    wrapper.el.remove()
  })

  it('onWheelModal clamps to modal maxZoom (20)', async () => {
    const { useModalPanZoom } = await import('../useDiagramViewer')
    const wrapper = makeSvgContainer()
    const modal = useModalPanZoom({ modalSvgWrapperRef: wrapper.ref })
    await modal.initModalPanZoom()
    await nextTick()

    const event = new WheelEvent('wheel', { deltaY: -100, cancelable: true })
    vi.spyOn(event, 'preventDefault')
    mockGetZoom.mockReturnValue(50)

    modal.onWheelModal(event)

    // 50 * 1.1 = 55 -> clamp to 20
    expect(mockZoom).toHaveBeenCalledWith(20)

    modal.destroyModalPanZoom()
    wrapper.el.remove()
  })

  it('zoomInModal/zoomOutModal/resetZoomModal delegate to instance', async () => {
    const { useModalPanZoom } = await import('../useDiagramViewer')
    const wrapper = makeSvgContainer()
    const modal = useModalPanZoom({ modalSvgWrapperRef: wrapper.ref })
    await modal.initModalPanZoom()

    modal.zoomInModal()
    expect(mockZoomIn).toHaveBeenCalled()

    modal.zoomOutModal()
    expect(mockZoomOut).toHaveBeenCalled()

    modal.resetZoomModal()
    expect(mockReset).toHaveBeenCalled()
    expect(mockCenter).toHaveBeenCalled()

    modal.destroyModalPanZoom()
    wrapper.el.remove()
  })

  it('destroyModalPanZoom destroys instance', async () => {
    const { useModalPanZoom } = await import('../useDiagramViewer')
    const wrapper = makeSvgContainer()
    const modal = useModalPanZoom({ modalSvgWrapperRef: wrapper.ref })
    await modal.initModalPanZoom()
    modal.destroyModalPanZoom()
    expect(mockDestroy).toHaveBeenCalled()
    // after destroy, zoomInModal is a no-op
    mockZoomIn.mockClear()
    modal.zoomInModal()
    expect(mockZoomIn).not.toHaveBeenCalled()
    wrapper.el.remove()
  })
})
