<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div v-if="visible" class="share-overlay" @click.self="close">
        <div class="share-dialog" role="dialog" aria-modal="true" @keydown.escape="close">
          <h2>Share Link</h2>

          <div v-if="error" class="share__error">{{ error }}</div>

          <div v-if="!createdShare" class="create-section">
            <div class="share__field">
              <label for="share-expires">Expires in</label>
              <select id="share-expires" v-model="expiresIn" class="expires-select">
                <option value="1h">1 Hour</option>
                <option value="24h">24 Hours</option>
                <option value="7d">7 Days</option>
                <option value="30d">30 Days</option>
                <option value="0">Permanent</option>
              </select>
            </div>
            <div class="share__field">
              <label for="share-max-views">Max views (optional)</label>
              <input
                id="share-max-views"
                v-model.number="maxViews"
                type="number"
                min="1"
                placeholder="Unlimited"
                class="max-views-input"
              />
            </div>
            <button class="share__submit create-btn" :disabled="creating" @click="createShare">
              {{ creating ? 'Creating...' : 'Create Link' }}
            </button>
          </div>

          <div v-else class="result-section">
            <div class="url-display">
              <input :value="createdShare.shareUrl" readonly ref="urlInput" @click="selectUrl" />
              <button class="copy-btn" @click="copyUrl">{{ copied ? 'Copied!' : 'Copy' }}</button>
            </div>
            <p class="warning">Copy the URL now — it won't be shown again!</p>
            <button class="create-another-btn" @click="createAnother">Create Another</button>
          </div>

          <button class="close-btn" @click="close">&times;</button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useShareStore } from '@/stores/share'
import { useToast } from '@/composables/useToast'
import type { ShareCreateResult } from '@/types'

const props = defineProps<{
  entrySlug: string
}>()

const visible = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{
  'share-created': []
}>()

const shareStore = useShareStore()
const toast = useToast()

const expiresIn = ref('7d')
const maxViews = ref<number | undefined>(undefined)
const creating = ref(false)
const createdShare = ref<ShareCreateResult | null>(null)
const copied = ref(false)
const error = ref<string | null>(null)
const urlInput = ref<HTMLInputElement | null>(null)

watch(visible, (v) => {
  if (v) {
    expiresIn.value = '7d'
    maxViews.value = undefined
    createdShare.value = null
    copied.value = false
    error.value = null
  }
})

async function createShare() {
  creating.value = true
  error.value = null
  try {
    const result = await shareStore.createShare(props.entrySlug, expiresIn.value, maxViews.value)
    createdShare.value = result
    emit('share-created')
  } catch (err: any) {
    const msg = err?.response?.data?.error?.message || err?.message || 'Failed to create share link'
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
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    toast.show('Failed to copy', 'error')
  }
}

function selectUrl() {
  urlInput.value?.select()
}

function createAnother() {
  createdShare.value = null
  copied.value = false
  expiresIn.value = '7d'
  maxViews.value = undefined
}

function close() {
  visible.value = false
}
</script>

<style scoped>
.share-overlay {
  position: fixed;
  inset: 0;
  background: var(--bg-overlay);
  z-index: 9997;
  display: flex;
  align-items: center;
  justify-content: center;
}

.share-dialog {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 24px;
  max-width: 480px;
  width: 90%;
  position: relative;
}

.share-dialog h2 {
  margin: 0 0 20px;
  font-size: 20px;
  color: var(--text-primary);
}

.share__field {
  margin-bottom: 16px;
}

.share__field label {
  display: block;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.share__field select,
.share__field input {
  width: 100%;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px;
}

.share__field select:focus,
.share__field input:focus {
  outline: 2px solid var(--accent-color);
  outline-offset: -1px;
}

.share__error {
  color: var(--error-text);
  font-size: 13px;
  padding: 8px 0;
  margin-bottom: 12px;
}

.share__submit {
  padding: 10px 16px;
  border-radius: 6px;
  border: none;
  background: var(--accent-color);
  color: var(--text-on-accent);
  font-size: 14px;
  cursor: pointer;
  width: 100%;
}

.share__submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.url-display {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.url-display input {
  flex: 1;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 13px;
  font-family: monospace;
}

.copy-btn {
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
}

.copy-btn:hover {
  background: var(--bg-tertiary);
}

.warning {
  font-size: 12px;
  color: var(--warning-text, #b8860b);
  margin: 0 0 16px;
}

.create-another-btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  width: 100%;
}

.create-another-btn:hover {
  background: var(--bg-tertiary);
}

.close-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  background: none;
  border: none;
  font-size: 20px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
}

.dialog-enter-active { transition: opacity 0.2s ease; }
.dialog-leave-active { transition: opacity 0.2s ease; }
.dialog-enter-from { opacity: 0; }
.dialog-leave-to { opacity: 0; }
</style>
