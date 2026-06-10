import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/api/client'
import type { User, AuthState } from '@/types'

const TOKEN_KEY = 'peekview_token'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY))
  const initializing = ref(true)
  const authLoading = ref(false)

  const authState = computed<AuthState>(() => {
    if (initializing.value) return 'loading'
    if (token.value && user.value) return 'authenticated'
    return 'anonymous'
  })

  const isAdmin = computed(() => user.value?.isAdmin ?? false)

  const isOwner = computed(() => {
    return (entryOwnerId: number | null) => {
      if (!user.value) return false
      // Admin can manage all entries (including owner_id=null)
      if (user.value.isAdmin) return true
      // Legacy entries with no owner: admin only
      if (entryOwnerId === null) return false
      return entryOwnerId === user.value.id
    }
  })

  async function login(username: string, password: string, captchaToken?: string): Promise<void> {
    authLoading.value = true
    try {
      const result = await api.login(username, password, captchaToken)
      token.value = result.accessToken
      user.value = result.user
    } finally {
      authLoading.value = false
    }
  }

  async function register(username: string, password: string, displayName?: string, captchaToken?: string): Promise<void> {
    authLoading.value = true
    try {
      const result = await api.register(username, password, displayName, captchaToken)
      token.value = result.accessToken
      user.value = result.user
    } finally {
      authLoading.value = false
    }
  }

  function logout(): void {
    api.logout()
    token.value = null
    user.value = null
  }

  async function fetchMe(): Promise<void> {
    const storedToken = localStorage.getItem(TOKEN_KEY)
    if (!storedToken) {
      initializing.value = false
      return
    }

    try {
      token.value = storedToken
      user.value = await api.getMe()
    } catch {
      // Token invalid/expired — clear silently (no toast on startup)
      localStorage.removeItem(TOKEN_KEY)
      token.value = null
      user.value = null
    } finally {
      initializing.value = false
    }
  }

  // Listen for auth-expired events from API interceptor
  window.addEventListener('peekview:auth-expired', () => {
    if (!initializing.value) {
      token.value = null
      user.value = null
    }
  })

  return {
    user,
    token,
    initializing,
    authLoading,
    authState,
    isAdmin,
    isOwner,
    login,
    register,
    logout,
    fetchMe,
  }
})