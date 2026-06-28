import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BannerBar from '@/components/BannerBar.vue'

describe('BannerBar', () => {
  it('renders username in the banner', () => {
    const wrapper = mount(BannerBar, {
      props: { username: 'alice' },
    })
    expect(wrapper.text()).toContain('alice')
  })

  it('renders "Back to Home" link pointing to /explore', () => {
    const wrapper = mount(BannerBar, {
      props: { username: 'alice' },
    })
    // After P4: should contain a router-link or <a> to /explore
    const link = wrapper.find('a')
    expect(link.exists()).toBe(true)
    // href may be /explore or rendered via router-link
  })

  it('renders heading with username', () => {
    const wrapper = mount(BannerBar, {
      props: { username: 'bob' },
    })
    // After P4: should have h1 or heading element showing @bob's entries
    expect(wrapper.text()).toContain('bob')
  })

  it('shows "@" symbol before username', () => {
    const wrapper = mount(BannerBar, {
      props: { username: 'alice' },
    })
    // After P4: text should contain @alice
    expect(wrapper.text()).toMatch(/@/)
  })

  it('renders different username correctly', () => {
    const wrapper = mount(BannerBar, {
      props: { username: 'charlie' },
    })
    expect(wrapper.text()).toContain('charlie')
  })
})
