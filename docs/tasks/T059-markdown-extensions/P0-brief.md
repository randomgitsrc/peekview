---
phase: P0
task_id: T059
task_name: markdown-extensions
type: brief
trace_id: T059-P0-20260720
created: 2026-07-20
status: draft
parent: 用户反馈 + backlog #26
---

# P0-Brief: Markdown 扩展补全（KaTeX + Task List + Footnote + Sub/Sup）

## 问题

PeekView 的 Markdown 渲染缺少多项 Agent/开发者高频使用的扩展语法，导致技术文档渲染不完整：

| 缺失特性 | 语法示例 | 现状 |
|----------|----------|------|
| 数学公式 | `$e^{i\pi}$` / `$$\frac{a}{b}$$` | 原样输出，不渲染 |
| 任务列表 | `- [x] done` / `- [ ] todo` | 渲染为纯文本 `[x]`，无 checkbox |
| 脚注 | `Hello[^1]` / `[^1]: note` | 原样输出 `[^1]`，不渲染为脚注链接 |
| 上标/下标 | `x^2^` / `H~2~O` | 原样输出，不渲染为 sup/sub |

## 现状

- `useMarkdown.ts` 使用 `markdown-it` 14.1.1，配置 `html: true, linkify: true, typographer: true`
- 已支持：表格、删除线、自动链接、HTML 内嵌
- 未注册任何扩展插件（无 task-lists / footnote / sub / sup / math）
- KaTeX `0.16.47` 已作为 Mermaid 间接依赖存在于 `node_modules`，但未作为直接依赖
- DOMPurify 会剥离 KaTeX 输出的自定义属性和样式，需要白名单扩展

## 目标

1. **KaTeX 数学公式**（🔴 高优先）：行内 `$...$` + 块级 `$$...$$`
2. **任务列表 checkbox**（🟠 中优先）：`- [x]` / `- [ ]` 渲染为 `<input type="checkbox">`
3. **脚注**（🟠 中优先）：`[^1]` + `[^1]: ...` 渲染为可点击脚注链接
4. **上标/下标**（🟡 中低优先）：`x^2^` → x²，`H~2~O` → H₂O

## 技术路线

### 插件选型

| 特性 | 插件 | 大小 | 备注 |
|------|------|------|------|
| 数学公式 | `@iktakahiro/markdown-it-katex` + `katex` | ~20KB gzip (CSS) | KaTeX 已在 node_modules |
| 任务列表 | `markdown-it-task-lists` | ~1KB | 零依赖，加 checkbox CSS |
| 脚注 | `markdown-it-footnote` | ~2KB | 零依赖，加脚注 CSS |
| 上标/下标 | `markdown-it-sub` + `markdown-it-sup` | <1KB each | 零依赖，无额外 CSS |

### 实现步骤

1. 添加直接依赖：`katex` + `@iktakahiro/markdown-it-katex` + `markdown-it-task-lists` + `markdown-it-footnote` + `markdown-it-sub` + `markdown-it-sup`
2. 在 `useMarkdown.ts` 中注册所有插件
3. 处理 DOMPurify 白名单：
   - KaTeX：`span[class]` 白名单 `katex-*` 前缀 + `aria-label` + `style`
   - Task list：`input[type][checked][disabled][class]`
4. 加载 KaTeX CSS（全局或按需）
5. 添加 task-list / footnote / sub-sup 的配套 CSS
6. CSP：当前 `unsafe-eval` 已允许，KaTeX 不需要额外 CSP 放宽

## agate 五字段

```yaml
task: "为 Markdown 渲染添加 KaTeX 数学公式、任务列表 checkbox、脚注、上标/下标四项扩展"
known_risks:
  - "DOMPurify 与 KaTeX 输出兼容性：KaTeX 生成大量 class=katex-* 的 span，DOMPurify 可能删除"
  - "$ 分隔符与货币符号冲突"
  - "KaTeX CSS 全局引入可能影响现有样式"
  - "脚注锚点在 SPA 中的滚动行为需验证"
executor_env:
  platform: "opencode"
  has_task_tool: true
  has_local_runtime: true
  network: "full"
env_constraints:
  debug_env: "make debug (:8888, /tmp/peekview-debug/)"
  no_prod_touch: true
  frontend_only: true
pruning_tendency: "保守（标准 P0-P8，P3 可简化：纯前端无后端变更，单元测试覆盖解析即可）"
```

## 裁剪倾向

- 标准流程（P0-P8），但 P3 可简化（纯前端渲染，无后端变更，单元测试覆盖解析即可）
