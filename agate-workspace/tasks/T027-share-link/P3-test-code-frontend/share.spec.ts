import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const mockListShares = vi.fn()
const mockCreateShare = vi.fn()
const mockRevokeShares = vi.fn()

vi.mock('@/api/client', () => ({
  api: {
    listShares: (...args: unknown[]) => mockListShares(...args),
    createShare: (...args: unknown[]) => mockCreateShare(...args),
    revokeShares: (...args: unknown[]) => mockRevokeShares(...args),
  },
}))

describe('share store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  // TC-STORE-01: fetchShares populates shares list
  it('fetchShares populates shares list', async () => {
    const shares = [
      { id: 1, tokenPrefix: 'abc', expiresAt: null, maxViews: null, viewCount: 0, createdBy: 1, createdAt: '2026-06-29T00:00:00Z', revokedAt: null },
      { id: 2, tokenPrefix: 'def', expiresAt: null, maxViews: 5, viewCount: 3, createdBy: 1, createdAt: '2026-06-29T00:00:00Z', revokedAt: null },
      { id: 3, tokenPrefix: 'ghi', expiresAt: null, maxViews: null, viewCount: 0, createdBy: 1, createdAt: '2026-06-29T00:00:00Z', revokedAt: '2026-06-29T00:00:00Z' },
    ]
    mockListShares.mockResolvedValue({ shares, total: 3 })

    const { useShareStore } = await import('@/stores/share')
    const store = useShareStore()
    await store.fetchShares('test-entry')

    expect(store.shares).toHaveLength(3)
    expect(store.shares[0].tokenPrefix).toBe('abc')
    expect(store.loading).toBe(false)
  })

  // TC-STORE-02: createShare calls API and returns result
  it('createShare calls API and returns result', async () => {
    const result = {
      id: 1,
      tokenPrefix: 'abc',
      shareUrl: '/test-entry?share=abc123def456',
      expiresAt: '2026-07-06T00:00:00Z',
      maxViews: null,
      viewCount: 0,
      createdAt: '2026-06-29T00:00:00Z',
    }
    mockCreateShare.mockResolvedValue(result)

    const { useShareStore } = await import('@/stores/share')
    const store = useShareStore()
    const returned = await store.createShare('test-entry', '7d')

    expect(mockCreateShare).toHaveBeenCalledWith('test-entry', { expires_in: '7d', max_views: null })
    expect(returned.shareUrl).toBe('/test-entry?share=abc123def456')
  })

  // TC-STORE-03: revokeShares refreshes list after revoke
  it('revokeShares refreshes list after revoke', async () => {
    mockRevokeShares.mockResolvedValue({ revoked_count: 2 })
    mockListShares.mockResolvedValue({ shares: [], total: 0 })

    const { useShareStore } = await import('@/stores/share')
    const store = useShareStore()
    await store.revokeShares('test-entry', [1, 2])

    expect(mockRevokeShares).toHaveBeenCalledWith('test-entry', { share_ids: [1, 2] })
    expect(mockListShares).toHaveBeenCalledWith('test-entry')
  })

  // Loading state management
  it('sets loading to true during fetchShares', async () => {
    mockListShares.mockReturnValue(new Promise(() => {}))

    const { useShareStore } = await import('@/stores/share')
    const store = useShareStore()

    const promise = store.fetchShares('test-entry')
    expect(store.loading).toBe(true)

    await promise.catch(() => {})
  })

  it('sets loading to false after fetchShares completes', async () => {
    mockListShares.mockResolvedValue({ shares: [], total: 0 })

    const { useShareStore } = await import('@/stores/share')
    const store = useShareStore()
    await store.fetchShares('test-entry')

    expect(store.loading).toBe(false)
  })

  it('sets loading to false after fetchShares fails', async () => {
    mockListShares.mockRejectedValue(new Error('Network error'))

    const { useShareStore } = await import('@/stores/share')
    const store = useShareStore()
    await store.fetchShares('test-entry').catch(() => {})

    expect(store.loading).toBe(false)
  })
})
