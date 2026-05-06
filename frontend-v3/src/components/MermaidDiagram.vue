<template>
  <div ref="containerRef" class="mermaid-viewer" @wheel="onWheel">
    <div ref="svgContainer" class="svg-container" v-html="svgContent"></div>
    <!-- Hidden fullscreen trigger for external access -->
    <button class="mermaid-fullscreen-trigger" @click="toggleFullscreen" style="display: none;"></button>
  </div>

  <!-- Fullscreen Modal -->
  <Teleport to="body">
    <div
      v-if="isFullscreen"
      class="mermaid-modal-overlay"
      @click.self="closeFullscreen"
    >
      <div class="mermaid-modal">
        <div class="mermaid-modal-toolbar">
          <span class="modal-title">Mermaid Diagram</span>
          <button class="toolbar-btn" @click="zoomInModal" title="Zoom In">+</button>
          <button class="toolbar-btn" @click="zoomOutModal" title="Zoom Out">−</button>
          <button class="toolbar-btn" @click="resetZoomModal" title="Reset">⟲</button>
          <button class="toolbar-btn" @click="downloadPng" title="Download PNG">⬇</button>
          <button class="toolbar-btn close-btn" @click="closeFullscreen" title="Close">×</button>
        </div>
        <div ref="modalContainer" class="mermaid-modal-container" @wheel="onWheelModal">
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
const emit = defineEmits<{
  zoomIn: []
  zoomOut: []
  reset: []
  fullscreen: []
  downloadPng: []
}>()

const containerRef = ref<HTMLElement>()
const svgContainer = ref<HTMLElement>()
const modalContainer = ref<HTMLElement>()
const modalSvgWrapper = ref<HTMLElement>()
const isFullscreen = ref(false)

// Use any for svg-pan-zoom since it doesn't have TypeScript definitions
let panZoomInstance: any = null
let modalPanZoomInstance: any = null
let resizeObserver: ResizeObserver | null = null

// Initialize pan-zoom on the SVG
async function initPanZoom() {
  if (!svgContainer.value) return

  const svg = svgContainer.value.querySelector('svg')
  if (!svg) return

  // Wait for next tick to ensure SVG is fully rendered
  await nextTick()

  // Fix SVG dimensions to fill container
  // Remove inline styles that constrain the SVG
  svg.removeAttribute('width')
  svg.removeAttribute('height')
  svg.style.width = '100%'
  svg.style.height = '100%'
  svg.style.maxWidth = '100%'
  svg.style.maxHeight = '100%'

  // Dynamically import svg-pan-zoom (client-side only)
  const svgPanZoom = (await import('svg-pan-zoom')).default

  const options: any = {
    zoomEnabled: true,
    controlIconsEnabled: false,
    fit: true,
    center: true,
    minZoom: 0.1,
    maxZoom: 10,
    panEnabled: true,
    mouseWheelZoomEnabled: false,
    preventMouseEventsDefault: false,
  }

  panZoomInstance = svgPanZoom(svg as SVGSVGElement, options)

  // Store reference for external access
  if (containerRef.value) {
    (containerRef.value as any).__panZoomInstance = panZoomInstance
  }
}

async function initModalPanZoom() {
  if (!modalSvgWrapper.value) return

  const svg = modalSvgWrapper.value.querySelector('svg')
  if (!svg) return

  await nextTick()

  // Fix SVG dimensions to fill container
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
    minZoom: 0.1,
    maxZoom: 20,
    panEnabled: true,
    mouseWheelZoomEnabled: false,
    preventMouseEventsDefault: false,
  }

  modalPanZoomInstance = svgPanZoom(svg as SVGSVGElement, options)
}

// Toolbar actions - also emit for parent control
function zoomIn() {
  if (panZoomInstance) {
    panZoomInstance.zoomIn()
  }
  emit('zoomIn')
}

function zoomOut() {
  if (panZoomInstance) {
    panZoomInstance.zoomOut()
  }
  emit('zoomOut')
}

function resetZoom() {
  if (panZoomInstance) {
    panZoomInstance.reset()
    panZoomInstance.center()
  }
  emit('reset')
}

// Modal actions
function zoomInModal() {
  if (modalPanZoomInstance) {
    modalPanZoomInstance.zoomIn()
  }
}

function zoomOutModal() {
  if (modalPanZoomInstance) {
    modalPanZoomInstance.zoomOut()
  }
}

function resetZoomModal() {
  if (modalPanZoomInstance) {
    modalPanZoomInstance.reset()
    modalPanZoomInstance.center()
  }
}

function toggleFullscreen() {
  isFullscreen.value = true
  emit('fullscreen')
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

// PNG download
async function downloadPng() {
  const svgElement = isFullscreen.value
    ? modalSvgWrapper.value?.querySelector('svg')
    : svgContainer.value?.querySelector('svg')

  if (!svgElement) return

  try {
    const blob = await exportMermaidToPng(svgElement as SVGElement)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mermaid-diagram-${props.id}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('Failed to export PNG:', err)
  }
}

async function exportMermaidToPng(svgElement: SVGElement): Promise<Blob> {
  // Clone SVG and get computed styles
  const clonedSvg = svgElement.cloneNode(true) as SVGElement

  // Ensure SVG has proper namespace
  if (!clonedSvg.getAttribute('xmlns')) {
    clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  }

  // Get computed background color
  const computedStyle = getComputedStyle(svgElement)
  const bgColor = computedStyle.backgroundColor || '#ffffff'

  // Serialize SVG
  const serializer = new XMLSerializer()
  const svgString = serializer.serializeToString(clonedSvg)

  // Create blob and URL
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  try {
    // Load into image
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = reject
      img.src = url
    })

    // Get SVG dimensions
    const rect = svgElement.getBoundingClientRect()
    const width = Math.max(rect.width, 100)
    const height = Math.max(rect.height, 100)

    // Create canvas with high DPI
    const scale = 2
    const canvas = document.createElement('canvas')
    canvas.width = width * scale
    canvas.height = height * scale

    const ctx = canvas.getContext('2d')!

    // Fill background
    ctx.fillStyle = bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent' ? '#ffffff' : bgColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw image
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    // Export PNG
    return new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/png')
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Custom wheel handler for smoother zoom
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

// Touch handling for mobile
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

// Watch for content changes
watch(() => props.svgContent, async () => {
  if (panZoomInstance) {
    panZoomInstance.destroy()
    panZoomInstance = null
  }
  await nextTick()
  await initPanZoom()
}, { immediate: true })

onMounted(() => {
  // Use ResizeObserver to handle container size changes
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

  // Add touch event listeners
  if (containerRef.value) {
    containerRef.value.addEventListener('touchstart', onTouchStart, { passive: false })
    containerRef.value.addEventListener('touchmove', onTouchMove, { passive: false })
    containerRef.value.addEventListener('touchend', onTouchEnd)
  }

  // Listen for refresh events from parent (e.g., after toggle)
  if (containerRef.value) {
    containerRef.value.addEventListener('mermaid-refresh', () => {
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

// Re-initialize pan-zoom (used after display changes)
async function refreshPanZoom() {
  if (panZoomInstance) {
    panZoomInstance.destroy()
    panZoomInstance = null
  }
  await nextTick()
  await initPanZoom()
}

// Expose methods for parent component
defineExpose({
  zoomIn,
  zoomOut,
  resetZoom,
  toggleFullscreen,
  refreshPanZoom,
  getSvgElement: () => svgContainer.value?.querySelector('svg'),
  downloadPng,
  exportMermaidToPng,
})
</script>

<style scoped>
.mermaid-viewer {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: grab;
}

.mermaid-viewer:active {
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

/* Modal styles */
.mermaid-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
}

.mermaid-modal {
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

.mermaid-modal-toolbar {
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

.mermaid-modal-container {
  flex: 1;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  cursor: grab;
}

.mermaid-modal-container:active {
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
