# PeekView HTML 多文件资源注入 技术设计文档

> 版本: 1.3
> 日期: 2026-05-18
> 状态: 草案（已纳入两轮专家评审意见）
> 关联: [spec-html-render.md](spec-html-render.md) §3.4 多文件行为 — 已知限制扩展
> 前置: HTML 网页渲染功能已上线（HtmlViewer.vue）
> 评审: [spec-html-multi-file-inject-review.md](../reviews/spec-html-multi-file-inject-review.md)

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
1. EntryDetailView 检测到当前文件为 HTML，并行 fetch 同条目其他文本文件内容
2. HtmlViewer 接收 props: content + siblingFiles + loadingSiblings
3. loadingSiblings=true 时显示 Loading 态
4. DOMParser 解析 HTML，提取相对路径引用节点
5. 对每个引用：在 siblingFiles 中匹配 filename
6. 匹配成功：用文件内容替换节点（link→style, script→inline script）
   type="module" 排除注入，保留原节点 404 → 警告条
7. serializeDocument（保留 DOCTYPE）→ 创建 Blob URL
8. 匹配失败：保留原节点（iframe 中自然 404，计入警告条）
```

### 3.3 数据流

```
EntryDetailView
  │  并行 fetch 兄弟文件内容（B2 方案：View 负责数据获取）
  │  props: content (当前 HTML 文件内容)
  │  props: siblingFiles [{filename, content, language}]
  │  props: loadingSiblings (bool，明确表达 fetch 状态)
  ↓
HtmlViewer（只负责注入和渲染，不做数据获取）
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
  // 排除绝对 URL 和特殊协议
  if (/^(https?:\/\/|data:|blob:|mailto:|tel:)/.test(trimmed)) return null
  if (trimmed.startsWith('//')) return null
  if (trimmed.startsWith('#')) return null
  // 排除绝对路径（以 / 开头），在 Blob URL 上下文中无法解析，不做注入
  if (trimmed.startsWith('/')) return null
  return trimmed.replace(/^\.\//,'')
}
```

### 3.5 替换规则

**CSS — `<link>` → `<style>`**：

仅处理 `rel="stylesheet"` 的 `<link>`。`rel="icon"`、`rel="preload"` 等不替换。

**JS — `<script src>` → `<script>`**：

仅处理无 `type` 或 `type="text/javascript"` 的 `<script>`。

**`type="module"` 排除注入**：inline module 无文件 URL，内部 `import` 语句会**静默失败**（无任何报错提示）。保留原 `<script src="..." type="module">` 节点，让它在 Blob URL 下自然 404 → 计入警告条，行为透明可预期。

### 3.6 安全性

| 关注点 | 评估 |
|--------|------|
| 路径遍历 | 不涉及文件系统操作，纯字符串匹配 + 内存中 DOM 操作 ✅ |
| CSP | Blob URL iframe 运行在 null origin，不继承父页面 CSP ✅ |
| 父页面隔离 | sandbox 无 `allow-same-origin`，无法访问父页面 cookie/DOM ✅ |

**注入内容的执行风险（已知，接受）：**

自动注入会在用户打开 HTML 文件时，下载并执行同条目内所有被引用的文本文件。对于 public entry，这意味着上传者的任意 JS 文件会在访客设备上的 sandbox 内**自动执行，访客无感知**。

风险边界：sandbox `allow-scripts` 且不含 `allow-same-origin`/`allow-popups`/`allow-forms`，执行结果被隔离在 iframe 内，无法访问父页面 cookie/DOM，无法发起顶层导航。**已接受的剩余风险**：iframe 内仍可发起外部 fetch（遥测/追踪）、消耗 CPU/内存、展示任意 UI（钓鱼界面）。

此风险与"HTML 内已有 `<script>` 标签直接执行"在本质上相同。PeekView 定位为代码/文件分享工具，查看他人内容本身即意味着接受该风险。当前接受此风险；如未来面向安全敏感企业场景，可在 public entry 首次加载时加确认弹窗。

---

## 4. 实现细节

### 4.1 修改文件清单

| 文件 | 变更 |
|------|------|
| `frontend-v3/src/components/HtmlViewer.vue` | 新增 `siblingFiles` / `loadingSiblings` prop；注入逻辑；更新警告条 |
| `frontend-v3/src/views/EntryDetailView.vue` | 并行 fetch 兄弟文件内容，传给 HtmlViewer |
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
  siblingFiles?: SiblingFile[]  // 兄弟文件内容，fetch 完成后传入
  loadingSiblings?: boolean     // 明确表达"正在 fetch 兄弟文件"状态
}>()
// 不用 siblingFiles=undefined 隐式表达 loading 态：
// undefined 是 prop 未提供的合法默认值，语义不清晰且脆弱。
```

**注入函数**（返回注入后 HTML 和未匹配引用数，避免两次 DOMParser 解析）：

```typescript
function injectResources(
  html: string,
  siblings: SiblingFile[]
): { html: string; unmatchedCount: number } {
  if (!siblings || siblings.length === 0) {
    return { html, unmatchedCount: countRelativePaths(html) }
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  const fileMap = new Map(
    siblings
      .map(f => [normalizeRef(f.filename), f.content] as const)
      .filter((entry): entry is [string, string] => entry[0] !== null)
  )

  // CSS: <link rel="stylesheet"> → <style>
  doc.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
    const href = normalizeRef(link.getAttribute('href') ?? '')
    if (!href || !fileMap.has(href)) return
    const style = doc.createElement('style')
    style.textContent = `/* injected from: ${href} */\n${fileMap.get(href)}`
    link.replaceWith(style)
  })

  // JS: <script src> → inline <script>
  // type="module" 排除注入：inline module 内部 import 静默失败，
  // 保留原节点 404 → 计入警告条，行为更透明
  doc.querySelectorAll('script[src]').forEach(script => {
    const src = normalizeRef(script.getAttribute('src') ?? '')
    if (!src || !fileMap.has(src)) return
    const type = script.getAttribute('type')
    if (type && type !== 'text/javascript') return
    const inline = doc.createElement('script')
    inline.textContent = `/* injected from: ${src} */\n${fileMap.get(src)}`
    script.replaceWith(inline)
  })

  const unmatchedCount = countRelativePathsInDoc(doc)
  return { html: serializeDoc(doc), unmatchedCount }
}

/**
 * 保留 DOCTYPE，避免浏览器进入 quirks mode。
 * DOCTYPE 丢失时，盒模型等 CSS 行为不同，Agent 生成的 HTML 通常有 DOCTYPE。
 */
function serializeDoc(doc: Document): string {
  const dt = doc.doctype
  const doctypeStr = dt ? `<!DOCTYPE ${dt.name}>` : '<!DOCTYPE html>'
  return doctypeStr + '\n' + doc.documentElement.outerHTML
}

function countRelativePaths(html: string): number {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return countRelativePathsInDoc(doc)
}

function countRelativePathsInDoc(doc: Document): number {
  const attrs = [
    ...Array.from(doc.querySelectorAll('[href]')).map(el => el.getAttribute('href') ?? ''),
    ...Array.from(doc.querySelectorAll('[src]')).map(el => el.getAttribute('src') ?? ''),
  ]
  return attrs.filter(a => a && normalizeRef(a) !== null).length
}
```

**创建 Blob 前调用**：

```typescript
function initRender(content: string) {
  if (!content) return
  if (isBlockedBySize.value && !manuallyTriggered.value) return

  const { html: processed, unmatchedCount } = injectResources(
    content,
    props.siblingFiles ?? []
  )
  relativePathWarningCount.value = unmatchedCount
  revokeBlobUrl(blobUrl.value)
  isLoading.value = true
  blobUrl.value = createBlobUrl(processed)
}
```

### 4.3 相对路径警告更新

`injectResources` 同时返回 `{ html, unmatchedCount }`，直接用于警告条计数，无需二次 DOMParser 解析。

- 注入成功的节点已替换，`countRelativePathsInDoc` 统计时不再出现
- 未匹配节点保留，继续被统计

**示例：**
- 3 个引用，2 个注入成功，1 个找不到文件 → `unmatchedCount=1` → 警告条显示"含 1 个本地资源引用"
- 全部注入成功 → `unmatchedCount=0` → 警告条消失
- 单文件场景（无 `siblingFiles`）→ 直接返回原始 HTML 的相对路径计数

### 4.4 EntryDetailView 变更

**背景约束：** `FileResponse` 不含 `content` 字段，前端文件内容按需逐个获取。必须在渲染 HTML 时主动 fetch 兄弟文件内容。

**实现（B2：EntryDetailView 统一 fetch）**：

```typescript
const siblingFilesContent = ref<SiblingFile[]>([])
const isFetchingSiblings = ref(false)
let fetchToken = 0

watch(
  () => entryStore.activeFile,
  async (file) => {
    siblingFilesContent.value = []
    if (!file || file.language !== 'html') return
    if (!currentEntry.value) return

    const siblings = currentEntry.value.files.filter(f => f.id !== file.id && !f.is_binary)
    if (siblings.length === 0) return

    isFetchingSiblings.value = true
    const token = ++fetchToken  // 竞态防护
    try {
      // Promise.allSettled：单文件失败不影响其他文件注入
      const settled = await Promise.allSettled(
        siblings.map(async f => ({
          filename: f.filename,
          language: f.language ?? '',
          content: await api.getFileContent(currentEntry.value!.slug, f.id),
        }))
      )
      if (token !== fetchToken) return  // 已切换文件，丢弃过期结果

      const results = settled
        .filter((r): r is PromiseFulfilledResult<SiblingFile> => r.status === 'fulfilled')
        .map(r => r.value)
      const failedCount = settled.filter(r => r.status === 'rejected').length
      if (failedCount > 0) {
        // toast：N 个资源文件加载失败，部分引用无法注入
      }
      siblingFilesContent.value = results
    } finally {
      if (token === fetchToken) isFetchingSiblings.value = false
    }
  },
  { immediate: true }
)
```

```vue
<HtmlViewer
  :content="entryStore.fileContent"
  :sibling-files="siblingFilesContent"
  :loading-siblings="isFetchingSiblings"
/>
```

**只 fetch 文本文件：** 二进制文件（`is_binary === true`）跳过 fetch，注入阶段也不处理。

---

## 5. 测试计划

### 5.1 单元测试（HtmlViewer.spec.ts）

| 用例 | 验证 |
|------|------|
| 无 siblingFiles | 行为与当前一致，相对路径警告正常 |
| CSS 内联注入 | `<link href="styles.css">` 替换为 `<style>`，含 DOCTYPE |
| JS 内联注入 | `<script src="app.js">` 替换为 inline `<script>` |
| 混合注入 | CSS + JS 同时注入 |
| 文件名带 `./` 前缀 | `href="./styles.css"` 正确匹配 `styles.css` |
| 不匹配的引用 | 保留原节点，计入相对路径警告 |
| 非 stylesheet 的 link | `rel="icon"` 不替换 |
| `type="module"` script | 不注入，保留原节点计入警告 |
| `type="application/json"` | 不替换 |
| 空文件内容 | 不崩溃 |
| loadingSiblings=true | 显示 Loading 态，不渲染 iframe |
| DOCTYPE 保留 | 注入后序列化结果含 `<!DOCTYPE html>` |
| unmatchedCount 正确 | 部分匹配时只计未注入的引用数 |

### 5.2 E2E 测试（html-render.spec.ts）

| 用例 | 验证 |
|------|------|
| 多文件 HTML 应用 | index.html + styles.css + app.js 渲染正确，样式和交互生效 |
| 相对路径警告消失 | 注入成功后无警告条 |
| 部分匹配 | 存在不匹配引用时，仅对未匹配项显示警告 |
| **竞态：快速切换** | 先切到 HTML，立刻切到非 HTML，再切回 HTML；最终渲染内容属于最后一次 HTML 文件，无残留数据 |

---

## 6. 分期计划

| 阶段 | 范围 | 复杂度 |
|------|------|--------|
| **P1** | CSS + JS 文本资源内联注入 | 中等 |
| **P2** | 图片/字体等二进制资源转 data URI | 较高 |
| **P3** | 子目录路径支持（`css/main.css`） | 低（匹配逻辑扩展） |

---

## 6.1 已知限制

| 限制 | 说明 |
|------|------|
| 子目录路径（`css/main.css`）| P1 不支持，P3 再扩展 |
| 二进制资源（图片/字体）| P1 不支持，P2 再扩展 |
| `type="module"` 内部 import | 排除注入，保留原节点 404 + 警告条 |
| JS 动态资源请求 | `fetch('./data.json')` 等不在 DOMParser 检测范围 |
| 空文件内容 | 注入空标签，不崩溃但无效果 |

---

## 7. 替代方案

### 7.1 后端虚拟文件系统

`GET /api/v1/entries/:id/files/:path`，iframe src 指向服务端 URL。**优点**：支持所有资源类型。**缺点**：需改后端、跨域问题、缓存策略复杂。

### 7.2 Service Worker 拦截

**优点**：不改 HTML 结构。**缺点**：scope 限制，sandbox iframe 内 SW 行为不确定。

### 7.3 结论

P1 选内联注入：实现简单，无后端改动，覆盖主流场景。P2 再评估虚拟文件系统。
