import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { watch } from 'vue'
import { useAuthStore } from './stores/auth'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'landing',
    component: () => import('./views/LandingView.vue'),
  },
  {
    path: '/explore',
    name: 'explore',
    component: () => import('./views/EntryListView.vue'),
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('./views/SettingsView.vue'),
  },
  {
    path: '/settings/apikeys',
    redirect: { path: '/settings', query: { tab: 'apikeys' } },
  },
  {
    path: '/stars',
    name: 'stars',
    component: () => import('./views/StarManageView.vue'),
  },
  {
    path: '/teams',
    name: 'teams',
    component: () => import('./views/TeamsView.vue'),
  },
  {
    path: '/users/:username',
    name: 'user-entries',
    component: () => import('./views/EntryListView.vue'),
    props: (route) => ({ owner: route.params.username as string }),
  },
  {
    path: '/admin',
    name: 'admin-not-found',
    component: () => import('./views/NotFoundView.vue'),
  },
  {
    path: '/:slug',
    name: 'detail',
    component: () => import('./views/EntryDetailView.vue'),
    props: true,
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('./views/NotFoundView.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, _from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    }
    if (to.hash) {
      return {
        el: to.hash,
        behavior: 'smooth',
      }
    }
    return { top: 0 }
  },
})

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

router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  if (authStore.authState === 'loading') {
    await waitForAuthInit(authStore, 5000)
  }
  if (to.path === '/') {
    if (authStore.authState === 'authenticated') return '/explore'
  }
  if (to.path === '/settings') {
    if (authStore.authState !== 'authenticated') return '/'
  }
  if (to.path === '/stars') {
    if (authStore.authState !== 'authenticated') return '/'
  }
  if (to.path === '/teams') {
    if (authStore.authState !== 'authenticated') return '/'
  }
})

export default router
