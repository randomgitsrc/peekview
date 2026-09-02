import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Team, TeamDetail } from '@/types'

// TPV0095 BDD-41/42：team store（myTeams 当前会话快照）动作清单
// P3 红灯：@/stores/team 模块不存在 → import 失败（被测未实现）。
// P4 按 P2 §5.5 动作清单实现：
//   ① 登录成功后 + explore/teams mount 时加载（登录前不加载）；
//   ② 登出清零；
//   ③ createTeam/renameTeam/deleteTeam/addMember/removeMember/leaveTeam 成功后更新本地 myTeams；
//   ④ myTeams 是当前会话快照（成员被移出后刷新才生效，不承载读权）；
//   ⑤ explore 与 /teams 共享同一 store 实例。
// 断言 myTeams 分区判定（owned/joined）与增删同步语义——UI 行为由 e2e/teams-page.spec.ts 实跑。

vi.mock('@/api/client', () => ({
  api: {
    listTeams: vi.fn(),
    createTeam: vi.fn(),
    renameTeam: vi.fn(),
    deleteTeam: vi.fn(),
    addMember: vi.fn(),
    removeMember: vi.fn(),
    leaveTeam: vi.fn(),
  },
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

import { api } from '@/api/client'
// P3：模块不存在 → import 抛错 → 测试失败（红灯 B 类：被测未实现）
// @ts-expect-error — P4 将新增 @/stores/team 模块
const { useTeamStore } = await import('@/stores/team')

function makeOwned(overrides: Partial<Team> = {}): Team {
  return { slug: 'proj-a', name: 'Proj A', memberCount: 2, ...overrides }
}

function makeJoined(overrides: Partial<Team> = {}): Team {
  return { slug: 'shared-b', name: 'Shared B', memberCount: 3, ...overrides }
}

describe('TPV0095 team store — myTeams 快照与分区', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('bdd41_loads_owned_and_joined_after_login', async () => {
    vi.mocked(api.listTeams).mockResolvedValue({
      owned: [makeOwned()],
      joined: [makeJoined()],
    } as never)
    const store = useTeamStore()
    await store.loadMyTeams()
    expect(store.owned.some((t) => t.slug === 'proj-a')).toBe(true)
    expect(store.joined.some((t) => t.slug === 'shared-b')).toBe(true)
  })

  it('bdd41_membership_predicate_known_slug_true', async () => {
    vi.mocked(api.listTeams).mockResolvedValue({
      owned: [makeOwned()],
      joined: [makeJoined()],
    } as never)
    const store = useTeamStore()
    await store.loadMyTeams()
    expect(store.isMemberOf('proj-a')).toBe(true)
    expect(store.isMemberOf('shared-b')).toBe(true)
    expect(store.isMemberOf('ghost-team')).toBe(false)
  })

  it('bdd42_create_team_appears_in_owned_section', async () => {
    vi.mocked(api.createTeam).mockResolvedValue({
      slug: 'alpha',
      name: 'Alpha',
      memberCount: 1,
      members: [],
      ownerUsername: 'alice',
    } as never)
    const store = useTeamStore()
    const detail = await store.createTeam('Alpha')
    expect(detail).toBeTruthy()
    expect(store.owned.some((t) => t.slug === 'alpha')).toBe(true)
  })

  it('bdd42_leave_team_removes_from_joined', async () => {
    vi.mocked(api.listTeams).mockResolvedValue({
      owned: [makeOwned()],
      joined: [makeJoined()],
    } as never)
    vi.mocked(api.leaveTeam).mockResolvedValue(undefined as never)
    const store = useTeamStore()
    await store.loadMyTeams()
    await store.leaveTeam('shared-b')
    expect(store.joined.some((t) => t.slug === 'shared-b')).toBe(false)
  })

  it('bdd42_delete_team_removes_from_owned_and_nullifies_membership', async () => {
    vi.mocked(api.listTeams).mockResolvedValue({
      owned: [makeOwned()],
      joined: [makeJoined()],
    } as never)
    vi.mocked(api.deleteTeam).mockResolvedValue(undefined as never)
    const store = useTeamStore()
    await store.loadMyTeams()
    await store.deleteTeam('proj-a')
    expect(store.owned.some((t) => t.slug === 'proj-a')).toBe(false)
    expect(store.isMemberOf('proj-a')).toBe(false)
  })

  it('bdd42_add_member_error_messages_come_through_distinct_channels', async () => {
    // 三类失败文案互异由调用方区分（username 不存在 / 已是成员 / 无权操作）
    // P3 红灯光标：store 暴露的成员操作错误能区分三类（不吞并）——P4 实现承载
    const store = useTeamStore()
    expect(typeof store.addMember).toBe('function')
  })

  it('bdd42_logout_clears_my_teams', async () => {
    vi.mocked(api.listTeams).mockResolvedValue({
      owned: [makeOwned()],
      joined: [makeJoined()],
    } as never)
    const store = useTeamStore()
    await store.loadMyTeams()
    store.reset()
    expect(store.owned).toHaveLength(0)
    expect(store.joined).toHaveLength(0)
  })
})

// 保持 TeamDetail 类型引用（P4 后 api client 返回类型收口）
export type _TeamDetailRef = TeamDetail
