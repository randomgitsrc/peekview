export interface ValidationResult {
  ok: boolean
  reason?: string
}

const PLANTUML_TIMEOUT = 5000
const VENDOR_BASE = '/vendor/plantuml'

let _timeoutMs = PLANTUML_TIMEOUT
export function _setTimeout(ms: number) { _timeoutMs = ms }

let loadPromise: Promise<void> | null = null
let renderQueue: Promise<unknown> = Promise.resolve()
let _plantUmlRender: ((lines: string[], targetId: string, options?: any) => void) | null = null

export function _setPlantUmlRender(fn: ((lines: string[], targetId: string, options?: any) => void) | null) {
  _plantUmlRender = fn
}

export function validateSource(code: string): ValidationResult {
  const trimmed = code.trim()
  if (!trimmed) return { ok: false, reason: 'empty source' }

  const startumlCount = (trimmed.match(/^@startuml(\s|$|\()/gm) || []).length
  const endumlCount = (trimmed.match(/^@enduml\s*$/gm) || []).length

  if (startumlCount === 0) return { ok: false, reason: 'missing @startuml' }
  if (endumlCount === 0) return { ok: false, reason: 'missing @enduml' }
  if (startumlCount !== endumlCount) return { ok: false, reason: 'unbalanced @startuml/@enduml' }

  return { ok: true }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(script)
  })
}

export async function ensureLoaded(): Promise<void> {
  if (_plantUmlRender) return
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    await loadScript(`${VENDOR_BASE}/viz-global.js`)
    const mod = await import(/* @vite-ignore */ `${VENDOR_BASE}/plantuml.js`)
    _plantUmlRender = mod.render
  })()

  return loadPromise
}

export async function render(code: string, theme?: 'dark' | 'light'): Promise<string> {
  const previous = renderQueue
  let release!: () => void
  renderQueue = new Promise<void>((r) => { release = r })
  await previous
  try {
    return await doRender(code, theme)
  } finally {
    release()
  }
}

async function doRender(code: string, theme?: 'dark' | 'light'): Promise<string> {
  await ensureLoaded()

  const validation = validateSource(code)
  if (!validation.ok) {
    throw new Error(`PlantUML source invalid: ${validation.reason}`)
  }

  const container = document.createElement('div')
  container.id = `plantuml-render-target-${Date.now()}`
  container.style.position = 'absolute'
  container.style.left = '-9999px'
  container.style.top = '-9999px'
  document.body.appendChild(container)

  try {
    await ensureLoaded()
    const renderFn = _plantUmlRender!
    const lines = code.split(/\r\n|\r|\n/)
    const dark = theme === 'dark'

    const svg = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        observer.disconnect()
        reject(new Error('PlantUML render timeout'))
      }, _timeoutMs)

      const observer = new MutationObserver(() => {
        const svgEl = container.querySelector('svg')
        if (svgEl) {
          observer.disconnect()
          clearTimeout(timeout)
          resolve(svgEl.outerHTML)
        }
      })
      observer.observe(container, { childList: true, subtree: true })

      try {
        renderFn(lines, container.id, { dark })
      } catch (err) {
        observer.disconnect()
        clearTimeout(timeout)
        reject(err)
      }
    })

    return svg
  } finally {
    document.body.removeChild(container)
  }
}
