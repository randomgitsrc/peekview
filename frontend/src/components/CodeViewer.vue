<template>
  <div class="code-viewer" ref="container">
    <div class="code-header">
      <span class="filename">{{ filename }}</span>
      <span class="line-count" v-if="lineCount">{{ lineCount }} lines</span>
      <button
        class="header-btn copy-btn"
        @click="copyCode"
        :aria-label="copied ? 'Copied to clipboard' : 'Copy code'"
        :title="copied ? 'Copied!' : 'Copy'"
      >
        {{ copied ? '✓' : 'Copy' }}
      </button>
      <button
        class="header-btn wrap-btn"
        @click="wrap = !wrap"
        :aria-label="wrap ? 'Disable word wrap' : 'Enable word wrap'"
        :title="wrap ? 'No wrap' : 'Wrap'"
      >
        {{ wrap ? '↩' : '→' }}
      </button>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading" class="code-loading">
      <div class="code-skeleton" v-for="i in 8" :key="i">
        <span class="skeleton-line-number"></span>
        <span class="skeleton-line-content"></span>
      </div>
    </div>

    <!-- Shiki highlighted code (v-html — safe: Shiki output is sanitized) -->
    <div
      v-else-if="highlighted"
      class="code-content"
      :class="{ wrap }"
      v-html="highlighted"
    ></div>

    <!-- Safe fallback: Vue template rendering, no v-html (review §16) -->
    <div v-else class="code-content fallback" :class="{ wrap }">
      <pre>
        <div v-for="(line, i) in content.split('\n')" :key="i" class="code-line" :id="`L${i + 1}`">
          <span class="line-number">{{ i + 1 }}</span>
          <span class="line-content">{{ line }}</span>
        </div>
      </pre>
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
}>()

const { highlight } = useShiki()

const highlighted = ref('')
const isLoading = ref(true)
const copied = ref(false)
const wrap = ref(false)
const container = ref<HTMLElement>()

const isEmpty = computed(() => props.content.length === 0)

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
  } catch {
    // Fallback: leave highlighted empty, Vue template fallback will render
    highlighted.value = ''
  } finally {
    isLoading.value = false
  }
}

// Re-highlight when content or language changes
watch(
  () => [props.content, props.language],
  () => doHighlight(),
)

onMounted(doHighlight)

// Line selection from URL hash (#L5 or #L5-L10)
onMounted(() => {
  const hash = window.location.hash
  if (hash.startsWith('#L')) {
    nextTick(() => {
      const el = document.querySelector(hash)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('line-highlight')
      }
    })
  }
})

async function copyCode() {
  try {
    await navigator.clipboard.writeText(props.content)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    // Clipboard API not available — ignore silently
  }
}
</script>

<style scoped>
.code-viewer {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
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
}

.header-btn {
  background: none;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 2px var(--space-2);
  cursor: pointer;
  font-size: var(--font-xs);
  color: var(--text-secondary);
  margin-left: auto;
}

.header-btn:hover {
  background: var(--bg-primary);
  color: var(--text-primary);
}

.copy-btn {
  margin-left: auto;
}

.wrap-btn {
  margin-left: var(--space-1);
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
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.skeleton-line-content {
  flex: 1;
  height: 14px;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  max-width: 60%;
}

/* Code content */
.code-content {
  padding: var(--space-3);
  overflow-x: auto;
  font-size: var(--font-sm);
  line-height: var(--line-height-code);
  background: var(--shiki-color-background, var(--bg-secondary));
}

.code-content :deep(pre) {
  margin: 0;
  background: transparent !important;
}

.code-content :deep(code) {
  font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace;
  font-size: var(--font-sm);
  line-height: var(--line-height-code);
}

/* Ensure Shiki tokens use CSS variables */
.code-content :deep(.shiki) {
  background: transparent !important;
}

/* Shiki line numbers - make them non-selectable */
.code-content :deep(.line-number),
.code-content :deep([data-line-number]) {
  user-select: none;
  -webkit-user-select: none;
}

.code-content.wrap {
  white-space: pre-wrap;
  word-break: break-all;
}

.code-content.wrap :deep(pre) {
  white-space: pre-wrap;
}

/* Fallback line rendering */
.fallback pre {
  margin: 0;
}

.code-line {
  display: flex;
  gap: var(--space-3);
  min-height: 1.5em;
}

.line-number {
  color: var(--text-tertiary);
  text-align: right;
  min-width: 30px;
  user-select: none; /* Line numbers are not selectable */
  -webkit-user-select: none;
  flex-shrink: 0;
}

.line-content {
  flex: 1;
}

/* Line highlight for hash selection */
:deep(.line-highlight),
.line-highlight {
  background: var(--accent-subtle);
  border-radius: var(--radius-sm);
  margin: 0 calc(-1 * var(--space-3));
  padding: 0 var(--space-3);
}

.empty-file {
  padding: var(--space-6);
  text-align: center;
  color: var(--text-secondary);
}
</style>
