<template>
  <div class="entry-detail" :class="{ 'zen-mode': zenMode }">
    <span class="sr-only" aria-live="polite">{{ zenAriaText }}</span>
    <!-- Header -->
    <header class="detail-header">
      <span class="back-btn" @click="goBack" title="Back to list">⌂</span>
      <h1 class="title">{{ entryTitle }}</h1>
      <div class="header-right">
        <!-- Owner controls (visibility + delete) -->
        <template v-if="entryStore.currentEntry && authStore.isOwner(entryStore.currentEntry.ownerId)">
          <div class="owner-actions desktop-only">
            <BaseButton
              size="small"
              :variant="entryStore.currentEntry.isPublic ? 'secondary' : 'secondary'"
              :title="entryStore.currentEntry.isPublic ? 'Make private' : 'Make public'"
              @click="handleToggleVisibility"
            >
              {{ entryStore.currentEntry.isPublic ? '🌐 Public' : '🔒 Private' }}
            </BaseButton>
            <BaseButton
              v-if="showShareButton"
              size="small"
              variant="secondary"
              @click="showShareDialog = true"
            >
              Share
            </BaseButton>
            <BaseButton
              size="small"
              variant="danger"
              @click="confirmDeleteEntry"
            >
              Delete
            </BaseButton>
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
          <BaseButton
            v-if="entryStore.canWrap"
            size="small"
            :variant="entryStore.wrapEnabled ? 'primary' : 'secondary'"
            @click="entryStore.toggleWrap()"
          >
            Wrap
          </BaseButton>
          <BaseButton
            v-if="entryStore.canCopy"
            size="small"
            variant="secondary"
            :title="isHtml ? 'Copy HTML source' : 'Copy'"
            :aria-label="isHtml ? 'Copy HTML source' : 'Copy'"
            @click="copyContent"
          >
            Copy
          </BaseButton>
          <BaseButton
            v-if="entryStore.canDownload"
            size="small"
            variant="secondary"
            @click="downloadFile"
          >
            Download
          </BaseButton>
          <a
            v-if="entryStore.currentEntry"
            class="raw-link"
            :href="`/api/v1/entries/${entryStore.currentEntry.slug}/raw`"
            target="_blank"
            rel="noopener noreferrer"
            title="Raw content — for Agent/API access"
          >
            Raw
          </a>
          <BaseButton
            v-if="entryStore.canPack && entryStore.currentEntry"
            size="small"
            variant="secondary"
            @click="downloadPack"
          >
            Pack
          </BaseButton>
        </div>
        <BaseButton
          v-if="showTocButton"
          size="small"
          variant="secondary"
          class="toc-btn"
          @click="showTocDrawer = true"
        >
          TOC
        </BaseButton>
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
      <main class="content-area entry-content" tabindex="-1">
        <!-- Loading State -->
        <div v-if="entryStore.loading" class="loading-state">
          <span>Loading...</span>
        </div>

        <!-- Error State -->
        <div v-else-if="entryStore.error" class="error-state" :class="{ 'share-error': shareErrorState }">
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
        <BaseButton
          size="small"
          variant="secondary"
          :title="entryStore.currentEntry.isPublic ? 'Make private' : 'Make public'"
          @click="handleToggleVisibility"
        >
          {{ entryStore.currentEntry.isPublic ? '🌐' : '🔒' }}
        </BaseButton>
        <BaseButton
          v-if="showShareButton"
          size="small"
          variant="secondary"
          @click="showShareDialog = true"
        >
          Share
        </BaseButton>
        <BaseButton
          size="small"
          variant="danger"
          @click="confirmDeleteEntry"
        >
          🗑️
        </BaseButton>
      </template>
      <BaseButton
        v-if="entryStore.isMultiFile"
        size="small"
        variant="secondary"
        class="menu-btn"
        @click="showFileDrawer = true"
      >
        Files ({{ entryStore.currentEntry?.files.length || 0 }})
      </BaseButton>
      <BaseButton
        v-if="entryStore.canWrap"
        size="small"
        :variant="entryStore.wrapEnabled ? 'primary' : 'secondary'"
        @click="entryStore.toggleWrap()"
      >
        Wrap
      </BaseButton>
      <BaseButton
        v-if="entryStore.canCopy"
        size="small"
        variant="secondary"
        :title="isHtml ? 'Copy HTML source' : 'Copy'"
        :aria-label="isHtml ? 'Copy HTML source' : 'Copy'"
        @click="copyContent"
      >
        Copy
      </BaseButton>
      <BaseButton
        v-if="entryStore.canDownload"
        size="small"
        variant="secondary"
        @click="downloadFile"
      >
        Download
      </BaseButton>
      <a
        v-if="entryStore.currentEntry"
        class="raw-link"
        :href="`/api/v1/entries/${entryStore.currentEntry.slug}/raw`"
        target="_blank"
        rel="noopener noreferrer"
        title="Raw content — for Agent/API access"
      >
        Raw
      </a>
      <BaseButton
        v-if="entryStore.canPack && entryStore.currentEntry"
        size="small"
        variant="secondary"
        @click="downloadPack"
      >
        Pack
      </BaseButton>
      <BaseButton
        v-if="showTocButton"
        size="small"
        variant="secondary"
        @click="showTocDrawer = true"
      >
        TOC
      </BaseButton>
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

    <!-- Share Dialog -->
    <ShareDialog
      v-model:visible="showShareDialog"
      :entry-slug="slug"
      @share-created="handleShareCreated"
    />

    <!-- Share Management Panel (owner, private entry only) -->
    <ShareManagementPanel
      v-if="showShareButton && currentEntry"
      :entry-slug="slug"
      class="entry-content"
      @share-revoked="handleShareRevoked"
    />

    <!-- Share watermark (non-owner share access only) -->
    <div v-if="isShareAccess" class="share-watermark">
      Shared by @{{ currentEntry?.shareContext?.sharedBy }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useEntryStore } from '@/stores/entry'
import { useAuthStore } from '@/stores/auth'
import { useShareStore } from '@/stores/share'
import { useToast } from '@/composables/useToast'
import BaseButton from '@/components/BaseButton.vue'
import CodeViewer from '@/components/CodeViewer.vue'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import HtmlViewer from '@/components/HtmlViewer.vue'
import ImageViewer from '@/components/ImageViewer.vue'
import { guessMimeType } from '@/utils/mime'
import { formatExpiresIn } from '@/utils/expires'
import { shouldHandleZenShortcut, redirectFocusIfHidden } from '@/utils/zen-shortcut'
import FileTree from '@/components/FileTree.vue'
import TocNav from '@/components/TocNav.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import ShareDialog from '@/components/ShareDialog.vue'
import ShareManagementPanel from '@/components/ShareManagementPanel.vue'
import type { TocHeading } from '@/types'

const props = defineProps<{
  slug: string
}>()

const router = useRouter()
const route = useRoute()
const entryStore = useEntryStore()
const authStore = useAuthStore()
const shareStore = useShareStore()
const toast = useToast()
const { currentEntry, activeFile } = storeToRefs(entryStore)

const showFileDrawer = ref(false)
const showTocDrawer = ref(false)

const showShareDialog = ref(false)
const shareErrorState = ref(false)

const isShareAccess = computed(() => {
  if (!currentEntry.value) return false
  if (authStore.isOwner(currentEntry.value.ownerId)) return false
  return currentEntry.value.shareContext?.isShareAccess === true
})

const showShareButton = computed(() => {
  if (!currentEntry.value) return false
  if (!authStore.isOwner(currentEntry.value.ownerId)) return false
  return !currentEntry.value.isPublic
})

const zenMode = ref(false)
const zenAriaText = ref('')

function updateZenAria(zen: boolean) {
  zenAriaText.value = zen ? 'Zen mode on. Press f or Escape to exit.' : 'Zen mode off.'
}

function handleZenKeydown(event: KeyboardEvent) {
  if (!shouldHandleZenShortcut(event)) return
  if (event.key === 'Escape' && zenMode.value) {
    zenMode.value = false
    updateZenAria(false)
    event.preventDefault()
    return
  }
  if (event.key === 'f' || event.key === 'F') {
    zenMode.value = !zenMode.value
    if (zenMode.value) {
      redirectFocusIfHidden()
    }
    updateZenAria(zenMode.value)
    event.preventDefault()
  }
}

const siblingFileIds = computed<number[]>(() => {
  if (!currentEntry.value || !activeFile.value) return []
  if (activeFile.value.language !== 'html') return []
  return currentEntry.value.files
    .filter(f => f.id !== activeFile.value!.id)
    .map(f => f.id)
})

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
    router.push('/explore')
  } else {
    toast.show('Failed to delete entry', 'error')
  }
}

function cancelDelete() {
}

async function handleToggleVisibility() {
  if (!currentEntry.value) return
  const wasPublic = currentEntry.value.isPublic
  const success = await entryStore.toggleVisibility(currentEntry.value)
  if (success) {
    if (!wasPublic) {
    } else {
      toast.show('Entry made private', 'success')
    }
  } else {
    toast.show('Failed to change visibility', 'error')
  }
}

function handleShareCreated() {
  shareStore.fetchShares(props.slug)
}

function handleShareRevoked() {
}

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

function goBack() {
  router.push(authStore.authState === 'authenticated' ? '/explore' : '/')
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

onMounted(async () => {
  const shareToken = route.query.share as string | undefined
  shareErrorState.value = false
  await entryStore.loadEntry(props.slug, shareToken)
  if (shareToken && !currentEntry.value && entryStore.error) {
    shareErrorState.value = true
  }
  if (shareToken) {
    router.replace({ path: route.path, query: {} })
  }
  document.addEventListener('keydown', handleZenKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleZenKeydown)
})

watch(() => props.slug, (newSlug) => {
  entryStore.loadEntry(newSlug)
})

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
  color: var(--c-accent);
}

.entry-time {
  font-size: var(--font-xs);
  color: var(--c-text-secondary);
}

.entry-expires {
  font-size: var(--font-xs);
  color: var(--c-text-secondary);
}

.entry-expires-never {
  color: var(--c-text-tertiary);
}

.raw-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  color: var(--c-text);
  padding: var(--space-1) var(--space-2);
  font-size: var(--font-xs);
  border: 1px solid var(--c-border-strong);
  border-radius: var(--radius-md);
  background: transparent;
  transition: all var(--transition-fast);
}

.raw-link:hover {
  background: var(--c-border);
  border-color: var(--c-text-tertiary);
}

.share-watermark {
  position: fixed;
  bottom: 16px;
  right: 16px;
  background: var(--c-surface);
  color: var(--c-text-secondary);
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 12px;
  z-index: 9999;
  pointer-events: none;
  user-select: none;
}

.share-error {
  color: var(--c-error);
  font-size: 15px;
  text-align: center;
  padding: 40px 16px;
}
</style>

<style>
@media (max-width: 768px) {
  .desktop-only {
    display: none !important;
  }
}
</style>
