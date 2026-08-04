import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useSidebarResize } from '../useSidebarResize'

const FILE_CONFIG = {
  storageKey: 'peekview-sidebar-width',
  cssVar: '--sidebar-width',
  defaultPx: 260,
  minPx: 160,
  maxPx: 500,
  side: 'left' as const,
}

const TOC_CONFIG = {
  storageKey: 'peekview-toc-width',
  cssVar: '--toc-width',
  defaultPx: 240,
  minPx: 150,
  maxPx: 400,
  side: 'right' as const,
}

describe('T081 useSidebarResize', () => {
  let handle: HTMLElement
  let contentArea: HTMLElement
  let rafCallbacks: Array<() => void>

  beforeEach(() => {
    localStorage.clear()
    document.documentElement.style.cssText = ''

    handle = document.createElement('div')
    handle.className = 'resize-handle'
    handle.setAttribute('role', 'separator')
    handle.setAttribute('aria-orientation', 'vertical')
    handle.setAttribute('tabindex', '0')
    document.body.appendChild(handle)

    contentArea = document.createElement('div')
    contentArea.className = 'content-area'
    contentArea.style.height = '400px'
    contentArea.style.overflowY = 'auto'
    Object.defineProperty(contentArea, 'scrollHeight', { value: 1000, configurable: true })
    Object.defineProperty(contentArea, 'clientHeight', { value: 400, configurable: true })
    contentArea.scrollTop = 100
    document.body.appendChild(contentArea)

    rafCallbacks = []
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      rafCallbacks.push(() => cb(performance.now()))
      return rafCallbacks.length
    })
    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {})
  })

  afterEach(() => {
    document.documentElement.style.cssText = ''
    document.body.classList.remove('resize-active')
    handle.remove()
    contentArea.remove()
    vi.restoreAllMocks()
  })

  function flushRaf() {
    const cbs = rafCallbacks.splice(0)
    cbs.forEach((cb) => cb())
  }

  function dispatchMouseMove(clientX: number) {
    document.dispatchEvent(new MouseEvent('mousemove', { clientX }))
    flushRaf()
  }

  function dispatchMouseUp() {
    document.dispatchEvent(new MouseEvent('mouseup'))
  }

  describe('BDD-01: drag file-sidebar handle increases width', () => {
    it('test_bdd_01_drag_file_sidebar_increases_width', () => {
      const { startDrag } = useSidebarResize(FILE_CONFIG)

      const startX = 260
      startDrag(new MouseEvent('mousedown', { clientX: startX }))

      dispatchMouseMove(startX + 50)

      const width = document.documentElement.style.getPropertyValue('--sidebar-width')
      expect(width).toBe('310px')

      dispatchMouseUp()
    })
  })

  describe('BDD-02: drag toc-sidebar handle increases width', () => {
    it('test_bdd_02_drag_toc_sidebar_increases_width', () => {
      const { startDrag } = useSidebarResize(TOC_CONFIG)

      const startX = 1000
      startDrag(new MouseEvent('mousedown', { clientX: startX }))

      dispatchMouseMove(startX - 30)

      const width = document.documentElement.style.getPropertyValue('--toc-width')
      expect(width).toBe('270px')

      dispatchMouseUp()
    })
  })

  describe('BDD-03: drag exceeding max width clamps to upper bound', () => {
    it('test_bdd_03_drag_exceeds_max_clamps_to_upper', () => {
      const { startDrag } = useSidebarResize(FILE_CONFIG)

      const startX = 260
      startDrag(new MouseEvent('mousedown', { clientX: startX }))

      dispatchMouseMove(startX + 300)

      const width = document.documentElement.style.getPropertyValue('--sidebar-width')
      expect(width).toBe('500px')

      dispatchMouseUp()
    })
  })

  describe('BDD-04: drag exceeding min width clamps to lower bound', () => {
    it('test_bdd_04_drag_exceeds_min_clamps_to_lower', () => {
      const { startDrag } = useSidebarResize(TOC_CONFIG)

      const startX = 1000
      startDrag(new MouseEvent('mousedown', { clientX: startX }))

      dispatchMouseMove(startX + 200)

      const width = document.documentElement.style.getPropertyValue('--toc-width')
      expect(width).toBe('150px')

      dispatchMouseUp()
    })
  })

  describe('BDD-05: width restored from localStorage on init', () => {
    it('test_bdd_05_width_restored_from_localstorage', () => {
      localStorage.setItem('peekview-sidebar-width', '350')

      const { loadWidth } = useSidebarResize(FILE_CONFIG)
      const width = loadWidth()

      expect(width).toBe(350)

      const cssWidth = document.documentElement.style.getPropertyValue('--sidebar-width')
      expect(cssWidth).toBe('350px')
    })
  })

  describe('BDD-06: invalid localStorage value falls back to default', () => {
    it('test_bdd_06_invalid_localstorage_falls_back_to_default', () => {
      localStorage.setItem('peekview-sidebar-width', 'abc')

      const { loadWidth } = useSidebarResize(FILE_CONFIG)
      const width = loadWidth()

      expect(width).toBe(260)

      const cssWidth = document.documentElement.style.getPropertyValue('--sidebar-width')
      expect(cssWidth).toBe('260px')
    })
  })

  describe('BDD-07: out-of-range localStorage value falls back to default', () => {
    it('test_bdd_07_out_of_range_localstorage_falls_back_to_default', () => {
      localStorage.setItem('peekview-toc-width', '9999')

      const { loadWidth } = useSidebarResize(TOC_CONFIG)
      const width = loadWidth()

      expect(width).toBe(240)

      const cssWidth = document.documentElement.style.getPropertyValue('--toc-width')
      expect(cssWidth).toBe('240px')
    })
  })

  describe('BDD-12: drag disables user-select on body', () => {
    it('test_bdd_12_drag_disables_user_select', () => {
      const { startDrag } = useSidebarResize(FILE_CONFIG)

      expect(document.body.classList.contains('resize-active')).toBe(false)

      startDrag(new MouseEvent('mousedown', { clientX: 260 }))

      expect(document.body.classList.contains('resize-active')).toBe(true)

      dispatchMouseUp()

      expect(document.body.classList.contains('resize-active')).toBe(false)
    })
  })

  describe('BDD-13: drag does not trigger content-area scroll', () => {
    it('test_bdd_13_drag_does_not_trigger_scroll', () => {
      const { startDrag } = useSidebarResize(FILE_CONFIG)

      const initialScrollTop = contentArea.scrollTop
      expect(initialScrollTop).toBe(100)

      startDrag(new MouseEvent('mousedown', { clientX: 260 }))

      dispatchMouseMove(310)
      dispatchMouseUp()

      expect(contentArea.scrollTop).toBe(initialScrollTop)
      expect(document.body.classList.contains('resize-active')).toBe(false)
    })
  })

  describe('BDD-14: double-click resets file-sidebar to default width', () => {
    it('test_bdd_14_double_click_resets_file_sidebar', () => {
      const { startDrag, onDoubleClick } = useSidebarResize(FILE_CONFIG)

      const startX = 260
      startDrag(new MouseEvent('mousedown', { clientX: startX }))
      dispatchMouseMove(startX + 90)
      dispatchMouseUp()

      let width = document.documentElement.style.getPropertyValue('--sidebar-width')
      expect(width).toBe('350px')

      onDoubleClick()

      width = document.documentElement.style.getPropertyValue('--sidebar-width')
      expect(width).toBe('260px')
    })
  })

  describe('BDD-15: double-click resets toc-sidebar to default width', () => {
    it('test_bdd_15_double_click_resets_toc_sidebar', () => {
      const { startDrag, onDoubleClick } = useSidebarResize(TOC_CONFIG)

      const startX = 1000
      startDrag(new MouseEvent('mousedown', { clientX: startX }))
      dispatchMouseMove(startX + 60)
      dispatchMouseUp()

      let width = document.documentElement.style.getPropertyValue('--toc-width')
      expect(width).toBe('180px')

      onDoubleClick()

      width = document.documentElement.style.getPropertyValue('--toc-width')
      expect(width).toBe('240px')
    })
  })

  describe('BDD-16: resize handle keyboard accessible', () => {
    it('test_bdd_16_keyboard_focus_visible', () => {
      const { startDrag } = useSidebarResize(FILE_CONFIG)
      startDrag(new MouseEvent('mousedown', { clientX: 260 }))
      dispatchMouseUp()

      handle.focus()

      expect(document.activeElement).toBe(handle)
      expect(handle.getAttribute('role')).toBe('separator')
      expect(handle.getAttribute('aria-orientation')).toBe('vertical')
      expect(handle.getAttribute('tabindex')).toBe('0')
    })
  })

  describe('cleanup: removes all event listeners', () => {
    it('cleanup_prevents_further_width_changes', () => {
      const { startDrag, cleanup } = useSidebarResize(FILE_CONFIG)

      cleanup()

      startDrag(new MouseEvent('mousedown', { clientX: 260 }))
      dispatchMouseMove(310)
      dispatchMouseUp()

      const width = document.documentElement.style.getPropertyValue('--sidebar-width')
      expect(width).not.toBe('310px')
    })
  })

  describe('saveWidth: persists to localStorage', () => {
    it('saveWidth_writes_clamped_value_to_localstorage', () => {
      const { saveWidth } = useSidebarResize(FILE_CONFIG)

      saveWidth(350)
      expect(localStorage.getItem('peekview-sidebar-width')).toBe('350')

      saveWidth(9999)
      expect(localStorage.getItem('peekview-sidebar-width')).toBe('500')

      saveWidth(10)
      expect(localStorage.getItem('peekview-sidebar-width')).toBe('160')
    })
  })
})
