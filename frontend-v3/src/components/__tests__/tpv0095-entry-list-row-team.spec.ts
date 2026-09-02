import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import EntryListRow from '@/components/EntryListRow.vue'
import BaseBadge from '@/components/BaseBadge.vue'
import type { Entry } from '@/types'

// TPV0095 BDD-39/40：EntryListRow team badge 优先级 + toggle 隐藏（delete 保留）
// P3 红灯：teamId/team 字段、badge-team 变体、visibility-toggle testid 均未实现 → 断言失败。

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: pushMock }) }))

function makeEntry(overrides: Partial<Entry> = {}): Entry {
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
    ...overrides,
  }
}

describe('TPV0095 EntryListRow — team badge 与 toggle 守卫', () => {
  beforeEach(() => {
    pushMock.mockClear()
  })

  it('bdd39_team_entry_renders_team_badge_with_team_semantics', () => {
    const wrapper = mount(EntryListRow, {
      props: {
        // @ts-expect-error — P4 将 teamId/team 并入 Entry 类型
        entry: makeEntry({ teamId: 5, team: { slug: 'proj-a', name: 'Proj A' } }),
        isOwner: true,
      },
      global: { stubs: { BaseTag: true } },
    })
    const badge = wrapper.find('.base-badge')
    expect(badge.exists()).toBe(true)
    expect(badge.classes()).toContain('badge-team')
    expect(badge.text()).toContain('仅团队可见')
    expect(badge.text()).toContain('Proj A')
  })

  it('bdd39_team_entry_does_not_render_private_badge', () => {
    const wrapper = mount(EntryListRow, {
      props: {
        // @ts-expect-error — P4 将 teamId/team 并入 Entry 类型
        entry: makeEntry({ teamId: 5, team: { slug: 'proj-a', name: 'Proj A' } }),
        isOwner: true,
      },
      global: { stubs: { BaseTag: true } },
    })
    const badges = wrapper.findAllComponents(BaseBadge)
    const classes = badges.flatMap((b) => b.classes())
    expect(classes).not.toContain('badge-private')
    expect(classes).not.toContain('badge-public')
    expect(classes).toContain('badge-team')
  })

  it('bdd40_team_entry_hides_visibility_toggle_but_keeps_delete', () => {
    const wrapper = mount(EntryListRow, {
      props: {
        // @ts-expect-error — P4 将 teamId 并入 Entry 类型
        entry: makeEntry({ teamId: 5 }),
        isOwner: true,
      },
      global: { stubs: { BaseTag: true } },
    })
    // P2 §5.7：两视图 toggle 统一 testid visibility-toggle → team entry count=0
    expect(wrapper.findAll('[data-testid="visibility-toggle"]')).toHaveLength(0)
    // delete 保留
    expect(wrapper.findAll('[data-action="delete"]')).toHaveLength(1)
  })

  it('bdd40_owner_non_team_public_entry_keeps_toggle', () => {
    const wrapper = mount(EntryListRow, {
      props: { entry: makeEntry({ isPublic: true }), isOwner: true },
      global: { stubs: { BaseTag: true } },
    })
    const toggle = wrapper.findAll('[data-testid="visibility-toggle"]')
    // 非 team entry：toggle 应存在（P4 后该断言转绿；P3 期 0 → 红灯提示 testid 未落）
    expect(toggle.length).toBeGreaterThan(0)
  })
})
