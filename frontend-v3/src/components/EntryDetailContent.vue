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
      <div
        class="resize-handle resize-handle-right"
        role="separator"
        aria-orientation="vertical"
        tabindex="0"
        aria-label="Resize file sidebar"
        @mousedown="fileResize.startDrag($event)"
        @dblclick="fileResize.onDoubleClick()"
      ></div>
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
        <div v-if="parseError" class="parse-error-banner" role="alert"><AlertCircleIcon :size="16" /><span>{{ parseError }}</span></div>
        <HtmlViewer v-if="isHtml" :slug="slug" :file-id="activeFile.id" :content="fileContent" :sibling-file-ids="siblingFileIds" />
        <template v-else-if="isMarkdown">
          <MarkdownViewer v-if="!sourceViewMode" :content="fileContent" :path-map="pathMap" :slug="slug" :headings="tocHeadings" @select-heading="$emit('scroll-to-heading', $event)" @navigate-file="$emit('navigate-file', $event)" />
          <CodeViewer v-else :content="fileContent" :filename="activeFile.filename" :language="activeFile.language" :wrap="wrapEnabled" :can-wrap="canWrap" :loading="fileLoading" @toggle-wrap="$emit('toggle-wrap')" />
        </template>
        <template v-else-if="isCsv || isTsv || isJson || isYaml || (isXml && !isSvg)">
          <CodeViewer v-if="showSourceView" :content="fileContent" :filename="activeFile.filename" :language="activeFile.language" :wrap="wrapEnabled" :can-wrap="canWrap" :loading="fileLoading" @toggle-wrap="$emit('toggle-wrap')" />
          <TableView v-else-if="isCsv || isTsv" :content="fileContent" :delimiter="isTsv ? '\t' : ','" :filename="activeFile.filename" :download-fn="downloadFile" @parse-error="onParseError" />
          <TreeView v-else :content="fileContent" :format="treeFormat" :filename="activeFile.filename" :download-fn="downloadFile" @parse-error="onParseError" />
        </template>
        <ImageViewer v-else-if="isImage" :filename="activeFile.filename" :slug="slug" :file-id="activeFile.id" />
        <CodeViewer v-else :content="fileContent" :filename="activeFile.filename" :language="activeFile.language" :wrap="wrapEnabled" :can-wrap="canWrap" :loading="fileLoading" @toggle-wrap="$emit('toggle-wrap')" />
      </template>

      <div v-else class="empty-state">
        <span>Select a file to view</span>
      </div>
    </main>

    <!-- TOC Sidebar (desktop) -->
    <aside v-if="isTocOpen && isMarkdown && !sourceViewMode && tocHeadings.length > 0" class="toc-sidebar">
      <div
        class="resize-handle resize-handle-left"
        role="separator"
        aria-orientation="vertical"
        tabindex="0"
        aria-label="Resize table of contents"
        @mousedown="tocResize.startDrag($event)"
        @dblclick="tocResize.onDoubleClick()"
      ></div>
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
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import FileTree from '@/components/FileTree.vue'
import TocNav from '@/components/TocNav.vue'
import CodeViewer from '@/components/CodeViewer.vue'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import HtmlViewer from '@/components/HtmlViewer.vue'
import ImageViewer from '@/components/ImageViewer.vue'
import TableView from '@/components/TableView.vue'
import TreeView from '@/components/TreeView.vue'
import { AlertCircle as AlertCircleIcon } from 'lucide-vue-next'
import type { Entry, File, TocHeading } from '@/types'
import type { PathMap } from '@/utils/path-map'
import { useSidebarResize } from '@/composables/useSidebarResize'

const props = defineProps<{
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
  isCsv: boolean
  isTsv: boolean
  isJson: boolean
  isYaml: boolean
  isXml: boolean
  isSvg: boolean
  isImage: boolean
  isBinary: boolean
  pathMap: PathMap | null
  tocHeadings: TocHeading[]
  siblingFileIds: number[]
  wrapEnabled: boolean
  canWrap: boolean
  isMultiFile: boolean
  sourceViewMode: boolean
  downloadFile: () => void
}>()

defineEmits<{
  'select-file': [file: File]
  'navigate-file': [fileId: number]
  'scroll-to-heading': [heading: TocHeading]
  'toggle-wrap': []
  'close-file-drawer': []
  'close-toc-drawer': []
}>()

const parseError = ref<string | null>(null)

const showSourceView = computed(() => props.sourceViewMode || parseError.value !== null)

const treeFormat = computed<'json' | 'yaml' | 'xml'>(() => {
  if (props.isYaml) return 'yaml'
  if (props.isXml) return 'xml'
  return 'json'
})

function onParseError(message: string) {
  parseError.value = message
}

watch(() => props.activeFile?.id, () => {
  parseError.value = null
})

watch(() => props.sourceViewMode, () => {
  parseError.value = null
})

const fileResize = useSidebarResize({
  storageKey: 'peekview-sidebar-width',
  cssVar: '--sidebar-width',
  defaultPx: 260,
  minPx: 160,
  maxPx: 500,
  side: 'left',
})

const tocResize = useSidebarResize({
  storageKey: 'peekview-toc-width',
  cssVar: '--toc-width',
  defaultPx: 240,
  minPx: 150,
  maxPx: 400,
  side: 'right',
})

onMounted(() => {
  fileResize.loadWidth()
  tocResize.loadWidth()
})

onUnmounted(() => {
  fileResize.cleanup()
  tocResize.cleanup()
})
</script>

<style scoped>
.detail-content { display: flex; flex: 1; overflow: hidden; }
.content-area { flex: 1; overflow-y: auto; outline: none; padding: var(--space-4); overscroll-behavior: y none; }
@media (max-width: 640px) { .content-area { padding: var(--space-3) var(--space-2); } }
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
.parse-error-banner { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-3); margin-bottom: var(--space-3); border-radius: var(--radius-md); background: var(--error-bg); color: var(--error-text); border: 1px solid var(--error-border); font-size: var(--font-sm); }
.drawer-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5); z-index: 200; }
.drawer { position: fixed; top: 0; bottom: 0; width: 280px; background: var(--c-surface); z-index: 201; overflow-y: auto; }
.drawer-left { left: 0; border-right: 1px solid var(--c-border); }
.drawer-right { right: 0; border-left: 1px solid var(--c-border); }
.drawer-header { display: flex; justify-content: space-between; align-items: center; padding: var(--space-3); border-bottom: 1px solid var(--c-border); font-size: var(--font-sm); font-weight: 600; }
.drawer-close { cursor: pointer; font-size: 24px; line-height: 1; color: var(--c-text-secondary); }
</style>
