import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'

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

const mockLoading = ref(true)
const mockError = ref<string | null>(null)
const mockCurrentEntry = ref<any>(null)
const mockActiveFile = ref<any>(null)
const mockFileContent = ref('')

vi.mock('@/stores/entry', () => ({
  useEntryStore: () => ({
    loading: mockLoading,
    error: mockError,
    currentEntry: mockCurrentEntry,
    activeFile: mockActiveFile,
    fileContent: mockFileContent,
    isMultiFile: false,
    canWrap: false,
    canCopy: false,
    loadEntry: vi.fn(),
    selectFile: vi.fn(),
  }),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: null,
    authState: 'anonymous',
    isAdmin: false,
  }),
}))

vi.mock('@/stores/share', () => ({
  useShareStore: () => ({
    shares: [],
    loadShares: vi.fn(),
  }),
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

vi.mock('@/composables/useShiki', () => ({
  useShiki: () => ({ highlight: vi.fn(() => ''), isReady: ref(true) }),
}))

vi.mock('@/composables/useMermaid', () => ({
  useMermaid: () => ({ render: vi.fn() }),
}))

vi.mock('@/composables/useMarkdown', () => ({
  useMarkdown: () => ({ render: vi.fn(() => '') }),
}))

vi.mock('@/composables/useViewMode', () => ({
  loadViewMode: () => 'grid',
  saveViewMode: vi.fn(),
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
  'router-link': { template: '<a :href="to"><slot /></a>', props: ['to'] },
  CodeViewer: true,
  MarkdownViewer: true,
  HtmlViewer: true,
  ImageViewer: true,
  FileTree: true,
  TocNav: true,
  ActionBar: true,
  ShareDialog: true,
  LoginDialog: true,
  ThemeToggle: true,
  BaseButton: true,
  BaseBadge: true,
  MermaidDiagram: true,
  OverflowMenu: true,
}

describe('T031 BDD-6: EntryDetailView skeleton', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockLoading.value = true
    mockError.value = null
    mockCurrentEntry.value = null
  })

  it('loading state should show skeleton elements, not "Loading..." text', () => {
    const wrapper = mount(EntryDetailView, {
      props: { slug: 'test-entry' },
      global: { stubs },
    })
    const loadingState = wrapper.find('.loading-state')
    if (loadingState.exists()) {
      expect(loadingState.text()).not.toContain('Loading...')
    }
    const skeleton = wrapper.find('[class*="skeleton"]')
    expect(skeleton.exists()).toBe(true)
  })
})
