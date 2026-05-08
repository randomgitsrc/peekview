# PeekView Frontend v3.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new Vue 3 frontend with GitHub-style code viewer and VitePress-style Markdown rendering, supporting Mermaid diagrams and responsive design.

**Architecture:** Fresh Vue 3 + Vite 5 project with Pinia state management. Pure CSS for styling (no UI framework). Shiki for syntax highlighting, markdown-it for Markdown, mermaid.js for diagrams. Component-based structure with clear separation of concerns.

**Tech Stack:** Vue 3.4 + Vite 5 + TypeScript + Pinia + Vue Router 4 + Shiki + markdown-it + mermaid.js + Axios

---

## File Structure Overview

```
frontend-v3/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── public/
└── src/
    ├── main.ts
    ├── App.vue
    ├── router.ts
    ├── api/
    │   ├── client.ts          # API client with Axios
    │   └── types.ts           # API response types
    ├── components/
    │   ├── CodeViewer.vue     # GitHub-style code with line numbers
    │   ├── MarkdownViewer.vue # VitePress-style Markdown + TOC extraction
    │   ├── FileTree.vue       # File tree sidebar
    │   ├── TocNav.vue         # TOC sidebar/drawer
    │   ├── ActionBar.vue      # Copy/Download/Wrap/Pack buttons
    │   └── ThemeToggle.vue    # Dark/light mode switch
    ├── composables/
    │   ├── useShiki.ts        # Shiki highlighter singleton
    │   ├── useMarkdown.ts     # markdown-it configuration
    │   └── useMermaid.ts      # Mermaid renderer with timeout
    ├── stores/
    │   ├── theme.ts           # Theme store (Pinia)
    │   └── entry.ts           # Entry/file state store
    ├── styles/
    │   ├── variables.css      # CSS Design Tokens
    │   ├── base.css           # Reset + base styles
    │   ├── code.css           # GitHub-style code blocks
    │   ├── markdown.css       # VitePress-style Markdown
    │   └── layout.css         # Page layout + responsive
    ├── types/
    │   └── index.ts           # TypeScript interfaces
    └── views/
        ├── EntryListView.vue  # Entry list page
        └── EntryDetailView.vue # Entry detail with file viewer
```

---

## Task 1: Project Setup

**Files:**
- Create: `frontend-v3/package.json`
- Create: `frontend-v3/tsconfig.json`
- Create: `frontend-v3/vite.config.ts`
- Create: `frontend-v3/index.html`
- Create: `frontend-v3/src/main.ts`

- [ ] **Step 1: Create project directory and package.json**

```bash
mkdir -p frontend-v3/src/{api,components,composables,stores,styles,types,views}
cd frontend-v3
cat > package.json << 'JSON'
{
  "name": "peekview-frontend-v3",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc && vite build",
    "preview": "vite preview",
    "test": "vitest"
  },
  "dependencies": {
    "axios": "^1.7.0",
    "markdown-it": "^14.1.0",
    "mermaid": "^10.9.0",
    "pinia": "^2.1.7",
    "shiki": "^1.10.0",
    "vue": "^3.4.0",
    "vue-router": "^4.3.0"
  },
  "devDependencies": {
    "@types/markdown-it": "^14.1.0",
    "@types/node": "^20.0.0",
    "@vitejs/plugin-vue": "^5.0.0",
    "typescript": "^5.4.0",
    "vite": "^5.2.0",
    "vitest": "^1.6.0",
    "vue-tsc": "^2.0.0"
  }
}
JSON
```

- [ ] **Step 2: Create tsconfig.json**

```bash
cat > tsconfig.json << 'JSON'
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "preserve",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.vue"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
JSON

cat > tsconfig.node.json << 'JSON'
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
JSON
```

- [ ] **Step 3: Create vite.config.ts**

```bash
cat > vite.config.ts << 'TYPESCRIPT'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
TYPESCRIPT
```

- [ ] **Step 4: Create index.html**

```bash
cat > index.html << 'HTML'
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PeekView</title>
    <!-- Theme initialization - prevent FOUC -->
    <script>
      (function() {
        const saved = localStorage.getItem('peekview-theme')
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        const theme = saved || (prefersDark ? 'dark' : 'light')
        document.documentElement.setAttribute('data-theme', theme)
      })()
    </script>
    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
HTML
```

- [ ] **Step 5: Create main.ts**

```bash
cat > src/main.ts << 'TYPESCRIPT'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/variables.css'
import './styles/base.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
TYPESCRIPT
```

- [ ] **Step 6: Install dependencies**

```bash
cd frontend-v3 && npm install
```

Expected: Dependencies installed successfully (no errors).

- [ ] **Step 7: Commit**

```bash
cd /home/kity/lab/projects/peekview/.worktrees/fix-scroll
git add frontend-v3/
git commit -m "feat(frontend-v3): Initialize Vue 3 project with Vite

- Add package.json with Vue 3, Pinia, Vue Router, Shiki, markdown-it, mermaid
- Configure TypeScript and Vite
- Add theme FOUC prevention in index.html
- Create main.ts entry point

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: CSS Design Tokens and Base Styles

**Files:**
- Create: `frontend-v3/src/styles/variables.css`
- Create: `frontend-v3/src/styles/base.css`

- [ ] **Step 1: Create variables.css with Design Tokens**

```bash
cat > src/styles/variables.css << 'CSS'
/* ===== Design Tokens ===== */
:root {
  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;

  /* Typography */
  --font-xs: 12px;
  --font-sm: 14px;
  --font-md: 16px;
  --font-lg: 20px;
  --font-xl: 24px;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace;

  /* Border Radius */
  --radius-sm: 3px;
  --radius-md: 6px;
  --radius-lg: 8px;

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-medium: 250ms ease;

  /* Layout */
  --header-height: 56px;
  --sidebar-width: 260px;
  --toc-width: 240px;
}

/* Light Theme (GitHub Primer) */
[data-theme="light"] {
  --bg-primary: #ffffff;
  --bg-secondary: #f6f8fa;
  --bg-tertiary: #f3f4f6;
  --bg-code: #f6f8fa;
  --bg-overlay: rgba(0, 0, 0, 0.5);

  --border-color: #d0d7de;
  --border-hover: #8c959f;

  --text-primary: #1f2328;
  --text-secondary: #656d76;
  --text-tertiary: #8c959f;
  --text-on-accent: #ffffff;

  --accent-color: #0969da;
  --accent-hover: #0550ae;
  --accent-light: rgba(9, 105, 218, 0.1);

  --success-color: #1a7f37;
  --warning-color: #9a6700;
  --error-color: #cf222e;

  --tag-bg: rgba(9, 105, 218, 0.1);
  --tag-text: #0969da;

  --shadow-sm: 0 1px 2px rgba(31, 35, 40, 0.04);
  --shadow-md: 0 3px 6px rgba(31, 35, 40, 0.08);
}

/* Dark Theme (GitHub Dark) */
[data-theme="dark"] {
  --bg-primary: #0d1117;
  --bg-secondary: #161b22;
  --bg-tertiary: #21262d;
  --bg-code: #161b22;
  --bg-overlay: rgba(0, 0, 0, 0.7);

  --border-color: #30363d;
  --border-hover: #8b949e;

  --text-primary: #e6edf3;
  --text-secondary: #8b949e;
  --text-tertiary: #6e7681;
  --text-on-accent: #ffffff;

  --accent-color: #3b82f6;
  --accent-hover: #2563eb;
  --accent-light: rgba(59, 130, 246, 0.15);

  --success-color: #3fb950;
  --warning-color: #d29922;
  --error-color: #f85149;

  --tag-bg: rgba(59, 130, 246, 0.2);
  --tag-text: #58a6ff;

  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);
}
CSS
```

- [ ] **Step 2: Create base.css**

```bash
cat > src/styles/base.css << 'CSS'
/* ===== Reset ===== */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  scroll-behavior: smooth;
}

html, body {
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Helvetica, Arial, sans-serif;
  font-size: var(--font-md);
  line-height: 1.5;
  background: var(--bg-primary);
  color: var(--text-primary);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code, pre {
  font-family: var(--font-mono);
  font-size: 0.9em;
}

/* ===== Scrollbar ===== */
::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

::-webkit-scrollbar-track {
  background: var(--bg-secondary);
}

::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: var(--radius-md);
  border: 2px solid var(--bg-secondary);
}

::-webkit-scrollbar-thumb:hover {
  background: var(--border-hover);
}

/* ===== Links ===== */
a {
  color: var(--accent-color);
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

/* ===== Buttons ===== */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  height: 32px;
  padding: 0 var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: var(--font-sm);
  font-weight: 500;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.btn:hover {
  background: var(--bg-tertiary);
  border-color: var(--border-hover);
  color: var(--text-primary);
}

.btn-primary {
  background: var(--accent-color);
  border-color: var(--accent-color);
  color: var(--text-on-accent);
}

.btn-primary:hover {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}

.btn-ghost {
  background: transparent;
  border-color: transparent;
}

.btn-ghost:hover {
  background: var(--bg-tertiary);
}

.btn-icon {
  width: 32px;
  height: 32px;
  padding: 0;
}

.btn.active {
  background: var(--accent-light);
  color: var(--accent-color);
  border-color: var(--accent-color);
}

/* ===== Utility Classes ===== */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
CSS
```

- [ ] **Step 3: Test styles load correctly**

```bash
cd frontend-v3 && npm run build 2>&1 | tail -5
```

Expected: Build completes without errors.

- [ ] **Step 4: Commit**

```bash
git add frontend-v3/src/styles/
git commit -m "feat(frontend-v3): Add Design Tokens and base styles

- Create variables.css with GitHub Primer-inspired tokens
- Light/dark theme support with data-theme attribute
- Add base.css with reset, scrollbar, buttons, utilities

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Type Definitions and API Client

**Files:**
- Create: `frontend-v3/src/types/index.ts`
- Create: `frontend-v3/src/api/types.ts`
- Create: `frontend-v3/src/api/client.ts`

- [ ] **Step 1: Create types/index.ts**

```bash
cat > src/types/index.ts << 'TYPESCRIPT'
// Entry types
export interface Entry {
  id: number
  slug: string
  summary: string
  tags: string[]
  status: 'active' | 'expired'
  files: File[]
  createdAt: string
}

export interface File {
  id: number
  path: string
  filename: string
  language: string | null
  isBinary: boolean
  size: number
  lineCount: number
}

// API response types
export interface EntryListResponse {
  items: Entry[]
  total: number
  page: number
  perPage: number
}

export interface ListEntriesParams {
  q?: string
  tags?: string[]
  status?: string
  page?: number
  perPage?: number
}

// TOC types
export interface TocHeading {
  level: number
  text: string
  id: string
}

// Theme
export type Theme = 'light' | 'dark'
TYPESCRIPT
```

- [ ] **Step 2: Create api/types.ts**

```bash
cat > src/api/types.ts << 'TYPESCRIPT'
// Raw API response types (may differ from domain types)

export interface EntryResponse {
  id: number
  slug: string
  summary: string
  tags: string[]
  status: string
  files: FileResponse[]
  created_at: string
  updated_at: string
}

export interface FileResponse {
  id: number
  path: string
  filename: string
  language: string | null
  is_binary: boolean
  size: number
  line_count: number
}

export interface EntryListApiResponse {
  items: EntryResponse[]
  total: number
  page: number
  per_page: number
}
TYPESCRIPT
```

- [ ] **Step 3: Create api/client.ts**

```bash
cat > src/api/client.ts << 'TYPESCRIPT'
import axios, { type AxiosInstance } from 'axios'
import type { Entry, EntryListResponse, ListEntriesParams } from '@/types'
import type { EntryResponse, EntryListApiResponse } from './types'

const API_BASE = '/api/v1'

class PeekAPI {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }

  // Transform API response to domain model
  private transformFile(file: import('./types').FileResponse) {
    return {
      id: file.id,
      path: file.path,
      filename: file.filename,
      language: file.language,
      isBinary: file.is_binary,
      size: file.size,
      lineCount: file.line_count,
    }
  }

  private transformEntry(entry: EntryResponse): Entry {
    return {
      id: entry.id,
      slug: entry.slug,
      summary: entry.summary,
      tags: entry.tags,
      status: entry.status as 'active' | 'expired',
      files: entry.files.map(f => this.transformFile(f)),
      createdAt: entry.created_at,
    }
  }

  async listEntries(params?: ListEntriesParams): Promise<EntryListResponse> {
    const response = await this.client.get<EntryListApiResponse>('/entries', {
      params: {
        q: params?.q,
        tags: params?.tags?.join(','),
        status: params?.status,
        page: params?.page,
        per_page: params?.perPage,
      },
    })

    return {
      items: response.data.items.map(e => this.transformEntry(e)),
      total: response.data.total,
      page: response.data.page,
      perPage: response.data.per_page,
    }
  }

  async getEntry(slug: string): Promise<Entry> {
    const response = await this.client.get<EntryResponse>(`/entries/${slug}`)
    return this.transformEntry(response.data)
  }

  async getFileContent(slug: string, fileId: number): Promise<string> {
    const response = await this.client.get<string>(
      `/entries/${slug}/files/${fileId}/content`,
      { responseType: 'text' }
    )
    return response.data
  }

  downloadFile(slug: string, fileId: number): string {
    return `${API_BASE}/entries/${slug}/files/${fileId}`
  }

  downloadPack(slug: string): string {
    return `${API_BASE}/entries/${slug}/files/pack`
  }
}

export const api = new PeekAPI()
TYPESCRIPT
```

- [ ] **Step 4: Commit**

```bash
git add frontend-v3/src/types/ frontend-v3/src/api/
git commit -m "feat(frontend-v3): Add type definitions and API client

- Create domain types (Entry, File, TocHeading)
- Create API response types
- Implement PeekAPI client with axios
- Add transformers for snake_case to camelCase

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Router Configuration

**Files:**
- Create: `frontend-v3/src/router.ts`
- Modify: `frontend-v3/src/App.vue`

- [ ] **Step 1: Create router.ts**

```bash
cat > src/router.ts << 'TYPESCRIPT'
import { createRouter, createWebHashHistory } from 'vue-router'
import EntryListView from './views/EntryListView.vue'
import EntryDetailView from './views/EntryDetailView.vue'

const routes = [
  {
    path: '/',
    name: 'list',
    component: EntryListView,
  },
  {
    path: '/entry/:slug',
    name: 'detail',
    component: EntryDetailView,
    props: true,
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    }
    if (to.hash) {
      return { el: to.hash, behavior: 'smooth' }
    }
    return { top: 0 }
  },
})

export default router
TYPESCRIPT
```

- [ ] **Step 2: Create basic App.vue**

```bash
cat > src/App.vue << 'VUE'
<template>
  <router-view />
</template>

<style>
/* App-level styles */
#app {
  height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>
VUE
```

- [ ] **Step 3: Create placeholder views**

```bash
cat > src/views/EntryListView.vue << 'VUE'
<template>
  <div class="entry-list">
    <h1>PeekView Entries</h1>
    <p>Loading...</p>
  </div>
</template>

<style scoped>
.entry-list {
  padding: 24px;
}
</style>
VUE

cat > src/views/EntryDetailView.vue << 'VUE'
<template>
  <div class="entry-detail">
    <h1>Entry Detail</h1>
    <p>Slug: {{ slug }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  slug: string
}>()
</script>

<style scoped>
.entry-detail {
  padding: 24px;
}
</style>
VUE
```

- [ ] **Step 4: Test dev server starts**

```bash
cd frontend-v3 && timeout 10 npm run dev 2>&1 | head -20 || true
```

Expected: Vite dev server starts on port 5173.

- [ ] **Step 5: Commit**

```bash
git add frontend-v3/src/router.ts frontend-v3/src/App.vue frontend-v3/src/views/
git commit -m "feat(frontend-v3): Add Vue Router configuration

- Create hash-mode router
- Add scrollBehavior for hash navigation
- Create placeholder views
- Update App.vue with router-view

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: Theme Store

**Files:**
- Create: `frontend-v3/src/stores/theme.ts`

- [ ] **Step 1: Create theme store**

```bash
cat > src/stores/theme.ts << 'TYPESCRIPT'
import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import type { Theme } from '@/types'

const STORAGE_KEY = 'peekview-theme'

export const useThemeStore = defineStore('theme', () => {
  // Initialize from localStorage or system preference
  const getInitialTheme = (): Theme => {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null
    if (saved === 'light' || saved === 'dark') {
      return saved
    }
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    return prefersDark ? 'dark' : 'light'
  }

  const theme = ref<Theme>(getInitialTheme())

  // Apply theme to document
  const applyTheme = (t: Theme) => {
    document.documentElement.setAttribute('data-theme', t)
  }

  // Toggle between light and dark
  const toggle = () => {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
  }

  // Set specific theme
  const setTheme = (t: Theme) => {
    theme.value = t
  }

  // Watch for changes and persist
  watch(theme, (newTheme) => {
    applyTheme(newTheme)
    localStorage.setItem(STORAGE_KEY, newTheme)
  }, { immediate: true })

  // Listen for system theme changes
  if (typeof window !== 'undefined') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', (e) => {
      // Only auto-switch if user hasn't manually set a preference
      if (!localStorage.getItem(STORAGE_KEY)) {
        theme.value = e.matches ? 'dark' : 'light'
      }
    })
  }

  return {
    theme,
    toggle,
    setTheme,
  }
})
TYPESCRIPT
```

- [ ] **Step 2: Create ThemeToggle component**

```bash
cat > src/components/ThemeToggle.vue << 'VUE'
<template>
  <button
    class="btn btn-icon"
    :title="theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'"
    @click="toggle"
  >
    <span v-if="theme === 'light'">🌙</span>
    <span v-else>☀️</span>
  </button>
</template>

<script setup lang="ts">
import { useThemeStore } from '@/stores/theme'
import { storeToRefs } from 'pinia'

const store = useThemeStore()
const { theme } = storeToRefs(store)
const { toggle } = store
</script>
VUE
```

- [ ] **Step 3: Commit**

```bash
git add frontend-v3/src/stores/theme.ts frontend-v3/src/components/ThemeToggle.vue
git commit -m "feat(frontend-v3): Add theme store and toggle

- Create Pinia store for light/dark theme
- Persist theme preference to localStorage
- Listen for system theme changes
- Create ThemeToggle component

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: Entry Store

**Files:**
- Create: `frontend-v3/src/stores/entry.ts`

- [ ] **Step 1: Create entry store**

```bash
cat > src/stores/entry.ts << 'TYPESCRIPT'
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/api/client'
import type { Entry, File, EntryListResponse, ListEntriesParams } from '@/types'

export const useEntryStore = defineStore('entry', () => {
  // State
  const entries = ref<Entry[]>([])
  const currentEntry = ref<Entry | null>(null)
  const activeFile = ref<File | null>(null)
  const fileContent = ref<string>('')
  const wrapEnabled = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Getters
  const isMultiFile = computed(() => {
    return currentEntry.value ? currentEntry.value.files.length > 1 : false
  })

  const canWrap = computed(() => {
    return activeFile.value && !activeFile.value.isBinary && activeFile.value.language !== 'markdown'
  })

  const canCopy = computed(() => {
    return activeFile.value && !activeFile.value.isBinary
  })

  const canDownload = computed(() => {
    return !!activeFile.value
  })

  const canPack = computed(() => {
    return currentEntry.value ? currentEntry.value.files.length > 1 : false
  })

  // Actions
  async function loadEntries(params?: ListEntriesParams) {
    loading.value = true
    error.value = null
    try {
      const response = await api.listEntries(params)
      entries.value = response.items
      return response
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load entries'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function loadEntry(slug: string) {
    loading.value = true
    error.value = null
    try {
      const entry = await api.getEntry(slug)
      currentEntry.value = entry
      // Auto-select first file if none selected
      if (entry.files.length > 0 && !activeFile.value) {
        await selectFile(entry.files[0])
      }
      return entry
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load entry'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function selectFile(file: File) {
    if (activeFile.value?.id === file.id) return

    activeFile.value = file
    fileContent.value = ''

    if (!file.isBinary) {
      try {
        const slug = currentEntry.value?.slug
        if (!slug) return
        fileContent.value = await api.getFileContent(slug, file.id)
      } catch (e) {
        error.value = e instanceof Error ? e.message : 'Failed to load file content'
      }
    }
  }

  function toggleWrap() {
    wrapEnabled.value = !wrapEnabled.value
  }

  function clearEntry() {
    currentEntry.value = null
    activeFile.value = null
    fileContent.value = ''
    error.value = null
  }

  return {
    // State
    entries,
    currentEntry,
    activeFile,
    fileContent,
    wrapEnabled,
    loading,
    error,
    // Getters
    isMultiFile,
    canWrap,
    canCopy,
    canDownload,
    canPack,
    // Actions
    loadEntries,
    loadEntry,
    selectFile,
    toggleWrap,
    clearEntry,
  }
})
TYPESCRIPT
```

- [ ] **Step 2: Commit**

```bash
git add frontend-v3/src/stores/entry.ts
git commit -m "feat(frontend-v3): Add entry store

- Manage entry list and current entry state
- Track active file and file content
- Computed getters for UI state (canWrap, canCopy, etc.)
- Actions for loading entries and selecting files

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: Shiki Composable

**Files:**
- Create: `frontend-v3/src/composables/useShiki.ts`
- Create: `frontend-v3/src/styles/code.css`

- [ ] **Step 1: Create useShiki composable**

```bash
cat > src/composables/useShiki.ts << 'TYPESCRIPT'
import { ref } from 'vue'
import {
  createHighlighter,
  type Highlighter,
  type BundledLanguage,
} from 'shiki'

// Static imports for common languages
import python from 'shiki/dist/langs/python.mjs'
import javascript from 'shiki/dist/langs/javascript.mjs'
import typescript from 'shiki/dist/langs/typescript.mjs'
import markdown from 'shiki/dist/langs/markdown.mjs'
import json from 'shiki/dist/langs/json.mjs'
import html from 'shiki/dist/langs/html.mjs'
import css from 'shiki/dist/langs/css.mjs'
import bash from 'shiki/dist/langs/bash.mjs'
import yaml from 'shiki/dist/langs/yaml.mjs'
import rust from 'shiki/dist/langs/rust.mjs'
import go from 'shiki/dist/langs/go.mjs'
import java from 'shiki/dist/langs/java.mjs'
import cpp from 'shiki/dist/langs/cpp.mjs'
import c from 'shiki/dist/langs/c.mjs'
import sql from 'shiki/dist/langs/sql.mjs'

import githubDark from 'shiki/dist/themes/github-dark.mjs'
import githubLight from 'shiki/dist/themes/github-light.mjs'

const commonLangs = [
  python, javascript, typescript, markdown, json,
  html, css, bash, yaml, rust, go, java, cpp, c, sql
]

let highlighterPromise: Promise<Highlighter> | null = null
const isReady = ref(false)
const loadError = ref<string | null>(null)

export function useShiki() {
  function getHighlighter(): Promise<Highlighter> {
    if (!highlighterPromise) {
      highlighterPromise = createHighlighter({
        themes: [githubDark as any, githubLight as any],
        langs: commonLangs as any[],
      })
        .then((hl) => {
          isReady.value = true
          return hl
        })
        .catch((err) => {
          loadError.value = err.message || 'Failed to initialize Shiki'
          highlighterPromise = null
          throw err
        })
    }
    return highlighterPromise
  }

  async function highlight(code: string, lang: string, theme: 'dark' | 'light'): Promise<string> {
    const hl = await getHighlighter()
    const themeName = theme === 'light' ? 'github-light' : 'github-dark'

    // Check if language is loaded
    const loadedLangs = hl.getLoadedLanguages()
    const useLang = loadedLangs.includes(lang as BundledLanguage) ? lang : 'text'

    return hl.codeToHtml(code, { lang: useLang, theme: themeName })
  }

  return {
    getHighlighter,
    highlight,
    isReady,
    loadError,
  }
}
TYPESCRIPT
```

- [ ] **Step 2: Create code.css**

```bash
cat > src/styles/code.css << 'CSS'
/* ===== GitHub-style Code Viewer ===== */
.code-viewer {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-code);
}

.code-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  font-size: var(--font-sm);
}

.code-header .filename {
  font-weight: 600;
  color: var(--text-primary);
}

.code-header .lang {
  color: var(--text-tertiary);
  text-transform: uppercase;
  font-size: var(--font-xs);
}

.code-header .actions {
  margin-left: auto;
  display: flex;
  gap: var(--space-2);
}

.code-body {
  overflow-x: auto;
  max-height: calc(100vh - 200px);
}

/* Shiki output styling */
.code-body :deep(pre) {
  margin: 0;
  padding: var(--space-4);
  background: transparent !important;
  overflow-x: auto;
}

.code-body :deep(code) {
  font-family: var(--font-mono);
  font-size: var(--font-sm);
  line-height: 1.6;
}

/* Line-based styling for hash navigation */
.code-body :deep(.line) {
  display: block;
  padding: 0 var(--space-3);
}

.code-body :deep(.line:target) {
  background: var(--accent-light);
}

/* Wrap mode */
.code-body.wrap-enabled :deep(pre) {
  white-space: pre-wrap;
  word-wrap: break-word;
}

/* Fallback pre styling */
.code-body pre {
  margin: 0;
  padding: var(--space-4);
  background: var(--bg-code);
  overflow-x: auto;
  font-family: var(--font-mono);
  font-size: var(--font-sm);
  line-height: 1.6;
}

/* Loading skeleton */
.code-loading {
  padding: var(--space-4);
}

.code-skeleton {
  display: flex;
  gap: var(--space-3);
  padding: 2px 0;
}

.skeleton-line-number {
  width: 30px;
  height: 14px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.skeleton-line-content {
  flex: 1;
  height: 14px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-sm);
  max-width: 60%;
}
CSS
```

- [ ] **Step 3: Commit**

```bash
git add frontend-v3/src/composables/useShiki.ts frontend-v3/src/styles/code.css
git commit -m "feat(frontend-v3): Add Shiki composable and code styles

- Create useShiki composable with static language imports
- Support 15 common languages
- Add GitHub-style code.css with header/body structure
- Support wrap mode and line highlighting

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 8: CodeViewer Component

**Files:**
- Create: `frontend-v3/src/components/CodeViewer.vue`

- [ ] **Step 1: Create CodeViewer.vue**

```bash
cat > src/components/CodeViewer.vue << 'VUE'
<template>
  <div class="code-viewer">
    <!-- Header -->
    <div class="code-header">
      <span class="filename">{{ filename }}</span>
      <span v-if="language" class="lang">{{ language }}</span>
      <div class="actions">
        <button class="btn btn-sm" @click="copyCode">Copy</button>
        <button 
          v-if="canWrap"
          class="btn btn-sm"
          :class="{ active: wrap }"
          @click="$emit('toggle-wrap')"
        >
          Wrap
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="code-loading">
      <div v-for="i in 8" :key="i" class="code-skeleton">
        <span class="skeleton-line-number"></span>
        <span class="skeleton-line-content"></span>
      </div>
    </div>

    <!-- Code content -->
    <div 
      v-else 
      class="code-body"
      :class="{ 'wrap-enabled': wrap }"
      v-html="highlightedCode"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useShiki } from '@/composables/useShiki'
import { useThemeStore } from '@/stores/theme'
import { storeToRefs } from 'pinia'

const props = defineProps<{
  content: string
  filename: string
  language: string | null
  wrap: boolean
  canWrap: boolean
  loading?: boolean
}>()

const emit = defineEmits<{
  'toggle-wrap': []
}>()

const { highlight } = useShiki()
const themeStore = useThemeStore()
const { theme } = storeToRefs(themeStore)

const highlightedCode = ref('')
const isHighlighting = ref(false)

const language = computed(() => props.language || 'text')

async function doHighlight() {
  if (!props.content) {
    highlightedCode.value = ''
    return
  }

  isHighlighting.value = true
  try {
    highlightedCode.value = await highlight(
      props.content,
      language.value,
      theme.value
    )
  } catch (err) {
    console.error('Highlight error:', err)
    // Fallback to plain text
    highlightedCode.value = `<pre><code>${escapeHtml(props.content)}</code></pre>`
  } finally {
    isHighlighting.value = false
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

async function copyCode() {
  try {
    await navigator.clipboard.writeText(props.content)
    // Could emit event for toast notification
  } catch (err) {
    console.error('Copy failed:', err)
  }
}

// Watch for content or theme changes
watch(
  () => [props.content, language.value, theme.value],
  () => doHighlight(),
  { immediate: true }
)
</script>

<style scoped>
@import '@/styles/code.css';
</style>
VUE
```

- [ ] **Step 2: Commit**

```bash
git add frontend-v3/src/components/CodeViewer.vue
git commit -m "feat(frontend-v3): Add CodeViewer component

- GitHub-style header with filename, language, actions
- Shiki syntax highlighting with theme support
- Copy and Wrap buttons
- Loading skeleton state
- Fallback to plain text on error

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

---

## Task 9: Markdown Composable

**Files:**
- Create: `frontend-v3/src/composables/useMarkdown.ts`
- Create: `frontend-v3/src/styles/markdown.css`

- [ ] **Step 1: Create useMarkdown composable**

```bash
cat > src/composables/useMarkdown.ts << 'TYPESCRIPT'
import MarkdownIt from 'markdown-it'
import { useShiki } from './useShiki'
import type { TocHeading } from '@/types'

export function useMarkdown() {
  const { highlight } = useShiki()

  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
  })

  function slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50)
  }

  function render(content: string): { html: string; headings: TocHeading[] } {
    const headings: TocHeading[] = []

    // Custom renderer to extract headings
    const originalHeading = md.renderer.rules.heading_open
    md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
      const token = tokens[idx]
      const level = parseInt(token.tag.substring(1))
      
      if (level >= 2 && level <= 4) {
        const nextToken = tokens[idx + 1]
        if (nextToken && nextToken.type === 'inline') {
          const text = nextToken.content
          const id = slugify(text)
          token.attrSet('id', id)
          headings.push({ level, text, id })
        }
      }

      return originalHeading
        ? originalHeading(tokens, idx, options, env, self)
        : self.renderToken(tokens, idx, options)
    }

    const html = md.render(content)
    return { html, headings }
  }

  return { render }
}
TYPESCRIPT
```

- [ ] **Step 2: Create markdown.css**

```bash
cat > src/styles/markdown.css << 'CSS'
/* ===== VitePress-style Markdown ===== */
.markdown-body {
  line-height: 1.7;
  color: var(--text-primary);
  max-width: none;
  padding: var(--space-5);
}

/* Headings */
.markdown-body h1,
.markdown-body h2,
.markdown-body h3,
.markdown-body h4 {
  margin-top: var(--space-6);
  margin-bottom: var(--space-4);
  font-weight: 600;
  line-height: 1.3;
  scroll-margin-top: 80px;
}

.markdown-body h1 {
  font-size: var(--font-xl);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--border-color);
}

.markdown-body h2 {
  font-size: var(--font-lg);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--border-color);
}

.markdown-body h3 { font-size: var(--font-md); }
.markdown-body h4 { font-size: var(--font-sm); }

/* Anchor link */
.markdown-body h1[id]::before,
.markdown-body h2[id]::before,
.markdown-body h3[id]::before {
  content: '#';
  margin-right: var(--space-2);
  color: var(--accent-color);
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.markdown-body h1[id]:hover::before,
.markdown-body h2[id]:hover::before,
.markdown-body h3[id]:hover::before {
  opacity: 1;
}

/* Paragraphs */
.markdown-body p {
  margin-bottom: var(--space-4);
}

/* Lists */
.markdown-body ul,
.markdown-body ol {
  margin-bottom: var(--space-4);
  padding-left: var(--space-5);
}

.markdown-body li {
  margin-bottom: var(--space-1);
}

.markdown-body li > ul,
.markdown-body li > ol {
  margin-top: var(--space-1);
  margin-bottom: var(--space-1);
}

/* Inline code */
.markdown-body code:not(pre code) {
  background: var(--bg-code);
  padding: 0.2em 0.4em;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 0.9em;
  color: var(--text-primary);
}

/* Code blocks */
.markdown-body pre {
  background: var(--bg-code);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  overflow-x: auto;
  margin-bottom: var(--space-4);
}

.markdown-body pre code {
  background: transparent;
  padding: 0;
  font-size: var(--font-sm);
  line-height: 1.6;
}

/* Tables */
.markdown-body table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: var(--space-4);
}

.markdown-body th,
.markdown-body td {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-color);
  text-align: left;
}

.markdown-body th {
  background: var(--bg-secondary);
  font-weight: 600;
}

.markdown-body tr:nth-child(2n) {
  background: var(--bg-secondary);
}

/* Blockquotes */
.markdown-body blockquote {
  border-left: 4px solid var(--accent-color);
  padding-left: var(--space-4);
  margin: var(--space-4) 0;
  color: var(--text-secondary);
}

/* Horizontal rule */
.markdown-body hr {
  border: none;
  border-top: 1px solid var(--border-color);
  margin: var(--space-6) 0;
}

/* Links */
.markdown-body a {
  color: var(--accent-color);
  text-decoration: none;
}

.markdown-body a:hover {
  text-decoration: underline;
}

/* Images */
.markdown-body img {
  max-width: 100%;
  border-radius: var(--radius-md);
}

/* Mermaid containers */
.markdown-body .mermaid {
  text-align: center;
  padding: var(--space-4);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-4);
}

.markdown-body .mermaid svg {
  max-width: 100%;
}
CSS
```

- [ ] **Step 3: Commit**

```bash
git add frontend-v3/src/composables/useMarkdown.ts frontend-v3/src/styles/markdown.css
git commit -m "feat(frontend-v3): Add Markdown composable and styles

- Create useMarkdown composable with TOC extraction
- Auto-generate heading IDs for anchor links
- Add VitePress-style markdown.css
- Support tables, lists, code blocks, blockquotes

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 10: Mermaid Composable

**Files:**
- Create: `frontend-v3/src/composables/useMermaid.ts`

- [ ] **Step 1: Create useMermaid composable**

```bash
cat > src/composables/useMermaid.ts << 'TYPESCRIPT'
import mermaid from 'mermaid'
import { ref } from 'vue'

const MERMAID_TIMEOUT = 5000 // 5 seconds

export function useMermaid() {
  const isInitialized = ref(false)

  async function init(theme: 'dark' | 'light') {
    if (isInitialized.value) return

    mermaid.initialize({
      startOnLoad: false,
      theme: theme === 'dark' ? 'dark' : 'default',
      securityLevel: 'strict',
      fontFamily: 'inherit',
    })

    isInitialized.value = true
  }

  async function render(id: string, code: string, theme: 'dark' | 'light'): Promise<string> {
    await init(theme)

    // Update theme if changed
    mermaid.initialize({ theme: theme === 'dark' ? 'dark' : 'default' })

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Mermaid render timeout'))
      }, MERMAID_TIMEOUT)

      try {
        mermaid.render(`mermaid-${id}`, code).then(({ svg }) => {
          clearTimeout(timeout)
          resolve(svg)
        }).catch((err) => {
          clearTimeout(timeout)
          reject(err)
        })
      } catch (err) {
        clearTimeout(timeout)
        reject(err)
      }
    })
  }

  return { render }
}
TYPESCRIPT
```

- [ ] **Step 2: Commit**

```bash
git add frontend-v3/src/composables/useMermaid.ts
git commit -m "feat(frontend-v3): Add Mermaid composable

- Initialize mermaid with theme support
- Render diagrams with 5-second timeout
- Graceful fallback on timeout/error

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 11: MarkdownViewer Component

**Files:**
- Create: `frontend-v3/src/components/MarkdownViewer.vue`
- Create: `frontend-v3/src/components/TocNav.vue`

- [ ] **Step 1: Create MarkdownViewer.vue**

```bash
cat > src/components/MarkdownViewer.vue << 'VUE'
<template>
  <div class="markdown-viewer">
    <!-- TOC passed via slot or prop -->
    <slot name="toc" :headings="headings" />
    
    <!-- Markdown content -->
    <div ref="contentRef" class="markdown-body" v-html="renderedHtml" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useMarkdown } from '@/composables/useMarkdown'
import { useMermaid } from '@/composables/useMermaid'
import { useThemeStore } from '@/stores/theme'
import { storeToRefs } from 'pinia'
import type { TocHeading } from '@/types'

const props = defineProps<{
  content: string
}>()

const emit = defineEmits<{
  headings: [headings: TocHeading[]]
}>()

const { render } = useMarkdown()
const { render: renderMermaid } = useMermaid()
const themeStore = useThemeStore()
const { theme } = storeToRefs(themeStore)

const contentRef = ref<HTMLElement>()
const headings = ref<TocHeading[]>([])
const mermaidCache = new Map<string, string>()

const renderedHtml = computed(() => {
  const result = render(props.content)
  headings.value = result.headings
  emit('headings', result.headings)
  return result.html
})

async function renderMermaidDiagrams() {
  if (!contentRef.value) return

  const elements = contentRef.value.querySelectorAll('.language-mermaid')
  
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i] as HTMLElement
    const code = el.textContent || ''
    const cacheKey = `${theme.value}-${code}`

    try {
      let svg: string
      if (mermaidCache.has(cacheKey)) {
        svg = mermaidCache.get(cacheKey)!
      } else {
        svg = await renderMermaid(`${i}`, code, theme.value)
        mermaidCache.set(cacheKey, svg)
      }

      const container = document.createElement('div')
      container.className = 'mermaid'
      container.innerHTML = svg
      el.parentElement?.replaceWith(container)
    } catch (err) {
      console.error('Mermaid render failed:', err)
      // Keep original code block on error
      el.parentElement?.classList.add('mermaid-error')
    }
  }
}

// Re-render mermaid when content or theme changes
watch(
  () => [props.content, theme.value],
  async () => {
    await nextTick()
    await renderMermaidDiagrams()
  },
  { immediate: true }
)

import { nextTick } from 'vue'
</script>

<style scoped>
@import '@/styles/markdown.css';
</style>
VUE
```

- [ ] **Step 2: Create TocNav.vue**

```bash
cat > src/components/TocNav.vue << 'VUE'
<template>
  <nav v-if="headings.length > 0" class="toc-nav">
    <h3 class="toc-title">On this page</h3>
    <ul class="toc-list">
      <li
        v-for="heading in headings"
        :key="heading.id"
        :class="['toc-item', `toc-level-${heading.level}`, { active: activeId === heading.id }]"
      >
        <a :href="`#${heading.id}`" @click.prevent="scrollTo(heading.id)">
          {{ heading.text }}
        </a>
      </li>
    </ul>
  </nav>
</template>

<script setup lang="ts">
import type { TocHeading } from '@/types'

const props = defineProps<{
  headings: TocHeading[]
  activeId: string | null
}>()

function scrollTo(id: string) {
  const element = document.getElementById(id)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}
</script>

<style scoped>
.toc-nav {
  padding: var(--space-4);
  font-size: var(--font-sm);
}

.toc-title {
  font-size: var(--font-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-tertiary);
  margin-bottom: var(--space-3);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--border-color);
}

.toc-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.toc-item {
  margin: var(--space-1) 0;
}

.toc-item a {
  display: block;
  padding: var(--space-1) var(--space-2);
  color: var(--text-secondary);
  text-decoration: none;
  border-radius: var(--radius-sm);
  border-left: 2px solid transparent;
  transition: all var(--transition-fast);
}

.toc-item a:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.toc-item.active a {
  color: var(--accent-color);
  border-left-color: var(--accent-color);
  background: var(--accent-light);
}

.toc-level-2 { padding-left: 0; }
.toc-level-3 { padding-left: var(--space-3); }
.toc-level-4 { padding-left: var(--space-6); }
</style>
VUE
```

- [ ] **Step 3: Commit**

```bash
git add frontend-v3/src/components/MarkdownViewer.vue frontend-v3/src/components/TocNav.vue
git commit -m "feat(frontend-v3): Add MarkdownViewer and TocNav components

- MarkdownViewer renders markdown with TOC extraction
- Integrates Mermaid diagrams with caching
- TocNav displays headings with active state
- VitePress-style TOC styling

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 12: FileTree Component

**Files:**
- Create: `frontend-v3/src/components/FileTree.vue`

- [ ] **Step 1: Create FileTree.vue**

```bash
cat > src/components/FileTree.vue << 'VUE'
<template>
  <div class="file-tree">
    <div class="file-tree-header">
      <h3>Files</h3>
    </div>
    <ul class="file-list">
      <li
        v-for="file in files"
        :key="file.id"
        :class="['file-item', { active: file.id === activeFileId }]"
        @click="$emit('select', file)"
      >
        <span class="file-icon">{{ getFileIcon(file) }}</span>
        <span class="file-name">{{ file.filename }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import type { File } from '@/types'

const props = defineProps<{
  files: File[]
  activeFileId: number | null
}>()

defineEmits<{
  select: [file: File]
}>()

function getFileIcon(file: File): string {
  if (file.isBinary) return '📦'
  if (file.language === 'markdown') return '📝'
  if (file.language === 'python') return '🐍'
  if (file.language === 'javascript' || file.language === 'typescript') return '📜'
  if (file.language === 'html') return '🌐'
  if (file.language === 'css') return '🎨'
  return '📄'
}
</script>

<style scoped>
.file-tree {
  height: 100%;
  overflow-y: auto;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
}

.file-tree-header {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border-color);
}

.file-tree-header h3 {
  font-size: var(--font-sm);
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.file-list {
  list-style: none;
  padding: var(--space-2);
  margin: 0;
}

.file-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.file-item:hover {
  background: var(--bg-tertiary);
}

.file-item.active {
  background: var(--accent-light);
}

.file-item.active .file-name {
  color: var(--accent-color);
  font-weight: 500;
}

.file-icon {
  font-size: var(--font-md);
}

.file-name {
  font-size: var(--font-sm);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
VUE
```

- [ ] **Step 2: Commit**

```bash
git add frontend-v3/src/components/FileTree.vue
git commit -m "feat(frontend-v3): Add FileTree component

- Display file list with icons based on language/type
- Active file highlighting
- Click to select file
- Scrollable sidebar

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 13: ActionBar Component

**Files:**
- Create: `frontend-v3/src/components/ActionBar.vue`

- [ ] **Step 1: Create ActionBar.vue**

```bash
cat > src/components/ActionBar.vue << 'VUE'
<template>
  <div class="action-bar">
    <button
      v-if="canCopy"
      class="btn btn-sm"
      :class="{ 'btn-secondary': variant === 'desktop' }"
      @click="$emit('copy')"
    >
      {{ variant === 'mobile' ? '📋' : '' }} Copy
    </button>
    
    <a
      v-if="canDownload && downloadUrl"
      :href="downloadUrl"
      download
      class="btn btn-sm"
      :class="{ 'btn-secondary': variant === 'desktop' }"
    >
      {{ variant === 'mobile' ? '⬇️' : '' }} Download
    </a>
    
    <a
      v-if="canPack && packUrl"
      :href="packUrl"
      download
      class="btn btn-sm"
      :class="{ 'btn-secondary': variant === 'desktop' }"
    >
      {{ variant === 'mobile' ? '📦' : '' }} Pack
    </a>
    
    <button
      v-if="canWrap"
      class="btn btn-sm"
      :class="{ active: wrap, 'btn-secondary': variant === 'desktop' && !wrap }"
      @click="$emit('toggle-wrap')"
    >
      {{ variant === 'mobile' ? '↩️' : '' }} Wrap
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  canCopy: boolean
  canDownload: boolean
  canWrap: boolean
  canPack: boolean
  wrap: boolean
  downloadUrl?: string
  packUrl?: string
  variant: 'desktop' | 'mobile'
}>()

defineEmits<{
  copy: []
  'toggle-wrap': []
}>()
</script>

<style scoped>
.action-bar {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.action-bar .btn {
  white-space: nowrap;
}
</style>
VUE
```

- [ ] **Step 2: Commit**

```bash
git add frontend-v3/src/components/ActionBar.vue
git commit -m "feat(frontend-v3): Add ActionBar component

- Copy, Download, Pack, Wrap buttons
- Desktop and mobile variants
- Conditional button visibility
- Active state for Wrap toggle

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 14: EntryDetailView Layout

**Files:**
- Create: `frontend-v3/src/views/EntryDetailView.vue`
- Create: `frontend-v3/src/styles/layout.css`

- [ ] **Step 1: Create layout.css**

```bash
cat > src/styles/layout.css << 'CSS'
/* ===== Entry Detail Layout ===== */
.entry-detail {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

/* Header */
.detail-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 0 var(--space-4);
  height: var(--header-height);
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.detail-header .back-btn {
  font-size: 20px;
  cursor: pointer;
  padding: var(--space-1);
  border-radius: var(--radius-md);
}

.detail-header .back-btn:hover {
  background: var(--bg-tertiary);
}

.detail-header .title {
  flex: 1;
  font-size: var(--font-md);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.detail-header .actions {
  display: none;
}

/* Main content area */
.detail-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* File tree sidebar */
.file-sidebar {
  display: none;
  width: var(--sidebar-width);
  flex-shrink: 0;
  border-right: 1px solid var(--border-color);
}

/* Content area */
.content-area {
  flex: 1;
  overflow-y: auto;
  background: var(--bg-primary);
}

/* TOC sidebar */
.toc-sidebar {
  display: none;
  width: var(--toc-width);
  flex-shrink: 0;
  border-left: 1px solid var(--border-color);
  background: var(--bg-secondary);
  overflow-y: auto;
}

/* Mobile bottom bar */
.mobile-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  height: var(--header-height);
  flex-shrink: 0;
}

.mobile-actions .menu-btn {
  margin-right: auto;
}

/* Desktop layout */
@media (min-width: 1024px) {
  .detail-header .actions {
    display: flex;
  }

  .file-sidebar {
    display: block;
  }

  .toc-sidebar {
    display: block;
  }

  .mobile-actions {
    display: none;
  }
}

/* Drawer for mobile */
.drawer-overlay {
  position: fixed;
  inset: 0;
  background: var(--bg-overlay);
  z-index: 100;
}

.drawer {
  position: fixed;
  top: 0;
  bottom: 0;
  width: 280px;
  max-width: 80vw;
  background: var(--bg-primary);
  z-index: 101;
  overflow-y: auto;
}

.drawer-left {
  left: 0;
  border-right: 1px solid var(--border-color);
}

.drawer-right {
  right: 0;
  border-left: 1px solid var(--border-color);
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border-color);
}

.drawer-close {
  font-size: 24px;
  cursor: pointer;
}

/* TOC button in header (mobile) */
.toc-btn {
  margin-left: auto;
}

@media (min-width: 1024px) {
  .toc-btn {
    display: none;
  }
}
CSS
```

- [ ] **Step 2: Create EntryDetailView.vue**

```bash
cat > src/views/EntryDetailView.vue << 'VUE'
<template>
  <div class="entry-detail">
    <!-- Header -->
    <header class="detail-header">
      <span class="back-btn" @click="$router.push('/')">←</span>
      <h1 class="title">{{ entry?.summary || 'Loading...' }}</h1>
      
      <!-- Desktop actions -->
      <ActionBar
        v-if="entry"
        class="actions"
        variant="desktop"
        :can-copy="canCopy"
        :can-download="canDownload"
        :can-wrap="canWrap"
        :can-pack="canPack"
        :wrap="wrapEnabled"
        :download-url="downloadUrl"
        :pack-url="packUrl"
        @copy="copyContent"
        @toggle-wrap="toggleWrap"
      />
      
      <!-- Mobile TOC button -->
      <button
        v-if="hasToc"
        class="btn btn-icon toc-btn"
        @click="showTocDrawer = true"
      >
        ☰
      </button>
    </header>

    <!-- Main content -->
    <div class="detail-content">
      <!-- File tree (desktop) -->
      <aside v-if="isMultiFile" class="file-sidebar">
        <FileTree
          :files="entry?.files || []"
          :active-file-id="activeFile?.id || null"
          @select="selectFile"
        />
      </aside>

      <!-- Content -->
      <main class="content-area">
        <div v-if="loading" class="loading-state">
          Loading...
        </div>
        
        <div v-else-if="error" class="error-state">
          {{ error }}
        </div>
        
        <CodeViewer
          v-else-if="activeFile && !isMarkdown"
          :content="fileContent"
          :filename="activeFile.filename"
          :language="activeFile.language"
          :wrap="wrapEnabled"
          :can-wrap="canWrap"
          @toggle-wrap="toggleWrap"
        />
        
        <MarkdownViewer
          v-else-if="activeFile && isMarkdown"
          :content="fileContent"
          @headings="onHeadingsUpdate"
        />
        
        <div v-else class="empty-state">
          Select a file to view
        </div>
      </main>

      <!-- TOC sidebar (desktop) -->
      <aside v-if="hasToc" class="toc-sidebar">
        <TocNav :headings="tocHeadings" :active-id="activeHeadingId" />
      </aside>
    </div>

    <!-- Mobile bottom actions -->
    <div v-if="entry" class="mobile-actions">
      <button
        v-if="isMultiFile"
        class="btn btn-icon menu-btn"
        @click="showFileDrawer = true"
      >
        ☰
      </button>
      
      <ActionBar
        variant="mobile"
        :can-copy="canCopy"
        :can-download="canDownload"
        :can-wrap="canWrap"
        :can-pack="canPack"
        :wrap="wrapEnabled"
        :download-url="downloadUrl"
        :pack-url="packUrl"
        @copy="copyContent"
        @toggle-wrap="toggleWrap"
      />
    </div>

    <!-- Mobile drawers -->
    <template v-if="showFileDrawer">
      <div class="drawer-overlay" @click="showFileDrawer = false" />
      <div class="drawer drawer-left">
        <div class="drawer-header">
          <h3>Files</h3>
          <span class="drawer-close" @click="showFileDrawer = false">×</span>
        </div>
        <FileTree
          :files="entry?.files || []"
          :active-file-id="activeFile?.id || null"
          @select="(f) => { selectFile(f); showFileDrawer = false; }"
        />
      </div>
    </template>

    <template v-if="showTocDrawer">
      <div class="drawer-overlay" @click="showTocDrawer = false" />
      <div class="drawer drawer-right">
        <div class="drawer-header">
          <h3>On this page</h3>
          <span class="drawer-close" @click="showTocDrawer = false">×</span>
        </div>
        <TocNav :headings="tocHeadings" :active-id="activeHeadingId" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useEntryStore } from '@/stores/entry'
import { storeToRefs } from 'pinia'
import FileTree from '@/components/FileTree.vue'
import CodeViewer from '@/components/CodeViewer.vue'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import TocNav from '@/components/TocNav.vue'
import ActionBar from '@/components/ActionBar.vue'
import type { File, TocHeading } from '@/types'

const props = defineProps<{
  slug: string
}>()

const route = useRoute()
const store = useEntryStore()
const {
  currentEntry: entry,
  activeFile,
  fileContent,
  wrapEnabled,
  loading,
  error,
  isMultiFile,
  canWrap,
  canCopy,
  canDownload,
  canPack,
} = storeToRefs(store)
const { loadEntry, selectFile: storeSelectFile, toggleWrap } = store

const tocHeadings = ref<TocHeading[]>([])
const activeHeadingId = ref<string | null>(null)
const showFileDrawer = ref(false)
const showTocDrawer = ref(false)

const isMarkdown = computed(() => activeFile.value?.language === 'markdown')
const hasToc = computed(() => isMarkdown.value && tocHeadings.value.length > 0)

const downloadUrl = computed(() => {
  if (!entry.value || !activeFile.value) return ''
  return `/api/v1/entries/${entry.value.slug}/files/${activeFile.value.id}`
})

const packUrl = computed(() => {
  if (!entry.value) return ''
  return `/api/v1/entries/${entry.value.slug}/files/pack`
})

function selectFile(file: File) {
  storeSelectFile(file)
  tocHeadings.value = []
}

function onHeadingsUpdate(headings: TocHeading[]) {
  tocHeadings.value = headings
  if (headings.length > 0 && !activeHeadingId.value) {
    activeHeadingId.value = headings[0].id
  }
}

async function copyContent() {
  if (!fileContent.value) return
  try {
    await navigator.clipboard.writeText(fileContent.value)
  } catch (err) {
    console.error('Copy failed:', err)
  }
}

// Load entry on mount and when slug changes
onMounted(() => loadEntry(props.slug))
watch(() => props.slug, (newSlug) => loadEntry(newSlug))
</script>

<style scoped>
@import '@/styles/layout.css';

.loading-state,
.error-state,
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-secondary);
}

.error-state {
  color: var(--error-color);
}
</style>
VUE
```

- [ ] **Step 3: Commit**

```bash
git add frontend-v3/src/views/EntryDetailView.vue frontend-v3/src/styles/layout.css
git commit -m "feat(frontend-v3): Add EntryDetailView with responsive layout

- Desktop: 3-column layout (file tree | content | TOC)
- Mobile: Single column with drawer menus
- Top action bar on desktop, bottom bar on mobile
- Integrated CodeViewer and MarkdownViewer

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 15: EntryListView

**Files:**
- Create: `frontend-v3/src/views/EntryListView.vue`

- [ ] **Step 1: Create EntryListView.vue**

```bash
cat > src/views/EntryListView.vue << 'VUE'
<template>
  <div class="entry-list">
    <header class="list-header">
      <h1>PeekView</h1>
      <ThemeToggle />
    </header>

    <div class="list-content">
      <div v-if="loading" class="loading">Loading...</div>
      
      <div v-else-if="error" class="error">{{ error }}</div>
      
      <div v-else-if="entries.length === 0" class="empty">
        No entries found
      </div>
      
      <div v-else class="entry-grid">
        <router-link
          v-for="entry in entries"
          :key="entry.id"
          :to="`/entry/${entry.slug}`"
          class="entry-card"
        >
          <h3 class="entry-title">{{ entry.summary }}</h3>
          <div class="entry-meta">
            <span class="entry-files">{{ entry.files.length }} files</span>
            <span v-if="entry.tags.length" class="entry-tags">
              {{ entry.tags.join(', ') }}
            </span>
          </div>
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useEntryStore } from '@/stores/entry'
import { storeToRefs } from 'pinia'
import ThemeToggle from '@/components/ThemeToggle.vue'

const store = useEntryStore()
const { entries, loading, error } = storeToRefs(store)
const { loadEntries } = store

onMounted(() => loadEntries())
</script>

<style scoped>
.entry-list {
  min-height: 100vh;
  background: var(--bg-primary);
}

.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4);
  border-bottom: 1px solid var(--border-color);
}

.list-header h1 {
  font-size: var(--font-xl);
  font-weight: 700;
}

.list-content {
  padding: var(--space-4);
  max-width: 1200px;
  margin: 0 auto;
}

.loading,
.error,
.empty {
  text-align: center;
  padding: var(--space-7);
  color: var(--text-secondary);
}

.error {
  color: var(--error-color);
}

.entry-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--space-4);
}

.entry-card {
  display: block;
  padding: var(--space-4);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  text-decoration: none;
  transition: all var(--transition-fast);
}

.entry-card:hover {
  border-color: var(--accent-color);
  box-shadow: var(--shadow-md);
}

.entry-title {
  font-size: var(--font-md);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

.entry-meta {
  display: flex;
  gap: var(--space-3);
  font-size: var(--font-sm);
  color: var(--text-secondary);
}

.entry-tags {
  color: var(--accent-color);
}
</style>
VUE
```

- [ ] **Step 2: Commit**

```bash
git add frontend-v3/src/views/EntryListView.vue
git commit -m "feat(frontend-v3): Add EntryListView

- Grid layout of entry cards
- Display file count and tags
- Link to entry detail
- Theme toggle in header

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 16: Final Integration and Build

**Files:**
- Modify: `frontend-v3/src/App.vue`
- Create: `frontend-v3/README.md`

- [ ] **Step 1: Update App.vue**

```bash
cat > src/App.vue << 'VUE'
<template>
  <router-view v-slot="{ Component }">
    <transition name="fade" mode="out-in">
      <component :is="Component" />
    </transition>
  </router-view>
</template>

<style>
/* Global transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* App container */
#app {
  height: 100vh;
}
</style>
VUE
```

- [ ] **Step 2: Create README**

```bash
cat > README.md << 'MARKDOWN'
# PeekView Frontend v3

New Vue 3 frontend for PeekView with GitHub-style code viewer and VitePress-style Markdown rendering.

## Features

- **Code Viewer**: Syntax highlighting with Shiki, line numbers, wrap mode
- **Markdown**: VitePress-style rendering with TOC navigation
- **Mermaid**: Diagram support with timeout fallback
- **Responsive**: Desktop 3-column layout, mobile drawer navigation
- **Themes**: Dark/light mode with system preference detection

## Development

\`\`\`bash
npm install
npm run dev
\`\`\`

## Build

\`\`\`bash
npm run build
\`\`\`

Output goes to `dist/` directory.
MARKDOWN
```

- [ ] **Step 3: Test build**

```bash
cd frontend-v3 && npm run build 2>&1 | tail -10
```

Expected: Build completes with no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend-v3/src/App.vue frontend-v3/README.md
git commit -m "feat(frontend-v3): Final integration

- Add page transition animations
- Create README documentation
- Verify build succeeds

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Summary

This implementation plan creates a complete new frontend:

| Task | Component | Key Features |
|------|-----------|--------------|
| 1-2 | Project Setup | Vue 3, Vite, TypeScript, Pinia |
| 3 | Types & API | Entry/File types, API client |
| 4 | Router | Hash mode, scroll behavior |
| 5-6 | Stores | Theme (dark/light), Entry state |
| 7-8 | Code Viewer | Shiki highlighting, GitHub style |
| 9-11 | Markdown | VitePress style, TOC, Mermaid |
| 12 | File Tree | Sidebar file navigation |
| 13 | ActionBar | Copy/Download/Pack/Wrap buttons |
| 14 | Detail View | 3-column responsive layout |
| 15 | List View | Entry grid with cards |
| 16 | Integration | Final build verification |

**Total: 16 tasks, estimated 4-5 days**
