import { ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/api/client'
import type { Entry, ListEntriesParams, TeamRef } from '@/types'
import { toPatchPayload } from '@/utils/visibility-target'
import type { VisibilityTarget } from '@/utils/visibility-options'
import { useEntryDetailStore } from './entryDetail'

let loadSeq = 0

export interface SetVisibilityResult {
  ok: boolean
  revokedShares: number
}

interface VisibilitySnapshot {
  isPublic: boolean
  teamId: number | null
  team: TeamRef | null
}

export const useEntryListStore = defineStore('entryList', () => {
  const entries = ref<Entry[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const ownerFound = ref<boolean | null>(null)
  const page = ref(1)
  const perPage = ref(20)
  const total = ref(0)
  const inFlight = ref<Set<string>>(new Set())

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

  function takeSnapshot(entry: Entry): VisibilitySnapshot {
    return { isPublic: entry.isPublic, teamId: entry.teamId ?? null, team: entry.team ?? null }
  }

  function applyPatch(entry: Entry, target: VisibilityTarget, updated?: Entry): void {
    if (updated) {
      entry.isPublic = updated.isPublic
      entry.teamId = updated.teamId ?? null
      entry.team = updated.team ?? null
      return
    }
    if (target.kind === 'team') {
      entry.isPublic = false
      entry.team = { slug: target.teamSlug, name: target.teamName }
      return
    }
    entry.isPublic = target.kind === 'public'
    entry.teamId = null
    entry.team = null
  }

  function restore(entry: Entry, snapshot: VisibilitySnapshot): void {
    entry.isPublic = snapshot.isPublic
    entry.teamId = snapshot.teamId
    entry.team = snapshot.team
  }

  async function setVisibility(entry: Entry, target: VisibilityTarget): Promise<SetVisibilityResult> {
    if (inFlight.value.has(entry.slug)) return { ok: false, revokedShares: 0 }
    inFlight.value.add(entry.slug)
    const snapshot = takeSnapshot(entry)
    applyPatch(entry, target)

    try {
      const updated = await api.updateEntry(entry.slug, toPatchPayload(target))
      applyPatch(entry, target, updated)
      const detailStore = useEntryDetailStore()
      detailStore.syncVisibility(entry.slug, {
        isPublic: updated.isPublic,
        teamId: updated.teamId ?? null,
        team: updated.team ?? null,
      })
      return { ok: true, revokedShares: updated.revokedShares ?? 0 }
    } catch {
      restore(entry, snapshot)
      return { ok: false, revokedShares: 0 }
    } finally {
      inFlight.value.delete(entry.slug)
    }
  }

  async function toggleVisibility(entry: Entry): Promise<boolean> {
    const target: VisibilityTarget = entry.isPublic ? { kind: 'private' } : { kind: 'public' }
    const result = await setVisibility(entry, target)
    return result.ok
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
    inFlight,
    loadEntries,
    setVisibility,
    toggleVisibility,
    deleteEntry,
  }
})
