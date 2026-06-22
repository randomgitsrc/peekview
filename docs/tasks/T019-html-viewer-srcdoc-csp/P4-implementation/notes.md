---
phase: P4
task_id: T019
task_name: html-viewer-srcdoc-csp
type: implementation
trace_id: T019-P4-2026-06-22
created: 2026-06-22
status: done
parent: docs/tasks/T019-html-viewer-srcdoc-csp/P1-requirements.md
---

# T019 P4 实现记录

## 改动文件清单

| 文件 | 改动类型 | 行数变化 |
|------|---------|---------|
| `frontend-v3/src/components/HtmlViewer.vue` | 修改 | +9 / -28 |

仅改动 1 个文件，符合 P2 设计的「纯前端单文件改动」声明。后端 `main.py`、测试文件、`HtmlViewerTestKeys.ts` 均未触碰。

## 改动内容

### 1. iframe 模板：blob URL → srcdoc

```vue
<!-- 改前 -->
<iframe v-if="blobUrl" :src="blobUrl" sandbox="allow-scripts" csp="..." />

<!-- 改后 -->
<iframe v-if="processedHtml" :srcdoc="processedHtml" sandbox="allow-scripts" csp="..." />
```

srcdoc 的 origin 为 `null`，不继承主应用 HTTP header 的 CSP（`script-src 'self' 'unsafe-eval'`），iframe 的 `csp` 属性成为唯一 CSP 来源，inline script 拦截问题解除。

### 2. CSP 策略放宽（支持 Three.js/WebGL/Canvas）

#### 新旧 CSP 对比

| 指令 | 旧值 | 新值 | 变化 |
|------|------|------|------|
| `default-src` | `'unsafe-inline' 'unsafe-eval' blob: data:` | `'unsafe-inline' 'unsafe-eval' blob: data: https:` | + `https:` |
| `script-src` | `'unsafe-inline' 'unsafe-eval' blob: data:` | `'unsafe-inline' 'unsafe-eval' blob: data: https:` | + `https:` |
| `style-src` | `'unsafe-inline' blob: data:` | `'unsafe-inline' blob: data: https:` | + `https:` |
| `img-src` | `blob: data:` | `blob: data: https:` | + `https:` |
| `media-src` | `blob: data:` | `blob: data: https:` | + `https:` |
| `font-src` | `blob: data:` | `blob: data: https:` | + `https:` |
| `connect-src` | `'none'` | `blob: data: https:` | 核心放宽（Three.js 模型加载） |
| `worker-src` | （未设） | `blob:` | 新增（Web Worker） |
| `frame-src` | `'none'` | `'none'` | 不变 |
| `form-action` | `'none'` | `'none'` | 不变 |

#### 最终 CSP 字符串

```
default-src 'unsafe-inline' 'unsafe-eval' blob: data: https:; script-src 'unsafe-inline' 'unsafe-eval' blob: data: https:; style-src 'unsafe-inline' blob: data: https:; img-src blob: data: https:; media-src blob: data: https:; font-src blob: data: https:; connect-src blob: data: https:; worker-src blob:; frame-src 'none'; form-action 'none';
```

### 3. 移除 Blob URL 管理

- `const blobUrl = ref<string | null>(null)` → `const processedHtml = ref<string | null>(null)`
- 删除 `createBlobUrl` 函数（4 行）
- 删除 `revokeBlobUrl` 函数（3 行）
- `initRender` 中 `revokeBlobUrl(blobUrl.value)` + `blobUrl.value = createBlobUrl(processed)` → `processedHtml.value = processed`（同步赋值，无 Blob 创建/释放开销）
- 删除 `onUnmounted(() => revokeBlobUrl(blobUrl.value))`（srcdoc 是字符串值，不持有浏览器资源句柄，随组件卸载自动 GC）
- 从 `import { ref, computed, watch, onUnmounted, inject } from 'vue'` 移除 `onUnmounted`
- 同步更新 2 处注释（loading 态注释 + iframe 注释 + onIframeError 注释）

`injectResources` / `normalizeRef` / `countRelativePaths` / `countRelativePathsInDoc` / `serializeDoc` 等函数零改动。loading 态逻辑（`isLoading` / `onIframeLoad` / `onIframeError`）、手动触发逻辑（`manuallyTriggered`）、大文件分级逻辑（`SIZE_WARN` / `SIZE_BLOCK` / `showManualRender`）均保留不变。

## 设计摘要

将 iframe 渲染载体从继承主页面 CSP 的 blob URL 换成 origin 为 null 的 srcdoc 字符串，并重写 iframe `csp` 属性放开 `connect-src`/`worker-src` 及各资源指令的 `https:`，让 Three.js/WebGL/Canvas 富交互 HTML 在 `sandbox="allow-scripts"`（无 allow-same-origin）凭据隔离下正常渲染。

## 验证结果

| Gate | 命令 | 结果 |
|------|------|------|
| P3 单元测试 | `npx vitest run src/components/__tests__/HtmlViewer.spec.ts` | ✅ 57/57 passed |
| P3 集成测试 | `npx vitest run src/components/__tests__/HtmlViewerIntegration.spec.ts` | ✅ 5/5 passed |
| 全量单元测试 | `npx vitest run` | ⚠️ 111/112 passed（1 失败为 `mime.spec.ts` svg 既有问题，与 T019 无关，stash 改动后仍失败） |
| 类型检查 + 构建 | `npm run build` | ✅ vue-tsc + vite build 通过（含既有 chunk size 警告） |

## 未触碰项（符合 P2 声明）

- `backend/peekview/main.py`（主应用 CSP，srcdoc iframe 不继承）
- `frontend-v3/src/components/__tests__/HtmlViewer.spec.ts`（P3 已写好）
- `frontend-v3/src/components/__tests__/HtmlViewerIntegration.spec.ts`（mock 了 HtmlViewer，不受影响）
- `frontend-v3/src/components/HtmlViewerTestKeys.ts`（测试注入 key，不变）

## 下一步

P5 技术验证（继承 P3 gate 结果，已绿）→ P6 Playwright 实跑（3.3MB 3D Model Viewer HTML + WebGL/CSP 抓取 + vision 截图）。
