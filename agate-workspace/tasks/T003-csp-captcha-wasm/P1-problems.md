---
phase: P1
task_id: T003
task_name: csp-captcha-wasm
type: problems
trace_id: T003-P1-20260612
created: 2026-06-12
status: draft
parent: 用户报告 CSP 拦截 captcha WASM
---

## 1. 需求复述

Cap captcha WASM 加载被 CSP 拦截，导致 `cap wasm load failed: NetworkError`。当前已做本地化（`CAP_CUSTOM_WASM_URL = '/wasm/cap_wasm_bg.wasm'`），但 cap widget JS 构建产物中有 CDN fallback（`window.CAP_CUSTOM_WASM_URL || "https://cdn.jsdelivr.net/..."`），若 fallback 触发则被 `connect-src 'self'` 拦截。

**核心问题**：CSP `connect-src 'self'` 与 cap widget CDN fallback 不兼容，需确保本地 WASM 始终可用 + CSP 仅在 captcha 启用时放宽必要域名。

## 2. 隐含需求识别

### ID-1: cap widget 静态导入触发推测性 WASM 预加载（即使 captcha 未启用）

- **发现**：`LoginDialog.vue:116` 静态 `import '@cap.js/widget'`，cap.js 模块初始化时（第 270-275 行）无条件调用 `getWasmModule().catch(() => {})` 做推测性预加载
- **影响**：即使 `captcha_enabled=false`，只要 LoginDialog 组件被加载，WASM 预加载就会触发。如果 `CAP_CUSTOM_WASM_URL` 因任何原因未生效，fetch 回退到 CDN → CSP 拦截 → 控制台报错
- **为什么必须处理**：控制台报错影响诊断，可能误导用户以为 captcha 有问题；且 WASM fetch 失败虽 `.catch(() => {})` 静默吞掉，但浏览器 DevTools 会显示 CSP 违规

### ID-2: `connect-src 'self'` 在 captcha 未启用时已足够，不应无条件放宽

- **发现**：当前 CSP 是硬编码的，不管 captcha 是否启用都一样
- **影响**：如果无条件给 `connect-src` 加 CDN 域名，等于即使不使用 captcha 也开放外部网络请求，违反最小权限
- **为什么必须处理**：CSP 是安全边界，应仅在功能启用时放宽

### ID-3: Vite 构建可能影响 `CAP_CUSTOM_WASM_URL` 设置时序

- **发现**：`index.html` 中 `<script>window.CAP_CUSTOM_WASM_URL = '/wasm/cap_wasm_bg.wasm'</script>` 在 `<script type="module">` 之前，时序正确
- **影响**：Vite dev server vs 生产构建的文件服务路径一致，风险较低，但需验证生产构建后 `/wasm/cap_wasm_bg.wasm` 确实可访问
- **为什么必须验证**：如果构建产物缺失 WASM 文件或路径不对，`CAP_CUSTOM_WASM_URL` 指向 404 → fetch 失败 → 同样回退 CDN

### ID-4: cap widget 的 CDN fallback 无法从应用层禁用

- **发现**：cap.js 第 246 行 `window.CAP_CUSTOM_WASM_URL || CDN_URL`，fallback 是第三方库硬编码行为
- **影响**：无法通过配置让 cap.js "不要 fallback"，只能确保 `CAP_CUSTOM_WASM_URL` 始终有效 + 本地 WASM 文件始终可访问
- **为什么必须处理**：这意味着"本地 WASM 一定可用"是硬性前提，不是可选优化

## 3. BDD 验收条件

### AC-1: captcha 未启用时，本地 WASM 正常加载，无 CSP 违规

```
Given captcha_enabled = false
  And 浏览器加载登录页面
When cap widget JS 模块初始化（推测性预加载 WASM）
Then 浏览器从 '/wasm/cap_wasm_bg.wasm' 加载 WASM（HTTP 200）
  And 浏览器控制台无 CSP 违规报告
  And 无 CDN fetch 请求（Network 面板无 jsdelivr.net 请求）
```

### AC-2: captcha 启用时，本地 WASM 正常加载 + CSP 允许必要连接

```
Given captcha_enabled = true
  And 浏览器加载登录页面
When 用户看到 captcha widget 并完成 PoW
Then WASM 从 '/wasm/cap_wasm_bg.wasm' 加载成功
  And captcha challenge/redeem API 调用成功（'self' 范围内）
  And 浏览器控制台无 CSP 违规报告
```

### AC-3: 生产构建后 WASM 文件路径可访问

```
Given 前端已构建（npm run build）
  And 后端以生产模式启动
When 浏览器请求 GET /wasm/cap_wasm_bg.wasm
Then 响应 HTTP 200
  And Content-Type 为 application/wasm
```

### AC-4: CSP 不为未使用 captcha 的实例无条件开放外部域名

```
Given captcha_enabled = false
When 查看 SPA 页面的 Content-Security-Policy 头
Then connect-src 不包含 cdn.jsdelivr.net 或其他外部域名
  And connect-src 为 'self'（或 'self' + 其他同源需求）
```

### AC-5: 即使 CAP_CUSTOM_WASM_URL 因故未生效，也不产生不可恢复的错误

```
Given 浏览器加载登录页面
  And CAP_CUSTOM_WASM_URL 变量因故未设置（极端场景）
When cap widget JS 尝试加载 WASM
Then WASM 从 CDN fallback 加载被 CSP 拦截时
  And 不影响页面其他功能正常使用（登录表单仍可操作）
  And 控制台错误可识别为 captcha WASM 问题
```

## 4. 待确认清单

无 `[NEED_CONFIRM]`。

- CDN fallback 无法从应用层禁用 → 确认方向：确保本地 WASM 始终可用 + CSP 条件开放，而非修改第三方库
- captcha 启用/未启用时 CSP 是否需要区分 → 确认方向：区分（AC-4 已覆盖），但本地 WASM 路径始终在 'self' 内，不需要额外开放

## 5. 裁剪说明

```
phases: [P1, P4, P5]
```

| 跳过阶段 | 理由 |
|----------|------|
| P2 | 方案明确：CSP `connect-src` 条件开放 captcha 必要域名；无需探索替代方案 |
| P3 | 配置变更（CSP header + 条件判断），无需 TDD |
| P6 | P5 技术验证覆盖 BDD 条件实跑，无独立验收需求 |
| P7 | 单文件改动（main.py CSP header），无跨文件一致性风险 |
| P8 | 配置变更无需版本 bump 或发布流程 |

## 6. 范围声明

```yaml
packages:
  - peekview    # 后端 CSP header 条件化
domains:
  - backend     # main.py CSP 设置
  - security    # CSP 策略变更
  - frontend    # 验证 WASM 本地路径可用性（无需代码改动，前端已就绪）
```

**不需改动的部分**：
- `frontend-v3/index.html`：`CAP_CUSTOM_WASM_URL` 已正确设置
- `frontend-v3/public/wasm/`：本地 WASM 文件已存在
- `LoginDialog.vue`：静态 import 已就绪
- `@cap.js/widget`：第三方库不修改

**需改动的部分**：
- `backend/peekview/main.py`：CSP `connect-src` 根据 captcha 是否启用条件生成
