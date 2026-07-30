<template>
  <div class="detail-content">
    <!-- File Sidebar (desktop) -->
    <aside v-if="isFileTreeOpen && isMultiFile" class="file-sidebar">
      <FileTree
        :files="currentEntry?.files || []"
        :activeFileId="activeFile?.id ?? null"
        :fileCount="currentEntry?.files.length"
        @select="$emit('select-file', $event)"
      />
    </aside>

    <!-- Main Content Area -->
    <main class="content-area entry-content" tabindex="-1">
      <div v-if="fileLoading" class="loading-state">
        <div class="skeleton-header">
          <div class="skeleton-bar skeleton-title-bar"></div>
          <div class="skeleton-bar skeleton-meta-bar"></div>
        </div>
        <div class="skeleton-content">
          <div class="skeleton-bar skeleton-content-block"></div>
        </div>
      </div>

      <div v-else-if="fileError" class="error-state" :class="{ 'share-error': shareErrorState }">
        <span>{{ fileError }}</span>
      </div>

      <div v-else-if="!currentEntry" class="empty-state">
        <span>Entry not found</span>
      </div>

      <template v-else-if="activeFile">
        <HtmlViewer
          v-if="isHtml"
          :slug="slug"
          :file-id="activeFile.id"
          :content="fileContent"
          :sibling-file-ids="siblingFileIds"
        />
        <MarkdownViewer
          v-else-if="isMarkdown"
          :content="fileContent"
          :path-map="pathMap"
          :slug="slug"
          :headings="tocHeadings"
          @select-heading="$emit('scroll-to-heading', $event)"
          @navigate-file="$emit('navigate-file', $event)"
        />
        <ImageViewer
          v-else-if="isImage"
          :filename="activeFile.filename"
          :slug="slug"
          :file-id="activeFile.id"
        />
        <CodeViewer
          v-else
          :content="fileContent"
          :filename="activeFile.filename"
          :language="activeFile.language"
          :wrap="wrapEnabled"
          :can-wrap="canWrap"
          :loading="fileLoading"
          @toggle-wrap="$emit('toggle-wrap')"
        />
      </template>

      <div v-else class="empty-state">
        <span>Select a file to view</span>
      </div>
    </main>

    <!-- TOC Sidebar (desktop) -->
    <aside v-if="isTocOpen && isMarkdown && tocHeadings.length > 0" class="toc-sidebar">
      <TocNav
        :headings="tocHeadings"
        :activeId="null"
        @select="$emit('scroll-to-heading', $event)"
      />
    </aside>
  </div>

  <!-- File Drawer (mobile) -->
  <div v-if="showFileDrawer" class="drawer-overlay" @click="$emit('close-file-drawer')"></div>
  <aside v-if="showFileDrawer" class="drawer drawer-left">
    <div class="drawer-header">
      <span>Files · {{ currentEntry?.files.length ?? 0 }}</span>
      <span class="drawer-close" @click="$emit('close-file-drawer')">&times;</span>
    </div>
    <FileTree
      :files="currentEntry?.files || []"
      :activeFileId="activeFile?.id ?? null"
      :fileCount="currentEntry?.files.length"
      @select="$emit('select-file', $event); $emit('close-file-drawer')"
    />
  </aside>

  <!-- TOC Drawer (mobile) -->
  <div v-if="showTocDrawer" class="drawer-overlay" @click="$emit('close-toc-drawer')"></div>
  <aside v-if="showTocDrawer" class="drawer drawer-right">
    <div class="drawer-header">
      <span>Table of Contents · {{ tocHeadings.length }}</span>
      <span class="drawer-close" @click="$emit('close-toc-drawer')">&times;</span>
    </div>
    <TocNav
      :headings="tocHeadings"
      :activeId="null"
      @select="$emit('scroll-to-heading', $event); $emit('close-toc-drawer')"
    />
  </aside>
</template>

<script setup lang="ts">
import FileTree from '@/components/FileTree.vue'
import TocNav from '@/components/TocNav.vue'
import CodeViewer from '@/components/CodeViewer.vue'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import HtmlViewer from '@/components/HtmlViewer.vue'
import ImageViewer from '@/components/ImageViewer.vue'
import type { Entry, File, TocHeading } from '@/types'
import type { PathMap } from '@/utils/path-map'

defineProps<{
  isFileTreeOpen: boolean
  isTocOpen: boolean
  showFileDrawer: boolean
  showTocDrawer: boolean
  currentEntry: Entry | null
  activeFile: File | null
  fileContent: string
  fileLoading: boolean
  fileError: string | null
  shareErrorState: boolean
  slug: string
  isMarkdown: boolean
  isHtml: boolean
  isImage: boolean
  isBinary: boolean
  pathMap: PathMap | null
  tocHeadings: TocHeading[]
  siblingFileIds: number[]
  wrapEnabled: boolean
  canWrap: boolean
  isMultiFile: boolean
}>()

defineEmits<{
  'select-file': [file: File]
  'navigate-file': [fileId: number]
  'scroll-to-heading': [heading: TocHeading]
  'toggle-wrap': []
  'close-file-drawer': []
  'close-toc-drawer': []
}>()
</script>

<style scoped>
.detail-content { display: flex; flex: 1; overflow: hidden; }
.file-sidebar { width: 200px; border-right: 1px solid var(--c-border); overflow-y: auto; flex-shrink: 0; }
.content-area { flex: 1; overflow-y: auto; outline: none; padding: var(--space-4); }
.toc-sidebar { width: 240px; border-left: 1px solid var(--c-border); overflow-y: auto; flex-shrink: 0; }
.loading-state { padding: var(--space-5); }
.skeleton-header { display: flex; flex-direction: column; gap: var(--space-3); margin-bottom: var(--space-5); }
.skeleton-bar { border-radius: 6px; background: var(--c-border); animation: shimmer 1.5s infinite; }
.skeleton-title-bar { height: 24px; width: 50%; }
.skeleton-meta-bar { height: 14px; width: 35%; }
.skeleton-content-block { height: 300px; width: 100%; }
@keyframes shimmer { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
.error-state { text-align: center; padding: var(--space-7); color: var(--c-text-secondary); }
.share-error { color: var(--c-error); font-size: 15px; text-align: center; padding: 40px 16px; }
.empty-state { text-align: center; padding: var(--space-7); color: var(--c-text-secondary); }
.drawer-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5); z-index: 200; }
.drawer { position: fixed; top: 0; bottom: 0; width: 280px; background: var(--c-surface); z-index: 201; overflow-y: auto; }
.drawer-left { left: 0; border-right: 1px solid var(--c-border); }
.drawer-right { right: 0; border-left: 1px solid var(--c-border); }
.drawer-header { display: flex; justify-content: space-between; align-items: center; padding: var(--space-3); border-bottom: 1px solid var(--c-border); font-size: var(--font-sm); font-weight: 600; }
.drawer-close { cursor: pointer; font-size: 24px; line-height: 1; color: var(--c-text-secondary); }
</style>
