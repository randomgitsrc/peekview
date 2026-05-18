# Plan: HTML 二进制资源注入（data URI）

Spec: `docs/specs/spec-html-binary-inject.md` v1.1（已通过自评审）

## Context

P1 CSS/JS 文本资源注入已上线。多文件 HTML 中的图片等二进制资源仍然无法加载（Blob URL 无文件系统上下文）。本计划将同条目内的二进制文件转为 data URI 内联到 HTML Blob 中，使 `<img src="logo.png">` 等引用生效。

## Implementation Order

6 steps, grouped by dependency.

---

### Step 1: `src/utils/mime.ts` — MIME type 推断工具

新建文件，MIME_MAP + guessMimeType，HtmlViewer 和 EntryDetailView 共同 import。

```typescript
const MIME_MAP: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp',
  ico: 'image/x-icon', bmp: 'image/bmp',
  woff: 'font/woff', woff2: 'font/woff2',
  ttf: 'font/ttf', otf: 'font/otf',
}

export function guessMimeType(filename: string): string | null {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return MIME_MAP[ext] ?? null
}
```

---

### Step 2: `src/api/client.ts` — getFileAsBase64 方法

使用下载端点（`/files/:id`）获取原始 bytes → base64。

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

---

### Step 3: `src/components/HtmlViewer.vue` — SiblingFile 标签联合 + 二进制注入

1. SiblingFile 改为标签联合：TextSiblingFile (isBinary: false) / BinarySiblingFile (isBinary: true)
2. injectResources 新增二进制注入分支：
   - 安全 src 元素白名单：img/video/audio/source/track
   - favicon：link[rel=icon] href → data URI
   - iframe/object/embed 不注入（安全风险）

---

### Step 4: `src/views/EntryDetailView.vue` — 二进制文件 fetch

1. 移除 `!f.isBinary` 过滤，所有兄弟文件都尝试 fetch
2. 二进制文件走 getFileAsBase64，文本文件走 getFileContent
3. 大文件保护：> 768KB 或 0 字节的二进制文件跳过（return null）
4. 无法推断 MIME type 的二进制文件跳过

---

### Step 5: 单元测试

`src/components/__tests__/HtmlViewer.spec.ts` 新增二进制注入测试组 (11 用例)
`src/utils/__tests__/mime.spec.ts` 新建 guessMimeType 测试

---

### Step 6: E2E 测试

`e2e/html-render.spec.ts` 新增 2 用例：图片注入可见 + 全部注入无警告

---

## Key Files

| File | Change |
|------|--------|
| `frontend-v3/src/utils/mime.ts` | 新建：MIME_MAP + guessMimeType |
| `frontend-v3/src/api/client.ts` | 新增 getFileAsBase64 |
| `frontend-v3/src/components/HtmlViewer.vue` | SiblingFile 标签联合，二进制注入分支 |
| `frontend-v3/src/views/EntryDetailView.vue` | 移除 isBinary 过滤，二进制 fetch |
| `frontend-v3/src/components/__tests__/HtmlViewer.spec.ts` | 二进制注入测试组 |
| `frontend-v3/e2e/html-render.spec.ts` | 图片注入 E2E 测试 |

## Verification

1. `cd frontend-v3 && npm run test` — 单元测试通过
2. `cd frontend-v3 && npm run build` — 构建成功
3. `make debug` — 构建+启动+E2E 通过
4. 浏览器 `multi-html-demo` — 图片正常显示，无警告条