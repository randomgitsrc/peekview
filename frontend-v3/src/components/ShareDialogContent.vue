<template>
  <div class="share-content">
    <div v-if="currentView === 'list'" class="list-view">
      <div class="share-header">
        <span class="share-title">Share Links</span>
        <button class="share-close-btn" @click="emitClose" aria-label="Close">
          <XIcon :size="18" />
        </button>
      </div>

      <div v-if="shareStore.loading" class="share-loading">
        <span class="loading-spinner"></span>
        <span>Loading...</span>
      </div>

      <template v-else>
        <div v-if="activeShares.length === 0 && expiredShares.length === 0" class="share-empty">
          <span>No active share links</span>
          <button class="create-share-btn" @click="currentView = 'create'">Create share link</button>
        </div>

        <template v-else>
          <div class="share-links">
            <div
              v-for="share in activeShares"
              :key="share.id"
              class="share-link-row"
              :class="{ 'new-link': newlyCreatedId === share.id }"
            >
              <div class="link-url-row">
                <div class="link-url-container" :title="displayUrl(share)">
                  <span class="share-url">{{ displayUrl(share) }}</span>
                </div>
                <button
                  class="copy-btn"
                  :class="{ copied: copiedId === share.id }"
                  @click="copyUrl(share)"
                  aria-label="Copy link"
                >
                  <CheckIcon v-if="copiedId === share.id" :size="14" class="copy-success" />
                  <CopyIcon v-else :size="14" />
                </button>
              </div>
              <div class="link-meta">
                <span class="share-status">{{ statusText(share) }}</span>
                <button class="revoke-btn" @click="revokeShare(share.id)">Revoke</button>
              </div>
            </div>
          </div>

          <div v-if="expiredShares.length > 0" class="expired-links-section">
            <button class="expired-toggle" @click="expiredExpanded = !expiredExpanded">
              <ChevronRightIcon :size="14" :class="{ expanded: expiredExpanded }" />
              Expired links ({{ expiredShares.length }})
            </button>
            <div v-if="expiredExpanded" class="expired-list">
              <div
                v-for="share in expiredShares"
                :key="share.id"
                class="share-link-row expired"
              >
                <div class="link-url-row">
                  <div class="link-url-container">
                    <span class="share-url">{{ share.tokenPrefix }}...</span>
                  </div>
                </div>
                <div class="link-meta">
                  <span class="share-status">{{ statusText(share) }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="share-footer">
            <button class="create-new-link-btn" @click="currentView = 'create'">+ Create new link</button>
          </div>
        </template>
      </template>
    </div>

    <div v-if="currentView === 'create'" class="create-view">
      <div class="share-header">
        <button class="back-btn" @click="currentView = 'list'">
          <ArrowLeftIcon :size="16" />
          Back
        </button>
        <span class="share-title">Create Link</span>
        <button class="share-close-btn" @click="emitClose" aria-label="Close">
          <XIcon :size="18" />
        </button>
      </div>

      <div class="create-form">
        <label class="form-label">
          Expires in
          <select v-model="expiresIn" class="expires-select">
            <option value="1h">1 hour</option>
            <option value="1d">1 day</option>
            <option value="7d">7 days</option>
            <option value="30d">30 days</option>
            <option value="never">Never</option>
          </select>
        </label>

        <label class="form-label">
          Max views
          <select v-model="maxViewsOption" class="max-views-select">
            <option value="unlimited">Unlimited</option>
            <option value="10">10</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </label>

        <button class="create-link-btn" :disabled="creating" @click="createLink">
          {{ creating ? 'Creating...' : 'Create link' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useShareStore } from '@/stores/share'
import { useToast } from '@/composables/useToast'
import type { ShareInfo } from '@/types'
import {
  X as XIcon,
  Copy as CopyIcon,
  Check as CheckIcon,
  ChevronRight as ChevronRightIcon,
  ArrowLeft as ArrowLeftIcon,
} from 'lucide-vue-next'

const props = defineProps<{
  entrySlug: string
}>()

const emit = defineEmits<{
  created: []
  revoked: []
  close: []
}>()

const shareStore = useShareStore()
const toast = useToast()

type ViewMode = 'list' | 'create'
const currentView = ref<ViewMode>('list')
const expiresIn = ref('7d')
const maxViewsOption = ref('unlimited')
const creating = ref(false)
const copiedId = ref<number | null>(null)
const newlyCreatedId = ref<number | null>(null)
const expiredExpanded = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | null = null

const activeShares = computed(() =>
  shareStore.shares.filter(s => s.revokedAt === null && !isShareExpired(s))
)

const expiredShares = computed(() =>
  shareStore.shares.filter(s => s.revokedAt !== null || isShareExpired(s))
)

function isShareExpired(share: ShareInfo): boolean {
  if (!share.expiresAt) return false
  return new Date(share.expiresAt) <= new Date()
}

function isMaxViewsReached(share: ShareInfo): boolean {
  return share.maxViews !== null && share.viewCount >= share.maxViews
}

function displayUrl(share: ShareInfo): string {
  const cached = shareStore.getShareUrl(share.id)
  if (cached) return cached
  return share.tokenPrefix + '...'
}

function statusText(share: ShareInfo): string {
  if (share.revokedAt !== null) return 'Revoked'
  if (isMaxViewsReached(share)) return 'View limit reached'
  const parts: string[] = []
  parts.push(`${share.viewCount}${share.maxViews ? '/' + share.maxViews : ''} views`)
  if (share.expiresAt) {
    const expires = new Date(share.expiresAt)
    const now = new Date()
    const diffMs = expires.getTime() - now.getTime()
    if (diffMs <= 0) return 'Expired'
    if (diffMs < 3600000) parts.push(`Expires in ${Math.floor(diffMs / 60000)}m`)
    else if (diffMs < 86400000) parts.push(`Expires in ${Math.floor(diffMs / 3600000)}h`)
    else parts.push(`Expires in ${Math.floor(diffMs / 86400000)}d`)
  } else {
    parts.push('Permanent')
  }
  return parts.join(' · ')
}

async function copyUrl(share: ShareInfo) {
  const url = displayUrl(share)
  try {
    await navigator.clipboard.writeText(url)
    copiedId.value = share.id
    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      copiedId.value = null
    }, 1500)
  } catch {
    toast.show('Failed to copy', 'error')
  }
}

async function revokeShare(id: number) {
  try {
    await shareStore.revokeShares(props.entrySlug, [id])
    toast.show('Link revoked', 'success')
    emit('revoked')
  } catch {
    toast.show('Failed to revoke link', 'error')
  }
}

async function createLink() {
  creating.value = true
  try {
    const maxViews = maxViewsOption.value === 'unlimited' ? undefined : parseInt(maxViewsOption.value)
    const result = await shareStore.createShare(props.entrySlug, expiresIn.value, maxViews)
    newlyCreatedId.value = result.id
    currentView.value = 'list'
    emit('created')
    setTimeout(() => {
      newlyCreatedId.value = null
    }, 500)
  } catch {
    toast.show('Failed to create link', 'error')
  } finally {
    creating.value = false
  }
}

function emitClose() {
  emit('close')
}

onMounted(() => {
  shareStore.fetchShares(props.entrySlug)
})
</script>

<style scoped>
.share-content {
  font-size: var(--font-sm);
}

.share-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px 8px;
  gap: 8px;
}

.share-title {
  font-size: var(--font-md);
  font-weight: 600;
  flex: 1;
}

.share-close-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--c-text-secondary);
  cursor: pointer;
  flex-shrink: 0;
}

.share-close-btn:hover {
  background: var(--c-surface-lower);
  color: var(--c-text);
}

.share-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px 16px;
  color: var(--c-text-secondary);
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--c-border);
  border-top-color: var(--c-accent);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.share-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 24px 16px;
  color: var(--c-text-secondary);
}

.create-share-btn,
.create-link-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  background: var(--c-accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: var(--font-sm);
  font-weight: 600;
  cursor: pointer;
  width: 100%;
}

.create-share-btn:hover,
.create-link-btn:hover {
  background: var(--c-accent-secondary);
}

.create-link-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.share-links {
  padding: 4px 0;
}

.share-link-row {
  padding: 8px 16px;
  border-left: 2px solid transparent;
}

.share-link-row.new-link {
  border-left-color: var(--c-success);
  animation: flash-border 0.5s ease-out;
}

@keyframes flash-border {
  0% { border-left-color: var(--c-success); }
  100% { border-left-color: var(--c-success); }
}

.share-link-row.expired {
  opacity: 0.6;
}

.link-url-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.link-url-container {
  flex: 1;
  min-width: 0;
  background: var(--c-surface-lower);
  border: 1px solid var(--c-border);
  border-radius: 4px;
  padding: 4px 8px;
  overflow: hidden;
}

.share-url {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--c-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

.copy-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--c-text-tertiary);
  cursor: pointer;
  flex-shrink: 0;
}

.copy-btn:hover {
  color: var(--c-text);
  background: var(--c-surface-lower);
}

.copy-btn.copied {
  color: var(--c-success);
}

.copy-success {
  color: var(--c-success);
}

.link-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
}

.share-status {
  font-size: 11px;
  color: var(--c-text-tertiary);
}

.revoke-btn {
  font-size: 11px;
  color: var(--c-error);
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
}

.revoke-btn:hover {
  background: var(--c-error-surface);
}

.expired-links-section {
  border-top: 1px solid var(--c-border);
  margin-top: 4px;
}

.expired-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  padding: 8px 16px;
  font-size: 12px;
  color: var(--c-text-tertiary);
  background: transparent;
  border: none;
  cursor: pointer;
}

.expired-toggle:hover {
  color: var(--c-text-secondary);
}

.expired-toggle svg {
  transition: transform 0.15s;
}

.expired-toggle svg.expanded {
  transform: rotate(90deg);
}

.expired-list {
  padding: 0 0 4px;
}

.share-footer {
  padding: 8px 16px;
  border-top: 1px solid var(--c-border);
}

.create-new-link-btn {
  background: transparent;
  border: none;
  color: var(--c-accent);
  font-size: var(--font-sm);
  cursor: pointer;
  padding: 4px 0;
}

.create-new-link-btn:hover {
  color: var(--c-accent-secondary);
}

.create-view .share-header {
  gap: 4px;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: none;
  color: var(--c-text-secondary);
  font-size: var(--font-sm);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}

.back-btn:hover {
  color: var(--c-text);
  background: var(--c-surface-lower);
}

.create-form {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: var(--c-text-secondary);
  font-weight: 500;
}

.expires-select,
.max-views-select {
  background: var(--c-surface-lower);
  border: 1px solid var(--c-border);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: var(--font-sm);
  color: var(--c-text);
  cursor: pointer;
  appearance: auto;
}

.expires-select:focus,
.max-views-select:focus {
  border-color: var(--c-accent);
  outline: none;
  box-shadow: 0 0 0 3px var(--c-glow);
}
</style>
