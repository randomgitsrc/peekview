// 部署位置: frontend-v3/src/composables/__tests__/useResponsiveLayout.boundary.spec.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useResponsiveLayout } from '../useResponsiveLayout'

// T085 BDD-8: 滚动到底端后继续滚动不触发抖动
// setupScrollHide 无边界保护 → 到底端后 metaTagsHidden 仍翻转 → 断言失败（B 类红灯）

describe('T085 BDD-8: setupScrollHide 边界保护', () => {
  let container: HTMLElement
  let cleanup: (() => void) | undefined

  beforeEach(() => {
    container = document.createElement('div')
    container.style.height = '400px'
    container.style.overflowY = 'auto'
    document.body.appendChild(container)

    Object.defineProperty(container, 'scrollHeight', { value: 1000, configurable: true })
    Object.defineProperty(container, 'clientHeight', { value: 400, configurable: true })
  })

  afterEach(() => {
    if (cleanup) {
      cleanup()
      cleanup = undefined
    }
    container.remove()
  })

  describe('BDD-8: 底端边界保护', () => {
    it('test_bdd_8_bottom_boundary_no_meta_tags_flip', () => {
      const { metaTagsHidden, setupScrollHide } = useResponsiveLayout()
      cleanup = setupScrollHide(container)

      container.scrollTop = 100
      container.dispatchEvent(new Event('scroll'))
      expect(metaTagsHidden.value).toBe(true)

      container.scrollTop = 600
      container.dispatchEvent(new Event('scroll'))
      expect(metaTagsHidden.value).toBe(true)

      const stateBeforeBottom = metaTagsHidden.value

      container.scrollTop = 598
      container.dispatchEvent(new Event('scroll'))

      expect(metaTagsHidden.value).toBe(stateBeforeBottom)
    })

    it('test_bdd_8_overscroll_at_bottom_no_flip_to_false', () => {
      const { metaTagsHidden, setupScrollHide } = useResponsiveLayout()
      cleanup = setupScrollHide(container)

      container.scrollTop = 600
      container.dispatchEvent(new Event('scroll'))
      expect(metaTagsHidden.value).toBe(true)

      container.scrollTop = 599
      container.dispatchEvent(new Event('scroll'))
      expect(metaTagsHidden.value).toBe(true)

      container.scrollTop = 598
      container.dispatchEvent(new Event('scroll'))
      expect(metaTagsHidden.value).toBe(true)
    })
  })

  describe('BDD-8: 顶端边界保护', () => {
    it('test_bdd_8_top_boundary_forces_show', () => {
      const { metaTagsHidden, setupScrollHide } = useResponsiveLayout()
      cleanup = setupScrollHide(container)

      container.scrollTop = 100
      container.dispatchEvent(new Event('scroll'))
      expect(metaTagsHidden.value).toBe(true)

      container.scrollTop = 3
      container.dispatchEvent(new Event('scroll'))

      expect(metaTagsHidden.value).toBe(false)
    })

    it('test_bdd_8_top_boundary_zero_forces_show', () => {
      const { metaTagsHidden, setupScrollHide } = useResponsiveLayout()
      cleanup = setupScrollHide(container)

      container.scrollTop = 100
      container.dispatchEvent(new Event('scroll'))
      expect(metaTagsHidden.value).toBe(true)

      container.scrollTop = 0
      container.dispatchEvent(new Event('scroll'))

      expect(metaTagsHidden.value).toBe(false)
    })
  })

  describe('BDD-8: 正常滚动行为不受影响', () => {
    it('test_bdd_8_normal_scroll_down_still_hides', () => {
      const { metaTagsHidden, setupScrollHide } = useResponsiveLayout()
      cleanup = setupScrollHide(container)

      container.scrollTop = 50
      container.dispatchEvent(new Event('scroll'))
      expect(metaTagsHidden.value).toBe(true)
    })

    it('test_bdd_8_normal_scroll_up_still_shows', () => {
      const { metaTagsHidden, setupScrollHide } = useResponsiveLayout()
      cleanup = setupScrollHide(container)

      container.scrollTop = 100
      container.dispatchEvent(new Event('scroll'))
      expect(metaTagsHidden.value).toBe(true)

      container.scrollTop = 80
      container.dispatchEvent(new Event('scroll'))
      expect(metaTagsHidden.value).toBe(false)
    })
  })
})
