// frontend/src/composables/useShiki.ts

import { ref } from 'vue'
import {
  createHighlighter,
  type Highlighter,
  type LanguageInput,
} from 'shiki'

// Import themes
import githubDark from 'shiki/dist/themes/github-dark.mjs'
import githubLight from 'shiki/dist/themes/github-light.mjs'

// Import common languages statically
import python from 'shiki/dist/langs/python.mjs'
import javascript from 'shiki/dist/langs/javascript.mjs'
import typescript from 'shiki/dist/langs/typescript.mjs'
import markdown from 'shiki/dist/langs/markdown.mjs'
import json from 'shiki/dist/langs/json.mjs'
import html from 'shiki/dist/langs/html.mjs'
import css from 'shiki/dist/langs/css.mjs'
import bash from 'shiki/dist/langs/bash.mjs'
import yaml from 'shiki/dist/langs/yaml.mjs'
import rust from 'shiki/dist/langs/rust.mjs'
import go from 'shiki/dist/langs/go.mjs'
import java from 'shiki/dist/langs/java.mjs'
import cpp from 'shiki/dist/langs/cpp.mjs'
import c from 'shiki/dist/langs/c.mjs'
import sql from 'shiki/dist/langs/sql.mjs'

const commonLangs = [
  python, javascript, typescript, markdown, json,
  html, css, bash, yaml, rust, go, java, cpp, c, sql
]

/** Singleton highlighter promise — created once, reused everywhere. */
let highlighterPromise: Promise<Highlighter> | null = null

/** Loading state for UI feedback. */
const isReady = ref(false)
const loadError = ref<string | null>(null)

export function useShiki() {
  /**
   * Get or create the singleton Shiki highlighter.
   * Created once with themes and common languages loaded.
   */
  function getHighlighter(): Promise<Highlighter> {
    if (!highlighterPromise) {
      highlighterPromise = createHighlighter({
        themes: [githubDark as any, githubLight as any],
        langs: commonLangs as LanguageInput[],
      })
        .then((hl) => {
          isReady.value = true
          return hl
        })
        .catch((err) => {
          loadError.value = err.message || 'Failed to initialize Shiki'
          highlighterPromise = null
          throw err
        })
    }
    return highlighterPromise
  }

  /**
   * Load a language into the highlighter on demand.
   */
  async function loadLanguage(lang: string): Promise<void> {
    const hl = await getHighlighter()
    if (hl.getLoadedLanguages().includes(lang)) return

    try {
      const grammar = await import(`shiki/langs/${lang}.mjs`)
        .then((m: any) => m.default || m)
      await hl.loadLanguage(grammar as LanguageInput)
    } catch {
      console.warn(`Shiki: language '${lang}' not available`)
    }
  }

  /**
   * Get current theme based on data-theme attribute
   */
  function getCurrentTheme(): string {
    const theme = document.documentElement.getAttribute('data-theme')
    return theme === 'light' ? 'github-light' : 'github-dark'
  }

  /**
   * Generate line numbers HTML
   */
  function renderLineNumbers(code: string): string {
    const lines = code.split('\n')
    const lineNumbers = lines.map((_, i) => `<span class="line-number">${i + 1}</span>`).join('\n')
    return `<div class="line-numbers" aria-hidden="true">${lineNumbers}</div>`
  }

  /**
   * Highlight code with theme matching current mode.
   */
  async function highlight(code: string, lang: string): Promise<string> {
    const hl = await getHighlighter()
    const theme = getCurrentTheme()

    // Check if language is loaded
    const loadedLangs = hl.getLoadedLanguages()
    const useLang = loadedLangs.includes(lang) ? lang : 'text'

    const html = hl.codeToHtml(code, { lang: useLang, theme })

    // Wrap with line numbers
    const lineNumbersHtml = renderLineNumbers(code)
    return `<div class="code-container">${lineNumbersHtml}${html}</div>`
  }

  return { getHighlighter, loadLanguage, highlight, isReady, loadError }
}
