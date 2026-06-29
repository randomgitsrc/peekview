import { ref, onMounted, onUnmounted, watch, type Ref } from 'vue'

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)
  const diffWeek = Math.floor(diffDay / 7)
  const diffMonth = Math.floor(diffDay / 30)
  const diffYear = Math.floor(diffDay / 365)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  if (diffWeek < 5) return `${diffWeek}w ago`
  if (diffMonth < 12) return `${diffMonth}mo ago`
  return `${diffYear}y ago`
}

export function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString()
}

export function useRelativeTime(dateStr: Ref<string | null | undefined>) {
  const relative = ref('')
  const full = ref('')

  function update() {
    if (dateStr.value) {
      relative.value = formatRelativeTime(dateStr.value)
      full.value = formatFullDate(dateStr.value)
    } else {
      relative.value = ''
      full.value = ''
    }
  }

  let timer: ReturnType<typeof setInterval> | null = null

  onMounted(() => {
    update()
    timer = setInterval(update, 60_000)
  })

  onUnmounted(() => {
    if (timer) clearInterval(timer)
  })

  watch(dateStr, update)

  return { relative, full, update }
}
