import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import EntryCard from '@/components/EntryCard.vue'
import type { Entry } from '@/types'

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

const routerLinkStub = {
  template: '<a :href="to"><slot /></a>',
  props: ['to'],
}

describe('T031 EntryCard', () => {
  const createWrapper = (props: Record<string, any> = {}) =>
    mount(EntryCard, {
      props: { entry: mockEntry, ...props },
      global: { stubs: { 'router-link': routerLinkStub } },
    })

  describe('BDD-2: native link', () => {
    it('card-body should be an <a> element with href to entry slug', () => {
      const wrapper = createWrapper()
      const cardBody = wrapper.find('.card-body')
      expect(cardBody.exists()).toBe(true)
      expect(cardBody.element.tagName.toLowerCase()).toBe('a')
      expect(cardBody.attributes('href')).toBe('/test-entry')
    })

    it('should NOT have role="button" or tabindex="0"', () => {
      const wrapper = createWrapper()
      const cardBody = wrapper.find('.card-body')
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
    it('username should be a span with role="link", not a router-link or <a>', () => {
      const wrapper = createWrapper()
      const username = wrapper.find('.meta-username')
      expect(username.exists()).toBe(true)
      expect(username.element.tagName.toLowerCase()).toBe('span')
      expect(username.attributes('role')).toBe('link')
    })

    it('card body should be <a> and clicking toggle button should NOT emit navigate', async () => {
      const wrapper = createWrapper({ isOwner: true })
      const cardBody = wrapper.find('.card-body')
      expect(cardBody.element.tagName.toLowerCase()).toBe('a')
      const toggleBtn = wrapper.find('.card-action-btn')
      expect(toggleBtn.exists()).toBe(true)
      await toggleBtn.trigger('click')
      expect(wrapper.emitted('toggleVisibility')).toBeTruthy()
      expect(wrapper.emitted('navigate')).toBeFalsy()
    })

    it('card body should be <a> and clicking delete button should NOT emit navigate', async () => {
      const wrapper = createWrapper({ isOwner: true })
      const cardBody = wrapper.find('.card-body')
      expect(cardBody.element.tagName.toLowerCase()).toBe('a')
      const deleteBtn = wrapper.find('.card-action-btn--danger')
      expect(deleteBtn.exists()).toBe(true)
      await deleteBtn.trigger('click')
      expect(wrapper.emitted('delete')).toBeTruthy()
      expect(wrapper.emitted('navigate')).toBeFalsy()
    })
  })
})
