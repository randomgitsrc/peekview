<template>
  <header class="page-header">
    <div class="page-header-left">
      <router-link v-if="backTo" :to="backTo" class="back-link">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        {{ backLabel }}
      </router-link>
      <h1 class="page-header-title">{{ title }}</h1>
      <div v-if="$slots.meta" class="page-header-meta">
        <slot name="meta" />
      </div>
    </div>
    <div v-if="$slots.actions" class="page-header-actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  backTo?: string
  backLabel?: string
}>(), {
  backTo: '',
  backLabel: 'Back',
})
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background: var(--c-surface);
  border-bottom: 1px solid var(--c-border);
  padding: 0 var(--space-5);
  height: var(--header-height);
  flex-shrink: 0;
}

.page-header-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--c-text-secondary);
  font-size: var(--font-sm);
  text-decoration: none;
  white-space: nowrap;
  transition: color var(--transition-fast);
}

.back-link:hover {
  color: var(--c-accent);
}

.page-header-title {
  font-size: 28px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--c-text);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.page-header-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.page-header-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
</style>
