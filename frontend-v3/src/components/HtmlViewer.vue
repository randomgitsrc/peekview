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
        此 HTML 含 {{ relativePathWarningCount }} 个本地资源引用，PeekView 当前不支持多文件相对路径，这些资源不会加载。
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

    <!-- 大文件手动触发（> 2MB）
         v-if/v-else 链：showManualRender 为 true 时显示手动触发区，
         否则显示 iframe 容器（含 loading 态）-->
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

    <!-- iframe 容器（正常渲染 / 512KB~2MB 时也显示此区域）-->
    <div v-else class="html-frame-container">
      <!-- Loading 态：fetch 兄弟文件中 / blobUrl 创建后到 iframe load 事件前 -->
      <div
        v-if="isLoading || props.loadingSiblings"
        data-testid="html-loading"
        class="html-loading"
      >
        <div class="loading-spinner" />
        <span>渲染中...</span>
      </div>

      <!-- iframe：content 非空且 blobUrl 已创建时显示 -->
      <iframe
        v-if="blobUrl"
        :src="blobUrl"
        sandbox="allow-scripts"
        referrerpolicy="no-referrer"
        class="html-frame"
        @load="onIframeLoad"
        @error="onIframeError"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted, inject } from 'vue'

// ── 测试注入 key（Symbol 避免命名冲突，定义在 HtmlViewerTestKeys.ts）────
import { HTML_VIEWER_TEST_SIZE_KEY } from './HtmlViewerTestKeys'

const props = defineProps<{
  content: string
  siblingFiles?: SiblingFile[]
  loadingSiblings?: boolean
}>()

export interface SiblingFile {
  filename: string
  content: string
  language: string
}

// ── 文件大小阈值 ──────────────────────────────────────────────────────────
const SIZE_WARN  = 512 * 1024       // 512KB
const SIZE_BLOCK = 2 * 1024 * 1024  // 2MB

// 测试环境可注入虚假大小；生产环境用字符数近似字节数
// 注意：JS 字符串为 UTF-16，content.length 是字符数而非字节数。
// Blob 实际用 UTF-8 编码，多字节字符（如中文）会导致实际体积更大。
// 此处用字符数作近似，对纯 ASCII HTML 误差极小；含大量多字节字符时
// 实际 Blob 可能比阈值计算结果更大，可接受的已知偏差。
const testContentSize = inject<number | null>(HTML_VIEWER_TEST_SIZE_KEY, null)

const contentSize = computed(() => {
  if (testContentSize !== null && testContentSize !== undefined) return testContentSize
  return props.content.length
})

const fileSizeLabel = computed(() => {
  const size = contentSize.value
  if (size >= SIZE_BLOCK) return `${(size / (1024 * 1024)).toFixed(1)} MB`
  // fileSizeLabel 只在 size >= SIZE_WARN 时显示，KB 分支是实际最小值
  return `${(size / 1024).toFixed(0)} KB`
})

// ── 大文件策略 ────────────────────────────────────────────────────────────
const showSizeWarning   = computed(() => contentSize.value >= SIZE_WARN && contentSize.value < SIZE_BLOCK)
const isBlockedBySize   = computed(() => contentSize.value >= SIZE_BLOCK)
const manuallyTriggered = ref(false)
const showManualRender  = computed(() => isBlockedBySize.value && !manuallyTriggered.value)

function triggerManualRender() {
  manuallyTriggered.value = true
}

// ── 资源注入 ────────────────────────────────────────────────────────────

function normalizeRef(ref: string): string | null {
  const trimmed = ref.trim()
  if (!trimmed) return null
  if (/^(https?:\/\/|data:|blob:|mailto:|tel:)/.test(trimmed)) return null
  if (trimmed.startsWith('//')) return null
  if (trimmed.startsWith('#')) return null
  if (trimmed.startsWith('/')) return null
  return trimmed.replace(/^\.\//, '')
}

function injectResources(
  html: string,
  siblings: SiblingFile[]
): { html: string; unmatchedCount: number } {
  if (!siblings || siblings.length === 0) {
    return { html, unmatchedCount: countRelativePaths(html) }
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  const fileMap = new Map(
    siblings
      .map(f => [normalizeRef(f.filename), f.content] as const)
      .filter((entry): entry is [string, string] => entry[0] !== null)
  )

  // CSS: <link rel="stylesheet"> → <style>
  doc.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
    const href = normalizeRef(link.getAttribute('href') ?? '')
    if (!href || !fileMap.has(href)) return
    const style = doc.createElement('style')
    style.textContent = `/* injected from: ${href} */\n${fileMap.get(href)}`
    link.replaceWith(style)
  })

  // JS: <script src> → inline <script>，移到 body 末尾
  // 外部脚本在加载完成时执行（DOM 已就绪），内联脚本则同步执行。
  // 若保留原位（如 <head>），执行时 <body> 尚未解析，DOM 查询会失败。
  // 移到 body 末尾可保证 DOM 就绪后再执行。
  // type="module" 排除注入：inline module 内部 import 静默失败，
  // 保留原节点 404 → 计入警告条，行为更透明
  doc.querySelectorAll('script[src]').forEach(script => {
    const src = normalizeRef(script.getAttribute('src') ?? '')
    if (!src || !fileMap.has(src)) return
    const type = script.getAttribute('type')
    if (type && type !== 'text/javascript') return
    const inline = doc.createElement('script')
    inline.textContent = `/* injected from: ${src} */\n${fileMap.get(src)}`
    script.remove()
    doc.body.appendChild(inline)
  })

  const unmatchedCount = countRelativePathsInDoc(doc)
  return { html: serializeDoc(doc), unmatchedCount }
}

function serializeDoc(doc: Document): string {
  const dt = doc.doctype
  const doctypeStr = dt ? `<!DOCTYPE ${dt.name}>` : '<!DOCTYPE html>'
  return doctypeStr + '\n' + doc.documentElement.outerHTML
}

function countRelativePaths(html: string): number {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return countRelativePathsInDoc(doc)
}

function countRelativePathsInDoc(doc: Document): number {
  const attrs = [
    ...Array.from(doc.querySelectorAll('[href]')).map(el => el.getAttribute('href') ?? ''),
    ...Array.from(doc.querySelectorAll('[src]')).map(el => el.getAttribute('src') ?? ''),
  ]
  return attrs.filter(a => a && normalizeRef(a) !== null).length
}

// ── 相对路径检测 ─────────────────────────────────────────────────────────
// 检测范围：静态 HTML 属性（href / src）
// 不覆盖 JS 动态创建的资源请求（已知限制，见 spec §3.4）
const relativePathWarningCount = ref(0)

// 用户是否主动关闭了警告（切换文件时 content 变更自动重置）
const relativePathWarningDismissed = ref(false)

watch(() => props.content, () => {
  relativePathWarningDismissed.value = false
})

const showRelativePathWarning = computed(() =>
  relativePathWarningCount.value > 0 && !relativePathWarningDismissed.value
)

// ── Blob URL 管理 ─────────────────────────────────────────────────────────
const blobUrl   = ref<string | null>(null)
const isLoading = ref(false)

function createBlobUrl(content: string): string {
  const blob = new Blob([content], { type: 'text/html' })
  return URL.createObjectURL(blob)
}

function revokeBlobUrl(url: string | null) {
  if (url) URL.revokeObjectURL(url)
}

function initRender(content: string) {
  // 空内容不渲染，避免创建空 Blob 导致 iframe 短暂闪白
  if (!content) return
  // 正在 fetch 兄弟文件，等数据到齐后再渲染
  if (props.loadingSiblings) return
  // 大文件且未手动触发，不创建 Blob URL
  if (isBlockedBySize.value && !manuallyTriggered.value) return

  const { html: processed, unmatchedCount } = injectResources(content, props.siblingFiles ?? [])
  relativePathWarningCount.value = unmatchedCount
  revokeBlobUrl(blobUrl.value)
  isLoading.value = true
  blobUrl.value = createBlobUrl(processed)
}

// content 变更时重新渲染（entry 切换文件时 content 会先置空再填充）
watch(
  () => props.content,
  (newContent) => {
    manuallyTriggered.value = false
    initRender(newContent)
  },
  { immediate: true }
)

// siblingFiles 到齐后触发渲染
// 不合并到 content watch：合并会导致 content 先到时先渲染无注入版本，
// siblingFiles 到了再渲染一次有注入版本，用户看到闪烁
watch(() => props.siblingFiles, (siblings) => {
  if (siblings && siblings.length > 0) initRender(props.content)
})

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

// Blob URL 加载失败时也退出 loading 态，防止 Loading 永久卡住
function onIframeError() {
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
  background: transparent; /* 由 iframe 内容自己决定背景色 */
  overflow: auto;          /* 替代过时的 scrolling 属性 */
}
</style>
