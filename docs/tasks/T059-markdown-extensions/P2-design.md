---
phase: P2
task_id: T059
type: design
parent: P1-requirements.md
trace_id: T059-P2-20260720
status: draft
created: 2026-07-20
agent: architect
---

# P2 Design: Markdown 扩展补全（KaTeX + Task List + Footnote + Sub/Sup）

## 影响域分析

### 改什么

| 文件 | 改动内容 |
|------|----------|
| `frontend-v3/package.json` | 添加 6 个直接依赖 |
| `frontend-v3/src/composables/useMarkdown.ts` | 注册 6 个 markdown-it 插件 |
| `frontend-v3/src/components/MarkdownViewer.vue` | 添加脚注链接点击拦截 + scrollIntoView；添加扩展 CSS（脚注/任务列表/KaTeX 暗色模式/溢出滚动） |
| `frontend-v3/src/main.ts` | 添加 `import 'katex/dist/katex.min.css'` |
| `frontend-v3/src/composables/__tests__/useMarkdown.svg.spec.ts` | DOMPurify config 同步（若 P5 发现需扩展白名单） |

### 不改什么

- 后端 API / 数据库 / MCP / CLI — 纯前端变更
- `SvgRenderer.vue` 的 DOMPurify 配置 — SVG 渲染路径不涉及 markdown 扩展
- `useMarkdown.ts` 的 DOMPurify ADD_ATTR/ADD_TAGS — 最小验证确认默认白名单已覆盖
- 现有 markdown-it 配置（html/linkify/typographer）— 不变
- 现有代码块/图表/前置元数据渲染逻辑 — 不变
- Vue Router 配置 — 脚注锚点不触发路由导航

### 风险在哪

| 风险 | 严重度 | 缓解 |
|------|--------|------|
| DOMPurify 剥离 `<annotation>`/`<semantics>` | 低 | 仅影响 MathML 可访问性，视觉渲染不受影响。可接受 |
| KaTeX CSS 24KB 增加首屏体积 | 低 | Vite 会 tree-shake + gzip，实际增量约 6-8KB。全局 import 是正确方式（KaTeX CSS 是渲染必需品） |
| 脚注锚点在 overflow:auto 容器内不滚动 | 中 | 已确认需 scrollIntoView 拦截，方案已设计 |
| `$` 分隔符与货币冲突 | 低 | 插件内置智能分隔符（$ 后跟数字不触发），BDD 覆盖 |
| 插件注册顺序影响解析 | 低 | markdown-it 插件按注册顺序解析，KaTeX 需在 sub/sup 之前注册（$ 分隔符优先级高于 ^/~） |

## §1 候选方案

### 方案 A：全局注册 + 全局 CSS + scrollIntoView 拦截（推荐）

**设计**：
1. 在 `useMarkdown.ts` 的 `new MarkdownIt()` 后按顺序注册 6 个插件：katex → task-lists → footnote → sub → sup
2. 在 `main.ts` 全局 import `katex/dist/katex.min.css`（Vite 处理为 CSS chunk，首屏加载）
3. 在 `MarkdownViewer.vue` 的 `<style>` 中添加脚注/任务列表/KaTeX 暗色模式/溢出滚动的 CSS
4. 在 `MarkdownViewer.vue` 的 `handleLinkClick` 中拦截脚注链接（`a[href^="#fn"]` 和 `a.footnote-backref`），调用 `scrollIntoView({ behavior: 'smooth', block: 'start' })`
5. DOMPurify 配置不变（默认白名单已覆盖）

**优点**：
- 与现有模式一致（CSS 全局 import 在 main.ts，click handler 在 MarkdownViewer.vue）
- scrollIntoView 模式已有先例（TocNav.vue、EntryDetailView.vue）
- KaTeX CSS 全局加载避免 FOUC，Vite 自动优化
- 零运行时开销（插件注册一次，CSS 静态加载）

**风险**：
- KaTeX CSS 24KB 增加首屏体积（可接受，gzip 后约 6-8KB）
- 全局 CSS 可能与现有样式冲突（KaTeX CSS 作用域在 `.katex` 下，冲突概率极低）

**工作量**：小（~100 行代码变更，主要是 CSS）

### 方案 B：按需加载 KaTeX CSS + 动态插件注册

**设计**：
1. 插件注册同方案 A
2. KaTeX CSS 不在 main.ts 全局 import，而是在 `useMarkdown.ts` 的 `render()` 中动态 `import('katex/dist/katex.min.css')`
3. 首次渲染含数学公式的 entry 时加载 CSS
4. 脚注滚动和 DOMPurify 同方案 A

**优点**：
- 不含数学公式的 entry 不加载 KaTeX CSS（节省 24KB）

**风险**：
- 首次渲染含数学公式的 entry 会有 FOUC（CSS 异步加载，HTML 先渲染）
- 动态 import 增加渲染路径复杂度
- Vite 的 CSS code-splitting 对动态 import 生成独立 chunk，可能延迟加载
- 违反 P1 隐含需求 2.2（"KaTeX CSS 必须在首屏渲染前加载完成，避免 FOUC"）

**工作量**：中（需处理动态 import + FOUC + 加载状态）

### 选择理由

**选方案 A**。理由：
1. P1 隐含需求 2.2 明确要求"KaTeX CSS 必须在首屏渲染前加载完成，避免 FOUC"，方案 B 违反此需求
2. 24KB CSS 在 Vite 构建后 gzip 约 6-8KB，对首屏性能影响可忽略
3. 方案 A 与现有 CSS 加载模式一致（main.ts 全局 import）
4. 方案 A 零 FOUC 风险，方案 B 需额外处理

## §2 详细设计

### 2.1 插件注册顺序

```typescript
// useMarkdown.ts — 在 new MarkdownIt() 后
import mkKatex from '@iktakahiro/markdown-it-katex'
import mkTaskLists from 'markdown-it-task-lists'
import mkFootnote from 'markdown-it-footnote'
import mkSub from 'markdown-it-sub'
import mkSup from 'markdown-it-sup'

md.use(mkKatex)
md.use(mkTaskLists)
md.use(mkFootnote)
md.use(mkSub)
md.use(mkSup)
```

**注册顺序理由**：
- KaTeX 最先注册：`$` 分隔符需在 `^`/`~` 之前匹配，避免 `$x^2$` 被 sub/sup 插件先解析
- Task lists 在 footnote 前：两者都修改列表渲染，task-lists 更简单先注册
- Sub/Sup 最后：`^`/`~` 是最宽松的分隔符，最后注册避免误匹配

### 2.2 KaTeX CSS 加载

```typescript
// main.ts — 在现有 CSS import 后添加
import 'katex/dist/katex.min.css'
```

Vite 会将此 CSS 提取到构建产物中，与现有 CSS 一起在首屏加载。无需额外配置。

### 2.3 脚注链接点击拦截

在 `MarkdownViewer.vue` 的现有 `handleLinkClick` 函数中扩展逻辑：

```typescript
function handleLinkClick(e: MouseEvent) {
  const target = (e.target as Element).closest('a')
  if (!target) return

  // 1. 优先处理文件链接（现有逻辑）
  const fileId = target.getAttribute('data-peekview-file-id')
  if (fileId) {
    e.preventDefault()
    emit('navigate-file', parseInt(fileId, 10))
    return
  }

  // 2. 处理脚注链接（href 以 #fn 开头，或 class 含 footnote-backref）
  const href = target.getAttribute('href')
  if (href && href.startsWith('#')) {
    const isFootnoteLink = href.startsWith('#fn') || target.classList.contains('footnote-backref')
    if (isFootnoteLink) {
      e.preventDefault()
      const targetId = href.slice(1)
      const targetEl = contentRef.value?.querySelector(`[id="${CSS.escape(targetId)}"]`)
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
      return
    }
  }
}
```

**关键设计决策**：
- 使用 `CSS.escape(targetId)` 处理含冒号的 ID（如 `fnref1:1`），确保 `querySelector` 正确
- 不使用 `document.getElementById`（会搜索整个文档，可能匹配到其他 entry 的元素）
- 在 `contentRef.value` 范围内查找，确保只滚动当前 entry 的内容
- `e.preventDefault()` 阻止原生 hash 导航（不会滚动 overflow:auto 容器）和 Vue Router 导航

### 2.4 CSS 样式

所有新增 CSS 写在 `MarkdownViewer.vue` 的非 scoped `<style>` 块中（与现有暗色模式 CSS 同一位置）。

#### 脚注样式

```css
.markdown-body .footnotes-sep {
  margin: 2rem 0 1rem;
  border: none;
  border-top: 1px solid var(--border-color, #d0d7de);
}

.markdown-body .footnotes {
  font-size: 0.875em;
  color: var(--text-secondary, #656d76);
}

.markdown-body .footnotes-list {
  list-style: decimal;
  padding-left: 2rem;
}

.markdown-body .footnote-ref {
  font-size: 0.75em;
  vertical-align: super;
}

.markdown-body .footnote-backref {
  text-decoration: none;
}

[data-theme='dark'] .markdown-body .footnotes-sep {
  border-top-color: #30363d;
}

[data-theme='dark'] .markdown-body .footnotes {
  color: #8b949e;
}
```

#### 任务列表样式

```css
.markdown-body .contains-task-list {
  list-style: none;
  padding-left: 0;
}

.markdown-body .task-list-item {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.markdown-body .task-list-item-checkbox {
  margin: 0;
  accent-color: var(--accent-color, #1f6feb);
  pointer-events: none;
}

[data-theme='dark'] .markdown-body .task-list-item-checkbox {
  accent-color: #58a6ff;
}
```

#### KaTeX 暗色模式

```css
[data-theme='dark'] .markdown-body .katex {
  color: #c9d1d9;
}
```

KaTeX CSS 使用 `.katex` 下的颜色继承，覆盖 `.katex` 的 `color` 即可。MathML 层（`.katex-mathml`）设为 `display:none`，无需暗色适配。

#### KaTeX 块级公式溢出滚动

```css
.markdown-body .katex-block {
  overflow-x: auto;
  overflow-y: hidden;
}
```

覆盖 B29（块级公式溢出可滚动）。

### 2.5 DOMPurify 配置

**不变**。最小验证确认：
- DOMPurify 3.x 默认白名单 + 当前 ADD_ATTR/ADD_TAGS 已覆盖所有扩展输出
- 唯一剥离：`<semantics>` 和 `<annotation>`（MathML 可访问性元素，视觉渲染不受影响）
- 若 P5 实测发现需扩展白名单，3 处调用点（useMarkdown.ts、SvgRenderer.vue、svg.spec.ts）需同步修改

### 2.6 依赖添加

```json
{
  "dependencies": {
    "@iktakahiro/markdown-it-katex": "^1.0.1",
    "katex": "^0.16.47",
    "markdown-it-task-lists": "^2.1.1",
    "markdown-it-footnote": "^4.0.0",
    "markdown-it-sub": "^2.0.0",
    "markdown-it-sup": "^2.0.0"
  }
}
```

注意：`katex` 已在 node_modules（mermaid 间接依赖），但需声明为直接依赖以确保版本锁定和类型可用。

## §3 实现完成标志

1. `useMarkdown.ts` 注册 6 个插件，渲染输出包含对应 HTML 结构
2. `main.ts` 全局 import KaTeX CSS，Vite 构建产物包含 katex 样式
3. `MarkdownViewer.vue` 脚注链接点击后 scrollIntoView 到目标位置
4. 暗色模式下 KaTeX 公式、checkbox、脚注文字颜色正确
5. 块级公式溢出时横向可滚动
6. DOMPurify sanitize 后 KaTeX/footnote/tasklist 输出结构完整
7. 现有功能（表格/删除线/代码块/Mermaid/PlantUML/SVG）不受影响

## §4 声明字段

```yaml
packages:
  - frontend-v3

domains:
  - frontend

ui_affected: true
ui_interaction_points:
  - "脚注引用链接点击 → scrollIntoView 到脚注定义"
  - "脚注回引链接点击 → scrollIntoView 回引用位置"
  - "任务列表 checkbox 显示（只读，不可交互）"
  - "KaTeX 公式渲染（行内 + 块级）"
  - "暗色模式下公式/checkbox/脚注颜色"

gate_commands:
  P5: "cd frontend-v3 && ./.venv-placeholder 2>/dev/null; cd frontend-v3 && npx vitest run --reporter=dot 2>&1 | tail -30"
  P5_e2e: "cd frontend-v3 && npx playwright test --reporter=line e2e/ 2>&1 | tail -40"

env_constraints:
  debug_env: "make debug (:8888, /tmp/peekview-debug/)"
  isolation_check: "sqlite3 /tmp/peekview-debug/peekview.db 'SELECT COUNT(*) FROM entries' 2>/dev/null || echo 'debug db not found'"

files_to_read:
  - path: frontend-v3/src/composables/useMarkdown.ts
    why: 插件注册位置 + DOMPurify 调用点
  - path: frontend-v3/src/components/MarkdownViewer.vue
    why: 脚注链接拦截 + CSS 样式添加位置
  - path: frontend-v3/src/main.ts
    why: KaTeX CSS 全局 import 位置
  - path: frontend-v3/package.json
    why: 依赖添加
  - path: frontend-v3/src/composables/__tests__/useMarkdown.svg.spec.ts
    why: DOMPurify PURIFY_CONFIG 常量定义（若需同步修改）
  - path: frontend-v3/src/components/renderers/SvgRenderer.vue:72-76
    why: DOMPurify 第三处调用点（若需同步修改）
  - path: frontend-v3/src/styles/base.css:8-10
    why: scroll-behavior: smooth 已设，确认无需修改

minimal_validation:
  - assumption: "DOMPurify 3.x 默认白名单 + 当前 ADD_ATTR/ADD_TAGS 能让 KaTeX 完整输出通过"
    method: "Node.js 脚本调用 dompurify + jsdom + katex，对比 sanitize 前后输出"
    result: "confirmed"
    note: "KaTeX 视觉渲染部分（katex-html/katex-display/strut/style/class）全部保留。仅 <semantics>/<annotation>（MathML 可访问性）被剥离，视觉渲染不受影响。P5 需实测完整公式渲染。"
  - assumption: "脚注锚点在 overflow:auto 容器内需 scrollIntoView 拦截，原生 hash 导航不滚动子容器"
    method: "代码分析 + HTML 测试页验证：.markdown-viewer 设 overflow:auto，原生 #hash 只滚动 document"
    result: "confirmed"
    note: "原生 hash 导航滚动 document 而非 overflow:auto 子容器。必须拦截脚注链接点击并调用 scrollIntoView。已有先例：TocNav.vue 和 EntryDetailView.vue 使用相同模式。"
  - assumption: "DOMPurify 3.x 默认白名单覆盖 footnote/tasklist/sub/sup 输出"
    method: "Node.js 脚本调用 dompurify + jsdom + markdown-it-footnote/task-lists，验证 sanitize 后结构完整"
    result: "confirmed"
    note: "footnote-ref/footnotes-sep/footnotes-list/footnote-backref/id/href 全部保留。checkbox type/checked/disabled 全部保留。含冒号 ID（fnref1:1）保留。"
