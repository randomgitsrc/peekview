<template>
  <div class="code-viewer" ref="container">
    <!-- Header with filename only -->
    <div class="code-header">
      <span class="filename">{{ filename }}</span>
      <span class="line-count" v-if="lineCount">{{ lineCount }} lines</span>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading" class="code-loading">
      <div class="code-skeleton" v-for="i in 8" :key="i">
        <span class="skeleton-line-number"></span>
        <span class="skeleton-line-content"></span>
      </div>
    </div>

    <!-- Shiki highlighted code -->
    <div
      v-else-if="highlighted"
      ref="codeBodyRef"
      class="code-content"
      :class="{ wrap }"
      v-html="highlighted"
    ></div>

    <!-- Safe fallback -->
    <div v-else class="code-content fallback" :class="{ wrap }">
      <pre><code>{{ content }}</code></pre>
    </div>

    <div v-if="isEmpty" class="empty-file">Empty file</div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, nextTick } from 'vue'
import { useShiki } from '../composables/useShiki'

const props = defineProps<{
  content: string
  filename: string
  language: string | null
  lineCount: number | null
  wrap: boolean
}>()

const { highlight } = useShiki()

const highlighted = ref('')
const isLoading = ref(true)
const codeBodyRef = ref<HTMLElement | null>(null)

const isEmpty = computed(() => props.content.length === 0)

// Sync line heights between line numbers and code lines when wrap is enabled
async function syncLineHeights() {
  if (!codeBodyRef.value) return

  await nextTick()

  const lineNumbers = codeBodyRef.value.querySelectorAll('.line-number')
  const lines = codeBodyRef.value.querySelectorAll('.line')

  // Reset all line number heights first
  lineNumbers.forEach((ln) => {
    (ln as HTMLElement).style.height = ''
  })

  // Sync heights when wrap is enabled
  if (props.wrap) {
    lines.forEach((line, index) => {
      const lineNum = lineNumbers[index]
      if (lineNum && line) {
        const lineHeight = line.getBoundingClientRect().height
        ;(lineNum as HTMLElement).style.height = `${lineHeight}px`
      }
    })
  }
}

// Watch for wrap changes to sync heights
watch(() => props.wrap, () => {
  syncLineHeights()
})

// Also sync after highlighting completes
watch(() => highlighted.value, () => {
  syncLineHeights()
})

async function doHighlight() {
  if (isEmpty.value) {
    highlighted.value = ''
    isLoading.value = false
    return
  }

  isLoading.value = true
  try {
  highlighted.value = await highlight(
      props.content,
      props.language || 'text',
    )
  } catch (err) {
    console.error('[CodeViewer] Highlight error:', err)
    highlighted.value = ''
  } finally {
    isLoading.value = false
  }
}

// Re-highlight when content or language changes
watch(
  () => [props.content, props.language],
  () => doHighlight(),
  { immediate: true },
)

onMounted(() => {
  // Line selection from URL hash
  const hash = window.location.hash
  if (hash.startsWith('#L')) {
    setTimeout(() => {
      const el = document.querySelector(hash)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('line-highlight')
      }
    }, 100)
  }
})
</script>

<style scoped>
.code-viewer {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: auto;
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 200px);
}

.code-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  font-size: var(--font-sm);
}

.filename {
  font-weight: 600;
  color: var(--text-primary);
}

.line-count {
  color: var(--text-secondary);
  font-size: var(--font-xs);
}

/* Code content - Shiki output */
.code-content {
  overflow: auto;
  font-size: var(--font-sm);
  line-height: var(--line-height-code);
  background: var(--bg-secondary);
  flex: 1;
}

/* Code container with line numbers */
.code-content :deep(.code-container) {
  display: flex;
}

/* Line numbers column */
.code-content :deep(.line-numbers) {
  flex-shrink: 0;
  padding: var(--space-3) 0;
  background: var(--bg-tertiary);
  border-right: 1px solid var(--border-color);
  text-align: right;
  user-select: none;
  font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace;
  font-size: var(--font-sm);
  line-height: var(--line-height-code);
}

.code-content :deep(.line-number) {
  display: block;
  padding: 0 var(--space-3);
  color: var(--text-secondary);
  min-width: 3ch;
  height: var(--line-height-code);
  line-height: var(--line-height-code);
}

/* Code content area */
.code-content :deep(pre) {
  margin: 0;
  padding: var(--space-3);
  background: transparent !important;
  overflow: visible;
  font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace;
  font-size: var(--font-sm);
  line-height: var(--line-height-code);
}

.code-content :deep(code) {
  display: flex;
  flex-direction: column;
  font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace;
  font-size: var(--font-sm);
  line-height: var(--line-height-code);
}

.code-content :deep(.line) {
  display: block;
  height: var(--line-height-code);
  line-height: var(--line-height-code);
}

/* Word wrap */
.code-content.wrap :deep(pre) {
  white-space: pre-wrap;
  word-break: break-all;
}

.code-content.wrap :deep(.line) {
  height: auto;
  min-height: var(--line-height-code);
  white-space: pre-wrap;
  word-break: break-all;
}

.code-content.wrap :deep(.line-number) {
  height: auto;
  min-height: var(--line-height-code);
}

/* Line highlight for hash selection */
:deep(.line-highlight),
.line-highlight {
  background: var(--accent-subtle);
  border-radius: var(--radius-sm);
}

/* Fallback styling */
.fallback pre {
  margin: 0;
  font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace;
}

.empty-file {
  padding: var(--space-6);
  text-align: center;
  color: var(--text-secondary);
}

/* Loading skeleton */
.code-loading {
  padding: var(--space-3);
}

.code-skeleton {
  display: flex;
  gap: var(--space-3);
  padding: 2px 0;
}

.skeleton-line-number {
  width: 30px;
  height: 14px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.skeleton-line-content {
  flex: 1;
  height: 14px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-sm);
  max-width: 60%;
}
</style>
