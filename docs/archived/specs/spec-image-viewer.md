# Spec: 图片查看器 + Bug 修复

## Context

P2 二进制注入已上线（代码层面 data URI 注入正确），但实际验证发现三个问题：

1. **中文乱码**：Blob type 缺少 charset → 浏览器默认 Latin-1 解码，中文变乱码。已修复为 `text/html;charset=UTF-8`。
2. **iframe 中图片空白**：E2E 测试数据中的 1x1 PNG base64 是损坏的（zlib decompress 失败），浏览器渲染为白色空白。需修正。
3. **没有图片查看功能**：点击 `.png/.jpg` 等图片文件时，CodeViewer 显示空白（selectFile 跳过二进制，fileContent 为空字符串）。需新增 ImageViewer。

## Step 1: Bug 修复

### 1a. Blob charset（已修复）

`src/components/HtmlViewer.vue:262`
```diff
- new Blob([content], { type: 'text/html' })
+ new Blob([content], { type: 'text/html;charset=UTF-8' })
```

### 1b. 修正损坏的 base64 PNG 数据

`e2e/html-render.spec.ts` 中的 `RED_PIXEL_PNG_BASE64` 使用了损坏的 base64 字符串。
替换为验证过的正确 base64（实现前需用 Playwright 实测确认渲染有色像素）：
- 红像素（待验证）
- 绿像素（待验证）

## Step 2: ImageViewer 组件

新建 `src/components/ImageViewer.vue`。

### 设计思路

**不走 downloadFile URL**（评审发现：私有条目的 `<img src>` 无法携带 JWT，导致 401）。
改用 **base64 data URI**：通过 `api.getFileAsBase64()` + `guessMimeType()` 构建 data URI，所有数据通过前端 JS 的 axios 请求获取（自动携带 JWT），公开和私有条目均适用。

Props：
```typescript
defineProps<{
  filename: string
  slug: string
  fileId: number
}>()
```

组件逻辑：
1. 挂载时调用 `api.getFileAsBase64(slug, fileId)` 获取 base64
2. 用 `guessMimeType(filename)` 推断 MIME type
3. 构建 data URI：`data:{mimeType};base64,{base64Content}`
4. 设置 img src 为 data URI
5. 大文件保护：> 10MB（原始）跳过自动加载，显示手动触发按钮（base64 约 13.3MB 内存开销）

模板结构：
```vue
<div class="image-viewer" data-testid="image-viewer">
  <!-- 性能警告：5MB ~ 10MB -->
  <div v-if="showSizeWarning" data-testid="size-warning" class="image-warning">
    ⚡ 文件较大（{{ fileSizeLabel }}），加载可能需要一点时间。
  </div>
  <!-- 手动触发：> 10MB -->
  <div v-if="showManualRender" data-testid="manual-render-btn" class="image-manual-render">
    <p>文件较大（{{ fileSizeLabel }}），自动加载已关闭以防止页面卡顿。</p>
    <button @click="triggerManualRender">点击加载</button>
  </div>
  <!-- Loading 态 -->
  <div v-if="isLoading" data-testid="image-loading" class="image-loading">
    <div class="loading-spinner" />
    <span>加载中...</span>
  </div>
  <!-- Error 态 -->
  <div v-if="hasError" data-testid="image-error" class="image-error">
    图片加载失败
  </div>
  <!-- 图片 -->
  <img
    v-if="dataUri"
    :src="dataUri"
    :alt="filename"
    data-testid="image-content"
    class="image-content"
    :class="{ 'image-zoomed': isZoomed }"
    @load="onLoad"
    @error="onError"
    @click="toggleZoom"
  />
</div>
```

### 交互设计

- 图片默认「适应窗口」：`object-fit: contain; max-width: 100%; max-height: 100%`
- 点击切换「原始尺寸」：`object-fit: none; cursor: zoom-out`（反之 `cursor: zoom-in`）
- 两个状态切换，不引入缩放比例滑块等复杂交互
- 原始尺寸状态下容器 `overflow: auto` 允许滚动查看大图

### 大文件策略

| 文件大小 | 行为 |
|----------|------|
| < 5MB | 正常加载 |
| 5MB ~ 10MB | 显示性能警告 + 正常加载 |
| ≥ 10MB | 不自动加载，显示手动触发按钮 |

（base64 开销约为原始 1.33 倍，10MB 原始 ≈ 13.3MB base64 字符串内存）

### 单元测试设计

`src/components/__tests__/ImageViewer.spec.ts`：
- 挂载时调用 getFileAsBase64，img src 为 data URI
- Loading 态：fetch 前显示 spinner
- Error 态：fetch 失败显示错误信息
- Load 事件后 Loading 态消失
- 大文件不自动加载，手动触发后正常加载
- 点击图片切换 zoom 状态

## Step 3: 接入 ImageViewer

`src/views/EntryDetailView.vue`：

1. 导入 ImageViewer + guessMimeType
2. 新增 computed：
   ```typescript
   const isImage = computed(() => {
     const file = activeFile.value
     if (!file || !file.isBinary) return false
     const mime = guessMimeType(file.filename)
     return mime?.startsWith('image/') ?? false
   })
   ```
3. 模板新增分支（在 HtmlViewer/MarkdownViewer 之后、CodeViewer 之前）：
   ```vue
   <ImageViewer
     v-if="isImage"
     :filename="activeFile.filename"
     :slug="slug"
     :file-id="activeFile.id"
   />
   ```

`src/stores/entry.ts`：
- 不修改 selectFile（ImageViewer 通过 props 传 slug/fileId，不依赖 fileContent）
- canCopy 对图片仍返回 false（已有逻辑 `if (isBinary) return false`）

### 非图片二进制文件的处理

字体（woff/woff2）、视频、音频等 `isBinary=true` 但 `!isImage` 的文件仍落到 CodeViewer 显示空白。这是当前合理行为——这些文件没有可视化查看方式。可后续单独处理（如显示文件信息面板）。

## Key Files

| File | Change |
|------|--------|
| `frontend-v3/src/components/HtmlViewer.vue` | Blob charset UTF-8（已改） |
| `frontend-v3/src/components/ImageViewer.vue` | 新建：图片查看器（base64 data URI） |
| `frontend-v3/src/views/EntryDetailView.vue` | 新增 isImage + ImageViewer 分支 |
| `frontend-v3/src/utils/mime.ts` | 复用 guessMimeType |
| `frontend-v3/src/api/client.ts` | 复用 getFileAsBase64 |
| `frontend-v3/e2e/html-render.spec.ts` | 修正损坏的 base64 PNG |
| `frontend-v3/e2e/debug-server.spec.ts` | 新增图片查看 E2E 测试 |
| `frontend-v3/src/components/__tests__/ImageViewer.spec.ts` | 新建单元测试 |

## Verification

1. `cd frontend-v3 && npm run test` — 单元测试通过
2. `cd frontend-v3 && npm run build` — 构建成功
3. `make debug` — 构建+启动+验证隔离+E2E 通过
4. 创建含正确 PNG 的演示条目 → 浏览器验证：
   - iframe 中图片显示有色块（红/绿）
   - 点击图片文件 → ImageViewer 显示图片
   - 无中文乱码
   - 私有条目图片也能正常显示