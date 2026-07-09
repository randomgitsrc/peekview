import { describe, it, expect } from 'vitest'
import { parseRestoreQuery, mergeQuery } from '@/views/searchUrl.logic'

describe('parseRestoreQuery', () => {
  it('parses status=archived from query string', () => {
    const result = parseRestoreQuery('status=archived')
    expect(result.status).toBe('archived')
  })

  it('returns null status when not present', () => {
    const result = parseRestoreQuery('q=test&page=2')
    expect(result.status).toBeNull()
  })

  it('parses all fields including status', () => {
    const result = parseRestoreQuery('q=hello&owner=me&status=archived&page=3')
    expect(result.q).toBe('hello')
    expect(result.owner).toBe('me')
    expect(result.status).toBe('archived')
    expect(result.page).toBe(3)
  })

  it('returns defaults for empty query', () => {
    const result = parseRestoreQuery('')
    expect(result.q).toBe('')
    expect(result.owner).toBeNull()
    expect(result.status).toBeNull()
    expect(result.page).toBe(1)
  })
})

describe('mergeQuery', () => {
  it('adds status parameter', () => {
    const result = mergeQuery('q=test', { status: 'archived' })
    expect(result).toContain('q=test')
    expect(result).toContain('status=archived')
  })

  it('removes status when undefined', () => {
    const result = mergeQuery('status=archived&q=test', { status: undefined })
    expect(result).not.toContain('status')
    expect(result).toContain('q=test')
  })
})
