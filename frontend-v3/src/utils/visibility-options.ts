import type { Entry, Team } from '@/types'

export type VisibilityItem = { kind: 'public' | 'private' | 'team' }

export type VisibilityTarget =
  | { kind: 'public' }
  | { kind: 'private' }
  | { kind: 'team'; teamSlug: string; teamName: string }

export type TeamOption = Team

export interface BuildVisibilityOptionsInput {
  isPublic: boolean
  currentTeamSlug: string | null
  teams: Team[]
  teamsFailed?: boolean
}

export interface VisibilityOptions {
  items: VisibilityItem[]
  teamSubmenu: TeamOption[]
  teamsFailed: boolean
}

export function buildVisibilityOptions(input: BuildVisibilityOptionsInput): VisibilityOptions {
  const { isPublic, currentTeamSlug, teams, teamsFailed = false } = input
  const isTeamVisible = currentTeamSlug !== null
  const items: VisibilityItem[] = []

  if (isTeamVisible || !isPublic) items.push({ kind: 'public' })
  if (isTeamVisible || isPublic) items.push({ kind: 'private' })
  if (teams.length > 0 || teamsFailed) items.push({ kind: 'team' })

  const teamSubmenu = teamsFailed ? [] : teams.filter(t => t.slug !== currentTeamSlug)

  return { items, teamSubmenu, teamsFailed }
}

export function visibilityStatusLabel(entry: Entry): string {
  if (entry.team) return `仅团队可见 · ${entry.team.name}`
  return entry.isPublic ? 'Public' : 'Private'
}
