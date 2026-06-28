<template>
  <div class="entry-list">
    <header class="list-header">
      <router-link to="/" class="logo-link">PeekView</router-link>
      <div class="search-box" role="search">
        <input
          v-model="searchQuery"
          type="search"
          class="search-input"
          aria-label="Search entries"
          placeholder="Search entries..."
          @input="onSearchInput"
          @keydown="onSearchKeydown"
        />
      </div>
      <div class="header-actions">
        <template v-if="authState === 'anonymous'">
          <button class="btn btn-login" @click="showLogin = true">Login</button>
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

      <div v-if="loading" class="loading">Loading...</div>

      <div v-else-if="ownerFound === false && props.owner" class="user-not-found">
        User <strong>@{{ props.owner }}</strong> not found
      </div>

      <div v-else-if="error" class="error">{{ error }}</div>

      <div v-else-if="entries.length === 0" class="empty">
        <template v-if="ownerFound === true">
          No entries from @{{ props.owner }}
        </template>
        <template v-else>
          No entries found
        </template>
      </div>

      <div v-else>
        <div class="entry-grid">
          <div
            v-for="entry in entries"
            :key="entry.id"
            class="entry-card"
          >
            <!-- Owner actions (visibility toggle + delete) -->
            <div v-if="authStore.isOwner(entry.ownerId)" class="card-actions">
              <button
                class="card-action-btn"
                :title="entry.isPublic ? 'Make private' : 'Make public'"
                @click.stop="handleToggleVisibility(entry)"
              >
                {{ entry.isPublic ? '🌐' : '🔒' }}
              </button>
              <button
                class="card-action-btn card-action-btn--danger"
                title="Delete"
                @click.stop="confirmDeleteEntry(entry)"
              >
                🗑️
              </button>
            </div>

            <!-- Card body (clickable, navigates to detail) -->
            <div
              class="card-body"
              role="link"
              tabindex="0"
              @click="navigateToEntry(entry)"
              @keydown.enter.prevent="navigateToEntry(entry)"
              @keydown.space.prevent="navigateToEntry(entry)"
            >
              <h3 class="entry-title">{{ entry.summary }}</h3>
              <div class="entry-meta">
                <span class="meta-item">{{ entry.fileCount ?? entry.files?.length ?? 0 }} files</span>
                <span v-if="entry.username" class="meta-item meta-creator" @click.stop>
                  <span class="creator-text">@</span>
                  <template v-if="entry.username === currentUserUsername">
                    <router-link :to="{ path: '/explore', query: { owner: 'me' } }" class="username-link">
                      {{ entry.username }}
                    </router-link>
                  </template>
                  <template v-else>
                    <router-link :to="`/users/${entry.username}`" class="username-link">
                      {{ entry.username }}
                    </router-link>
                  </template>
                </span>
                <span class="meta-item meta-time">{{ formatRelativeTime(entry.createdAt) }}</span>
                <span v-if="!entry.isPublic" class="meta-item meta-private">private</span>
                <span v-if="entry.expiresAt" class="meta-item meta-expires"
                      :class="{ 'meta-expires-soon': isExpiringSoon(entry.expiresAt) }">
                  {{ formatExpiresIn(entry.expiresAt) }}
                </span>
                <span v-if="entry.tags.length" class="meta-tags">
                  {{ entry.tags.join(', ') }}
                </span>
              </div>
            </div>
          </div>
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
import ThemeToggle from '@/components/ThemeToggle.vue'
import Pagination from '@/components/Pagination.vue'
import LoginDialog from '@/components/LoginDialog.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import BannerBar from '@/components/BannerBar.vue'
import FilterChip from '@/components/FilterChip.vue'
import type { Entry } from '@/types'
import { formatExpiresIn, isExpiringSoon } from '@/utils/expires'
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

// Owner filter (All/Mine)
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

// Search state
const searchQuery = ref('')
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

function onSearchInput() {
  debouncedSearch()
}

function onSearchKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    flushSearch()
    ;(e.target as HTMLInputElement)?.blur()
  } else if (e.key === 'Escape') {
    clearSearch()
  }
}

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

// Login dialog
const showLogin = ref(false)

// User menu dropdown
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

// Delete confirmation
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

// Visibility toggle
async function handleToggleVisibility(entry: Entry) {
  const success = await entryStore.toggleVisibility(entry)
  if (success) {
    toast.show(entry.isPublic ? 'Entry made public' : 'Entry made private', 'success')
  } else {
    toast.show('Failed to change visibility', 'error')
  }
}

// Pagination
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

// Browser back/forward: restore state from URL query
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

// Relative time formatter
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)
  const diffWeek = Math.floor(diffDay / 7)
  const diffMonth = Math.floor(diffDay / 30)
  const diffYear = Math.floor(diffDay / 365)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  if (diffWeek < 5) return `${diffWeek}w ago`
  if (diffMonth < 12) return `${diffMonth}mo ago`
  return `${diffYear}y ago`
}
</script>

<style scoped>
.entry-list { min-height: 100vh; background: var(--bg-primary); display: flex; flex-direction: column; }
.list-header { display: flex; align-items: center; justify-content: space-between; padding: var(--space-4); border-bottom: 1px solid var(--border-color); flex-shrink: 0; }
.logo-link { font-size: var(--font-xl); font-weight: 700; color: var(--text-primary); text-decoration: none; flex-shrink: 0 }
.logo-link:hover { color: var(--accent-color) }

/* Search box */
.search-box {
  flex: 1;
  max-width: 400px;
  margin: 0 var(--space-4);
}

.search-input {
  width: 100%;
  padding: var(--space-1) var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: var(--font-sm);
  outline: none;
  transition: border-color var(--transition-fast);
}

.search-input:focus {
  border-color: var(--accent-color);
}

.search-input::placeholder {
  color: var(--text-tertiary);
}

/* Screen reader only utility */
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

.header-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.btn-login {
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
  font-size: var(--font-sm);
  transition: all var(--transition-fast);
}

.btn-login:hover {
  background: var(--accent-light);
  border-color: var(--accent-color);
  color: var(--accent-color);
}

/* User menu */
.user-menu-wrapper { position: relative; }

.user-menu-trigger {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
  font-size: var(--font-sm);
  transition: all var(--transition-fast);
}

.user-menu-trigger:hover { background: var(--bg-tertiary); }

.user-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--accent-color);
  color: var(--text-on-accent);
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
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
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
  background: var(--accent-color);
  color: var(--text-on-accent);
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
  color: var(--text-secondary);
  cursor: pointer;
  font-size: var(--font-sm);
  text-align: left;
  border-radius: var(--radius-sm);
}

.dropdown-item:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.dropdown-enter-active { transition: opacity 0.15s ease; }
.dropdown-leave-active { transition: opacity 0.15s ease; }
.dropdown-enter-from { opacity: 0; }
.dropdown-leave-to { opacity: 0; }

/* Content */
.list-content { padding: var(--space-4); max-width: 1200px; margin: 0 auto; width: 100%; flex: 1; }
.loading, .error, .empty { text-align: center; padding: var(--space-7); color: var(--text-secondary); }
.error { color: var(--error-color); }

/* Owner tabs (All/Mine) */
.owner-tabs {
  display: flex;
  gap: var(--space-1);
  margin-bottom: var(--space-4);
  border-bottom: 1px solid var(--border-color);
  padding-bottom: var(--space-1);
}

/* Filter chip bar */
.filter-chip-bar {
  margin-bottom: var(--space-3);
}

/* User not found */
.user-not-found {
  text-align: center;
  padding: var(--space-7);
  color: var(--text-secondary);
  font-size: var(--font-md);
}

.owner-tab {
  padding: var(--space-1) var(--space-3);
  border: none;
  background: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: var(--font-sm);
  font-weight: 500;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: all var(--transition-fast);
}

.owner-tab:hover { color: var(--text-primary); }
.owner-tab.active { color: var(--accent-color); border-bottom-color: var(--accent-color); }

/* Entry grid & cards */
.entry-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: var(--space-4); }

.entry-card {
  position: relative;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  transition: all var(--transition-fast);
}

.entry-card:hover { border-color: var(--accent-color); box-shadow: var(--shadow-md); }

.card-actions {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  display: flex;
  gap: var(--space-1);
  z-index: 1;
}

.card-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 14px;
  transition: all var(--transition-fast);
}

.card-action-btn:hover {
  background: var(--bg-tertiary);
  border-color: var(--border-hover);
  color: var(--text-primary);
}

.card-action-btn--danger:hover {
  background: var(--error-bg);
  border-color: var(--error-border);
  color: var(--error-text);
}

.card-body {
  display: block;
  padding: var(--space-4);
  text-decoration: none;
  color: var(--text-primary);
  cursor: pointer;
}

.entry-title { font-size: var(--font-md); font-weight: 600; margin-bottom: var(--space-2); }

.entry-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  font-size: var(--font-xs);
  color: var(--text-secondary);
}

.meta-item { display: inline-flex; align-items: center; }
.meta-creator { color: var(--accent-color); }
.creator-text { color: var(--accent-color); }
.username-link {
  color: var(--accent-color);
  text-decoration: none;
  font-weight: 500;
}
.username-link:hover {
  text-decoration: underline;
}
.meta-private { color: var(--warning-color); font-weight: 500; }
.meta-tags { color: var(--accent-color); }
.meta-expires { color: var(--text-secondary); }
.meta-expires-soon { color: var(--warning-color); font-weight: 500; }

/* Footer */
.list-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-5);
  border-top: 1px solid var(--border-color);
  font-size: var(--font-xs);
  color: var(--text-tertiary);
  flex-shrink: 0;
  flex-wrap: wrap;
  background: color-mix(in srgb, var(--bg-color, var(--color-canvas-default, transparent)) 60%, transparent);
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
  color: var(--text-tertiary);
  text-decoration: none;
  font-size: var(--font-xs);
  font-weight: 500;
  line-height: 1;
  transition: color var(--transition-fast), background-color var(--transition-fast);
}

.footer-link:hover {
  color: var(--text-primary);
  background: color-mix(in srgb, var(--text-primary, currentColor) 8%, transparent);
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
  color: var(--text-secondary);
  font-weight: 500;
  letter-spacing: 0.01em;
}

.footer-meta {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--text-tertiary);
}

.footer-meta .version {
  font-family: var(--font-mono);
  color: var(--text-secondary);
}

.footer-meta .separator {
  opacity: 0.5;
}

.footer-meta .copyright {
  opacity: 0.85;
}

@media (max-width: 640px) {
  .list-header {
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .search-box {
    flex: 1 1 100%;
    max-width: none;
    margin: var(--space-1) 0;
    order: 3;
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