<template>
  <Teleport to="body">
    <div class="toast-container">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="['toast', `toast-${toast.type}`]"
        >
          <Icon :icon="iconFor(toast.type)" class="toast-icon" />
          <span class="toast-message">{{ toast.message }}</span>
          <button class="toast-close" @click="remove(toast.id)">
            <Icon icon="codicon:close" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useToasts } from '../../composables/useToast'
import type { ToastType } from '../../types'

const { toasts } = useToasts()

function iconFor(type: ToastType): string {
  const icons: Record<ToastType, string> = {
    success: 'codicon:check',
    error: 'codicon:error',
    info: 'codicon:info',
  }
  return icons[type]
}

function remove(id: string) {
  const index = toasts.value.findIndex(t => t.id === id)
  if (index > -1) toasts.value.splice(index, 1)
}
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: var(--space-4);
  right: var(--space-4);
  z-index: var(--z-toast);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

@media (max-width: 768px) {
  .toast-container {
    top: auto;
    bottom: calc(var(--bottom-bar-height) + var(--space-4));
    left: var(--space-4);
    right: var(--space-4);
  }
}

.toast {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  min-width: 280px;
}

.toast-success {
  border-left: 3px solid var(--success-color);
}
.toast-error {
  border-left: 3px solid var(--error-color);
}
.toast-info {
  border-left: 3px solid var(--accent-color);
}

.toast-icon {
  font-size: 18px;
  flex-shrink: 0;
}
.toast-success .toast-icon { color: var(--success-color); }
.toast-error .toast-icon { color: var(--error-color); }
.toast-info .toast-icon { color: var(--accent-color); }

.toast-message {
  flex: 1;
  font-size: var(--font-sm);
}

.toast-close {
  background: none;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: var(--space-1);
}
.toast-close:hover {
  color: var(--text-primary);
}

/* Transitions */
.toast-enter-active,
.toast-leave-active {
  transition: all var(--transition-base);
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

@media (max-width: 768px) {
  .toast-enter-from,
  .toast-leave-to {
    transform: translateY(100%);
  }
}
</style>
