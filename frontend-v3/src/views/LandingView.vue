<template>
  <div class="landing">
    <section class="hero">
      <h1 class="hero-title">PeekView</h1>
      <p class="hero-subtitle">Share code snippets instantly</p>
      <p class="hero-desc">Agent-powered formatting, human-friendly viewing. Create entries via API, CLI, or MCP &mdash; view code, markdown, diagrams, and HTML in your browser.</p>
      <div class="hero-actions">
        <button class="cta cta-primary" @click="showLogin = true">Login</button>
        <button class="cta cta-secondary" @click="showLogin = true">Get Started</button>
      </div>
    </section>

    <section class="examples">
      <h2 class="section-title">Recent Public Entries</h2>
      <div v-if="loadingExamples" class="state-info">Loading examples...</div>
      <div v-else-if="errorExamples" class="state-err">{{ errorExamples }}</div>
      <div v-else-if="exampleEntries.length === 0" class="state-info">No public entries yet</div>
      <div v-else class="examples-grid">
        <router-link v-for="entry in exampleEntries" :key="entry.id" :to="`/${entry.slug}`" class="example-card">
          <h3 class="card-title">{{ entry.summary }}</h3>
          <div class="card-meta">
            <span>{{ entry.fileCount ?? 0 }} files</span>
            <span v-if="entry.username">@{{ entry.username }}</span>
          </div>
        </router-link>
      </div>
    </section>

    <footer class="landing-footer">
      <div class="footer-links">
        <a href="https://github.com/randomgitsrc/peekview" target="_blank" rel="noopener noreferrer" class="footer-link">GitHub</a>
        <a href="https://pypi.org/project/peekview/" target="_blank" rel="noopener noreferrer" class="footer-link">PyPI</a>
        <a href="https://www.npmjs.com/package/@peekview/mcp-server" target="_blank" rel="noopener noreferrer" class="footer-link">npm</a>
      </div>
      <div class="footer-info">Built for sharing code &amp; docs &middot; &copy; 2026 PeekView</div>
    </footer>

    <LoginDialog v-model:visible="showLogin" :allow-registration="true" />
    <ThemeToggle class="theme-fab" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { api } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import LoginDialog from '@/components/LoginDialog.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import type { Entry } from '@/types'

const router = useRouter()
const { authState } = storeToRefs(useAuthStore())
const showLogin = ref(false)
const exampleEntries = ref<Entry[]>([])
const loadingExamples = ref(true)
const errorExamples = ref('')

const SEO_TITLE = 'PeekView — Share code snippets instantly'
const SEO_DESC = 'Agent-powered code snippet sharing. Create entries via API, CLI, or MCP — view beautifully formatted code, markdown, diagrams, and HTML in your browser.'

function injectMeta() {
  document.title = SEO_TITLE
  const m = (n: string, v: string, p?: string) => { const el = document.createElement('meta'); el.setAttribute(n, v); if (p) el.setAttribute('property', p); el.setAttribute('data-peekview-landing', ''); document.head.appendChild(el) }
  m('name', 'description'); m('property', 'og:title'); m('property', 'og:description')
  document.querySelectorAll('[data-peekview-landing]').forEach(el => { if (el.getAttribute('property') === 'og:title') el.setAttribute('content', 'PeekView'); else if (el.getAttribute('property') === 'og:description' || el.getAttribute('name') === 'description') el.setAttribute('content', SEO_DESC) })
}
function removeMeta() { document.querySelectorAll('[data-peekview-landing]').forEach(el => el.remove()); document.title = 'PeekView' }

async function loadExamples() {
  try { exampleEntries.value = (await api.listEntries({ perPage: 4 })).items }
  catch (e: any) { errorExamples.value = e?.message || 'Failed to load examples' }
  finally { loadingExamples.value = false }
}

watch(authState, (state) => { if (state === 'authenticated') router.replace('/explore') })
onMounted(() => { injectMeta(); loadExamples() })
onUnmounted(() => { removeMeta() })
</script>

<style scoped>
.landing { min-height:100vh;display:flex;flex-direction:column;align-items:center;background:var(--bg-primary);color:var(--text-primary);position:relative }
.theme-fab { position:absolute;top:var(--space-4);right:var(--space-4);z-index:10 }

.hero { text-align:center;padding:var(--space-7) var(--space-4) var(--space-6);max-width:640px }
.hero-title { font-size:48px;font-weight:800;letter-spacing:-1px }
.hero-subtitle { font-size:var(--font-xl);color:var(--accent-color);font-weight:500;margin-top:var(--space-2) }
.hero-desc { margin-top:var(--space-4);font-size:var(--font-md);color:var(--text-secondary);line-height:1.7;max-width:480px;margin-left:auto;margin-right:auto }
.hero-actions { display:flex;gap:var(--space-3);justify-content:center;margin-top:var(--space-5) }
.cta { padding:var(--space-2) var(--space-5);border-radius:var(--radius-md);font-size:var(--font-md);font-weight:600;cursor:pointer;border:none;transition:all var(--transition-fast) }
.cta-primary { background:var(--accent-color);color:var(--text-on-accent) }
.cta-primary:hover { background:var(--accent-hover) }
.cta-secondary { background:var(--bg-secondary);color:var(--accent-color);border:1px solid var(--accent-color) }
.cta-secondary:hover { background:var(--accent-light) }

.examples { width:100%;max-width:900px;padding:0 var(--space-4) var(--space-7) }
.section-title { font-size:var(--font-lg);font-weight:600;margin-bottom:var(--space-4);text-align:center }
.state-info,.state-err { text-align:center;padding:var(--space-5);color:var(--text-secondary);font-size:var(--font-sm) }
.state-err { color:var(--error-text) }
.examples-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--space-4) }
.example-card { display:block;padding:var(--space-4);background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-lg);text-decoration:none;color:var(--text-primary);transition:all var(--transition-fast) }
.example-card:hover { border-color:var(--accent-color);box-shadow:var(--shadow-md) }
.card-title { font-size:var(--font-md);font-weight:600;margin-bottom:var(--space-2) }
.card-meta { display:flex;gap:var(--space-3);font-size:var(--font-xs);color:var(--text-secondary) }

.landing-footer { width:100%;max-width:900px;padding:var(--space-5) var(--space-4);border-top:1px solid var(--border-color);display:flex;align-items:center;justify-content:space-between;gap:var(--space-4);flex-wrap:wrap;margin-top:auto }
.footer-links { display:flex;gap:var(--space-2) }
.footer-link { padding:4px 10px;border-radius:var(--radius-md);color:var(--text-tertiary);text-decoration:none;font-size:var(--font-xs);font-weight:500;transition:color var(--transition-fast),background-color var(--transition-fast) }
.footer-link:hover { color:var(--text-primary);background:color-mix(in srgb,var(--text-primary,currentColor) 8%,transparent) }
.footer-info { font-size:var(--font-xs);color:var(--text-tertiary) }

@media (max-width:640px) {
  .hero-title { font-size:36px }
  .hero-subtitle { font-size:var(--font-lg) }
  .hero { padding:var(--space-5) var(--space-3) var(--space-4) }
  .hero-desc { font-size:var(--font-sm) }
  .hero-actions { flex-direction:column;align-items:center }
  .cta { width:100%;max-width:280px;text-align:center }
  .examples-grid { grid-template-columns:1fr }
  .landing-footer { flex-direction:column;align-items:center;text-align:center }
  .footer-links { justify-content:center }
}
</style>
