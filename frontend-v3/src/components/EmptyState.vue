<template>
  <div class="empty-state">
    <div class="empty-state-icon">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline v-if="icon === 'Inbox'" points="22 12 16 12 14 15 10 15 8 12 2 12" />
        <path v-if="icon === 'Inbox'" d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        <circle v-if="icon === 'Search'" cx="11" cy="11" r="8" />
        <line v-if="icon === 'Search'" x1="21" y1="21" x2="16.65" y2="16.65" />
        <path v-if="icon === 'FileX'" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline v-if="icon === 'FileX'" points="14 2 14 8 20 8" />
        <line v-if="icon === 'FileX'" x1="9" y1="15" x2="15" y2="15" />
        <path v-if="icon === 'FolderX'" d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        <line v-if="icon === 'FolderX'" x1="9" y1="14" x2="15" y2="14" />
        <ellipse v-if="icon === 'Database'" cx="12" cy="5" rx="9" ry="3" />
        <path v-if="icon === 'Database'" d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
        <path v-if="icon === 'Database'" d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        <circle v-if="icon === 'AlertCircle'" cx="12" cy="12" r="10" />
        <line v-if="icon === 'AlertCircle'" x1="12" y1="8" x2="12" y2="12" />
        <line v-if="icon === 'AlertCircle'" x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    </div>
    <h3 v-if="heading" class="empty-state-heading">{{ heading }}</h3>
    <p v-if="description" class="empty-state-description">{{ description }}</p>
    <BaseButton
      v-if="ctaLabel"
      variant="primary"
      class="empty-state-cta"
      @click="$emit('cta')"
    >
      {{ ctaLabel }}
    </BaseButton>
  </div>
</template>

<script setup lang="ts">
import BaseButton from '@/components/BaseButton.vue'

withDefaults(defineProps<{
  icon?: string
  heading?: string
  description?: string
  ctaLabel?: string
}>(), {
  icon: 'Inbox',
  heading: undefined,
  description: '',
  ctaLabel: '',
})

defineEmits<{
  cta: []
}>()
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  max-width: 480px;
  margin: 0 auto;
  padding: var(--space-7) var(--space-4);
}

.empty-state-icon {
  color: var(--c-text-tertiary);
  margin-bottom: var(--space-5);
}

.empty-state-heading {
  font-size: var(--font-lg);
  font-weight: 600;
  color: var(--c-text);
  margin: 0 0 var(--space-2);
}

.empty-state-description {
  font-size: var(--font-sm);
  color: var(--c-text-secondary);
  line-height: 1.6;
  margin: 0 0 var(--space-5);
}

.empty-state-cta {
  margin-top: var(--space-2);
}
</style>
