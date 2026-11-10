import type { VisibilityTarget } from './visibility-options'

export interface VisibilityPatchPayload {
  is_public?: boolean
  team_id?: string | null
}

export function toPatchPayload(target: VisibilityTarget): VisibilityPatchPayload {
  if (target.kind === 'public') return { is_public: true, team_id: null }
  if (target.kind === 'private') return { is_public: false, team_id: null }
  return { team_id: target.teamSlug }
}

export function needsConfirm(target: VisibilityTarget): boolean {
  return target.kind === 'public'
}
