<template>
  <div class="file-tree">
    <div class="file-tree-header">
      <h3>Files</h3>
    </div>
    <ul class="file-list">
      <li
        v-for="file in files"
        :key="file.id"
        :class="['file-item', { active: file.id === activeFileId }]"
        @click="$emit('select', file)"
      >
        <span class="file-icon">{{ getFileIcon(file) }}</span>
        <span class="file-name">{{ file.filename }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import type { File } from '@/types'

defineProps<{
  files: File[]
  activeFileId: number | null
}>()

defineEmits<{
  select: [file: File]
}>()

function getFileIcon(file: File): string {
  if (file.isBinary) return '📦'
  if (file.language === 'markdown') return '📝'
  if (file.language === 'python') return '🐍'
  if (file.language === 'javascript' || file.language === 'typescript') return '📜'
  if (file.language === 'html') return '🌐'
  if (file.language === 'css') return '🎨'
  return '📄'
}
</script>

<style scoped>
.file-tree { height: 100%; overflow-y: auto; background: var(--bg-secondary); border-right: 1px solid var(--border-color); }
.file-tree-header { padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--border-color); }
.file-tree-header h3 { font-size: var(--font-sm); font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; }
.file-list { list-style: none; padding: var(--space-2); margin: 0; }
.file-item { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); cursor: pointer; transition: background var(--transition-fast); }
.file-item:hover { background: var(--bg-tertiary); }
.file-item.active { background: var(--accent-light); }
.file-item.active .file-name { color: var(--accent-color); font-weight: 500; }
.file-icon { font-size: var(--font-md); }
.file-name { font-size: var(--font-sm); color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
