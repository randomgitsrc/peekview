<template>
  <button
    class="theme-toggle"
    @click="toggle"
    :aria-label="isDark ? 'Switch to light theme' : 'Switch to dark theme'"
    :title="isDark ? 'Switch to light' : 'Switch to dark'"
  >
    <Icon :icon="isDark ? 'codicon:sun' : 'codicon:moon'" />
  </button>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useTheme } from '../composables/useTheme'

const { isDark, toggle } = useTheme()
</script>

<style scoped>
.theme-toggle {
  background: none;
  border: 1px solid var(--border-color);
  border-radius: 50%;
  width: 32px;
  height: 32px;
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  transition: color var(--transition-fast), border-color var(--transition-fast);
}

.theme-toggle:hover {
  color: var(--text-primary);
  border-color: var(--text-secondary);
}

.theme-toggle:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}
</style>
