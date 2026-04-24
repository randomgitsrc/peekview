<template>
  <button
    :class="['btn', `btn-${variant}`, { 'btn-icon': iconOnly }]"
    :disabled="disabled || loading"
    @click="$emit('click', $event)"
  >
    <Icon v-if="loading" icon="codicon:loading" class="animate-spin" />
    <Icon v-else-if="icon" :icon="icon" />
    <slot />
  </button>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { ButtonVariant } from '../../types'

interface Props {
  variant?: ButtonVariant
  icon?: string
  iconOnly?: boolean
  disabled?: boolean
  loading?: boolean
}

defineProps<Props>()
defineEmits<{ click: [e: MouseEvent] }>()
</script>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  height: 32px;
  padding: 0 var(--space-3);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
  background: transparent;
  color: var(--text-primary);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}

.btn:active:not(:disabled) {
  transform: scale(0.96);
}

.btn-primary {
  background: var(--accent-color);
  color: var(--text-on-accent);
}
.btn-primary:hover:not(:disabled) {
  background: var(--accent-hover);
}

.btn-secondary {
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}
.btn-secondary:hover:not(:disabled) {
  background: var(--bg-tertiary);
  border-color: var(--border-hover);
  color: var(--text-primary);
}

.btn-ghost {
  color: var(--text-secondary);
}
.btn-ghost:hover:not(:disabled) {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.btn-icon {
  width: 32px;
  height: 32px;
  padding: 0;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
