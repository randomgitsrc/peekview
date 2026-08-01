<template>
  <div class="tree-view">
    <TruncationBanner
      v-if="truncated"
      message="文件超过 2MB，已截断显示"
      :download-fn="downloadFn"
    />

    <template v-else>
      <div class="tree-search">
        <input
          v-model="searchQuery"
          class="tree-search-input"
          type="text"
          placeholder="Search nodes..."
          aria-label="Search tree nodes"
        />
        <span aria-live="polite" class="search-match-count">{{ matchCountText }}</span>
      </div>

      <div v-if="treeData.length === 0" class="no-data">
        <span>{{ emptyMessage }}</span>
      </div>

      <ul v-else class="tree-list">
        <DataTreeNode
          v-for="node in treeData"
          :key="node.path"
          :node="node"
          :depth="0"
          :search-query="searchQuery"
        />
      </ul>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, provide, ref, watch } from 'vue'
import { load } from 'js-yaml'
import DataTreeNode from '@/components/DataTreeNode.vue'
import TruncationBanner from '@/components/TruncationBanner.vue'
import { jsonToTreeData, xmlToTreeData } from '@/composables/useTreeData'
import { TreeExpandKey } from '@/composables/treeExpandKey'
import type { TreeDataNode, NodeType } from '@/types/structured-data'

const props = defineProps<{
  content: string
  format: 'json' | 'yaml' | 'xml'
  filename: string
  downloadFn: () => void
}>()

const emit = defineEmits<{
  'parse-error': [message: string]
}>()

const MAX_SIZE = 2 * 1024 * 1024

const truncated = computed(() => props.content.length > MAX_SIZE)

const treeData = ref<TreeDataNode[]>([])
const emptyMessage = ref('无数据')
const searchQuery = ref('')
const expandedPaths = ref<Set<string>>(new Set())

function togglePath(path: string) {
  const next = new Set(expandedPaths.value)
  if (next.has(path)) {
    next.delete(path)
  } else {
    next.add(path)
  }
  expandedPaths.value = next
}

provide(TreeExpandKey, { expandedPaths, togglePath })

function parseTree() {
  if (truncated.value) return
  if (!props.content.trim()) {
    treeData.value = []
    emptyMessage.value = '无数据'
    return
  }
  try {
    let root: unknown = null
    if (props.format === 'json') {
      root = JSON.parse(props.content)
      treeData.value = jsonToTreeData(root)
    } else if (props.format === 'yaml') {
      root = load(props.content)
      treeData.value = jsonToTreeData(root)
    } else {
      treeData.value = xmlToTreeData(props.content)
    }
    if (treeData.value.length === 0) {
      if (isScalarRoot(root)) {
        treeData.value = [scalarLeaf(root)]
      } else {
        emptyMessage.value = emptyMessageFor(root)
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    emit('parse-error', message)
    treeData.value = []
  }
}

function isScalarRoot(root: unknown): root is string | number | boolean {
  return typeof root === 'string' || typeof root === 'number' || typeof root === 'boolean'
}

function scalarLeaf(root: string | number | boolean): TreeDataNode {
  const type: NodeType = typeof root === 'number' ? 'number' : typeof root === 'boolean' ? 'boolean' : 'string'
  return { key: 'value', value: String(root), type, path: 'value' }
}

function emptyMessageFor(root: unknown): string {
  if (root === null || root === undefined) return '无数据'
  if (Array.isArray(root)) return root.length === 0 ? 'Empty array' : '无数据'
  if (typeof root === 'object') return Object.keys(root).length === 0 ? 'Empty object' : '无数据'
  return '无数据'
}

function resetExpansion() {
  if (treeData.value.length === 1 && treeData.value[0].children?.length) {
    expandedPaths.value = new Set([treeData.value[0].path])
  } else {
    expandedPaths.value = new Set()
  }
}

watch(
  () => [props.content, props.format],
  () => {
    treeData.value = []
    expandedPaths.value = new Set()
    searchQuery.value = ''
    parseTree()
    resetExpansion()
  },
  { immediate: true },
)

function nodeMatches(node: TreeDataNode, q: string): boolean {
  return node.key.toLowerCase().includes(q) || node.value.toLowerCase().includes(q)
}

const matchCount = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return 0
  let count = 0
  const walk = (nodes: TreeDataNode[]) => {
    for (const node of nodes) {
      if (nodeMatches(node, q)) count++
      if (node.children) walk(node.children)
    }
  }
  walk(treeData.value)
  return count
})

const matchCountText = computed(() => {
  const q = searchQuery.value.trim()
  if (!q) return ''
  const n = matchCount.value
  if (n === 0) return 'No matches'
  return `${n} ${n === 1 ? 'match' : 'matches'}`
})
</script>

<style scoped>
.tree-view {
  min-width: 0;
}

.tree-search {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.tree-search-input {
  flex: 1;
  min-width: 0;
  padding: var(--space-2) var(--space-3);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--font-sm);
}

.tree-search-input:focus {
  outline: none;
  border-color: var(--accent-color);
}

.search-match-count {
  font-size: var(--font-xs);
  color: var(--text-secondary);
  flex-shrink: 0;
}

.tree-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.no-data {
  padding: var(--space-6);
  text-align: center;
  color: var(--text-secondary);
  font-size: var(--font-sm);
}

@media (max-width: 640px) {
  .tree-search-input {
    font-size: var(--font-md);
  }
}
</style>
