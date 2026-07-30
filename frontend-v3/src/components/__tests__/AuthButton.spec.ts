import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import AuthButton from '@/components/AuthButton.vue'

const routerLinkStub = {
  template: '<a><slot /></a>',
}

function mockMatchMedia(isMobile: boolean) {
  const listeners: ((e: MediaQueryListEvent) => void)[] = []
  const mql = {
    matches: isMobile,
    media: '(max-width: 640px)',
    addEventListener: vi.fn((_: string, cb: (e: MediaQueryListEvent) => void) => {
      listeners.push(cb)
    }),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }
  vi.stubGlobal('matchMedia', vi.fn(() => mql))
  return { mql, listeners }
}

describe('AuthButton', () => {
  beforeEach(() => {
    vi.stubGlobal('__APP_VERSION__', '0.0.0-test')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('BDD-01: marketing pageType renders primary variant "Sign in"', () => {
    mockMatchMedia(false)
    const wrapper = mount(AuthButton, {
      props: { pageType: 'marketing' },
      global: { stubs: { 'router-link': routerLinkStub } },
    })
    const btn = wrapper.find('button')
    expect(btn.classes()).toContain('btn-primary')
    expect(btn.text()).toBe('Sign in')
  })

  it('BDD-01: marketing pageType renders primary even on mobile', () => {
    mockMatchMedia(true)
    const wrapper = mount(AuthButton, {
      props: { pageType: 'marketing' },
      global: { stubs: { 'router-link': routerLinkStub } },
    })
    const btn = wrapper.find('button')
    expect(btn.classes()).toContain('btn-primary')
    expect(btn.text()).toBe('Sign in')
  })

  it('BDD-02: functional pageType desktop (>=641px) renders secondary variant', () => {
    mockMatchMedia(false)
    const wrapper = mount(AuthButton, {
      props: { pageType: 'functional' },
      global: { stubs: { 'router-link': routerLinkStub } },
    })
    const btn = wrapper.find('button')
    expect(btn.classes()).toContain('btn-secondary')
    expect(btn.text()).toBe('Sign in')
  })

  it('BDD-03: functional pageType tablet (641px-1023px) renders secondary variant', () => {
    mockMatchMedia(false)
    const wrapper = mount(AuthButton, {
      props: { pageType: 'functional' },
      global: { stubs: { 'router-link': routerLinkStub } },
    })
    const btn = wrapper.find('button')
    expect(btn.classes()).toContain('btn-secondary')
    expect(btn.text()).toBe('Sign in')
  })

  it('BDD-04: functional pageType mobile (<=640px) renders ghost variant', () => {
    mockMatchMedia(true)
    const wrapper = mount(AuthButton, {
      props: { pageType: 'functional' },
      global: { stubs: { 'router-link': routerLinkStub } },
    })
    const btn = wrapper.find('button')
    expect(btn.classes()).toContain('btn-ghost')
    expect(btn.text()).toBe('Sign in')
  })

  it('BDD-05: functional pageType desktop renders secondary (for Detail page)', () => {
    mockMatchMedia(false)
    const wrapper = mount(AuthButton, {
      props: { pageType: 'functional' },
      global: { stubs: { 'router-link': routerLinkStub } },
    })
    const btn = wrapper.find('button')
    expect(btn.classes()).toContain('btn-secondary')
    expect(btn.text()).toBe('Sign in')
  })

  it('BDD-06: functional pageType mobile renders ghost (for Detail page)', () => {
    mockMatchMedia(true)
    const wrapper = mount(AuthButton, {
      props: { pageType: 'functional' },
      global: { stubs: { 'router-link': routerLinkStub } },
    })
    const btn = wrapper.find('button')
    expect(btn.classes()).toContain('btn-ghost')
    expect(btn.text()).toBe('Sign in')
  })

  it('emits sign-in event when clicked', async () => {
    mockMatchMedia(false)
    const wrapper = mount(AuthButton, {
      props: { pageType: 'marketing' },
      global: { stubs: { 'router-link': routerLinkStub } },
    })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('sign-in')).toBeTruthy()
    expect(wrapper.emitted('sign-in')!.length).toBe(1)
  })

  it('uses size="small"', () => {
    mockMatchMedia(false)
    const wrapper = mount(AuthButton, {
      props: { pageType: 'marketing' },
      global: { stubs: { 'router-link': routerLinkStub } },
    })
    expect(wrapper.find('button').classes()).toContain('btn-small')
  })
})
