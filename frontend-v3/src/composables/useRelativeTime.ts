import { ref, onMounted, onUnmounted, watch, type Ref } from 'vue'

const FULL_DATE_OPTIONS = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
} as const

function parseDate(dateStr: string): Date | null {
  const date = new Date(dateStr)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatOffsetDate(date: Date, timeZoneName: 'shortOffset' | 'longOffset'): string {
  return date.toLocaleString(undefined, { ...FULL_DATE_OPTIONS, timeZoneName })
}

export function formatRelativeTime(dateStr: string): string {
  const date = parseDate(dateStr)
  if (!date) return ''

  const diffMs = Date.now() - date.getTime()
  const absSec = Math.floor(Math.abs(diffMs) / 1000)
  if (absSec < 60) return 'just now'

  const absMin = Math.floor(absSec / 60)
  const absHour = Math.floor(absMin / 60)
  const absDay = Math.floor(absHour / 24)
  const absWeek = Math.floor(absDay / 7)
  const absMonth = Math.floor(absDay / 30)
  const absYear = Math.floor(absDay / 365)

  let value: string
  if (absMin < 60) value = `${absMin}m`
  else if (absHour < 24) value = `${absHour}h`
  else if (absDay < 7) value = `${absDay}d`
  else if (absWeek < 5) value = `${absWeek}w`
  else if (absMonth < 12) value = `${absMonth}mo`
  else value = `${absYear}y`

  return diffMs < 0 ? `in ${value}` : `${value} ago`
}

export function formatFullDate(dateStr: string): string {
  const date = parseDate(dateStr)
  if (!date) return '—'
  return formatOffsetDate(date, 'shortOffset')
}

export function formatTooltip(dateStr: string): string {
  const date = parseDate(dateStr)
  if (!date) return 'Invalid date'
  const relative = formatRelativeTime(dateStr)
  const full = formatOffsetDate(date, 'longOffset')
  return `${relative} · ${full} · ${Intl.DateTimeFormat().resolvedOptions().timeZone}`
}

export function useRelativeTime(dateStr: Ref<string | null | undefined>) {
  const relative = ref('')
  const full = ref('')
  const absolute = ref('')

  function update() {
    if (dateStr.value) {
      relative.value = formatRelativeTime(dateStr.value)
      full.value = formatTooltip(dateStr.value)
      absolute.value = formatFullDate(dateStr.value)
    } else {
      relative.value = ''
      full.value = ''
      absolute.value = ''
    }
  }

  update()

  let timer: ReturnType<typeof setInterval> | null = null

  onMounted(() => {
    timer = setInterval(update, 60_000)
  })

  onUnmounted(() => {
    if (timer) clearInterval(timer)
  })

  watch(dateStr, update)

  return { relative, full, absolute, update }
}
