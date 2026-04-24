<template>
  <div class="entry-list-view">
    <header class="list-header">
      <h1>Peek</h1>
      <div class="header-actions">
        <input
          v-model="searchQuery"
          placeholder="Search entries..."
          @input="debouncedSearch"
          class="search-input"
          aria-label="Search entries"
        />
        <ThemeToggle />
      </div>
    </header>

    <!-- Loading skeleton -->
    <div v-if="loading" class="entry-list">
      <div v-for="i in 5" :key="i" class="entry-skeleton">
        <div class="skeleton-title"></div>
        <div class="skeleton-meta">
          <div class="skeleton-tag"></div>
          <div class="skeleton-tag"></div>
          <div class="skeleton-date"></div>
        </div>
      </div>
    </div>

    <!-- Error state with retry -->
    <div v-else-if="error" class="error-display" role="alert">
      <Icon icon="codicon:error" class="error-icon" />
      <p class="error-message">
        {{ errorCode === 'NOT_FOUND' ? 'No entries found' : 'Failed to load entries' }}
      </p>
      <p class="error-detail" v-if="errorCode !== 'NOT_FOUND'">{{ error }}</p>
      <button class="retry-btn" @click="doFetch" aria-label="Retry loading entries">
        Try again
      </button>
    </div>

    <!-- Entry list -->
    <div v-else class="entry-list">
      <div
        v-for="entry in entries"
        :key="entry.id"
        class="entry-card"
        tabindex="0"
        role="link"
        :aria-label="`View entry: ${entry.summary}`"
        @click="goToEntry(entry.slug)"
        @keydown.enter="goToEntry(entry.slug)"
      >
        <h3>{{ entry.summary }}</h3>
        <div class="entry-meta">
          <span class="entry-tag" v-for="tag in entry.tags" :key="tag">#{{ tag }}</span>
          <span class="entry-date">{{ formatDate(entry.created_at) }}</span>
        </div>
      </div>
      <div v-if="entries.length === 0" class="empty-state">
        <Icon icon="codicon:inbox" class="empty-icon" />
        <p>No entries yet</p>
      </div>
    </div>

    <!-- Accessible pagination -->
    <nav
      class="pagination"
      v-if="totalPages > 1"
      aria-label="Pagination"
    >
      <button
        @click="page--"
        :disabled="page <= 1"
        aria-label="Previous page"
      >
        ← Prev
      </button>
      <span class="page-info" aria-live="polite">
        Page {{ page }} of {{ totalPages }}
        <span class="total-count">({{ total }} entries)</span>
      </span>
      <button
        @click="page++"
        :disabled="page >= totalPages"
        aria-label="Next page"
      >
        Next →
      </button>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import ThemeToggle from '../components/ThemeToggle.vue'
import { useEntryList } from '../composables/useEntry'

const router = useRouter()
const { entries, total, totalPages, loading, error, errorCode, fetchEntries } = useEntryList()

const searchQuery = ref('')
const page = ref(1)

let debounceTimer: ReturnType<typeof setTimeout>
function debouncedSearch() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    page.value = 1
    doFetch()
  }, 300)
}

function doFetch() {
  fetchEntries({
    q: searchQuery.value || undefined,
    page: page.value,
  })
}

function goToEntry(slug: string) {
  router.push(`/${slug}`)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString()
}

onMounted(doFetch)
watch(page, doFetch)
</script>

<style scoped>
.entry-list-view {
  max-width: 900px;
  margin: 0 auto;
  padding: var(--space-5);
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-5);
}

.list-header h1 {
  color: var(--text-primary);
  margin: 0;
}

.header-actions {
  display: flex;
  gap: var(--space-3);
  align-items: center;
}

.search-input {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: var(--font-sm);
  width: 200px;
}

.search-input:focus {
  outline: 2px solid var(--accent-color);
  outline-offset: 1px;
}

/* Loading skeleton */
.entry-skeleton {
  padding: var(--space-4);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-3);
}

.skeleton-title {
  width: 60%;
  height: 18px;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  margin-bottom: var(--space-2);
}

.skeleton-meta {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.skeleton-tag,
.skeleton-date {
  height: 20px;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
}

.skeleton-tag { width: 60px; }
.skeleton-date { width: 80px; }

/* Error display */
.error-display {
  text-align: center;
  padding: var(--space-7);
  color: var(--text-secondary);
}

.error-icon {
  font-size: 48px;
  color: var(--error-color);
  margin-bottom: var(--space-3);
}

.error-message {
  font-size: var(--font-md);
  color: var(--text-primary);
  margin: 0 0 var(--space-2);
}

.error-detail {
  font-size: var(--font-sm);
  color: var(--text-tertiary);
  margin: 0 0 var(--space-4);
}

.retry-btn {
  padding: var(--space-2) var(--space-4);
  background: var(--accent-color);
  color: #ffffff;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--font-sm);
}

.retry-btn:hover {
  background: var(--accent-hover);
}

.retry-btn:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}

/* Entry card */
.entry-card {
  padding: var(--space-4);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-3);
  cursor: pointer;
  transition: border-color var(--transition-fast);
}

.entry-card:hover {
  border-color: var(--accent-color);
}

.entry-card:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 1px;
}

.entry-card h3 {
  margin: 0 0 var(--space-2);
  color: var(--text-primary);
}

.entry-meta {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  font-size: var(--font-sm);
  color: var(--text-secondary);
}

.entry-tag {
  background: var(--tag-bg);
  color: var(--tag-text);
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
}

.entry-date {
  margin-left: auto;
}

/* Empty state */
.empty-state {
  text-align: center;
  padding: var(--space-7);
  color: var(--text-secondary);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: var(--space-3);
}

/* Pagination */
.pagination {
  display: flex;
  justify-content: center;
  gap: var(--space-3);
  align-items: center;
  margin-top: var(--space-5);
}

.pagination button {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  cursor: pointer;
  color: var(--text-primary);
  font-size: var(--font-sm);
}

.pagination button:disabled {
  opacity: 0.5;
  cursor: default;
}

.pagination button:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 1px;
}

.page-info {
  font-size: var(--font-sm);
  color: var(--text-secondary);
}

.total-count {
  color: var(--text-tertiary);
  font-size: var(--font-xs);
}

/* Responsive */
@media (max-width: 768px) {
  .entry-list-view {
    padding: var(--space-3);
  }

  .list-header {
    flex-direction: column;
    gap: var(--space-3);
    align-items: stretch;
  }

  .header-actions {
    flex-wrap: wrap;
  }

  .search-input {
    flex: 1;
    min-width: 150px;
  }
}
</style>
