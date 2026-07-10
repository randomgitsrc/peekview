<template>
  <div class="entry-detail" :class="{ 'zen-mode': zenMode }">
    <span class="sr-only" aria-live="polite">{{ zenAriaText }}</span>
    <!-- Mobile sticky header -->
    <div v-if="!isDesktop" class="mobile-sticky-header">
      <router-link to="/" class="back-btn" aria-label="Back">
        <ChevronLeftIcon :size="20" />
      </router-link>
      <span class="sticky-title">{{ entryTitle }}</span>
    </div>

    <!-- Desktop/Tablet header -->
    <header v-if="isDesktop" class="detail-header">
      <div class="title-row">
        <router-link to="/" class="detail-logo" title="Back to home">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none"><rect x="2" y="2" width="28" height="28" rx="8" fill="var(--c-accent)"/><path d="M12 23.5V9.5h5.4a4.6 4.6 0 0 1 0 9.2H12" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </router-link>
        <div class="title-group">
          <h1 class="title">{{ entryTitle }}</h1>
        </div>
        <div class="actions-area">
          <button
            v-if="entryStore.isMultiFile"
            :class="['toggle-btn', { active: isFileTreeOpen }]"
            @click="isFileTreeOpen = !isFileTreeOpen"
            aria-label="Toggle file tree"
            :aria-expanded="isFileTreeOpen"
          >
            <FolderIcon :size="16" />
          </button>
          <button
            v-if="isMarkdown && tocHeadings.length > 0"
            :class="['toggle-btn', { active: isTocOpen }]"
            @click="isTocOpen = !isTocOpen"
            aria-label="Table of Contents"
            :aria-expanded="isTocOpen"
          >
            <ListIcon :size="16" />
          </button>
          <span class="action-sep"></span>
          <button
            v-if="entryStore.canCopy"
            class="icon-btn"
            @click="copyContent"
            aria-label="Copy"
          >
            <CopyIcon :size="16" />
          </button>
          <button
            v-if="showShareButton"
            class="icon-btn"
            @click="showShareDialog = true"
            aria-label="Share"
          >
            <Share2Icon :size="16" />
          </button>
          <span class="action-sep"></span>
          <OverflowMenu :items="overflowItems" variant="dropdown" />
          <ThemeToggle />
        </div>
      </div>
      <div class="meta-row">
        <router-link
          v-if="entryStore.currentEntry?.username"
          :to="`/users/${entryStore.currentEntry.username}`"
          class="entry-owner-link"
        >@{{ entryStore.currentEntry.username }}</router-link>
        <span class="meta-dot"></span>
        <span :title="fullTime">{{ relativeTime }}</span>
        <template v-if="entryStore.currentEntry?.status === 'archived'">
          <span class="meta-dot"></span>
          <span class="status-tag">Archived</span>
        </template>
        <template v-else-if="isExpiredButActive">
          <span class="meta-dot"></span>
          <span class="status-tag" style="color:var(--c-warning)">Expired</span>
        </template>
        <template v-else-if="entryStore.currentEntry?.expiresAt">
          <span class="meta-dot"></span>
          <span>Expires {{ formatExpiresIn(entryStore.currentEntry.expiresAt) }}</span>
        </template>
        <span class="meta-sep"></span>
        <span v-if="currentEntry?.readStats">{{ currentEntry.readStats.totalCount }} read{{ currentEntry.readStats.totalCount !== 1 ? 's' : '' }}</span>
        <span class="meta-dot"></span>
        <span :class="['status-tag', entryStore.currentEntry?.isPublic ? 'public' : 'private']">
          {{ entryStore.currentEntry?.isPublic ? 'Public' : 'Private' }}
        </span>
        <template v-for="tag in currentEntry?.tags ?? []" :key="tag">
          <span class="meta-dot"></span>
          <span class="meta-tag">{{ tag }}</span>
        </template>
      </div>
    </header>

    <!-- Expired warning banner -->
    <div v-if="isExpiredButActive" class="expired-warning-banner">
      <span class="expired-warning-text">此条目已过期，等待清理</span>
      <button v-if="authStore.isOwner(entryStore.currentEntry?.ownerId ?? null)" class="expired-edit-btn" @click="showExpiresInDialog = true">重新设置过期时间</button>
    </div>

    <!-- Archived banner -->
    <div v-if="entryStore.currentEntry?.status === 'archived'" class="archived-banner">
      <span class="archived-banner-text">This entry has expired</span>
      <button v-if="authStore.isOwner(entryStore.currentEntry.ownerId)" class="reactivate-btn" @click="showExpiresInDialog = true">Reactivate</button>
    </div>

    <!-- Content -->
    <div class="detail-content">
      <!-- File Sidebar (desktop) -->
      <aside v-if="isFileTreeOpen && entryStore.isMultiFile" class="file-sidebar">
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
            :path-map="pathMap"
            :slug="slug"
            :headings="tocHeadings"
            @select-heading="scrollToHeading"
            @navigate-file="handleNavigateFile"
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
      <aside v-if="isTocOpen && isMarkdown && tocHeadings.length > 0" class="toc-sidebar">
        <TocNav
          :headings="tocHeadings"
          :activeId="null"
          @select="scrollToHeading"
        />
      </aside>
    </div>

    <!-- Mobile meta-tags-bar (scroll-hide) -->
    <div v-if="!isDesktop" ref="metaTagsSentinel" class="meta-tags-bar" :class="{ hidden: metaTagsHidden }">
      <router-link
        v-if="entryStore.currentEntry?.username"
        :to="`/users/${entryStore.currentEntry.username}`"
        class="owner-link"
      >@{{ entryStore.currentEntry.username }}</router-link>
      <span class="meta-dot"></span>
      <span>{{ relativeTime }}</span>
      <span class="meta-sep"></span>
      <span>{{ currentEntry?.readStats?.totalCount ?? 0 }} reads</span>
      <span class="meta-dot"></span>
      <span :class="['status-tag', entryStore.currentEntry?.isPublic ? 'public' : 'private']">
        {{ entryStore.currentEntry?.isPublic ? 'Public' : 'Private' }}
      </span>
      <template v-for="tag in currentEntry?.tags ?? []" :key="tag">
        <span class="meta-dot"></span>
        <span class="meta-tag">{{ tag }}</span>
      </template>
    </div>

    <!-- Mobile bottom bar -->
    <div v-if="!isDesktop && entryStore.currentEntry" class="mobile-bottom-bar">
      <button v-if="entryStore.isMultiFile" class="files-btn" @click="showFileDrawer = true" aria-label="Files">
        <FolderIcon :size="14" /> Files <span class="badge">{{ currentEntry?.files.length ?? 0 }}</span>
      </button>
      <div class="flex-spacer"></div>
      <template v-if="isMarkdown && tocHeadings.length > 0">
        <button class="bottom-btn primary" @click="showTocDrawer = true" aria-label="Table of Contents">
          <ListIcon :size="14" /> TOC
        </button>
      </template>
      <template v-else-if="!isBinary">
        <button v-if="entryStore.canWrap" :class="['bottom-btn', entryStore.wrapEnabled && 'primary']" @click="entryStore.toggleWrap()">
          Wrap
        </button>
        <button v-if="entryStore.canCopy" class="bottom-btn primary" @click="copyContent" aria-label="Copy">
          <CopyIcon :size="14" /> Copy
        </button>
      </template>
      <OverflowMenu :items="overflowItems" variant="sheet" />
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

    <!-- Expires In Dialog -->
    <ExpiresInDialog
      v-model:visible="showExpiresInDialog"
      :entry-slug="slug"
      :is-archived="currentEntry?.status === 'archived'"
      @updated="handleExpiresInUpdated"
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
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useEntryStore } from '@/stores/entry'
import { useAuthStore } from '@/stores/auth'
import { useShareStore } from '@/stores/share'
import { useThemeStore } from '@/stores/theme'
import { useToast } from '@/composables/useToast'
import OverflowMenu from '@/components/OverflowMenu.vue'
import type { OverflowMenuItem } from '@/components/OverflowMenu.vue'
import CodeViewer from '@/components/CodeViewer.vue'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import HtmlViewer from '@/components/HtmlViewer.vue'
import ImageViewer from '@/components/ImageViewer.vue'
import { guessMimeType } from '@/utils/mime'
import { buildPathMap } from '@/utils/path-map'
import type { PathMap } from '@/utils/path-map'
import { formatExpiresIn, isExpired } from '@/utils/expires'
import { useRelativeTime } from '@/composables/useRelativeTime'
import { shouldHandleZenShortcut, redirectFocusIfHidden } from '@/utils/zen-shortcut'
import FileTree from '@/components/FileTree.vue'
import TocNav from '@/components/TocNav.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import ShareDialog from '@/components/ShareDialog.vue'
import ShareManagementPanel from '@/components/ShareManagementPanel.vue'
import ExpiresInDialog from '@/components/ExpiresInDialog.vue'
import type { TocHeading } from '@/types'
import {
  ChevronLeft as ChevronLeftIcon,
  Folder as FolderIcon,
  List as ListIcon,
  Copy as CopyIcon,
  Share2 as Share2Icon,
} from 'lucide-vue-next'

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
const showExpiresInDialog = ref(false)

const isFileTreeOpen = ref(false)
const isTocOpen = ref(false)

const isDesktop = ref(window.innerWidth >= 768)
let resizeTimer = 0
function handleResize() {
  if (resizeTimer) cancelAnimationFrame(resizeTimer)
  resizeTimer = requestAnimationFrame(() => {
    isDesktop.value = window.innerWidth >= 768
  })
}

const metaTagsSentinel = ref<HTMLElement>()
const metaTagsHidden = ref(false)
let tagsObserver: IntersectionObserver | null = null

const isShareAccess = computed(() => {
  if (!currentEntry.value) return false
  if (authStore.isOwner(currentEntry.value.ownerId)) return false
  return currentEntry.value.shareContext?.isShareAccess === true
})

const showShareButton = computed(() => {
  if (!currentEntry.value) return false
  if (!authStore.isOwner(currentEntry.value.ownerId)) return false
  if (currentEntry.value.status === 'archived') return false
  return !currentEntry.value.isPublic
})

const isExpiredButActive = computed(() => {
  if (!currentEntry.value) return false
  return isExpired(currentEntry.value)
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

async function handleExpiresInUpdated() {
  await entryStore.loadEntry(props.slug)
  toast.show('Entry updated', 'success')
}

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

const pathMap = computed<PathMap | null>(() => {
  if (!currentEntry.value) return null
  return buildPathMap(currentEntry.value.files, currentEntry.value.slug)
})

function handleNavigateFile(fileId: number) {
  const file = currentEntry.value?.files.find(f => f.id === fileId)
  if (file) {
    entryStore.selectFile(file)
  }
}

const isBinary = computed(() => {
  return activeFile.value?.isBinary ?? false
})

const overflowItems = computed(() => {
  const items: OverflowMenuItem[] = []
  const themeStore = useThemeStore()
  // Group 1: Display
  items.push({
    label: themeStore.theme === 'dark' ? 'Light theme' : 'Dark theme',
    icon: themeStore.theme === 'dark' ? 'sun' : 'moon',
    hint: 'Tap to toggle',
    divider: false,
    action: () => themeStore.toggle(),
  })
  // Group 2: Owner-only
  if (currentEntry.value && authStore.isOwner(currentEntry.value.ownerId)) {
    items.push({
      label: currentEntry.value.isPublic ? 'Make Private' : 'Make Public',
      icon: currentEntry.value.isPublic ? 'lock' : 'globe',
      hint: currentEntry.value.isPublic ? 'Currently Public' : 'Currently Private',
      divider: true,
      action: handleToggleVisibility,
    })
    if (showShareButton.value) {
      items.push({
        label: 'Share',
        icon: 'share-2',
        hint: 'Create share link',
        action: () => { showShareDialog.value = true },
      })
    }
  }
  // Group 3: File actions
  if (entryStore.canDownload) {
    items.push({
      label: 'Download',
      icon: 'download',
      hint: activeFile.value?.filename ?? '',
      divider: !!(currentEntry.value && authStore.isOwner(currentEntry.value.ownerId)),
      action: downloadFile,
    })
  }
  if (currentEntry.value) {
    items.push({
      label: 'Raw',
      icon: 'file-text',
      hint: 'Structured JSON',
      href: `/api/v1/entries/${currentEntry.value.slug}/raw`,
      target: '_blank',
      rel: 'noopener noreferrer',
    })
  }
  if (entryStore.canPack && currentEntry.value) {
    items.push({
      label: 'Download as Pack',
      icon: 'package',
      hint: `${currentEntry.value.files.length} files`,
      action: downloadPack,
    })
  }
  // Group 4: Danger
  if (currentEntry.value && authStore.isOwner(currentEntry.value.ownerId)) {
    items.push({
      label: 'Delete entry',
      icon: 'trash-2',
      hint: 'Permanently',
      variant: 'danger',
      divider: true,
      action: confirmDeleteEntry,
    })
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
  window.addEventListener('resize', handleResize)
  await nextTick()
  // Set up IntersectionObserver for meta-tags-bar scroll hide
  if (metaTagsSentinel.value) {
    tagsObserver = new IntersectionObserver(
      ([entry]) => { metaTagsHidden.value = !entry.isIntersecting },
      { threshold: 0 }
    )
    tagsObserver.observe(metaTagsSentinel.value)
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleZenKeydown)
  window.removeEventListener('resize', handleResize)
  if (resizeTimer) cancelAnimationFrame(resizeTimer)
  if (tagsObserver) tagsObserver.disconnect()
})

watch(() => props.slug, (newSlug) => {
  entryStore.loadEntry(newSlug)
})

watch(() => entryStore.currentEntry, async (entry) => {
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

.entry-owner-link {
  font-size: 12px;
  color: var(--c-accent);
  text-decoration: none;
  font-family: var(--font-mono);
}

.entry-owner-link:hover {
  text-decoration: underline;
}

.title-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.title-group .title {
  margin: 0;
  padding: 0;
}

.expired-warning-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--c-warning-surface);
  border-bottom: 1px solid var(--c-warning);
  width: 100%;
}

.expired-warning-text {
  font-size: var(--font-sm);
  color: var(--c-warning);
  font-weight: 600;
}

.expired-edit-btn {
  padding: var(--space-1) var(--space-3);
  background: var(--c-accent);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-sm);
  font-weight: 600;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}

.expired-edit-btn:hover {
  opacity: 0.9;
}

.archived-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--c-error-surface);
  border-bottom: 1px solid var(--c-error);
  width: 100%;
}

.archived-banner-text {
  font-size: var(--font-sm);
  color: var(--c-error);
  font-weight: 600;
}

.reactivate-btn {
  padding: var(--space-1) var(--space-3);
  background: var(--c-accent);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-sm);
  font-weight: 600;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}

.reactivate-btn:hover {
  opacity: 0.9;
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

.meta-tag {
  display: inline-flex;
  align-items: center;
  background: var(--c-tag-bg);
  color: var(--c-text-tertiary);
  border-radius: 4px;
  padding: 1px 5px;
  font-size: 10px;
}
</style>
</style>
