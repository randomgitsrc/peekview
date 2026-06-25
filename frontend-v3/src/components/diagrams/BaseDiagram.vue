<!-- STUB - P3b 创建，P4 实现 -->
<script setup lang="ts">
defineProps<{
  svgContent: string
  codeViewHtml: string
  blockId: string | number
  blockIndex: number
  classPrefix: 'mermaid' | 'plantuml' | 'svg'
  theme: 'light' | 'dark'
  pngBackground: '#ffffff' | 'transparent'
  pngViewBoxFallback: 'g-root-getBBox' | 'width-height-attrs'
  pngFinalSize: { width: number; height: number }
  pngBrFix: boolean
  pngFilenamePrefix: string
  panZoomMinZoom: number
  panZoomMaxZoom: number
  panZoomInitTryCatch: boolean
  touchEnabled: boolean
  resizeEnabled: boolean
  refreshEventName: string
  modalTitle: string
  toggleTextUpdates: boolean
  refreshOnToggle: boolean
  copyFeedback: boolean
  menuClickOutside: boolean
  menuCloseOthers: boolean
}>()
defineEmits<{
  (e: 'fullscreen', blockId: string | number): void
  (e: 'download-png', blockId: string | number): void
  (e: 'toggle-view', blockId: string | number): void
  (e: 'toggle-menu', blockId: string | number): void
  (e: 'copy-code', blockId: string | number): void
  (e: 'start-resize', blockId: string | number, startY: number): void
}>()
defineExpose({
  zoomIn: () => {}, zoomOut: () => {}, resetZoom: () => {},
  toggleFullscreen: () => {}, refreshPanZoom: () => {},
  getSvgElement: () => null, downloadPng: () => {}, exportToPng: (_s: string) => {},
})
</script>
<template><div></div></template>
