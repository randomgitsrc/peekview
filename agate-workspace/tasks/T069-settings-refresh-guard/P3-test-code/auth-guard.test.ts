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

function createGuardedRouter(authStore: ReturnType<typeof useAuthStore>, timeoutMs = 5000) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'landing', component: { render: () => null } },
      { path: '/explore', name: 'explore', component: { render: () => null } },
      { path: '/settings', name: 'settings', component: { render: () => null } },
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
  })

  return router
}

describe('BDD-1: Authenticated user full-page refresh /settings stays on /settings', () => {
  it('test_bdd_1: when authState transitions from loading→authenticated, guard does not redirect from /settings', async () => {
    setActivePinia(createPinia())
    const authStore = useAuthStore()
    authStore.initializing = true
    authStore.user = null

    const router = createGuardedRouter(authStore)

    const pushPromise = router.push('/settings')
    await nextTick()

    authStore.user = { id: 1, username: 'alice', displayName: null, isActive: true, isAdmin: false, createdAt: '' }
    authStore.initializing = false
    await nextTick()

    await pushPromise
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/settings')
  })
})

describe('BDD-2: Unauthenticated user full-page refresh /settings redirects to /', () => {
  it('test_bdd_2: when authState transitions from loading→anonymous, guard redirects /settings to /', async () => {
    setActivePinia(createPinia())
    const authStore = useAuthStore()
    authStore.initializing = true
    authStore.user = null

    const router = createGuardedRouter(authStore)

    const pushPromise = router.push('/settings')
    await nextTick()

    authStore.user = null
    authStore.initializing = false
    await nextTick()

    await pushPromise
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/')
  })
})

describe('BDD-3: Authenticated user SPA navigation to /settings works', () => {
  it('test_bdd_3: when initializing=false and authenticated, SPA nav to /settings succeeds', async () => {
    setActivePinia(createPinia())
    const authStore = useAuthStore()
    authStore.initializing = false
    authStore.user = { id: 1, username: 'alice', displayName: null, isActive: true, isAdmin: false, createdAt: '' }

    const router = createGuardedRouter(authStore)

    await router.push('/settings')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/settings')
  })
})

describe('BDD-4: Authenticated user full-page refresh / redirects to /explore', () => {
  it('test_bdd_4: when authState transitions from loading→authenticated, guard redirects / to /explore', async () => {
    setActivePinia(createPinia())
    const authStore = useAuthStore()
    authStore.initializing = true
    authStore.user = null

    const router = createGuardedRouter(authStore)

    const pushPromise = router.push('/')
    await nextTick()

    authStore.user = { id: 1, username: 'alice', displayName: null, isActive: true, isAdmin: false, createdAt: '' }
    authStore.initializing = false
    await nextTick()

    await pushPromise
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/explore')
  })
})

describe('BDD-5: Unauthenticated user full-page refresh / stays on /', () => {
  it('test_bdd_5: when authState transitions from loading→anonymous, guard does not redirect from /', async () => {
    setActivePinia(createPinia())
    const authStore = useAuthStore()
    authStore.initializing = true
    authStore.user = null

    const router = createGuardedRouter(authStore)

    const pushPromise = router.push('/')
    await nextTick()

    authStore.user = null
    authStore.initializing = false
    await nextTick()

    await pushPromise
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/')
  })
})

describe('BDD-6: Auth guard does not hang indefinitely', () => {
  it('test_bdd_6: guard resolves within timeout even if fetchMe never completes', async () => {
    setActivePinia(createPinia())
    const authStore = useAuthStore()
    authStore.initializing = true
    authStore.user = null

    const TIMEOUT_MS = 300
    const router = createGuardedRouter(authStore, TIMEOUT_MS)

    const start = Date.now()
    await router.push('/settings')
    await router.isReady()
    const elapsed = Date.now() - start

    expect(elapsed).toBeLessThan(5000)
    expect(router.currentRoute.value.path).toBe('/')
  })
})
