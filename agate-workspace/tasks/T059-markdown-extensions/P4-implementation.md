---
phase: P4
task_id: T059
type: implementation
parent: P3-test-cases.md
trace_id: T059-P4-20260720
status: draft
created: 2026-07-20
agent: implementer
---

# P4 Implementation: Markdown 扩展补全（KaTeX + Task List + Footnote + Sub/Sup）

## 方案

P2 方案 A：全局注册 + 全局 CSS + scrollIntoView 拦截

## 修改文件清单

| 文件 | 改动 |
|------|------|
| `frontend-v3/package.json` | 添加 6 个直接依赖：`@iktakahiro/markdown-it-katex`, `katex`, `markdown-it-task-lists`, `markdown-it-footnote`, `markdown-it-sub`, `markdown-it-sup` |
| `frontend-v3/src/composables/useMarkdown.ts` | 导入 5 个插件，按 katex→task-lists→footnote→sub→sup 顺序注册 |
| `frontend-v3/src/main.ts` | 添加 `import 'katex/dist/katex.min.css'` |
| `frontend-v3/src/components/MarkdownViewer.vue` | 扩展 `handleLinkClick` 拦截脚注链接 + 添加脚注/任务列表/KaTeX 暗色模式/溢出滚动 CSS |
| `frontend-v3/src/vite-env.d.ts` | 添加 5 个模块类型声明 |
| `frontend-v3/src/markdown-it-plugins.d.ts` | 独立类型声明文件（vite-env.d.ts 声明未被 moduleResolution:"bundler" 识别） |

## 实现细节

### 1. 插件注册（useMarkdown.ts）

```typescript
import mkKatex from '@iktakahiro/markdown-it-katex'
import mkTaskLists from 'markdown-it-task-lists'
import mkFootnote from 'markdown-it-footnote'
import mkSub from 'markdown-it-sub'
import mkSup from 'markdown-it-sup'

md.use(mkKatex, { throwOnError: false })
md.use(mkTaskLists)
md.use(mkFootnote)
md.use(mkSub)
md.use(mkSup)
```

[DESIGN_GAP: P2 未指定 KaTeX `throwOnError` 选项。实现中设为 `false`，原因：插件默认在错误时抛异常并渲染 `class='katex-error'` span（无颜色标记），而 P3 TC05 断言输出含 `#cc0000/mathcolor`。设 `throwOnError: false` 后 KaTeX 自身渲染红色错误标记，与 P3 测试预期一致。]

### 2. KaTeX CSS（main.ts）

全局 `import 'katex/dist/katex.min.css'`，Vite 提取到 CSS chunk，首屏加载，无 FOUC。

### 3. 脚注链接拦截（MarkdownViewer.vue handleLinkClick）

- 原有 `handleLinkClick` 仅处理 `a[data-peekview-file-id]`
- 扩展为通用 `<a>` 匹配，优先级：file-id > 脚注链接 > 其他
- 脚注链接判断：`href.startsWith('#fn')` 或 `target.classList.contains('footnote-backref')`
- 使用 `CSS.escape(targetId)` 处理含冒号 ID（如 `fnref1:1`）
- `scrollIntoView({ behavior: 'smooth', block: 'start' })` 在 `contentRef.value` 范围内查找

### 4. CSS 样式（MarkdownViewer.vue 非 scoped style）

- 脚注：`.footnotes-sep`/`.footnotes`/`.footnotes-list`/`.footnote-ref`/`.footnote-backref` + 暗色模式
- 任务列表：`.contains-task-list`/`.task-list-item`/`.task-list-item-checkbox` + 暗色模式
- KaTeX 暗色模式：`[data-theme='dark'] .katex { color: #c9d1d9 }`
- KaTeX 溢出滚动：`.katex-block { overflow-x: auto; overflow-y: hidden }`

### 5. 类型声明

5 个模块无 TypeScript 类型定义，在 `src/markdown-it-plugins.d.ts` 声明为 `MarkdownIt.PluginSimple`。初始放在 `vite-env.d.ts` 但 `moduleResolution:"bundler"` 未识别，移至独立文件后通过。

## 自查结果

- `vitest run` 全部 51 个 useMarkdown 相关测试通过（36 新增 + 15 原有）
- `vue-tsc --noEmit` 无新增类型错误
- 现有 ShareDialog.spec.ts 失败为预存问题，与本次变更无关

## DOMPurify

未修改。P2 minimal_validation confirmed 默认白名单已覆盖所有扩展输出。

## 依赖版本

| 包 | 安装版本 |
|----|---------|
| `@iktakahiro/markdown-it-katex` | ^4.0.1 |
| `katex` | ^0.18.1 |
| `markdown-it-task-lists` | ^2.1.1 |
| `markdown-it-footnote` | ^4.0.0 |
| `markdown-it-sub` | ^2.0.0 |
| `markdown-it-sup` | ^2.0.0 |
