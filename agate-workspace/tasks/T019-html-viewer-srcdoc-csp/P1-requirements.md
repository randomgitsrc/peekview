---
phase: P1
task_id: T019
task_name: html-viewer-srcdoc-csp
type: requirements
trace_id: T019-P1-2026-06-22
created: 2026-06-22
status: updated
parent: docs/tasks/T019-html-viewer-srcdoc-csp/P0-brief.md
revision: 2
revision_note: "2026-06-23 [SCOPE+] 增补——P2-rev2 改为后端 render 路由方案，domains/packages 扩展到后端，BDD-8 验证方式更新"
---

# T019 P1 需求基线

## 任务概述

将 `HtmlViewer.vue` 的 iframe 渲染方式从 `blob:` URL 改为 `srcdoc`，解除主页面 CSP 对 inline script 的继承性拦截；同时放宽 iframe 内 CSP 以支持 Three.js/WebGL/Canvas 等富交互 HTML（connect-src / worker-src / img-src / font-src / style-src）。

## 范围界定

> **[SCOPE+] 2026-06-23 增补**：原 P1 基于已废弃的 srcdoc 方案（domains: [frontend]）。P2-rev2 改为后端 render 路由方案后，范围扩展到后端。下方已更新。

- **domains**: `[backend, frontend]`
  - **[SCOPE+] 后端**：新增 `GET /api/v1/entries/{slug}/files/{file_id}/render` 路由 + `html_render_service.py`（BS4 sibling 注入）+ `main.py` CSP 中间件特判 + 新依赖 `beautifulsoup4`
  - **前端**：`HtmlViewer.vue` 从 blob URL 改为 render URL；`EntryDetailView.vue` 移除前端 sibling fetch 逻辑。主应用 CSP（`main.py`）的主页面部分**不动**——render 路由返回独立的 CSP header，不继承主页面 CSP。
- **packages**: `[backend, frontend-v3]`
- **ui_affected**: `true`
  - loading 态时机变化（render URL 的 load 事件在 iframe 完整加载后触发，与原 blob URL 行为一致）
  - iframe 视觉行为从「blob URL 加载」变为「后端 render URL 加载」，用户无感知
  - sibling 文件加载从「前端 N 次 fetch 内容」变为「前端只传 file IDs」，体验更流畅

## 裁剪说明

**偏保留**（遵循 P0 `pruning_tendency`），P2 / P3 / P6 / P7 / P8 全保留：

| 阶段 | 保留 | 理由 |
|------|------|------|
| P2 | ✅ | CSP 策略每条指令的放宽容许什么、拒绝什么须明确文档化；srcdoc vs blob URL 的 origin 语义须固化 |
| P3 | ✅ | TDD：现有 `HtmlViewer.spec.ts` 有大量 Blob URL 创建/释放测试需重写为 srcdoc 断言；新增 CSP 字符串断言 |
| P6 | ✅ | Three.js/WebGL 须真实浏览器实跑；CSP 违规须 console 抓取验证；vision 确认 3D 渲染 |
| P7 | ✅ | `HtmlViewer.vue` + `HtmlViewer.spec.ts` 多文件一致性；CSP 字符串在模板与测试间须一致 |
| P8 | ✅ | `frontend-v3` 版本 bump + CHANGELOG |

P4/P5 默认走。

## BDD 验收条件

> 所有 BDD 在 `make debug-start` 环境（`127.0.0.1:8888`，`/tmp/peekview-debug/`）下验证。
> 测试样本：`~/oclab/open-codesign/test01/AI-3D-Model-Viewer-Workspace-App-2026-06-22-135809.html`（3.3MB，Three.js + React + WebGL）。
> Playwright CDP: `127.0.0.1:18800`。

### BDD-1: 大文件(>2MB) HTML 点击渲染后 inline script 执行

- **Given** 一个 3.3MB 的 3D Model Viewer HTML entry 已创建（`PEEKVIEW_DEBUG_MODE=1 peekview create`），且该 HTML 含 8 个 inline `<script>` 块
- **When** 在 EntryDetailView 打开该 entry，看到"文件较大（3.3 MB），自动渲染已关闭"提示，点击「点击渲染」按钮
- **Then** iframe 在 1 秒内创建完成，**console 无任何 CSP 违规**（无 `Refused to execute inline script` 报错），iframe 内 inline script 执行至少一次（可通过 `window.__rendered = true` 标记或 React 挂载副作用验证）

### BDD-2: React 组件渲染到 #root

- **Given** 3D Model Viewer HTML 已点击渲染且 iframe 加载完成
- **When** Playwright 通过 `frame.locator('#root')` 查询 iframe 内 #root 容器
- **Then** `#root` 存在且 `childElementCount > 0`（React 已挂载，不是空 div）

### BDD-3: Three.js / WebGL context 创建成功

- **Given** 3D Model Viewer HTML 已点击渲染且 iframe 加载完成
- **When** Playwright 在 iframe 内执行 `document.querySelector('canvas')` 并对 canvas 调用 `gl = canvas.getContext('webgl') || canvas.getContext('webgl2') || canvas.getContext('experimental-webgl')`
- **Then** `canvas` 元素存在 **且** `gl` 非 null（WebGL context 创建成功）

### BDD-4: requestAnimationFrame 渲染循环运行

- **Given** 3D Model Viewer HTML 已点击渲染且 WebGL context 已创建
- **When** Playwright 在 iframe 内连续两帧采样 `canvas.toDataURL()`（间隔 `requestAnimationFrame` ×2 + 100ms）
- **Then** 两次采样的 dataURL **不同**（渲染循环在持续绘制，不是静态画面）

### BDD-5: Google Fonts / 外部 CSS 加载

- **Given** 3D Model Viewer HTML 含 `<link href="https://fonts.googleapis.com/...">` 引用
- **When** iframe 加载完成，等待 2 秒（网络请求）
- **Then** console **无** `Refused to load stylesheet` / `Refused to load font` CSP 违规；`document.fonts.ready` resolve 成功（或至少 Network 面板有 fonts.googleapis.com 请求记录，无被 CSP 拦截）

### BDD-6: 小文件(<2MB) HTML 自动渲染无回归

- **Given** 一个 <2MB 的简单 HTML entry（含 inline `<script>`）已创建
- **When** 在 EntryDetailView 打开该 entry（无手动点击渲染步骤）
- **Then** iframe 自动渲染，inline script 执行，loading 态在 iframe load 事件后消失；不显示「点击渲染」按钮

### BDD-7: 纯文本 HTML（无 script）正常渲染

- **Given** 一个无 `<script>` 的纯文本 HTML entry（如 `<html><body><h1>Hello</h1></body></html>`）
- **When** 在 EntryDetailView 打开该 entry
- **Then** iframe 内显示「Hello」标题，无 CSP 违规，无 JS 错误，loading 态正常消失

### BDD-8: sandbox 安全性——iframe 无法访问主页面凭据

> **[SCOPE+] 2026-06-23 更新**：验证方式从 srcdoc（origin=null）改为后端 render 路由（同源加载 + sandbox opaque origin）。

- **Given** 主页面已登录（`peekview_token` cookie 存在），且 HtmlViewer 正在渲染任一 HTML
- **When** Playwright 在 iframe 内尝试执行 `document.cookie`、`localStorage.getItem('peekview_token')`、`fetch('/api/entries')`（带凭据）
- **Then**
  - `document.cookie` 返回空字符串（sandbox 无 `allow-same-origin`，iframe 在 opaque origin 运行，虽同源加载但无法访问 cookie）
  - `localStorage` 抛 `SecurityError` 或返回 null
  - `fetch('/api/entries')` 因 sandbox opaque origin 无法携带主页面 cookie，**不携带主页面 cookie**（请求为匿名跨域请求，主页面 cookie 不被发送）
  - **补充验证**：iframe 初始加载 render URL 时浏览器自动携带 cookie（sandbox 不影响初始 resource fetch），private entry 的 iframe 能正常加载

## gate_commands

> **[SCOPE+] 2026-06-23 增补**：后端 render 路由 + BS4 注入新增后端测试。

```bash
# 1. 后端单元测试（[SCOPE+] 新增）
cd backend && python3 -m pytest tests/test_html_render.py -v
cd backend && python3 -m pytest tests/test_api.py -v  # 无回归

# 2. 后端 lint
cd backend && make lint

# 3. 前端单元测试（P3 产出，P5 gate）
cd frontend-v3 && npx vitest run src/components/__tests__/HtmlViewer.spec.ts
cd frontend-v3 && npx vitest run src/components/__tests__/HtmlViewerIntegration.spec.ts

# 4. 全量单元测试（确保无回归）
cd frontend-v3 && npx vitest run

# 3. 类型检查 + 构建
cd frontend-v3 && npm run build

# 4. Lint
cd frontend-v3 && npm run lint

# 5. Playwright 实跑（P6 gate）—— 3D Model Viewer + CSP/WebGL 验证
make debug-start
# 通过 Playwright CDP 127.0.0.1:18800：
#   a. 创建 entry 指向测试样本 HTML
#   b. 打开 entry，点击「点击渲染」
#   c. page.on('console') 抓取 CSP 违规（应为 0 条）
#   d. 检查 iframe 内 #root childElementCount > 0
#   e. 检查 iframe 内 canvas + WebGL context 非 null
#   f. 采样两帧 canvas.toDataURL() 确认渲染循环
#   g. vision-helper 截图确认 3D 模型可见
make debug-stop
```

## 隐含依赖检查

### 1. `injectResources()` 兄弟文件注入逻辑 ✅ 兼容

`injectResources(html, siblings)` 返回 `{ html: string, unmatchedCount: number }`，输出是 **HTML 字符串**。srcdoc 属性直接接收 HTML 字符串，**无需改动**。

- 当前流程：`content` → `injectResources` → `processedHtml` → `createBlobUrl(processedHtml)` → `blobUrl` → `:src="blobUrl"`
- 改后流程：`content` → `injectResources` → `processedHtml` → `processedHtml ref` → `:srcdoc="processedHtml"`

中间产物形态不变，只是末端的载体从 Blob 换成字符串。

### 2. `onIframeLoad` 时机变化 ⚠️ 已识别（P0 风险 4）

- **blob URL**：load 事件在 iframe 完整加载（含所有同步资源）后触发。
- **srcdoc**：load 事件在 HTML 解析完成、**同步 script 执行完**后触发，但 Three.js 初始化（异步 import、模型加载）可能跨多个微任务/宏任务。

**影响**：loading 态可能在 Three.js 还在初始化时消失，用户看到短暂空白或未渲染 canvas。

**判定**：可接受。loading 的语义是「iframe 加载完成」而非「内容渲染完成」。P6 实跑时观察实际体验，若 >3 秒空白才考虑加渲染完成检测（超范围，需 [NEED_CONFIRM]）。

### 3. 其他组件依赖 `blobUrl` ✅ 无外部依赖

- `EntryDetailView.vue:126-131` 仅通过 props 传 `content` / `siblingFiles` / `loadingSiblings`，**未引用** `blobUrl`。
- **无全屏功能**依赖 blobUrl（grep 确认 `blobUrl` 仅出现在 `HtmlViewer.vue` 内部）。
- `blobUrl` ref 是 HtmlViewer 内部状态，改为 `processedHtml` ref 后对外接口不变。

### 4. [SCOPE+] 测试代码回补 ⚠️ 标记

**现有测试 `HtmlViewer.spec.ts` 有大量 Blob URL 相关断言需重写**：

- `describe('Blob URL 创建与释放')` 整块（约 3 个测试）：
  - `expect(createObjectURLMock).toHaveBeenCalledOnce()` → 删除或改为「不再调用 createObjectURL」
  - `expect(iframe.attributes('src')).toBe(mockBlobUrl)` → `expect(iframe.attributes('srcdoc')).toContain('<html')`
  - `expect(revokeObjectURLMock).toHaveBeenCalledWith(mockBlobUrl)` → 删除（srcdoc 无需 revoke）
- 其他 describe 块中 `mount(HtmlViewer)` 会触发 `createObjectURL` mock，改 srcdoc 后 mock 不再被调用，需确认 mock 不影响断言（多数测试只检查 iframe 属性，应无影响，但需逐个验证）。

**回补策略**（P3 阶段执行）：
- 删除 `Blob URL 创建与释放` describe 块，替换为 `srcdoc 渲染` describe 块：
  - 挂载时 `srcdoc` 属性含注入后的 HTML
  - content 变更时 `srcdoc` 更新
  - 卸载时无内存泄漏（无 blob 需 revoke，验证无残留即可）
- 新增 `CSP 属性` describe 块：
  - `csp` 属性含 `connect-src ... https:` / `worker-src blob:` / `font-src ... https:` 等
  - `csp` 属性含 `'unsafe-inline'`（解除 inline script 拦截的核心）
- 新增 `sandbox` 属性断言：`sandbox="allow-scripts"`（不含 `allow-same-origin`）

**影响阶段**：P3（TDD）。**不影响 P1 基线本身**，但 P3 工作量增加。

## 能力缺口检测

| 能力 | 状态 | 说明 |
|------|------|------|
| Playwright WebGL 检测 | available | `canvas.getContext('webgl')` + `toDataURL()` 帧采样，标准 API |
| 3D Model Viewer 测试样本 | available | `~/oclab/open-codesign/test01/AI-3D-Model-Viewer-Workspace-App-2026-06-22-135809.html`（3.3MB，已确认存在） |
| Playwright CDP 连接 | available | `make debug-start` 暴露 `127.0.0.1:18800`，已有 skill `playwright-cdp` |
| CSP 违规抓取 | available | `page.on('console')` + `page.on('pageerror')` |
| vision 截图确认 | available | skill `playwright-cdp` 的 vision-helper subagent |

**[CAPABILITY_GAP]**: 无。所有验证能力齐备，可直接进入 P2。

## 标记汇总

### [SCOPE+] 测试代码回补

**位置**：本文件「隐含依赖检查 §4」
**内容**：现有 `HtmlViewer.spec.ts` 的 Blob URL 相关测试需重写为 srcdoc 断言；新增 CSP 属性 / sandbox 属性测试。
**影响**：P3 工作量增加，但**不改变 P1 基线范围**（测试回补是 P3 的固有职责）。
**处置**：按 agate 工作流「[SCOPE+] 增补 P1 基线 + 定向回补（不全重跑）」——P3 阶段执行回补，不需回滚 P1。

### [NEED_CONFIRM] 无

需求方向明确（P0 已锁定方案：blob URL → srcdoc + CSP 放宽），无歧义点，无需停下问人。

### [CAPABILITY_GAP] 无

见上表，所有能力 available。

## 下一步

P1 基线已建立，可进入 P2（方案设计）：明确 CSP 每条指令的最终值、srcdoc 的 HTML 转义处理（`<` / `&` / 引号在 srcdoc 属性值中的转义）、`processedHtml` ref 的响应式策略。
