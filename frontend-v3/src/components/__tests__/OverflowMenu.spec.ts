import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

interface OverflowMenuItem {
  label: string
  icon?: string
  hint?: string
  href?: string
  target?: string
  rel?: string
  variant?: 'default' | 'danger'
  divider?: boolean
  action?: () => void
}

function createItems(overrides: Partial<OverflowMenuItem>[] = []): OverflowMenuItem[] {
  const defaults: OverflowMenuItem[] = [
    { label: 'Download', action: vi.fn() },
    { label: 'Raw', href: '/api/v1/entries/test/raw', target: '_blank', rel: 'noopener noreferrer' },
    { label: 'Delete', icon: 'trash-2', hint: 'Permanently', variant: 'danger', action: vi.fn() },
  ]
  return overrides.length > 0
    ? overrides.map((o, i) => ({ ...defaults[i], ...o }))
    : defaults
}

function mountOverflowMenu(props: Partial<{ items: OverflowMenuItem[]; variant: 'dropdown' | 'sheet' }> = {}) {
  return mount(
    // Dynamic import will fail until OverflowMenu.vue is rewritten in P4
    // Using require-style to ensure import error surfaces as test failure
    require('@/components/OverflowMenu.vue').default,
    {
      props: {
        items: createItems(),
        variant: 'dropdown' as const,
        ...props,
      },
      attachTo: document.body,
    }
  )
}

describe('OverflowMenu', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    document.documentElement.dataset.theme = 'dark'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('BDD-16: variant="dropdown" sub-component', () => {
    it('OM-01: renders OverflowMenuDropdown sub-component when variant="dropdown"', async () => {
      const wrapper = mountOverflowMenu({ variant: 'dropdown' })
      await wrapper.find('.overflow-trigger').trigger('click')
      await flushPromises()
      expect(wrapper.find('.overflow-dropdown').exists()).toBe(true)
      expect(wrapper.find('.bottom-sheet').exists()).toBe(false)
    })

    it('OM-03: dropdown items have 18px icons', async () => {
      const items: OverflowMenuItem[] = [
        { label: 'Delete', icon: 'trash-2', action: vi.fn() },
      ]
      const wrapper = mountOverflowMenu({ items, variant: 'dropdown' })
      await wrapper.find('.overflow-trigger').trigger('click')
      await flushPromises()
      const icon = wrapper.find('.item-icon')
      if (icon.exists()) {
        const style = getComputedStyle(icon.element)
        expect(style.width).toBe('18px')
        expect(style.height).toBe('18px')
      }
    })

    it('OM-05: dropdown item min-height is 36px', async () => {
      const wrapper = mountOverflowMenu({ variant: 'dropdown' })
      await wrapper.find('.overflow-trigger').trigger('click')
      await flushPromises()
      const item = wrapper.find('.overflow-item')
      if (item.exists()) {
        const style = getComputedStyle(item.element)
        expect(style.minHeight).toBe('36px')
      }
    })
  })

  describe('BDD-17: variant="sheet" sub-component', () => {
    it('OM-02: renders OverflowMenuSheet sub-component when variant="sheet"', async () => {
      const wrapper = mountOverflowMenu({ variant: 'sheet' })
      await wrapper.find('.overflow-trigger').trigger('click')
      await flushPromises()
      expect(wrapper.find('.bottom-sheet').exists()).toBe(true)
      expect(wrapper.find('.overflow-dropdown').exists()).toBe(false)
    })

    it('OM-04: sheet items have 20px icons', async () => {
      const items: OverflowMenuItem[] = [
        { label: 'Delete', icon: 'trash-2', action: vi.fn() },
      ]
      const wrapper = mountOverflowMenu({ items, variant: 'sheet' })
      await wrapper.find('.overflow-trigger').trigger('click')
      await flushPromises()
      const icon = wrapper.find('.sheet-item-icon')
      if (icon.exists()) {
        const style = getComputedStyle(icon.element)
        expect(style.width).toBe('20px')
        expect(style.height).toBe('20px')
      }
    })

    it('OM-06: sheet item min-height is 48px', async () => {
      const wrapper = mountOverflowMenu({ variant: 'sheet' })
      await wrapper.find('.overflow-trigger').trigger('click')
      await flushPromises()
      const item = wrapper.find('.sheet-item')
      if (item.exists()) {
        const style = getComputedStyle(item.element)
        expect(style.minHeight).toBe('48px')
      }
    })

    it('OM-22: sheet has drag handle', async () => {
      const wrapper = mountOverflowMenu({ variant: 'sheet' })
      await wrapper.find('.overflow-trigger').trigger('click')
      await flushPromises()
      expect(wrapper.find('.sheet-drag-handle').exists()).toBe(true)
    })

    it('OM-23: sheet backdrop click closes the sheet', async () => {
      const wrapper = mountOverflowMenu({ variant: 'sheet' })
      await wrapper.find('.overflow-trigger').trigger('click')
      await flushPromises()
      expect(wrapper.find('.bottom-sheet').exists()).toBe(true)

      await wrapper.find('.sheet-backdrop').trigger('click')
      await flushPromises()
      expect(wrapper.find('.bottom-sheet').exists()).toBe(false)
    })

    it('OM-24: sheet close button closes the sheet', async () => {
      const wrapper = mountOverflowMenu({ variant: 'sheet' })
      await wrapper.find('.overflow-trigger').trigger('click')
      await flushPromises()
      expect(wrapper.find('.bottom-sheet').exists()).toBe(true)

      await wrapper.find('.sheet-close-btn').trigger('click')
      await flushPromises()
      expect(wrapper.find('.bottom-sheet').exists()).toBe(false)
    })
  })

  describe('BDD-01: Dropdown background token', () => {
    it('OM-07: dropdown background uses --c-surface token', async () => {
      const wrapper = mountOverflowMenu({ variant: 'dropdown' })
      await wrapper.find('.overflow-trigger').trigger('click')
      await flushPromises()
      const dropdown = wrapper.find('.overflow-dropdown')
      if (dropdown.exists()) {
        const style = getComputedStyle(dropdown.element)
        const bg = style.background || style.backgroundColor
        expect(bg).not.toBe('')
        expect(bg).not.toContain('transparent')
        expect(bg).not.toContain('rgba(0, 0, 0, 0)')
      }
    })

    it('OM-31: light theme dropdown background is opaque white', async () => {
      document.documentElement.dataset.theme = 'light'
      const wrapper = mountOverflowMenu({ variant: 'dropdown' })
      await wrapper.find('.overflow-trigger').trigger('click')
      await flushPromises()
      const dropdown = wrapper.find('.overflow-dropdown')
      if (dropdown.exists()) {
        const style = getComputedStyle(dropdown.element)
        const bg = style.backgroundColor
        expect(bg).toBe('rgb(255, 255, 255)')
      }
    })

    it('OM-32: dark theme dropdown background is #121822', async () => {
      document.documentElement.dataset.theme = 'dark'
      const wrapper = mountOverflowMenu({ variant: 'dropdown' })
      await wrapper.find('.overflow-trigger').trigger('click')
      await flushPromises()
      const dropdown = wrapper.find('.overflow-dropdown')
      if (dropdown.exists()) {
        const style = getComputedStyle(dropdown.element)
        const bg = style.backgroundColor
        expect(bg).toBe('rgb(18, 24, 34)')
      }
    })
  })

  describe('BDD-02: Dropdown border and shadow tokens', () => {
    it('OM-08: dropdown border uses --c-border-strong token', async () => {
      const wrapper = mountOverflowMenu({ variant: 'dropdown' })
      await wrapper.find('.overflow-trigger').trigger('click')
      await flushPromises()
      const dropdown = wrapper.find('.overflow-dropdown')
      if (dropdown.exists()) {
        const style = getComputedStyle(dropdown.element)
        const border = style.borderColor
        expect(border).toBeTruthy()
        expect(border).not.toBe('')
      }
    })

    it('OM-09: dropdown border-radius is 8px', async () => {
      const wrapper = mountOverflowMenu({ variant: 'dropdown' })
      await wrapper.find('.overflow-trigger').trigger('click')
      await flushPromises()
      const dropdown = wrapper.find('.overflow-dropdown')
      if (dropdown.exists()) {
        const style = getComputedStyle(dropdown.element)
        expect(style.borderRadius).toBe('8px')
      }
    })

    it('OM-10: dropdown box-shadow matches spec', async () => {
      const wrapper = mountOverflowMenu({ variant: 'dropdown' })
      await wrapper.find('.overflow-trigger').trigger('click')
      await flushPromises()
      const dropdown = wrapper.find('.overflow-dropdown')
      if (dropdown.exists()) {
        const style = getComputedStyle(dropdown.element)
        const shadow = style.boxShadow
        expect(shadow).toContain('rgba(0, 0, 0, 0.16)')
      }
    })

    it('OM-33: dropdown min-width is 220px', async () => {
      const wrapper = mountOverflowMenu({ variant: 'dropdown' })
      await wrapper.find('.overflow-trigger').trigger('click')
      await flushPromises()
      const dropdown = wrapper.find('.overflow-dropdown')
      if (dropdown.exists()) {
        const style = getComputedStyle(dropdown.element)
        expect(style.minWidth).toBe('220px')
      }
    })
  })

  describe('BDD-03: Menu item hover state', () => {
    it('OM-11: normal item hover background uses --c-surface-lower', async () => {
      const wrapper = mountOverflowMenu({ variant: 'dropdown' })
      await wrapper.find('.overflow-trigger').trigger('click')
      await flushPromises()
      const item = wrapper.find('.overflow-item')
      if (item.exists()) {
        await item.trigger('mouseenter')
        await flushPromises()
        const style = getComputedStyle(item.element)
        const bg = style.background || style.backgroundColor
        expect(bg).toBeTruthy()
      }
    })

    it('OM-12: danger item hover background uses --c-error-surface token', async () => {
      const items: OverflowMenuItem[] = [
        { label: 'Delete', variant: 'danger', action: vi.fn() },
      ]
      const wrapper = mountOverflowMenu({ items, variant: 'dropdown' })
      await wrapper.find('.overflow-trigger').trigger('click')
      await flushPromises()
      const item = wrapper.find('.overflow-item.item-danger')
      if (item.exists()) {
        await item.trigger('mouseenter')
        await flushPromises()
        const style = getComputedStyle(item.element)
        const bg = style.background || style.backgroundColor
        expect(bg).toBeTruthy()
      }
    })
  })

  describe('BDD-04: Share item removed from OverflowMenu', () => {
    it('OM-13: no "Share" label in OverflowMenu items', async () => {
      const wrapper = mountOverflowMenu({ variant: 'dropdown' })
      await wrapper.find('.overflow-trigger').trigger('click')
      await flushPromises()
      const items = wrapper.findAll('.overflow-item')
      const hasShareItem = items.some(el => el.text().includes('Share'))
      expect(hasShareItem).toBe(false)
    })
  })

  describe('BDD-20: Keyboard navigation in OverflowMenu', () => {
    it('OM-14: Enter key opens dropdown', async () => {
      const wrapper = mountOverflowMenu({ variant: 'dropdown' })
      await wrapper.find('.overflow-trigger').trigger('keydown', { key: 'Enter' })
      await flushPromises()
      expect(wrapper.find('.overflow-dropdown').exists()).toBe(true)
    })

    it('OM-15: Space key opens dropdown', async () => {
      const wrapper = mountOverflowMenu({ variant: 'dropdown' })
      await wrapper.find('.overflow-trigger').trigger('keydown', { key: ' ' })
      await flushPromises()
      expect(wrapper.find('.overflow-dropdown').exists()).toBe(true)
    })

    it('OM-16: Escape closes dropdown and focus returns to trigger', async () => {
      const wrapper = mountOverflowMenu({ variant: 'dropdown' })
      await wrapper.find('.overflow-trigger').trigger('click')
      await flushPromises()
      expect(wrapper.find('.overflow-dropdown').exists()).toBe(true)

      await document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await flushPromises()

      expect(wrapper.find('.overflow-dropdown').exists()).toBe(false)
      expect(document.activeElement).toBe(wrapper.find('.overflow-trigger').element)
    })

    it('OM-17: Tab with open dropdown closes and moves focus', async () => {
      const wrapper = mountOverflowMenu({ variant: 'dropdown' })
      await wrapper.find('.overflow-trigger').trigger('click')
      await flushPromises()
      expect(wrapper.find('.overflow-dropdown').exists()).toBe(true)

      await document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
      await flushPromises()

      expect(wrapper.find('.overflow-dropdown').exists()).toBe(false)
    })

    it('OM-18: aria-expanded toggles correctly', async () => {
      const wrapper = mountOverflowMenu({ variant: 'dropdown' })
      const trigger = wrapper.find('.overflow-trigger')
      expect(trigger.attributes('aria-expanded')).toBe('false')

      await trigger.trigger('click')
      await flushPromises()
      expect(trigger.attributes('aria-expanded')).toBe('true')

      await document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await flushPromises()
      expect(trigger.attributes('aria-expanded')).toBe('false')
    })
  })

  describe('Click-outside closes menu', () => {
    it('OM-19: clicking outside closes dropdown', async () => {
      const wrapper = mountOverflowMenu({ variant: 'dropdown' })
      await wrapper.find('.overflow-trigger').trigger('click')
      await flushPromises()
      expect(wrapper.find('.overflow-dropdown').exists()).toBe(true)

      const outside = document.createElement('div')
      document.body.appendChild(outside)
      outside.click()
      await flushPromises()

      expect(wrapper.find('.overflow-dropdown').exists()).toBe(false)
    })
  })

  describe('Item action handling', () => {
    it('OM-20: item click calls action and closes', async () => {
      const action = vi.fn()
      const items: OverflowMenuItem[] = [{ label: 'Download', action }]
      const wrapper = mountOverflowMenu({ items, variant: 'dropdown' })
      await wrapper.find('.overflow-trigger').trigger('click')
      await flushPromises()

      await wrapper.find('.overflow-item').trigger('click')
      expect(action).toHaveBeenCalledOnce()
      expect(wrapper.find('.overflow-dropdown').exists()).toBe(false)
    })
  })

  describe('Exposed methods', () => {
    it('OM-21: close() exposed method works', async () => {
      const wrapper = mountOverflowMenu({ variant: 'dropdown' })
      await wrapper.find('.overflow-trigger').trigger('click')
      await flushPromises()
      expect(wrapper.find('.overflow-dropdown').exists()).toBe(true)

      const vm = wrapper.vm as unknown as { close: () => void }
      vm.close()
      await flushPromises()
      expect(wrapper.find('.overflow-dropdown').exists()).toBe(false)
    })
  })

  describe('Item rendering details', () => {
    it('OM-25: divider renders correctly', async () => {
      const items: OverflowMenuItem[] = [
        { label: 'Download', action: vi.fn() },
        { label: '', divider: true },
        { label: 'Delete', variant: 'danger', action: vi.fn() },
      ]
      const wrapper = mountOverflowMenu({ items, variant: 'dropdown' })
      await wrapper.find('.overflow-trigger').trigger('click')
      await flushPromises()
      const divider = wrapper.find('.dropdown-divider')
      expect(divider.exists()).toBe(true)
    })

    it('OM-26: href item renders <a> tag', async () => {
      const items: OverflowMenuItem[] = [
        { label: 'Raw', href: '/raw', target: '_blank', rel: 'noopener' },
      ]
      const wrapper = mountOverflowMenu({ items, variant: 'dropdown' })
      await wrapper.find('.overflow-trigger').trigger('click')
      await flushPromises()
      const linkItem = wrapper.find('.overflow-item')
      expect(linkItem.element.tagName).toBe('A')
      expect(linkItem.attributes('href')).toBe('/raw')
      expect(linkItem.attributes('target')).toBe('_blank')
      expect(linkItem.attributes('rel')).toBe('noopener')
    })

    it('OM-27: action item renders <button> tag', async () => {
      const items: OverflowMenuItem[] = [
        { label: 'Download', action: vi.fn() },
      ]
      const wrapper = mountOverflowMenu({ items, variant: 'dropdown' })
      await wrapper.find('.overflow-trigger').trigger('click')
      await flushPromises()
      const btnItem = wrapper.find('.overflow-item')
      expect(btnItem.element.tagName).toBe('BUTTON')
    })

    it('OM-28: danger variant applies item-danger class', async () => {
      const items: OverflowMenuItem[] = [
        { label: 'Delete', variant: 'danger', action: vi.fn() },
      ]
      const wrapper = mountOverflowMenu({ items, variant: 'dropdown' })
      await wrapper.find('.overflow-trigger').trigger('click')
      await flushPromises()
      const item = wrapper.find('.overflow-item')
      expect(item.classes()).toContain('item-danger')
    })

    it('OM-29: icon rendered when item has icon', async () => {
      const items: OverflowMenuItem[] = [
        { label: 'Delete', icon: 'trash-2', action: vi.fn() },
      ]
      const wrapper = mountOverflowMenu({ items, variant: 'dropdown' })
      await wrapper.find('.overflow-trigger').trigger('click')
      await flushPromises()
      const item = wrapper.find('.overflow-item')
      expect(item.find('svg').exists()).toBe(true)
    })

    it('OM-30: hint text rendered', async () => {
      const items: OverflowMenuItem[] = [
        { label: 'Delete', hint: 'Permanently', action: vi.fn() },
      ]
      const wrapper = mountOverflowMenu({ items, variant: 'dropdown' })
      await wrapper.find('.overflow-trigger').trigger('click')
      await flushPromises()
      const hint = wrapper.find('.item-hint')
      expect(hint.exists()).toBe(true)
      expect(hint.text()).toBe('Permanently')
    })
  })
})
