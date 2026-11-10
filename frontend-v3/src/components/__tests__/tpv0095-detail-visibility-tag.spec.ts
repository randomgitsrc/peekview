import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, computed } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import EntryDetailHeader from '@/components/EntryDetailHeader.vue'
import { ZenModeKey, IsMobileKey } from '@/composables/entryDetailKeys'
import type { Entry } from '@/types'

// TPV0095 BDD-44 [SCOPE+]：detail 头部状态标签三态（team / private / public）
//
// TPV0102 显式取代登记（P2 §6.4 第 5 项，禁止静默改）：
//   本文件原以 `wrapper.find('.status-tag')` 取出只读标签文本做三态断言。
//   TPV0102 D8 把详情页的只读 `.status-tag` 原位**替换**为 `VisibilityMenu`（桌面 `variant="inline"`），
//   `.status-tag` 不再承载可见性语义 → 定位改为菜单触发按钮 `[data-testid="visibility-toggle"]`，
//   读取其可见文本（文案逐字沿用 Public / Private / 仅团队可见 · {team.name}）。
//   三态覆盖点全部保留（team / private / public 各一条），仅换定位载体；
//   另新增一条守卫断言：`.status-tag` 不得再承载可见性文案（防替换退化成"替换 + 并存"）。
//   为何不能继续用 `.status-tag` 类名：`EntryDetailHeader.vue` 的 Archived / Expired 也带该类，
//   替换后同页会出现多个 `.status-tag`，`find()` 取首个会误命中。

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  onBeforeRouteLeave: vi.fn(),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => mockAuthStore,
  storeToRefs: (s: any) => ({
    user: s.user,
    isAdmin: s.isAdmin,
  }),
}))

const mockAuthStore = {
  user: ref(null),
  authState: ref('authenticated'),
  isAdmin: ref(false),
  logout: vi.fn(),
}

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), show: vi.fn() }),
}))

vi.mock('@/stores/theme', () => ({
  useThemeStore: () => ({ theme: ref('light'), toggle: vi.fn() }),
  storeToRefs: (s: any) => ({ theme: s.theme }),
}))

vi.mock('@/stores/entryDetail', () => ({
  useEntryDetailStore: () => ({}),
}))

function makeEntry(overrides: Partial<Entry> & Record<string, unknown> = {}): Entry {
  return {
    id: 1,
    slug: 'x',
    summary: 'X',
    tags: [],
    status: 'active',
    files: [],
    isPublic: false,
    ownerId: 7,
    username: 'alice',
    expiresAt: null,
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  } as Entry
}

const routerLinkStub = {
  template: '<a :href="to"><slot /></a>',
  props: ['to'],
}

function createWrapper(entry: Entry) {
  const isMobile = computed(() => false)
  const zenMode = ref(false)
  return mount(EntryDetailHeader, {
    props: {
      entryTitle: 'X',
      isExpiredButActive: false,
      isFileTreeOpen: false,
      isTocOpen: false,
      isMarkdown: false,
      tocHeadings: [],
      isMultiFile: false,
      canCopy: false,
      showShareButton: false,
      shareDialogOpen: false,
      activeShareCount: 0,
      overflowItems: [],
      authState: 'authenticated',
      currentEntry: entry,
      slug: 'x',
      teams: [],
      teamsFailed: false,
      isOwner: true,
      variant: 'inline',
    },
    global: {
      stubs: {
        'router-link': routerLinkStub,
        ShareDialog: true,
        OverflowMenu: true,
        ThemeToggle: true,
        StarToggle: true,
        UserMenu: true,
        AuthButton: true,
        BaseTag: true,
      },
      provide: {
        [IsMobileKey as symbol]: isMobile,
        [ZenModeKey as symbol]: zenMode,
      },
    },
  })
}

function visibilityToggleText(wrapper: ReturnType<typeof createWrapper>): string {
  const toggle = wrapper.find('[data-testid="visibility-toggle"]')
  return toggle.exists() ? toggle.text().trim() : ''
}

describe('TPV0095 EntryDetailHeader — 状态标签三态（BDD-44）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('__APP_VERSION__', '0.0.0-test')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('bdd44_team_entry_shows_team_semantics_not_private', () => {
    const wrapper = createWrapper(
      makeEntry({
        isPublic: false,
        teamId: 5,
        team: { slug: 'proj-a', name: 'Proj A' },
      }),
    )
    const text = visibilityToggleText(wrapper)
    expect(text).not.toContain('Private')
    expect(text.toLowerCase()).toContain('团队')
    expect(text).toContain('Proj A')
  })

  it('bdd44_private_entry_still_shows_private', () => {
    const wrapper = createWrapper(makeEntry({ isPublic: false }))
    expect(visibilityToggleText(wrapper)).toContain('Private')
  })

  it('bdd44_public_entry_still_shows_public', () => {
    const wrapper = createWrapper(makeEntry({ isPublic: true }))
    expect(visibilityToggleText(wrapper)).toContain('Public')
  })

  it('bdd44_status_tag_no_longer_carries_visibility_semantics', () => {
    const wrapper = createWrapper(makeEntry({ isPublic: true }))
    expect(wrapper.find('[data-testid="visibility-toggle"]').exists()).toBe(true)
    expect(wrapper.find('.status-tag').exists()).toBe(false)
  })
})
