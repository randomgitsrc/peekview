<script lang="ts">
import type { InjectionKey, Ref } from 'vue'
export const EXPAND_KEY: InjectionKey<{ expandedPaths: Ref<Set<string>>; toggleDir: (path: string) => void }> = Symbol('fileTreeExpand')
</script>

<template>
  <div class="file-tree">
    <div class="file-tree-header">
      <h3>Files<template v-if="fileCount !== undefined"> · {{ fileCount }}</template></h3>
    </div>
    <ul class="file-list">
      <TreeNodeItem
        v-for="node in treeNodes"
        :key="node.fullPath"
        :node="node"
        :depth="0"
        :active-file-id="activeFileId"
        @select="onSelect"
      />
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, provide } from 'vue'
import type { File, TreeNode } from '@/types'
import TreeNodeItem from '@/components/TreeNodeItem.vue'

const props = defineProps<{
  files: File[]
  activeFileId: number | null
  fileCount?: number
}>()

const emit = defineEmits<{
  select: [file: File]
}>()

function onSelect(file: File) {
  emit('select', file)
}

// ── buildTree ──────────────────────────────────────────────────────────────

function buildTree(files: File[]): TreeNode[] {
  const root: TreeNode[] = []

  for (const file of files) {
    const rawPath = (file.path?.trim() || file.filename)
    const segments = rawPath.replace(/^\/+|\/+$/g, '').split('/').filter(s => s.length > 0)

    let current = root
    let accumulated = ''

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]
      accumulated = accumulated ? `${accumulated}/${segment}` : segment
      const isLeaf = i === segments.length - 1

      if (isLeaf) {
        current.push({
          name: segment,
          fullPath: accumulated,
          isDir: false,
          children: [],
          file,
        })
      } else {
        let dirNode = current.find(n => n.isDir && n.name === segment)
        if (!dirNode) {
          dirNode = {
            name: segment,
            fullPath: accumulated,
            isDir: true,
            children: [],
          }
          current.push(dirNode)
        }
        current = dirNode.children
      }
    }
  }

  return sortNodes(root)
}

function sortNodes(nodes: TreeNode[]): TreeNode[] {
  const dirs = nodes.filter(n => n.isDir).sort((a, b) => a.name.localeCompare(b.name))
  const files = nodes.filter(n => !n.isDir).sort((a, b) => a.name.localeCompare(b.name))
  return [...dirs.map(d => ({ ...d, children: sortNodes(d.children) })), ...files]
}

const treeNodes = computed(() => buildTree(props.files))

// ── 折叠状态 ────────────────────────────────────────────────────────────────

const expandedPaths = ref<Set<string>>(new Set())

function collectAllDirPaths(nodes: TreeNode[]): string[] {
  const paths: string[] = []
  for (const node of nodes) {
    if (node.isDir) {
      paths.push(node.fullPath)
      paths.push(...collectAllDirPaths(node.children))
    }
  }
  return paths
}

function initExpanded() {
  expandedPaths.value = new Set(collectAllDirPaths(treeNodes.value))
}

function autoExpandActive() {
  if (!props.activeFileId || !props.files.length) return
  const activeFile = props.files.find(f => f.id === props.activeFileId)
  if (!activeFile) return

  const rawPath = (activeFile.path?.trim() || activeFile.filename)
  const segments = rawPath.replace(/^\/+|\/+$/g, '').split('/').filter(s => s.length > 0)

  let accumulated = ''
  for (let i = 0; i < segments.length - 1; i++) {
    accumulated = accumulated ? `${accumulated}/${segments[i]}` : segments[i]
    expandedPaths.value.add(accumulated)
  }
}

function toggleDir(path: string) {
  if (expandedPaths.value.has(path)) {
    expandedPaths.value.delete(path)
  } else {
    expandedPaths.value.add(path)
  }
}

provide(EXPAND_KEY, { expandedPaths, toggleDir })

// 初始化：全部展开 + 确保 activeFile 目录展开
initExpanded()
autoExpandActive()

watch(() => props.files, () => {
  initExpanded()
  autoExpandActive()
})

watch(() => props.activeFileId, () => {
  autoExpandActive()
})
</script>

<style scoped>
.file-tree { height: 100%; overflow-y: auto; background: var(--bg-secondary); border-right: 1px solid var(--border-color); }
.file-tree-header { padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--border-color); }
.file-tree-header h3 { font-size: var(--font-sm); font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; }
.file-list { list-style: none; padding: var(--space-2); margin: 0; }
</style>