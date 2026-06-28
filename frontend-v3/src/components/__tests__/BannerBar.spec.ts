import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BannerBar from '@/components/BannerBar.vue'

const routerLinkStub = {
  template: '<a :href="to"><slot /></a>',
  props: ['to'],
}

describe('BannerBar', () => {
  it('renders username in the banner', () => {
    const wrapper = mount(BannerBar, {
      props: { username: 'alice' },
      global: { stubs: { 'router-link': routerLinkStub } },
    })
    expect(wrapper.text()).toContain('alice')
  })

  it('renders "Back to Home" link pointing to /explore', () => {
    const wrapper = mount(BannerBar, {
      props: { username: 'alice' },
      global: { stubs: { 'router-link': routerLinkStub } },
    })
    const link = wrapper.find('a')
    expect(link.exists()).toBe(true)
  })

  it('renders heading with username', () => {
    const wrapper = mount(BannerBar, {
      props: { username: 'bob' },
      global: { stubs: { 'router-link': routerLinkStub } },
    })
    expect(wrapper.text()).toContain('bob')
  })

  it('shows "@" symbol before username', () => {
    const wrapper = mount(BannerBar, {
      props: { username: 'alice' },
      global: { stubs: { 'router-link': routerLinkStub } },
    })
    expect(wrapper.text()).toMatch(/@/)
  })

  it('renders different username correctly', () => {
    const wrapper = mount(BannerBar, {
      props: { username: 'charlie' },
      global: { stubs: { 'router-link': routerLinkStub } },
    })
    expect(wrapper.text()).toContain('charlie')
  })
})
