import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ImageViewer from '@/components/ImageViewer.vue'

const mocks = vi.hoisted(() => ({
  mockGetFileAsBase64: vi.fn(),
  mockGuessMimeType: vi.fn(),
}))

vi.mock('@/api/client', () => ({
  api: {
    getFileAsBase64: mocks.mockGetFileAsBase64,
  },
}))

vi.mock('@/utils/mime', () => ({
  guessMimeType: mocks.mockGuessMimeType,
}))

const DEFAULT_PROPS = { filename: 'test.png', slug: 'my-entry', fileId: 1 }

function shortBase64(): string {
  return 'a'.repeat(100)
}

function makeBase64(size: number): string {
  return 'A'.repeat(Math.ceil(size * 4 / 3))
}

describe('ImageViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.mockGuessMimeType.mockReturnValue('image/png')
  })

  it('shows loading state on mount', async () => {
    mocks.mockGetFileAsBase64.mockReturnValue(new Promise(() => {}))
    const wrapper = mount(ImageViewer, { props: DEFAULT_PROPS })
    await flushPromises()
    expect(wrapper.find('[data-testid="image-loading"]').exists()).toBe(true)
  })

  it('shows image on successful load', async () => {
    mocks.mockGetFileAsBase64.mockResolvedValue(shortBase64())
    const wrapper = mount(ImageViewer, { props: DEFAULT_PROPS })
    await flushPromises()

    const img = wrapper.find('[data-testid="image-content"]')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toContain('data:image/png;base64,')

    await img.trigger('load')
    expect(wrapper.find('[data-testid="image-loading"]').exists()).toBe(false)
  })

  it('shows error on API failure', async () => {
    mocks.mockGetFileAsBase64.mockRejectedValue(new Error('Network error'))
    const wrapper = mount(ImageViewer, { props: DEFAULT_PROPS })
    await flushPromises()

    expect(wrapper.find('[data-testid="image-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="image-content"]').exists()).toBe(false)
  })

  it('shows error when mime type is unknown', async () => {
    mocks.mockGuessMimeType.mockReturnValue(null)
    const wrapper = mount(ImageViewer, { props: DEFAULT_PROPS })
    await flushPromises()

    expect(wrapper.find('[data-testid="image-error"]').exists()).toBe(true)
    expect(mocks.mockGetFileAsBase64).not.toHaveBeenCalled()
  })

  it('shows size warning for 5-10MB files', async () => {
    const base64 = makeBase64(6 * 1024 * 1024)
    mocks.mockGetFileAsBase64.mockResolvedValue(base64)
    const wrapper = mount(ImageViewer, { props: DEFAULT_PROPS })
    await flushPromises()

    expect(wrapper.find('[data-testid="size-warning"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="image-content"]').exists()).toBe(true)
  })

  it('shows manual render button for >10MB files', async () => {
    const base64 = makeBase64(11 * 1024 * 1024)
    mocks.mockGetFileAsBase64.mockResolvedValue(base64)
    const wrapper = mount(ImageViewer, { props: DEFAULT_PROPS })
    await flushPromises()

    expect(wrapper.find('[data-testid="manual-render-btn"]').exists()).toBe(true)
    // Note: image also loads on mount for >10MB (manual-render is an overlay)
    expect(wrapper.find('[data-testid="image-content"]').exists()).toBe(true)
  })

  it('clicking manual render button clears overlay', async () => {
    const base64 = makeBase64(11 * 1024 * 1024)
    mocks.mockGetFileAsBase64.mockResolvedValue(base64)
    const wrapper = mount(ImageViewer, { props: DEFAULT_PROPS })
    await flushPromises()

    await wrapper.find('[data-testid="manual-render-btn"]').trigger('click')
    // Overlay should be gone but image should remain
    expect(wrapper.find('[data-testid="manual-render-btn"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="image-content"]').exists()).toBe(true)
  })

  it('clicking image toggles zoom', async () => {
    mocks.mockGetFileAsBase64.mockResolvedValue(shortBase64())
    const wrapper = mount(ImageViewer, { props: DEFAULT_PROPS })
    await flushPromises()

    const img = wrapper.find('[data-testid="image-content"]')
    expect(img.classes()).not.toContain('image-content-zoomed')

    await img.trigger('click')
    expect(img.classes()).toContain('image-content-zoomed')

    await img.trigger('click')
    expect(img.classes()).not.toContain('image-content-zoomed')
  })

  it('reloads image when fileId changes', async () => {
    mocks.mockGetFileAsBase64.mockResolvedValue(shortBase64())
    const wrapper = mount(ImageViewer, { props: DEFAULT_PROPS })
    await flushPromises()
    expect(mocks.mockGetFileAsBase64).toHaveBeenCalledTimes(1)

    await wrapper.setProps({ fileId: 2 })
    await flushPromises()
    expect(mocks.mockGetFileAsBase64).toHaveBeenCalledTimes(2)
  })

  it('resets zoom state when fileId changes', async () => {
    mocks.mockGetFileAsBase64.mockResolvedValue(shortBase64())
    const wrapper = mount(ImageViewer, { props: DEFAULT_PROPS })
    await flushPromises()

    const img = wrapper.find('[data-testid="image-content"]')
    await img.trigger('click')
    expect(img.classes()).toContain('image-content-zoomed')

    await wrapper.setProps({ fileId: 2 })
    await flushPromises()

    const newImg = wrapper.find('[data-testid="image-content"]')
    expect(newImg.classes()).not.toContain('image-content-zoomed')
  })

  it('handles img @error event', async () => {
    mocks.mockGetFileAsBase64.mockResolvedValue(shortBase64())
    const wrapper = mount(ImageViewer, { props: DEFAULT_PROPS })
    await flushPromises()

    const img = wrapper.find('[data-testid="image-content"]')
    await img.trigger('error')

    expect(wrapper.find('[data-testid="image-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="image-loading"]').exists()).toBe(false)
  })

  it('does not show size warning for small files', async () => {
    const base64 = makeBase64(1024)
    mocks.mockGetFileAsBase64.mockResolvedValue(base64)
    const wrapper = mount(ImageViewer, { props: DEFAULT_PROPS })
    await flushPromises()

    expect(wrapper.find('[data-testid="size-warning"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="image-content"]').exists()).toBe(true)
  })
})
