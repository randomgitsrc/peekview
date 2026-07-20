---
phase: P0
task_id: T059
task_name: markdown-katex-math
type: brief
trace_id: T059-P0-20260720
created: 2026-07-20
status: draft
parent: 用户反馈 + backlog #26
---

# P0-Brief: Markdown 数学公式渲染 (KaTeX)

## 问题

PeekView 的 Markdown 渲染不支持 LaTeX 数学公式。用户在 Markdown 中写 `$e^{i\pi} + 1 = 0$` 或 `$$\frac{a}{b}$$` 时，公式以原始文本显示，不会被渲染为数学符号。

## 现状

- `useMarkdown.ts` 使用 `markdown-it`，未注册任何数学插件
- KaTeX `0.16.47` 已作为 Mermaid 的间接依赖存在于 `node_modules`，但未作为直接依赖
- DOMPurify 会剥离 KaTeX 输出的自定义属性和样式，需要白名单扩展

## 目标

在 Markdown 渲染中支持：
- 行内公式：`$...$`（如 `$e^{i\pi} + 1 = 0$`）
- 块级公式：`$$...$$`（如 `$$\frac{-b \pm \sqrt{b^2-4ac}}{2a}$$`）

## 技术路线

1. 添加直接依赖 `katex` + `@iktakahiro/markdown-it-katex`（或类似 markdown-it 数学插件）
2. 在 `useMarkdown.ts` 中注册插件
3. 处理 DOMPurify 白名单（KaTeX 输出的 `span`/`class` 属性）
4. 加载 KaTeX CSS（全局或按需）
5. CSP：当前 `unsafe-eval` 已允许，KaTeX 不需要额外 CSP 放宽

## 约束

- debug_env: `make debug` (:8888, /tmp/peekview-debug/)
- 不触碰生产服务
- KaTeX CSS 约 20KB gzip，需评估对首屏加载的影响

## 风险

- DOMPurify 与 KaTeX 输出的兼容性：KaTeX 生成大量带 `class="katex-*"` 的 span，DOMPurify 可能删除
- `$` 分隔符与 Markdown 内其他 `$` 符号冲突（如货币符号）
- KaTeX CSS 全局引入可能影响现有样式

## 裁剪倾向

- 标准流程（P0-P8），但 P3 可简化（纯前端渲染，无后端变更，单元测试覆盖公式解析即可）
