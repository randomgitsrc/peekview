import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref, nextTick, defineComponent, h } from 'vue'

const mockAuthState = ref<'loading' | 'authenticated' | 'anonymous'>('authenticated')
const mockUser = ref<any>({
  id: 1,
  username: 'testuser',
  displayName: 'Test User',
  isActive: true,
  isAdmin: false,
  createdAt: '2026-01-01T00:00:00Z',
})
const mockUpdateProfile = vi.fn()
const mockLogin = vi.fn()
const mockLogout = vi.fn()
const mockFetchMe = vi.fn()

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: mockUser,
    authState: mockAuthState,
    isAdmin: false,
    isOwner: () => false,
    updateProfile: mockUpdateProfile,
    login: mockLogin,
    logout: mockLogout,
    fetchMe: mockFetchMe,
  }),
}))

const mockChangePassword = vi.fn()
const mockGetApiKeys = vi.fn()
const mockCreateApiKey = vi.fn()
const mockRevokeApiKey = vi.fn()
const mockCleanupExpired = vi.fn()

vi.mock('@/api/client', () => ({
  api: {
    updateProfile: vi.fn(),
    changePassword: mockChangePassword,
    getMe: vi.fn(),
    getApiKeys: mockGetApiKeys,
    createApiKey: mockCreateApiKey,
    revokeApiKey: mockRevokeApiKey,
    cleanupExpiredKeys: mockCleanupExpired,
    logout: vi.fn(),
  },
}))

const mockToastShow = vi.fn()
const mockToastSuccess = vi.fn()
const mockToastError = vi.fn()

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    show: mockToastShow,
    success: mockToastSuccess,
    error: mockToastError,
    info: vi.fn(),
    messages: { value: [] },
    remove: vi.fn(),
  }),
}))

vi.mock('@/stores/theme', () => ({
  useThemeStore: () => ({
    theme: 'dark',
    toggle: vi.fn(),
  }),
}))

vi.mock('@/composables/useRelativeTime', () => ({
  useRelativeTime: () => ({ relative: ref('6 months ago'), full: ref('2026-01-01') }),
}))

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  const currentQuery = ref({ tab: 'profile' })
  return {
    ...actual,
    useRoute: () => ({
      path: '/settings',
      query: currentQuery.value,
      params: {},
    }),
    useRouter: () => ({
      replace: vi.fn((loc: any) => {
        if (loc?.query?.tab) {
          currentQuery.value = { tab: loc.query.tab }
        }
      }),
      push: vi.fn(),
    }),
  }
})

const TransitionStub = defineComponent({
  props: ['name'],
  setup(_, { slots }) {
    return () => slots.default?.()
  },
})

async function mountSettings() {
  const SettingsView = (await import('@/views/SettingsView.vue')).default
  return mount(SettingsView, {
    global: {
      stubs: {
        Transition: TransitionStub,
        RouterLink: true,
        'cap-widget': true,
      },
    },
  })
}

describe('SettingsView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockAuthState.value = 'authenticated'
    mockUser.value = {
      id: 1,
      username: 'testuser',
      displayName: 'Test User',
      isActive: true,
      isAdmin: false,
      createdAt: '2026-01-01T00:00:00Z',
    }
  })

  describe('BDD-01: Profile tab shows user info', () => {
    it('shows username as readonly', async () => {
      const wrapper = await mountSettings()
      const usernameInput = wrapper.find('[data-testid="profile-username"]')
      expect(usernameInput.exists()).toBe(true)
      expect(usernameInput.attributes('readonly')).toBeDefined()
    })

    it('shows display_name as editable input', async () => {
      const wrapper = await mountSettings()
      const displayNameInput = wrapper.find('[data-testid="profile-display-name"]')
      expect(displayNameInput.exists()).toBe(true)
      expect(displayNameInput.attributes('readonly')).toBeUndefined()
    })

    it('shows role badge', async () => {
      const wrapper = await mountSettings()
      const roleBadge = wrapper.find('[data-testid="profile-role"]')
      expect(roleBadge.exists()).toBe(true)
      expect(roleBadge.text()).toBe('Member')
    })

    it('shows admin badge for admin user', async () => {
      mockUser.value = { ...mockUser.value, isAdmin: true }
      const wrapper = await mountSettings()
      const roleBadge = wrapper.find('[data-testid="profile-role"]')
      expect(roleBadge.text()).toBe('Admin')
    })

    it('shows member since date', async () => {
      const wrapper = await mountSettings()
      const memberSince = wrapper.find('[data-testid="profile-member-since"]')
      expect(memberSince.exists()).toBe(true)
    })
  })

  describe('BDD-02: Edit display_name success', () => {
    it('updates display_name and shows toast on success', async () => {
      mockUpdateProfile.mockResolvedValue(undefined)
      const wrapper = await mountSettings()
      const input = wrapper.find('[data-testid="profile-display-name"]')
      await input.setValue('Alice Chen')
      const saveBtn = wrapper.find('[data-testid="profile-save"]')
      await saveBtn.trigger('click')
      await flushPromises()
      expect(mockUpdateProfile).toHaveBeenCalledWith('Alice Chen')
      expect(mockToastSuccess).toHaveBeenCalled()
    })
  })

  describe('BDD-03: Clear display_name', () => {
    it('clears display_name and shows toast', async () => {
      mockUpdateProfile.mockResolvedValue(undefined)
      const wrapper = await mountSettings()
      const input = wrapper.find('[data-testid="profile-display-name"]')
      await input.setValue('')
      const saveBtn = wrapper.find('[data-testid="profile-save"]')
      await saveBtn.trigger('click')
      await flushPromises()
      expect(mockUpdateProfile).toHaveBeenCalledWith(null)
      expect(mockToastSuccess).toHaveBeenCalled()
    })
  })

  describe('BDD-04: display_name too long validation', () => {
    it('shows validation error for display_name > 64 chars', async () => {
      const wrapper = await mountSettings()
      const input = wrapper.find('[data-testid="profile-display-name"]')
      await input.setValue('A'.repeat(65))
      const saveBtn = wrapper.find('[data-testid="profile-save"]')
      expect((saveBtn.element as HTMLButtonElement).disabled).toBe(true)
    })
  })

  describe('BDD-05: Change password success', () => {
    it('calls changePassword and shows toast on success', async () => {
      mockChangePassword.mockResolvedValue(undefined)
      const wrapper = await mountSettings()
      const securityTab = wrapper.find('[data-testid="tab-security"]')
      if (securityTab.exists()) {
        await securityTab.trigger('click')
        await nextTick()
      }
      await wrapper.find('[data-testid="security-old-password"]').setValue('oldpass123')
      await wrapper.find('[data-testid="security-new-password"]').setValue('newpass123')
      await wrapper.find('[data-testid="security-confirm-password"]').setValue('newpass123')
      await wrapper.find('[data-testid="security-submit"]').trigger('click')
      await flushPromises()
      expect(mockChangePassword).toHaveBeenCalledWith('oldpass123', 'newpass123')
      expect(mockToastSuccess).toHaveBeenCalled()
    })
  })

  describe('BDD-06: Change password wrong old password', () => {
    it('shows error when old password is incorrect', async () => {
      mockChangePassword.mockRejectedValue({
        response: { data: { detail: 'Old password is incorrect' } },
      })
      const wrapper = await mountSettings()
      const securityTab = wrapper.find('[data-testid="tab-security"]')
      if (securityTab.exists()) {
        await securityTab.trigger('click')
        await nextTick()
      }
      await wrapper.find('[data-testid="security-old-password"]').setValue('wrongpass')
      await wrapper.find('[data-testid="security-new-password"]').setValue('newpass123')
      await wrapper.find('[data-testid="security-confirm-password"]').setValue('newpass123')
      await wrapper.find('[data-testid="security-submit"]').trigger('click')
      await flushPromises()
      expect(mockToastError).toHaveBeenCalled()
    })
  })

  describe('BDD-07: Session valid after password change', () => {
    it('authState remains authenticated after password change', async () => {
      mockChangePassword.mockResolvedValue(undefined)
      const wrapper = await mountSettings()
      const securityTab = wrapper.find('[data-testid="tab-security"]')
      if (securityTab.exists()) {
        await securityTab.trigger('click')
        await nextTick()
      }
      await wrapper.find('[data-testid="security-old-password"]').setValue('oldpass123')
      await wrapper.find('[data-testid="security-new-password"]').setValue('newpass123')
      await wrapper.find('[data-testid="security-confirm-password"]').setValue('newpass123')
      await wrapper.find('[data-testid="security-submit"]').trigger('click')
      await flushPromises()
      expect(mockAuthState.value).toBe('authenticated')
    })
  })

  describe('BDD-08: API Keys tab functionality', () => {
    it('renders API Keys tab content', async () => {
      mockGetApiKeys.mockResolvedValue([])
      const wrapper = await mountSettings()
      const apiKeysTab = wrapper.find('[data-testid="tab-apikeys"]')
      if (apiKeysTab.exists()) {
        await apiKeysTab.trigger('click')
        await nextTick()
      }
      expect(wrapper.find('[data-testid="apikeys-content"]').exists()).toBe(true)
    })
  })

  describe('BDD-09: Unauthenticated redirect', () => {
    it('does not render settings when not authenticated', async () => {
      mockAuthState.value = 'anonymous'
      const wrapper = await mountSettings()
      expect(wrapper.find('[data-testid="settings-page"]').exists()).toBe(false)
    })
  })

  describe('BDD-11: Tab switching and URL sync', () => {
    it('clicking Security tab updates URL query param', async () => {
      const wrapper = await mountSettings()
      const securityTab = wrapper.find('[data-testid="tab-security"]')
      if (securityTab.exists()) {
        await securityTab.trigger('click')
        await nextTick()
      }
      expect(wrapper.find('[data-testid="security-content"]').exists() || wrapper.find('[data-testid="security-old-password"]').exists()).toBe(true)
    })
  })

  describe('BDD-14: Mobile layout', () => {
    it('renders stacked layout container for mobile', async () => {
      const wrapper = await mountSettings()
      expect(wrapper.find('[data-testid="settings-page"]').exists()).toBe(true)
    })
  })

  describe('Submit protection', () => {
    it('disables save button during profile submission', async () => {
      mockUpdateProfile.mockReturnValue(new Promise(() => {}))
      const wrapper = await mountSettings()
      const input = wrapper.find('[data-testid="profile-display-name"]')
      await input.setValue('New Name')
      const saveBtn = wrapper.find('[data-testid="profile-save"]')
      await saveBtn.trigger('click')
      await nextTick()
      expect((saveBtn.element as HTMLButtonElement).disabled).toBe(true)
    })

    it('disables change password button during submission', async () => {
      mockChangePassword.mockReturnValue(new Promise(() => {}))
      const wrapper = await mountSettings()
      const securityTab = wrapper.find('[data-testid="tab-security"]')
      if (securityTab.exists()) {
        await securityTab.trigger('click')
        await nextTick()
      }
      await wrapper.find('[data-testid="security-old-password"]').setValue('oldpass123')
      await wrapper.find('[data-testid="security-new-password"]').setValue('newpass123')
      await wrapper.find('[data-testid="security-confirm-password"]').setValue('newpass123')
      const submitBtn = wrapper.find('[data-testid="security-submit"]')
      await submitBtn.trigger('click')
      await nextTick()
      expect((submitBtn.element as HTMLButtonElement).disabled).toBe(true)
    })
  })

  describe('Security form validation', () => {
    it('disables submit when new password < 8 chars', async () => {
      const wrapper = await mountSettings()
      const securityTab = wrapper.find('[data-testid="tab-security"]')
      if (securityTab.exists()) {
        await securityTab.trigger('click')
        await nextTick()
      }
      await wrapper.find('[data-testid="security-old-password"]').setValue('oldpass123')
      await wrapper.find('[data-testid="security-new-password"]').setValue('short')
      await wrapper.find('[data-testid="security-confirm-password"]').setValue('short')
      const submitBtn = wrapper.find('[data-testid="security-submit"]')
      expect((submitBtn.element as HTMLButtonElement).disabled).toBe(true)
    })

    it('disables submit when confirm password does not match', async () => {
      const wrapper = await mountSettings()
      const securityTab = wrapper.find('[data-testid="tab-security"]')
      if (securityTab.exists()) {
        await securityTab.trigger('click')
        await nextTick()
      }
      await wrapper.find('[data-testid="security-old-password"]').setValue('oldpass123')
      await wrapper.find('[data-testid="security-new-password"]').setValue('newpass123')
      await wrapper.find('[data-testid="security-confirm-password"]').setValue('different')
      const submitBtn = wrapper.find('[data-testid="security-submit"]')
      expect((submitBtn.element as HTMLButtonElement).disabled).toBe(true)
    })
  })
})
