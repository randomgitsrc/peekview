import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/api/client'
import type { Entry, File, ListEntriesParams } from '@/types'
import { useToast } from '@/composables/useToast'

let loadSeq = 0

export const useEntryStore = defineStore('entry', () => {
  // State
  const entries = ref<Entry[]>([])
  const currentEntry = ref<Entry | null>(null)
  const activeFile = ref<File | null>(null)
  const fileContent = ref<string>('')
  const wrapEnabled = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Owner found state
  const ownerFound = ref<boolean | null>(null)

  // Pagination state
  const page = ref(1)
  const perPage = ref(20)
  const total = ref(0)

  // Getters (computed)
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

  const canDownload = computed(() => {
    return activeFile.value !== null
  })

  const canPack = computed(() => {
    return (currentEntry.value?.files.length ?? 0) > 1
  })

  // Actions
  async function loadEntries(params?: ListEntriesParams, options?: { clearOnError?: boolean }): Promise<void> {
    const seq = ++loadSeq
    loading.value = true
    error.value = null

    try {
      const response = await api.listEntries(params)
      if (seq !== loadSeq) return
      entries.value = response.items
      page.value = response.page
      perPage.value = response.perPage
      total.value = response.total
      ownerFound.value = response.ownerFound ?? null
    } catch (err) {
      if (seq !== loadSeq) return
      error.value = err instanceof Error ? err.message : 'Failed to load entries'
      if (options?.clearOnError !== false) {
        entries.value = []
      }
    } finally {
      if (seq === loadSeq) {
        loading.value = false
      }
    }
  }

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
    // Skip if already active
    if (activeFile.value?.id === file.id) return

    activeFile.value = file
    fileContent.value = ''

    // Fetch content if not binary
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

  async function toggleVisibility(entry: Entry): Promise<boolean> {
    const originalPublic = entry.isPublic
    const index = entries.value.findIndex(e => e.id === entry.id)
    const newPublic = !originalPublic

    entry.isPublic = newPublic
    if (index >= 0) {
      entries.value[index] = { ...entries.value[index], isPublic: newPublic }
    }
    if (currentEntry.value?.id === entry.id) {
      currentEntry.value = { ...currentEntry.value, isPublic: newPublic }
    }

    try {
      const updated = await api.toggleEntryVisibility(entry.slug, newPublic)
      if (updated.revokedShares && updated.revokedShares > 0) {
        const toast = useToast()
        toast.show(`${updated.revokedShares} share link(s) revoked — entry is now public`, 'warning')
      }
      return true
    } catch {
      entry.isPublic = originalPublic
      if (index >= 0) {
        entries.value[index] = { ...entries.value[index], isPublic: originalPublic }
      }
      if (currentEntry.value?.id === entry.id) {
        currentEntry.value = { ...currentEntry.value, isPublic: originalPublic }
      }
      return false
    }
  }

  async function deleteEntry(slug: string): Promise<boolean> {
    try {
      await api.deleteEntry(slug)
      entries.value = entries.value.filter(e => e.slug !== slug)
      if (currentEntry.value?.slug === slug) {
        clearEntry()
      }
      return true
    } catch {
      return false
    }
  }

  return {
    // State
    entries,
    currentEntry,
    activeFile,
    fileContent,
    wrapEnabled,
    loading,
    error,
    // Owner found state
    ownerFound,
    // Pagination state
    page,
    perPage,
    total,
    // Getters
    isMultiFile,
    canWrap,
    canCopy,
    canDownload,
    canPack,
    // Actions
    loadEntries,
    loadEntry,
    selectFile,
    toggleWrap,
    clearEntry,
    toggleVisibility,
    deleteEntry,
  }
})
