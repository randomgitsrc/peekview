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


/**
 * TPV0104 补充修复 B — URL → Store 的加载编排（供 onMounted 与路由变化共用）
 *
 * 修复前：slug watcher 只调 `loadEntry(newSlug)`，丢失 `route.query.file` / `share`，
 * 且随后的 `syncUrl()` 会把有效 file 参数清掉（Vue Router 复用同一组件时必然触发）。
 *
 * 本函数保证：用**当前路由**的 file + share 加载对应 slug；等状态建立完成后才规范化 URL。
 * 抽成独立模块是为了守住 t082 的既有行数契约（`EntryDetailView.vue < 300` 行）。
 */
export function useRouteDrivenLoad(
  route: { query: Query },
  store: {
    loadEntry: (slug: string, fileId?: number, shareToken?: string) => Promise<void>
    error: string | null
  },
  currentEntry: Ref<Entry | null>,
  suppressUrlSync: Ref<boolean>,
  syncUrl: () => void,
  shareErrorState: Ref<boolean>,
  nextTickFn: () => Promise<void>,
) {
  async function loadFromRoute(targetSlug: string): Promise<void> {
    const shareToken = route.query.share as string | undefined
    const fileId = parseFileId(route.query.file)

    // 加载期间禁止 Store→URL 同步，避免用中间态（默认文件）覆写 URL
    suppressUrlSync.value = true
    try {
      await store.loadEntry(targetSlug, fileId, shareToken)
      shareErrorState.value = !!(shareToken && !currentEntry.value && store.error)
    } finally {
      // 状态建立完成后才规范化 URL（此时 activeFile 已是路由指定的那个文件）
      syncUrl()
      await nextTickFn()
      suppressUrlSync.value = false
    }
  }

  return { loadFromRoute }
}
