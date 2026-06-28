import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import TocNav from '@/components/TocNav.vue'
import type { TocHeading } from '@/types'

function makeHeading(overrides: Partial<TocHeading> = {}): TocHeading {
  return { level: 2, text: 'Test Heading', id: 'test-heading', ...overrides }
}

describe('TocNav', () => {
  it('renders nothing when headings is empty', () => {
    const wrapper = mount(TocNav, {
      props: { headings: [], activeId: null },
    })
    expect(wrapper.find('nav').exists()).toBe(false)
  })

  it('renders heading text', () => {
    const headings = [
      makeHeading({ text: 'Introduction', id: 'intro' }),
      makeHeading({ text: 'Getting Started', id: 'getting-started' }),
    ]
    const wrapper = mount(TocNav, {
      props: { headings, activeId: null },
    })
    const links = wrapper.findAll('a')
    expect(links).toHaveLength(2)
    expect(links[0].text()).toBe('Introduction')
    expect(links[1].text()).toBe('Getting Started')
  })

  it('generates correct href anchors', () => {
    const headings = [
      makeHeading({ text: 'Foo', id: 'foo-bar' }),
    ]
    const wrapper = mount(TocNav, {
      props: { headings, activeId: null },
    })
    const link = wrapper.find('a')
    expect(link.attributes('href')).toBe('#foo-bar')
  })

  it('applies level class to toc items', () => {
    const headings = [
      makeHeading({ level: 2, id: 'h2' }),
      makeHeading({ level: 3, id: 'h3' }),
      makeHeading({ level: 4, id: 'h4' }),
    ]
    const wrapper = mount(TocNav, {
      props: { headings, activeId: null },
    })
    const items = wrapper.findAll('li')
    expect(items[0].classes()).toContain('toc-level-2')
    expect(items[1].classes()).toContain('toc-level-3')
    expect(items[2].classes()).toContain('toc-level-4')
  })

  it('highlights active heading', () => {
    const headings = [
      makeHeading({ id: 'a' }),
      makeHeading({ id: 'b' }),
    ]
    const wrapper = mount(TocNav, {
      props: { headings, activeId: 'b' },
    })
    const items = wrapper.findAll('li')
    expect(items[0].classes()).not.toContain('active')
    expect(items[1].classes()).toContain('active')
  })

  it('no item is active when activeId does not match', () => {
    const headings = [makeHeading({ id: 'a' })]
    const wrapper = mount(TocNav, {
      props: { headings, activeId: 'nonexistent' },
    })
    expect(wrapper.find('.active').exists()).toBe(false)
  })

  it('no item is active when activeId is null', () => {
    const headings = [makeHeading({ id: 'a' })]
    const wrapper = mount(TocNav, {
      props: { headings, activeId: null },
    })
    expect(wrapper.find('.active').exists()).toBe(false)
  })

  describe('scrollTo on click', () => {
    let scrollIntoViewMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
      scrollIntoViewMock = vi.fn()
      Element.prototype.scrollIntoView = scrollIntoViewMock
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('calls scrollIntoView on the target element', async () => {
      const div = document.createElement('div')
      div.id = 'target-id'
      document.body.appendChild(div)

      const headings = [makeHeading({ id: 'target-id' })]
      const wrapper = mount(TocNav, {
        props: { headings, activeId: null },
      })

      await wrapper.find('a').trigger('click')

      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'start',
      })
      expect(scrollIntoViewMock.mock.instances[0]).toBe(div)

      document.body.removeChild(div)
    })

    it('does not throw when target element does not exist', async () => {
      const headings = [makeHeading({ id: 'missing-id' })]
      const wrapper = mount(TocNav, {
        props: { headings, activeId: null },
      })

      await expect(wrapper.find('a').trigger('click')).resolves.toBeUndefined()
      // scrollIntoView on prototype is never called because getElementById returns null
      expect(scrollIntoViewMock).not.toHaveBeenCalled()
    })
  })

  it('renders the "On this page" title', () => {
    const wrapper = mount(TocNav, {
      props: { headings: [makeHeading()], activeId: null },
    })
    expect(wrapper.find('.toc-title').text()).toBe('On this page')
  })
})
