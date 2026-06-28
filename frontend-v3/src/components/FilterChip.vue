<template>
  <span class="filter-chip">
    <span class="filter-chip-label">{{ label }}</span>
    <button class="filter-chip-dismiss" @click="$emit('dismiss')" aria-label="Remove filter">&times;</button>
  </span>
</template>

<script setup lang="ts">
defineProps<{ label: string }>()
defineEmits<{ dismiss: [] }>()
</script>

<style scoped>
.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-full, 999px);
  background: var(--accent-light);
  color: var(--accent-color);
  font-size: var(--font-sm);
  font-weight: 500;
  line-height: 1;
}

.filter-chip-label {
  white-space: nowrap;
}

.filter-chip-dismiss {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  background: none;
  color: var(--accent-color);
  cursor: pointer;
  font-size: var(--font-md);
  line-height: 1;
  border-radius: 50%;
  transition: background var(--transition-fast);
}

.filter-chip-dismiss:hover {
  background: color-mix(in srgb, var(--accent-color) 20%, transparent);
}
</style>
