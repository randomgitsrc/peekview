# 实现计划：JWT → httpOnly Cookie + 前端 CSP

> 来源：improvement-backlog.md #4 #5
> 日期：2026-06-10
> 冲突风险：🟡 中（改 backend auth + frontend auth store，可能与 captcha agent 冲突）

---

## #4 JWT → httpOnly Cookie

### 问题

前端 JWT 存在 `localStorage['peekview_token']`，Markdown 渲染若有 XSS 绕过可直接窃取 token。
httpOnly Cookie 浏览器 JS 无法读取，即使 XSS 也偷不走。

### 现状分析

| 组件 | 当前实现 |
|------|---------|
| 后端 `auth.py` | `create_access_token()` 生成 JWT，login/register 返回 `access_token` JSON |
| 前端 `client.ts` | `localStorage.setItem('peekview_token', token)` 存储 |
| 前端 `client.ts` | 请求拦截器从 localStorage 读 token → `Authorization: Bearer` |
| 前端 `client.ts` | 响应拦截器 401 时清 localStorage |
| 后端 `get_current_user` | 从 `Authorization: Bearer` 头读 JWT |
| 后端 CORS | `allow_credentials=True` 已配置 |
| CLI / MCP | 用 `Authorization` 头或 `X-API-Key` 头，不受影响 |

### 设计决策

#### D1：双模式（Cookie + Header 并存）

httpOnly Cookie 用于浏览器 SPA，`Authorization: Bearer` 继续用于 CLI/MCP/curl。
`get_current_user` 检查顺序：**Authorization Header JWT → Cookie JWT → X-API-Key**。

Header JWT 优先于 Cookie JWT，避免混淆 deputy 问题：
当请求同时携带 Cookie（浏览器自动附加）和 Authorization header（显式设置）时，
以显式的 header 为准。

**理由**：CLI/MCP 不是浏览器，无法使用 Cookie。双模式保证向后兼容。

#### D2：SameSite=Lax

Cookie 设置 `SameSite=Lax`，防止 CSRF（跨站请求不携带 Cookie）。
同站导航（从外部链接进入 PeekView）仍携带 Cookie，用户体验不受影响。

**不用 Strict**：Strict 会阻断从外部链接进入时的认证态，体验差。

#### D3：不引入 CSRF Token

`SameSite=Lax` 已防护 CSRF。加上 API 主要是 JSON POST（非表单提交），
浏览器对 `Content-Type: application/json` 的跨站请求会触发 CORS preflight。
CSRF Token 增加复杂度但收益有限。

#### D4：不引入 Refresh Token

当前 JWT 有效期 7 天。引入 Refresh Token 需要后端维护 token 存储，
增加复杂度。7 天过期后重新登录，用户体验可接受。

**未来路径**：如果需要即时吊销 token，应引入 `jti` + 黑名单，而非 Refresh Token。

#### D5：login/register 成功后 Set-Cookie + 仍返回 access_token

后端 login/register 响应同时：
1. `Set-Cookie: peekview_token=<jwt>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=<from config>`
2. JSON body 仍返回 `access_token`（向后兼容 CLI/MCP）

前端忽略 JSON body 中的 `access_token`（浏览器通过 Cookie 自动认证）。
CLI/MCP 从 JSON body 读取 `access_token` 用于 `Authorization: Bearer` header。

前端改为从 Cookie 自动携带（浏览器行为），不再写 localStorage。

### 改动清单

#### 1. `backend/peekview/api/auth.py`

login 和 register 端点在返回 JSON 响应时同时 Set-Cookie：

```python
from fastapi import Response

@router.post("/login")
@limiter.limit(login_rate_limit)
async def login(data: UserLogin, request: Request, response: Response) -> AuthResponse:
    # ... 现有逻辑 ...
    token = create_access_token(user.id, config.auth.secret_key, config.auth.token_expire_days)
    
    # Set httpOnly cookie（Max-Age 从 config 读取，不硬编码）
    response.set_cookie(
        key="peekview_token",
        value=token,
        httponly=True,
        secure=request.url.scheme == "https",
        samesite="lax",
        max_age=config.auth.token_expire_days * 86400,
        path="/",
    )
    
    return AuthResponse(access_token=token, token_type="bearer", user=user_response)
```

register 同理。

#### 2. `backend/peekview/api/auth.py` — logout 端点

现在 logout 是 no-op。改为清除 Cookie：

```python
@router.post("/logout", status_code=204)
async def logout(response: Response):
    response.delete_cookie(key="peekview_token", path="/")
    return None
```

#### 3. `backend/peekview/auth.py` — `get_current_user` 增加 Cookie 读取

```python
def get_current_user(request: Request) -> User | None:
    # 1. Authorization header (JWT / API key) — 保持不变
    auth_header = request.headers.get("Authorization", "")
    x_api_key = request.headers.get("X-API-Key", "")
    
    # 2. httpOnly Cookie (browser SPA)
    cookie_token = request.cookies.get("peekview_token")
    
    # JWT 验证：优先 header，其次 cookie
    jwt_token = None
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        if _looks_like_jwt(token):
            jwt_token = token
    if jwt_token is None and cookie_token:
        jwt_token = cookie_token
    
    # 后续：验证 jwt_token / API key / 返回 None — 逻辑不变
```

#### 4. `frontend-v3/src/api/client.ts`

**移除**：
- `localStorage.setItem(TOKEN_KEY, ...)` — 不再写 localStorage
- 请求拦截器中的 `localStorage.getItem(TOKEN_KEY)` — Cookie 自动携带

**修改**：
- 请求拦截器：移除 `Authorization` header 注入（Cookie 由浏览器自动携带）
- 响应拦截器：401 时调用 `api.logout()` 清 Cookie（而非清 localStorage）
- `withCredentials = true`（same-origin 下 no-op，跨域部署时必需）

```typescript
// 构造函数中：
this.client.defaults.withCredentials = true

// 请求拦截器：移除 token 注入
this.client.interceptors.request.use((config) => config)

// 响应拦截器：401 时清 Cookie
this.client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      this.client.post('/auth/logout').catch(() => {})  // 清 httpOnly cookie
      window.dispatchEvent(new CustomEvent('peekview:auth-expired'))
    }
    return Promise.reject(error)
  }
)

// 移除：所有 localStorage.getItem/setItem/removeItem(TOKEN_KEY)
```

#### 5. `frontend-v3/src/stores/auth.ts`

**移除**：`token` ref + `TOKEN_KEY` 常量 + 所有 `localStorage` 读写

**重新设计**：不再跟踪 JWT token 字符串（httpOnly Cookie JS 无法读取），
改为用 `user` ref 作为唯一认证状态源：

```typescript
// 之前：
const TOKEN_KEY = 'peekview_token'
const token = ref<string | null>(localStorage.getItem(TOKEN_KEY))
const isLoggedIn = computed(() => !!token.value)

// 之后：
const user = ref<User | null>(null)
const isLoggedIn = computed(() => !!user.value)
```

**修改** `fetchMe()`：
```typescript
async function fetchMe(): Promise<void> {
  try {
    user.value = await api.getMe()  // Cookie 自动携带
  } catch {
    user.value = null
  } finally {
    initializing.value = false
  }
}
```

**修改** `logout()`：
```typescript
function logout(): void {
  api.logout()  // POST /auth/logout → 服务端清 cookie
  user.value = null
}
```

**修改** `login()` / `register()`：
```typescript
// 之前：
token.value = result.accessToken
user.value = result.user

// 之后：不再设置 token，后端 Set-Cookie 已自动设置
user.value = result.user
```

**需同步更新所有 `token` 引用**：
- `LoginDialog.vue` — submit handler 不再读 `result.accessToken`
- `EntryListView.vue` — logout handler 不再清 localStorage
- `client.ts` — 移除 `TOKEN_KEY`、请求拦截器 token 注入、401 拦截器 localStorage 操作

#### 6. `frontend-v3/src/components/LoginDialog.vue`

login/register 成功后不再需要手动存 token：
```typescript
// 之前：authStore.login() 内部写 localStorage
// 现在：后端 Set-Cookie 自动设置，前端只需更新 user
```

#### 7. `frontend-v3/e2e/debug-server.spec.ts` — E2E 测试全面重写

`setupAuth()` 辅助函数改用 Playwright Cookie API：

```typescript
// 之前：
async function setupAuth(page: any, token: string) {
  await page.evaluate((t: string) => {
    localStorage.setItem('peekview_token', t); return true
  }, token)
}

// 之后：
async function setupAuth(page: any, token: string) {
  await page.context().addCookies([{
    name: 'peekview_token',
    value: token,
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax' as const,
  }])
}
```

直接 API 调用（`page.request.post`）的 `Authorization: Bearer` header 保持不变
（这些是 API 级别测试，不走浏览器 Cookie）。

登出测试（行 625）从 `localStorage.getItem()` 改为检查 Cookie：
```typescript
// 之前：
const savedToken = await page.evaluate(() => localStorage.getItem('peekview_token'))
expect(savedToken).toBeNull()

// 之后：
const cookies = await page.context().cookies()
const authCookie = cookies.find(c => c.name === 'peekview_token')
expect(authCookie).toBeUndefined()  // logout 应清除 cookie
```

**影响范围**：15+ 处 localStorage 引用、8+ 处 Authorization header、1 处登出断言。

### 迁移策略

**不需要渐进迁移**。因为：
1. 后端 login/register 同时返回 JSON `access_token` + Set-Cookie
2. CLI/MCP 只用 header，不受影响
3. 前端改动是原子性的（一次性移除 localStorage）

**版本升级**：用户刷新页面后，前端新代码不再读 localStorage，
浏览器会在下次 login 时获得 Cookie。旧 localStorage 中的 token 自然过期无效。

---

## #5 前端页面 CSP

### 问题

前端页面没有 Content-Security-Policy 头。MarkdownIt `html: true` 无消毒，
`v-html` 渲染任意 HTML + 内联事件，XSS 面大。

### 现状分析

| 来源 | 需求 |
|------|------|
| Shiki 代码高亮 | `style-src 'unsafe-inline'`（每个 token 有 inline style） |
| Mermaid 图表 | `style-src 'unsafe-inline'` + `onclick` 事件处理器 |
| Copy 按钮 | `script-src 'unsafe-inline'`（onclick="copyCodeBlock(this)"） |
| HtmlViewer iframe | `frame-src blob:` + **iframe `csp` 属性**（见 D9） |
| ImageViewer | `img-src data:` |
| 主题 FOUC 脚本 | `script-src 'unsafe-inline'`（index.html inline script） |
| MarkdownIt html:true | **最危险**：无消毒，可注入 `<script>` 和事件处理器 |

### 设计决策

#### D6：CSP 用 `script-src 'self'` 而非 `'unsafe-inline'`

`'unsafe-inline'` 使 CSP for script-src 形同虚设。
方案：把 index.html inline script 移到外部 JS + 事件委托替代 onclick → `script-src 'self'` 即可。

`'self'` 的安全性：API 端点有 `X-Content-Type-Options: nosniff`，浏览器不会把 JSON 当 JS 执行。
攻击者无法通过 XSS 注入 `<script src="/api/...">` 执行恶意代码。

#### D7：style-src 暂时用 'unsafe-inline'

Shiki 的 inline style 是动态生成的，无法加 nonce。
`'unsafe-inline'` for style-src 比 for script-src 风险低得多
（CSS 不能执行 JS，不能发网络请求到外部）。

**未来路径**：Shiki 迁移到 CSS class 模式后可去掉 `'unsafe-inline'`。

#### D8：MarkdownIt 加消毒层

在 `useMarkdown.ts` 中加入 DOMPurify 消毒：
```typescript
import DOMPurify from 'dompurify'

const raw = md.render(content)
const clean = DOMPurify.sanitize(raw, {
  ALLOWED_TAGS: [...],  // 白名单
  ALLOWED_ATTR: ['class', 'style', 'id', 'data-*'],
})
```

**CSP + DOMPurify 双层防护**：即使 CSP 被绕过，DOMPurify 也过滤了危险标签。

#### D9：HtmlViewer blob iframe 必须豁免父页面 CSP

**关键发现**：按 CSP Level 3 规范，blob: URL iframe **会继承**父页面的 CSP。
（项目现有文档 `spec-html-render.md` 行 82 的"不继承"说法是错误的，需更正。）

如果 `script-src 'self'` 被继承到 blob iframe，所有 Agent 生成的 HTML 内容会崩溃：
- inline `<script>` 被 CSP 阻断（inline 永远不匹配 `'self'`）
- CDN 外部脚本（ECharts、Tailwind、Alpine.js）被阻断
- `sandbox="allow-scripts"` 不阻止 CSP 继承（只隔离 DOM/origin）

**解决方案**：给 iframe 加 `csp` 属性，显式交付宽松 CSP 给 iframe 内容：

```html
<iframe
  :src="blobUrl"
  sandbox="allow-scripts"
  csp="default-src * 'unsafe-inline' 'unsafe-eval' data: blob: https: http:"
  referrerpolicy="no-referrer"
/>
```

`csp` 属性会向 iframe 内容交付一个 header-level CSP，阻止继承父页面的限制性 CSP。
两种 CSP 取交集（最严格的生效），但因为 iframe 自己的 CSP 允许 inline 和外部脚本，
实际效果是 iframe 内的脚本可以正常执行。

**浏览器支持**：Chrome 73+, Firefox 78+, Safari 16.4+。

**安全性**：`sandbox="allow-scripts"` 无 `allow-same-origin` 仍提供 DOM 隔离
（iframe 是 opaque origin，无法访问父页面 Cookie/DOM/localStorage）。
iframe `csp` 属性放宽的是 iframe 内部的脚本执行，不影响父页面安全。

### 改动清单

#### 1. `backend/peekview/main.py` — 安全头中间件

增加前端页面的 CSP：

```python
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/api") or request.url.path == "/health":
        # API 端点：最严格 CSP
        response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
        response.headers["X-Content-Type-Options"] = "nosniff"
        # ... 其他头不变
    else:
        # 所有前端路径（含 /assets/、SPA 路由、静态文件）：专用 CSP
        csp = (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: blob:; "
            "font-src 'self'; "
            "frame-src blob:; "
            "connect-src 'self'; "
            "base-uri 'self'; "
            "frame-ancestors 'none'"
        )
        response.headers["Content-Security-Policy"] = csp
    return response
```

#### 2. `backend/peekview/main.py` — 安全头中间件（简化版，不用 nonce）

index.html 的 inline script 移到外部 JS 后，`script-src 'self'` 即可，无需 nonce。

#### 3. `frontend-v3/src/theme-init.ts` — 主题 FOUC 预防脚本外移

把 `index.html` 中的 inline `<script>` 移到独立 TypeScript 文件：

```typescript
// src/theme-init.ts
;(function() {
  const saved = localStorage.getItem('peekview-theme')
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const theme = saved || (prefersDark ? 'dark' : 'light')
  document.documentElement.setAttribute('data-theme', theme)
})()
```

在 `index.html` 中替换为：
```html
<script type="module" src="/src/theme-init.ts"></script>
```

这样 CSP `script-src 'self'` 即可覆盖，无需 `'unsafe-inline'` 或 nonce。

#### 4. `frontend-v3/src/composables/useMarkdown.ts` — 事件委托

移除所有 8 个 `onclick` / `onmousedown` 内联事件，改为 `data-action` 属性 + 事件委托。

**完整映射表：**

| # | 行号 | 当前 | 改为 |
|---|------|------|------|
| 1 | 231 | `onclick="toggleMermaidView('${id}')"` | `data-action="toggle-mermaid-view" data-block-id="${id}"` |
| 2 | 235 | `onclick="openMermaidFullscreen('${id}')"` | `data-action="open-mermaid-fullscreen" data-block-id="${id}"` |
| 3 | 237 | `onclick="toggleMermaidMenu('${id}')"` | `data-action="toggle-mermaid-menu" data-block-id="${id}"` |
| 4 | 239 | `onclick="downloadMermaidPng('${id}')"` | `data-action="download-mermaid-png" data-block-id="${id}"` |
| 5 | 240 | `onclick="copyMermaidCode('${id}')"` | `data-action="copy-mermaid-code" data-block-id="${id}"` |
| 6 | 247 | `onmousedown="startResize('${id}', event)"` | `data-action="start-resize" data-block-id="${id}"` |
| 7 | 262 | `onclick="copyCodeBlock(this)"` | `data-action="copy-code-block"` |
| 8 | 276 | `onclick="copyCodeBlock(this)"` | `data-action="copy-code-block"` |

在 `MarkdownViewer.vue` 上层监听 click + mousedown 事件：
```typescript
function setupDelegatedListeners() {
  contentRef.value?.addEventListener('click', handleDelegatedAction)
  contentRef.value?.addEventListener('mousedown', handleDelegatedResize)
}

function handleDelegatedAction(e: MouseEvent) {
  const target = (e.target as Element).closest('[data-action]') as HTMLElement | null
  if (!target) return
  const action = target.dataset.action
  const blockId = target.dataset.blockId
  switch (action) {
    case 'toggle-mermaid-view':    toggleMermaidView(blockId!); break
    case 'open-mermaid-fullscreen': openMermaidFullscreen(blockId!); break
    case 'toggle-mermaid-menu':    toggleMermaidMenu(blockId!); break
    case 'download-mermaid-png':   downloadMermaidPng(blockId!); break
    case 'copy-mermaid-code':      copyMermaidCode(blockId!); break
    case 'copy-code-block':        copyCodeBlock(target); break
  }
}

function handleDelegatedResize(e: MouseEvent) {
  const target = (e.target as Element).closest('[data-action="start-resize"]') as HTMLElement | null
  if (!target) return
  const blockId = target.dataset.blockId!
  startResize(blockId, e)
}
```

**移除 `MarkdownViewer.vue` 的 7 个 `window.*` 全局函数**：
`window.copyCodeBlock`、`window.copyMermaidCode`、`window.downloadMermaidPng`、
`window.toggleMermaidView`、`window.openMermaidFullscreen`、`window.toggleMermaidMenu`、
`window.startResize` — 全部改为组件内方法（闭包可访问 `mermaidInstances` 等 module-scoped 变量）。

#### 5. `frontend-v3/src/composables/useMarkdown.ts` — DOMPurify 消毒

```typescript
import DOMPurify from 'dompurify'

const raw = md.render(content)
const clean = DOMPurify.sanitize(raw, {
  ADD_TAGS: ['foreignobject'],
  ADD_ATTR: ['dominant-baseline'],
  HTML_INTEGRATION_POINTS: { foreignobject: true },
  // 不需要 ADD_ATTR onclick/onmousedown — 事件委托已替代
})
```

需要在 `package.json` 中加 `dompurify` 依赖。

**为什么需要这 3 个配置项：**

| 配置 | 原因 |
|------|------|
| `ADD_TAGS: ["foreignobject"]` | Mermaid 在 flowchart/sequence/timeline/mindmap 等 54 处使用 `<foreignObject>` 承载 HTML 标签（div/span/br/i），DOMPurify 默认在 SVG 禁用列表中 |
| `ADD_ATTR: ["dominant-baseline"]` | Mermaid 用此属性控制文本垂直对齐（mindmap/sequence/timeline 等），DOMPurify 默认 SVG 属性列表不包含 |
| `HTML_INTEGRATION_POINTS: { foreignobject: true }` | 不加此项 DOMPurify 会剥除 `<foreignObject>` 内的 HTML 内容（div/span/br/i），文字标签全部消失 |

**注意**：Mermaid 在 `securityLevel: 'strict'` 模式下内部已用同样的配置做了 DOMPurify 消毒，
SVG 输出是安全的。此处的 DOMPurify 是针对 `useMarkdown.ts` 的 `render()` 输出，
其中包含用户 markdown 内容（`html: true` 允许原始 HTML），才是主要消毒目标。

**MermaidDiagram.vue 的 SVG 不需二次消毒**（mermaid 内部已做），但加了也无害。

**验证**：实施后需测试以下 Mermaid 图表类型确保 DOMPurify 白名单不破坏渲染：
flowchart（foreignObject）、sequence（dominant-baseline）、timeline、mindmap、
C4、quadrant、xychart。Mermaid 版本升级后白名单可能需跟进。

#### 6. 前端 `v-html` 使用范围不变

`v-html` 本身不是问题（Vue 官方认可用法），关键是内容经过 DOMPurify 消毒 + CSP 兜底。

### 不改动的文件

- `packages/mcp-server/` — 不使用浏览器 Cookie，不受影响
- `backend/peekview/client.py` — CLI 用 header，不受影响
- 后端 `create_access_token()` — JWT 生成逻辑不变，只是多了一个传输通道

---

## 实施顺序

### Phase 1: JWT → httpOnly Cookie (#4)

| 步骤 | 文件 | 改动 |
|------|------|------|
| 1.1 | `backend/peekview/api/auth.py` | login/register Set-Cookie（Max-Age 从 config） |
| 1.2 | `backend/peekview/api/auth.py` | logout 清 Cookie |
| 1.3 | `backend/peekview/auth.py` | `get_current_user` 加 Cookie 读取（header JWT > cookie JWT > API key） |
| 1.4 | `frontend-v3/src/api/client.ts` | 移除 localStorage、请求拦截器 token 注入；加 withCredentials；401 调 logout |
| 1.5 | `frontend-v3/src/stores/auth.ts` | 移除 token ref + TOKEN_KEY；改用 user ref |
| 1.6 | `frontend-v3/src/components/LoginDialog.vue` | login 后不再存 token |
| 1.7 | `backend/tests/test_auth.py` | 新增 Cookie 认证测试（10 条用例） |
| 1.8 | `frontend-v3/e2e/debug-server.spec.ts` | setupAuth 改用 addCookies；登出断言改检查 Cookie |
| **CK1** | **Phase 1 checkpoint** | **backend tests + frontend build + 手动登录/登出验证 Cookie，确认 Phase 1 无误后再进 Phase 2** |

### Phase 2: 前端 CSP (#5)

| 步骤 | 文件 | 改动 |
|------|------|------|
| 2.1 | `frontend-v3/src/theme-init.ts` | 新建，从 index.html 外移主题脚本 |
| 2.2 | `frontend-v3/index.html` | 删除 inline script，改为 `<script src="/src/theme-init.ts">` |
| 2.3 | `frontend-v3/src/composables/useMarkdown.ts` | 8 个 onclick/onmousedown → data-action + data-block-id |
| 2.4 | `frontend-v3/src/components/MarkdownViewer.vue` | 移除 7 个 window.* 全局函数；加事件委托 handleDelegatedAction + handleDelegatedResize |
| 2.5 | `frontend-v3/src/composables/useMarkdown.ts` | 加 DOMPurify 消毒（ADD_TAGS/ADD_ATTR/HTML_INTEGRATION_POINTS） |
| 2.6 | `npm install dompurify && npm install -D @types/dompurify` | 加依赖 |
| 2.7 | `backend/peekview/main.py` | 安全头中间件加前端 CSP（非 API 路径） |
| 2.8 | `frontend-v3/src/components/HtmlViewer.vue` | iframe 加 `csp` 属性豁免父页面 CSP 继承 |

### Phase 3: 验证

| 步骤 | 命令 |
|------|------|
| 3.1 | `cd backend && python3 -m pytest tests/ -v` |
| 3.2 | `cd frontend-v3 && npm run build` |
| 3.3 | `make debug` → Playwright E2E 全量 |
| 3.4 | 浏览器验证：登录 → 查看 entry → 登出 → 确认 Cookie 清除 |
| 3.5 | 浏览器验证：Mermaid 图表交互（toggle/fullscreen/resize/copy）无异常 |
| 3.6 | 浏览器验证：HtmlViewer 加载含 `<script>` 的 HTML 页面（ECharts/Tailwind CDN）不阻断 |
| 3.7 | 浏览器验证：MarkdownIt `html: true` 内容被 DOMPurify 消毒（`<script>` 标签被剥除） |

## 风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| Cookie 不跨域 | 非 same-origin 部署下 Cookie 不发送 | PeekView 生产部署是 same-origin；开发环境 Vite proxy 也是 same-origin |
| SameSite=Lax + 非 GET 请求 | 跨站 POST 不带 Cookie | API 用 JSON POST，触发 CORS preflight，不受影响 |
| `style-src 'unsafe-inline'` | CSS 注入仍可能 | CSS 不能执行 JS，风险低；DOMPurify 过滤 style 属性 |
| DOMPurify 白名单过严 | 某些 Markdown 功能被过滤 | 逐案例调整白名单 |
| 事件委托改造工作量大 | useMarkdown.ts 8 个 inline handler | 逐个改为 data-action + 委托 |
| 主题脚本移到外部 JS | 首次加载可能有 FOUC | 极小概率，外部 JS 同源加载很快 |

## Follow-up（本次不做）

- `jti` + token 黑名单（即时吊销）
- `iss` claim（多实例区分）
- Shiki CSS class 模式（去掉 `style-src 'unsafe-inline'`）
- 前端单文件下载按钮 bug（二进制文件空 Blob）

---

## 专家评审（2026-06-10）

### BUG-1：Cookie-based JWT 与全局 API Key 中间件的交互

**问题**：全局 API Key 中间件（`main.py:134-181`）通过 `Authorization: Bearer <key>` 验证。
如果请求携带 `peekview_token` Cookie 但没有 `Authorization` header，
中间件会跳过 JWT 验证，直接进入路由处理。这是正确行为——Cookie 只在路由层的
`get_current_user` 中被读取。

但需确认：全局 API Key 中间件不会拦截携带 Cookie 但无 `Authorization` header 的请求。

**验证**：中间件逻辑是"如果有 `Authorization` 或 `X-API-Key` 且非 JWT/pv_ 前缀 → 检查全局 key"。
如果都没有 → 直接放行。Cookie 不经过中间件。**OK，无问题**。

### BUG-2：axios withCredentials 在 same-origin 下不需要

**问题**：方案建议 `this.client.defaults.withCredentials = true`。

**分析**：PeekView 生产部署是 same-origin（前端从后端 static 目录提供）。
same-origin 请求浏览器默认携带 Cookie，`withCredentials` 只在跨域时需要。

开发环境用 Vite proxy（`/api` → `localhost:8080`），proxy 转发后是 same-origin。

**结论**：设置 `withCredentials = true` 无害（same-origin 下是 no-op），
但建议加上注释说明为什么。

### ISSUE-1：前端 401 响应拦截器清 Cookie 问题

**问题**：当前 401 拦截器清 `localStorage`。改为 Cookie 后，前端 JS 无法删除 httpOnly Cookie。

**修复**：401 时调用 `api.logout()`（POST /auth/logout），后端清 Cookie。
或者前端 401 拦截器直接跳转到 `/` 强制刷新（Cookie 过期后自然消失）。

**方案**：401 拦截器中 `authStore.logout()` → 调用 `api.logout()` → 后端清 Cookie。
如果 `api.logout()` 失败（网络问题），前端清除 `user.value` 即可，
Cookie 会在 `Max-Age` 过期后自动消失（最多 7 天）。

### ISSUE-2：`isLoggedIn` 计算属性依赖 `user.value` 初始值

**问题**：方案建议 `isLoggedIn = computed(() => !!user.value)`。
但 `user.value` 在 `fetchMe()` 完成前是 `null`，即使用户有有效 Cookie。
`initializing.value` 已处理此场景——UI 在初始化期间显示 loading 状态。

**验证**：当前代码已有 `initializing` 逻辑（auth.ts），只需要确保 `fetchMe()` 不再依赖
localStorage 而是依赖 Cookie 自动携带。**OK**。

### ISSUE-3：CSP nonce 注入到静态 index.html 的方案选择

**问题**：方案提出了 3 种方案，推荐"把 inline script 移到外部 JS"。
但如果用 `script-src 'self'`，攻击者可以注入 `<script src="/api/v1/entries/evil">`
利用 API 端点返回的内容作为 JS 执行（虽然 API 返回 JSON，但 MIME sniffing 理论上可能绕过）。

**修复**：后端 API 端点已有 `X-Content-Type-Options: nosniff`，浏览器不会把 JSON 当 JS 执行。
加上 `script-src 'self'` 限制了只能加载同源 JS 文件，实际风险极低。

**结论**：`script-src 'self'` + `nosniff` 足够安全。nonce 方案更安全但实现复杂
（需要后端动态渲染 index.html 或 SSR），不适合当前 SPA 架构。

### ISSUE-4：Mermaid onclick 改造遗漏

**问题**：useMarkdown.ts 有 8 个 inline 事件处理器（7 个 onclick + 1 个 onmousedown）。
MarkdownViewer.vue 也直接注册了 7 个 `window.*` 全局函数。

**修复**：事件委托方案需同时：
1. `useMarkdown.ts`：所有 `onclick="xxx()"` 改为 `data-action="xxx"` + `data-id="..."`
2. `MarkdownViewer.vue`：移除 `window.xxx` 注册，改为 `@click="handleMarkdownClick"`
3. 全局 `window` 函数变为组件内方法

**工作量**：中等，约 30 分钟。

### ISSUE-5：DOMPurify 白名单需要包含 Mermaid SVG 元素

**问题**：Mermaid 生成的 SVG 包含 `<svg>`, `<path>`, `<circle>`, `<rect>`, `<text>`, `<g>`, `<defs>`, `<marker>`, `<polygon>`, `<line>` 等标签和 `d`, `transform`, `viewBox`, `fill`, `stroke` 等属性。

**修复**：DOMPurify 默认允许 SVG 标签（`ADD_TAGS: ['svg']`），但需要确认：
```typescript
DOMPurify.sanitize(raw, {
  ALLOWED_TAGS: DOMPurify.getDefaultTags().concat(['svg', ...mermaidTags]),
  ALLOWED_ATTR: ['class', 'style', 'id', 'data-action', 'data-id', ...mermaidAttrs],
})
```
或使用 `ALLOW_TAGS` 配合 `ADD_TAGS` / `ADD_ATTR`。

**简化方案**：使用 DOMPurify 默认白名单 + `ADD_TAGS` / `ADD_ATTR` 增量添加，
而非完全自定义白名单。默认白名单已覆盖大部分安全标签。

### ISSUE-6：后端测试需要覆盖 Cookie 认证

**问题**：现有后端测试全部用 `Authorization: Bearer` header 测试认证。
改为 Cookie 后，需要新增测试：

1. login 响应包含 `Set-Cookie: peekview_token=...` + HttpOnly + SameSite=Lax
2. 后续请求携带 Cookie 可认证（GET /auth/me 返回用户信息）
3. logout 响应清除 Cookie（`Set-Cookie: peekview_token=; Max-Age=0`）
4. Cookie + Header 同时存在时 Header JWT 优先
5. SameSite 属性值正确（Lax）
6. HTTP 下不设 Secure、HTTPS 下设 Secure
7. Cookie Max-Age 与 config.auth.token_expire_days 一致
8. 过期 Cookie → get_current_user 返回 None（匿名）
9. 无效 Cookie → get_current_user 返回 None（匿名）
10. 多用户 Cookie 串扰：用户 A 的 Cookie 不能认证用户 B

### ISSUE-7：前端 E2E 测试需要更新

**问题**：Playwright E2E 测试可能依赖 localStorage 中的 token。
改为 Cookie 后，login 后 token 在 Cookie 中，测试断言需更新。

### 评审结论

| 编号 | 级别 | 问题 | 决策 |
|------|------|------|------|
| BUG-1 | ⚪ OK | Cookie 与全局 API Key 中间件无冲突 | 无需处理 |
| BUG-2 | 🟢 低 | withCredentials 在 same-origin 下 no-op | 保留，加注释 |
| ISSUE-1 | 🟠 中 | 401 无法清 httpOnly Cookie | 修复：调用 logout API |
| ISSUE-2 | ⚪ OK | isLoggedIn 初始值 | 已有 initializing 处理 |
| ISSUE-3 | 🟢 低 | CSP nonce vs 'self' | 用 'self'，够安全 |
| ISSUE-4 | 🟠 中 | Mermaid onclick 改造 | 必须修复 |
| ISSUE-5 | 🟡 中 | DOMPurify 白名单含 Mermaid SVG | 用 ADD_TAGS 增量添加 |
| ISSUE-6 | 🟠 中 | 后端测试覆盖 Cookie 认证 | 必须新增 |
| ISSUE-7 | 🟡 中 | E2E 测试更新 | 需检查并更新 |

**必须修复项**：ISSUE-1、ISSUE-4、ISSUE-6
**需要检查**：ISSUE-7

---

## 第二轮专家评审（2026-06-10）

### R2-BUG-1：Cookie JWT + 全局 API Key 同时存在的混淆 deputy 风险

**问题**：浏览器携带 `peekview_token` Cookie（有效 JWT），同时请求头有 `Authorization: Bearer <global_api_key>`。全局 API Key 中间件验证通过放行，`get_current_user` 读到 Cookie JWT 返回绑定用户。`_is_global_api_key_auth()` 返回 False（因为 `current_user is not None`），所有权检查使用 Cookie 用户的身份。

这不是安全漏洞（更具体的身份覆盖了不具体的），但创建了歧义：
中间件通过全局 key 授权（无用户绑定），路由层看到绑定用户。

**修复**：方案必须明确定义优先级。建议：**Authorization header 中的 JWT 优先于 Cookie**。
如果 header 中有非 JWT 的 Bearer token（如全局 API Key），Cookie JWT 仍可用于用户身份。
文档记录此行为。

### R2-BUG-2：Cookie Max-Age 硬编码 604800（7 天）

**问题**：方案写死 `Max-Age=604800`，但 `PEEKVIEW_AUTH__TOKEN_EXPIRE_DAYS` 可配置。
如果用户配置 30 天，Cookie 7 天过期但 JWT 还有效，浏览器不发送 Cookie，用户被当匿名。

**修复**：Cookie Max-Age 必须从 `config.auth.token_expire_days * 86400` 计算。

### R2-BUG-3：前端 login/register 后 `data.access_token` 不再可靠

**问题**：方案说 JSON body 仍返回 `access_token`（向后兼容 CLI/MCP），所以前端 `data.access_token` 仍然可用。但方案又建议前端不再写 localStorage。

**分析**：如果后端仍返回 `access_token`，前端可以读但不需要存。关键是前端不再需要它——
浏览器自动携带 Cookie，前端只需设置 `user.value`。

**决策**：后端继续在 JSON body 返回 `access_token`（CLI/MCP 需要），前端忽略它。
前端 login 后直接 `user.value = result.user`，不操作 token。

### R2-ISSUE-1：Vite dev proxy 中 Secure flag 会阻止 Cookie

**问题**：如果 `Secure=True`，开发环境（HTTP）浏览器会拒绝 Set-Cookie。

**修复**：`secure=request.url.scheme == "https"` — 开发环境 HTTP 时不设 Secure。
生产环境 HTTPS 时设 Secure。当前方案已正确处理。**OK**。

但需注意：不设 `Domain` 属性，让浏览器默认使用当前 origin。跨端口（5173→8080 proxy）
时 Cookie domain 是 `localhost`（不含端口），Vite proxy 转发后 Cookie 可正常设置。**OK**。

### R2-ISSUE-2：过期 Cookie 在匿名端点的静默降级

**问题**：用户有过期 `peekview_token` Cookie → `get_current_user` 解码失败 → 返回 None → 用户被当匿名。
如果 `allow_anonymous_create=True`，entry 创建成功但被强制 `is_public=True`。
用户困惑："我明明登录了，为什么是公开的？"

**修复**：`get_current_user` 检测到 Cookie 中有过期 JWT 时，在响应中清除 Cookie：
```python
if cookie_token and not jwt_token:
    # Cookie 有值但 JWT 无效/过期 → 清除
    response.delete_cookie("peekview_token", path="/")
```

但 `get_current_user` 是 Depends 依赖，无法直接操作 response。
替代方案：在安全头中间件中检查，如果请求携带 `peekview_token` Cookie 但
`get_current_user` 返回 None，附加 `Set-Cookie` 清除。

**更简单的方案**：前端 `fetchMe()` 失败时（401 或无用户），调用 `api.logout()` 清 Cookie。
这已在 ISSUE-1 中覆盖。**OK**。

### R2-ISSUE-3：E2E 测试 `debug-server.spec.ts` 需全面重写

**问题**：875 行 E2E 测试有 15+ 处 `localStorage.setItem('peekview_token', ...)`，
8+ 处手动 `Authorization: Bearer` header，`setupAuth()` 辅助函数依赖 localStorage。

**影响**：这是最大的改动面。迁移后：
- `setupAuth()` 改用 `page.context().addCookies()`
- 登出测试（行 625）从检查 `localStorage.getItem()` 改为检查 Cookie
- 直接 API 调用（非浏览器）仍可用 `Authorization` header

**修复**：
```typescript
// 之前：
async function setupAuth(page: any, token: string) {
  await page.evaluate((t: string) => { localStorage.setItem('peekview_token', t); return true }, token)
}

// 之后：
async function setupAuth(page: any, token: string) {
  await page.context().addCookies([{
    name: 'peekview_token',
    value: token,
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  }])
}
```

直接 API 调用（非浏览器上下文）的 `Authorization: Bearer` header 保持不变。

### R2-ISSUE-4：前端 auth.ts 的 `token` ref 需要重新设计

**问题**：当前 `token.value` 存储 JWT 字符串，用于 `isLoggedIn` 计算和请求拦截器。
迁移后，前端 JS 无法读取 httpOnly Cookie 中的 JWT。`token.value` 变成空。

**修复**：不再跟踪 `token` ref，改为跟踪 `user` ref：
```typescript
// 之前：
const token = ref<string | null>(localStorage.getItem(TOKEN_KEY))
const isLoggedIn = computed(() => !!token.value)

// 之后：
const token = ref<boolean>(false)  // 简化为 boolean：是否有认证态
const isLoggedIn = computed(() => !!user.value)

// fetchMe 成功 → token.value = true
// logout → token.value = false
```

或者更简单：完全移除 `token` ref，所有地方改用 `!!user.value`。
需要检查所有 `token` 引用点。

### R2-ISSUE-5：CSP `script-src 'self'` 需要排除 /assets 路径的 CSP

**问题**：方案中 CSP 条件是 `elif not request.url.path.startswith("/assets")`，
但前端 JS 文件都在 `/assets/` 下。如果 `/assets/` 路径不加 CSP，
XSS 注入的 `<script src="/assets/evil.js">` 不受限制。

**修复**：所有前端页面（包括 `/assets/`）都应加 CSP。
条件改为：API 端点用严格 CSP，其他所有路径用前端 CSP。

```python
if request.url.path.startswith("/api") or request.url.path == "/health":
    # API 严格 CSP
else:
    # 前端页面 CSP（含 /assets/）
```

### R2-ISSUE-6：CSP 对 /api 路径和前端路径的边界处理

**问题**：SPA 路由如 `/e/my-slug` 既可以是前端页面，也可能被后端 catch-all 路由匹配。
需确保前端 CSP 应用到所有非 `/api` 非 `/health` 的路径。

**修复**：改为正向条件（前端路径列表）不如反向条件（非 API 即前端）可靠。
`else` 分支覆盖所有非 API 路径，包括静态文件。**OK**。

---

### 第二轮评审结论

| 编号 | 级别 | 问题 | 决策 |
|------|------|------|------|
| R2-BUG-1 | 🟠 中 | Cookie + API Key 混淆 deputy | 文档化优先级：header JWT > cookie JWT |
| R2-BUG-2 | 🔴 高 | Max-Age 硬编码 | 修复：从 config 计算 |
| R2-BUG-3 | 🟢 低 | data.access_token 仍可用 | 前端忽略，后端继续返回 |
| R2-ISSUE-1 | ⚪ OK | Vite proxy + Secure flag | 方案已正确处理 |
| R2-ISSUE-2 | 🟢 低 | 过期 Cookie 静默降级 | 前端 fetchMe 失败时 logout 清 Cookie |
| R2-ISSUE-3 | 🔴 高 | E2E 测试全面重写 | setupAuth 改用 addCookies |
| R2-ISSUE-4 | 🟠 中 | token ref 重新设计 | 移除 token ref，改用 user ref |
| R2-ISSUE-5 | 🟠 中 | /assets 路径缺 CSP | 所有非 API 路径加 CSP |
| R2-ISSUE-6 | ⚪ OK | API/前端路径边界 | else 分支已覆盖 |

**新增必须修复项**：R2-BUG-2（Max-Age 硬编码）、R2-ISSUE-3（E2E 重写）、R2-ISSUE-4（token ref）、R2-ISSUE-5（/assets CSP）
**文档化**：R2-BUG-1（优先级）

---

## 方案修订记录

| 修订 | 内容 |
|------|------|
| R1 | 修复 ISSUE-1（401 清 Cookie）、ISSUE-4（Mermaid onclick）、ISSUE-6（后端测试） |
| R2 | 修复 R2-BUG-2（Max-Age 从 config 计算）、R2-ISSUE-4（移除 token ref）、R2-ISSUE-5（/assets 加 CSP）；文档化 R2-BUG-1（优先级）；E2E 全面重写计划 |
| R3 | 补齐事件委托完整映射表（8 个 onclick → data-action）；补齐 DOMPurify 具体白名单（3 个配置项）；移除 nonce 中间件矛盾代码；细化实施顺序为 3 Phase 20 步；后端测试扩充到 10 条 |
| R4 | 修正 blob: iframe CSP 继承错误认知（CSP3 规范：blob iframe 会继承父页面 CSP）；新增 D9（iframe csp 属性）；新增步骤 2.8（HtmlViewer iframe csp 属性）；新增验证步骤 3.6-3.7；DOMPurify 加验证说明 |

---

*维护：实施完成后更新 improvement-backlog.md 状态*
