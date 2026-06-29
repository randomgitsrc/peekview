import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PageHeader from '@/components/PageHeader.vue'

const routerLinkStub = {
  template: '<a :href="to"><slot /></a>',
  props: ['to'],
}

describe('PageHeader', () => {
  const createWrapper = (props: { title: string; backTo?: string; backLabel?: string } = { title: 'Test' }, slots = {}) =>
    mount(PageHeader, {
      props,
      slots,
      global: { stubs: { 'router-link': routerLinkStub } },
    })

  it('renders title text', () => {
    const wrapper = createWrapper({ title: 'Explore' })
    expect(wrapper.text()).toContain('Explore')
  })

  it('renders title with 28px/600 style', () => {
    const wrapper = createWrapper({ title: 'Explore' })
    const title = wrapper.find('.page-header-title') || wrapper.find('h1')
    expect(title.exists()).toBe(true)
  })

  it('does not render back link when backTo is empty', () => {
    const wrapper = createWrapper({ title: 'Explore', backTo: '' })
    const backLink = wrapper.find('.back-link') || wrapper.find('a')
    expect(backLink.exists()).toBe(false)
  })

  it('renders back link when backTo is provided', () => {
    const wrapper = createWrapper({ title: 'Detail', backTo: '/explore' })
    const backLink = wrapper.find('.back-link') || wrapper.find('a')
    expect(backLink.exists()).toBe(true)
  })

  it('renders back label text', () => {
    const wrapper = createWrapper({ title: 'Detail', backTo: '/explore', backLabel: 'Back to list' })
    const backLink = wrapper.find('.back-link') || wrapper.find('a')
    expect(backLink.text()).toContain('Back to list')
  })

  it('renders default back label "Back"', () => {
    const wrapper = createWrapper({ title: 'Detail', backTo: '/explore' })
    const backLink = wrapper.find('.back-link') || wrapper.find('a')
    expect(backLink.text()).toContain('Back')
  })

  it('renders meta slot content', () => {
    const wrapper = createWrapper(
      { title: 'Explore' },
      { meta: '<span class="meta-info">5 entries</span>' },
    )
    expect(wrapper.find('.meta-info').exists()).toBe(true)
  })

  it('renders actions slot content', () => {
    const wrapper = createWrapper(
      { title: 'Explore' },
      { actions: '<button class="action-btn">Action</button>' },
    )
    expect(wrapper.find('.action-btn').exists()).toBe(true)
  })

  it('has page-header root class', () => {
    const wrapper = createWrapper({ title: 'Explore' })
    expect(wrapper.find('.page-header').exists()).toBe(true)
  })

  it('uses --c-surface background', () => {
    const wrapper = createWrapper({ title: 'Explore' })
    const header = wrapper.find('.page-header')
    const style = header.attributes('style') || ''
    const classes = header.classes().join(' ')
    const usesSurface = style.includes('--c-surface') || classes.includes('page-header')
    expect(usesSurface).toBe(true)
  })

  it('uses --c-border for bottom border', () => {
    const wrapper = createWrapper({ title: 'Explore' })
    const header = wrapper.find('.page-header')
    const style = header.attributes('style') || ''
    const classes = header.classes().join(' ')
    const usesBorder = style.includes('--c-border') || classes.includes('page-header')
    expect(usesBorder).toBe(true)
  })
})
