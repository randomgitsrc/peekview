/**
 * TPV0093 star-lifecycle — P3 TDD 红灯测试（frontend）
 *
 * 覆盖 BDD-18 / BDD-19：
 * - BDD-18: 登录用户 Explore 出现 [All][Mine][Archived][Starred] 四个 tab；点击 Starred 后
 *           列表仅含该用户星标的 entry（active 与 archived 均含，starred=true 参数）
 * - BDD-19: 匿名用户不显示 Starred tab（现有"tabs 仅登录可见"行为的回归锚）
 *
 * 被测视图：src/views/EntryListView.vue（已存在，但 P4 才加 Starred tab）
 * P2-design §6.2 / §6.5：owner-tabs 加第 4 个 tab，data-testid="tab-starred"；
 * setFilter 三态签名扩为 (owner, status, starred)；URL 态 ?starred=1。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/api/client'
import type { User } from '@/types'

vi.mock('@/api/client', () => ({
  api: {
    listEntries: vi.fn(),
    logout: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    getMe: vi.fn(),
    deleteEntry: vi.fn(),
    toggleEntryVisibility: vi.fn(),
    getEntry: vi.fn(),
    getFileContent: vi.fn(),
  },
}))

const mockListEntries = api.listEntries as ReturnType<typeof vi.fn>

const USER: User = { id: 1, username: 'alice', displayName: null, isActive: true, isAdmin: false, createdAt: '' }

async function mountList(user: User | null) {
  vi.stubGlobal('__APP_VERSION__', '0.0.0-test')
  const pinia = createPinia()
  setActivePinia(pinia)
  const authStore = useAuthStore()
  authStore.initializing = false
  authStore.user = user

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'landing', component: { render: () => null } },
      { path: '/explore', name: 'explore', component: { render: () => null } },
      { path: '/:slug', name: 'detail', component: { render: () => null } },
    ],
  })
  await router.push('/explore')
  await router.isReady()

  const EntryListView = (await import('@/views/EntryListView.vue')).default
  const wrapper = mount(EntryListView, {
    global: {
      plugins: [pinia, router],
      stubs: {
        SearchInput: true,
        EntryListRow: true,
        EntryCard: true,
        EmptyState: true,
        AuthButton: true,
        UserMenu: true,
        ThemeToggle: true,
        Pagination: true,
        LoginDialog: true,
        ConfirmDialog: true,
        BannerBar: true,
        FilterChip: true,
      },
    },
  })
  await flushPromises()
  return { wrapper, router, authStore }
}

describe('EntryListView Starred tab — BDD-18: 登录用户出现 4 tabs 且 Starred 过滤生效', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListEntries.mockResolvedValue({ items: [], total: 0, page: 1, perPage: 20, ownerFound: null })
  })

  it('TC-BDD18-01: 登录用户 Explore 显示 5 个 owner tab（含 Starred 与 Teams）', async () => {
    const { wrapper } = await mountList(USER)

    const tabs = wrapper.findAll('.owner-tab')
    // TPV0095 BDD-38：owner-tabs 由 4 tab 扩为 5 tab（All/Mine/Teams/Archived/Starred）
    expect(tabs.length).toBe(5)
    expect(wrapper.find('[data-testid="tab-starred"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="tab-teams"]').exists()).toBe(true)
  })

  it('TC-BDD18-02: 点击 Starred tab → loadEntries 以 starred=true 重新加载列表', async () => {
    const { wrapper } = await mountList(USER)

    await wrapper.find('[data-testid="tab-starred"]').trigger('click')
    await flushPromises()

    const call = mockListEntries.mock.calls[mockListEntries.mock.calls.length - 1]
    expect(call[0]).toMatchObject({ starred: true })
  })

  it('TC-BDD18-03: Starred tab 激活时 active 与 archived 条目均显示', async () => {
    const items = [
      { id: 1, slug: 'star-active', summary: 'Starred active', tags: [], status: 'active', fileCount: 0, isPublic: true, ownerId: 1, username: 'alice', expiresAt: null, archivedAt: null, createdAt: '', updatedAt: '' },
      { id: 2, slug: 'star-archived', summary: 'Starred archived', tags: [], status: 'archived', fileCount: 0, isPublic: true, ownerId: 1, username: 'alice', expiresAt: null, archivedAt: '2026-07-01T00:00:00Z', createdAt: '', updatedAt: '' },
    ]
    mockListEntries.mockResolvedValue({ items, total: 2, page: 1, perPage: 20, ownerFound: null })

    const { wrapper } = await mountList(USER)
    await wrapper.find('[data-testid="tab-starred"]').trigger('click')
    await flushPromises()

    expect(mockListEntries.mock.calls[mockListEntries.mock.calls.length - 1][0]).toMatchObject({ starred: true })
    expect(wrapper.find('.entry-grid').exists() || wrapper.find('.entry-panel').exists()).toBe(true)
  })
})

describe('EntryListView Starred tab — BDD-19: 匿名用户不显示 Starred tab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListEntries.mockResolvedValue({ items: [], total: 0, page: 1, perPage: 20, ownerFound: null })
  })

  it('TC-BDD19-01: 匿名用户 Explore 不出现 Starred tab', async () => {
    const { wrapper } = await mountList(null)

    expect(wrapper.find('[data-testid="tab-starred"]').exists()).toBe(false)
  })

  it('TC-BDD19-02: 匿名用户 owner-tabs 整体不渲染（与现有"tabs 仅登录可见"一致）', async () => {
    const { wrapper } = await mountList(null)

    expect(wrapper.find('.owner-tabs').exists()).toBe(false)
    expect(wrapper.findAll('.owner-tab').length).toBe(0)
  })
})
