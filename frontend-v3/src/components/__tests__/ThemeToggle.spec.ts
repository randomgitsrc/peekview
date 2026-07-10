import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import ThemeToggle from '@/components/ThemeToggle.vue'

const mocks = vi.hoisted(() => ({
  toggle: vi.fn(),
  currentTheme: 'light' as 'light' | 'dark',
}))

vi.mock('@/stores/theme', () => ({
  useThemeStore: () => ({
    theme: ref(mocks.currentTheme),
    toggle: mocks.toggle,
  }),
  storeToRefs: (store: any) => ({ theme: store.theme }),
}))

describe('ThemeToggle', () => {
  beforeEach(() => {
    mocks.toggle.mockReset()
  })

  it('light 模式显示 SVG icon', () => {
    mocks.currentTheme = 'light'
    const wrapper = mount(ThemeToggle)
    expect(wrapper.find('button').html()).toContain('<svg')
  })

  it('dark 模式显示 SVG icon', () => {
    mocks.currentTheme = 'dark'
    const wrapper = mount(ThemeToggle)
    expect(wrapper.find('button').html()).toContain('<svg')
  })

  it('点击 button 调用 toggle', async () => {
    const wrapper = mount(ThemeToggle)
    await wrapper.find('button').trigger('click')
    expect(mocks.toggle).toHaveBeenCalledTimes(1)
  })

  it('light 模式 title 是 "Switch to dark mode"', () => {
    mocks.currentTheme = 'light'
    const wrapper = mount(ThemeToggle)
    expect(wrapper.find('button').attributes('title')).toBe('Switch to dark mode')
  })

  it('dark 模式 title 是 "Switch to light mode"', () => {
    mocks.currentTheme = 'dark'
    const wrapper = mount(ThemeToggle)
    expect(wrapper.find('button').attributes('title')).toBe('Switch to light mode')
  })
})
