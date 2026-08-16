/**
 * TPV0093 star-lifecycle — P3 TDD 红灯测试（frontend）
 *
 * 覆盖 BDD-1 / BDD-2 / BDD-3 / BDD-6 / BDD-23：
 * - BDD-1: 登录用户星标公开内容，计数 +1（乐观更新 + 服务端校准）
 * - BDD-2: 同一用户重复星标不重复计数，提示"已于 X 月 X 日星标"
 * - BDD-3: 取消星标计数 -1，isStarred 回 false
 * - BDD-6: 前端乐观更新失败回滚（计数与 isStarred 均回滚）
 * - BDD-23: 归档期星标 Toast（两种文案：即将归档 / 已归档）
 *
 * 被测组件：src/components/StarToggle.vue（P4 新建，当前不存在 → 红灯）
 * 组件契约（P2-design §6.1）：
 *   props: { entry: Entry, authState: 'authenticated' | 'anonymous' }
 *   template: button[data-testid="star-toggle"]（aria-pressed）+ span[data-testid="star-count"]
 *   匿名点击 emit('open-login')；已登录点击调 api.star / api.unstar（乐观更新 + 回滚）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { useToast } from '@/composables/useToast'
import type { Entry } from '@/types'

vi.mock('@/api/client', () => ({
  api: {
    star: vi.fn(),
    unstar: vi.fn(),
    listEntries: vi.fn(),
    getEntry: vi.fn(),
  },
}))

import { api } from '@/api/client'
import StarToggle from '@/components/StarToggle.vue'

const mockStar = api.star as ReturnType<typeof vi.fn>
const mockUnstar = api.unstar as ReturnType<typeof vi.fn>

function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 1,
    slug: 'test-entry',
    summary: 'Test entry',
    tags: [],
    status: 'active',
    files: [],
    fileCount: 0,
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

describe('StarToggle — BDD-1: 登录用户星标公开内容，计数 +1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('TC-BDD1-01: 点击星标按钮后调用 api.star 且计数乐观 +1', async () => {
    const entry = makeEntry({ starCount: 5, isStarred: false })
    mockStar.mockResolvedValue({ star_count: 6, is_starred: true, already_starred: false })

    const wrapper = mount(StarToggle, {
      props: { entry, authState: 'authenticated' },
    })

    await wrapper.find('[data-testid="star-toggle"]').trigger('click')

    expect(mockStar).toHaveBeenCalledWith('test-entry')
    expect(wrapper.find('[data-testid="star-count"]').text()).toBe('6')
    await flushPromises()
    expect(wrapper.find('[data-testid="star-count"]').text()).toBe('6')
    expect(wrapper.find('[data-testid="star-toggle"]').attributes('aria-pressed')).toBe('true')
  })

  it('TC-BDD1-02: 未星标时 aria-pressed=false，星标后 aria-pressed=true', async () => {
    const entry = makeEntry({ starCount: 0, isStarred: false })
    mockStar.mockResolvedValue({ star_count: 1, is_starred: true, already_starred: false })

    const wrapper = mount(StarToggle, {
      props: { entry, authState: 'authenticated' },
    })

    expect(wrapper.find('[data-testid="star-toggle"]').attributes('aria-pressed')).toBe('false')
    await wrapper.find('[data-testid="star-toggle"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="star-toggle"]').attributes('aria-pressed')).toBe('true')
  })
})

describe('StarToggle — BDD-2: 同一用户重复星标不重复计数', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useToast().messages.value = []
  })

  it('TC-BDD2-01: already_starred=true 时计数不变且 Toast 提示"已于 X 月 X 日星标"', async () => {
    const entry = makeEntry({ starCount: 3, isStarred: true })
    mockStar.mockResolvedValue({ star_count: 3, is_starred: true, already_starred: true, created_at: '2026-08-01T00:00:00Z' })

    const wrapper = mount(StarToggle, {
      props: { entry, authState: 'authenticated' },
    })

    await wrapper.find('[data-testid="star-toggle"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="star-count"]').text()).toBe('3')
    const toast = useToast().messages.value
    expect(toast.some(t => /已于/.test(t.message) && /星标/.test(t.message))).toBe(true)
  })

  it('TC-BDD2-02: 重复星标 Toast 含日期（2026 年 8 月）', async () => {
    const entry = makeEntry({ starCount: 3, isStarred: true })
    mockStar.mockResolvedValue({ star_count: 3, is_starred: true, already_starred: true, created_at: '2026-08-01T00:00:00Z' })

    const wrapper = mount(StarToggle, {
      props: { entry, authState: 'authenticated' },
    })

    await wrapper.find('[data-testid="star-toggle"]').trigger('click')
    await flushPromises()

    const toast = useToast().messages.value
    const starToast = toast.find(t => /星标/.test(t.message))
    expect(starToast).toBeTruthy()
    expect(starToast!.message).toMatch(/8 月/)
  })
})

describe('StarToggle — BDD-3: 取消星标计数 -1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('TC-BDD3-01: 已星标时点击调用 api.unstar 且计数 -1', async () => {
    const entry = makeEntry({ starCount: 5, isStarred: true })
    mockUnstar.mockResolvedValue({ star_count: 4, is_starred: false })

    const wrapper = mount(StarToggle, {
      props: { entry, authState: 'authenticated' },
    })

    await wrapper.find('[data-testid="star-toggle"]').trigger('click')

    expect(mockUnstar).toHaveBeenCalledWith('test-entry')
    expect(wrapper.find('[data-testid="star-count"]').text()).toBe('4')
    await flushPromises()
    expect(wrapper.find('[data-testid="star-count"]').text()).toBe('4')
    expect(wrapper.find('[data-testid="star-toggle"]').attributes('aria-pressed')).toBe('false')
  })
})

describe('StarToggle — BDD-6: 前端乐观更新失败回滚', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('TC-BDD6-01: star 请求失败 → 计数回滚到原值且 isStarred 回滚为未星标', async () => {
    const entry = makeEntry({ starCount: 5, isStarred: false })
    mockStar.mockRejectedValue(new Error('Network error'))

    const wrapper = mount(StarToggle, {
      props: { entry, authState: 'authenticated' },
    })

    await wrapper.find('[data-testid="star-toggle"]').trigger('click')
    expect(wrapper.find('[data-testid="star-count"]').text()).toBe('6')

    await flushPromises()
    expect(wrapper.find('[data-testid="star-count"]').text()).toBe('5')
    expect(wrapper.find('[data-testid="star-toggle"]').attributes('aria-pressed')).toBe('false')
  })

  it('TC-BDD6-02: unstar 请求失败 → 计数回滚到原值且 isStarred 保持已星标', async () => {
    const entry = makeEntry({ starCount: 5, isStarred: true })
    mockUnstar.mockRejectedValue(new Error('Network error'))

    const wrapper = mount(StarToggle, {
      props: { entry, authState: 'authenticated' },
    })

    await wrapper.find('[data-testid="star-toggle"]').trigger('click')
    expect(wrapper.find('[data-testid="star-count"]').text()).toBe('4')

    await flushPromises()
    expect(wrapper.find('[data-testid="star-count"]').text()).toBe('5')
    expect(wrapper.find('[data-testid="star-toggle"]').attributes('aria-pressed')).toBe('true')
  })
})

describe('StarToggle — BDD-23: 归档期星标即时 Toast 提示（双文案）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useToast().messages.value = []
  })

  it('TC-BDD23-01: active 且距归档 <7 天 → Toast"该内容将于 X 月 X 日归档，星标后可长期保存"', async () => {
    const entry = makeEntry({
      status: 'active',
      starCount: 0,
      isStarred: false,
      expiresAt: new Date(Date.now() + 3 * 86400000).toISOString(),
    })
    mockStar.mockResolvedValue({ star_count: 1, is_starred: true, already_starred: false })

    const wrapper = mount(StarToggle, {
      props: { entry, authState: 'authenticated' },
    })

    await wrapper.find('[data-testid="star-toggle"]').trigger('click')
    await flushPromises()

    const toast = useToast().messages.value
    const archiveToast = toast.find(t => /归档/.test(t.message))
    expect(archiveToast).toBeTruthy()
    expect(archiveToast!.message).toMatch(/将于/)
    expect(archiveToast!.message).toMatch(/星标后可长期保存/)
  })

  it('TC-BDD23-02: archived 状态 → Toast"该内容已归档，星标后可长期保存"（不含"将于"）', async () => {
    const entry = makeEntry({
      status: 'archived',
      starCount: 0,
      isStarred: false,
      expiresAt: null,
      archivedAt: new Date(Date.now() - 86400000).toISOString(),
    })
    mockStar.mockResolvedValue({ star_count: 1, is_starred: true, already_starred: false })

    const wrapper = mount(StarToggle, {
      props: { entry, authState: 'authenticated' },
    })

    await wrapper.find('[data-testid="star-toggle"]').trigger('click')
    await flushPromises()

    const toast = useToast().messages.value
    const archiveToast = toast.find(t => /归档/.test(t.message))
    expect(archiveToast).toBeTruthy()
    expect(archiveToast!.message).toMatch(/已归档/)
    expect(archiveToast!.message).not.toMatch(/将于/)
    expect(archiveToast!.message).toMatch(/星标后可长期保存/)
  })
})
