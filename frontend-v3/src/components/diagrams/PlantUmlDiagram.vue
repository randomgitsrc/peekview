<!-- STUB PlantUmlDiagram.vue - P3b 创建，P4 实现 -->
<script setup lang="ts">
import BaseDiagram from './BaseDiagram.vue'
defineProps<{ code: string; theme: 'light' | 'dark'; blockId: string | number; blockIndex: number; svgContent?: string }>()
const baseProps = {}   // STUB: 空，断言差异 props 失败
defineExpose({})      // STUB: 空，断言 expose 项失败
</script>
<template><BaseDiagram v-bind="baseProps" /></template>
