import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  mergeQuery,
  parseRestoreQuery,
  resolveSearchKeyAction,
  createDebouncedSearch,
} from '../searchUrl.logic'
import type { RestoredQuery, SearchKeyAction } from '../searchUrl.logic'
import { useDebounce } from '@/composables/useDebounce'

// ============================================================
// T026 search-url — P3 TDD tests (RED LIGHT)
//
// These tests import stub implementations from searchUrl.logic.ts.
// The stubs return intentionally wrong values, so ALL assertions
// that depend on correct mergeQuery / parseRestoreQuery /
// resolveSearchKeyAction / createDebouncedSearch behavior FAIL.
//
// Debounce tests use the real useDebounce composable (already
// implemented and tested in composables/__tests__/useDebounce.spec.ts)
// — those tests PASS because the composable is correct.
//
// After P4 implementation: update imports to point to the real
// functions exported from EntryListView.vue (or their extracted
// pure-logic module), and all tests turn GREEN.
// ============================================================

// ============================================================
// Tests: mergeQuery
// ============================================================
describe('mergeQuery — URL query parameter merge', () => {
  // TC-01 | BDD-1: add q to empty query
  it('adds q=python to empty query', () => {
    expect(mergeQuery('', { q: 'python' })).toBe('q=python')
  })

  // TC-02 | BDD-5: add q while preserving owner
  it('adds q=test while preserving existing owner=me', () => {
    expect(mergeQuery('owner=me', { q: 'test' })).toBe('owner=me&q=test')
  })

  // TC-03 | BDD-4: add owner while preserving q
  it('adds owner=me while preserving existing q=python', () => {
    expect(mergeQuery('q=python', { owner: 'me' })).toBe('q=python&owner=me')
  })

  // TC-04 | BDD-6: remove q while preserving owner
  it('removes q while preserving owner=me', () => {
    expect(mergeQuery('q=test&owner=me', { q: undefined })).toBe('owner=me')
  })

  // TC-05 | BDD-4 (reverse): remove owner while preserving q
  it('removes owner while preserving q=test (All tab from search)', () => {
    expect(mergeQuery('q=test&owner=me', { owner: undefined })).toBe('q=test')
  })

  // TC-06 | BDD-7: add page parameter
  it('adds page=2 while preserving q=demo', () => {
    expect(mergeQuery('q=demo', { page: '2' })).toBe('q=demo&page=2')
  })

  // TC-07 | BDD-12: page=1 is omitted (default)
  it('omits page=1 from URL (default value)', () => {
    expect(mergeQuery('q=other', { page: '1' })).toBe('q=other')
  })

  // TC-08 | BDD-12: search change resets page to 1
  it('resets page to 1 when search query changes', () => {
    expect(mergeQuery('q=demo&page=3', { q: 'other', page: undefined })).toBe('q=other')
  })

  // TC-09 | BDD-13: empty string removes the key
  it('removes q when value is empty string (blank input)', () => {
    expect(mergeQuery('q=python', { q: '' })).toBe('')
  })

  // TC-10 | BDD-3: undefined removes the key
  it('removes q when value is undefined (Esc clear)', () => {
    expect(mergeQuery('q=keyword', { q: undefined })).toBe('')
  })

  // TC-11 | BDD-14: simultaneous multi-param update
  it('updates q, owner, and page simultaneously', () => {
    const result = mergeQuery('q=old&page=3', { q: 'code', owner: 'me', page: '2' })
    expect(result).toContain('q=code')
    expect(result).toContain('owner=me')
    expect(result).toContain('page=2')
  })

  // TC-12 | BDD-14: build full query from scratch
  it('builds full query from empty string', () => {
    const result = mergeQuery('', { q: 'code', owner: 'me', page: '2' })
    expect(result).toContain('q=code')
    expect(result).toContain('owner=me')
    expect(result).toContain('page=2')
  })

  // TC-13: empty updates object preserves existing query
  it('preserves existing query when updates object is empty', () => {
    const result = mergeQuery('q=python&owner=me', {})
    expect(result).toContain('q=python')
    expect(result).toContain('owner=me')
  })

  // TC-14: special characters URL-encoded
  it('encodes spaces as + in query value', () => {
    expect(mergeQuery('', { q: 'hello world' })).toBe('q=hello+world')
  })

  // Edge: remove non-existent key is a no-op
  it('removing a non-existent key is a no-op', () => {
    expect(mergeQuery('q=test', { owner: undefined })).toBe('q=test')
  })

  // Edge: page=1 with no other params returns empty string
  it('setting only page=1 returns empty string', () => {
    expect(mergeQuery('', { page: '1' })).toBe('')
  })

  // Edge: page=1 removal from existing page=1
  it('removing page when it is already 1 is a no-op', () => {
    expect(mergeQuery('q=test', { page: '1' })).toBe('q=test')
  })
})

// ============================================================
// Tests: parseRestoreQuery
// ============================================================
describe('parseRestoreQuery — URL query parsing for restoreFromURL', () => {
  // TC-15 | BDD-8, BDD-14: restore all three params
  it('restores q, owner, and page from full query string', () => {
    expect(parseRestoreQuery('q=keyword&page=2&owner=me')).toEqual({
      q: 'keyword',
      owner: 'me',
      page: 2,
    })
  })

  // TC-16 | BDD-8: only q provided
  it('restores only q, defaults owner to null and page to 1', () => {
    expect(parseRestoreQuery('q=hello')).toEqual({
      q: 'hello',
      owner: null,
      page: 1,
    })
  })

  // TC-17: only owner provided
  it('restores only owner, defaults q to empty and page to 1', () => {
    expect(parseRestoreQuery('owner=me')).toEqual({
      q: '',
      owner: 'me',
      page: 1,
    })
  })

  // TC-18: empty query string
  it('returns defaults for empty query string', () => {
    expect(parseRestoreQuery('')).toEqual({
      q: '',
      owner: null,
      page: 1,
    })
  })

  // TC-19: non-numeric page falls back to 1
  it('falls back to page=1 when page is non-numeric', () => {
    expect(parseRestoreQuery('page=abc')).toEqual({
      q: '',
      owner: null,
      page: 1,
    })
  })

  // TC-20: negative page falls back to 1
  it('clamps negative page to 1', () => {
    expect(parseRestoreQuery('page=-5').page).toBe(1)
  })

  // TC-21: zero page falls back to 1
  it('clamps page=0 to 1', () => {
    expect(parseRestoreQuery('page=0').page).toBe(1)
  })

  // TC-22 | BDD-13: empty q param
  it('returns empty string for q when q= is present but empty', () => {
    expect(parseRestoreQuery('q=').q).toBe('')
  })

  // TC-23 | BDD-9: q only on user page (owner from props, not query)
  it('parses q from user-page URL without owner in query', () => {
    expect(parseRestoreQuery('q=notes')).toEqual({
      q: 'notes',
      owner: null,
      page: 1,
    })
  })

  // Edge: large page number
  it('accepts large valid page numbers', () => {
    expect(parseRestoreQuery('page=999').page).toBe(999)
  })

  // Edge: page with leading zeros
  it('parses page=05 as 5', () => {
    expect(parseRestoreQuery('page=05').page).toBe(5)
  })

  // Edge: mixed valid and invalid
  it('restores valid params alongside invalid page', () => {
    expect(parseRestoreQuery('q=test&page=xyz&owner=alice')).toEqual({
      q: 'test',
      owner: 'alice',
      page: 1,
    })
  })

  // Edge: URL-encoded query value
  it('decodes URL-encoded q values', () => {
    expect(parseRestoreQuery('q=hello+world').q).toBe('hello world')
  })
})

// ============================================================
// Tests: resolveSearchKeyAction
// ============================================================
describe('resolveSearchKeyAction — keyboard event dispatch', () => {
  // TC-24 | BDD-2: Enter → flush
  it('returns flush for Enter key', () => {
    expect(resolveSearchKeyAction('Enter')).toBe('flush')
  })

  // TC-25 | BDD-3: Escape → clear
  it('returns clear for Escape key', () => {
    expect(resolveSearchKeyAction('Escape')).toBe('clear')
  })

  // TC-26 | BDD-1: normal character → none
  it('returns none for character key "a"', () => {
    expect(resolveSearchKeyAction('a')).toBe('none')
  })

  // TC-27: Backspace → none
  it('returns none for Backspace key', () => {
    expect(resolveSearchKeyAction('Backspace')).toBe('none')
  })

  // TC-28: Tab → none
  it('returns none for Tab key', () => {
    expect(resolveSearchKeyAction('Tab')).toBe('none')
  })

  // Edge: Space → none
  it('returns none for Space key', () => {
    expect(resolveSearchKeyAction(' ')).toBe('none')
  })

  // Edge: Delete → none
  it('returns none for Delete key', () => {
    expect(resolveSearchKeyAction('Delete')).toBe('none')
  })

  // Edge: Arrow keys → none
  it('returns none for arrow keys', () => {
    expect(resolveSearchKeyAction('ArrowLeft')).toBe('none')
    expect(resolveSearchKeyAction('ArrowRight')).toBe('none')
  })
})

// ============================================================
// Tests: createDebouncedSearch with fake timers
// (Tests the stub — these WILL FAIL because the stub doesn't
//  actually debounce or call the wrapped function)
// ============================================================
describe('createDebouncedSearch — search debounce wrapper', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // TC-29 | BDD-1: rapid input only triggers one execution
  it('triggers only once after 300ms of rapid typing', () => {
    const fn = vi.fn()
    const { debounced } = createDebouncedSearch(fn, 300)

    debounced('p')
    vi.advanceTimersByTime(50)
    debounced('py')
    vi.advanceTimersByTime(50)
    debounced('python')

    vi.advanceTimersByTime(299)
    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('python')
  })

  // TC-30 | BDD-2: cancel (Enter bypass) prevents deferred call
  it('cancel prevents the deferred debounced call from firing', () => {
    const fn = vi.fn()
    const { debounced, cancel } = createDebouncedSearch(fn, 300)

    debounced('react')
    cancel()

    vi.advanceTimersByTime(500)
    expect(fn).not.toHaveBeenCalled()
  })

  // TC-31 | BDD-1: single call fires after 300ms
  it('fires after exactly 300ms for a single call', () => {
    const fn = vi.fn()
    const { debounced } = createDebouncedSearch(fn, 300)

    debounced('test')
    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(299)
    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('test')
  })

  // Edge: resetting timer on each call
  it('resets timer when called again within delay window', () => {
    const fn = vi.fn()
    const { debounced } = createDebouncedSearch(fn, 300)

    debounced('a')
    vi.advanceTimersByTime(250)
    debounced('b')
    vi.advanceTimersByTime(250)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(50)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('b')
  })

  // Edge: cancel without prior call is safe
  it('cancel is safe when no timer is active', () => {
    const fn = vi.fn()
    const { cancel } = createDebouncedSearch(fn, 300)

    expect(() => cancel()).not.toThrow()
    vi.advanceTimersByTime(500)
    expect(fn).not.toHaveBeenCalled()
  })
})

// ============================================================
// Debounce composable verification (real useDebounce, NOT stub)
// These tests verify the 300ms search debounce interaction
// pattern that EntryListView.vue will use with the real
// useDebounce composable. These PASS because useDebounce is
// already implemented.
// ============================================================
describe('search debounce interaction (real useDebounce)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // BDD-1: 300ms debounce — rapid typing only triggers one API call
  it('300ms debounce: rapid typing triggers only one call', () => {
    const loadEntries = vi.fn()
    const debouncedSearch = useDebounce(loadEntries, 300)

    // Simulate typing "python" character by character
    debouncedSearch('p')
    vi.advanceTimersByTime(50)
    debouncedSearch('py')
    vi.advanceTimersByTime(50)
    debouncedSearch('pyt')
    vi.advanceTimersByTime(50)
    debouncedSearch('pyth')
    vi.advanceTimersByTime(50)
    debouncedSearch('pytho')
    vi.advanceTimersByTime(50)
    debouncedSearch('python')

    vi.advanceTimersByTime(299)
    expect(loadEntries).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(loadEntries).toHaveBeenCalledTimes(1)
    expect(loadEntries).toHaveBeenCalledWith('python')
  })

  // BDD-2: Enter bypasses 300ms debounce
  it('Enter bypasses debounce: caller cancels timer and invokes directly', () => {
    const loadEntries = vi.fn()

    // Simulate the pattern: useDebounce for normal input, direct call for Enter
    // The debounce timer is cleared and the function called immediately
    let timer: ReturnType<typeof setTimeout> | null = null

    function onInput(val: string) {
      if (timer !== null) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        loadEntries(val)
      }, 300)
    }

    function onEnter(val: string) {
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
      loadEntries(val)
    }

    // Start debounced input
    onInput('rea')
    onInput('reac')
    onInput('react')

    // Before 300ms, loadEntries not called
    vi.advanceTimersByTime(200)
    expect(loadEntries).not.toHaveBeenCalled()

    // Enter pressed — immediate flush
    onEnter('react')
    expect(loadEntries).toHaveBeenCalledTimes(1)
    expect(loadEntries).toHaveBeenCalledWith('react')

    // Timer was cancelled, so advancing past 300ms doesn't fire again
    vi.advanceTimersByTime(500)
    expect(loadEntries).toHaveBeenCalledTimes(1)
  })
})

// ============================================================
// Integration: mergeQuery ↔ parseRestoreQuery round-trip
//
// These test the full query lifecycle using the STUB functions,
// so they WILL FAIL until P4 implements the real logic.
// ============================================================
describe('mergeQuery ↔ parseRestoreQuery round-trip', () => {
  it('round-trips q param through merge and restore', () => {
    const merged = mergeQuery('', { q: 'hello' })
    const restored = parseRestoreQuery(merged)
    expect(restored.q).toBe('hello')
  })

  it('round-trips q + owner through merge and restore', () => {
    const merged = mergeQuery('', { q: 'test', owner: 'me' })
    const restored = parseRestoreQuery(merged)
    expect(restored.q).toBe('test')
    expect(restored.owner).toBe('me')
  })

  it('round-trips q + owner + page through merge and restore', () => {
    const merged = mergeQuery('', { q: 'code', owner: 'me', page: '2' })
    const restored = parseRestoreQuery(merged)
    expect(restored.q).toBe('code')
    expect(restored.owner).toBe('me')
    expect(restored.page).toBe(2)
  })

  it('merge-remove round-trip: add then remove owner', () => {
    const withOwner = mergeQuery('q=test', { owner: 'me' })
    expect(parseRestoreQuery(withOwner).owner).toBe('me')

    const withoutOwner = mergeQuery(withOwner, { owner: undefined })
    expect(parseRestoreQuery(withoutOwner).owner).toBeNull()
    expect(parseRestoreQuery(withoutOwner).q).toBe('test')
  })

  it('merge-remove round-trip: add then clear q', () => {
    const withQ = mergeQuery('owner=me', { q: 'search' })
    expect(parseRestoreQuery(withQ).q).toBe('search')

    const withoutQ = mergeQuery(withQ, { q: '' })
    expect(parseRestoreQuery(withoutQ).q).toBe('')
    expect(parseRestoreQuery(withoutQ).owner).toBe('me')
  })
})
