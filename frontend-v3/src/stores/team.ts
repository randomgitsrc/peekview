import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/api/client'
import type { Team, TeamDetail } from '@/types'

export const useTeamStore = defineStore('team', () => {
  const owned = ref<Team[]>([])
  const joined = ref<Team[]>([])
  const loading = ref(false)
  const teamsLoaded = ref(false)
  const error = ref<string | null>(null)

  const allTeams = computed<Team[]>(() => [...owned.value, ...joined.value])

  function reset(): void {
    owned.value = []
    joined.value = []
    loading.value = false
    teamsLoaded.value = false
    error.value = null
  }

  async function loadMyTeams(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const response = await api.listTeams()
      owned.value = response.owned
      joined.value = response.joined
      teamsLoaded.value = true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load teams'
    } finally {
      loading.value = false
    }
  }

  function isMemberOf(slug: string): boolean {
    return allTeams.value.some(t => t.slug === slug)
  }

  function teamBySlug(slug: string): Team | undefined {
    return allTeams.value.find(t => t.slug === slug)
  }

  function upsertOwned(team: Team): void {
    const idx = owned.value.findIndex(t => t.slug === team.slug)
    if (idx >= 0) owned.value[idx] = team
    else owned.value.unshift(team)
  }

  async function createTeam(name: string): Promise<TeamDetail> {
    const detail = await api.createTeam(name)
    upsertOwned(detail)
    teamsLoaded.value = true
    return detail
  }

  async function renameTeam(slug: string, name: string): Promise<TeamDetail> {
    const detail = await api.renameTeam(slug, name)
    upsertOwned(detail)
    return detail
  }

  async function deleteTeam(slug: string): Promise<void> {
    await api.deleteTeam(slug)
    owned.value = owned.value.filter(t => t.slug !== slug)
  }

  async function addMember(slug: string, username: string): Promise<TeamDetail> {
    const detail = await api.addMember(slug, username)
    upsertOwned(detail)
    return detail
  }

  async function removeMember(slug: string, userId: number): Promise<TeamDetail> {
    const detail = await api.removeMember(slug, userId)
    upsertOwned(detail)
    return detail
  }

  async function leaveTeam(slug: string): Promise<void> {
    await api.leaveTeam(slug)
    joined.value = joined.value.filter(t => t.slug !== slug)
  }

  async function fetchDetail(slug: string): Promise<TeamDetail> {
    const detail = await api.getTeam(slug)
    syncDetail(detail)
    return detail
  }

  function syncDetail(detail: TeamDetail): void {
    const target = owned.value.some(t => t.slug === detail.slug) ? owned.value : joined.value
    const idx = target.findIndex(t => t.slug === detail.slug)
    const summary: Team = { slug: detail.slug, name: detail.name, memberCount: detail.members.length }
    if (idx >= 0) target[idx] = summary
    else target.unshift(summary)
  }

  return {
    owned,
    joined,
    loading,
    teamsLoaded,
    error,
    reset,
    loadMyTeams,
    isMemberOf,
    teamBySlug,
    createTeam,
    renameTeam,
    deleteTeam,
    addMember,
    removeMember,
    leaveTeam,
    fetchDetail,
    syncDetail,
  }
})
