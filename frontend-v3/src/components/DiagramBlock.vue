<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue"
import MermaidRenderer from "@/components/renderers/MermaidRenderer.vue"
import PlantUmlRenderer from "@/components/renderers/PlantUmlRenderer.vue"
import SvgRenderer from "@/components/renderers/SvgRenderer.vue"
import type { DiagramBlockData } from "@/types"

const props = defineProps<{
  block: DiagramBlockData
  theme: "dark" | "light"
}>()

const isCodeMode = ref(false)
const isMenuOpen = ref(false)
const hasError = ref(false) // Spec #66
const copyButtonText = ref("⧉ Copy Code") // Spec #59-60
const copyTimeout = ref<number>()
const rendererRef = ref()
const dropdownRef = ref<HTMLElement>()

const toggleText = computed(() => {
  return isCodeMode.value ? "Code" : "Diagram"
})

function toggleView() {
  isCodeMode.value = !isCodeMode.value
  // Note: do NOT call renderer.refresh() here. svg-pan-zoom caches internal
  // viewport <g> state and gets corrupted when re-initialized on the same
  // SVG (returns the stale broken instance from its instancesStore). The
  // first init already fits the diagram to the container; toggle just
  // flips v-show and the browser handles visibility.
}

// Fullscreen (spec §5.3 #18)
function openFullscreen() {
  rendererRef.value?.openFullscreen?.()
}

// Dropdown menu (spec §5.4 #25-31)
function toggleMenu() {
  if (props.block.lang !== "plantuml") {
    // Close other open menus (close-others for mermaid/svg)
    // Only close menus that are NOT inside this component's dropdown
    document.querySelectorAll(".diagram-dropdown-menu.show").forEach((el) => {
      if (!dropdownRef.value?.contains(el)) {
        el.classList.remove("show")
      }
    })
  }
  isMenuOpen.value = !isMenuOpen.value
}

function closeMenu() {
  isMenuOpen.value = false
}

// Download PNG (delegate to renderer)
function handleDownloadPng() {
  rendererRef.value?.downloadPng?.()
  closeMenu()
}

// Copy code (spec §5.8 #59-60)
async function handleCopyCode() {
  try {
    await navigator.clipboard.writeText(props.block.code)

    if (props.block.lang !== "plantuml") {
      // Mermaid/SVG: show "Copied!" for 2 seconds
      copyButtonText.value = "✓ Copied!"
      if (copyTimeout.value) clearTimeout(copyTimeout.value)
      copyTimeout.value = window.setTimeout(() => {
        copyButtonText.value = "⧉ Copy Code"
      }, 2000)
    } else {
      // PlantUML: console.log only, no visual feedback
      console.log("PlantUML code copied")
    }
  } catch (err) {
    console.error("Failed to copy code:", err)
  }

  closeMenu()
}

// Click-outside for mermaid/svg (spec #30)
function handleClickOutside(event: MouseEvent) {
  if (props.block.lang === "plantuml") return
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    isMenuOpen.value = false
  }
}

onMounted(() => {
  if (props.block.lang !== "plantuml") {
    document.addEventListener("click", handleClickOutside)
  }
})

onUnmounted(() => {
  if (props.block.lang !== "plantuml") {
    document.removeEventListener("click", handleClickOutside)
  }
  if (copyTimeout.value) clearTimeout(copyTimeout.value)
})

// Error handling (spec §5.12 #66)
function onRenderError() {
  if (props.block.lang === "plantuml") {
    // PlantUML: switch to code mode
    isCodeMode.value = true
  } else {
    // Mermaid/SVG: show error div
    hasError.value = true
  }
}

defineExpose({
  openFullscreen: () => rendererRef.value?.openFullscreen(),
})
</script>

<template>
  <div class="diagram-block" :data-type="block.lang" :data-index="block.index">
    <div class="diagram-header">
      <span class="diagram-label">{{ block.lang.toUpperCase() }}</span>
      <div class="diagram-header-actions">
        <button
          class="diagram-view-toggle"
          :class="{ 'code-active': isCodeMode }"
          @click="toggleView"
          title="Toggle Diagram/Code"
        >
          <span class="toggle-icon">◫</span>
          <span class="toggle-text">{{ toggleText }}</span>
        </button>
        <button class="diagram-action-btn fullscreen-btn" @click="openFullscreen" title="Fullscreen">⧉</button>
        <div class="diagram-dropdown" ref="dropdownRef">
          <button class="diagram-action-btn menu-btn" @click="toggleMenu" title="More actions">⋯</button>
          <div class="diagram-dropdown-menu" :class="{ show: isMenuOpen }">
            <button @click="handleDownloadPng">⬇ Download PNG</button>
            <button @click="handleCopyCode">{{ copyButtonText }}</button>
          </div>
        </div>
      </div>
    </div>
    <div class="diagram-viewer" v-show="!isCodeMode && !hasError">
      <MermaidRenderer
        v-if="block.lang === 'mermaid'"
        ref="rendererRef"
        :code="block.code"
        :theme="theme"
        @render-error="onRenderError"
      />
      <PlantUmlRenderer
        v-else-if="block.lang === 'plantuml'"
        ref="rendererRef"
        :code="block.code"
        :theme="theme"
        @render-error="onRenderError"
      />
      <SvgRenderer
        v-else-if="block.lang === 'svg'"
        ref="rendererRef"
        :code="block.code"
        :theme="theme"
        @render-error="onRenderError"
      />
      <!-- Resize handle: mermaid/svg only (spec #63) -->
      <div v-if="block.lang !== 'plantuml'" class="diagram-resize-handle"></div>
    </div>
    <div class="diagram-code" v-show="isCodeMode">
      <div v-html="block.codeViewHtml"></div>
    </div>
    <div v-if="hasError && block.lang !== 'plantuml'" class="diagram-error">
      Failed to render {{ block.lang === 'svg' ? 'SVG' : 'diagram' }}
    </div>
  </div>
</template>

<style>
/* === DiagramBlock Styles (Task 8 CSS Migration) === */
/* All rules use .diagram-block as root prefix for specificity (0,2,x) */

/* Block appearance (spec #1) */
.diagram-block {
  margin: 1rem 0;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-secondary);
}

/* Header (spec #2-5) */
.diagram-block .diagram-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
}

.diagram-block .diagram-label {
  font-weight: 600;
  font-size: 12px;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.diagram-block .diagram-header-actions {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

/* Toggle button (spec #12-17) */
.diagram-block .diagram-view-toggle {
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

.diagram-block .diagram-view-toggle:hover {
  background: var(--bg-secondary);
  border-color: var(--border-hover);
}

.diagram-block .diagram-view-toggle .toggle-icon {
  font-size: 14px;
}

.diagram-block .diagram-view-toggle.code-active {
  color: var(--accent-color);
  border-color: var(--accent-color);
  background: rgba(var(--accent-rgb), 0.1);
}

/* Action buttons (spec #18-24) */
.diagram-block .diagram-action-btn {
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

.diagram-block .diagram-action-btn:hover {
  background: var(--bg-secondary);
  border-color: var(--border-hover);
  color: var(--text-primary);
}

/* Dropdown (spec #25-31) */
.diagram-block .diagram-dropdown {
  position: relative;
}

.diagram-block .diagram-dropdown-menu {
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

.diagram-block .diagram-dropdown-menu.show {
  display: block;
}

.diagram-block .diagram-dropdown-menu button {
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

.diagram-block .diagram-dropdown-menu button:hover {
  background: var(--bg-secondary);
}

/* Viewer and Code areas (spec #6-10) */
.diagram-block .diagram-viewer {
  position: relative;
  background: var(--bg-secondary);
  overflow: hidden;
  min-height: 300px;
  height: 400px;
  width: 100%;
}

.diagram-block .diagram-code {
  background: var(--bg-secondary);
  min-height: 100px;
  width: 100%;
  aspect-ratio: auto;
}

.diagram-block .diagram-code .code-container {
  display: flex;
  background: var(--bg-code);
}

.diagram-block .diagram-code .line-numbers {
  flex-shrink: 0;
  padding: var(--space-3) 0;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  text-align: right;
  user-select: none;
  font-family: var(--font-mono);
  font-size: var(--font-sm);
  line-height: 1.6;
}

.diagram-block .diagram-code .line-number {
  display: block;
  padding: 0 var(--space-3);
  color: var(--text-tertiary);
  min-width: 3ch;
  height: 1.6em;
}

.diagram-block .diagram-code pre {
  flex: 1;
  margin: 0;
  padding: var(--space-3);
  background: transparent !important;
  overflow-x: auto;
  font-family: var(--font-mono);
  font-size: var(--font-sm);
  line-height: 1.6;
}

.diagram-block .diagram-code code {
  font-family: var(--font-mono);
  font-size: var(--font-sm);
  line-height: 1.6;
  display: flex;
  flex-direction: column;
}

.diagram-block .diagram-code .line {
  display: block;
  min-width: 100%;
  padding-right: var(--space-3);
  margin-right: calc(-1 * var(--space-3));
  height: 1.6em;
}

.diagram-block .diagram-code .line:nth-child(even) {
  background-color: var(--bg-code-even);
}


/* Resize handle (spec #63-65) */
.diagram-block .diagram-resize-handle {
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

.diagram-block .diagram-viewer.resizing {
  position: relative !important;
}

.diagram-block .diagram-viewer.resizing .diagram-resize-handle {
  opacity: 1;
  position: absolute !important;
  bottom: 0 !important;
  right: 0 !important;
}

/* Error state (spec #66) */
.diagram-block .diagram-error {
  padding: 1rem;
  background: #ffeaea;
  border: 1px solid #ff6b6b;
  border-radius: 6px;
  color: #c92a2a;
  text-align: center;
}

[data-theme='dark'] .diagram-block .diagram-error {
  background: #3d1f1f;
  border-color: #ff6b6b;
  color: #ff8787;
}

/* Mobile responsive (spec #71-74) */
@media (max-width: 768px) {
  .diagram-block .diagram-header {
    padding: 6px 10px;
  }

  .diagram-block .diagram-view-toggle .toggle-text {
    display: none;
  }

  .diagram-block[data-type="mermaid"] .diagram-view-toggle {
    padding: 4px 8px;
  }

  .diagram-block[data-type="mermaid"] .diagram-action-btn {
    width: 26px;
    height: 26px;
    font-size: 12px;
  }

  .diagram-block[data-type="mermaid"] .diagram-viewer {
    min-height: 150px;
  }
}
</style>
