<template>
  <div class="entry-detail">
    <!-- Header -->
    <header class="detail-header">
      <span class="back-btn" @click="goBack" title="Back to list">&larr;</span>
      <h1 class="title">{{ entryTitle }}</h1>
      <div class="actions" v-if="entryStore.currentEntry">
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
          <!-- Code File -->
          <CodeViewer
            v-if="!isMarkdown"
            :content="entryStore.fileContent"
            :filename="entryStore.activeFile.filename"
            :language="entryStore.activeFile.language"
            :wrap="entryStore.wrapEnabled"
            :can-wrap="entryStore.canWrap"
            :loading="entryStore.loading"
            @toggle-wrap="entryStore.toggleWrap()"
          />

          <!-- Markdown File -->
          <MarkdownViewer
            v-else
            :content="entryStore.fileContent"
            :headings="tocHeadings"
            @select-heading="scrollToHeading"
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
      <button class="btn btn-sm menu-btn" @click="showFileDrawer = true">
        Files
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useEntryStore } from '@/stores/entry'
import CodeViewer from '@/components/CodeViewer.vue'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import FileTree from '@/components/FileTree.vue'
import TocNav from '@/components/TocNav.vue'
import type { TocHeading } from '@/types'

const props = defineProps<{
  slug: string
}>()

const router = useRouter()
const entryStore = useEntryStore()
const { currentEntry, activeFile } = storeToRefs(entryStore)

// Drawer state
const showFileDrawer = ref(false)
const showTocDrawer = ref(false)

// Computed properties
const entryTitle = computed(() => {
  return currentEntry.value?.summary || props.slug
})

const isMarkdown = computed(() => {
  return activeFile.value?.language === 'markdown'
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

function downloadPack() {
  if (!currentEntry.value) return
  // Pack download logic - would call API to get zip
  console.log('Download pack for:', currentEntry.value.slug)
}

function extractHeadings(content: string): TocHeading[] {
  const headings: TocHeading[] = []
  const lines = content.split('\n')
  const usedIds = new Set<string>()

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/)
    if (match) {
      const level = match[1].length
      // Only include h2-h4 headings (same as useMarkdown.ts)
      if (level < 2 || level > 4) continue

      const text = match[2].trim()
      // Match the slugify logic from useMarkdown.ts - preserve CJK characters
      let id = text.toLowerCase()
        .replace(/[^\w\s一-龥぀-ゟ゠-ヿ-]/g, '')  // Keep CJK, hiragana, katakana
        .replace(/\s+/g, '-')
        .replace(/^-+|-+$/g, '')  // Trim leading/trailing dashes
        .substring(0, 50) || 'heading'  // Fallback if empty

      // Ensure unique IDs
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

// Load entry on mount and when slug changes
onMounted(() => {
  entryStore.loadEntry(props.slug)
})

watch(() => props.slug, (newSlug) => {
  entryStore.loadEntry(newSlug)
})
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
</style>
