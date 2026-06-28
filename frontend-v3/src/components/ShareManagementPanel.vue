<template>
  <div class="share-management-panel" v-if="shares.length > 0 || loading">
    <div class="panel-header">
      <h3>Share Links</h3>
      <span class="stats">Active {{ activeCount }} / Expired {{ expiredCount }} / Revoked {{ revokedCount }}</span>
    </div>

    <div v-if="loading" class="loading">Loading...</div>

    <div v-else-if="shares.length === 0" class="empty">No share links</div>

    <div v-else class="share-list">
      <div v-for="share in shares" :key="share.id" class="share-item" :class="shareStatus(share)">
        <label class="checkbox-label" v-if="share.revokedAt === null && !isExpired(share)">
          <input type="checkbox" v-model="selectedIds" :value="share.id" />
        </label>
        <span class="prefix">{{ share.tokenPrefix }}...</span>
        <span class="status">{{ statusLabel(share) }}</span>
        <span class="views">{{ share.viewCount }}{{ share.maxViews ? '/' + share.maxViews : '' }} views</span>
        <span class="expires">{{ expiresLabel(share) }}</span>
        <button v-if="share.revokedAt === null && !isExpired(share)" class="revoke-btn" @click="revokeOne(share.id)">Revoke</button>
      </div>

      <div v-if="selectedIds.length > 0" class="batch-actions">
        <button class="danger" @click="revokeSelected">Revoke {{ selectedIds.length }} Selected</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useShareStore } from '@/stores/share'
import { useToast } from '@/composables/useToast'
import type { ShareInfo } from '@/types'

const props = defineProps<{
  entrySlug: string
}>()

const emit = defineEmits<{
  'share-revoked': []
}>()

const shareStore = useShareStore()
const toast = useToast()
const selectedIds = ref<number[]>([])

const shares = computed(() => shareStore.shares)
const loading = computed(() => shareStore.loading)

const activeCount = computed(() => shares.value.filter(s => s.revokedAt === null && !isExpired(s)).length)
const expiredCount = computed(() => shares.value.filter(s => s.revokedAt === null && isExpired(s)).length)
const revokedCount = computed(() => shares.value.filter(s => s.revokedAt !== null).length)

function isExpired(share: ShareInfo): boolean {
  if (!share.expiresAt) return false
  return new Date(share.expiresAt) <= new Date()
}

function isMaxViewsReached(share: ShareInfo): boolean {
  return share.maxViews !== null && share.viewCount >= share.maxViews
}

function shareStatus(share: ShareInfo): string {
  if (share.revokedAt !== null) return 'revoked'
  if (isExpired(share) || isMaxViewsReached(share)) return 'expired'
  return 'active'
}

function statusLabel(share: ShareInfo): string {
  if (share.revokedAt !== null) return 'Revoked'
  if (isMaxViewsReached(share)) return 'Expired'
  if (isExpired(share)) return 'Expired'
  return 'Active'
}

function expiresLabel(share: ShareInfo): string {
  if (share.revokedAt !== null) return ''
  if (isMaxViewsReached(share)) return 'View limit reached'
  if (!share.expiresAt) return 'Permanent'
  const expires = new Date(share.expiresAt)
  const now = new Date()
  const diffMs = expires.getTime() - now.getTime()
  if (diffMs <= 0) {
    const agoMs = -diffMs
    if (agoMs < 3600000) return `Expired ${Math.floor(agoMs / 60000)}m ago`
    if (agoMs < 86400000) return `Expired ${Math.floor(agoMs / 3600000)}h ago`
    return `Expired ${Math.floor(agoMs / 86400000)}d ago`
  }
  if (diffMs < 3600000) return `Expires in ${Math.floor(diffMs / 60000)}m`
  if (diffMs < 86400000) return `Expires in ${Math.floor(diffMs / 3600000)}h`
  return `Expires in ${Math.floor(diffMs / 86400000)}d`
}

async function revokeOne(id: number) {
  try {
    await shareStore.revokeShares(props.entrySlug, [id])
    toast.show('1 link revoked', 'success')
    emit('share-revoked')
  } catch {
    toast.show('Failed to revoke link', 'error')
  }
}

async function revokeSelected() {
  const count = selectedIds.value.length
  try {
    await shareStore.revokeShares(props.entrySlug, [...selectedIds.value])
    selectedIds.value = []
    toast.show(`${count} link${count > 1 ? 's' : ''} revoked`, 'success')
    emit('share-revoked')
  } catch {
    toast.show('Failed to revoke links', 'error')
  }
}

onMounted(() => {
  shareStore.fetchShares(props.entrySlug)
})
</script>

<style scoped>
.share-management-panel {
  margin-top: 16px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md, 8px);
  padding: 16px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.panel-header h3 {
  margin: 0;
  font-size: 14px;
  color: var(--text-primary);
}

.stats {
  font-size: 12px;
  color: var(--text-secondary);
}

.loading,
.empty {
  font-size: 13px;
  color: var(--text-secondary);
  padding: 8px 0;
}

.share-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.share-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 6px;
  font-size: 13px;
}

.share-item.active {
  background: var(--bg-secondary);
}

.share-item.expired {
  opacity: 0.6;
}

.share-item.revoked {
  opacity: 0.5;
}

.checkbox-label {
  display: flex;
  align-items: center;
}

.prefix {
  font-family: monospace;
  color: var(--text-secondary);
  font-size: 12px;
}

.status {
  font-size: 12px;
  font-weight: 500;
  min-width: 60px;
}

.active .status {
  color: var(--success-text, #16a34a);
}

.expired .status,
.revoked .status {
  color: var(--text-tertiary);
}

.views {
  font-size: 12px;
  color: var(--text-secondary);
  min-width: 80px;
}

.expires {
  font-size: 12px;
  color: var(--text-secondary);
  flex: 1;
}

.revoke-btn {
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
}

.revoke-btn:hover {
  color: var(--error-text);
  border-color: var(--error-border);
}

.batch-actions {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border-color);
}

.batch-actions .danger {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid var(--error-border);
  background: var(--bg-primary);
  color: var(--error-text);
  font-size: 13px;
  cursor: pointer;
}

.batch-actions .danger:hover {
  background: var(--error-bg);
}
</style>
