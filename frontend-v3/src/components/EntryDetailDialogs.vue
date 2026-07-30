<template>
  <ConfirmDialog
    v-model:visible="showConfirmDeleteModel"
    title="Delete Entry"
    :message="deleteMessage"
    confirm-label="Delete"
    variant="destructive"
    @confirm="$emit('confirm-delete')"
    @cancel="$emit('cancel-delete')"
  />

  <ExpiresInDialog
    v-model:visible="showExpiresInDialogModel"
    :entry-slug="slug"
    :is-archived="isArchived"
    @updated="$emit('expires-in-updated')"
  />

  <LoginDialog v-model:visible="showLoginModel" :allow-registration="true" />

  <div v-if="isShareAccess" class="share-watermark">
    Shared by @{{ sharedBy }}
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import ExpiresInDialog from '@/components/ExpiresInDialog.vue'
import LoginDialog from '@/components/LoginDialog.vue'

const props = defineProps<{
  showConfirmDelete: boolean
  deleteMessage: string
  showExpiresInDialog: boolean
  showLogin: boolean
  isShareAccess: boolean
  slug: string
  isArchived: boolean
  sharedBy: string | null
}>()

const emit = defineEmits<{
  'update:show-confirm-delete': [value: boolean]
  'confirm-delete': []
  'cancel-delete': []
  'update:show-expires-in-dialog': [value: boolean]
  'expires-in-updated': []
  'update:show-login': [value: boolean]
}>()

const showConfirmDeleteModel = computed({
  get: () => props.showConfirmDelete,
  set: (v: boolean) => emit('update:show-confirm-delete', v),
})

const showExpiresInDialogModel = computed({
  get: () => props.showExpiresInDialog,
  set: (v: boolean) => emit('update:show-expires-in-dialog', v),
})

const showLoginModel = computed({
  get: () => props.showLogin,
  set: (v: boolean) => emit('update:show-login', v),
})
</script>

<style scoped>
.share-watermark {
  position: fixed;
  bottom: 16px;
  right: 16px;
  background: var(--c-surface);
  color: var(--c-text-secondary);
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 12px;
  z-index: 9999;
  pointer-events: none;
  user-select: none;
}
</style>
