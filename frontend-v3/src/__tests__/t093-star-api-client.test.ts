/**
 * TPV0093 star-lifecycle — P3 TDD 红灯测试（frontend）
 *
 * 覆盖 P2 §7 design-4（client.ts transform 映射）+ §4.6 API 契约的客户端方法：
 * - transformListItem / transformEntry 补 star_count→starCount、is_starred→isStarred、
 *   countdown→countdown 映射（当前未映射 → 红灯）
 * - api.star(slug) / api.unstar(slug) / api.listStars(params) / api.removeStars(entryIds)
 *   方法存在（当前不存在 → 红灯）
 *
 * 被测：src/api/client.ts（已存在，P4 加 star 方法与字段映射）
 * P2-design §2.1：client.ts transformListItem/transformEntry 补 star_count 映射。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api } from '@/api/client'

function makeListRaw(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    slug: 'entry-1',
    summary: 'Entry 1',
    tags: [],
    status: 'active',
    file_count: 0,
    is_public: true,
    owner_id: 1,
    username: 'alice',
    expires_at: null,
    archived_at: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...overrides,
  }
}

describe('api/client — design-4: transform 映射星标字段', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('TC-TRANSFORM-01: transformListItem 将 star_count 映射为 starCount', async () => {
    const mockGet = vi.fn().mockResolvedValue({
      data: {
        items: [makeListRaw({ star_count: 7, is_starred: true })],
        total: 1,
        page: 1,
        per_page: 20,
      },
    })
    const axios = (api as unknown as { client: { get: typeof mockGet } }).client
    const originalGet = axios.get
    axios.get = mockGet

    try {
      const result = await api.listEntries({})
      expect(result.items[0].starCount).toBe(7)
      expect(result.items[0].isStarred).toBe(true)
    } finally {
      axios.get = originalGet
    }
  })

  it('TC-TRANSFORM-02: transformListItem 将 countdown 透传为 countdown', async () => {
    const mockGet = vi.fn().mockResolvedValue({
      data: {
        items: [makeListRaw({ countdown: { status: 'running', remaining_days: 3, archive_delete_at: '2026-08-20T00:00:00Z' } })],
        total: 1,
        page: 1,
        per_page: 20,
      },
    })
    const axios = (api as unknown as { client: { get: typeof mockGet } }).client
    const originalGet = axios.get
    axios.get = mockGet

    try {
      const result = await api.listEntries({})
      expect(result.items[0].countdown).toEqual({ status: 'running', remainingDays: 3, archiveDeleteAt: '2026-08-20T00:00:00Z' })
    } finally {
      axios.get = originalGet
    }
  })

  it('TC-TRANSFORM-03: transformEntry 将 star_count/is_starred 映射（详情响应）', async () => {
    const mockGet = vi.fn().mockResolvedValue({
      data: {
        id: 1,
        slug: 'entry-1',
        summary: 'Entry 1',
        tags: [],
        status: 'archived',
        files: [],
        is_public: true,
        owner_id: 1,
        username: 'alice',
        expires_at: null,
        archived_at: '2026-07-01T00:00:00Z',
        created_at: '2026-08-01T00:00:00Z',
        updated_at: '2026-08-01T00:00:00Z',
        star_count: 4,
        is_starred: true,
      },
    })
    const axios = (api as unknown as { client: { get: typeof mockGet } }).client
    const originalGet = axios.get
    axios.get = mockGet

    try {
      const entry = await api.getEntry('entry-1')
      expect(entry.starCount).toBe(4)
      expect(entry.isStarred).toBe(true)
    } finally {
      axios.get = originalGet
    }
  })
})

describe('api/client — §4.6 star API 方法', () => {
  it('TC-API-01: api.star 方法存在（POST /entries/{slug}/star）', () => {
    expect(typeof (api as unknown as Record<string, unknown>).star).toBe('function')
  })

  it('TC-API-02: api.unstar 方法存在（DELETE /entries/{slug}/star）', () => {
    expect(typeof (api as unknown as Record<string, unknown>).unstar).toBe('function')
  })

  it('TC-API-03: api.listStars 方法存在（GET /api/v1/stars，我的星标+墓碑）', () => {
    expect(typeof (api as unknown as Record<string, unknown>).listStars).toBe('function')
  })

  it('TC-API-04: api.removeStars 方法存在（DELETE /api/v1/stars 批量移除）', () => {
    expect(typeof (api as unknown as Record<string, unknown>).removeStars).toBe('function')
  })

  it('TC-API-05: api.star 调用 POST /entries/{slug}/star 并返回 {star_count, is_starred}', async () => {
    const mockPost = vi.fn().mockResolvedValue({
      data: { star_count: 6, is_starred: true, already_starred: false },
    })
    const axios = (api as unknown as { client: { post: typeof mockPost } }).client
    const originalPost = axios.post
    axios.post = mockPost

    try {
      const starFn = (api as unknown as { star: (slug: string) => Promise<unknown> }).star
      const result = await starFn('entry-1')
      expect(mockPost).toHaveBeenCalledWith('/entries/entry-1/star')
      expect(result).toMatchObject({ star_count: 6, is_starred: true })
    } finally {
      axios.post = originalPost
    }
  })
})
