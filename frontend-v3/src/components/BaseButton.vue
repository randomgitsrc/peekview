<template>
  <button
    :type="type"
    :disabled="disabled"
    :class="[
      'base-button',
      `btn-${variant}`,
      `btn-${size === 'small' ? 'small' : 'default'}`,
      { 'btn-disabled': disabled, 'btn-focus-ring': true },
    ]"
    @click="disabled ? null : $emit('click', $event)"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'default' | 'small'
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
}>(), {
  variant: 'secondary',
  size: 'default',
  disabled: false,
  type: 'button',
})

defineEmits<{
  click: [e: MouseEvent]
}>()
</script>

<style scoped>
.base-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border: 1px solid transparent;
  border-radius: var(--radius-lg);
  font-size: var(--font-sm);
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.btn-default {
  height: 40px;
  padding: 0 18px;
}

.btn-small {
  height: 34px;
  padding: 0 14px;
  font-size: 13px;
}

.btn-primary {
  background: var(--c-accent);
  color: #fff;
  border-color: var(--c-accent);
  box-shadow: 0 6px 20px var(--c-glow);
}

.btn-primary:hover {
  background: var(--c-accent-secondary);
  border-color: var(--c-accent-secondary);
}

.btn-secondary {
  background: transparent;
  color: var(--c-text);
  border-color: var(--c-border-strong);
}

.btn-secondary:hover {
  background: var(--c-border);
  border-color: var(--c-text-tertiary);
}

.btn-ghost {
  background: transparent;
  color: var(--c-text);
  border-color: transparent;
}

.btn-ghost:hover {
  background: var(--c-border);
}

.btn-danger {
  background: var(--c-error);
  color: #fff;
  border-color: var(--c-error);
}

.btn-danger:hover {
  filter: brightness(0.9);
}

.btn-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-focus-ring:focus-visible {
  outline: 2px solid var(--c-accent-secondary);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .base-button {
    transition: none;
  }
}
</style>
