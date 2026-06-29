<template>
  <div
    class="entry-list-row"
    role="button"
    tabindex="0"
    @click="$emit('navigate', entry)"
    @keydown.enter="$emit('navigate', entry)"
    @keydown.space.prevent="$emit('navigate', entry)"
  >
    <div class="entry-content">
      <div class="entry-title">{{ entry.summary || entry.slug }}</div>
      <div v-if="entry.summary" class="entry-summary">{{ entry.summary }}</div>
      <div class="entry-meta-row">
        <BaseTag v-for="tag in entry.tags" :key="tag">{{ tag }}</BaseTag>
        <span class="entry-meta">{{ metaText }}</span>
      </div>
    </div>
    <div class="entry-right">
      <BaseBadge :status="entry.isPublic ? 'public' : 'private'" />
      <div v-if="isOwner" class="entry-actions" @click.stop>
        <button
          type="button"
          class="action-btn visibility-btn"
          data-action="toggle-visibility"
          :title="entry.isPublic ? 'Make private' : 'Make public'"
          @click="$emit('toggleVisibility', entry)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path v-if="entry.isPublic" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle v-if="entry.isPublic" cx="12" cy="12" r="3"/><path v-if="!entry.isPublic" d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line v-if="!entry.isPublic" x1="1" y1="1" x2="23" y2="23"/></svg>
        </button>
        <button
          type="button"
          class="action-btn delete-btn"
          data-action="delete"
          title="Delete"
          @click="$emit('delete', entry)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    </div>
    <slot name="actions" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Entry } from '@/types'
import BaseTag from '@/components/BaseTag.vue'
import BaseBadge from '@/components/BaseBadge.vue'

const props = withDefaults(defineProps<{
  entry: Entry
  isOwner?: boolean
  currentUsername?: string | null
}>(), {
  isOwner: false,
  currentUsername: null,
})

defineEmits<{
  navigate: [entry: Entry]
  toggleVisibility: [entry: Entry]
  delete: [entry: Entry]
}>()

const metaText = computed(() => {
  const parts: string[] = []
  if (props.entry.username) parts.push(props.entry.username)
  const date = new Date(props.entry.createdAt)
  parts.push(date.toLocaleDateString())
  if (props.entry.fileCount) parts.push(`${props.entry.fileCount} file${props.entry.fileCount !== 1 ? 's' : ''}`)
  return parts.join(' · ')
})
</script>

<style scoped>
.entry-list-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--c-border);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.entry-list-row:hover {
  background: var(--c-surface-lower);
}

.entry-list-row:focus-visible {
  outline: 2px solid var(--c-accent-secondary);
  outline-offset: -2px;
}

.entry-content {
  min-width: 0;
}

.entry-title {
  font-size: var(--font-md);
  font-weight: 600;
  color: var(--c-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.entry-summary {
  font-size: var(--font-sm);
  color: var(--c-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}

.entry-meta-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-1);
  flex-wrap: wrap;
}

.entry-meta {
  font-size: 13px;
  color: var(--c-text-tertiary);
  font-family: var(--font-mono);
}

.entry-right {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.entry-actions {
  display: flex;
  gap: var(--space-1);
}

@media (hover: hover) {
  .entry-actions {
    opacity: 0;
    transition: opacity var(--transition-fast);
  }
  .entry-list-row:hover .entry-actions {
    opacity: 1;
  }
}

.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--c-text-tertiary);
  cursor: pointer;
  padding: 0;
}

.action-btn:hover {
  background: var(--c-border);
  color: var(--c-text);
}

@media (max-width: 640px) {
  .entry-list-row {
    grid-template-columns: 1fr;
    gap: var(--space-2);
  }
  .entry-right {
    justify-content: flex-start;
  }
  .entry-actions {
    opacity: 1;
  }
}
</style>
