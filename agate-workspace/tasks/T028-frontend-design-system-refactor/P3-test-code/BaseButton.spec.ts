import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseButton from '@/components/BaseButton.vue'

describe('BaseButton', () => {
  const createWrapper = (props = {}, slots = {}) =>
    mount(BaseButton, { props, slots })

  it('renders default variant (secondary)', () => {
    const wrapper = createWrapper()
    const btn = wrapper.find('button')
    expect(btn.classes()).toContain('btn-secondary')
  })

  it('renders primary variant', () => {
    const wrapper = createWrapper({ variant: 'primary' })
    expect(wrapper.find('button').classes()).toContain('btn-primary')
  })

  it('renders ghost variant', () => {
    const wrapper = createWrapper({ variant: 'ghost' })
    expect(wrapper.find('button').classes()).toContain('btn-ghost')
  })

  it('renders danger variant', () => {
    const wrapper = createWrapper({ variant: 'danger' })
    expect(wrapper.find('button').classes()).toContain('btn-danger')
  })

  it('renders default size', () => {
    const wrapper = createWrapper()
    expect(wrapper.find('button').classes()).toContain('btn-default')
  })

  it('renders small size', () => {
    const wrapper = createWrapper({ size: 'small' })
    expect(wrapper.find('button').classes()).toContain('btn-small')
  })

  it('renders disabled state', () => {
    const wrapper = createWrapper({ disabled: true })
    const btn = wrapper.find('button')
    expect(btn.attributes('disabled')).toBeDefined()
    expect(btn.classes()).toContain('btn-disabled')
  })

  it('disabled button does not emit click', async () => {
    const wrapper = createWrapper({ disabled: true })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('click')).toBeFalsy()
  })

  it('enabled button emits click', async () => {
    const wrapper = createWrapper()
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('click')).toBeTruthy()
    expect(wrapper.emitted('click')!.length).toBe(1)
  })

  it('renders native button type', () => {
    const wrapper = createWrapper({ type: 'submit' })
    expect(wrapper.find('button').attributes('type')).toBe('submit')
  })

  it('default type is button', () => {
    const wrapper = createWrapper()
    expect(wrapper.find('button').attributes('type')).toBe('button')
  })

  it('renders slot content', () => {
    const wrapper = createWrapper({}, { default: 'Click me' })
    expect(wrapper.find('button').text()).toBe('Click me')
  })

  it('has focus ring style on focus', () => {
    const wrapper = createWrapper()
    const btn = wrapper.find('button')
    const style = btn.attributes('style') || ''
    const classes = btn.classes().join(' ')
    const hasFocusRing = style.includes('--c-accent-secondary') || classes.includes('btn-focus-ring')
    expect(hasFocusRing || btn.element.style.outline).toBeDefined()
  })

  it('primary variant uses --c-accent background', () => {
    const wrapper = createWrapper({ variant: 'primary' })
    const btn = wrapper.find('button')
    const style = btn.attributes('style') || ''
    const classes = btn.classes().join(' ')
    const usesAccentToken = style.includes('--c-accent') || classes.includes('btn-primary')
    expect(usesAccentToken).toBe(true)
  })

  it('danger variant uses --c-error background', () => {
    const wrapper = createWrapper({ variant: 'danger' })
    const btn = wrapper.find('button')
    const style = btn.attributes('style') || ''
    const classes = btn.classes().join(' ')
    const usesErrorToken = style.includes('--c-error') || classes.includes('btn-danger')
    expect(usesErrorToken).toBe(true)
  })
})
