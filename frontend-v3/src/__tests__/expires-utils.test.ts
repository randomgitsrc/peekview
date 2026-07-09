import { describe, it, expect } from 'vitest'
import { isExpired } from '@/utils/expires'

function makeEntry(overrides: { status?: string; expiresAt?: string | null } = {}) {
  return {
    status: overrides.status ?? 'active',
    expiresAt: overrides.expiresAt ?? null,
  }
}

describe('isExpired', () => {
  it('TC-C13: active + past expiresAt → true', () => {
    const entry = makeEntry({ status: 'active', expiresAt: new Date(Date.now() - 86400000).toISOString() })
    expect(isExpired(entry)).toBe(true)
  })

  it('TC-C14: active + future expiresAt → false', () => {
    const entry = makeEntry({ status: 'active', expiresAt: new Date(Date.now() + 7 * 86400000).toISOString() })
    expect(isExpired(entry)).toBe(false)
  })

  it('TC-C15: active + null expiresAt → false', () => {
    const entry = makeEntry({ status: 'active', expiresAt: null })
    expect(isExpired(entry)).toBe(false)
  })

  it('TC-C16: archived + past expiresAt → false', () => {
    const entry = makeEntry({ status: 'archived', expiresAt: new Date(Date.now() - 86400000).toISOString() })
    expect(isExpired(entry)).toBe(false)
  })
})
