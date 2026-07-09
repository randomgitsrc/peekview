import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import EntryListRow from '@/components/EntryListRow.vue'
import type { Entry } from '@/types'

vi.mock('@/composables/useRelativeTime', () => ({
  useRelativeTime: () => ({ relative: ref('2d ago'), full: ref('2026-07-07 14:30') }),
}))

function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 1,
    slug: 'test-entry',
    summary: 'Test entry',
    tags: [],
    status: 'active',
    files: [],
    fileCount: 2,
    isPublic: true,
    ownerId: 1,
    username: 'alice',
    expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    archivedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('EntryListRow', () => {
  it('TC-B14: displays @username format', () => {
    const entry = makeEntry({ username: 'bob' })
    const wrapper = mount(EntryListRow, { props: { entry }, global: { stubs: { BaseTag: true, BaseBadge: true } } })
    expect(wrapper.text()).toContain('@bob')
  })

  it('TC-B17: username=null does not show username', () => {
    const entry = makeEntry({ username: null })
    const wrapper = mount(EntryListRow, { props: { entry }, global: { stubs: { BaseTag: true, BaseBadge: true } } })
    expect(wrapper.find('.meta-username').exists()).toBe(false)
  })

  it('TC-B15: @username is a router-link', () => {
    const entry = makeEntry({ username: 'bob' })
    const wrapper = mount(EntryListRow, { props: { entry }, global: { stubs: { BaseTag: true, BaseBadge: true } } })
    const link = wrapper.find('.meta-username')
    expect(link.exists()).toBe(true)
    expect(link.attributes('to')).toBe('/users/bob')
  })

  it('TC-C09: expired-but-active shows expired badge', () => {
    const entry = makeEntry({ status: 'active', expiresAt: new Date(Date.now() - 86400000).toISOString() })
    const wrapper = mount(EntryListRow, { props: { entry }, global: { stubs: { BaseTag: true, BaseBadge: true } } })
    const badge = wrapper.findComponent({ name: 'BaseBadge' })
    expect(badge.props('status')).toBe('expired')
  })

  it('TC-D04: time element has title attribute for absolute time', () => {
    const entry = makeEntry()
    const wrapper = mount(EntryListRow, { props: { entry }, global: { stubs: { BaseTag: true, BaseBadge: true } } })
    const timeEl = wrapper.find('.meta-time')
    expect(timeEl.exists()).toBe(true)
    expect(timeEl.attributes('title')).toBe('2026-07-07 14:30')
  })
})
