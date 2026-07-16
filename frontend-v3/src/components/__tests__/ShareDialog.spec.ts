import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ShareDialogContent from '@/components/ShareDialogContent.vue'
import ShareDialog from '@/components/ShareDialog.vue'

describe('ShareDialogContent — BDD behavior contracts', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('BDD-21: renders empty state when no active share links', () => {
    const wrapper = mount(ShareDialogContent, {
      props: { entrySlug: 'test-entry' }
    })
    expect(wrapper.text()).toContain('No active share links')
  })

  it('BDD-21: shows create share link button in empty state', () => {
    const wrapper = mount(ShareDialogContent, {
      props: { entrySlug: 'test-entry' }
    })
    expect(wrapper.find('[data-testid="create-share-btn"]').exists()).toBe(true)
  })

  it('BDD-10a: switches to create view on create button click', async () => {
    const wrapper = mount(ShareDialogContent, {
      props: { entrySlug: 'test-entry' }
    })
    await wrapper.find('[data-testid="create-share-btn"]').trigger('click')
    expect(wrapper.vm.currentView).toBe('create')
  })

  it('BDD-10a: create view has expiry and maxViews selectors', async () => {
    const wrapper = mount(ShareDialogContent, {
      props: { entrySlug: 'test-entry' }
    })
    await wrapper.find('[data-testid="create-share-btn"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="expires-select"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="max-views-select"]').exists()).toBe(true)
  })

  it('BDD-09: expired links section exists', () => {
    const wrapper = mount(ShareDialogContent, {
      props: { entrySlug: 'test-entry' }
    })
    expect(wrapper.find('[data-testid="expired-section"]').exists()).toBe(true)
  })

  it('BDD-23: Escape key emits close', async () => {
    const wrapper = mount(ShareDialogContent, {
      props: { entrySlug: 'test-entry' }
    })
    await wrapper.find('[data-testid="share-content"]').trigger('keydown.escape')
    expect(wrapper.emitted('close')).toBeTruthy()
  })
})

describe('ShareDialog — BDD container contracts', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('BDD-12: popover variant renders Popover container', () => {
    const wrapper = mount(ShareDialog, {
      props: { entrySlug: 'test-entry', variant: 'popover' },
      global: { stubs: { ShareDialogContent: true } }
    })
    expect(wrapper.find('[data-testid="share-popover"]').exists()).toBe(true)
  })

  it('BDD-14: sheet variant renders Bottom Sheet container', () => {
    const wrapper = mount(ShareDialog, {
      props: { entrySlug: 'test-entry', variant: 'sheet' },
      global: { stubs: { ShareDialogContent: true } }
    })
    expect(wrapper.find('[data-testid="share-sheet"]').exists()).toBe(true)
  })

  it('BDD-22: share trigger button exists', () => {
    const wrapper = mount(ShareDialog, {
      props: { entrySlug: 'test-entry', variant: 'popover' },
      global: { stubs: { ShareDialogContent: true } }
    })
    expect(wrapper.find('[data-testid="share-trigger-btn"]').exists()).toBe(true)
  })
})
