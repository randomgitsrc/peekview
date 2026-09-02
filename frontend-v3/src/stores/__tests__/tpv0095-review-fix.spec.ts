import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useTeamStore } from '@/stores/team'
import { api } from '@/api/client'

// TPV0095 design-review F2 — auth.logout() 内建 teamStore.reset()
// P2 §5.5-② 登出清零 myTeams → 防跨账号残留（新账号 explore 显示旧 team chips / URL team 恢复误判）

vi.mock('@/api/client', () => ({
  api: {
    logout: vi.fn(),
    listTeams: vi.fn().mockResolvedValue({ owned: [], joined: [] }),
    getMe: vi.fn(),
    createTeam: vi.fn(),
    renameTeam: vi.fn(),
    deleteTeam: vi.fn(),
    addMember: vi.fn(),
    removeMember: vi.fn(),
    leaveTeam: vi.fn(),
    getTeam: vi.fn(),
  },
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

describe('TPV0095 F2 — auth.logout 登出清零 myTeams', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('f2_logout_clears_owned_and_joined_in_team_store', () => {
    const authStore = useAuthStore()
    const teamStore = useTeamStore()
    authStore.initializing = false
    authStore.user = { id: 1, username: 'alice', displayName: null, isActive: true, isAdmin: false, createdAt: '' }
    // 预置旧账号 myTeams 快照
    teamStore.owned = [{ slug: 'old-a', name: 'Old A', memberCount: 1 }]
    teamStore.joined = [{ slug: 'old-j', name: 'Old J', memberCount: 1 }]

    authStore.logout()

    expect(teamStore.owned).toHaveLength(0)
    expect(teamStore.joined).toHaveLength(0)
    expect(api.logout).toHaveBeenCalled()
  })

  it('f2_logout_resets_membership_predicate', async () => {
    const authStore = useAuthStore()
    const teamStore = useTeamStore()
    authStore.initializing = false
    authStore.user = { id: 1, username: 'alice', displayName: null, isActive: true, isAdmin: false, createdAt: '' }
    teamStore.owned = [{ slug: 'old-a', name: 'Old A', memberCount: 1 }]
    teamStore.joined = [{ slug: 'old-j', name: 'Old J', memberCount: 1 }]
    expect(teamStore.isMemberOf('old-a')).toBe(true)

    authStore.logout()

    expect(teamStore.isMemberOf('old-a')).toBe(false)
  })
})
