import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import EntryCard from '@/components/EntryCard.vue'
import BaseBadge from '@/components/BaseBadge.vue'
import type { Entry } from '@/types'

// TPV0095 BDD-39/40：EntryCard team badge 优先级 + toggle 隐藏（delete 保留）
// P3 红灯：
//  - entry.teamId 在 Entry 类型与组件渲染逻辑均不存在；
//  - visibility toggle 无 data-testid="visibility-toggle"；
//  - team entry 现仍渲染 private badge / 显示 toggle → 断言失败。
//
// ⚠️ bdd40_team_entry_hides_visibility_toggle_but_keeps_delete 已被 TPV0102 有意取代
//    （P2-design §6.4 第 2 项）：团队 entry 现**有**可见性菜单（VisibilityMenu 替换原
//    「单按钮 + 空 team-hint span」，team entry 不再被 `v-if="!entry.teamId"` 排除），
//    断言值由 count = 0 翻转为 count = 1。原覆盖点（team entry 渲染可见性入口与否 +
//    delete 保留）**未删除**，只翻转设计变更影响的值。

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

describe('TPV0095 EntryCard — team badge 与 toggle 守卫', () => {
  beforeEach(() => {
    pushMock.mockClear()
  })

  it('bdd39_team_entry_renders_team_badge_with_team_semantics', () => {
    const wrapper = mount(EntryCard, {
      props: {
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
    const wrapper = mount(EntryCard, {
      props: {
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

  it('bdd40_team_entry_shows_visibility_toggle_and_keeps_delete', () => {
    const wrapper = mount(EntryCard, {
      props: {
        entry: makeEntry({ teamId: 5, team: { slug: 'proj-a', name: 'Proj A' } }),
        isOwner: true,
      },
      global: { stubs: { BaseTag: true } },
    })
    // TPV0102 取代 TPV0095 BDD-40（P2-design §6.4 第 2 项）：team entry 现有可见性菜单入口
    expect(wrapper.findAll('[data-testid="visibility-toggle"]')).toHaveLength(1)
    // delete 保留（不被菜单替换）
    expect(wrapper.findAll('[data-action="delete"], .card-action-btn--danger')).not.toHaveLength(0)
  })

  it('bdd40_toggle_visible_for_non_team_owner_entry', () => {
    const wrapper = mount(EntryCard, {
      props: { entry: makeEntry({ isPublic: true }), isOwner: true },
      global: { stubs: { BaseTag: true } },
    })
    // 非 team entry 同样有统一 testid 的入口（两态一致，防「一律不渲染」假绿）
    expect(wrapper.findAll('[data-testid="visibility-toggle"]')).toHaveLength(1)
  })
})
