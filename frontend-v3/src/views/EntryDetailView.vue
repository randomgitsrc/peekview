<template>
  <div class="entry-detail">
    <!-- Header -->
    <header class="detail-header">
      <span class="back-btn" @click="goBack" title="Back to list">⌂</span>
      <h1 class="title">{{ entryTitle }}</h1>
      <div class="header-right">
        <!-- Owner controls (visibility + delete) -->
        <template v-if="entryStore.currentEntry && authStore.isOwner(entryStore.currentEntry.ownerId)">
          <div class="owner-actions desktop-only">
            <button
              class="btn btn-sm"
              :title="entryStore.currentEntry.isPublic ? 'Make private' : 'Make public'"
              @click="handleToggleVisibility"
            >
              {{ entryStore.currentEntry.isPublic ? '🌐 Public' : '🔒 Private' }}
            </button>
            <button
              class="btn btn-sm btn-danger"
              @click="confirmDeleteEntry"
            >
              Delete
            </button>
          </div>
        </template>

        <!-- Entry meta (owner + time) -->
        <span v-if="entryStore.currentEntry?.username" class="entry-owner desktop-only">
          @{{ entryStore.currentEntry.username }}
        </span>
        <span v-if="entryStore.currentEntry?.createdAt" class="entry-time desktop-only">
          {{ formatRelativeTime(entryStore.currentEntry.createdAt) }}
        </span>
        <span v-if="entryStore.currentEntry?.expiresAt" class="entry-expires desktop-only">
          Expires {{ formatExpiresIn(entryStore.currentEntry.expiresAt) }}
        </span>
        <span v-else-if="entryStore.currentEntry" class="entry-expires entry-expires-never desktop-only">
          Never expires
        </span>

        <div class="actions desktop-only" v-if="entryStore.currentEntry">
          <button
            v-if="entryStore.canWrap"
            class="btn btn-sm"
            :class="{ active: entryStore.wrapEnabled }"
            @click="entryStore.toggleWrap()"
          >
            Wrap
          </button>
          <button
            v-if="entryStore.canCopy"
            class="btn btn-sm"
            :title="isHtml ? 'Copy HTML source' : 'Copy'"
            :aria-label="isHtml ? 'Copy HTML source' : 'Copy'"
            @click="copyContent"
          >
            Copy
          </button>
          <button
            v-if="entryStore.canDownload"
            class="btn btn-sm"
            @click="downloadFile"
          >
            Download
          </button>
          <a
            v-if="entryStore.currentEntry"
            class="btn btn-sm"
            :href="`/api/v1/entries/${entryStore.currentEntry.slug}/raw`"
            target="_blank"
            rel="noopener noreferrer"
            title="Raw content — for Agent/API access"
          >
            Raw
          </a>
          <button
            v-if="entryStore.canPack && entryStore.currentEntry"
            class="btn btn-sm"
            @click="downloadPack"
          >
            Pack
          </button>
        </div>
        <button
          v-if="showTocButton"
          class="btn btn-sm toc-btn"
          @click="showTocDrawer = true"
        >
          TOC
        </button>
        <ThemeToggle />
      </div>
    </header>

    <!-- Content -->
    <div class="detail-content">
      <!-- File Sidebar (desktop) -->
      <aside v-if="showFileSidebar" class="file-sidebar">
        <FileTree
          :files="entryStore.currentEntry?.files || []"
          :activeFileId="entryStore.activeFile?.id ?? null"
          @select="entryStore.selectFile"
        />
      </aside>

      <!-- Main Content Area -->
      <main class="content-area">
        <!-- Loading State -->
        <div v-if="entryStore.loading" class="loading-state">
          <span>Loading...</span>
        </div>

        <!-- Error State -->
        <div v-else-if="entryStore.error" class="error-state">
          <span>{{ entryStore.error }}</span>
        </div>

        <!-- Empty State -->
        <div v-else-if="!entryStore.currentEntry" class="empty-state">
          <span>Entry not found</span>
        </div>

        <!-- Content -->
        <template v-else-if="entryStore.activeFile">
          <!-- HTML File -->
          <HtmlViewer
            v-if="isHtml"
            :slug="slug"
            :file-id="entryStore.activeFile.id"
            :content="entryStore.fileContent"
            :sibling-file-ids="siblingFileIds"
          />

          <!-- Markdown File -->
          <MarkdownViewer
            v-else-if="isMarkdown"
            :content="entryStore.fileContent"
            :headings="tocHeadings"
            @select-heading="scrollToHeading"
          />

          <!-- Image File -->
          <ImageViewer
            v-else-if="isImage"
            :filename="entryStore.activeFile.filename"
            :slug="slug"
            :file-id="entryStore.activeFile.id"
          />

          <!-- Code File -->
          <CodeViewer
            v-else
            :content="entryStore.fileContent"
            :filename="entryStore.activeFile.filename"
            :language="entryStore.activeFile.language"
            :wrap="entryStore.wrapEnabled"
            :can-wrap="entryStore.canWrap"
            :loading="entryStore.loading"
            @toggle-wrap="entryStore.toggleWrap()"
          />
        </template>

        <!-- No file selected -->
        <div v-else class="empty-state">
          <span>Select a file to view</span>
        </div>
      </main>

      <!-- TOC Sidebar (desktop) -->
      <aside v-if="showTocSidebar" class="toc-sidebar">
        <TocNav
          :headings="tocHeadings"
          :activeId="null"
          @select="scrollToHeading"
        />
      </aside>
    </div>

    <!-- Mobile Actions -->
    <div class="mobile-actions" v-if="entryStore.currentEntry">
      <!-- Owner actions on mobile -->
      <template v-if="authStore.isOwner(entryStore.currentEntry.ownerId)">
        <button
          class="btn btn-sm"
          :title="entryStore.currentEntry.isPublic ? 'Make private' : 'Make public'"
          @click="handleToggleVisibility"
        >
          {{ entryStore.currentEntry.isPublic ? '🌐' : '🔒' }}
        </button>
        <button
          class="btn btn-sm btn-danger"
          @click="confirmDeleteEntry"
        >
          🗑️
        </button>
      </template>
      <button
        v-if="entryStore.isMultiFile"
        class="btn btn-sm menu-btn"
        @click="showFileDrawer = true"
      >
        Files ({{ entryStore.currentEntry?.files.length || 0 }})
      </button>
      <button
        v-if="entryStore.canWrap"
        class="btn btn-sm"
        :class="{ active: entryStore.wrapEnabled }"
        @click="entryStore.toggleWrap()"
      >
        Wrap
      </button>
      <button
        v-if="entryStore.canCopy"
        class="btn btn-sm"
        :title="isHtml ? 'Copy HTML source' : 'Copy'"
        :aria-label="isHtml ? 'Copy HTML source' : 'Copy'"
        @click="copyContent"
      >
        Copy
      </button>
      <button
        v-if="entryStore.canDownload"
        class="btn btn-sm"
        @click="downloadFile"
      >
        Download
      </button>
      <a
        v-if="entryStore.currentEntry"
        class="btn btn-sm"
        :href="`/api/v1/entries/${entryStore.currentEntry.slug}/raw`"
        target="_blank"
        rel="noopener noreferrer"
        title="Raw content — for Agent/API access"
      >
        Raw
      </a>
      <button
        v-if="entryStore.canPack && entryStore.currentEntry"
        class="btn btn-sm"
        @click="downloadPack"
      >
        Pack
      </button>
      <button
        v-if="showTocButton"
        class="btn btn-sm"
        @click="showTocDrawer = true"
      >
        TOC
      </button>
    </div>

    <!-- File Drawer (mobile) -->
    <div v-if="showFileDrawer" class="drawer-overlay" @click="showFileDrawer = false"></div>
    <aside v-if="showFileDrawer" class="drawer drawer-left">
      <div class="drawer-header">
        <span>Files</span>
        <span class="drawer-close" @click="showFileDrawer = false">&times;</span>
      </div>
      <FileTree
        :files="entryStore.currentEntry?.files || []"
        :activeFileId="entryStore.activeFile?.id ?? null"
        @select="selectFileAndCloseDrawer"
      />
    </aside>

    <!-- TOC Drawer (mobile) -->
    <div v-if="showTocDrawer" class="drawer-overlay" @click="showTocDrawer = false"></div>
    <aside v-if="showTocDrawer" class="drawer drawer-right">
      <div class="drawer-header">
        <span>Table of Contents</span>
        <span class="drawer-close" @click="showTocDrawer = false">&times;</span>
      </div>
      <TocNav
        :headings="tocHeadings"
        :activeId="null"
        @select="selectTocAndCloseDrawer"
      />
    </aside>

    <!-- Confirm dialog for delete -->
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
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useEntryStore } from '@/stores/entry'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import CodeViewer from '@/components/CodeViewer.vue'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import HtmlViewer from '@/components/HtmlViewer.vue'
import ImageViewer from '@/components/ImageViewer.vue'
import { guessMimeType } from '@/utils/mime'
import { formatExpiresIn } from '@/utils/expires'
import FileTree from '@/components/FileTree.vue'
import TocNav from '@/components/TocNav.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import type { TocHeading } from '@/types'

const props = defineProps<{
  slug: string
}>()

const router = useRouter()
const entryStore = useEntryStore()
const authStore = useAuthStore()
const toast = useToast()
const { currentEntry, activeFile } = storeToRefs(entryStore)

// Drawer state
const showFileDrawer = ref(false)
const showTocDrawer = ref(false)

// Sibling file IDs for HTML render route injection
const siblingFileIds = computed<number[]>(() => {
  if (!currentEntry.value || !activeFile.value) return []
  if (activeFile.value.language !== 'html') return []
  return currentEntry.value.files
    .filter(f => f.id !== activeFile.value!.id)
    .map(f => f.id)
})

// Delete confirmation
const showConfirmDelete = ref(false)
const deleteMessage = computed(() =>
  currentEntry.value
    ? `Are you sure you want to delete "${currentEntry.value.summary}"?`
    : ''
)

function confirmDeleteEntry() {
  showConfirmDelete.value = true
}

async function handleDelete() {
  if (!currentEntry.value) return
  const success = await entryStore.deleteEntry(currentEntry.value.slug)
  if (success) {
    toast.show('Entry deleted', 'success')
    router.push('/')
  } else {
    toast.show('Failed to delete entry', 'error')
  }
}

function cancelDelete() {
  // ConfirmDialog already sets visible=false
}

// Visibility toggle
async function handleToggleVisibility() {
  if (!currentEntry.value) return
  const success = await entryStore.toggleVisibility(currentEntry.value)
  if (success) {
    toast.show(currentEntry.value.isPublic ? 'Entry made public' : 'Entry made private', 'success')
  } else {
    toast.show('Failed to change visibility', 'error')
  }
}

// Computed properties
const entryTitle = computed(() => {
  return currentEntry.value?.summary || props.slug
})

const isMarkdown = computed(() => {
  return activeFile.value?.language === 'markdown'
})

const isHtml = computed(() => {
  return activeFile.value?.language === 'html'
})

const isImage = computed(() => {
  const file = activeFile.value
  if (!file) return false
  const mime = guessMimeType(file.filename)
  // SVG is text format, others are binary
  if (mime === 'image/svg+xml') return true
  return file.isBinary && (mime?.startsWith('image/') ?? false)
})

const showFileSidebar = computed(() => {
  return entryStore.isMultiFile
})

const showTocSidebar = computed(() => {
  return isMarkdown.value && tocHeadings.value.length > 0
})

const showTocButton = computed(() => {
  return isMarkdown.value && tocHeadings.value.length > 0
})

const tocHeadings = computed<TocHeading[]>(() => {
  if (!isMarkdown.value || !entryStore.fileContent) {
    return []
  }
  return extractHeadings(entryStore.fileContent)
})

// Methods
function goBack() {
  router.push('/')
}

function selectFileAndCloseDrawer(file: { id: number }) {
  entryStore.selectFile(file as { id: number; path: string; filename: string; language: string | null; isBinary: boolean; size: number; lineCount: number })
  showFileDrawer.value = false
}

function selectTocAndCloseDrawer(heading: TocHeading) {
  scrollToHeading(heading)
  showTocDrawer.value = false
}

function scrollToHeading(heading: TocHeading) {
  const element = document.getElementById(heading.id)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth' })
  }
}

function copyContent() {
  if (entryStore.fileContent) {
    navigator.clipboard.writeText(entryStore.fileContent)
  }
}

function downloadFile() {
  if (!activeFile.value || !currentEntry.value) return

  const blob = new Blob([entryStore.fileContent], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = activeFile.value.filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

async function downloadPack() {
  if (!currentEntry.value) return

  try {
    const response = await fetch(`/api/v1/entries/${currentEntry.value.slug}/download`)
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`)
    }

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${currentEntry.value.slug}.zip`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.show('Pack downloaded', 'success')
  } catch (e) {
    console.error('Pack download error:', e)
    toast.show('Failed to download pack', 'error')
  }
}

function extractHeadings(content: string): TocHeading[] {
  const headings: TocHeading[] = []
  const lines = content.split('\n')
  const usedIds = new Set<string>()

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/)
    if (match) {
      const level = match[1].length
      if (level < 2 || level > 4) continue

      const text = match[2].trim()
      let id = text.toLowerCase()
        .replace(/[^\w\s一-龥぀-ゟ゠-ヿ-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 50) || 'heading'

      let uniqueId = id
      let counter = 1
      while (usedIds.has(uniqueId)) {
        uniqueId = `${id}-${counter}`
        counter++
      }
      usedIds.add(uniqueId)

      headings.push({ level, text, id: uniqueId })
    }
  }

  return headings
}

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

// Load entry on mount and when slug changes
onMounted(() => {
  entryStore.loadEntry(props.slug)
})

watch(() => props.slug, (newSlug) => {
  entryStore.loadEntry(newSlug)
})

// Inject <link rel="alternate"> for machine-readable raw access
watch(() => entryStore.currentEntry, (entry) => {
  document.querySelectorAll('link[data-peekview-raw]').forEach(el => el.remove())
  if (entry) {
    const link = document.createElement('link')
    link.rel = 'alternate'
    link.type = 'application/json'
    link.href = `/api/v1/entries/${entry.slug}/raw`
    link.setAttribute('data-peekview-raw', '1')
    document.head.appendChild(link)
  }
}, { immediate: true })
</script>

<style scoped>
@import '@/styles/layout.css';

.btn {
  padding: var(--space-1) var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
  font-size: var(--font-sm);
  transition: all var(--transition-fast);
}

.btn:hover {
  background: var(--bg-tertiary);
  border-color: var(--border-hover);
}

.btn.active {
  background: var(--accent-color);
  color: var(--text-on-accent);
  border-color: var(--accent-color);
}

.btn-sm {
  padding: var(--space-1) var(--space-2);
  font-size: var(--font-xs);
}

.btn-danger {
  color: var(--error-text);
  border-color: var(--error-border);
}

.btn-danger:hover {
  background: var(--error-bg);
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.header-right .actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.owner-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.entry-owner {
  font-size: var(--font-xs);
  color: var(--accent-color);
}

.entry-time {
  font-size: var(--font-xs);
  color: var(--text-secondary);
}

.entry-expires {
  font-size: var(--font-xs);
  color: var(--text-secondary);
}

.entry-expires-never {
  color: var(--text-tertiary);
}
</style>

<style>
/* Global styles for detail header */
.detail-header .back-btn {
  font-size: 24px;
  cursor: pointer;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-md);
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.detail-header .back-btn:hover {
  background: var(--bg-tertiary);
}

/* Hide desktop-only elements on mobile */
@media (max-width: 768px) {
  .desktop-only {
    display: none !important;
  }
}
</style>