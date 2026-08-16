import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/api/client'
import type { Entry, File } from '@/types'

export const useEntryDetailStore = defineStore('entryDetail', () => {
  const currentEntry = ref<Entry | null>(null)
  const activeFile = ref<File | null>(null)
  const fileContent = ref<string>('')
  const wrapEnabled = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)

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
    loading.value = true
    error.value = null

    try {
      const entryPromise = api.getEntry(slug, shareToken)
      const contentPromise = api.getFileContent(slug, fileId ?? 0).catch(() => null)

      const [entry, content] = await Promise.all([entryPromise, contentPromise])
      currentEntry.value = entry
      activeFile.value = null
      fileContent.value = ''

      if (entry.files.length > 0) {
        const targetFile = fileId != null
          ? entry.files.find(f => f.id === fileId) ?? entry.files[0]
          : entry.files[0]
        activeFile.value = targetFile
        if (content != null) {
          fileContent.value = content
        } else if (!targetFile.isBinary) {
          const actualContent = await api.getFileContent(slug, targetFile.id)
          fileContent.value = actualContent
        }
      }
    } catch (err: any) {
      if (shareToken) {
        error.value = 'This share link is no longer valid.'
      } else {
        error.value = err instanceof Error ? err.message : 'Failed to load entry'
      }
      currentEntry.value = null
    } finally {
      loading.value = false
    }
  }

  async function selectFile(file: File): Promise<void> {
    if (activeFile.value?.id === file.id) return

    activeFile.value = file
    fileContent.value = ''

    if (!file.isBinary && currentEntry.value) {
      try {
        const content = await api.getFileContent(currentEntry.value.slug, file.id)
        fileContent.value = content
      } catch (err) {
        error.value = err instanceof Error ? err.message : 'Failed to load file content'
      }
    }
  }

  function toggleWrap(): void {
    wrapEnabled.value = !wrapEnabled.value
  }

  function clearEntry(): void {
    currentEntry.value = null
    activeFile.value = null
    fileContent.value = ''
    wrapEnabled.value = false
    error.value = null
  }

  function syncVisibility(slug: string, isPublic: boolean): void {
    if (currentEntry.value?.slug === slug) {
      currentEntry.value = { ...currentEntry.value, isPublic }
    }
  }

  function syncStar(data: { starCount: number; isStarred: boolean }): void {
    if (currentEntry.value) {
      currentEntry.value = { ...currentEntry.value, starCount: data.starCount, isStarred: data.isStarred }
    }
  }

  function clearIfSlug(slug: string): void {
    if (currentEntry.value?.slug === slug) {
      clearEntry()
    }
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
