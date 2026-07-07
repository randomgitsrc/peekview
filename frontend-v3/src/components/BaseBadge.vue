<template>
  <span class="base-badge" :class="`badge-${status}`">{{ status }}</span>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  status?: 'public' | 'private' | 'shared' | 'archived'
}>(), {
  status: 'public',
})
</script>

<style scoped>
.base-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: var(--font-xs);
  font-family: var(--font-mono);
  text-transform: capitalize;
}

.badge-public {
  background: var(--c-badge-public-bg);
  color: var(--c-success);
}

.badge-private {
  background: var(--c-badge-private-bg);
  color: var(--c-error);
}

.badge-shared {
  background: var(--c-badge-shared-bg);
  color: var(--c-warning);
}

.badge-archived {
  background: var(--c-badge-archived-bg);
  color: var(--c-text-tertiary);
}
</style>
