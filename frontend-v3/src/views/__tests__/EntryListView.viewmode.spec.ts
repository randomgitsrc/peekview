import { describe, it, expect, beforeEach } from 'vitest'
import { loadViewMode, saveViewMode } from '../../composables/useViewMode'

describe('viewMode persistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('TC-30: switching to list writes list to localStorage (B07)', () => {
    saveViewMode('list')
    expect(localStorage.getItem('peekview-view-mode')).toBe('list')
  })

  it('TC-31: reading list from localStorage initializes viewMode as list (B08)', () => {
    localStorage.setItem('peekview-view-mode', 'list')
    expect(loadViewMode()).toBe('list')
  })

  it('TC-32: no localStorage value defaults to grid (B09)', () => {
    expect(loadViewMode()).toBe('grid')
  })

  it('TC-33: invalid localStorage value falls back to grid (B10)', () => {
    localStorage.setItem('peekview-view-mode', 'table')
    expect(loadViewMode()).toBe('grid')
  })

  it('TC-34: switching back to grid writes grid to localStorage (B11)', () => {
    localStorage.setItem('peekview-view-mode', 'list')
    saveViewMode('grid')
    expect(localStorage.getItem('peekview-view-mode')).toBe('grid')
  })
})
