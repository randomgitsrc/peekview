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

      <div v-else>
        <div class="entry-grid">
          <router-link
            v-for="entry in entries"
            :key="entry.id"
            :to="`/${entry.slug}`"
            class="entry-card"
          >
            <h3 class="entry-title">{{ entry.summary }}</h3>
            <div class="entry-meta">
              <span class="entry-files">{{ entry.fileCount ?? entry.files?.length ?? 0 }} files</span>
              <span v-if="entry.tags.length" class="entry-tags">
                {{ entry.tags.join(', ') }}
              </span>
            </div>
          </router-link>
        </div>

        <Pagination
          v-if="totalPages > 1"
          v-model:page="currentPage"
          :per-page="perPage"
          :total="total"
        />
      </div>
    </div>

    <!-- Footer -->
    <footer class="list-footer">
      <div class="footer-links">
        <a
          href="https://github.com/randomgitsrc/peekview"
          target="_blank"
          rel="noopener noreferrer"
          class="footer-link"
          title="GitHub"
        >
          <svg class="footer-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
        </a>
        <a
          href="https://pypi.org/project/peekview/"
          target="_blank"
          rel="noopener noreferrer"
          class="footer-link"
          title="PyPI"
        >
          <svg class="footer-icon pypi-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.026 0L6.018 3.5v3.5h11.976V3.5L12.026 0zM18.034 7H6.018v10l6.008 3.5L18.034 17V7z"/>
          </svg>
        </a>
      </div>
      <div class="footer-info">
        <span class="version">v{{ appVersion }}</span>
        <span class="separator">·</span>
        <span class="copyright">© 2026 PeekView</span>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useEntryStore } from '@/stores/entry'
import { storeToRefs } from 'pinia'
import ThemeToggle from '@/components/ThemeToggle.vue'
import Pagination from '@/components/Pagination.vue'

// App version from package.json (injected by Vite)
declare const __APP_VERSION__: string
const appVersion = ref(__APP_VERSION__)

const store = useEntryStore()
const { entries, loading, error, total, page, perPage } = storeToRefs(store)
const { loadEntries } = store

// Local page state for pagination
const currentPage = ref(1)

// Computed total pages
const totalPages = computed(() => Math.ceil(total.value / perPage.value))

// Load entries when page changes
watch(currentPage, (newPage) => {
  loadEntries({ page: newPage, perPage: perPage.value })
})

onMounted(() => {
  currentPage.value = page.value || 1
  loadEntries({ page: currentPage.value, perPage: perPage.value })
})
</script>

<style scoped>
.entry-list { min-height: 100vh; background: var(--bg-primary); display: flex; flex-direction: column; }
.list-header { display: flex; align-items: center; justify-content: space-between; padding: var(--space-4); border-bottom: 1px solid var(--border-color); flex-shrink: 0; }
.list-header h1 { font-size: var(--font-xl); font-weight: 700; }
.list-content { padding: var(--space-4); max-width: 1200px; margin: 0 auto; width: 100%; flex: 1; }
.loading, .error, .empty { text-align: center; padding: var(--space-7); color: var(--text-secondary); }
.error { color: var(--error-color); }
.entry-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: var(--space-4); }
.entry-card { display: block; padding: var(--space-4); background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-lg); text-decoration: none; transition: all var(--transition-fast); }
.entry-card:hover { border-color: var(--accent-color); box-shadow: var(--shadow-md); }
.entry-title { font-size: var(--font-md); font-weight: 600; color: var(--text-primary); margin-bottom: var(--space-2); }
.entry-meta { display: flex; gap: var(--space-3); font-size: var(--font-sm); color: var(--text-secondary); }
.entry-tags { color: var(--accent-color); }

/* Footer */
.list-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-6);
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--border-color);
  font-size: var(--font-xs);
  color: var(--text-tertiary);
  flex-shrink: 0;
  flex-wrap: wrap;
}

.footer-links {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.footer-link {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: var(--text-tertiary);
  transition: color var(--transition-fast);
}

.footer-link:hover {
  color: var(--text-primary);
}

.footer-icon {
  width: 18px;
  height: 18px;
}

.footer-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.footer-info .version {
  font-family: var(--font-mono);
  color: var(--text-secondary);
}

.footer-info .separator {
  opacity: 0.5;
}

.footer-info .copyright {
  opacity: 0.8;
}
</style>
