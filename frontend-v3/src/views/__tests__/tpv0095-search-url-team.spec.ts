import { describe, it, expect } from 'vitest'
import { mergeQuery, parseRestoreQuery } from '@/views/searchUrl.logic'

// TPV0095 BDD-38/41：searchUrl.logic 扩展 team/view 维度（四维互斥 URL 表达）
// P3 红灯：现状 parseRestoreQuery 返回 { q, owner, status, page, tags }，无 team/view →
// 断言失败（被测未实现）。P4 按 P2 §5.4 实现：mergeQuery/parseRestoreQuery 增加 team/view。

function restorableKeys(queryString: string): Record<string, unknown> {
  return { ...parseRestoreQuery(queryString) } as Record<string, unknown>
}

describe('TPV0095 searchUrl.logic — team/view 维度', () => {
  it('bdd38_parse_restores_view_teams_from_url', () => {
    const restored = restorableKeys('view=teams')
    expect(restored).toHaveProperty('view')
    expect(restored.view).toBe('teams')
  })

  it('bdd38_parse_restores_team_slug_from_url', () => {
    const restored = restorableKeys('team=proj-a')
    expect(restored).toHaveProperty('team')
    expect(restored.team).toBe('proj-a')
  })

  it('bdd38_merge_keeps_team_when_setting_other_dimension', () => {
    const qs = mergeQuery('team=proj-a&page=2', { status: 'archived' })
    expect(qs).toContain('team=proj-a')
    expect(qs).toContain('status=archived')
  })

  it('bdd38_merge_drops_team_when_undefined_clear', () => {
    const qs = mergeQuery('team=proj-a', { team: undefined })
    expect(qs).not.toContain('team')
  })

  it('bdd38_merge_sets_view_teams', () => {
    const qs = mergeQuery('', { view: 'teams' })
    expect(qs).toContain('view=teams')
  })

  it('bdd41_restore_team_and_view_coexist_for_teams_tab_chip', () => {
    const restored = restorableKeys('view=teams&team=proj-a')
    expect(restored.view).toBe('teams')
    expect(restored.team).toBe('proj-a')
  })
})
