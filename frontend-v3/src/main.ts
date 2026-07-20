import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router.ts'
import { useAuthStore } from './stores/auth'
import './styles/variables.css'
import './styles/base.css'
import './styles/layout.css'
import 'katex/dist/katex.min.css'

// CAP_CUSTOM_WASM_URL must be set before @cap.js/widget is loaded.
// cap.js reads this at module-evaluation time to determine WASM fetch URL.
// This works because @cap.js/widget is only imported inside LoginDialog.vue,
// which is lazy-loaded via router — so cap.js loads AFTER main.ts executes.
window.CAP_CUSTOM_WASM_URL = '/wasm/cap_wasm_bg.wasm'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

// Fetch current user before mounting (prevents UI flash)
const authStore = useAuthStore()
authStore.fetchMe().finally(() => {
  app.mount('#app')
})