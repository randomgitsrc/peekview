<template>
  <div class="markdown-viewer">
    <slot name="toc" :headings="headings" />
    <div ref="contentRef" class="markdown-body" v-html="renderedHtml" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, h, render as vueRender } from 'vue'
import { useMarkdown } from '@/composables/useMarkdown'
import { useMermaid } from '@/composables/useMermaid'
import { useThemeStore } from '@/stores/theme'
import { storeToRefs } from 'pinia'
import type { TocHeading } from '@/types'
import MermaidDiagram from '@/components/MermaidDiagram.vue'

const props = defineProps<{ content: string }>()
const emit = defineEmits<{ headings: [headings: TocHeading[]] }>()

const { render } = useMarkdown()
const { render: renderMermaid } = useMermaid()
const themeStore = useThemeStore()
const { theme } = storeToRefs(themeStore)

const contentRef = ref<HTMLElement>()
const headings = ref<TocHeading[]>([])
const renderedHtml = ref('')
const isLoading = ref(false)
const mermaidCache = new Map<string, string>()

// Global copy function for code blocks
;(window as any).copyCodeBlock = async (btn: HTMLButtonElement) => {
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

// Global download function for mermaid PNG
;(window as any).downloadMermaidPng = async (blockId: string) => {
  const block = document.getElementById(blockId)
  if (!block) return

  const mountPoint = block.querySelector('.mermaid-viewer-mount')
  if (!mountPoint) return

  // Find the MermaidDiagram component instance and trigger download
  const svg = mountPoint.querySelector('svg')
  if (!svg) {
    console.error('No SVG found in mermaid block')
    return
  }

  try {
    // Clone SVG and get computed styles
    const clonedSvg = svg.cloneNode(true) as SVGElement

    // Ensure SVG has proper namespace
    if (!clonedSvg.getAttribute('xmlns')) {
      clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    }

    // Get computed background color
    const computedStyle = getComputedStyle(svg)
    const bgColor = computedStyle.backgroundColor || '#ffffff'

    // Serialize SVG
    const serializer = new XMLSerializer()
    const svgString = serializer.serializeToString(clonedSvg)

    // Create blob and URL
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)

    try {
      // Load into image
      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = reject
        img.src = url
      })

      // Get SVG dimensions
      const rect = svg.getBoundingClientRect()
      const width = Math.max(rect.width, 100)
      const height = Math.max(rect.height, 100)

      // Create canvas with high DPI
      const scale = 2
      const canvas = document.createElement('canvas')
      canvas.width = width * scale
      canvas.height = height * scale

      const ctx = canvas.getContext('2d')!

      // Fill background
      ctx.fillStyle = bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent' ? '#ffffff' : bgColor
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Draw image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      // Export PNG
      canvas.toBlob((pngBlob) => {
        if (pngBlob) {
          const pngUrl = URL.createObjectURL(pngBlob)
          const a = document.createElement('a')
          a.href = pngUrl
          a.download = `mermaid-diagram-${blockId.replace('mermaid-block-', '')}.png`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(pngUrl)
        }
      }, 'image/png')
    } finally {
      URL.revokeObjectURL(url)
    }
  } catch (err) {
    console.error('Failed to export PNG:', err)
    alert('Failed to download PNG. Please try again.')
  }
}

// Global toggle function for mermaid view
;(window as any).toggleMermaidView = (blockId: string, view: 'diagram' | 'code') => {
  const block = document.getElementById(blockId)
  if (!block) return

  const diagramMode = block.querySelector('.mermaid-content[data-mode="diagram"]') as HTMLElement
  const codeMode = block.querySelector('.mermaid-content[data-mode="code"]') as HTMLElement
  const diagramBtn = block.querySelector('.diagram-btn') as HTMLElement
  const codeBtn = block.querySelector('.code-btn') as HTMLElement

  if (view === 'diagram') {
    if (diagramMode) diagramMode.style.display = ''
    if (codeMode) codeMode.style.display = 'none'
    if (diagramBtn) diagramBtn.classList.add('active')
    if (codeBtn) codeBtn.classList.remove('active')
  } else {
    if (diagramMode) diagramMode.style.display = 'none'
    if (codeMode) codeMode.style.display = ''
    if (diagramBtn) diagramBtn.classList.remove('active')
    if (codeBtn) codeBtn.classList.add('active')
  }
}

// Async render markdown with syntax highlighting
async function renderContent() {
  isLoading.value = true
  try {
    const themeName = theme.value === 'dark' ? 'github-dark' : 'github-light'
    const result = await render(props.content, themeName)
    headings.value = result.headings
    renderedHtml.value = result.html
    emit('headings', result.headings)
    await nextTick()
    await renderMermaidDiagrams()
  } catch (err) {
    console.error('Markdown render failed:', err)
  } finally {
    isLoading.value = false
  }
}

async function renderMermaidDiagrams() {
  if (!contentRef.value) return

  // Find new mermaid blocks that need rendering
  const blocks = contentRef.value.querySelectorAll('.mermaid-block')

  for (const block of blocks) {
    const mountPoint = block.querySelector('.mermaid-viewer-mount')
    if (!mountPoint || (mountPoint as HTMLElement).dataset.rendered === 'true') continue

    const code = block.getAttribute('data-mermaid-code') || ''
    if (!code) continue

    const index = block.getAttribute('data-index') || '0'
    const cacheKey = `${theme.value}-${code}`

    try {
      let svg: string
      if (mermaidCache.has(cacheKey)) {
        svg = mermaidCache.get(cacheKey)!
      } else {
        svg = await renderMermaid(index, code, theme.value)
        mermaidCache.set(cacheKey, svg)
      }

      // Mark as rendered to avoid re-rendering
      ;(mountPoint as HTMLElement).dataset.rendered = 'true'

      // Mount MermaidDiagram component
      const vNode = h(MermaidDiagram, {
        svgContent: svg,
        id: `mermaid-${index}`,
      })
      vueRender(vNode, mountPoint)
    } catch (err) {
      console.error('Mermaid render failed:', err)
      mountPoint.innerHTML = '<div class="mermaid-error">Failed to render diagram</div>'
    }
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

/* Mermaid actions container */
.mermaid-actions {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

/* Code toggle button styling */
.code-toggle-btn {
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s;
}

.code-toggle-btn:hover {
  background: var(--bg-tertiary);
  border-color: var(--border-hover);
}

.code-toggle-btn.active {
  color: var(--accent-color);
  border-color: var(--accent-color);
  background: rgba(var(--accent-rgb), 0.1);
}

/* Mermaid view containers */
.mermaid-view {
  position: relative;
}

.diagram-view {
  min-height: 100px;
  padding: var(--space-3);
  background: var(--bg-secondary);
}

.code-view {
  background: var(--bg-secondary);
}

.code-view pre {
  margin: 0;
  padding: var(--space-3);
  overflow-x: auto;
  background: var(--bg-secondary) !important;
}

.code-view code {
  font-family: var(--font-mono);
  font-size: var(--font-sm);
  line-height: 1.5;
  color: var(--text-primary);
}

/* === Mermaid Block Styles (Refactored) === */
.mermaid-block {
  margin: 1rem 0;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-secondary);
}

.mermaid-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
}

.mermaid-label {
  font-weight: 600;
  font-size: 12px;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.mermaid-header-actions {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.mermaid-toggle-btn {
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s;
}

.mermaid-toggle-btn:hover {
  background: var(--bg-tertiary);
  border-color: var(--border-hover);
}

.mermaid-toggle-btn.active {
  color: var(--accent-color);
  border-color: var(--accent-color);
  background: rgba(var(--accent-rgb), 0.1);
}

.mermaid-download-btn,
.mermaid-copy-btn {
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s;
}

.mermaid-download-btn:hover,
.mermaid-copy-btn:hover {
  background: var(--bg-tertiary);
  border-color: var(--border-hover);
}

.mermaid-download-btn.copied,
.mermaid-copy-btn.copied {
  color: var(--success-color);
  border-color: var(--success-color);
  background: var(--success-bg);
}

.mermaid-content {
  position: relative;
  min-height: 100px;
  max-height: 600px;
}

.mermaid-content.diagram-mode {
  background: var(--bg-secondary);
}

.mermaid-content.code-mode {
  background: var(--bg-secondary);
}

.mermaid-content.code-mode pre {
  margin: 0;
  padding: var(--space-3);
  overflow-x: auto;
  background: var(--bg-secondary) !important;
}

.mermaid-viewer-mount {
  width: 100%;
  height: 100%;
  min-height: 150px;
}

/* Floating toolbar for desktop hover */
.mermaid-block:hover .mermaid-floating-toolbar {
  opacity: 1;
  visibility: visible;
}

.mermaid-floating-toolbar {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
  padding: 4px;
  background: rgba(0, 0, 0, 0.8);
  border-radius: var(--radius-sm);
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s, visibility 0.2s;
  z-index: 10;
}

.mermaid-floating-toolbar button {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: var(--radius-sm);
  color: white;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.mermaid-floating-toolbar button:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* Mermaid error state */
.mermaid-error {
  padding: 1rem;
  background: #ffeaea;
  border: 1px solid #ff6b6b;
  border-radius: 6px;
  color: #c92a2a;
  text-align: center;
}

[data-theme='dark'] .mermaid-error {
  background: #3d1f1f;
  border-color: #ff6b6b;
  color: #ff8787;
}

/* Mobile: always show toolbar in header */
@media (max-width: 768px) {
  .mermaid-header-actions {
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .mermaid-toggle-btn,
  .mermaid-download-btn,
  .mermaid-copy-btn {
    padding: 6px 10px;
    min-height: 32px;
  }

  .mermaid-content {
    max-height: 400px;
  }
}

/* Legacy mermaid styles (for backward compatibility) */
.mermaid-actions {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.code-toggle-btn {
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s;
}

.code-toggle-btn:hover {
  background: var(--bg-tertiary);
  border-color: var(--border-hover);
}

.code-toggle-btn.active {
  color: var(--accent-color);
  border-color: var(--accent-color);
  background: rgba(var(--accent-rgb), 0.1);
}

.mermaid-view {
  position: relative;
}

.diagram-view {
  min-height: 100px;
  padding: var(--space-3);
  background: var(--bg-secondary);
}

.code-view {
  background: var(--bg-secondary);
}

.code-view pre {
  margin: 0;
  padding: var(--space-3);
  overflow-x: auto;
  background: var(--bg-secondary) !important;
}

.code-view code {
  font-family: var(--font-mono);
  font-size: var(--font-sm);
  line-height: 1.5;
  color: var(--text-primary);
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
</style>
