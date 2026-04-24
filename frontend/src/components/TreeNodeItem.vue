<template>
  <div class="tree-node">
    <div
      class="tree-node-row"
      :class="{ active: node.file && node.file.id === activeFileId }"
      :style="{ paddingLeft: `${depth * 16 + 8}px` }"
      role="treeitem"
      :aria-selected="node.file ? node.file.id === activeFileId : undefined"
      :aria-expanded="node.file ? undefined : !collapsed"
      tabindex="0"
      @click="handleClick"
      @keydown.enter="handleClick"
      @keydown.space.prevent="handleClick"
    >
      <!-- Expand/collapse chevron for directories -->
      <span v-if="!node.file" class="tree-chevron" :class="{ collapsed }">
        ▸
      </span>
      <span v-else class="tree-chevron-spacer"></span>

      <!-- Icon -->
      <Icon
        :icon="nodeIcon"
        class="tree-icon"
        :class="{ 'tree-icon-folder': !node.file }"
      />

      <!-- Name -->
      <span class="tree-name">{{ node.name }}</span>
    </div>

    <!-- Children (recursive) -->
    <div v-if="!node.file && !collapsed" class="tree-children" role="group">
      <TreeNodeItem
        v-for="child in node.children"
        :key="child.path"
        :node="child"
        :active-file-id="activeFileId"
        :depth="depth + 1"
        @select="$emit('select', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@iconify/vue'
import type { FileResponse, TreeNode } from '../types'

const props = defineProps<{
  node: TreeNode
  activeFileId: number | null
  depth: number
}>()

const emit = defineEmits<{
  select: [file: FileResponse]
}>()

const collapsed = ref(false)

const nodeIcon = computed(() => {
  if (!props.node.file) {
    return collapsed.value
      ? 'codicon:folder'
      : 'codicon:folder-opened'
  }

  // File type icons using VS Code Codicons
  const lang = props.node.file.language
  const name = props.node.file.filename.toLowerCase()
  const iconMap: Record<string, string> = {
    python: 'codicon:file-code',
    javascript: 'codicon:file-code',
    typescript: 'codicon:file-code',
    rust: 'codicon:file-code',
    go: 'codicon:file-code',
    java: 'codicon:file-code',
    html: 'codicon:file-code',
    css: 'codicon:file-code',
    markdown: 'codicon:file-code',
    json: 'codicon:json',
    yaml: 'codicon:settings',
  }

  if (lang && iconMap[lang]) return iconMap[lang]
  if (name.endsWith('.md')) return 'codicon:file-code'
  if (name.endsWith('.json')) return 'codicon:json'
  if (props.node.file.is_binary) return 'codicon:file-binary'
  return 'codicon:file'
})

function handleClick() {
  if (props.node.file) {
    emit('select', props.node.file)
  } else {
    collapsed.value = !collapsed.value
  }
}
</script>

<style scoped>
.tree-node-row {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding-top: var(--space-1);
  padding-bottom: var(--space-1);
  padding-right: var(--space-3);
  cursor: pointer;
  color: var(--text-primary);
  white-space: nowrap;
  user-select: none;
}

.tree-node-row:hover {
  background: var(--bg-secondary);
}

.tree-node-row.active {
  background: var(--accent-color);
  color: #ffffff;
}

.tree-node-row:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: -2px;
}

.tree-chevron {
  font-size: 10px;
  width: 14px;
  text-align: center;
  transition: transform var(--transition-fast);
  flex-shrink: 0;
}

.tree-chevron:not(.collapsed) {
  transform: rotate(90deg);
}

.tree-chevron-spacer {
  width: 14px;
  flex-shrink: 0;
}

.tree-icon {
  flex-shrink: 0;
  font-size: 16px;
}

.tree-icon-folder {
  color: var(--accent-color);
}

.tree-name {
  overflow: hidden;
  text-overflow: ellipsis;
}

.tree-children {
  /* Recursive children are indented via padding-left on tree-node-row */
}
</style>
