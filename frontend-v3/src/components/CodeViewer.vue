<template>
  <div class="code-viewer">
    <!-- Header -->
    <div class="code-header">
      <span class="filename">{{ filename }}</span>
      <span v-if="language" class="lang">{{ language }}</span>
      <div class="actions">
        <button class="btn btn-sm" @click="copyCode">Copy</button>
        <button
          v-if="canWrap"
          class="btn btn-sm"
          :class="{ active: wrap }"
          @click="$emit('toggle-wrap')"
        >
          Wrap
        </button>
      </div>
    </div>

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
      class="code-body"
      :class="{ 'wrap-enabled': wrap }"
      v-html="highlightedCode"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
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

const language = computed(() => props.language || 'text')

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

async function copyCode() {
  try {
    await navigator.clipboard.writeText(props.content)
  } catch (err) {
    console.error('Copy failed:', err)
  }
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
