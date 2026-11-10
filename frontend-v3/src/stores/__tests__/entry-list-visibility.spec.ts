/**
 * TPV0102 — entryList store 的 `setVisibility` 契约（P3 红灯基线）。
 *
 * 对应 P1-requirements.md：
 *   BDD-19  Team A → Public（成功时 is_public=true 且团队三字段同写）
 *   BDD-21  切换失败时状态保持原值（三字段完全回滚）
 *   BDD-24  请求进行中不可重复触发（inFlight 守卫，不发出第二个请求）
 *   BDD-27/28/29  Private→Team A / Team A→Team B / Team A→Private 的 payload 透传
 *
 * 契约来源 P2-design §3.5「store 改动」：
 *   setVisibility(entry, target) -> Promise<{ ok: boolean, revokedShares: number }>
 *   * 删除原 `entry.teamId` 守卫（陷阱 11：**替代**而非叠加）
 *   * 乐观更新 + 失败时 `restore(snapshot)` 三字段整体回写
 *   * `inFlight.has(slug)` 时直接返回 `{ ok:false, revokedShares:0 }`（BDD-24 判据）
 *   * **store 内不得发 toast**（E-2 归属裁定）→ 本 spec **不断言 toast**，只断言返回值
 *
 * mock hoisting 反模式（T079 教训）：`vi.mock()` 回调内**只用字符串字面量**，
 * 不引用外部变量；动态行为在 `beforeEach` 里用 `vi.mocked(...)` 设置。
 *
 * 当前红灯原因（B 类）：`store.setVisibility` 尚未实现（现为 `toggleVisibility`）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useEntryListStore } from '@/stores/entryList'
import type { Entry } from '@/types'

vi.mock('@/api/client', () => ({
  api: {
    listEntries: vi.fn(),
    updateEntry: vi.fn(),
    toggleEntryVisibility: vi.fn(),
    deleteEntry: vi.fn(),
  },
}))

// store 内不得发 toast（P2 E-2）；此 mock 保证若有调用也不会崩，但 spec 不断言它
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

vi.mock('@/stores/entryDetail', () => ({
  useEntryDetailStore: () => ({
    syncVisibility: vi.fn(),
    clearIfSlug: vi.fn(),
  }),
}))

import { api } from '@/api/client'

const TEAM_A_ENTRY = (): Entry => ({
  id: 1,
  slug: 'team-entry',
  summary: 'Team entry',
  tags: [],
  status: 'active',
  files: [],
  fileCount: 2,
  isPublic: false,
  ownerId: 7,
  username: 'alice',
  expiresAt: null,
  archivedAt: null,
  createdAt: '2026-11-10T09:43:00Z',
  teamId: 11,
  team: { slug: 'team-a', name: 'Team A' },
})

const PRIVATE_ENTRY = (): Entry => ({
  ...TEAM_A_ENTRY(),
  id: 2,
  slug: 'private-entry',
  isPublic: false,
  teamId: null,
  team: null,
})

/** 服务端 PATCH 响应的客户端形状（api.updateEntry 已做 transform） */
function updatedEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    ...PRIVATE_ENTRY(),
    slug: 'team-entry',
    ...overrides,
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('BDD-19: setVisibility 成功路径写三字段', () => {
  it('BDD-19: 升 Public 后 entry 三字段为 true/null/null', async () => {
    const store = useEntryListStore()
    const entry = TEAM_A_ENTRY()
    store.entries = [entry]

    vi.mocked(api.updateEntry).mockResolvedValue(
      updatedEntry({ isPublic: true, teamId: null, team: null, revokedShares: 0 }),
    )

    const result = await store.setVisibility(entry, { kind: 'public' })

    expect(result.ok).toBe(true)
    expect(entry.isPublic).toBe(true)
    expect(entry.teamId).toBeNull()
    expect(entry.team).toBeNull()
  })

  it('BDD-19: revokedShares > 0 时原样回传计数（B-4）', async () => {
    const store = useEntryListStore()
    const entry = TEAM_A_ENTRY()
    store.entries = [entry]

    vi.mocked(api.updateEntry).mockResolvedValue(
      updatedEntry({ isPublic: true, teamId: null, team: null, revokedShares: 2 }),
    )

    const result = await store.setVisibility(entry, { kind: 'public' })

    expect(result).toEqual({ ok: true, revokedShares: 2 })
  })

  it('BDD-19: revoked_shares 为 undefined 时返回 0', async () => {
    const store = useEntryListStore()
    const entry = TEAM_A_ENTRY()
    store.entries = [entry]

    vi.mocked(api.updateEntry).mockResolvedValue(
      updatedEntry({ isPublic: true, teamId: null, team: null, revokedShares: undefined }),
    )

    const result = await store.setVisibility(entry, { kind: 'public' })

    expect(result.revokedShares).toBe(0)
  })
})

describe('BDD-21: 失败路径三字段完全回滚', () => {
  it('BDD-21: 服务端拒绝后 isPublic/teamId/team 与操作前逐一相等', async () => {
    const store = useEntryListStore()
    const entry = TEAM_A_ENTRY()
    store.entries = [entry]

    const before = {
      isPublic: entry.isPublic,
      teamId: entry.teamId,
      team: entry.team,
    }
    vi.mocked(api.updateEntry).mockRejectedValue(new Error('500 Server Error'))

    const result = await store.setVisibility(entry, { kind: 'private' })

    expect(result).toEqual({ ok: false, revokedShares: 0 })
    expect(entry.isPublic).toBe(before.isPublic)
    expect(entry.teamId).toBe(before.teamId)
    expect(entry.team).toEqual(before.team)
  })

  it('BDD-21: 失败时不得残留乐观更新的 public 状态', async () => {
    const store = useEntryListStore()
    const entry = PRIVATE_ENTRY()
    store.entries = [entry]
    vi.mocked(api.updateEntry).mockRejectedValue(new Error('boom'))

    await store.setVisibility(entry, { kind: 'public' })

    expect(entry.isPublic).toBe(false)
  })
})

describe('BDD-24: inFlight 守卫阻止第二个请求', () => {
  it('BDD-24: 首次调用未完成时第二次调用返回 ok:false 且不发请求', async () => {
    const store = useEntryListStore()
    const entry = PRIVATE_ENTRY()
    store.entries = [entry]

    let resolveFirst: ((value: Entry) => void) | undefined
    vi.mocked(api.updateEntry).mockImplementation(
      () =>
        new Promise<Entry>(resolve => {
          resolveFirst = resolve
        }),
    )

    const first = store.setVisibility(entry, { kind: 'public' })
    const second = await store.setVisibility(entry, { kind: 'team', teamSlug: 'team-a', teamName: 'Team A' })

    expect(second.ok).toBe(false)
    expect(vi.mocked(api.updateEntry)).toHaveBeenCalledTimes(1)

    resolveFirst?.(updatedEntry({ isPublic: true, teamId: null, team: null }))
    await first
  })
})

describe('BDD-27/28/29: 三次转换的 payload 透传给 API', () => {
  it('BDD-27: Private → Team A 只传 team_id', async () => {
    const store = useEntryListStore()
    const entry = PRIVATE_ENTRY()
    store.entries = [entry]
    vi.mocked(api.updateEntry).mockResolvedValue(
      updatedEntry({ isPublic: false, teamId: 11, team: { slug: 'team-a', name: 'Team A' } }),
    )

    await store.setVisibility(entry, { kind: 'team', teamSlug: 'team-a', teamName: 'Team A' })

    expect(api.updateEntry).toHaveBeenCalledWith('private-entry', { team_id: 'team-a' })
  })

  it('BDD-28: Team A → Team B 的 payload 指向新团队', async () => {
    const store = useEntryListStore()
    const entry = TEAM_A_ENTRY()
    store.entries = [entry]
    vi.mocked(api.updateEntry).mockResolvedValue(
      updatedEntry({ isPublic: false, teamId: 12, team: { slug: 'team-b', name: 'Team B' } }),
    )

    await store.setVisibility(entry, { kind: 'team', teamSlug: 'team-b', teamName: 'Team B' })

    expect(api.updateEntry).toHaveBeenCalledWith('team-entry', { team_id: 'team-b' })
    expect(entry.team?.slug).toBe('team-b')
  })

  it('BDD-29: Team A → Private 的 payload 清团队且置非公开', async () => {
    const store = useEntryListStore()
    const entry = TEAM_A_ENTRY()
    store.entries = [entry]
    vi.mocked(api.updateEntry).mockResolvedValue(
      updatedEntry({ isPublic: false, teamId: null, team: null }),
    )

    await store.setVisibility(entry, { kind: 'private' })

    expect(api.updateEntry).toHaveBeenCalledWith('team-entry', {
      is_public: false,
      team_id: null,
    })
    expect(entry.isPublic).toBe(false)
    expect(entry.team).toBeNull()
  })
})

describe('BDD-19: store 不发 toast（E-2 归属裁定）', () => {
  it('BDD-19: setVisibility 全程不依赖 useToast（仅回传计数）', async () => {
    const store = useEntryListStore()
    const entry = TEAM_A_ENTRY()
    store.entries = [entry]
    vi.mocked(api.updateEntry).mockResolvedValue(
      updatedEntry({ isPublic: true, teamId: null, team: null, revokedShares: 3 }),
    )

    const result = await store.setVisibility(entry, { kind: 'public' })

    // toast 的唯一发出点是视图层；store 只回传计数
    expect(result.revokedShares).toBe(3)
    expect(store).not.toHaveProperty('toast')
  })
})
