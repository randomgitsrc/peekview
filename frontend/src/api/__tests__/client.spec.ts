import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api } from '../client'
import { PeekApiError } from '../../types'

// Mock fetch globally
const mockFetch = vi.fn()
;(globalThis as any).fetch = mockFetch as unknown as typeof fetch

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear any meta tags
    document.head.innerHTML = ''
  })

  describe('AC1: request with API key', () => {
    it('includes API key from meta tag', async () => {
      // Create meta tag with API key
      const meta = document.createElement('meta')
      meta.setAttribute('name', 'peek-api-key')
      meta.setAttribute('content', 'test-api-key')
      document.head.appendChild(meta)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('{"items":[],"total":0}'),
      } as Response)

      await api.listEntries()

      expect(mockFetch).toHaveBeenCalled()
      const [, options] = mockFetch.mock.calls[0]
      expect(options.headers).toMatchObject({
        'X-API-Key': 'test-api-key',
      })
    })

    it('works without API key when not configured', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('{"items":[],"total":0}'),
      } as Response)

      await api.listEntries()

      expect(mockFetch).toHaveBeenCalled()
    })
  })

  describe('AC2: error handling', () => {
    it('throws PeekApiError on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: { code: 'NOT_FOUND', message: 'Entry not found' } }),
        text: () => Promise.resolve('{"error":{"code":"NOT_FOUND","message":"Entry not found"}}'),
      } as Response)

      await expect(api.getEntry('nonexistent')).rejects.toThrow(PeekApiError)
    })

    it('extracts error code from response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: { code: 'SERVER_ERROR', message: 'Server error' } }),
        text: () => Promise.resolve('{"error":{"code":"SERVER_ERROR","message":"Server error"}}'),
      } as Response)

      try {
        await api.getEntry('test')
      } catch (e: any) {
        expect(e).toBeInstanceOf(PeekApiError)
        expect(e.code).toBe('SERVER_ERROR')
        expect(e.message).toBe('Server error')
      }
    })

    it('uses UNKNOWN code for non-JSON errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('Invalid JSON')),
        text: () => Promise.resolve('Internal Server Error'),
      } as Response)

      try {
        await api.getEntry('test')
      } catch (e: any) {
        expect(e.code).toBe('UNKNOWN')
      }
    })
  })

  describe('AC3: listEntries', () => {
    it('fetches entries without params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('{"items":[],"total":0,"page":1,"per_page":20}'),
      } as Response)

      const result = await api.listEntries()

      expect(mockFetch).toHaveBeenCalled()
      const [url] = mockFetch.mock.calls[0]
      expect(url).toContain('/api/v1/entries')
      expect(result.items).toEqual([])
      expect(result.total).toBe(0)
    })

    it('includes search query', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('{"items":[],"total":0}'),
      } as Response)

      await api.listEntries({ q: 'python' })

      const [url] = mockFetch.mock.calls[0]
      expect(url).toContain('q=python')
    })

    it('includes pagination params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('{"items":[],"total":0}'),
      } as Response)

      await api.listEntries({ page: 2, per_page: 10 })

      const url = mockFetch.mock.calls[0][0] as string
      expect(url).toContain('page=2')
      expect(url).toContain('per_page=10')
    })

    it('includes tags filter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('{"items":[],"total":0}'),
      } as Response)

      await api.listEntries({ tags: 'python,vue' })

      const url = mockFetch.mock.calls[0][0] as string
      expect(url).toContain('tags=python%2Cvue')
    })
  })

  describe('AC4: getEntry', () => {
    it('fetches entry by slug', async () => {
      const mockEntry = {
        id: 1,
        slug: 'test-entry',
        summary: 'Test',
        status: 'active',
        tags: [],
        files: [],
        created_at: '2026-04-23T00:00:00Z',
        updated_at: '2026-04-23T00:00:00Z',
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockEntry)),
      } as Response)

      const result = await api.getEntry('test-entry')

      const [url] = mockFetch.mock.calls[0]
      expect(url).toContain('/api/v1/entries/test-entry')
      expect(result.slug).toBe('test-entry')
    })

    it('includes include parameter for file content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('{}'),
      } as Response)

      await api.getEntry('test-entry', { include: 'files.content' })

      const url = mockFetch.mock.calls[0][0] as string
      expect(url).toContain('include=files.content')
    })
  })

  describe('fetchFileContent', () => {
    it('fetches file content as text', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('file content here'),
      } as Response)

      const content = await api.fetchFileContent('test-entry', 1)

      const [url] = mockFetch.mock.calls[0]
      expect(url).toContain('/api/v1/entries/test-entry/files/1/content')
      expect(content).toBe('file content here')
    })
  })

  describe('downloadFile', () => {
    it('returns download URL', () => {
      const url = api.downloadFile('test-entry', 1)
      expect(url).toBe('/api/v1/entries/test-entry/files/1/download')
    })
  })
})
