import { ref, computed, type Ref, type ComputedRef } from 'vue'

export function useResponsiveLayout(): {
  viewportWidth: Ref<number>
  isMobile: ComputedRef<boolean>
  isDesktop: ComputedRef<boolean>
  metaTagsHidden: Ref<boolean>
  handleResize: () => void
  setupScrollHide: (container: HTMLElement) => () => void
} {
  const viewportWidth = ref(window.innerWidth)
  let resizeTimer = 0

  function handleResize() {
    if (resizeTimer) cancelAnimationFrame(resizeTimer)
    resizeTimer = requestAnimationFrame(() => {
      viewportWidth.value = window.innerWidth
    })
  }

  const isMobile = computed(() => viewportWidth.value <= 640)
  const isDesktop = computed(() => viewportWidth.value > 640)

  const metaTagsHidden = ref(false)

  function setupScrollHide(container: HTMLElement): () => void {
    let lastScrollTop = 0
    const onScroll = () => {
      const current = container.scrollTop
      if (current > lastScrollTop && current > 10) {
        metaTagsHidden.value = true
      } else if (current < lastScrollTop) {
        metaTagsHidden.value = false
      }
      lastScrollTop = current
    }
    container.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      container.removeEventListener('scroll', onScroll)
      if (resizeTimer) cancelAnimationFrame(resizeTimer)
    }
  }

  return {
    viewportWidth,
    isMobile,
    isDesktop,
    metaTagsHidden,
    handleResize,
    setupScrollHide,
  }
}
