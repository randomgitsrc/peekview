<template>
  <div ref="containerRef" class="diagram-svg-container" @wheel="viewer.onWheel">
    <div ref="svgContainerRef" v-html="svgContent"></div>
  </div>

  <Teleport to="body">
    <div
      v-if="isFullscreen"
      class="diagram-modal"
      @click.self="closeFullscreen"
    >
      <div class="diagram-modal-content">
        <div class="diagram-modal-toolbar">
          <span class="diagram-modal-title">PlantUML Diagram</span>
          <button class="diagram-toolbar-btn" @click="modal.zoomInModal" title="Zoom In">+</button>
          <button class="diagram-toolbar-btn" @click="modal.zoomOutModal" title="Zoom Out">−</button>
          <button class="diagram-toolbar-btn" @click="modal.resetZoomModal" title="Reset">⟲</button>
          <button class="diagram-toolbar-btn" @click="downloadPng" title="Download PNG">⬇</button>
          <button class="diagram-toolbar-btn close-btn" @click="closeFullscreen" title="Close">×</button>
        </div>
        <div
          ref="modalSvgContainerRef"
          class="diagram-modal-svg-container"
          @wheel="modal.onWheelModal"
        >
          <div ref="modalSvgWrapperRef" class="diagram-svg-wrapper" v-html="svgContent"></div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import * as usePlantUML from '@/composables/usePlantUML'
import { useDiagramViewer, useModalPanZoom } from '@/composables/useDiagramViewer'

interface Props {
  code: string
  theme: 'dark' | 'light'
}

const props = defineProps<Props>()
const emit = defineEmits<{
  renderError: []
}>()

const containerRef = ref<HTMLElement>()
const svgContainerRef = ref<HTMLElement>()
const modalSvgContainerRef = ref<HTMLElement>()
const modalSvgWrapperRef = ref<HTMLElement>()

const svgContent = ref('')
const isFullscreen = ref(false)
const cancelled = ref(false)

const viewer = useDiagramViewer({
  containerRef,
  svgContainerRef,
  enableTouch: false,
  enableResize: false,
  refreshEventName: 'plantuml-refresh',
  maxZoom: 10,
})

const modal = useModalPanZoom({
  modalSvgWrapperRef,
  maxZoom: 20,
})

async function renderDiagram() {
  try {
    await usePlantUML.ensureLoaded()
    if (cancelled.value) return
    const svg = await usePlantUML.render(props.code, props.theme)
    if (cancelled.value) return
    svgContent.value = svg
  } catch (err) {
    console.error('PlantUML render failed:', err)
    if (cancelled.value) return
    emit('renderError')
  }
}

function openFullscreen() {
  isFullscreen.value = true
  nextTick(() => {
    modal.initModalPanZoom()
  })
}

function closeFullscreen() {
  isFullscreen.value = false
  modal.destroyModalPanZoom()
}

async function exportPng(): Promise<Blob> {
  const svgString = await usePlantUML.render(props.code, props.theme)
  if (!svgString) {
    throw new Error('No SVG content available')
  }

  const parser = new DOMParser()
  const svgDoc = parser.parseFromString(svgString, 'image/svg+xml')
  const svgEl = svgDoc.documentElement as unknown as SVGElement

  const parseError = svgDoc.querySelector('parsererror')
  if (parseError) {
    console.error('SVG Parse Error:', parseError.textContent)
    throw new Error(`Failed to parse SVG: ${parseError.textContent?.substring(0, 100)}`)
  }

  let width = 0
  let height = 0
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

async function downloadPng() {
  try {
    const blob = await exportPng()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `plantuml-diagram-${Date.now()}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('Failed to export PNG:', err)
  }
}

watch(
  () => [props.code, props.theme],
  async () => {
    await renderDiagram()
    await nextTick()
    await viewer.initPanZoom()
  },
  { immediate: true }
)

onMounted(() => {
  viewer.setupRefreshListener()
})

onUnmounted(() => {
  cancelled.value = true
  viewer.cleanup()
  modal.destroyModalPanZoom()
})

defineExpose({
  openFullscreen,
  closeFullscreen,
  refresh: () => viewer.refreshPanZoom(),
  exportPng,
  downloadPng,
})
</script>

<style scoped>
.diagram-svg-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: grab;
}

.diagram-svg-container:active {
  cursor: grabbing;
}

.diagram-svg-container > div {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.diagram-svg-container :deep(svg) {
  max-width: 100%;
  max-height: 100%;
}

.diagram-modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
}

.diagram-modal-content {
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

.diagram-modal-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
}

.diagram-modal-title {
  flex: 1;
  font-weight: 600;
  color: var(--text-primary);
}

.diagram-toolbar-btn {
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

.diagram-toolbar-btn:hover {
  background: var(--bg-secondary);
  border-color: var(--border-hover);
}

.diagram-toolbar-btn.close-btn {
  margin-left: var(--space-2);
  font-size: 20px;
}

.diagram-modal-svg-container {
  flex: 1;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  cursor: grab;
}

.diagram-modal-svg-container:active {
  cursor: grabbing;
}

.diagram-svg-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.diagram-svg-wrapper :deep(svg) {
  max-width: 100%;
  max-height: 100%;
}
</style>
