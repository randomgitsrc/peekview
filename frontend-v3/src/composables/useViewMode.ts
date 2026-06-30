const STORAGE_KEY = 'peekview-view-mode'
const VALID_MODES = ['grid', 'list'] as const
type ViewMode = typeof VALID_MODES[number]

export function loadViewMode(): ViewMode {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored && (VALID_MODES as readonly string[]).includes(stored)) return stored as ViewMode
  return 'grid'
}

export function saveViewMode(mode: ViewMode): void {
  localStorage.setItem(STORAGE_KEY, mode)
}
