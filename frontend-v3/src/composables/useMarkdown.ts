import MarkdownIt from 'markdown-it'
import type { TocHeading } from '@/types'

export function useMarkdown() {
  const md = new MarkdownIt({ html: true, linkify: true, typographer: true })

  function slugify(text: string): string {
    return text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').substring(0, 50)
  }

  function render(content: string): { html: string; headings: TocHeading[] } {
    const headings: TocHeading[] = []

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

    const html = md.render(content)
    return { html, headings }
  }

  return { render }
}
