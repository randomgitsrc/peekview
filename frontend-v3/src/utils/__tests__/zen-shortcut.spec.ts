import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shouldHandleZenShortcut, redirectFocusIfHidden } from '../zen-shortcut'

interface KeyboardEventInit {
  key: string
  ctrlKey?: boolean
  metaKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
}

function makeKeyboardEvent(key: string, init?: Partial<KeyboardEventInit>): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    ctrlKey: init?.ctrlKey ?? false,
    metaKey: init?.metaKey ?? false,
    altKey: init?.altKey ?? false,
    shiftKey: init?.shiftKey ?? false,
  })
}

describe('shouldHandleZenShortcut', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('TC-01: f key + body focus → true', () => {
    const event = makeKeyboardEvent('f')
    expect(shouldHandleZenShortcut(event)).toBe(true)
  })

  it('TC-02: F key (uppercase) + body focus → true', () => {
    const event = makeKeyboardEvent('F')
    expect(shouldHandleZenShortcut(event)).toBe(true)
  })

  it('TC-03: f key + input focus → false', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    const event = makeKeyboardEvent('f')
    expect(shouldHandleZenShortcut(event)).toBe(false)
  })

  it('TC-04: f key + textarea focus → false', () => {
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    textarea.focus()
    const event = makeKeyboardEvent('f')
    expect(shouldHandleZenShortcut(event)).toBe(false)
  })

  it('TC-05: f key + contenteditable=true attribute → false', () => {
    const div = document.createElement('div')
    div.setAttribute('contenteditable', 'true')
    document.body.appendChild(div)
    div.focus()
    const event = makeKeyboardEvent('f')
    expect(shouldHandleZenShortcut(event)).toBe(false)
  })

  it('TC-06: f key + isContentEditable=true → false', () => {
    const div = document.createElement('div')
    div.tabIndex = 0
    Object.defineProperty(div, 'isContentEditable', { value: true, configurable: true })
    document.body.appendChild(div)
    div.focus()
    expect(document.activeElement).toBe(div)
    const event = makeKeyboardEvent('f')
    expect(shouldHandleZenShortcut(event)).toBe(false)
  })

  it('TC-07: f key + button focus → true', () => {
    const button = document.createElement('button')
    document.body.appendChild(button)
    button.focus()
    const event = makeKeyboardEvent('f')
    expect(shouldHandleZenShortcut(event)).toBe(true)
  })

  it('TC-08: f key + element inside [role="alertdialog"] → false', () => {
    const overlay = document.createElement('div')
    overlay.setAttribute('role', 'alertdialog')
    const button = document.createElement('button')
    overlay.appendChild(button)
    document.body.appendChild(overlay)
    button.focus()
    const event = makeKeyboardEvent('f')
    expect(shouldHandleZenShortcut(event)).toBe(false)
  })

  it('TC-09: f key + element inside .confirm-overlay → false', () => {
    const overlay = document.createElement('div')
    overlay.className = 'confirm-overlay'
    const button = document.createElement('button')
    overlay.appendChild(button)
    document.body.appendChild(overlay)
    button.focus()
    const event = makeKeyboardEvent('f')
    expect(shouldHandleZenShortcut(event)).toBe(false)
  })

  it('TC-10: Escape key + input focus → true', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    const event = makeKeyboardEvent('Escape')
    expect(shouldHandleZenShortcut(event)).toBe(true)
  })

  it('TC-11: Escape key + body focus → true', () => {
    const event = makeKeyboardEvent('Escape')
    expect(shouldHandleZenShortcut(event)).toBe(true)
  })

  it('TC-12: other key (a) + body focus → false', () => {
    const event = makeKeyboardEvent('a')
    expect(shouldHandleZenShortcut(event)).toBe(false)
  })

  it('TC-13: Enter key + body focus → false', () => {
    const event = makeKeyboardEvent('Enter')
    expect(shouldHandleZenShortcut(event)).toBe(false)
  })

  it('TC-14: f key + activeElement=null → true', () => {
    const spy = vi.spyOn(document, 'activeElement', 'get').mockReturnValue(null)
    const event = makeKeyboardEvent('f')
    expect(shouldHandleZenShortcut(event)).toBe(true)
    spy.mockRestore()
  })

  it('TC-15: Ctrl+F does not trigger zen mode (B01)', () => {
    const event = makeKeyboardEvent('f', { ctrlKey: true })
    expect(shouldHandleZenShortcut(event)).toBe(false)
  })

  it('TC-16: Cmd+F (macOS) does not trigger zen mode (B01)', () => {
    const event = makeKeyboardEvent('f', { metaKey: true })
    expect(shouldHandleZenShortcut(event)).toBe(false)
  })

  it('TC-17: plain F key still triggers zen mode (B02)', () => {
    const event = makeKeyboardEvent('f')
    expect(shouldHandleZenShortcut(event)).toBe(true)
  })

  it('TC-18: Ctrl+Shift+F does not trigger zen mode (B03)', () => {
    const event = makeKeyboardEvent('f', { ctrlKey: true, shiftKey: true })
    expect(shouldHandleZenShortcut(event)).toBe(false)
  })

  it('TC-19: Alt+F does not trigger zen mode (B04)', () => {
    const event = makeKeyboardEvent('f', { altKey: true })
    expect(shouldHandleZenShortcut(event)).toBe(false)
  })

  it('TC-20: Escape with Ctrl still triggers zen mode (B05)', () => {
    const event = makeKeyboardEvent('Escape', { ctrlKey: true })
    expect(shouldHandleZenShortcut(event)).toBe(true)
  })

  it('TC-21: Escape with Alt still triggers zen mode (B05)', () => {
    const event = makeKeyboardEvent('Escape', { altKey: true })
    expect(shouldHandleZenShortcut(event)).toBe(true)
  })

  it('TC-22: F key + input focus still does not trigger (B06)', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    const event = makeKeyboardEvent('f')
    expect(shouldHandleZenShortcut(event)).toBe(false)
  })
})

describe('redirectFocusIfHidden', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('TC-20: focus in .detail-header → redirect to .content-area', () => {
    const header = document.createElement('header')
    header.className = 'detail-header'
    const button = document.createElement('button')
    header.appendChild(button)
    const contentArea = document.createElement('main')
    contentArea.className = 'content-area'
    contentArea.tabIndex = -1
    document.body.appendChild(header)
    document.body.appendChild(contentArea)
    button.focus()
    redirectFocusIfHidden()
    expect(document.activeElement).toBe(contentArea)
  })

  it('TC-21: focus in .file-sidebar → redirect to .content-area', () => {
    const sidebar = document.createElement('aside')
    sidebar.className = 'file-sidebar'
    const link = document.createElement('a')
    link.href = '#'
    sidebar.appendChild(link)
    const contentArea = document.createElement('main')
    contentArea.className = 'content-area'
    contentArea.tabIndex = -1
    document.body.appendChild(sidebar)
    document.body.appendChild(contentArea)
    link.focus()
    redirectFocusIfHidden()
    expect(document.activeElement).toBe(contentArea)
  })

  it('TC-22: focus in .content-area → no redirect', () => {
    const contentArea = document.createElement('main')
    contentArea.className = 'content-area'
    contentArea.tabIndex = -1
    const inner = document.createElement('div')
    inner.tabIndex = 0
    contentArea.appendChild(inner)
    document.body.appendChild(contentArea)
    inner.focus()
    const before = document.activeElement
    redirectFocusIfHidden()
    expect(document.activeElement).toBe(before)
  })

  it('TC-23: focus on body → no redirect', () => {
    const contentArea = document.createElement('main')
    contentArea.className = 'content-area'
    contentArea.tabIndex = -1
    document.body.appendChild(contentArea)
    document.body.focus()
    const before = document.activeElement
    redirectFocusIfHidden()
    expect(document.activeElement).toBe(before)
  })
})
