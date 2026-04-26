import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/api/client'
import type { Entry, File, ListEntriesParams } from '@/types'

export const useEntryStore = defineStore('entry', () => {
  // State
  const entries = ref<Entry[]>([])
  const currentEntry = ref<Entry | null>(null)
  const activeFile = ref<File | null>(null)
  const fileContent = ref<string>('')
  const wrapEnabled = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Getters (computed)
  const isMultiFile = computed(() => {
    return (currentEntry.value?.files.length ?? 0) > 1
  })

  const canWrap = computed(() => {
    if (!activeFile.value) return false
    if (activeFile.value.isBinary) return false
    if (activeFile.value.language === 'markdown') return false
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
  async function loadEntries(params?: ListEntriesParams): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const response = await api.listEntries(params)
      entries.value = response.items
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load entries'
      entries.value = []
    } finally {
      loading.value = false
    }
  }

  async function loadEntry(slug: string): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const entry = await api.getEntry(slug)
      currentEntry.value = entry

      // Auto-select first file if none selected and entry has files
      if (!activeFile.value && entry.files.length > 0) {
        await selectFile(entry.files[0])
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load entry'
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

  return {
    // State
    entries,
    currentEntry,
    activeFile,
    fileContent,
    wrapEnabled,
    loading,
    error,
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
  }
})
