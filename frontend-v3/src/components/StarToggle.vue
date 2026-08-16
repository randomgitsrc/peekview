<template>
  <button
    type="button"
    :class="['star-toggle', { 'star-toggle--active': displayStarred }]"
    :aria-pressed="displayStarred"
    :aria-label="displayStarred ? `已收藏，${displayCount} 人认为值得收藏` : '收藏该内容'"
    :title="displayCount > 0 ? `${displayCount} 人认为值得收藏` : undefined"
    :data-testid="testid"
    @click="handleClick"
  >
    <Star :size="16" :fill="displayStarred ? 'currentColor' : 'none'" />
    <span class="star-count" data-testid="star-count">{{ displayCount }}</span>
    <span class="star-tooltip">{{ displayCount }} 人认为值得收藏</span>
  </button>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Star } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'
import { api } from '@/api/client'
import type { Entry, AuthState } from '@/types'

const props = withDefaults(defineProps<{
  entry: Entry
  authState: AuthState
  testid?: string
}>(), {
  testid: 'star-toggle',
})

const emit = defineEmits<{
  'open-login': []
  changed: [data: { starCount: number; isStarred: boolean }]
}>()

const toast = useToast()

const displayCount = ref(props.entry.starCount ?? 0)
const displayStarred = ref(props.entry.isStarred ?? false)

watch(() => props.entry, (entry) => {
  displayCount.value = entry.starCount ?? 0
  displayStarred.value = entry.isStarred ?? false
}, { immediate: true })

async function handleClick(): Promise<void> {
  if (props.authState !== 'authenticated') {
    emit('open-login')
    return
  }
  if (displayStarred.value) {
    await doUnstar()
  } else {
    await doStar()
  }
}

async function doStar(): Promise<void> {
  const originalCount = displayCount.value
  displayCount.value += 1
  displayStarred.value = true
  try {
    const res = await api.star(props.entry.slug)
    displayCount.value = res.star_count
    displayStarred.value = res.is_starred
    emit('changed', { starCount: res.star_count, isStarred: res.is_starred })
    if (res.already_starred) {
      const date = res.created_at ? formatCnDate(res.created_at) : ''
      toast.show(`已于 ${date} 星标`, 'warning', { label: '查看星标', to: '/explore?starred=1' })
    } else {
      showArchiveToast()
    }
  } catch {
    displayCount.value = originalCount
    displayStarred.value = false
  }
}

async function doUnstar(): Promise<void> {
  const originalCount = displayCount.value
  displayCount.value -= 1
  displayStarred.value = false
  try {
    const res = await api.unstar(props.entry.slug)
    displayCount.value = res.star_count
    displayStarred.value = res.is_starred
    emit('changed', { starCount: res.star_count, isStarred: res.is_starred })
  } catch {
    displayCount.value = originalCount
    displayStarred.value = true
  }
}

function showArchiveToast(): void {
  if (props.entry.status === 'archived') {
    toast.show('该内容已归档，星标后可长期保存', 'success')
  } else if (props.entry.status === 'active' && props.entry.expiresAt) {
    const days = (new Date(props.entry.expiresAt).getTime() - Date.now()) / 86400000
    if (days < 7) {
      toast.show(`该内容将于 ${formatMonthDay(props.entry.expiresAt)} 归档，星标后可长期保存`, 'success')
    }
  }
}

function formatCnDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`
}

function formatMonthDay(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`
}
</script>

<style scoped>
.star-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  position: relative;
  background: none;
  border: none;
  cursor: pointer;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  color: var(--c-text-secondary);
  min-width: 44px;
  min-height: 44px;
  transition: all var(--transition-fast);
}

.star-toggle:hover {
  background: var(--c-border);
  color: var(--c-text);
}

.star-toggle:focus-visible {
  outline: 2px solid var(--c-accent-secondary);
  outline-offset: 2px;
}

.star-toggle--active {
  color: var(--c-accent);
  background: var(--c-accent-surface);
}

.star-count {
  font-size: var(--font-xs);
  font-family: var(--font-mono);
  font-weight: 600;
  line-height: 1;
}

.star-tooltip {
  position: absolute;
  bottom: -30px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--c-surface-lower);
  color: var(--c-text);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--transition-fast);
  z-index: 10;
}

.star-toggle:hover .star-tooltip {
  opacity: 1;
}
</style>
