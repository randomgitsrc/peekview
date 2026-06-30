<template>
  <div class="markdown-viewer">
    <slot name="toc" :headings="headings" />
    <div ref="contentRef" class="markdown-body">
      <template v-for="(block, i) in blocks" :key="i">
        <div v-if="block.type === 'html'" v-html="block.html" />
        <DiagramBlock v-else-if="block.type === 'diagram'" :block="block" :theme="theme" />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useMarkdown } from '@/composables/useMarkdown'
import { useThemeStore } from '@/stores/theme'
import { storeToRefs } from 'pinia'
import type { TocHeading, MarkdownBlock } from '@/types'
import DiagramBlock from '@/components/DiagramBlock.vue'

const props = defineProps<{ content: string }>()
const emit = defineEmits<{ headings: [headings: TocHeading[]] }>()

const { render } = useMarkdown()
const themeStore = useThemeStore()
const { theme } = storeToRefs(themeStore)

const contentRef = ref<HTMLElement>()
const headings = ref<TocHeading[]>([])
const blocks = ref<MarkdownBlock[]>([])
const isLoading = ref(false)
let renderToken = 0

async function copyCodeBlock(btn: HTMLButtonElement) {
  const code = btn.getAttribute('data-code')
  if (code) {
    try {
      await navigator.clipboard.writeText(code)
      const originalText = btn.textContent
      btn.textContent = 'Copied!'
      btn.classList.add('copied')
      setTimeout(() => {
        btn.textContent = originalText
        btn.classList.remove('copied')
      }, 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }
}

function handleCodeBlockCopy(e: MouseEvent) {
  const target = (e.target as Element).closest('[data-action="copy-code-block"]') as HTMLButtonElement | null
  if (!target) return
  copyCodeBlock(target)
}

onMounted(() => {
  contentRef.value?.addEventListener('click', handleCodeBlockCopy)
})

onBeforeUnmount(() => {
  contentRef.value?.removeEventListener('click', handleCodeBlockCopy)
})

async function renderContent() {
  const myToken = ++renderToken
  isLoading.value = true
  try {
    const themeName = theme.value === 'dark' ? 'github-dark' : 'github-light'
    const result = await render(props.content, themeName)
    if (myToken !== renderToken) return
    headings.value = result.headings
    blocks.value = result.blocks
    emit('headings', result.headings)
  } catch (err) {
    if (myToken === renderToken) console.error('Markdown render failed:', err)
  } finally {
    if (myToken === renderToken) isLoading.value = false
  }
}

watch(() => [props.content, theme.value], async () => {
  await renderContent()
}, { immediate: true })
</script>

<style scoped>
.markdown-viewer {
  height: 100%;
  overflow: auto;
}

.markdown-body {
  padding: 2rem;
  max-width: 900px;
  margin: 0 auto;
}
</style>

<style>
/* Custom overrides for github-markdown-css */

/* Smooth scroll for anchor links */
.markdown-body :is(h1, h2, h3, h4, h5, h6) {
  scroll-margin-top: 80px;
}

/* Dark mode support - github-markdown-css already handles this via color-scheme */
[data-theme='dark'] .markdown-body {
  color-scheme: dark;
  /* Override to match our dark theme colors - GitHub dark dimmed theme */
  --color-canvas-default: #0d1117;
  --color-canvas-subtle: #161b22;
  --color-canvas-inset: #010409;
  --color-border-default: #30363d;
  --color-border-muted: #21262d;
  --color-neutral-muted: rgba(110, 118, 129, 0.4);
  --color-accent-fg: #58a6ff;
  --color-accent-emphasis: #1f6feb;
  --color-fg-default: #c9d1d9;
  --color-fg-muted: #8b949e;
  --color-fg-subtle: #6e7681;
  --color-fg-on-emphasis: #ffffff;
  --color-danger-fg: #f85149;
  --color-success-fg: #3fb950;
  --color-attention-fg: #d29922;
  --color-done-fg: #a371f7;
  --color-sponsors-fg: #db61a2;
  --color-primer-shadow: 0 0 transparent;
  --color-scale-gray-7: #21262d;
  --color-scale-blue-8: #0c2d6b;
  /* Additional overrides for better dark mode */
  background-color: #0d1117 !important;
  color: #c9d1d9 !important;
}

/* Force dark mode for all markdown elements */
[data-theme='dark'] .markdown-body h1,
[data-theme='dark'] .markdown-body h2,
[data-theme='dark'] .markdown-body h3,
[data-theme='dark'] .markdown-body h4,
[data-theme='dark'] .markdown-body h5,
[data-theme='dark'] .markdown-body h6 {
  color: #c9d1d9 !important;
  border-bottom-color: #30363d !important;
}

[data-theme='dark'] .markdown-body p,
[data-theme='dark'] .markdown-body li,
[data-theme='dark'] .markdown-body td,
[data-theme='dark'] .markdown-body th {
  color: #c9d1d9 !important;
}

[data-theme='dark'] .markdown-body a {
  color: #58a6ff !important;
}

[data-theme='dark'] .markdown-body code {
  background-color: rgba(110, 118, 129, 0.4) !important;
  color: #c9d1d9 !important;
}

[data-theme='dark'] .markdown-body pre {
  background-color: #161b22 !important;
}

[data-theme='dark'] .markdown-body blockquote {
  color: #8b949e !important;
  border-left-color: #30363d !important;
}

[data-theme='dark'] .markdown-body table tr {
  background-color: #0d1117 !important;
  border-top-color: #30363d !important;
}

[data-theme='dark'] .markdown-body table th,
[data-theme='dark'] .markdown-body table td {
  border-color: #30363d !important;
}

[data-theme='dark'] .markdown-body table tr:nth-child(2n) {
  background-color: #161b22 !important;
}

[data-theme='dark'] .markdown-body hr {
  background-color: #30363d !important;
}

[data-theme='dark'] .markdown-body img {
  background-color: transparent !important;
}

[data-theme='dark'] .markdown-body .highlight pre,
[data-theme='dark'] .markdown-body pre {
  background-color: #161b22 !important;
}

/* Shiki code blocks in dark mode */
[data-theme='dark'] .markdown-body .shiki {
  background-color: #161b22 !important;
}

[data-theme='dark'] .markdown-body .shiki code {
  background-color: transparent !important;
  color: #c9d1d9 !important;
}

/* Ensure ALL code tokens don't have backgrounds in dark mode - be very specific */
[data-theme='dark'] .markdown-body .shiki span,
[data-theme='dark'] .markdown-body .shiki [class*="hljs-"],
[data-theme='dark'] .markdown-body pre span,
[data-theme='dark'] .markdown-body code span {
  background-color: transparent !important;
  background: none !important;
}

/* Override any inline background styles from Shiki */
[data-theme='dark'] .markdown-body pre [style*="background-color"],
[data-theme='dark'] .markdown-body pre [style*="background:"] {
  background-color: transparent !important;
  background: transparent !important;
}

/* Fix inline code in dark mode */
[data-theme='dark'] .markdown-body code:not(pre code) {
  background-color: rgba(110, 118, 129, 0.4) !important;
  color: #c9d1d9 !important;
}

/* Ensure pre/code blocks don't have selection-like background */
[data-theme='dark'] .markdown-body pre code {
  background-color: transparent !important;
  color: #c9d1d9 !important;
}

/* Additional fixes for code block appearance */
[data-theme='dark'] .markdown-body pre {
  background-color: #161b22 !important;
  border: 1px solid #30363d !important;
}

/* Ensure ALL children of pre don't have backgrounds */
[data-theme='dark'] .markdown-body pre * {
  background-color: transparent !important;
  background: transparent !important;
}

/* Zebra stripe for code blocks (must override pre * transparent) */
.markdown-body .code-block-wrapper pre .line:nth-child(even) {
  background-color: var(--bg-code-even) !important;
}

[data-theme='dark'] .markdown-body .code-block-wrapper pre .line:nth-child(even) {
  background-color: var(--bg-code-even) !important;
}

/* Code block wrapper with copy button */
.markdown-body .code-block-wrapper {
  position: relative;
  margin: 1rem 0;
  border: 1px solid var(--border-color, #d0d7de);
  border-radius: 6px;
  overflow: hidden;
}

[data-theme='dark'] .markdown-body .code-block-wrapper {
  border-color: #30363d;
}

.markdown-body .code-block-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--bg-secondary, #f6f8fa);
  border-bottom: 1px solid var(--border-color, #d0d7de);
  font-size: 12px;
}

[data-theme='dark'] .markdown-body .code-block-header {
  background: #161b22;
  border-color: #30363d;
}

.markdown-body .code-lang {
  font-weight: 600;
  color: var(--text-secondary, #656d76);
  text-transform: uppercase;
}

[data-theme='dark'] .markdown-body .code-lang {
  color: #848d97;
}

.markdown-body .code-copy-btn {
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary, #656d76);
  background: var(--bg-primary, #ffffff);
  border: 1px solid var(--border-color, #d0d7de);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

[data-theme='dark'] .markdown-body .code-copy-btn {
  color: #c9d1d9;
  background: #21262d;
  border-color: #30363d;
}

.markdown-body .code-copy-btn:hover {
  background: var(--bg-tertiary, #eaeef2);
  border-color: var(--border-hover, #afb8c1);
}

[data-theme='dark'] .markdown-body .code-copy-btn:hover {
  background: #30363d;
  border-color: #8b949e;
}

.markdown-body .code-copy-btn.copied {
  color: #1a7f37;
  border-color: #1a7f37;
  background: #dafbe1;
}

[data-theme='dark'] .markdown-body .code-copy-btn.copied {
  color: #3fb950;
  border-color: #3fb950;
  background: #0f2c1f;
}

.markdown-body .code-block-wrapper pre {
  margin: 0 !important;
  border-radius: 0 !important;
  border: none !important;
}

.markdown-body .code-block-wrapper .code-container {
  display: flex;
  background: var(--bg-code);
}

.markdown-body .code-block-wrapper .line-numbers {
  flex-shrink: 0;
  padding: var(--space-4) 0;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  text-align: right;
  user-select: none;
  font-family: var(--font-mono);
  font-size: var(--font-sm);
  line-height: 1.6;
}

.markdown-body .code-block-wrapper .line-number {
  display: block;
  padding: 0 var(--space-3);
  color: var(--text-tertiary);
  min-width: 3ch;
  height: 1.6em;
}

.markdown-body .code-block-wrapper .line {
  display: block;
}

[data-theme='dark'] .markdown-body .code-block-wrapper .line-numbers {
  background: #161b22;
  border-right-color: #30363d;
}

.markdown-body .code-block-wrapper .code-container pre {
  flex: 1;
  margin: 0;
  padding: var(--space-4);
  background: transparent !important;
  overflow-x: auto;
  font-family: var(--font-mono);
  font-size: var(--font-sm);
  line-height: 1.6;
}

.markdown-body .code-block-wrapper .code-container code {
  font-family: var(--font-mono);
  font-size: var(--font-sm);
  line-height: 1.6;
  display: flex;
  flex-direction: column;
}

/* === Front Matter Styles === */
.front-matter {
  margin: 1rem 0;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  overflow: hidden;
}

.front-matter-content {
  padding: var(--space-3) var(--space-4);
}

.front-matter-row {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  padding: 3px 0;
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.5;
}

.front-matter-row.multi-line {
  align-items: flex-start;
  flex-wrap: wrap;
}

.front-matter-key {
  color: var(--accent-color);
  font-weight: 500;
  flex-shrink: 0;
  /* Fixed width for alignment */
  width: 120px;
  min-width: 120px;
}

.front-matter-separator {
  color: var(--text-secondary);
  flex-shrink: 0;
}

.front-matter-value {
  color: var(--text-primary);
  flex: 1;
  word-break: break-word;
  /* Allow wrapping but start at same position */
  min-width: 0;
}

.front-matter-value.empty {
  color: var(--text-secondary);
  font-style: italic;
}

/* Tags display */
.front-matter-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  margin: 2px 4px 2px 0;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--text-secondary);
}

.front-matter-tag:hover {
  background: var(--bg-primary);
  border-color: var(--border-hover);
}

/* Multi-line values */
.front-matter-line {
  display: block;
  margin-bottom: 4px;
  line-height: 1.6;
}

.front-matter-line:last-child {
  margin-bottom: 0;
}

/* Dark mode adjustments for front matter */
[data-theme='dark'] .front-matter {
  background: var(--bg-secondary);
  border-color: #30363d;
}

[data-theme='dark'] .front-matter-key {
  color: #58a6ff;
}

[data-theme='dark'] .front-matter-tag {
  background: #21262d;
  border-color: #30363d;
  color: #8b949e;
}

[data-theme='dark'] .front-matter-tag:hover {
  background: #30363d;
  border-color: #484f58;
}
</style>
