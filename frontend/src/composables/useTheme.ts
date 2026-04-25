// composables/useTheme.ts
import { ref, watch, onMounted, computed } from 'vue'

type Theme = 'dark' | 'light'

const STORAGE_KEY = 'peek-theme'

// Singleton state
const theme = ref<Theme>('dark')
const isReady = ref(false)

export function useTheme() {
  onMounted(() => {
    // Read from localStorage first (THEME-04: Theme persists)
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null
    if (saved) {
      theme.value = saved
      document.documentElement.setAttribute('data-theme', saved)
    } else {
      // Fall back to DOM attribute
      const current = document.documentElement.getAttribute('data-theme') as Theme
      theme.value = current || 'dark'
      // Save default to localStorage
      localStorage.setItem(STORAGE_KEY, theme.value)
    }
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
