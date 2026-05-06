import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/EntryListView.vue'),
  },
  {
    path: '/entries',
    name: 'entries',
    component: () => import('@/views/EntryListView.vue'),
  },
  {
    path: '/entries/:slug',
    name: 'entry-detail',
    component: () => import('@/views/EntryDetailView.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
