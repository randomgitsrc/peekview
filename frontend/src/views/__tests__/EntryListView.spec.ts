import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, nextTick } from 'vue'
import EntryListView from '../EntryListView.vue'
import type { EntryListItem } from '../../types'

// Mock vue-router
const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

// Mock useEntryList
const mockEntries = ref<EntryListItem[]>([])
const mockTotal = ref(0)
const mockTotalPages = ref(1)
const mockLoading = ref(false)
const mockError = ref<string | null>(null)
const mockErrorCode = ref<string | null>(null)
const mockFetchEntries = vi.fn()

vi.mock('../../composables/useEntry', () => ({
  useEntryList: () => ({
    entries: mockEntries,
    total: mockTotal,
    totalPages: mockTotalPages,
    loading: mockLoading,
    error: mockError,
    errorCode: mockErrorCode,
    fetchEntries: mockFetchEntries,
  }),
}))

describe('EntryListView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEntries.value = []
    mockTotal.value = 0
    mockTotalPages.value = 1
    mockLoading.value = false
    mockError.value = null
    mockErrorCode.value = null
  })

  it('VEL1: shows loading skeleton when loading', () => {
    mockLoading.value = true
    const wrapper = mount(EntryListView)

    expect(wrapper.find('.entry-skeleton').exists()).toBe(true)
    expect(wrapper.findAll('.entry-skeleton').length).toBe(5)
  })

  it('VEL2: displays entries when loaded', async () => {
    mockEntries.value = [
      { id: 1, slug: 'entry-1', summary: 'Test Entry 1', tags: ['python'], status: 'active', file_count: 2, created_at: '2026-04-23T00:00:00Z', updated_at: '2026-04-23T00:00:00Z' },
      { id: 2, slug: 'entry-2', summary: 'Test Entry 2', tags: ['vue'], status: 'active', file_count: 1, created_at: '2026-04-22T00:00:00Z', updated_at: '2026-04-22T00:00:00Z' },
    ]
    mockTotal.value = 2

    const wrapper = mount(EntryListView)
    await flushPromises()

    expect(wrapper.findAll('.entry-card').length).toBe(2)
    expect(wrapper.text()).toContain('Test Entry 1')
    expect(wrapper.text()).toContain('Test Entry 2')
  })

  it('VEL3: searches entries on input', async () => {
    const wrapper = mount(EntryListView)
    await flushPromises()

    const searchInput = wrapper.find('.search-input')
    await searchInput.setValue('python')

    // Wait for debounce
    await new Promise(r => setTimeout(r, 400))

    expect(mockFetchEntries).toHaveBeenCalled()
  })

  it('VEL4: shows pagination when multiple pages', async () => {
    mockEntries.value = [
      { id: 1, slug: 'entry-1', summary: 'Entry 1', tags: [], status: 'active', file_count: 1, created_at: '2026-04-23T00:00:00Z', updated_at: '2026-04-23T00:00:00Z' },
    ]
    mockTotal.value = 50
    mockTotalPages.value = 5

    const wrapper = mount(EntryListView)
    await flushPromises()

    expect(wrapper.find('.pagination').exists()).toBe(true)
    expect(wrapper.text()).toContain('Page 1 of 5')
    expect(wrapper.text()).toContain('(50 entries)')
  })

  it('VEL5: navigates to entry on click', async () => {
    mockEntries.value = [
      { id: 1, slug: 'test-entry', summary: 'Test Entry', tags: [], status: 'active', file_count: 1, created_at: '2026-04-23T00:00:00Z', updated_at: '2026-04-23T00:00:00Z' },
    ]
    mockTotal.value = 1

    const wrapper = mount(EntryListView)
    await flushPromises()

    await wrapper.find('.entry-card').trigger('click')

    expect(mockPush).toHaveBeenCalledWith('/test-entry')
  })

  it('VEL6: shows empty state when no entries', async () => {
    mockEntries.value = []
    mockTotal.value = 0

    const wrapper = mount(EntryListView)
    await flushPromises()

    expect(wrapper.find('.empty-state').exists()).toBe(true)
    expect(wrapper.text()).toContain('No entries yet')
  })

  it('VEL6: shows error state with retry', async () => {
    mockError.value = 'Network error'
    mockErrorCode.value = 'SERVER_ERROR'

    const wrapper = mount(EntryListView)
    await flushPromises()

    expect(wrapper.find('.error-display').exists()).toBe(true)
    expect(wrapper.text()).toContain('Failed to load entries')

    // Click retry
    await wrapper.find('.retry-btn').trigger('click')
    expect(mockFetchEntries).toHaveBeenCalled()
  })

  it('VEL6: shows NOT_FOUND message when no results', async () => {
    mockError.value = 'No entries found'
    mockErrorCode.value = 'NOT_FOUND'

    const wrapper = mount(EntryListView)
    await flushPromises()

    expect(wrapper.text()).toContain('No entries found')
  })

  it('has accessible entry cards', async () => {
    mockEntries.value = [
      { id: 1, slug: 'test-entry', summary: 'Test Entry', tags: [], status: 'active', file_count: 1, created_at: '2026-04-23T00:00:00Z', updated_at: '2026-04-23T00:00:00Z' },
    ]
    mockTotal.value = 1

    const wrapper = mount(EntryListView)
    await flushPromises()

    const card = wrapper.find('.entry-card')
    expect(card.attributes('role')).toBe('link')
    expect(card.attributes('tabindex')).toBe('0')
    expect(card.attributes('aria-label')).toContain('Test Entry')
  })
})
