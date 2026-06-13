<template>
  <div class="entry-list">
    <header class="list-header">
      <h1>PeekView</h1>
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
      <!-- All/Mine tabs for authenticated users -->
      <div v-if="authState === 'authenticated'" class="owner-tabs">
        <button
          class="owner-tab"
          :class="{ active: currentOwner !== 'me' }"
          @click="setOwner(null)"
        >All</button>
        <button
          class="owner-tab"
          :class="{ active: currentOwner === 'me' }"
          @click="setOwner('me')"
        >Mine</button>
      </div>

      <div v-if="loading" class="loading">Loading...</div>

      <div v-else-if="error" class="error">{{ error }}</div>

      <div v-else-if="entries.length === 0" class="empty">
        No entries found
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
            <router-link :to="`/${entry.slug}`" class="card-body">
              <h3 class="entry-title">{{ entry.summary }}</h3>
              <div class="entry-meta">
                <span class="meta-item">{{ entry.fileCount ?? entry.files?.length ?? 0 }} files</span>
                <span v-if="entry.username" class="meta-item meta-creator">@{{ entry.username }}</span>
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
            </router-link>
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
        <a
          href="https://www.npmjs.com/package/@peekview/mcp-server"
          target="_blank"
          rel="noopener noreferrer"
          class="footer-link"
          title="npm"
        >
          <svg class="footer-icon npm-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M0 0v24h24V0H0zm20 20h-4v-8h-3v8H4V4h16v16z"/>
          </svg>
        </a>
      </div>
      <div class="footer-info">
        <span class="version">v{{ appVersion }}</span>
        <span class="separator">·</span>
        <span class="copyright">© 2026 PeekView</span>
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
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useEntryStore } from '@/stores/entry'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { storeToRefs } from 'pinia'
import ThemeToggle from '@/components/ThemeToggle.vue'
import Pagination from '@/components/Pagination.vue'
import LoginDialog from '@/components/LoginDialog.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import type { Entry } from '@/types'
import { formatExpiresIn, isExpiringSoon } from '@/utils/expires'

declare const __APP_VERSION__: string
const appVersion = ref(__APP_VERSION__)

const entryStore = useEntryStore()
const authStore = useAuthStore()
const toast = useToast()
const router = useRouter()
const { entries, loading, error, total, page, perPage } = storeToRefs(entryStore)
const { loadEntries } = entryStore
const { user, authState } = storeToRefs(authStore)

// Owner filter (All/Mine)
const currentOwner = ref<string | null>(null)

function setOwner(owner: string | null) {
  currentOwner.value = owner
  currentPage.value = 1
  loadEntries({ page: 1, perPage: perPage.value, owner: owner || undefined })
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
  loadEntries({ page: newPage, perPage: perPage.value, owner: currentOwner.value || undefined })
})

onMounted(() => {
  // Restore owner from URL if present
  const urlParams = new URLSearchParams(window.location.search)
  const ownerParam = urlParams.get('owner')
  if (ownerParam === 'me' && authState.value === 'authenticated') {
    currentOwner.value = 'me'
  }
  currentPage.value = page.value || 1
  loadEntries({ page: currentPage.value, perPage: perPage.value, owner: currentOwner.value || undefined })
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
.list-header h1 { font-size: var(--font-xl); font-weight: 700; }

.header-actions {
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
.meta-private { color: var(--warning-color); font-weight: 500; }
.meta-tags { color: var(--accent-color); }
.meta-expires { color: var(--text-secondary); }
.meta-expires-soon { color: var(--warning-color); font-weight: 500; }

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

.footer-links { display: flex; align-items: center; gap: var(--space-3); }
.footer-link { display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; color: var(--text-tertiary); transition: color var(--transition-fast); }
.footer-link:hover { color: var(--text-primary); }
.footer-icon { width: 18px; height: 18px; }

.footer-info { display: flex; align-items: center; gap: var(--space-2); }
.footer-info .version { font-family: var(--font-mono); color: var(--text-secondary); }
.footer-info .separator { opacity: 0.5; }
.footer-info .copyright { opacity: 0.8; }
</style>