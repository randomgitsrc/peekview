# PeekView 验证码（Cap）集成方案

**状态**: 已评审，待实施
**作者**: kity
**日期**: 2026-06-09
**目标版本**: Backend v0.1.43

---

## 1. 库选型：Cap (`https://github.com/tiagozip/cap`)

### 为什么选 Cap

| 选项 | 类型 | 优势 | 劣势 |
|---|---|---|---|
| **Cap** | 开源自托管 | Apache 2.0，无追踪，GDPR 友好，20kb，无视觉谜题 | 需要额外部署服务 |
| reCAPTCHA v3 | Google 托管 | 主流 | 第三方追踪、不可自托管 |
| hCaptcha | 商业 | 商业生态 | 付费、视觉谜题 |
| Turnstile | Cloudflare | 简单 | 第三方依赖 |

**结论：Cap 符合 PeekView 自托管、零追踪定位。**

### Cap 架构

- **Widget**（前端 web component）：`<cap-widget>` 内嵌到登录/注册表单，生成 `cap-token`
- **Standalone server**（Docker 容器）：暴露 `/siteverify` API 验证 token
- **Widget → Standalone 流程**：
  1. 浏览器加载 widget
  2. 用户勾选 → widget 跑 PoW + instrumentation
  3. 解决后发 `cap-token` 给后端表单
  4. 后端把 token 转给 Standalone `/siteverify` 验证

### 第三方库依赖

| 库 | 用途 | 安装方式 |
|---|---|---|
| Docker（已装） | 运行 Cap standalone | 系统已有 |
| Frontend：`@cap.js/widget` (npm) 或 CDN `<script>` | 浏览器 widget | npm 或 CDN |
| Backend：无（用 `httpx`/requests 调用 Cap standalone） | 调 `/siteverify` | 已有的 httpx |

---

## 2. 集成架构

```
┌─────────────────┐                  ┌──────────────────┐
│  Browser        │                  │  Cap Standalone  │
│  (frontend-v3)  │   solve PoW     │  (Docker :3000)  │
│                 │ ──────────────►  │                  │
│  <cap-widget>   │                  │  Redis store     │
│  (PoW + instr)  │ ◄─────────────   │  (Valkey)        │
│                 │  cap-token       │                  │
└────────┬────────┘                  └────────┬─────────┘
         │  submit form                       │
         │  + cap-token                       │
         ▼                                    ▼
┌────────────────────────────────────────────────────┐
│  PeekView Backend (FastAPI)                       │
│  /api/v1/auth/login                                │
│  /api/v1/auth/register                             │
│    → 验 username/password                         │
│    → 调 Cap /siteverify 验 cap-token              │
│    → 通过则继续；失败则 CAPTCHA_INVALID 401         │
└────────────────────────────────────────────────────┘
```

---

## 3. 部署 Cap Standalone

新增 `docker-compose.yml`（用户自部署，本仓库不提交密钥）：

```yaml
services:
  cap:
    image: tiago2/cap:latest
    container_name: peekview-cap
    ports:
      - "3000:3000"
    environment:
      ADMIN_KEY: ${CAP_ADMIN_KEY}    # 从 .env 读取，至少 32 字符
      REDIS_URL: redis://peekview-cap-redis:6379
    depends_on:
      peekview-cap-redis:
        condition: service_healthy
    restart: unless-stopped

  peekview-cap-redis:
    image: valkey/valkey:9-alpine
    container_name: peekview-cap-redis
    volumes:
      - cap-data:/data
    command: valkey-server --save 60 1 --loglevel warning --maxmemory-policy noeviction
    healthcheck:
      test: ["CMD", "valkey-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
    restart: unless-stopped

volumes:
  cap-data:
```

启动后访问 `http://localhost:3000`，用 `CAP_ADMIN_KEY` 登录 dashboard，建一对 site key + secret key。

---

## 4. 配置

新增 `peekview.auth.captcha` 配置段（`backend/peekview/config.py`）：

```python
class CaptchaConfig(BaseModel):
    enabled: bool = True
    site_key: str = ""                # 公钥，公开
    secret_key: str = ""              # 私钥，server-side
    verify_url: str = "http://localhost:3000"  # Cap standalone URL
    verify_timeout_seconds: float = 5.0
    exempt_first_user: bool = True    # 第一个用户（admin）可跳过 captcha，方便初始化
    exempt_localhost: bool = True     # localhost 来源可跳过
```

env 变量：
- `PEEKVIEW_AUTH__CAPTCHA__ENABLED`
- `PEEKVIEW_AUTH__CAPTCHA__SITE_KEY`
- `PEEKVIEW_AUTH__CAPTCHA__SECRET_KEY`
- `PEEKVIEW_AUTH__CAPTCHA__VERIFY_URL`

---

## 5. 后端改动

### 5.1 Pydantic schema（`models.py`）

```python
class CaptchaTokenMixin(BaseModel):
    captcha_token: str | None = None  # Optional 仅对 exempt 场景

class UserRegister(CaptchaTokenMixin):
    username: str
    password: str
    display_name: str | None = None

class UserLogin(CaptchaTokenMixin):
    username: str
    password: str
```

### 5.2 验证码校验逻辑（`api/captcha.py`，新文件）

```python
"""Captcha verification wrapper around Cap standalone."""
import httpx
from peekview.exceptions import PeekError

class CaptchaInvalidError(PeekError):
    status_code = 401
    error_code = "CAPTCHA_INVALID"

class CaptchaRequiredError(PeekError):
    status_code = 401
    error_code = "CAPTCHA_REQUIRED"

async def verify_captcha(
    token: str | None,
    site_key: str,
    secret_key: str,
    verify_url: str,
    timeout: float = 5.0,
) -> bool:
    """Returns True if captcha valid or not required."""
    if not token:
        raise CaptchaRequiredError("Captcha token is required")
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(
            f"{verify_url}/{site_key}/siteverify",
            json={"secret": secret_key, "response": token},
        )
        resp.raise_for_status()
        return resp.json().get("success", False)
```

### 5.3 接入 auth.py

`register` 和 `login` handler 在做 password 校验前/同时调 `verify_captcha`：

```python
@router.post("/register", status_code=201)
@limiter.limit(login_rate_limit)
async def register(data: UserRegister, request: Request) -> AuthResponse:
    config = request.app.state.config
    # 1. 验证 captcha（如果启用）
    if config.auth.captcha.enabled and not _is_exempt(request, config):
        ok = await verify_captcha(
            data.captcha_token,
            site_key=config.auth.captcha.site_key,
            secret_key=config.auth.captcha.secret_key,
            verify_url=config.auth.captcha.verify_url,
        )
        if not ok:
            raise CaptchaInvalidError("Captcha verification failed")
    # 2. 继续原有的 username/password/register 逻辑
    ...
```

### 5.4 错误响应

- `CAPTCHA_INVALID`（401）：token 验证失败
- `CAPTCHA_REQUIRED`（401）：缺 token

错误格式与现有 `PeekError` 一致。

---

## 6. 前端改动

### 6.1 安装 widget

`frontend-v3/package.json` 加：
```json
"@cap.js/widget": "^1.0.0"
```

或在 `index.html` 加 CDN：
```html
<script src="https://cdn.jsdelivr.net/npm/@cap.js/widget@latest"></script>
```

### 6.2 `LoginDialog.vue` 集成 widget

```vue
<template>
  ...
  <form @submit.prevent="submit">
    <div class="login__field">
      <label>Username</label>
      <input v-model="username" ... />
    </div>
    <div class="login__field">
      <label>Password</label>
      <input v-model="password" type="password" ... />
    </div>
    
    <!-- NEW: Cap widget -->
    <div v-if="captchaEnabled" class="login__captcha">
      <cap-widget
        :data-cap-api-endpoint="`${capApiEndpoint}/${capSiteKey}/`"
        @solve="onCaptchaSolve"
      />
    </div>
    
    <button type="submit" :disabled="loading || (captchaEnabled && !captchaToken)">
      {{ loading ? 'Please wait...' : (mode === 'login' ? 'Login' : 'Register') }}
    </button>
  </form>
</template>

<script setup>
import { ref, onMounted } from 'vue';
// Custom element type definition for TS
const captchaToken = ref<string | null>(null);
const capApiEndpoint = ref('');
const capSiteKey = ref('');

onMounted(async () => {
  // 从后端 /api/v1/config/captcha 公开端点取 site_key + endpoint
  const cfg = await fetch('/api/v1/config/captcha').then(r => r.json());
  capApiEndpoint.value = cfg.endpoint;
  capSiteKey.value = cfg.site_key;
  captchaEnabled.value = cfg.enabled;
});

function onCaptchaSolve(e: CustomEvent) {
  captchaToken.value = e.detail.token;
}

async function submit() {
  await authStore.login(username.value, password.value, captchaToken.value);
}
</script>
```

### 6.3 公开 config 端点

`/api/v1/config/captcha` 返回（**仅公开 site_key 和 endpoint，不含 secret_key**）：

```python
@router.get("/config/captcha")
async def get_captcha_config(config: ServerConfig = Depends(get_config)) -> CaptchaPublicConfig:
    """Public captcha config (no secret leakage)."""
    return CaptchaPublicConfig(
        enabled=config.auth.captcha.enabled,
        site_key=config.auth.captcha.site_key,
        endpoint=config.auth.captcha.verify_url,
    )
```

### 6.4 Auth store / API client 改动

`api/client.ts`：
```typescript
async login(username: string, password: string, captchaToken?: string): Promise<AuthResponse> {
    const response = await this.client.post('/auth/login', {
      username, password, captcha_token: captchaToken,
    });
    ...
}
```

`stores/auth.ts`：
```typescript
async function login(username: string, password: string, captchaToken?: string) {
    const result = await api.login(username, password, captchaToken);
    ...
}
```

---

## 7. TDD 实施计划

### 7.1 后端测试（先写测试）

**`tests/api/test_captcha.py`（新文件）**：
- [ ] `verify_captcha` token 有效 → return True
- [ ] `verify_captcha` token 无效 → return False
- [ ] `verify_captcha` token 为空 → raise CaptchaRequiredError
- [ ] `verify_captcha` Cap 服务不可达 → raise（不暴露内部错误）
- [ ] `register` captcha 失败 → 401 CAPTCHA_INVALID
- [ ] `register` captcha 成功 → 继续正常注册
- [ ] `register` exempt 场景（第一个用户）→ 跳过 captcha
- [ ] `login` captcha 失败 → 401
- [ ] `login` captcha 成功 → 正常登录
- [ ] `/api/v1/config/captcha` 返回 enabled/site_key/endpoint，不含 secret

**Mock 策略**：用 `httpx` mock 或 `respx` 拦截 `verify_captcha` 的 HTTP 调用。

### 7.2 前端测试（Vitest + Vue Test Utils）

**`frontend-v3/src/components/__tests__/LoginDialog.spec.ts`（新）**：
- [ ] captcha 启用时显示 widget
- [ ] captcha 未解决时 submit 按钮禁用
- [ ] captcha 解决后 token 传给 authStore.login
- [ ] 错误显示来自后端（CAPTCHA_INVALID / CAPTCHA_REQUIRED）
- [ ] captcha 关闭时（disabled）不显示 widget，submit 按钮正常工作

**E2E（Playwright）**：
- [ ] 登录页加载 captcha widget
- [ ] 用户勾选 captcha → token 传给后端 → 验证通过 → 登录成功
- [ ] 用户不勾选 captcha → 按钮禁用 / 提交后端返 CAPTCHA_REQUIRED
- [ ] Captcha 服务不可达 → 显示友好错误

---

## 8. 文档改动

| 文件 | 改动 |
|---|---|
| `CHANGELOG.md` | 加 `[0.1.43]` 条目：新增 Cap captcha 支持 |
| `backend/README.md` | 加 captcha 配置章节：env 变量、CAP_ADMIN_KEY 部署 |
| `docs/specs/spec-security-hardening-*.md` | 同步 captcha 集成（如已有相关 spec）|
| `frontend-v3/README.md` 或 主 README | 提及 captcha 前端集成 |
| `docker-compose.yml`（新增） | Cap standalone 部署 |
| 新增 `docs/roadmap/improvement-backlog.md` #13 | 跟踪 captcha 实施 |

---

## 9. 风险与缓解

| 风险 | 等级 | 缓解 |
|---|---|---|
| Cap standalone 不可用导致登录注册全挂 | 中 | 配置 `captcha.enabled=false` 可关闭；首次启动可走 exempt 路径 |
| 性能：每次登录多一次 HTTP 调 Cap | 低 | httpx async + 5s timeout；可后续加本地缓存 |
| secret_key 泄露 | 中 | secret_key 只存 server config / env，不进前端 / 日志 |
| 前端 widget 加载失败 | 低 | onerror 时回退显示手动刷新 |
| 测试 mock Cap standalone 困难 | 中 | 用 respx/httpx mock，验证调用参数而非真实集成 |
| 老用户无 captcha token | 中 | exempt 路径：前 N 个用户可豁免，配置开关 |

---

## 10. 验收标准

- [ ] `verify_captcha` 单元测试通过
- [ ] login/register 集成 captcha 验证
- [ ] exempt 场景（第一个用户、localhost）跳过 captcha
- [ ] 前端 LoginDialog 显示 widget，未解决时按钮禁用
- [ ] /config/captcha 公开端点不泄露 secret
- [ ] E2E：完整登录流程通过
- [ ] Cap standalone 不可达时后端不崩、有合理错误
- [ ] captcha.enabled=false 时完全关闭
- [ ] 文档 / spec / CHANGELOG / backlog 同步
- [ ] 单元测试 159 → 增加 captcha 测试
- [ ] Backend 版本 bump 到 v0.1.43

---

## 11. 不做的事

- ❌ 不用 reCAPTCHA/hCaptcha（避免第三方追踪）
- ❌ 不做 captcha 失败时的"音频验证"备用方案
- ❌ 不在 cap-token 中加自定义字段
- ❌ 不把 secret_key 暴露给前端

---

*方案创建：2026-06-09*
