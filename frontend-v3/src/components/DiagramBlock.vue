<script setup lang="ts">
import { ref, computed } from "vue"
import MermaidRenderer from "@/components/renderers/MermaidRenderer.vue"
import PlantUmlRenderer from "@/components/renderers/PlantUmlRenderer.vue"
import SvgRenderer from "@/components/renderers/SvgRenderer.vue"
import type { DiagramBlockData } from "@/types"

const props = defineProps<{
  block: DiagramBlockData
  theme: "dark" | "light"
}>()

const isCodeMode = ref(false)
const rendererRef = ref()

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
      </div>
    </div>
    <div class="diagram-viewer" v-show="!isCodeMode">
      <MermaidRenderer
        v-if="block.lang === 'mermaid'"
        ref="rendererRef"
        :code="block.code"
        :theme="theme"
      />
      <PlantUmlRenderer
        v-else-if="block.lang === 'plantuml'"
        ref="rendererRef"
        :code="block.code"
        :theme="theme"
      />
      <SvgRenderer
        v-else-if="block.lang === 'svg'"
        ref="rendererRef"
        :code="block.code"
        :theme="theme"
      />
    </div>
    <div class="diagram-code" v-show="isCodeMode">
      <div v-html="block.codeViewHtml"></div>
    </div>
  </div>
</template>
