// frontend/src/composables/useEntry.ts

import { ref } from 'vue'
import { api } from '../api/client'
import type { EntryResponse, EntryListItem } from '../types'
import { PeekApiError } from '../types'

interface CacheEntry {
  data: EntryResponse
  timestamp: number
}

/** Simple in-memory cache for entry data. */
const entryCache = new Map<string, CacheEntry>()
const CACHE_MAX_AGE = 30_000  // 30 seconds

export function useEntry() {
  const entry = ref<EntryResponse | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const errorCode = ref<string | null>(null)

  /**
   * Fetch entry by slug. Uses cache if fresh.
   * Optionally includes file content inline (?include=files.content).
   */
  async function fetchEntry(
    slug: string,
    options?: { includeContent?: boolean; maxAge?: number },
  ) {
    const maxAge = options?.maxAge ?? CACHE_MAX_AGE

    // Check cache
    const cached = entryCache.get(slug)
    if (cached && Date.now() - cached.timestamp < maxAge) {
      entry.value = cached.data
      error.value = null
      errorCode.value = null
      return
    }

    loading.value = true
    error.value = null
    errorCode.value = null

    try {
      const opts: { include?: string } = {}
      if (options?.includeContent) {
        opts.include = 'files.content'
      }
      entry.value = await api.getEntry(slug, opts)
      entryCache.set(slug, { data: entry.value, timestamp: Date.now() })
    } catch (e: unknown) {
      if (e instanceof PeekApiError) {
        error.value = e.message
        errorCode.value = e.code
      } else if (e instanceof Error) {
        error.value = e.message
        errorCode.value = 'UNKNOWN'
      } else {
        error.value = 'An unexpected error occurred'
        errorCode.value = 'UNKNOWN'
      }
    } finally {
      loading.value = false
    }
  }

  /** Clear cache for a specific slug or all entries. */
  function clearCache(slug?: string) {
    if (slug) {
      entryCache.delete(slug)
    } else {
      entryCache.clear()
    }
  }

  /** Reset entire cache (for testing). */
  function _resetCache() {
    entryCache.clear()
  }

  return { entry, loading, error, errorCode, fetchEntry, clearCache, _resetCache }
}

/** Entry list state — separate composable for the list page. */
export function useEntryList() {
  const entries = ref<EntryListItem[]>([])
  const total = ref(0)
  const totalPages = ref(1)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const errorCode = ref<string | null>(null)

  async function fetchEntries(params?: {
    q?: string
    tags?: string
    page?: number
    per_page?: number
  }) {
    loading.value = true
    error.value = null
    errorCode.value = null

    try {
      const resp = await api.listEntries(params)
      entries.value = resp.items
      total.value = resp.total
      totalPages.value =
        resp.per_page > 0 ? Math.ceil(resp.total / resp.per_page) : 1
    } catch (e: unknown) {
      if (e instanceof PeekApiError) {
        error.value = e.message
        errorCode.value = e.code
      } else if (e instanceof Error) {
        error.value = e.message
        errorCode.value = 'UNKNOWN'
      } else {
        error.value = 'An unexpected error occurred'
        errorCode.value = 'UNKNOWN'
      }
    } finally {
      loading.value = false
    }
  }

  return {
    entries,
    total,
    totalPages,
    loading,
    error,
    errorCode,
    fetchEntries,
  }
}
