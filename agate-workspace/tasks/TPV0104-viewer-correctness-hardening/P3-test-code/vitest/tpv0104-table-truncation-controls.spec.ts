/**
 * TPV0104 — 截断态表头控件与文案（BDD-32 / BDD-33 回归 / BDD-34）
 *
 * `maxRows` 默认 50000 且全仓无 view 覆盖（`TableView.vue:127`），seed 最大 CSV 仅 61 行
 * → 判据必须在单测层传小 `maxRows`（先例 `TableView.spec.ts:184` 传 `maxRows: 5`）。
 *
 * 源码事实（P1 §3.5）：`.th-sort-btn` 与 `.th-filter` **无 v-if、始终渲染**；
 * `.th-label` 已存在于 `.th-sort-btn` **内部**（`TableView.vue:28`）→ 截断态的正确形态是
 * `v-if/v-else` 双分支（另一分支再写一份 `span.th-label`），而非给既有 span 加条件。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import TableView from '@/components/TableView.vue'

function csvWithDataRows(n: number): string {
  const rows: string[] = ['id,name']
  for (let i = 0; i < n; i++) rows.push(`${i},row${i}`)
  return rows.join('\n')
}

function mountTable(props: Partial<{
  content: string
  delimiter: ',' | '\t'
  filename: string
  downloadFn: () => void
  maxRows: number
}> = {}) {
  return mount(TableView, {
    props: {
      content: csvWithDataRows(10),
      delimiter: ',',
      filename: 'data.csv',
      downloadFn: vi.fn(),
      ...props,
    },
  })
}

describe('TPV0104 截断态表头控件（BDD-32）', () => {
  let wrapper: ReturnType<typeof mountTable>

  beforeEach(async () => {
    wrapper = mountTable({ maxRows: 5 })
    await flushPromises()
  })

  it('test_bdd_32_no_sort_buttons_when_truncated', () => {
    expect(wrapper.findAll('.th-sort-btn')).toHaveLength(0)
  })

  it('test_bdd_32_no_filter_inputs_when_truncated', () => {
    expect(wrapper.findAll('thead input')).toHaveLength(0)
  })

  it('test_bdd_32_header_text_still_visible_when_truncated', () => {
    // 截断态只禁「可点击排序控件」与「过滤输入框」，表头文字本身仍须可见
    const headers = wrapper.findAll('thead th')
    expect(headers.length).toBeGreaterThan(0)
    expect(headers[0].text()).toContain('id')
  })
})

describe('TPV0104 未截断态控件仍生效（BDD-33 回归兼容）', () => {
  it('test_bdd_33_sort_and_filter_controls_present_when_not_truncated', async () => {
    const wrapper = mountTable({ maxRows: 50 })
    await flushPromises()
    expect(wrapper.findAll('.th-sort-btn').length).toBeGreaterThan(0)
    expect(wrapper.findAll('thead input').length).toBeGreaterThan(0)
  })

  it('test_bdd_33_sorting_changes_first_row_order', async () => {
    // 素材刻意倒序，首次点击（asc）必然改变首行 → 断言可区分「排序未生效」
    const desc = ['id,name', '3,r3', '2,r2', '1,r1'].join('\n')
    const wrapper = mountTable({ maxRows: 50, content: desc })
    await flushPromises()
    const before = wrapper.findAll('tbody tr').map(r => r.text())
    await wrapper.findAll('.th-sort-btn')[0].trigger('click')
    await flushPromises()
    const after = wrapper.findAll('tbody tr').map(r => r.text())
    expect(after[0]).not.toBe(before[0])
    expect(after[0]).toContain('1')
  })

  it('test_bdd_33_filtering_reduces_visible_rows', async () => {
    const wrapper = mountTable({ maxRows: 50 })
    await flushPromises()
    const before = wrapper.findAll('tbody tr').length
    await wrapper.findAll('thead input')[1].setValue('row1')
    await flushPromises()
    const after = wrapper.findAll('tbody tr').length
    expect(after).toBeLessThan(before)
    expect(after).toBeGreaterThanOrEqual(1)
  })
})

describe('TPV0104 截断提示文案含已显示行数与总行数（BDD-34）', () => {
  it('test_bdd_34_banner_text_has_shown_and_total_rows', async () => {
    // 10 数据行 + 1 表头行 = totalRows 11；maxRows 5
    // 字面文案（P2-design.md M4）：`数据量过大，已显示前 5 行，共 11 行`
    const wrapper = mountTable({ maxRows: 5 })
    await flushPromises()
    const banner = wrapper.find('.truncation-banner')
    expect(banner.exists()).toBe(true)
    const text = banner.text()
    expect(text).toContain('5')
    expect(text).toContain('11')
  })
})
