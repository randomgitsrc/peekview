---
phase: P2
task_id: T004
task_name: captcha-wasm-root-cause
trace_id: T004-P2-20260612
created: 2026-06-12
parent: docs/tasks/T004-captcha-wasm-root-cause/P1-problems.md
---

packages: [peekview]
domains: [frontend, security]
ui_affected: false

# P2 设计：CAP_CUSTOM_WASM_URL 时序竞态治本

## 1. 影响域分析

### 改什么

| 文件 | 变更 |
|------|------|
| `frontend-v3/src/main.ts` | 在文件顶部（import 语句之后）添加 `window.CAP_CUSTOM_WASM_URL` 赋值 |
| `frontend-v3/index.html` | 移除 `<script>window.CAP_CUSTOM_WASM_URL = ...</script>` 行（逻辑迁入 main.ts，消除两处设置的维护负担） |

### 不改什么

| 文件/模块 | 理由 |
|-----------|------|
| `LoginDialog.vue` | `import '@cap.js/widget'` 保持不变；改为动态 import 可引入新风险 |
| `@cap.js/widget` 源码 | 第三方库，不改 |
| `vite.config.ts` | 无需修改；`define` 方案不适用（第三方库读 `window` 变量） |
| `backend/` 静态文件服务 | `/wasm/*` 路径通过 catch-all 路由已能正确提供 |
| CSP 策略 | 不变更；AC-4 防御性验证确认 CSP 拦截 CDN fallback 是预期行为 |

### 风险在哪

| 风险 | 缓解 |
|------|------|
| ES 模块提升导致 import 先于赋值执行 | `@cap.js/widget` 不在 main.ts 的静态 import 图中（通过路由懒加载），main.ts 函数体执行时 cap.js 尚未加载。详见 §2.1 时序证明 |
| 开发模式下 Vite 预构建改变加载顺序 | 开发模式同步 `<script>` 仍在 `<script type="module">` 之前；移除 index.html 中的内联脚本后，变量由 main.ts 设置，时序更可靠 |
| 未来有人将 LoginDialog 改为静态导入 | 在 main.ts 中添加注释说明赋值必须在 cap.js 加载前执行 |

## 2. 设计方案

### 2.1 方案：在 main.ts 中设置 CAP_CUSTOM_WASM_URL

**核心思路**：将 `window.CAP_CUSTOM_WASM_URL` 赋值从 `index.html` 内联脚本移至 `main.ts` 模块体顶部。同时移除 `index.html` 中的对应行。

**时序证明（为什么可行）**：

```
时间线（生产构建）:
1. 浏览器解析 index.html
2. <script type="module"> 标记入口 chunk (index-*.js)
3. 入口 chunk 加载 → 解析静态 import 图 (vue, pinia, App.vue, router.ts, stores, CSS)
   └─ 注意：EntryListView 是懒加载 (dynamic import)，不在初始 import 图中
   └─ 注意：LoginDialog 在 EntryListView 中，而 @cap.js/widget 在 LoginDialog 中
   └─ 因此 @cap.js/widget 不在初始 import 图中
4. 入口 chunk 模块体执行 → window.CAP_CUSTOM_WASM_URL = '/wasm/...' ✅ 已设置
5. createApp + mount
6. 路由导航 → 懒加载 EntryListView chunk → 加载 @cap.js/widget
7. @cap.js/widget 模块体执行 → 读取 window.CAP_CUSTOM_WASM_URL ✅ 值已存在
8. getWasmModule() fetch 本地 WASM → 200 ✅
```

**关键事实**：`@cap.js/widget` 在 `LoginDialog.vue:116` 通过 `import '@cap.js/widget'` 静态导入，但 `LoginDialog` 在 `EntryListView.vue` 中导入，而 `EntryListView` 在 `router.ts` 中通过 `() => import(...)` 懒加载。因此 cap.js 不在 main.ts 的初始 import 图中。

**ES 模块语义补充说明**：

虽然 ES 模块规范规定「静态 import 在模块体代码之前解析」，但这不影响本方案：
- main.ts 的静态 import 图 = { vue, pinia, App.vue, router.ts, auth store, CSS } — **不含** @cap.js/widget
- main.ts 模块体执行时，cap.js 尚未被任何代码引用
- cap.js 仅在懒加载 chunk 被请求时才加载和执行，此时 main.ts 早已执行完毕

### 2.2 具体改动

**frontend-v3/src/main.ts**：

```typescript
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router.ts'
import { useAuthStore } from './stores/auth'
import './styles/variables.css'
import './styles/base.css'

// CAP_CUSTOM_WASM_URL must be set before @cap.js/widget is loaded.
// cap.js reads this at module-evaluation time to determine WASM fetch URL.
// This works because @cap.js/widget is only imported inside LoginDialog.vue,
// which is lazy-loaded via router — so cap.js loads AFTER main.ts executes.
window.CAP_CUSTOM_WASM_URL = '/wasm/cap_wasm_bg.wasm'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

const authStore = useAuthStore()
authStore.fetchMe().finally(() => {
  app.mount('#app')
})
```

**frontend-v3/index.html**：

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PeekView</title>
    <!-- Theme initialization - prevent FOUC (sync script, runs before render) -->
    <script src="/js/theme-init.js"></script>
    <!-- GitHub Markdown CSS (local) -->
    <link rel="stylesheet" href="/css/github-markdown.css">
    <!-- Fonts (local) -->
    <link rel="stylesheet" href="/fonts/inter.css">
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

（移除 `<!-- Captcha WASM local path -->` 注释及对应 `<script>` 行）

### 2.3 方案否决记录

| 方案 | 否决理由 |
|------|----------|
| 保留 index.html 内联脚本 + main.ts 赋值（双写） | 两处设置同一变量，维护时易遗漏一处；无额外收益 |
| 在 vite.config.ts 中用 `define` 注入 | `define` 做的是编译时文本替换，但 `@cap.js/widget` 读的是 `window.CAP_CUSTOM_WASM_URL`，define 无法影响第三方库的 window 读取 |
| 将 `import '@cap.js/widget'` 改为动态 `import()` | 增加组件复杂度；cap.js 的 custom element 注册时机变化可能引入新问题；过度工程 |
| 在 index.html 中调整脚本顺序 | 当前顺序已是正确的（sync script 在 module script 之前）；问题根源是开发者可能误以为 index.html 设置可靠，实际应将初始化逻辑收敛到 JS 模块中 |

## 3. BDD 条件覆盖

| AC | 覆盖方式 |
|----|----------|
| **AC-1**: CAP_CUSTOM_WASM_URL 在 cap.js 初始化前设置 | main.ts 模块体在懒加载 chunk 之前执行，cap.js 在懒加载 chunk 中。时序保证见 §2.1 |
| **AC-2**: 开发/生产环境一致性 | 两种模式均通过 main.ts 设置变量，路径一致为 `/wasm/cap_wasm_bg.wasm`；开发模式 Vite 从 `public/wasm/` 提供文件，生产模式后端 catch-all 路由提供 |
| **AC-3**: 生产构建后 WASM 路径可访问 | 不涉及；WASM 文件在 `public/wasm/` → `dist/wasm/` → `backend/static/wasm/`，构建流程不变 |
| **AC-4**: CDN fallback 被 CSP 正确拦截 | 不涉及；CSP 策略不变 |
| **AC-5**: 缓存场景 | 不涉及；本方案不改变缓存策略。旧缓存 index.html 中的内联脚本被移除后，旧版本仍能通过 CDN fallback（被 CSP 拦截但不影响功能，因为 cap.js 有 JS fallback solver） |

## 4. 实现完成标志

- [ ] `frontend-v3/src/main.ts` 在 import 语句后、`createApp` 前设置了 `window.CAP_CUSTOM_WASM_URL`
- [ ] `frontend-v3/index.html` 中已移除 `CAP_CUSTOM_WASM_URL` 内联脚本
- [ ] 生产构建后浏览器控制台无 `cap wasm load failed` 错误
- [ ] Network 面板 WASM 请求目标为 `/wasm/cap_wasm_bg.wasm`（非 CDN）
- [ ] 开发模式（Vite :5173）同样无 WASM 加载错误
