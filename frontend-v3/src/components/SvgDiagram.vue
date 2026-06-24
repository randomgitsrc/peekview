<template>
  <div class="svg-viewer-stub" :data-svg="svgContent" :id="id"></div>
</template>

<script setup lang="ts">
interface Props {
  svgContent: string
  id: string
}

const props = defineProps<Props>()

defineExpose({
  toggleFullscreen: () => {},
  downloadPng: () => {},
  refreshPanZoom: () => {},
})
</script>
