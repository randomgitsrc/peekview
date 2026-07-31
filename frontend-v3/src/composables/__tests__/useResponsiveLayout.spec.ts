import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useResponsiveLayout } from '../useResponsiveLayout'

describe('T084 useResponsiveLayout.setupScrollHide', () => {
  let container: HTMLElement
  let scrollableChild: HTMLElement
  let cleanup: (() => void) | undefined

  beforeEach(() => {
    container = document.createElement('div')
    container.style.height = '400px'
    container.style.overflowY = 'auto'
    document.body.appendChild(container)

    scrollableChild = document.createElement('div')
    scrollableChild.style.height = '100%'
    scrollableChild.style.overflowY = 'auto'
    Object.defineProperty(scrollableChild, 'scrollHeight', { value: 1000, configurable: true })
    Object.defineProperty(scrollableChild, 'clientHeight', { value: 400, configurable: true })
    container.appendChild(scrollableChild)
  })

  afterEach(() => {
    if (cleanup) {
      cleanup()
      cleanup = undefined
    }
    container.remove()
  })

  describe('BDD-04: scroll down hides meta-tags-bar', () => {
    it('test_bdd_04_scroll_down_hides_meta_tags', () => {
      const { metaTagsHidden, setupScrollHide } = useResponsiveLayout()

      expect(metaTagsHidden.value).toBe(false)

      cleanup = setupScrollHide(container)

      container.scrollTop = 50
      container.dispatchEvent(new Event('scroll'))

      expect(metaTagsHidden.value).toBe(true)
    })
  })

  describe('BDD-05: scroll up restores meta-tags-bar', () => {
    it('test_bdd_05_scroll_up_restores_meta_tags', () => {
      const { metaTagsHidden, setupScrollHide } = useResponsiveLayout()

      cleanup = setupScrollHide(container)

      container.scrollTop = 50
      container.dispatchEvent(new Event('scroll'))
      expect(metaTagsHidden.value).toBe(true)

      container.scrollTop = 20
      container.dispatchEvent(new Event('scroll'))

      expect(metaTagsHidden.value).toBe(false)
    })
  })

  describe('BDD-06: scroll-hide listens to container directly (not findScrollable)', () => {
    it('test_bdd_06_scroll_hide_listens_to_container_not_child', () => {
      const { metaTagsHidden, setupScrollHide } = useResponsiveLayout()

      expect(metaTagsHidden.value).toBe(false)

      cleanup = setupScrollHide(container)

      scrollableChild.scrollTop = 100
      scrollableChild.dispatchEvent(new Event('scroll'))

      expect(metaTagsHidden.value).toBe(false)

      container.scrollTop = 50
      container.dispatchEvent(new Event('scroll'))

      expect(metaTagsHidden.value).toBe(true)
    })

    it('cleanup removes the scroll listener from container', () => {
      const { metaTagsHidden, setupScrollHide } = useResponsiveLayout()

      cleanup = setupScrollHide(container)
      const removeSpy = vi.spyOn(container, 'removeEventListener')

      cleanup()
      cleanup = undefined

      expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function))

      container.scrollTop = 100
      container.dispatchEvent(new Event('scroll'))

      expect(metaTagsHidden.value).toBe(false)
    })
  })
})
