<template>
  <div class="entry-detail-view">
    <header class="detail-header">
      <router-link to="/" class="back-link" aria-label="Back to entry list">
        ← Back
      </router-link>
      <h2>{{ entry?.summary }}</h2>
      <div class="header-actions">
        <button
          v-if="activeFile && !activeFile.is_binary"
          class="header-btn"
          @click="copyContent"
        >
          {{ copied ? 'Copied!' : 'Copy' }}
        </button>
        <button
          v-if="activeFile"
          class="header-btn"
          @click="downloadFile"
        >
          Download
        </button>
        <ThemeToggle />
      </div>
    </header>

    <!-- Loading skeleton -->
    <div v-if="loading" class="entry-content">
      <div class="tree-skeleton">
        <div v-for="i in 4" :key="i" class="skeleton-tree-item"></div>
      </div>
      <div class="file-skeleton">
        <div class="skeleton-code-header"></div>
        <div v-for="i in 8" :key="i" class="skeleton-code-line"></div>
      </div>
    </div>

    <!-- Error state with retry -->
    <div v-else-if="error" class="error-display" role="alert">
      <Icon icon="codicon:error" class="error-icon" />
      <template v-if="errorCode === 'NOT_FOUND'">
        <p class="error-message">Entry not found</p>
        <p class="error-detail">This entry may have been deleted or the link is incorrect.</p>
      </template>
      <template v-else>
        <p class="error-message">Failed to load entry</p>
        <p class="error-detail">{{ error }}</p>
      </template>
      <button class="retry-btn" @click="retryFetch" aria-label="Retry loading entry">
        Try again
      </button>
      <router-link to="/" class="back-home-link">Back to home</router-link>
    </div>

    <!-- Entry content -->
    <div v-else-if="entry" class="entry-content">
      <!-- Left: File Tree (desktop only, when multiple files) -->
      <aside v-if="entry.files.length > 1" class="sidebar-left">
        <FileTree
          :files="entry.files"
          :active-file-id="activeFile?.id ?? null"
          @select="selectFile"
        />
      </aside>

      <!-- Center: File Display -->
      <main class="file-display" aria-live="polite">
        <!-- File loading -->
        <div v-if="fileLoading" class="file-loading">
          <div class="code-skeleton" v-for="i in 8" :key="i">
            <span class="skeleton-line-number"></span>
            <span class="skeleton-line-content"></span>
          </div>
        </div>

        <!-- File error -->
        <div v-else-if="fileError" class="file-error" role="alert">
          <p>Failed to load file content</p>
          <button class="retry-btn small" @click="loadFileContent" aria-label="Retry loading file">
            Try again
          </button>
        </div>

        <!-- Code viewer -->
        <CodeViewer
          v-else-if="activeFile && !activeFile.is_binary && !isMarkdown"
          :content="fileContent"
          :filename="activeFile.filename"
          :language="activeFile.language"
          :line-count="activeFile.line_count"
        />

        <!-- Markdown viewer (without internal TOC) -->
        <MarkdownViewer
          v-else-if="activeFile && isMarkdown"
          :content="fileContent"
          @headings="updateHeadings"
        />

        <!-- Binary file download -->
        <div v-else-if="activeFile?.is_binary" class="binary-file">
          <Icon icon="codicon:file-binary" class="binary-icon" />
          <span class="binary-name">{{ activeFile.filename }}</span>
          <span class="binary-size">{{ formatSize(activeFile.size) }}</span>
          <a
            :href="downloadUrl"
            download
            class="download-link"
          >
            <Icon icon="codicon:download" /> Download
          </a>
        </div>

        <!-- No file selected -->
        <div v-else class="no-file">
          <Icon icon="codicon:file" class="no-file-icon" />
          <p>Select a file to view</p>
        </div>
      </main>

      <!-- Right: TOC for Markdown (desktop only) -->
      <aside v-if="markdownHeadings.length > 0" class="sidebar-right">
        <nav class="toc-sidebar" aria-label="Table of contents">
          <h4 class="toc-title">Outline</h4>
          <ul class="toc-list">
            <li
              v-for="heading in markdownHeadings"
              :key="heading.id"
              :class="['toc-item', `toc-level-${heading.level}`]"
            >
              <a
                :href="`#${heading.id}`"
                :class="{ active: activeHeading === heading.id }"
                @click.prevent="scrollToHeading(heading.id)"
              >
                {{ heading.text }}
              </a>
            </li>
          </ul>
        </nav>
      </aside>
    </div>

    <footer class="detail-footer" v-if="entry">
      <div class="tags">
        <span v-for="tag in entry.tags" :key="tag" class="tag">#{{ tag }}</span>
      </div>
      <span class="date">Created: {{ formatDate(entry.created_at) }}</span>
    </footer>

    <!-- Mobile drawers and bottom bar -->
    <MobileFileDrawer
      v-if="entry && entry.files.length > 1"
      :is-open="fileDrawerOpen"
      :files="entry.files"
      :active-file-id="activeFile?.id ?? null"
      @close="fileDrawerOpen = false"
      @select="selectFile"
    />
    <MobileTocDrawer
      v-if="markdownHeadings.length > 0"
      :is-open="tocDrawerOpen"
      :headings="markdownHeadings"
      @close="tocDrawerOpen = false"
      @navigate="scrollToHeading"
    />
    <MobileBottomBar
      v-if="entry && !loading"
      :active-file="activeFile"
      :has-multiple-files="entry.files.length > 1"
      :can-copy="!!activeFile && !activeFile.is_binary"
      :can-download="!!activeFile"
      :has-toc="markdownHeadings.length > 0"
      :content="fileContent"
      @toggle-file-drawer="fileDrawerOpen = true"
      @toggle-toc="tocDrawerOpen = true"
      @download="downloadFile"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { api } from '../api/client'
import { useEntry } from '../composables/useEntry'
import FileTree from '../components/FileTree.vue'
import CodeViewer from '../components/CodeViewer.vue'
import MarkdownViewer from '../components/MarkdownViewer.vue'
import ThemeToggle from '../components/ThemeToggle.vue'
import MobileFileDrawer from '../components/MobileFileDrawer.vue'
import MobileTocDrawer from '../components/MobileTocDrawer.vue'
import MobileBottomBar from '../components/MobileBottomBar.vue'
import type { FileResponse, TocHeading } from '../types'

const route = useRoute()
const router = useRouter()
const { entry, loading, error, errorCode, fetchEntry, clearCache } = useEntry()

const activeFile = ref<FileResponse | null>(null)
const fileContent = ref('')
const fileLoading = ref(false)
const fileError = ref<string | null>(null)
const fileDrawerOpen = ref(false)
const tocDrawerOpen = ref(false)
const activeHeading = ref<string | null>(null)
const markdownHeadings = ref<TocHeading[]>([])
const copied = ref(false)

const isMarkdown = computed(() => activeFile.value?.language === 'markdown')

const downloadUrl = computed(() =>
  activeFile.value
    ? api.downloadFile(route.params.slug as string, activeFile.value.id)
    : '',
)

/**
 * Select initial file based on ?file= query parameter (review §7).
 * Falls back to the first file if no match.
 */
function selectInitialFile() {
  if (!entry.value || entry.value.files.length === 0) return

  const queryFile = route.query.file as string
  if (queryFile) {
    const match = entry.value.files.find(
      (f) => f.path === queryFile || f.filename === queryFile,
    )
    if (match) {
      activeFile.value = match
      return
    }
  }
  activeFile.value = entry.value.files[0]
}

/**
 * Select a file and update the URL query parameter for deep linking (review §7).
 */
function selectFile(file: FileResponse) {
  activeFile.value = file
  // Update URL query parameter without navigation
  router.replace({
    query: {
      ...route.query,
      file: file.path || file.filename,
    },
  })
}

/**
 * Load file content using the /content inline endpoint (review §2).
 * Clears stale content immediately to avoid showing wrong content (review §17).
 */
async function loadFileContent() {
  if (!activeFile.value) return
  if (activeFile.value.is_binary) return

  // Check if content was included inline (from ?include=files.content)
  if (activeFile.value.content !== undefined) {
    fileContent.value = activeFile.value.content
    fileError.value = null
    return
  }

  // Clear immediately — don't show stale content (review §17)
  fileContent.value = ''
  fileLoading.value = true
  fileError.value = null

  try {
    fileContent.value = await api.fetchFileContent(
      route.params.slug as string,
      activeFile.value.id,
    )
  } catch (e: unknown) {
    fileError.value =
      e instanceof Error ? e.message : 'Failed to load file content'
  } finally {
    fileLoading.value = false
  }
}

function retryFetch() {
  clearCache(route.params.slug as string)
  doFetchEntry()
}

async function doFetchEntry() {
  // Fetch with inline content to reduce N+1 (review §2)
  await fetchEntry(route.params.slug as string, {
    includeContent: true,
  })
  selectInitialFile()
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString()
}

function downloadFile() {
  if (!activeFile.value) return
  const url = api.downloadFile(route.params.slug as string, activeFile.value.id)
  const a = document.createElement('a')
  a.href = url
  a.download = activeFile.value.filename
  a.click()
}

async function copyContent() {
  if (!fileContent.value) return
  try {
    await navigator.clipboard.writeText(fileContent.value)
    copied.value = true
    setTimeout(() => copied.value = false, 2000)
  } catch {
    // Clipboard API not available
  }
}

function scrollToHeading(headingId: string) {
  const element = document.getElementById(headingId)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

function updateHeadings(headings: TocHeading[]) {
  markdownHeadings.value = headings
  if (headings.length > 0 && !activeHeading.value) {
    activeHeading.value = headings[0].id
  }
}

// Load file content when active file changes
watch(activeFile, loadFileContent)

// Re-fetch entry when slug changes (route navigation)
watch(
  () => route.params.slug,
  (newSlug) => {
    if (newSlug) doFetchEntry()
  },
)

onMounted(doFetchEntry)
</script>

<style scoped>
.entry-detail-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-5);
}

.detail-header {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-bottom: var(--space-5);
}

.back-link {
  color: var(--accent-color);
  text-decoration: none;
  white-space: nowrap;
}

.back-link:hover {
  text-decoration: underline;
}

.detail-header h2 {
  flex: 1;
  color: var(--text-primary);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-actions {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.header-btn {
  padding: var(--space-2) var(--space-3);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--font-sm);
  cursor: pointer;
}

.header-btn:hover {
  background: var(--bg-tertiary);
}

/* Entry content layout */
.entry-content {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 0;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  overflow: hidden;
  min-height: 400px;
}

/* Left sidebar - File Tree */
.sidebar-left {
  min-width: 220px;
  max-width: 280px;
  border-right: 1px solid var(--border-color);
  background: var(--bg-primary);
  overflow-y: auto;
}

.sidebar-left :deep(.file-tree) {
  min-width: auto;
  max-width: none;
  border: none;
}

/* Main content area */
.file-display {
  min-width: 0;
  overflow: auto;
  background: var(--bg-primary);
}

/* Right sidebar - TOC */
.sidebar-right {
  width: 220px;
  border-left: 1px solid var(--border-color);
  background: var(--bg-secondary);
  overflow-y: auto;
}

.toc-sidebar {
  padding: var(--space-4) var(--space-3);
}

.toc-title {
  font-size: var(--font-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-tertiary);
  margin: 0 0 var(--space-3) 0;
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--border-color);
}

.toc-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.toc-item {
  margin: var(--space-1) 0;
}

.toc-item a {
  display: block;
  padding: var(--space-1) var(--space-2);
  color: var(--text-secondary);
  text-decoration: none;
  font-size: var(--font-sm);
  line-height: 1.4;
  border-radius: var(--radius-sm);
  border-left: 2px solid transparent;
}

.toc-item a:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.toc-item a.active {
  color: var(--accent-color);
  border-left-color: var(--accent-color);
  background: var(--bg-tertiary);
}

.toc-level-2 {
  padding-left: var(--space-2);
}

.toc-level-3 {
  padding-left: var(--space-4);
}

.toc-level-4,
.toc-level-5,
.toc-level-6 {
  padding-left: var(--space-6);
}

/* Loading skeletons */
.tree-skeleton {
  min-width: 220px;
  border-right: 1px solid var(--border-color);
  padding: var(--space-3);
}

.skeleton-tree-item {
  height: 20px;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  margin-bottom: var(--space-2);
  width: 70%;
}

.skeleton-tree-item:nth-child(2n) {
  width: 85%;
  margin-left: 20px;
}

.skeleton-tree-item:nth-child(3n) {
  width: 60%;
  margin-left: 40px;
}

.file-skeleton {
  flex: 1;
  padding: var(--space-3);
}

.skeleton-code-header {
  height: 36px;
  background: var(--bg-secondary);
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  margin-bottom: var(--space-2);
  border-bottom: 1px solid var(--border-color);
}

.skeleton-code-line {
  display: flex;
  gap: var(--space-3);
  padding: 2px 0;
}

.file-loading {
  padding: var(--space-3);
}

.code-skeleton {
  display: flex;
  gap: var(--space-3);
  padding: 2px 0;
}

.skeleton-line-number {
  width: 30px;
  height: 14px;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.skeleton-line-content {
  flex: 1;
  height: 14px;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  max-width: 60%;
}

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
  margin-right: var(--space-2);
}

.retry-btn:hover {
  background: var(--accent-hover);
}

.retry-btn:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}

.retry-btn.small {
  padding: var(--space-1) var(--space-3);
  font-size: var(--font-xs);
}

.back-home-link {
  color: var(--accent-color);
  margin-left: var(--space-2);
}

/* File error */
.file-error {
  padding: var(--space-6);
  text-align: center;
  color: var(--text-secondary);
}

.file-error p {
  margin: 0 0 var(--space-3);
}

/* Binary file */
.binary-file {
  padding: var(--space-6);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}

.binary-icon {
  font-size: 48px;
  color: var(--text-tertiary);
}

.binary-name {
  font-weight: 600;
  color: var(--text-primary);
}

.binary-size {
  color: var(--text-secondary);
  font-size: var(--font-sm);
}

.download-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--accent-color);
  margin-top: var(--space-2);
}

/* No file */
.no-file {
  padding: var(--space-7);
  text-align: center;
  color: var(--text-secondary);
}

.no-file-icon {
  font-size: 48px;
  margin-bottom: var(--space-3);
}

/* Footer */
.detail-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: var(--space-4);
  padding: var(--space-3) 0;
  border-top: 1px solid var(--border-color);
}

.tag {
  background: var(--tag-bg);
  color: var(--tag-text);
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--font-sm);
  margin-right: var(--space-1);
}

.date {
  color: var(--text-secondary);
  font-size: var(--font-sm);
}

/* Responsive */
@media (max-width: 768px) {
  .entry-detail-view {
    padding: var(--space-3);
    padding-bottom: 72px; /* Space for bottom bar */
  }

  .detail-header {
    flex-wrap: wrap;
  }

  .detail-header h2 {
    order: 3;
    width: 100%;
    flex: auto;
    font-size: var(--font-md);
  }

  .entry-content {
    display: flex;
    flex-direction: column;
    border: none;
    background: transparent;
  }

  /* Hide desktop sidebars on mobile (replaced by drawers) */
  .sidebar-left,
  .sidebar-right {
    display: none;
  }

  .file-display {
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    min-height: 300px;
  }
}
</style>
