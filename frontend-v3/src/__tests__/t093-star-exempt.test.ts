/**
 * TPV0093 star-lifecycle — P3 TDD 红灯测试（frontend）
 *
 * 覆盖 BDD-24 / BDD-25：
 * - BDD-24: 作者 Archived 列表显示星标豁免标签"因被 N 位用户星标，已暂停自动删除"，
 *           且不再显示"剩余 X 天删除"文案
 * - BDD-25: 作者强制删除需二次确认（明示 N 位用户星标将变为"作者已删除"），确认前不执行删除
 *
 * 被测组件：src/components/EntryCard.vue / EntryListRow.vue（已存在，P4 加豁免标签与强制删除）
 * P2-design §6.4 / §6.5 data-testid：star-exempt-label / star-exempt-help /
 *   force-delete / force-delete-confirm。footer 渲染条件扩展：isOwner && archived && starCount>0。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import EntryCard from '@/components/EntryCard.vue'
import EntryListRow from '@/components/EntryListRow.vue'
import type { Entry } from '@/types'

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))

vi.mock('@/composables/useRelativeTime', () => ({
  useRelativeTime: () => ({ relative: ref('2d ago'), full: ref('2026-07-07 14:30') }),
}))

function makeArchivedEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 1,
    slug: 'archived-starred',
    summary: 'Archived starred entry',
    tags: [],
    status: 'archived',
    files: [],
    fileCount: 0,
    isPublic: true,
    ownerId: 1,
    username: 'alice',
    expiresAt: null,
    archivedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('EntryCard — BDD-24: 作者 Archived 列表显示星标豁免标签', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('TC-BDD24-01: archived + starCount>0 + owner → 显示豁免标签（star-exempt-label）', () => {
    const entry = makeArchivedEntry({ starCount: 3, isStarred: false })
    const wrapper = mount(EntryCard, {
      props: { entry, isOwner: true },
      global: { stubs: { BaseTag: true, BaseBadge: true, ConfirmDialog: true } },
    })

    const label = wrapper.find('[data-testid="star-exempt-label"]')
    expect(label.exists()).toBe(true)
    expect(label.text()).toContain('因被 3 位用户星标')
    expect(label.text()).toContain('已暂停自动删除')
  })

  it('TC-BDD24-02: 豁免标签替换"剩余 X 天删除"文案（不再显示剩余天数）', () => {
    const entry = makeArchivedEntry({ starCount: 2 })
    const wrapper = mount(EntryCard, {
      props: { entry, isOwner: true },
      global: { stubs: { BaseTag: true, BaseBadge: true, ConfirmDialog: true } },
    })

    expect(wrapper.find('[data-testid="star-exempt-label"]').text()).toContain('因被 2 位用户星标')
    expect(wrapper.text()).not.toMatch(/剩余\s*\d+\s*天/)
  })

  it('TC-BDD24-03: archived + starCount=0（无星标）+ owner → 不显示豁免标签', () => {
    const entry = makeArchivedEntry({ starCount: 0 })
    const wrapper = mount(EntryCard, {
      props: { entry, isOwner: true },
      global: { stubs: { BaseTag: true, BaseBadge: true, ConfirmDialog: true } },
    })

    expect(wrapper.find('[data-testid="star-exempt-label"]').exists()).toBe(false)
  })

  it('TC-BDD24-04: 豁免标签含可点击帮助（star-exempt-help）', () => {
    const entry = makeArchivedEntry({ starCount: 3 })
    const wrapper = mount(EntryCard, {
      props: { entry, isOwner: true },
      global: { stubs: { BaseTag: true, BaseBadge: true, ConfirmDialog: true } },
    })

    const help = wrapper.find('[data-testid="star-exempt-help"]')
    expect(help.exists()).toBe(true)
    expect(help.element.tagName.toLowerCase()).toBe('button')
  })

  it('TC-BDD24-05: EntryListRow 同样显示豁免标签', () => {
    const entry = makeArchivedEntry({ starCount: 5 })
    const wrapper = mount(EntryListRow, {
      props: { entry, isOwner: true },
      global: { stubs: { BaseTag: true, BaseBadge: true, ConfirmDialog: true } },
    })

    const label = wrapper.find('[data-testid="star-exempt-label"]')
    expect(label.exists()).toBe(true)
    expect(label.text()).toContain('因被 5 位用户星标')
  })
})

describe('EntryCard — BDD-25: 作者强制删除需二次确认（明示星标影响）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('TC-BDD25-01: archived + 有星标 → 渲染"立即删除（强制）"按钮（force-delete）', () => {
    const entry = makeArchivedEntry({ starCount: 3 })
    const wrapper = mount(EntryCard, {
      props: { entry, isOwner: true },
      global: { stubs: { BaseTag: true, BaseBadge: true, ConfirmDialog: true } },
    })

    const forceDelete = wrapper.find('[data-testid="force-delete"]')
    expect(forceDelete.exists()).toBe(true)
  })

  it('TC-BDD25-02: 点击 force-delete → 弹出二次确认（force-delete-confirm）且明示 N 位用户星标', async () => {
    const entry = makeArchivedEntry({ starCount: 3 })
    const wrapper = mount(EntryCard, {
      props: { entry, isOwner: true },
      global: { stubs: { BaseTag: true, BaseBadge: true, ConfirmDialog: true } },
    })

    await wrapper.find('[data-testid="force-delete"]').trigger('click')
    await flushPromises()

    const confirm = wrapper.find('[data-testid="force-delete-confirm"]')
    expect(confirm.exists()).toBe(true)
    expect(confirm.text()).toMatch(/3\s*位用户/)
    expect(confirm.text()).toMatch(/作者已删除|将变为/)
  })

  it('TC-BDD25-03: 确认前不执行删除（不 emit delete 事件）', async () => {
    const entry = makeArchivedEntry({ starCount: 3 })
    const wrapper = mount(EntryCard, {
      props: { entry, isOwner: true },
      global: { stubs: { BaseTag: true, BaseBadge: true, ConfirmDialog: true } },
    })

    await wrapper.find('[data-testid="force-delete"]').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('delete')).toBeUndefined()
  })

  it('TC-BDD25-04: 确认后 emit delete 事件（强制删除走现有 deleteEntry → 后端建墓碑）', async () => {
    const entry = makeArchivedEntry({ starCount: 3 })
    const wrapper = mount(EntryCard, {
      props: { entry, isOwner: true },
      global: { stubs: { BaseTag: true, BaseBadge: true, ConfirmDialog: true } },
    })

    await wrapper.find('[data-testid="force-delete"]').trigger('click')
    await flushPromises()

    const confirm = wrapper.find('[data-testid="force-delete-confirm"]')
    await confirm.find('.confirm__btn--destructive, [data-testid="confirm-force-delete"]').trigger('click')
    await flushPromises()

    const emitted = wrapper.emitted('delete')
    expect(emitted).toBeTruthy()
    expect((emitted![0][0] as { slug: string }).slug).toBe('archived-starred')
  })

  it('TC-BDD25-05: 无星标（starCount=0）不渲染强制删除按钮（常规删除路径不变）', () => {
    const entry = makeArchivedEntry({ starCount: 0 })
    const wrapper = mount(EntryCard, {
      props: { entry, isOwner: true },
      global: { stubs: { BaseTag: true, BaseBadge: true, ConfirmDialog: true } },
    })

    expect(wrapper.find('[data-testid="force-delete"]').exists()).toBe(false)
  })
})
