<template>
  <div class="stars-page" data-testid="stars-page">
    <header class="stars-header">
      <router-link to="/" class="stars-logo">
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none"><rect x="2" y="2" width="28" height="28" rx="8" fill="var(--c-accent)"/><path d="M12 23.5V9.5h5.4a4.6 4.6 0 0 1 0 9.2H12" stroke="var(--text-on-accent)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="stars-logo-word">PeekView</span>
      </router-link>
      <div class="stars-actions">
        <ThemeToggle />
      </div>
    </header>

    <div class="stars-body">
      <div class="stars-head">
        <h1 class="stars-title">我的星标</h1>
        <button
          type="button"
          class="manage-expired-link"
          data-testid="manage-expired-link"
          @click="switchFilter('expired')"
        >管理失效内容</button>
      </div>

      <nav class="stars-tabs" aria-label="星标分类">
        <button
          v-for="tab in tabDefs"
          :key="tab.key"
          type="button"
          :data-testid="`stars-tab-${tab.key}`"
          :class="['stars-tab', { active: filter === tab.key }]"
          @click="switchFilter(tab.key)"
        >{{ tab.label }}</button>
      </nav>

      <div class="stars-toolbar">
        <button
          type="button"
          class="stars-batch-remove"
          data-testid="stars-batch-remove"
          :disabled="selectedIds.length === 0"
          @click="openBatchConfirm"
        >移除所选（{{ selectedIds.length }}）</button>
      </div>

      <div v-if="loading" class="stars-loading" data-testid="stars-loading" role="status">加载中…</div>

      <div v-else-if="error" class="stars-error" data-testid="stars-error" role="alert">
        <span>{{ error }}</span>
        <button type="button" class="stars-retry" @click="load()">重试</button>
      </div>

      <template v-else>
        <div v-if="filteredItems.length === 0" class="stars-empty" :data-testid="`stars-empty-${filter}`">
          {{ emptyText }}
        </div>

        <ul v-else class="stars-list">
          <li v-for="item in filteredItems" :key="starKey(item)" class="stars-item">
            <label class="star-check">
              <input
                type="checkbox"
                class="star-checkbox"
                data-testid="star-checkbox"
                :aria-label="`选择 ${starTitle(item)}`"
                :checked="selectedIds.includes(starId(item))"
                @change="toggleSelect(starId(item))"
              />
            </label>

            <template v-if="item.type === 'tombstone'">
              <div class="tombstone-card" data-testid="tombstone-card">
                <div class="tombstone-main">
                  <span class="tombstone-watermark">{{ tombstoneWatermark(item) }}</span>
                  <span class="tombstone-title">{{ item.title }}</span>
                  <button
                    type="button"
                    class="tombstone-reason"
                    data-testid="tombstone-reason"
                    :aria-expanded="expandedReasonId === item.id"
                    @click="expandedReasonId = expandedReasonId === item.id ? null : item.id"
                  >看原因</button>
                </div>
                <p v-if="expandedReasonId === item.id" class="tombstone-reason-detail" data-testid="tombstone-reason-detail">
                  {{ tombstoneReasonText(item) }}
                </p>
                <div class="tombstone-actions">
                  <button
                    type="button"
                    class="tombstone-remove"
                    data-testid="tombstone-remove"
                    @click="openSingleConfirm(item)"
                  >移除</button>
                </div>
              </div>
            </template>

            <template v-else>
              <div class="star-entry-card">
                <router-link class="entry-title" :to="'/' + item.slug">{{ item.summary }}</router-link>
                <span v-if="isExpiring(item)" class="star-countdown" data-testid="star-countdown">剩余 {{ item.countdown!.remainingDays }} 天<span v-if="item.countdown!.status === 'paused'" class="star-countdown-exempt">· 豁免中</span></span>
              </div>
            </template>
          </li>
        </ul>
      </template>
    </div>

    <ConfirmDialog
      v-model:visible="confirmVisible"
      :title="confirmTitle"
      :message="confirmMessage"
      confirm-label="移除"
      variant="destructive"
      @confirm="handleConfirm"
      @cancel="closeConfirm"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useToast } from '@/composables/useToast'
import ThemeToggle from '@/components/ThemeToggle.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useStarStore } from '@/stores/star'
import type { StarItem } from '@/types'

const starStore = useStarStore()
const { items, loading, error } = storeToRefs(starStore)
const route = useRoute()
const router = useRouter()
const toast = useToast()

const tabDefs = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '有效' },
  { key: 'expiring', label: '即将失效' },
  { key: 'expired', label: '已失效或已删除' },
] as const
type FilterKey = typeof tabDefs[number]['key']

const filter = ref<FilterKey>('all')
const selectedIds = ref<number[]>([])
const expandedReasonId = ref<number | null>(null)

type ConfirmState =
  | { type: 'batch'; ids: number[] }
  | { type: 'single'; id: number; title: string }

const confirmVisible = ref(false)
const confirmState = ref<ConfirmState | null>(null)

const confirmTitle = computed(() =>
  confirmState.value?.type === 'batch' ? '移除所选星标' : '移除收藏',
)

const confirmMessage = computed(() => {
  const s = confirmState.value
  if (!s) return ''
  if (s.type === 'batch') {
    return `确认移除 ${s.ids.length} 个星标？关联的墓碑将一并清理`
  }
  return `确认移除「${s.title}」的收藏？关联的墓碑将一并清理`
})

const emptyTextMap: Record<FilterKey, string> = {
  all: '暂无星标内容',
  active: '暂无有效星标',
  expiring: '暂无即将失效内容',
  expired: '暂无失效内容或墓碑',
}
const emptyText = computed(() => emptyTextMap[filter.value])

function isExpiring(item: StarItem): boolean {
  return item.type === 'entry'
    && !!item.countdown
    && item.countdown.status !== 'expired'
    && item.countdown.remainingDays > 0
    && item.countdown.remainingDays < 7
}

function isExpiredEntry(item: StarItem): boolean {
  return item.type === 'entry' && item.countdown?.status === 'expired'
}

const filteredItems = computed<StarItem[]>(() => {
  const f = filter.value
  return items.value.filter((item) => {
    if (f === 'all') return true
    if (f === 'active') return item.type === 'entry' && !isExpiring(item) && !isExpiredEntry(item)
    if (f === 'expiring') return isExpiring(item)
    return item.type === 'tombstone' || isExpiredEntry(item)
  })
})

function starId(item: StarItem): number {
  return item.id
}

function starTitle(item: StarItem): string {
  return item.type === 'tombstone' ? item.title : (item.summary || item.slug)
}

function starKey(item: StarItem): string {
  return `${item.type}-${item.id}`
}

function toggleSelect(id: number): void {
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter(x => x !== id)
    : [...selectedIds.value, id]
}

async function load(): Promise<void> {
  await starStore.load({ filter: filter.value })
}

function switchFilter(key: FilterKey): void {
  filter.value = key
  selectedIds.value = []
  expandedReasonId.value = null
  router.replace({ query: { filter: key } })
  starStore.load({ filter: key })
}

function openBatchConfirm(): void {
  if (selectedIds.value.length === 0) return
  confirmState.value = { type: 'batch', ids: [...selectedIds.value] }
  confirmVisible.value = true
}

function openSingleConfirm(item: StarItem): void {
  confirmState.value = { type: 'single', id: item.id, title: starTitle(item) }
  confirmVisible.value = true
}

function closeConfirm(): void {
  confirmVisible.value = false
  confirmState.value = null
}

async function handleConfirm(): Promise<void> {
  const s = confirmState.value
  confirmVisible.value = false
  confirmState.value = null
  if (!s) return
  const ids = s.type === 'batch' ? s.ids : [s.id]
  try {
    await starStore.remove(ids)
    starStore.removeLocally(ids)
    selectedIds.value = []
    toast.show('已移除收藏', 'success')
  } catch {
    toast.show('移除失败，请重试', 'error')
  }
}

function tombstoneWatermark(item: Extract<StarItem, { type: 'tombstone' }>): string {
  return item.reason === 'expired' ? '内容已失效' : '作者已删除'
}

function tombstoneReasonText(item: Extract<StarItem, { type: 'tombstone' }>): string {
  const reason = item.reason === 'expired' ? '内容已失效（归档倒计时归零）' : '作者已删除该内容'
  return `${reason}，由 ${item.deletedBy} 于 ${formatDate(item.deletedAt)} 删除`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

onMounted(() => {
  const q = route.query.filter as string | undefined
  if (q && tabDefs.some(t => t.key === q)) {
    filter.value = q as FilterKey
  }
  load()
})
</script>

<style scoped>
.stars-page { min-height: 100vh; background: var(--c-bg); display: flex; flex-direction: column; }

.stars-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background: var(--c-surface);
  border-bottom: 1px solid var(--c-border);
  padding: 0 var(--space-5);
  height: var(--header-height);
  flex-shrink: 0;
}

.stars-logo {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  text-decoration: none;
  flex-shrink: 0;
}

.stars-logo-word {
  font-size: 20px;
  font-weight: 700;
  color: var(--c-text);
  letter-spacing: -0.02em;
}

.stars-logo:hover .stars-logo-word { color: var(--c-accent); }

.stars-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.stars-body {
  flex: 1;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
  padding: var(--space-4);
}

.stars-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-2);
}

.stars-title {
  font-size: var(--font-xl);
  font-weight: 700;
  color: var(--c-text);
  margin: 0;
}

.manage-expired-link {
  background: none;
  border: none;
  color: var(--c-accent);
  font-size: var(--font-sm);
  font-weight: 500;
  cursor: pointer;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
}

.manage-expired-link:hover {
  background: var(--c-accent-surface);
  text-decoration: underline;
}

.manage-expired-link:focus-visible {
  outline: 2px solid var(--c-accent-secondary);
  outline-offset: 2px;
}

.stars-tabs {
  display: flex;
  gap: var(--space-1);
  border-bottom: 1px solid var(--c-border);
  margin-bottom: var(--space-3);
  flex-wrap: wrap;
}

.stars-tab {
  padding: var(--space-1) var(--space-3);
  border: none;
  background: none;
  color: var(--c-text-secondary);
  cursor: pointer;
  font-size: var(--font-sm);
  font-weight: 500;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: all var(--transition-fast);
}

.stars-tab:hover { color: var(--c-text); }
.stars-tab.active { color: var(--c-accent); border-bottom-color: var(--c-accent); }

.stars-tab:focus-visible {
  outline: 2px solid var(--c-accent-secondary);
  outline-offset: 2px;
}

.stars-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: var(--space-3);
}

.stars-batch-remove {
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--c-border);
  background: var(--c-surface);
  color: var(--c-error);
  font-size: var(--font-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.stars-batch-remove:hover:not(:disabled) {
  background: var(--c-error-surface);
  border-color: var(--c-error);
}

.stars-batch-remove:focus-visible {
  outline: 2px solid var(--c-accent-secondary);
  outline-offset: 2px;
}

.stars-batch-remove:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.stars-loading {
  text-align: center;
  padding: var(--space-7);
  color: var(--c-text-secondary);
}

.stars-error {
  text-align: center;
  padding: var(--space-7);
  color: var(--c-error);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
}

.stars-retry {
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--c-border-strong);
  background: var(--c-surface);
  color: var(--c-text);
  cursor: pointer;
}

.stars-retry:focus-visible {
  outline: 2px solid var(--c-accent-secondary);
  outline-offset: 2px;
}

.stars-empty {
  text-align: center;
  padding: var(--space-7);
  color: var(--c-text-secondary);
}

.stars-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.stars-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  background: var(--c-surface);
  border: 1px solid var(--c-border-strong);
  border-radius: 12px;
  padding: var(--space-3);
}

.star-check {
  display: inline-flex;
  align-items: center;
  padding-top: 4px;
  flex-shrink: 0;
}

.star-checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--c-accent);
  cursor: pointer;
}

.star-checkbox:focus-visible {
  outline: 2px solid var(--c-accent-secondary);
  outline-offset: 2px;
}

.tombstone-card {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.tombstone-main {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.tombstone-watermark {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--c-surface-lower);
  color: var(--c-text-tertiary);
  letter-spacing: 0.02em;
}

.tombstone-title {
  font-size: var(--font-md);
  font-weight: 600;
  color: var(--c-text-tertiary);
  text-decoration: line-through;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tombstone-reason {
  background: none;
  border: none;
  color: var(--c-accent);
  font-size: var(--font-xs);
  cursor: pointer;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
}

.tombstone-reason:hover { text-decoration: underline; }

.tombstone-reason:focus-visible {
  outline: 2px solid var(--c-accent-secondary);
  outline-offset: 2px;
}

.tombstone-reason-detail {
  margin: 0;
  font-size: var(--font-xs);
  color: var(--c-text-secondary);
  line-height: 1.5;
}

.tombstone-actions {
  display: flex;
  gap: var(--space-2);
}

.tombstone-remove {
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--c-border);
  background: var(--c-surface);
  color: var(--c-error);
  font-size: var(--font-xs);
  font-weight: 500;
  cursor: pointer;
}

.tombstone-remove:hover {
  background: var(--c-error-surface);
  border-color: var(--c-error);
}

.tombstone-remove:focus-visible {
  outline: 2px solid var(--c-accent-secondary);
  outline-offset: 2px;
}

.star-entry-card {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.star-entry-card .entry-title {
  font-size: var(--font-md);
  font-weight: 600;
  color: var(--c-text);
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.star-entry-card .entry-title:hover { text-decoration: underline; }

.star-countdown {
  flex-shrink: 0;
  font-size: var(--font-xs);
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  color: var(--c-error);
  background: var(--c-error-surface);
  font-family: var(--font-mono);
}

.star-countdown-exempt {
  color: var(--c-text-secondary);
  font-family: var(--font-sans);
  font-weight: 500;
}

@media (max-width: 640px) {
  .stars-header { padding: 0 var(--space-3); }
  .stars-item { flex-wrap: wrap; }
}
</style>
