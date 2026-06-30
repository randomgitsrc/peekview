import { ref } from 'vue'
import { createHighlighter, type Highlighter, type BundledLanguage } from 'shiki'

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
import xml from 'shiki/langs/xml.mjs'

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
  sql,
  xml
]

export const LANG_IMPORT_MAP: Record<string, () => Promise<any>> = {
  csharp: () => import('shiki/langs/csharp.mjs'),
  ruby: () => import('shiki/langs/ruby.mjs'),
  php: () => import('shiki/langs/php.mjs'),
  swift: () => import('shiki/langs/swift.mjs'),
  scala: () => import('shiki/langs/scala.mjs'),
  r: () => import('shiki/langs/r.mjs'),
  scss: () => import('shiki/langs/scss.mjs'),
  sass: () => import('shiki/langs/sass.mjs'),
  less: () => import('shiki/langs/less.mjs'),
  stylus: () => import('shiki/langs/stylus.mjs'),
  toml: () => import('shiki/langs/toml.mjs'),
  ini: () => import('shiki/langs/ini.mjs'),
  rst: () => import('shiki/langs/rst.mjs'),
  zsh: () => import('shiki/langs/zsh.mjs'),
  fish: () => import('shiki/langs/fish.mjs'),
  powershell: () => import('shiki/langs/powershell.mjs'),
  batch: () => import('shiki/langs/batch.mjs'),
  dockerfile: () => import('shiki/langs/dockerfile.mjs'),
  makefile: () => import('shiki/langs/makefile.mjs'),
  graphql: () => import('shiki/langs/graphql.mjs'),
  vue: () => import('shiki/langs/vue.mjs'),
  svelte: () => import('shiki/langs/svelte.mjs'),
  astro: () => import('shiki/langs/astro.mjs'),
  lua: () => import('shiki/langs/lua.mjs'),
  viml: () => import('shiki/langs/viml.mjs'),
  elm: () => import('shiki/langs/elm.mjs'),
  clojure: () => import('shiki/langs/clojure.mjs'),
  dart: () => import('shiki/langs/dart.mjs'),
  groovy: () => import('shiki/langs/groovy.mjs'),
  'objective-c': () => import('shiki/langs/objective-c.mjs'),
  'objective-cpp': () => import('shiki/langs/objective-cpp.mjs'),
  nim: () => import('shiki/langs/nim.mjs'),
  v: () => import('shiki/langs/v.mjs'),
  zig: () => import('shiki/langs/zig.mjs'),
  elixir: () => import('shiki/langs/elixir.mjs'),
  erlang: () => import('shiki/langs/erlang.mjs'),
  ocaml: () => import('shiki/langs/ocaml.mjs'),
  fsharp: () => import('shiki/langs/fsharp.mjs'),
  purescript: () => import('shiki/langs/purescript.mjs'),
  haxe: () => import('shiki/langs/haxe.mjs'),
  pascal: () => import('shiki/langs/pascal.mjs'),
  crystal: () => import('shiki/langs/crystal.mjs'),
  lisp: () => import('shiki/langs/lisp.mjs'),
  scheme: () => import('shiki/langs/scheme.mjs'),
  racket: () => import('shiki/langs/racket.mjs'),
  julia: () => import('shiki/langs/julia.mjs'),
  matlab: () => import('shiki/langs/matlab.mjs'),
  wolfram: () => import('shiki/langs/wolfram.mjs'),
  prolog: () => import('shiki/langs/prolog.mjs'),
  perl: () => import('shiki/langs/perl.mjs'),
  awk: () => import('shiki/langs/awk.mjs'),
  diff: () => import('shiki/langs/diff.mjs'),
  reg: () => import('shiki/langs/reg.mjs'),
  tsx: () => import('shiki/langs/tsx.mjs'),
  kotlin: () => import('shiki/langs/kotlin.mjs'),
  csv: () => import('shiki/langs/csv.mjs'),
  log: () => import('shiki/langs/log.mjs'),
  jsonc: () => import('shiki/langs/jsonc.mjs'),
  cmake: () => import('shiki/langs/cmake.mjs'),
  nginx: () => import('shiki/langs/nginx.mjs'),
  apache: () => import('shiki/langs/apache.mjs'),
  dotenv: () => import('shiki/langs/dotenv.mjs'),
}

export const LEGACY_LANG_MAP: Record<string, string> = {
  mathematica: 'wolfram',
  registry: 'reg',
}

const loadingLangs = new Map<string, Promise<boolean>>()

export async function ensureLanguage(
  highlighter: Highlighter,
  lang: string
): Promise<string> {
  const resolvedLang = LEGACY_LANG_MAP[lang] ?? lang

  if (highlighter.getLoadedLanguages().includes(resolvedLang as BundledLanguage)) {
    return resolvedLang
  }

  let promise = loadingLangs.get(resolvedLang)
  if (!promise) {
    const importer = LANG_IMPORT_MAP[resolvedLang]
    if (!importer) return 'text'
    promise = importer()
      .then(async (mod) => {
        await highlighter.loadLanguage(mod.default)
        return true
      })
      .catch(() => {
        loadingLangs.delete(resolvedLang)
        return false
      })
    loadingLangs.set(resolvedLang, promise)
  }

  const ok = await promise
  return ok ? resolvedLang : 'text'
}

let highlighterPromise: Promise<Highlighter> | null = null

const isReady = ref(false)
const loadError = ref<string | null>(null)

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
    const effectiveLang = await ensureLanguage(highlighter, lang)

    const html = highlighter.codeToHtml(code, {
      lang: effectiveLang,
      theme
    })

    const lineNumbersHtml = renderLineNumbers(code)
    return `<div class="code-container">${lineNumbersHtml}${html}</div>`
  }

  async function highlightCode(
    code: string,
    lang: string,
    theme: 'github-dark' | 'github-light'
  ): Promise<string> {
    const highlighter = await getHighlighter()
    const effectiveLang = await ensureLanguage(highlighter, lang)

    return highlighter.codeToHtml(code, {
      lang: effectiveLang,
      theme
    })
  }

  return {
    isReady,
    loadError,
    getHighlighter,
    highlight,
    highlightCode
  }
}
