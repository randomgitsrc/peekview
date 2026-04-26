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
.entry-list { min-height: 100vh; background: var(--bg-primary); }
.list-header { display: flex; align-items: center; justify-content: space-between; padding: var(--space-4); border-bottom: 1px solid var(--border-color); }
.list-header h1 { font-size: var(--font-xl); font-weight: 700; }
.list-content { padding: var(--space-4); max-width: 1200px; margin: 0 auto; }
.loading, .error, .empty { text-align: center; padding: var(--space-7); color: var(--text-secondary); }
.error { color: var(--error-color); }
.entry-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: var(--space-4); }
.entry-card { display: block; padding: var(--space-4); background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-lg); text-decoration: none; transition: all var(--transition-fast); }
.entry-card:hover { border-color: var(--accent-color); box-shadow: var(--shadow-md); }
.entry-title { font-size: var(--font-md); font-weight: 600; color: var(--text-primary); margin-bottom: var(--space-2); }
.entry-meta { display: flex; gap: var(--space-3); font-size: var(--font-sm); color: var(--text-secondary); }
.entry-tags { color: var(--accent-color); }
</style>
