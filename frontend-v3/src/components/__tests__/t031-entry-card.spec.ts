import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import EntryCard from '@/components/EntryCard.vue'
import type { Entry } from '@/types'

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: pushMock }) }))

const mockEntry: Entry = {
  id: 1,
  slug: 'test-entry',
  summary: 'A test entry',
  tags: ['vue'],
  status: 'active',
  files: [{ id: 10, path: null, filename: 'main.py', language: 'python', isBinary: false, size: 100, lineCount: 10 }],
  fileCount: 2,
  isPublic: true,
  ownerId: 1,
  username: 'alice',
  expiresAt: null,
  archivedAt: null,
  createdAt: '2026-01-01T00:00:00Z',
}

describe('T031 EntryCard', () => {
  const createWrapper = (props: Record<string, any> = {}) =>
    mount(EntryCard, {
      props: { entry: mockEntry, ...props },
    })

  beforeEach(() => {
    pushMock.mockClear()
  })

  describe('BDD-2: native link', () => {
    it('card-title should be an <a> element with href to entry slug', () => {
      const wrapper = createWrapper()
      const title = wrapper.find('.card-title')
      expect(title.exists()).toBe(true)
      expect(title.element.tagName.toLowerCase()).toBe('a')
      expect(title.attributes('href')).toBe('/test-entry')
    })

    it('card-body should be a <div> (not a link)', () => {
      const wrapper = createWrapper()
      const cardBody = wrapper.find('.card-body')
      expect(cardBody.element.tagName.toLowerCase()).toBe('div')
      expect(cardBody.attributes('role')).not.toBe('button')
      expect(cardBody.attributes('tabindex')).toBeUndefined()
    })
  })

  describe('BDD-3: separator font', () => {
    it('meta-sep should have UI font-family (not inherit mono)', () => {
      const wrapper = createWrapper()
      const sep = wrapper.find('.meta-sep')
      expect(sep.exists()).toBe(true)
      const style = window.getComputedStyle(sep.element)
      const fontFamily = sep.element.getAttribute('style') || ''
      const classes = sep.classes()
      const hasUiFont = fontFamily.includes('Inter') || fontFamily.includes('sans-serif') ||
        classes.some(c => c.includes('ui-font'))
      const computedFont = style.fontFamily || ''
      const hasUiFontComputed = computedFont.includes('Inter') || computedFont.includes('sans-serif')
      expect(hasUiFont || hasUiFontComputed).toBe(true)
    })
  })

  describe('BDD-7: nested interactive elements', () => {
    it('username should be an <a> with href to user page', () => {
      const wrapper = createWrapper()
      const username = wrapper.find('.meta-username')
      expect(username.exists()).toBe(true)
      expect(username.element.tagName.toLowerCase()).toBe('a')
      expect(username.attributes('href')).toBe('/users/alice')
    })

    it('clicking toggle button should NOT trigger navigation', async () => {
      const wrapper = createWrapper({ isOwner: true })
      const toggleBtn = wrapper.find('.card-action-btn')
      expect(toggleBtn.exists()).toBe(true)
      await toggleBtn.trigger('click')
      expect(wrapper.emitted('toggleVisibility')).toBeTruthy()
      expect(pushMock).not.toHaveBeenCalled()
    })

    it('clicking delete button should NOT trigger navigation', async () => {
      const wrapper = createWrapper({ isOwner: true })
      const deleteBtn = wrapper.find('.card-action-btn--danger')
      expect(deleteBtn.exists()).toBe(true)
      await deleteBtn.trigger('click')
      expect(wrapper.emitted('delete')).toBeTruthy()
      expect(pushMock).not.toHaveBeenCalled()
    })
  })
})
