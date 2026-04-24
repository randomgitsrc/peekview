<template>
  <div class="tooltip-wrapper">
    <slot />
    <span v-if="text" class="tooltip-text">{{ text }}</span>
  </div>
</template>

<script setup lang="ts">
interface Props {
  text: string
}
defineProps<Props>()
</script>

<style scoped>
.tooltip-wrapper {
  position: relative;
  display: inline-flex;
}

.tooltip-text {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(-4px);
  padding: 4px 8px;
  background: var(--bg-overlay);
  color: var(--text-primary);
  font-size: var(--font-xs);
  border-radius: var(--radius-sm);
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  transition: all var(--transition-fast);
  z-index: var(--z-tooltip);
}

.tooltip-wrapper:hover .tooltip-text {
  opacity: 1;
  visibility: visible;
}
</style>
