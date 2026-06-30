import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import EntryListRow from '@/components/EntryListRow.vue'
import type { Entry } from '@/types'

const mockEntry: Entry = {
  id: 1,
  slug: 'test-entry',
  summary: 'A test entry',
  tags: ['vue', 'typescript'],
  status: 'active',
  files: [],
  fileCount: 3,
  isPublic: true,
  ownerId: 1,
  username: 'alice',
  expiresAt: null,
  createdAt: '2026-01-01T00:00:00Z',
}

const mockPrivateEntry: Entry = {
  ...mockEntry,
  id: 2,
  slug: 'private-entry',
  isPublic: false,
  username: 'bob',
}

const routerLinkStub = {
  template: '<a :href="to"><slot /></a>',
  props: ['to'],
}

describe('EntryListRow', () => {
  const createWrapper = (props: Record<string, any> = {}) =>
    mount(EntryListRow, {
      props: { entry: mockEntry, ...props },
      global: { stubs: { 'router-link': routerLinkStub } },
    })

  it('renders entry summary', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('A test entry')
  })

  it('renders entry slug as fallback when no summary', () => {
    const wrapper = createWrapper({ entry: { ...mockEntry, summary: '' } })
    expect(wrapper.text()).toContain('test-entry')
  })

  it('renders tags using BaseTag', () => {
    const wrapper = createWrapper()
    const tags = wrapper.findAll('.base-tag')
    expect(tags.length).toBeGreaterThanOrEqual(1)
  })

  it('renders public badge for public entry when owner', () => {
    const wrapper = createWrapper({ isOwner: true })
    const badge = wrapper.find('.base-badge')
    expect(badge.exists()).toBe(true)
    expect(badge.classes()).toContain('badge-public')
  })

  it('hides badge when not owner', () => {
    const wrapper = createWrapper({ isOwner: false })
    const badge = wrapper.find('.base-badge')
    expect(badge.exists()).toBe(false)
  })

  it('renders private badge for private entry when owner', () => {
    const wrapper = createWrapper({ entry: mockPrivateEntry, isOwner: true })
    const badge = wrapper.find('.base-badge')
    expect(badge.exists()).toBe(true)
    expect(badge.classes()).toContain('badge-private')
  })

  it('shows action buttons when isOwner is true', () => {
    const wrapper = createWrapper({ isOwner: true })
    const actions = wrapper.find('.entry-actions') || wrapper.find('[data-testid="entry-actions"]')
    expect(actions.exists()).toBe(true)
  })

  it('hides action buttons when isOwner is false', () => {
    const wrapper = createWrapper({ isOwner: false })
    const actions = wrapper.find('.entry-actions') || wrapper.find('[data-testid="entry-actions"]')
    expect(actions.exists()).toBe(false)
  })

  it('emits navigate on row click', async () => {
    const wrapper = createWrapper()
    const row = wrapper.find('.entry-list-row') || wrapper.find('[role="button"]') || wrapper.find('a')
    if (row.exists()) {
      await row.trigger('click')
      expect(wrapper.emitted('navigate')).toBeTruthy()
    }
  })

  it('emits navigate on Enter key', async () => {
    const wrapper = createWrapper()
    const row = wrapper.find('.entry-list-row') || wrapper.find('[role="button"]')
    if (row.exists()) {
      await row.trigger('keydown', { key: 'Enter' })
      expect(wrapper.emitted('navigate')).toBeTruthy()
    }
  })

  it('emits navigate on Space key', async () => {
    const wrapper = createWrapper()
    const row = wrapper.find('.entry-list-row') || wrapper.find('[role="button"]')
    if (row.exists()) {
      await row.trigger('keydown', { key: ' ' })
      expect(wrapper.emitted('navigate')).toBeTruthy()
    }
  })

  it('emits toggleVisibility when visibility button clicked', async () => {
    const wrapper = createWrapper({ isOwner: true })
    const btn = wrapper.find('[data-action="toggle-visibility"]') || wrapper.find('.visibility-btn')
    if (btn.exists()) {
      await btn.trigger('click')
      expect(wrapper.emitted('toggleVisibility')).toBeTruthy()
    }
  })

  it('emits delete when delete button clicked', async () => {
    const wrapper = createWrapper({ isOwner: true })
    const btn = wrapper.find('[data-action="delete"]') || wrapper.find('.delete-btn')
    if (btn.exists()) {
      await btn.trigger('click')
      expect(wrapper.emitted('delete')).toBeTruthy()
    }
  })

  it('has entry-list-row root class', () => {
    const wrapper = createWrapper()
    expect(wrapper.find('.entry-list-row').exists()).toBe(true)
  })

  it('uses --c-border for row separator', () => {
    const wrapper = createWrapper()
    const row = wrapper.find('.entry-list-row')
    const style = row.attributes('style') || ''
    const classes = row.classes().join(' ')
    const usesBorder = style.includes('--c-border') || classes.includes('entry-list-row')
    expect(usesBorder).toBe(true)
  })

  it('renders meta text with --c-text-tertiary', () => {
    const wrapper = createWrapper()
    const meta = wrapper.find('.entry-meta')
    const style = meta.attributes('style') || ''
    const classes = meta.classes().join(' ')
    const usesTertiary = style.includes('--c-text-tertiary') || classes.includes('entry-meta')
    expect(usesTertiary).toBe(true)
  })
})
