import { ref } from 'vue'
import { createHighlighter, type Highlighter, type BundledLanguage } from 'shiki'

// Static imports for languages
import python from 'shiki/langs/python.mjs'
import javascript from 'shiki/langs/javascript.mjs'
import typescript from 'shiki/langs/typescript.mjs'
import markdown from 'shiki/langs/markdown.mjs'
import json from 'shiki/langs/json.mjs'
import html from 'shiki/langs/html.mjs'
import css from 'shiki/langs/css.mjs'
import bash from 'shiki/langs/bash.mjs'
import yaml from 'shiki/langs/yaml.mjs'
import rust from 'shiki/langs/rust.mjs'
import go from 'shiki/langs/go.mjs'
import java from 'shiki/langs/java.mjs'
import cpp from 'shiki/langs/cpp.mjs'
import c from 'shiki/langs/c.mjs'
import sql from 'shiki/langs/sql.mjs'

// Theme imports
import githubDark from 'shiki/themes/github-dark.mjs'
import githubLight from 'shiki/themes/github-light.mjs'

const commonLangs = [
  python,
  javascript,
  typescript,
  markdown,
  json,
  html,
  css,
  bash,
  yaml,
  rust,
  go,
  java,
  cpp,
  c,
  sql
]

let highlighterPromise: Promise<Highlighter> | null = null

const isReady = ref(false)
const loadError = ref<string | null>(null)

// Generate line numbers HTML
function renderLineNumbers(code: string): string {
  const lines = code.split('\n')
  const lineNumbers = lines.map((_, i) => `<span class="line-number">${i + 1}</span>`).join('\n')
  return `<div class="line-numbers" aria-hidden="true">${lineNumbers}</div>`
}

export function useShiki() {
  function getHighlighter(): Promise<Highlighter> {
    if (highlighterPromise) {
      return highlighterPromise
    }

    highlighterPromise = createHighlighter({
      themes: [githubDark, githubLight],
      langs: commonLangs
    }).then(highlighter => {
      isReady.value = true
      loadError.value = null
      return highlighter
    }).catch(err => {
      loadError.value = err instanceof Error ? err.message : 'Failed to load Shiki'
      throw err
    })

    return highlighterPromise
  }

  async function highlight(
    code: string,
    lang: string,
    theme: 'github-dark' | 'github-light'
  ): Promise<string> {
    const highlighter = await getHighlighter()

    // Check if language is loaded, fall back to 'text' if not
    const loadedLangs = highlighter.getLoadedLanguages()
    const effectiveLang = loadedLangs.includes(lang as BundledLanguage) ? lang : 'text'

    const html = highlighter.codeToHtml(code, {
      lang: effectiveLang,
      theme
    })

    // Wrap with line numbers
    const lineNumbersHtml = renderLineNumbers(code)
    return `<div class="code-container">${lineNumbersHtml}${html}</div>`
  }

  return {
    isReady,
    loadError,
    getHighlighter,
    highlight
  }
}
