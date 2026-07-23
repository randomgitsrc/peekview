<template>
  <div data-testid="security-content" class="security-tab">
    <div class="form-field">
      <label>Old Password</label>
      <input
        data-testid="security-old-password"
        v-model="oldPassword"
        type="password"
        autocomplete="current-password"
      />
    </div>
    <div class="form-field">
      <label>New Password</label>
      <input
        data-testid="security-new-password"
        v-model="newPassword"
        type="password"
        autocomplete="new-password"
      />
    </div>
    <div class="form-field">
      <label>Confirm New Password</label>
      <input
        data-testid="security-confirm-password"
        v-model="confirmPassword"
        type="password"
        autocomplete="new-password"
      />
    </div>
    <BaseButton
      data-testid="security-submit"
      variant="primary"
      :disabled="submitDisabled"
      @click="handleSubmit"
    >
      {{ submitting ? 'Changing...' : 'Change Password' }}
    </BaseButton>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { api } from '@/api/client'
import { useToast } from '@/composables/useToast'
import BaseButton from '@/components/BaseButton.vue'

const toast = useToast()

const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const submitting = ref(false)

const submitDisabled = computed(() => {
  return submitting.value
    || !oldPassword.value
    || newPassword.value.length < 8
    || newPassword.value !== confirmPassword.value
})

async function handleSubmit() {
  if (submitDisabled.value) return
  submitting.value = true
  try {
    await api.changePassword(oldPassword.value, newPassword.value)
    toast.success('Password changed successfully')
    oldPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (err: any) {
    const detail = err?.response?.data?.detail
    toast.error(detail || 'Failed to change password')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.security-tab { display: flex; flex-direction: column; gap: var(--space-4); }

.form-field { display: flex; flex-direction: column; gap: var(--space-1); }
.form-field label { font-size: 13px; color: var(--c-text-secondary); }

.form-field input {
  padding: 8px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--c-border);
  background: var(--c-surface-lower);
  color: var(--c-text);
  font-size: 14px;
}

.form-field input:focus {
  outline: 2px solid var(--c-accent);
  outline-offset: -1px;
}
</style>
