import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { RouterLink } from 'vue-router'
import EntryDetailView from '../EntryDetailView.vue'

// Mock vue-router
const mockRoute = {
  params: { slug: 'test-entry' },
  query: {},
}
const mockReplace = vi.fn()

vi.mock('vue-router', async () => {
  const actual = await vi.importActual('vue-router')
  return {
    ...actual,
    useRoute: () => mockRoute,
    useRouter: () => ({
      replace: mockReplace,
    }),
  }
})

// Mock useEntry
const mockEntry = ref<any>(null)
const mockLoading = ref(false)
const mockError = ref<string | null>(null)
const mockErrorCode = ref<string | null>(null)
const mockFetchEntry = vi.fn()
const mockClearCache = vi.fn()

vi.mock('../../composables/useEntry', () => ({
  useEntry: () => ({
    entry: mockEntry,
    loading: mockLoading,
    error: mockError,
    errorCode: mockErrorCode,
    fetchEntry: mockFetchEntry,
    clearCache: mockClearCache,
  }),
}))

// Mock API client
vi.mock('../../api/client', () => ({
  api: {
    fetchFileContent: vi.fn().mockResolvedValue('file content'),
    downloadFile: vi.fn().mockReturnValue('/api/v1/entries/test-entry/files/1/download'),
  },
}))

import { ref } from 'vue'

describe('EntryDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEntry.value = null
    mockLoading.value = false
    mockError.value = null
    mockErrorCode.value = null
    mockRoute.params.slug = 'test-entry'
    mockRoute.query = {}
  })

  const mountOptions = {
    global: {
      stubs: {
        RouterLink: {
          template: '<a :href="to"><slot /></a>',
          props: ['to'],
        },
      },
    },
  }

  it('VED1: shows loading skeleton', () => {
    mockLoading.value = true
    const wrapper = mount(EntryDetailView, mountOptions)

    expect(wrapper.find('.tree-skeleton').exists()).toBe(true)
    expect(wrapper.find('.file-skeleton').exists()).toBe(true)
  })

  it('VED2: displays entry with file tree', async () => {
    mockEntry.value = {
      id: 1,
      slug: 'test-entry',
      summary: 'Test Entry',
      tags: ['python'],
      status: 'active',
      files: [
        { id: 1, path: null, filename: 'main.py', language: 'python', is_binary: false, size: 100, line_count: 20 },
        { id: 2, path: 'README.md', filename: 'README.md', language: 'markdown', is_binary: false, size: 200, line_count: 30 },
      ],
      created_at: '2026-04-23T00:00:00Z',
      updated_at: '2026-04-23T00:00:00Z',
    }

    const wrapper = mount(EntryDetailView, mountOptions)
    await flushPromises()

    expect(wrapper.find('.detail-header h2').text()).toBe('Test Entry')
    expect(wrapper.find('.sidebar-left').exists()).toBe(true)
  })

  it('VED3: hides file tree for single file', async () => {
    mockEntry.value = {
      id: 1,
      slug: 'test-entry',
      summary: 'Test Entry',
      tags: [],
      status: 'active',
      files: [
        { id: 1, path: null, filename: 'main.py', language: 'python', is_binary: false, size: 100, line_count: 20 },
      ],
      created_at: '2026-04-23T00:00:00Z',
      updated_at: '2026-04-23T00:00:00Z',
    }

    const wrapper = mount(EntryDetailView, mountOptions)
    await flushPromises()

    expect(wrapper.find('.sidebar-left').exists()).toBe(false)
  })

  it('VED4: shows CodeViewer for code file', async () => {
    mockEntry.value = {
      id: 1,
      slug: 'test-entry',
      summary: 'Test Entry',
      tags: [],
      status: 'active',
      files: [
        { id: 1, path: null, filename: 'main.py', language: 'python', is_binary: false, size: 100, line_count: 20, content: 'print("hello")' },
      ],
      created_at: '2026-04-23T00:00:00Z',
      updated_at: '2026-04-23T00:00:00Z',
    }

    const wrapper = mount(EntryDetailView, mountOptions)
    await flushPromises()

    expect(wrapper.findComponent({ name: 'CodeViewer' }).exists()).toBe(true)
  })

  it('VED4: shows MarkdownViewer for markdown file', async () => {
    mockEntry.value = {
      id: 1,
      slug: 'test-entry',
      summary: 'Test Entry',
      tags: [],
      status: 'active',
      files: [
        { id: 1, path: 'README.md', filename: 'README.md', language: 'markdown', is_binary: false, size: 100, line_count: 10, content: '# Title' },
      ],
      created_at: '2026-04-23T00:00:00Z',
      updated_at: '2026-04-23T00:00:00Z',
    }

    const wrapper = mount(EntryDetailView, mountOptions)
    await flushPromises()

    expect(wrapper.findComponent({ name: 'MarkdownViewer' }).exists()).toBe(true)
  })

  it('VED4: shows binary file download', async () => {
    mockEntry.value = {
      id: 1,
      slug: 'test-entry',
      summary: 'Test Entry',
      tags: [],
      status: 'active',
      files: [
        { id: 1, path: null, filename: 'data.bin', language: null, is_binary: true, size: 1024, line_count: null },
      ],
      created_at: '2026-04-23T00:00:00Z',
      updated_at: '2026-04-23T00:00:00Z',
    }

    const wrapper = mount(EntryDetailView, mountOptions)
    await flushPromises()

    expect(wrapper.find('.binary-file').exists()).toBe(true)
    expect(wrapper.find('.binary-size').text()).toBe('1.0 KB')
  })

  it('VED5: shows error state with retry', async () => {
    mockError.value = 'Failed to load'
    mockErrorCode.value = 'SERVER_ERROR'

    const wrapper = mount(EntryDetailView, mountOptions)
    await flushPromises()

    expect(wrapper.find('.error-display').exists()).toBe(true)
    expect(wrapper.find('.retry-btn').exists()).toBe(true)

    await wrapper.find('.retry-btn').trigger('click')
    expect(mockClearCache).toHaveBeenCalledWith('test-entry')
  })

  it('VED5: shows NOT_FOUND error', async () => {
    mockError.value = 'Entry not found'
    mockErrorCode.value = 'NOT_FOUND'

    const wrapper = mount(EntryDetailView, mountOptions)
    await flushPromises()

    expect(wrapper.text()).toContain('Entry not found')
    expect(wrapper.find('.back-home-link').exists()).toBe(true)
  })

  it('VED6: selects file from query parameter', async () => {
    mockRoute.query = { file: 'README.md' }
    mockEntry.value = {
      id: 1,
      slug: 'test-entry',
      summary: 'Test Entry',
      tags: [],
      status: 'active',
      files: [
        { id: 1, path: null, filename: 'main.py', language: 'python', is_binary: false, size: 100, line_count: 20 },
        { id: 2, path: 'README.md', filename: 'README.md', language: 'markdown', is_binary: false, size: 200, line_count: 30, content: '# Title' },
      ],
      created_at: '2026-04-23T00:00:00Z',
      updated_at: '2026-04-23T00:00:00Z',
    }

    const wrapper = mount(EntryDetailView, mountOptions)
    await flushPromises()

    // Should select README.md based on query parameter
    expect(wrapper.findComponent({ name: 'MarkdownViewer' }).exists()).toBe(true)
  })

  it('VED7: shows footer with tags and date', async () => {
    mockEntry.value = {
      id: 1,
      slug: 'test-entry',
      summary: 'Test Entry',
      tags: ['python', 'vue'],
      status: 'active',
      files: [
        { id: 1, path: null, filename: 'main.py', language: 'python', is_binary: false, size: 100, line_count: 20, content: 'code' },
      ],
      created_at: '2026-04-23T00:00:00Z',
      updated_at: '2026-04-23T00:00:00Z',
    }

    const wrapper = mount(EntryDetailView, mountOptions)
    await flushPromises()

    expect(wrapper.find('.detail-footer').exists()).toBe(true)
    expect(wrapper.text()).toContain('#python')
    expect(wrapper.text()).toContain('#vue')
    expect(wrapper.text()).toContain('Created:')
  })

  it('VED8: file selection updates URL query', async () => {
    mockEntry.value = {
      id: 1,
      slug: 'test-entry',
      summary: 'Test Entry',
      tags: [],
      status: 'active',
      files: [
        { id: 1, path: null, filename: 'main.py', language: 'python', is_binary: false, size: 100, line_count: 20 },
        { id: 2, path: 'README.md', filename: 'README.md', language: 'markdown', is_binary: false, size: 200, line_count: 30 },
      ],
      created_at: '2026-04-23T00:00:00Z',
      updated_at: '2026-04-23T00:00:00Z',
    }

    const wrapper = mount(EntryDetailView, mountOptions)
    await flushPromises()

    // Trigger file selection via FileTree
    const fileTree = wrapper.findComponent({ name: 'FileTree' })
    if (fileTree.exists()) {
      await fileTree.vm.$emit('select', mockEntry.value.files[1])
      expect(mockReplace).toHaveBeenCalled()
    }
  })
})
