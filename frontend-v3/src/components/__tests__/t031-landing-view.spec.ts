import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import LandingView from '@/views/LandingView.vue'

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: ref(null),
    authState: ref('anonymous'),
    isAdmin: ref(false),
    login: vi.fn(),
    logout: vi.fn(),
    checkAuth: vi.fn(),
  }),
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

vi.stubGlobal('__APP_VERSION__', '0.0.0-test')

const routerLinkStub = {
  template: '<a :href="to"><slot /></a>',
  props: ['to'],
}

describe('T031 BDD-5: navigation button text', () => {
  it('hero-cta and cta-band buttons should say "Browse public", not "Explore"', () => {
    setActivePinia(createPinia())
    const wrapper = mount(LandingView, {
      global: {
        stubs: {
          'router-link': routerLinkStub,
          LoginDialog: true,
          ThemeToggle: true,
        },
      },
    })

    const links = wrapper.findAll('a.btn-primary')
    expect(links.length).toBeGreaterThanOrEqual(2)

    for (const link of links) {
      expect(link.text()).not.toBe('Explore')
      expect(link.text()).toBe('Browse public')
    }
  })
})
