import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'
import type { TocHeading, MarkdownBlock, MarkdownBlocksResult } from '@/types'
import { useShiki } from './useShiki'
import { resolvePath } from '@/utils/path-map'
import type { PathMap } from '@/utils/path-map'

// Compat type for MarkdownViewer (removed in Task 7)
export interface MarkdownRenderResult extends MarkdownBlocksResult {
  html: string
  mermaidSources: Map<number, string>
  plantumlSources: Map<number, string>
  svgSources: Map<number, string>
}

function buildCodeBlockWrapper(
  lang: string,
  code: string,
  highlighted: string,
  escapeFn: (text: string) => string,
): string {
  return `<div class="code-block-wrapper">
    <div class="code-block-header">
      <span class="code-lang">${lang.toUpperCase()}</span>
      <button class="code-copy-btn" data-code="${escapeFn(code)}" data-action="copy-code-block">Copy</button>
    </div>
    ${highlighted}
  </div>`
}

function buildFallbackCodeBlock(
  lang: string,
  code: string,
  escapeFn: (text: string) => string,
): string {
  const escapedCode = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return `<div class="code-block-wrapper">
    <div class="code-block-header">
      <span class="code-lang">${lang.toUpperCase()}</span>
      <button class="code-copy-btn" data-code="${escapeFn(code)}" data-action="copy-code-block">Copy</button>
    </div>
    <pre><code class="language-${lang}">${escapedCode}</code></pre>
  </div>`
}

export function useMarkdown() {
  const md = new MarkdownIt({ html: true, linkify: true, typographer: true })
  const { highlightCode } = useShiki()

  // Front matter extraction regex - must be at the very beginning of the file
  // Note: no /m flag so ^ matches only start of string, not each line
  const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/

  function slugify(text: string): string {
    // Keep CJK characters and other word characters, remove punctuation
    return text
      .toLowerCase()
      .replace(/[^\w\s一-龥぀-ゟ゠-ヿ-]/g, '') // Keep CJK, hiragana, katakana
      .replace(/\s+/g, '-')
      .replace(/^-+|-+$/g, '') // Trim leading/trailing dashes
      .substring(0, 50) || 'heading' // Fallback if empty
  }

  function escapeHtmlAttribute(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }

  function escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }

  // Override inline code renderer
  md.renderer.rules.code_inline = (tokens, idx) => {
    const token = tokens[idx]
    const code = token.content
    const escapedCode = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    return `<code>${escapedCode}</code>`
  }

  // Store code blocks for async highlighting
  interface CodeBlock {
    index: number
    lang: string
    code: string
  }

  function rewriteHtmlRefs(html: string, pathMap: PathMap, slug: string): string {
    const doc = new DOMParser().parseFromString(html, 'text/html')

    for (const img of doc.querySelectorAll('img[src]')) {
      const src = img.getAttribute('src')
      if (!src) continue
      const fileId = resolvePath(src, pathMap)
      if (fileId !== null) {
        img.setAttribute('src', `/api/v1/entries/${slug}/files/${fileId}/content`)
      }
    }

    for (const a of doc.querySelectorAll('a[href]')) {
      const href = a.getAttribute('href')
      if (!href) continue
      const fileId = resolvePath(href, pathMap)
      if (fileId !== null) {
        a.setAttribute('href', `/${slug}?file=${fileId}`)
        a.setAttribute('data-peekview-file-id', String(fileId))
      }
    }

    return doc.body.innerHTML
  }

  async function render(
    content: string,
    theme: 'github-dark' | 'github-light',
    pathMap: PathMap | null = null,
    slug: string = '',
  ): Promise<MarkdownRenderResult> {
    const headings: TocHeading[] = []
    const codeBlocks: CodeBlock[] = []
    let frontMatterHtml = ''
    let processedContent = content
    const frontMatterMatch = content.match(frontMatterRegex)
    if (frontMatterMatch) {
      const frontMatterContent = frontMatterMatch[1].trim()
      processedContent = content.slice(frontMatterMatch[0].length)

      // Parse front matter into key-value pairs (supporting multi-line values)
      const frontMatterData: Array<{ key: string; value: string; isMultiLine: boolean }> = []
      const lines = frontMatterContent.split('\n')
      let currentKey = ''
      let currentValue = ''
      let isMultiLine = false

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const match = line.match(/^(\w+):\s*(.*)$/)

        if (match) {
          // Save previous entry if exists
          if (currentKey) {
            frontMatterData.push({
              key: currentKey,
              value: currentValue.trim(),
              isMultiLine
            })
          }
          currentKey = match[1]
          const valuePart = match[2].trim()

          // Check for multi-line indicator (>)
          if (valuePart === '>') {
            isMultiLine = true
            currentValue = ''
            // Collect following indented lines
            i++
            while (i < lines.length && (lines[i].startsWith('  ') || lines[i] === '')) {
              currentValue += (currentValue ? '\n' : '') + lines[i].replace(/^  /, '')
              i++
            }
            i-- // Step back one line since the outer loop will increment
          } else if (valuePart.startsWith('>')) {
            // Folded style with content on same line
            isMultiLine = true
            currentValue = valuePart.slice(1).trim()
            // Collect following indented lines
            i++
            while (i < lines.length && (lines[i].startsWith('  ') || lines[i] === '')) {
              currentValue += (currentValue ? '\n' : '') + lines[i].replace(/^  /, '')
              i++
            }
            i-- // Step back one line
          } else {
            isMultiLine = false
            currentValue = valuePart
          }
        } else if (currentKey && isMultiLine && line.startsWith('  ')) {
          // Continuation of multi-line value
          currentValue += (currentValue ? '\n' : '') + line.replace(/^  /, '')
        }
      }

      // Save last entry
      if (currentKey) {
        frontMatterData.push({
          key: currentKey,
          value: currentValue.trim(),
          isMultiLine
        })
      }

      if (frontMatterData.length > 0) {
        // Build front matter HTML (compact design without header)
        frontMatterHtml = `<div class="front-matter">
          <div class="front-matter-content">
            ${frontMatterData.map(({ key, value, isMultiLine }) => {
              // Handle array format like [tag1, tag2]
              if (value.startsWith('[') && value.endsWith(']')) {
                const items = value.slice(1, -1).split(',').map(v => v.trim()).filter(Boolean)
                return `<div class="front-matter-row">
                  <span class="front-matter-key">${escapeHtml(key)}</span>
                  <span class="front-matter-separator">:</span>
                  <span class="front-matter-value">
                    ${items.map(item => `<span class="front-matter-tag">${escapeHtml(item)}</span>`).join('')}
                  </span>
                </div>`
              }
              // Handle multi-line text
              if (isMultiLine) {
                return `<div class="front-matter-row multi-line">
                  <span class="front-matter-key">${escapeHtml(key)}</span>
                  <span class="front-matter-separator">:</span>
                  <span class="front-matter-value">
                    ${value.split('\n').map(v => `<span class="front-matter-line">${escapeHtml(v)}</span>`).join('')}
                  </span>
                </div>`
              }
              // Handle empty value (like place:)
              if (!value) {
                return `<div class="front-matter-row">
                  <span class="front-matter-key">${escapeHtml(key)}</span>
                  <span class="front-matter-separator">:</span>
                  <span class="front-matter-value empty">—</span>
                </div>`
              }
              // Standard key-value
              return `<div class="front-matter-row">
                <span class="front-matter-key">${escapeHtml(key)}</span>
                <span class="front-matter-separator">:</span>
                <span class="front-matter-value">${escapeHtml(value)}</span>
              </div>`
            }).join('')}
          </div>
        </div>`
      }
    }

    // Store original fence renderer
    const originalFence = md.renderer.rules.fence

    // First pass: collect code blocks
    md.renderer.rules.fence = (tokens, idx) => {
      const token = tokens[idx]
      const code = token.content
      const lang = token.info.trim() || 'text'
      const index = codeBlocks.length
      codeBlocks.push({ index, lang, code })
      // Placeholder that will be replaced
      return `<!--CODE_BLOCK_${index}-->`
    }

    // Set up heading renderer
    const originalHeading = md.renderer.rules.heading_open
    md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
      const token = tokens[idx]
      const level = parseInt(token.tag.substring(1))
      if (level >= 2 && level <= 4) {
        const nextToken = tokens[idx + 1]
        if (nextToken?.type === 'inline') {
          const text = nextToken.content
          const id = slugify(text)
          token.attrSet('id', id)
          headings.push({ level, text, id })
        }
      }
      return originalHeading ? originalHeading(tokens, idx, options, env, self) : self.renderToken(tokens, idx, options)
    }

    // Override image renderer for path resolution
    const originalImage = md.renderer.rules.image
    if (pathMap && slug) {
      md.renderer.rules.image = (tokens, idx, options, env, self) => {
        const token = tokens[idx]
        const srcAttr = token.attrGet('src')
        if (srcAttr) {
          const fileId = resolvePath(srcAttr, pathMap)
          if (fileId !== null) {
            token.attrSet('src', `/api/v1/entries/${slug}/files/${fileId}/content`)
          }
        }
        return originalImage
          ? originalImage(tokens, idx, options, env, self)
          : self.renderToken(tokens, idx, options)
      }
    }

    // Override link_open renderer for path resolution
    const originalLinkOpen = md.renderer.rules.link_open
    if (pathMap && slug) {
      md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
        const token = tokens[idx]
        const hrefAttr = token.attrGet('href')
        if (hrefAttr) {
          const fileId = resolvePath(hrefAttr, pathMap)
          if (fileId !== null) {
            token.attrSet('href', `/${slug}?file=${fileId}`)
            token.attrSet('data-peekview-file-id', String(fileId))
          }
        }
        return originalLinkOpen
          ? originalLinkOpen(tokens, idx, options, env, self)
          : self.renderToken(tokens, idx, options)
      }
    }

    // Render markdown (with placeholders) - use processedContent (without front matter)
    let html = md.render(processedContent)

    // Restore link_open renderer
    if (pathMap && slug) {
      md.renderer.rules.link_open = originalLinkOpen
    }

    // Restore image renderer
    if (pathMap && slug) {
      md.renderer.rules.image = originalImage
    }

    // Restore heading renderer
    md.renderer.rules.heading_open = originalHeading

    // Restore fence renderer
    md.renderer.rules.fence = originalFence

    // Second pass: build blocks array from html + placeholders
    const blocks: MarkdownBlock[] = []
    const parts = html.split(/<!--CODE_BLOCK_(\d+)-->/)
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        const segment = parts[i].trim()
        if (segment) {
          blocks.push({ type: 'html', html: segment })
        }
      } else {
        const blockIdx = parseInt(parts[i])
        const codeBlock = codeBlocks[blockIdx]
        if (codeBlock.lang === 'mermaid' || codeBlock.lang === 'plantuml' || codeBlock.lang === 'svg') {
          let codeViewHtml: string
          if (codeBlock.lang === 'svg') {
            codeViewHtml = await highlightCode(codeBlock.code, 'xml', theme)
          } else if (codeBlock.lang === 'mermaid') {
            codeViewHtml = await highlightCode(codeBlock.code, 'mermaid', theme)
          } else {
            codeViewHtml = await highlightCode(codeBlock.code, 'text', theme)
          }
          blocks.push({
            type: 'diagram',
            lang: codeBlock.lang as 'mermaid' | 'plantuml' | 'svg',
            code: codeBlock.code,
            codeViewHtml,
            index: codeBlock.index,
          })
        } else {
          try {
            const highlighted = await highlightCode(codeBlock.code, codeBlock.lang, theme)
            const wrappedCode = buildCodeBlockWrapper(codeBlock.lang, codeBlock.code, highlighted, escapeHtmlAttribute)
            blocks.push({ type: 'html', html: wrappedCode })
          } catch (err) {
            const fallbackCode = buildFallbackCodeBlock(codeBlock.lang, codeBlock.code, escapeHtmlAttribute)
            blocks.push({ type: 'html', html: fallbackCode })
          }
        }
      }
    }

    // Prepend front matter as html block if present
    if (frontMatterHtml) {
      blocks.unshift({ type: 'html', html: frontMatterHtml })
    }

    // Sanitize html blocks
    for (const block of blocks) {
      if (block.type === 'html') {
        block.html = DOMPurify.sanitize(block.html, {
          ADD_ATTR: ['data-action', 'data-code', 'data-line', 'data-block-id', 'data-index', 'data-mode', 'data-peekview-file-id', 'target', 'rel'],
          ADD_TAGS: ['button'],
        })
      }
    }

    // Post-DOMPurify DOM walk for raw HTML refs
    if (pathMap && slug) {
      for (const block of blocks) {
        if (block.type === 'html') {
          block.html = rewriteHtmlRefs(block.html, pathMap, slug)
        }
      }
    }

    return { blocks, headings, html: '', mermaidSources: new Map(), plantumlSources: new Map(), svgSources: new Map() }
  }

  return { render }
}
