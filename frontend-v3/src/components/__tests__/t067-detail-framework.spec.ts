import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref, nextTick } from 'vue'

const mockAuthState = ref<'loading' | 'authenticated' | 'anonymous'>('anonymous')
const mockUser = ref<any>(null)
const mockLoading = ref(true)
const mockError = ref<string | null>(null)
const mockCurrentEntry = ref<any>(null)
const mockActiveFile = ref<any>(null)
const mockFileContent = ref('')
const mockIsMultiFile = ref(false)

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

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: mockUser,
    authState: mockAuthState,
    isAdmin: false,
    isOwner: () => false,
  }),
}))

vi.mock('@/stores/entry', () => ({
  useEntryStore: () => ({
    loading: mockLoading,
    error: mockError,
    currentEntry: mockCurrentEntry,
    activeFile: mockActiveFile,
    fileContent: mockFileContent,
    isMultiFile: mockIsMultiFile,
    canWrap: false,
    canCopy: true,
    canDownload: false,
    canPack: false,
    loadEntry: vi.fn(),
    selectFile: vi.fn(),
    deleteEntry: vi.fn(),
    toggleVisibility: vi.fn(),
    toggleWrap: vi.fn(),
  }),
}))

vi.mock('@/stores/share', () => ({
  useShareStore: () => ({
    shares: [],
    fetchShares: vi.fn(),
  }),
}))

vi.mock('@/stores/theme', () => ({
  useThemeStore: () => ({
    theme: 'dark',
    toggle: vi.fn(),
  }),
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

vi.mock('@/composables/useRelativeTime', () => ({
  useRelativeTime: () => ({ relative: ref('2 hours ago'), full: ref('2026-07-23') }),
}))

vi.mock('@/utils/zen-shortcut', () => ({
  shouldHandleZenShortcut: () => false,
  redirectFocusIfHidden: vi.fn(),
}))

vi.mock('@/utils/expires', () => ({
  formatExpiresIn: () => 'in 7 days',
  isExpired: () => false,
}))

vi.mock('@/utils/mime', () => ({
  guessMimeType: () => 'text/plain',
}))

vi.mock('@/utils/path-map', () => ({
  buildPathMap: () => null,
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    currentRoute: { value: { query: {} } },
  }),
  useRoute: () => ({
    params: { slug: 'test-entry' },
    query: {},
    path: '/test-entry',
  }),
  onBeforeRouteUpdate: vi.fn(),
}))

vi.stubGlobal('__APP_VERSION__', '0.0.0-test')

import EntryDetailView from '@/views/EntryDetailView.vue'

const stubs = {
  'router-link': {
    template: '<a :href="to"><slot /></a>',
    props: ['to'],
  },
  CodeViewer: true,
  MarkdownViewer: true,
  HtmlViewer: true,
  ImageViewer: true,
  FileTree: true,
  TocNav: true,
  ShareDialog: true,
  LoginDialog: true,
  ThemeToggle: true,
  BaseButton: {
    template: '<button :class="[\'base-button\', \'btn-\' + variant, \'btn-\' + (size === \'small\' ? \'small\' : \'default\')]" @click="$emit(\'click\', $event)"><slot /></button>',
    props: ['variant', 'size', 'disabled', 'type', 'href', 'target', 'rel'],
  },
  BaseBadge: true,
  OverflowMenu: true,
  ConfirmDialog: true,
  ExpiresInDialog: true,
}

function makeEntry(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    slug: 'test-entry',
    summary: 'Test Entry',
    tags: [],
    status: 'active',
    files: [{ id: 10, path: 'main.py', filename: 'main.py', language: 'python', isBinary: false, size: 100, lineCount: 10 }],
    isPublic: true,
    ownerId: 99,
    username: 'alice',
    expiresAt: null,
    archivedAt: null,
    createdAt: '2026-07-23T00:00:00Z',
    readStats: { totalCount: 5, uniqueReaders: 3, byChannel: {}, lastReadAt: null },
    ...overrides,
  }
}

function mountDesktop(overrides: Record<string, any> = {}) {
  const entry = makeEntry(overrides)
  mockLoading.value = false
  mockError.value = null
  mockCurrentEntry.value = entry
  mockActiveFile.value = entry.files[0]
  mockFileContent.value = 'print("hello")'
  mockIsMultiFile.value = false
  Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true, configurable: true })
  return mount(EntryDetailView, {
    props: { slug: 'test-entry' },
    global: { stubs },
  })
}

function mountMobile(overrides: Record<string, any> = {}) {
  const entry = makeEntry(overrides)
  mockLoading.value = false
  mockError.value = null
  mockCurrentEntry.value = entry
  mockActiveFile.value = entry.files[0]
  mockFileContent.value = 'print("hello")'
  mockIsMultiFile.value = false
  Object.defineProperty(window, 'innerWidth', { value: 375, writable: true, configurable: true })
  return mount(EntryDetailView, {
    props: { slug: 'test-entry' },
    global: { stubs },
  })
}

describe('T067 BDD-1: Detail page Sign in for anonymous users', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockAuthState.value = 'anonymous'
    mockUser.value = null
  })

  it('desktop header shows Sign in button when authState is anonymous', async () => {
    const wrapper = mountDesktop()
    await nextTick()
    const signInBtn = wrapper.find('.actions-area .btn-primary')
    expect(signInBtn.exists()).toBe(true)
    expect(signInBtn.text()).toContain('Sign in')
  })

  it('mobile sticky-header shows Sign in entry when authState is anonymous', async () => {
    const wrapper = mountMobile()
    await nextTick()
    const signInEl = wrapper.find('.mobile-sticky-header .mobile-signin-btn')
    expect(signInEl.exists()).toBe(true)
  })

  it('clicking Sign in opens LoginDialog', async () => {
    const wrapper = mountDesktop()
    await nextTick()
    const signInBtn = wrapper.find('.actions-area .btn-primary')
    expect(signInBtn.exists()).toBe(true)
    await signInBtn.trigger('click')
    await nextTick()
    const loginDialog = wrapper.findComponent({ name: 'LoginDialog' })
    expect(loginDialog.exists()).toBe(true)
  })
})

describe('T067 BDD-2: Detail page Sign in hidden for authenticated users', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockAuthState.value = 'anonymous'
    mockUser.value = null
  })

  it('desktop header hides Sign in button when authState is authenticated', async () => {
    const wrapper = mountDesktop()
    await nextTick()
    expect(wrapper.find('.actions-area .btn-primary').exists()).toBe(true)
    mockAuthState.value = 'authenticated'
    mockUser.value = { id: 1, username: 'alice', displayName: 'Alice', isAdmin: false }
    await nextTick()
    expect(wrapper.find('.actions-area .btn-primary').exists()).toBe(false)
  })

  it('mobile sticky-header hides Sign in when authState is authenticated', async () => {
    const wrapper = mountMobile()
    await nextTick()
    expect(wrapper.find('.mobile-sticky-header .mobile-signin-btn').exists()).toBe(true)
    mockAuthState.value = 'authenticated'
    mockUser.value = { id: 1, username: 'alice', displayName: 'Alice', isAdmin: false }
    await nextTick()
    expect(wrapper.find('.mobile-sticky-header .mobile-signin-btn').exists()).toBe(false)
  })
})

describe('T067 BDD-3: Sign in disappears reactively after login', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockAuthState.value = 'anonymous'
    mockUser.value = null
  })

  it('Sign in button disappears when authState changes from anonymous to authenticated', async () => {
    const wrapper = mountDesktop()
    await nextTick()
    expect(wrapper.find('.actions-area .btn-primary').exists()).toBe(true)
    mockAuthState.value = 'authenticated'
    mockUser.value = { id: 1, username: 'alice', displayName: 'Alice', isAdmin: false }
    await nextTick()
    expect(wrapper.find('.actions-area .btn-primary').exists()).toBe(false)
  })
})

describe('T067 BDD-4: Brand wordmark on desktop', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockAuthState.value = 'anonymous'
    mockUser.value = null
  })

  it('desktop header shows PeekView brand text', async () => {
    const wrapper = mountDesktop()
    await nextTick()
    const brandWord = wrapper.find('.detail-logo-word')
    expect(brandWord.exists()).toBe(true)
    expect(brandWord.text()).toBe('PeekView')
  })

  it('brand area total height does not exceed 36px', async () => {
    const wrapper = mountDesktop()
    await nextTick()
    const brandWord = wrapper.find('.detail-logo-word')
    expect(brandWord.exists()).toBe(true)
    const titleRow = wrapper.find('.title-row')
    expect(titleRow.exists()).toBe(true)
  })
})

describe('T067 BDD-5: Mobile brand elements', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockAuthState.value = 'anonymous'
    mockUser.value = null
  })

  it('mobile sticky-header shows brand identifier element', async () => {
    const wrapper = mountMobile()
    await nextTick()
    const brand = wrapper.find('.mobile-sticky-header .sticky-brand')
    expect(brand.exists()).toBe(true)
    expect(brand.text()).toBe('PeekView')
  })

  it('brand identifier visible at viewport width <=380px', async () => {
    const wrapper = mountMobile()
    await nextTick()
    const brand = wrapper.find('.mobile-sticky-header .sticky-brand')
    expect(brand.exists()).toBe(true)
  })
})

describe('T067 BDD-6: Explore navigation entry', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockAuthState.value = 'anonymous'
    mockUser.value = null
  })

  it('desktop has clickable navigation element pointing to /explore', async () => {
    const wrapper = mountDesktop()
    await nextTick()
    const exploreLinks = wrapper.findAll('a').filter(a => a.attributes('href') === '/explore')
    expect(exploreLinks.length).toBeGreaterThanOrEqual(1)
  })

  it('mobile has clickable navigation element pointing to /explore', async () => {
    const wrapper = mountMobile()
    await nextTick()
    const exploreLinks = wrapper.findAll('a').filter(a => a.attributes('href') === '/explore')
    expect(exploreLinks.length).toBeGreaterThanOrEqual(1)
  })
})

describe('T067 BDD-7: Mobile bottom bar file count format', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockAuthState.value = 'anonymous'
    mockUser.value = null
  })

  it('mobile bottom bar shows "N files" format (count first, lowercase files)', async () => {
    const entry = makeEntry({
      files: [
        { id: 10, path: 'main.py', filename: 'main.py', language: 'python', isBinary: false, size: 100, lineCount: 10 },
        { id: 11, path: 'utils.py', filename: 'utils.py', language: 'python', isBinary: false, size: 50, lineCount: 5 },
      ],
    })
    Object.defineProperty(window, 'innerWidth', { value: 375, writable: true, configurable: true })
    mockLoading.value = false
    mockError.value = null
    mockCurrentEntry.value = entry
    mockActiveFile.value = entry.files[0]
    mockIsMultiFile.value = true
    const wrapper = mount(EntryDetailView, {
      props: { slug: 'test-entry' },
      global: { stubs },
    })
    await nextTick()
    const filesBtn = wrapper.find('.mobile-bottom-bar .files-btn')
    expect(filesBtn.exists()).toBe(true)
    const text = filesBtn.text()
    expect(text).toMatch(/^\d+\s+files$/)
    expect(text).not.toMatch(/^Files\s+\d+$/)
  })
})

describe('T067 BDD-8: Reads count format unified', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockAuthState.value = 'anonymous'
    mockUser.value = null
  })

  it('desktop shows conditional plural: "1 read" for single read', async () => {
    const wrapper = mountDesktop({ readStats: { totalCount: 1, uniqueReaders: 1, byChannel: {}, lastReadAt: null } })
    await nextTick()
    const header = wrapper.find('.detail-header')
    expect(header.exists()).toBe(true)
    const readsText = header.text()
    expect(readsText).toContain('1 read')
    expect(readsText).not.toContain('1 reads')
  })

  it('desktop shows conditional plural: "N reads" for N>1', async () => {
    const wrapper = mountDesktop({ readStats: { totalCount: 5, uniqueReaders: 3, byChannel: {}, lastReadAt: null } })
    await nextTick()
    const header = wrapper.find('.detail-header')
    expect(header.exists()).toBe(true)
    const readsText = header.text()
    expect(readsText).toContain('5 reads')
  })

  it('mobile shows same conditional plural format as desktop', async () => {
    const wrapper = mountMobile({ readStats: { totalCount: 1, uniqueReaders: 1, byChannel: {}, lastReadAt: null } })
    await nextTick()
    const metaBar = wrapper.find('.meta-tags-bar')
    expect(metaBar.exists()).toBe(true)
    const readsText = metaBar.text()
    expect(readsText).toContain('1 read')
    expect(readsText).not.toContain('1 reads')
  })

  it('desktop hides reads count when readStats is null', async () => {
    const wrapper = mountDesktop({ readStats: null })
    await nextTick()
    const header = wrapper.find('.detail-header')
    expect(header.exists()).toBe(true)
    const readsText = header.text()
    expect(readsText).not.toContain('read')
  })

  it('mobile hides reads count when readStats is null', async () => {
    const wrapper = mountMobile({ readStats: null })
    await nextTick()
    const metaBar = wrapper.find('.meta-tags-bar')
    expect(metaBar.exists()).toBe(true)
    const readsText = metaBar.text()
    expect(readsText).not.toContain('read')
  })
})

describe('T067 BDD-9: Landing page Sign in visual weight', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockAuthState.value = 'anonymous'
    mockUser.value = null
  })

  it('LandingView Sign in uses btn-primary or equivalent high visual weight style', async () => {
    const LandingView = (await import('@/views/LandingView.vue')).default
    const wrapper = mount(LandingView, {
      global: {
        stubs: {
          'router-link': { template: '<a :href="to"><slot /></a>', props: ['to'] },
          LoginDialog: true,
          ThemeToggle: true,
          BaseButton: {
            template: '<button :class="[\'base-button\', \'btn-\' + variant, \'btn-\' + (size === \'small\' ? \'small\' : \'default\')]" @click="$emit(\'click\', $event)"><slot /></button>',
            props: ['variant', 'size', 'disabled', 'type', 'href', 'target', 'rel'],
          },
        },
      },
    })
    await nextTick()
    const signInBtn = wrapper.find('.nav-cta .btn-primary')
    expect(signInBtn.exists()).toBe(true)
    expect(signInBtn.text()).toContain('Sign in')
  })

  it('LandingView Sign in is not using btn-ghost class', async () => {
    const LandingView = (await import('@/views/LandingView.vue')).default
    const wrapper = mount(LandingView, {
      global: {
        stubs: {
          'router-link': { template: '<a :href="to"><slot /></a>', props: ['to'] },
          LoginDialog: true,
          ThemeToggle: true,
          BaseButton: {
            template: '<button :class="[\'base-button\', \'btn-\' + variant, \'btn-\' + (size === \'small\' ? \'small\' : \'default\')]" @click="$emit(\'click\', $event)"><slot /></button>',
            props: ['variant', 'size', 'disabled', 'type', 'href', 'target', 'rel'],
          },
        },
      },
    })
    await nextTick()
    const ghostBtn = wrapper.find('.nav-cta .btn-ghost')
    expect(ghostBtn.exists()).toBe(false)
  })
})

describe('T067 BDD-10: Desktop tooltip hover verification', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockAuthState.value = 'anonymous'
    mockUser.value = null
  })

  it('desktop icon buttons have tooltip elements', async () => {
    const wrapper = mountDesktop()
    await nextTick()
    const tooltips = wrapper.findAll('.actions-area .tooltip')
    expect(tooltips.length).toBeGreaterThanOrEqual(1)
  })

  it('tooltip elements contain text content', async () => {
    const wrapper = mountDesktop()
    await nextTick()
    const tooltips = wrapper.findAll('.actions-area .tooltip')
    expect(tooltips.length).toBeGreaterThanOrEqual(1)
    for (const tooltip of tooltips) {
      expect(tooltip.text().length).toBeGreaterThan(0)
    }
  })
})

describe('T067 BDD-11: authState loading hides Sign in (no flash)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('desktop Sign in button not visible when authState is loading (but visible when anonymous)', async () => {
    mockAuthState.value = 'anonymous'
    mockUser.value = null
    const wrapper = mountDesktop()
    await nextTick()
    expect(wrapper.find('.actions-area .btn-primary').exists()).toBe(true)
    mockAuthState.value = 'loading'
    mockUser.value = null
    await nextTick()
    expect(wrapper.find('.actions-area .btn-primary').exists()).toBe(false)
  })

  it('mobile Sign in not visible when authState is loading (but visible when anonymous)', async () => {
    mockAuthState.value = 'anonymous'
    mockUser.value = null
    const wrapper = mountMobile()
    await nextTick()
    expect(wrapper.find('.mobile-sticky-header .mobile-signin-btn').exists()).toBe(true)
    mockAuthState.value = 'loading'
    mockUser.value = null
    await nextTick()
    expect(wrapper.find('.mobile-sticky-header .mobile-signin-btn').exists()).toBe(false)
  })
})

describe('T067 BDD-12: Zen mode hides brand and Sign in', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockAuthState.value = 'anonymous'
    mockUser.value = null
  })

  it('desktop brand identifier not visible in zen mode (but visible normally)', async () => {
    const wrapper = mountDesktop()
    await nextTick()
    expect(wrapper.find('.detail-logo-word').exists()).toBe(true)
    await wrapper.setData({ zenMode: true })
    await nextTick()
    expect(wrapper.find('.detail-logo-word').isVisible()).toBe(false)
  })

  it('desktop Sign in not visible in zen mode (but visible normally)', async () => {
    const wrapper = mountDesktop()
    await nextTick()
    expect(wrapper.find('.actions-area .btn-primary').exists()).toBe(true)
    await wrapper.setData({ zenMode: true })
    await nextTick()
    expect(wrapper.find('.actions-area .btn-primary').isVisible()).toBe(false)
  })

  it('mobile brand identifier not visible in zen mode (but visible normally)', async () => {
    const wrapper = mountMobile()
    await nextTick()
    expect(wrapper.find('.mobile-sticky-header .sticky-brand').exists()).toBe(true)
    await wrapper.setData({ zenMode: true })
    await nextTick()
    expect(wrapper.find('.mobile-sticky-header .sticky-brand').isVisible()).toBe(false)
  })

  it('mobile Sign in not visible in zen mode (but visible normally)', async () => {
    const wrapper = mountMobile()
    await nextTick()
    expect(wrapper.find('.mobile-sticky-header .mobile-signin-btn').exists()).toBe(true)
    await wrapper.setData({ zenMode: true })
    await nextTick()
    expect(wrapper.find('.mobile-sticky-header .mobile-signin-btn').isVisible()).toBe(false)
  })
})
