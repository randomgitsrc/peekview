// composables/useToast.ts
import { ref } from 'vue'
import type { ToastMessage, ToastType } from '../types'

const toasts = ref<ToastMessage[]>([])
let idCounter = 0

export function useToast() {
  function show(message: string, type: ToastType = 'info', duration = 3000) {
    const id = String(++idCounter)
    toasts.value.push({ id, type, message, duration })
    if (duration > 0) {
      setTimeout(() => remove(id), duration)
    }
  }

  function remove(id: string) {
    const index = toasts.value.findIndex(t => t.id === id)
    if (index > -1) toasts.value.splice(index, 1)
  }

  return {
    toasts,
    show,
    success: (msg: string) => show(msg, 'success'),
    error: (msg: string) => show(msg, 'error'),
    info: (msg: string) => show(msg, 'info'),
    remove,
  }
}

// For use in setup
export function useToasts() {
  return { toasts }
}
