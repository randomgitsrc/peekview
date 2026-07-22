import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

vi.stubGlobal('__APP_VERSION__', '0.0.0-test')

vi.mock('@/api/client', () => ({
  api: {
    logout: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    getMe: vi.fn(),
  },
}))

const LandingView = () => import('@/views/LandingView.vue')

function createTestRouter(initialRoute = '/') {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'landing', component: { template: '<div>landing</div>' } },
      { path: '/explore', name: 'explore', component: { template: '<div>explore</div>' } },
      { path: '/:slug', name: 'detail', component: { template: '<div>detail</div>' } },
    ],
  })
}

async function mountLanding(authOverrides: Record<string, any> = {}, initialRoute = '/') {
  const pinia = createPinia()
  setActivePinia(pinia)

  const router = createTestRouter(initialRoute)
  router.push(initialRoute)
  await router.isReady()

  const authStore = useAuthStore()
  Object.assign(authStore, authOverrides)

  const LandingViewComp = (await LandingView()).default

  const wrapper = mount(LandingViewComp, {
    global: {
      plugins: [pinia, router],
      stubs: {
        ThemeToggle: true,
        LoginDialog: true,
      },
    },
  })

  return { wrapper, router, authStore, pinia }
}

const mockUser = {
  id: 1,
  username: 'alice',
  displayName: 'Alice',
  isActive: true,
  isAdmin: false,
  createdAt: '2026-01-01',
}

describe('T065: LandingView auth state bugs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('BDD-1: Authenticated user full-page load → redirected to /explore', () => {
    it('calls router.replace("/explore") when authState is already "authenticated" on mount', async () => {
      const { router } = await mountLanding({
        initializing: false,
        user: mockUser,
      })

      const replaceSpy = vi.spyOn(router, 'replace')
      await flushPromises()

      expect(replaceSpy).toHaveBeenCalledWith('/explore')
    })
  })

  describe('BDD-2: Sign in button visible when anonymous', () => {
    it('renders Sign in button when authState is "anonymous"', async () => {
      const { wrapper } = await mountLanding({
        initializing: false,
        user: null,
      })

      const signInBtn = wrapper.find('.nav-cta button.btn-ghost')
      expect(signInBtn.exists()).toBe(true)
      expect(signInBtn.text()).toContain('Sign in')
    })
  })

  describe('BDD-3: Sign in button NOT visible when authenticated', () => {
    it('does NOT render Sign in button when authState is "authenticated"', async () => {
      const { wrapper } = await mountLanding({
        initializing: false,
        user: mockUser,
      })

      const signInBtn = wrapper.find('.nav-cta button.btn-ghost')
      expect(signInBtn.exists()).toBe(false)
    })
  })

  describe('BDD-4: Authenticated user sees user identity in nav', () => {
    it('renders userName in nav area when authState is "authenticated"', async () => {
      const { wrapper } = await mountLanding({
        initializing: false,
        user: mockUser,
      })

      const userMenu = wrapper.find('.user-menu-wrapper, .user-name, .user-menu-trigger')
      expect(userMenu.exists() || wrapper.text().includes('alice')).toBe(true)
    })
  })

  describe('BDD-5: Anonymous user login → redirect (no regression)', () => {
    it('triggers router.replace("/explore") when authState changes from anonymous to authenticated', async () => {
      const { wrapper, authStore, router } = await mountLanding({
        initializing: false,
        user: null,
      })

      const replaceSpy = vi.spyOn(router, 'replace')
      await flushPromises()
      replaceSpy.mockClear()

      authStore.user = mockUser
      await flushPromises()

      expect(replaceSpy).toHaveBeenCalledWith('/explore')
    })
  })

  describe('BDD-6: fetchMe in progress → landing renders normally', () => {
    it('renders landing page with logo when authState is "loading"', async () => {
      const { wrapper, router } = await mountLanding({
        initializing: true,
        user: null,
      })

      const replaceSpy = vi.spyOn(router, 'replace')
      await flushPromises()

      expect(wrapper.find('.brand').exists()).toBe(true)
      expect(wrapper.find('.word').text()).toBe('PeekView')
      expect(replaceSpy).not.toHaveBeenCalledWith('/explore')
    })

    it('Sign in button is NOT shown when authState is "loading"', async () => {
      const { wrapper } = await mountLanding({
        initializing: true,
        user: null,
      })

      const signInBtn = wrapper.find('.nav-cta button.btn-ghost')
      expect(signInBtn.exists()).toBe(false)
    })
  })
})
