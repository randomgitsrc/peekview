import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import { useTheme } from '../useTheme'

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
})

describe('useTheme', () => {
  beforeEach(() => {
    // Reset DOM
    document.documentElement.setAttribute('data-theme', 'dark')
    localStorageMock.getItem.mockReturnValue(null)
    localStorageMock.setItem.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
    // Reset theme singleton after each test
    const { _reset } = useTheme()
    _reset()
  })

  it('CT1: reads initial theme from DOM data-theme attribute', async () => {
    document.documentElement.setAttribute('data-theme', 'light')

    const TestComponent = defineComponent({
      setup() {
        const result = useTheme()
        return { result }
      },
      template: '<div>{{ result.theme }}</div>',
    })

    const wrapper = mount(TestComponent)
    await flushPromises()

    expect(wrapper.vm.result.theme.value).toBe('light')
  })

  it('CT1: defaults to dark if no data-theme attribute', async () => {
    document.documentElement.removeAttribute('data-theme')

    const TestComponent = defineComponent({
      setup() {
        const result = useTheme()
        return { result }
      },
      template: '<div>{{ result.theme }}</div>',
    })

    const wrapper = mount(TestComponent)
    await flushPromises()

    expect(wrapper.vm.result.theme.value).toBe('dark')
  })

  it('CT2: toggle switches from dark to light', async () => {
    const TestComponent = defineComponent({
      setup() {
        const result = useTheme()
        return { result }
      },
      template: '<div>{{ result.theme }}</div>',
    })

    const wrapper = mount(TestComponent)
    await flushPromises()

    // Should start as dark
    expect(wrapper.vm.result.theme.value).toBe('dark')

    // Trigger the actual toggle function
    wrapper.vm.result.toggle()
    await nextTick()

    expect(wrapper.vm.result.theme.value).toBe('light')
    expect(wrapper.vm.result.isDark.value).toBe(false)
  })

  it('CT2: toggle switches from light to dark', async () => {
    const TestComponent = defineComponent({
      setup() {
        const result = useTheme()
        // Start with light theme
        result.set('light')
        return { result }
      },
      template: '<div>{{ result.theme }}</div>',
    })

    const wrapper = mount(TestComponent)
    await flushPromises()

    // Should start as light
    expect(wrapper.vm.result.theme.value).toBe('light')

    // Trigger the actual toggle function
    wrapper.vm.result.toggle()
    await nextTick()

    expect(wrapper.vm.result.theme.value).toBe('dark')
    expect(wrapper.vm.result.isDark.value).toBe(true)
  })

  it('CT3: set changes theme directly', async () => {
    const TestComponent = defineComponent({
      setup() {
        const result = useTheme()
        return { result }
      },
      template: '<div>{{ result.theme }}</div>',
    })

    const wrapper = mount(TestComponent)
    await flushPromises()

    wrapper.vm.result.set('light')
    await nextTick()

    expect(wrapper.vm.result.theme.value).toBe('light')
  })

  it('CT4: isDark is computed property that reflects theme', async () => {
    const TestComponent = defineComponent({
      setup() {
        const result = useTheme()
        return { result }
      },
      template: '<div>{{ result.theme }}</div>',
    })

    const wrapper = mount(TestComponent)
    await flushPromises()

    wrapper.vm.result.theme.value = 'dark'
    await nextTick()
    expect(wrapper.vm.result.isDark.value).toBe(true)

    wrapper.vm.result.theme.value = 'light'
    await nextTick()
    expect(wrapper.vm.result.isDark.value).toBe(false)
  })
})
