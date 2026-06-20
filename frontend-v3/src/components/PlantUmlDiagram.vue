<template>
  <div ref="containerRef" class="plantuml-viewer" @wheel="onWheel">
    <div ref="svgContainer" class="svg-container" v-html="svgContent"></div>
    <button class="plantuml-fullscreen-trigger" @click="toggleFullscreen" style="display: none;"></button>
  </div>

  <Teleport to="body">
    <div
      v-if="isFullscreen"
      class="plantuml-modal-overlay"
      @click.self="closeFullscreen"
    >
      <div class="plantuml-modal">
        <div class="plantuml-modal-toolbar">
          <span class="modal-title">PlantUML Diagram</span>
          <button class="toolbar-btn" @click="zoomInModal" title="Zoom In">+</button>
          <button class="toolbar-btn" @click="zoomOutModal" title="Zoom Out">−</button>
          <button class="toolbar-btn" @click="resetZoomModal" title="Reset">⟲</button>
          <button class="toolbar-btn" @click="downloadPng" title="Download PNG">⬇</button>
          <button class="toolbar-btn close-btn" @click="closeFullscreen" title="Close">×</button>
        </div>
        <div ref="modalContainer" class="plantuml-modal-container" @wheel="onWheelModal">
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
}

function zoomIn() {
  panZoomInstance?.zoomIn()
}
function zoomOut() {
  panZoomInstance?.zoomOut()
}
function resetZoom() {
  panZoomInstance?.reset()
  panZoomInstance?.center()
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
    const blob = await exportPlantUmlToPng()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `plantuml-diagram-${props.id}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('Failed to export PlantUML PNG:', err)
  }
}

async function exportPlantUmlToPng(): Promise<Blob> {
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
    width = 800
    height = 600
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
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
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

watch(() => props.svgContent, async () => {
  panZoomInstance?.destroy()
  panZoomInstance = null
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
    containerRef.value.addEventListener('plantuml-refresh', () => {
      refreshPanZoom()
    })
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  panZoomInstance?.destroy()
  panZoomInstance = null
  modalPanZoomInstance?.destroy()
  modalPanZoomInstance = null
})

async function refreshPanZoom() {
  panZoomInstance?.destroy()
  panZoomInstance = null
  await nextTick()
  await initPanZoom()
}

defineExpose({
  zoomIn,
  zoomOut,
  resetZoom,
  toggleFullscreen,
  refreshPanZoom,
  getSvgElement: () => svgContainer.value?.querySelector('svg'),
  downloadPng,
  exportPlantUmlToPng,
})
</script>

<style scoped>
.plantuml-viewer {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: grab;
}

.plantuml-viewer:active {
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

.plantuml-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
}

.plantuml-modal {
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

.plantuml-modal-toolbar {
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

.plantuml-modal-container {
  flex: 1;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  cursor: grab;
}

.plantuml-modal-container:active {
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
