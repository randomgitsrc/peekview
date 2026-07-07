<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div v-if="visible" class="expires-overlay" @click.self="close">
        <div class="expires-dialog" role="dialog" aria-modal="true" @keydown.escape="close">
          <h2>{{ isArchived ? 'Reactivate Entry' : 'Edit Expiry' }}</h2>

          <div v-if="error" class="expires__error">{{ error }}</div>

          <div class="expires__field">
            <label for="expires-in-select">{{ isArchived ? 'Set new expiry' : 'Expires in' }}</label>
            <select id="expires-in-select" v-model="selected" class="expires-select" :disabled="loading">
              <option value="1h">1 Hour</option>
              <option value="24h">24 Hours</option>
              <option value="7d">7 Days</option>
              <option value="30d">30 Days</option>
              <option value="0">Never</option>
            </select>
          </div>

          <button class="expires__submit" :disabled="loading" @click="handleSubmit">
            {{ loading ? (isArchived ? 'Reactivating...' : 'Updating...') : (isArchived ? 'Reactivate' : 'Update') }}
          </button>

          <button class="close-btn" @click="close">&times;</button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { api } from '@/api/client'

const props = defineProps<{
  entrySlug: string
  isArchived: boolean
}>()

const visible = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{
  updated: []
}>()

const selected = ref('7d')
const loading = ref(false)
const error = ref<string | null>(null)

watch(visible, (v) => {
  if (v) {
    selected.value = '7d'
    error.value = null
    loading.value = false
  }
})

async function handleSubmit() {
  loading.value = true
  error.value = null
  try {
    await api.updateEntry(props.entrySlug, { expires_in: selected.value })
    emit('updated')
    visible.value = false
  } catch (e: any) {
    error.value = e.response?.data?.detail || e.message || 'Failed to update'
  } finally {
    loading.value = false
  }
}

function close() {
  visible.value = false
}
</script>

<style scoped>
.expires-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.expires-dialog {
  position: relative;
  background: var(--c-surface);
  border: 1px solid var(--c-border-strong);
  border-radius: 14px;
  padding: var(--space-6);
  min-width: 320px;
  max-width: 90vw;
}

.expires-dialog h2 {
  font-size: var(--font-lg);
  font-weight: 600;
  color: var(--c-text);
  margin: 0 0 var(--space-4);
}

.expires__error {
  color: var(--c-error);
  font-size: var(--font-sm);
  margin-bottom: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: var(--c-error-surface);
  border-radius: var(--radius-md);
}

.expires__field {
  margin-bottom: var(--space-4);
}

.expires__field label {
  display: block;
  font-size: var(--font-sm);
  color: var(--c-text-secondary);
  margin-bottom: var(--space-2);
}

.expires-select {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  background: var(--c-surface-lower);
  border: 1px solid var(--c-border-strong);
  border-radius: var(--radius-md);
  color: var(--c-text);
  font-size: var(--font-md);
  cursor: pointer;
}

.expires-select:focus {
  outline: 2px solid var(--c-accent-secondary);
  outline-offset: -2px;
}

.expires__submit {
  width: 100%;
  padding: var(--space-2) var(--space-4);
  background: var(--c-accent);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-md);
  font-weight: 600;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}

.expires__submit:hover:not(:disabled) {
  opacity: 0.9;
}

.expires__submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.close-btn {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
  background: none;
  border: none;
  color: var(--c-text-tertiary);
  font-size: 20px;
  cursor: pointer;
  padding: var(--space-1);
  line-height: 1;
}

.close-btn:hover {
  color: var(--c-text);
}

.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.2s ease;
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}
</style>
