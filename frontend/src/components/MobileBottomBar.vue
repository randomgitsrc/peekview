<template>
  <div class="mobile-bottom-bar">
    <!-- Left: File info - hamburger for multi-file, filename for single-file -->
    <div class="file-section" @click="toggleFileDrawer">
      <template v-if="hasMultipleFiles">
        <Icon icon="codicon:menu" />
        <span class="file-badge">{{ fileCount }} files</span>
      </template>
      <template v-else>
        <Icon icon="codicon:file-code" />
        <span class="filename">{{ activeFile?.filename || 'Select file' }}</span>
      </template>
    </div>
    <!-- Right: Action buttons -->
    <div class="actions">
      <!-- Copy button -->
      <button
        v-if="canCopy"
        class="action-btn"
        @click="copy"
        title="Copy content"
      >
        <Icon :icon="copied ? 'codicon:check' : 'codicon:copy'" />
        <span class="btn-label">Copy</span>
      </button>
      <!-- Download button -->
      <button
        v-if="canDownload"
        class="action-btn"
        @click="emit('download')"
        title="Download"
      >
        <Icon icon="codicon:download" />
        <span class="btn-label">Down</span>
      </button>
      <!-- TOC button: only for Markdown with headings -->
      <button
        v-if="hasToc"
        class="action-btn"
        @click="emit('toggleToc')"
        title="Table of Contents"
      >
        <Icon icon="codicon:list-tree" />
        <span class="btn-label">TOC</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@iconify/vue'
import type { FileResponse } from '../types'

const props = defineProps<{
  activeFile: FileResponse | null
  hasMultipleFiles: boolean
  canCopy: boolean
  canDownload: boolean
  hasToc: boolean
  content?: string
}>()

const emit = defineEmits<{
  toggleFileDrawer: []
  toggleToc: []
  download: []
}>()

const copied = ref(false)

const fileCount = computed(() => {
  if (!props.activeFile) return 0
  // This is a simplification - in real usage the parent provides file count via activeFile context
  return props.hasMultipleFiles ? '+' : 1
})

const toggleFileDrawer = () => emit('toggleFileDrawer')

const copy = async () => {
  if (!props.content) return
  await navigator.clipboard.writeText(props.content)
  copied.value = true
  setTimeout(() => copied.value = false, 2000)
}
</script>

<style scoped>
.mobile-bottom-bar {
  position: fixed; bottom: 0; left: 0; right: 0; height: 56px;
  background: var(--bg-primary); border-top: 1px solid var(--border-color);
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 var(--space-3); z-index: 50; gap: var(--space-2);
}
.file-section {
  display: flex; align-items: center; gap: var(--space-2);
  flex: 1; min-width: 0; cursor: pointer;
  padding: var(--space-2) var(--space-3);
  background: var(--bg-secondary); border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
}
.file-section:hover { border-color: var(--border-hover); }
.file-section .filename {
  flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; color: var(--text-primary); font-size: var(--font-sm);
}
.file-badge {
  font-size: var(--font-xs); color: var(--text-secondary);
  background: var(--bg-tertiary); padding: 2px 6px; border-radius: var(--radius-sm);
}
.actions { display: flex; align-items: center; gap: 2px; }
.action-btn {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  width: 44px; height: 44px; background: none; border: none;
  border-radius: var(--radius-md); color: var(--text-secondary);
  cursor: pointer; font-size: 16px; padding: 2px;
}
.action-btn:hover { background: var(--bg-secondary); color: var(--text-primary); }
.action-btn.active { background: var(--accent-light); color: var(--accent-color); }
.action-btn .btn-label { font-size: 10px; margin-top: 2px; }
@media (min-width: 769px) { .mobile-bottom-bar { display: none; } }
</style>
