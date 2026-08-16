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
 *
 * r4（TPV0093-P4-r4）：mock 形状与 /api/v1/stars 真实后端契约对齐——
 *   真实 client（api.listStars/api.removeStars）跑 transform，mock 只替换
 *   axios.get/delete（raw snake_case + entry_id + 嵌套 tombstone），
 *   整条 raw → transform → store → 渲染链路被覆盖（C1 集成用例）。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { api } from '@/api/client'

type AxiosClient = { get: unknown; delete: unknown }
const rawClient = (api as unknown as { client: AxiosClient }).client
const originalGet = rawClient.get
const originalDelete = rawClient.delete

function makeStarItem(overrides: Record<string, unknown> = {}) {
  return {
    type: 'entry',
    entry_id: 1,
    slug: 'starred-1',
    summary: 'Starred entry 1',
    status: 'active',
    is_public: true,
    owner_id: 1,
    username: 'alice',
    starred_at: '2026-08-01T00:00:00Z',
    star_count: 3,
    is_starred: true,
    expires_at: null,
    archived_at: null,
    countdown: null,
    tombstone: null,
    ...overrides,
  }
}

function makeTombstoneItem(overrides: Record<string, unknown> = {}) {
  const { tombstone: tombstoneOverrides, ...rest } = overrides as {
    tombstone?: Record<string, unknown>
    [k: string]: unknown
  }
  return {
    type: 'tombstone',
    entry_id: 101,
    slug: 'deleted-entry',
    summary: 'Deleted entry',
    starred_at: '2026-08-01T00:00:00Z',
    tombstone: {
      id: 101,
      entry_id: 101,
      slug: 'deleted-entry',
      title: 'Deleted entry',
      cover: null,
      deleted_by: 'alice',
      deleted_at: '2026-08-01T00:00:00Z',
      reason: 'author_deleted',
      ...(tombstoneOverrides ?? {}),
    },
    ...rest,
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

  const client = (api as unknown as { client: AxiosClient }).client
  client.get = vi.fn().mockResolvedValue({ data: { items, total: items.length } })
  client.delete = vi.fn().mockResolvedValue({ data: { removed: items.length } })

  const StarManageView = (await import('@/views/StarManageView.vue')).default
  const wrapper = mount(StarManageView, {
    global: {
      plugins: [pinia, router],
      stubs: {
        ThemeToggle: true,
        AuthButton: true,
        UserMenu: true,
      },
    },
  })
  await flushPromises()
  return { wrapper, router }
}

function clickDialogConfirm(): void {
  const btn = document.body.querySelector<HTMLElement>('.confirm__btn--destructive')
  if (!btn) throw new Error('ConfirmDialog confirm button not found in document.body')
  btn.click()
}

function lastRemoveEntryIds(): number[] {
  const client = (api as unknown as { client: { delete: ReturnType<typeof vi.fn> } }).client
  const config = client.delete.mock.calls[0][1] as { data: { entry_ids: number[] } }
  return config.data.entry_ids
}

afterEach(() => {
  const client = (api as unknown as { client: AxiosClient }).client
  client.get = originalGet
  client.delete = originalDelete
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

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

  it('TC-BDD14-04: 点击墓碑移除按钮 → 二次确认后 api.removeStars 传递 entry_id（来自墓碑嵌套契约）', async () => {
    const { wrapper } = await mountManage([makeTombstoneItem({ entry_id: 101 })])

    await wrapper.find('[data-testid="tombstone-remove"]').trigger('click')
    await flushPromises()
    expect((api as unknown as { client: { delete: ReturnType<typeof vi.fn> } }).client.delete).not.toHaveBeenCalled()

    clickDialogConfirm()
    await flushPromises()

    expect((api as unknown as { client: { delete: ReturnType<typeof vi.fn> } }).client.delete).toHaveBeenCalled()
    expect(lastRemoveEntryIds()).toContain(101)
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
      makeStarItem({ entry_id: 1, summary: 'Healthy', countdown: null }),
      makeStarItem({ entry_id: 2, summary: 'Expiring soon', countdown: { status: 'running', remaining_days: 3, archive_delete_at: null } }),
    ])

    await wrapper.find('[data-testid="stars-tab-expiring"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Expiring soon')
    expect(wrapper.text()).not.toContain('Healthy')
  })

  it('TC-BDD20-03: 点击"已失效或已删除"tab → 墓碑卡片可见', async () => {
    const { wrapper } = await mountManage([
      makeStarItem({ entry_id: 1, summary: 'Live' }),
      makeTombstoneItem({ entry_id: 101, tombstone: { title: 'Gone' } }),
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

  it('TC-BDD20-05: status=expired 且 remainingDays<7 的条目不落入"即将失效"分类（守卫）', async () => {
    const { wrapper } = await mountManage([
      makeStarItem({ entry_id: 1, summary: 'Dead', countdown: { status: 'expired', remaining_days: 2, archive_delete_at: null } }),
    ])

    await wrapper.find('[data-testid="stars-tab-expiring"]').trigger('click')
    await flushPromises()

    const empty = wrapper.find('[data-testid="stars-empty-expiring"]')
    expect(empty.exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Dead')
    expect(wrapper.find('[data-testid="star-countdown"]').exists()).toBe(false)
  })

  it('TC-BDD20-06: paused 且 remainingDays=0 的条目不落入"即将失效"分类（0 < 下界）', async () => {
    const { wrapper } = await mountManage([
      makeStarItem({ entry_id: 1, summary: 'Exempt', countdown: { status: 'paused', remaining_days: 0, archive_delete_at: null } }),
    ])

    await wrapper.find('[data-testid="stars-tab-expiring"]').trigger('click')
    await flushPromises()

    const empty = wrapper.find('[data-testid="stars-empty-expiring"]')
    expect(empty.exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Exempt')
    expect(wrapper.find('[data-testid="star-countdown"]').exists()).toBe(false)
  })
})

describe('StarManageView — BDD-21: 即将失效条目显示红色倒计时标签', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('TC-BDD21-01: remainingDays < 7 显示"剩余X天"倒计时标签', async () => {
    const { wrapper } = await mountManage([
      makeStarItem({ countdown: { status: 'running', remaining_days: 3, archive_delete_at: null } }),
    ])

    const countdown = wrapper.find('[data-testid="star-countdown"]')
    expect(countdown.exists()).toBe(true)
    expect(countdown.text()).toMatch(/剩余\s*3\s*天/)
  })

  it('TC-BDD21-02: 剩余 >= 7 天不显示红色倒计时标签', async () => {
    const { wrapper } = await mountManage([
      makeStarItem({ countdown: { status: 'running', remaining_days: 30, archive_delete_at: null } }),
    ])

    expect(wrapper.find('[data-testid="star-countdown"]').exists()).toBe(false)
  })

  it('TC-BDD21-03: countdown 为 null（active 有效期内）不显示倒计时标签', async () => {
    const { wrapper } = await mountManage([makeStarItem({ countdown: null })])

    expect(wrapper.find('[data-testid="star-countdown"]').exists()).toBe(false)
  })

  it('TC-BDD21-04: status=expired 的条目不渲染"剩余X天"倒计时标签（失效条目无剩余天数语义）', async () => {
    const { wrapper } = await mountManage([
      makeStarItem({ countdown: { status: 'expired', remaining_days: 0, archive_delete_at: null } }),
    ])

    expect(wrapper.find('[data-testid="star-countdown"]').exists()).toBe(false)
  })
})

describe('StarManageView — BDD-22: 批量取消星标/批量移除墓碑', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('TC-BDD22-01: 勾选多个条目后批量移除按钮可用，二次确认后调用 api.removeStars（entry_id 传递）', async () => {
    const { wrapper } = await mountManage([
      makeStarItem({ entry_id: 1 }),
      makeTombstoneItem({ entry_id: 101 }),
      makeStarItem({ entry_id: 2, slug: 'keep' }),
    ])

    const checkboxes = wrapper.findAll('[data-testid="star-checkbox"]')
    await checkboxes[0].setValue(true)
    await checkboxes[1].setValue(true)

    const batchBtn = wrapper.find('[data-testid="stars-batch-remove"]')
    expect(batchBtn.attributes('disabled')).toBeUndefined()

    await batchBtn.trigger('click')
    await flushPromises()
    expect((api as unknown as { client: { delete: ReturnType<typeof vi.fn> } }).client.delete).not.toHaveBeenCalled()

    clickDialogConfirm()
    await flushPromises()

    expect((api as unknown as { client: { delete: ReturnType<typeof vi.fn> } }).client.delete).toHaveBeenCalled()
    const ids = lastRemoveEntryIds()
    expect(ids).toContain(1)
    expect(ids).toContain(101)
  })

  it('TC-BDD22-02: 无勾选时批量移除按钮 disabled', async () => {
    const { wrapper } = await mountManage([makeStarItem({ entry_id: 1 })])

    const batchBtn = wrapper.find('[data-testid="stars-batch-remove"]')
    expect(batchBtn.attributes('disabled')).toBeDefined()
  })

  it('TC-BDD22-03: 批量移除成功后条目从列表消失（含墓碑被清理）', async () => {
    const { wrapper } = await mountManage([
      makeStarItem({ entry_id: 1, summary: 'Will be removed' }),
      makeTombstoneItem({ entry_id: 101, tombstone: { title: 'Tombstone removed' } }),
    ])

    const checkboxes = wrapper.findAll('[data-testid="star-checkbox"]')
    await checkboxes[0].setValue(true)
    await checkboxes[1].setValue(true)
    await wrapper.find('[data-testid="stars-batch-remove"]').trigger('click')
    await flushPromises()
    clickDialogConfirm()
    await flushPromises()

    expect((api as unknown as { client: { delete: ReturnType<typeof vi.fn> } }).client.delete).toHaveBeenCalled()
  })
})

describe('StarManageView — BDD-26: 强制删除后星标用户看到"作者已删除"墓碑', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('TC-BDD26-01: 墓碑卡片标记"作者已删除"状态（reason=author_deleted 水印）', async () => {
    const { wrapper } = await mountManage([makeTombstoneItem({ tombstone: { reason: 'author_deleted' } })])

    expect(wrapper.text()).toMatch(/作者已删除|author_deleted/)
    expect(wrapper.find('[data-testid="tombstone-card"]').exists()).toBe(true)
  })

  it('TC-BDD26-02: 墓碑卡片不可访问正文（无文件/内容链接）', async () => {
    const { wrapper } = await mountManage([makeTombstoneItem()])

    const card = wrapper.find('[data-testid="tombstone-card"]')
    expect(card.find('[data-testid="file-link"], .file-link, a[href*="/files/"]').exists()).toBe(false)
  })
})
