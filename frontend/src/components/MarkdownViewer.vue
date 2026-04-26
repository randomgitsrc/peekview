<template>
  <div class="markdown-viewer markdown-body" ref="viewerRef" v-html="rendered"></div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import MarkdownIt from 'markdown-it'
import anchor from 'markdown-it-anchor'
import sanitizeHtml from 'sanitize-html'
import { useShiki } from '../composables/useShiki'

const props = defineProps<{ content: string }>()

const emit = defineEmits<{
  headings: [{ id: string; text: string; level: number }[]]
}>()

const viewerRef = ref<HTMLElement | null>(null)

interface Heading {
  id: string
  text: string
  level: number
}

// Create markdown-it instance at module level (review §20: singleton, not per-render)
const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
})

// Add anchor plugin for heading IDs (required for TOC linking)
md.use(anchor, {
  permalink: false,  // Disable visible permalink symbols
  slugify: (s: string) =>
    s
      .toLowerCase()
      .replace(/[^\w]+/g, '-')
      .replace(/(^-|-$)/g, ''),
})

const { highlight } = useShiki()

/** Extract headings from rendered HTML for TOC. */
function extractHeadings(html: string): Heading[] {
  const result: Heading[] = []
  const regex = /<h([2-4])[^\n]*?id="([^"]*)"[^>]*>(.*?)<\/h\1>/g
  let match
  while ((match = regex.exec(html)) !== null) {
    const level = parseInt(match[1], 10)
    const id = match[2]
    const text = match[3].replace(/<[^>]*>/g, '').trim()
    result.push({ id, text, level })
  }
  return result
}

/** Render markdown, sanitize, then highlight code blocks. */
const rendered = computed(() => {
  const html = md.render(props.content)

  const sanitized = sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'img',
      'button',
      'span',
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ['src', 'alt', 'title'],
      a: ['href', 'id', 'name'],
      h1: ['id'],
      h2: ['id'],
      h3: ['id'],
      h4: ['id'],
      span: ['class', 'aria-hidden'],
      button: ['class', 'aria-label', 'data-code-index'],
      code: ['class', 'language-*'],
      pre: ['class'],
    },
  })

  // Extract headings and emit to parent for TOC sidebar
  nextTick(() => {
    const headings = extractHeadings(sanitized)
    emit('headings', headings)
  })

  return sanitized
})

/**
 * After DOM update: highlight code blocks with Shiki and inject copy buttons.
 * This runs as a post-render side effect.
 */
watch(rendered, () => {
  nextTick(async () => {
    if (!viewerRef.value) return

    const codeBlocks = viewerRef.value.querySelectorAll('pre code')
    for (const block of codeBlocks) {
      const code = block.textContent || ''
      const langClass = block.className.match(/language-(\w+)/)
      const lang = langClass ? langClass[1] : 'text'

      try {
        const highlightedHtml = await highlight(code, lang)
        // Replace code block content with Shiki output
        const pre = block.parentElement
        if (pre) {
          pre.innerHTML = highlightedHtml
          pre.classList.add('shiki')
        }
      } catch {
        // Keep original markdown-it rendering as fallback
      }

      // Inject copy button (review §11)
      const pre = block.parentElement
      if (pre && !pre.querySelector('.md-copy-btn')) {
        pre.style.position = 'relative'
        const btn = document.createElement('button')
        btn.className = 'md-copy-btn'
        btn.setAttribute('aria-label', 'Copy code block')
        btn.textContent = 'Copy'
        btn.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(code)
            btn.textContent = 'Copied!'
            setTimeout(() => {
              btn.textContent = 'Copy'
            }, 2000)
          } catch {
            // Clipboard API not available
          }
        })
        pre.appendChild(btn)
      }
    }
  })
})

onMounted(() => {
  // Trigger initial code block processing
  nextTick(() => {
    // The watch on `rendered` handles this
  })
})
</script>

<style scoped>
.markdown-viewer {
  max-height: calc(100vh - 200px);
  overflow-y: auto;
}
</style>
