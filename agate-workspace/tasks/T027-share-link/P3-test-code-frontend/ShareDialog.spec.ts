import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { h, defineComponent } from 'vue'

const mocks = vi.hoisted(() => ({
  mockCreateShare: vi.fn(),
  mockToastShow: vi.fn(),
}))

vi.mock('@/api/client', () => ({
  api: {
    createShare: (...args: unknown[]) => mocks.mockCreateShare(...args),
  },
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    show: mocks.mockToastShow,
    messages: { value: [] },
    remove: vi.fn(),
  }),
}))

const TeleportStub = defineComponent({
  props: ['to'],
  setup(_, { slots }) {
    return () => h('div', { class: 'teleport-stub' }, slots.default?.())
  },
})

const TransitionStub = defineComponent({
  props: ['name'],
  setup(_, { slots }) {
    return () => slots.default?.()
  },
})

function mountDialog(visible = true, extraProps: Record<string, unknown> = {}) {
  return mount(
    defineComponent({
      template: '<ShareDialog v-model:visible="dlgVisible" :entry-slug="entrySlug" @share-created="onShareCreated" />',
      components: { ShareDialog: () => import('@/components/ShareDialog.vue') },
      setup() {
        const dlgVisible = ref(visible)
        const entrySlug = ref(extraProps.entrySlug || 'test-entry')
        const onShareCreated = vi.fn()
        return { dlgVisible, entrySlug, onShareCreated }
      },
    }),
    {
      global: {
        stubs: {
          Teleport: TeleportStub,
          Transition: TransitionStub,
        },
        plugins: [createPinia()],
      },
    }
  )
}

import { ref } from 'vue'

describe('ShareDialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  // TC-F02-01: ShareDialog opens on Share button click
  it('does not render when visible is false', async () => {
    const wrapper = await mountDialog(false)
    expect(wrapper.find('.share-overlay').exists()).toBe(false)
  })

  it('renders dialog when visible is true', async () => {
    const wrapper = await mountDialog(true)
    expect(wrapper.find('.share-overlay').exists()).toBe(true)
    expect(wrapper.find('.share-dialog').exists()).toBe(true)
  })

  // TC-F02-02: Expiration selector defaults to 7d
  it('expiration selector defaults to 7d with correct options', async () => {
    const wrapper = await mountDialog(true)
    const select = wrapper.find('.expires-select')
    expect(select.exists()).toBe(true)
    expect((select.element as HTMLSelectElement).value).toBe('7d')

    const options = select.findAll('option')
    const optionValues = options.map(o => (o.element as HTMLOptionElement).value)
    expect(optionValues).toContain('1h')
    expect(optionValues).toContain('24h')
    expect(optionValues).toContain('7d')
    expect(optionValues).toContain('30d')
    expect(optionValues).toContain('0')
  })

  // TC-F02-03: Max views input defaults to empty (Unlimited)
  it('max views input defaults to empty with Unlimited placeholder', async () => {
    const wrapper = await mountDialog(true)
    const input = wrapper.find('.max-views-input')
    expect(input.exists()).toBe(true)
    expect((input.element as HTMLInputElement).value).toBe('')
    expect(input.attributes('placeholder')).toBe('Unlimited')
  })

  // TC-F02-04: Generate button is visible
  it('Create Link button is visible and enabled', async () => {
    const wrapper = await mountDialog(true)
    const btn = wrapper.find('.create-btn')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toContain('Create Link')
    expect((btn.element as HTMLButtonElement).disabled).toBe(false)
  })

  // TC-F03-01: Generate shows share URL
  it('shows share URL after generation', async () => {
    mocks.mockCreateShare.mockResolvedValue({
      id: 1,
      tokenPrefix: 'aBcDeFgH',
      shareUrl: '/test-entry?share=aBcDeFgHiJkLmNoP',
      expiresAt: '2026-07-06T00:00:00Z',
      maxViews: null,
      viewCount: 0,
      createdAt: '2026-06-29T00:00:00Z',
    })
    const wrapper = await mountDialog(true)
    await wrapper.find('.create-btn').trigger('click')
    await flushPromises()

    const urlInput = wrapper.find('.url-display input')
    expect(urlInput.exists()).toBe(true)
    expect((urlInput.element as HTMLInputElement).value).toContain('/test-entry?share=')
  })

  // TC-F03-02: Copy button appears after generation
  it('Copy button appears after share link generation', async () => {
    mocks.mockCreateShare.mockResolvedValue({
      id: 1,
      tokenPrefix: 'aBcDeFgH',
      shareUrl: '/test-entry?share=aBcDeFgHiJkLmNoP',
      expiresAt: '2026-07-06T00:00:00Z',
      maxViews: null,
      viewCount: 0,
      createdAt: '2026-06-29T00:00:00Z',
    })
    const wrapper = await mountDialog(true)
    await wrapper.find('.create-btn').trigger('click')
    await flushPromises()

    expect(wrapper.find('.copy-btn').exists()).toBe(true)
  })

  // TC-F03-03: Warning message about one-time display
  it('shows warning about one-time URL display', async () => {
    mocks.mockCreateShare.mockResolvedValue({
      id: 1,
      tokenPrefix: 'aBcDeFgH',
      shareUrl: '/test-entry?share=aBcDeFgHiJkLmNoP',
      expiresAt: '2026-07-06T00:00:00Z',
      maxViews: null,
      viewCount: 0,
      createdAt: '2026-06-29T00:00:00Z',
    })
    const wrapper = await mountDialog(true)
    await wrapper.find('.create-btn').trigger('click')
    await flushPromises()

    expect(wrapper.find('.warning').text()).toContain('Copy the URL now')
  })

  // TC-F04-01: Copy button writes to clipboard
  it('Copy button writes share URL to clipboard', async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText: mockWriteText } })

    mocks.mockCreateShare.mockResolvedValue({
      id: 1,
      tokenPrefix: 'aBcDeFgH',
      shareUrl: '/test-entry?share=aBcDeFgHiJkLmNoP',
      expiresAt: '2026-07-06T00:00:00Z',
      maxViews: null,
      viewCount: 0,
      createdAt: '2026-06-29T00:00:00Z',
    })
    const wrapper = await mountDialog(true)
    await wrapper.find('.create-btn').trigger('click')
    await flushPromises()

    await wrapper.find('.copy-btn').trigger('click')
    await flushPromises()

    expect(mockWriteText).toHaveBeenCalledWith('/test-entry?share=aBcDeFgHiJkLmNoP')
  })

  // TC-F04-02: Toast shown on copy
  it('shows toast on successful copy', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })

    mocks.mockCreateShare.mockResolvedValue({
      id: 1,
      tokenPrefix: 'aBcDeFgH',
      shareUrl: '/test-entry?share=aBcDeFgHiJkLmNoP',
      expiresAt: '2026-07-06T00:00:00Z',
      maxViews: null,
      viewCount: 0,
      createdAt: '2026-06-29T00:00:00Z',
    })
    const wrapper = await mountDialog(true)
    await wrapper.find('.create-btn').trigger('click')
    await flushPromises()

    await wrapper.find('.copy-btn').trigger('click')
    await flushPromises()

    expect(mocks.mockToastShow).toHaveBeenCalledWith('Link copied', 'success')
  })

  // TC-F04-03: Copy button text changes to "Copied!"
  it('Copy button text changes to Copied after click', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })

    mocks.mockCreateShare.mockResolvedValue({
      id: 1,
      tokenPrefix: 'aBcDeFgH',
      shareUrl: '/test-entry?share=aBcDeFgHiJkLmNoP',
      expiresAt: '2026-07-06T00:00:00Z',
      maxViews: null,
      viewCount: 0,
      createdAt: '2026-06-29T00:00:00Z',
    })
    const wrapper = await mountDialog(true)
    await wrapper.find('.create-btn').trigger('click')
    await flushPromises()

    await wrapper.find('.copy-btn').trigger('click')
    await flushPromises()

    expect(wrapper.find('.copy-btn').text()).toBe('Copied!')
  })

  // Dialog close behavior
  it('closes dialog on close button click', async () => {
    const wrapper = await mountDialog(true)
    await wrapper.find('.close-btn').trigger('click')
    const emitted = wrapper.emitted('update:visible')
    expect(emitted).toBeTruthy()
    expect(emitted![0][0]).toBe(false)
  })

  it('closes dialog on overlay click', async () => {
    const wrapper = await mountDialog(true)
    await wrapper.find('.share-overlay').trigger('click')
    const emitted = wrapper.emitted('update:visible')
    expect(emitted).toBeTruthy()
    expect(emitted![0][0]).toBe(false)
  })

  // Create Another resets to create state
  it('Create Another resets to create state', async () => {
    mocks.mockCreateShare.mockResolvedValue({
      id: 1,
      tokenPrefix: 'aBcDeFgH',
      shareUrl: '/test-entry?share=aBcDeFgHiJkLmNoP',
      expiresAt: '2026-07-06T00:00:00Z',
      maxViews: null,
      viewCount: 0,
      createdAt: '2026-06-29T00:00:00Z',
    })
    const wrapper = await mountDialog(true)
    await wrapper.find('.create-btn').trigger('click')
    await flushPromises()

    expect(wrapper.find('.result-section').exists()).toBe(true)

    const anotherBtn = wrapper.find('.create-another-btn')
    expect(anotherBtn.exists()).toBe(true)
    await anotherBtn.trigger('click')

    expect(wrapper.find('.create-section').exists()).toBe(true)
    expect(wrapper.find('.result-section').exists()).toBe(false)
  })

  // Loading state during creation
  it('shows loading state during creation', async () => {
    mocks.mockCreateShare.mockReturnValue(new Promise(() => {}))
    const wrapper = await mountDialog(true)
    await wrapper.find('.create-btn').trigger('click')
    await flushPromises()

    const btn = wrapper.find('.create-btn')
    expect(btn.text()).toContain('Creating')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
  })
})
