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
  if (props.block.lang === "plantuml") return "Diagram"
  return isCodeMode.value ? "Code" : "Diagram"
})

function toggleView() {
  isCodeMode.value = !isCodeMode.value
  if (!isCodeMode.value && props.block.lang !== "plantuml") {
    rendererRef.value?.refresh?.()
  }
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
        <button class="diagram-action-btn fullscreen-btn" title="Fullscreen">⧉</button>
        <div class="diagram-dropdown" ref="dropdownRef">
          <button class="diagram-action-btn menu-btn" @click="toggleMenu" title="More actions">⋯</button>
          <div class="diagram-dropdown-menu" :class="{ show: isMenuOpen }">
            <button @click="closeMenu">⬇ Download PNG</button>
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
