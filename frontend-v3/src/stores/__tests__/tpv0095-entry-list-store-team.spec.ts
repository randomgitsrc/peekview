import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useEntryListStore } from '@/stores/entryList'
import type { Entry } from '@/types'

// TPV0095 BDD-40：store 层 toggleVisibility 对 teamId entry 拒绝（UI 与守卫双保险）
// P3 红灯：toggleVisibility 现无 teamId 守卫 → 对 team entry 仍调用 api 且返回 true → 断言失败。

vi.mock('@/api/client', () => ({
  api: {
    listEntries: vi.fn(),
    toggleEntryVisibility: vi.fn().mockResolvedValue({ revokedShares: 0 }),
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
    // @ts-expect-error — P4 将 teamId/team 并入 Entry 类型
    teamId: 5,
    team: { slug: 'proj-a', name: 'Proj A' },
  }
}

describe('TPV0095 entryList store — toggleVisibility teamId 守卫', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('bdd40_store_toggle_rejects_team_entry_without_api_call', async () => {
    const store = useEntryListStore()
    const entry = makeTeamEntry()
    store.entries = [entry]

    const result = await store.toggleVisibility(entry)

    expect(result).toBe(false)
    expect(api.toggleEntryVisibility).not.toHaveBeenCalled()
    // 原值不被翻转（守卫后 isPublic 保持 false）
    expect(entry.isPublic).toBe(false)
  })

  it('bdd40_store_toggle_keeps_working_for_non_team_private_entry', async () => {
    vi.mocked(api.toggleEntryVisibility).mockResolvedValue({ revokedShares: 0 } as never)
    const store = useEntryListStore()
    const entry = makeTeamEntry()
    // @ts-expect-error — 移除 teamId 模拟非 team entry（P4 后类型收口）
    delete (entry as Partial<Entry>).teamId
    store.entries = [entry]

    const result = await store.toggleVisibility(entry)

    expect(result).toBe(true)
    expect(api.toggleEntryVisibility).toHaveBeenCalledTimes(1)
    expect(entry.isPublic).toBe(true)
  })
})
