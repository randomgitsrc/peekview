import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'

const mocks = vi.hoisted(() => ({
  mockListShares: vi.fn(),
  mockRevokeShares: vi.fn(),
  mockToastShow: vi.fn(),
}))

vi.mock('@/api/client', () => ({
  api: {
    listShares: (...args: unknown[]) => mocks.mockListShares(...args),
    revokeShares: (...args: unknown[]) => mocks.mockRevokeShares(...args),
  },
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    show: mocks.mockToastShow,
    messages: { value: [] },
    remove: vi.fn(),
  }),
}))

const now = new Date('2026-06-29T12:00:00Z')

function makeShare(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    tokenPrefix: 'aBcDeFgH',
    expiresAt: new Date(now.getTime() + 7 * 86400000).toISOString(),
    maxViews: null,
    viewCount: 0,
    createdBy: 1,
    createdAt: now.toISOString(),
    revokedAt: null,
    ...overrides,
  }
}

async function mountPanel(slug = 'test-entry') {
  const ShareManagementPanel = (await import('@/components/ShareManagementPanel.vue')).default
  return mount(ShareManagementPanel, {
    props: { entrySlug: slug },
    global: {
      plugins: [createPinia()],
    },
  })
}

describe('ShareManagementPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  // TC-F05-01: Panel shows share list with stats
  it('shows stats with Active/Expired/Revoked counts', async () => {
    mocks.mockListShares.mockResolvedValue({
      shares: [
        makeShare({ id: 1 }),
        makeShare({ id: 2, expiresAt: new Date(now.getTime() - 86400000).toISOString() }),
        makeShare({ id: 3, revokedAt: now.toISOString() }),
      ],
      total: 3,
    })
    const wrapper = await mountPanel()
    await flushPromises()

    const stats = wrapper.find('.stats')
    expect(stats.exists()).toBe(true)
    expect(stats.text()).toContain('Active 1')
    expect(stats.text()).toContain('Expired 1')
    expect(stats.text()).toContain('Revoked 1')
  })

  // TC-F05-02: Each active share has checkbox and revoke button
  it('active share has checkbox and revoke button', async () => {
    mocks.mockListShares.mockResolvedValue({
      shares: [makeShare({ id: 1 })],
      total: 1,
    })
    const wrapper = await mountPanel()
    await flushPromises()

    const shareItem = wrapper.find('.share-item')
    expect(shareItem.find('input[type="checkbox"]').exists()).toBe(true)
    expect(shareItem.find('.revoke-btn').exists()).toBe(true)
  })

  // TC-F05-03: Expired/revoked shares have no checkbox/revoke
  it('revoked share has no checkbox or revoke button', async () => {
    mocks.mockListShares.mockResolvedValue({
      shares: [makeShare({ id: 1, revokedAt: now.toISOString() })],
      total: 1,
    })
    const wrapper = await mountPanel()
    await flushPromises()

    const shareItem = wrapper.find('.share-item')
    expect(shareItem.find('input[type="checkbox"]').exists()).toBe(false)
    expect(shareItem.find('.revoke-btn').exists()).toBe(false)
  })

  it('expired share has no checkbox or revoke button', async () => {
    mocks.mockListShares.mockResolvedValue({
      shares: [makeShare({ id: 1, expiresAt: new Date(now.getTime() - 86400000).toISOString() })],
      total: 1,
    })
    const wrapper = await mountPanel()
    await flushPromises()

    const shareItem = wrapper.find('.share-item')
    expect(shareItem.find('input[type="checkbox"]').exists()).toBe(false)
    expect(shareItem.find('.revoke-btn').exists()).toBe(false)
  })

  // TC-F06-01: Click revoke updates share status
  it('clicking revoke calls API and refreshes list', async () => {
    mocks.mockListShares.mockResolvedValue({
      shares: [makeShare({ id: 1 })],
      total: 1,
    })
    mocks.mockRevokeShares.mockResolvedValue({ revoked_count: 1 })

    const wrapper = await mountPanel()
    await flushPromises()

    await wrapper.find('.revoke-btn').trigger('click')
    await flushPromises()

    expect(mocks.mockRevokeShares).toHaveBeenCalledWith('test-entry', { share_ids: [1] })
    expect(mocks.mockListShares).toHaveBeenCalledTimes(2)
  })

  // TC-F07-01: Checkboxes enable batch revoke button
  it('batch revoke button appears when shares are selected', async () => {
    mocks.mockListShares.mockResolvedValue({
      shares: [
        makeShare({ id: 1 }),
        makeShare({ id: 2 }),
        makeShare({ id: 3 }),
      ],
      total: 3,
    })
    const wrapper = await mountPanel()
    await flushPromises()

    expect(wrapper.find('.batch-actions').exists()).toBe(false)

    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    await checkboxes[0].setValue(true)
    await checkboxes[1].setValue(true)

    const batchBtn = wrapper.find('.batch-actions button')
    expect(batchBtn.exists()).toBe(true)
    expect(batchBtn.text()).toContain('2')
  })

  // TC-F07-02: Batch revoke calls API with selected IDs
  it('batch revoke calls API with selected share IDs', async () => {
    mocks.mockListShares.mockResolvedValue({
      shares: [
        makeShare({ id: 1 }),
        makeShare({ id: 2 }),
        makeShare({ id: 3 }),
      ],
      total: 3,
    })
    mocks.mockRevokeShares.mockResolvedValue({ revoked_count: 2 })

    const wrapper = await mountPanel()
    await flushPromises()

    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    await checkboxes[0].setValue(true)
    await checkboxes[1].setValue(true)

    await wrapper.find('.batch-actions button').trigger('click')
    await flushPromises()

    expect(mocks.mockRevokeShares).toHaveBeenCalledWith('test-entry', { share_ids: [1, 2] })
  })

  // Loading state
  it('shows loading state while fetching shares', async () => {
    mocks.mockListShares.mockReturnValue(new Promise(() => {}))
    const wrapper = await mountPanel()

    expect(wrapper.find('.loading').exists()).toBe(true)
  })

  // Empty state
  it('shows empty state when no shares', async () => {
    mocks.mockListShares.mockResolvedValue({ shares: [], total: 0 })
    const wrapper = await mountPanel()
    await flushPromises()

    expect(wrapper.find('.empty').exists()).toBe(true)
  })

  // Status labels
  it('shows correct status labels for each share', async () => {
    mocks.mockListShares.mockResolvedValue({
      shares: [
        makeShare({ id: 1 }),
        makeShare({ id: 2, expiresAt: new Date(now.getTime() - 86400000).toISOString() }),
        makeShare({ id: 3, revokedAt: now.toISOString() }),
      ],
      total: 3,
    })
    const wrapper = await mountPanel()
    await flushPromises()

    const items = wrapper.findAll('.share-item')
    expect(items[0].find('.status').text()).toBe('Active')
    expect(items[1].find('.status').text()).toBe('Expired')
    expect(items[2].find('.status').text()).toBe('Revoked')
  })

  // View count display
  it('shows view count for each share', async () => {
    mocks.mockListShares.mockResolvedValue({
      shares: [makeShare({ id: 1, viewCount: 5, maxViews: 10 })],
      total: 1,
    })
    const wrapper = await mountPanel()
    await flushPromises()

    const views = wrapper.find('.views')
    expect(views.text()).toContain('5/10')
  })

  // Token prefix display
  it('shows token prefix for each share', async () => {
    mocks.mockListShares.mockResolvedValue({
      shares: [makeShare({ id: 1, tokenPrefix: 'aBcDeFgH' })],
      total: 1,
    })
    const wrapper = await mountPanel()
    await flushPromises()

    const prefix = wrapper.find('.prefix')
    expect(prefix.text()).toContain('aBcDeFgH')
  })
})
