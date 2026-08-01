<template>
  <li class="tree-node">
    <div class="tree-node-row" :style="{ paddingLeft: `${depth * 20}px` }">
      <button
        v-if="hasChildren"
        class="expand-toggle"
        :aria-expanded="isExpanded"
        :aria-label="isExpanded ? 'Collapse node' : 'Expand node'"
        @click="toggle"
      >
        <ChevronRightIcon :size="14" :class="{ rotated: isExpanded }" />
      </button>
      <span v-else class="expand-placeholder" aria-hidden="true"></span>

      <button
        v-if="isLeaf"
        type="button"
        class="tree-node-label"
        :class="{ 'search-highlight': isHighlighted }"
        :title="copyTitle"
        @click="copyValue"
      >
        <span class="tree-node-key">{{ node.key }}</span>
        <span class="tree-node-value">{{ node.value }}</span>
      </button>
      <span v-else class="tree-node-label" :class="{ 'search-highlight': isHighlighted }">
        <span class="tree-node-key">{{ node.key }}</span>
      </span>

      <span class="type-tag" :class="`type-${node.type}`">{{ node.type }}</span>
    </div>

    <ul v-if="hasChildren && isExpanded" class="tree-children">
      <DataTreeNode
        v-for="child in node.children"
        :key="child.path"
        :node="child"
        :depth="depth + 1"
        :search-query="searchQuery"
      />
    </ul>
  </li>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { ChevronRight as ChevronRightIcon } from 'lucide-vue-next'
import type { TreeDataNode } from '@/types/structured-data'
import { useToast } from '@/composables/useToast'
import { TreeExpandKey, type TreeExpandContext } from '@/composables/treeExpandKey'

const props = defineProps<{
  node: TreeDataNode
  depth: number
  searchQuery: string
}>()

const { expandedPaths, togglePath } = inject<TreeExpandContext>(TreeExpandKey)!
const toast = useToast()

const hasChildren = computed(() => (props.node.children?.length ?? 0) > 0)
const isExpanded = computed(() => expandedPaths.value.has(props.node.path))
const isLeaf = computed(() => !hasChildren.value)

const query = computed(() => props.searchQuery.trim().toLowerCase())
const isHighlighted = computed(() => {
  const q = query.value
  if (!q) return false
  return props.node.key.toLowerCase().includes(q) || props.node.value.toLowerCase().includes(q)
})

const copyTitle = computed(() => (isLeaf.value ? 'Click to copy value' : ''))

function toggle() {
  togglePath(props.node.path)
}

async function copyValue() {
  if (!isLeaf.value || !props.node.value) return
  try {
    await navigator.clipboard.writeText(props.node.value)
    const preview = props.node.value.length > 80 ? `${props.node.value.slice(0, 80)}…` : props.node.value
    toast.success(`Copied: ${preview}`)
  } catch (err) {
    console.error('Copy failed:', err)
    toast.error('Failed to copy')
  }
}
</script>

<style scoped>
.tree-node {
  list-style: none;
}

.tree-node-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
}

.tree-node-row:hover {
  background: var(--bg-tertiary);
}

.expand-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  margin: calc(var(--space-1) * -1) 0;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.expand-toggle:hover {
  color: var(--text-primary);
}

.expand-toggle .rotated {
  transform: rotate(90deg);
  transition: transform var(--transition-fast);
}

.expand-placeholder {
  width: 44px;
  flex-shrink: 0;
}

.tree-node-label {
  display: inline-flex;
  align-items: baseline;
  gap: var(--space-2);
  font-family: var(--font-mono);
  font-size: var(--font-sm);
  cursor: pointer;
  min-width: 0;
  background: none;
  border: none;
  padding: 0;
  color: inherit;
  text-align: left;
}

.tree-node-label:focus-visible {
  outline: 2px solid var(--accent-hover);
  outline-offset: 2px;
}

.tree-node-label.search-highlight {
  background: var(--warning-bg);
  color: var(--warning-text);
  border-radius: var(--radius-sm);
  padding: 0 var(--space-1);
}

.tree-node-key {
  color: var(--text-primary);
}

.tree-node-value {
  color: var(--text-secondary);
  word-break: break-all;
}

.type-tag {
  font-size: var(--font-xs);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  flex-shrink: 0;
}

.type-string {
  background: var(--success-bg);
  color: var(--tag-string);
}

.type-number {
  background: var(--accent-light);
  color: var(--tag-number);
}

.type-boolean {
  background: var(--warning-bg);
  color: var(--tag-boolean);
}

.type-null {
  background: var(--bg-tertiary);
  color: var(--tag-null);
}

.type-object,
.type-array {
  background: var(--accent-light);
  color: var(--accent-hover);
}

.tree-children {
  list-style: none;
  margin: 0;
  padding: 0;
}
</style>
