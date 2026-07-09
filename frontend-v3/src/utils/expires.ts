export function formatExpiresIn(dateStr: string): string {
  const expires = new Date(dateStr)
  const now = new Date()
  const diffMs = expires.getTime() - now.getTime()
  if (diffMs <= 0) return 'expired'
  const diffDay = Math.ceil(diffMs / 86400000)
  if (diffDay <= 1) return `in ${Math.ceil(diffMs / 3600000)}h`
  if (diffDay <= 30) return `in ${diffDay}d`
  if (diffDay <= 365) return `in ${Math.ceil(diffDay / 30)}mo`
  return `in ${Math.ceil(diffDay / 365)}y`
}

export function isExpiringSoon(dateStr: string): boolean {
  const expires = new Date(dateStr)
  const now = new Date()
  const diffMs = expires.getTime() - now.getTime()
  const diffDay = Math.ceil(diffMs / 86400000)
  return diffDay > 0 && diffDay < 3
}

export function isExpired(entry: { status: string; expiresAt: string | null }): boolean {
  if (entry.status !== 'active') return false
  if (!entry.expiresAt) return false
  return new Date(entry.expiresAt).getTime() < Date.now()
}
