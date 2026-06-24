<template>
  <div ref="containerRef" class="svg-viewer" @wheel="onWheel">
    <div ref="svgContainer" class="svg-container" v-html="svgContent"></div>
    <button class="svg-fullscreen-trigger" @click="toggleFullscreen" style="display: none;"></button>
  </div>

  <Teleport to="body">
    <div
      v-if="isFullscreen"
      class="svg-modal-overlay"
      @click.self="closeFullscreen"
    >
      <div class="svg-modal">
        <div class="svg-modal-toolbar">
          <span class="modal-title">SVG Diagram</span>
          <button class="toolbar-btn" @click="zoomInModal" title="Zoom In">+</button>
          <button class="toolbar-btn" @click="zoomOutModal" title="Zoom Out">−</button>
          <button class="toolbar-btn" @click="resetZoomModal" title="Reset">⟲</button>
          <button class="toolbar-btn" @click="downloadPng" title="Download PNG">⬇</button>
          <button class="toolbar-btn close-btn" @click="closeFullscreen" title="Close">×</button>
        </div>
        <div ref="modalContainer" class="svg-modal-container" @wheel="onWheelModal">
          <div ref="modalSvgWrapper" class="svg-wrapper" v-html="svgContent"></div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'

interface Props {
  svgContent: string
  id: string
}

const props = defineProps<Props>()

const containerRef = ref<HTMLElement>()
const svgContainer = ref<HTMLElement>()
const modalContainer = ref<HTMLElement>()
const modalSvgWrapper = ref<HTMLElement>()
const isFullscreen = ref(false)

let panZoomInstance: any = null
let modalPanZoomInstance: any = null
let resizeObserver: ResizeObserver | null = null

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
  try {
    const svgPanZoom = (await import('svg-pan-zoom')).default
    panZoomInstance = svgPanZoom(svg as SVGSVGElement, {
      zoomEnabled: true,
      controlIconsEnabled: false,
      fit: true,
      center: true,
      minZoom: 0.1,
      maxZoom: 10,
      panEnabled: true,
      mouseWheelZoomEnabled: false,
      preventMouseEventsDefault: false,
    })
    if (containerRef.value) {
      (containerRef.value as any).__panZoomInstance = panZoomInstance
    }
  } catch (e) {
    console.warn('svg-pan-zoom init failed:', e)
    panZoomInstance = null
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
  try {
    const svgPanZoom = (await import('svg-pan-zoom')).default
    modalPanZoomInstance = svgPanZoom(svg as SVGSVGElement, {
      zoomEnabled: true,
      controlIconsEnabled: false,
      fit: true,
      center: true,
      minZoom: 0.1,
      maxZoom: 20,
      panEnabled: true,
      mouseWheelZoomEnabled: false,
      preventMouseEventsDefault: false,
    })
  } catch (e) {
    console.warn('svg-pan-zoom init failed:', e)
    modalPanZoomInstance = null
  }
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

function toggleFullscreen() {
  isFullscreen.value = true
  nextTick(async () => {
    await initModalPanZoom()
  })
}

function closeFullscreen() {
  isFullscreen.value = false
  modalPanZoomInstance?.destroy()
  modalPanZoomInstance = null
}

async function downloadPng() {
  try {
    const blob = await exportSvgToPng()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `svg-diagram-${props.id}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('Failed to export SVG PNG:', err)
  }
}

async function exportSvgToPng(): Promise<Blob> {
  const svgString = props.svgContent
  if (!svgString) throw new Error('No SVG content available')

  const parser = new DOMParser()
  const svgDoc = parser.parseFromString(svgString, 'image/svg+xml')
  const svgEl = svgDoc.documentElement as unknown as SVGElement

  const parseError = svgDoc.querySelector('parsererror')
  if (parseError) {
    throw new Error(`Failed to parse SVG: ${parseError.textContent?.substring(0, 100)}`)
  }

  let width = 0, height = 0

  const viewBox = svgEl.getAttribute('viewBox')
  if (viewBox) {
    const parts = viewBox.split(/\s+/).map(parseFloat)
    if (parts.length >= 4) {
      width = Math.ceil(parts[2] + 20)
      height = Math.ceil(parts[3] + 20)
    }
  }

  if (width === 0 || height === 0) {
    const w = svgEl.getAttribute('width')
    const h = svgEl.getAttribute('height')
    if (w) width = Math.ceil(parseFloat(w) + 20)
    if (h) height = Math.ceil(parseFloat(h) + 20)
  }

  if (width === 0 || height === 0) {
    width = 400
    height = 300
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
  // 透明背景：不调 fillRect，canvas 默认全像素 alpha=0
  ctx.drawImage(img, 0, 0, width, height)

  return new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b!), 'image/png')
  })
}

function onWheel(e: WheelEvent) {
  e.preventDefault()
  if (!panZoomInstance) return
  const delta = e.deltaY > 0 ? 0.9 : 1.1
  const currentZoom = panZoomInstance.getZoom()
  const newZoom = Math.max(0.1, Math.min(10, currentZoom * delta))
  panZoomInstance.zoom(newZoom)
}

function onWheelModal(e: WheelEvent) {
  e.preventDefault()
  if (!modalPanZoomInstance) return
  const delta = e.deltaY > 0 ? 0.9 : 1.1
  const currentZoom = modalPanZoomInstance.getZoom()
  const newZoom = Math.max(0.1, Math.min(20, currentZoom * delta))
  modalPanZoomInstance.zoom(newZoom)
}

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
    const newZoom = Math.max(0.1, Math.min(10, initialZoom * scale))
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

watch(() => props.svgContent, async () => {
  if (panZoomInstance) {
    panZoomInstance.destroy()
    panZoomInstance = null
  }
  await nextTick()
  await initPanZoom()
}, { immediate: true })

onMounted(() => {
  if (containerRef.value && 'ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(() => {
      if (panZoomInstance) {
        panZoomInstance.resize()
        panZoomInstance.fit()
        panZoomInstance.center()
      }
    })
    resizeObserver.observe(containerRef.value)
  }

  if (containerRef.value) {
    containerRef.value.addEventListener('touchstart', onTouchStart, { passive: false })
    containerRef.value.addEventListener('touchmove', onTouchMove, { passive: false })
    containerRef.value.addEventListener('touchend', onTouchEnd)
  }

  if (containerRef.value) {
    containerRef.value.addEventListener('svg-refresh', () => {
      refreshPanZoom()
    })
  }
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
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

async function refreshPanZoom() {
  if (panZoomInstance) {
    panZoomInstance.destroy()
    panZoomInstance = null
  }
  await nextTick()
  await initPanZoom()
}

defineExpose({
  toggleFullscreen,
  downloadPng,
  refreshPanZoom,
})
</script>

<style scoped>
.svg-viewer {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: grab;
}

.svg-viewer:active {
  cursor: grabbing;
}

.svg-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.svg-container :deep(svg) {
  max-width: 100%;
  max-height: 100%;
}

.svg-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
}

.svg-modal {
  width: 100%;
  max-width: 1400px;
  height: 90vh;
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}

.svg-modal-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
}

.modal-title {
  flex: 1;
  font-weight: 600;
  color: var(--text-primary);
}

.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 16px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.toolbar-btn:hover {
  background: var(--bg-secondary);
  border-color: var(--border-hover);
}

.toolbar-btn.close-btn {
  margin-left: var(--space-2);
  font-size: 20px;
}

.svg-modal-container {
  flex: 1;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  cursor: grab;
}

.svg-modal-container:active {
  cursor: grabbing;
}

.svg-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.svg-wrapper :deep(svg) {
  max-width: 100%;
  max-height: 100%;
}
</style>
