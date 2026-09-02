<template>
  <div class="entry-list">
    <header class="explore-header">
      <router-link to="/" class="explore-logo">
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none"><rect x="2" y="2" width="28" height="28" rx="8" fill="var(--c-accent)"/><path d="M12 23.5V9.5h5.4a4.6 4.6 0 0 1 0 9.2H12" stroke="var(--text-on-accent)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="explore-logo-word">PeekView</span>
      </router-link>
      <div class="explore-actions">
        <AuthButton v-if="authState === 'anonymous'" page-type="functional" @sign-in="showLogin = true" />
        <UserMenu v-else-if="authState === 'authenticated'" @logout="handleLogout" />
        <ThemeToggle />
      </div>
    </header>

    <div class="list-content">
      <div class="content-toolbar">
        <div class="toolbar-left">
          <BannerBar v-if="isBannerMode" :username="props.owner!" />

          <div v-if="showTabs" class="owner-tabs" role="tablist" aria-label="内容过滤" @keydown="onTablistKeydown">
            <button
              v-for="tab in tabDefs"
              :key="tab.key"
              type="button"
              role="tab"
              class="owner-tab"
              :data-testid="tab.testid"
              :class="{ active: isTabActive(tab.key) }"
              :aria-selected="isTabActive(tab.key) ? 'true' : 'false'"
              @click="selectTab(tab.key)"
            >{{ tab.label }}</button>
          </div>

          <div v-if="showChip || currentTags.length || (currentTeam && currentTeamInfo)" class="filter-chip-bar">
            <FilterChip v-if="showChip" :label="`@${currentOwner}`" @dismiss="clearOwnerFilter" />
            <FilterChip
              v-if="currentTeam && currentTeamInfo"
              :label="currentTeamInfo.name"
              :dismiss-label="`移除团队过滤：${currentTeamInfo.name}`"
              :data-testid="`team-chip-${currentTeam}`"
              @dismiss="clearTeamFilter"
            />
            <FilterChip
              v-for="tag in currentTags"
              :key="tag"
              :label="tag"
              @dismiss="removeTag(tag)"
            />
          </div>

          <div v-if="teamsChipRowVisible" class="teams-chip-row">
            <button
              v-for="team in teamChips"
              :key="team.slug"
              type="button"
              class="team-chip"
              :data-testid="`teams-chip-${team.slug}`"
              :class="{ active: currentTeam === team.slug }"
              @click="selectTeamChip(team.slug)"
            >{{ team.name }}</button>
            <router-link class="teams-manage-link" data-testid="teams-manage-link" to="/teams">管理团队</router-link>
          </div>
        </div>
        <div class="toolbar-right">
          <div class="explore-search">
            <SearchInput
              v-model="searchQuery"
              placeholder="Search titles, tags & content..."
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

      <div
        class="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {{ authChangeAnnouncement }}
      </div>

      <div v-if="loading" class="loading-state" role="status" aria-live="polite">
        <div v-if="viewMode === 'grid'" class="entry-grid">
          <div v-for="i in 6" :key="i" class="skeleton-card">
            <div class="skeleton-bar skeleton-title"></div>
            <div class="skeleton-bar skeleton-meta"></div>
            <div class="skeleton-bar skeleton-tags"></div>
          </div>
        </div>
        <div v-else class="entry-panel">
          <div v-for="i in 6" :key="i" class="skeleton-row">
            <div class="skeleton-bar skeleton-title"></div>
            <div class="skeleton-bar skeleton-meta"></div>
          </div>
        </div>
      </div>

      <div v-else-if="ownerFound === false && props.owner" class="user-not-found">
        User <strong>@{{ props.owner }}</strong> not found
      </div>

      <div v-else-if="teamUnavailable" class="team-unavailable" data-testid="team-unavailable" role="status">
        <p class="team-unavailable-title">团队不可用</p>
        <p class="team-unavailable-desc">你无权访问该团队，或该团队不存在。</p>
        <button
          type="button"
          class="team-unavailable-clear"
          data-testid="team-unavailable-clear"
          @click="clearTeamFilter"
        >清除过滤</button>
      </div>

      <div v-else-if="error" class="error-state">
        <span>{{ error }}</span>
      </div>

      <div
        v-else-if="entries.length === 0"
        :data-testid="emptyTestId"
        class="team-state-empty"
      >
        <EmptyState
          icon="Search"
          :heading="emptyStateHeading"
          :description="emptyStateDescription"
        />
      </div>

      <template v-else>
        <div v-if="viewMode === 'grid'" class="entry-grid">
          <EntryCard
            v-for="entry in entries"
            :key="entry.id"
            :entry="entry"
            :is-owner="authStore.isOwner(entry.ownerId)"
            :current-username="currentUserUsername"
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
        <span class="footer-tagline">Built for sharing what agents ship</span>
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
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter, onBeforeRouteUpdate } from 'vue-router'
import { useEntryListStore } from '@/stores/entryList'
import { useAuthStore } from '@/stores/auth'
import { useTeamStore } from '@/stores/team'
import { useToast } from '@/composables/useToast'
import { storeToRefs } from 'pinia'
import SearchInput from '@/components/SearchInput.vue'
import EntryListRow from '@/components/EntryListRow.vue'
import EntryCard from '@/components/EntryCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import AuthButton from '@/components/AuthButton.vue'
import UserMenu from '@/components/UserMenu.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import Pagination from '@/components/Pagination.vue'
import LoginDialog from '@/components/LoginDialog.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import BannerBar from '@/components/BannerBar.vue'
import FilterChip from '@/components/FilterChip.vue'
import type { Entry } from '@/types'
import { useDebounce } from '@/composables/useDebounce'
import { mergeQuery } from '@/views/searchUrl.logic'
import { loadViewMode, saveViewMode } from '@/composables/useViewMode'

declare const __APP_VERSION__: string
const appVersion = ref(__APP_VERSION__)

const entryStore = useEntryListStore()
const authStore = useAuthStore()
const teamStore = useTeamStore()
const toast = useToast()
const router = useRouter()
const { entries, loading, error, total, perPage, ownerFound } = storeToRefs(entryStore)
const { loadEntries } = entryStore
const { owned: rawOwned, joined: rawJoined, teamsLoaded: rawTeamsLoaded } = storeToRefs(teamStore)
const { loadMyTeams, isMemberOf: isTeamMember } = teamStore
const { user, authState } = storeToRefs(authStore)

// storeToRefs 在部分旧测试里被 mock 成空对象（无 team store 键）→ 容错访问
const myOwned = computed(() => rawOwned?.value ?? [])
const myJoined = computed(() => rawJoined?.value ?? [])
const teamsLoaded = computed(() => rawTeamsLoaded?.value ?? false)

const props = defineProps<{
  owner?: string
}>()

type ActiveView = 'all' | 'teams'
type TabKey = 'all' | 'mine' | 'teams' | 'archived' | 'starred'

const currentOwner = ref<string | null>(null)
const currentStatus = ref<string | null>(null)
const currentStarred = ref(false)
const currentTags = ref<string[]>([])
const currentTeam = ref<string | null>(null)
const activeView = ref<ActiveView>('all')
const unavailableTeam = ref<string | null>(null)
const authChangeAnnouncement = ref('')

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

const effectiveStatus = computed(() => currentStatus.value || undefined)

const effectiveStarred = computed(() => (currentStarred.value ? true : undefined))

const effectiveTeam = computed(() => {
  if (currentTeam.value) return currentTeam.value
  if (activeView.value === 'teams') return 'me'
  return undefined
})

const currentUserUsername = computed(() => user.value?.username ?? null)

const tabDefs: { key: TabKey; label: string; testid: string }[] = [
  { key: 'all', label: 'All', testid: 'tab-all' },
  { key: 'mine', label: 'Mine', testid: 'tab-mine' },
  { key: 'teams', label: 'Teams', testid: 'tab-teams' },
  { key: 'archived', label: 'Archived', testid: 'tab-archived' },
  { key: 'starred', label: 'Starred', testid: 'tab-starred' },
]

function isTabActive(key: TabKey): boolean {
  if (key === 'all') {
    return !currentOwner.value && !currentStatus.value && !currentStarred.value && !currentTeam.value && activeView.value !== 'teams'
  }
  if (key === 'mine') {
    return currentOwner.value === 'me' && !currentStarred.value && !currentTeam.value && activeView.value !== 'teams'
  }
  if (key === 'teams') {
    return activeView.value === 'teams'
  }
  if (key === 'archived') {
    return currentStatus.value === 'archived' && !currentStarred.value && !currentTeam.value && activeView.value !== 'teams'
  }
  // starred
  return !!currentStarred.value && activeView.value !== 'teams'
}

const teamChips = computed(() => {
  if (activeView.value !== 'teams') return []
  return [...myOwned.value, ...myJoined.value]
})

const teamsChipRowVisible = computed(() =>
  showTabs.value && activeView.value === 'teams' && !props.owner
)

const currentTeamInfo = computed(() =>
  [...myOwned.value, ...myJoined.value].find(t => t.slug === currentTeam.value) ?? null
)

const teamUnavailable = computed(() =>
  authState.value === 'authenticated' && !!unavailableTeam.value
)

const teamEmptyVisible = computed(() =>
  authState.value === 'authenticated'
  && !!currentTeam.value
  && !teamUnavailable.value
  && !loading.value
  && !error.value
  && entries.value.length === 0
)

const teamsEmptyVisible = computed(() =>
  authState.value === 'authenticated'
  && activeView.value === 'teams'
  && !currentTeam.value
  && !loading.value
  && !error.value
  && myOwned.value.length === 0
  && myJoined.value.length === 0
  && entries.value.length === 0
)

const emptyTestId = computed(() => {
  if (teamEmptyVisible.value) return 'team-empty'
  if (teamsEmptyVisible.value) return 'teams-empty'
  return undefined
})

const emptyStateHeading = computed(() => {
  if (ownerFound.value === true && props.owner) return `No entries from @${props.owner}`
  if (teamEmptyVisible.value) return '该团队暂无内容'
  if (teamsEmptyVisible.value) return '暂无团队内容'
  if (currentStarred.value) return '暂无星标内容'
  if (currentStatus.value === 'archived') return '暂无已归档条目'
  return 'No entries found'
})

const emptyStateDescription = computed(() => {
  if (teamEmptyVisible.value) return '该团队还没有发布任何内容。'
  if (teamsEmptyVisible.value) return '你可以创建或加入团队，也可以从下方管理你的团队。'
  return ''
})

const searchQuery = ref('')
const viewMode = ref<'grid' | 'list'>(loadViewMode())
let suppressRouteUpdate = false
let teamRestorePending = false

function updateURL(params: Record<string, string | undefined>): void {
  const currentQuery = window.location.search.slice(1)
  const newQuery = mergeQuery(currentQuery, params)
  const path = props.owner ? `/users/${props.owner}` : '/explore'

  suppressRouteUpdate = true
  if (!newQuery) {
    router.push({ path })
  } else {
    const queryObj: Record<string, string> = {}
    new URLSearchParams(newQuery).forEach((value, key) => {
      queryObj[key] = value
    })
    router.push({ path, query: queryObj })
  }
  nextTick(() => { suppressRouteUpdate = false })
}

function flushSearch() {
  const q = searchQuery.value.trim()
  updateURL({ q: q || undefined, page: undefined })
  currentPage.value = 1
  loadEntries({ page: 1, perPage: perPage.value, owner: effectiveOwner.value, status: effectiveStatus.value, starred: effectiveStarred.value, team: effectiveTeam.value, q: q || undefined, tags: currentTags.value.length ? currentTags.value : undefined })
}

function clearSearch() {
  searchQuery.value = ''
  updateURL({ q: undefined })
  currentPage.value = 1
  loadEntries({ page: 1, perPage: perPage.value, owner: effectiveOwner.value, status: effectiveStatus.value, starred: effectiveStarred.value, team: effectiveTeam.value, tags: currentTags.value.length ? currentTags.value : undefined })
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

function loadNow() {
  currentPage.value = 1
  loadEntries({ page: 1, perPage: perPage.value, owner: effectiveOwner.value, status: effectiveStatus.value, starred: effectiveStarred.value, team: effectiveTeam.value, q: searchQuery.value || undefined, tags: currentTags.value.length ? currentTags.value : undefined })
}

function selectTab(key: TabKey) {
  if (key === 'all') {
    currentOwner.value = null
    currentStatus.value = null
    currentStarred.value = false
    currentTeam.value = null
    activeView.value = 'all'
    loadNow()
    updateURL({ owner: undefined, status: undefined, starred: undefined, view: undefined, team: undefined, page: undefined })
  } else if (key === 'mine') {
    currentOwner.value = 'me'
    currentStatus.value = null
    currentStarred.value = false
    currentTeam.value = null
    activeView.value = 'all'
    loadNow()
    updateURL({ owner: 'me', status: undefined, starred: undefined, view: undefined, team: undefined, page: undefined })
  } else if (key === 'archived') {
    currentOwner.value = null
    currentStatus.value = 'archived'
    currentStarred.value = false
    currentTeam.value = null
    activeView.value = 'all'
    loadNow()
    updateURL({ owner: undefined, status: 'archived', starred: undefined, view: undefined, team: undefined, page: undefined })
  } else if (key === 'starred') {
    currentOwner.value = null
    currentStatus.value = null
    currentStarred.value = true
    currentTeam.value = null
    currentTags.value = []
    activeView.value = 'all'
    loadNow()
    updateURL({ owner: undefined, status: undefined, starred: '1', view: undefined, team: undefined, page: undefined })
  } else if (key === 'teams') {
    currentOwner.value = null
    currentStatus.value = null
    currentStarred.value = false
    currentTeam.value = null
    activeView.value = 'teams'
    ensureMyTeamsLoaded()
    loadNow()
    updateURL({ owner: undefined, status: undefined, starred: undefined, view: 'teams', team: undefined, page: undefined })
  }
}

function selectTeamChip(slug: string) {
  currentTeam.value = slug
  activeView.value = 'teams'
  currentOwner.value = null
  currentStatus.value = null
  currentStarred.value = false
  loadNow()
  updateURL({ view: 'teams', team: slug, owner: undefined, status: undefined, starred: undefined, page: undefined })
}

function clearTeamFilter() {
  currentTeam.value = null
  activeView.value = 'teams'
  unavailableTeam.value = null
  currentPage.value = 1
  loadEntries({ page: 1, perPage: perPage.value, team: 'me', owner: undefined, status: undefined, starred: undefined, q: searchQuery.value || undefined, tags: currentTags.value.length ? currentTags.value : undefined })
  updateURL({ team: undefined, view: 'teams', owner: undefined, status: undefined, starred: undefined, page: undefined })
}

function ensureMyTeamsLoaded() {
  if (authState.value === 'authenticated' && !teamsLoaded.value) {
    loadMyTeams()
  }
}

function onTablistKeydown(e: KeyboardEvent) {
  const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('.owner-tab'))
  const currentIndex = tabs.indexOf(document.activeElement as HTMLButtonElement)
  if (e.key === 'ArrowRight' && currentIndex >= 0 && tabs[currentIndex + 1]) {
    e.preventDefault()
    tabs[currentIndex + 1].focus()
    selectTab(tabDefs[currentIndex + 1].key)
  } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
    e.preventDefault()
    tabs[currentIndex - 1].focus()
    selectTab(tabDefs[currentIndex - 1].key)
  } else if (e.key === 'Home' && tabs.length) {
    e.preventDefault()
    tabs[0].focus()
    selectTab(tabDefs[0].key)
  } else if (e.key === 'End' && tabs.length) {
    e.preventDefault()
    tabs[tabs.length - 1].focus()
    selectTab(tabDefs[tabs.length - 1].key)
  }
}

function clearOwnerFilter() {
  currentOwner.value = null
  currentStatus.value = null
  currentStarred.value = false
  currentTeam.value = null
  activeView.value = 'all'
  currentPage.value = 1
  loadEntries({ page: 1, perPage: perPage.value, starred: undefined, team: undefined, q: searchQuery.value || undefined, tags: currentTags.value.length ? currentTags.value : undefined })
  updateURL({ owner: undefined, status: undefined, starred: undefined, view: undefined, team: undefined, page: undefined })
}

function removeTag(tag: string) {
  currentTags.value = currentTags.value.filter(t => t !== tag)
  currentPage.value = 1
  updateURL({ tags: currentTags.value.length ? currentTags.value.join(',') : undefined, page: undefined })
  loadEntries({ page: 1, perPage: perPage.value, owner: effectiveOwner.value, status: effectiveStatus.value, starred: effectiveStarred.value, team: effectiveTeam.value, q: searchQuery.value || undefined, tags: currentTags.value.length ? currentTags.value : undefined })
}

const showLogin = ref(false)

function handleLogout() {
  if (currentStatus.value === 'archived') {
    currentStatus.value = null
  }
  currentTeam.value = null
  activeView.value = 'all'
  authStore.logout()
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

watch(viewMode, (mode) => {
  saveViewMode(mode)
})

watch(currentPage, (newPage) => {
  updateURL({ page: newPage > 1 ? String(newPage) : undefined, starred: effectiveStarred.value ? '1' : undefined, team: currentTeam.value || undefined, view: activeView.value === 'teams' ? 'teams' : undefined })
  loadEntries({ page: newPage, perPage: perPage.value, owner: effectiveOwner.value, status: effectiveStatus.value, starred: effectiveStarred.value, team: effectiveTeam.value, q: searchQuery.value || undefined, tags: currentTags.value.length ? currentTags.value : undefined })
})

watch(() => props.owner, (newOwner) => {
  if (newOwner) {
    currentOwner.value = null
    currentStatus.value = null
    currentStarred.value = false
    currentTeam.value = null
    activeView.value = 'all'
    currentPage.value = 1
    loadEntries({ page: 1, perPage: perPage.value, owner: newOwner, starred: undefined, q: searchQuery.value || undefined, tags: currentTags.value.length ? currentTags.value : undefined })
  }
})

function applyUrlToState() {
  const urlParams = new URLSearchParams(window.location.search)
  const authenticated = authState.value === 'authenticated'

  searchQuery.value = (urlParams.get('q') ?? '')
  const pageParam = urlParams.get('page')
  currentPage.value = pageParam && parseInt(pageParam, 10) > 0 ? parseInt(pageParam, 10) : 1
  const tagsParam = urlParams.get('tags')
  currentTags.value = tagsParam ? tagsParam.split(',').filter(Boolean) : []

  if (props.owner) {
    currentOwner.value = null
    currentStatus.value = null
    currentStarred.value = false
    currentTeam.value = null
    activeView.value = 'all'
    return
  }

  const starredParam = urlParams.get('starred')
  const ownerParam = urlParams.get('owner')
  const statusParam = urlParams.get('status')
  const viewParam = urlParams.get('view')
  const teamParam = urlParams.get('team')

  currentStarred.value = starredParam === '1' && authenticated
  if (currentStarred.value) {
    currentOwner.value = null
    currentStatus.value = null
    currentTeam.value = null
    activeView.value = 'all'
    return
  }

  // owner/status/archived dims (mutually exclusive with team/view)
  currentOwner.value = null
  currentStatus.value = null
  currentTeam.value = null
  unavailableTeam.value = null
  activeView.value = 'all'

  if (ownerParam === 'me' && authenticated) {
    currentOwner.value = 'me'
  } else if (ownerParam && ownerParam !== 'me') {
    currentOwner.value = ownerParam
  }
  if (statusParam) {
    currentStatus.value = statusParam
  }

  if (authenticated && viewParam === 'teams') {
    activeView.value = 'teams'
  }

  if (authenticated && teamParam) {
    if (teamsLoaded.value) {
      if (isTeamMember(teamParam)) {
        currentTeam.value = teamParam
        activeView.value = 'teams'
      } else {
        unavailableTeam.value = teamParam
      }
    } else {
      teamRestorePending = true
    }
  }
}

watch(teamsLoaded, (loaded) => {
  if (loaded && teamRestorePending) {
    teamRestorePending = false
    const teamParam = new URLSearchParams(window.location.search).get('team')
    if (teamParam) {
      if (isTeamMember(teamParam)) {
        currentTeam.value = teamParam
        activeView.value = 'teams'
      } else {
        unavailableTeam.value = teamParam
      }
    }
  }
})

// 初始恢复在 setup 期同步执行（首帧即生效，URL team/view 决定不可用态/空态）
applyUrlToState()
if (authState.value === 'authenticated') ensureMyTeamsLoaded()

watch(authState, (newState, oldState) => {
  if (newState === 'authenticated' && oldState !== 'authenticated') {
    authChangeAnnouncement.value = 'Signed in. List refreshed.'
    applyUrlToState()
    ensureMyTeamsLoaded()
    if (!teamUnavailable.value) {
      currentPage.value = 1
      loadEntries({ page: 1, perPage: perPage.value, owner: effectiveOwner.value, status: effectiveStatus.value, starred: effectiveStarred.value, team: effectiveTeam.value, q: searchQuery.value || undefined, tags: currentTags.value.length ? currentTags.value : undefined })
    }
  } else if (newState === 'anonymous' && oldState === 'authenticated') {
    authChangeAnnouncement.value = 'Signed out. List refreshed.'
    const wasFiltered = currentStarred.value || currentStatus.value === 'archived' || currentTeam.value
    currentStarred.value = false
    currentStatus.value = null
    currentTeam.value = null
    activeView.value = 'all'
    unavailableTeam.value = null
    if (wasFiltered) {
      nextTick(() => {
        document.querySelector<HTMLButtonElement>('.owner-tab[data-testid="tab-all"]')?.focus()
      })
    }
    currentPage.value = 1
    loadEntries({ page: 1, perPage: perPage.value, owner: effectiveOwner.value, status: effectiveStatus.value, starred: undefined, team: undefined, q: searchQuery.value || undefined, tags: currentTags.value.length ? currentTags.value : undefined }, { clearOnError: false })
  }
})

onMounted(() => {
  if (props.owner) {
    currentOwner.value = null
  }
  if (!teamUnavailable.value) {
    loadEntries({ page: currentPage.value, perPage: perPage.value, owner: effectiveOwner.value, status: effectiveStatus.value, starred: effectiveStarred.value, team: effectiveTeam.value, q: searchQuery.value || undefined, tags: currentTags.value.length ? currentTags.value : undefined })
  }
})

onBeforeRouteUpdate((to) => {
  if (suppressRouteUpdate) return
  if (to.path !== '/explore' && !to.path.startsWith('/users/')) return

  window.history.replaceState({}, '', to.fullPath)
  applyUrlToState()
  if (!teamUnavailable.value) {
    loadEntries({ page: currentPage.value, perPage: perPage.value, owner: effectiveOwner.value, status: effectiveStatus.value, starred: effectiveStarred.value, team: effectiveTeam.value, q: searchQuery.value || undefined, tags: currentTags.value.length ? currentTags.value : undefined })
  }
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

.explore-search {
  max-width: 280px;
  min-width: 0;
}

.list-content { padding: var(--space-4); max-width: 1200px; margin: 0 auto; width: 100%; flex: 1; }

.loading-state {
  text-align: center;
  padding: 0;
  color: var(--c-text-secondary);
}

.skeleton-card {
  background: var(--c-surface);
  border: 1px solid var(--c-border-strong);
  border-radius: 14px;
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.skeleton-row {
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--c-border);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.skeleton-bar {
  border-radius: 6px;
  background: var(--c-border);
  animation: shimmer 1.5s infinite;
}

.skeleton-title {
  height: 16px;
  width: 70%;
}

.skeleton-meta {
  height: 13px;
  width: 45%;
}

.skeleton-tags {
  height: 22px;
  width: 55%;
}

@keyframes shimmer {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
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
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.owner-tabs::-webkit-scrollbar {
  display: none;
}

.filter-chip-bar {
}

.teams-chip-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.team-chip {
  display: inline-flex;
  align-items: center;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full, 999px);
  border: 1px solid var(--c-border);
  background: var(--c-surface);
  color: var(--c-text-secondary);
  font-size: var(--font-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.team-chip:hover {
  border-color: var(--c-accent);
  color: var(--c-text);
}

.team-chip.active {
  background: var(--c-accent-surface);
  border-color: var(--c-accent);
  color: var(--c-accent);
}

.teams-manage-link {
  display: inline-flex;
  align-items: center;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-md);
  border: none;
  background: none;
  color: var(--c-accent);
  font-size: var(--font-sm);
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.teams-manage-link:hover {
  background: var(--c-accent-surface);
}

.team-unavailable {
  text-align: center;
  padding: var(--space-7) var(--space-4);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
}

.team-unavailable-title {
  font-size: var(--font-lg);
  font-weight: 600;
  color: var(--c-text);
  margin: 0;
}

.team-unavailable-desc {
  font-size: var(--font-sm);
  color: var(--c-text-secondary);
  margin: 0;
}

.team-unavailable-clear {
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  border: 1px solid var(--c-border-strong);
  background: var(--c-surface);
  color: var(--c-text);
  font-size: var(--font-sm);
  font-weight: 500;
  cursor: pointer;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  transition: all var(--transition-fast);
}

.team-unavailable-clear:hover {
  background: var(--c-surface-lower);
}

.team-state-empty {
  min-height: 200px;
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
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
  flex-shrink: 0;
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
  font-family: Inter, -apple-system, sans-serif;
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
