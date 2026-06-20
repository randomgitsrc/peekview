import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'
import type { TocHeading } from '@/types'
import { useShiki } from './useShiki'

export interface MarkdownRenderResult {
  html: string
  headings: TocHeading[]
  mermaidSources: Map<number, string>
  plantumlSources: Map<number, string>
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

  async function render(content: string, theme: 'github-dark' | 'github-light'): Promise<MarkdownRenderResult> {
    const headings: TocHeading[] = []
    const codeBlocks: CodeBlock[] = []
    const mermaidSources = new Map<number, string>()
    const plantumlSources = new Map<number, string>()
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

    // Render markdown (with placeholders) - use processedContent (without front matter)
    let html = md.render(processedContent)

    // Restore heading renderer
    md.renderer.rules.heading_open = originalHeading

    // Restore fence renderer
    md.renderer.rules.fence = originalFence

    // Second pass: replace placeholders with highlighted code
    for (const block of codeBlocks) {
      try {
        // Skip mermaid blocks - they will be rendered by Mermaid.js with toggle support
        if (block.lang === 'mermaid') {
          const mermaidBlockId = `mermaid-block-${block.index}`
          mermaidSources.set(block.index, block.code)
          const mermaidBlock = `<div class="mermaid-block" id="${mermaidBlockId}" data-index="${block.index}">
            <div class="mermaid-header">
              <span class="mermaid-label">MERMAID</span>
              <div class="mermaid-header-actions">
                <button class="mermaid-view-toggle" data-action="toggle-mermaid-view" data-block-id="${mermaidBlockId}" title="Toggle Diagram/Code">
                  <span class="toggle-icon">◫</span>
                  <span class="toggle-text">Diagram</span>
                </button>
                <button class="mermaid-action-btn fullscreen-btn" data-action="open-mermaid-fullscreen" data-block-id="${mermaidBlockId}" title="Fullscreen">⧉</button>
                <div class="mermaid-dropdown">
                  <button class="mermaid-action-btn menu-btn" data-action="toggle-mermaid-menu" data-block-id="${mermaidBlockId}" title="More actions">⋯</button>
                  <div class="mermaid-dropdown-menu" id="menu-${mermaidBlockId}">
                    <button data-action="download-mermaid-png" data-block-id="${mermaidBlockId}">⬇ Download PNG</button>
                    <button data-action="copy-mermaid-code" data-block-id="${mermaidBlockId}">⧉ Copy Code</button>
                  </div>
                </div>
              </div>
            </div>
            <div class="mermaid-content diagram-mode is-active" data-mode="diagram">
              <div class="mermaid-viewer-mount" data-index="${block.index}"></div>
              <div class="mermaid-resize-handle" data-action="start-resize" data-block-id="${mermaidBlockId}"></div>
            </div>
            <div class="mermaid-content code-mode" data-mode="code">
              <pre class="shiki"><code>${escapeHtml(block.code)}</code></pre>
            </div>
          </div>`
          html = html.replace(`<!--CODE_BLOCK_${block.index}-->`, mermaidBlock)
          continue
        }

        if (block.lang === 'plantuml') {
          const plantumlBlockId = `plantuml-block-${block.index}`
          plantumlSources.set(block.index, block.code)
          const plantumlBlock = `<div class="plantuml-block" id="${plantumlBlockId}" data-index="${block.index}">
            <div class="plantuml-header">
              <span class="plantuml-label">PLANTUML</span>
              <div class="plantuml-header-actions">
                <button class="plantuml-view-toggle" data-action="toggle-plantuml-view" data-block-id="${plantumlBlockId}" title="Toggle Diagram/Code">
                  <span class="toggle-icon">◫</span>
                  <span class="toggle-text">Diagram</span>
                </button>
                <button class="plantuml-action-btn fullscreen-btn" data-action="open-plantuml-fullscreen" data-block-id="${plantumlBlockId}" title="Fullscreen">⧉</button>
                <div class="plantuml-dropdown">
                  <button class="plantuml-action-btn menu-btn" data-action="toggle-plantuml-menu" data-block-id="${plantumlBlockId}" title="More actions">⋯</button>
                  <div class="plantuml-dropdown-menu" id="menu-${plantumlBlockId}">
                    <button data-action="download-plantuml-png" data-block-id="${plantumlBlockId}">⬇ Download PNG</button>
                    <button data-action="copy-plantuml-code" data-block-id="${plantumlBlockId}">⧉ Copy Code</button>
                  </div>
                </div>
              </div>
            </div>
            <div class="plantuml-content diagram-mode is-active" data-mode="diagram">
              <div class="plantuml-viewer-mount" data-index="${block.index}"></div>
            </div>
            <div class="plantuml-content code-mode" data-mode="code">
              <pre class="shiki"><code>${escapeHtml(block.code)}</code></pre>
            </div>
          </div>`
          html = html.replace(`<!--CODE_BLOCK_${block.index}-->`, plantumlBlock)
          continue
        }

        const highlighted = await highlightCode(block.code, block.lang, theme)
        // Wrap highlighted code with our header and copy button
        const wrappedCode = `<div class="code-block-wrapper">
          <div class="code-block-header">
            <span class="code-lang">${block.lang.toUpperCase()}</span>
            <button class="code-copy-btn" data-code="${escapeHtmlAttribute(block.code)}" data-action="copy-code-block">Copy</button>
          </div>
          ${highlighted}
        </div>`
        html = html.replace(`<!--CODE_BLOCK_${block.index}-->`, wrappedCode)
      } catch (err) {
        // Fallback to plain text if highlighting fails
        const escapedCode = block.code
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
        const fallbackCode = `<div class="code-block-wrapper">
          <div class="code-block-header">
            <span class="code-lang">${block.lang.toUpperCase()}</span>
            <button class="code-copy-btn" data-code="${escapeHtmlAttribute(block.code)}" data-action="copy-code-block">Copy</button>
          </div>
          <pre><code class="language-${block.lang}">${escapedCode}</code></pre>
        </div>`
        html = html.replace(`<!--CODE_BLOCK_${block.index}-->`, fallbackCode)
      }
    }

    // Prepend front matter HTML if present
    if (frontMatterHtml) {
      html = frontMatterHtml + html
    }

    html = DOMPurify.sanitize(html, {
      ADD_ATTR: ['data-action', 'data-code', 'data-line', 'data-block-id', 'data-index', 'data-mode', 'target', 'rel'],
      ADD_TAGS: ['button'],
    })

    return { html, headings, mermaidSources, plantumlSources }
  }

  return { render }
}
