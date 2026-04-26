import { ref } from 'vue'
import type { ToastType } from '../types'

export interface Toast {
  id: string
  message: string
  type: ToastType
  duration: number
}

const toasts = ref<Toast[]>([])
let idCounter = 0

export function useToasts() {
  function add(options: { message: string; type?: ToastType; duration?: number }) {
    const id = String(++idCounter)
    const toast: Toast = {
      id,
      message: options.message,
      type: options.type || 'info',
      duration: options.duration || 3000,
    }
    toasts.value.push(toast)

    setTimeout(() => {
      remove(id)
    }, toast.duration)

    return id
  }

  function remove(id: string) {
    const index = toasts.value.findIndex(t => t.id === id)
    if (index > -1) {
      toasts.value.splice(index, 1)
    }
  }

  function success(message: string, duration?: number) {
    return add({ message, type: 'success', duration })
  }

  function error(message: string, duration?: number) {
    return add({ message, type: 'error', duration })
  }

  function info(message: string, duration?: number) {
    return add({ message, type: 'info', duration })
  }

  return {
    toasts,
    add,
    remove,
    success,
    error,
    info,
  }
}

// Backward compatibility
export function useToast() {
  const { success, error, info, toasts } = useToasts()
  return {
    success,
    error,
    info,
    toasts,
    show: (options: { message: string; type?: ToastType; duration?: number }) => {
      return useToasts().add(options)
    },
  }
}
