import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useEntryListStore } from '@/stores/entryList'
import type { Entry } from '@/types'

// TPV0095 BDD-40 原语义：store 层 toggleVisibility 对 teamId entry 拒绝（守卫）。
// TPV0102（P2 §6.4 第 4 项，陷阱 11「替代而非叠加」）显式取代：teamId 守卫被删除，
// 团队 entry 的可见性切换改由 `setVisibility` 走 `api.updateEntry` 正常发起请求。
// 断言值随之翻转 —— 本文件的更新是设计变更的显式登记，不是静默改。

vi.mock('@/api/client', () => ({
  api: {
    listEntries: vi.fn(),
    updateEntry: vi.fn(),
    toggleEntryVisibility: vi.fn(),
    deleteEntry: vi.fn(),
  },
}))

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

function makeTeamEntry(): Entry {
  return {
    id: 1,
    slug: 'team-entry',
    summary: 'Team entry',
    tags: [],
    status: 'active',
    files: [],
    fileCount: 0,
    isPublic: false,
    ownerId: 7,
    username: 'alice',
    expiresAt: null,
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
    teamId: 5,
    team: { slug: 'proj-a', name: 'Proj A' },
  }
}

describe('TPV0095 entryList store — teamId 守卫已被 TPV0102 显式取代', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('bdd40_store_team_entry_now_allows_visibility_request', async () => {
    vi.mocked(api.updateEntry).mockResolvedValue({
      ...makeTeamEntry(),
      isPublic: true,
      teamId: null,
      team: null,
    })
    const store = useEntryListStore()
    const entry = makeTeamEntry()
    store.entries = [entry]

    const result = await store.setVisibility(entry, { kind: 'public' })

    expect(result.ok).toBe(true)
    expect(api.updateEntry).toHaveBeenCalledWith('team-entry', { is_public: true, team_id: null })
    expect(api.toggleEntryVisibility).not.toHaveBeenCalled()
    expect(entry.isPublic).toBe(true)
  })

  it('bdd40_store_toggle_keeps_working_for_non_team_private_entry', async () => {
    vi.mocked(api.updateEntry).mockResolvedValue({
      ...makeTeamEntry(),
      isPublic: true,
      teamId: null,
      team: null,
    })
    const store = useEntryListStore()
    const entry = makeTeamEntry()
    delete (entry as Partial<Entry>).teamId
    store.entries = [entry]

    const result = await store.toggleVisibility(entry)

    expect(result).toBe(true)
    expect(api.updateEntry).toHaveBeenCalledTimes(1)
    expect(entry.isPublic).toBe(true)
  })
})
