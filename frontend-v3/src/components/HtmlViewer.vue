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
        此 HTML 含 {{ relativePathCount }} 个本地资源引用，PeekView 当前不支持多文件相对路径，这些资源不会加载。
      </span>
      <button
        data-testid="relative-path-warning-close"
        class="warning-close"
        @click="showRelativePathWarning = false"
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
      <!-- Loading 态 -->
      <div
        v-if="isLoading"
        data-testid="html-loading"
        class="html-loading"
      >
        <div class="loading-spinner" />
        <span>渲染中...</span>
      </div>

      <!-- iframe -->
      <iframe
        v-if="blobUrl"
        :src="blobUrl"
        sandbox="allow-scripts"
        referrerpolicy="no-referrer"
        scrolling="yes"
        class="html-frame"
        @load="onIframeLoad"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted, inject } from 'vue'

const props = defineProps<{
  content: string
}>()

// ── 测试注入点（仅测试环境使用，生产环境忽略）─────────────────────────────
const testContentSize = inject<number | null>('__testContentSize', null)

// ── 文件大小阈值 ──────────────────────────────────────────────────────────
const SIZE_WARN  = 512 * 1024       // 512KB
const SIZE_BLOCK = 2 * 1024 * 1024  // 2MB

const contentSize = computed(() => {
  // 测试环境允许注入虚假大小
  if (testContentSize !== null && testContentSize !== undefined) return testContentSize
  // 生产：JS 字符串为 UTF-16，1 字符 ≈ 2 字节，这里用字符数近似
  return props.content.length
})

const fileSizeLabel = computed(() => {
  const size = contentSize.value
  if (size >= SIZE_BLOCK) return `${(size / (1024 * 1024)).toFixed(1)} MB`
  if (size >= SIZE_WARN)  return `${(size / 1024).toFixed(0)} KB`
  return `${size} B`
})

// ── 大文件策略 ────────────────────────────────────────────────────────────
const showSizeWarning  = computed(() => contentSize.value >= SIZE_WARN  && contentSize.value < SIZE_BLOCK)
const isBlockedBySize  = computed(() => contentSize.value >= SIZE_BLOCK)
const manuallyTriggered = ref(false)
const showManualRender  = computed(() => isBlockedBySize.value && !manuallyTriggered.value)

function triggerManualRender() {
  manuallyTriggered.value = true
}

// ── 相对路径检测 ─────────────────────────────────────────────────────────
// 检测范围：静态 HTML 属性（href / src / action）
// 不覆盖 JS 动态创建的资源请求（已知限制）
const relativePathCount = computed(() => {
  if (!props.content) return 0
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(props.content, 'text/html')
    const attrs = [
      ...Array.from(doc.querySelectorAll('[href]')).map(el => el.getAttribute('href') ?? ''),
      ...Array.from(doc.querySelectorAll('[src]')).map(el => el.getAttribute('src') ?? ''),
      ...Array.from(doc.querySelectorAll('[action]')).map(el => el.getAttribute('action') ?? ''),
    ]
    return attrs.filter(attr =>
      attr &&
      !attr.startsWith('http://') &&
      !attr.startsWith('https://') &&
      !attr.startsWith('//') &&
      !attr.startsWith('data:') &&
      !attr.startsWith('#') &&
      attr.trim() !== ''
    ).length
  } catch {
    return 0
  }
})

const showRelativePathWarning = ref(false)

watch(relativePathCount, (count) => {
  showRelativePathWarning.value = count > 0
}, { immediate: true })

// ── Blob URL 管理 ─────────────────────────────────────────────────────────
const blobUrl = ref<string | null>(null)
const isLoading = ref(false)

function createBlobUrl(content: string): string {
  const blob = new Blob([content], { type: 'text/html' })
  return URL.createObjectURL(blob)
}

function revokeBlobUrl(url: string | null) {
  if (url) URL.revokeObjectURL(url)
}

function initRender(content: string) {
  // 大文件且未手动触发，不创建 Blob URL
  if (isBlockedBySize.value && !manuallyTriggered.value) return

  revokeBlobUrl(blobUrl.value)
  isLoading.value = true
  blobUrl.value = createBlobUrl(content)
}

// content 变更时重新渲染
watch(
  () => props.content,
  (newContent) => {
    manuallyTriggered.value = false
    initRender(newContent)
  },
  { immediate: true }
)

// 手动触发时渲染
watch(manuallyTriggered, (triggered) => {
  if (triggered) initRender(props.content)
})

// 卸载时释放 Blob URL，防止内存泄漏
onUnmounted(() => {
  revokeBlobUrl(blobUrl.value)
})

// ── iframe 加载状态 ───────────────────────────────────────────────────────
function onIframeLoad() {
  isLoading.value = false
}
</script>

<style scoped>
.html-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* ── 警告条 ── */
.html-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  font-size: 13px;
  flex-shrink: 0;
}

.relative-path-warning {
  background: var(--color-warning-bg, #fff8e1);
  border-bottom: 1px solid var(--color-warning-border, #f9a825);
  color: var(--color-warning-text, #6d4c00);
}

.size-warning {
  background: var(--color-info-bg, #e3f2fd);
  border-bottom: 1px solid var(--color-info-border, #1565c0);
  color: var(--color-info-text, #0d47a1);
}

[data-theme="dark"] .relative-path-warning {
  background: #3d3000;
  border-color: #f9a825;
  color: #ffe57f;
}

[data-theme="dark"] .size-warning {
  background: #0d2137;
  border-color: #1565c0;
  color: #90caf9;
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
  border-radius: 4px;
  color: inherit;
  opacity: 0.7;
  flex-shrink: 0;
}

.warning-close:hover {
  opacity: 1;
  background: rgba(0, 0, 0, 0.1);
}

/* ── 手动触发 ── */
.html-manual-render {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.manual-render-info {
  text-align: center;
  color: var(--color-text-secondary);
}

.file-size-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 12px;
}

.manual-render-info p {
  margin-bottom: 16px;
  font-size: 14px;
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
  gap: 12px;
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
  font-size: 14px;
  z-index: 1;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--color-border-secondary);
  border-top-color: var(--color-accent);
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
  background: #fff;
}
</style>
