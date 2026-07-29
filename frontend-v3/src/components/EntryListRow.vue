<template>
  <div
    class="entry-list-row"
    :class="{ 'entry-list-row--archived': entry.status === 'archived' }"
  >
    <div class="entry-content">
      <a class="entry-title" :href="'/' + entry.slug" @click.prevent="navigateToEntry">
        {{ entry.summary || entry.slug }}
      </a>
      <div class="entry-meta-row">
        <span class="entry-meta">
          <a
            v-if="entry.username"
            class="meta-username"
            :href="'/users/' + entry.username"
            @click.prevent="navigateToUser"
          >@{{ entry.username }}</a>
          <span v-if="entry.username" class="meta-sep" style="font-family: Inter, -apple-system, sans-serif"> · </span>
          <span class="meta-time" :title="fullTime">{{ relativeTime }}</span>
          <template v-if="entry.fileCount">
            <span class="meta-sep" style="font-family: Inter, -apple-system, sans-serif"> · </span>
            <span>{{ entry.fileCount }} file{{ entry.fileCount !== 1 ? 's' : '' }}</span>
          </template>
        </span>
      </div>
      <div v-if="entry.tags.length" class="entry-tags-row">
        <BaseTag
          v-for="tag in visibleTags"
          :key="tag"
          :href="'/explore?tags=' + encodeURIComponent(tag)"
          @navigate="navigateToTag"
        >{{ tag }}</BaseTag>
        <button
          v-if="remainingTagCount > 0"
          type="button"
          class="tag-overflow"
          tabindex="0"
          :data-tags="entry.tags.join(', ')"
          :aria-label="'All tags: ' + entry.tags.join(', ')"
        >+{{ remainingTagCount }}</button>
      </div>
    </div>
    <div class="entry-right">
        <BaseBadge v-if="isExpiredButActive" status="expired" />
        <BaseBadge v-else-if="entry.status === 'archived'" status="archived" />
        <BaseBadge v-else-if="isOwner" :status="entry.isPublic ? 'public' : 'private'" />
      <div v-if="isOwner" class="entry-actions" @click.stop.prevent>
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
import { computed, toRef } from 'vue'
import { useRouter } from 'vue-router'
import type { Entry } from '@/types'
import BaseTag from '@/components/BaseTag.vue'
import BaseBadge from '@/components/BaseBadge.vue'
import { useRelativeTime } from '@/composables/useRelativeTime'
import { isExpired } from '@/utils/expires'

const props = withDefaults(defineProps<{
  entry: Entry
  isOwner?: boolean
  currentUsername?: string | null
}>(), {
  isOwner: false,
  currentUsername: null,
})

defineEmits<{
  toggleVisibility: [entry: Entry]
  delete: [entry: Entry]
}>()

const router = useRouter()

function navigateToEntry() {
  const firstFileId = props.entry.files?.[0]?.id
  if (firstFileId) {
    router.push({ path: `/${props.entry.slug}`, query: { firstFileId: String(firstFileId) } })
  } else {
    router.push(`/${props.entry.slug}`)
  }
}

function navigateToUser() {
  if (props.entry.username) {
    router.push(`/users/${props.entry.username}`)
  }
}

function navigateToTag(href: string) {
  router.push(href)
}

const TAG_LIMIT = 3

const visibleTags = computed(() => props.entry.tags.slice(0, TAG_LIMIT))

const remainingTagCount = computed(() => Math.max(0, props.entry.tags.length - TAG_LIMIT))

const createdAtRef = toRef(() => props.entry.createdAt)
const { relative: relativeTime, full: fullTime } = useRelativeTime(createdAtRef)

const isExpiredButActive = computed(() => isExpired(props.entry))
</script>

<style scoped>
.entry-list-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--c-border);
  transition: background var(--transition-fast);
}

.entry-list-row:hover {
  background: var(--c-surface-lower);
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
  display: block;
  text-decoration: none;
}

.entry-title:hover {
  text-decoration: underline;
}

.entry-title:focus-visible {
  outline: 2px solid var(--c-accent-secondary);
  outline-offset: 2px;
}

.entry-meta-row {
  display: flex;
  align-items: center;
  margin-top: var(--space-1);
}

.entry-tags-row {
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

.meta-username {
  color: var(--c-accent);
  text-decoration: none;
}

.meta-username:hover {
  text-decoration: underline;
}

.meta-username:focus-visible {
  outline: 2px solid var(--c-accent-secondary);
  outline-offset: 2px;
}

.meta-sep {
  color: var(--c-text-tertiary);
  font-family: Inter, -apple-system, sans-serif;
}

.meta-time {
  cursor: default;
}

.tag-overflow {
  position: relative;
  display: inline-flex;
  align-items: center;
  background: var(--c-tag-bg);
  color: var(--c-text-tertiary);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: var(--font-xs);
  font-family: var(--font-mono);
  border: none;
  cursor: default;
}

.tag-overflow::after {
  content: attr(data-tags);
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--c-surface);
  border: 1px solid var(--c-border-strong);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-xs);
  white-space: nowrap;
  box-shadow: var(--shadow-md);
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--transition-fast);
  z-index: 10;
}

.tag-overflow:hover::after,
.tag-overflow:focus::after {
  opacity: 1;
}

.tag-overflow:focus-visible {
  outline: 2px solid var(--c-accent-secondary);
  outline-offset: 2px;
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

.entry-list-row--archived {
  opacity: 0.6;
}

.entry-list-row--archived:hover {
  opacity: 0.8;
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
