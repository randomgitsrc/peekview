<template>
  <div class="code-viewer">
    <!-- Loading -->
    <div v-if="loading" class="code-loading">
      <div v-for="i in 8" :key="i" class="code-skeleton">
        <span class="skeleton-line-number"></span>
        <span class="skeleton-line-content"></span>
      </div>
    </div>

    <!-- Code content -->
    <div
      v-else
      ref="codeBodyRef"
      class="code-body"
      :class="{ 'wrap-enabled': wrap }"
      v-html="highlightedCode"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, nextTick } from 'vue'
import { useShiki } from '@/composables/useShiki'
import { useThemeStore } from '@/stores/theme'
import { storeToRefs } from 'pinia'

const props = defineProps<{
  content: string
  filename: string
  language: string | null
  wrap: boolean
  canWrap: boolean
  loading?: boolean
}>()

defineEmits<{
  'toggle-wrap': []
}>()

const { highlight } = useShiki()
const themeStore = useThemeStore()
const { theme } = storeToRefs(themeStore)

const highlightedCode = ref('')
const isHighlighting = ref(false)
const codeBodyRef = ref<HTMLElement | null>(null)

const language = computed(() => props.language || 'text')

// Sync line heights between line numbers and code lines
async function syncLineHeights() {
  if (!codeBodyRef.value) return

  await nextTick()

  const lineNumbers = codeBodyRef.value.querySelectorAll('.line-number')
  const lines = codeBodyRef.value.querySelectorAll('.line')

  // Reset all line number heights first
  lineNumbers.forEach((ln) => {
    (ln as HTMLElement).style.height = ''
  })

  // Sync heights when wrap is enabled
  if (props.wrap) {
    lines.forEach((line, index) => {
      const lineNum = lineNumbers[index]
      if (lineNum && line) {
        const lineHeight = line.getBoundingClientRect().height
        ;(lineNum as HTMLElement).style.height = `${lineHeight}px`
      }
    })
  }
}

// Watch for wrap changes to sync heights
watch(() => props.wrap, () => {
  syncLineHeights()
})

// Also sync after highlighting completes
watch(() => highlightedCode.value, () => {
  syncLineHeights()
})

async function doHighlight() {
  if (!props.content) {
    highlightedCode.value = ''
    return
  }

  isHighlighting.value = true
  try {
    highlightedCode.value = await highlight(
      props.content,
      language.value,
      theme.value === 'dark' ? 'github-dark' : 'github-light'
    )
  } catch (err) {
    console.error('Highlight error:', err)
    highlightedCode.value = `<pre><code>${escapeHtml(props.content)}</code></pre>`
  } finally {
    isHighlighting.value = false
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

watch(
  () => [props.content, language.value, theme.value],
  () => doHighlight(),
  { immediate: true }
)
</script>

<style scoped>
@import '@/styles/code.css';
</style>
