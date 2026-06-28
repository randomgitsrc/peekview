import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { h, defineComponent } from 'vue'
import LoginDialog from '@/components/LoginDialog.vue'

const mocks = vi.hoisted(() => ({
  mockLogin: vi.fn(),
  mockRegister: vi.fn(),
  mockToastShow: vi.fn(),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    login: mocks.mockLogin,
    register: mocks.mockRegister,
    logout: vi.fn(),
  }),
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
  return mount(LoginDialog, {
    props: { visible, allowRegistration: true, ...extraProps },
    global: {
      stubs: {
        Teleport: TeleportStub,
        Transition: TransitionStub,
        'cap-widget': true,
      },
    },
  })
}

describe('LoginDialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('does not render when visible is false', () => {
    const wrapper = mountDialog(false)
    expect(wrapper.find('.login-overlay').exists()).toBe(false)
  })

  it('renders when visible is true', () => {
    const wrapper = mountDialog(true)
    expect(wrapper.find('.login-overlay').exists()).toBe(true)
    expect(wrapper.find('.login-dialog').exists()).toBe(true)
  })

  it('renders login form with title', () => {
    const wrapper = mountDialog(true)
    expect(wrapper.find('#login-title').text()).toBe('Login')
    expect(wrapper.find('#login-username').exists()).toBe(true)
    expect(wrapper.find('#login-password').exists()).toBe(true)
  })

  it('toggles to register mode', async () => {
    const wrapper = mountDialog(true)
    expect(wrapper.find('#login-title').text()).toBe('Login')
    expect(wrapper.find('#login-confirm').exists()).toBe(false)

    await wrapper.find('.login__switch-btn').trigger('click')

    expect(wrapper.find('#login-title').text()).toBe('Register')
    expect(wrapper.find('#login-confirm').exists()).toBe(true)
    expect(wrapper.find('#login-display').exists()).toBe(true)
  })

  it('toggles back to login mode from register', async () => {
    const wrapper = mountDialog(true)
    await wrapper.find('.login__switch-btn').trigger('click')
    expect(wrapper.find('#login-title').text()).toBe('Register')

    await wrapper.find('.login__switch-btn').trigger('click')
    expect(wrapper.find('#login-title').text()).toBe('Login')
  })

  it('submit button disabled when form invalid', () => {
    const wrapper = mountDialog(true)
    const btn = wrapper.find('.login__submit')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('submit button disabled with short username', async () => {
    const wrapper = mountDialog(true)
    await wrapper.find('#login-username').setValue('ab')
    await wrapper.find('#login-password').setValue('12345678')
    const btn = wrapper.find('.login__submit')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('submit button disabled with short password', async () => {
    const wrapper = mountDialog(true)
    await wrapper.find('#login-username').setValue('validuser')
    await wrapper.find('#login-password').setValue('short')
    const btn = wrapper.find('.login__submit')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('submit button enabled when form valid', async () => {
    const wrapper = mountDialog(true)
    await wrapper.find('#login-username').setValue('validuser')
    await wrapper.find('#login-password').setValue('12345678')
    const btn = wrapper.find('.login__submit')
    expect((btn.element as HTMLButtonElement).disabled).toBe(false)
  })

  it('register mode requires matching passwords', async () => {
    const wrapper = mountDialog(true)
    await wrapper.find('.login__switch-btn').trigger('click')

    await wrapper.find('#login-username').setValue('validuser')
    await wrapper.find('#login-password').setValue('12345678')
    await wrapper.find('#login-confirm').setValue('different')
    const btn = wrapper.find('.login__submit')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)

    await wrapper.find('#login-confirm').setValue('12345678')
    expect((btn.element as HTMLButtonElement).disabled).toBe(false)
  })

  it('calls authStore.login on submit', async () => {
    mocks.mockLogin.mockResolvedValue(undefined)
    const wrapper = mountDialog(true)
    await wrapper.find('#login-username').setValue('testuser')
    await wrapper.find('#login-password').setValue('password123')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()
    expect(mocks.mockLogin).toHaveBeenCalledWith('testuser', 'password123', undefined)
  })

  it('calls authStore.register in register mode', async () => {
    mocks.mockRegister.mockResolvedValue(undefined)
    const wrapper = mountDialog(true)
    await wrapper.find('.login__switch-btn').trigger('click')
    await wrapper.find('#login-username').setValue('testuser')
    await wrapper.find('#login-password').setValue('password123')
    await wrapper.find('#login-confirm').setValue('password123')
    await wrapper.find('#login-display').setValue('Test User')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()
    expect(mocks.mockRegister).toHaveBeenCalledWith('testuser', 'password123', 'Test User', undefined)
  })

  it('shows error on login failure', async () => {
    mocks.mockLogin.mockRejectedValue({ message: 'Invalid credentials' })
    const wrapper = mountDialog(true)
    await wrapper.find('#login-username').setValue('testuser')
    await wrapper.find('#login-password').setValue('password123')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()
    expect(wrapper.find('.login__error').exists()).toBe(true)
    expect(wrapper.find('.login__error').text()).toBe('Invalid credentials')
  })

  it('shows captcha error when CAPTCHA_REQUIRED', async () => {
    mocks.mockLogin.mockRejectedValue({
      response: { data: { error: { code: 'CAPTCHA_REQUIRED', message: 'captcha needed' } } },
    })
    const wrapper = mountDialog(true)
    await wrapper.find('#login-username').setValue('testuser')
    await wrapper.find('#login-password').setValue('password123')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()
    expect(wrapper.find('.login__error').text()).toBe('Please complete the captcha verification.')
  })

  it('shows loading state during submission', async () => {
    mocks.mockLogin.mockReturnValue(new Promise(() => {}))
    const wrapper = mountDialog(true)
    await wrapper.find('#login-username').setValue('testuser')
    await wrapper.find('#login-password').setValue('password123')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()
    const btn = wrapper.find('.login__submit')
    expect(btn.text()).toBe('Please wait...')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('closes dialog on close button click', async () => {
    const wrapper = mountDialog(true)
    await wrapper.find('.login__close').trigger('click')
    const emitted = wrapper.emitted('update:visible')
    expect(emitted).toBeTruthy()
    expect(emitted![0][0]).toBe(false)
  })

  it('closes dialog on overlay click', async () => {
    const wrapper = mountDialog(true)
    await wrapper.find('.login-overlay').trigger('click')
    const emitted = wrapper.emitted('update:visible')
    expect(emitted).toBeTruthy()
    expect(emitted![0][0]).toBe(false)
  })

  it('resets form when dialog opens', async () => {
    const wrapper = mountDialog(false)
    await wrapper.setProps({ visible: true })
    await flushPromises()
    const usernameInput = wrapper.find('#login-username').element as HTMLInputElement
    expect(usernameInput.value).toBe('')
  })

  it('toggles password visibility', async () => {
    const wrapper = mountDialog(true)
    const pwInput = wrapper.find('#login-password')
    expect(pwInput.attributes('type')).toBe('password')
    await wrapper.find('.login__toggle-pw').trigger('click')
    expect(pwInput.attributes('type')).toBe('text')
    await wrapper.find('.login__toggle-pw').trigger('click')
    expect(pwInput.attributes('type')).toBe('password')
  })

  it('hides register switch when allowRegistration is false', () => {
    const wrapper = mountDialog(true, { allowRegistration: false })
    expect(wrapper.find('.login__switch').exists()).toBe(false)
  })

  it('shows register switch by default', () => {
    const wrapper = mountDialog(true)
    expect(wrapper.find('.login__switch').exists()).toBe(true)
  })

  it('closes dialog and shows toast on successful login', async () => {
    mocks.mockLogin.mockResolvedValue(undefined)
    const wrapper = mountDialog(true)
    await wrapper.find('#login-username').setValue('testuser')
    await wrapper.find('#login-password').setValue('password123')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()
    const emitted = wrapper.emitted('update:visible')
    expect(emitted).toBeTruthy()
    if (emitted && emitted.length > 0) {
      expect(emitted[emitted.length - 1][0]).toBe(false)
    }
    expect(mocks.mockToastShow).toHaveBeenCalledWith('Logged in successfully', 'success')
  })

  it('closes dialog and shows toast on successful register', async () => {
    mocks.mockRegister.mockResolvedValue(undefined)
    const wrapper = mountDialog(true)
    await wrapper.find('.login__switch-btn').trigger('click')
    await wrapper.find('#login-username').setValue('testuser')
    await wrapper.find('#login-password').setValue('password123')
    await wrapper.find('#login-confirm').setValue('password123')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()
    const emitted = wrapper.emitted('update:visible')
    expect(emitted).toBeTruthy()
    if (emitted && emitted.length > 0) {
      expect(emitted[emitted.length - 1][0]).toBe(false)
    }
    expect(mocks.mockToastShow).toHaveBeenCalledWith('Account created', 'success')
  })
})
