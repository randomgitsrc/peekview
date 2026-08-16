import { ref } from 'vue'

export interface ToastAction {
  label: string
  to: string
}

export interface ToastMessage {
  id: number
  message: string
  variant: 'success' | 'warning' | 'error'
  createdAt: number
  action?: ToastAction
}

const messages = ref<ToastMessage[]>([])
let nextId = 0

function show(message: string, variant: ToastMessage['variant'] = 'success', action?: ToastAction): void {
  const id = nextId++
  const toast: ToastMessage = { id, message, variant, createdAt: Date.now(), action }
  messages.value.push(toast)

  // Auto-dismiss after 3 seconds
  setTimeout(() => {
    messages.value = messages.value.filter(t => t.id !== id)
  }, 3000)
}

function remove(id: number): void {
  messages.value = messages.value.filter(t => t.id !== id)
}

function success(message: string): void {
  show(message, 'success')
}

function error(message: string): void {
  show(message, 'error')
}

export function useToast() {
  return { messages, show, success, error, remove }
}