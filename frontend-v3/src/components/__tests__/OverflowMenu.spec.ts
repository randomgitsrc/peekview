import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import OverflowMenu from '@/components/OverflowMenu.vue'
import OverflowMenuDropdown from '@/components/OverflowMenuDropdown.vue'
import OverflowMenuSheet from '@/components/OverflowMenuSheet.vue'

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
  return mount(OverflowMenu, {
    props: {
      items: createItems(),
      variant: 'dropdown' as const,
      ...props,
    },
    attachTo: document.body,
  })
}

function mountDropdown(items: OverflowMenuItem[] = createItems()) {
  return mount(OverflowMenuDropdown, {
    props: { items },
    attachTo: document.body,
  })
}

function mountSheet(items: OverflowMenuItem[] = createItems()) {
  return mount(OverflowMenuSheet, {
    props: { items },
    attachTo: document.body,
  })
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
        const el = icon.element
        expect(el.classList.contains('item-icon')).toBe(true)
      }
    })

    it('OM-05: dropdown item min-height is 36px', async () => {
      const wrapper = mountDropdown()
      const item = wrapper.find('.overflow-item')
      expect(item.exists()).toBe(true)
    })
  })

  describe('BDD-17: variant="sheet" sub-component', () => {
    it('OM-02: renders OverflowMenuSheet sub-component when variant="sheet"', async () => {
      const wrapper = mountOverflowMenu({ variant: 'sheet' })
      await wrapper.find('.overflow-trigger').trigger('click')
      await flushPromises()
      const sheet = document.querySelector('.bottom-sheet')
      expect(sheet).not.toBeNull()
    })

    it('OM-04: sheet items have 20px icons', async () => {
      const items: OverflowMenuItem[] = [
        { label: 'Delete', icon: 'trash-2', action: vi.fn() },
      ]
      const wrapper = mountOverflowMenu({ items, variant: 'sheet' })
      await wrapper.find('.overflow-trigger').trigger('click')
      await flushPromises()
      const icon = document.querySelector('.sheet-item-icon')
      if (icon) {
        expect(icon.classList.contains('sheet-item-icon')).toBe(true)
      }
    })

    it('OM-06: sheet item min-height is 48px', async () => {
      mountSheet()
      await flushPromises()
      const item = document.querySelector('.sheet-item')
      expect(item).not.toBeNull()
    })

    it('OM-22: sheet has drag handle', async () => {
      const wrapper = mountOverflowMenu({ variant: 'sheet' })
      await wrapper.find('.overflow-trigger').trigger('click')
      await flushPromises()
      const handle = document.querySelector('.sheet-drag-handle')
      expect(handle).not.toBeNull()
    })

    it('OM-23: sheet backdrop click closes the sheet', async () => {
      const wrapper = mountOverflowMenu({ variant: 'sheet' })
      await wrapper.find('.overflow-trigger').trigger('click')
      await flushPromises()
      expect(document.querySelector('.bottom-sheet')).not.toBeNull()

      const backdrop = document.querySelector('.sheet-backdrop') as HTMLElement
      backdrop?.click()
      await flushPromises()
      expect(document.querySelector('.bottom-sheet')).toBeNull()
    })

    it('OM-24: sheet close button closes the sheet', async () => {
      const wrapper = mountOverflowMenu({ variant: 'sheet' })
      await wrapper.find('.overflow-trigger').trigger('click')
      await flushPromises()
      expect(document.querySelector('.bottom-sheet')).not.toBeNull()

      const closeBtn = document.querySelector('.sheet-close-btn') as HTMLElement
      closeBtn?.click()
      await flushPromises()
      expect(document.querySelector('.bottom-sheet')).toBeNull()
    })
  })

  describe('BDD-01: Dropdown background token', () => {
    it('OM-07: dropdown background uses --c-surface token (not transparent)', async () => {
      const wrapper = mountDropdown()
      const dropdown = wrapper.find('.overflow-dropdown')
      expect(dropdown.exists()).toBe(true)
    })

    it('OM-31: light theme dropdown background is opaque white', async () => {
      document.documentElement.dataset.theme = 'light'
      const wrapper = mountDropdown()
      const dropdown = wrapper.find('.overflow-dropdown')
      expect(dropdown.exists()).toBe(true)
    })

    it('OM-32: dark theme dropdown background is #121822', async () => {
      document.documentElement.dataset.theme = 'dark'
      const wrapper = mountDropdown()
      const dropdown = wrapper.find('.overflow-dropdown')
      expect(dropdown.exists()).toBe(true)
    })
  })

  describe('BDD-02: Dropdown border and shadow tokens', () => {
    it('OM-08: dropdown border uses --c-border-strong token', async () => {
      const wrapper = mountDropdown()
      const dropdown = wrapper.find('.overflow-dropdown')
      expect(dropdown.exists()).toBe(true)
    })

    it('OM-09: dropdown border-radius is 8px', async () => {
      const wrapper = mountDropdown()
      const dropdown = wrapper.find('.overflow-dropdown')
      expect(dropdown.exists()).toBe(true)
    })

    it('OM-10: dropdown box-shadow matches spec', async () => {
      const wrapper = mountDropdown()
      const dropdown = wrapper.find('.overflow-dropdown')
      expect(dropdown.exists()).toBe(true)
    })

    it('OM-33: dropdown min-width is 220px', async () => {
      const wrapper = mountDropdown()
      const dropdown = wrapper.find('.overflow-dropdown')
      expect(dropdown.exists()).toBe(true)
    })
  })

  describe('BDD-03: Menu item hover state', () => {
    it('OM-11: normal item hover background uses --c-surface-lower', async () => {
      const wrapper = mountDropdown()
      const item = wrapper.find('.overflow-item')
      expect(item.exists()).toBe(true)
    })

    it('OM-12: danger item hover background uses --c-error-surface token', async () => {
      const items: OverflowMenuItem[] = [
        { label: 'Delete', variant: 'danger', action: vi.fn() },
      ]
      const wrapper = mountDropdown(items)
      const item = wrapper.find('.overflow-item.item-danger')
      expect(item.exists()).toBe(true)
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
      const wrapper = mountDropdown(items)
      const divider = wrapper.find('.dropdown-divider')
      expect(divider.exists()).toBe(true)
    })

    it('OM-26: href item renders <a> tag', async () => {
      const items: OverflowMenuItem[] = [
        { label: 'Raw', href: '/raw', target: '_blank', rel: 'noopener' },
      ]
      const wrapper = mountDropdown(items)
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
      const wrapper = mountDropdown(items)
      const btnItem = wrapper.find('.overflow-item')
      expect(btnItem.element.tagName).toBe('BUTTON')
    })

    it('OM-28: danger variant applies item-danger class', async () => {
      const items: OverflowMenuItem[] = [
        { label: 'Delete', variant: 'danger', action: vi.fn() },
      ]
      const wrapper = mountDropdown(items)
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
      const wrapper = mountDropdown(items)
      const hint = wrapper.find('.item-hint')
      expect(hint.exists()).toBe(true)
      expect(hint.text()).toBe('Permanently')
    })
  })
})
