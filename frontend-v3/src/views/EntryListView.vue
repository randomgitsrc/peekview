<template>
  <div class="entry-list">
    <header class="explore-header">
      <router-link to="/" class="explore-logo">
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none"><rect x="2" y="2" width="28" height="28" rx="8" fill="var(--c-accent)"/><path d="M12 23.5V9.5h5.4a4.6 4.6 0 0 1 0 9.2H12" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="explore-logo-word">PeekView</span>
      </router-link>
      <div class="explore-actions">
        <template v-if="authState === 'anonymous'">
          <BaseButton variant="ghost" @click="showLogin = true">Login</BaseButton>
        </template>
        <template v-else-if="authState === 'authenticated'">
          <div class="user-menu-wrapper">
            <button class="user-menu-trigger" @click="toggleUserMenu">
              <span class="user-avatar">{{ userInitial }}</span>
              <span class="user-name">{{ userName }}</span>
              <span v-if="authStore.isAdmin" class="admin-badge">admin</span>
            </button>
            <Transition name="dropdown">
              <div v-if="showUserMenu" class="user-dropdown">
                <button class="dropdown-item" @click="navigateToApiKeys">API Keys</button>
                <button class="dropdown-item" @click="handleLogout">Logout</button>
              </div>
            </Transition>
          </div>
        </template>
        <ThemeToggle />
      </div>
    </header>

    <div class="list-content">
      <div class="content-toolbar">
        <div class="toolbar-left">
          <BannerBar v-if="isBannerMode" :username="props.owner!" />

          <div v-if="showTabs" class="owner-tabs">
            <button
              class="owner-tab"
              :class="{ active: currentOwner === null }"
              @click="setOwner(null)"
            >All</button>
            <button
              class="owner-tab"
              :class="{ active: currentOwner === 'me' }"
              @click="setOwner('me')"
            >Mine</button>
          </div>

          <div v-if="showChip" class="filter-chip-bar">
            <FilterChip :label="`@${currentOwner}`" @dismiss="clearOwnerFilter" />
          </div>
        </div>
        <div class="toolbar-right">
          <div class="explore-search">
            <SearchInput
              v-model="searchQuery"
              placeholder="搜索标题、标签和文件内容..."
              @keydown="onSearchKeydown"
              @clear="clearSearch"
            />
          </div>
          <div class="view-toggle">
            <button
              class="view-toggle-btn"
              :class="{ active: viewMode === 'grid' }"
              title="Grid view"
              @click="viewMode = 'grid'"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            </button>
            <button
              class="view-toggle-btn"
              :class="{ active: viewMode === 'list' }"
              title="List view"
              @click="viewMode = 'list'"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            </button>
          </div>
        </div>
      </div>

      <div
        v-if="searchQuery"
        class="search-status sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <template v-if="loading">Searching...</template>
        <template v-else>{{ entries.length }} result{{ entries.length === 1 ? '' : 's' }}</template>
      </div>

      <div v-if="loading" class="loading-state">
        <span>Loading...</span>
      </div>

      <div v-else-if="ownerFound === false && props.owner" class="user-not-found">
        User <strong>@{{ props.owner }}</strong> not found
      </div>

      <div v-else-if="error" class="error-state">
        <span>{{ error }}</span>
      </div>

      <EmptyState
        v-else-if="entries.length === 0"
        icon="Search"
        :heading="ownerFound === true ? `No entries from @${props.owner}` : 'No entries found'"
      />

      <template v-else>
        <div v-if="viewMode === 'grid'" class="entry-grid">
          <EntryCard
            v-for="entry in entries"
            :key="entry.id"
            :entry="entry"
            :is-owner="authStore.isOwner(entry.ownerId)"
            :current-username="currentUserUsername"
            @navigate="navigateToEntry"
            @toggle-visibility="handleToggleVisibility"
            @delete="confirmDeleteEntry"
          />
        </div>
        <div v-else class="entry-panel">
          <EntryListRow
            v-for="entry in entries"
            :key="entry.id"
            :entry="entry"
            :is-owner="authStore.isOwner(entry.ownerId)"
            :current-username="currentUserUsername"
            @navigate="navigateToEntry"
            @toggle-visibility="handleToggleVisibility"
            @delete="confirmDeleteEntry"
          />
        </div>

        <Pagination
          v-if="totalPages > 1"
          v-model:page="currentPage"
          :per-page="perPage"
          :total="total"
        />
      </template>
    </div>

    <!-- Footer -->
    <footer class="list-footer">
      <div class="footer-links">
        <a
          href="https://github.com/randomgitsrc/peekview"
          target="_blank"
          rel="noopener noreferrer"
          class="footer-link"
        >
          <svg class="footer-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          <span class="footer-link-label">GitHub</span>
        </a>
        <a
          href="https://pypi.org/project/peekview/"
          target="_blank"
          rel="noopener noreferrer"
          class="footer-link"
        >
          <svg class="footer-icon pypi-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.026 0L6.018 3.5v3.5h11.976V3.5L12.026 0zM18.034 7H6.018v10l6.008 3.5L18.034 17V7z"/>
          </svg>
          <span class="footer-link-label">PyPI</span>
        </a>
        <a
          href="https://www.npmjs.com/package/@peekview/mcp-server"
          target="_blank"
          rel="noopener noreferrer"
          class="footer-link"
        >
          <svg class="footer-icon npm-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M0 0v24h24V0H0zm20 20h-4v-8h-3v8H4V4h16v16z"/>
          </svg>
          <span class="footer-link-label">npm</span>
        </a>
      </div>
      <div class="footer-info">
        <span class="footer-tagline">Built for sharing code &amp; docs</span>
        <span class="footer-meta">
          <span class="version">v{{ appVersion }}</span>
          <span class="separator">·</span>
          <span class="copyright">© 2026 PeekView</span>
        </span>
      </div>
    </footer>

    <!-- Dialogs (teleported to body) -->
    <LoginDialog v-model:visible="showLogin" :allow-registration="true" />
    <ConfirmDialog
      v-model:visible="showConfirmDelete"
      title="Delete Entry"
      :message="deleteMessage"
      confirm-label="Delete"
      variant="destructive"
      @confirm="handleDelete"
      @cancel="cancelDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter, onBeforeRouteUpdate } from 'vue-router'
import { useEntryStore } from '@/stores/entry'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { storeToRefs } from 'pinia'
import SearchInput from '@/components/SearchInput.vue'
import EntryListRow from '@/components/EntryListRow.vue'
import EntryCard from '@/components/EntryCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import BaseButton from '@/components/BaseButton.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import Pagination from '@/components/Pagination.vue'
import LoginDialog from '@/components/LoginDialog.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import BannerBar from '@/components/BannerBar.vue'
import FilterChip from '@/components/FilterChip.vue'
import type { Entry } from '@/types'
import { useDebounce } from '@/composables/useDebounce'
import { mergeQuery, parseRestoreQuery } from '@/views/searchUrl.logic'

declare const __APP_VERSION__: string
const appVersion = ref(__APP_VERSION__)

const entryStore = useEntryStore()
const authStore = useAuthStore()
const toast = useToast()
const router = useRouter()
const { entries, loading, error, total, perPage, ownerFound } = storeToRefs(entryStore)
const { loadEntries } = entryStore
const { user, authState } = storeToRefs(authStore)

const props = defineProps<{
  owner?: string
}>()

const currentOwner = ref<string | null>(null)

const isBannerMode = computed(() =>
  !!(props.owner) && props.owner !== 'me' && ownerFound.value !== false
)

const showTabs = computed(() =>
  authState.value === 'authenticated' && !isBannerMode.value
)

const showChip = computed(() =>
  !!currentOwner.value && currentOwner.value !== 'me' && !props.owner
)

const effectiveOwner = computed(() => props.owner || currentOwner.value || undefined)

const currentUserUsername = computed(() => user.value?.username ?? null)

const searchQuery = ref('')
const viewMode = ref<'grid' | 'list'>('grid')
let suppressRouteUpdate = false

function updateURL(params: Record<string, string | undefined>): void {
  const currentQuery = window.location.search.slice(1)
  const newQuery = mergeQuery(currentQuery, params)
  const path = props.owner ? `/users/${props.owner}` : '/explore'

  suppressRouteUpdate = true
  if (!newQuery) {
    router.replace({ path })
  } else {
    const queryObj: Record<string, string> = {}
    new URLSearchParams(newQuery).forEach((value, key) => {
      queryObj[key] = value
    })
    router.replace({ path, query: queryObj })
  }
  nextTick(() => { suppressRouteUpdate = false })
}

function flushSearch() {
  const q = searchQuery.value.trim()
  updateURL({ q: q || undefined, page: undefined })
  currentPage.value = 1
  loadEntries({ page: 1, perPage: perPage.value, owner: effectiveOwner.value, q: q || undefined })
}

function clearSearch() {
  searchQuery.value = ''
  updateURL({ q: undefined })
  currentPage.value = 1
  loadEntries({ page: 1, perPage: perPage.value, owner: effectiveOwner.value })
}

const debouncedSearch = useDebounce(flushSearch, 300)

function onSearchKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    flushSearch()
  } else if (e.key === 'Escape') {
    clearSearch()
  }
}

watch(() => searchQuery.value, () => {
  debouncedSearch()
})

function setOwner(owner: string | null) {
  currentOwner.value = owner
  currentPage.value = 1
  loadEntries({ page: 1, perPage: perPage.value, owner: owner || undefined, q: searchQuery.value || undefined })
  updateURL({ owner: owner || undefined, page: undefined })
}

function clearOwnerFilter() {
  currentOwner.value = null
  currentPage.value = 1
  loadEntries({ page: 1, perPage: perPage.value, q: searchQuery.value || undefined })
  updateURL({ owner: undefined, page: undefined })
}

function navigateToEntry(entry: Entry) {
  router.push(`/${entry.slug}`)
}

function navigateToApiKeys() {
  showUserMenu.value = false
  router.push('/settings/apikeys')
}

const showLogin = ref(false)

const showUserMenu = ref(false)

const userInitial = computed(() => {
  const name = user.value?.displayName || user.value?.username || ''
  return name.charAt(0).toUpperCase()
})

const userName = computed(() => {
  return user.value?.displayName || user.value?.username || ''
})

function toggleUserMenu() {
  showUserMenu.value = !showUserMenu.value
}

function closeUserMenu(e: MouseEvent) {
  if (!(e.target as HTMLElement).closest('.user-menu-wrapper')) {
    showUserMenu.value = false
  }
}

onMounted(() => document.addEventListener('click', closeUserMenu))
onUnmounted(() => document.removeEventListener('click', closeUserMenu))

function handleLogout() {
  showUserMenu.value = false
  authStore.logout()
  entryStore.filterPrivateEntries()
  toast.show('Logged out', 'success')
}

const showConfirmDelete = ref(false)
const deleteTarget = ref<Entry | null>(null)
const deleteMessage = computed(() =>
  deleteTarget.value
    ? `Are you sure you want to delete "${deleteTarget.value.summary}"?`
    : ''
)

function confirmDeleteEntry(entry: Entry) {
  deleteTarget.value = entry
  showConfirmDelete.value = true
}

async function handleDelete() {
  if (!deleteTarget.value) return
  const success = await entryStore.deleteEntry(deleteTarget.value.slug)
  if (success) {
    toast.show('Entry deleted', 'success')
  } else {
    toast.show('Failed to delete entry', 'error')
  }
  deleteTarget.value = null
}

function cancelDelete() {
  deleteTarget.value = null
}

async function handleToggleVisibility(entry: Entry) {
  const success = await entryStore.toggleVisibility(entry)
  if (success) {
    toast.show(entry.isPublic ? 'Entry made public' : 'Entry made private', 'success')
  } else {
    toast.show('Failed to change visibility', 'error')
  }
}

const currentPage = ref(1)
const totalPages = computed(() => Math.ceil(total.value / perPage.value))

watch(currentPage, (newPage) => {
  updateURL({ page: newPage > 1 ? String(newPage) : undefined })
  loadEntries({ page: newPage, perPage: perPage.value, owner: effectiveOwner.value, q: searchQuery.value || undefined })
})

watch(() => props.owner, (newOwner) => {
  if (newOwner) {
    currentOwner.value = null
    currentPage.value = 1
    loadEntries({ page: 1, perPage: perPage.value, owner: newOwner, q: searchQuery.value || undefined })
  }
})

watch(authState, (newState) => {
  if (newState === 'authenticated' && !props.owner) {
    const urlParams = new URLSearchParams(window.location.search)
    const ownerParam = urlParams.get('owner')
    if (ownerParam === 'me' && currentOwner.value !== 'me') {
      currentOwner.value = 'me'
      currentPage.value = 1
      loadEntries({ page: 1, perPage: perPage.value, owner: 'me', q: searchQuery.value || undefined })
    }
  }
})

function restoreFromURL() {
  const urlParams = new URLSearchParams(window.location.search)
  const ownerParam = urlParams.get('owner')
  if (ownerParam && ownerParam !== 'me') {
    currentOwner.value = ownerParam
  } else if (ownerParam === 'me' && authState.value === 'authenticated') {
    currentOwner.value = 'me'
  }

  const restored = parseRestoreQuery(window.location.search.slice(1))
  searchQuery.value = restored.q
  currentPage.value = restored.page
}

onMounted(() => {
  if (props.owner) {
    currentOwner.value = null
  }
  restoreFromURL()
  loadEntries({ page: currentPage.value, perPage: perPage.value, owner: effectiveOwner.value, q: searchQuery.value || undefined })
})

onBeforeRouteUpdate((to) => {
  if (suppressRouteUpdate) return
  if (to.path !== '/explore' && !to.path.startsWith('/users/')) return

  const newQ = (to.query.q as string) || ''
  const newOwner = (to.query.owner as string) || null
  const newPage = parseInt(to.query.page as string) || 1

  searchQuery.value = newQ
  currentOwner.value = newOwner
  currentPage.value = Math.max(1, newPage)

  loadEntries({ page: Math.max(1, newPage), perPage: perPage.value, owner: newOwner || undefined, q: newQ || undefined })
})
</script>

<style scoped>
.entry-list { min-height: 100vh; background: var(--c-bg); display: flex; flex-direction: column; }

.explore-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background: var(--c-surface);
  border-bottom: 1px solid var(--c-border);
  padding: 0 var(--space-5);
  height: var(--header-height);
  flex-shrink: 0;
}

.explore-logo {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  text-decoration: none;
  flex-shrink: 0;
}

.explore-logo-word {
  font-size: 20px;
  font-weight: 700;
  color: var(--c-text);
  letter-spacing: -0.02em;
}

.explore-logo:hover .explore-logo-word {
  color: var(--c-accent);
}

.explore-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.explore-search {
  max-width: 280px;
  min-width: 0;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

.user-menu-wrapper { position: relative; }

.user-menu-trigger {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--c-border-strong);
  background: transparent;
  color: var(--c-text);
  cursor: pointer;
  font-size: var(--font-sm);
  transition: all var(--transition-fast);
}

.user-menu-trigger:hover { background: var(--c-surface-lower); }

.user-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--c-accent);
  color: #fff;
  font-size: var(--font-xs);
  font-weight: 600;
}

.user-name {
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-dropdown {
  position: absolute;
  top: calc(100% + var(--space-1));
  right: 0;
  background: var(--c-surface);
  border: 1px solid var(--c-border-strong);
  border-radius: var(--radius-md);
  padding: var(--space-1);
  min-width: 120px;
  box-shadow: var(--shadow-md);
  z-index: 100;
}

.admin-badge {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
  background: var(--c-accent);
  color: #fff;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.dropdown-item {
  display: block;
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: none;
  background: none;
  color: var(--c-text-secondary);
  cursor: pointer;
  font-size: var(--font-sm);
  text-align: left;
  border-radius: var(--radius-sm);
}

.dropdown-item:hover {
  background: var(--c-surface-lower);
  color: var(--c-text);
}

.dropdown-enter-active { transition: opacity 0.15s ease; }
.dropdown-leave-active { transition: opacity 0.15s ease; }
.dropdown-enter-from { opacity: 0; }
.dropdown-leave-to { opacity: 0; }

.list-content { padding: var(--space-4); max-width: 1200px; margin: 0 auto; width: 100%; flex: 1; }

.loading-state {
  text-align: center;
  padding: var(--space-7);
  color: var(--c-text-secondary);
}

.error-state {
  text-align: center;
  padding: var(--space-7);
  color: var(--c-error);
}

.user-not-found {
  text-align: center;
  padding: var(--space-7);
  color: var(--c-text-secondary);
  font-size: var(--font-md);
}

.owner-tabs {
  display: flex;
  gap: var(--space-1);
  border-bottom: 1px solid var(--c-border);
  padding-bottom: var(--space-1);
}

.filter-chip-bar {
}

.owner-tab {
  padding: var(--space-1) var(--space-3);
  border: none;
  background: none;
  color: var(--c-text-secondary);
  cursor: pointer;
  font-size: var(--font-sm);
  font-weight: 500;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: all var(--transition-fast);
}

.owner-tab:hover { color: var(--c-text); }
.owner-tab.active { color: var(--c-accent); border-bottom-color: var(--c-accent); }

.content-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.entry-panel {
  background: var(--c-surface);
  border: 1px solid var(--c-border-strong);
  border-radius: 14px;
  overflow: hidden;
}

.entry-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-4);
}

.view-toggle {
  display: inline-flex;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.view-toggle-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--c-text-tertiary);
  cursor: pointer;
  padding: 0;
  transition: all var(--transition-fast);
}

.view-toggle-btn:hover {
  background: var(--c-surface-lower);
  color: var(--c-text);
}

.view-toggle-btn.active {
  background: var(--c-accent-surface);
  color: var(--c-accent);
}

.list-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-5);
  border-top: 1px solid var(--c-border);
  font-size: var(--font-xs);
  color: var(--c-text-tertiary);
  flex-shrink: 0;
  flex-wrap: wrap;
  background: color-mix(in srgb, var(--c-surface) 60%, transparent);
}

.footer-links {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.footer-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 4px 10px;
  border-radius: var(--radius-md);
  color: var(--c-text-tertiary);
  text-decoration: none;
  font-size: var(--font-xs);
  font-weight: 500;
  line-height: 1;
  transition: color var(--transition-fast), background-color var(--transition-fast);
}

.footer-link:hover {
  color: var(--c-text);
  background: color-mix(in srgb, var(--c-text) 8%, transparent);
}

.footer-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  display: block;
  vertical-align: middle;
}

.footer-link-label {
  line-height: 1;
}

.footer-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  line-height: 1.4;
}

.footer-tagline {
  color: var(--c-text-secondary);
  font-weight: 500;
  letter-spacing: 0.01em;
}

.footer-meta {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--c-text-tertiary);
}

.footer-meta .version {
  font-family: var(--font-mono);
  color: var(--c-text-secondary);
}

.footer-meta .separator {
  opacity: 0.5;
}

.footer-meta .copyright {
  opacity: 0.85;
}

@media (max-width: 640px) {
  .explore-search {
    max-width: none;
    flex: 1 1 100%;
  }
  .content-toolbar {
    flex-wrap: wrap;
  }
  .toolbar-right {
    flex: 1 1 100%;
    justify-content: stretch;
  }
  .list-footer {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-3);
    padding: var(--space-4) var(--space-3);
  }
  .footer-links {
    justify-content: center;
    flex-wrap: wrap;
    gap: var(--space-1);
  }
  .footer-link {
    padding: 6px 10px;
  }
  .footer-info {
    align-items: center;
    text-align: center;
  }
}
</style>
