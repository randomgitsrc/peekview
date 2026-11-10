/**
 * TPV0102 — 可见性菜单组件契约（P3 红灯基线）。
 *
 * 对应 P1-requirements.md：
 *   BDD-16  菜单不包含当前可见性状态项
 *   BDD-17  无团队时不渲染 Team 入口
 *   BDD-18  Team 恒为子菜单且排除当前团队、Team 入口不直接切换
 *   BDD-19  升为 Public 需二次确认（确认前不发事件）
 *   BDD-20  降级可见性不弹二次确认
 *   BDD-21  confirm-cancel 路径（取消后菜单重开 + 焦点回归，P2 D-10）
 *   BDD-24  切换请求进行中菜单不可重复触发
 *   BDD-30  Escape 关闭菜单且焦点回到触发入口
 *   （附）R11 团队列表加载失败时 Team 位为禁用项 + 失败文案
 *
 * 契约来源 P2-design §3.5 `VisibilityMenu.vue` + §3.8 稳定测试标识清单：
 *   触发按钮 `data-testid="visibility-toggle"`（沿用，**不得改名**）+ `aria-label` + `aria-haspopup`
 *           + `aria-expanded="isOpen"`
 *   菜单容器 `data-testid="visibility-menu"`
 *   菜单项   `visibility-item-public` / `visibility-item-private` / `visibility-item-team`
 *   子菜单   `visibility-team-submenu`，项 `visibility-team-option-{slug}`
 *   二次确认 不设 testid（`ConfirmDialog` 根为 Teleport，attrs 不落到 DOM）→ 用既有类名
 *           `.confirm-dialog`（P2 §3.8 D-2 裁定）
 *
 * 当前红灯原因（B 类）：`@/components/VisibilityMenu.vue` 尚未创建。
 */

import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import VisibilityMenu from '@/components/VisibilityMenu.vue'
import type { Entry, Team } from '@/types'

const TEAM_A: Team = { slug: 'team-a', name: 'Team A', memberCount: 2 }
const TEAM_B: Team = { slug: 'team-b', name: 'Team B', memberCount: 1 }

function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 1,
    slug: 'owned-entry',
    summary: 'Owned entry',
    tags: [],
    status: 'active',
    files: [],
    fileCount: 2,
    isPublic: true,
    ownerId: 7,
    username: 'alice',
    expiresAt: null,
    archivedAt: null,
    createdAt: '2026-11-10T09:43:00Z',
    teamId: null,
    team: null,
    ...overrides,
  }
}

function mountMenu(props: Record<string, unknown> = {}) {
  return mount(VisibilityMenu, {
    props: {
      entry: makeEntry(),
      teams: [TEAM_A, TEAM_B],
      variant: 'icon' as const,
      ...props,
    },
    attachTo: document.body,
  })
}

async function openMenu(wrapper: ReturnType<typeof mountMenu>) {
  await wrapper.find('[data-testid="visibility-toggle"]').trigger('click')
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('BDD-16/17/18: 菜单项构造呈现在 DOM 上', () => {
  it('BDD-16: public entry 的菜单不含 public 项，含 private 与 team 入口', async () => {
    const wrapper = mountMenu({ entry: makeEntry({ isPublic: true }) })
    await openMenu(wrapper)

    expect(wrapper.find('[data-testid="visibility-item-public"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="visibility-item-private"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="visibility-item-team"]').exists()).toBe(true)
  })

  it('BDD-17: teams 为空时不渲染 Team 入口', async () => {
    const wrapper = mountMenu({ entry: makeEntry({ isPublic: true }), teams: [] })
    await openMenu(wrapper)

    expect(wrapper.find('[data-testid="visibility-item-team"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="visibility-item-private"]').exists()).toBe(true)
  })

  it('BDD-18: Team 以子菜单呈现，子菜单排除当前团队', async () => {
    const wrapper = mountMenu({
      entry: makeEntry({ isPublic: false, teamId: 1, team: { slug: TEAM_A.slug, name: TEAM_A.name } }),
      teams: [TEAM_A, TEAM_B],
    })
    await openMenu(wrapper)
    await wrapper.find('[data-testid="visibility-item-team"]').trigger('click')

    const submenu = wrapper.find('[data-testid="visibility-team-submenu"]')
    expect(submenu.exists()).toBe(true)
    expect(wrapper.find(`[data-testid="visibility-team-option-${TEAM_A.slug}"]`).exists()).toBe(false)
    expect(wrapper.find(`[data-testid="visibility-team-option-${TEAM_B.slug}"]`).exists()).toBe(true)
  })

  it('BDD-18: 点 Team 入口只展开子菜单，不 emit select', async () => {
    const wrapper = mountMenu({ entry: makeEntry({ isPublic: true }) })
    await openMenu(wrapper)
    await wrapper.find('[data-testid="visibility-item-team"]').trigger('click')

    expect(wrapper.emitted('select')).toBeUndefined()
    expect(wrapper.find('[data-testid="visibility-team-submenu"]').exists()).toBe(true)
  })
})

describe('BDD-19: 升为 Public 需二次确认', () => {
  it('BDD-19: 选择 Public 在确认前不 emit select', async () => {
    const wrapper = mountMenu({
      entry: makeEntry({ isPublic: false, teamId: 1, team: { slug: TEAM_A.slug, name: TEAM_A.name } }),
    })
    await openMenu(wrapper)
    await wrapper.find('[data-testid="visibility-item-public"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('select')).toBeUndefined()
    // 二次确认走既有 ConfirmDialog（Teleport 到 body，类名定位，P2 §3.8 D-2）
    expect(document.body.querySelector('.confirm-dialog')).not.toBeNull()
  })

  it('BDD-19: 确认后才 emit select 且 payload 为 public', async () => {
    const wrapper = mountMenu({
      entry: makeEntry({ isPublic: false, teamId: 1, team: { slug: TEAM_A.slug, name: TEAM_A.name } }),
    })
    await openMenu(wrapper)
    await wrapper.find('[data-testid="visibility-item-public"]').trigger('click')
    await wrapper.vm.$nextTick()

    const confirmBtn = document.body.querySelector<HTMLButtonElement>(
      '.confirm__btn:not(.confirm__btn--cancel)',
    )
    expect(confirmBtn).not.toBeNull()
    confirmBtn!.click()
    await wrapper.vm.$nextTick()

    const emitted = wrapper.emitted('select')
    expect(emitted).toBeTruthy()
    expect(emitted![0][0]).toEqual({ kind: 'public' })
  })
})

describe('BDD-20: 降级可见性不弹二次确认', () => {
  it('BDD-20: 选择 Private 直接 emit，且不出现确认框', async () => {
    const wrapper = mountMenu({ entry: makeEntry({ isPublic: true }) })
    await openMenu(wrapper)
    await wrapper.find('[data-testid="visibility-item-private"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(document.body.querySelector('.confirm-dialog')).toBeNull()
    const emitted = wrapper.emitted('select')
    expect(emitted).toBeTruthy()
    expect(emitted![0][0]).toEqual({ kind: 'private' })
  })
})

describe('BDD-21: 取消二次确认（confirm-cancel 路径，P2 D-10）', () => {
  it('BDD-21: 取消后 emit confirm-cancel、不发 select、菜单重开、焦点回触发入口', async () => {
    const wrapper = mountMenu({
      entry: makeEntry({ isPublic: false, teamId: 1, team: { slug: TEAM_A.slug, name: TEAM_A.name } }),
    })
    await openMenu(wrapper)
    await wrapper.find('[data-testid="visibility-item-public"]').trigger('click')
    await wrapper.vm.$nextTick()

    const cancelBtn = document.body.querySelector<HTMLButtonElement>('.confirm__btn--cancel')
    expect(cancelBtn).not.toBeNull()
    cancelBtn!.click()
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('confirm-cancel')).toBeTruthy()
    expect(wrapper.emitted('select')).toBeUndefined()
    // 菜单重开 + 焦点回归（ConfirmDialog 关闭后焦点落到 body，须由本组件补回）
    expect(wrapper.find('[data-testid="visibility-menu"]').exists()).toBe(true)
    expect(document.activeElement).toBe(wrapper.find('[data-testid="visibility-toggle"]').element)
  })
})

describe('BDD-24: 请求进行中不可重复触发', () => {
  it('BDD-24: disabled 时菜单项不响应点击', async () => {
    const wrapper = mountMenu({ entry: makeEntry({ isPublic: true }), disabled: true })
    // disabled 时触发按钮不可点：直接断言按钮 disabled 属性
    const trigger = wrapper.find('[data-testid="visibility-toggle"]')
    expect(trigger.attributes('disabled')).toBeDefined()

    await trigger.trigger('click')
    expect(wrapper.find('[data-testid="visibility-item-private"]').exists()).toBe(false)
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('BDD-24: 触发按钮同时带 aria-disabled 与 aria-haspopup', async () => {
    const wrapper = mountMenu({ entry: makeEntry({ isPublic: true }), disabled: true })
    const trigger = wrapper.find('[data-testid="visibility-toggle"]')
    expect(trigger.attributes('aria-disabled')).toBe('true')
    expect(trigger.attributes('aria-haspopup')).toBe('true')
  })
})

describe('BDD-30: 键盘可关闭且焦点回到触发入口', () => {
  it('BDD-30: Escape 关闭菜单且焦点回到触发按钮', async () => {
    const wrapper = mountMenu({ entry: makeEntry({ isPublic: true }) })
    await openMenu(wrapper)
    expect(wrapper.find('[data-testid="visibility-menu"]').exists()).toBe(true)

    const trigger = wrapper.find('[data-testid="visibility-toggle"]').element as HTMLElement
    trigger.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="visibility-menu"]').exists()).toBe(false)
    expect(document.activeElement).toBe(trigger)
  })

  it('BDD-30: 触发按钮带 aria-expanded 反映开合状态', async () => {
    const wrapper = mountMenu({ entry: makeEntry({ isPublic: true }) })
    const trigger = wrapper.find('[data-testid="visibility-toggle"]')
    expect(trigger.attributes('aria-expanded')).toBe('false')
    await openMenu(wrapper)
    expect(
      wrapper.find('[data-testid="visibility-toggle"]').attributes('aria-expanded'),
    ).toBe('true')
  })
})

describe('R11: 团队列表加载失败时 Team 位不静默消失', () => {
  it('R11: teamsFailed 时 Team 位为禁用项且带失败文案', async () => {
    const wrapper = mountMenu({
      entry: makeEntry({ isPublic: true }),
      teams: [],
      teamsFailed: true,
    })
    await openMenu(wrapper)

    const teamItem = wrapper.find('[data-testid="visibility-item-team"]')
    expect(teamItem.exists()).toBe(true)
    expect(teamItem.attributes('disabled')).toBeDefined()
    const hinted = `${teamItem.text()} ${teamItem.attributes('title') ?? ''}`
    expect(hinted).toContain('团队列表加载失败')
  })
})

describe('可见性状态 aria-label（P2 N-4）', () => {
  it('触发按钮带由纯函数生成的状态 aria-label', () => {
    const wrapper = mountMenu({ entry: makeEntry({ isPublic: true }) })
    const label = wrapper.find('[data-testid="visibility-toggle"]').attributes('aria-label')
    expect(label).toBeTruthy()
    expect(label).toContain('Public')
  })

  it('团队可见性时 aria-label 含「仅团队可见 · 团队名」', () => {
    const wrapper = mountMenu({
      entry: makeEntry({ isPublic: false, teamId: 1, team: { slug: TEAM_A.slug, name: TEAM_A.name } }),
    })
    const label = wrapper.find('[data-testid="visibility-toggle"]').attributes('aria-label')
    expect(label).toContain('仅团队可见')
    expect(label).toContain(TEAM_A.name)
  })
})
