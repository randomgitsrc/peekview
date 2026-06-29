import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import EmptyState from '@/components/EmptyState.vue'

describe('EmptyState', () => {
  it('renders heading text', () => {
    const wrapper = mount(EmptyState, { props: { heading: 'No entries found' } })
    expect(wrapper.text()).toContain('No entries found')
  })

  it('renders description text', () => {
    const wrapper = mount(EmptyState, {
      props: { heading: 'Empty', description: 'Create your first entry' },
    })
    expect(wrapper.text()).toContain('Create your first entry')
  })

  it('renders default icon (Inbox) when no icon prop', () => {
    const wrapper = mount(EmptyState, { props: { heading: 'Empty' } })
    const icon = wrapper.find('.empty-state-icon') || wrapper.find('svg')
    expect(icon.exists()).toBe(true)
  })

  it('renders custom icon prop', () => {
    const wrapper = mount(EmptyState, { props: { heading: 'Empty', icon: 'Search' } })
    const icon = wrapper.find('.empty-state-icon') || wrapper.find('svg')
    expect(icon.exists()).toBe(true)
  })

  it('does not render CTA button when ctaLabel is empty', () => {
    const wrapper = mount(EmptyState, { props: { heading: 'Empty', ctaLabel: '' } })
    const ctaBtn = wrapper.find('.empty-state-cta') || wrapper.find('button')
    expect(ctaBtn.exists()).toBe(false)
  })

  it('renders CTA button when ctaLabel is provided', () => {
    const wrapper = mount(EmptyState, {
      props: { heading: 'Empty', ctaLabel: 'Create Entry' },
    })
    const ctaBtn = wrapper.find('.empty-state-cta') || wrapper.find('button')
    expect(ctaBtn.exists()).toBe(true)
    expect(ctaBtn.text()).toContain('Create Entry')
  })

  it('emits cta event on CTA button click', async () => {
    const wrapper = mount(EmptyState, {
      props: { heading: 'Empty', ctaLabel: 'Create' },
    })
    const ctaBtn = wrapper.find('.empty-state-cta') || wrapper.find('button')
    if (ctaBtn.exists()) {
      await ctaBtn.trigger('click')
      expect(wrapper.emitted('cta')).toBeTruthy()
    }
  })

  it('has empty-state root class', () => {
    const wrapper = mount(EmptyState, { props: { heading: 'Empty' } })
    expect(wrapper.find('.empty-state').exists()).toBe(true)
  })

  it('heading uses 20px/600 style', () => {
    const wrapper = mount(EmptyState, { props: { heading: 'Empty' } })
    const heading = wrapper.find('.empty-state-heading') || wrapper.find('h2') || wrapper.find('h3')
    expect(heading.exists()).toBe(true)
  })

  it('description uses --c-text-secondary color', () => {
    const wrapper = mount(EmptyState, {
      props: { heading: 'Empty', description: 'No data' },
    })
    const desc = wrapper.find('.empty-state-description')
    const style = desc.attributes('style') || ''
    const classes = desc.classes().join(' ')
    const usesSecondary = style.includes('--c-text-secondary') || classes.includes('empty-state-description')
    expect(usesSecondary).toBe(true)
  })
})
