export function shouldHandleZenShortcut(event: KeyboardEvent): boolean {
  if (event.key !== 'f' && event.key !== 'F' && event.key !== 'Escape') return false
  if (event.key === 'Escape') return true
  const active = document.activeElement
  if (!active) return true
  const tag = active.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return false
  if ((active as HTMLElement).isContentEditable || active.getAttribute('contenteditable') === 'true') return false
  if (active.closest('[role="alertdialog"], .confirm-overlay')) return false
  return true
}

export function redirectFocusIfHidden(): void {
  const active = document.activeElement
  if (active && active.closest('.detail-header, .file-sidebar, .toc-sidebar, .mobile-actions')) {
    const contentArea = document.querySelector('.content-area') as HTMLElement | null
    contentArea?.focus()
  }
}
