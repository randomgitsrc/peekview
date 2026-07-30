import { ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/api/client'
import type { Entry, ListEntriesParams } from '@/types'
import { useToast } from '@/composables/useToast'
import { useEntryDetailStore } from './entryDetail'

let loadSeq = 0

export const useEntryListStore = defineStore('entryList', () => {
  const entries = ref<Entry[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const ownerFound = ref<boolean | null>(null)
  const page = ref(1)
  const perPage = ref(20)
  const total = ref(0)

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

  async function toggleVisibility(entry: Entry): Promise<boolean> {
    const originalPublic = entry.isPublic
    const index = entries.value.findIndex(e => e.id === entry.id)
    const newPublic = !originalPublic

    entry.isPublic = newPublic
    if (index >= 0) {
      entries.value[index] = { ...entries.value[index], isPublic: newPublic }
    }

    const detailStore = useEntryDetailStore()
    detailStore.syncVisibility(entry.slug, newPublic)

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
      detailStore.syncVisibility(entry.slug, originalPublic)
      return false
    }
  }

  async function deleteEntry(slug: string): Promise<boolean> {
    try {
      await api.deleteEntry(slug)
      entries.value = entries.value.filter(e => e.slug !== slug)
      const detailStore = useEntryDetailStore()
      detailStore.clearIfSlug(slug)
      return true
    } catch {
      return false
    }
  }

  return {
    entries,
    loading,
    error,
    ownerFound,
    page,
    perPage,
    total,
    loadEntries,
    toggleVisibility,
    deleteEntry,
  }
})
