<template>
  <div class="toast-container">
    <TransitionGroup name="toast">
      <div
        v-for="toast in messages"
        :key="toast.id"
        :class="['toast', `toast--${toast.variant}`]"
        role="status"
        :aria-live="toast.variant === 'error' ? 'assertive' : 'polite'"
      >
        <span class="toast__message">{{ toast.message }}</span>
        <a
          v-if="toast.action"
          :href="toast.action.to"
          class="toast__action"
          data-testid="star-toast-action"
        >{{ toast.action.label }}</a>
        <button class="toast__close" @click="remove(toast.id)" aria-label="Dismiss">&times;</button>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { useToast } from '@/composables/useToast'

const { messages, remove } = useToast()
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 400px;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  pointer-events: auto;
  animation: slideDown 0.3s ease;
}

.toast--success {
  background: var(--success-bg);
  color: var(--success-text);
  border: 1px solid var(--success-border);
}

.toast--warning {
  background: var(--warning-bg);
  color: var(--warning-text);
  border: 1px solid var(--warning-border);
}

.toast--error {
  background: var(--error-bg);
  color: var(--error-text);
  border: 1px solid var(--error-border);
}

.toast__message {
  flex: 1;
}

.toast__close {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 18px;
  padding: 0 4px;
  opacity: 0.7;
}

.toast__close:hover {
  opacity: 1;
}

.toast__action {
  flex-shrink: 0;
  color: inherit;
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
}

.toast__action:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}

.toast-enter-active { transition: all 0.3s ease; }
.toast-leave-active { transition: all 0.3s ease; }
.toast-enter-from { opacity: 0; transform: translateY(-16px); }
.toast-leave-to { opacity: 0; transform: translateY(-16px); }

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-16px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>