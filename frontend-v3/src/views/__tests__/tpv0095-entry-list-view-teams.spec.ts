import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'

// TPV0095 BDD-38/41/42/43 — EntryListView Teams tab / 不可用态 / 管理链接 / tablist 语义
// P3 红灯：EntryListView 现状 4 tab 无 Teams、无 tablist/aria-selected、无不可用态/空态容器、
//         无 teams-manage-link、restore 忽略 team/view → 各断言失败（被测未实现）。

vi.mock('pinia', async (importOriginal) => {
  const actual = await importOriginal<typeof import('pinia')>()
  return {
    ...actual,
    storeToRefs: (store: any) => {
      const refs: any = {}
      for (const key of Object.keys(store)) {
        const val = store[key]
        if (val && typeof val === 'object' && 'value' in val) {
          refs[key] = val
        }
      }
      return refs
    },
  }
})

const mockEntries = ref<any[]>([])
const mockLoading = ref(false)
const mockError = ref<string | null>(null)
const mockTotal = ref(0)
const mockPerPage = ref(20)
const mockOwnerFound = ref<boolean | null>(null)
const mockLoadEntries = vi.fn()
const mockDeleteEntry = vi.fn()

vi.mock('@/stores/entryList', () => ({
  useEntryListStore: () => ({
    entries: mockEntries,
    loading: mockLoading,
    error: mockError,
    total: mockTotal,
    perPage: mockPerPage,
    ownerFound: mockOwnerFound,
    loadEntries: mockLoadEntries,
    deleteEntry: mockDeleteEntry,
    toggleVisibility: vi.fn(),
  }),
}))

const mockUser = ref<any>(null)
const mockAuthState = ref('anonymous')
const mockIsAdmin = ref(false)
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: mockUser,
    authState: mockAuthState,
    isAdmin: mockIsAdmin,
    isOwner: () => false,
    login: vi.fn(),
    logout: vi.fn(),
    checkAuth: vi.fn(),
  }),
}))

// myTeams 快照（P2 §5.5：explore 与 /teams 共享 team store；登录后加载、登出清零）
const mockOwned = ref<any[]>([])
const mockJoined = ref<any[]>([])
const mockTeamsLoaded = ref(false)
const mockLoadMyTeams = vi.fn()
const mockIsMemberOf = vi.fn((slug: string) =>
  [...mockOwned.value, ...mockJoined.value].some((t) => t.slug === slug),
)
vi.mock('@/stores/team', () => ({
  useTeamStore: () => ({
    owned: mockOwned,
    joined: mockJoined,
    teamsLoaded: mockTeamsLoaded,
    loadMyTeams: mockLoadMyTeams,
    isMemberOf: mockIsMemberOf,
    reset: vi.fn(),
  }),
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), show: vi.fn() }),
}))

vi.mock('@/composables/useDebounce', () => ({
  useDebounce: (fn: any) => fn,
}))

vi.mock('@/composables/useViewMode', () => ({
  loadViewMode: () => 'grid',
  saveViewMode: vi.fn(),
}))

const mockRouter = { push: vi.fn(), replace: vi.fn() }
vi.mock('vue-router', () => ({
  useRouter: () => mockRouter,
  onBeforeRouteUpdate: vi.fn(),
}))

import EntryListView from '@/views/EntryListView.vue'

const stubs = {
  'router-link': { template: '<a :href="to"><slot /></a>', props: ['to'] },
  SearchInput: { template: '<input :placeholder="placeholder" />', props: ['placeholder', 'modelValue'] },
  EntryCard: true,
  EntryListRow: true,
  EmptyState: true,
  ThemeToggle: true,
  Pagination: true,
  LoginDialog: true,
  ConfirmDialog: true,
  BannerBar: true,
  AuthButton: true,
  UserMenu: true,
}

function setURL(pathAndQuery: string) {
  window.history.pushState({}, '', pathAndQuery)
}

function mountView() {
  return mount(EntryListView, {
    global: { stubs },
  })
}

const TABS = ['tab-all', 'tab-mine', 'tab-teams', 'tab-archived', 'tab-starred']

describe('TPV0095 EntryListView — Teams tab（BDD-38）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('__APP_VERSION__', '0.0.0-test')
    setURL('/explore')
    mockEntries.value = []
    mockLoading.value = false
    mockError.value = null
    mockTotal.value = 0
    mockPerPage.value = 20
    mockOwnerFound.value = null
    mockUser.value = { id: 7, username: 'alice', displayName: null, isActive: true, isAdmin: false, createdAt: '' }
    mockAuthState.value = 'authenticated'
    mockOwned.value = []
    mockJoined.value = []
    mockTeamsLoaded.value = false
    mockLoadEntries.mockClear()
    mockDeleteEntry.mockClear()
    mockLoadMyTeams.mockClear()
    mockRouter.push.mockClear()
  })

  it('bdd38_explore_renders_5_mutually_exclusive_tabs_for_authenticated', () => {
    const wrapper = mountView()
    expect(wrapper.findAll('.owner-tab')).toHaveLength(5)
    for (const testid of TABS) {
      expect(wrapper.find(`[data-testid="${testid}"]`).exists()).toBe(true)
    }
    // 顶栏出现 Teams tab：文本可辨识
    expect(wrapper.find('[data-testid="tab-teams"]').text()).toBe('Teams')
  })

  it('bdd38_clicking_teams_tab_activates_only_teams_and_clears_all', async () => {
    const wrapper = mountView()
    await wrapper.find('[data-testid="tab-teams"]').trigger('click')
    expect(wrapper.find('[data-testid="tab-teams"]').classes()).toContain('active')
    expect(wrapper.find('[data-testid="tab-all"]').classes()).not.toContain('active')
  })

  it('bdd38_teams_tab_aggregation_sends_team_me_and_url_view_teams', async () => {
    const wrapper = mountView()
    await wrapper.find('[data-testid="tab-teams"]').trigger('click')
    // team=me 聚合（P2 §5.1）——store 参数
    expect(mockLoadEntries).toHaveBeenCalledWith(
      expect.objectContaining({ team: 'me' }),
    )
    // URL 反映 view=teams
    const lastPush = mockRouter.push.mock.calls[mockRouter.push.mock.calls.length - 1]
    expect(lastPush).toBeTruthy()
    const query = lastPush[0]?.query ?? {}
    expect(query.view).toBe('teams')
  })
})

describe('TPV0095 EntryListView — 单一不可用态与空态（BDD-41）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('__APP_VERSION__', '0.0.0-test')
    mockEntries.value = []
    mockLoading.value = false
    mockError.value = null
    mockUser.value = { id: 7, username: 'alice', displayName: null, isActive: true, isAdmin: false, createdAt: '' }
    mockAuthState.value = 'authenticated'
    mockLoadEntries.mockClear()
    mockLoadMyTeams.mockClear()
    mockRouter.push.mockClear()
  })

  it('bdd41_unknown_team_slug_renders_unavailable_state_and_skips_list_call', async () => {
    setURL('/explore?team=ghost-team')
    mockTeamsLoaded.value = true
    mockOwned.value = []
    mockJoined.value = []
    const wrapper = mountView()
    // 判定依赖 myTeams settle 之后：slug ∉ myTeams → 团队不可用 + 清除 CTA，且不调 listEntries
    expect(wrapper.find('[data-testid="team-unavailable"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="team-unavailable-clear"]').exists()).toBe(true)
    expect(mockLoadEntries).not.toHaveBeenCalled()
  })

  it('bdd41_clear_cta_removes_team_filter_and_resumes_list', async () => {
    setURL('/explore?team=ghost-team')
    mockTeamsLoaded.value = true
    const wrapper = mountView()
    await wrapper.find('[data-testid="team-unavailable-clear"]').trigger('click')
    expect(wrapper.find('[data-testid="team-unavailable"]').exists()).toBe(false)
    expect(mockLoadEntries).toHaveBeenCalled()
    const lastPush = mockRouter.push.mock.calls[mockRouter.push.mock.calls.length - 1]
    const query = lastPush?.[0]?.query ?? lastPush?.[0] ?? {}
    expect(JSON.stringify(query)).not.toContain('ghost-team')
  })

  it('bdd41_teams_aggregation_empty_state_uses_teams_empty', async () => {
    setURL('/explore?view=teams')
    mockTeamsLoaded.value = true
    mockOwned.value = []
    mockJoined.value = []
    const wrapper = mountView()
    // 我无任何 team 的聚合空态：teams-empty（区别于 team-empty）
    expect(wrapper.find('[data-testid="teams-empty"]').exists()).toBe(true)
  })

  it('bdd41_member_team_with_no_content_uses_team_empty', async () => {
    setURL('/explore?team=proj-a')
    mockTeamsLoaded.value = true
    mockOwned.value = [{ slug: 'proj-a', name: 'Proj A' }]
    mockJoined.value = []
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="team-empty"]').exists()).toBe(true)
  })
})

describe('TPV0095 EntryListView — 管理团队链接（BDD-42 入口 DOM）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('__APP_VERSION__', '0.0.0-test')
    setURL('/explore')
    mockUser.value = { id: 7, username: 'alice', displayName: null, isActive: true, isAdmin: false, createdAt: '' }
    mockAuthState.value = 'authenticated'
    mockLoadEntries.mockClear()
    mockRouter.push.mockClear()
  })

  it('bdd42_teams_tab_contains_manage_teams_link_to_teams_page', async () => {
    const wrapper = mountView()
    await wrapper.find('[data-testid="tab-teams"]').trigger('click')
    const link = wrapper.find('[data-testid="teams-manage-link"]')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href') ?? link.attributes('to') ?? '').toContain('/teams')
  })
})

describe('TPV0095 EntryListView — tablist a11y 语义（BDD-43）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('__APP_VERSION__', '0.0.0-test')
    setURL('/explore')
    mockUser.value = { id: 7, username: 'alice', displayName: null, isActive: true, isAdmin: false, createdAt: '' }
    mockAuthState.value = 'authenticated'
  })

  it('bdd43_tab_bar_has_tablist_role_and_5_tabs_with_aria_selected', () => {
    const wrapper = mountView()
    const tablist = wrapper.find('[role="tablist"]')
    expect(tablist.exists()).toBe(true)
    const tabs = tablist.findAll('[role="tab"]')
    expect(tabs).toHaveLength(5)
    for (const tab of tabs) {
      expect(tab.attributes('aria-selected')).toBeTruthy()
    }
  })
})
