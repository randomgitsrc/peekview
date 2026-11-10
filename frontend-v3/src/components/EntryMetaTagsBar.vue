<template>
  <div class="meta-tags-bar" data-testid="meta-tags-bar">
    <router-link v-if="currentEntry?.username" :to="`/users/${currentEntry.username}`" class="owner-link">@{{ currentEntry.username }}</router-link>
    <span class="meta-dot"></span>
    <TimeDisplay v-if="currentEntry" :date-str="currentEntry.createdAt" />
    <span class="meta-sep"></span>
    <template v-if="currentEntry?.readStats"><span>{{ currentEntry.readStats.totalCount }} read{{ currentEntry.readStats.totalCount !== 1 ? 's' : '' }}</span><span class="meta-dot"></span></template>
    <VisibilityMenu
      v-if="currentEntry && isOwner"
      :entry="currentEntry"
      :teams="teams"
      :variant="variant"
      :disabled="disabled"
      :teams-failed="teamsFailed"
      @select="$emit('select', $event)"
    />
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
import TimeDisplay from '@/components/TimeDisplay.vue'
import VisibilityMenu from '@/components/VisibilityMenu.vue'
import type { Entry, Team } from '@/types'
import type { VisibilityTarget } from '@/utils/visibility-options'

withDefaults(defineProps<{
  currentEntry: Entry | null
  teams: Team[]
  teamsFailed: boolean
  isOwner: boolean
  variant?: 'icon' | 'inline' | 'sheet'
  disabled?: boolean
}>(), {
  variant: 'sheet',
  disabled: false,
})

defineEmits<{
  select: [target: VisibilityTarget]
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
</style>
