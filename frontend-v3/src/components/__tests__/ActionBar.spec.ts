import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ActionBar from '@/components/ActionBar.vue'

function defaultProps(overrides: Record<string, unknown> = {}) {
  return {
    canCopy: false,
    canDownload: false,
    canWrap: false,
    canPack: false,
    wrap: false,
    variant: 'desktop' as const,
    ...overrides,
  }
}

describe('ActionBar', () => {
  describe('Copy button', () => {
    it('renders when canCopy is true', () => {
      const wrapper = mount(ActionBar, {
        props: defaultProps({ canCopy: true }),
      })
      expect(wrapper.text()).toContain('Copy')
    })

    it('does not render when canCopy is false', () => {
      const wrapper = mount(ActionBar, {
        props: defaultProps({ canCopy: false }),
      })
      expect(wrapper.text()).not.toContain('Copy')
    })

    it('emits copy on click', async () => {
      const wrapper = mount(ActionBar, {
        props: defaultProps({ canCopy: true }),
      })
      await wrapper.find('button').trigger('click')
      expect(wrapper.emitted('copy')).toBeTruthy()
    })
  })

  describe('Download link', () => {
    it('renders when canDownload and downloadUrl are set', () => {
      const wrapper = mount(ActionBar, {
        props: defaultProps({
          canDownload: true,
          downloadUrl: '/api/v1/files/1/download',
        }),
      })
      const link = wrapper.find('a[download]')
      expect(link.exists()).toBe(true)
      expect(link.text()).toContain('Download')
    })

    it('does not render when canDownload is false', () => {
      const wrapper = mount(ActionBar, {
        props: defaultProps({
          canDownload: false,
          downloadUrl: '/api/v1/files/1/download',
        }),
      })
      expect(wrapper.text()).not.toContain('Download')
    })

    it('does not render when downloadUrl is missing', () => {
      const wrapper = mount(ActionBar, {
        props: defaultProps({ canDownload: true, downloadUrl: undefined }),
      })
      expect(wrapper.text()).not.toContain('Download')
    })

    it('has correct href and download attributes', () => {
      const wrapper = mount(ActionBar, {
        props: defaultProps({
          canDownload: true,
          downloadUrl: '/api/v1/files/42/download',
        }),
      })
      const link = wrapper.find('a')
      expect(link.attributes('href')).toBe('/api/v1/files/42/download')
      expect(link.attributes('download')).toBe('')
    })
  })

  describe('Pack link', () => {
    it('renders when canPack and packUrl are set', () => {
      const wrapper = mount(ActionBar, {
        props: defaultProps({
          canPack: true,
          packUrl: '/api/v1/entries/test/pack',
        }),
      })
      expect(wrapper.text()).toContain('Pack')
    })

    it('does not render when canPack is false', () => {
      const wrapper = mount(ActionBar, {
        props: defaultProps({
          canPack: false,
          packUrl: '/api/v1/entries/test/pack',
        }),
      })
      expect(wrapper.text()).not.toContain('Pack')
    })

    it('does not render when packUrl is missing', () => {
      const wrapper = mount(ActionBar, {
        props: defaultProps({ canPack: true, packUrl: undefined }),
      })
      expect(wrapper.text()).not.toContain('Pack')
    })

    it('has correct href and download attributes', () => {
      const wrapper = mount(ActionBar, {
        props: defaultProps({
          canPack: true,
          packUrl: '/api/v1/entries/demo/pack',
        }),
      })
      const link = wrapper.find('a')
      expect(link.attributes('href')).toBe('/api/v1/entries/demo/pack')
      expect(link.attributes('download')).toBe('')
    })
  })

  describe('Wrap button', () => {
    it('renders when canWrap is true', () => {
      const wrapper = mount(ActionBar, {
        props: defaultProps({ canWrap: true }),
      })
      expect(wrapper.text()).toContain('Wrap')
    })

    it('does not render when canWrap is false', () => {
      const wrapper = mount(ActionBar, {
        props: defaultProps({ canWrap: false }),
      })
      expect(wrapper.text()).not.toContain('Wrap')
    })

    it('has active class when wrap is true', () => {
      const wrapper = mount(ActionBar, {
        props: defaultProps({ canWrap: true, wrap: true }),
      })
      const buttons = wrapper.findAll('button')
      const wrapButton = buttons.find(b => b.text().includes('Wrap'))
      expect(wrapButton!.classes()).toContain('active')
    })

    it('does not have active class when wrap is false', () => {
      const wrapper = mount(ActionBar, {
        props: defaultProps({ canWrap: true, wrap: false }),
      })
      const buttons = wrapper.findAll('button')
      const wrapButton = buttons.find(b => b.text().includes('Wrap'))
      expect(wrapButton!.classes()).not.toContain('active')
    })

    it('emits toggle-wrap on click', async () => {
      const wrapper = mount(ActionBar, {
        props: defaultProps({ canWrap: true }),
      })
      const buttons = wrapper.findAll('button')
      const wrapButton = buttons.find(b => b.text().includes('Wrap'))
      await wrapButton!.trigger('click')
      expect(wrapper.emitted('toggle-wrap')).toBeTruthy()
    })
  })

  describe('variant: desktop', () => {
    it('copy button has btn-secondary class', () => {
      const wrapper = mount(ActionBar, {
        props: defaultProps({ canCopy: true, variant: 'desktop' }),
      })
      expect(wrapper.find('button').classes()).toContain('btn-secondary')
    })

    it('wrap button has btn-secondary when not active', () => {
      const wrapper = mount(ActionBar, {
        props: defaultProps({ canWrap: true, wrap: false, variant: 'desktop' }),
      })
      const buttons = wrapper.findAll('button')
      const wrapButton = buttons.find(b => b.text().includes('Wrap'))
      expect(wrapButton!.classes()).toContain('btn-secondary')
    })

    it('wrap button does not have btn-secondary when active', () => {
      const wrapper = mount(ActionBar, {
        props: defaultProps({ canWrap: true, wrap: true, variant: 'desktop' }),
      })
      const buttons = wrapper.findAll('button')
      const wrapButton = buttons.find(b => b.text().includes('Wrap'))
      expect(wrapButton!.classes()).not.toContain('btn-secondary')
    })

    it('download link has btn-secondary class', () => {
      const wrapper = mount(ActionBar, {
        props: defaultProps({
          canDownload: true,
          downloadUrl: '/dl',
          variant: 'desktop',
        }),
      })
      expect(wrapper.find('a').classes()).toContain('btn-secondary')
    })
  })

  describe('variant: mobile', () => {
    it('hides btn-secondary class on copy button', () => {
      const wrapper = mount(ActionBar, {
        props: defaultProps({ canCopy: true, variant: 'mobile' }),
      })
      expect(wrapper.find('button').classes()).not.toContain('btn-secondary')
    })

    it('shows emoji in copy button', () => {
      const wrapper = mount(ActionBar, {
        props: defaultProps({ canCopy: true, variant: 'mobile' }),
      })
      expect(wrapper.find('button').text()).toContain('📋')
    })

    it('shows emoji in download link', () => {
      const wrapper = mount(ActionBar, {
        props: defaultProps({
          canDownload: true,
          downloadUrl: '/dl',
          variant: 'mobile',
        }),
      })
      expect(wrapper.find('a').text()).toContain('⬇️')
    })

    it('shows emoji in pack link', () => {
      const wrapper = mount(ActionBar, {
        props: defaultProps({
          canPack: true,
          packUrl: '/pack',
          variant: 'mobile',
        }),
      })
      expect(wrapper.find('a').text()).toContain('📦')
    })

    it('shows emoji in wrap button', () => {
      const wrapper = mount(ActionBar, {
        props: defaultProps({ canWrap: true, variant: 'mobile' }),
      })
      const buttons = wrapper.findAll('button')
      const wrapButton = buttons.find(b => b.text().includes('Wrap'))
      expect(wrapButton!.text()).toContain('↩️')
    })
  })

  describe('default rendering state', () => {
    it('renders empty action bar when all booleans are false', () => {
      const wrapper = mount(ActionBar, {
        props: defaultProps(),
      })
      expect(wrapper.find('button').exists()).toBe(false)
      expect(wrapper.find('a').exists()).toBe(false)
    })

    it('renders multiple controls simultaneously', () => {
      const wrapper = mount(ActionBar, {
        props: defaultProps({
          canCopy: true,
          canDownload: true,
          downloadUrl: '/dl',
          canWrap: true,
          canPack: true,
          packUrl: '/pack',
        }),
      })
      const buttons = wrapper.findAll('button')
      const links = wrapper.findAll('a')
      expect(buttons.length + links.length).toBe(4)
    })
  })
})
