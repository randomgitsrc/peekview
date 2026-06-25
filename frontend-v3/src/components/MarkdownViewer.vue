<template>
  <div class="markdown-viewer">
    <slot name="toc" :headings="headings" />
    <div ref="contentRef" class="markdown-body" v-html="renderedHtml" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, h, render as vueRender, onMounted, onBeforeUnmount } from 'vue'

import { useMarkdown, type MarkdownRenderResult } from '@/composables/useMarkdown'
import { useMermaid } from '@/composables/useMermaid'
import * as usePlantUML from '@/composables/usePlantUML'
import { useThemeStore } from '@/stores/theme'
import { storeToRefs } from 'pinia'
import type { TocHeading } from '@/types'
import MermaidDiagram from '@/components/diagrams/MermaidDiagram.vue'
import PlantUmlDiagram from '@/components/diagrams/PlantUmlDiagram.vue'
import SvgDiagram from '@/components/diagrams/SvgDiagram.vue'
import DOMPurify from 'dompurify'

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
let mermaidSourcesMap: Map<number, string> = new Map()
let plantumlSourcesMap: Map<number, string> = new Map()
let svgSourcesMap: Map<number, string> = new Map()
let renderToken = 0

const mermaidInstances = new Map<string, any>()
const plantumlInstances = new Map<string, any>()
const svgInstances = new Map<string, any>()


// Resize handling



onMounted(() => {
})

onBeforeUnmount(() => {
})

function handleToggleView(blockId: string | number, prefix: string) {
  const block = document.getElementById(String(blockId))
  if (!block) return
  const diagramMode = block.querySelector(`.${prefix}-content.diagram-mode`)
  const codeMode = block.querySelector(`.${prefix}-content.code-mode`)
  if (diagramMode && codeMode) {
    diagramMode.classList.toggle('is-active')
    codeMode.classList.toggle('is-active')
  }
}

function handleFullscreen(blockId: string | number, prefix: string) {
  const instances = prefix === 'mermaid' ? mermaidInstances : prefix === 'plantuml' ? plantumlInstances : svgInstances
  const inst = instances.get(String(blockId))
  inst?.toggleFullscreen?.()
}

function handleCopyCode(blockId: string | number, prefix: string) {
  const code = prefix === 'mermaid' ? mermaidSourcesMap.get(parseInt(String(blockId).split('-').pop() || '0')) :
               prefix === 'plantuml' ? plantumlSourcesMap.get(parseInt(String(blockId).split('-').pop() || '0')) :
               svgSourcesMap.get(parseInt(String(blockId).split('-').pop() || '0')) || ''
  if (code) navigator.clipboard.writeText(code).catch(() => {})
}

function handleDownloadPng(blockId: string | number, prefix: string) {
  if (prefix === 'svg') {
    const inst = svgInstances.get(String(blockId))
    inst?.downloadPng?.()
  }
}

function handleToggleMenu(_blockId: string | number, _prefix: string) {
  // menu 开关由 BaseDiagram 内部 menuOpen 控制
}

function handleStartResize(blockId: string | number, startY: number, _prefix: string) {
  const block = document.getElementById(String(blockId))
  if (!block) return
  const content = block.querySelector('.diagram-mode') as HTMLElement
  if (!content) return
  const startHeight = content.offsetHeight
  const onMove = (e: MouseEvent) => {
    const delta = e.clientY - startY
    content.style.height = Math.max(200, startHeight + delta) + 'px'
  }
  const onUp = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

async function renderContent() {
  const myToken = ++renderToken
  isLoading.value = true
  try {
    const themeName = theme.value === 'dark' ? 'github-dark' : 'github-light'
    const result: MarkdownRenderResult = await render(props.content, themeName)
    if (myToken !== renderToken) return
    headings.value = result.headings
    renderedHtml.value = result.html
    const sources = result.sources
    mermaidSourcesMap.clear()
    plantumlSourcesMap.clear()
    svgSourcesMap.clear()
    sources.forEach((val, idx) => {
      if (val.lang === 'mermaid') mermaidSourcesMap.set(idx, val.code)
      else if (val.lang === 'plantuml') plantumlSourcesMap.set(idx, val.code)
      else if (val.lang === 'svg') svgSourcesMap.set(idx, val.code)
    })
    emit('headings', result.headings)
    await nextTick()

    if (myToken !== renderToken) return

    if (contentRef.value) {
      const mountPoints = contentRef.value.querySelectorAll('.mermaid-viewer-mount')
      mountPoints.forEach(mp => {
        delete (mp as HTMLElement).dataset.rendered
      })
      const plantumlMountPoints = contentRef.value.querySelectorAll('.plantuml-viewer-mount')
      plantumlMountPoints.forEach(mp => {
        delete (mp as HTMLElement).dataset.rendered
      })
      const svgMountPoints = contentRef.value.querySelectorAll('.svg-viewer-mount')
      svgMountPoints.forEach(mp => {
        delete (mp as HTMLElement).dataset.rendered
      })
    }

    await renderMermaidDiagrams()
    if (myToken !== renderToken) return
    await renderPlantUmlDiagrams(myToken)
    if (myToken !== renderToken) return
    await renderSvgBlocks(myToken)
  } catch (err) {
    if (myToken === renderToken) console.error('Markdown render failed:', err)
  } finally {
    if (myToken === renderToken) isLoading.value = false
  }
}

async function renderMermaidDiagrams() {
  if (!contentRef.value) return

  // Find new mermaid blocks that need rendering
  const blocks = contentRef.value.querySelectorAll('.mermaid-block')

  for (const block of blocks) {
    const mountPoint = block.querySelector('.mermaid-viewer-mount')
    if (!mountPoint || (mountPoint as HTMLElement).dataset.rendered === 'true') continue

    const index = parseInt(block.getAttribute('data-index') || '0')
    const code = mermaidSourcesMap.get(index) || ''
    if (!code) continue
    const cacheKey = `${theme.value}-${code}`

    try {
      let svg: string
      if (mermaidCache.has(cacheKey)) {
        svg = mermaidCache.get(cacheKey)!
      } else {
        svg = await renderMermaid(String(index), code, theme.value)
        mermaidCache.set(cacheKey, svg)
      }

      // Mark as rendered to avoid re-rendering
      ;(mountPoint as HTMLElement).dataset.rendered = 'true'

      // Mount MermaidDiagram component
      const vNode = h(MermaidDiagram, {
        blockIndex: index,
        blockId: `mermaid-block-${index}`,
        svgContent: svg,
        codeViewHtml: '',
        theme: theme.value === 'dark' ? 'dark' : 'light',
        onToggleView: (blockId: string | number) => handleToggleView(blockId, 'mermaid'),
        onFullscreen: (blockId: string | number) => handleFullscreen(blockId, 'mermaid'),
        onCopyCode: (blockId: string | number) => handleCopyCode(blockId, 'mermaid'),
        onDownloadPng: (blockId: string | number) => handleDownloadPng(blockId, 'mermaid'),
        onToggleMenu: (blockId: string | number) => handleToggleMenu(blockId, 'mermaid'),
        onStartResize: (blockId: string | number, startY: number) => handleStartResize(blockId, startY, 'mermaid'),
      })
      vueRender(vNode, mountPoint)

      // Store instance reference for external access (fullscreen, etc)
      const inst = (vNode as any).component?.exposed ?? (vNode as any).component?.proxy
      mermaidInstances.set(`mermaid-block-${index}`, inst)
    } catch (err) {
      console.error('Mermaid render failed:', err)
      mountPoint.innerHTML = '<div class="mermaid-error">Failed to render diagram</div>'
    }
  }
}

// PlantUML rendering — 串行硬约束：plantuml.js 用共享内部状态，并发调用静默覆盖。
// 不可改为并行。L1 引擎层 usePlantUML.render 内部有模块级 Promise 链队列保证串行。
async function renderPlantUmlDiagrams(myToken: number) {
  if (!contentRef.value) return
  if (plantumlSourcesMap.size === 0) return

  await usePlantUML.ensureLoaded()
  if (myToken !== renderToken) return

  const blocks = contentRef.value.querySelectorAll('.plantuml-block')

  for (const block of blocks) {
    if (myToken !== renderToken) return

    const mountPoint = block.querySelector('.plantuml-viewer-mount')
    if (!mountPoint || (mountPoint as HTMLElement).dataset.rendered === 'true') continue

    const index = parseInt(block.getAttribute('data-index') || '0')
    const code = plantumlSourcesMap.get(index) || ''
    if (!code) continue

    try {
      const svg = await usePlantUML.render(code, theme.value)
      if (myToken !== renderToken) return

      ;(mountPoint as HTMLElement).dataset.rendered = 'true'

      const vNode = h(PlantUmlDiagram, {
        blockIndex: index,
        blockId: `plantuml-block-${index}`,
        svgContent: svg,
        codeViewHtml: '',
        theme: theme.value === 'dark' ? 'dark' : 'light',
        onToggleView: (blockId: string | number) => handleToggleView(blockId, 'plantuml'),
        onFullscreen: (blockId: string | number) => handleFullscreen(blockId, 'plantuml'),
        onCopyCode: (blockId: string | number) => handleCopyCode(blockId, 'plantuml'),
        onDownloadPng: (blockId: string | number) => handleDownloadPng(blockId, 'plantuml'),
        onToggleMenu: (blockId: string | number) => handleToggleMenu(blockId, 'plantuml'),
        onStartResize: (blockId: string | number, startY: number) => handleStartResize(blockId, startY, 'plantuml'),
      })
      vueRender(vNode, mountPoint)

      const inst = (vNode as any).component?.exposed ?? (vNode as any).component?.proxy
      plantumlInstances.set(`plantuml-block-${index}`, inst)
    } catch (err) {
      console.error('PlantUML render failed:', err)
      const blockEl = block as HTMLElement
      const diagramMode = blockEl.querySelector('.plantuml-content.diagram-mode')
      const codeMode = blockEl.querySelector('.plantuml-content.code-mode')
      if (diagramMode && codeMode) {
        diagramMode.classList.remove('is-active')
        codeMode.classList.add('is-active')
      }
      ;(mountPoint as HTMLElement).dataset.rendered = 'true'
    }
  }
}

async function renderSvgBlocks(myToken: number) {
  if (!contentRef.value) return
  if (svgSourcesMap.size === 0) return

  const blocks = contentRef.value.querySelectorAll('.svg-block')

  for (const block of blocks) {
    if (myToken !== renderToken) return

    const mountPoint = block.querySelector('.svg-viewer-mount')
    if (!mountPoint || (mountPoint as HTMLElement).dataset.rendered === 'true') continue

    const index = parseInt(block.getAttribute('data-index') || '0')
    const code = svgSourcesMap.get(index) || ''
    if (!code) continue

    try {
      const cleanSvg = DOMPurify.sanitize(code, {
        ADD_ATTR: ['data-action', 'data-code', 'data-line', 'data-block-id', 'data-index', 'data-mode', 'target', 'rel'],
        ADD_TAGS: ['button'],
      })

      ;(mountPoint as HTMLElement).dataset.rendered = 'true'

      const vNode = h(SvgDiagram, {
        blockIndex: index,
        blockId: `svg-block-${index}`,
        svgContent: cleanSvg,
        codeViewHtml: '',
        theme: theme.value === 'dark' ? 'dark' : 'light',
        onToggleView: (blockId: string | number) => handleToggleView(blockId, 'svg'),
        onFullscreen: (blockId: string | number) => handleFullscreen(blockId, 'svg'),
        onCopyCode: (blockId: string | number) => handleCopyCode(blockId, 'svg'),
        onDownloadPng: (blockId: string | number) => handleDownloadPng(blockId, 'svg'),
        onToggleMenu: (blockId: string | number) => handleToggleMenu(blockId, 'svg'),
        onStartResize: (blockId: string | number, startY: number) => handleStartResize(blockId, startY, 'svg'),
      })
      vueRender(vNode, mountPoint)

      // Capture the mounted component instance to call its exposed
      // toggleFullscreen / downloadPng methods later.
      const inst = (vNode as any).component?.exposed ?? (vNode as any).component?.proxy
      svgInstances.set(`svg-block-${index}`, inst)
    } catch (err) {
      console.error('SVG render failed:', err)
      mountPoint.innerHTML = '<div class="svg-error">Failed to render SVG</div>'
    }
  }
}

// SVG toggle — toggle between diagram and code view
// Open SVG fullscreen via the mounted SvgDiagram instance
// Toggle SVG dropdown menu
// Copy the raw SVG source code
// Download SVG as PNG via the mounted SvgDiagram instance's downloadPng method
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

/* === Mermaid Block Styles (Refactored v2) === */
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

/* Toggle button */
.mermaid-view-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s;
}

.mermaid-view-toggle:hover {
  background: var(--bg-secondary);
  border-color: var(--border-hover);
}

.mermaid-view-toggle .toggle-icon {
  font-size: 14px;
}

.mermaid-view-toggle.code-active {
  color: var(--accent-color);
  border-color: var(--accent-color);
  background: rgba(var(--accent-rgb), 0.1);
}

/* Action buttons */
.mermaid-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  font-size: 14px;
  color: var(--text-secondary);
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s;
}

.mermaid-action-btn:hover {
  background: var(--bg-secondary);
  border-color: var(--border-hover);
  color: var(--text-primary);
}

/* Dropdown menu */
.mermaid-dropdown {
  position: relative;
}

.mermaid-dropdown-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  min-width: 140px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 100;
  display: none;
  overflow: hidden;
}

.mermaid-dropdown-menu.show {
  display: block;
}

.mermaid-dropdown-menu button {
  display: block;
  width: 100%;
  padding: 8px 12px;
  text-align: left;
  font-size: 13px;
  color: var(--text-primary);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 0.2s;
}

.mermaid-dropdown-menu button:hover {
  background: var(--bg-secondary);
}

/* Content areas */
.mermaid-content {
  position: relative;
  min-height: 300px;
  height: auto;
  width: 100%;
  /* Remove aspect-ratio to allow free resizing */
}

.mermaid-content.diagram-mode {
  background: var(--bg-secondary);
  overflow: hidden;
  min-height: 300px;
  height: 400px; /* Default height for initial render */
  width: 100%;
}

.mermaid-content.code-mode {
  background: var(--bg-secondary);
  min-height: 100px;
  aspect-ratio: auto;
}

/* Toggle visibility using is-active class */
.mermaid-content.diagram-mode:not(.is-active),
.mermaid-content.code-mode:not(.is-active) {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
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
  position: relative;
}

.mermaid-viewer-mount :deep(svg) {
  max-width: 100%;
  max-height: 100%;
}

/* Resize handle */
.mermaid-resize-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 20px;
  height: 20px;
  cursor: se-resize;
  background: linear-gradient(
    -45deg,
    transparent 40%,
    var(--border-color) 40%,
    var(--border-color) 45%,
    transparent 45%,
    transparent 50%,
    var(--border-color) 50%,
    var(--border-color) 55%,
    transparent 55%
  );
  z-index: 100;
  opacity: 0.6;
  transition: opacity 0.2s;
  /* Ensure handle stays at corner during resize */
  pointer-events: auto;
}

.mermaid-content.resizing {
  /* Ensure proper positioning during resize */
  position: relative !important;
}

.mermaid-content.resizing .mermaid-resize-handle {
  opacity: 1;
  /* Force handle to stay at bottom-right during resize */
  position: absolute !important;
  bottom: 0 !important;
  right: 0 !important;
}

/* Fullscreen trigger (hidden) */
.mermaid-fullscreen-trigger {
  display: none;
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

/* === PlantUML Block Styles (mirror mermaid) === */
.plantuml-block {
  margin: 1rem 0;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-secondary);
}

.plantuml-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
}

.plantuml-label {
  font-weight: 600;
  font-size: 12px;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.plantuml-header-actions {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.plantuml-view-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s;
}

.plantuml-view-toggle:hover {
  background: var(--bg-secondary);
  border-color: var(--border-hover);
}

.plantuml-view-toggle .toggle-icon {
  font-size: 14px;
}

.plantuml-view-toggle.code-active {
  color: var(--accent-color);
  border-color: var(--accent-color);
  background: rgba(var(--accent-rgb), 0.1);
}

.plantuml-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  font-size: 14px;
  color: var(--text-secondary);
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s;
}

.plantuml-action-btn:hover {
  background: var(--bg-secondary);
  border-color: var(--border-hover);
  color: var(--text-primary);
}

.plantuml-dropdown {
  position: relative;
}

.plantuml-dropdown-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  min-width: 140px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 100;
  display: none;
  overflow: hidden;
}

.plantuml-dropdown-menu.show {
  display: block;
}

.plantuml-dropdown-menu button {
  display: block;
  width: 100%;
  padding: 8px 12px;
  text-align: left;
  font-size: 13px;
  color: var(--text-primary);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 0.2s;
}

.plantuml-dropdown-menu button:hover {
  background: var(--bg-secondary);
}

.plantuml-content {
  position: relative;
  min-height: 300px;
  height: auto;
  width: 100%;
}

.plantuml-content.diagram-mode {
  background: var(--bg-secondary);
  overflow: hidden;
  min-height: 300px;
  height: 400px;
  width: 100%;
}

.plantuml-content.code-mode {
  background: var(--bg-secondary);
  min-height: 100px;
  aspect-ratio: auto;
}

.plantuml-content.diagram-mode:not(.is-active),
.plantuml-content.code-mode:not(.is-active) {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.plantuml-content.code-mode pre {
  margin: 0;
  padding: var(--space-3);
  overflow-x: auto;
  background: var(--bg-secondary) !important;
}

.plantuml-viewer-mount {
  width: 100%;
  height: 100%;
  position: relative;
}

.plantuml-viewer-mount :deep(svg) {
  max-width: 100%;
  max-height: 100%;
}

.plantuml-fullscreen-trigger {
  display: none;
}

.plantuml-error {
  padding: 1rem;
  background: #ffeaea;
  border: 1px solid #ff6b6b;
  border-radius: 6px;
  color: #c92a2a;
  text-align: center;
}

[data-theme='dark'] .plantuml-error {
  background: #3d1f1f;
  border-color: #ff6b6b;
  color: #ff8787;
}

/* === SVG Block Styles (mirror mermaid) === */
.svg-block {
  margin: 1rem 0;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-secondary);
}

.svg-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
}

.svg-label {
  font-weight: 600;
  font-size: 12px;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.svg-header-actions {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

/* Toggle button */
.svg-view-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s;
}

.svg-view-toggle:hover {
  background: var(--bg-secondary);
  border-color: var(--border-hover);
}

.svg-view-toggle .toggle-icon {
  font-size: 14px;
}

.svg-view-toggle.code-active {
  color: var(--accent-color);
  border-color: var(--accent-color);
  background: rgba(var(--accent-rgb), 0.1);
}

/* Action buttons */
.svg-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  font-size: 14px;
  color: var(--text-secondary);
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s;
}

.svg-action-btn:hover {
  background: var(--bg-secondary);
  border-color: var(--border-hover);
  color: var(--text-primary);
}

/* Dropdown menu */
.svg-dropdown {
  position: relative;
}

.svg-dropdown-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  min-width: 140px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 100;
  display: none;
  overflow: hidden;
}

.svg-dropdown-menu.show {
  display: block;
}

.svg-dropdown-menu button {
  display: block;
  width: 100%;
  padding: 8px 12px;
  text-align: left;
  font-size: 13px;
  color: var(--text-primary);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 0.2s;
}

.svg-dropdown-menu button:hover {
  background: var(--bg-secondary);
}

/* Content areas */
.svg-content {
  position: relative;
  min-height: 300px;
  height: auto;
  width: 100%;
}

.svg-content.diagram-mode {
  background: var(--bg-secondary);
  overflow: hidden;
  min-height: 300px;
  height: 400px;
  width: 100%;
}

.svg-content.code-mode {
  background: var(--bg-secondary);
  min-height: 100px;
  aspect-ratio: auto;
}

/* Toggle visibility using is-active class */
.svg-content.diagram-mode:not(.is-active),
.svg-content.code-mode:not(.is-active) {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.svg-content.code-mode pre {
  margin: 0;
  padding: var(--space-3);
  overflow-x: auto;
  background: var(--bg-secondary) !important;
}

.svg-viewer-mount {
  width: 100%;
  height: 100%;
  position: relative;
}

.svg-viewer-mount :deep(svg) {
  max-width: 100%;
  max-height: 100%;
}

/* Resize handle */
.svg-resize-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 20px;
  height: 20px;
  cursor: se-resize;
  background: linear-gradient(
    -45deg,
    transparent 40%,
    var(--border-color) 40%,
    var(--border-color) 45%,
    transparent 45%,
    transparent 50%,
    var(--border-color) 50%,
    var(--border-color) 55%,
    transparent 55%
  );
  z-index: 100;
  opacity: 0.6;
  transition: opacity 0.2s;
  pointer-events: auto;
}

.svg-content.resizing {
  position: relative !important;
}

.svg-content.resizing .svg-resize-handle {
  opacity: 1;
  position: absolute !important;
  bottom: 0 !important;
  right: 0 !important;
}

/* Fullscreen trigger (hidden) */
.svg-fullscreen-trigger {
  display: none;
}

/* SVG error state */
.svg-error {
  padding: 1rem;
  background: #ffeaea;
  border: 1px solid #ff6b6b;
  border-radius: 6px;
  color: #c92a2a;
  text-align: center;
}

[data-theme='dark'] .svg-error {
  background: #3d1f1f;
  border-color: #ff6b6b;
  color: #ff8787;
}

@media (max-width: 768px) {
  .svg-header {
    padding: 6px 10px;
  }

  .svg-view-toggle .toggle-text {
    display: none;
  }
}

@media (max-width: 768px) {
  .svg-view-toggle {
    padding: 4px 8px;
  }
}

@media (max-width: 768px) {
  .plantuml-header {
    padding: 6px 10px;
  }

  .plantuml-view-toggle .toggle-text {
    display: none;
  }
}

/* Mobile adjustments */
@media (max-width: 768px) {
  .mermaid-header {
    padding: 6px 10px;
  }

  .mermaid-view-toggle .toggle-text {
    display: none; /* Only show icon on mobile */
  }

  .mermaid-view-toggle {
    padding: 4px 8px;
  }

  .mermaid-action-btn {
    width: 26px;
    height: 26px;
    font-size: 12px;
  }

  .mermaid-content {
    min-height: 150px;
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
