<template>
  <button
    type="button"
    class="theme-toggle"
    :title="theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'"
    @click="toggle"
  >
    <MoonIcon v-if="theme === 'light'" :size="18" class="theme-toggle-icon" />
    <SunIcon v-else :size="18" class="theme-toggle-icon" />
  </button>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useThemeStore } from '@/stores/theme'
import { Moon as MoonIcon, Sun as SunIcon } from 'lucide-vue-next'

const themeStore = useThemeStore()
const { theme } = storeToRefs(themeStore)
const { toggle } = themeStore
</script>

<style scoped>
.theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--c-border-strong);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--c-text);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.theme-toggle:hover {
  background: var(--c-border);
  border-color: var(--c-text-tertiary);
  color: var(--c-text);
}

.theme-toggle-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}
</style>
