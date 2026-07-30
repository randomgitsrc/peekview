import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, computed } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import EntryDetailHeader from '@/components/EntryDetailHeader.vue'
import { ZenModeKey, IsMobileKey } from '@/composables/entryDetailKeys'
import type { Entry } from '@/types'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  onBeforeRouteLeave: vi.fn(),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: ref(null),
    authState: ref('anonymous'),
    isAdmin: ref(false),
    logout: vi.fn(),
  }),
  storeToRefs: (s: any) => ({
    user: s.user,
    isAdmin: s.isAdmin,
  }),
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), show: vi.fn() }),
}))

vi.mock('@/stores/theme', () => ({
  useThemeStore: () => ({
    theme: ref('light'),
    toggle: vi.fn(),
  }),
  storeToRefs: (s: any) => ({ theme: s.theme }),
}))

const mockEntry: Entry = {
  id: 1,
  slug: 'test-entry',
  summary: 'Test entry summary',
  tags: ['vue', 'typescript', '前端'],
  status: 'active',
  files: [],
  isPublic: true,
  ownerId: 1,
  username: 'alice',
  expiresAt: null,
  archivedAt: null,
  createdAt: '2024-01-01T00:00:00Z',
}

const routerLinkStub = {
  template: '<a :href="to"><slot /></a>',
  props: ['to'],
}

function createWrapper(options: {
  isMobile?: boolean
  authState?: string
  entry?: Entry
} = {}) {
  const isMobileVal = options.isMobile ?? false
  const isMobile = computed(() => isMobileVal)
  const zenMode = ref(false)

  return mount(EntryDetailHeader, {
    props: {
      entryTitle: 'Test Entry',
      relativeTime: '2 hours ago',
      fullTime: '2024-01-01 00:00:00 UTC',
      isExpiredButActive: false,
      metaTagsHidden: false,
      isFileTreeOpen: false,
      isTocOpen: false,
      isMarkdown: true,
      tocHeadings: [],
      isMultiFile: false,
      canCopy: true,
      showShareButton: false,
      shareDialogOpen: false,
      activeShareCount: 0,
      overflowItems: [],
      authState: options.authState ?? 'anonymous',
      currentEntry: options.entry ?? mockEntry,
      slug: 'test-entry',
    },
    global: {
      stubs: {
        'router-link': routerLinkStub,
        ShareDialog: true,
        OverflowMenu: true,
        ThemeToggle: true,
        LoginDialog: true,
      },
      provide: {
        [IsMobileKey as symbol]: isMobile,
        [ZenModeKey as symbol]: zenMode,
      },
    },
  })
}

describe('EntryDetailHeader — T079', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('__APP_VERSION__', '0.0.0-test')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('BDD-05: Detail anonymous desktop shows secondary "Sign in"', () => {
    it('desktop header has AuthButton with secondary variant', () => {
      const wrapper = createWrapper({ isMobile: false, authState: 'anonymous' })
      const header = wrapper.find('.detail-header')
      expect(header.exists()).toBe(true)

      const btn = header.find('button')
      expect(btn.classes()).toContain('btn-secondary')
      expect(btn.text()).toBe('Sign in')
    })

    it('desktop header does NOT use primary variant for sign-in', () => {
      const wrapper = createWrapper({ isMobile: false, authState: 'anonymous' })
      const header = wrapper.find('.detail-header')
      const btn = header.find('button.btn-small, button.base-button')
      if (btn.exists()) {
        expect(btn.classes()).not.toContain('btn-primary')
      }
    })
  })

  describe('BDD-06: Detail anonymous mobile shows ghost "Sign in"', () => {
    it('mobile header has AuthButton with ghost variant', () => {
      const wrapper = createWrapper({ isMobile: true, authState: 'anonymous' })
      const mobileHeader = wrapper.find('.mobile-sticky-header')
      expect(mobileHeader.exists()).toBe(true)

      const btn = mobileHeader.find('button')
      expect(btn.exists()).toBe(true)
      expect(btn.classes()).toContain('btn-ghost')
      expect(btn.text()).toBe('Sign in')
    })

    it('mobile header does not use plain text link for sign-in', () => {
      const wrapper = createWrapper({ isMobile: true, authState: 'anonymous' })
      const mobileHeader = wrapper.find('.mobile-sticky-header')
      const plainLink = mobileHeader.find('.mobile-signin-link')
      expect(plainLink.exists()).toBe(false)
    })
  })

  describe('BDD-09: Detail desktop authenticated shows user menu', () => {
    it('desktop header shows UserMenu trigger when authenticated', () => {
      const wrapper = createWrapper({ isMobile: false, authState: 'authenticated' })
      const header = wrapper.find('.detail-header')
      const trigger = header.find('.user-menu-trigger')
      expect(trigger.exists()).toBe(true)
    })

    it('desktop header does not show AuthButton when authenticated', () => {
      const wrapper = createWrapper({ isMobile: false, authState: 'authenticated' })
      const header = wrapper.find('.detail-header')
      const signInBtn = header.find('button:has-text("Sign in")')
      expect(signInBtn.exists()).toBe(false)
    })

    it('desktop user menu opens to show Settings + Logout', async () => {
      const wrapper = createWrapper({ isMobile: false, authState: 'authenticated' })
      const header = wrapper.find('.detail-header')
      await header.find('.user-menu-trigger').trigger('click')
      await flushPromises()

      const items = header.findAll('.dropdown-item')
      expect(items.length).toBe(2)
      expect(items[0].text()).toBe('Settings')
      expect(items[1].text()).toBe('Logout')
    })
  })

  describe('BDD-10: Detail mobile authenticated shows user menu', () => {
    it('mobile header shows UserMenu trigger when authenticated', () => {
      const wrapper = createWrapper({ isMobile: true, authState: 'authenticated' })
      const mobileHeader = wrapper.find('.mobile-sticky-header')
      const trigger = mobileHeader.find('.user-menu-trigger')
      expect(trigger.exists()).toBe(true)
    })

    it('mobile header does not show AuthButton when authenticated', () => {
      const wrapper = createWrapper({ isMobile: true, authState: 'authenticated' })
      const mobileHeader = wrapper.find('.mobile-sticky-header')
      const signInBtn = mobileHeader.find('button:has-text("Sign in")')
      expect(signInBtn.exists()).toBe(false)
    })

    it('mobile user menu opens to show Settings + Logout', async () => {
      const wrapper = createWrapper({ isMobile: true, authState: 'authenticated' })
      const mobileHeader = wrapper.find('.mobile-sticky-header')
      await mobileHeader.find('.user-menu-trigger').trigger('click')
      await flushPromises()

      const items = mobileHeader.findAll('.dropdown-item')
      expect(items.length).toBe(2)
      expect(items[0].text()).toBe('Settings')
      expect(items[1].text()).toBe('Logout')
    })
  })

  describe('BDD-13: Detail desktop has no Explore button', () => {
    it('desktop header actions-area does not contain Explore router-link', () => {
      const wrapper = createWrapper({ isMobile: false })
      const actionsArea = wrapper.find('.actions-area')
      const exploreLinks = actionsArea.findAll('a')
      for (const link of exploreLinks) {
        expect(link.attributes('href')).not.toBe('/explore')
        expect(link.attributes('title')).not.toBe('Explore')
        expect(link.text()).not.toBe('Explore')
      }
    })

    it('desktop header does not contain CompassIcon', () => {
      const wrapper = createWrapper({ isMobile: false })
      const html = wrapper.html()
      expect(html).not.toContain('Explore')
    })
  })

  describe('BDD-14: Detail desktop tags are clickable BaseTag', () => {
    it('meta-row tags use BaseTag (a.base-tag) not span.meta-tag', () => {
      const wrapper = createWrapper({ isMobile: false, entry: mockEntry })
      const metaRow = wrapper.find('.meta-row')
      const baseTags = metaRow.findAll('.base-tag')
      expect(baseTags.length).toBe(mockEntry.tags.length)

      const oldMetaTags = metaRow.findAll('.meta-tag')
      expect(oldMetaTags.length).toBe(0)
    })

    it('meta-row BaseTag href points to /explore?tags=<encoded>', () => {
      const wrapper = createWrapper({ isMobile: false, entry: mockEntry })
      const metaRow = wrapper.find('.meta-row')
      const baseTags = metaRow.findAll('.base-tag')

      expect(baseTags[0].attributes('href')).toBe('/explore?tags=vue')
      expect(baseTags[1].attributes('href')).toBe('/explore?tags=typescript')
    })

    it('clicking a tag emits navigate event', async () => {
      const wrapper = createWrapper({ isMobile: false, entry: mockEntry })
      const metaRow = wrapper.find('.meta-row')
      const baseTags = metaRow.findAll('.base-tag')

      await baseTags[0].trigger('click')
      const baseTagComp = wrapper.findAllComponents({ name: 'BaseTag' })
      expect(baseTagComp.length).toBeGreaterThan(0)
      expect(baseTagComp[0].emitted('navigate')).toBeTruthy()
    })
  })

  describe('BDD-15: Detail mobile tags are clickable BaseTag', () => {
    it('meta-tags-bar tags use BaseTag not span.meta-tag', () => {
      const wrapper = createWrapper({ isMobile: true, entry: mockEntry })
      const metaTagsBar = wrapper.find('.meta-tags-bar')
      const baseTags = metaTagsBar.findAll('.base-tag')
      expect(baseTags.length).toBe(mockEntry.tags.length)

      const oldMetaTags = metaTagsBar.findAll('.meta-tag')
      expect(oldMetaTags.length).toBe(0)
    })

    it('meta-tags-bar BaseTag href points to /explore?tags=<encoded>', () => {
      const wrapper = createWrapper({ isMobile: true, entry: mockEntry })
      const metaTagsBar = wrapper.find('.meta-tags-bar')
      const baseTags = metaTagsBar.findAll('.base-tag')

      expect(baseTags[0].attributes('href')).toBe('/explore?tags=vue')
    })
  })

  describe('BDD-16: Detail Chinese tag is properly URL-encoded', () => {
    it('Chinese tag href is URL-encoded', () => {
      const entryWithChineseTag: Entry = {
        ...mockEntry,
        tags: ['前端'],
      }
      const wrapper = createWrapper({ isMobile: false, entry: entryWithChineseTag })
      const metaRow = wrapper.find('.meta-row')
      const baseTag = metaRow.find('.base-tag')

      expect(baseTag.exists()).toBe(true)
      const href = baseTag.attributes('href')
      expect(href).toContain('tags=')
      expect(href).not.toContain('tags=前端')
      expect(decodeURIComponent(href!.split('tags=')[1])).toBe('前端')
    })

    it('Chinese tag displays correct text', () => {
      const entryWithChineseTag: Entry = {
        ...mockEntry,
        tags: ['前端'],
      }
      const wrapper = createWrapper({ isMobile: false, entry: entryWithChineseTag })
      const metaRow = wrapper.find('.meta-row')
      const baseTag = metaRow.find('.base-tag')

      expect(baseTag.text()).toBe('前端')
    })
  })

  describe('Admin badge in Detail page user menu', () => {
    it('admin user shows admin badge in detail header trigger', async () => {
      vi.doMock('@/stores/auth', () => ({
        useAuthStore: () => ({
          user: ref({ id: 1, username: 'admin1', displayName: 'Admin', isActive: true, isAdmin: true, createdAt: '2024-01-01T00:00:00Z' }),
          authState: ref('authenticated'),
          isAdmin: ref(true),
          logout: vi.fn(),
        }),
        storeToRefs: (s: any) => ({
          user: s.user,
          isAdmin: s.isAdmin,
        }),
      }))

      const wrapper = createWrapper({ isMobile: false, authState: 'authenticated' })
      const header = wrapper.find('.detail-header')
      const badge = header.find('.admin-badge')
      expect(badge.exists()).toBe(true)
      expect(badge.text()).toBe('admin')
    })
  })

  describe('Empty tags array', () => {
    it('renders without error when entry has no tags', () => {
      const entryNoTags: Entry = { ...mockEntry, tags: [] }
      const wrapper = createWrapper({ isMobile: false, entry: entryNoTags })
      const metaRow = wrapper.find('.meta-row')
      const baseTags = metaRow.findAll('.base-tag')
      expect(baseTags.length).toBe(0)
    })

    it('mobile meta-tags-bar renders without error when entry has no tags', () => {
      const entryNoTags: Entry = { ...mockEntry, tags: [] }
      const wrapper = createWrapper({ isMobile: true, entry: entryNoTags })
      const metaTagsBar = wrapper.find('.meta-tags-bar')
      const baseTags = metaTagsBar.findAll('.base-tag')
      expect(baseTags.length).toBe(0)
    })
  })
})
