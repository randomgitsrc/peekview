/**
 * TPV0093 star-lifecycle — P3 TDD 红灯测试（frontend）
 *
 * 覆盖 P2 §7 design-3（useToast action 扩展）：
 * - useToast.show 支持可选 action { label, to }——重复星标 Toast 的"查看星标"跳转入口
 * - action 缺省不渲染（既有 Toast 调用零回归）
 *
 * 被测：src/composables/useToast.ts + src/components/Toast.vue（已存在，P4 加 action）
 * P2-design §6.1：Toast action「查看星标」→ 跳转 /explore?starred=1（data-testid="star-toast-action"）。
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { useToast } from '@/composables/useToast'
import Toast from '@/components/Toast.vue'

describe('useToast — design-3: action 扩展（重复星标跳转入口）', () => {
  beforeEach(() => {
    useToast().messages.value = []
  })

  it('TC-TOAST-01: show 支持 action 参数，toast 消息携带 { label, to }', () => {
    const toast = useToast()
    toast.show('已于 2026 年 8 月 1 日星标', 'warning', { label: '查看星标', to: '/explore?starred=1' })

    const last = toast.messages.value[toast.messages.value.length - 1]
    expect(last.action).toEqual({ label: '查看星标', to: '/explore?starred=1' })
  })

  it('TC-TOAST-02: 不带 action 的既有调用不受影响（action undefined）', () => {
    const toast = useToast()
    toast.show('Entry deleted', 'success')

    const last = toast.messages.value[toast.messages.value.length - 1]
    expect(last.action).toBeUndefined()
  })

  it('TC-TOAST-03: Toast.vue 对带 action 的消息渲染 action 按钮（star-toast-action）', async () => {
    const toast = useToast()
    toast.show('已于 2026 年 8 月 1 日星标', 'warning', { label: '查看星标', to: '/explore?starred=1' })

    const wrapper = mount(Toast)
    const action = wrapper.find('[data-testid="star-toast-action"]')
    expect(action.exists()).toBe(true)
    expect(action.text()).toBe('查看星标')
  })

  it('TC-TOAST-04: Toast.vue 对无 action 的消息不渲染 action 按钮（零回归）', () => {
    const toast = useToast()
    toast.show('Entry deleted', 'success')

    const wrapper = mount(Toast)
    expect(wrapper.find('[data-testid="star-toast-action"]').exists()).toBe(false)
  })
})
