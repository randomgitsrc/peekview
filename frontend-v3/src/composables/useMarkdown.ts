import MarkdownIt from 'markdown-it'
import type { TocHeading } from '@/types'
import { useShiki } from './useShiki'

export function useMarkdown() {
  const md = new MarkdownIt({ html: true, linkify: true, typographer: true })
  const { highlightCode } = useShiki()

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

  async function render(content: string, theme: 'github-dark' | 'github-light'): Promise<{ html: string; headings: TocHeading[] }> {
    const headings: TocHeading[] = []
    const codeBlocks: CodeBlock[] = []

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

    // Render markdown (with placeholders)
    let html = md.render(content)

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
          // Flattened structure: 2 layers instead of 4
          // Icons: ⧉ fullscreen, ⬇ download, ⧉ copy, ⋯ menu
          const mermaidBlock = `<div class="mermaid-block" id="${mermaidBlockId}" data-mermaid-code="${escapeHtmlAttribute(block.code)}" data-index="${block.index}">
            <div class="mermaid-header">
              <span class="mermaid-label">MERMAID</span>
              <div class="mermaid-header-actions">
                <button class="mermaid-view-toggle" onclick="toggleMermaidView('${mermaidBlockId}')" title="Toggle Diagram/Code">
                  <span class="toggle-icon">◫</span>
                  <span class="toggle-text">Diagram</span>
                </button>
                <button class="mermaid-action-btn fullscreen-btn" onclick="openMermaidFullscreen('${mermaidBlockId}')" title="Fullscreen">⧉</button>
                <div class="mermaid-dropdown">
                  <button class="mermaid-action-btn menu-btn" onclick="toggleMermaidMenu('${mermaidBlockId}')" title="More actions">⋯</button>
                  <div class="mermaid-dropdown-menu" id="menu-${mermaidBlockId}">
                    <button onclick="downloadMermaidPng('${mermaidBlockId}')">⬇ Download PNG</button>
                    <button onclick="copyMermaidCode('${mermaidBlockId}')">⧉ Copy Code</button>
                  </div>
                </div>
              </div>
            </div>
            <div class="mermaid-content diagram-mode is-active" data-mode="diagram">
              <div class="mermaid-viewer-mount" data-index="${block.index}"></div>
              <div class="mermaid-resize-handle" onmousedown="startResize('${mermaidBlockId}', event)"></div>
            </div>
            <div class="mermaid-content code-mode" data-mode="code">
              <pre class="shiki"><code>${escapeHtml(block.code)}</code></pre>
            </div>
          </div>`
          html = html.replace(`<!--CODE_BLOCK_${block.index}-->`, mermaidBlock)
          continue
        }

        const highlighted = await highlightCode(block.code, block.lang, theme)
        // Wrap highlighted code with our header and copy button
        const wrappedCode = `<div class="code-block-wrapper">
          <div class="code-block-header">
            <span class="code-lang">${block.lang.toUpperCase()}</span>
            <button class="code-copy-btn" data-code="${escapeHtmlAttribute(block.code)}" onclick="copyCodeBlock(this)">Copy</button>
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
            <button class="code-copy-btn" data-code="${escapeHtmlAttribute(block.code)}" onclick="copyCodeBlock(this)">Copy</button>
          </div>
          <pre><code class="language-${block.lang}">${escapedCode}</code></pre>
        </div>`
        html = html.replace(`<!--CODE_BLOCK_${block.index}-->`, fallbackCode)
      }
    }

    return { html, headings }
  }

  return { render }
}
