import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref, computed } from 'vue'

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

vi.mock('@/stores/entry', () => ({
  useEntryStore: () => ({
    entries: mockEntries,
    loading: mockLoading,
    error: mockError,
    total: mockTotal,
    perPage: mockPerPage,
    ownerFound: mockOwnerFound,
    loadEntries: vi.fn(),
    deleteEntry: vi.fn(),
    toggleEntryVisibility: vi.fn(),
  }),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: ref(null),
    authState: ref('anonymous'),
    isAdmin: ref(false),
    login: vi.fn(),
    logout: vi.fn(),
    checkAuth: vi.fn(),
  }),
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

vi.mock('@/composables/useDebounce', () => ({
  useDebounce: (fn: any) => fn,
}))

vi.mock('@/composables/useViewMode', () => ({
  loadViewMode: () => 'grid',
  saveViewMode: vi.fn(),
}))

vi.mock('@/views/searchUrl.logic', () => ({
  mergeQuery: vi.fn(() => ({})),
  parseRestoreQuery: vi.fn(() => ({ q: '', page: 1 })),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    currentRoute: { value: { query: {} } },
  }),
  onBeforeRouteUpdate: vi.fn(),
}))

vi.stubGlobal('__APP_VERSION__', '0.0.0-test')

import EntryListView from '@/views/EntryListView.vue'

const stubs = {
  'router-link': { template: '<a :href="to"><slot /></a>', props: ['to'] },
  SearchInput: {
    template: '<input :placeholder="placeholder" />',
    props: ['placeholder', 'modelValue'],
  },
  EntryCard: true,
  EntryListRow: true,
  EmptyState: true,
  BaseButton: true,
  ThemeToggle: true,
  Pagination: true,
  LoginDialog: true,
  ConfirmDialog: true,
  BannerBar: true,
  FilterChip: true,
}

describe('T031 EntryListView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockEntries.value = []
    mockLoading.value = false
    mockError.value = null
    mockTotal.value = 0
    mockOwnerFound.value = null
  })

  describe('BDD-4: search placeholder language', () => {
    it('search input placeholder should be English', () => {
      const wrapper = mount(EntryListView, {
        global: { stubs },
      })
      const input = wrapper.find('input[placeholder]')
      expect(input.exists()).toBe(true)
      const placeholder = input.attributes('placeholder') || ''
      expect(placeholder).not.toContain('搜索')
      expect(placeholder.toLowerCase()).toContain('search')
    })
  })

  describe('BDD-6: skeleton loading state', () => {
    it('loading state should show skeleton elements, not "Loading..." text', () => {
      mockLoading.value = true
      const wrapper = mount(EntryListView, {
        global: { stubs },
      })
      const loadingState = wrapper.find('.loading-state')
      if (loadingState.exists()) {
        expect(loadingState.text()).not.toContain('Loading...')
      }
      const skeleton = wrapper.find('.skeleton-card, .skeleton-row, [class*="skeleton"]')
      expect(skeleton.exists()).toBe(true)
    })
  })
})
