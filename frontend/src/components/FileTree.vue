<template>
  <div class="file-tree" role="tree" aria-label="File tree">
    <TreeNodeItem
      v-for="node in tree"
      :key="node.path"
      :node="node"
      :active-file-id="activeFileId"
      :depth="0"
      @select="$emit('select', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { FileResponse, TreeNode } from '../types'
import TreeNodeItem from './TreeNodeItem.vue'

const props = defineProps<{
  files: FileResponse[]
  activeFileId: number | null
}>()

defineEmits<{
  select: [file: FileResponse]
}>()

/**
 * Transform flat FileResponse[] into a nested TreeNode[] tree structure.
 * E.g. [{path: "src/main.py"}, {path: "src/utils.py"}, {path: "README.md"}]
 * becomes:
 *   [{name: "src", children: [{name: "main.py", file: ...}, {name: "utils.py", file: ...}]},
 *    {name: "README.md", file: ...}]
 */
function buildTree(files: FileResponse[]): TreeNode[] {
  const root: TreeNode[] = []

  for (const file of files) {
    const parts = (file.path || file.filename).split('/')
    let current = root

    for (let i = 0; i < parts.length; i++) {
      const partName = parts[i]
      const isLeaf = i === parts.length - 1
      const partPath = parts.slice(0, i + 1).join('/')

      if (isLeaf) {
        // File node
        current.push({
          name: partName,
          path: partPath,
          children: [],
          file,
        })
      } else {
        // Directory node — find or create
        let dir = current.find((n) => n.name === partName && !n.file)
        if (!dir) {
          dir = { name: partName, path: partPath, children: [] }
          current.push(dir)
        }
        current = dir.children
      }
    }
  }

  // Sort: directories first, then alphabetically
  function sortNodes(nodes: TreeNode[]): TreeNode[] {
    return nodes.sort((a, b) => {
      const aIsDir = !a.file
      const bIsDir = !b.file
      if (aIsDir !== bIsDir) return aIsDir ? -1 : 1
      return a.name.localeCompare(b.name)
    }).map((node) => ({
      ...node,
      children: sortNodes(node.children),
    }))
  }

  return sortNodes(root)
}

const tree = computed(() => buildTree(props.files))
</script>

<style scoped>
.file-tree {
  min-width: 220px;
  max-width: 280px;
  border-right: 1px solid var(--border-color);
  padding: var(--space-2) 0;
  overflow-y: auto;
  font-size: var(--font-sm);
}

/* Responsive: on mobile, file tree becomes a horizontal strip */
@media (max-width: 768px) {
  .file-tree {
    min-width: 100%;
    max-width: 100%;
    max-height: 40vh;
    border-right: none;
    border-bottom: 1px solid var(--border-color);
  }
}
</style>
