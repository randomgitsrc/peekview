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

describe('share store: shareUrlCache + getShareUrl', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('ST-01: createShare caches shareUrl in shareUrlCache', async () => {
    const shareResult = {
      id: 42,
      tokenPrefix: 'pv_new123',
      shareUrl: 'http://localhost:8888/my-entry?share=pv_new123fulltoken',
      expiresAt: null,
      maxViews: null,
      viewCount: 0,
      createdAt: new Date().toISOString(),
    }
    mockCreateShare.mockResolvedValue(shareResult)
    mockListShares.mockResolvedValue({ shares: [], total: 0 })

    const { useShareStore } = await import('@/stores/share')
    const store = useShareStore()
    await store.createShare('my-entry', '7d')

    const getShareUrl = (store as unknown as Record<string, { (id: number): string | null }>).getShareUrl
    expect(typeof getShareUrl).toBe('function')
    expect(getShareUrl(42)).toBe('http://localhost:8888/my-entry?share=pv_new123fulltoken')
  })

  it('ST-02: getShareUrl returns null for uncached share', async () => {
    mockListShares.mockResolvedValue({ shares: [], total: 0 })

    const { useShareStore } = await import('@/stores/share')
    const store = useShareStore()

    const getShareUrl = (store as unknown as Record<string, { (id: number): string | null }>).getShareUrl
    expect(typeof getShareUrl).toBe('function')
    expect(getShareUrl(999)).toBeNull()
  })

  it('ST-03: createShare calls fetchShares after creation', async () => {
    const shareResult = {
      id: 42,
      tokenPrefix: 'pv_new123',
      shareUrl: 'http://localhost:8888/my-entry?share=pv_new123fulltoken',
      expiresAt: null,
      maxViews: null,
      viewCount: 0,
      createdAt: new Date().toISOString(),
    }
    mockCreateShare.mockResolvedValue(shareResult)
    mockListShares.mockResolvedValue({ shares: [], total: 0 })

    const { useShareStore } = await import('@/stores/share')
    const store = useShareStore()
    await store.createShare('my-entry', '7d')

    expect(mockListShares).toHaveBeenCalledWith('my-entry')
  })

  it('ST-04: shareUrlCache is reactive Map', async () => {
    mockListShares.mockResolvedValue({ shares: [], total: 0 })

    const { useShareStore } = await import('@/stores/share')
    const store = useShareStore()

    const shareUrlCache = (store as unknown as Record<string, unknown>).shareUrlCache
    expect(shareUrlCache).toBeDefined()
    expect(shareUrlCache).toBeInstanceOf(Map)
  })
})
