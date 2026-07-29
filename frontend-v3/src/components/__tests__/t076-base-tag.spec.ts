import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseTag from '@/components/BaseTag.vue'

describe('T076 BaseTag polymorphic rendering', () => {
  describe('with href prop (clickable tag)', () => {
    it('renders as an <a class="base-tag"> with the given href', () => {
      const wrapper = mount(BaseTag, {
        props: { href: '/explore?tags=python' },
        slots: { default: 'python' },
      })
      expect(wrapper.element.tagName.toLowerCase()).toBe('a')
      expect(wrapper.find('a.base-tag').exists()).toBe(true)
      expect(wrapper.attributes('href')).toBe('/explore?tags=python')
    })

    it('emits navigate with href when clicked (parent does router.push)', async () => {
      const wrapper = mount(BaseTag, {
        props: { href: '/explore?tags=python' },
        slots: { default: 'python' },
      })
      await wrapper.trigger('click')
      expect(wrapper.emitted('navigate')).toBeTruthy()
      expect(wrapper.emitted('navigate')![0]).toEqual(['/explore?tags=python'])
    })
  })

  describe('without href prop (backward compatible)', () => {
    it('renders as a plain <span class="base-tag">', () => {
      const wrapper = mount(BaseTag, { slots: { default: 'vue' } })
      expect(wrapper.element.tagName.toLowerCase()).toBe('span')
      expect(wrapper.find('.base-tag').exists()).toBe(true)
    })
  })
})
