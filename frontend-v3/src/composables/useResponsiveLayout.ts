import { ref, computed, type Ref, type ComputedRef } from 'vue'

export function useResponsiveLayout(): {
  viewportWidth: Ref<number>
  isMobile: ComputedRef<boolean>
  isDesktop: ComputedRef<boolean>
  handleResize: () => void
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

  return {
    viewportWidth,
    isMobile,
    isDesktop,
    handleResize,
  }
}
