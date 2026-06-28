import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import type { ShareCreateResponse, ShareListApiResponse, ShareResponse } from '@/api/types'

vi.mock('axios')

const mockAxios = axios as unknown as {
  create: () => {
    get: ReturnType<typeof vi.fn>
    post: ReturnType<typeof vi.fn>
    patch: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
    interceptors: {
      response: {
        use: ReturnType<typeof vi.fn>
      }
    }
  }
}

describe('API client: share methods', () => {
  let mockGet: ReturnType<typeof vi.fn>
  let mockPost: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.resetModules()
    mockGet = vi.fn()
    mockPost = vi.fn()
    const mockClient = {
      get: mockGet,
      post: mockPost,
      patch: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        response: { use: vi.fn() },
      },
    }
    mockAxios.create = vi.fn(() => mockClient)
    vi.clearAllMocks()
  })

  // TC-API-01: createShare transforms response correctly
  it('createShare transforms snake_case response to camelCase', async () => {
    const apiResponse: { data: ShareCreateResponse } = {
      data: {
        id: 1,
        token_prefix: 'aBcDeFgH',
        share_url: '/my-entry?share=aBcDeFgHiJkLmNoP',
        expires_at: '2026-07-06T00:00:00Z',
        max_views: null,
        view_count: 0,
        created_by: 1,
        created_at: '2026-06-29T00:00:00Z',
        revoked_at: null,
      },
    }
    mockPost.mockResolvedValue(apiResponse)

    const { api } = await import('@/api/client')
    const result = await api.createShare('my-entry', { expires_in: '7d', max_views: null })

    expect(mockPost).toHaveBeenCalledWith('/entries/my-entry/shares', {
      expires_in: '7d',
      max_views: null,
    })
    expect(result.id).toBe(1)
    expect(result.tokenPrefix).toBe('aBcDeFgH')
    expect(result.shareUrl).toBe('/my-entry?share=aBcDeFgHiJkLmNoP')
    expect(result.expiresAt).toBe('2026-07-06T00:00:00Z')
    expect(result.maxViews).toBeNull()
    expect(result.viewCount).toBe(0)
  })

  // TC-API-02: listShares transforms response correctly
  it('listShares transforms snake_case response to camelCase', async () => {
    const shareResponse: ShareResponse = {
      id: 1,
      token_prefix: 'aBcDeFgH',
      expires_at: '2026-07-06T00:00:00Z',
      max_views: 10,
      view_count: 3,
      created_by: 1,
      created_at: '2026-06-29T00:00:00Z',
      revoked_at: null,
    }
    const apiResponse: { data: ShareListApiResponse } = {
      data: {
        shares: [shareResponse],
        total: 1,
      },
    }
    mockGet.mockResolvedValue(apiResponse)

    const { api } = await import('@/api/client')
    const result = await api.listShares('my-entry')

    expect(mockGet).toHaveBeenCalledWith('/entries/my-entry/shares')
    expect(result.total).toBe(1)
    expect(result.shares).toHaveLength(1)
    expect(result.shares[0].id).toBe(1)
    expect(result.shares[0].tokenPrefix).toBe('aBcDeFgH')
    expect(result.shares[0].maxViews).toBe(10)
    expect(result.shares[0].viewCount).toBe(3)
    expect(result.shares[0].revokedAt).toBeNull()
  })

  // TC-API-03: revokeShares returns revoked_count
  it('revokeShares returns revoked_count from API', async () => {
    const apiResponse = { data: { revoked_count: 2 } }
    mockPost.mockResolvedValue(apiResponse)

    const { api } = await import('@/api/client')
    const result = await api.revokeShares('my-entry', { share_ids: [1, 2] })

    expect(mockPost).toHaveBeenCalledWith('/entries/my-entry/shares/revoke', {
      share_ids: [1, 2],
    })
    expect(result.revoked_count).toBe(2)
  })

  // TC-API-04: getEntry with shareToken passes param
  it('getEntry passes share token as query param', async () => {
    const entryResponse = {
      data: {
        id: 1,
        slug: 'my-entry',
        summary: 'Test',
        tags: [],
        status: 'active',
        files: [],
        is_public: false,
        owner_id: 1,
        username: 'alice',
        expires_at: null,
        created_at: '2026-06-29T00:00:00Z',
        updated_at: '2026-06-29T00:00:00Z',
        share_context: {
          is_share_access: true,
          shared_by: 'alice',
        },
      },
    }
    mockGet.mockResolvedValue(entryResponse)

    const { api } = await import('@/api/client')
    const result = await api.getEntry('my-entry', 'aBcDeFgHiJkLmNoP')

    expect(mockGet).toHaveBeenCalledWith('/entries/my-entry', {
      params: { share: 'aBcDeFgHiJkLmNoP' },
    })
    expect(result.shareContext).toBeDefined()
    expect(result.shareContext?.isShareAccess).toBe(true)
    expect(result.shareContext?.sharedBy).toBe('alice')
  })

  it('getEntry without shareToken does not pass share param', async () => {
    const entryResponse = {
      data: {
        id: 1,
        slug: 'my-entry',
        summary: 'Test',
        tags: [],
        status: 'active',
        files: [],
        is_public: true,
        owner_id: 1,
        username: 'alice',
        expires_at: null,
        created_at: '2026-06-29T00:00:00Z',
        updated_at: '2026-06-29T00:00:00Z',
      },
    }
    mockGet.mockResolvedValue(entryResponse)

    const { api } = await import('@/api/client')
    await api.getEntry('my-entry')

    expect(mockGet).toHaveBeenCalledWith('/entries/my-entry', undefined)
  })
})
