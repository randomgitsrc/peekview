// ============================================================
// T026 search-url — Stub implementations (TDD red light)
//
// These functions WILL be implemented in EntryListView.vue during P4.
// Currently they are intentionally wrong stubs so P3 tests fail.
//
// After P4: the real logic lives in EntryListView.vue <script setup>.
// This file may be deleted or kept as a pure-logic extraction.
// ============================================================

export function mergeQuery(
  _currentQueryString: string,
  _updates: Record<string, string | undefined>,
): string {
  // STUB: returns empty string, ignoring all inputs
  return ''
}

export interface RestoredQuery {
  q: string
  owner: string | null
  page: number
}

export function parseRestoreQuery(_queryString: string): RestoredQuery {
  // STUB: returns hardcoded defaults, ignoring the URL
  return { q: '', owner: null, page: 1 }
}

export type SearchKeyAction = 'flush' | 'clear' | 'none'

export function resolveSearchKeyAction(_key: string): SearchKeyAction {
  // STUB: always returns 'none', even for Enter/Escape
  return 'none'
}

export function createDebouncedSearch<T extends (...args: unknown[]) => unknown>(
  _fn: T,
  _delay: number,
): { debounced: (...args: Parameters<T>) => void; cancel: () => void } {
  // STUB: debounced calls immediately (no debounce), cancel is no-op
  const debounced = (..._args: Parameters<T>): void => {
    // does nothing
  }
  const cancel = (): void => {
    // does nothing
  }
  return { debounced, cancel }
}
