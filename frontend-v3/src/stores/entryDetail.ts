import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/api/client'
import { createLoadGuard, resolveLoadTarget } from '@/composables/useLoadGuard'
import type { Entry, File, TeamRef } from '@/types'

export const useEntryDetailStore = defineStore('entryDetail', () => {
  const currentEntry = ref<Entry | null>(null)
  const activeFile = ref<File | null>(null)
  const fileContent = ref<string>('')
  const wrapEnabled = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)
  // 请求序号守卫（TPV0104 补充修复 B/D）：只有最后发起的那次加载可以提交状态。
  const loadGuard = createLoadGuard()

  const isMultiFile = computed(() => {
    return (currentEntry.value?.files.length ?? 0) > 1
  })

  const canWrap = computed(() => {
    if (!activeFile.value) return false
    if (activeFile.value.isBinary) return false
    if (activeFile.value.language === 'markdown') return false
    if (activeFile.value.language === 'html') return false
    return true
  })

  const canCopy = computed(() => {
    if (!activeFile.value) return false
    if (activeFile.value.isBinary) return false
    return true
  })

  const canDownload = computed(() => activeFile.value !== null)

  const canPack = computed(() => (currentEntry.value?.files.length ?? 0) > 1)

  async function loadEntry(slug: string, fileId?: number, shareToken?: string): Promise<void> {
    // 竞态守卫：只有最后发起的那次加载可以提交状态（详见 useLoadGuard.ts）
    const seq = loadGuard.next()
    const isStale = () => !loadGuard.isCurrent(seq)

    loading.value = true
    error.value = null

    try {
      const [entry, prefetched] = await Promise.all([
        api.getEntry(slug, shareToken),
        api.getFileContent(slug, fileId ?? 0).catch(() => null),
      ])
      if (isStale()) return

      const { targetFile, content, needFetchTarget } = resolveLoadTarget(entry, fileId, prefetched)
      currentEntry.value = entry
      activeFile.value = targetFile
      fileContent.value = content ?? ''

      if (targetFile && needFetchTarget) {
        const body = await api.getFileContent(slug, targetFile.id)
        if (isStale()) return
        fileContent.value = body
      }
    } catch (err: any) {
      if (isStale()) return
      error.value = shareToken
        ? 'This share link is no longer valid.'
        : (err instanceof Error ? err.message : 'Failed to load entry')
      currentEntry.value = null
    } finally {
      if (!isStale()) loading.value = false
    }
  }

  async function selectFile(file: File): Promise<void> {
    if (activeFile.value?.id === file.id) return

    // 与 loadEntry 共用序号：快速连续切文件时只有最后一次内容请求可落地（修复 B/D）
    const seq = loadGuard.next()
    activeFile.value = file
    fileContent.value = ''
    if (file.isBinary || !currentEntry.value) return
    const slug = currentEntry.value.slug
    try {
      const content = await api.getFileContent(slug, file.id)
      if (loadGuard.isCurrent(seq)) fileContent.value = content
    } catch (err) {
      if (loadGuard.isCurrent(seq)) {
        error.value = err instanceof Error ? err.message : 'Failed to load file content'
      }
    }
  }

  const toggleWrap = (): void => { wrapEnabled.value = !wrapEnabled.value }

  function clearEntry(): void {
    currentEntry.value = null
    activeFile.value = null
    fileContent.value = ''
    wrapEnabled.value = false
    error.value = null
  }

  function syncVisibility(
    slug: string,
    patch: { isPublic: boolean; teamId: number | null; team: TeamRef | null },
  ): void {
    if (currentEntry.value?.slug === slug) {
      currentEntry.value = {
        ...currentEntry.value,
        isPublic: patch.isPublic,
        teamId: patch.teamId,
        team: patch.team,
      }
    }
  }

  function syncStar(data: { starCount: number; isStarred: boolean }): void {
    if (!currentEntry.value) return
    currentEntry.value = { ...currentEntry.value, starCount: data.starCount, isStarred: data.isStarred }
  }

  const clearIfSlug = (slug: string): void => {
    if (currentEntry.value?.slug === slug) clearEntry()
  }

  return {
    currentEntry,
    activeFile,
    fileContent,
    wrapEnabled,
    loading,
    error,
    isMultiFile,
    canWrap,
    canCopy,
    canDownload,
    canPack,
    loadEntry,
    selectFile,
    toggleWrap,
    clearEntry,
    syncVisibility,
    syncStar,
    clearIfSlug,
  }
})
