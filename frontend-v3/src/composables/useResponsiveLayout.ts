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
    const findScrollable = (parent: Element): HTMLElement | null => {
      for (const child of parent.children) {
        if (child instanceof HTMLElement) {
          const ov = getComputedStyle(child).overflowY
          if ((ov === 'auto' || ov === 'scroll') && child.scrollHeight > child.clientHeight) {
            return child
          }
        }
      }
      return null
    }

    let scrollContainer: HTMLElement | null = findScrollable(container)
    if (!scrollContainer) {
      scrollContainer = container as HTMLElement
    }
    const onScroll = () => {
      metaTagsHidden.value = (scrollContainer?.scrollTop ?? 0) > 10
    }
    scrollContainer.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      scrollContainer?.removeEventListener('scroll', onScroll)
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
