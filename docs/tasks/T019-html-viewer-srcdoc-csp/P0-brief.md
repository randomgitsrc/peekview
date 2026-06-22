---
phase: P0
task_id: T019
task_name: html-viewer-srcdoc-csp
type: brief
trace_id: T019-P0-2026-06-22
created: 2026-06-22
status: ready
parent: docs/tasks/T018-plantuml-start-markers/P8-release.md
---

# T019: HTML Viewer srcdoc + CSP 放宽（支持 Three.js/WebGL/Canvas）

## 任务一句话

HtmlViewer.vue 的 iframe 从 blob URL 改为 srcdoc，解除主页 CSP 对 inline script 的继承性拦截；同时为 Three.js/WebGL/Canvas 等富交互 HTML 放宽 CSP（connect-src/worker-src/img-src/font-src），让 3D 渲染、模型加载、Web Worker 等场景正常工作。

## 触发原因

用户测试 open-codesign 生成的 3D Model Viewer HTML（3.3MB，含 Three.js + WebGL + Canvas）：

1. 页面显示"文件较大（3.3 MB），自动渲染已关闭"——这是正常的 >2MB 保护机制
2. 点击"点击渲染"后，iframe 1 秒内创建完成，但 **React/Three.js 永远不渲染**
3. Playwright 实测：iframe 内 8 个 inline `<script>` 全部被 CSP 拦截
4. console 8 条 `Executing inline script violates the following Content Security Policy directive 'script-src 'self' 'unsafe-eval''`

## 根因

### 根因 1：blob URL 继承主页面 CSP

后端 `main.py:148` 下发 HTTP header：
```
Content-Security-Policy: script-src 'self' 'unsafe-eval'; ...
```

这个 CSP 是为**主应用**设计的——只允许同源 script 文件 + eval，不允许 inline script（防 XSS）。

`HtmlViewer.vue:67` 用 `URL.createObjectURL(blob)` 创建 blob URL 作为 iframe src。**blob URL 继承创建者的 origin**（`http://127.0.0.1:8888`），因此也继承了该 origin 的 CSP。

虽然 `HtmlViewer.vue:69` 给 iframe 设了 `csp` 属性（含 `'unsafe-inline'`），但 iframe 的 `csp` 属性只能**额外限制**，不能放宽继承的 CSP。blob URL 继承的 `script-src 'self' 'unsafe-eval'` 已经拒绝了 `'unsafe-inline'`，iframe csp 属性无法解除。

### 根因 2：CSP 对 Three.js/WebGL 场景过严

即使解决了 inline script 问题，当前 iframe 的 CSP 还有其他限制：

| CSP 指令 | 当前值 | Three.js 需求 | 问题 |
|---------|--------|--------------|------|
| `connect-src` | `'none'` | `'self'` `https:` `blob:` `data:` | ❌ GLTFLoader.load() 加载模型失败 |
| `worker-src` | 未设 | `blob:` | ❌ Web Worker（物理引擎等）失败 |
| `img-src` | `blob: data:` | `blob: data: https:` | ⚠️ 外部纹理图片被拦 |
| `font-src` | `blob: data:` | `blob: data: https:` | ⚠️ Google Fonts 被拦 |
| `style-src` | `'unsafe-inline' blob: data:` | 加 `https:` | ⚠️ 外部 CSS 被拦 |

## 方案

### 改动 1：blob URL → srcdoc

```vue
<!-- 改前 -->
<iframe :src="blobUrl" sandbox="allow-scripts" csp="..." />

<!-- 改后 -->
<iframe :srcdoc="processedHtml" sandbox="allow-scripts" csp="..." />
```

**srcdoc 的 origin 是 null**——不继承主页面 CSP，iframe 的 `csp` 属性成为唯一 CSP 来源，完全可控。

**大小限制**：Chrome 对 srcdoc 无硬限制（实测 3.3MB 可行）；Firefox ~50MB；Safari 较保守但 3.3MB 没问题。

### 改动 2：CSP 专为富交互 HTML 设计

```
default-src 'unsafe-inline' 'unsafe-eval' blob: data: https:;
script-src 'unsafe-inline' 'unsafe-eval' blob: data: https:;
style-src 'unsafe-inline' blob: data: https:;
img-src blob: data: https:;
media-src blob: data: https:;
font-src blob: data: https:;
connect-src blob: data: https:;
worker-src blob:;
frame-src 'none';
form-action 'none';
```

**安全考量**：
- `sandbox="allow-scripts"` 不加 `allow-same-origin`——iframe 无法访问主页面 cookie/localStorage，即使 CSP 放宽 connect-src，也无法发起带凭据的请求
- `connect-src https:` 允许 fetch 外部 API——但无 same-origin 权限，不会泄露用户凭据
- `frame-src 'none'`——禁止 iframe 内嵌 iframe，防止钓鱼

### 改动 3：移除 Blob URL 管理

- 删除 `createBlobUrl` / `revokeBlobUrl` / `blobUrl` ref
- `initRender` 直接设置 `processedHtml` ref
- `onUnmounted` 不再需要 revoke

## 已知风险

- **风险 1（中）**：srcdoc 大小限制。Chrome 无硬限制但超大文档（>10MB）可能卡顿。测试文件 3.3MB 实测可行。Firefox/Safari 较保守，但 3.3MB 在所有主流浏览器都能工作。
- **风险 2（低）**：CSP 放宽 connect-src https: 后，恶意 HTML 可向外部发送数据。但 sandbox 无 allow-same-origin，无法读取用户凭据，风险可控。
- **风险 3（低）**：兄弟文件注入（injectResources）逻辑不变。注入后的 HTML 字符串直接作为 srcdoc 值。但 base64 二进制资源会让 srcdoc 变大——这是已知行为，不是回归。
- **风险 4（低）**：`onIframeLoad` 时机变化。srcdoc 的 load 事件在 HTML 解析完成后触发，但 inline script 可能还在执行（Three.js 初始化）。loading 态可能提前消失。可接受——loading 是"iframe 加载"不是"内容渲染完成"。
- **风险 5（需验证）**：srcdoc + sandbox="allow-scripts"（无 allow-same-origin）下，WebGL/Canvas/OffscreenCanvas 是否正常工作。理论上不需要 same-origin，但需 Playwright 实测确认。

## executor_env

```yaml
platform: opencode
has_task_tool: true
has_local_runtime: true
network: full
```

## env_constraints

```yaml
debug_env:
  start: make debug-start  # 127.0.0.1:8888, /tmp/peekview-debug/
  stop: make debug-stop
  test_entry_create: PEEKVIEW_DEBUG_MODE=1 peekview create -s "summary" /path/to/file.html
  playwright_cdp: 127.0.0.1:18800
  test_file: ~/oclab/open-codesign/test01/AI-3D-Model-Viewer-Workspace-App-2026-06-22-135809.html
  verify_console_errors: Playwright page.on('console') 抓 CSP 违规
  verify_webgl: Playwright 检查 iframe 内 canvas/WebGL context 是否创建
```

## pruning_tendency

**偏保留**，理由：

1. **涉及安全**：CSP 放宽是安全敏感改动，P6 必须实跑验证
2. **UI 受影响**：loading 态时机变化，P6 须视觉确认
3. **Three.js/WebGL 需真实浏览器验证**：单元测试无法覆盖 WebGL context 创建

建议裁剪：
- **P2 保留**：CSP 策略设计需要明确文档（哪些指令放宽容许什么、拒绝什么）
- **P3 保留**：TDD，为 srcdoc/CSP 逻辑写测试
- **P6 保留**：Playwright 实跑 3D Model Viewer HTML + vision 确认渲染
- **P7 保留**：HtmlViewer.vue + 可能的 main.py（如需调整后端 CSP）多文件一致性检查
- **P8 保留**：版本 bump + CHANGELOG

## phase_hint

[P1, P2, P3, P4, P5, P6, P7, P8]

## 验收标准（预填，P1 细化）

1. 3.3MB 的 3D Model Viewer HTML 点击"渲染"后，iframe 内 inline script 正常执行（console 无 CSP 违规）
2. React 组件渲染到 `#root`（`rootChildCount > 0`）
3. Three.js / WebGL context 正常创建（`canvas` 元素存在，`gl.getContext('webgl')` 非 null）
4. requestAnimationFrame 渲染循环运行（canvas 内容持续更新）
5. Google Fonts 正常加载（console 无 font CSP 违规）
6. 小文件 HTML（<2MB）仍自动渲染，无回归
7. 纯文本 HTML（无 script）仍正常渲染
