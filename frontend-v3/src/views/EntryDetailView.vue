<template>
  <div class="entry-detail" :class="{ 'zen-mode': zenMode }">
    <span class="sr-only" aria-live="polite">{{ zenAriaText }}</span>
    <!-- Header -->
    <header class="detail-header">
      <router-link to="/" class="detail-logo" title="Back to home">
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none"><rect x="2" y="2" width="28" height="28" rx="8" fill="var(--c-accent)"/><path d="M12 23.5V9.5h5.4a4.6 4.6 0 0 1 0 9.2H12" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </router-link>
      <div class="title-group">
        <h1 class="title">{{ entryTitle }}</h1>
        <div v-if="currentEntry?.tags?.length" class="header-tags">
          <BaseTag v-for="tag in visibleTags" :key="tag">{{ tag }}</BaseTag>
          <span v-if="remainingTagCount > 0" class="tag-overflow">+{{ remainingTagCount }}</span>
        </div>
      </div>
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
        <span v-if="currentEntry?.createdAt" class="entry-time desktop-only" :title="fullTime">
          {{ relativeTime }}
        </span>
        <span v-if="currentEntry?.readStats" class="entry-read-stats desktop-only">
          {{ currentEntry.readStats.totalCount }} read{{ currentEntry.readStats.totalCount !== 1 ? 's' : '' }}
          <template v-if="Object.keys(currentEntry.readStats.byChannel).length > 1">
            (API {{ currentEntry.readStats.byChannel.api ?? 0 }}, MCP {{ currentEntry.readStats.byChannel.mcp ?? 0 }})
          </template>
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
          <BaseButton
            v-if="entryStore.currentEntry"
            size="small"
            variant="secondary"
            :href="`/api/v1/entries/${entryStore.currentEntry.slug}/raw`"
            target="_blank"
            rel="noopener noreferrer"
            title="Raw content — for Agent/API access"
          >
            Raw
          </BaseButton>
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
      <OverflowMenu :items="overflowItems" />
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
import OverflowMenu from '@/components/OverflowMenu.vue'
import type { OverflowMenuItem } from '@/components/OverflowMenu.vue'
import CodeViewer from '@/components/CodeViewer.vue'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import HtmlViewer from '@/components/HtmlViewer.vue'
import ImageViewer from '@/components/ImageViewer.vue'
import { guessMimeType } from '@/utils/mime'
import { formatExpiresIn } from '@/utils/expires'
import { useRelativeTime } from '@/composables/useRelativeTime'
import { shouldHandleZenShortcut, redirectFocusIfHidden } from '@/utils/zen-shortcut'
import BaseTag from '@/components/BaseTag.vue'
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

const TAG_LIMIT = 3

const visibleTags = computed(() => (currentEntry.value?.tags ?? []).slice(0, TAG_LIMIT))

const remainingTagCount = computed(() => Math.max(0, (currentEntry.value?.tags?.length ?? 0) - TAG_LIMIT))

const createdAtRef = computed(() => currentEntry.value?.createdAt ?? null)
const { relative: relativeTime, full: fullTime } = useRelativeTime(createdAtRef)

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

const overflowItems = computed(() => {
  const items: OverflowMenuItem[] = []
  if (currentEntry.value && authStore.isOwner(currentEntry.value.ownerId)) {
    items.push({
      label: currentEntry.value.isPublic ? 'Make Private' : 'Make Public',
      icon: currentEntry.value.isPublic ? '🔒' : '🌐',
      action: handleToggleVisibility,
    })
    if (showShareButton.value) {
      items.push({ label: 'Share', action: () => { showShareDialog.value = true } })
    }
    items.push({
      label: 'Delete',
      icon: '🗑️',
      variant: 'danger',
      action: confirmDeleteEntry,
    })
  }
  if (entryStore.canDownload) {
    items.push({ label: 'Download', action: downloadFile })
  }
  if (currentEntry.value) {
    items.push({
      label: 'Raw',
      href: `/api/v1/entries/${currentEntry.value.slug}/raw`,
      target: '_blank',
      rel: 'noopener noreferrer',
    })
  }
  if (entryStore.canPack && currentEntry.value) {
    items.push({ label: 'Pack', action: downloadPack })
  }
  if (showTocButton.value) {
    items.push({ label: 'TOC', action: () => { showTocDrawer.value = true } })
  }
  return items
})

const tocHeadings = computed<TocHeading[]>(() => {
  if (!isMarkdown.value || !entryStore.fileContent) {
    return []
  }
  return extractHeadings(entryStore.fileContent)
})

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
  cursor: default;
}

.title-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.header-tags {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.tag-overflow {
  display: inline-flex;
  align-items: center;
  background: var(--c-tag-bg);
  color: var(--c-text-tertiary);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: var(--font-xs);
  font-family: var(--font-mono);
}

.entry-expires {
  font-size: var(--font-xs);
  color: var(--c-text-secondary);
}

.entry-read-stats {
  font-size: var(--font-xs);
  color: var(--c-text-secondary);
}

.entry-expires-never {
  color: var(--c-text-tertiary);
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
