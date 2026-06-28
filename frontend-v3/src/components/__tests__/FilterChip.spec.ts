import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FilterChip from '@/components/FilterChip.vue'

describe('FilterChip', () => {
  it('renders the label text', () => {
    const wrapper = mount(FilterChip, {
      props: { label: '@alice' },
    })
    expect(wrapper.text()).toContain('@alice')
  })

  it('renders a dismiss button', () => {
    const wrapper = mount(FilterChip, {
      props: { label: '@alice' },
    })
    const dismissBtn = wrapper.find('button')
    expect(dismissBtn.exists()).toBe(true)
  })

  it('emits dismiss event when close button is clicked', async () => {
    const wrapper = mount(FilterChip, {
      props: { label: '@alice' },
    })
    const dismissBtn = wrapper.find('button')
    await dismissBtn.trigger('click')
    expect(wrapper.emitted('dismiss')).toBeTruthy()
    expect(wrapper.emitted('dismiss')!.length).toBe(1)
  })

  it('renders with custom label', () => {
    const wrapper = mount(FilterChip, {
      props: { label: '@bob' },
    })
    expect(wrapper.text()).toContain('@bob')
  })

  it('has pill-style root element', () => {
    const wrapper = mount(FilterChip, {
      props: { label: '@alice' },
    })
    const root = wrapper.find('.filter-chip')
    // After P4 implementation, root should have .filter-chip class
    expect(root.exists()).toBe(true)
  })

  it('close button has aria-label for accessibility', () => {
    const wrapper = mount(FilterChip, {
      props: { label: '@alice' },
    })
    const dismissBtn = wrapper.find('button')
    // After P4: button should have aria-label="Remove filter"
    const ariaLabel = dismissBtn.attributes('aria-label')
    expect(ariaLabel).toBeDefined()
  })
})
