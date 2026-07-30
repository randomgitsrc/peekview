<template>
  <div v-if="isExpiredButActive" class="expired-warning-banner">
    <span class="expired-warning-text">此条目已过期，等待清理</span>
    <button v-if="isOwner" class="expired-edit-btn" @click="$emit('show-expires-in-dialog')">重新设置过期时间</button>
  </div>
  <div v-if="isArchived" class="archived-banner">
    <span class="archived-banner-text">This entry has expired</span>
    <button v-if="isOwner" class="reactivate-btn" @click="$emit('show-expires-in-dialog')">Reactivate</button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  isExpiredButActive: boolean
  isArchived: boolean
  isOwner: boolean
}>()

defineEmits<{
  'show-expires-in-dialog': []
}>()
</script>

<style scoped>
.expired-warning-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--c-warning-surface);
  border-bottom: 1px solid var(--c-warning);
  width: 100%;
}

.expired-warning-text {
  font-size: var(--font-sm);
  color: var(--c-warning);
  font-weight: 600;
}

.expired-edit-btn {
  padding: var(--space-1) var(--space-3);
  background: var(--c-accent);
  color: var(--text-on-accent);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-sm);
  font-weight: 600;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}

.expired-edit-btn:hover {
  opacity: 0.9;
}

.archived-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--c-error-surface);
  border-bottom: 1px solid var(--c-error);
  width: 100%;
}

.archived-banner-text {
  font-size: var(--font-sm);
  color: var(--c-error);
  font-weight: 600;
}

.reactivate-btn {
  padding: var(--space-1) var(--space-3);
  background: var(--c-accent);
  color: var(--text-on-accent);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-sm);
  font-weight: 600;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}

.reactivate-btn:hover {
  opacity: 0.9;
}
</style>
