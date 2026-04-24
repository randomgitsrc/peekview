import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'

// Import design system
import './styles/variables.css'
import './styles/dark.css'
import './styles/light.css'
import './styles/components.css'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: () => import('./views/EntryListView.vue') },
    { path: '/:slug', component: () => import('./views/EntryDetailView.vue') },
  ],
})

const app = createApp(App)
app.use(router)
app.mount('#app')
