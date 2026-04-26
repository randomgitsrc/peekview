import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import type { Theme } from '@/types'

const STORAGE_KEY = 'peekview-theme'

function getInitialTheme(): Theme {
  // Check localStorage first
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'light' || saved === 'dark') {
    return saved
  }

  // Fall back to system preference
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }

  return 'light'
}

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)
}

export const useThemeStore = defineStore('theme', () => {
  // State
  const theme = ref<Theme>(getInitialTheme())

  // Apply initial theme
  applyTheme(theme.value)

  // Actions
  function setTheme(newTheme: Theme): void {
    theme.value = newTheme
    applyTheme(newTheme)
  }

  function toggle(): void {
    const newTheme = theme.value === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
  }

  // Watch for theme changes and persist to localStorage
  watch(theme, (newTheme) => {
    localStorage.setItem(STORAGE_KEY, newTheme)
  })

  // Listen for system theme changes (only auto-switch if no saved preference)
  if (window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', (e) => {
      // Only auto-switch if user hasn't explicitly set a preference
      const saved = localStorage.getItem(STORAGE_KEY)
      if (!saved) {
        setTheme(e.matches ? 'dark' : 'light')
      }
    })
  }

  return {
    theme,
    setTheme,
    toggle,
  }
})
