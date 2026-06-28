import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const mockListEntries = vi.fn()
const mockGetEntry = vi.fn()
const mockGetFileContent = vi.fn()
const mockToggleVisibility = vi.fn()
const mockDeleteEntry = vi.fn()

vi.mock('@/api/client', () => ({
  api: {
    listEntries: (...args: unknown[]) => mockListEntries(...args),
    getEntry: (...args: unknown[]) => mockGetEntry(...args),
    getFileContent: (...args: unknown[]) => mockGetFileContent(...args),
    toggleEntryVisibility: (...args: unknown[]) => mockToggleVisibility(...args),
    deleteEntry: (...args: unknown[]) => mockDeleteEntry(...args),
  },
}))

describe('entry store: loadEntries ownerFound storage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('stores ownerFound=true from API response', async () => {
    mockListEntries.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      perPage: 20,
      ownerFound: true,
    })

    const { useEntryStore } = await import('@/stores/entry')
    const store = useEntryStore()
    await store.loadEntries({ owner: 'alice' })

    // After P4 implementation, store should expose ownerFound ref
    expect((store as unknown as Record<string, unknown>).ownerFound).toBe(true)
  })

  it('stores ownerFound=false from API response', async () => {
    mockListEntries.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      perPage: 20,
      ownerFound: false,
    })

    const { useEntryStore } = await import('@/stores/entry')
    const store = useEntryStore()
    await store.loadEntries({ owner: 'nonexistent' })

    expect((store as unknown as Record<string, unknown>).ownerFound).toBe(false)
  })

  it('stores ownerFound=null when owner is not specified', async () => {
    mockListEntries.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      perPage: 20,
      ownerFound: null,
    })

    const { useEntryStore } = await import('@/stores/entry')
    const store = useEntryStore()
    await store.loadEntries()

    expect((store as unknown as Record<string, unknown>).ownerFound).toBe(null)
  })

  it('stores ownerFound=null when API response omits the field', async () => {
    mockListEntries.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      perPage: 20,
      // ownerFound intentionally omitted
    })

    const { useEntryStore } = await import('@/stores/entry')
    const store = useEntryStore()
    await store.loadEntries()

    expect((store as unknown as Record<string, unknown>).ownerFound).toBe(null)
  })

  it('preserves existing entries alongside ownerFound', async () => {
    const mockEntry = {
      id: 1,
      slug: 'test',
      summary: 'Test Entry',
      tags: [],
      status: 'active' as const,
      files: [],
      isPublic: true,
      ownerId: 1,
      username: 'alice',
      expiresAt: null,
      createdAt: '2026-01-01T00:00:00Z',
    }

    mockListEntries.mockResolvedValue({
      items: [mockEntry],
      total: 1,
      page: 1,
      perPage: 20,
      ownerFound: true,
    })

    const { useEntryStore } = await import('@/stores/entry')
    const store = useEntryStore()
    await store.loadEntries({ owner: 'alice' })

    expect(store.entries).toHaveLength(1)
    expect(store.entries[0].slug).toBe('test')
    expect(store.total).toBe(1)
    expect((store as unknown as Record<string, unknown>).ownerFound).toBe(true)
  })
})
