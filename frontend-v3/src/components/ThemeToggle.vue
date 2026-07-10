<template>
  <button
    type="button"
    class="btn btn-icon"
    :title="theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'"
    @click="toggle"
  >
    <MoonIcon v-if="theme === 'light'" :size="18" />
    <SunIcon v-else :size="18" />
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
