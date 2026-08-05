import { describe, it, expect, vi } from 'vitest'
import { nextTick, watch } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

vi.mock('@/api/client', () => ({
  api: {
    listEntries: vi.fn(),
    logout: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    getMe: vi.fn().mockResolvedValue(null),
    deleteEntry: vi.fn(),
    toggleEntryVisibility: vi.fn(),
    getEntry: vi.fn(),
    getFileContent: vi.fn(),
    listUsers: vi.fn(),
    disableUser: vi.fn(),
    enableUser: vi.fn(),
    promoteUser: vi.fn(),
    demoteUser: vi.fn(),
    resetUserPassword: vi.fn(),
    deleteUser: vi.fn(),
  },
}))

function waitForAuthInit(authStore: ReturnType<typeof useAuthStore>, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, ms)
    const stop = watch(() => authStore.initializing, (val) => {
      if (!val) {
        clearTimeout(timeout)
        stop()
        resolve()
      }
    }, { immediate: true })
  })
}

const ADMIN_USER = { id: 1, username: 'admin', displayName: null, isActive: true, isAdmin: true, createdAt: '' }
const NORMAL_USER = { id: 2, username: 'bob', displayName: null, isActive: true, isAdmin: false, createdAt: '' }

function createGuardedRouter(authStore: ReturnType<typeof useAuthStore>, timeoutMs = 5000) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'landing', component: { render: () => null } },
      { path: '/explore', name: 'explore', component: { render: () => null } },
      { path: '/settings', name: 'settings', component: { render: () => null } },
      {
        path: '/admin',
        name: 'admin',
        component: { render: () => null },
        meta: { requiresAdmin: true },
      },
      { path: '/:slug', name: 'detail', component: { render: () => null }, props: true },
    ],
  })

  router.beforeEach(async (to) => {
    if (authStore.authState === 'loading') {
      await waitForAuthInit(authStore, timeoutMs)
    }
    if (to.path === '/') {
      if (authStore.authState === 'authenticated') return '/explore'
    }
    if (to.path === '/settings') {
      if (authStore.authState !== 'authenticated') return '/'
    }
    if (to.meta.requiresAdmin) {
      if (authStore.authState !== 'authenticated') return '/'
      if (!authStore.isAdmin) return '/explore'
    }
  })

  return router
}

describe('BDD-14: non-admin user access /admin is refused', () => {
  it('test_bdd_14: authenticated non-admin redirected to /explore', async () => {
    setActivePinia(createPinia())
    const authStore = useAuthStore()
    authStore.initializing = false
    authStore.user = NORMAL_USER

    const router = createGuardedRouter(authStore)

    await router.push('/admin')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/explore')
  })

  it('test_bdd_14b: admin user can access /admin', async () => {
    setActivePinia(createPinia())
    const authStore = useAuthStore()
    authStore.initializing = false
    authStore.user = ADMIN_USER

    const router = createGuardedRouter(authStore)

    await router.push('/admin')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/admin')
  })
})

describe('BDD-15: unauthenticated user access /admin is refused', () => {
  it('test_bdd_15: unauthenticated redirected to /', async () => {
    setActivePinia(createPinia())
    const authStore = useAuthStore()
    authStore.initializing = false
    authStore.user = null

    const router = createGuardedRouter(authStore)

    await router.push('/admin')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/')
  })

  it('test_bdd_15b: loading state resolves then unauthenticated redirects to /', async () => {
    setActivePinia(createPinia())
    const authStore = useAuthStore()
    authStore.initializing = true
    authStore.user = null

    const router = createGuardedRouter(authStore)

    const pushPromise = router.push('/admin')
    await nextTick()

    authStore.user = null
    authStore.initializing = false
    await nextTick()

    await pushPromise
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/')
  })

  it('test_bdd_15c: loading state resolves to admin user, access granted', async () => {
    setActivePinia(createPinia())
    const authStore = useAuthStore()
    authStore.initializing = true
    authStore.user = null

    const router = createGuardedRouter(authStore)

    const pushPromise = router.push('/admin')
    await nextTick()

    authStore.user = ADMIN_USER
    authStore.initializing = false
    await nextTick()

    await pushPromise
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/admin')
  })
})
