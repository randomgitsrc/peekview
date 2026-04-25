<template>
  <div class="markdown-viewer">
    <slot name="toc" :headings="headings" />
    <div ref="contentRef" class="markdown-body" v-html="renderedHtml" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useMarkdown } from '@/composables/useMarkdown'
import { useMermaid } from '@/composables/useMermaid'
import { useThemeStore } from '@/stores/theme'
import { storeToRefs } from 'pinia'
import type { TocHeading } from '@/types'

const props = defineProps<{ content: string }>()
const emit = defineEmits<{ headings: [headings: TocHeading[]] }>()

const { render } = useMarkdown()
const { render: renderMermaid } = useMermaid()
const themeStore = useThemeStore()
const { theme } = storeToRefs(themeStore)

const contentRef = ref<HTMLElement>()
const headings = ref<TocHeading[]>([])
const mermaidCache = new Map<string, string>()

const renderedHtml = computed(() => {
  const result = render(props.content)
  headings.value = result.headings
  emit('headings', result.headings)
  return result.html
})

async function renderMermaidDiagrams() {
  if (!contentRef.value) return
  const elements = contentRef.value.querySelectorAll('.language-mermaid')

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i] as HTMLElement
    const code = el.textContent || ''
    const cacheKey = `${theme.value}-${code}`

    try {
      let svg: string
      if (mermaidCache.has(cacheKey)) {
        svg = mermaidCache.get(cacheKey)!
      } else {
        svg = await renderMermaid(`${i}`, code, theme.value)
        mermaidCache.set(cacheKey, svg)
      }

      const container = document.createElement('div')
      container.className = 'mermaid'
      container.innerHTML = svg
      el.parentElement?.replaceWith(container)
    } catch (err) {
      console.error('Mermaid render failed:', err)
      el.parentElement?.classList.add('mermaid-error')
    }
  }
}

watch(() => [props.content, theme.value], async () => {
  await nextTick()
  await renderMermaidDiagrams()
}, { immediate: true })
</script>

<style scoped>
@import '@/styles/markdown.css';
</style>
