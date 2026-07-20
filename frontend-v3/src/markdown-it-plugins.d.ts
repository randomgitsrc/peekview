declare module '@iktakahiro/markdown-it-katex' {
  import type MarkdownIt from 'markdown-it'
  const mkKatex: MarkdownIt.PluginSimple
  export default mkKatex
}

declare module 'markdown-it-task-lists' {
  import type MarkdownIt from 'markdown-it'
  const mkTaskLists: MarkdownIt.PluginSimple
  export default mkTaskLists
}

declare module 'markdown-it-footnote' {
  import type MarkdownIt from 'markdown-it'
  const mkFootnote: MarkdownIt.PluginSimple
  export default mkFootnote
}

declare module 'markdown-it-sub' {
  import type MarkdownIt from 'markdown-it'
  const mkSub: MarkdownIt.PluginSimple
  export default mkSub
}

declare module 'markdown-it-sup' {
  import type MarkdownIt from 'markdown-it'
  const mkSup: MarkdownIt.PluginSimple
  export default mkSup
}
