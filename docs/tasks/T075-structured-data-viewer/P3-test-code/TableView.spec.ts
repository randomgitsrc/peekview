import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import TableView from '@/components/TableView.vue'

// T075 TableView — CSV/TSV 表格渲染器（P2 §3.8）
// 当前红灯：@/components/TableView.vue 不存在 → import 失败（B 类红灯）
//
// 选择器契约（P4 implementer 须满足）：
//   - 根容器 class="table-view"，内部语义 table/thead/tbody/tr/th/td
//   - 列头 th 绑定 aria-sort（ascending/descending，原序时无 aria-sort）
//   - 列头筛选输入框 aria-label="Filter {列名}"
//   - 每页行数选择器 select.per-page-select（50/100/500，默认 100）
//   - 分页复用 Pagination 组件（class="pagination"）
//   - 截断提示条 class="truncation-banner" + 下载按钮

function csvRows(n: number): string {
  const rows: string[] = ['name,age,city']
  for (let i = 0; i < n; i++) {
    rows.push(`user${i},${20 + (i % 60)},city${i % 10}`)
  }
  return rows.join('\n')
}

function mountTable(props: Partial<{
  content: string
  delimiter: ',' | '\t'
  filename: string
  downloadFn: () => void
}> = {}) {
  return mount(TableView, {
    props: {
      content: 'name,age\nalice,30\nbob,25',
      delimiter: ',',
      filename: 'data.csv',
      downloadFn: vi.fn(),
      ...props,
    },
  })
}

describe('T075 TableView 渲染（BDD-12/13）', () => {
  it('test_bdd_12_csv_renders_table_with_headers_and_rows', async () => {
    const wrapper = mountTable({ content: 'name,age\n alice,30\nbob,25' })
    await flushPromises()
    expect(wrapper.find('.table-view').exists()).toBe(true)
    expect(wrapper.find('table').exists()).toBe(true)
    const headers = wrapper.findAll('thead th')
    expect(headers.length).toBe(3)
    expect(headers[0].text()).toBe('name')
    expect(headers[1].text()).toBe('age')
    expect(wrapper.findAll('tbody tr').length).toBe(2)
    expect(wrapper.find('tbody tr').text()).toContain('alice')
  })

  it('test_bdd_13_tsv_tab_delimited_parses_columns', async () => {
    const wrapper = mountTable({ delimiter: '\t', content: 'name\tage\nalice\t30' })
    await flushPromises()
    const headers = wrapper.findAll('thead th')
    expect(headers.length).toBe(2)
    expect(headers[0].text()).toBe('name')
    expect(wrapper.find('tbody tr td').text()).toBe('alice')
  })
})

describe('T075 TableView CSV 边界渲染（BDD-14/15/16）', () => {
  it('test_bdd_14_quoted_comma_stays_single_cell', async () => {
    const wrapper = mountTable({ content: 'a,b\n"hello, world",x' })
    await flushPromises()
    const firstRowCells = wrapper.findAll('tbody tr').at(0)!.findAll('td')
    expect(firstRowCells.length).toBe(2)
    expect(firstRowCells[0].text()).toBe('hello, world')
  })

  it('test_bdd_15_quoted_newline_stays_single_cell', async () => {
    const wrapper = mountTable({ content: 'a,b\n"line1\nline2",x' })
    await flushPromises()
    expect(wrapper.findAll('tbody tr').length).toBe(1)
    expect(wrapper.find('tbody tr td').text()).toContain('line1')
    expect(wrapper.find('tbody tr td').text()).toContain('line2')
  })

  it('test_bdd_16_double_quote_escape_rendered', async () => {
    const wrapper = mountTable({ content: 'a,b\n"say ""hi""",x' })
    await flushPromises()
    expect(wrapper.find('tbody tr td').text()).toBe('say "hi"')
  })
})

describe('T075 TableView 排序与筛选（BDD-17/18）', () => {
  it('test_bdd_17_sort_cycle_asc_desc_original', async () => {
    const wrapper = mountTable({ content: 'n\n3\n1\n2' })
    await flushPromises()
    const header = wrapper.findAll('thead th')[0]

    await header.trigger('click')
    await flushPromises()
    expect(header.attributes('aria-sort')).toBe('ascending')
    expect(wrapper.find('tbody tr').text()).toBe('1')

    await header.trigger('click')
    await flushPromises()
    expect(header.attributes('aria-sort')).toBe('descending')
    expect(wrapper.find('tbody tr').text()).toBe('3')

    await header.trigger('click')
    await flushPromises()
    expect(header.attributes('aria-sort')).toBeUndefined()
  })

  it('test_bdd_18_filter_column_contains_only', async () => {
    const wrapper = mountTable({ content: 'name,age\nalice,30\nbob,25\nalicia,40' })
    await flushPromises()
    expect(wrapper.findAll('tbody tr').length).toBe(3)

    const filterInput = wrapper.find('input[aria-label="Filter name"]')
    expect(filterInput.exists()).toBe(true)
    await filterInput.setValue('alice')
    await flushPromises()

    const rows = wrapper.findAll('tbody tr')
    expect(rows.length).toBe(2)
    for (const row of rows) {
      expect(row.text()).toContain('alice')
    }
  })
})

describe('T075 TableView 分页（BDD-19/20）', () => {
  it('test_bdd_19_default_per_page_100', async () => {
    const wrapper = mountTable({ content: csvRows(250) })
    await flushPromises()
    expect(wrapper.findAll('tbody tr').length).toBe(100)
    const perPageSelect = wrapper.find('select.per-page-select')
    expect((perPageSelect.element as HTMLSelectElement).value).toBe('100')
    expect(wrapper.find('.pagination').exists()).toBe(true)
  })

  it('test_bdd_20_per_page_switch_resets_page_one', async () => {
    const wrapper = mountTable({ content: csvRows(250) })
    await flushPromises()

    // 翻到第 3 页（点击 Pagination 页码）
    const pageNums = wrapper.findAll('.page-num')
    const page3 = pageNums.find(p => p.text() === '3')
    await page3!.trigger('click')
    await flushPromises()
    expect(wrapper.findAll('tbody tr').length).toBe(100)

    // 切换每页行数 → 回第一页
    const perPageSelect = wrapper.find('select.per-page-select')
    await perPageSelect.setValue('50')
    await flushPromises()

    expect(wrapper.findAll('tbody tr').length).toBe(50)
    const activePages = wrapper.findAll('.page-num.active')
    expect(activePages.length).toBe(1)
    expect(activePages[0].text()).toBe('1')
  })
})

describe('T075 TableView 横向滚动（BDD-21）', () => {
  it('test_bdd_21_horizontal_scroll_container', async () => {
    const cols = Array.from({ length: 30 }, (_, i) => `col${i}`).join(',')
    const wrapper = mountTable({ content: `${cols}\n${Array.from({ length: 30 }, (_, i) => `v${i}`).join(',')}` })
    await flushPromises()
    const scrollContainer = wrapper.find('.table-scroll')
    expect(scrollContainer.exists()).toBe(true)
    const el = scrollContainer.element as HTMLElement
    expect(getComputedStyle(el).overflowX).toBe('auto')
  })
})

describe('T075 TableView 截断与空输入（BDD-22/23）', () => {
  it('test_bdd_22_truncation_banner_with_download', async () => {
    const downloadFn = vi.fn()
    const big = Array.from({ length: 50001 }, (_, i) => `v,${i}`).join('\n')
    const wrapper = mountTable({ content: big, downloadFn })
    await flushPromises()
    expect(wrapper.findAll('tbody tr').length).toBe(50000)
    const banner = wrapper.find('.truncation-banner')
    expect(banner.exists()).toBe(true)
    expect(banner.text()).toContain('50,000')
    const downloadBtn = banner.find('button')
    await downloadBtn.trigger('click')
    expect(downloadFn).toHaveBeenCalled()
  })

  it('test_bdd_23_empty_csv_no_data_no_crash', async () => {
    const wrapper = mountTable({ content: '' })
    await flushPromises()
    expect(wrapper.find('.table-view').exists()).toBe(true)
    const noData = wrapper.find('.no-data')
    const tbodyRows = wrapper.findAll('tbody tr')
    expect(noData.exists() || tbodyRows.length === 0).toBe(true)
  })
})

describe('T075 TableView 解析失败（BDD-49）', () => {
  it('test_bdd_49_parse_error_emits', async () => {
    const wrapper = mountTable({ content: 'a,b\n"unclosed' })
    await flushPromises()
    const emitted = wrapper.emitted('parse-error')
    expect(emitted).toBeDefined()
    expect(typeof emitted![0][0]).toBe('string')
  })
})
