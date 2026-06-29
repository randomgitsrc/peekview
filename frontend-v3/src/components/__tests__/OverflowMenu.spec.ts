import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import OverflowMenu from '@/components/OverflowMenu.vue'

function createItems(overrides: Partial<OverflowMenuItem>[] = []) {
  const defaults: OverflowMenuItem[] = [
    { label: 'Download', action: vi.fn() },
    { label: 'Raw', href: '/api/v1/entries/test/raw', target: '_blank', rel: 'noopener noreferrer' },
    { label: 'Delete', icon: '🗑️', variant: 'danger', action: vi.fn() },
  ]
  return overrides.length > 0
    ? overrides.map((o, i) => ({ ...defaults[i], ...o }))
    : defaults
}

interface OverflowMenuItem {
  label: string
  icon?: string
  href?: string
  target?: string
  rel?: string
  variant?: 'default' | 'danger'
  action?: () => void
}

function mountOverflowMenu(props: Partial<{ items: OverflowMenuItem[] }> = {}) {
  return mount(OverflowMenu, {
    props: {
      items: createItems(),
      ...props,
    },
    attachTo: document.body,
  })
}

describe('OverflowMenu', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('rendering', () => {
    it('renders overflow trigger button', () => {
      const wrapper = mountOverflowMenu()
      const trigger = wrapper.find('.overflow-trigger')
      expect(trigger.exists()).toBe(true)
      expect(trigger.text()).toContain('⋯')
    })

    it('trigger has aria-haspopup attribute', () => {
      const wrapper = mountOverflowMenu()
      const trigger = wrapper.find('.overflow-trigger')
      expect(trigger.attributes('aria-haspopup')).toBe('true')
    })

    it('trigger has aria-expanded=false when closed', () => {
      const wrapper = mountOverflowMenu()
      const trigger = wrapper.find('.overflow-trigger')
      expect(trigger.attributes('aria-expanded')).toBe('false')
    })

    it('trigger has is-open class when open', async () => {
      const wrapper = mountOverflowMenu()
      await wrapper.find('.overflow-trigger').trigger('click')
      const trigger = wrapper.find('.overflow-trigger')
      expect(trigger.classes()).toContain('is-open')
    })

    it('dropdown is not rendered when closed', () => {
      const wrapper = mountOverflowMenu()
      expect(wrapper.find('.overflow-dropdown').exists()).toBe(false)
    })

    it('dropdown is rendered when trigger is clicked', async () => {
      const wrapper = mountOverflowMenu()
      await wrapper.find('.overflow-trigger').trigger('click')
      expect(wrapper.find('.overflow-dropdown').exists()).toBe(true)
    })

    it('dropdown has role="menu"', async () => {
      const wrapper = mountOverflowMenu()
      await wrapper.find('.overflow-trigger').trigger('click')
      expect(wrapper.find('.overflow-dropdown').attributes('role')).toBe('menu')
    })

    it('renders correct number of menu items', async () => {
      const items = createItems()
      const wrapper = mountOverflowMenu({ items })
      await wrapper.find('.overflow-trigger').trigger('click')
      expect(wrapper.findAll('.overflow-item')).toHaveLength(items.length)
    })

    it('renders <a> element for items with href', async () => {
      const wrapper = mountOverflowMenu()
      await wrapper.find('.overflow-trigger').trigger('click')
      const rawItem = wrapper.findAll('.overflow-item').find(el => el.text().includes('Raw'))
      expect(rawItem!.element.tagName).toBe('A')
      expect(rawItem!.attributes('href')).toBe('/api/v1/entries/test/raw')
      expect(rawItem!.attributes('target')).toBe('_blank')
      expect(rawItem!.attributes('rel')).toBe('noopener noreferrer')
    })

    it('renders <button> element for items without href', async () => {
      const wrapper = mountOverflowMenu()
      await wrapper.find('.overflow-trigger').trigger('click')
      const downloadItem = wrapper.findAll('.overflow-item').find(el => el.text().includes('Download'))
      expect(downloadItem!.element.tagName).toBe('BUTTON')
    })

    it('each menu item has role="menuitem"', async () => {
      const wrapper = mountOverflowMenu()
      await wrapper.find('.overflow-trigger').trigger('click')
      wrapper.findAll('.overflow-item').forEach(item => {
        expect(item.attributes('role')).toBe('menuitem')
      })
    })

    it('renders icon when item has icon', async () => {
      const wrapper = mountOverflowMenu()
      await wrapper.find('.overflow-trigger').trigger('click')
      const deleteItem = wrapper.findAll('.overflow-item').find(el => el.text().includes('Delete'))
      expect(deleteItem!.find('.item-icon').exists()).toBe(true)
      expect(deleteItem!.find('.item-icon').text()).toBe('🗑️')
    })

    it('does not render icon element when item has no icon', async () => {
      const wrapper = mountOverflowMenu()
      await wrapper.find('.overflow-trigger').trigger('click')
      const downloadItem = wrapper.findAll('.overflow-item').find(el => el.text().includes('Download'))
      expect(downloadItem!.find('.item-icon').exists()).toBe(false)
    })

    it('applies item-danger class for variant="danger"', async () => {
      const wrapper = mountOverflowMenu()
      await wrapper.find('.overflow-trigger').trigger('click')
      const deleteItem = wrapper.findAll('.overflow-item').find(el => el.text().includes('Delete'))
      expect(deleteItem!.classes()).toContain('item-danger')
    })

    it('does not apply item-danger class for default variant', async () => {
      const wrapper = mountOverflowMenu()
      await wrapper.find('.overflow-trigger').trigger('click')
      const downloadItem = wrapper.findAll('.overflow-item').find(el => el.text().includes('Download'))
      expect(downloadItem!.classes()).not.toContain('item-danger')
    })

    it('renders empty dropdown when items array is empty', async () => {
      const wrapper = mountOverflowMenu({ items: [] })
      await wrapper.find('.overflow-trigger').trigger('click')
      expect(wrapper.findAll('.overflow-item')).toHaveLength(0)
    })
  })

  describe('toggle interaction', () => {
    it('opens dropdown on trigger click', async () => {
      const wrapper = mountOverflowMenu()
      await wrapper.find('.overflow-trigger').trigger('click')
      expect(wrapper.find('.overflow-dropdown').exists()).toBe(true)
      expect(wrapper.find('.overflow-trigger').attributes('aria-expanded')).toBe('true')
    })

    it('closes dropdown on second trigger click', async () => {
      const wrapper = mountOverflowMenu()
      await wrapper.find('.overflow-trigger').trigger('click')
      expect(wrapper.find('.overflow-dropdown').exists()).toBe(true)
      await wrapper.find('.overflow-trigger').trigger('click')
      expect(wrapper.find('.overflow-dropdown').exists()).toBe(false)
      expect(wrapper.find('.overflow-trigger').attributes('aria-expanded')).toBe('false')
    })
  })

  describe('click-outside closes menu', () => {
    it('closes dropdown when clicking outside the menu', async () => {
      const wrapper = mountOverflowMenu()
      await wrapper.find('.overflow-trigger').trigger('click')
      expect(wrapper.find('.overflow-dropdown').exists()).toBe(true)

      const outside = document.createElement('div')
      document.body.appendChild(outside)
      outside.click()
      await flushPromises()

      expect(wrapper.find('.overflow-dropdown').exists()).toBe(false)
    })

    it('does not close dropdown when clicking inside the dropdown', async () => {
      const wrapper = mountOverflowMenu()
      await wrapper.find('.overflow-trigger').trigger('click')
      expect(wrapper.find('.overflow-dropdown').exists()).toBe(true)

      await wrapper.find('.overflow-dropdown').trigger('click')
      expect(wrapper.find('.overflow-dropdown').exists()).toBe(true)
    })
  })

  describe('Escape key closes menu', () => {
    it('closes dropdown on Escape key', async () => {
      const wrapper = mountOverflowMenu()
      await wrapper.find('.overflow-trigger').trigger('click')
      expect(wrapper.find('.overflow-dropdown').exists()).toBe(true)

      await document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await flushPromises()

      expect(wrapper.find('.overflow-dropdown').exists()).toBe(false)
    })

    it('returns focus to trigger after Escape close', async () => {
      const wrapper = mountOverflowMenu()
      const trigger = wrapper.find('.overflow-trigger')
      await trigger.trigger('click')
      await flushPromises()

      await document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await flushPromises()

      expect(document.activeElement).toBe(trigger.element)
    })

    it('does nothing on Escape when menu is already closed', async () => {
      const wrapper = mountOverflowMenu()
      expect(wrapper.find('.overflow-dropdown').exists()).toBe(false)

      await document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await flushPromises()

      expect(wrapper.find('.overflow-dropdown').exists()).toBe(false)
    })
  })

  describe('item action handling', () => {
    it('calls action callback and closes menu when button item is clicked', async () => {
      const action = vi.fn()
      const items: OverflowMenuItem[] = [
        { label: 'Download', action },
      ]
      const wrapper = mountOverflowMenu({ items })
      await wrapper.find('.overflow-trigger').trigger('click')
      expect(wrapper.find('.overflow-dropdown').exists()).toBe(true)

      await wrapper.find('.overflow-item').trigger('click')
      expect(action).toHaveBeenCalledOnce()
      expect(wrapper.find('.overflow-dropdown').exists()).toBe(false)
    })

    it('closes menu when <a> item is clicked', async () => {
      const items: OverflowMenuItem[] = [
        { label: 'Raw', href: '/raw', target: '_blank', rel: 'noopener' },
      ]
      const wrapper = mountOverflowMenu({ items })
      await wrapper.find('.overflow-trigger').trigger('click')
      expect(wrapper.find('.overflow-dropdown').exists()).toBe(true)

      await wrapper.find('.overflow-item').trigger('click')
      expect(wrapper.find('.overflow-dropdown').exists()).toBe(false)
    })

    it('danger variant item calls action and closes', async () => {
      const action = vi.fn()
      const items: OverflowMenuItem[] = [
        { label: 'Delete', variant: 'danger', action },
      ]
      const wrapper = mountOverflowMenu({ items })
      await wrapper.find('.overflow-trigger').trigger('click')

      await wrapper.find('.overflow-item').trigger('click')
      expect(action).toHaveBeenCalledOnce()
      expect(wrapper.find('.overflow-dropdown').exists()).toBe(false)
    })
  })

  describe('cleanup', () => {
    it('removes event listeners on unmount', async () => {
      const removeSpy = vi.spyOn(document, 'removeEventListener')
      const wrapper = mountOverflowMenu()
      await wrapper.find('.overflow-trigger').trigger('click')

      wrapper.unmount()
      expect(removeSpy).toHaveBeenCalledWith('click', expect.any(Function))
      expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
    })
  })
})
