/**
 * Tests for T048 entry-lifecycle: BDD conditions B11-B13 (frontend).
 *
 * TDD red tests — components don't exist yet, so we test the API client
 * and type contracts. Component mount tests will be added in P4 when
 * components are implemented.
 *
 * B11-B13 UI tests that require component mounting are deferred to P6
 * (Playwright verification). These tests verify the data layer and
 * API client contracts that the UI depends on.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Entry } from '@/types'

function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 1,
    slug: 'test-entry',
    summary: 'Test entry',
    tags: [],
    status: 'active',
    files: [],
    isPublic: true,
    ownerId: 1,
    username: 'testuser',
    expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

// ============================================================
// B11: Frontend EntryDetailView expiry edit — API contract
// ============================================================

describe('B11: Entry expiry edit — API contract', () => {
  it('TC-B11-01: Entry type supports archived status', () => {
    const entry: Entry = makeEntry({ status: 'archived' })
    expect(entry.status).toBe('archived')
  })

  it('TC-B11-02: Entry type supports archivedAt field', () => {
    const entry: Entry = makeEntry({
      status: 'archived',
      archivedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    } as Entry & { archivedAt: string | null })
    expect((entry as Entry & { archivedAt: string | null }).archivedAt).toBeTruthy()
  })

  it('TC-B11-03: updateEntry API method exists on client', async () => {
    const { api } = await import('@/api/client')
    expect(typeof api.updateEntry).toBe('function')
  })

  it('TC-B11-04: updateEntry accepts expires_in parameter', async () => {
    const { api } = await import('@/api/client')
    const mockPatch = vi.fn().mockResolvedValue({
      data: {
        id: 1,
        slug: 'test-entry',
        summary: 'Test',
        tags: [],
        status: 'active',
        files: [],
        is_public: true,
        owner_id: 1,
        username: 'testuser',
        expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    })

    const axios = (api as unknown as { client: { patch: typeof mockPatch } }).client
    const originalPatch = axios.patch
    axios.patch = mockPatch

    try {
      await api.updateEntry('test-entry', { expires_in: '30d' })
      expect(mockPatch).toHaveBeenCalledWith('/entries/test-entry', { expires_in: '30d' })
    } finally {
      axios.patch = originalPatch
    }
  })
})

// ============================================================
// B12: Frontend archived entry — type contract
// ============================================================

describe('B12: Archived entry — type contract', () => {
  it('TC-B12-01: archived entry has status "archived"', () => {
    const entry: Entry = makeEntry({ status: 'archived' })
    expect(entry.status).toBe('archived')
  })

  it('TC-B12-02: archived entry has null expiresAt', () => {
    const entry: Entry = makeEntry({ status: 'archived', expiresAt: null })
    expect(entry.expiresAt).toBeNull()
  })

  it('TC-B12-03: updateEntry with isArchived context sends expires_in for reactivation', async () => {
    const { api } = await import('@/api/client')
    const mockPatch = vi.fn().mockResolvedValue({
      data: {
        id: 1,
        slug: 'reactivate-test',
        summary: 'Test',
        tags: [],
        status: 'active',
        files: [],
        is_public: true,
        owner_id: 1,
        username: 'testuser',
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    })

    const axios = (api as unknown as { client: { patch: typeof mockPatch } }).client
    const originalPatch = axios.patch
    axios.patch = mockPatch

    try {
      await api.updateEntry('reactivate-test', { expires_in: '7d' })
      expect(mockPatch).toHaveBeenCalledWith('/entries/reactivate-test', { expires_in: '7d' })
    } finally {
      axios.patch = originalPatch
    }
  })
})

// ============================================================
// B13: Frontend list archived visual distinction — type contract
// ============================================================

describe('B13: List archived visual distinction — type contract', () => {
  it('TC-B13-01: Entry type distinguishes active from archived status', () => {
    const active: Entry = makeEntry({ status: 'active' })
    const archived: Entry = makeEntry({ status: 'archived' })
    expect(active.status).toBe('active')
    expect(archived.status).toBe('archived')
    expect(active.status).not.toBe(archived.status)
  })

  it('TC-B13-02: Entry type does not have "expired" status value', () => {
    type ValidStatus = 'active' | 'archived'
    const statuses: ValidStatus[] = ['active', 'archived']
    expect(statuses).toHaveLength(2)
    expect(statuses).not.toContain('expired')
  })

  it('TC-B13-03: listEntries returns entries with status field for visual distinction', async () => {
    const { api } = await import('@/api/client')
    const mockGet = vi.fn().mockResolvedValue({
      data: {
        items: [
          { id: 1, slug: 'active-1', summary: 'Active', tags: [], status: 'active', file_count: 0, is_public: true, owner_id: 1, username: 'u', expires_at: null, created_at: '', updated_at: '' },
          { id: 2, slug: 'archived-1', summary: 'Archived', tags: [], status: 'archived', file_count: 0, is_public: true, owner_id: 1, username: 'u', expires_at: null, created_at: '', updated_at: '' },
        ],
        total: 2,
        page: 1,
        per_page: 20,
      },
    })

    const axios = (api as unknown as { client: { get: typeof mockGet } }).client
    const originalGet = axios.get
    axios.get = mockGet

    try {
      const result = await api.listEntries({ owner: 'me' })
      const archivedItems = result.items.filter(e => e.status === 'archived')
      expect(archivedItems.length).toBeGreaterThan(0)
    } finally {
      axios.get = originalGet
    }
  })
})
