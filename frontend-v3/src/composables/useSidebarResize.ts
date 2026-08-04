export interface SidebarResizeConfig {
  storageKey: string
  cssVar: string
  defaultPx: number
  minPx: number
  maxPx: number
  side: 'left' | 'right'
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function setCssVar(cssVar: string, px: number): void {
  document.documentElement.style.setProperty(cssVar, `${px}px`)
}

function readCurrentWidth(config: SidebarResizeConfig): number {
  const stored = document.documentElement.style.getPropertyValue(config.cssVar)
  if (stored) {
    const parsed = parseFloat(stored)
    if (Number.isFinite(parsed)) return parsed
  }
  return config.defaultPx
}

export function useSidebarResize(config: SidebarResizeConfig) {
  let rafId: number | null = null
  let startX = 0
  let startWidth = 0
  let dragging = false
  let cleanedUp = false

  function onMouseMove(e: MouseEvent): void {
    if (!dragging) return
    const delta = e.clientX - startX
    const newWidth = config.side === 'left' ? startWidth + delta : startWidth - delta
    const clamped = clamp(newWidth, config.minPx, config.maxPx)
    if (rafId !== null) cancelAnimationFrame(rafId)
    rafId = requestAnimationFrame(() => {
      setCssVar(config.cssVar, clamped)
    })
  }

  function onMouseUp(): void {
    dragging = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    document.body.classList.remove('resize-active')
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    const finalWidth = readCurrentWidth(config)
    saveWidth(finalWidth)
  }

  function startDrag(event: MouseEvent): void {
    if (cleanedUp) return
    event.preventDefault()
    startX = event.clientX
    startWidth = readCurrentWidth(config)
    dragging = true
    document.body.classList.add('resize-active')
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  function loadWidth(): number {
    const stored = localStorage.getItem(config.storageKey)
    if (stored !== null) {
      const parsed = Number(stored)
      if (Number.isFinite(parsed) && parsed >= config.minPx && parsed <= config.maxPx) {
        setCssVar(config.cssVar, parsed)
        return parsed
      }
    }
    setCssVar(config.cssVar, config.defaultPx)
    return config.defaultPx
  }

  function saveWidth(px: number): void {
    const clamped = clamp(px, config.minPx, config.maxPx)
    localStorage.setItem(config.storageKey, String(clamped))
  }

  function onDoubleClick(): void {
    setCssVar(config.cssVar, config.defaultPx)
    saveWidth(config.defaultPx)
  }

  function cleanup(): void {
    dragging = false
    cleanedUp = true
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    document.body.classList.remove('resize-active')
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  return {
    startDrag,
    loadWidth,
    saveWidth,
    onDoubleClick,
    cleanup,
  }
}
