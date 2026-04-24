import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, ref, computed, nextTick } from 'vue'
import ThemeToggle from '../ThemeToggle.vue'

// Create a proper mock that returns reactive refs
const createMockTheme = (isDarkValue: boolean) => {
  const theme = ref(isDarkValue ? 'dark' : 'light')
  const isDark = computed(() => theme.value === 'dark')
  const toggle = vi.fn(() => {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  })
  const set = vi.fn((newTheme: string) => {
    theme.value = newTheme as 'dark' | 'light'
  })
  return { theme, isDark, toggle, set, isReady: ref(true) }
}

// Mock useTheme before imports
const mockUseTheme = vi.fn()
vi.mock('../../composables/useTheme', () => ({
  useTheme: () => mockUseTheme(),
}))

describe('ThemeToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('TT1: renders theme toggle button', () => {
    mockUseTheme.mockReturnValue(createMockTheme(true))

    const wrapper = mount(ThemeToggle)

    expect(wrapper.find('.theme-toggle').exists()).toBe(true)
  })

  it('TT1: shows sun icon when dark mode', () => {
    mockUseTheme.mockReturnValue(createMockTheme(true))

    const wrapper = mount(ThemeToggle)

    const button = wrapper.find('.theme-toggle')
    expect(button.attributes('aria-label')).toBe('Switch to light theme')
    expect(button.attributes('title')).toBe('Switch to light')
  })

  it('TT1: shows moon icon when light mode', () => {
    mockUseTheme.mockReturnValue(createMockTheme(false))

    const wrapper = mount(ThemeToggle)

    const button = wrapper.find('.theme-toggle')
    expect(button.attributes('aria-label')).toBe('Switch to dark theme')
    expect(button.attributes('title')).toBe('Switch to dark')
  })

  it('TT2: toggles theme when clicked', async () => {
    const theme = createMockTheme(true)
    mockUseTheme.mockReturnValue(theme)

    const wrapper = mount(ThemeToggle)

    await wrapper.find('.theme-toggle').trigger('click')

    expect(theme.toggle).toHaveBeenCalledTimes(1)
  })

  it('TT2: has accessible attributes', () => {
    mockUseTheme.mockReturnValue(createMockTheme(true))

    const wrapper = mount(ThemeToggle)

    const button = wrapper.find('.theme-toggle')
    expect(button.attributes('aria-label')).toBeDefined()
    expect(button.attributes('title')).toBeDefined()
  })
})
