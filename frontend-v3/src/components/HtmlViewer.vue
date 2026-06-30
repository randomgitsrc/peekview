<template>
  <div class="html-viewer">
    <!-- 相对路径警告条 -->
    <div
      v-if="showRelativePathWarning"
      data-testid="relative-path-warning"
      class="html-warning relative-path-warning"
    >
      <span class="warning-icon">⚠️</span>
      <span class="warning-text">
        此 HTML 含 {{ relativePathWarningCount }} 个本地资源引用，PeekView 将尝试自动注入。部分引用可能无法注入（如动态加载、嵌套 iframe 等）。
      </span>
      <button
        data-testid="relative-path-warning-close"
        class="warning-close"
        @click="relativePathWarningDismissed = true"
        aria-label="关闭警告"
      >
        ✕
      </button>
    </div>

    <!-- 大文件性能警告（512KB ~ 2MB） -->
    <div
      v-if="showSizeWarning"
      data-testid="size-warning"
      class="html-warning size-warning"
    >
      <span class="warning-icon">⚡</span>
      <span class="warning-text">
        文件较大（{{ fileSizeLabel }}），渲染可能需要一点时间。
      </span>
    </div>

    <!-- 大文件手动触发（> 2MB） -->
    <div v-if="showManualRender" class="html-manual-render">
      <div class="manual-render-info">
        <span class="file-size-icon">📄</span>
        <p>文件较大（{{ fileSizeLabel }}），自动渲染已关闭以防止页面卡顿。</p>
        <button
          data-testid="manual-render-btn"
          class="btn btn-primary"
          @click="triggerManualRender"
        >
          点击渲染
        </button>
      </div>
    </div>

    <!-- iframe 容器 -->
    <div v-else class="html-frame-container">
      <div
        v-if="isLoading || props.loadingSiblings"
        data-testid="html-loading"
        class="html-loading"
      >
        <div class="loading-spinner" />
        <span>渲染中...</span>
      </div>

      <iframe
        v-if="renderUrl"
        :src="renderUrl"
        sandbox="allow-scripts allow-forms"
        referrerpolicy="no-referrer"
        class="html-frame"
        @load="onIframeLoad"
        @error="onIframeError"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, inject } from 'vue'
import { HTML_VIEWER_TEST_SIZE_KEY } from './HtmlViewerTestKeys'

const props = defineProps<{
  content: string
  fileId: number
  slug: string
  siblingFileIds?: number[]
  loadingSiblings?: boolean
}>()

// ── 文件大小阈值 ──────────────────────────────────────────────────────────
const SIZE_WARN  = 512 * 1024
const SIZE_BLOCK = 2 * 1024 * 1024

const testContentSize = inject<number | null>(HTML_VIEWER_TEST_SIZE_KEY, null)

const contentSize = computed(() => {
  if (testContentSize !== null && testContentSize !== undefined) return testContentSize
  return props.content.length
})

const fileSizeLabel = computed(() => {
  const size = contentSize.value
  if (size >= SIZE_BLOCK) return `${(size / (1024 * 1024)).toFixed(1)} MB`
  return `${(size / 1024).toFixed(0)} KB`
})

// ── 大文件策略 ────────────────────────────────────────────────────────────
const showSizeWarning   = computed(() => contentSize.value >= SIZE_WARN && contentSize.value < SIZE_BLOCK)
const isBlockedBySize   = computed(() => contentSize.value >= SIZE_BLOCK)
const manuallyTriggered = ref(false)
const showManualRender  = computed(() => isBlockedBySize.value && !manuallyTriggered.value)

function triggerManualRender() {
  manuallyTriggered.value = true
  isLoading.value = true
}

// ── 相对路径检测 ─────────────────────────────────────────────────────────
const relativePathWarningCount = ref(0)
const relativePathWarningDismissed = ref(false)

watch(() => props.content, () => {
  relativePathWarningDismissed.value = false
})

const showRelativePathWarning = computed(() =>
  relativePathWarningCount.value > 0 && !relativePathWarningDismissed.value
)

function countRelativePaths(html: string): number {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const attrs = [
    ...Array.from(doc.querySelectorAll('[href]')).map(el => el.getAttribute('href') ?? ''),
    ...Array.from(doc.querySelectorAll('[src]')).map(el => el.getAttribute('src') ?? ''),
  ]
  return attrs.filter(a => {
    const trimmed = a.trim()
    if (!trimmed) return false
    if (/^(https?:\/\/|data:|blob:|mailto:|tel:)/.test(trimmed)) return false
    if (trimmed.startsWith('//')) return false
    if (trimmed.startsWith('#')) return false
    if (trimmed.startsWith('/')) return false
    return true
  }).length
}

// ── renderUrl ─────────────────────────────────────────────────────────────
const renderUrl = computed(() => {
  if (!props.content || !props.fileId || !props.slug) return null
  if (props.loadingSiblings) return null
  if (isBlockedBySize.value && !manuallyTriggered.value) return null
  let url = `/api/v1/entries/${props.slug}/files/${props.fileId}/render`
  if (props.siblingFileIds && props.siblingFileIds.length > 0) {
    url += `?inject=${props.siblingFileIds.join(',')}`
  }
  return url
})

// ── iframe 加载状态 ───────────────────────────────────────────────────────
const isLoading = ref(false)

function onIframeLoad() {
  isLoading.value = false
}

function onIframeError() {
  isLoading.value = false
}

// ── content 变更 ──────────────────────────────────────────────────────────
watch(
  () => props.content,
  (newContent) => {
    manuallyTriggered.value = false
    relativePathWarningCount.value = countRelativePaths(newContent)
    isLoading.value = true
  },
  { immediate: true }
)

// ── siblingFileIds 变更（切换到非空时重新触发加载态）─────────────────────
watch(() => props.siblingFileIds, () => {
  if (renderUrl.value) isLoading.value = true
})

// ── 手动触发后启动加载态 ─────────────────────────────────────────────────
watch(manuallyTriggered, (triggered) => {
  if (triggered && renderUrl.value) isLoading.value = true
})
</script>

<style scoped>
.html-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* ── 警告条（使用项目 CSS 变量，自动跟随主题）── */
.html-warning {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  font-size: var(--font-xs);
  flex-shrink: 0;
}

.relative-path-warning {
  background: var(--warning-bg);
  border-bottom: 1px solid var(--warning-border);
  color: var(--warning-text);
}

.size-warning {
  background: var(--accent-light);
  border-bottom: 1px solid var(--border-color);
  color: var(--text-secondary);
}

.warning-icon {
  flex-shrink: 0;
}

.warning-text {
  flex: 1;
}

.warning-close {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  color: inherit;
  opacity: 0.7;
  flex-shrink: 0;
  transition: opacity var(--transition-fast);
}

.warning-close:hover {
  opacity: 1;
  background: rgba(0, 0, 0, 0.08);
}

/* ── 手动触发区 ── */
.html-manual-render {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.manual-render-info {
  text-align: center;
  color: var(--text-secondary);
}

.file-size-icon {
  font-size: 48px;
  display: block;
  margin-bottom: var(--space-3);
}

.manual-render-info p {
  margin-bottom: var(--space-4);
  font-size: var(--font-sm);
}

/* ── iframe 容器 ── */
.html-frame-container {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.html-loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: var(--font-sm);
  z-index: 1;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--border-color);
  border-top-color: var(--accent-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.html-frame {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
  background: transparent;
  overflow: auto;
}
</style>
