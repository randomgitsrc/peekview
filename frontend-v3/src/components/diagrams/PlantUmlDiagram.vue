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

// plantuml 无 emit（保真 P1 I2）：attrs 自动 fallthrough 到 BaseDiagram，
// BaseDiagram emit 的事件冒泡回外部 MarkdownViewer handler，按 classPrefix='plantuml'
// 走「无 refresh/无 toggle-text/无 click-outside/无 Copied」分支保真
const renderer = useCodeBlockRenderer()

const svgContent = computed(() => props.svgContent || renderer.getPlantUmlSvgByIndex(props.blockIndex))
const codeViewHtml = computed(() => props.codeViewHtml || renderer.getCodeViewHtml(props.blockIndex) || '')

const baseProps = computed(() => ({
  svgContent: svgContent.value,
  codeViewHtml: codeViewHtml.value,
  blockId: props.blockId,
  blockIndex: props.blockIndex,
  classPrefix: 'plantuml' as const,
  theme: props.theme,
  pngBackground: '#ffffff' as const,
  pngViewBoxFallback: 'width-height-attrs' as const,
  pngFinalSize: { width: 800, height: 600 },
  pngBrFix: false,
  pngFilenamePrefix: 'plantuml-diagram',
  panZoomMinZoom: 0.1,
  panZoomMaxZoom: 10,
  panZoomInitTryCatch: false,
  touchEnabled: false,
  resizeEnabled: false,
  refreshEventName: 'plantuml-refresh',
  modalTitle: 'PlantUML Diagram',
  toggleTextUpdates: false,
  refreshOnToggle: false,
  copyFeedback: false,
  menuClickOutside: false,
  menuCloseOthers: false,
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
  exportPlantUmlToPng: (svg: string) => baseRef.value?.exportToPng(svg),
})
</script>

<template>
  <BaseDiagram
    ref="baseRef"
    v-bind="baseProps"
    v-on="$attrs"
  />
</template>
