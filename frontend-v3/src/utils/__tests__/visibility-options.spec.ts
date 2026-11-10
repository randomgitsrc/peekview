/**
 * TPV0102 — 可见性菜单选项构造（纯函数，P3 红灯基线）。
 *
 * 对应 P1-requirements.md：
 *   BDD-16  菜单不包含当前可见性状态项
 *   BDD-17  用户无任何团队时菜单不渲染 Team 入口
 *   BDD-18  Team 一律以子菜单呈现且子菜单排除当前团队
 *   （附）R11 团队列表加载失败时 Team 位不得静默消失
 *
 * 契约来源 P2-design §3.5 / N-1（签名冻结，P4 不得改）：
 *   buildVisibilityOptions({ isPublic, currentTeamSlug, teams, teamsFailed? })
 *     -> { items: VisibilityTarget[], teamSubmenu: TeamOption[], teamsFailed: boolean }
 *
 * 关键约束（P2 N-1）：`Team` / `TeamRef` 均**没有数字 id**，子菜单只能按 `slug` 比对；
 * 找不到当前团队时按「无当前团队」处理（子菜单不排除任何项）。
 *
 * 当前红灯原因（B 类）：`@/utils/visibility-options` 模块尚未创建。
 */

import { describe, it, expect } from 'vitest'
import { buildVisibilityOptions } from '@/utils/visibility-options'
import type { Team } from '@/types'

const TEAM_A: Team = { slug: 'team-a', name: 'Team A', memberCount: 2 }
const TEAM_B: Team = { slug: 'team-b', name: 'Team B', memberCount: 1 }

/** items 的 kind 集合（只关心 kind，不关心顺序） */
function kinds(items: Array<{ kind: string }>): string[] {
  return items.map(i => i.kind)
}

describe('BDD-16: 当前可见性状态项不出现在菜单中', () => {
  it('BDD-16: public 态 items 不含 public，含 private 与 Team 入口', () => {
    const result = buildVisibilityOptions({
      isPublic: true,
      currentTeamSlug: null,
      teams: [TEAM_A],
    })
    expect(kinds(result.items)).not.toContain('public')
    expect(kinds(result.items)).toContain('private')
    expect(result.teamSubmenu.length).toBeGreaterThan(0)
  })

  it('BDD-16: private 态 items 不含 private，含 public', () => {
    const result = buildVisibilityOptions({
      isPublic: false,
      currentTeamSlug: null,
      teams: [TEAM_A],
    })
    expect(kinds(result.items)).not.toContain('private')
    expect(kinds(result.items)).toContain('public')
  })

  it('BDD-16: team 态 items 同时含 public 与 private（P2 §3.5 规则 5）', () => {
    const result = buildVisibilityOptions({
      isPublic: false,
      currentTeamSlug: TEAM_A.slug,
      teams: [TEAM_A, TEAM_B],
    })
    expect(kinds(result.items)).toContain('public')
    expect(kinds(result.items)).toContain('private')
  })

  it('BDD-16: 当前态排除是「不出现」而非「置灰」', () => {
    const publicState = buildVisibilityOptions({
      isPublic: true,
      currentTeamSlug: null,
      teams: [],
    })
    const serialized = JSON.stringify(publicState.items)
    expect(serialized).not.toContain('"public"')
  })
})

describe('BDD-17: 无团队时不渲染 Team 入口', () => {
  it('BDD-17: teams 为空数组 → teamSubmenu 为空且 items 无 team', () => {
    const result = buildVisibilityOptions({
      isPublic: true,
      currentTeamSlug: null,
      teams: [],
    })
    expect(result.teamSubmenu).toEqual([])
    expect(kinds(result.items)).not.toContain('team')
    expect(result.teamsFailed).toBe(false)
  })

  it('BDD-17: teamsFailed 缺省为 false', () => {
    const result = buildVisibilityOptions({
      isPublic: false,
      currentTeamSlug: null,
      teams: [TEAM_A],
    })
    expect(result.teamsFailed).toBe(false)
  })

  it('R11: teamsFailed 为真时透传该标志（供组件渲染禁用项而非静默隐藏）', () => {
    const failed = buildVisibilityOptions({
      isPublic: true,
      currentTeamSlug: null,
      teams: [],
      teamsFailed: true,
    })
    expect(failed.teamsFailed).toBe(true)
  })

  it('R11: teamsFailed 为真时信息不丢失（透传标志 或 保留 Team 位，二者其一）', () => {
    // P2 §3.5 规则 6：teamsFailed 时 teamSubmenu 为空，但必须**透传 teamsFailed=true**
    // 供组件渲染禁用项 —— 不得让「加载失败」静默退化为「无团队」（R11）。
    const result = buildVisibilityOptions({
      isPublic: true,
      currentTeamSlug: null,
      teams: [TEAM_A],
      teamsFailed: true,
    })
    const keepsInfo = result.teamsFailed || kinds(result.items).includes('team')
    expect(keepsInfo).toBe(true)
  })
})

describe('BDD-18: Team 恒为子菜单且排除当前团队', () => {
  it('BDD-18: 子菜单排除当前团队（按 slug）', () => {
    const result = buildVisibilityOptions({
      isPublic: false,
      currentTeamSlug: TEAM_A.slug,
      teams: [TEAM_A, TEAM_B],
    })
    const slugs = result.teamSubmenu.map(t => t.slug)
    expect(slugs).not.toContain(TEAM_A.slug)
    expect(slugs).toContain(TEAM_B.slug)
  })

  it('BDD-18: 找不到当前团队时不排除任何项（P2 §3.5）', () => {
    const result = buildVisibilityOptions({
      isPublic: false,
      currentTeamSlug: 'ghost-team',
      teams: [TEAM_A, TEAM_B],
    })
    const slugs = result.teamSubmenu.map(t => t.slug)
    expect(slugs).toContain(TEAM_A.slug)
    expect(slugs).toContain(TEAM_B.slug)
  })

  it('BDD-18: Team 入口本身不直接执行切换（items 里的 team 项无 teamSlug）', () => {
    const result = buildVisibilityOptions({
      isPublic: true,
      currentTeamSlug: null,
      teams: [TEAM_A],
    })
    const teamItems = result.items.filter(i => i.kind === 'team')
    expect(teamItems.length).toBe(1)
    // Team 入口是子菜单触发器：不得携带可直接提交的 teamSlug（切换须经子菜单选择）
    expect(JSON.stringify(teamItems[0])).not.toContain('teamSlug')
  })

  it('BDD-18: 子菜单项保留完整 Team 形状（slug + name + memberCount，无 id）', () => {
    const result = buildVisibilityOptions({
      isPublic: true,
      currentTeamSlug: null,
      teams: [TEAM_A],
    })
    expect(result.teamSubmenu[0]).toEqual(TEAM_A)
    expect(result.teamSubmenu[0]).not.toHaveProperty('id')
  })
})
