# PeekView HTML 二进制资源注入（data URI）技术设计文档

> 版本: 1.1
> 日期: 2026-05-18
> 状态: 已评审（自评审 C1-C4 + I1-I6 已处理）
> 关联: [spec-html-multi-file-inject.md](spec-html-multi-file-inject.md) P2 阶段
> 前置: P1 CSS/JS 文本资源注入已上线

---

## 1. 问题

### 1.1 现状

P1 已实现 CSS/JS 文本资源的内联注入（`<link>` → `<style>`，`<script src>` → inline `<script>`）。多文件 HTML 中的**二进制资源**（图片、字体等）仍然无法加载：

```html
<img src="logo.png">        <!-- 无法加载 -->
<link rel="icon" href="favicon.ico"> <!-- 无法加载 -->
```

当前行为：DOMParser 检测到相对路径后弹出警告条，图片显示为空白/损坏图标。

### 1.2 影响场景

Agent 常见生成模式中，带图片的网页是最常见的多文件 HTML 应用之一。当前体验断裂——样式和脚本已正常工作，但图片缺失。

---

## 2. 目标

将同条目内的**二进制文件**（图片、字体）转为 data URI 内联到 HTML Blob 中，使相对路径引用生效。

**非目标**：
- 音视频文件的大规模 data URI 转换（体积过大，体验差）
- 子目录结构支持（同 P1 限制）

---

## 3. 设计方案

### 3.1 核心思路

在创建 Blob URL 前，用同条目内的二进制文件内容替换 HTML 中的相对路径 `src` 属性：

```
<img src="logo.png"> → <img src="data:image/png;base64,iVBOR...">
```

### 3.2 注入流程

```
1. EntryDetailView 检测到当前文件为 HTML，并行 fetch 同条目其他文件内容
   - 文本文件：用现有 getFileContent（responseType: text）
   - 二进制文件：用新增 getFileAsBase64（下载端点 + responseType: arraybuffer → base64）
2. HtmlViewer 接收 props: content + siblingFiles（含 isBinary/mimeType 标记）
3. injectResources 执行：
   a. CSS 注入（已有）
   b. JS 注入（已有）
   c. 二进制注入：[src] 属性匹配 → 替换为 data URI
4. countRelativePathsInDoc 统计注入后剩余未匹配引用 → 警告条
```

### 3.3 数据流

```
EntryDetailView
  │  并行 fetch 文本 + 二进制兄弟文件
  │  props: siblingFiles [{filename, content, language, isBinary?, mimeType?}]
  ↓
HtmlViewer（只负责注入和渲染）
  │  文本资源：CSS → <style>, JS → inline <script>
  │  二进制资源：src → data URI
  ↓
iframe (sandbox="allow-scripts")
```

### 3.4 二进制 fetch 端点选择

| 端点 | URL | Content-Type | 适用 |
|------|-----|-------------|------|
| content | `/entries/:slug/files/:id/content` | `text/plain`（language=null 时） | 文本文件 |
| download | `/entries/:slug/files/:id` | `application/octet-stream` | **二进制文件** |

二进制文件应使用下载端点，因为 content 端点对 `language=null` 的文件返回 `text/plain; charset=utf-8`，可能导致编码损坏。

### 3.5 MIME type 推断

从文件扩展名推断，不依赖后端 Content-Type（后端二进制文件一律返回 `application/octet-stream`）：

```typescript
const MIME_MAP: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp',
  ico: 'image/x-icon', bmp: 'image/bmp',
  woff: 'font/woff', woff2: 'font/woff2',
  ttf: 'font/ttf', otf: 'font/otf',
}
```

**SVG 不在映射中**：`image/svg+xml` data URI 可包含可执行 JavaScript（即使在 `<img>` 中脚本被抑制，SVG 仍可通过 CSS `url()` 发起外部请求）。安全边界与 P1 一致——sandbox iframe 内的任意内容自动执行，但 SVG 的 CSS 侧信道攻击风险超出图片范畴。SVG 引用保留原节点 → 404 + 警告条。

**音视频不在映射中**：体积膨胀严重（base64 +33%），data URI 播放体验差，不适合内联。音视频引用保留原节点 → 404 + 警告条。

### 3.6 大文件保护

data URI 的 base64 编码比原始体积大约 33%。过大的文件会显著拖慢渲染。

**策略**：超过 `BINARY_SIZE_LIMIT`（默认 1MB）的二进制文件跳过注入，保留原节点 → 计入警告条。用户可在警告条中看到"N 个本地资源引用"的提示，知道哪些资源无法加载。

### 3.7 替换规则

**替换范围**：仅安全的元素类型。`<iframe>`、`<object>`、`<embed>` 的 `src` 属性不替换——这些元素会将 data URI 内容作为嵌套浏览上下文渲染，存在脚本注入风险。

**安全白名单**：`img`、`video`、`audio`、`source`（仅 media context）、`track`

```typescript
const SAFE_SRC_SELECTORS = ['img[src]', 'video[src]', 'audio[src]', 'source[src]', 'track[src]']

doc.querySelectorAll(SAFE_SRC_SELECTORS.join(',')).forEach(el => {
  const src = normalizeRef(el.getAttribute('src') ?? '')
  if (!src || !binaryMap.has(src)) return
  const file = binaryMap.get(src)!
  el.setAttribute('src', `data:${file.mimeType};base64,${file.content}`)
})
```

**favicon 注入**（额外分支）：`<link rel="icon" href="favicon.ico">` 是最常见的二进制引用之一，现代浏览器（Chrome/Firefox/Edge）支持 `data:image/x-icon;base64,...`。单独处理：

```typescript
doc.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]').forEach(link => {
  const href = normalizeRef(link.getAttribute('href') ?? '')
  if (!href || !binaryMap.has(href)) return
  const file = binaryMap.get(href)!
  link.setAttribute('href', `data:${file.mimeType};base64,${file.content}`)
})
```

**不替换**：
- `<iframe src>`、`<object src>`、`<embed src>` — 安全风险
- `<a href="file.pdf">` — 非资源引用
- 绝对 URL / 协议引用 — 已由 `normalizeRef` 过滤
- 无 MIME type 的二进制文件 — 跳过

### 3.8 安全性

| 关注点 | 评估 |
|--------|------|
| data URI 执行风险 | 图片/字体 data URI 不可执行 ✅。SVG **排除**（可含 JS + CSS 侧信道攻击） |
| iframe/object/embed | `src` 属性白名单排除这些元素，防止嵌套浏览上下文注入 ✅ |
| sandbox 隔离 | 不变 ✅ |
| 体积膨胀 | base64 +33%，768KB 上限 → 注入后约 1MB ✅ |
| favicon | `link[rel=icon]` href 注入为 data URI，现代浏览器支持 ✅（Safari 不完全支持，但不影响功能） |

---

## 4. 实现细节

### 4.1 修改文件清单

| 文件 | 变更 |
|------|------|
| `frontend-v3/src/api/client.ts` | 新增 `getFileAsBase64` 方法 |
| `frontend-v3/src/utils/mime.ts` | 新建，MIME_MAP + guessMimeType |
| `frontend-v3/src/components/HtmlViewer.vue` | SiblingFile 标签联合，injectResources 增加二进制注入分支，安全元素白名单 |
| `frontend-v3/src/views/EntryDetailView.vue` | 移除 isBinary 过滤，二进制文件走 getFileAsBase64，大文件跳过 |
| `frontend-v3/src/components/__tests__/HtmlViewer.spec.ts` | 二进制注入测试组 |
| `frontend-v3/e2e/html-render.spec.ts` | 图片注入 E2E 测试 |

### 4.2 API Client 变更

```typescript
async getFileAsBase64(slug: string, fileId: number): Promise<string> {
  const response = await this.client.get(
    `/entries/${slug}/files/${fileId}`,
    { responseType: 'arraybuffer' }
  )
  const bytes = new Uint8Array(response.data)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}
```

逐字节循环避免 `Function.prototype.apply` 的 call stack 限制（不同 JS 引擎阈值不同）。对 1MB 以下的文件（约 1M 次循环），耗时在毫秒级，可接受。

### 4.3 SiblingFile 接口扩展

使用标签联合类型（discriminated union）防止文本/base64 混用：

```typescript
interface TextSiblingFile {
  filename: string
  content: string       // 文本内容（CSS/JS 源码）
  language: string
  isBinary: false
}

interface BinarySiblingFile {
  filename: string
  content: string       // base64 编码的二进制内容
  mimeType: string      // 如 'image/png'
  isBinary: true
}

type SiblingFile = TextSiblingFile | BinarySiblingFile
```

这保证 `injectResources` 中文本分支和二进制分支使用不同 map，不会误将 base64 注入到 `<style>` 或 `<script>` 中。

### 4.4 injectResources 变更

在现有 CSS/JS 注入逻辑之后，新增二进制资源注入分支。注意：文本/二进制使用**不同的 map**，避免跨类型污染。

```typescript
// 二进制资源：安全元素 src → data URI
const binarySiblings = siblings.filter((f): f is BinarySiblingFile => f.isBinary === true && 'mimeType' in f)
if (binarySiblings.length > 0) {
  const binaryMap = new Map(
    binarySiblings
      .map(f => [normalizeRef(f.filename), f] as const)
      .filter((entry): entry is [string, BinarySiblingFile] => entry[0] !== null)
  )

  // 安全 src 元素白名单
  const SAFE_SRC_SELECTORS = ['img[src]', 'video[src]', 'audio[src]', 'source[src]', 'track[src]']
  doc.querySelectorAll(SAFE_SRC_SELECTORS.join(',')).forEach(el => {
    const src = normalizeRef(el.getAttribute('src') ?? '')
    if (!src || !binaryMap.has(src)) return
    const file = binaryMap.get(src)!
    el.setAttribute('src', `data:${file.mimeType};base64,${file.content}`)
  })

  // favicon：<link rel="icon" href> → data URI
  doc.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]').forEach(link => {
    const href = normalizeRef(link.getAttribute('href') ?? '')
    if (!href || !binaryMap.has(href)) return
    const file = binaryMap.get(href)!
    link.setAttribute('href', `data:${file.mimeType};base64,${file.content}`)
  })
}
```

### 4.5 EntryDetailView 变更

```typescript
const BINARY_SIZE_LIMIT = 768 * 1024  // 768KB 原始大小 → base64 后约 1MB

const siblings = currentEntry.value.files.filter(f => f.id !== file.id)
// 不再排除 isBinary

const settled = await Promise.allSettled(
  siblings.map(async f => {
    if (f.isBinary) {
      // 大文件跳过（768KB 原始 → base64 后约 1MB 注入到 Blob）
      if (f.size > BINARY_SIZE_LIMIT || f.size === 0) return null
      const mimeType = guessMimeType(f.filename)
      if (!mimeType) return null  // 无法推断 MIME type，跳过

      const base64 = await api.getFileAsBase64(currentEntry.value!.slug, f.id)
      return {
        filename: f.filename,
        content: base64,
        isBinary: true as const,
        mimeType,
      } satisfies BinarySiblingFile
    }
    return {
      filename: f.filename,
      language: f.language ?? '',
      content: await api.getFileContent(currentEntry.value!.slug, f.id),
      isBinary: false as const,
    } satisfies TextSiblingFile
  })
)

// 过滤掉 null 结果（跳过的大文件 / 无 MIME type / 0 字节文件）
const results = settled
  .filter((r): r is PromiseFulfilledResult<SiblingFile | null> => r.status === 'fulfilled')
  .map(r => r.value)
  .filter((v): v is SiblingFile => v !== null)
```

**guessMimeType 函数**放置位置：`frontend-v3/src/utils/mime.ts`（独立工具文件），HtmlViewer 和 EntryDetailView 共同 import。

---

## 5. 测试计划

### 5.1 单元测试

| 用例 | 验证 |
|------|------|
| 图片 data URI 注入 | `<img src="logo.png">` src 变为 `data:image/png;base64,...` |
| favicon 注入 | `<link rel="icon" href="favicon.ico">` href 变为 `data:image/x-icon;base64,...` |
| iframe/object 不注入 | `<iframe src="page.html">` src 保留原值不变 |
| SVG 不注入 | `<img src="chart.svg">` src 保留原值（SVG 不在 MIME_MAP） |
| 不支持的扩展名 | `.exe` 等无 mimeType 的二进制文件不注入，计入 unmatchedCount |
| 大文件跳过 | > 768KB 的二进制文件不注入，保留原 src |
| 0 字节文件跳过 | 0 字节的二进制文件不注入 |
| 混合注入 | CSS + JS + 图片同时注入，全部成功 |
| 全部注入后警告消失 | CSS + JS + 图片 + favicon 全部匹配时无警告条 |
| href 属性不替换 | `<a href="file.pdf">` 不受影响 |
| guessMimeType 单元测试 | 已知扩展名返回正确 MIME，未知返回 null |

### 5.2 E2E 测试

| 用例 | 验证 |
|------|------|
| 图片注入可见 | index.html + logo.png → iframe 内图片正常显示 |
| 全部注入无警告 | CSS + JS + 图片全部注入 → 无警告条 |

---

## 6. 已知限制

| 限制 | 说明 |
|------|------|
| 大文件（> 768KB）| 跳过注入，保留原节点 + 警告条。768KB 原始 → base64 后约 1MB |
| SVG | 不注入（安全风险：可含 JS/CSS 侧信道），保留原节点 |
| 音视频 | 不注入（体积膨胀 + 播放体验差），保留原节点 |
| 子目录路径 | 同 P1 限制，匹配使用 filename（不含 path），P3 扩展 |
| CSS 背景图片 | `background-image: url(logo.png)` 不在 DOMParser 检测范围（`url()` 在 inline style 中不可检测）|
| 多次引用同一图片 | 同一图片引用 N 次则 base64 重复 N 次，Blob 体积膨胀 N × 33% |
| `<picture>` / `srcset` | `srcset` 属性不处理，仅处理 `src` |
| Safari favicon data URI | Safari 对 `link[rel=icon]` data URI 支持不完全 |

---

## 附录：自评审记录（v1.0 → v1.1）

| 编号 | 级别 | 问题 | 处置 |
|------|------|------|------|
| C1 | CRITICAL | SVG data URI 可含 JS/CSS 侧信道 | 从 MIME_MAP 移除 SVG，保留原节点 |
| C2 | CRITICAL | `[src]` 选择器过宽，匹配 iframe/object/embed | 改为安全元素白名单：img/video/audio/source/track |
| C3 | CRITICAL | btoa + String.fromCharCode.apply 可能 stack overflow | 改为逐字节循环（无 apply） |
| C4 | CRITICAL | SiblingFile content 双义（文本/base64）易混用 | 改为标签联合类型 TextSiblingFile / BinarySiblingFile |
| I1 | IMPORTANT | chunk size 跨引擎不一致 | 逐字节循环方案已解决 |
| I2 | IMPORTANT | favicon 注入缺失 | 新增 link[rel=icon] href → data URI 分支 |
| I3 | IMPORTANT | guessMimeType 放在 HtmlViewer 不合理 | 移至 `src/utils/mime.ts` |
| I4 | IMPORTANT | btoa 失败无处理 | Promise.allSettled 已覆盖，文档补充说明 |
| I5 | IMPORTANT | CSS url() 不在警告检测范围 | 已知限制表补充说明 |
| I6 | IMPORTANT | 1MB 限制未考虑 base64 +33% 膨胀 | 改为 768KB 原始限制（base64 后约 1MB） |
| M1 | MINOR | srcset 不处理 | 已知限制表补充 |
| M2 | MINOR | MIME_MAP 含音视频但声明为非目标 | 已从 MIME_MAP 移除 |
| M3 | MINOR | 多次引用同一图片 base64 重复 | 已知限制表补充 |
| M4 | MINOR | 二进制文件 language 无意义 | 标签联合类型中 BinarySiblingFile 不含 language |
| M5 | MINOR | 0 字节文件 | 新增 size === 0 跳过逻辑 |
| M7 | MINOR | getFileAsBase64 无单元测试 | 测试计划新增 guessMimeType 单元测试