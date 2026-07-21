import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { PeekViewClient } from '../src/client.js'
import { listEntriesTool } from '../src/tools/listEntries.js'
import type { SessionContext } from '../src/types.js'

const mockServer = setupServer()

beforeAll(() => mockServer.listen())
afterEach(() => mockServer.resetHandlers())
afterAll(() => mockServer.close())

const client = new PeekViewClient({ peekviewUrl: 'http://localhost:8080' })

const testContext: SessionContext = {
  userToken: 'pv_test_key',
  userId: 1,
  username: 'alice',
}

function mockListResponse(items: any[] = []) {
  return HttpResponse.json({
    items,
    total: items.length,
    page: 1,
    per_page: 20,
  })
}

// ============================================================
// BDD-M1: MCP list_entries default (no status) returns only active
// ============================================================
describe('BDD-M1: list_entries default behavior (no status param)', () => {
  it('calls API without status param when no status is provided', async () => {
    let capturedUrl: string | undefined

    mockServer.use(
      http.get('http://localhost:8080/api/v1/entries', ({ request }) => {
        capturedUrl = request.url
        return mockListResponse([
          { id: 1, slug: 'active-1', summary: 'Active 1', tags: [], files: [], created_at: '2026-01-01T00:00:00Z', expires_at: null, is_public: true },
        ])
      })
    )

    const tool = listEntriesTool(client)
    const result = await tool.handler({}, testContext)

    expect(capturedUrl).toBeDefined()
    const url = new URL(capturedUrl!)
    expect(url.searchParams.has('status')).toBe(false)
    expect(result.content[0].text).not.toContain('error')
  })

  it('returns active entries only (server default filtering)', async () => {
    mockServer.use(
      http.get('http://localhost:8080/api/v1/entries', ({ request }) => {
        const url = new URL(request.url)
        // Server should only return active when no status param
        expect(url.searchParams.has('status')).toBe(false)
        return mockListResponse([
          { id: 1, slug: 'entry-a', summary: 'Item A', tags: [], files: [], created_at: '2026-01-01T00:00:00Z', expires_at: null, is_public: true },
          { id: 2, slug: 'entry-b', summary: 'Item B', tags: [], files: [], created_at: '2026-01-02T00:00:00Z', expires_at: null, is_public: false },
        ])
      })
    )

    const tool = listEntriesTool(client)
    const result = await tool.handler({}, testContext)

    expect(result.content[0].text).toContain('Found 2 entries')
    expect(result.content[0].text).toContain('Item A')
    expect(result.content[0].text).toContain('Item B')
  })
})

// ============================================================
// BDD-M2: MCP list_entries with status parameter filtering
// ============================================================
describe('BDD-M2: list_entries with status parameter', () => {
  it('passes status=archived to API and returns archived entries', async () => {
    let capturedUrl: string | undefined

    mockServer.use(
      http.get('http://localhost:8080/api/v1/entries', ({ request }) => {
        capturedUrl = request.url
        return mockListResponse([
          { id: 1, slug: 'archived-1', summary: 'Archived Entry', tags: [], files: [], created_at: '2026-01-01T00:00:00Z', expires_at: null, is_public: true },
        ])
      })
    )

    const tool = listEntriesTool(client)
    const result = await tool.handler({ status: 'archived' }, testContext)

    expect(capturedUrl).toBeDefined()
    const url = new URL(capturedUrl!)
    expect(url.searchParams.get('status')).toBe('archived')
    expect(result.content[0].text).toContain('Archived Entry')
  })

  it('passes status=active to API and returns active entries', async () => {
    let capturedUrl: string | undefined

    mockServer.use(
      http.get('http://localhost:8080/api/v1/entries', ({ request }) => {
        capturedUrl = request.url
        return mockListResponse([
          { id: 1, slug: 'active-1', summary: 'Active Entry', tags: [], files: [], created_at: '2026-01-01T00:00:00Z', expires_at: null, is_public: true },
        ])
      })
    )

    const tool = listEntriesTool(client)
    const result = await tool.handler({ status: 'active' }, testContext)

    expect(capturedUrl).toBeDefined()
    const url = new URL(capturedUrl!)
    expect(url.searchParams.get('status')).toBe('active')
    expect(result.content[0].text).toContain('Active Entry')
  })

  it('combines status with other query params', async () => {
    let capturedUrl: string | undefined

    mockServer.use(
      http.get('http://localhost:8080/api/v1/entries', ({ request }) => {
        capturedUrl = request.url
        return mockListResponse([])
      })
    )

    const tool = listEntriesTool(client)
    await tool.handler({ status: 'active', query: 'test', tags: ['demo'], page: 2, per_page: 10 }, testContext)

    const url = new URL(capturedUrl!)
    expect(url.searchParams.get('status')).toBe('active')
    expect(url.searchParams.get('q')).toBe('test')
    expect(url.searchParams.get('tags')).toBe('demo')
    expect(url.searchParams.get('page')).toBe('2')
    expect(url.searchParams.get('per_page')).toBe('10')
  })
})

// ============================================================
// BDD-M3: MCP list_entries status 非法值处理
// ============================================================
describe('BDD-M3: list_entries invalid status value', () => {
  it('returns zod validation error for invalid status value', async () => {
    let requestMade = false
    mockServer.use(
      http.get('http://localhost:8080/api/v1/entries', () => {
        requestMade = true
        return HttpResponse.json({ items: [], total: 0, page: 1, per_page: 20 })
      })
    )

    const tool = listEntriesTool(client)
    const result = await tool.handler({ status: 'invalid_status' }, testContext)

    // RED: current zod schema lacks status param → ignores invalid value, passes to API
    // After P4 implementation, zod will catch invalid values before API call
    // If request was made, it means validation didn't reject → RED
    if (!requestMade) {
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toMatch(/invalid|status|failed/i)
    }
    // Assert: should not reach the API with invalid status
    expect(requestMade).toBe(false)
  })

  it('returns zod validation error for empty string status', async () => {
    let requestMade = false
    mockServer.use(
      http.get('http://localhost:8080/api/v1/entries', () => {
        requestMade = true
        return HttpResponse.json({ items: [], total: 0, page: 1, per_page: 20 })
      })
    )

    const tool = listEntriesTool(client)
    await tool.handler({ status: '' }, testContext)

    expect(requestMade).toBe(false)
  })

  it('returns zod validation error for non-enum string', async () => {
    let requestMade = false
    mockServer.use(
      http.get('http://localhost:8080/api/v1/entries', () => {
        requestMade = true
        return HttpResponse.json({ items: [], total: 0, page: 1, per_page: 20 })
      })
    )

    const tool = listEntriesTool(client)
    await tool.handler({ status: 'deleted' }, testContext)

    expect(requestMade).toBe(false)
  })

  it('returns zod validation error for boolean status value', async () => {
    let requestMade = false
    mockServer.use(
      http.get('http://localhost:8080/api/v1/entries', () => {
        requestMade = true
        return HttpResponse.json({ items: [], total: 0, page: 1, per_page: 20 })
      })
    )

    const tool = listEntriesTool(client)
    await tool.handler({ status: true }, testContext)

    expect(requestMade).toBe(false)
  })
})

// ============================================================
// Client: listEntries passes status to URL
// ============================================================
describe('Client: listEntries with status', () => {
  it('client.listEntries passes status to URLSearchParams', async () => {
    let capturedUrl: string | undefined

    mockServer.use(
      http.get('http://localhost:8080/api/v1/entries', ({ request }) => {
        capturedUrl = request.url
        return mockListResponse([])
      })
    )

    // RED: current client.listEntries signature doesn't have status param
    // After P4 implementation, it will accept status
    await (client.listEntries as any)('pv_test_key', 1, 20, undefined, undefined, 'archived')

    const url = new URL(capturedUrl!)
    expect(url.searchParams.get('status')).toBe('archived')
  })

  it('client.listEntries omits status when not provided', async () => {
    let capturedUrl: string | undefined

    mockServer.use(
      http.get('http://localhost:8080/api/v1/entries', ({ request }) => {
        capturedUrl = request.url
        return mockListResponse([])
      })
    )

    await (client.listEntries as any)('pv_test_key', 1, 20, undefined, undefined, undefined)

    const url = new URL(capturedUrl!)
    expect(url.searchParams.has('status')).toBe(false)
  })
})
