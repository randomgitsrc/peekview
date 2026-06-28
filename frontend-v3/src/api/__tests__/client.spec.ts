import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import type { EntryListApiResponse } from '@/api/types'
import type { EntryListResponse } from '@/types'

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

describe('API client: listEntries ownerFound passthrough', () => {
  let mockGet: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.resetModules()
    mockGet = vi.fn()
    const mockClient = {
      get: mockGet,
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        response: { use: vi.fn() },
      },
    }
    mockAxios.create = vi.fn(() => mockClient)
    vi.clearAllMocks()
  })

  it('passes owner_found=true through as ownerFound=true', async () => {
    const response: { data: EntryListApiResponse } = {
      data: {
        items: [],
        total: 0,
        page: 1,
        per_page: 20,
        owner_found: true,
      },
    }
    mockGet.mockResolvedValue(response)

    // Re-import to get fresh instance with mocked axios
    const { api } = await import('@/api/client')
    const result: EntryListResponse = await api.listEntries({ owner: 'alice' })

    expect(result.ownerFound).toBe(true)
  })

  it('passes owner_found=false through as ownerFound=false', async () => {
    const response: { data: EntryListApiResponse } = {
      data: {
        items: [],
        total: 0,
        page: 1,
        per_page: 20,
        owner_found: false,
      },
    }
    mockGet.mockResolvedValue(response)

    const { api } = await import('@/api/client')
    const result: EntryListResponse = await api.listEntries({ owner: 'nonexistent' })

    expect(result.ownerFound).toBe(false)
  })

  it('returns ownerFound=null when owner_found is absent from API response', async () => {
    const response: { data: EntryListApiResponse } = {
      data: {
        items: [
          {
            id: 1,
            slug: 'test',
            summary: 'Test',
            tags: [],
            status: 'active',
            file_count: 1,
            is_public: true,
            owner_id: null,
            username: null,
            expires_at: null,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
        ],
        total: 1,
        page: 1,
        per_page: 20,
        // owner_found intentionally omitted
      },
    }
    mockGet.mockResolvedValue(response)

    const { api } = await import('@/api/client')
    const result: EntryListResponse = await api.listEntries()

    expect(result.ownerFound).toBe(null)
  })

  it('returns ownerFound=null when owner_found is null in API response', async () => {
    const response: { data: EntryListApiResponse } = {
      data: {
        items: [],
        total: 0,
        page: 1,
        per_page: 20,
        owner_found: null,
      },
    }
    mockGet.mockResolvedValue(response)

    const { api } = await import('@/api/client')
    const result: EntryListResponse = await api.listEntries({ owner: 'me' })

    expect(result.ownerFound).toBe(null)
  })

  it('transforms entry list items correctly alongside ownerFound', async () => {
    const response: { data: EntryListApiResponse } = {
      data: {
        items: [
          {
            id: 42,
            slug: 'hello-world',
            summary: 'Hello World',
            tags: ['demo'],
            status: 'active',
            file_count: 3,
            is_public: true,
            owner_id: 7,
            username: 'alice',
            expires_at: null,
            created_at: '2026-06-01T12:00:00Z',
            updated_at: '2026-06-01T12:00:00Z',
          },
        ],
        total: 1,
        page: 1,
        per_page: 20,
        owner_found: true,
      },
    }
    mockGet.mockResolvedValue(response)

    const { api } = await import('@/api/client')
    const result: EntryListResponse = await api.listEntries({ owner: 'alice' })

    expect(result.items).toHaveLength(1)
    expect(result.items[0].slug).toBe('hello-world')
    expect(result.items[0].username).toBe('alice')
    expect(result.ownerFound).toBe(true)
  })
})
