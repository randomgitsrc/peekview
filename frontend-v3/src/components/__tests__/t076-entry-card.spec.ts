import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import EntryCard from '@/components/EntryCard.vue'
import type { Entry } from '@/types'

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: pushMock }) }))

const mockEntry: Entry = {
  id: 1,
  slug: 'my-post',
  summary: 'Hello World',
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

const manyTagEntry: Entry = {
  ...mockEntry,
  id: 2,
  slug: 'many-tags',
  tags: ['vue', 'typescript', 'python', 'go', 'rust'],
}

describe('T076 EntryCard interaction', () => {
  const createWrapper = (props: Record<string, any> = {}) =>
    mount(EntryCard, {
      props: { entry: mockEntry, ...props },
    })

  beforeEach(() => {
    pushMock.mockClear()
  })

  describe('BDD-01: only title shows underline on hover', () => {
    it('card-title is a standalone <a>, decoupled from card-body', () => {
      const wrapper = createWrapper()
      const title = wrapper.find('.card-title')
      expect(title.exists()).toBe(true)
      expect(title.element.tagName.toLowerCase()).toBe('a')
    })

    it('card-body is NOT an anchor (no whole-card link → no whole-card underline)', () => {
      const wrapper = createWrapper()
      const body = wrapper.find('.card-body')
      expect(body.element.tagName.toLowerCase()).toBe('div')
    })
  })

  describe('BDD-02: clicking title navigates to entry detail (SPA)', () => {
    it('card-title is an <a> with href to /{slug}', () => {
      const wrapper = createWrapper()
      const title = wrapper.find('.card-title')
      expect(title.element.tagName.toLowerCase()).toBe('a')
      expect(title.attributes('href')).toBe('/my-post')
    })

    it('clicking title triggers SPA navigation (router.push), not a full reload', async () => {
      const wrapper = createWrapper()
      const title = wrapper.find('.card-title')
      await title.trigger('click')
      expect(pushMock).toHaveBeenCalled()
    })
  })

  describe('BDD-03: clicking username navigates to user page', () => {
    it('meta-username is an <a> with href /users/alice', () => {
      const wrapper = createWrapper()
      const username = wrapper.find('.meta-username')
      expect(username.exists()).toBe(true)
      expect(username.element.tagName.toLowerCase()).toBe('a')
      expect(username.attributes('href')).toBe('/users/alice')
    })

    it('clicking username navigates to /users/alice', async () => {
      const wrapper = createWrapper()
      const username = wrapper.find('.meta-username')
      await username.trigger('click')
      expect(pushMock).toHaveBeenCalledWith('/users/alice')
    })
  })

  describe('BDD-04: right-click title copies entry URL', () => {
    it('card-title exposes a real href containing /{slug} for native copy-link', () => {
      const wrapper = createWrapper()
      const title = wrapper.find('.card-title')
      const href = title.attributes('href') ?? ''
      expect(href).toContain('/my-post')
    })
  })

  describe('BDD-05: right-click username copies user URL', () => {
    it('meta-username exposes a real href containing /users/alice', () => {
      const wrapper = createWrapper()
      const username = wrapper.find('.meta-username')
      const href = username.attributes('href') ?? ''
      expect(href).toContain('/users/alice')
    })
  })

  describe('BDD-06: hovering non-link areas shows no underline', () => {
    it('meta-time is not inside any anchor element', () => {
      const wrapper = createWrapper()
      const time = wrapper.find('.meta-time')
      expect(time.exists()).toBe(true)
      expect((time.element as HTMLElement).closest('a')).toBeNull()
    })

    it('meta-dot is not inside any anchor element', () => {
      const wrapper = createWrapper()
      const dot = wrapper.find('.meta-dot')
      expect(dot.exists()).toBe(true)
      expect((dot.element as HTMLElement).closest('a')).toBeNull()
    })
  })

  describe('BDD-07: clicking a tag navigates to tag filter page', () => {
    it('tag is rendered as an <a> with href /explore?tags=vue', () => {
      const wrapper = createWrapper()
      const tag = wrapper.find('.card-tags .base-tag')
      expect(tag.exists()).toBe(true)
      expect(tag.element.tagName.toLowerCase()).toBe('a')
      expect(tag.attributes('href')).toBe('/explore?tags=vue')
    })

    it('clicking a tag navigates to /explore?tags=vue', async () => {
      const wrapper = createWrapper()
      const tag = wrapper.find('.card-tags .base-tag')
      await tag.trigger('click')
      expect(pushMock).toHaveBeenCalledWith('/explore?tags=vue')
    })
  })

  describe('BDD-08: tag shows underline + pointer cursor on hover', () => {
    it('tag is an anchor (native pointer + underline-on-hover semantics)', () => {
      const wrapper = createWrapper()
      const tag = wrapper.find('.card-tags .base-tag')
      expect(tag.element.tagName.toLowerCase()).toBe('a')
    })
  })

  describe('BDD-09: hovering tag-overflow shows all tags tooltip', () => {
    it('tag-overflow carries data-tags listing all 5 tags', () => {
      const wrapper = createWrapper({ entry: manyTagEntry })
      const overflow = wrapper.find('.tag-overflow')
      expect(overflow.exists()).toBe(true)
      expect(overflow.text()).toBe('+2')
      expect(overflow.attributes('data-tags')).toBe('vue, typescript, python, go, rust')
    })
  })

  describe('BDD-10: mobile tap on tag-overflow triggers tooltip', () => {
    it('tag-overflow is focusable (tabindex=0) so tap triggers :focus tooltip', () => {
      const wrapper = createWrapper({ entry: manyTagEntry })
      const overflow = wrapper.find('.tag-overflow')
      expect(overflow.attributes('tabindex')).toBe('0')
    })
  })

  describe('BDD-20: Tab focuses title/username/tag links', () => {
    it('title, username and tag are all natively focusable <a> elements', () => {
      const wrapper = createWrapper()
      expect(wrapper.find('.card-title').element.tagName.toLowerCase()).toBe('a')
      expect(wrapper.find('.meta-username').element.tagName.toLowerCase()).toBe('a')
      expect(wrapper.find('.card-tags .base-tag').element.tagName.toLowerCase()).toBe('a')
    })
  })

  describe('BDD-21: card hover border highlight preserved', () => {
    it('entry-card root is a container and card-body is a non-link div', () => {
      const wrapper = createWrapper()
      expect(wrapper.find('.entry-card').exists()).toBe(true)
      expect(wrapper.find('.entry-card').element.tagName.toLowerCase()).toBe('div')
      expect(wrapper.find('.card-body').element.tagName.toLowerCase()).toBe('div')
    })
  })
})
