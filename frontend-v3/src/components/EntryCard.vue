<template>
  <div class="entry-card" :class="{ 'entry-card--own': isOwner }">
    <div v-if="isOwner" class="card-actions" @click.stop>
      <button
        type="button"
        class="card-action-btn"
        :title="entry.isPublic ? 'Make private' : 'Make public'"
        @click="$emit('toggleVisibility', entry)"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path v-if="entry.isPublic" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle v-if="entry.isPublic" cx="12" cy="12" r="3"/><path v-if="!entry.isPublic" d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line v-if="!entry.isPublic" x1="1" y1="1" x2="23" y2="23"/></svg>
      </button>
      <button
        type="button"
        class="card-action-btn card-action-btn--danger"
        title="Delete"
        @click="$emit('delete', entry)"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
    </div>
    <div
      class="card-body"
      role="button"
      tabindex="0"
      @click="$emit('navigate', entry)"
      @keydown.enter="$emit('navigate', entry)"
      @keydown.space.prevent="$emit('navigate', entry)"
    >
      <h3 class="card-title">{{ entry.summary || entry.slug }}</h3>
      <div class="card-meta">
        <BaseTag v-for="tag in entry.tags" :key="tag">{{ tag }}</BaseTag>
        <span class="card-meta-text">{{ metaText }}</span>
      </div>
      <div class="card-footer">
        <BaseBadge :status="entry.isPublic ? 'public' : 'private'" />
      </div>
    </div>
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
  if (props.entry.username) parts.push(`@${props.entry.username}`)
  const date = new Date(props.entry.createdAt)
  parts.push(date.toLocaleDateString())
  if (props.entry.fileCount) parts.push(`${props.entry.fileCount} file${props.entry.fileCount !== 1 ? 's' : ''}`)
  return parts.join(' · ')
})
</script>

<style scoped>
.entry-card {
  position: relative;
  background: var(--c-surface);
  border: 1px solid var(--c-border-strong);
  border-radius: 14px;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
  display: flex;
  flex-direction: column;
}

.entry-card:hover {
  border-color: var(--c-accent);
  box-shadow: var(--shadow-md);
}

.card-actions {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  display: flex;
  gap: var(--space-1);
  z-index: 1;
}

@media (hover: hover) {
  .card-actions {
    opacity: 0;
    transition: opacity var(--transition-fast);
  }
  .entry-card:hover .card-actions {
    opacity: 1;
  }
}

.card-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-md);
  border: 1px solid var(--c-border);
  background: var(--c-surface);
  color: var(--c-text-tertiary);
  cursor: pointer;
  padding: 0;
  transition: all var(--transition-fast);
}

.card-action-btn:hover {
  background: var(--c-surface-lower);
  border-color: var(--c-border-strong);
  color: var(--c-text);
}

.card-action-btn--danger:hover {
  background: var(--c-error-surface);
  border-color: var(--c-error);
  color: var(--c-error);
}

.card-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  padding: var(--space-4);
  cursor: pointer;
}

.card-title {
  font-size: var(--font-md);
  font-weight: 600;
  color: var(--c-text);
  margin: 0 0 var(--space-2);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-desc {
  font-size: var(--font-sm);
  color: var(--c-text-secondary);
  margin: 0 0 var(--space-2);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-bottom: var(--space-3);
}

.card-meta-text {
  font-size: 13px;
  color: var(--c-text-tertiary);
  font-family: var(--font-mono);
}

.card-footer {
  display: flex;
  align-items: center;
  margin-top: auto;
}
</style>
