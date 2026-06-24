<template>
  <div class="markdown-viewer">
    <slot name="toc" :headings="headings" />
    <div ref="contentRef" class="markdown-body" v-html="renderedHtml" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, h, render as vueRender, onMounted, onBeforeUnmount } from 'vue'
import mermaid from 'mermaid'
import { useMarkdown, type MarkdownRenderResult } from '@/composables/useMarkdown'
import { useMermaid } from '@/composables/useMermaid'
import * as usePlantUML from '@/composables/usePlantUML'
import { useThemeStore } from '@/stores/theme'
import { storeToRefs } from 'pinia'
import type { TocHeading } from '@/types'
import MermaidDiagram from '@/components/MermaidDiagram.vue'
import PlantUmlDiagram from '@/components/PlantUmlDiagram.vue'
import SvgDiagram from '@/components/SvgDiagram.vue'
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

async function copyMermaidCode(blockId: string) {
  const index = parseInt(blockId.replace('mermaid-block-', ''))
  const code = mermaidSourcesMap.get(index) || ''
  if (!code) return
  try {
    await navigator.clipboard.writeText(code)
    // Show feedback
    const menu = document.getElementById(`menu-${blockId}`)
    if (menu) {
      const btn = menu.querySelector('button:last-child')
      if (btn) {
        const original = btn.textContent
        btn.textContent = '✓ Copied!'
        setTimeout(() => {
          btn.textContent = original
        }, 2000)
      }
    }
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

// Global download function for mermaid PNG - re-renders mermaid code to clean SVG
async function downloadMermaidPng(blockId: string) {
  const block = document.getElementById(blockId)
  if (!block) return

  const index = parseInt(block.getAttribute('data-index') || '0')
  const code = mermaidSourcesMap.get(index) || ''
  if (!code) {
    console.error('No mermaid code found')
    return
  }

  try {
    // Re-render the mermaid code to get a clean SVG (no DOM transforms/foreignObject)
    const { svg } = await mermaid.render(`export-${blockId}`, code)

    // Parse the clean SVG
    // Fix: mermaid uses <br> but DOMParser requires XHTML <br/>
    const fixedSvg = svg.replace(/<br>/gi, '<br/>')
    const parser = new DOMParser()
    const svgDoc = parser.parseFromString(fixedSvg, 'image/svg+xml')
    const svgEl = svgDoc.documentElement as unknown as SVGElement

    // Check for parse errors
    const parseError = svgDoc.querySelector('parsererror')
    if (parseError) {
      console.error('SVG Parse Error:', parseError.textContent)
      console.error('SVG preview:', svg.substring(0, 500))
      throw new Error(`Failed to parse SVG: ${parseError.textContent?.substring(0, 100)}`)
    }

    // Get dimensions from viewBox (mermaid calculates this accurately including foreignObject content)
    // Just use viewBox width/height directly - mermaid already includes all content boundaries
    let width = 0, height = 0
    const viewBox = svgEl.getAttribute('viewBox')
    if (viewBox) {
      const parts = viewBox.split(/\s+/).map(parseFloat)
      if (parts.length >= 4) {
        // parts = [x, y, width, height], e.g., "-8 -8 142 284"
        // Use width/height directly, don't modify viewBox or add transforms
        width = Math.ceil(parts[2] + 20)  // Small padding
        height = Math.ceil(parts[3] + 20)
      }
    }

    // Fallback: try to get dimensions from g.root bbox
    // Note: getBBox() may not include foreignObject content accurately
    if (width === 0 || height === 0) {
      try {
        const tempDiv = document.createElement('div')
        tempDiv.style.cssText = 'position: absolute; left: -9999px; top: 0; visibility: hidden;'
        tempDiv.innerHTML = svg
        document.body.appendChild(tempDiv)
        const tempSvg = tempDiv.querySelector('svg')
        if (tempSvg) {
          const rootGroup = tempSvg.querySelector('g.root')
          if (rootGroup) {
            const bbox = (rootGroup as SVGGElement).getBBox()
            if (bbox && bbox.width > 0 && bbox.height > 0) {
              width = Math.ceil(bbox.width + 40)
              height = Math.ceil(bbox.height + 40)
            }
          }
        }
        document.body.removeChild(tempDiv)
      } catch (e) {
        console.error('Error getting bbox:', e)
      }
    }

    // Final fallback
    if (width === 0 || height === 0) {
      width = 800
      height = 600
    }

    // Ensure minimum size
    width = Math.max(width, 100)
    height = Math.max(height, 100)

    // Set dimensions
    svgEl.setAttribute('width', String(width))
    svgEl.setAttribute('height', String(height))
    svgEl.style.width = `${width}px`
    svgEl.style.height = `${height}px`
    svgEl.style.maxWidth = 'none'
    svgEl.style.maxHeight = 'none'

    // Ensure namespace
    if (!svgEl.getAttribute('xmlns')) {
      svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    }

    // Serialize to data URL
    const serializer = new XMLSerializer()
    const serialized = serializer.serializeToString(svgEl)
    const svgBase64 = btoa(unescape(encodeURIComponent(serialized)))
    const dataUrl = `data:image/svg+xml;base64,${svgBase64}`

    // Load and draw to canvas
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = reject
      img.src = dataUrl
    })

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')!

    // Fill white background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw SVG
    ctx.drawImage(img, 0, 0, width, height)

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
  } catch (err) {
    console.error('Failed to export PNG:', err)
    alert('Failed to download PNG. Please try again.')
  }
}

// Global toggle function for mermaid view - toggle mode
function toggleMermaidView(blockId: string) {
  const block = document.getElementById(blockId)
  if (!block) return

  const diagramMode = block.querySelector('.mermaid-content[data-mode="diagram"]') as HTMLElement
  const codeMode = block.querySelector('.mermaid-content[data-mode="code"]') as HTMLElement
  const toggleBtn = block.querySelector('.mermaid-view-toggle') as HTMLElement
  const toggleText = toggleBtn?.querySelector('.toggle-text') as HTMLElement

  if (!diagramMode || !codeMode) return

  const isCurrentlyCode = codeMode.classList.contains('is-active')

  if (isCurrentlyCode) {
    // Switch to diagram
    codeMode.classList.remove('is-active')
    diagramMode.classList.add('is-active')
    if (toggleText) toggleText.textContent = 'Diagram'
    toggleBtn?.classList.remove('code-active')

    // Trigger resize on the pan-zoom instance after display change
    const viewer = diagramMode.querySelector('.mermaid-viewer')
    if (viewer) {
      viewer.dispatchEvent(new CustomEvent('mermaid-refresh', { bubbles: true }))
    }
  } else {
    // Switch to code
    diagramMode.classList.remove('is-active')
    codeMode.classList.add('is-active')
    if (toggleText) toggleText.textContent = 'Code'
    toggleBtn?.classList.add('code-active')
  }
}

// Open mermaid fullscreen
function openMermaidFullscreen(blockId: string) {
  const instance = mermaidInstances.get(blockId)
  if (instance && instance.toggleFullscreen) {
    instance.toggleFullscreen()
  }
}

// Toggle mermaid dropdown menu
function toggleMermaidMenu(blockId: string) {
  const menu = document.getElementById(`menu-${blockId}`)
  if (!menu) return

  // Close other menus
  document.querySelectorAll('.mermaid-dropdown-menu').forEach((m) => {
    if (m.id !== `menu-${blockId}`) {
      m.classList.remove('show')
    }
  })

  menu.classList.toggle('show')

  // Close on click outside
  const closeMenu = (e: Event) => {
    if (!(e.target as Element).closest('.mermaid-dropdown')) {
      menu.classList.remove('show')
      document.removeEventListener('click', closeMenu)
    }
  }

  // Add listener next tick to avoid immediate close
  setTimeout(() => {
    document.addEventListener('click', closeMenu)
  }, 0)
}

// Resize handling
let resizingBlock: HTMLElement | null = null
let startY = 0
let startHeight = 0

function startResize(blockId: string, e: MouseEvent) {
  e.preventDefault()
  const block = document.getElementById(blockId)
  if (!block) return

  const content = block.querySelector('.mermaid-content[data-mode="diagram"]') as HTMLElement
  if (!content) return

  resizingBlock = content
  startY = e.clientY
  // Get current computed height
  const computedStyle = window.getComputedStyle(content)
  startHeight = parseInt(computedStyle.height) || 400

  document.addEventListener('mousemove', onResizeMove)
  document.addEventListener('mouseup', onResizeEnd)
  document.body.style.cursor = 'se-resize'
  content.classList.add('resizing')
}

function onResizeMove(e: MouseEvent) {
  if (!resizingBlock) return
  const delta = e.clientY - startY
  const newHeight = Math.max(200, startHeight + delta)
  resizingBlock.style.height = `${newHeight}px`
  // Remove maxHeight constraint during resize
  resizingBlock.style.maxHeight = 'none'
}

function onResizeEnd() {
  if (resizingBlock) {
    resizingBlock.classList.remove('resizing')
    resizingBlock = null
  }
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)
  document.body.style.cursor = ''
}

function handleDelegatedAction(e: MouseEvent) {
  const target = (e.target as Element).closest('[data-action]') as HTMLElement | null
  if (!target) return
  const action = target.dataset.action
  const blockId = target.dataset.blockId
  switch (action) {
    case 'toggle-mermaid-view': toggleMermaidView(blockId!); break
    case 'open-mermaid-fullscreen': openMermaidFullscreen(blockId!); break
    case 'toggle-mermaid-menu': toggleMermaidMenu(blockId!); break
    case 'download-mermaid-png': downloadMermaidPng(blockId!); break
    case 'copy-mermaid-code': copyMermaidCode(blockId!); break
    case 'toggle-plantuml-view': togglePlantUmlView(blockId!); break
    case 'open-plantuml-fullscreen': openPlantUmlFullscreen(blockId!); break
    case 'toggle-plantuml-menu': togglePlantUmlMenu(blockId!); break
    case 'download-plantuml-png': downloadPlantUmlPng(blockId!); break
    case 'copy-plantuml-code': copyPlantUmlCode(blockId!); break
    case 'toggle-svg-view': toggleSvgView(blockId!); break
    case 'open-svg-fullscreen': openSvgFullscreen(blockId!); break
    case 'toggle-svg-menu': toggleSvgMenu(blockId!); break
    case 'download-svg-png': downloadSvgPng(blockId!); break
    case 'copy-svg-code': copySvgCode(blockId!); break
    case 'copy-code-block': copyCodeBlock(target as HTMLButtonElement); break
  }
}

function handleDelegatedResize(e: MouseEvent) {
  const target = (e.target as Element).closest('[data-action="start-resize"]') as HTMLElement | null
  if (!target) return
  startResize(target.dataset.blockId!, e)
}

onMounted(() => {
  contentRef.value?.addEventListener('click', handleDelegatedAction)
  contentRef.value?.addEventListener('mousedown', handleDelegatedResize)
})

onBeforeUnmount(() => {
  contentRef.value?.removeEventListener('click', handleDelegatedAction)
  contentRef.value?.removeEventListener('mousedown', handleDelegatedResize)
})

async function renderContent() {
  const myToken = ++renderToken
  isLoading.value = true
  try {
    const themeName = theme.value === 'dark' ? 'github-dark' : 'github-light'
    const result: MarkdownRenderResult = await render(props.content, themeName)
    if (myToken !== renderToken) return
    headings.value = result.headings
    renderedHtml.value = result.html
    mermaidSourcesMap = result.mermaidSources
    plantumlSourcesMap = result.plantumlSources
    svgSourcesMap = result.svgSources
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
        svgContent: svg,
        id: `mermaid-${index}`,
      })
      vueRender(vNode, mountPoint)

      // Store instance reference for external access (fullscreen, etc)
      // Note: vueRender doesn't give us the instance directly, so we store the mount point
      // and use a data attribute to track it
      mermaidInstances.set(`mermaid-block-${index}`, {
        toggleFullscreen: () => {
          const btn = mountPoint.querySelector('.mermaid-fullscreen-trigger')
          if (btn) {
            (btn as HTMLElement).click()
          }
        }
      })
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
        svgContent: svg,
        id: `plantuml-${index}`,
      })
      vueRender(vNode, mountPoint)

      plantumlInstances.set(`plantuml-block-${index}`, {
        toggleFullscreen: () => {
          const btn = mountPoint.querySelector('.plantuml-fullscreen-trigger')
          if (btn) {
            (btn as HTMLElement).click()
          }
        }
      })
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
        svgContent: cleanSvg,
        id: `svg-${index}`,
      })
      vueRender(vNode, mountPoint)

      // Capture the mounted component instance to call its exposed
      // toggleFullscreen / downloadPng methods later.
      const inst = (vNode as any).component?.proxy
      svgInstances.set(`svg-block-${index}`, inst)
    } catch (err) {
      console.error('SVG render failed:', err)
      mountPoint.innerHTML = '<div class="svg-error">Failed to render SVG</div>'
    }
  }
}

function togglePlantUmlView(blockId: string) {
  const block = document.getElementById(blockId)
  if (!block) return
  const diagramMode = block.querySelector('.plantuml-content.diagram-mode')
  const codeMode = block.querySelector('.plantuml-content.code-mode')
  if (diagramMode && codeMode) {
    diagramMode.classList.toggle('is-active')
    codeMode.classList.toggle('is-active')
  }
}

function openPlantUmlFullscreen(blockId: string) {
  const instance = plantumlInstances.get(blockId)
  instance?.toggleFullscreen()
}

function togglePlantUmlMenu(blockId: string) {
  const menu = document.getElementById(`menu-${blockId}`)
  if (menu) {
    menu.classList.toggle('show')
  }
}

function copyPlantUmlCode(blockId: string) {
  const block = document.getElementById(blockId)
  if (!block) return
  const index = parseInt(block.getAttribute('data-index') || '0')
  const code = plantumlSourcesMap.get(index) || ''
  navigator.clipboard.writeText(code).then(() => {
    console.log('PlantUML code copied')
  }).catch(err => console.error('Copy failed:', err))
}

async function downloadPlantUmlPng(blockId: string) {
  const block = document.getElementById(blockId)
  if (!block) return
  const index = parseInt(block.getAttribute('data-index') || '0')
  const code = plantumlSourcesMap.get(index) || ''
  if (!code) return

  try {
    const svg = await usePlantUML.render(code, theme.value)

    const parser = new DOMParser()
    const svgDoc = parser.parseFromString(svg, 'image/svg+xml')
    const svgEl = svgDoc.documentElement as unknown as SVGElement

    let width = 0, height = 0
    const viewBox = svgEl.getAttribute('viewBox')
    if (viewBox) {
      const parts = viewBox.split(/\s+/).map(parseFloat)
      if (parts.length >= 4) {
        width = Math.ceil(parts[2] + 20)
        height = Math.ceil(parts[3] + 20)
      }
    }
    if (width === 0 || height === 0) {
      const w = svgEl.getAttribute('width')
      const h = svgEl.getAttribute('height')
      if (w) width = Math.ceil(parseFloat(w) + 20)
      if (h) height = Math.ceil(parseFloat(h) + 20)
    }
    if (width === 0 || height === 0) {
      width = 800
      height = 600
    }
    width = Math.max(width, 100)
    height = Math.max(height, 100)

    svgEl.setAttribute('width', String(width))
    svgEl.setAttribute('height', String(height))
    if (!svgEl.getAttribute('xmlns')) {
      svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    }

    const serializer = new XMLSerializer()
    const serialized = serializer.serializeToString(svgEl)
    const svgBase64 = btoa(unescape(encodeURIComponent(serialized)))
    const dataUrl = `data:image/svg+xml;base64,${svgBase64}`

    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = reject
      img.src = dataUrl
    })

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, width, height)

    canvas.toBlob((b) => {
      if (!b) return
      const url = URL.createObjectURL(b)
      const a = document.createElement('a')
      a.href = url
      a.download = `plantuml-diagram-${blockId}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }, 'image/png')
  } catch (err) {
    console.error('Failed to download PlantUML PNG:', err)
  }
}

// SVG toggle — toggle between diagram and code view
function toggleSvgView(blockId: string) {
  const root = contentRef.value
  if (!root) return
  const block = root.querySelector(`#${blockId}`) as HTMLElement | null
  if (!block) return

  const diagramMode = block.querySelector('.svg-content[data-mode="diagram"]') as HTMLElement
  const codeMode = block.querySelector('.svg-content[data-mode="code"]') as HTMLElement
  const toggleBtn = block.querySelector('.svg-view-toggle') as HTMLElement
  const toggleText = toggleBtn?.querySelector('.toggle-text') as HTMLElement

  if (!diagramMode || !codeMode) return

  const isCurrentlyCode = codeMode.classList.contains('is-active')

  if (isCurrentlyCode) {
    // Switch to diagram
    codeMode.classList.remove('is-active')
    diagramMode.classList.add('is-active')
    if (toggleText) toggleText.textContent = 'Diagram'
    toggleBtn?.classList.remove('code-active')

    // Trigger resize on the pan-zoom instance after display change
    const viewer = diagramMode.querySelector('.svg-viewer')
    if (viewer) {
      viewer.dispatchEvent(new CustomEvent('svg-refresh', { bubbles: true }))
    }
  } else {
    // Switch to code
    diagramMode.classList.remove('is-active')
    codeMode.classList.add('is-active')
    if (toggleText) toggleText.textContent = 'Code'
    toggleBtn?.classList.add('code-active')
  }
}

// Open SVG fullscreen via the mounted SvgDiagram instance
function openSvgFullscreen(blockId: string) {
  const instance = svgInstances.get(blockId)
  if (instance && instance.toggleFullscreen) {
    instance.toggleFullscreen()
  }
}

// Toggle SVG dropdown menu
function toggleSvgMenu(blockId: string) {
  const root = contentRef.value
  if (!root) return
  const menu = root.querySelector(`#menu-${blockId}`) as HTMLElement | null
  if (!menu) return

  // Close other menus
  root.querySelectorAll('.svg-dropdown-menu').forEach((m) => {
    if (m.id !== `menu-${blockId}`) {
      m.classList.remove('show')
    }
  })

  menu.classList.toggle('show')

  // Close on click outside
  const closeMenu = (e: Event) => {
    if (!(e.target as Element).closest('.svg-dropdown')) {
      menu.classList.remove('show')
      document.removeEventListener('click', closeMenu)
    }
  }

  // Add listener next tick to avoid immediate close
  setTimeout(() => {
    document.addEventListener('click', closeMenu)
  }, 0)
}

// Copy the raw SVG source code
async function copySvgCode(blockId: string) {
  const index = parseInt(blockId.replace('svg-block-', ''))
  const code = svgSourcesMap.get(index) || ''
  if (!code) return
  try {
    await navigator.clipboard.writeText(code)
    // Show feedback
    const root = contentRef.value
    const menu = root?.querySelector(`#menu-${blockId}`)
    if (menu) {
      const btn = menu.querySelector('button:last-child')
      if (btn) {
        const original = btn.textContent
        btn.textContent = '✓ Copied!'
        setTimeout(() => {
          btn.textContent = original
        }, 2000)
      }
    }
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

// Download SVG as PNG via the mounted SvgDiagram instance's downloadPng method
function downloadSvgPng(blockId: string) {
  const instance = svgInstances.get(blockId)
  if (instance && instance.downloadPng) {
    instance.downloadPng()
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
