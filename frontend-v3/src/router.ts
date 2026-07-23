import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
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
    path: '/users/:username',
    name: 'user-entries',
    component: () => import('./views/EntryListView.vue'),
    props: (route) => ({ owner: route.params.username as string }),
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

router.beforeEach((to, _from) => {
  if (to.path === '/') {
    const authStore = useAuthStore()
    if (authStore.authState === 'authenticated') {
      return '/explore'
    }
  }
  if (to.path === '/settings') {
    const authStore = useAuthStore()
    if (authStore.authState !== 'authenticated') {
      return '/'
    }
  }
})

export default router
