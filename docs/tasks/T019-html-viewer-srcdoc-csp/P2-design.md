---
phase: P2
task_id: T019
task_name: html-viewer-srcdoc-csp
type: design
trace_id: T019-P2-2026-06-22
created: 2026-06-22
status: draft
parent: docs/tasks/T019-html-viewer-srcdoc-csp/P1-requirements.md
---

# T019 P2 方案设计

## 方案概述

将 `HtmlViewer.vue` 的 iframe 渲染方式从 `blob:` URL 改为 `srcdoc`，让 iframe 的 origin 为 `null`，彻底脱离主应用 HTTP header CSP（`script-src 'self' 'unsafe-eval'`）的继承性拦截；同时重写 iframe 的 `csp` 属性，专为 Three.js/WebGL/Canvas 等富交互 HTML 放宽 `connect-src` / `worker-src` / `img-src` / `font-src` / `style-src`，并保留 `sandbox="allow-scripts"`（无 `allow-same-origin`）确保凭据隔离。

纯前端单文件改动，后端 `main.py:146` 的主应用 CSP 不动。

## 字段声明

### packages
- `[frontend-v3]`

### domains
- `[frontend]`

### ui_affected
- `true`
  - loading 态时机变化（srcdoc load 事件在 HTML 解析 + 同步 script 执行完触发，Three.js 异步初始化不在此范围，loading 可能提前消失——P0 风险 4，判定可接受，P6 实跑观察）。
  - iframe DOM 由 `<iframe :src="blobUrl">` 变为 `<iframe :srcdoc="processedHtml">`，用户视觉无感知。

### gate_commands

继承自 P1，无补充：

```bash
# 1. 单元测试（P3 产出，P5 gate）
cd frontend-v3 && npx vitest run src/components/__tests__/HtmlViewer.spec.ts
cd frontend-v3 && npx vitest run src/components/__tests__/HtmlViewerIntegration.spec.ts

# 2. 全量单元测试（无回归）
cd frontend-v3 && npx vitest run

# 3. 类型检查 + 构建
cd frontend-v3 && npm run build

# 4. Lint
cd frontend-v3 && npm run lint

# 5. Playwright 实跑（P6 gate）
make debug-start
# Playwright CDP 127.0.0.1:18800：
#   a. 创建 entry 指向测试样本 HTML
#   b. 打开 entry，点击「点击渲染」
#   c. page.on('console') 抓 CSP 违规（应为 0 条）
#   d. 检查 iframe 内 #root childElementCount > 0
#   e. 检查 iframe 内 canvas + WebGL context 非 null
#   f. 采样两帧 canvas.toDataURL() 确认渲染循环
#   g. vision-helper 截图确认 3D 模型可见
#   h. BDD-8 sandbox 安全性验证（cookie/localStorage/fetch 凭据隔离）
make debug-stop
```

## 改动文件清单

| 文件 | 改动摘要 |
|------|---------|
| `frontend-v3/src/components/HtmlViewer.vue` | 主体改写：`blobUrl` ref → `processedHtml` ref；iframe `:src` → `:srcdoc`；更新 `csp` 属性字符串（放宽 connect-src/worker-src/img-src/font-src/style-src + https:）；删除 `createBlobUrl` / `revokeBlobUrl` / `onUnmounted` revoke 逻辑；`initRender` 直接赋值 `processedHtml`。 |
| `frontend-v3/src/components/__tests__/HtmlViewer.spec.ts` | [SCOPE+] 测试回补：删除 `Blob URL 创建与释放` describe 块；新增 `srcdoc 渲染` / `CSP 属性` describe 块；多文件注入/二进制注入测试从 `createObjectURLMock` 读取 blob.text() 改为读 `iframe.attributes('srcdoc')`；删除 URL mock（不再需要）。 |

**不改动**：
- `backend/peekview/main.py:146-148`（主应用 CSP，srcdoc iframe 不继承）
- `frontend-v3/src/components/__tests__/HtmlViewerIntegration.spec.ts`（mock 了 HtmlViewer，不受影响）
- `frontend-v3/src/components/HtmlViewerTestKeys.ts`（测试注入 key，不变）

## CSP 策略设计

### 最终 CSP 字符串（iframe `csp` 属性值）

```
default-src 'unsafe-inline' 'unsafe-eval' blob: data: https:; script-src 'unsafe-inline' 'unsafe-eval' blob: data: https:; style-src 'unsafe-inline' blob: data: https:; img-src blob: data: https:; media-src blob: data: https:; font-src blob: data: https:; connect-src blob: data: https:; worker-src blob:; frame-src 'none'; form-action 'none';
```

### 逐指令说明

| 指令 | 取值 | 允许 | 拒绝 | 理由 |
|------|------|------|------|------|
| `default-src` | `'unsafe-inline' 'unsafe-eval' blob: data: https:` | inline 资源 / eval / blob/data/https 来源 | 其他来源（如 `file:`、`ftp:`、非 https http） | 兜底指令，为未显式声明的指令提供基线。含 `https:` 允许 CDN 资源；`'unsafe-inline'` + `'unsafe-eval'` 为富交互 HTML 必需。 |
| `script-src` | `'unsafe-inline' 'unsafe-eval' blob: data: https:` | inline `<script>` / `eval()` / `new Function()` / blob/data/https 脚本 | 非 https 的 http 脚本、`file:` 脚本 | **核心指令**：`'unsafe-inline'` 解除 React/Three.js inline script 拦截（根因 1）；`'unsafe-eval'` 允许 Three.js shader 编译（部分 3D 库用 `new Function()` 编译 shader）；`blob:` 允许 `new Worker(URL.createObjectURL(...))` 间接创建的脚本；`https:` 允许 CDN 加载 Three.js 库本身。 |
| `style-src` | `'unsafe-inline' blob: data: https:` | inline `<style>` / `style=` 属性 / blob/data/https 样式表 | 非 https http 样式表 | `unsafe-inline'` 允许 React 内联样式 + Three.js 动态样式；`https:` 允许 Google Fonts CSS、Tailwind CDN 等。 |
| `img-src` | `blob: data: https:` | blob/data/https 图片 | 非 https http 图片、`file:` | Three.js 纹理加载（`TextureLoader.load()`）、`<img>` 元素、Canvas `drawImage`。`data:` 覆盖 base64 纹理，`blob:` 覆盖动态生成纹理，`https:` 覆盖外部纹理 URL。 |
| `media-src` | `blob: data: https:` | blob/data/https 音视频 | 非 https http 媒体 | 与 img-src 对齐，允许 `<video>`/`<audio>` 加载外部媒体。 |
| `font-src` | `blob: data: https:` | blob/data/https 字体 | 非 https http 字体 | **BDD-5 核心**：允许 Google Fonts（`https://fonts.gstatic.com`）加载 woff2；`data:` 覆盖 base64 内嵌字体。 |
| `connect-src` | `blob: data: https:` | fetch/XHR/WebSocket 到 blob/data/https | `'none'`（当前值）→ 放宽；非 https http、`file:` | **根因 2 核心**：允许 `GLTFLoader.load()` fetch `.glb`/`.gltf` 模型；`blob:` 覆盖动态生成模型数据；`https:` 覆盖外部模型 CDN。**安全**：sandbox 无 `allow-same-origin`，fetch 不携带主页面 cookie，匿名跨域请求。 |
| `worker-src` | `blob:` | blob URL Worker | https/data/非 blob Worker | Three.js DRACOLoader/MeshoptDecoder 等通过 `URL.createObjectURL(new Blob([workerCode]))` 创建解码 Worker。**仅允许 blob:**——Worker 脚本应内联生成，不允许外部 https Worker（减少攻击面）。若 P6 发现需要 https Worker，再放宽（条件性 [NEED_CONFIRM]）。 |
| `frame-src` | `'none'` | 无 | 任何 iframe 嵌套 | 禁止 iframe 内嵌 iframe，防止钓鱼嵌套。 |
| `form-action` | `'none'` | 无 | 任何表单提交 | 禁止表单提交，防止恶意 HTML 向外部发送数据。 |

### Three.js/WebGL/Canvas 场景覆盖矩阵

| 场景 | 对应 CSP 指令 | 覆盖情况 |
|------|--------------|---------|
| inline script 执行（React/Three.js 入口） | `script-src 'unsafe-inline'` | ✅ |
| eval/new Function（shader 编译） | `script-src 'unsafe-eval'` | ✅ |
| WebGL context 创建（`getContext('webgl')`） | 无需 CSP（Canvas/WebGL API 不受 CSP 管控） | ✅ N/A |
| Canvas 2D context | 无需 CSP（同上） | ✅ N/A |
| requestAnimationFrame 渲染循环 | 无需 CSP（定时器 API 不受 CSP 管控） | ✅ N/A |
| fetch/XHR 加载外部模型（.glb/.gltf） | `connect-src blob: data: https:` | ✅ |
| 纹理图片加载（Image + data:/blob:/https:） | `img-src blob: data: https:` | ✅ |
| Google Fonts 加载 | `font-src ... https:` + `style-src ... https:` | ✅ |
| Web Worker（物理引擎、DRACOLoader 等） | `worker-src blob:` | ✅ |
| OffscreenCanvas | 无需 CSP（Canvas API）+ Worker 内代码受 `worker-src` 控制 | ✅ |

### 可选加固（超范围，需 [SCOPE+] 评估）

以下指令 P0 未要求，当前方案不引入。若 P6/P7 发现需要，按 [SCOPE+] 流程增补：

- `object-src 'none'`：禁止 `<object>`/`<embed>`/`<applet>`。当前由 `default-src` 兜底（允许 blob/data/https），但现代浏览器已废弃插件，实际风险极低。
- `base-uri 'none'`：禁止 `<base>` 标签注入。srcdoc 内容是用户自己的 HTML，非外部攻击向量，风险低。
- `child-src`：`worker-src` + `frame-src` 的旧版兜底，现代浏览器用后者，无需显式声明。

## srcdoc 实现细节

### 1. `processedHtml` ref 替代 `blobUrl` ref

```ts
// ── 改前 ──
const blobUrl = ref<string | null>(null)
const isLoading = ref(false)

function createBlobUrl(content: string): string {
  const blob = new Blob([content], { type: 'text/html;charset=UTF-8' })
  return URL.createObjectURL(blob)
}

function revokeBlobUrl(url: string | null) {
  if (url) URL.revokeObjectURL(url)
}

// ── 改后 ──
const processedHtml = ref<string | null>(null)
const isLoading = ref(false)
// createBlobUrl / revokeBlobUrl 删除
```

### 2. `initRender` 函数改动

```ts
// ── 改前 ──
function initRender(content: string) {
  if (!content) return
  if (props.loadingSiblings) return
  if (isBlockedBySize.value && !manuallyTriggered.value) return

  const { html: processed, unmatchedCount } = injectResources(content, props.siblingFiles ?? [])
  relativePathWarningCount.value = unmatchedCount
  revokeBlobUrl(blobUrl.value)
  isLoading.value = true
  blobUrl.value = createBlobUrl(processed)
}

// ── 改后 ──
function initRender(content: string) {
  if (!content) return
  if (props.loadingSiblings) return
  if (isBlockedBySize.value && !manuallyTriggered.value) return

  const { html: processed, unmatchedCount } = injectResources(content, props.siblingFiles ?? [])
  relativePathWarningCount.value = unmatchedCount
  isLoading.value = true
  processedHtml.value = processed  // 直接赋值，无需 revoke 旧值
}
```

`injectResources` 返回的 `processed` 字符串直接赋给 `processedHtml` ref，Vue 响应式触发 iframe 重新渲染。无 Blob 创建/释放开销。

### 3. 模板改动（iframe 标签）

```vue
<!-- ── 改前 ── -->
<iframe
  v-if="blobUrl"
  :src="blobUrl"
  sandbox="allow-scripts"
  csp="default-src 'unsafe-inline' 'unsafe-eval' blob: data:; script-src 'unsafe-inline' 'unsafe-eval' blob: data:; style-src 'unsafe-inline' blob: data:; img-src blob: data:; media-src blob: data:; font-src blob: data:; connect-src 'none'; frame-src 'none'; form-action 'none';"
  referrerpolicy="no-referrer"
  class="html-frame"
  @load="onIframeLoad"
  @error="onIframeError"
/>

<!-- ── 改后 ── -->
<iframe
  v-if="processedHtml"
  :srcdoc="processedHtml"
  sandbox="allow-scripts"
  csp="default-src 'unsafe-inline' 'unsafe-eval' blob: data: https:; script-src 'unsafe-inline' 'unsafe-eval' blob: data: https:; style-src 'unsafe-inline' blob: data: https:; img-src blob: data: https:; media-src blob: data: https:; font-src blob: data: https:; connect-src blob: data: https:; worker-src blob:; frame-src 'none'; form-action 'none';"
  referrerpolicy="no-referrer"
  class="html-frame"
  @load="onIframeLoad"
  @error="onIframeError"
/>
```

CSP 字符串差异（改后 vs 改前）：
- `default-src` / `script-src` / `style-src` / `img-src` / `media-src` / `font-src`：追加 ` https:`
- `connect-src`：`'none'` → `blob: data: https:`
- `worker-src`：新增 `blob:`
- `frame-src` / `form-action`：不变

### 4. `onIframeLoad` 时机

`onIframeLoad` 函数本身**不变**：

```ts
function onIframeLoad() {
  isLoading.value = false
}

function onIframeError() {
  isLoading.value = false
}
```

**时机变化**（P0 风险 4）：
- blob URL：load 事件在 iframe 完整加载（含所有同步资源）后触发。
- srcdoc：load 事件在 HTML 解析完成 + **同步 script 执行完**后触发，但 Three.js 初始化（异步 import、模型加载、shader 编译）跨多个微任务/宏任务，可能在 load 事件后才完成。

**影响**：loading 态可能在 Three.js 还在初始化时消失，用户看到短暂空白或未渲染 canvas。

**判定**：可接受。loading 的语义是「iframe 加载完成」而非「内容渲染完成」。P6 实跑观察实际体验：
- 若 < 1 秒空白：无感知，不需处理。
- 若 1~3 秒空白：可接受（3D 渲染本就需要初始化时间）。
- 若 > 3 秒空白：考虑加渲染完成检测（如轮询 `canvas` 元素出现 + WebGL context 非空）——**超范围，需 [NEED_CONFIRM]**。

### 5. `onUnmounted` 清理

```ts
// ── 改前 ──
onUnmounted(() => {
  revokeBlobUrl(blobUrl.value)
})

// ── 改后 ──
// onUnmounted 删除——srcdoc 无需手动清理，processedHtml ref 随组件卸载自动 GC。
```

srcdoc 是字符串值，不持有浏览器资源句柄（不像 blob URL 持有 ObjectURL 句柄需 revoke）。组件卸载时 `processedHtml` ref 失去引用，V8 GC 自动回收字符串内存。无内存泄漏风险。

## 兄弟文件注入兼容性

### injectResources 返回值直接作为 srcdoc

`injectResources(html, siblings)` 返回 `{ html: string, unmatchedCount: number }`，其中 `html` 是经过 DOMParser 解析 + `serializeDoc` 序列化后的 HTML 字符串。该字符串直接赋给 `processedHtml` ref，作为 `:srcdoc` 绑定值。

### 编码/转义分析

**结论：无编码问题，processedHtml 字符串原样传递。**

详细分析：

1. **Vue 绑定机制**：`:srcdoc="processedHtml"` 等价于 `iframe.setAttribute('srcdoc', processedHtml)`。Vue 3 对普通 attribute（非 property 如 `value`/`checked`）用 `setAttribute` 设置。

2. **setAttribute 行为**：`setAttribute('srcdoc', value)` 将 `value` 转为字符串后存为属性值。浏览器内部存储原始字符串，**不经过 HTML 实体编码/解码**。

3. **iframe 渲染时取值**：浏览器取 srcdoc 属性值的原始字符串，直接作为 iframe 内的 HTML 解析。不经过二次实体解码。

4. **特殊字符处理**：
   - `"`（双引号）：processedHtml 中可能含双引号（如 `<div class="foo">`）。`setAttribute` 不受属性值引号边界影响——它操作的是 DOM 节点属性，不是 HTML 文本。无破坏问题。
   - `<` / `>`：同上，DOM 属性值不受影响。
   - `&`：同上，不经过实体解码。
   - null 字符（`\0`）：HTML 内容通常不含，可忽略。若含，浏览器会容错处理。

5. **对比声明式 HTML**：若用 `<iframe srcdoc="<p>hello</p>">` 声明式写法，属性值会经过 HTML 实体解码（`&lt;` → `<`）。但 Vue 的 DOM API 绑定不走 HTML 解析路径，直接 setAttribute，无此问题。

6. **base64 二进制资源**：injectResources 将二进制兄弟文件转为 `data:${mimeType};base64,${content}` 嵌入 HTML。base64 字符集为 `[A-Za-z0-9+/=]`，不含特殊字符，无转义问题。base64 会让 srcdoc 变大——已知行为（P0 风险 3），非回归。

### 流程对比

```
改前: content → injectResources → processedHtml → createBlobUrl → blobUrl → :src="blobUrl"
改后: content → injectResources → processedHtml → processedHtml ref → :srcdoc="processedHtml"
```

中间产物形态（HTML 字符串）不变，只是末端载体从 Blob 换成字符串。`injectResources` 函数本身**零改动**。

## loading 态时机变化处理

### 当前逻辑（保留）

```ts
// initRender 中：
isLoading.value = true
processedHtml.value = processed  // 触发 iframe 渲染

// onIframeLoad：
isLoading.value = false
```

isLoading 显示条件：`v-if="isLoading || props.loadingSiblings"`。

### 时机差异

| 阶段 | blob URL | srcdoc |
|------|---------|--------|
| initRender 调用 | isLoading=true，createObjectURL 同步返回 | isLoading=true，processedHtml 赋值同步 |
| iframe 创建 | 浏览器异步加载 blob URL | 浏览器同步解析 srcdoc 字符串 |
| load 事件触发 | blob 内容完整加载后 | HTML 解析 + 同步 script 执行完后 |
| Three.js 初始化 | load 事件后异步 | load 事件后异步（相同） |

**关键差异**：srcdoc 的 load 事件可能比 blob URL 略早触发（因为 srcdoc 无网络请求阶段），但两者都在「同步 script 执行完」后触发。Three.js 异步初始化不受影响。

### 处理策略

- **不改动 loading 逻辑**：`isLoading` / `onIframeLoad` / `onIframeError` 保持现状。
- **P6 实跑观察**：记录点击「点击渲染」到 loading 消失的时长，以及 loading 消失到 canvas 出现内容的间隔。
- **阈值判定**：
  - loading 消失后 ≤ 1 秒出现内容：无感知，不需处理。
  - 1~3 秒：可接受（3D 渲染初始化正常耗时）。
  - \> 3 秒：**条件性 [NEED_CONFIRM]**——考虑加「渲染完成检测」（轮询 canvas + WebGL context），但这改变 loading 语义为「内容渲染完成」，超 P0 范围。

## 测试策略

### P3 单元测试

**文件**：`frontend-v3/src/components/__tests__/HtmlViewer.spec.ts`

#### 删除项

- 删除 `beforeEach`/`afterEach` 中的 `URL.createObjectURL`/`revokeObjectURL` mock（srcdoc 不调用 URL API）。
- 删除 `describe('Blob URL 创建与释放')` 整块（3 个测试）。
- 删除所有测试中 `createObjectURLMock.mock.calls` 读取 blob.text() 的断言模式。

#### 新增项

**`describe('srcdoc 渲染')`**：
1. `挂载时 srcdoc 属性含注入后的 HTML`：`expect(iframe.attributes('srcdoc')).toContain('<html')`，且含原始 HTML 内容。
2. `content 变更时 srcdoc 更新`：setProps 新 content，断言 srcdoc 属性含新内容。
3. `卸载时无残留`：unmount 后不断言（srcdoc 无句柄需清理），仅验证不抛错。
4. `空 content 不渲染 iframe`：`expect(wrapper.find('iframe').exists()).toBe(false)`。

**`describe('CSP 属性')`**：
1. `csp 含 connect-src blob: data: https:`：断言放宽外部模型加载。
2. `csp 含 worker-src blob:`：断言允许 Web Worker。
3. `csp 含 font-src blob: data: https:`：断言允许 Google Fonts。
4. `csp 含 style-src 'unsafe-inline' blob: data: https:`：断言允许外部 CSS + inline 样式。
5. `csp 含 script-src 'unsafe-inline' 'unsafe-eval'`：断言允许 inline script + eval（核心解除拦截）。
6. `csp 含 img-src blob: data: https:`：断言允许外部纹理。
7. `csp 含 frame-src 'none'`：断言禁止 iframe 嵌套。
8. `csp 含 form-action 'none'`：断言禁止表单提交。

**`describe('sandbox 属性')`**（已有，保留并补充）：
- `sandbox="allow-scripts"`（已有）。
- 补充：`不含 allow-same-origin`（已有，保留——BDD-8 安全性核心）。

#### 改写项（多文件注入/二进制注入测试）

所有通过 `createObjectURLMock.mock.calls[0][0]` 读取 Blob 再 `blob.text()` 的断言，改为直接读 `wrapper.find('iframe').attributes('srcdoc')`：

```ts
// 改前
const blob = (createObjectURLMock.mock.calls as any[][])[0][0] as Blob
const text = await blob.text()
expect(text).toContain('/* injected from: styles.css */')

// 改后
const srcdoc = wrapper.find('iframe').attributes('srcdoc') ?? ''
expect(srcdoc).toContain('/* injected from: styles.css */')
```

受影响测试（约 15 个）：`多文件注入` / `二进制资源注入` / `层级目录路径匹配` describe 块内所有读取 blob.text() 的测试。

#### 保留项（无改动）

- `describe('相对路径检测警告')`：逻辑不变。
- `describe('大文件分级处理')`：逻辑不变，但删除 `expect(createObjectURLMock).not.toHaveBeenCalled()` 断言（mock 不存在），改为 `expect(wrapper.find('iframe').exists()).toBe(false)`。
- `describe('Loading 状态')`：逻辑不变。
- `describe('iframe sandbox 属性')`：逻辑不变。

### P6 Playwright 实跑

**环境**：`make debug-start`（`127.0.0.1:8888`，`/tmp/peekview-debug/`），Playwright CDP `127.0.0.1:18800`。
**测试样本**：`~/oclab/open-codesign/test01/AI-3D-Model-Viewer-Workspace-App-2026-06-22-135809.html`（3.3MB，Three.js + React + WebGL）。
**Skill**：`playwright-vision`（vision-helper subagent 截图确认）。

#### 测试步骤

1. **创建 entry**：`PEEKVIEW_DEBUG_MODE=1 peekview create -s "3D Model Viewer" <测试样本>`。
2. **打开 entry**：Playwright 导航到 EntryDetailView，确认显示「文件较大（3.3 MB），自动渲染已关闭」。
3. **点击渲染**：`frame.locator('[data-testid="manual-render-btn"]').click()`。
4. **CSP 违规抓取**（BDD-1）：
   - `page.on('console')` 收集所有 console 消息。
   - `page.on('pageerror')` 收集 JS 错误。
   - 等待 5 秒（让 Three.js 初始化 + 模型加载）。
   - 断言：无 `Refused to execute inline script` / `Refused to load` 等 CSP 违规消息。
5. **React 挂载验证**（BDD-2）：
   - `const frame = page.frameLocator('iframe.html-frame')`
   - `const root = frame.locator('#root')`
   - 断言 `root.childElementCount > 0`。
6. **WebGL context 验证**（BDD-3）：
   - `const canvas = frame.locator('canvas')`
   - 断言 canvas 存在。
   - 在 frame 内执行 `canvas.getContext('webgl') || canvas.getContext('webgl2')`，断言非 null。
7. **渲染循环验证**（BDD-4）：
   - 在 frame 内执行两次 `canvas.toDataURL()`（间隔 `requestAnimationFrame` ×2 + 100ms）。
   - 断言两次 dataURL 不同（渲染循环在持续绘制）。
8. **Google Fonts 验证**（BDD-5）：
   - 等待 2 秒（网络请求）。
   - 断言 console 无 `Refused to load stylesheet` / `Refused to load font`。
   - 可选：检查 `document.fonts.ready` resolve。
9. **vision 截图**：
   - `vision-helper` subagent 截图 iframe 区域。
   - 确认 3D 模型可见（非空白/非错误页）。
10. **sandbox 安全性验证**（BDD-8）：
    - 在 frame 内执行 `document.cookie`，断言返回空字符串。
    - 在 frame 内执行 `localStorage.getItem('peekview_token')`，断言抛 SecurityError 或返回 null。
    - 在 frame 内执行 `fetch('/api/entries')`，断言请求为匿名跨域（不携带 cookie）——可通过后端日志或 network 拦截验证。

#### 小文件回归（BDD-6/BDD-7）

- 创建 <2MB 简单 HTML entry（含 inline `<script>`），打开后自动渲染，inline script 执行，loading 正常消失。
- 创建纯文本 HTML entry（无 script），打开后显示内容，无 CSP 违规，无 JS 错误。

## 风险评估

| # | 风险 | 等级 | 缓解措施 |
|---|------|------|---------|
| 1 | srcdoc 大小限制：Chrome 无硬限制但超大文档（>10MB）可能卡顿；Firefox ~50MB；Safari 较保守 | 中 | 测试文件 3.3MB 实测可行（P0 已确认）。P6 实跑验证。若未来出现 >10MB 文件，考虑回到 blob URL + 后端单独下发宽松 CSP header 的方案（超范围 [SCOPE+]）。 |
| 2 | CSP 放宽 `connect-src https:` 后恶意 HTML 可向外部发送数据 | 低 | `sandbox="allow-scripts"` 无 `allow-same-origin`，iframe origin=null，无法读取主页面 cookie/localStorage；`referrerpolicy="no-referrer"` 不泄露来源；fetch 为匿名跨域请求。风险可控。 |
| 3 | 兄弟文件注入的 base64 二进制让 srcdoc 变大 | 低 | 已知行为（P0 风险 3），非回归。srcdoc 大小限制同风险 1。 |
| 4 | `onIframeLoad` 时机变化导致 loading 提前消失 | 低 | loading 语义是「iframe 加载」非「内容渲染」。P6 实跑观察：>3 秒空白才考虑加渲染完成检测（条件性 [NEED_CONFIRM]，超 P0 范围）。 |
| 5 | srcdoc + sandbox 无 allow-same-origin 下 WebGL/Canvas/OffscreenCanvas 是否正常工作 | 需验证 | 理论上 Canvas/WebGL API 不需要 same-origin。P6 实跑验证（BDD-3/BDD-4）。若失败，考虑加 `allow-same-origin`（降低安全性，**[NEED_CONFIRM]**）——但这会让 iframe 能访问主页面 cookie，需重新评估 sandbox 策略。 |
| 6 | 现有测试 `HtmlViewer.spec.ts` 大量 mock `createObjectURL`/`revokeObjectURL`，改 srcdoc 后 mock 不再被调用 | 低 | [SCOPE+] P3 阶段回补：删除 URL mock，重写 Blob URL 测试为 srcdoc 断言，多文件注入测试改读 `iframe.attributes('srcdoc')`。逐个验证不崩。 |
| 7 | `worker-src blob:` 可能不足以覆盖所有 Three.js Worker 场景（如外部 https Worker 脚本） | 低 | Three.js DRACOLoader/MeshoptDecoder 等用 blob Worker。P6 实跑观察 console 是否有 `worker-src` 违规。若需 https Worker，放宽 `worker-src blob: https:`（条件性 [NEED_CONFIRM]）。 |

## 标记汇总

### [SCOPE+] 测试代码回补

- **来源**：P1「隐含依赖检查 §4」已标记。
- **内容**：`HtmlViewer.spec.ts` 删除 Blob URL 测试，新增 srcdoc/CSP 测试，多文件注入测试改读 srcdoc 属性。
- **影响**：P3 工作量增加，不改变 P1 基线范围。
- **处置**：P3 阶段执行回补。

### [NEED_CONFIRM] 条件性（P6 验证后触发）

以下不是当前需要 confirm 的点，而是 P6 实跑后**若触发条件**才需 confirm：

1. **loading 态 >3 秒空白**（风险 4）：若 P6 观察到 loading 消失后 >3 秒才出现内容，需 confirm 是否加渲染完成检测（改变 loading 语义，超 P0 范围）。
2. **WebGL/Canvas 在 sandbox 无 allow-same-origin 下失败**（风险 5）：若 P6 BDD-3/BDD-4 失败，需 confirm 是否加 `allow-same-origin`（降低安全性）。
3. **worker-src blob: 不足**（风险 7）：若 P6 console 出现 worker-src CSP 违规，需 confirm 是否放宽到 `worker-src blob: https:`。

当前方案无需 confirm，直接进入 P3。

### [SCOPE_GAP] 无

无方案缺口。P0 已锁定方案（blob URL → srcdoc + CSP 放宽），P1 已确认所有隐含依赖兼容，P2 细化实现细节无缺口。

### [CAPABILITY_GAP] 无

继承 P1：所有验证能力齐备（Playwright WebGL 检测、3D 测试样本、CDP 连接、CSP 抓取、vision 截图）。

## 下一步

P2 方案已明确，可进入 P3（TDD）：
1. 先改写 `HtmlViewer.spec.ts`（删除 Blob URL 测试，新增 srcdoc/CSP 测试）——测试应失败（因为 HtmlViewer.vue 还没改）。
2. 再改 `HtmlViewer.vue`（blobUrl → processedHtml，CSP 字符串更新）——测试应全绿。
3. 跑 `npx vitest run src/components/__tests__/HtmlViewer.spec.ts` 确认 P3 gate 通过。
