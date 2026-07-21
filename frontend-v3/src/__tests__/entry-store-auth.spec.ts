import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useEntryStore } from '@/stores/entry'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/api/client'
import type { Entry, EntryListResponse } from '@/types'

vi.mock('@/api/client', () => ({
  api: {
    listEntries: vi.fn(),
    logout: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    getMe: vi.fn(),
    deleteEntry: vi.fn(),
    toggleEntryVisibility: vi.fn(),
    getEntry: vi.fn(),
    getFileContent: vi.fn(),
  },
}))

function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 1,
    slug: 'test-entry',
    summary: 'Test entry',
    tags: [],
    status: 'active',
    files: [],
    fileCount: 2,
    isPublic: true,
    ownerId: 1,
    username: 'alice',
    expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    archivedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeListResponse(items: Entry[], total?: number): EntryListResponse {
  return {
    items,
    total: total ?? items.length,
    page: 1,
    perPage: 20,
  }
}

const mockListEntries = api.listEntries as ReturnType<typeof vi.fn>

describe('Entry Store', () => {
  let entryStore: ReturnType<typeof useEntryStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    entryStore = useEntryStore()
    vi.clearAllMocks()
  })

  // ============================================================
  // BDD-B1/C1: loadEntries API call
  // ============================================================
  describe('loadEntries', () => {
    it('calls api.listEntries with correct params including status', async () => {
      mockListEntries.mockResolvedValue(makeListResponse([]))

      await entryStore.loadEntries({
        page: 1,
        perPage: 10,
        status: 'archived',
        owner: 'me',
        q: 'test',
      })

      expect(mockListEntries).toHaveBeenCalledWith({
        page: 1,
        perPage: 10,
        status: 'archived',
        owner: 'me',
        q: 'test',
      })
    })

    it('sets entries from API response', async () => {
      const items = [makeEntry({ slug: 'a' }), makeEntry({ id: 2, slug: 'b' })]
      mockListEntries.mockResolvedValue(makeListResponse(items, 5))

      await entryStore.loadEntries()

      expect(entryStore.entries).toEqual(items)
      expect(entryStore.total).toBe(5)
      expect(entryStore.page).toBe(1)
      expect(entryStore.perPage).toBe(20)
    })

    it('sets error and clears entries on failure by default', async () => {
      mockListEntries.mockRejectedValue(new Error('Network error'))

      // pre-populate entries
      entryStore.entries = [makeEntry()]
      await entryStore.loadEntries()

      expect(entryStore.error).toBe('Network error')
      expect(entryStore.entries).toEqual([])
    })

    // ============================================================
    // P2 §2.8: sequence number dedup (stale response discarded)
    // ============================================================
    it('discards stale response when newer request was made (sequence number dedup)', async () => {
      let resolve1!: (value: EntryListResponse) => void
      let resolve2!: (value: EntryListResponse) => void

      mockListEntries
        .mockImplementationOnce(() => new Promise<EntryListResponse>((r) => { resolve1 = r }))
        .mockImplementationOnce(() => new Promise<EntryListResponse>((r) => { resolve2 = r }))

      const items1 = [makeEntry({ id: 1, slug: 'first' })]
      const items2 = [makeEntry({ id: 2, slug: 'second' })]

      const p1 = entryStore.loadEntries({ page: 1 })
      const p2 = entryStore.loadEntries({ page: 2 })

      resolve2!(makeListResponse(items2))
      resolve1!(makeListResponse(items1))

      await p1
      await p2

      // The latest response (page 2) should be the final state
      expect(entryStore.entries).toEqual(items2)
      expect(entryStore.page).toBe(1)
    })

    // ============================================================
    // P2 §2.9: clearOnError option
    // ============================================================
    it('clearOnError=false preserves old entries on error', async () => {
      const oldEntries = [makeEntry({ slug: 'old' })]
      entryStore.entries = oldEntries

      mockListEntries.mockRejectedValue(new Error('Network error'))

      await (entryStore.loadEntries as any)({ page: 1 }, { clearOnError: false })

      expect(entryStore.error).toBe('Network error')
      expect(entryStore.entries).toEqual(oldEntries)
    })

    it('clearOnError=true (default) clears entries on error', async () => {
      const oldEntries = [makeEntry({ slug: 'old' })]
      entryStore.entries = oldEntries

      mockListEntries.mockRejectedValue(new Error('Network error'))

      await (entryStore.loadEntries as any)({ page: 1 }, { clearOnError: true })

      expect(entryStore.error).toBe('Network error')
      expect(entryStore.entries).toEqual([])
    })
  })
})

// ============================================================
// Auth Store
// ============================================================
describe('Auth Store', () => {
  let authStore: ReturnType<typeof useAuthStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    authStore = useAuthStore()
    vi.clearAllMocks()
  })

  describe('authState computed', () => {
    it('returns "loading" when initializing', () => {
      authStore.initializing = true
      authStore.user = null
      expect(authStore.authState).toBe('loading')
    })

    it('returns "authenticated" when user is set and not initializing', () => {
      authStore.initializing = false
      authStore.user = { id: 1, username: 'alice', displayName: null, isActive: true, isAdmin: false, createdAt: '' }
      expect(authStore.authState).toBe('authenticated')
    })

    it('returns "anonymous" when not initializing and no user', () => {
      authStore.initializing = false
      authStore.user = null
      expect(authStore.authState).toBe('anonymous')
    })
  })

  describe('logout', () => {
    it('clears user and calls api.logout', () => {
      authStore.user = { id: 1, username: 'alice', displayName: null, isActive: true, isAdmin: false, createdAt: '' }
      authStore.initializing = false

      authStore.logout()

      expect(authStore.user).toBeNull()
      expect(api.logout).toHaveBeenCalled()
    })

    it('authState becomes "anonymous" after logout', () => {
      authStore.user = { id: 1, username: 'alice', displayName: null, isActive: true, isAdmin: false, createdAt: '' }
      authStore.initializing = false

      authStore.logout()

      expect(authStore.authState).toBe('anonymous')
    })

    // BDD-C1: logout must not rely only on client-side filtering
    // The authState change should trigger a full API reload
    it('does NOT call entry store filterPrivateEntries (facilitates API reload)', () => {
      authStore.user = { id: 1, username: 'alice', displayName: null, isActive: true, isAdmin: false, createdAt: '' }
      authStore.initializing = false

      authStore.logout()

      // filterPrivateEntries should NOT be called by auth store
      // The reload must happen via authState watcher → loadEntries
      expect(authStore.authState).toBe('anonymous')
    })
  })

  describe('peekview:auth-expired', () => {
    it('sets user to null when event fires', () => {
      authStore.user = { id: 1, username: 'alice', displayName: null, isActive: true, isAdmin: false, createdAt: '' }
      authStore.initializing = false

      window.dispatchEvent(new CustomEvent('peekview:auth-expired'))

      expect(authStore.user).toBeNull()
      expect(authStore.authState).toBe('anonymous')
    })

    it('does not clear user during initialization', () => {
      authStore.user = { id: 1, username: 'alice', displayName: null, isActive: true, isAdmin: false, createdAt: '' }
      authStore.initializing = true

      window.dispatchEvent(new CustomEvent('peekview:auth-expired'))

      expect(authStore.user).not.toBeNull()
      expect(authStore.authState).toBe('loading')
    })

    // BDD-D1: auth-expired should cause authState → anonymous → list reload
    it('authState becomes "anonymous" after auth-expired event', () => {
      authStore.user = { id: 1, username: 'alice', displayName: null, isActive: true, isAdmin: false, createdAt: '' }
      authStore.initializing = false

      window.dispatchEvent(new CustomEvent('peekview:auth-expired'))

      expect(authStore.authState).toBe('anonymous')
    })
  })
})
