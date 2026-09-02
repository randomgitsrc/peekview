import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, computed } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import EntryDetailHeader from '@/components/EntryDetailHeader.vue'
import { ZenModeKey, IsMobileKey } from '@/composables/entryDetailKeys'
import type { Entry } from '@/types'

// TPV0095 BDD-44 [SCOPE+]：detail 头部状态标签三态（team / private / public）
// P2 §5.8 载体 = EntryDetailHeader + EntryMetaTagsBar，三态逻辑 teamId ? team 文案 : (isPublic?Public:Private)。
// P3 红灯：现状 .status-tag 按 currentEntry.isPublic 渲染 → team entry（isPublic=false）误显 "Private" → 断言失败。

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
      relativeTime: '2 hours ago',
      fullTime: '2026-01-01 00:00:00 UTC',
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

function statusTagText(wrapper: ReturnType<typeof createWrapper>): string {
  const tag = wrapper.find('.status-tag')
  return tag.exists() ? tag.text().trim() : ''
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
    const text = statusTagText(wrapper)
    expect(text).not.toContain('Private')
    expect(text.toLowerCase()).toContain('团队')
    expect(text).toContain('Proj A')
  })

  it('bdd44_private_entry_still_shows_private', () => {
    const wrapper = createWrapper(makeEntry({ isPublic: false }))
    expect(statusTagText(wrapper)).toContain('Private')
  })

  it('bdd44_public_entry_still_shows_public', () => {
    const wrapper = createWrapper(makeEntry({ isPublic: true }))
    expect(statusTagText(wrapper)).toContain('Public')
  })
})
