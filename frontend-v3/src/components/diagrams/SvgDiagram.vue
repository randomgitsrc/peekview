<script setup lang="ts">
import { computed, ref } from 'vue'
import BaseDiagram from './BaseDiagram.vue'

const props = defineProps<{
  blockIndex: number
  blockId: string | number
  svgContent?: string
  codeViewHtml?: string
  theme: 'light' | 'dark'
}>()

const svgContent = computed(() => props.svgContent || '')

const baseProps = computed(() => ({
  svgContent: svgContent.value,
  codeViewHtml: props.codeViewHtml || '',
  blockId: props.blockId,
  blockIndex: props.blockIndex,
  classPrefix: 'svg' as const,
  theme: props.theme,
  pngBackground: 'transparent' as const,
  pngViewBoxFallback: 'width-height-attrs' as const,
  pngFinalSize: { width: 400, height: 300 },
  pngBrFix: false,
  pngFilenamePrefix: 'svg-diagram',
  panZoomMinZoom: 0.1,
  panZoomMaxZoom: 10,
  panZoomInitTryCatch: true,
  touchEnabled: true,
  resizeEnabled: true,
  refreshEventName: 'svg-refresh',
  modalTitle: 'SVG Diagram',
  toggleTextUpdates: false,
  refreshOnToggle: false,
  copyFeedback: false,
  menuClickOutside: true,
  menuCloseOthers: true,
}))

const baseRef = ref<InstanceType<typeof BaseDiagram> | null>(null)

defineExpose({
  toggleFullscreen: () => baseRef.value?.toggleFullscreen(),
  downloadPng: () => baseRef.value?.downloadPng(),
  refreshPanZoom: () => baseRef.value?.refreshPanZoom(),
})
</script>

<template>
  <BaseDiagram
    ref="baseRef"
    v-bind="baseProps"
    v-on="$attrs"
  />
</template>
