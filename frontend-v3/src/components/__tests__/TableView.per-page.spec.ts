// 部署位置: frontend-v3/src/components/__tests__/TableView.per-page.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import TableView from '@/components/TableView.vue'

// T085 BDD-11: 每页行数控件支持键盘操作
// 原生 select 无自定义下拉 → 无 button.per-page-trigger / role=listbox → 断言失败（B 类红灯）
//
// 选择器契约（P4 implementer 须满足）：
//   - 触发按钮: button.per-page-trigger（aria-haspopup="listbox", aria-expanded）
//   - 选项列表: ul[role="listbox"] / li[role="option"]
//   - 选项值: data-value="50" / data-value="100" / data-value="500"
//   - 键盘: Enter/Space 打开 → ArrowDown/ArrowUp 导航 → Enter 选择 → Escape 关闭

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

describe('T085 BDD-11: 每页行数控件键盘操作', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('test_bdd_11_per_page_trigger_exists', async () => {
    const wrapper = mountTable({ content: csvRows(150) })
    await flushPromises()
    const trigger = wrapper.find('button.per-page-trigger')
    expect(trigger.exists()).toBe(true)
  })

  it('test_bdd_11_trigger_has_listbox_aria', async () => {
    const wrapper = mountTable({ content: csvRows(150) })
    await flushPromises()
    const trigger = wrapper.find('button.per-page-trigger')
    expect(trigger.attributes('aria-haspopup')).toBe('listbox')
  })

  it('test_bdd_11_enter_opens_listbox', async () => {
    const wrapper = mountTable({ content: csvRows(150) })
    await flushPromises()
    const trigger = wrapper.find('button.per-page-trigger')
    await trigger.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    const listbox = wrapper.find('[role="listbox"]')
    expect(listbox.exists()).toBe(true)
    expect(trigger.attributes('aria-expanded')).toBe('true')
  })

  it('test_bdd_11_keyboard_navigate_and_select_50', async () => {
    const wrapper = mountTable({ content: csvRows(300) })
    await flushPromises()

    expect(wrapper.findAll('tbody tr').length).toBe(100)

    const trigger = wrapper.find('button.per-page-trigger')
    await trigger.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    const listbox = wrapper.find('[role="listbox"]')
    expect(listbox.exists()).toBe(true)

    const options = wrapper.findAll('[role="option"]')
    expect(options.length).toBeGreaterThanOrEqual(3)

    const option50 = options.find(o => o.attributes('data-value') === '50')
    expect(option50).toBeTruthy()

    await trigger.trigger('keydown', { key: 'ArrowDown' })
    await flushPromises()

    if (option50) {
      await option50.trigger('keydown', { key: 'Enter' })
      await flushPromises()
    }

    expect(wrapper.findAll('tbody tr').length).toBe(50)

    const activePages = wrapper.findAll('.page-num.active')
    expect(activePages.length).toBe(1)
    expect(activePages[0].text()).toBe('1')
  })

  it('test_bdd_11_escape_closes_listbox', async () => {
    const wrapper = mountTable({ content: csvRows(150) })
    await flushPromises()
    const trigger = wrapper.find('button.per-page-trigger')
    await trigger.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(wrapper.find('[role="listbox"]').exists()).toBe(true)

    await trigger.trigger('keydown', { key: 'Escape' })
    await flushPromises()
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)
    expect(trigger.attributes('aria-expanded')).toBe('false')
  })
})
