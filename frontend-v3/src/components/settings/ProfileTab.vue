<template>
  <div class="profile-tab">
    <div class="form-field">
      <label>Username</label>
      <input
        data-testid="profile-username"
        type="text"
        :value="user?.username"
        readonly
      />
    </div>
    <div class="form-field">
      <label>Display Name</label>
      <input
        data-testid="profile-display-name"
        v-model="displayName"
        type="text"
        maxlength="64"
        placeholder="Enter display name"
      />
      <span v-if="displayName.length > 64" class="field-error">Display name must be 64 characters or less</span>
    </div>
    <div class="form-field">
      <label>Role</label>
      <span data-testid="profile-role" class="role-badge" :class="user?.isAdmin ? 'role-admin' : 'role-member'">
        {{ user?.isAdmin ? 'Admin' : 'Member' }}
      </span>
    </div>
    <div class="form-field">
      <label>Member Since</label>
      <span data-testid="profile-member-since" class="member-since">{{ formattedDate }}</span>
    </div>
    <BaseButton
      data-testid="profile-save"
      variant="primary"
      :disabled="saving || displayName.length > 64"
      @click="handleSave"
    >
      {{ saving ? 'Saving...' : 'Save' }}
    </BaseButton>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, toRef } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import BaseButton from '@/components/BaseButton.vue'

const authStore = useAuthStore()
const toast = useToast()
const user = toRef(authStore, 'user')

const displayName = ref(user.value?.displayName || '')
const saving = ref(false)

const formattedDate = computed(() => {
  if (!user.value?.createdAt) return ''
  return new Date(user.value.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
})

async function handleSave() {
  if (saving.value || displayName.value.length > 64) return
  saving.value = true
  try {
    const value = displayName.value.trim()
    await authStore.updateProfile(value)
    toast.success('Profile updated')
  } catch (err: any) {
    toast.error(err?.response?.data?.detail || 'Failed to update profile')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.profile-tab { display: flex; flex-direction: column; gap: var(--space-4); }

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

.form-field input[readonly] {
  opacity: 0.6;
  cursor: not-allowed;
}

.field-error { font-size: var(--font-xs); color: var(--c-error); }

.role-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: var(--font-xs);
  font-family: var(--font-mono);
}

.role-member { background: var(--c-badge-public-bg); color: var(--c-success); }
.role-admin { background: var(--c-badge-shared-bg); color: var(--c-warning); }

.member-since { font-size: 14px; color: var(--c-text); }
</style>
