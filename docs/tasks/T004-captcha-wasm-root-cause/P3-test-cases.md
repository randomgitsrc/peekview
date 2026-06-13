---
phase: P3
task_id: T004
trace_id: T004-P3-20260612
created: 2026-06-12
---

# P3 测试用例：CAP_CUSTOM_WASM_URL 时序竞态治本

## 1. 测试策略

本任务改动范围极小（2 文件：main.ts 加一行赋值、index.html 移除一行内联脚本），且 P2 声明 `ui_affected: false`。测试设计以**构建验证 + E2E 验证**为主，不需要单元测试。

| 类型 | 用途 |
|------|------|
| 构建验证 | 确保 main.ts 修改后 `npm run build` 不报错，产物包含赋值语句 |
| E2E（Playwright） | 验证运行时 WASM 加载行为正确，控制台无错误 |

## 2. 测试用例

### TC-01: 构建成功 — main.ts 赋值不影响构建

| 字段 | 值 |
|------|-----|
| **BDD 追溯** | AC-1（前置条件：代码变更可构建） |
| **类型** | 构建验证 |
| **前置条件** | `frontend-v3/src/main.ts` 已添加 `window.CAP_CUSTOM_WASM_URL = '/wasm/cap_wasm_bg.wasm'` |
| **步骤** | 1. 执行 `npm run build` |
| **预期** | 构建成功（exit code 0），无 TypeScript 编译错误 |

### TC-02: 构建产物包含 CAP_CUSTOM_WASM_URL 赋值

| 字段 | 值 |
|------|-----|
| **BDD 追溯** | AC-1（赋值语句存在于产物中） |
| **类型** | 构建验证 |
| **前置条件** | `npm run build` 已成功 |
| **步骤** | 1. 在 `dist/assets/` 入口 chunk 中搜索 `CAP_CUSTOM_WASM_URL` |
| **预期** | 产物中包含 `CAP_CUSTOM_WASM_URL` 赋值语句，值为 `/wasm/cap_wasm_bg.wasm` |

### TC-03: index.html 产物中无 CAP_CUSTOM_WASM_URL 内联脚本

| 字段 | 值 |
|------|-----|
| **BDD 追溯** | AC-1（内联脚本已移除，逻辑迁入 main.ts） |
| **类型** | 构建验证 |
| **前置条件** | `npm run build` 已成功 |
| **步骤** | 1. 检查 `dist/index.html` 内容 |
| **预期** | `dist/index.html` 不包含 `CAP_CUSTOM_WASM_URL` 内联 `<script>` |

### TC-04: 生产环境 — WASM 从本地路径加载，无 CDN 请求

| 字段 | 值 |
|------|-----|
| **BDD 追溯** | AC-1, AC-2（生产模式） |
| **类型** | E2E（Playwright） |
| **前置条件** | 调试后端运行在 `:8888`，captcha 已启用 |
| **步骤** | 1. 打开首页，拦截所有网络请求<br>2. 点击登录按钮触发 LoginDialog<br>3. 等待 `cap-widget` 渲染<br>4. 检查网络请求中 `.wasm` 请求的 URL |
| **预期** | 存在请求 `/wasm/cap_wasm_bg.wasm`（状态 200），无 `cdn.jsdelivr.net` 的 WASM 请求 |

### TC-05: 生产环境 — 控制台无 WASM 加载错误

| 字段 | 值 |
|------|-----|
| **BDD 追溯** | AC-1, AC-2（生产模式） |
| **类型** | E2E（Playwright） |
| **前置条件** | 调试后端运行在 `:8888`，captcha 已启用 |
| **步骤** | 1. 监听浏览器控制台错误<br>2. 打开首页并触发登录对话框<br>3. 等待 cap-widget 完全渲染（5s）<br>4. 收集所有控制台错误 |
| **预期** | 控制台无 `cap wasm load failed` 错误，无 `NetworkError` 相关的 WASM 错误 |

### TC-06: 生产环境 — WASM 文件 HTTP 可访问

| 字段 | 值 |
|------|-----|
| **BDD 追溯** | AC-3 |
| **类型** | E2E（Playwright） |
| **前置条件** | 调试后端运行在 `:8888` |
| **步骤** | 1. `page.request.get('/wasm/cap_wasm_bg.wasm')` |
| **预期** | HTTP 200，Content-Type 为 `application/wasm` 或 `application/octet-stream` |

### TC-07: window.CAP_CUSTOM_WASM_URL 在 cap.js 加载前已设置

| 字段 | 值 |
|------|-----|
| **BDD 追溯** | AC-1 |
| **类型** | E2E（Playwright） |
| **前置条件** | 调试后端运行在 `:8888` |
| **步骤** | 1. 打开首页<br>2. 在页面加载完成后执行 `page.evaluate(() => window.CAP_CUSTOM_WASM_URL)` |
| **预期** | 返回值等于 `/wasm/cap_wasm_bg.wasm` |

### TC-08: CSP 拦截 CDN fallback（防御性验证）

| 字段 | 值 |
|------|-----|
| **BDD 追溯** | AC-4 |
| **类型** | E2E（Playwright） |
| **前置条件** | 调试后端运行在 `:8888` |
| **步骤** | 1. 打开首页，监听控制台 CSP 违规报告<br>2. 若 cap.js 尝试 CDN fallback，CSP 应拦截 |
| **预期** | 若有 CDN 请求，CSP 拦截属预期行为；页面功能不受影响 |

## 3. BDD 条件覆盖矩阵

| BDD 条件 | 测试用例 |
|----------|----------|
| **AC-1**: CAP_CUSTOM_WASM_URL 在 cap.js 初始化前设置 | TC-02, TC-04, TC-05, TC-07 |
| **AC-2**: 开发/生产环境一致性 | TC-04, TC-05（生产）；开发模式构建验证同 TC-01 |
| **AC-3**: 生产构建后 WASM 路径可访问 | TC-06 |
| **AC-4**: CDN fallback 被 CSP 正确拦截 | TC-08 |
| **AC-5**: 缓存场景 | P2 审核确认为"不涉及"，无代码层面缓存策略变更 |

## 4. 测试代码位置

本任务不需要新增独立测试文件。测试在 P5 技术验证阶段通过以下方式执行：

- **TC-01/02/03**: `npm run build` + 产物内容检查（手动或脚本）
- **TC-04~08**: 复用现有 `e2e/debug-captcha.spec.ts` 扩展，或通过 `make debug-test` 执行

## 5. 当前状态

所有测试用例依赖 P4 实现后才能执行验证。当前为红灯状态（代码未修改，CAP_CUSTOM_WASM_URL 仍在 index.html 内联脚本中，main.ts 未添加赋值）。
