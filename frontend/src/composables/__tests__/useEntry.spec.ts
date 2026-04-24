import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick, defineComponent } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import type { EntryResponse, EntryListResponse } from '../../types'
import { PeekApiError } from '../../types'

// Mock the API module
vi.mock('../../api/client', () => ({
  api: {
    getEntry: vi.fn(),
    listEntries: vi.fn(),
  },
}))

import { api } from '../../api/client'
import { useEntry, useEntryList } from '../useEntry'

describe('useEntry', () => {
  const mockEntry: EntryResponse = {
    id: 1,
    slug: 'test-entry',
    url: 'http://localhost:8080/test-entry',
    summary: 'Test Entry',
    status: 'active',
    tags: ['test'],
    files: [],
    expires_at: null,
    created_at: '2026-04-23T00:00:00Z',
    updated_at: '2026-04-23T00:00:00Z',
  }

  // Counter for unique slugs per test
  let testIdCounter = 0

  beforeEach(() => {
    vi.clearAllMocks()
    testIdCounter++
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('CE1: fetchEntry makes request', () => {
    it('fetches entry from API', async () => {
      const uniqueSlug = `test-entry-${testIdCounter}`
      const entryData = { ...mockEntry, slug: uniqueSlug }
      vi.mocked(api.getEntry).mockResolvedValueOnce(entryData)

      const TestComponent = defineComponent({
        setup() {
          const { entry, loading, fetchEntry } = useEntry()
          return { entry, loading, fetchEntry }
        },
        template: '<div></div>',
      })

      const wrapper = mount(TestComponent)
      await wrapper.vm.fetchEntry(uniqueSlug)
      await flushPromises()

      expect(vi.mocked(api.getEntry)).toHaveBeenCalledWith(uniqueSlug, {})
      expect(wrapper.vm.entry).toEqual(entryData)
      expect(wrapper.vm.loading).toBe(false)
    })

    it('includes file content when requested', async () => {
      const uniqueSlug = `test-entry-${testIdCounter}`
      vi.mocked(api.getEntry).mockResolvedValueOnce(mockEntry)

      const TestComponent = defineComponent({
        setup() {
          const { fetchEntry } = useEntry()
          return { fetchEntry }
        },
        template: '<div></div>',
      })

      const wrapper = mount(TestComponent)
      await wrapper.vm.fetchEntry(uniqueSlug, { includeContent: true })
      await flushPromises()

      expect(vi.mocked(api.getEntry)).toHaveBeenCalledWith(uniqueSlug, { include: 'files.content' })
    })
  })

  describe('CE2: loading state during fetch', () => {
    it('sets loading to true during fetch', async () => {
      const uniqueSlug = `test-entry-${testIdCounter}`
      let resolvePromise: (value: any) => void
      const promise = new Promise<EntryResponse>((resolve) => {
        resolvePromise = resolve
      })
      vi.mocked(api.getEntry).mockReturnValueOnce(promise)

      const TestComponent = defineComponent({
        setup() {
          const { loading, fetchEntry } = useEntry()
          return { loading, fetchEntry }
        },
        template: '<div></div>',
      })

      const wrapper = mount(TestComponent)
      const fetchPromise = wrapper.vm.fetchEntry(uniqueSlug)

      expect(wrapper.vm.loading).toBe(true)

      resolvePromise!(mockEntry)
      await fetchPromise
      await flushPromises()

      expect(wrapper.vm.loading).toBe(false)
    })
  })

  describe('CE3: error state on failure', () => {
    it('sets error on API failure', async () => {
      const uniqueSlug = `test-entry-${testIdCounter}`
      vi.mocked(api.getEntry).mockRejectedValueOnce(new Error('Network error'))

      const TestComponent = defineComponent({
        setup() {
          const { error, errorCode, fetchEntry } = useEntry()
          return { error, errorCode, fetchEntry }
        },
        template: '<div></div>',
      })

      const wrapper = mount(TestComponent)
      await wrapper.vm.fetchEntry(uniqueSlug)
      await flushPromises()

      expect(wrapper.vm.error).toBe('Network error')
      expect(wrapper.vm.errorCode).toBe('UNKNOWN')
    })
  })

  describe('CE4: error code preserved', () => {
    it('preserves PeekApiError code', async () => {
      const uniqueSlug = `test-entry-${testIdCounter}`
      const apiError = new PeekApiError('NOT_FOUND', 'Entry not found', 404)
      vi.mocked(api.getEntry).mockRejectedValueOnce(apiError)

      const TestComponent = defineComponent({
        setup() {
          const { error, errorCode, fetchEntry } = useEntry()
          return { error, errorCode, fetchEntry }
        },
        template: '<div></div>',
      })

      const wrapper = mount(TestComponent)
      await wrapper.vm.fetchEntry(uniqueSlug)
      await flushPromises()

      expect(wrapper.vm.error).toBe('Entry not found')
      expect(wrapper.vm.errorCode).toBe('NOT_FOUND')
    })
  })

  describe('CE5: cache hit uses cached data', () => {
    it('uses cached data within maxAge', async () => {
      const uniqueSlug = `test-entry-${testIdCounter}`
      vi.mocked(api.getEntry).mockResolvedValue(mockEntry)

      const TestComponent = defineComponent({
        setup() {
          const { entry, fetchEntry } = useEntry()
          return { entry, fetchEntry }
        },
        template: '<div></div>',
      })

      const wrapper = mount(TestComponent)

      // First fetch - should call API
      await wrapper.vm.fetchEntry(uniqueSlug)
      await flushPromises()
      expect(vi.mocked(api.getEntry)).toHaveBeenCalledTimes(1)

      // Second fetch within cache window - should not call API
      await wrapper.vm.fetchEntry(uniqueSlug)
      await flushPromises()
      expect(vi.mocked(api.getEntry)).toHaveBeenCalledTimes(1)
      expect(wrapper.vm.entry).toEqual(mockEntry)
    })
  })

  describe('CE6: cache expired refetches', () => {
    it('refetches when cache expires', async () => {
      const uniqueSlug = `test-entry-${testIdCounter}`
      vi.mocked(api.getEntry).mockResolvedValue(mockEntry)

      const TestComponent = defineComponent({
        setup() {
          const { fetchEntry } = useEntry()
          return { fetchEntry }
        },
        template: '<div></div>',
      })

      const wrapper = mount(TestComponent)

      // First fetch
      await wrapper.vm.fetchEntry(uniqueSlug)
      await flushPromises()
      expect(vi.mocked(api.getEntry)).toHaveBeenCalledTimes(1)

      // Second fetch with 0 maxAge (force refetch)
      await wrapper.vm.fetchEntry(uniqueSlug, { maxAge: 0 })
      await flushPromises()
      expect(vi.mocked(api.getEntry)).toHaveBeenCalledTimes(2)
    })
  })

  describe('CE7: clearCache clears specific', () => {
    it('clears specific entry from cache', async () => {
      const uniqueSlug = `test-entry-${testIdCounter}`
      vi.mocked(api.getEntry).mockResolvedValue(mockEntry)

      const TestComponent = defineComponent({
        setup() {
          const { fetchEntry, clearCache } = useEntry()
          return { fetchEntry, clearCache }
        },
        template: '<div></div>',
      })

      const wrapper = mount(TestComponent)

      // First fetch
      await wrapper.vm.fetchEntry(uniqueSlug)
      await flushPromises()
      expect(vi.mocked(api.getEntry)).toHaveBeenCalledTimes(1)

      // Clear cache
      wrapper.vm.clearCache(uniqueSlug)

      // Second fetch - should call API again
      await wrapper.vm.fetchEntry(uniqueSlug)
      await flushPromises()
      expect(vi.mocked(api.getEntry)).toHaveBeenCalledTimes(2)
    })
  })

  describe('CE8: clearCache clears all', () => {
    it('clears all entries from cache', async () => {
      vi.mocked(api.getEntry).mockResolvedValue(mockEntry)

      const TestComponent = defineComponent({
        setup() {
          const { fetchEntry, clearCache } = useEntry()
          return { fetchEntry, clearCache }
        },
        template: '<div></div>',
      })

      const wrapper = mount(TestComponent)

      const slug1 = `entry-1-${testIdCounter}`
      const slug2 = `entry-2-${testIdCounter}`

      // Fetch multiple entries
      await wrapper.vm.fetchEntry(slug1)
      await wrapper.vm.fetchEntry(slug2)
      await flushPromises()
      expect(vi.mocked(api.getEntry)).toHaveBeenCalledTimes(2)

      // Clear all cache
      wrapper.vm.clearCache()

      // Refetch - should call API again
      await wrapper.vm.fetchEntry(slug1)
      await wrapper.vm.fetchEntry(slug2)
      await flushPromises()
      expect(vi.mocked(api.getEntry)).toHaveBeenCalledTimes(4)
    })
  })
})

describe('useEntryList', () => {
  const mockListResponse: EntryListResponse = {
    items: [
      { id: 1, slug: 'entry-1', summary: 'Entry 1', tags: [], status: 'active', file_count: 2, created_at: '', updated_at: '' },
      { id: 2, slug: 'entry-2', summary: 'Entry 2', tags: [], status: 'active', file_count: 1, created_at: '', updated_at: '' },
    ],
    total: 2,
    page: 1,
    per_page: 20,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches entries list', async () => {
    vi.mocked(api.listEntries).mockResolvedValueOnce(mockListResponse)

    const TestComponent = defineComponent({
      setup() {
        const { entries, total, totalPages, fetchEntries } = useEntryList()
        return { entries, total, totalPages, fetchEntries }
      },
      template: '<div></div>',
    })

    const wrapper = mount(TestComponent)
    await wrapper.vm.fetchEntries()
    await flushPromises()

    expect(vi.mocked(api.listEntries)).toHaveBeenCalledWith(undefined)
    expect(wrapper.vm.entries).toHaveLength(2)
    expect(wrapper.vm.total).toBe(2)
    expect(wrapper.vm.totalPages).toBe(1)
  })

  it('passes search params', async () => {
    vi.mocked(api.listEntries).mockResolvedValueOnce(mockListResponse)

    const TestComponent = defineComponent({
      setup() {
        const { fetchEntries } = useEntryList()
        return { fetchEntries }
      },
      template: '<div></div>',
    })

    const wrapper = mount(TestComponent)
    await wrapper.vm.fetchEntries({ q: 'test', page: 2, per_page: 10 })
    await flushPromises()

    expect(vi.mocked(api.listEntries)).toHaveBeenCalledWith({ q: 'test', page: 2, per_page: 10 })
  })

  it('handles error state', async () => {
    vi.mocked(api.listEntries).mockRejectedValueOnce(new PeekApiError('SERVER_ERROR', 'Server error', 500))

    const TestComponent = defineComponent({
      setup() {
        const { error, errorCode, fetchEntries } = useEntryList()
        return { error, errorCode, fetchEntries }
      },
      template: '<div></div>',
    })

    const wrapper = mount(TestComponent)
    await wrapper.vm.fetchEntries()
    await flushPromises()

    expect(wrapper.vm.error).toBe('Server error')
    expect(wrapper.vm.errorCode).toBe('SERVER_ERROR')
  })

  it('handles loading state', async () => {
    let resolvePromise: (value: any) => void
    const promise = new Promise((resolve) => {
      resolvePromise = resolve
    })
    vi.mocked(api.listEntries).mockReturnValueOnce(promise as any)

    const TestComponent = defineComponent({
      setup() {
        const { loading, fetchEntries } = useEntryList()
        return { loading, fetchEntries }
      },
      template: '<div></div>',
    })

    const wrapper = mount(TestComponent)
    const fetchPromise = wrapper.vm.fetchEntries()
    expect(wrapper.vm.loading).toBe(true)

    resolvePromise!(mockListResponse)
    await fetchPromise
    await flushPromises()

    expect(wrapper.vm.loading).toBe(false)
  })
})
