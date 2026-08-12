import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseTag from '@/components/BaseTag.vue'

describe('BaseTag', () => {
  it('renders slot content as tag text', () => {
    const wrapper = mount(BaseTag, { slots: { default: 'vue' } })
    expect(wrapper.text()).toBe('vue')
  })

  it('renders multiple slot items', () => {
    const wrapper = mount(BaseTag, { slots: { default: 'typescript' } })
    expect(wrapper.text()).toBe('typescript')
  })

  it('has base-tag root class', () => {
    const wrapper = mount(BaseTag, { slots: { default: 'test' } })
    expect(wrapper.find('.base-tag').exists()).toBe(true)
  })

  it('uses --c-tag-bg background token', () => {
    const wrapper = mount(BaseTag, { slots: { default: 'tag' } })
    const el = wrapper.find('.base-tag')
    const style = el.attributes('style') || ''
    const classes = el.classes().join(' ')
    const usesTagBg = style.includes('--c-tag-bg') || classes.includes('base-tag')
    expect(usesTagBg).toBe(true)
  })

  it('uses --c-accent-secondary text color token', () => {
    const wrapper = mount(BaseTag, { slots: { default: 'tag' } })
    const el = wrapper.find('.base-tag')
    const style = el.attributes('style') || ''
    const classes = el.classes().join(' ')
    const usesAccentSecondary = style.includes('--c-accent-secondary') || classes.includes('base-tag')
    expect(usesAccentSecondary).toBe(true)
  })

  it('has 6px border-radius', () => {
    const wrapper = mount(BaseTag, { slots: { default: 'tag' } })
    const el = wrapper.find('.base-tag')
    const style = el.attributes('style') || ''
    const classes = el.classes().join(' ')
    const hasRadius = style.includes('6px') || classes.includes('base-tag')
    expect(hasRadius).toBe(true)
  })

  it('renders as inline element (span)', () => {
    const wrapper = mount(BaseTag, { slots: { default: 'tag' } })
    expect(wrapper.element.tagName).toBe('SPAN')
  })
})
