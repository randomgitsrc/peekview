import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseBadge from '@/components/BaseBadge.vue'

// TPV0095 BDD-39/44：BaseBadge team 变体 + label 参数化
// P3 红灯：BaseBadge 现 status union 无 'team'、无 label prop →
// (a) TS：status="team" 超 union（vue-tsc 层面）；
// (b) 运行时 label 退化为 "team"，无「仅团队可见 · {teamName}」文案 → 断言失败。

describe('TPV0095 BaseBadge — team 变体', () => {
  it('bdd39_renders_team_status_badge', () => {
    const wrapper = mount(BaseBadge, { props: { status: 'team' } })
    expect(wrapper.find('.base-badge').classes()).toContain('badge-team')
  })

  it('bdd39_label_can_be_parameterized_with_team_copy', () => {
    const wrapper = mount(BaseBadge, {
      props: { status: 'team', label: '仅团队可见 · Proj A' },
    })
    expect(wrapper.find('.base-badge').text()).toContain('仅团队可见 · Proj A')
  })

  it('bdd39_team_badge_not_rendered_with_public_class', () => {
    const wrapper = mount(BaseBadge, { props: { status: 'team' } })
    const el = wrapper.find('.base-badge')
    expect(el.classes()).not.toContain('badge-public')
    expect(el.classes()).not.toContain('badge-private')
  })

  it('bdd39_default_label_falls_back_to_status_word', () => {
    const wrapper = mount(BaseBadge, { props: { status: 'public' } })
    expect(wrapper.text().toLowerCase()).toContain('public')
  })

  it('bdd44_detail_badge_slot_contains_team_word_and_name', () => {
    // 详情三态标签按 P2 §5.8 复用 BaseBadge team 变体——载体渲染文案须含团队语义
    const wrapper = mount(BaseBadge, {
      props: { status: 'team', label: '仅团队可见 · 团队A' },
    })
    const text = wrapper.text()
    expect(text).toContain('团队')
    expect(text).not.toContain('Private')
  })
})
