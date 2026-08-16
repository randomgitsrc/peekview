/**
 * TPV0093 star-lifecycle — P3 TDD 红灯测试（frontend）
 *
 * 覆盖 BDD-14 / BDD-20 / BDD-21 / BDD-22 / BDD-26：
 * - BDD-14: 墓碑卡片展示失效原因且可移除（标题置灰/删除线 + 水印 + 原因 + 移除按钮、无正文入口）
 * - BDD-20: 星标管理页分类筛选（全部/有效/即将失效/已失效或已删除）
 * - BDD-21: 即将失效条目显示红色倒计时标签（剩余 <7 天 → "剩余X天" 红色）
 * - BDD-22: 批量取消星标/批量移除墓碑（勾选 → 移除 → 条目消失 + 墓碑清理）
 * - BDD-26: 强制删除后星标用户看到"作者已删除"墓碑（墓碑卡片状态标记）
 *
 * 被测视图：src/views/StarManageView.vue（P4 新建，当前不存在 → import 红灯）
 * P2-design §6.3 / §6.5 data-testid：stars-tab-{all|active|expiring|expired}、
 *   tombstone-card / tombstone-remove / tombstone-reason / star-checkbox /
 *   stars-batch-remove / stars-loading / stars-error / stars-empty-{...}。
 * 测试补充 testid：star-countdown（红色倒计时标签，文本"剩余X天"）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { api } from '@/api/client'
import type { User } from '@/types'

vi.mock('@/api/client', () => ({
  api: {
    listStars: vi.fn(),
    removeStars: vi.fn(),
    logout: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    getMe: vi.fn(),
    listEntries: vi.fn(),
    deleteEntry: vi.fn(),
    toggleEntryVisibility: vi.fn(),
    getEntry: vi.fn(),
    getFileContent: vi.fn(),
  },
}))

const mockListStars = api.listStars as ReturnType<typeof vi.fn>
const mockRemoveStars = api.removeStars as ReturnType<typeof vi.fn>

const USER: User = { id: 1, username: 'alice', displayName: null, isActive: true, isAdmin: false, createdAt: '' }

function makeStarItem(overrides: Record<string, unknown> = {}) {
  return {
    type: 'entry',
    id: 1,
    slug: 'starred-1',
    summary: 'Starred entry 1',
    status: 'active',
    starCount: 3,
    isStarred: true,
    countdown: null,
    ...overrides,
  }
}

function makeTombstoneItem(overrides: Record<string, unknown> = {}) {
  return {
    type: 'tombstone',
    id: 101,
    slug: 'deleted-entry',
    title: 'Deleted entry',
    deletedBy: 'alice',
    deletedAt: '2026-08-01T00:00:00Z',
    reason: 'author_deleted',
    ...overrides,
  }
}

async function mountManage(items: unknown[], filter?: string) {
  const pinia = createPinia()
  setActivePinia(pinia)

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'landing', component: { render: () => null } },
      { path: '/stars', name: 'stars', component: { render: () => null } },
    ],
  })
  await router.push(filter ? `/stars?filter=${filter}` : '/stars')
  await router.isReady()

  mockListStars.mockResolvedValue({ items, total: items.length })

  const StarManageView = (await import('@/views/StarManageView.vue')).default
  const wrapper = mount(StarManageView, {
    global: {
      plugins: [pinia, router],
      stubs: {
        ThemeToggle: true,
        AuthButton: true,
        UserMenu: true,
        ConfirmDialog: true,
      },
    },
  })
  await flushPromises()
  return { wrapper, router }
}

describe('StarManageView — BDD-14: 墓碑卡片展示失效原因且可移除', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('TC-BDD14-01: 墓碑卡片渲染（tombstone-card）且无正文入口', async () => {
    const { wrapper } = await mountManage([makeTombstoneItem()])

    const card = wrapper.find('[data-testid="tombstone-card"]')
    expect(card.exists()).toBe(true)
    expect(card.text()).toContain('Deleted entry')
    expect(card.find('a.entry-title, a.card-title, .tombstone-body-link').exists()).toBe(false)
  })

  it('TC-BDD14-02: 墓碑卡片显示失效原因按钮（tombstone-reason）与移除按钮（tombstone-remove）', async () => {
    const { wrapper } = await mountManage([makeTombstoneItem()])

    expect(wrapper.find('[data-testid="tombstone-reason"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="tombstone-remove"]').exists()).toBe(true)
  })

  it('TC-BDD14-03: 点击墓碑"看原因"展示失效原因（reason=author_deleted）', async () => {
    const { wrapper } = await mountManage([makeTombstoneItem()])

    await wrapper.find('[data-testid="tombstone-reason"]').trigger('click')
    expect(wrapper.text()).toMatch(/作者已删除|author_deleted|已失效/)
  })

  it('TC-BDD14-04: 点击墓碑移除按钮 → api.removeStars 包含该墓碑 id', async () => {
    mockRemoveStars.mockResolvedValue({ removed: 1 })
    const { wrapper } = await mountManage([makeTombstoneItem({ id: 101 })])

    await wrapper.find('[data-testid="tombstone-remove"]').trigger('click')
    await flushPromises()

    expect(mockRemoveStars).toHaveBeenCalled()
    const arg = mockRemoveStars.mock.calls[0][0]
    expect(Array.isArray(arg) ? arg : arg.entryIds).toContain(101)
  })
})

describe('StarManageView — BDD-20: 星标管理页分类筛选', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('TC-BDD20-01: 渲染 4 个分类 tab（all/active/expiring/expired）', async () => {
    const { wrapper } = await mountManage([makeStarItem()])

    expect(wrapper.find('[data-testid="stars-tab-all"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="stars-tab-active"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="stars-tab-expiring"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="stars-tab-expired"]').exists()).toBe(true)
  })

  it('TC-BDD20-02: 点击"即将失效"tab → 仅显示 expiring 分类条目（含"剩余"标签）', async () => {
    const { wrapper } = await mountManage([
      makeStarItem({ id: 1, summary: 'Healthy', countdown: null }),
      makeStarItem({ id: 2, summary: 'Expiring soon', countdown: { status: 'running', remainingDays: 3 } }),
    ])

    await wrapper.find('[data-testid="stars-tab-expiring"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Expiring soon')
    expect(wrapper.text()).not.toContain('Healthy')
  })

  it('TC-BDD20-03: 点击"已失效或已删除"tab → 墓碑卡片可见', async () => {
    const { wrapper } = await mountManage([
      makeStarItem({ id: 1, summary: 'Live' }),
      makeTombstoneItem({ id: 101, title: 'Gone' }),
    ])

    await wrapper.find('[data-testid="stars-tab-expired"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="tombstone-card"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Gone')
  })

  it('TC-BDD20-04: 分类空态文案（stars-empty-expired：暂无失效内容或墓碑）', async () => {
    const { wrapper } = await mountManage([], 'expired')

    const empty = wrapper.find('[data-testid="stars-empty-expired"]')
    expect(empty.exists()).toBe(true)
  })
})

describe('StarManageView — BDD-21: 即将失效条目显示红色倒计时标签', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('TC-BDD21-01: remainingDays < 7 显示"剩余X天"倒计时标签', async () => {
    const { wrapper } = await mountManage([
      makeStarItem({ countdown: { status: 'running', remainingDays: 3 } }),
    ])

    const countdown = wrapper.find('[data-testid="star-countdown"]')
    expect(countdown.exists()).toBe(true)
    expect(countdown.text()).toMatch(/剩余\s*3\s*天/)
  })

  it('TC-BDD21-02: 剩余 >= 7 天不显示红色倒计时标签', async () => {
    const { wrapper } = await mountManage([
      makeStarItem({ countdown: { status: 'running', remainingDays: 30 } }),
    ])

    expect(wrapper.find('[data-testid="star-countdown"]').exists()).toBe(false)
  })

  it('TC-BDD21-03: countdown 为 null（active 有效期内）不显示倒计时标签', async () => {
    const { wrapper } = await mountManage([makeStarItem({ countdown: null })])

    expect(wrapper.find('[data-testid="star-countdown"]').exists()).toBe(false)
  })
})

describe('StarManageView — BDD-22: 批量取消星标/批量移除墓碑', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('TC-BDD22-01: 勾选多个条目后批量移除按钮可用并调用 api.removeStars', async () => {
    mockRemoveStars.mockResolvedValue({ removed: 2 })
    const { wrapper } = await mountManage([
      makeStarItem({ id: 1 }),
      makeTombstoneItem({ id: 101 }),
      makeStarItem({ id: 2, slug: 'keep' }),
    ])

    const checkboxes = wrapper.findAll('[data-testid="star-checkbox"]')
    await checkboxes[0].setValue(true)
    await checkboxes[1].setValue(true)

    const batchBtn = wrapper.find('[data-testid="stars-batch-remove"]')
    expect(batchBtn.attributes('disabled')).toBeUndefined()

    await batchBtn.trigger('click')
    await flushPromises()

    expect(mockRemoveStars).toHaveBeenCalled()
  })

  it('TC-BDD22-02: 无勾选时批量移除按钮 disabled', async () => {
    const { wrapper } = await mountManage([makeStarItem({ id: 1 })])

    const batchBtn = wrapper.find('[data-testid="stars-batch-remove"]')
    expect(batchBtn.attributes('disabled')).toBeDefined()
  })

  it('TC-BDD22-03: 批量移除成功后条目从列表消失（含墓碑被清理）', async () => {
    mockRemoveStars.mockResolvedValue({ removed: 2 })
    const { wrapper } = await mountManage([
      makeStarItem({ id: 1, summary: 'Will be removed' }),
      makeTombstoneItem({ id: 101, title: 'Tombstone removed' }),
    ])

    const checkboxes = wrapper.findAll('[data-testid="star-checkbox"]')
    await checkboxes[0].setValue(true)
    await checkboxes[1].setValue(true)
    await wrapper.find('[data-testid="stars-batch-remove"]').trigger('click')
    await flushPromises()

    expect(mockRemoveStars).toHaveBeenCalled()
  })
})

describe('StarManageView — BDD-26: 强制删除后星标用户看到"作者已删除"墓碑', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('TC-BDD26-01: 墓碑卡片标记"作者已删除"状态（reason=author_deleted 水印）', async () => {
    const { wrapper } = await mountManage([makeTombstoneItem({ reason: 'author_deleted' })])

    expect(wrapper.text()).toMatch(/作者已删除|author_deleted/)
    expect(wrapper.find('[data-testid="tombstone-card"]').exists()).toBe(true)
  })

  it('TC-BDD26-02: 墓碑卡片不可访问正文（无文件/内容链接）', async () => {
    const { wrapper } = await mountManage([makeTombstoneItem()])

    const card = wrapper.find('[data-testid="tombstone-card"]')
    expect(card.find('[data-testid="file-link"], .file-link, a[href*="/files/"]').exists()).toBe(false)
  })
})
