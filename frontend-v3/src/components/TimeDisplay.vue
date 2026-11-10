<template>
  <span class="time-display" data-testid="time-display">
    <span class="time-display__main" data-testid="time-display-main">{{ absolute }}</span>
    <span class="time-display__tip" role="tooltip" data-testid="time-tooltip">{{ full }}</span>
  </span>
</template>

<script setup lang="ts">
import { toRef } from 'vue'
import { useRelativeTime } from '@/composables/useRelativeTime'

const props = defineProps<{ dateStr: string }>()

const { full, absolute } = useRelativeTime(toRef(props, 'dateStr'))
</script>

<style scoped>
.time-display {
  position: relative;
  display: inline-flex;
}

.time-display__main {
  white-space: nowrap;
}

.time-display__tip {
  position: absolute;
  top: calc(100% + var(--space-1));
  left: 0;
  visibility: hidden;
  white-space: normal;
  z-index: 10;
  max-width: 320px;
  padding: var(--space-1) var(--space-2);
  border-radius: 6px;
  border: 1px solid var(--c-border-strong);
  background: var(--c-surface);
  color: var(--c-text);
  font-size: var(--font-xs);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.16);
  pointer-events: none;
}

.time-display:hover .time-display__tip,
.time-display:focus-within .time-display__tip {
  visibility: visible;
}

@media (max-width: 640px) {
  .time-display__tip {
    left: auto;
    right: 0;
  }
}
</style>
