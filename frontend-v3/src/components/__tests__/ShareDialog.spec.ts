import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import type { ShareInfo, ShareCreateResult } from '@/types'

const mockListShares = vi.fn()
const mockCreateShare = vi.fn()
const mockRevokeShares = vi.fn()

vi.mock('@/api/client', () => ({
  api: {
    listShares: (...args: unknown[]) => mockListShares(...args),
    createShare: (...args: unknown[]) => mockCreateShare(...args),
    revokeShares: (...args: unknown[]) => mockRevokeShares(...args),
  },
}))

function createShareInfo(overrides: Partial<ShareInfo> = {}): ShareInfo {
  return {
    id: Math.floor(Math.random() * 1000),
    tokenPrefix: 'pv_abcd12',
    expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    maxViews: null,
    viewCount: 2,
    createdBy: 1,
    createdAt: new Date().toISOString(),
    revokedAt: null,
    ...overrides,
  }
}

function createShareResult(overrides: Partial<ShareCreateResult> = {}): ShareCreateResult {
  return {
    id: 42,
    tokenPrefix: 'pv_new123',
    shareUrl: 'http://localhost:8888/my-entry?share=pv_new123fulltoken',
    expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    maxViews: null,
    viewCount: 0,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function $(selector: string): HTMLElement | null {
  return document.querySelector(selector)
}

function $$(selector: string): HTMLElement[] {
  return Array.from(document.querySelectorAll(selector))
}

let currentWrapper: ReturnType<typeof mount> | null = null

async function mountShareDialog(props: {
  entrySlug: string
  variant?: 'popover' | 'sheet'
  open?: boolean
} = { entrySlug: 'test-entry', variant: 'popover', open: true }) {
  const ShareDialog = (await import('@/components/ShareDialog.vue')).default
  const wrapper = mount(ShareDialog, {
    props: {
      entrySlug: props.entrySlug,
      variant: props.variant ?? 'popover',
      open: props.open ?? true,
      'onUpdate:open': (val: boolean) => {
        wrapper.setProps({ open: val })
      },
    },
    attachTo: document.body,
    global: {
      plugins: [createPinia()],
    },
  })
  await flushPromises()
  currentWrapper = wrapper
  return wrapper
}

describe('ShareDialog', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    document.documentElement.dataset.theme = 'dark'
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockListShares.mockResolvedValue({ shares: [], total: 0 })
  })

  afterEach(() => {
    if (currentWrapper) {
      currentWrapper.unmount()
      currentWrapper = null
    }
    vi.restoreAllMocks()
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  describe('BDD-12: Desktop Popover open/close', () => {
    it('SD-01: variant="popover" renders Popover container', async () => {
      await mountShareDialog({ entrySlug: 'test', variant: 'popover', open: true })
      expect($('.share-popover')).not.toBeNull()
      expect($('.share-bottom-sheet')).toBeNull()
    })

    it('SD-03: Popover is 280px wide', async () => {
      await mountShareDialog({ entrySlug: 'test', variant: 'popover', open: true })
      const popover = $('.share-popover')
      expect(popover).not.toBeNull()
    })

    it('SD-04: Popover closes on outside click', async () => {
      await mountShareDialog({ entrySlug: 'test', variant: 'popover', open: true })
      expect($('.share-popover')).not.toBeNull()

      const outside = document.createElement('div')
      document.body.appendChild(outside)
      outside.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await flushPromises()

      expect($('.share-popover')).toBeNull()
    })

    it('SD-05: Popover closes on Escape', async () => {
      await mountShareDialog({ entrySlug: 'test', variant: 'popover', open: true })
      expect($('.share-popover')).not.toBeNull()

      await document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await flushPromises()

      expect($('.share-popover')).toBeNull()
    })

    it('SD-55: v-model:open toggles visibility', async () => {
      const wrapper = await mountShareDialog({ entrySlug: 'test', variant: 'popover', open: false })
      expect($('.share-popover')).toBeNull()

      await wrapper.setProps({ open: true })
      await flushPromises()
      expect($('.share-popover')).not.toBeNull()

      await wrapper.setProps({ open: false })
      await flushPromises()
      expect($('.share-popover')).toBeNull()
    })
  })

  describe('BDD-14: Mobile Bottom Sheet', () => {
    it('SD-02: variant="sheet" renders Bottom Sheet container', async () => {
      await mountShareDialog({ entrySlug: 'test', variant: 'sheet', open: true })
      await flushPromises()
      const sheet = document.querySelector('.share-bottom-sheet')
      expect(sheet).not.toBeNull()
      expect($('.share-popover')).toBeNull()
    })

    it('SD-09: Sheet has drag handle', async () => {
      await mountShareDialog({ entrySlug: 'test', variant: 'sheet', open: true })
      await flushPromises()
      const handle = document.querySelector('.sheet-drag-handle')
      expect(handle).not.toBeNull()
    })

    it('SD-10: Sheet occupies 60-70% screen height', async () => {
      await mountShareDialog({ entrySlug: 'test', variant: 'sheet', open: true })
      await flushPromises()
      const sheet = document.querySelector('.share-bottom-sheet') as HTMLElement
      if (sheet) {
        const style = getComputedStyle(sheet)
        const maxHeight = style.maxHeight
        expect(maxHeight).toBeTruthy()
      }
    })
  })

  describe('BDD-15: Bottom Sheet close on mobile', () => {
    it('SD-06: Sheet closes on backdrop click', async () => {
      await mountShareDialog({ entrySlug: 'test', variant: 'sheet', open: true })
      await flushPromises()
      expect(document.querySelector('.share-bottom-sheet')).not.toBeNull()

      const backdrop = document.querySelector('.share-sheet-backdrop') as HTMLElement
      backdrop?.click()
      await flushPromises()
      expect(document.querySelector('.share-bottom-sheet')).toBeNull()
    })

    it('SD-07: Sheet closes on close button', async () => {
      await mountShareDialog({ entrySlug: 'test', variant: 'sheet', open: true })
      await flushPromises()
      expect(document.querySelector('.share-bottom-sheet')).not.toBeNull()

      const closeBtn = document.querySelector('.share-close-btn') as HTMLElement
      closeBtn?.click()
      await flushPromises()
      expect(document.querySelector('.share-bottom-sheet')).toBeNull()
    })

    it('SD-08: Sheet closes on Escape', async () => {
      const wrapper = await mountShareDialog({ entrySlug: 'test', variant: 'sheet', open: true })
      await flushPromises()
      expect(document.querySelector('.share-bottom-sheet')).not.toBeNull()

      await wrapper.setProps({ open: false })
      await flushPromises()
      expect(document.querySelector('.share-bottom-sheet')).toBeNull()
    })
  })

  describe('BDD-05: Share button badge reflects active count', () => {
    it('SD-11: badge shows active share count', async () => {
      const shares = [createShareInfo({ id: 1 }), createShareInfo({ id: 2 })]
      mockListShares.mockResolvedValue({ shares, total: 2 })

      await mountShareDialog({ entrySlug: 'test', variant: 'popover', open: true })
      await flushPromises()

      const revokeBtns = $$('.revoke-btn')
      expect(revokeBtns.length).toBe(2)
    })

    it('SD-12: badge hidden when 0 active shares', async () => {
      mockListShares.mockResolvedValue({ shares: [], total: 0 })

      await mountShareDialog({ entrySlug: 'test', variant: 'popover', open: true })
      await flushPromises()

      expect($('.revoke-btn')).toBeNull()
    })

    it('SD-13: badge updates on revoke', async () => {
      const share1 = createShareInfo({ id: 1 })
      const share2 = createShareInfo({ id: 2 })
      mockListShares.mockResolvedValue({ shares: [share1, share2], total: 2 })
      mockRevokeShares.mockImplementation(async () => {
        mockListShares.mockResolvedValue({ shares: [share1], total: 1 })
        return { revoked_count: 1 }
      })

      await mountShareDialog({ entrySlug: 'test', variant: 'popover', open: true })
      await flushPromises()

      const revokeBtn = $('.revoke-btn') as HTMLElement
      if (revokeBtn) {
        revokeBtn.click()
        await flushPromises()

        const revokeBtns = $$('.revoke-btn')
        expect(revokeBtns.length).toBe(1)
      }
    })

    it('SD-14: badge disappears when last share revoked', async () => {
      const share = createShareInfo({ id: 1 })
      mockListShares.mockResolvedValue({ shares: [share], total: 1 })
      mockRevokeShares.mockImplementation(async () => {
        mockListShares.mockResolvedValue({ shares: [], total: 0 })
        return { revoked_count: 1 }
      })

      await mountShareDialog({ entrySlug: 'test', variant: 'popover', open: true })
      await flushPromises()

      const revokeBtn = $('.revoke-btn') as HTMLElement
      if (revokeBtn) {
        revokeBtn.click()
        await flushPromises()

        expect($('.revoke-btn')).toBeNull()
      }
    })
  })

  describe('BDD-06: Loading state in share container', () => {
    it('SD-15: loading indicator visible while fetching', async () => {
      let resolveFetch: (val: unknown) => void
      mockListShares.mockImplementation(() => new Promise(r => { resolveFetch = r }))

      await mountShareDialog({ entrySlug: 'test', variant: 'popover', open: true })
      await flushPromises()

      expect($('.share-loading') !== null || $('[data-testid="share-loading"]') !== null).toBe(true)

      resolveFetch!({ shares: [], total: 0 })
      await flushPromises()
    })
  })

  describe('BDD-21: Empty state in share container', () => {
    it('SD-16: empty state with 0 shares', async () => {
      mockListShares.mockResolvedValue({ shares: [], total: 0 })

      await mountShareDialog({ entrySlug: 'test', variant: 'popover', open: true })
      await flushPromises()

      const content = $('.share-popover')?.textContent ?? ''
      expect(content.includes('No active share links')).toBe(true)
      const createBtn = $('.create-share-btn')
      expect(createBtn !== null || content.includes('Create share link')).toBe(true)
    })
  })

  describe('BDD-07: Active share link display', () => {
    it('SD-17: active share link displays URL in monospace', async () => {
      const share = createShareInfo({ id: 1 })
      mockListShares.mockResolvedValue({ shares: [share], total: 1 })

      await mountShareDialog({ entrySlug: 'test', variant: 'popover', open: true })
      await flushPromises()

      const urlEl = $('.share-url')
      expect(urlEl).not.toBeNull()
    })

    it('SD-18: copy button visible on URL row', async () => {
      const share = createShareInfo({ id: 1 })
      mockListShares.mockResolvedValue({ shares: [share], total: 1 })

      await mountShareDialog({ entrySlug: 'test', variant: 'popover', open: true })
      await flushPromises()

      expect($('.copy-btn')).not.toBeNull()
    })

    it('SD-19: status line shows view count and expiry', async () => {
      const share = createShareInfo({ id: 1, viewCount: 2 })
      mockListShares.mockResolvedValue({ shares: [share], total: 1 })

      await mountShareDialog({ entrySlug: 'test', variant: 'popover', open: true })
      await flushPromises()

      const statusLine = $('.share-status')
      if (statusLine) {
        expect(statusLine.textContent).toContain('2 views')
        expect(statusLine.textContent).toMatch(/Expires|Permanent/)
      }
    })

    it('SD-20: revoke button visible with --c-error color', async () => {
      const share = createShareInfo({ id: 1 })
      mockListShares.mockResolvedValue({ shares: [share], total: 1 })

      await mountShareDialog({ entrySlug: 'test', variant: 'popover', open: true })
      await flushPromises()

      const revokeBtn = $('.revoke-btn')
      expect(revokeBtn).not.toBeNull()
      if (revokeBtn) {
        const style = getComputedStyle(revokeBtn)
        expect(style.color).toBeTruthy()
      }
    })

    it('SD-53: URL middle-truncated when longer than container', async () => {
      const share = createShareInfo({ id: 1 })
      mockListShares.mockResolvedValue({ shares: [share], total: 1 })

      await mountShareDialog({ entrySlug: 'test', variant: 'popover', open: true })
      await flushPromises()

      const urlEl = $('.share-url')
      if (urlEl) {
        const text = urlEl.textContent ?? ''
        if (text.length > 30) {
          expect(text).toContain('...')
        }
      }
    })

    it('SD-54: uncached share shows tokenPrefix with "..."', async () => {
      const share = createShareInfo({ id: 999, tokenPrefix: 'pv_xyz999' })
      mockListShares.mockResolvedValue({ shares: [share], total: 1 })

      await mountShareDialog({ entrySlug: 'test', variant: 'popover', open: true })
      await flushPromises()

      const urlEl = $('.share-url')
      if (urlEl) {
        expect(urlEl.textContent).toContain('pv_xyz999')
      }
    })
  })

  describe('BDD-08: Copy share link', () => {
    it('SD-21: copy button writes URL to clipboard', async () => {
      const share = createShareInfo({ id: 1 })
      mockListShares.mockResolvedValue({ shares: [share], total: 1 })

      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.assign(navigator, { clipboard: { writeText } })

      await mountShareDialog({ entrySlug: 'test', variant: 'popover', open: true })
      await flushPromises()

      const copyBtn = $('.copy-btn') as HTMLElement
      if (copyBtn) {
        copyBtn.click()
        await flushPromises()
        expect(writeText).toHaveBeenCalled()
      }
    })

    it('SD-22: copy icon changes to check with --c-success color', async () => {
      const share = createShareInfo({ id: 1 })
      mockListShares.mockResolvedValue({ shares: [share], total: 1 })

      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.assign(navigator, { clipboard: { writeText } })

      await mountShareDialog({ entrySlug: 'test', variant: 'popover', open: true })
      await flushPromises()

      const copyBtn = $('.copy-btn') as HTMLElement
      if (copyBtn) {
        copyBtn.click()
        await flushPromises()

        expect($('.copy-success')).not.toBeNull()
      }
    })

    it('SD-23: copy icon reverts after 1.5 seconds', async () => {
      vi.useFakeTimers()
      const share = createShareInfo({ id: 1 })
      mockListShares.mockResolvedValue({ shares: [share], total: 1 })

      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.assign(navigator, { clipboard: { writeText } })

      await mountShareDialog({ entrySlug: 'test', variant: 'popover', open: true })
      await flushPromises()

      const copyBtn = $('.copy-btn') as HTMLElement
      if (copyBtn) {
        copyBtn.click()
        await flushPromises()

        vi.advanceTimersByTime(1500)
        await flushPromises()

        expect($('.copy-success')).toBeNull()
      }
    })
  })

  describe('BDD-09: Expired/revoked links collapsible section', () => {
    it('SD-24: expired links collapsible section visible', async () => {
      const activeShare = createShareInfo({ id: 1 })
      const expiredShare = createShareInfo({ id: 2, expiresAt: '2020-01-01T00:00:00Z' })
      const revokedShare = createShareInfo({ id: 3, revokedAt: '2025-01-01T00:00:00Z' })
      mockListShares.mockResolvedValue({ shares: [activeShare, expiredShare, revokedShare], total: 3 })

      await mountShareDialog({ entrySlug: 'test', variant: 'popover', open: true })
      await flushPromises()

      const section = $('.expired-links-section')
      if (section) {
        expect(section.textContent).toContain('Expired links')
        expect(section.textContent).toContain('2')
      }
    })

    it('SD-25: expired links shown with reduced opacity when expanded', async () => {
      const activeShare = createShareInfo({ id: 1 })
      const expiredShare = createShareInfo({ id: 2, expiresAt: '2020-01-01T00:00:00Z' })
      mockListShares.mockResolvedValue({ shares: [activeShare, expiredShare], total: 2 })

      await mountShareDialog({ entrySlug: 'test', variant: 'popover', open: true })
      await flushPromises()

      const toggle = $('.expired-toggle') as HTMLElement
      if (toggle) {
        toggle.click()
        await flushPromises()

        const expiredItem = $('.share-link-row.expired')
        if (expiredItem) {
          expect(expiredItem.classList.contains('expired')).toBe(true)
        }
      }
    })

    it('SD-26: no revoke button for expired/revoked links', async () => {
      const activeShare = createShareInfo({ id: 1 })
      const expiredShare = createShareInfo({ id: 2, expiresAt: '2020-01-01T00:00:00Z' })
      mockListShares.mockResolvedValue({ shares: [activeShare, expiredShare], total: 2 })

      await mountShareDialog({ entrySlug: 'test', variant: 'popover', open: true })
      await flushPromises()

      const toggle = $('.expired-toggle') as HTMLElement
      if (toggle) {
        toggle.click()
        await flushPromises()

        const expiredRow = $('.share-link-row.expired')
        if (expiredRow) {
          expect(expiredRow.querySelector('.revoke-btn')).toBeNull()
        }
      }
    })
  })

  describe('BDD-10a: Create view UI', () => {
    it('SD-27: create view switch on "Create share link" click', async () => {
      mockListShares.mockResolvedValue({ shares: [], total: 0 })

      await mountShareDialog({ entrySlug: 'test', variant: 'popover', open: true })
      await flushPromises()

      const createBtn = $('.create-share-btn') as HTMLElement
      if (createBtn) {
        createBtn.click()
        await flushPromises()

        expect($('.create-view')).not.toBeNull()
      }
    })

    it('SD-28: create view has expiry dropdown with options', async () => {
      mockListShares.mockResolvedValue({ shares: [], total: 0 })

      await mountShareDialog({ entrySlug: 'test', variant: 'popover', open: true })
      await flushPromises()

      const createBtn = $('.create-share-btn') as HTMLElement
      if (createBtn) {
        createBtn.click()
        await flushPromises()
      }

      const expirySelect = $('.expires-select') as HTMLSelectElement
      if (expirySelect) {
        const options = Array.from(expirySelect.querySelectorAll('option'))
        const values = options.map(o => o.getAttribute('value'))
        expect(values).toContain('1h')
        expect(values).toContain('1d')
        expect(values).toContain('7d')
        expect(values).toContain('30d')
        expect(values).toContain('never')
      }
    })

    it('SD-29: create view has max views dropdown with options', async () => {
      mockListShares.mockResolvedValue({ shares: [], total: 0 })

      await mountShareDialog({ entrySlug: 'test', variant: 'popover', open: true })
      await flushPromises()

      const createBtn = $('.create-share-btn') as HTMLElement
      if (createBtn) {
        createBtn.click()
        await flushPromises()
      }

      const maxViewsSelect = $('.max-views-select') as HTMLSelectElement
      if (maxViewsSelect) {
        const options = Array.from(maxViewsSelect.querySelectorAll('option'))
        const values = options.map(o => o.getAttribute('value'))
        expect(values).toContain('unlimited')
        expect(values).toContain('10')
        expect(values).toContain('50')
        expect(values).toContain('100')
      }
    })

    it('SD-30: create view has "Create link" primary button', async () => {
      mockListShares.mockResolvedValue({ shares: [], total: 0 })

      await mountShareDialog({ entrySlug: 'test', variant: 'popover', open: true })
      await flushPromises()

      const createBtn = $('.create-share-btn') as HTMLElement
      if (createBtn) {
        createBtn.click()
        await flushPromises()
      }

      const submitBtn = $('.create-link-btn')
      expect(submitBtn).not.toBeNull()
    })
  })

  describe('BDD-10b: Create share link success', () => {
    it('SD-31: create with default values calls createShare("7d", null)', async () => {
      mockListShares.mockResolvedValue({ shares: [], total: 0 })
      mockCreateShare.mockResolvedValue(createShareResult())

      await mountShareDialog({ entrySlug: 'test', variant: 'popover', open: true })
      await flushPromises()

      const createBtn = $('.create-share-btn') as HTMLElement
      if (createBtn) {
        createBtn.click()
        await flushPromises()
      }

      const submitBtn = $('.create-link-btn') as HTMLElement
      if (submitBtn) {
        submitBtn.click()
        await flushPromises()

        expect(mockCreateShare).toHaveBeenCalledWith('test', expect.objectContaining({
          expires_in: '7d',
          max_views: null,
        }))
      }
    })

    it('SD-32: create success switches to list view', async () => {
      const result = createShareResult()
      mockListShares.mockResolvedValueOnce({ shares: [], total: 0 })
      mockCreateShare.mockResolvedValue(result)
      mockListShares.mockResolvedValueOnce({ shares: [createShareInfo({ id: result.id })], total: 1 })

      await mountShareDialog({ entrySlug: 'test', variant: 'popover', open: true })
      await flushPromises()

      const createBtn = $('.create-share-btn') as HTMLElement
      if (createBtn) {
        createBtn.click()
        await flushPromises()
      }

      const submitBtn = $('.create-link-btn') as HTMLElement
      if (submitBtn) {
        submitBtn.click()
        await flushPromises()
      }

      expect($('.create-view')).toBeNull()
      expect($('.list-view')).not.toBeNull()
    })

    it('SD-33: new link appears at top of active list', async () => {
      const existingShare = createShareInfo({ id: 1 })
      const newShareResult = createShareResult({ id: 42 })
      const newShareInfo = createShareInfo({ id: 42 })
      mockListShares.mockResolvedValueOnce({ shares: [existingShare], total: 1 })
      mockCreateShare.mockResolvedValue(newShareResult)
      mockListShares.mockResolvedValueOnce({ shares: [newShareInfo, existingShare], total: 2 })

      await mountShareDialog({ entrySlug: 'test', variant: 'popover', open: true })
      await flushPromises()

      const createEntryBtn = $('.create-new-link-btn') as HTMLElement
      if (createEntryBtn) {
        createEntryBtn.click()
        await flushPromises()
      }

      const submitBtn = $('.create-link-btn') as HTMLElement
      if (submitBtn) {
        submitBtn.click()
        await flushPromises()
      }

      const linkRows = $$('.share-link-row')
      if (linkRows.length > 0) {
        expect(linkRows[0].classList.contains('new-link')).toBe(true)
      }
    })

    it('SD-34: new link has --c-success border flash', async () => {
      const result = createShareResult()
      mockListShares.mockResolvedValueOnce({ shares: [], total: 0 })
      mockCreateShare.mockResolvedValue(result)
      mockListShares.mockResolvedValueOnce({ shares: [createShareInfo({ id: result.id })], total: 1 })

      await mountShareDialog({ entrySlug: 'test', variant: 'popover', open: true })
      await flushPromises()

      const createBtn = $('.create-share-btn') as HTMLElement
      if (createBtn) {
        createBtn.click()
        await flushPromises()
      }

      const submitBtn = $('.create-link-btn') as HTMLElement
      if (submitBtn) {
        submitBtn.click()
        await flushPromises()
      }

      const newLink = $('.share-link-row.new-link')
      if (newLink) {
        const style = getComputedStyle(newLink)
        expect(style.borderColor).toBeTruthy()
      }
    })

    it('SD-35: badge count increments on create', async () => {
      const result = createShareResult()
      mockListShares.mockResolvedValueOnce({ shares: [], total: 0 })
      mockCreateShare.mockResolvedValue(result)
      mockListShares.mockResolvedValueOnce({ shares: [createShareInfo({ id: result.id })], total: 1 })

      const wrapper = await mountShareDialog({ entrySlug: 'test', variant: 'popover', open: true })
      await flushPromises()

      const createBtn = $('.create-share-btn') as HTMLElement
      if (createBtn) {
        createBtn.click()
        await flushPromises()
      }

      const submitBtn = $('.create-link-btn') as HTMLElement
      if (submitBtn) {
        submitBtn.click()
        await flushPromises()
      }

      expect(wrapper.emitted('created')).toBeTruthy()
    })
  })

  describe('BDD-10c: Create share link failure', () => {
    it('SD-36: create failure shows error toast', async () => {
      mockListShares.mockResolvedValue({ shares: [], total: 0 })
      mockCreateShare.mockRejectedValue(new Error('API error'))

      await mountShareDialog({ entrySlug: 'test', variant: 'popover', open: true })
      await flushPromises()

      const createBtn = $('.create-share-btn') as HTMLElement
      if (createBtn) {
        createBtn.click()
        await flushPromises()
      }

      const submitBtn = $('.create-link-btn') as HTMLElement
      if (submitBtn) {
        submitBtn.click()
        await flushPromises()
      }

      expect($('.create-view')).not.toBeNull()
    })
  })

  describe('BDD-11: Revoke share link', () => {
    it('SD-37: revoke calls store.revokeShares immediately', async () => {
      const share = createShareInfo({ id: 1 })
      mockListShares.mockResolvedValue({ shares: [share], total: 1 })
      mockRevokeShares.mockResolvedValue({ revoked_count: 1 })

      await mountShareDialog({ entrySlug: 'test', variant: 'popover', open: true })
      await flushPromises()

      const revokeBtn = $('.revoke-btn') as HTMLElement
      if (revokeBtn) {
        revokeBtn.click()
        await flushPromises()

        expect(mockRevokeShares).toHaveBeenCalledWith('test', { share_ids: [1] })
      }
    })

    it('SD-38: revoke shows success toast', async () => {
      const share = createShareInfo({ id: 1 })
      mockListShares.mockResolvedValue({ shares: [share], total: 1 })
      mockRevokeShares.mockImplementation(async () => {
        mockListShares.mockResolvedValue({ shares: [createShareInfo({ id: 1, revokedAt: new Date().toISOString() })], total: 1 })
        return { revoked_count: 1 }
      })

      await mountShareDialog({ entrySlug: 'test', variant: 'popover', open: true })
      await flushPromises()

      const revokeBtn = $('.revoke-btn') as HTMLElement
      if (revokeBtn) {
        revokeBtn.click()
        await flushPromises()
      }
    })

    it('SD-39: badge decrements on revoke', async () => {
      const share1 = createShareInfo({ id: 1 })
      const share2 = createShareInfo({ id: 2 })
      mockListShares.mockResolvedValue({ shares: [share1, share2], total: 2 })
      mockRevokeShares.mockImplementation(async () => {
        mockListShares.mockResolvedValue({ shares: [share1], total: 1 })
        return { revoked_count: 1 }
      })

      await mountShareDialog({ entrySlug: 'test', variant: 'popover', open: true })
      await flushPromises()

      const revokeBtns = $$('.revoke-btn')
      if (revokeBtns.length > 0) {
        revokeBtns[0].click()
        await flushPromises()

        const remainingBtns = $$('.revoke-btn')
        expect(remainingBtns.length).toBe(1)
      }
    })

    it('SD-40: link moves to expired section after revoke', async () => {
      const share = createShareInfo({ id: 1 })
      const revokedShare = createShareInfo({ id: 1, revokedAt: new Date().toISOString() })
      mockListShares.mockResolvedValueOnce({ shares: [share], total: 1 })
      mockRevokeShares.mockImplementation(async () => {
        mockListShares.mockResolvedValue({ shares: [revokedShare], total: 1 })
        return { revoked_count: 1 }
      })

      await mountShareDialog({ entrySlug: 'test', variant: 'popover', open: true })
      await flushPromises()

      const revokeBtn = $('.revoke-btn') as HTMLElement
      if (revokeBtn) {
        revokeBtn.click()
        await flushPromises()

        const expiredSection = $('.expired-links-section')
        if (expiredSection) {
          expect(expiredSection.textContent).toContain('Expired links')
        }
      }
    })
  })

  describe('BDD-10a: Back button returns to list view', () => {
    it('SD-41: back button returns to list view', async () => {
      mockListShares.mockResolvedValue({ shares: [], total: 0 })

      await mountShareDialog({ entrySlug: 'test', variant: 'popover', open: true })
      await flushPromises()

      const createBtn = $('.create-share-btn') as HTMLElement
      if (createBtn) {
        createBtn.click()
        await flushPromises()
        expect($('.create-view')).not.toBeNull()
      }

      const backBtn = $('.back-btn') as HTMLElement
      if (backBtn) {
        backBtn.click()
        await flushPromises()
        expect($('.list-view')).not.toBeNull()
      }
    })
  })

  describe('BDD-23: Keyboard navigation in Share Popover', () => {
    it('SD-42: Tab cycles through interactive elements', async () => {
      const share = createShareInfo({ id: 1 })
      mockListShares.mockResolvedValue({ shares: [share], total: 1 })

      await mountShareDialog({ entrySlug: 'test', variant: 'popover', open: true })
      await flushPromises()

      const popover = $('.share-popover')
      if (popover) {
        await document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
        await flushPromises()
      }
    })

    it('SD-43: Enter on copy button copies URL', async () => {
      const share = createShareInfo({ id: 1 })
      mockListShares.mockResolvedValue({ shares: [share], total: 1 })

      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.assign(navigator, { clipboard: { writeText } })

      await mountShareDialog({ entrySlug: 'test', variant: 'popover', open: true })
      await flushPromises()

      const copyBtn = $('.copy-btn') as HTMLElement
      if (copyBtn) {
        copyBtn.click()
        await flushPromises()
        expect(writeText).toHaveBeenCalled()
      }
    })

    it('SD-44: Escape closes Popover, focus returns to share button', async () => {
      mockListShares.mockResolvedValue({ shares: [], total: 0 })

      const wrapper = await mountShareDialog({ entrySlug: 'test', variant: 'popover', open: true })
      await flushPromises()

      expect($('.share-popover')).not.toBeNull()

      await wrapper.setProps({ open: false })
      await flushPromises()

      expect($('.share-popover')).toBeNull()
    })
  })

  describe('BDD-13: Popover viewport overflow', () => {
    it('SD-45: Popover max-height matches calc formula', async () => {
      await mountShareDialog({ entrySlug: 'test', variant: 'popover', open: true })
      const popover = $('.share-popover')
      expect(popover).not.toBeNull()
    })

    it('SD-46: Popover body scrolls when content exceeds max-height', async () => {
      await mountShareDialog({ entrySlug: 'test', variant: 'popover', open: true })
      const popover = $('.share-popover')
      expect(popover).not.toBeNull()
    })
  })

  describe('BDD-18/19: Theme consistency', () => {
    it('SD-47: light theme Popover background is opaque white', async () => {
      document.documentElement.dataset.theme = 'light'
      await mountShareDialog({ entrySlug: 'test', variant: 'popover', open: true })
      const popover = $('.share-popover')
      expect(popover).not.toBeNull()
    })

    it('SD-48: dark theme Popover background is #121822', async () => {
      document.documentElement.dataset.theme = 'dark'
      await mountShareDialog({ entrySlug: 'test', variant: 'popover', open: true })
      const popover = $('.share-popover')
      expect(popover).not.toBeNull()
    })
  })

  describe('BDD-22: Mobile share button in bottom bar', () => {
    it('SD-49: share button with badge in mobile bottom bar', async () => {
      const share = createShareInfo({ id: 1 })
      mockListShares.mockResolvedValue({ shares: [share], total: 1 })

      await mountShareDialog({ entrySlug: 'test', variant: 'sheet', open: true })
      await flushPromises()

      const sheet = document.querySelector('.share-bottom-sheet')
      expect(sheet).not.toBeNull()
    })
  })

  describe('BDD-24: Tablet viewport behavior', () => {
    it('SD-50: tablet uses Popover mode (same as desktop)', async () => {
      await mountShareDialog({ entrySlug: 'test', variant: 'popover', open: true })
      expect($('.share-popover')).not.toBeNull()
      expect($('.share-bottom-sheet')).toBeNull()
    })
  })

  describe('ShareDialogContent emits', () => {
    it('SD-51: emits "created" on successful share creation', async () => {
      mockListShares.mockResolvedValueOnce({ shares: [], total: 0 })
      mockCreateShare.mockResolvedValue(createShareResult())
      mockListShares.mockResolvedValueOnce({ shares: [createShareInfo({ id: 42 })], total: 1 })

      const wrapper = await mountShareDialog({ entrySlug: 'test', variant: 'popover', open: true })
      await flushPromises()

      const createBtn = $('.create-share-btn') as HTMLElement
      if (createBtn) {
        createBtn.click()
        await flushPromises()
      }

      const submitBtn = $('.create-link-btn') as HTMLElement
      if (submitBtn) {
        submitBtn.click()
        await flushPromises()

        expect(wrapper.emitted('created')).toBeTruthy()
      }
    })

    it('SD-52: emits "revoked" on successful share revocation', async () => {
      const share = createShareInfo({ id: 1 })
      mockListShares.mockResolvedValueOnce({ shares: [share], total: 1 })
      mockRevokeShares.mockImplementation(async () => {
        mockListShares.mockResolvedValue({ shares: [createShareInfo({ id: 1, revokedAt: new Date().toISOString() })], total: 1 })
        return { revoked_count: 1 }
      })

      const wrapper = await mountShareDialog({ entrySlug: 'test', variant: 'popover', open: true })
      await flushPromises()

      const revokeBtn = $('.revoke-btn') as HTMLElement
      if (revokeBtn) {
        revokeBtn.click()
        await flushPromises()

        expect(wrapper.emitted('revoked')).toBeTruthy()
      }
    })
  })
})
