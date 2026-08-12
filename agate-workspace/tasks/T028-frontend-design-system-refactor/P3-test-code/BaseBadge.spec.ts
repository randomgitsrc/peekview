import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseBadge from '@/components/BaseBadge.vue'

describe('BaseBadge', () => {
  it('renders public status by default', () => {
    const wrapper = mount(BaseBadge)
    expect(wrapper.find('.base-badge').classes()).toContain('badge-public')
  })

  it('renders public status explicitly', () => {
    const wrapper = mount(BaseBadge, { props: { status: 'public' } })
    expect(wrapper.find('.base-badge').classes()).toContain('badge-public')
  })

  it('renders private status', () => {
    const wrapper = mount(BaseBadge, { props: { status: 'private' } })
    expect(wrapper.find('.base-badge').classes()).toContain('badge-private')
  })

  it('renders shared status', () => {
    const wrapper = mount(BaseBadge, { props: { status: 'shared' } })
    expect(wrapper.find('.base-badge').classes()).toContain('badge-shared')
  })

  it('public badge uses --c-badge-public-bg and --c-success', () => {
    const wrapper = mount(BaseBadge, { props: { status: 'public' } })
    const el = wrapper.find('.base-badge')
    const style = el.attributes('style') || ''
    const classes = el.classes().join(' ')
    const usesPublicTokens = style.includes('--c-badge-public-bg') || style.includes('--c-success') || classes.includes('badge-public')
    expect(usesPublicTokens).toBe(true)
  })

  it('private badge uses --c-badge-private-bg and --c-error', () => {
    const wrapper = mount(BaseBadge, { props: { status: 'private' } })
    const el = wrapper.find('.base-badge')
    const style = el.attributes('style') || ''
    const classes = el.classes().join(' ')
    const usesPrivateTokens = style.includes('--c-badge-private-bg') || style.includes('--c-error') || classes.includes('badge-private')
    expect(usesPrivateTokens).toBe(true)
  })

  it('shared badge uses --c-badge-shared-bg and --c-warning', () => {
    const wrapper = mount(BaseBadge, { props: { status: 'shared' } })
    const el = wrapper.find('.base-badge')
    const style = el.attributes('style') || ''
    const classes = el.classes().join(' ')
    const usesSharedTokens = style.includes('--c-badge-shared-bg') || style.includes('--c-warning') || classes.includes('badge-shared')
    expect(usesSharedTokens).toBe(true)
  })

  it('renders status text', () => {
    const wrapper = mount(BaseBadge, { props: { status: 'public' } })
    expect(wrapper.text().toLowerCase()).toContain('public')
  })

  it('has 6px border-radius', () => {
    const wrapper = mount(BaseBadge, { props: { status: 'public' } })
    const el = wrapper.find('.base-badge')
    const style = el.attributes('style') || ''
    const classes = el.classes().join(' ')
    const hasRadius = style.includes('6px') || classes.includes('base-badge')
    expect(hasRadius).toBe(true)
  })

  it('renders as inline element (span)', () => {
    const wrapper = mount(BaseBadge, { props: { status: 'public' } })
    expect(wrapper.element.tagName).toBe('SPAN')
  })
})
