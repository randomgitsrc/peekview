import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FilterChip from '@/components/FilterChip.vue'

// TPV0095 BDD-41：FilterChip dismiss aria-label 参数化
// P2 §0.1 D4：dismiss aria-label 硬编码 "Remove filter" → 参数化（「移除团队过滤：{teamName}」）
// P3 红灯：FilterChip 现无 dismissLabel prop → 传 prop 不生效、aria-label 仍 "Remove filter" → 断言失败。

describe('TPV0095 FilterChip — dismiss aria-label 参数化（BDD-41）', () => {
  it('bdd41_default_aria_label_remove_filter', () => {
    const wrapper = mount(FilterChip, { props: { label: 'x' } })
    expect(wrapper.find('.filter-chip-dismiss').attributes('aria-label')).toBe('Remove filter')
  })

  it('bdd41_parameterized_aria_label_for_team_chip', () => {
    const wrapper = mount(FilterChip, {
      props: { label: 'Proj A', dismissLabel: '移除团队过滤：Proj A' },
    })
    const aria = wrapper.find('.filter-chip-dismiss').attributes('aria-label')
    expect(aria).toContain('移除团队过滤')
    expect(aria).toContain('Proj A')
  })
})
