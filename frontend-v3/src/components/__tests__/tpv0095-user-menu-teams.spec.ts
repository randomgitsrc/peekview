import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, type Ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import UserMenu from '@/components/UserMenu.vue'

// TPV0095 BDD-42：UserMenu 加 Teams 项（data-testid user-menu-teams-item）→ 跳 /teams
// P3 红灯：UserMenu 现状仅 Settings/Logout 两项 → 断言失败（被测未实现）。

const mockUser = {
  id: 1,
  username: 'alice',
  displayName: 'Alice' as string | null,
  isActive: true,
  isAdmin: false,
  createdAt: '2024-01-01T00:00:00Z',
}

const mockAuthStore: {
  user: Ref<typeof mockUser | null>
  authState: Ref<string>
  isAdmin: Ref<boolean>
  logout: ReturnType<typeof vi.fn>
} = {
  user: ref(mockUser),
  authState: ref('authenticated'),
  isAdmin: ref(false),
  logout: vi.fn(),
}

const mockRouter = {
  push: vi.fn(),
}

vi.mock('vue-router', () => ({
  useRouter: () => mockRouter,
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => mockAuthStore,
  storeToRefs: (s: any) => ({
    user: s.user,
    isAdmin: s.isAdmin,
  }),
}))

const routerLinkStub = {
  template: '<a :href="to"><slot /></a>',
  props: ['to'],
}

describe('UserMenu — Teams 入口（BDD-42）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('__APP_VERSION__', '0.0.0-test')
    mockRouter.push.mockReset()
    mockAuthStore.logout.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('bdd42_user_menu_contains_teams_item', async () => {
    const wrapper = mount(UserMenu, {
      global: { stubs: { 'router-link': routerLinkStub } },
    })
    await wrapper.find('.user-menu-trigger').trigger('click')
    expect(wrapper.find('[data-testid="user-menu-teams-item"]').exists()).toBe(true)
  })

  it('bdd42_clicking_teams_item_navigates_to_teams_page', async () => {
    const wrapper = mount(UserMenu, {
      global: { stubs: { 'router-link': routerLinkStub } },
    })
    await wrapper.find('.user-menu-trigger').trigger('click')
    await wrapper.find('[data-testid="user-menu-teams-item"]').trigger('click')
    const target = mockRouter.push.mock.calls[mockRouter.push.mock.calls.length - 1]?.[0]
    expect(target).toBe('/teams')
  })
})
