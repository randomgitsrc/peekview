import { computed, ref } from 'vue'
import { shouldHandleZenShortcut, redirectFocusIfHidden } from '@/utils/zen-shortcut'

const LOCKED_ARIA_TEXT = 'Fullscreen view. Content only.'
const MANUAL_ON_ARIA_TEXT = 'Zen mode on. Press f or Escape to exit.'
const MANUAL_OFF_ARIA_TEXT = 'Zen mode off.'

export function useZenMode(locked: () => boolean = () => false) {
  const manualZen = ref(false)

  const zenMode = computed(() => locked() || manualZen.value)
  const zenAriaText = computed(() => {
    if (locked()) return LOCKED_ARIA_TEXT
    return manualZen.value ? MANUAL_ON_ARIA_TEXT : MANUAL_OFF_ARIA_TEXT
  })

  function handleZenKeydown(event: KeyboardEvent) {
    if (locked()) return
    if (!shouldHandleZenShortcut(event)) return
    if (event.key === 'Escape' && zenMode.value) {
      manualZen.value = false
      event.preventDefault()
      return
    }
    if (event.key === 'f' || event.key === 'F') {
      manualZen.value = !manualZen.value
      if (manualZen.value) {
        redirectFocusIfHidden()
      }
      event.preventDefault()
    }
  }

  return {
    zenMode,
    zenAriaText,
    handleZenKeydown,
  }
}
