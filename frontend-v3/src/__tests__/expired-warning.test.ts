// ⚠️ TC-D03/TC-D04 已被 TPV0102 有意取代（P2-design §6.4 第 6/7 项）：主显由
//    `<span :title=fullTime>{{relativeTime}}</span>` 改为 `<TimeDisplay>`——主显是绝对时间
//    （`.time-display__main`），完整时间移入 `role="tooltip"` 的 `[data-testid="time-tooltip"]`
//    节点。`title` 属性不再存在，故断言改为断言主显文本 + tooltip 文本；`useRelativeTime`
//    mock 相应补 `absolute` 字段（返回值形状由 `{relative,full}` 扩为 `{relative,full,absolute}`）。

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import EntryListRow from '@/components/EntryListRow.vue'
import type { Entry } from '@/types'

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))

vi.mock('@/composables/useRelativeTime', () => ({
  useRelativeTime: () => ({
    relative: ref('2d ago'),
    full: ref('2026-07-07 14:30 GMT+8 (Asia/Shanghai)'),
    absolute: ref('2026-07-07 14:30'),
  }),
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

  it('TC-B15: @username is a clickable link', () => {
    const entry = makeEntry({ username: 'bob' })
    const wrapper = mount(EntryListRow, { props: { entry }, global: { stubs: { BaseTag: true, BaseBadge: true } } })
    const link = wrapper.find('.meta-username')
    expect(link.exists()).toBe(true)
    expect(link.element.tagName.toLowerCase()).toBe('a')
    expect(link.text()).toContain('bob')
  })

  it('TC-C09: expired-but-active shows expired badge', () => {
    const entry = makeEntry({ status: 'active', expiresAt: new Date(Date.now() - 86400000).toISOString() })
    const wrapper = mount(EntryListRow, { props: { entry }, global: { stubs: { BaseTag: true, BaseBadge: true } } })
    const badge = wrapper.findComponent({ name: 'BaseBadge' })
    expect(badge.props('status')).toBe('expired')
  })

  it('TC-D04: time element exposes absolute time with full-time tooltip', () => {
    const entry = makeEntry()
    const wrapper = mount(EntryListRow, { props: { entry }, global: { stubs: { BaseTag: true, BaseBadge: true } } })
    const timeEl = wrapper.find('.meta-time')
    expect(timeEl.exists()).toBe(true)
    expect(timeEl.find('.time-display__main').text()).toBe('2026-07-07 14:30')
    expect(timeEl.find('[data-testid="time-tooltip"]').text()).toBe('2026-07-07 14:30 GMT+8 (Asia/Shanghai)')
  })
})
