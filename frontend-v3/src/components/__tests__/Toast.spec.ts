import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import Toast from '@/components/Toast.vue'
import { useToast } from '@/composables/useToast'

const { messages, show, remove } = useToast()

describe('Toast.vue', () => {
  beforeEach(() => {
    messages.value = []
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('空消息时不渲染 toast 项', () => {
    const wrapper = mount(Toast)
    expect(wrapper.findAll('.toast')).toHaveLength(0)
  })

  it('有消息时渲染正确数量', async () => {
    messages.value = [
      { id: 1, message: 'one', variant: 'success', createdAt: 0 },
      { id: 2, message: 'two', variant: 'error', createdAt: 0 },
      { id: 3, message: 'three', variant: 'warning', createdAt: 0 },
    ]
    await flushPromises()
    const wrapper = mount(Toast)
    await flushPromises()
    expect(wrapper.findAll('.toast')).toHaveLength(3)
  })

  it('消息 variant 映射到正确的 class', async () => {
    messages.value = [
      { id: 1, message: 'ok', variant: 'success', createdAt: 0 },
      { id: 2, message: 'warn', variant: 'warning', createdAt: 0 },
      { id: 3, message: 'err', variant: 'error', createdAt: 0 },
    ]
    await flushPromises()
    const wrapper = mount(Toast)
    await flushPromises()
    const toasts = wrapper.findAll('.toast')
    expect(toasts[0].classes()).toContain('toast--success')
    expect(toasts[1].classes()).toContain('toast--warning')
    expect(toasts[2].classes()).toContain('toast--error')
  })

  it('关闭按钮点击后调用 remove（消息消失）', async () => {
    messages.value = [
      { id: 1, message: 'to remove', variant: 'success', createdAt: 0 },
    ]
    const wrapper = mount(Toast)
    await flushPromises()
    expect(wrapper.findAll('.toast')).toHaveLength(1)

    await wrapper.find('.toast__close').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('.toast')).toHaveLength(0)
  })

  it('message 文本正确显示', async () => {
    messages.value = [
      { id: 1, message: 'hello toast', variant: 'success', createdAt: 0 },
    ]
    const wrapper = mount(Toast)
    await flushPromises()
    expect(wrapper.find('.toast__message').text()).toBe('hello toast')
  })

  it('show() 3 秒后自动消失', async () => {
    vi.useFakeTimers()
    const wrapper = mount(Toast)

    show('auto disappear', 'success')
    await flushPromises()
    expect(wrapper.findAll('.toast')).toHaveLength(1)

    vi.advanceTimersByTime(3000)
    await flushPromises()

    expect(wrapper.findAll('.toast')).toHaveLength(0)
  })
})
