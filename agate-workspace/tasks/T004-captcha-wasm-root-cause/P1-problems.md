---
phase: P1
task_id: T004
task_name: captcha-wasm-root-cause
type: problems
trace_id: T004-P1-20260612
created: 2026-06-12
status: draft
parent: T003 治本需求 - 修复 CAP_CUSTOM_WASM_URL 不生效问题
---

## 1. 需求复述

T003 用"CSP 条件开放 CDN"方案治标，但产品要求治本：
- 用户的 captcha 验证功能实际**有效**（能正常验证）
- 但浏览器控制台报 `cap wasm load failed: NetworkError`，CSP 拦截了 CDN fallback
- 根因：`CAP_CUSTOM_WASM_URL` 在某些情况下未生效，导致 fallback 到 CDN

本任务分析为什么 `CAP_CUSTOM_WASM_URL` 可能没生效。

## 2. 隐含需求识别

### ID-1: cap.js 模块初始化时序问题 — 静态 import 立即执行

- **发现**：`LoginDialog.vue:116` 有 `import '@cap.js/widget'`，这是**顶层静态导入**
- **影响**：当 Vue 组件模块首次被解析时（可能早于任何组件实例化），ES 模块加载器会立即执行 `@cap.js/widget` 的初始化代码
- **cap.js 源码（第 270-275 行）**：
  ```javascript
  if (typeof WebAssembly === "object" && typeof WebAssembly.compile === "function") {
    getWasmModule().catch(() => {});
  }
  ```
  这段代码在 cap.js **模块加载时立即执行**，而非等待组件实例化
- **时序竞态**：`index.html` 中 `CAP_CUSTOM_WASM_URL` 设置是同步脚本，但 Vite 模块加载是异步的。若 Vite 预加载、缓存或并发请求导致 `@cap.js/widget` 在 `<script>` 之前被求值，则 `window.CAP_CUSTOM_WASM_URL` 为 `undefined`
- **为什么必须处理**：时序问题不解决，即使 WASM 文件存在、CSP 正确配置，fallback 仍可能在某些浏览器/网络条件下触发

### ID-2: Vite dev server 模块预加载可能提前触发 cap.js 初始化

- **发现**：`frontend-v3/vite.config.ts` 使用默认配置，Vite 可能对依赖做预取
- **影响**：开发模式下 Vite 的模块图预加载可能导致 `@cap.js/widget` 在同步脚本执行前被触发
- **为什么必须验证**：开发环境与生产环境时序可能不同，需确保两边都可靠

### ID-3: 浏览器缓存导致旧 JS 被加载

- **发现**：若用户浏览器缓存了旧版本的前端 JS（不含 `CAP_CUSTOM_WASM_URL` 设置逻辑），即使服务端已更新，本地仍使用旧逻辑
- **影响**：这不是代码 bug，而是部署/缓存策略问题
- **为什么必须考虑**：用户报告的问题可能并非代码问题，而是缓存问题未被识别

### ID-4: 本地 WASM 文件在部分部署模式下不可访问

- **发现**：构建产物在 `backend/peekview/static/wasm/cap_wasm_bg.wasm` 存在
- **影响**：需验证后端静态文件服务配置是否正确映射 `/wasm/*` 路径
- **为什么必须验证**：如果 WASM 文件 404，fetch 失败后 cap.js 会 fallback 到 CDN

## 3. BDD 验收条件

### AC-1: 时序问题修复 — CAP_CUSTOM_WASM_URL 必须在 cap.js 初始化前设置

```
Given 用户访问登录页面（首次加载，无缓存）
When 浏览器解析 LoginDialog.vue 组件并执行 import '@cap.js/widget'
Then window.CAP_CUSTOM_WASM_URL 已经等于 '/wasm/cap_wasm_bg.wasm'
  And cap.js getWasmModule() 第一次 fetch 尝试从 /wasm/cap_wasm_bg.wasm 加载
  And 浏览器 Network 面板无 cdn.jsdelivr.net 请求
```

### AC-2: 开发环境与生产环境一致性

```
Given Vite dev server 运行在端口 5173
  And 后端服务运行在端口 8080
When 浏览器打开 http://localhost:5173 并触发登录对话框
Then 控制台无 'cap wasm load failed' 错误
  And fetch('/wasm/cap_wasm_bg.wasm') 返回 200

Given 前端已构建并复制到后端 static 目录
  And 后端以生产模式启动
When 浏览器打开 http://localhost:8080 并触发登录对话框
Then 控制台无 'cap wasm load failed' 错误
  And fetch('/wasm/cap_wasm_bg.wasm') 返回 200
```

### AC-3: 生产构建后 WASM 路径可访问

```
Given 前端执行 npm run build
  And 构建产物已复制到 backend/peekview/static/
When curl http://localhost:8080/wasm/cap_wasm_bg.wasm
Then 响应 HTTP 200
  And Content-Type 为 application/wasm 或 application/octet-stream
```

### AC-4: 即使时序问题修复后，CDN fallback 仍被 CSP 正确拦截（防御性验证）

```
Given captcha 功能正常（CAP_CUSTOM_WASM_URL 生效）
  And CSP connect-src 仅包含 'self'
When cap widget 因任何原因触发 CDN fallback
Then fetch 请求被 CSP 拦截（符合预期）
  And 不影响页面其他功能
```

### AC-5: 缓存场景验证

```
Given 用户曾访问过网站（浏览器缓存了旧的 index.html 和 JS）
When 部署新版本后用户刷新页面（未清除缓存）
Then 页面仍能正确加载（可能通过 CDN fallback）
  Or 页面展示提示要求用户清除缓存/硬刷新
```

## 4. 待确认清单

无 `[NEED_CONFIRM]`。

- 时序问题是否是唯一根因 → 确认方向：AC-1/AC-2 覆盖
- 缓存问题是否需要代码层面解决 → 确认方向：AC-5 验证实际影响，若普遍需加版本号/ETag
- 是否需要修改 index.html 脚本顺序 → 确认方向：AC-1 若失败，P2 需探索替代方案

## 5. 裁剪说明

```
phases: [P1, P2, P3, P4, P5, P6]
```

| 跳过阶段 | 理由 |
|----------|------|
| P7 | 单文件改动（frontend-v3/src/main.ts 或 index.html），无跨文件一致性风险 |
| P8 | 版本无需 bump（P1 问题分析阶段） |

## 6. 范围声明

```yaml
packages:
  - peekview    # 后端 static 文件服务
domains:
  - frontend    # main.ts 初始化顺序或 index.html 脚本顺序
  - security    # CSP 策略验证
```

**分析结论**：

核心根因是 **cap.js 模块在 import 时立即执行 WASM 预加载**，与 `index.html` 中 `CAP_CUSTOM_WASM_URL` 设置脚本存在**时序竞态**。当前 `<script>window.CAP_CUSTOM_WASM_URL = ...</script>` 放在 `<script type="module">` 之前，但 Vite 模块加载的异步特性可能导致 `@cap.js/widget` 在同步脚本执行前被求值。

**建议治本方案**：
将 `CAP_CUSTOM_WASM_URL` 设置移到 Vue 应用初始化阶段（`frontend-v3/src/main.ts` 开头），确保在任何组件（包括 LoginDialog）被解析和导入之前，变量已存在于 `window` 对象上。