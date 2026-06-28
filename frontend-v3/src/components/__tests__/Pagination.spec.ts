import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Pagination from '@/components/Pagination.vue'

function mountPagination(props: {
  page?: number
  perPage?: number
  total?: number
  maxVisible?: number
} = {}) {
  return mount(Pagination, {
    props: {
      page: 1,
      perPage: 10,
      total: 100,
      ...props,
    },
  })
}

describe('totalPages computed', () => {
  it('ceil(total / perPage)', () => {
    const wrapper = mountPagination({ total: 100, perPage: 10, page: 1 })
    expect(wrapper.vm.totalPages).toBe(10)
  })

  it('rounds up when not evenly divisible', () => {
    const wrapper = mountPagination({ total: 25, perPage: 10, page: 1 })
    expect(wrapper.vm.totalPages).toBe(3)
  })

  it('minimum is 1 even when total is 0', () => {
    const wrapper = mountPagination({ total: 0, perPage: 10, page: 1 })
    expect(wrapper.vm.totalPages).toBe(1)
  })

  it('total equals perPage gives 1 page', () => {
    const wrapper = mountPagination({ total: 10, perPage: 10, page: 1 })
    expect(wrapper.vm.totalPages).toBe(1)
  })
})

describe('visiblePages computed', () => {
  it('returns all pages when total <= maxVisible', () => {
    const wrapper = mountPagination({ total: 50, perPage: 10, page: 1, maxVisible: 7 })
    expect(wrapper.vm.visiblePages).toEqual([1, 2, 3, 4, 5])
  })

  it('first page: shows leading pages with no left ellipsis', () => {
    const wrapper = mountPagination({ total: 200, perPage: 10, page: 1, maxVisible: 7 })
    const pages = wrapper.vm.visiblePages
    expect(pages[0]).toBe(1)
    expect(pages[pages.length - 1]).toBe(20)
    // No ellipsis on left side since start=1
    expect(pages.length).toBeLessThanOrEqual(7)
  })

  it('middle page: shows both ends with surrounding pages', () => {
    const wrapper = mountPagination({ total: 200, perPage: 10, page: 10, maxVisible: 7 })
    const pages = wrapper.vm.visiblePages
    expect(pages[0]).toBe(1)
    expect(pages[pages.length - 1]).toBe(20)
    expect(pages).toContain(10)
  })

  it('last page: shows trailing pages with no right ellipsis', () => {
    const wrapper = mountPagination({ total: 200, perPage: 10, page: 20, maxVisible: 7 })
    const pages = wrapper.vm.visiblePages
    expect(pages[0]).toBe(1)
    expect(pages[pages.length - 1]).toBe(20)
  })

  it('all values are numbers (ellipsis strings filtered out)', () => {
    const wrapper = mountPagination({ total: 300, perPage: 10, page: 15, maxVisible: 7 })
    for (const p of wrapper.vm.visiblePages) {
      expect(typeof p).toBe('number')
    }
  })
})

describe('prev/next buttons', () => {
  it('prev is disabled when page is 1', () => {
    const wrapper = mountPagination({ page: 1, total: 100 })
    const buttons = wrapper.findAll('.page-btn')
    const prevBtn = buttons[0]
    expect(prevBtn.attributes('disabled')).toBeDefined()
  })

  it('prev is enabled when page > 1', () => {
    const wrapper = mountPagination({ page: 3, total: 100 })
    const buttons = wrapper.findAll('.page-btn')
    const prevBtn = buttons[0]
    expect(prevBtn.attributes('disabled')).toBeUndefined()
  })

  it('next is disabled when page equals totalPages', () => {
    const wrapper = mountPagination({ page: 10, total: 100, perPage: 10 })
    const buttons = wrapper.findAll('.page-btn')
    const nextBtn = buttons[1]
    expect(nextBtn.attributes('disabled')).toBeDefined()
  })

  it('next is enabled when page < totalPages', () => {
    const wrapper = mountPagination({ page: 5, total: 100, perPage: 10 })
    const buttons = wrapper.findAll('.page-btn')
    const nextBtn = buttons[1]
    expect(nextBtn.attributes('disabled')).toBeUndefined()
  })

  it('clicking prev emits update:page with page-1', async () => {
    const wrapper = mountPagination({ page: 3, total: 100 })
    const prevBtn = wrapper.findAll('.page-btn')[0]
    await prevBtn.trigger('click')
    expect(wrapper.emitted('update:page')![0]).toEqual([2])
  })

  it('clicking next emits update:page with page+1', async () => {
    const wrapper = mountPagination({ page: 3, total: 100 })
    const nextBtn = wrapper.findAll('.page-btn')[1]
    await nextBtn.trigger('click')
    expect(wrapper.emitted('update:page')![0]).toEqual([4])
  })
})

describe('page number click', () => {
  it('clicking a page number emits update:page', async () => {
    const wrapper = mountPagination({ total: 100, perPage: 10, page: 1 })
    const pageNums = wrapper.findAll('.page-num')
    // Click page 5 (index 4)
    await pageNums[4].trigger('click')
    expect(wrapper.emitted('update:page')![0]).toEqual([5])
  })

  it('active class is on current page button', () => {
    const wrapper = mountPagination({ total: 100, perPage: 10, page: 5 })
    const pageNums = wrapper.findAll('.page-num')
    const activeButtons = pageNums.filter(btn => btn.classes('active'))
    expect(activeButtons.length).toBe(1)
    expect(activeButtons[0].text()).toBe('5')
  })

  it('only one active page at a time', () => {
    const wrapper = mountPagination({ total: 100, perPage: 10, page: 3, maxVisible: 7 })
    const activeButtons = wrapper.findAll('.page-num.active')
    expect(activeButtons.length).toBe(1)
  })
})

describe('quick jump', () => {
  it('renders Go button and input', () => {
    const wrapper = mountPagination()
    expect(wrapper.find('.page-input').exists()).toBe(true)
    expect(wrapper.find('.jump-btn').exists()).toBe(true)
  })

  it('shows total pages in jumper', () => {
    const wrapper = mountPagination({ total: 100, perPage: 10 })
    expect(wrapper.find('.page-jumper').text()).toContain('/ 10')
  })

  it('enter key triggers jump', async () => {
    const wrapper = mountPagination({ total: 100, perPage: 10, page: 1 })
    const input = wrapper.find('.page-input')
    await input.setValue('8')
    await input.trigger('keyup.enter')
    expect(wrapper.emitted('update:page')![0]).toEqual([8])
  })

  it('Go button click triggers jump', async () => {
    const wrapper = mountPagination({ total: 100, perPage: 10, page: 1 })
    const input = wrapper.find('.page-input')
    await input.setValue('6')
    const goBtn = wrapper.find('.jump-btn')
    await goBtn.trigger('click')
    expect(wrapper.emitted('update:page')![0]).toEqual([6])
  })

  it('clears input after jump', async () => {
    const wrapper = mountPagination({ total: 100, perPage: 10, page: 1 })
    const input = wrapper.find('.page-input')
    await input.setValue('5')
    await input.trigger('keyup.enter')
    expect((input.element as HTMLInputElement).value).toBe('')
  })

  it('does not jump to out-of-range page', async () => {
    const wrapper = mountPagination({ total: 100, perPage: 10, page: 1 })
    const input = wrapper.find('.page-input')
    await input.setValue('99')
    await input.trigger('keyup.enter')
    expect(wrapper.emitted('update:page')).toBeFalsy()
  })

  it('does not jump to page < 1', async () => {
    const wrapper = mountPagination({ total: 100, perPage: 10, page: 1 })
    const input = wrapper.find('.page-input')
    await input.setValue('0')
    await input.trigger('keyup.enter')
    expect(wrapper.emitted('update:page')).toBeFalsy()
  })
})
