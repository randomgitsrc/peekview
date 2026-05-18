# PeekView HTML 多文件资源注入 技术设计文档

> 版本: 1.0
> 日期: 2026-05-18
> 状态: 草案
> 关联: [spec-html-render.md](spec-html-render.md) §3.4 多文件行为 — 已知限制扩展
> 前置: HTML 网页渲染功能已上线（HtmlViewer.vue）

---

## 1. 问题

### 1.1 现状

PeekView 的 HtmlViewer 将 HTML 内容通过 `Blob URL` 渲染到 sandboxed iframe 中：

```typescript
const blob = new Blob([content], { type: 'text/html' })
return URL.createObjectURL(blob)
```

Blob URL 是浏览器内存中的孤立地址（如 `blob:http://127.0.0.1:8888/xxx`），**没有文件系统上下文**。HTML 中的相对路径引用无法解析：

```html
<link rel="stylesheet" href="styles.css">   <!-- 无法加载 -->
<script src="app.js"></script>               <!-- 无法加载 -->
<img src="logo.png">                         <!-- 无法加载 -->
```

当前行为：DOMParser 检测到相对路径后弹出警告条，资源不加载，页面样式/功能缺失。

### 1.2 影响场景

Agent 常见生成模式：

| 场景 | 文件组成 | 当前结果 |
|------|---------|---------|
| 单文件 HTML | `index.html`（内联 CSS/JS） | 正常渲染 |
| 多文件 HTML 应用 | `index.html` + `styles.css` + `app.js` | 样式/脚本丢失 |
| 带图片的页面 | `index.html` + `logo.png` | 图片缺失 |
| 完整前端项目 | 多个 HTML/CSS/JS/图片 | 大量资源丢失 |

多文件 HTML 应用是最常见的 Agent 生成模式之一，当前体验断裂。

---

## 2. 目标

将同一条目内其他文件的**文本资源**（CSS、JS）自动内联注入到 HTML Blob 中，使相对路径引用生效。

**非目标**（P2 阶段）：
- 图片/字体等二进制资源的 data URI 转换
- 子目录结构支持（如 `css/main.css`）
- 跨条目资源引用

---

## 3. 设计方案

### 3.1 核心思路

在创建 Blob URL 前，**用同条目内的文件内容替换 HTML 中的相对路径引用**：

```
<link href="styles.css">  →  <style>/* styles.css 的内容 */</style>
<script src="app.js">     →  <script>/* app.js 的内容 */</script>
```

### 3.2 注入流程

```
1. EntryDetailView 传入当前 HTML 文件内容 + 同条目所有文件列表
2. HtmlViewer 接收 props: content + siblingFiles
3. DOMParser 解析 HTML，提取相对路径引用节点
4. 对每个引用：在 siblingFiles 中匹配 filename
5. 匹配成功：用文件内容替换节点（link→style, script→inline script）
6. 序列化修改后的 HTML → 创建 Blob URL
7. 匹配失败：保留原节点（iframe 中自然 404，与当前行为一致）
```

### 3.3 数据流

```
EntryDetailView
  │  props: content (当前文件内容)
  │  props: siblingFiles (同条目其他文件 [{filename, content, language}])
  ↓
HtmlViewer
  │  1. DOMParser 解析 content
  │  2. 遍历 <link href> / <script src>
  │  3. 匹配 siblingFiles 中的 filename
  │  4. 替换节点
  │  5. 序列化 → Blob URL
  ↓
iframe (sandbox="allow-scripts")
```

### 3.4 匹配规则

| 引用路径 | 匹配 filename | 说明 |
|---------|--------------|------|
| `styles.css` | `styles.css` | 精确匹配 |
| `./app.js` | `app.js` | 去除 `./` 前缀 |
| `css/main.css` | — | P1 不支持带路径引用 |
| `../lib.js` | — | P1 不支持父目录引用 |

规范化逻辑：

```typescript
function normalizeRef(ref: string): string | null {
  const trimmed = ref.trim()
  if (!trimmed) return null
  // 排除绝对路径和特殊协议
  if (/^(https?:|\/\/|data:|#|mailto:|tel:)/.test(trimmed)) return null
  // 去除 ./ 前缀
  return trimmed.replace(/^\.\//, '')
}
```

### 3.5 替换规则

**CSS — `<link>` → `<style>`**：

```html
<!-- 替换前 -->
<link rel="stylesheet" href="styles.css">

<!-- 替换后 -->
<style>/* injected from: styles.css */
body { ... }
</style>
```

仅处理 `rel="stylesheet"` 的 `<link>`。`rel="icon"`、`rel="preload"` 等不替换。

**JS — `<script src>` → `<script>`**：

```html
<!-- 替换前 -->
<script src="app.js"></script>

<!-- 替换后 -->
<script>/* injected from: app.js */
console.log('hello')
</script>
```

仅处理无 `type` 或 `type="text/javascript"` 的 `<script>`。`type="module"` 的 script 注入后仍为 inline，行为一致（module 默认 defer，inline module 也 defer）。

### 3.6 安全性

| 关注点 | 评估 |
|--------|------|
| XSS | iframe sandbox="allow-scripts" 已隔离，注入内容在沙箱内运行，不影响父页面 |
| 注入内容来源 | 同条目文件，用户自己上传的内容，信任级别与主 HTML 一致 |
| 路径遍历 | 不涉及文件系统操作，纯字符串匹配 + 内存中 DOM 操作 |
| CSP | sandbox iframe 继承父页面 CSP，不会因注入而放宽 |

**结论**：注入不增加安全风险。已有 sandbox 保障。

---

## 4. 实现细节

### 4.1 修改文件清单

| 文件 | 变更 |
|------|------|
| `frontend-v3/src/components/HtmlViewer.vue` | 新增 `siblingFiles` prop；注入逻辑；更新警告条判断 |
| `frontend-v3/src/views/EntryDetailView.vue` | 传递 `siblingFiles` 给 HtmlViewer |
| `frontend-v3/src/components/__tests__/HtmlViewer.spec.ts` | 新增多文件注入测试用例 |
| `frontend-v3/e2e/html-render.spec.ts` | 新增多文件 HTML E2E 测试 |

### 4.2 HtmlViewer 变更

**新增 prop**：

```typescript
interface SiblingFile {
  filename: string
  content: string
  language: string
}

const props = defineProps<{
  content: string
  siblingFiles?: SiblingFile[]  // 新增，可选
}>()
```

**注入函数**：

```typescript
function injectResources(html: string, siblings: SiblingFile[]): string {
  if (!siblings || siblings.length === 0) return html

  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  // 构建 filename → content 映射
  const fileMap = new Map(siblings.map(f => [normalizeRef(f.filename)!, f.content]))

  // 替换 <link rel="stylesheet" href="...">
  doc.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
    const href = normalizeRef(link.getAttribute('href') ?? '')
    if (!href || !fileMap.has(href)) return
    const style = doc.createElement('style')
    style.textContent = `/* injected from: ${href} */\n${fileMap.get(href)}`
    link.replaceWith(style)
  })

  // 替换 <script src="...">
  doc.querySelectorAll('script[src]').forEach(script => {
    const src = normalizeRef(script.getAttribute('src') ?? '')
    if (!src || !fileMap.has(src)) return
    const type = script.getAttribute('type')
    // 仅处理无 type 或 text/javascript / module
    if (type && type !== 'text/javascript' && type !== 'module') return
    const inline = doc.createElement('script')
    if (type) inline.setAttribute('type', type)
    inline.textContent = `/* injected from: ${src} */\n${fileMap.get(src)}`
    script.replaceWith(inline)
  })

  return doc.documentElement.outerHTML
}
```

**创建 Blob 前调用**：

```typescript
function initRender(content: string) {
  // ...
  const processed = injectResources(content, props.siblingFiles ?? [])
  blobUrl.value = createBlobUrl(processed)
}
```

### 4.3 相对路径警告更新

注入后，已成功替换的引用不应再计入警告计数。更新 `relativePathCount` 逻辑：

- 先执行注入，再检测剩余未替换的相对路径
- 或者：检测时排除已在 siblingFiles 中匹配的引用

**推荐方案**：注入后对处理过的 HTML 重新检测，只显示真正无法解析的引用数。

### 4.4 EntryDetailView 变更

当前 `EntryDetailView` 已有 `entry.files` 列表。需要将文件内容传递给 HtmlViewer：

```vue
<HtmlViewer
  :content="currentFileContent"
  :sibling-files="siblingFilesForHtml"
/>
```

```typescript
const siblingFilesForHtml = computed(() => {
  if (!entry.value || !currentFile.value) return []
  return entry.value.files
    .filter(f => f.id !== currentFile.value!.id)  // 排除自身
    .map(f => ({
      filename: f.filename,
      content: f.content ?? '',  // 需要文件内容
      language: f.language,
    }))
})
```

**注意**：当前 API 返回的文件列表可能不含 `content`（详情页需要单独获取文件内容）。需要确认 API 是否已在 entry 详情中返回所有文件内容。

---

## 5. 测试计划

### 5.1 单元测试（HtmlViewer.spec.ts）

| 用例 | 验证 |
|------|------|
| 无 siblingFiles | 行为与当前一致，相对路径警告正常 |
| CSS 内联注入 | `<link href="styles.css">` 替换为 `<style>` |
| JS 内联注入 | `<script src="app.js">` 替换为 inline `<script>` |
| 混合注入 | CSS + JS 同时注入 |
| 文件名带 `./` 前缀 | `href="./styles.css"` 正确匹配 `styles.css` |
| 不匹配的引用 | 保留原节点，计入相对路径警告 |
| 非 stylesheet 的 link | `rel="icon"` 不替换 |
| 非 JS 的 script type | `type="application/json"` 不替换 |
| 空文件内容 | 注入空 `<style>` / `<script>`，不崩溃 |

### 5.2 E2E 测试（html-render.spec.ts）

| 用例 | 验证 |
|------|------|
| 多文件 HTML 应用 | index.html + styles.css + app.js 渲染正确，样式和交互生效 |
| 相对路径警告消失 | 注入成功后无警告条 |
| 部分匹配 | 存在不匹配引用时，仅对未匹配项显示警告 |

---

## 6. 分期计划

| 阶段 | 范围 | 复杂度 |
|------|------|--------|
| **P1** | CSS + JS 文本资源内联注入 | 中等 |
| **P2** | 图片/字体等二进制资源转 data URI | 较高 |
| **P3** | 子目录路径支持（`css/main.css`） | 低（匹配逻辑扩展） |

P1 覆盖 90% 的 Agent 生成场景（HTML + CSS + JS 三件套）。

---

## 7. 替代方案

### 7.1 后端虚拟文件系统

为每条目创建虚拟路径，服务端路由解析 `GET /api/v1/entries/:id/files/:path`，iframe src 指向服务端 URL。

**优点**：支持所有资源类型（含二进制）。**缺点**：需改后端 API + 路由，iframe 跨域问题，缓存策略复杂。

### 7.2 Service Worker 拦截

注册 Service Worker 拦截 iframe 内的相对路径请求，从内存中返回对应文件内容。

**优点**：不改 HTML 结构。**缺点**：scope 限制，生命周期管理复杂，sandbox iframe 内 Service Worker 行为不确定。

### 7.3 结论

**P1 选内联注入方案**：实现简单，无后端改动，覆盖主流场景。P2 再评估是否需要虚拟文件系统方案以支持二进制资源。
