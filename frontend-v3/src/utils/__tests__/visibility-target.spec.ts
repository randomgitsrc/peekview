/**
 * TPV0102 — 可见性切换 payload 与二次确认判定（纯函数，P3 红灯基线）。
 *
 * 对应 P1-requirements.md 的五个可见性转换（P0 决策 3 全量）：
 *   BDD-19  Team A → Public     需二次确认；确认后 is_public=true 且 team 清空
 *   BDD-20  Public → Private    不弹确认；is_public=false
 *   BDD-27  Private → Team A    无确认；归 Team A 且保持非公开
 *   BDD-28  Team A → Team B     无确认；归属改为 Team B 且保持非公开
 *   BDD-29  Team A → Private    无确认；团队清空且保持非公开
 *
 * 契约来源 P2-design §3.5 `visibility-target.ts`：
 *   toPatchPayload({kind:'public'})  -> { is_public: true,  team_id: null }   // 两字段同传
 *   toPatchPayload({kind:'private'}) -> { is_public: false, team_id: null }   // 也传 team_id:null
 *   toPatchPayload({kind:'team', ...}) -> { team_id: teamSlug }               // 后端强制 is_public=false
 *   needsConfirm(target) -> target.kind === 'public'
 *
 * 「两字段同传」的机制依据（P2 §3.5）：后端 `is_public` 分支在 `entry.team_id !== None`
 * 时无法变 public，清团队要求 `team_id_set` 为真且 `team_id is None`。只传 is_public
 * 会停在 private → BDD-19 的「团队清空」判据必然失败。
 *
 * 当前红灯原因（B 类）：`@/utils/visibility-target` 模块尚未创建。
 */

import { describe, it, expect } from 'vitest'
import { toPatchPayload, needsConfirm } from '@/utils/visibility-target'

const PUBLIC = { kind: 'public' } as const
const PRIVATE = { kind: 'private' } as const
const TEAM_A = { kind: 'team', teamSlug: 'team-a', teamName: 'Team A' } as const
const TEAM_B = { kind: 'team', teamSlug: 'team-b', teamName: 'Team B' } as const

describe('BDD-19: Team A → Public（需二次确认，两字段同传）', () => {
  it('BDD-19: public 的 payload 同时带 is_public 与 team_id', () => {
    expect(toPatchPayload(PUBLIC)).toEqual({ is_public: true, team_id: null })
  })

  it('BDD-19: public 的 payload 必须显式含 team_id 键（null 不能省略）', () => {
    const payload = toPatchPayload(PUBLIC)
    expect(Object.prototype.hasOwnProperty.call(payload, 'team_id')).toBe(true)
    expect(payload.team_id).toBeNull()
  })

  it('BDD-19: public 需要二次确认', () => {
    expect(needsConfirm(PUBLIC)).toBe(true)
  })
})

describe('BDD-20: Public → Private（无确认）', () => {
  it('BDD-20: private 的 payload 为 is_public=false + team_id=null', () => {
    expect(toPatchPayload(PRIVATE)).toEqual({ is_public: false, team_id: null })
  })

  it('BDD-20: private 不需要二次确认', () => {
    expect(needsConfirm(PRIVATE)).toBe(false)
  })
})

describe('BDD-27: Private → Team A（无确认）', () => {
  it('BDD-27: team 的 payload 只传 team_id(slug)', () => {
    expect(toPatchPayload(TEAM_A)).toEqual({ team_id: 'team-a' })
  })

  it('BDD-27: team 的 payload 不重复声明 is_public（后端强制 false）', () => {
    const payload = toPatchPayload(TEAM_A)
    expect(Object.prototype.hasOwnProperty.call(payload, 'is_public')).toBe(false)
  })

  it('BDD-27: team 不需要二次确认', () => {
    expect(needsConfirm(TEAM_A)).toBe(false)
  })
})

describe('BDD-28: Team A → Team B（无确认）', () => {
  it('BDD-28: payload 的 team_id 指向新团队', () => {
    expect(toPatchPayload(TEAM_B)).toEqual({ team_id: 'team-b' })
  })

  it('BDD-28: payload 不含旧团队 slug（防「两字段都传」式残留）', () => {
    const payload = toPatchPayload(TEAM_B)
    expect(JSON.stringify(payload)).not.toContain('team-a')
  })

  it('BDD-28: 换团队不需要二次确认', () => {
    expect(needsConfirm(TEAM_B)).toBe(false)
  })
})

describe('BDD-29: Team A → Private（清团队且保持非公开）', () => {
  it('BDD-29: private 的 payload 显式清空 team_id', () => {
    const payload = toPatchPayload(PRIVATE)
    expect(Object.prototype.hasOwnProperty.call(payload, 'team_id')).toBe(true)
    expect(payload.team_id).toBeNull()
  })

  it('BDD-29: private 的 payload 同时置 is_public=false（两字段都断言）', () => {
    expect(toPatchPayload(PRIVATE).is_public).toBe(false)
  })

  it('BDD-29: Team A → Private 不需要二次确认', () => {
    expect(needsConfirm(PRIVATE)).toBe(false)
  })
})

describe('五转换全量覆盖（P0 决策 3）', () => {
  it('五个转换的 needsConfirm 真值表只有 Public 为 true', () => {
    expect(needsConfirm(PUBLIC)).toBe(true)
    expect(needsConfirm(PRIVATE)).toBe(false)
    expect(needsConfirm(TEAM_A)).toBe(false)
    expect(needsConfirm(TEAM_B)).toBe(false)
  })
})
