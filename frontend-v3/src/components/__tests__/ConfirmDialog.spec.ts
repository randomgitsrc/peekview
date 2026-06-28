/**
 * ConfirmDialog 单元测试
 *
 * 覆盖：
 * - visible 双向绑定（v-model:visible）
 * - title / message / confirmLabel 渲染
 * - variant 样式 class 切换（destructive / primary）
 * - confirm / cancel 事件 emit
 * - overlay 点击触发 cancel
 * - 打开时 cancel 按钮自动 focus
 * - aria 属性（role / aria-labelledby / aria-describedby）
 *
 * 注意：组件用 <Teleport to="body"> 渲染，所有查询走 document.body。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

function mountDialog(props: Record<string, unknown> = {}) {
  return mount(ConfirmDialog, {
    props: {
      title: 'Test Title',
      message: 'Test Message',
      ...props,
    },
  })
}

function q(selector: string): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(selector)
}

function getConfirmBtn(): HTMLElement {
  const btn = q('.confirm__btn:not(.confirm__btn--cancel)')
  if (!btn) throw new Error('confirm button not found')
  return btn
}

describe('ConfirmDialog.vue', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('visible=false 时不渲染对话框', () => {
    mountDialog({ visible: false })
    expect(q('.confirm-dialog')).toBeNull()
    expect(q('.confirm-overlay')).toBeNull()
  })

  it('visible=true 时渲染对话框', async () => {
    mountDialog({ visible: true })
    await flushPromises()
    expect(q('.confirm-dialog')).not.toBeNull()
    expect(q('.confirm-overlay')).not.toBeNull()
  })

  it('title 和 message 正确显示', async () => {
    mountDialog({
      visible: true,
      title: '删除条目',
      message: '确认删除吗？此操作不可撤销。',
    })
    await flushPromises()
    expect(q('.confirm__title')!.textContent).toBe('删除条目')
    expect(q('.confirm__message')!.textContent).toBe('确认删除吗？此操作不可撤销。')
  })

  it('confirmLabel 未传入时默认渲染为空', async () => {
    mountDialog({ visible: true })
    await flushPromises()
    expect(getConfirmBtn().textContent!.trim()).toBe('')
  })

  it('confirmLabel 自定义值正确显示', async () => {
    mountDialog({ visible: true, confirmLabel: 'Delete' })
    await flushPromises()
    expect(getConfirmBtn().textContent!.trim()).toBe('Delete')
  })

  it('variant=destructive 时 confirm 按钮有 confirm__btn--destructive class', async () => {
    mountDialog({ visible: true, variant: 'destructive' })
    await flushPromises()
    expect(getConfirmBtn().classList.contains('confirm__btn--destructive')).toBe(true)
  })

  it('variant=primary 时 confirm 按钮有 confirm__btn--primary class', async () => {
    mountDialog({ visible: true, variant: 'primary' })
    await flushPromises()
    expect(getConfirmBtn().classList.contains('confirm__btn--primary')).toBe(true)
  })

  it('点击 confirm 按钮 emit confirm 事件并关闭对话框', async () => {
    const wrapper = mountDialog({ visible: true, confirmLabel: 'OK' })
    await flushPromises()
    getConfirmBtn().click()
    await flushPromises()
    expect(wrapper.emitted('confirm')).toBeTruthy()
    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })

  it('点击 cancel 按钮 emit cancel 事件并关闭对话框', async () => {
    const wrapper = mountDialog({ visible: true })
    await flushPromises()
    q('.confirm__btn--cancel')!.click()
    await flushPromises()
    expect(wrapper.emitted('cancel')).toBeTruthy()
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('点击 overlay（confirm-overlay）触发 cancel', async () => {
    const wrapper = mountDialog({ visible: true })
    await flushPromises()
    q('.confirm-overlay')!.click()
    await flushPromises()
    expect(wrapper.emitted('cancel')).toBeTruthy()
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('confirm 按钮 click 后 visible 变为 false', async () => {
    const wrapper = mountDialog({ visible: true, confirmLabel: 'OK' })
    await flushPromises()
    getConfirmBtn().click()
    await flushPromises()
    expect(wrapper.emitted('update:visible')?.at(-1)).toEqual([false])
  })

  it('cancel 按钮 click 后 visible 变为 false', async () => {
    const wrapper = mountDialog({ visible: true })
    await flushPromises()
    q('.confirm__btn--cancel')!.click()
    await flushPromises()
    expect(wrapper.emitted('update:visible')?.at(-1)).toEqual([false])
  })

  it('对话框打开时 cancel 按钮自动 focus', async () => {
    const wrapper = mountDialog({ visible: false })
    await flushPromises()
    expect(q('.confirm__btn--cancel')).toBeNull()

    await wrapper.setProps({ visible: true })
    await flushPromises()

    const cancelBtn = q('.confirm__btn--cancel')!
    expect(document.activeElement).toBe(cancelBtn)
  })

  it('对话框有正确的 aria 属性', async () => {
    mountDialog({ visible: true })
    await flushPromises()
    const dialog = q('.confirm-dialog')! as HTMLElement
    expect(dialog.getAttribute('role')).toBe('alertdialog')
    expect(dialog.getAttribute('aria-labelledby')).toBe('confirm-title')
    expect(dialog.getAttribute('aria-describedby')).toBe('confirm-desc')
    expect(q('#confirm-title')).not.toBeNull()
    expect(q('#confirm-desc')).not.toBeNull()
  })
})
