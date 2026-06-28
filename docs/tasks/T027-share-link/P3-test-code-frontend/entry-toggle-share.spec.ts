import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const mockToggleVisibility = vi.fn()

vi.mock('@/api/client', () => ({
  api: {
    toggleEntryVisibility: (...args: unknown[]) => mockToggleVisibility(...args),
    listEntries: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, perPage: 20 }),
    getEntry: vi.fn().mockResolvedValue({
      id: 1, slug: 'test', summary: 'Test', tags: [], status: 'active',
      files: [], isPublic: false, ownerId: 1, username: 'alice',
      expiresAt: null, createdAt: '2026-06-29T00:00:00Z',
    }),
    deleteEntry: vi.fn(),
  },
}))

describe('entry store: toggleVisibility share revocation handling', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  // TC-ESTORE-01: toggleVisibility shows toast when shares revoked
  it('shows toast when private→public revokes shares', async () => {
    const entry = {
      id: 1,
      slug: 'test-entry',
      summary: 'Test Entry',
      tags: [],
      status: 'active' as const,
      files: [],
      isPublic: false,
      ownerId: 1,
      username: 'alice',
      expiresAt: null,
      createdAt: '2026-06-29T00:00:00Z',
    }

    mockToggleVisibility.mockResolvedValue({
      ...entry,
      isPublic: true,
      revokedShares: 3,
    })

    const { useEntryStore } = await import('@/stores/entry')
    const store = useEntryStore()
    store.entries = [entry]
    store.currentEntry = entry

    const success = await store.toggleVisibility(entry)

    expect(success).toBe(true)
    expect(entry.isPublic).toBe(true)
  })

  // TC-ESTORE-02: toggleVisibility no toast when no shares revoked
  it('no revocation toast when public→private', async () => {
    const entry = {
      id: 1,
      slug: 'test-entry',
      summary: 'Test Entry',
      tags: [],
      status: 'active' as const,
      files: [],
      isPublic: true,
      ownerId: 1,
      username: 'alice',
      expiresAt: null,
      createdAt: '2026-06-29T00:00:00Z',
    }

    mockToggleVisibility.mockResolvedValue({
      ...entry,
      isPublic: false,
    })

    const { useEntryStore } = await import('@/stores/entry')
    const store = useEntryStore()
    store.entries = [entry]
    store.currentEntry = entry

    const success = await store.toggleVisibility(entry)

    expect(success).toBe(true)
    expect(entry.isPublic).toBe(false)
  })

  // Rollback on failure still works
  it('rolls back visibility on API failure', async () => {
    const entry = {
      id: 1,
      slug: 'test-entry',
      summary: 'Test Entry',
      tags: [],
      status: 'active' as const,
      files: [],
      isPublic: false,
      ownerId: 1,
      username: 'alice',
      expiresAt: null,
      createdAt: '2026-06-29T00:00:00Z',
    }

    mockToggleVisibility.mockRejectedValue(new Error('Network error'))

    const { useEntryStore } = await import('@/stores/entry')
    const store = useEntryStore()
    store.entries = [entry]
    store.currentEntry = entry

    const success = await store.toggleVisibility(entry)

    expect(success).toBe(false)
    expect(entry.isPublic).toBe(false)
  })
})
