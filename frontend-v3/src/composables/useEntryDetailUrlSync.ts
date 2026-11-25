import { computed, ref, watch } from 'vue'
import type { Ref } from 'vue'
import type { LocationQuery, Router } from 'vue-router'
import { resolveDefaultFile, normalizeFileQuery } from '@/utils/default-file'
import type { Entry, File, TocHeading } from '@/types'

type Query = LocationQuery

export function parseFileId(raw: unknown): number | undefined {
  if (raw == null) return undefined
  const value = Number(raw)
  return Number.isInteger(value) ? value : undefined
}

function sameQuery(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  if (keysA.length !== keysB.length) return false
  return keysA.every(key => String(a[key]) === String(b[key]))
}

export function useEntryDetailUrlSync(
  slug: Ref<string>,
  route: { query: Query; path: string },
  router: Router,
  currentEntry: Ref<Entry | null>,
  activeFile: Ref<File | null>,
) {
  const suppressUrlSync = ref(false)
  const defaultFileId = computed(() => resolveDefaultFile(currentEntry.value?.files ?? [])?.id ?? null)

  function normalizedQuery(): Query {
    const query = normalizeFileQuery(route.query, activeFile.value?.id ?? null, defaultFileId.value)
    delete query.firstFileId
    return query
  }

  function syncUrl(): void {
    const next = normalizedQuery()
    if (sameQuery(next, route.query)) return
    router.replace({ path: route.path, query: next })
  }

  function handleFullscreen(): void {
    if (!activeFile.value) return
    router.push({ path: `/${slug.value}/f`, query: normalizedQuery() })
  }

  watch(() => activeFile.value?.id ?? null, () => {
    if (suppressUrlSync.value) return
    syncUrl()
  })

  return { suppressUrlSync, defaultFileId, syncUrl, handleFullscreen }
}

export function useTocAutoExpand(
  tocHeadings: Ref<TocHeading[]>,
  isMarkdown: Ref<boolean>,
  isDesktop: Ref<boolean>,
  isTocOpen: Ref<boolean>,
  showTocDrawer: Ref<boolean>,
) {
  const userToggledToc = ref(false)

  watch(tocHeadings, (list) => {
    if (!isDesktop.value) return
    if (userToggledToc.value) return
    if (isMarkdown.value && list.length > 0) isTocOpen.value = true
  }, { flush: 'post' })

  function toggleToc(): void {
    userToggledToc.value = true
    isTocOpen.value = !isTocOpen.value
  }

  function toggleTocDrawer(): void {
    userToggledToc.value = true
    showTocDrawer.value = !showTocDrawer.value
  }

  function resetUserToggledToc(): void {
    userToggledToc.value = false
  }

  return { toggleToc, toggleTocDrawer, resetUserToggledToc }
}
