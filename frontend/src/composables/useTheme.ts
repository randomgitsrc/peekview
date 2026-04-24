// composables/useTheme.ts
import { ref, watch, onMounted, computed } from 'vue'

type Theme = 'dark' | 'light'

const STORAGE_KEY = 'peek-theme'

// Singleton state
const theme = ref<Theme>('dark')
const isReady = ref(false)

export function useTheme() {
  onMounted(() => {
    // Read from DOM (set by inline script in index.html)
    const current = document.documentElement.getAttribute('data-theme') as Theme
    theme.value = current || 'dark'
    isReady.value = true
  })

  watch(theme, (newTheme) => {
    document.documentElement.setAttribute('data-theme', newTheme)
    localStorage.setItem(STORAGE_KEY, newTheme)
  })

  function toggle() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }

  function set(newTheme: Theme) {
    theme.value = newTheme
  }

  /** Reset theme to default (for testing). */
  function _reset() {
    theme.value = 'dark'
    isReady.value = false
  }

  return {
    theme,
    isReady,
    isDark: computed(() => theme.value === 'dark'),
    toggle,
    set,
    _reset,
  }
}
