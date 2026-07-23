import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/api/client'
import type { User, AuthState } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const initializing = ref(true)
  const authLoading = ref(false)

  const authState = computed<AuthState>(() => {
    if (initializing.value) return 'loading'
    if (user.value) return 'authenticated'
    return 'anonymous'
  })

  const isAdmin = computed(() => user.value?.isAdmin ?? false)

  const isOwner = computed(() => {
    return (entryOwnerId: number | null) => {
      if (!user.value) return false
      if (user.value.isAdmin) return true
      if (entryOwnerId === null) return false
      return entryOwnerId === user.value.id
    }
  })

  async function login(username: string, password: string, captchaToken?: string): Promise<void> {
    authLoading.value = true
    try {
      const result = await api.login(username, password, captchaToken)
      user.value = result.user
    } finally {
      authLoading.value = false
    }
  }

  async function register(username: string, password: string, displayName?: string, captchaToken?: string): Promise<void> {
    authLoading.value = true
    try {
      const result = await api.register(username, password, displayName, captchaToken)
      user.value = result.user
    } finally {
      authLoading.value = false
    }
  }

  function logout(): void {
    api.logout()
    user.value = null
  }

  async function fetchMe(): Promise<void> {
    try {
      user.value = await api.getMe()
    } catch {
      user.value = null
    } finally {
      initializing.value = false
    }
  }

  async function updateProfile(displayName: string | null): Promise<void> {
    const updated = await api.updateProfile(displayName)
    user.value = updated
  }

  window.addEventListener('peekview:auth-expired', () => {
    if (!initializing.value) {
      user.value = null
    }
  })

  return {
    user,
    initializing,
    authLoading,
    authState,
    isAdmin,
    isOwner,
    login,
    register,
    logout,
    fetchMe,
    updateProfile,
  }
})
