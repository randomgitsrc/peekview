import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import EntryListRow from '@/components/EntryListRow.vue'
import type { Entry } from '@/types'

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: pushMock }) }))

const mockEntry: Entry = {
  id: 1,
  slug: 'list-entry',
  summary: 'A list entry',
  tags: ['k8s'],
  status: 'active',
  files: [],
  fileCount: 3,
  isPublic: true,
  ownerId: 1,
  username: 'bob',
  expiresAt: null,
  archivedAt: null,
  createdAt: '2026-01-01T00:00:00Z',
}

const manyTagEntry: Entry = {
  ...mockEntry,
  id: 2,
  slug: 'list-many-tags',
  tags: ['a', 'b', 'c', 'd', 'e'],
}

describe('T076 EntryListRow interaction', () => {
  const createWrapper = (props: Record<string, any> = {}) =>
    mount(EntryListRow, {
      props: { entry: mockEntry, ...props },
    })

  beforeEach(() => {
    pushMock.mockClear()
  })

  describe('BDD-16: list view title click navigates to detail (SPA)', () => {
    it('entry-title is an <a> with href to /{slug}', () => {
      const wrapper = createWrapper()
      const title = wrapper.find('.entry-title')
      expect(title.exists()).toBe(true)
      expect(title.element.tagName.toLowerCase()).toBe('a')
      expect(title.attributes('href')).toBe('/list-entry')
    })

    it('clicking title triggers SPA navigation', async () => {
      const wrapper = createWrapper()
      await wrapper.find('.entry-title').trigger('click')
      expect(pushMock).toHaveBeenCalled()
    })
  })

  describe('BDD-17: list view tag click navigates to filter page', () => {
    it('tag is an <a> with href /explore?tags=k8s', () => {
      const wrapper = createWrapper()
      const tag = wrapper.find('.entry-tags-row .base-tag')
      expect(tag.exists()).toBe(true)
      expect(tag.element.tagName.toLowerCase()).toBe('a')
      expect(tag.attributes('href')).toBe('/explore?tags=k8s')
    })

    it('clicking tag navigates to /explore?tags=k8s', async () => {
      const wrapper = createWrapper()
      await wrapper.find('.entry-tags-row .base-tag').trigger('click')
      expect(pushMock).toHaveBeenCalledWith('/explore?tags=k8s')
    })

    it('truncates tags to TAG_LIMIT=3 with +N overflow (row height consistency)', () => {
      const wrapper = createWrapper({ entry: manyTagEntry })
      expect(wrapper.findAll('.entry-tags-row .base-tag').length).toBe(3)
      const overflow = wrapper.find('.tag-overflow')
      expect(overflow.exists()).toBe(true)
      expect(overflow.text()).toBe('+2')
    })
  })

  describe('BDD-18: list view username click navigates to user page', () => {
    it('meta-username is an <a> with href /users/bob', () => {
      const wrapper = createWrapper()
      const username = wrapper.find('.meta-username')
      expect(username.exists()).toBe(true)
      expect(username.element.tagName.toLowerCase()).toBe('a')
      expect(username.attributes('href')).toBe('/users/bob')
    })

    it('clicking username navigates to /users/bob', async () => {
      const wrapper = createWrapper()
      await wrapper.find('.meta-username').trigger('click')
      expect(pushMock).toHaveBeenCalledWith('/users/bob')
    })
  })

  describe('BDD-19: list view hover semantics match grid', () => {
    it('row root is a non-link <div> (no whole-row underline)', () => {
      const wrapper = createWrapper()
      const row = wrapper.find('.entry-list-row')
      expect(row.exists()).toBe(true)
      expect(row.element.tagName.toLowerCase()).toBe('div')
    })

    it('meta-time is not inside any anchor element', () => {
      const wrapper = createWrapper()
      const time = wrapper.find('.meta-time')
      expect(time.exists()).toBe(true)
      expect((time.element as HTMLElement).closest('a')).toBeNull()
    })

    it('title, username and tag are anchors (underline on hover)', () => {
      const wrapper = createWrapper()
      expect(wrapper.find('.entry-title').element.tagName.toLowerCase()).toBe('a')
      expect(wrapper.find('.meta-username').element.tagName.toLowerCase()).toBe('a')
      expect(wrapper.find('.entry-tags-row .base-tag').element.tagName.toLowerCase()).toBe('a')
    })
  })
})
