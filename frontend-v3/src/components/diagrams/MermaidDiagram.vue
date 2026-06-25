<script setup lang="ts">
import { computed, ref } from 'vue'
import BaseDiagram from './BaseDiagram.vue'
import { useCodeBlockRenderer } from '@/composables/useCodeBlockRenderer'

const props = defineProps<{
  blockIndex: number
  blockId: string | number
  svgContent?: string
  codeViewHtml?: string
  theme: 'light' | 'dark'
}>()

defineEmits<{
  (e: 'zoom-in'): void
  (e: 'zoom-out'): void
  (e: 'reset'): void
  (e: 'fullscreen', blockId: string | number): void
  (e: 'download-png', blockId: string | number): void
}>()

const renderer = useCodeBlockRenderer()

const svgContent = computed(() => props.svgContent || renderer.getMermaidSvgByIndex(props.blockIndex))
const codeViewHtml = computed(() => props.codeViewHtml || renderer.getCodeViewHtml(props.blockIndex) || '')

const baseProps = computed(() => ({
  svgContent: svgContent.value,
  codeViewHtml: codeViewHtml.value,
  blockId: props.blockId,
  blockIndex: props.blockIndex,
  classPrefix: 'mermaid' as const,
  theme: props.theme,
  pngBackground: '#ffffff' as const,
  pngViewBoxFallback: 'g-root-getBBox' as const,
  pngFinalSize: { width: 800, height: 600 },
  pngBrFix: true,
  pngFilenamePrefix: 'mermaid-diagram',
  panZoomMinZoom: 0.1,
  panZoomMaxZoom: 10,
  panZoomInitTryCatch: false,
  touchEnabled: true,
  resizeEnabled: true,
  refreshEventName: 'mermaid-refresh',
  modalTitle: 'Mermaid Diagram',
  label: 'MERMAID',
  toggleTextUpdates: true,
  refreshOnToggle: true,
  copyFeedback: true,
  menuClickOutside: true,
  menuCloseOthers: true,
}))

const baseRef = ref<InstanceType<typeof BaseDiagram> | null>(null)

defineExpose({
  zoomIn: () => baseRef.value?.zoomIn(),
  zoomOut: () => baseRef.value?.zoomOut(),
  resetZoom: () => baseRef.value?.resetZoom(),
  toggleFullscreen: () => baseRef.value?.toggleFullscreen(),
  refreshPanZoom: () => baseRef.value?.refreshPanZoom(),
  getSvgElement: () => baseRef.value?.getSvgElement(),
  downloadPng: () => baseRef.value?.downloadPng(),
  exportMermaidToPng: (svg: string) => baseRef.value?.exportToPng(svg),
})
</script>

<template>
  <BaseDiagram
    ref="baseRef"
    v-bind="baseProps"
    v-on="$attrs"
    @fullscreen="$emit('fullscreen', blockId)"
    @download-png="$emit('download-png', blockId)"
    @toggle-view="$emit('reset')"
  />
</template>
