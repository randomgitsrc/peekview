<template>
  <Teleport to="body" :disabled="!isMobile">
    <div
      v-if="visible && !isMobile"
      ref="popoverRef"
      class="share-popover share-panel"
      role="dialog"
      aria-label="Share link"
    >
      <header class="popover-header">
        <h3 class="popover-title">Share Link</h3>
        <button class="popover-close-btn" aria-label="Close" @click="close">
          <XIcon :size="16" />
        </button>
      </header>

      <div class="popover-body">
        <div v-if="error" class="error-banner" role="alert">{{ error }}</div>

        <div v-else-if="viewState === 'loading'" class="loading-state">Loading...</div>

        <template v-else-if="viewState === 'result' && createdShare">
          <div class="url-display">
            <input
              class="share-link-input text-input url-input"
              :value="createdShare.shareUrl"
              readonly
              data-testid="share-link-input"
              @click="onUrlClick"
            />
            <button class="icon-action-btn" @click="copyUrl">
              <CopyIcon :size="14" />
              <span>{{ copied ? 'Copied!' : 'Copy' }}</span>
            </button>
          </div>
          <p class="warning">Copy the URL now — it won't be shown again!</p>
          <div class="result-actions">
            <button
              class="icon-action-btn danger"
              data-testid="share-revoke"
              @click="revokeOne(createdShare.id)"
            >
              <Trash2Icon :size="14" />
              <span>Revoke</span>
            </button>
            <button class="primary-btn" @click="finishResult">Done</button>
          </div>
        </template>

        <template v-else-if="viewState === 'activeList'">
          <div v-if="activeShares.length === 0" class="empty-state">
            No active share links
          </div>
          <div
            v-for="share in activeShares"
            :key="share.id"
            class="active-item"
            data-testid="share-active-item"
          >
            <div class="active-info">
              <span class="prefix">{{ share.tokenPrefix }}...</span>
              <span class="status-text">Active</span>
              <span class="expires-text">
                {{ share.viewCount }}{{ share.maxViews ? '/' + share.maxViews : '' }} uses ·
                {{ expiresLabel(share) }}
              </span>
            </div>
            <button
              class="icon-action-btn"
              title="Copy token"
              data-testid="share-copy-token"
              @click="copyShareUrl(share)"
            >
              <CopyIcon :size="14" />
            </button>
            <button
              class="icon-action-btn danger"
              title="Revoke share"
              data-testid="share-revoke"
              @click="revokeOne(share.id)"
            >
              <Trash2Icon :size="14" />
            </button>
          </div>
        </template>

        <template v-else>
          <div class="field">
            <label for="share-expires">Expires in</label>
            <select
              id="share-expires"
              v-model="expiresIn"
              class="select-input"
            >
              <option value="1h">1 Hour</option>
              <option value="24h">24 Hours</option>
              <option value="7d">7 Days</option>
              <option value="30d">30 Days</option>
              <option value="0">Permanent</option>
            </select>
          </div>
          <div class="field">
            <label for="share-max-views">Max uses (optional)</label>
            <input
              id="share-max-views"
              v-model.number="maxViews"
              type="number"
              min="1"
              placeholder="Unlimited"
              class="text-input"
            />
          </div>
          <button
            class="primary-btn"
            :disabled="creating"
            data-testid="share-generate"
            @click="createShare"
          >
            {{ creating ? 'Generating...' : 'Generate Link' }}
          </button>
        </template>
      </div>
    </div>

    <div
      v-else-if="visible && isMobile"
      class="share-mobile-overlay"
      role="presentation"
      @click.self="close"
    >
      <div
        ref="popoverRef"
        class="share-mobile-modal share-popover share-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Share link"
      >
        <header class="popover-header">
          <h3 class="popover-title">Share Link</h3>
          <button class="popover-close-btn" aria-label="Close" @click="close">
            <XIcon :size="16" />
          </button>
        </header>

        <div class="popover-body">
          <div v-if="error" class="error-banner" role="alert">{{ error }}</div>

          <div v-else-if="viewState === 'loading'" class="loading-state">Loading...</div>

          <template v-else-if="viewState === 'result' && createdShare">
            <div class="url-display">
              <input
                class="share-link-input text-input url-input"
                :value="createdShare.shareUrl"
                readonly
                data-testid="share-link-input"
                @click="onUrlClick"
              />
              <button class="icon-action-btn" @click="copyUrl">
                <CopyIcon :size="14" />
                <span>{{ copied ? 'Copied!' : 'Copy' }}</span>
              </button>
            </div>
            <p class="warning">Copy the URL now — it won't be shown again!</p>
            <div class="result-actions">
              <button
                class="icon-action-btn danger"
                data-testid="share-revoke"
                @click="revokeOne(createdShare.id)"
              >
                <Trash2Icon :size="14" />
                <span>Revoke</span>
              </button>
              <button class="primary-btn" @click="finishResult">Done</button>
            </div>
          </template>

          <template v-else-if="viewState === 'activeList'">
            <div v-if="activeShares.length === 0" class="empty-state">
              No active share links
            </div>
            <div
              v-for="share in activeShares"
              :key="share.id"
              class="active-item"
              data-testid="share-active-item"
            >
              <div class="active-info">
                <span class="prefix">{{ share.tokenPrefix }}...</span>
                <span class="status-text">Active</span>
                <span class="expires-text">
                  {{ share.viewCount }}{{ share.maxViews ? '/' + share.maxViews : '' }} uses ·
                  {{ expiresLabel(share) }}
                </span>
              </div>
              <button
                class="icon-action-btn"
                title="Copy token"
                data-testid="share-copy-token"
                @click="copyShareUrl(share)"
              >
                <CopyIcon :size="14" />
              </button>
              <button
                class="icon-action-btn danger"
                title="Revoke share"
                data-testid="share-revoke"
                @click="revokeOne(share.id)"
              >
                <Trash2Icon :size="14" />
              </button>
            </div>
          </template>

          <template v-else>
            <div class="field">
              <label for="share-expires-mobile">Expires in</label>
              <select
                id="share-expires-mobile"
                v-model="expiresIn"
                class="select-input"
              >
                <option value="1h">1 Hour</option>
                <option value="24h">24 Hours</option>
                <option value="7d">7 Days</option>
                <option value="30d">30 Days</option>
                <option value="0">Permanent</option>
              </select>
            </div>
            <div class="field">
              <label for="share-max-views-mobile">Max uses (optional)</label>
              <input
                id="share-max-views-mobile"
                v-model.number="maxViews"
                type="number"
                min="1"
                placeholder="Unlimited"
                class="text-input"
              />
            </div>
            <button
              class="primary-btn"
              :disabled="creating"
              data-testid="share-generate"
              @click="createShare"
            >
              {{ creating ? 'Generating...' : 'Generate Link' }}
            </button>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import { X as XIcon, Copy as CopyIcon, Trash2 as Trash2Icon } from 'lucide-vue-next'
import { useShareStore } from '@/stores/share'
import { useToast } from '@/composables/useToast'
import type { ShareInfo, ShareCreateResult } from '@/types'

const props = defineProps<{
  entrySlug: string
  visible: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  close: []
  'share-created': []
  'share-revoked': []
}>()

const shareStore = useShareStore()
const toast = useToast()

const visible = computed({
  get: () => props.visible,
  set: (v) => emit('update:visible', v),
})

const popoverRef = ref<HTMLElement | null>(null)

const isMobile = ref(false)
function checkMobile() {
  isMobile.value = typeof window !== 'undefined' && window.innerWidth < 768
}
checkMobile()
let resizeHandler: (() => void) | null = null
if (typeof window !== 'undefined') {
  resizeHandler = () => checkMobile()
  window.addEventListener('resize', resizeHandler)
}

const expiresIn = ref('7d')
const maxViews = ref<number | undefined>(undefined)
const creating = ref(false)
const copied = ref(false)
const error = ref<string | null>(null)
const createdShare = ref<ShareCreateResult | null>(null)

const shares = computed(() => shareStore.shares)
const loading = computed(() => shareStore.loading)

const activeShares = computed(() =>
  shares.value.filter(
    (s) => s.revokedAt === null && !isExpired(s) && !isMaxViewsReached(s)
  )
)

type ViewState = 'loading' | 'createForm' | 'result' | 'activeList'
const viewState = ref<ViewState>('loading')

function isExpired(share: ShareInfo): boolean {
  if (!share.expiresAt) return false
  return new Date(share.expiresAt) <= new Date()
}

function isMaxViewsReached(share: ShareInfo): boolean {
  return share.maxViews !== null && share.viewCount >= share.maxViews
}

function recomputeViewState() {
  if (loading.value && shares.value.length === 0) {
    viewState.value = 'loading'
    return
  }
  if (createdShare.value) {
    viewState.value = 'result'
    return
  }
  if (activeShares.value.length > 0) {
    viewState.value = 'activeList'
    return
  }
  viewState.value = 'createForm'
}

watch([loading, activeShares, createdShare], () => {
  recomputeViewState()
})

function expiresLabel(share: ShareInfo): string {
  if (share.maxViews !== null && share.viewCount >= share.maxViews) {
    return 'View limit reached'
  }
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

async function refreshShares() {
  try {
    await shareStore.fetchShares(props.entrySlug)
  } catch {
    error.value = 'Failed to load share links'
  }
}

async function createShare() {
  if (creating.value) return
  creating.value = true
  error.value = null
  try {
    const result = await shareStore.createShare(
      props.entrySlug,
      expiresIn.value,
      maxViews.value
    )
    createdShare.value = result
    copied.value = false
    emit('share-created')
    await refreshShares()
    viewState.value = 'result'
  } catch (err: any) {
    const msg =
      err?.response?.data?.error?.message ||
      err?.message ||
      'Failed to generate share link'
    error.value = msg
  } finally {
    creating.value = false
  }
}

async function copyUrl() {
  if (!createdShare.value) return
  try {
    await navigator.clipboard.writeText(createdShare.value.shareUrl)
    copied.value = true
    toast.show('Link copied', 'success')
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    toast.show('Failed to copy', 'error')
  }
}

async function copyShareUrl(share: ShareInfo) {
  const tokenPrefix = share.tokenPrefix
  const url = `${window.location.origin}/s/${tokenPrefix}`
  try {
    await navigator.clipboard.writeText(url)
    toast.show('Token copied', 'success')
  } catch {
    toast.show('Failed to copy', 'error')
  }
}

function onUrlClick(e: MouseEvent) {
  const target = e.target as HTMLInputElement
  target.select?.()
}

function finishResult() {
  createdShare.value = null
  copied.value = false
  expiresIn.value = '7d'
  maxViews.value = undefined
  recomputeViewState()
}

async function revokeOne(id: number) {
  try {
    await shareStore.revokeShares(props.entrySlug, [id])
    toast.show('1 link revoked', 'success')
    emit('share-revoked')
    if (createdShare.value && createdShare.value.id === id) {
      createdShare.value = null
      copied.value = false
    }
    await refreshShares()
    recomputeViewState()
  } catch {
    toast.show('Failed to revoke link', 'error')
  }
}

function close() {
  visible.value = false
  emit('close')
}

watch(
  () => props.visible,
  async (newVis) => {
    if (newVis) {
      error.value = null
      createdShare.value = null
      copied.value = false
      expiresIn.value = '7d'
      maxViews.value = undefined
      viewState.value = 'loading'
      await refreshShares()
      recomputeViewState()
      await nextTick()
      document.addEventListener('click', handleClickOutside, true)
      document.addEventListener('keydown', handleKeydown)
    } else {
      document.removeEventListener('click', handleClickOutside, true)
      document.removeEventListener('keydown', handleKeydown)
    }
  },
  { immediate: true }
)

function handleClickOutside(e: MouseEvent) {
  if (!visible.value) return
  if (!popoverRef.value) return
  const target = e.target as Node
  if (popoverRef.value.contains(target)) return
  const triggerEl = document.querySelector('[data-share-trigger]')
  if (triggerEl && triggerEl.contains(target)) return
  close()
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && visible.value) {
    e.stopPropagation()
    close()
  }
}

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside, true)
  document.removeEventListener('keydown', handleKeydown)
  if (resizeHandler) window.removeEventListener('resize', resizeHandler)
})
</script>

<style scoped>
.share-popover {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 6px;
  background: var(--c-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.15),
    0 4px 6px -2px rgba(0, 0, 0, 0.08);
  width: 320px;
  max-width: calc(100vw - 32px);
  z-index: 100;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.share-popover-inner {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.popover-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-color);
  background: var(--c-surface);
}

.popover-title {
  margin: 0;
  font-size: var(--font-sm, 13px);
  font-weight: 600;
  color: var(--text-primary);
}

.popover-close-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  border-radius: 6px;
  cursor: pointer;
}
.popover-close-btn:hover {
  background: var(--c-border);
  color: var(--text-primary);
}

.popover-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  max-height: 60vh;
  overflow-y: auto;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}

.select-input,
.text-input {
  width: 100%;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--c-bg, var(--bg-primary));
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
}

.select-input:focus,
.text-input:focus {
  outline: 2px solid var(--c-accent);
  outline-offset: -1px;
  border-color: var(--c-accent);
}

.primary-btn {
  width: 100%;
  padding: 8px 14px;
  border-radius: 6px;
  border: none;
  background: var(--c-accent);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}
.primary-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.primary-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.error-banner {
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--error-bg, rgba(220, 38, 38, 0.1));
  color: var(--c-error, #dc2626);
  font-size: 12px;
  border: 1px solid var(--c-error, #dc2626);
}

.loading-state {
  text-align: center;
  padding: 16px 8px;
  color: var(--text-secondary);
  font-size: 13px;
}

.empty-state {
  text-align: center;
  padding: 12px 8px;
  color: var(--text-secondary);
  font-size: 13px;
}

.url-display {
  display: flex;
  gap: 6px;
  align-items: stretch;
}

.url-input {
  flex: 1;
  font-family: monospace;
  font-size: 12px;
  min-width: 0;
  text-overflow: ellipsis;
}

.icon-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--c-surface);
  color: var(--text-primary);
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}
.icon-action-btn:hover {
  background: var(--c-border);
}
.icon-action-btn.danger {
  color: var(--c-error, #dc2626);
  border-color: var(--c-error, #dc2626);
}
.icon-action-btn.danger:hover {
  background: var(--error-bg, rgba(220, 38, 38, 0.1));
}

.warning {
  margin: 0;
  font-size: 12px;
  color: var(--c-warning, #b8860b);
  font-weight: 500;
  padding: 0;
}

.result-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.result-actions .primary-btn {
  flex: 1;
}

.result-actions .icon-action-btn {
  flex-shrink: 0;
}

.active-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px;
  border-radius: 6px;
  background: var(--c-bg, var(--bg-primary));
  border: 1px solid var(--border-color);
}

.active-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.prefix {
  font-family: monospace;
  font-size: 12px;
  color: var(--text-primary);
  font-weight: 500;
}

.status-text {
  font-size: 11px;
  font-weight: 600;
  color: var(--success-text, #16a34a);
}

.expires-text {
  font-size: 11px;
  color: var(--text-secondary);
}

.share-mobile-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.share-mobile-modal {
  position: relative;
  top: auto;
  right: auto;
  margin: 0;
  width: 100%;
  max-width: 360px;
  z-index: 210;
  max-height: 80vh;
}
</style>
