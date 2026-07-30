import { ref } from 'vue'
import { shouldHandleZenShortcut, redirectFocusIfHidden } from '@/utils/zen-shortcut'

export function useZenMode() {
  const zenMode = ref(false)
  const zenAriaText = ref('')

  function updateZenAria(zen: boolean) {
    zenAriaText.value = zen ? 'Zen mode on. Press f or Escape to exit.' : 'Zen mode off.'
  }

  function handleZenKeydown(event: KeyboardEvent) {
    if (!shouldHandleZenShortcut(event)) return
    if (event.key === 'Escape' && zenMode.value) {
      zenMode.value = false
      updateZenAria(false)
      event.preventDefault()
      return
    }
    if (event.key === 'f' || event.key === 'F') {
      zenMode.value = !zenMode.value
      if (zenMode.value) {
        redirectFocusIfHidden()
      }
      updateZenAria(zenMode.value)
      event.preventDefault()
    }
  }

  return {
    zenMode,
    zenAriaText,
    handleZenKeydown,
    updateZenAria,
  }
}
