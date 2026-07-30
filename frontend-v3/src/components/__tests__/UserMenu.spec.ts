import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import UserMenu from '@/components/UserMenu.vue'

const mockUser = {
  id: 1,
  username: 'alice',
  displayName: 'Alice' as string | null,
  isActive: true,
  isAdmin: false,
  createdAt: '2024-01-01T00:00:00Z',
}

const mockAdminUser = {
  ...mockUser,
  username: 'admin1',
  displayName: 'Admin User' as string | null,
  isAdmin: true,
}

function createAuthStoreMock(user: typeof mockUser | null, isAdmin = false) {
  return {
    user: ref(user),
    authState: ref(user ? 'authenticated' : 'anonymous'),
    isAdmin: ref(isAdmin),
    logout: vi.fn(),
  }
}

const routerLinkStub = {
  template: '<a :href="to"><slot /></a>',
  props: ['to'],
}

const mockRouter = {
  push: vi.fn(),
}

vi.mock('vue-router', () => ({
  useRouter: () => mockRouter,
}))

describe('UserMenu', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('__APP_VERSION__', '0.0.0-test')
    mockRouter.push.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  function mountUserMenu(authStoreMock: ReturnType<typeof createAuthStoreMock>) {
    vi.mock('@/stores/auth', () => ({
      useAuthStore: () => authStoreMock,
      storeToRefs: (s: any) => ({
        user: s.user,
        isAdmin: s.isAdmin,
      }),
    }))

    return mount(UserMenu, {
      global: {
        stubs: {
          'router-link': routerLinkStub,
        },
      },
    })
  }

  it('BDD-07: renders user menu trigger for authenticated user', () => {
    const store = createAuthStoreMock(mockUser)
    const wrapper = mountUserMenu(store)
    expect(wrapper.find('.user-menu-trigger').exists()).toBe(true)
  })

  it('BDD-07: dropdown contains Settings and Logout after clicking trigger', async () => {
    const store = createAuthStoreMock(mockUser)
    const wrapper = mountUserMenu(store)

    await wrapper.find('.user-menu-trigger').trigger('click')
    await flushPromises()

    const dropdown = wrapper.find('.user-dropdown')
    expect(dropdown.exists()).toBe(true)

    const items = wrapper.findAll('.dropdown-item')
    expect(items.length).toBe(2)
    expect(items[0].text()).toBe('Settings')
    expect(items[1].text()).toBe('Logout')
  })

  it('BDD-08: Explore page renders same Settings + Logout menu', async () => {
    const store = createAuthStoreMock(mockUser)
    const wrapper = mountUserMenu(store)

    await wrapper.find('.user-menu-trigger').trigger('click')
    await flushPromises()

    const items = wrapper.findAll('.dropdown-item')
    expect(items.length).toBe(2)
    expect(items[0].text()).toBe('Settings')
    expect(items[1].text()).toBe('Logout')
  })

  it('BDD-09: Detail desktop renders user menu with Settings + Logout', async () => {
    const store = createAuthStoreMock(mockUser)
    const wrapper = mountUserMenu(store)

    await wrapper.find('.user-menu-trigger').trigger('click')
    await flushPromises()

    const items = wrapper.findAll('.dropdown-item')
    expect(items.length).toBe(2)
    expect(items[0].text()).toBe('Settings')
    expect(items[1].text()).toBe('Logout')
  })

  it('BDD-10: Detail mobile renders user menu with Settings + Logout', async () => {
    const store = createAuthStoreMock(mockUser)
    const wrapper = mountUserMenu(store)

    await wrapper.find('.user-menu-trigger').trigger('click')
    await flushPromises()

    const items = wrapper.findAll('.dropdown-item')
    expect(items.length).toBe(2)
    expect(items[0].text()).toBe('Settings')
    expect(items[1].text()).toBe('Logout')
  })

  it('BDD-11: admin user shows admin badge in trigger', () => {
    const store = createAuthStoreMock(mockAdminUser, true)
    const wrapper = mountUserMenu(store)

    const badge = wrapper.find('.admin-badge')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe('admin')
  })

  it('BDD-11: non-admin user does not show admin badge', () => {
    const store = createAuthStoreMock(mockUser, false)
    const wrapper = mountUserMenu(store)

    expect(wrapper.find('.admin-badge').exists()).toBe(false)
  })

  it('BDD-12: menu items are consistent (Settings + Logout only)', async () => {
    const store = createAuthStoreMock(mockUser)
    const wrapper = mountUserMenu(store)

    await wrapper.find('.user-menu-trigger').trigger('click')
    await flushPromises()

    const items = wrapper.findAll('.dropdown-item')
    const texts = items.map((i) => i.text())
    expect(texts).toEqual(['Settings', 'Logout'])
  })

  it('BDD-12: admin user menu still has same items (Settings + Logout)', async () => {
    const store = createAuthStoreMock(mockAdminUser, true)
    const wrapper = mountUserMenu(store)

    await wrapper.find('.user-menu-trigger').trigger('click')
    await flushPromises()

    const items = wrapper.findAll('.dropdown-item')
    const texts = items.map((i) => i.text())
    expect(texts).toEqual(['Settings', 'Logout'])
  })

  it('BDD-17: clicking Settings navigates to /settings?tab=apikeys', async () => {
    const store = createAuthStoreMock(mockUser)
    const wrapper = mountUserMenu(store)

    await wrapper.find('.user-menu-trigger').trigger('click')
    await flushPromises()

    const settingsItem = wrapper.findAll('.dropdown-item')[0]
    await settingsItem.trigger('click')

    expect(mockRouter.push).toHaveBeenCalledWith('/settings?tab=apikeys')
  })

  it('clicking Logout calls authStore.logout and emits logout event', async () => {
    const store = createAuthStoreMock(mockUser)
    const wrapper = mountUserMenu(store)

    await wrapper.find('.user-menu-trigger').trigger('click')
    await flushPromises()

    const logoutItem = wrapper.findAll('.dropdown-item')[1]
    await logoutItem.trigger('click')

    expect(store.logout).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('logout')).toBeTruthy()
  })

  it('dropdown closes after clicking outside', async () => {
    const store = createAuthStoreMock(mockUser)
    const wrapper = mountUserMenu(store)

    await wrapper.find('.user-menu-trigger').trigger('click')
    await flushPromises()
    expect(wrapper.find('.user-dropdown').exists()).toBe(true)

    document.body.addEventListener = vi.fn()
    const clickHandler = (document.body.addEventListener as any).mock.calls.find(
      (call: any[]) => call[0] === 'click'
    )?.[1]

    if (clickHandler) {
      const outsideEvent = { target: document.createElement('div') } as unknown as MouseEvent
      clickHandler(outsideEvent)
      await flushPromises()
      expect(wrapper.find('.user-dropdown').exists()).toBe(false)
    }
  })

  it('shows user initial (first letter of displayName)', () => {
    const store = createAuthStoreMock(mockUser)
    const wrapper = mountUserMenu(store)
    expect(wrapper.find('.user-avatar').text()).toBe('A')
  })

  it('shows username when displayName is null', () => {
    const userNoDisplay = { ...mockUser, displayName: null }
    const store = createAuthStoreMock(userNoDisplay)
    const wrapper = mountUserMenu(store)
    expect(wrapper.find('.user-name').text()).toBe('alice')
    expect(wrapper.find('.user-avatar').text()).toBe('A')
  })

  it('toggles dropdown on trigger click', async () => {
    const store = createAuthStoreMock(mockUser)
    const wrapper = mountUserMenu(store)

    expect(wrapper.find('.user-dropdown').exists()).toBe(false)

    await wrapper.find('.user-menu-trigger').trigger('click')
    expect(wrapper.find('.user-dropdown').exists()).toBe(true)

    await wrapper.find('.user-menu-trigger').trigger('click')
    expect(wrapper.find('.user-dropdown').exists()).toBe(false)
  })

  it('dropdown closes after Settings click', async () => {
    const store = createAuthStoreMock(mockUser)
    const wrapper = mountUserMenu(store)

    await wrapper.find('.user-menu-trigger').trigger('click')
    await flushPromises()

    const settingsItem = wrapper.findAll('.dropdown-item')[0]
    await settingsItem.trigger('click')
    await flushPromises()

    expect(wrapper.find('.user-dropdown').exists()).toBe(false)
  })
})
