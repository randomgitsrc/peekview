<template>
  <div class="meta-tags-bar" data-testid="meta-tags-bar">
    <router-link v-if="currentEntry?.username" :to="`/users/${currentEntry.username}`" class="owner-link">@{{ currentEntry.username }}</router-link>
    <span class="meta-dot"></span><span>{{ relativeTime }}</span>
    <span class="meta-sep"></span>
    <template v-if="currentEntry?.readStats"><span>{{ currentEntry.readStats.totalCount }} read{{ currentEntry.readStats.totalCount !== 1 ? 's' : '' }}</span><span class="meta-dot"></span></template>
    <template v-if="currentEntry?.teamId">
      <span class="status-tag team">仅团队可见 · {{ currentEntry.team?.name || currentEntry.team?.slug }}</span>
    </template>
    <template v-else-if="currentEntry">
      <span :class="['status-tag', currentEntry.isPublic ? 'public' : 'private']">{{ currentEntry.isPublic ? 'Public' : 'Private' }}</span>
    </template>
    <BaseTag
      v-for="tag in currentEntry?.tags ?? []"
      :key="tag"
      :href="'/explore?tags=' + encodeURIComponent(tag)"
      @navigate="navigateToTag"
    >{{ tag }}</BaseTag>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import BaseTag from '@/components/BaseTag.vue'
import type { Entry } from '@/types'

defineProps<{
  currentEntry: Entry | null
  relativeTime: string
}>()

const router = useRouter()

function navigateToTag(href: string) {
  router.push(href)
}
</script>

<style scoped>
.meta-tags-bar { display: flex; align-items: center; gap: var(--space-1); padding: var(--space-4) var(--space-4); background: var(--c-surface); border-bottom: 1px solid var(--c-border); font-size: var(--font-xs); color: var(--c-text-secondary); flex-wrap: wrap; overflow-x: visible; white-space: normal; }
.owner-link { color: var(--c-accent); text-decoration: none; font-family: var(--font-mono); font-size: 12px; }
.meta-dot { width: 3px; height: 3px; border-radius: 50%; background: var(--c-text-tertiary); flex-shrink: 0; }
.status-tag { font-size: 10px; padding: 1px 6px; border-radius: 4px; background: var(--c-tag-bg); color: var(--c-text-tertiary); }
.status-tag.public { background: var(--c-accent-surface); color: var(--c-accent); }
.status-tag.private { background: var(--c-surface-lower); color: var(--c-text-secondary); }
.status-tag.team { background: var(--c-badge-shared-bg); color: var(--c-warning); }
</style>
