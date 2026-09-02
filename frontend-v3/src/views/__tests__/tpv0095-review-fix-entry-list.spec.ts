import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'

// TPV0095 design-review F1 — teams-chip-row 按钮用独立 testid teams-chip-{slug}
// 不与 filter-chip-bar 的 FilterChip team-chip-{slug} 冲突（P2 §5.7 清单原义：team-chip-{slug} 是「具体 team chip（FilterChip）」）

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

describe('TPV0095 F1 — teams-chip-row 独立 testid', () => {
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
    mockTeamsLoaded.value = true
    mockOwned.value = [{ slug: 'proj-a', name: 'Proj A' }]
    mockJoined.value = []
    mockLoadEntries.mockClear()
    mockRouter.push.mockClear()
  })

  it('f1_row_button_uses_teams_chip_slug_testid', async () => {
    const wrapper = mount(EntryListView, { global: { stubs } })
    await wrapper.find('[data-testid="tab-teams"]').trigger('click')
    const rowBtn = wrapper.find('[data-testid="teams-chip-proj-a"]')
    expect(rowBtn.exists()).toBe(true)
    // row 按钮不带 FilterChip 的 team-chip- 前缀（去重，非 .team-chip class 专有）
    expect(rowBtn.attributes('data-testid')).toBe('teams-chip-proj-a')
  })

  it('f1_row_button_and_selected_filter_chip_do_not_share_testid', async () => {
    const wrapper = mount(EntryListView, { global: { stubs } })
    await wrapper.find('[data-testid="tab-teams"]').trigger('click')
    // 点 row 按钮选中 team → filter-chip-bar 出现 FilterChip team-chip-proj-a（§5.7）
    await wrapper.find('[data-testid="teams-chip-proj-a"]').trigger('click')
    const filterChip = wrapper.find('[data-testid="team-chip-proj-a"]')
    const rowBtn = wrapper.find('[data-testid="teams-chip-proj-a"]')
    expect(filterChip.exists()).toBe(true)
    expect(rowBtn.exists()).toBe(true)
    // 两元素 testid 互异（F1 修复点）
    expect(filterChip.attributes('data-testid')).not.toBe(rowBtn.attributes('data-testid'))
  })
})
