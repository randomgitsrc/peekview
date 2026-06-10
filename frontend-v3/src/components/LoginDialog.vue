<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div v-if="visible" class="login-overlay" @click.self="close">
        <div
          class="login-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="login-title"
          @keydown.escape="close"
        >
          <h2 id="login-title" class="login__title">
            {{ mode === 'login' ? 'Login' : 'Register' }}
          </h2>

          <form @submit.prevent="submit" class="login__form">
            <div class="login__field">
              <label for="login-username">Username</label>
              <input
                id="login-username"
                ref="firstInput"
                v-model="username"
                type="text"
                autocomplete="username"
                :disabled="loading"
                placeholder="3-32 characters"
              />
            </div>

            <div class="login__field">
              <label for="login-password">Password</label>
              <div class="login__password-wrapper">
                <input
                  id="login-password"
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  autocomplete="current-password"
                  :disabled="loading"
                  placeholder="At least 8 characters"
                />
                <button
                  type="button"
                  class="login__toggle-pw"
                  @click="showPassword = !showPassword"
                  :aria-label="showPassword ? 'Hide password' : 'Show password'"
                >
                  {{ showPassword ? '&#128065;' : '&#128064;' }}
                </button>
              </div>
            </div>

            <div v-if="mode === 'register'" class="login__field">
              <label for="login-confirm">Confirm Password</label>
              <input
                id="login-confirm"
                v-model="confirmPassword"
                type="password"
                autocomplete="new-password"
                :disabled="loading"
                placeholder="Re-enter password"
              />
            </div>

            <div v-if="mode === 'register'" class="login__field">
              <label for="login-display">Display Name (optional)</label>
              <input
                id="login-display"
                v-model="displayName"
                type="text"
                :disabled="loading"
                placeholder="How others see you"
              />
            </div>

            <div v-if="captchaEnabled" class="login__captcha">
              <cap-widget
                :data-cap-api-endpoint="captchaEndpoint"
                @solve="onCaptchaSolve"
                @error="onCaptchaError"
              />
            </div>

            <div v-if="error" class="login__error">{{ error }}</div>

            <button
              type="submit"
              class="login__submit"
              :disabled="loading || !formValid || (captchaEnabled && !captchaToken)"
            >
              {{ loading ? 'Please wait...' : (mode === 'login' ? 'Login' : 'Register') }}
            </button>
          </form>

          <div v-if="allowRegistration" class="login__switch">
            <template v-if="mode === 'login'">
              Don't have an account?
              <button type="button" @click="mode = 'register'" class="login__switch-btn">Register</button>
            </template>
            <template v-else>
              Already have an account?
              <button type="button" @click="mode = 'login'" class="login__switch-btn">Login</button>
            </template>
          </div>

          <button type="button" class="login__close" @click="close" aria-label="Close">&times;</button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import '@cap.js/widget'

defineProps<{
  allowRegistration?: boolean
}>()

const visible = defineModel<boolean>('visible', { default: false })
const authStore = useAuthStore()
const toast = useToast()

const mode = ref<'login' | 'register'>('login')
const username = ref('')
const password = ref('')
const confirmPassword = ref('')
const displayName = ref('')
const showPassword = ref(false)
const error = ref<string | null>(null)
const loading = ref(false)
const firstInput = ref<HTMLInputElement | null>(null)

// Captcha state
const captchaEnabled = ref(false)
const captchaEndpoint = ref('')
const captchaToken = ref<string | null>(null)

async function loadCaptchaConfig() {
  try {
    const resp = await fetch('/api/v1/config/captcha')
    if (resp.ok) {
      const cfg = await resp.json()
      captchaEnabled.value = cfg.enabled
      let ep = cfg.endpoint || '/api/v1/captcha'
      if (!ep.endsWith('/')) ep += '/'
      captchaEndpoint.value = ep
    }
  } catch {
    captchaEnabled.value = false
  }
}

function onCaptchaSolve(e: CustomEvent) {
  captchaToken.value = e.detail.token
}

function onCaptchaError(e: CustomEvent) {
  console.error('Captcha error:', e.detail)
  error.value = 'Captcha verification failed. Please try again.'
}

const formValid = computed(() => {
  if (username.value.length < 3 || username.value.length > 32) return false
  if (password.value.length < 8) return false
  if (mode.value === 'register' && password.value !== confirmPassword.value) return false
  return true
})

watch(visible, async (v) => {
  if (v) {
    error.value = null
    username.value = ''
    password.value = ''
    confirmPassword.value = ''
    displayName.value = ''
    captchaToken.value = null
    mode.value = 'login'
    await loadCaptchaConfig()
    await nextTick()
    firstInput.value?.focus()
  }
})

async function submit() {
  if (!formValid.value) return
  error.value = null
  loading.value = true

  try {
    if (mode.value === 'login') {
      await authStore.login(username.value, password.value, captchaToken.value || undefined)
      toast.show('Logged in successfully', 'success')
    } else {
      await authStore.register(username.value, password.value, displayName.value, captchaToken.value || undefined)
      toast.show('Account created', 'success')
    }
    visible.value = false
  } catch (err: any) {
    const code = err?.response?.data?.error?.code
    const msg = err?.response?.data?.error?.message || err?.message || 'Operation failed'
    if (code === 'CAPTCHA_REQUIRED') {
      error.value = 'Please complete the captcha verification.'
    } else if (code === 'CAPTCHA_INVALID') {
      error.value = 'Captcha verification failed. Please try again.'
    } else {
      error.value = msg
    }
    captchaToken.value = null
  } finally {
    loading.value = false
  }
}

function close() {
  visible.value = false
}
</script>

<style scoped>
.login-overlay {
  position: fixed;
  inset: 0;
  background: var(--bg-overlay);
  z-index: 9997;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-dialog {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 24px;
  max-width: 400px;
  width: 90%;
  position: relative;
}

.login__title {
  margin: 0 0 20px;
  font-size: 20px;
  color: var(--text-primary);
}

.login__form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.login__field label {
  display: block;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.login__field input {
  width: 100%;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px;
}

.login__field input:focus {
  outline: 2px solid var(--accent-color);
  outline-offset: -1px;
}

.login__password-wrapper {
  position: relative;
}

.login__password-wrapper input {
  width: 100%;
  padding-right: 36px;
}

.login__toggle-pw {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-secondary);
  padding: 4px;
}

.login__error {
  color: var(--error-text);
  font-size: 13px;
  padding: 8px 0;
}

.login__submit {
  padding: 10px 16px;
  border-radius: 6px;
  border: none;
  background: var(--accent-color);
  color: var(--text-on-accent);
  font-size: 14px;
  cursor: pointer;
}

.login__submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.login__switch {
  margin-top: 16px;
  font-size: 13px;
  color: var(--text-secondary);
  text-align: center;
}

.login__switch-btn {
  background: none;
  border: none;
  color: var(--accent-color);
  cursor: pointer;
  font-size: 13px;
  padding: 0;
}

.login__close {
  position: absolute;
  top: 12px;
  right: 12px;
  background: none;
  border: none;
  font-size: 20px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
}

.dialog-enter-active { transition: opacity 0.2s ease; }
.dialog-leave-active { transition: opacity 0.2s ease; }
.dialog-enter-from { opacity: 0; }
.dialog-leave-to { opacity: 0; }

.login__captcha {
  margin: 8px 0;
}
</style>