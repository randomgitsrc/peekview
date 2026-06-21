import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { useThemeStore } from '../../stores/theme'

const STORAGE_KEY = 'peekview-theme'

function makeMatchMedia(matches: boolean) {
  return vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

describe('useThemeStore', () => {
  let setAttributeSpy: any

  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    setAttributeSpy = vi.spyOn(document.documentElement, 'setAttribute')
  })

  afterEach(() => {
    setAttributeSpy.mockRestore()
    vi.unstubAllGlobals()
  })

  describe('TC-01: getInitialTheme — localStorage 优先于 system preference', () => {
    it('localStorage=light 时，即使系统为 dark 仍返回 light', () => {
      vi.stubGlobal('matchMedia', makeMatchMedia(true))
      localStorage.setItem(STORAGE_KEY, 'light')

      const store = useThemeStore()

      expect(store.theme).toBe('light')
    })

    it('localStorage=dark 时，即使系统为 light 仍返回 dark', () => {
      vi.stubGlobal('matchMedia', makeMatchMedia(false))
      localStorage.setItem(STORAGE_KEY, 'dark')

      const store = useThemeStore()

      expect(store.theme).toBe('dark')
    })
  })

  describe('TC-02: getInitialTheme — 无 localStorage 时跟随 system preference', () => {
    it('无 localStorage + 系统 dark → dark', () => {
      vi.stubGlobal('matchMedia', makeMatchMedia(true))

      const store = useThemeStore()

      expect(store.theme).toBe('dark')
    })

    it('无 localStorage + 系统 light → light', () => {
      vi.stubGlobal('matchMedia', makeMatchMedia(false))

      const store = useThemeStore()

      expect(store.theme).toBe('light')
    })

    it('无 localStorage + 无 matchMedia → 默认 light（兜底）', () => {
      vi.stubGlobal('matchMedia', undefined)

      const store = useThemeStore()

      expect(store.theme).toBe('light')
    })
  })

  describe('TC-03: setTheme — 更新 data-theme 属性到 document.documentElement', () => {
    it('setTheme(dark) 调用 setAttribute("data-theme","dark")', () => {
      vi.stubGlobal('matchMedia', makeMatchMedia(false))
      const store = useThemeStore()
      setAttributeSpy.mockClear()

      store.setTheme('dark')

      expect(setAttributeSpy).toHaveBeenCalledWith('data-theme', 'dark')
    })

    it('setTheme(light) 调用 setAttribute("data-theme","light")', () => {
      vi.stubGlobal('matchMedia', makeMatchMedia(true))
      const store = useThemeStore()
      setAttributeSpy.mockClear()

      store.setTheme('light')

      expect(setAttributeSpy).toHaveBeenCalledWith('data-theme', 'light')
    })

    it('store 初始化时也调用 setAttribute 写入初始主题', () => {
      vi.stubGlobal('matchMedia', makeMatchMedia(false))

      const store = useThemeStore()

      expect(setAttributeSpy).toHaveBeenCalledWith('data-theme', store.theme)
    })
  })

  describe('TC-04: setTheme — 持久化到 localStorage', () => {
    it('setTheme(dark) 后 localStorage 持久化为 dark', async () => {
      vi.stubGlobal('matchMedia', makeMatchMedia(false))
      const store = useThemeStore()

      store.setTheme('dark')
      await nextTick()

      expect(localStorage.getItem(STORAGE_KEY)).toBe('dark')
    })

    it('setTheme(light) 后 localStorage 持久化为 light', async () => {
      vi.stubGlobal('matchMedia', makeMatchMedia(true))
      const store = useThemeStore()

      store.setTheme('light')
      await nextTick()

      expect(localStorage.getItem(STORAGE_KEY)).toBe('light')
    })
  })

  describe('TC-05: toggle — light↔dark 切换', () => {
    it('light → dark → light 双向可逆', () => {
      vi.stubGlobal('matchMedia', makeMatchMedia(false))
      const store = useThemeStore()
      expect(store.theme).toBe('light')

      store.toggle()
      expect(store.theme).toBe('dark')

      store.toggle()
      expect(store.theme).toBe('light')
    })

    it('初始 dark 时 toggle → light', () => {
      vi.stubGlobal('matchMedia', makeMatchMedia(true))
      const store = useThemeStore()
      expect(store.theme).toBe('dark')

      store.toggle()
      expect(store.theme).toBe('light')
    })
  })
})
