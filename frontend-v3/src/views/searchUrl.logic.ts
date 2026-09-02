// ============================================================
// T026 search-url — Pure logic functions for URL query management
//
// These functions are used by EntryListView.vue to:
//   - mergeQuery: build new URL query strings from current state
//   - parseRestoreQuery: restore state from URL on mount / back/forward
//   - resolveSearchKeyAction: dispatch keyboard events for search input
//   - createDebouncedSearch: debounce wrapper with cancel support
// ============================================================

export function mergeQuery(
  currentQueryString: string,
  updates: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams(currentQueryString)

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || value === '') {
      params.delete(key)
    } else if (key === 'page' && value === '1') {
      // page=1 is the default, omit from URL for cleanliness
      params.delete(key)
    } else {
      params.set(key, value)
    }
  }

  return params.toString()
}

export interface RestoredQuery {
  q: string
  owner: string | null
  status: string | null
  page: number
  tags: string[]
  team?: string | null
  view?: 'teams' | null
}

export function parseRestoreQuery(queryString: string): RestoredQuery {
  const params = new URLSearchParams(queryString)

  const q = params.get('q') ?? ''
  const owner = params.get('owner') ?? null
  const status = params.get('status') ?? null
  const tagsParam = params.get('tags')
  const tags = tagsParam ? tagsParam.split(',').filter(Boolean) : []
  // team/view 用 undefined（而非 null）表达"URL 无此维度"：
  // 既有 spec 的 toEqual 精确断言忽略 undefined 属性，team/view 新键不破坏旧对象全等；
  // 新 spec（toHaveProperty / spread）仍能感知键存在。
  const team = params.get('team') ?? undefined
  const viewParam = params.get('view')
  const view = viewParam === 'teams' ? 'teams' : undefined

  let page = 1
  const pageParam = params.get('page')
  if (pageParam !== null) {
    const parsed = parseInt(pageParam, 10)
    if (!isNaN(parsed) && parsed > 0) {
      page = parsed
    }
  }

  return { q, owner, status, page, tags, team, view }
}

export type SearchKeyAction = 'flush' | 'clear' | 'none'

export function resolveSearchKeyAction(key: string): SearchKeyAction {
  if (key === 'Enter') return 'flush'
  if (key === 'Escape') return 'clear'
  return 'none'
}

export function createDebouncedSearch<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number,
): { debounced: (...args: Parameters<T>) => void; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null

  const debounced = (...args: Parameters<T>): void => {
    if (timer !== null) {
      clearTimeout(timer)
    }
    timer = setTimeout(() => {
      timer = null
      fn(...args)
    }, delay)
  }

  const cancel = (): void => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  return { debounced, cancel }
}
