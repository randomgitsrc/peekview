<!-- P4c1: script setup 实现（template/style 占位，P4c2 再写） -->
<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'

const props = defineProps<{
  // ── 渲染源 ──
  svgContent: string
  codeViewHtml: string
  // ── 标识 ──
  blockId: string | number
  blockIndex: number
  classPrefix: 'mermaid' | 'plantuml' | 'svg'
  // ── 主题 ──
  theme: 'light' | 'dark'
  // ── PNG 导出差异 ──
  pngBackground: '#ffffff' | 'transparent'
  pngViewBoxFallback: 'g-root-getBBox' | 'width-height-attrs'
  pngFinalSize: { width: number; height: number }
  pngBrFix: boolean
  pngFilenamePrefix: string
  // ── panZoom 配置差异 ──
  panZoomMinZoom: number
  panZoomMaxZoom: number
  panZoomInitTryCatch: boolean
  // ── 交互差异 ──
  touchEnabled: boolean
  resizeEnabled: boolean
  // ── refresh 事件差异 ──
  refreshEventName: string
  // ── modal 差异 ──
  modalTitle: string
  // ── emit handler 差异（P4c2 template 用）──
  toggleTextUpdates: boolean
  refreshOnToggle: boolean
  copyFeedback: boolean
  menuClickOutside: boolean
  menuCloseOthers: boolean
}>()

const emit = defineEmits<{
  (e: 'fullscreen', blockId: string | number): void
  (e: 'download-png', blockId: string | number): void
  (e: 'toggle-view', blockId: string | number): void
  (e: 'toggle-menu', blockId: string | number): void
  (e: 'copy-code', blockId: string | number): void
  (e: 'start-resize', blockId: string | number, startY: number): void
}>()

// ── DOM refs（P4c2 template 绑定）──
const containerRef = ref<HTMLElement>()
const svgContainer = ref<HTMLElement>()
const modalContainer = ref<HTMLElement>()
const modalSvgWrapper = ref<HTMLElement>()

// ── 状态 ──
const isFullscreen = ref(false)
let panZoomInstance: any = null
let modalPanZoomInstance: any = null
let resizeObserver: ResizeObserver | null = null

// ── panZoom init（参照 MermaidDiagram.initPanZoom）──
async function initPanZoom() {
  if (!svgContainer.value) return

  const svg = svgContainer.value.querySelector('svg')
  if (!svg) return

  await nextTick()

  svg.removeAttribute('width')
  svg.removeAttribute('height')
  svg.style.width = '100%'
  svg.style.height = '100%'
  svg.style.maxWidth = '100%'
  svg.style.maxHeight = '100%'

  const svgPanZoom = (await import('svg-pan-zoom')).default

  const options: any = {
    zoomEnabled: true,
    controlIconsEnabled: false,
    fit: true,
    center: true,
    minZoom: props.panZoomMinZoom,
    maxZoom: props.panZoomMaxZoom,
    panEnabled: true,
    mouseWheelZoomEnabled: false,
    preventMouseEventsDefault: false,
  }

  if (props.panZoomInitTryCatch) {
    try {
      panZoomInstance = svgPanZoom(svg as SVGSVGElement, options)
    } catch (e) {
      console.warn('Failed to init pan-zoom:', e)
      panZoomInstance = null
    }
  } else {
    panZoomInstance = svgPanZoom(svg as SVGSVGElement, options)
  }

  if (containerRef.value) {
    ;(containerRef.value as any).__panZoomInstance = panZoomInstance
  }
}

async function initModalPanZoom() {
  if (!modalSvgWrapper.value) return

  const svg = modalSvgWrapper.value.querySelector('svg')
  if (!svg) return

  await nextTick()

  svg.removeAttribute('width')
  svg.removeAttribute('height')
  svg.style.width = '100%'
  svg.style.height = '100%'
  svg.style.maxWidth = '100%'
  svg.style.maxHeight = '100%'

  const svgPanZoom = (await import('svg-pan-zoom')).default

  const options: any = {
    zoomEnabled: true,
    controlIconsEnabled: false,
    fit: true,
    center: true,
    minZoom: props.panZoomMinZoom,
    maxZoom: 20,
    panEnabled: true,
    mouseWheelZoomEnabled: false,
    preventMouseEventsDefault: false,
  }

  modalPanZoomInstance = svgPanZoom(svg as SVGSVGElement, options)
}

// ── zoom（P2 修订4：zoom 不 emit，按钮 @click 直调）──
function zoomIn() {
  panZoomInstance?.zoomIn()
}

function zoomOut() {
  panZoomInstance?.zoomOut()
}

function resetZoom() {
  if (panZoomInstance) {
    panZoomInstance.reset()
    panZoomInstance.center()
  }
}

// ── modal zoom ──
function zoomInModal() {
  modalPanZoomInstance?.zoomIn()
}

function zoomOutModal() {
  modalPanZoomInstance?.zoomOut()
}

function resetZoomModal() {
  if (modalPanZoomInstance) {
    modalPanZoomInstance.reset()
    modalPanZoomInstance.center()
  }
}

// ── fullscreen ──
function toggleFullscreen() {
  isFullscreen.value = true
  emit('fullscreen', props.blockId)
  nextTick(async () => {
    await initModalPanZoom()
  })
}

function closeFullscreen() {
  isFullscreen.value = false
  if (modalPanZoomInstance) {
    modalPanZoomInstance.destroy()
    modalPanZoomInstance = null
  }
}

// ── PNG 导出（modal 路径：用传入 svgContent；inline 路径：用挂载 DOM svg via downloadPng）──
async function exportToPng(svgString: string): Promise<Blob> {
  if (!svgString) {
    throw new Error('No SVG content available')
  }

  const fixedSvg = props.pngBrFix ? svgString.replace(/<br>/gi, '<br/>') : svgString
  const parser = new DOMParser()
  const svgDoc = parser.parseFromString(fixedSvg, 'image/svg+xml')
  const svgEl = svgDoc.documentElement as unknown as SVGElement

  const parseError = svgDoc.querySelector('parsererror')
  if (parseError) {
    console.error('SVG Parse Error:', parseError.textContent)
    console.error('SVG String preview:', svgString.substring(0, 500))
    throw new Error(`Failed to parse SVG: ${parseError.textContent?.substring(0, 100)}`)
  }

  let width = 0
  let height = 0

  if (props.pngViewBoxFallback === 'g-root-getBBox') {
    const viewBox = svgEl.getAttribute('viewBox')
    if (viewBox) {
      const parts = viewBox.split(/\s+/).map(parseFloat)
      if (parts.length >= 4) {
        width = Math.ceil(parts[2] + 20)
        height = Math.ceil(parts[3] + 20)
      }
    }

    if (width === 0 || height === 0) {
      try {
        const tempDiv = document.createElement('div')
        tempDiv.style.cssText = 'position: absolute; left: -9999px; top: 0; visibility: hidden;'
        tempDiv.innerHTML = svgString
        document.body.appendChild(tempDiv)
        const svg = tempDiv.querySelector('svg')
        if (svg) {
          const rootGroup = svg.querySelector('g.root')
          if (rootGroup) {
            const bbox = (rootGroup as SVGGElement).getBBox()
            if (bbox && bbox.width > 0 && bbox.height > 0) {
              width = Math.ceil(bbox.width + 40)
              height = Math.ceil(bbox.height + 40)
            }
          }
        }
        document.body.removeChild(tempDiv)
      } catch (e) {
        console.error('Error getting bbox:', e)
      }
    }
  } else {
    const wAttr = svgEl.getAttribute('width')
    const hAttr = svgEl.getAttribute('height')
    if (wAttr) width = parseFloat(wAttr)
    if (hAttr) height = parseFloat(hAttr)
  }

  if (width === 0 || height === 0) {
    width = props.pngFinalSize.width
    height = props.pngFinalSize.height
  }

  width = Math.max(width, 100)
  height = Math.max(height, 100)

  svgEl.setAttribute('width', String(width))
  svgEl.setAttribute('height', String(height))
  svgEl.style.width = `${width}px`
  svgEl.style.height = `${height}px`
  svgEl.style.maxWidth = 'none'
  svgEl.style.maxHeight = 'none'

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
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')!

  if (props.pngBackground !== 'transparent') {
    ctx.fillStyle = props.pngBackground
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  ctx.drawImage(img, 0, 0, width, height)

  return new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b!), 'image/png')
  })
}

// inline PNG 下载（用 props.svgContent 走 exportToPng）
async function downloadPng() {
  try {
    const blob = await exportToPng(props.svgContent)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${props.pngFilenamePrefix}-${props.blockId}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('Failed to export PNG:', err)
  }
}

// ── wheel 自定义缩放（参照 MermaidDiagram.onWheel）──
function onWheel(e: WheelEvent) {
  e.preventDefault()
  if (!panZoomInstance) return

  const delta = e.deltaY > 0 ? 0.9 : 1.1
  const currentZoom = panZoomInstance.getZoom()
  const newZoom = Math.max(props.panZoomMinZoom, Math.min(props.panZoomMaxZoom, currentZoom * delta))
  panZoomInstance.zoom(newZoom)
}

function onWheelModal(e: WheelEvent) {
  e.preventDefault()
  if (!modalPanZoomInstance) return

  const delta = e.deltaY > 0 ? 0.9 : 1.1
  const currentZoom = modalPanZoomInstance.getZoom()
  const newZoom = Math.max(props.panZoomMinZoom, Math.min(20, currentZoom * delta))
  modalPanZoomInstance.zoom(newZoom)
}

// ── touch（mobile，touchEnabled 控制是否绑定）──
let touchStartDistance = 0
let initialZoom = 1
let isDragging = false
let startX = 0
let startY = 0

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
    const newZoom = Math.max(props.panZoomMinZoom, Math.min(props.panZoomMaxZoom, initialZoom * scale))
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

// ── refresh（销毁 + 重建 panZoom）──
async function refreshPanZoom() {
  if (panZoomInstance) {
    panZoomInstance.destroy()
    panZoomInstance = null
  }
  await nextTick()
  await initPanZoom()
}

function getSvgElement(): SVGSVGElement | null {
  return (svgContainer.value?.querySelector('svg') as SVGSVGElement | null) ?? null
}

// ── watch svgContent（参照 MermaidDiagram：immediate + nextTick 延迟到 mount 后）──
watch(
  () => props.svgContent,
  async () => {
    if (panZoomInstance) {
      panZoomInstance.destroy()
      panZoomInstance = null
    }
    await nextTick()
    await initPanZoom()
  },
  { immediate: true }
)

onMounted(() => {
  if (props.resizeEnabled && containerRef.value && 'ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(() => {
      if (panZoomInstance) {
        panZoomInstance.resize()
        panZoomInstance.fit()
        panZoomInstance.center()
      }
    })
    resizeObserver.observe(containerRef.value)
  }

  if (props.touchEnabled && containerRef.value) {
    containerRef.value.addEventListener('touchstart', onTouchStart, { passive: false })
    containerRef.value.addEventListener('touchmove', onTouchMove, { passive: false })
    containerRef.value.addEventListener('touchend', onTouchEnd)
  }

  if (containerRef.value && props.refreshEventName) {
    containerRef.value.addEventListener(props.refreshEventName, () => {
      refreshPanZoom()
    })
  }
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (panZoomInstance) {
    panZoomInstance.destroy()
    panZoomInstance = null
  }
  if (modalPanZoomInstance) {
    modalPanZoomInstance.destroy()
    modalPanZoomInstance = null
  }
  if (containerRef.value) {
    containerRef.value.removeEventListener('touchstart', onTouchStart)
    containerRef.value.removeEventListener('touchmove', onTouchMove)
    containerRef.value.removeEventListener('touchend', onTouchEnd)
  }
})

defineExpose({
  zoomIn,
  zoomOut,
  resetZoom,
  toggleFullscreen,
  refreshPanZoom,
  getSvgElement,
  downloadPng,
  exportToPng,
})
</script>

<template><div></div></template>
