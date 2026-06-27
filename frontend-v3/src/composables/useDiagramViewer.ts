import { nextTick, type Ref } from 'vue'

interface UseDiagramViewerOptions {
  containerRef: Ref<HTMLElement | undefined>
  svgContainerRef: Ref<HTMLElement | undefined>
  maxZoom?: number
  minZoom?: number
  enableTouch?: boolean
  enableResize?: boolean
  refreshEventName?: string
}

interface UseModalPanZoomOptions {
  modalSvgWrapperRef: Ref<HTMLElement | undefined>
  maxZoom?: number
}

export function useDiagramViewer(options: UseDiagramViewerOptions) {
  const {
    containerRef,
    svgContainerRef,
    maxZoom = 10,
    minZoom = 0.1,
    enableTouch = true,
    enableResize = true,
    refreshEventName = 'diagram-refresh',
  } = options

  let panZoomInstance: any = null
  let resizeObserver: ResizeObserver | null = null

  let touchStartDistance = 0
  let initialZoom = 1
  let isDragging = false
  let startX = 0
  let startY = 0

  let refreshHandler: (() => void) | null = null

  async function initPanZoom() {
    if (!svgContainerRef.value) return

    const svg = svgContainerRef.value.querySelector('svg')
    if (!svg) return

    await nextTick()

    svg.removeAttribute('width')
    svg.removeAttribute('height')
    svg.style.width = '100%'
    svg.style.height = '100%'
    svg.style.maxWidth = '100%'
    svg.style.maxHeight = '100%'

    try {
      const svgPanZoom = (await import('svg-pan-zoom')).default
      panZoomInstance = svgPanZoom(svg as SVGSVGElement, {
        zoomEnabled: true,
        controlIconsEnabled: false,
        fit: true,
        center: true,
        minZoom,
        maxZoom,
        panEnabled: true,
        mouseWheelZoomEnabled: false,
        preventMouseEventsDefault: false,
      })
      if (containerRef.value) {
        ;(containerRef.value as any).__panZoomInstance = panZoomInstance
      }
    } catch (e) {
      console.warn('svg-pan-zoom init failed:', e)
      panZoomInstance = null
    }
  }

  function destroyPanZoom() {
    if (panZoomInstance) {
      panZoomInstance.destroy()
      panZoomInstance = null
    }
  }

  async function refreshPanZoom() {
    destroyPanZoom()
    await nextTick()
    await initPanZoom()
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault()
    if (!panZoomInstance) return
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const currentZoom = panZoomInstance.getZoom()
    const newZoom = Math.max(minZoom, Math.min(maxZoom, currentZoom * delta))
    panZoomInstance.zoom(newZoom)
  }

  function onTouchStart(e: TouchEvent) {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      touchStartDistance = Math.sqrt(dx * dx + dy * dy)
      initialZoom = panZoomInstance?.getZoom() || 1
    } else if (e.touches.length === 1) {
      isDragging = true
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
    }
  }

  function onTouchMove(e: TouchEvent) {
    if (!panZoomInstance) return
    if (e.touches.length === 2 && touchStartDistance > 0) {
      e.preventDefault()
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const distance = Math.sqrt(dx * dx + dy * dy)
      const scale = distance / touchStartDistance
      const newZoom = Math.max(minZoom, Math.min(maxZoom, initialZoom * scale))
      panZoomInstance.zoom(newZoom)
    } else if (e.touches.length === 1 && isDragging) {
      e.preventDefault()
      const dx = e.touches[0].clientX - startX
      const dy = e.touches[0].clientY - startY
      panZoomInstance.panBy({ x: dx, y: dy })
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
    }
  }

  function onTouchEnd() {
    isDragging = false
    touchStartDistance = 0
  }

  function setupTouchListeners() {
    if (!enableTouch || !containerRef.value) return
    containerRef.value.addEventListener('touchstart', onTouchStart, { passive: false })
    containerRef.value.addEventListener('touchmove', onTouchMove, { passive: false })
    containerRef.value.addEventListener('touchend', onTouchEnd)
  }

  function removeTouchListeners() {
    if (!containerRef.value) return
    containerRef.value.removeEventListener('touchstart', onTouchStart)
    containerRef.value.removeEventListener('touchmove', onTouchMove)
    containerRef.value.removeEventListener('touchend', onTouchEnd)
  }

  function setupResizeObserver() {
    if (!enableResize || !containerRef.value || !('ResizeObserver' in window)) return
    resizeObserver = new ResizeObserver(() => {
      if (panZoomInstance) {
        panZoomInstance.resize()
        panZoomInstance.fit()
        panZoomInstance.center()
      }
    })
    resizeObserver.observe(containerRef.value)
  }

  function setupRefreshListener() {
    if (!containerRef.value) return
    refreshHandler = () => {
      refreshPanZoom()
    }
    containerRef.value.addEventListener(refreshEventName, refreshHandler)
  }

  function cleanup() {
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
    destroyPanZoom()
    removeTouchListeners()
    if (refreshHandler && containerRef.value) {
      containerRef.value.removeEventListener(refreshEventName, refreshHandler)
      refreshHandler = null
    }
  }

  return {
    initPanZoom,
    destroyPanZoom,
    refreshPanZoom,
    onWheel,
    setupTouchListeners,
    removeTouchListeners,
    setupResizeObserver,
    setupRefreshListener,
    cleanup,
  }
}

export function useModalPanZoom(options: UseModalPanZoomOptions) {
  const { modalSvgWrapperRef, maxZoom = 20 } = options
  const minZoom = 0.1

  let modalPanZoomInstance: any = null

  async function initModalPanZoom() {
    if (!modalSvgWrapperRef.value) return

    const svg = modalSvgWrapperRef.value.querySelector('svg')
    if (!svg) return

    await nextTick()

    svg.removeAttribute('width')
    svg.removeAttribute('height')
    svg.style.width = '100%'
    svg.style.height = '100%'
    svg.style.maxWidth = '100%'
    svg.style.maxHeight = '100%'

    try {
      const svgPanZoom = (await import('svg-pan-zoom')).default
      modalPanZoomInstance = svgPanZoom(svg as SVGSVGElement, {
        zoomEnabled: true,
        controlIconsEnabled: false,
        fit: true,
        center: true,
        minZoom,
        maxZoom,
        panEnabled: true,
        mouseWheelZoomEnabled: false,
        preventMouseEventsDefault: false,
      })
    } catch (e) {
      console.warn('svg-pan-zoom init failed:', e)
      modalPanZoomInstance = null
    }
  }

  function destroyModalPanZoom() {
    if (modalPanZoomInstance) {
      modalPanZoomInstance.destroy()
      modalPanZoomInstance = null
    }
  }

  function onWheelModal(e: WheelEvent) {
    e.preventDefault()
    if (!modalPanZoomInstance) return
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const currentZoom = modalPanZoomInstance.getZoom()
    const newZoom = Math.max(minZoom, Math.min(maxZoom, currentZoom * delta))
    modalPanZoomInstance.zoom(newZoom)
  }

  function zoomInModal() {
    modalPanZoomInstance?.zoomIn()
  }

  function zoomOutModal() {
    modalPanZoomInstance?.zoomOut()
  }

  function resetZoomModal() {
    modalPanZoomInstance?.reset()
    modalPanZoomInstance?.center()
  }

  return {
    initModalPanZoom,
    destroyModalPanZoom,
    onWheelModal,
    zoomInModal,
    zoomOutModal,
    resetZoomModal,
  }
}
