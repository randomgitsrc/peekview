import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ActionBar from '../ActionBar.vue'

// Mock the theme composable
vi.mock('../../composables/useTheme', () => ({
  useTheme: () => ({
    theme: { value: 'dark' },
    toggleTheme: vi.fn()
  })
}))

describe('ActionBar', () => {
  it('renders copy button when canCopy is true', () => {
    const wrapper = mount(ActionBar, {
      props: { canCopy: true, content: 'test', isMobile: false }
    })
    expect(wrapper.text()).toContain('Copy')
  })

  it('emits toggleWrap when wrap button clicked', async () => {
    const wrapper = mount(ActionBar, {
      props: { canWrap: true, wrap: false, isMobile: false }
    })
    const wrapBtn = wrapper.findAll('.action-btn').find(b => b.text().includes('Wrap'))
    if (wrapBtn) {
      await wrapBtn.trigger('click')
      expect(wrapper.emitted()).toHaveProperty('toggleWrap')
    }
  })

  it('renders mobile layout when isMobile is true', () => {
    const wrapper = mount(ActionBar, {
      props: { canCopy: true, isMobile: true }
    })
    expect(wrapper.find('.action-bar').classes()).toContain('is-mobile')
  })
})
