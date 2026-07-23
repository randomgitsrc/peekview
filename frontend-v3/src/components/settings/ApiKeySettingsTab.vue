<template>
  <div data-testid="apikeys-content" class="apikey-settings-tab">
    <div class="page-title-bar">
      <h1 class="page-title">API Keys</h1>
      <BaseButton variant="primary" @click="showCreate = true">Create Key</BaseButton>
    </div>
    <div v-if="loading" class="loading-state">
      <span>Loading...</span>
    </div>
    <div v-else-if="error" class="error-state">
      <span>{{ error }}</span>
    </div>
    <EmptyState
      v-else-if="keys.length === 0"
      icon="Database"
      heading="No API keys yet"
      description="Create one to automate entry creation."
      cta-label="Create Key"
      @cta="showCreate = true"
    />
    <div v-else class="key-list">
      <div v-for="key in keys" :key="key.id" class="key-card">
        <div class="key-info">
          <div class="key-name">{{ key.name }}</div>
          <div class="key-meta">
            <span class="key-prefix">{{ key.keyPrefix }}...</span>
            <span v-if="key.expiresAt" class="key-expiry" :class="{ 'expired': isExpired(key.expiresAt) }">
              <template v-if="isExpired(key.expiresAt)">
                <BaseBadge status="private" />
              </template>
              <template v-else>Expires {{ formatDate(key.expiresAt) }}</template>
            </span>
            <span v-else class="key-expiry">No expiry</span>
            <span class="key-last-used">
              {{ key.lastUsedAt ? `Last used ${formatRelativeTime(key.lastUsedAt)}` : 'Never used' }}
            </span>
          </div>
          <div class="key-created">Created {{ formatDate(key.createdAt) }}</div>
        </div>
        <div class="key-actions">
          <BaseButton size="small" variant="danger" @click="confirmRevoke(key)">Revoke</BaseButton>
        </div>
      </div>
    </div>

    <BaseButton
      v-if="keys.some(k => k.expiresAt && isExpired(k.expiresAt))"
      variant="secondary"
      class="cleanup-btn"
      @click="handleCleanup"
    >
      Cleanup Expired Keys
    </BaseButton>

    <Teleport to="body">
      <Transition name="dialog">
        <div v-if="showCreate" class="dialog-overlay" @click.self="showCreate = false">
          <div class="dialog" role="dialog" aria-modal="true">
            <h2 v-if="!createdKey">Create API Key</h2>
            <h2 v-else>API Key Created</h2>

            <div v-if="!createdKey">
              <div class="form-field">
                <label for="key-name">Name</label>
                <input
                  id="key-name"
                  ref="nameInput"
                  v-model="newKeyName"
                  type="text"
                  placeholder="e.g., CI Bot"
                  :disabled="creating"
                  maxlength="64"
                  @keydown.enter="handleCreate"
                />
              </div>
              <div class="form-field">
                <label for="key-expiry">Expiration</label>
                <select id="key-expiry" v-model="newKeyExpiry" :disabled="creating">
                  <option value="">Never</option>
                  <option value="7d">7 days</option>
                  <option value="30d">30 days</option>
                  <option value="90d">90 days</option>
                </select>
              </div>
              <div v-if="createError" class="error-state">{{ createError }}</div>
              <div class="dialog-actions">
                <BaseButton variant="secondary" :disabled="creating" @click="showCreate = false">Cancel</BaseButton>
                <BaseButton variant="primary" :disabled="creating || !newKeyName.trim()" @click="handleCreate">
                  {{ creating ? 'Creating...' : 'Create' }}
                </BaseButton>
              </div>
            </div>

            <div v-else class="created-key-section">
              <p class="warning-text">
                Copy this key now — it won't be shown again!
              </p>
              <div class="key-display">
                <code class="key-value">{{ createdKey.key }}</code>
                <BaseButton size="small" variant="secondary" @click="copyKey" :title="copied ? 'Copied!' : 'Copy'">
                  {{ copied ? 'Copied!' : 'Copy' }}
                </BaseButton>
              </div>
              <div class="dialog-actions">
                <BaseButton variant="primary" @click="dismissCreated">I've Saved It</BaseButton>
              </div>
            </div>

            <button type="button" class="dialog-close" @click="handleCloseCreate" aria-label="Close">&times;</button>
          </div>
        </div>
      </Transition>
    </Teleport>

    <ConfirmDialog
      v-model:visible="showRevokeConfirm"
      title="Revoke API Key"
      :message="revokeMessage"
      confirm-label="Revoke"
      variant="destructive"
      @confirm="handleRevoke"
      @cancel="revokeTarget = null"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { api } from '@/api/client'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import BaseButton from '@/components/BaseButton.vue'
import BaseBadge from '@/components/BaseBadge.vue'
import EmptyState from '@/components/EmptyState.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import type { ApiKey, ApiKeyCreateResult } from '@/types'

const authStore = useAuthStore()
const toast = useToast()

const keys = ref<ApiKey[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const showCreate = ref(false)
const newKeyName = ref('')
const newKeyExpiry = ref('')
const creating = ref(false)
const createError = ref<string | null>(null)
const createdKey = ref<ApiKeyCreateResult | null>(null)
const nameInput = ref<HTMLInputElement | null>(null)
const copied = ref(false)

const showRevokeConfirm = ref(false)
const revokeTarget = ref<ApiKey | null>(null)
const revokeMessage = computed(() =>
  revokeTarget.value
    ? `Are you sure you want to revoke "${revokeTarget.value.name}"? Any scripts using this key will stop working.`
    : ''
)

watch(showCreate, async (v) => {
  if (v && !createdKey.value) {
    newKeyName.value = ''
    newKeyExpiry.value = ''
    createError.value = null
    await nextTick()
    nameInput.value?.focus()
  }
})

onMounted(() => {
  if (authStore.authState === 'authenticated') {
    loadKeys()
  }
})

watch(() => authStore.authState, (state) => {
  if (state === 'authenticated' && keys.value.length === 0 && !loading.value && !error.value) {
    loadKeys()
  }
})

async function loadKeys() {
  loading.value = true
  error.value = null
  try {
    keys.value = await api.listApiKeys()
  } catch (err: any) {
    error.value = err?.response?.data?.error?.message || 'Failed to load API keys'
  } finally {
    loading.value = false
  }
}

async function handleCreate() {
  if (!newKeyName.value.trim()) return
  creating.value = true
  createError.value = null
  try {
    const result = await api.createApiKey(newKeyName.value.trim(), newKeyExpiry.value || undefined)
    createdKey.value = result
    await loadKeys()
  } catch (err: any) {
    createError.value = err?.response?.data?.error?.message || 'Failed to create API key'
  } finally {
    creating.value = false
  }
}

async function copyKey() {
  if (!createdKey.value) return
  try {
    await navigator.clipboard.writeText(createdKey.value.key)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
  }
}

function dismissCreated() {
  createdKey.value = null
  showCreate.value = false
  copied.value = false
}

function handleCloseCreate() {
  if (createdKey.value) {
    if (confirm("Have you saved your API key? It won't be shown again.")) {
      dismissCreated()
    }
  } else {
    showCreate.value = false
  }
}

function confirmRevoke(key: ApiKey) {
  revokeTarget.value = key
  showRevokeConfirm.value = true
}

async function handleRevoke() {
  if (!revokeTarget.value) return
  try {
    await api.revokeApiKey(revokeTarget.value.id)
    toast.show(`Revoked "${revokeTarget.value.name}"`, 'success')
    await loadKeys()
  } catch (err: any) {
    toast.show(err?.response?.data?.error?.message || 'Failed to revoke key', 'error')
  }
  revokeTarget.value = null
}

async function handleCleanup() {
  try {
    const count = await api.cleanupExpiredKeys()
    toast.show(`Cleaned up ${count} expired key(s)`, 'success')
    await loadKeys()
  } catch (err: any) {
    toast.show(err?.response?.data?.error?.message || 'Failed to cleanup', 'error')
  }
}

function isExpired(dateStr: string | null): boolean {
  if (!dateStr) return false
  return new Date(dateStr) < new Date()
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString()
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  return `${diffDay}d ago`
}
</script>

<style scoped>
.apikey-settings-tab { }

.page-title-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--c-text);
  margin: 0;
}

.loading-state {
  text-align: center;
  padding: var(--space-7);
  color: var(--c-text-secondary);
}

.error-state {
  text-align: center;
  padding: var(--space-7);
  color: var(--c-error);
}

.key-list { display: flex; flex-direction: column; gap: var(--space-3); }

.key-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  background: var(--c-surface);
  border: 1px solid var(--c-border-strong);
  border-radius: 14px;
  gap: var(--space-3);
}

.key-name { font-weight: 600; font-size: var(--font-md); color: var(--c-text); }

.key-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  font-size: var(--font-xs);
  color: var(--c-text-secondary);
  margin-top: 2px;
}

.key-prefix { font-family: var(--font-mono); color: var(--c-text-tertiary); }
.key-expiry { }
.key-expiry.expired { color: var(--c-error); font-weight: 500; }
.key-created { font-size: var(--font-xs); color: var(--c-text-tertiary); margin-top: 2px; }

.cleanup-btn { margin-top: var(--space-4); }

.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.5);
  z-index: 9997;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dialog {
  background: var(--c-surface);
  border: 1px solid var(--c-border-strong);
  border-radius: 14px;
  padding: 24px;
  max-width: 480px;
  width: 90%;
  position: relative;
}

.dialog h2 { margin: 0 0 20px; font-size: 20px; color: var(--c-text); }

.form-field { margin-bottom: 16px; }
.form-field label { display: block; font-size: 13px; color: var(--c-text-secondary); margin-bottom: 4px; }

.form-field input,
.form-field select {
  width: 100%;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--c-border);
  background: var(--c-surface-lower);
  color: var(--c-text);
  font-size: 14px;
}

.form-field input:focus,
.form-field select:focus {
  outline: 2px solid var(--c-accent);
  outline-offset: -1px;
}

.dialog-actions { display: flex; gap: var(--space-2); justify-content: flex-end; margin-top: 20px; }

.dialog-close {
  position: absolute;
  top: 12px;
  right: 12px;
  background: none;
  border: none;
  font-size: 20px;
  color: var(--c-text-secondary);
  cursor: pointer;
  padding: 4px;
}

.warning-text {
  color: var(--c-warning);
  font-weight: 500;
  font-size: var(--font-sm);
  margin-bottom: var(--space-3);
}

.key-display {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  background: var(--c-surface-lower);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
}

.key-value {
  flex: 1;
  font-family: var(--font-mono);
  font-size: var(--font-sm);
  word-break: break-all;
  user-select: all;
  color: var(--c-text);
}

.dialog-enter-active { transition: opacity 0.2s ease; }
.dialog-leave-active { transition: opacity 0.2s ease; }
.dialog-enter-from { opacity: 0; }
.dialog-leave-to { opacity: 0; }
</style>
