# PeekView 内置 Cap-compatible 验证码集成方案

**版本**: v1.0-final  
**日期**: 2026-06-10  
**目标版本**: Backend v0.1.44 + Frontend v0.1.44  
**状态**: 评审通过（第一轮 4/10 -> 第二轮 8/10），已回归定稿

---

## 1. 背景与目标

### 1.1 背景

- **v0.1.43 已完成**: 后端 captcha 校验框架（`enforce_captcha`、`verify_captcha_token`）、公开 config 端点、15 个单元测试
- **当前缺口**:
  - 前端 `LoginDialog.vue` **完全没有**集成 `<cap-widget>`
  - `verify_captcha_token` 依赖**外部 Cap standalone 服务**（需 Docker 部署）
  - 用户明确要求: `pipx install peekview` 后开箱即用，**不愿为验证码单独部署任何东西**

### 1.2 目标

| # | 目标 | 验收标准 |
|---|------|----------|
| G1 | `pipx install peekview` 后验证码功能**开箱即用** | 无需 Docker、无需 Node.js、无需额外服务 |
| G2 | 前端 `LoginDialog.vue` 完整集成 `<cap-widget>` | widget 显隐正确、按钮状态联动、错误回显 |
| G3 | 与 v0.1.43 配置**向后兼容** | `captcha_enabled` 等字段语义不变；external 模式可选保留 |
| G4 | E2E Playwright **完整 TDD** | 先写测试->失败->实施->通过 |
| G5 | 已有功能**零回归** | 432 个 backend tests + 全部 E2E 仍通过 |

---

## 2. 需求分析

### 2.1 功能需求

| ID | 需求 | 优先级 |
|----|------|--------|
| FR1 | PeekView 内置 Cap-compatible challenge/redeem/siteverify 端点 | P0 |
| FR2 | 前端 LoginDialog 动态加载并显示 `<cap-widget>` | P0 |
| FR3 | captcha enabled 时，登录/注册必须携带有效 captcha token | P0 |
| FR4 | captcha disabled 时，登录/注册完全不受影响 | P0 |
| FR5 | 第一个用户注册可豁免 captcha（v0.1.43 已有，保持） | P0 |
| FR6 | 公开 config 端点告知前端 captcha 是否启用及如何连接 | P0 |

### 2.2 非功能需求

| ID | 需求 | 指标 |
|----|------|------|
| NFR1 | **零外部依赖** | 纯 Python 标准库 + 已有 SQLite，无需 pip 额外包 |
| NFR2 | **向后兼容** | v0.1.43 的配置文件/env 变量无需修改即可工作 |
| NFR3 | **响应时间** | challenge 生成 + redeem 验证 < 200ms（单核） |
| NFR4 | **安全级别** | 不低于外部 Cap standalone（JWT 签名、PoW 验证、防重放） |
| NFR5 | **离线可用** | 首次 pipx install 后，无需任何网络即可使用 captcha |

---

## 3. 架构设计

### 3.1 系统架构

```
Browser (frontend-v3)
  |
  | 1 GET /api/v1/config/captcha
  |   <- { enabled, site_key, endpoint }
  |
  | 2 POST /api/v1/captcha/challenge
  |   <- { challenge: {c,s,d}, token, expires }
  |
  | 3 [Browser computes sha256 PoW]
  |
  | 4 POST /api/v1/captcha/redeem
  |   -> { token, solutions: [nonce, ...] }
  |   <- { success: true, token: capToken, expires }
  |
  | 5 Submit login/register form + capToken
  |
  v
PeekView Backend (FastAPI)
  |
  | 6 POST /api/v1/auth/login (or /register)
  |   -> enforce_captcha -> siteverify_token
  |   -> JWT signature valid -> continue login
```

### 3.2 Cap 协议分析（基于源码逆向）

Cap 开源代码（Apache 2.0）核心协议由三部分组成：

**Challenge 协议**
- `POST /challenge` (widget 拼接后为 `{apiEndpoint}challenge`)
- Response: `{ challenge: { c, s, d }, token: JWT, expires }`
- `c`=challenge count, `s`=salt size, `d`=difficulty
- JWT payload: `{ n, c, s, d, exp, iat, sk? }`

**Redeem 协议**
- `POST /redeem` (widget 拼接后为 `{apiEndpoint}redeem`)
- Request: `{ token: challengeJWT, solutions: [nonce1, ...] }`
- PoW 验证：对每个 i in [0,c):
  - `salt_seed = fnv1a_resume(fnv1a(token), str(i+1))`
  - `target_seed = fnv1a_resume(salt_seed, "d")`
  - `salt = prng_from_hash(salt_seed, s)`
  - `target = prng_from_hash(target_seed, d)`
  - `sha256_hex(salt + str(nonce_i))` must start with `target`
- Response: `{ success: true, token: redeemToken, expires }`

**Siteverify 协议**
- `POST /siteverify` (widget 不调用此端点；PeekView auth 内部调用)
- Request: `{ secret, response: redeemToken }`
- Response: `{ success: true/false }`

**核心算法（从 Cap `core/src/prng.js` 精确提取）**

```javascript
function fnv1a(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return hash >>> 0;
}

function fnv1aResume(state, str) {
  let h = state;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return h >>> 0;
}

function prngFromHash(initialHash, length) {
  let state = initialHash;
  let result = "";
  while (result.length < length) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    result += state.toString(16).padStart(8, "0");
  }
  return result.substring(0, length);
}
```

**上述算法必须在 Python 中逐字节精确复现**，否则 widget 计算的 solutions 将无法通过后端验证。

---

## 4. 后端设计

### 4.1 新增/修改文件清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `peekview/captcha_engine.py` | **新增** | Cap-compatible 核心引擎（challenge/redeem/siteverify 纯 Python 实现） |
| `peekview/api/captcha.py` | **修改** | `verify_captcha_token` 增加内置引擎分支；`enforce_captcha` 不变 |
| `peekview/api/captcha_router.py` | **新增** | FastAPI 路由: `/api/v1/captcha/challenge`, `/redeem`, `/siteverify`（widget 直接拼接 endpoint + 'challenge'/'redeem'，不插入 siteKey） |
| `peekview/api/config_router.py` | **修改** | `GET /api/v1/config/captcha` 增加 `mode` 和 `endpoint` |
| `peekview/main.py` | **修改** | 注册 `captcha_router` |
| `peekview/config.py` | **修改** | `PeekAuth` 新增 `captcha_builtin_*` 参数 |
| `tests/test_captcha_builtin.py` | **新增** | 内置引擎 TDD 测试（>=20 个用例） |
| `tests/test_captcha.py` | **修改** | 增加内置模式集成测试 |

### 4.2 captcha_engine.py 模块设计

```python
"""Cap-compatible captcha engine - pure Python standard library."""

import hashlib, hmac, json, secrets, time
from base64 import urlsafe_b64decode, urlsafe_b64encode

# FNV-1a 32-bit
HASH_OFFSET = 2166136261

def fnv1a(s: str) -> int:
    h = HASH_OFFSET
    for ch in s:
        h ^= ord(ch)
        h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)
        h &= 0xFFFFFFFF
    return h

def fnv1a_resume(state: int, s: str) -> int:
    h = state
    for ch in s:
        h ^= ord(ch)
        h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)
        h &= 0xFFFFFFFF
    return h

def prng_from_hash(initial_hash: int, length: int) -> str:
    state = initial_hash
    result = ""
    while len(result) < length:
        state ^= (state << 13) & 0xFFFFFFFF
        state ^= (state >> 17) & 0xFFFFFFFF
        state ^= (state << 5) & 0xFFFFFFFF
        state &= 0xFFFFFFFF
        result += format(state, "08x")
    return result[:length]

# JWT HS256 (stdlib only)
def _b64url(data: bytes) -> str:
    return urlsafe_b64encode(data).rstrip(b"=").decode("ascii")

def _b64url_decode(s: str) -> bytes:
    pad = 4 - len(s) % 4
    if pad != 4: s += "=" * pad
    return urlsafe_b64decode(s.encode("ascii"))

def jwt_sign(payload: dict, secret: str) -> str:
    header = _b64url(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    body = _b64url(json.dumps(payload, separators=(",", ":")).encode())
    sig = hmac.new(secret.encode(), f"{header}.{body}".encode(), hashlib.sha256).digest()
    return f"{header}.{body}.{_b64url(sig)}"

def jwt_verify(token: str, secret: str) -> dict | None:
    try:
        parts = token.split(".")
        if len(parts) != 3: return None
        sig = hmac.new(secret.encode(), f"{parts[0]}.{parts[1]}".encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(sig, _b64url_decode(parts[2])): return None
        return json.loads(_b64url_decode(parts[1]).decode("utf-8"))
    except Exception:
        return None

# PoW helpers
def sha256_hex(data: str) -> str:
    return hashlib.sha256(data.encode("utf-8")).hexdigest()

def pow_matches(hash_hex: str, target: str) -> bool:
    return hash_hex.startswith(target.lower())

# Cap-compatible API
DEFAULT_C = 50
DEFAULT_S = 32
DEFAULT_D = 4
DEFAULT_CHALLENGE_TTL_MS = 10 * 60 * 1000
DEFAULT_TOKEN_TTL_MS = 20 * 60 * 1000

def generate_challenge(secret: str, site_key: str, c=DEFAULT_C, s=DEFAULT_S, d=DEFAULT_D, ttl_ms=DEFAULT_CHALLENGE_TTL_MS) -> dict:
    now = int(time.time() * 1000)
    expires = now + ttl_ms
    payload = {"n": secrets.token_hex(25), "c": c, "s": s, "d": d, "exp": expires, "iat": now, "sk": site_key}
    token = jwt_sign(payload, secret)
    return {"challenge": {"c": c, "s": s, "d": d}, "token": token, "expires": expires}

async def validate_challenge(secret: str, body: dict, token_ttl_ms=DEFAULT_TOKEN_TTL_MS) -> dict:
    """Validate PoW solutions asynchronously to avoid blocking the event loop."""
    import asyncio
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _validate_challenge_sync, secret, body, token_ttl_ms)

def _validate_challenge_sync(secret: str, body: dict, token_ttl_ms=DEFAULT_TOKEN_TTL_MS) -> dict:
    token = body.get("token")
    solutions = body.get("solutions")
    if not token or not isinstance(solutions, list):
        return {"success": False, "reason": "missing_parameters"}
    payload = jwt_verify(token, secret)
    if not payload: return {"success": False, "reason": "invalid_token"}
    if payload.get("exp", 0) < time.time() * 1000: return {"success": False, "reason": "expired"}
    c, s, d = payload["c"], payload["s"], payload["d"]
    if len(solutions) != c: return {"success": False, "reason": "invalid_solutions"}
    token_fnv = fnv1a(token)
    for i in range(c):
        sol = solutions[i]
        # Exclude bool (bool is subclass of int in Python)
        if type(sol) is not int: return {"success": False, "reason": "invalid_solutions"}
        salt_seed = fnv1a_resume(token_fnv, str(i + 1))
        target_seed = fnv1a_resume(salt_seed, "d")
        salt = prng_from_hash(salt_seed, s)
        target = prng_from_hash(target_seed, d)
        if not pow_matches(sha256_hex(salt + str(sol)), target):
            return {"success": False, "reason": "invalid_solution"}
    now = int(time.time() * 1000)
    token_expires = now + token_ttl_ms
    redeem_token = jwt_sign({"sk": payload.get("sk"), "exp": token_expires, "iat": payload["iat"], "jti": secrets.token_hex(8)}, secret)
    return {"success": True, "token": redeem_token, "expires": token_expires}

def siteverify_token(secret: str, site_key: str, token: str) -> bool:
    payload = jwt_verify(token, secret)
    if not payload: return False
    if payload.get("sk") != site_key: return False
    if payload.get("exp", 0) < time.time() * 1000: return False
    return True
```

### 4.3 数据库模型

**无需新增 SQLModel 表**。redeem token 采用 JWT 自包含格式（含 `exp`, `sk`, `jti`），无需数据库存储。

> **设计决策说明**: 不存储 nonce/jti 表意味着无法严格防止 redeem token 重放。但考虑到:
> 1. token 有效期短（默认 20 分钟）
> 2. 重放攻击仍需配合正确的用户名/密码
> 3. 减少数据库迁移复杂度
> 4. 外部 Cap standalone 也使用 Redis 过期而非持久化审计
>
> 因此**当前版本不引入 nonce 表**。如后续安全审计要求，可追加 `CaptchaNonce` 表（无迁移风险，纯追加）。

### 4.4 API 端点

| 方法 | 路径 | 访问控制 | 说明 |
|------|------|----------|------|
| GET | `/api/v1/config/captcha` | 公开 | 返回 `{ enabled, site_key, endpoint, mode }` |
| POST | `/api/v1/captcha/challenge` | 公开 | 生成 PoW 挑战（rate limit: 30 req/min per IP） |
| POST | `/api/v1/captcha/redeem` | 公开 | 验证 PoW solutions，签发 redeem token（rate limit: 30 req/min per IP） |
| POST | `/api/v1/captcha/siteverify` | 公开 | 验证 redeem token（rate limit: 60 req/min per IP） |

**Rate limit 实现**: 复用项目现有 `slowapi` rate limit 机制（`peekview.api.rate_limit`）。

```python
# peekview/api/captcha_router.py (示意)
from fastapi import APIRouter, Request
from peekview.api.rate_limit import limiter
from peekview.captcha_engine import generate_challenge, validate_challenge, siteverify_token

router = APIRouter(prefix="/api/v1/captcha", tags=["captcha"])

@router.post("/challenge")
@limiter.limit("30/minute")
async def challenge(request: Request):
    config = request.app.state.config
    return generate_challenge(...)

@router.post("/redeem")
@limiter.limit("30/minute")
async def redeem(request: Request):
    config = request.app.state.config
    body = await request.json()
    return await validate_challenge(secret, body)
```

### 4.5 配置变更

`PeekAuth` 新增字段（全部有安全默认值）:

```python
class PeekAuth(BaseSettings):
    # ... existing fields unchanged ...
    # 新增：独立的 captcha JWT 签名密钥（不与 auth JWT 共用）
    captcha_secret_key: str = Field(
        default="",
        description="Secret key for captcha JWT signing (builtin mode). Auto-generated if empty.",
    )
    captcha_builtin_difficulty: int = Field(default=4)
    captcha_builtin_challenge_count: int = Field(default=50)
    captcha_builtin_challenge_size: int = Field(default=32)
    captcha_builtin_challenge_ttl_ms: int = Field(default=600_000)
    captcha_builtin_token_ttl_ms: int = Field(default=1_200_000)
```

**向后兼容策略（关键修正）**:
- `captcha_mode` 的**推断逻辑**（避免静默行为变更）:
  1. 如果 `captcha_enabled=False` -> captcha 关闭（与 v0.1.43 一致）
  2. 如果 `captcha_enabled=True` 且 `captcha_verify_url` 为空/默认 (`"http://localhost:3000"`) -> **builtin 模式**
  3. 如果 `captcha_enabled=True` 且 `captcha_verify_url` 非空且非默认 -> **external 模式**（打印 deprecation warning，建议迁移到 `captcha_mode` 显式配置）
- `_config_to_dataclass` 在 builtin 模式下**跳过** `verify_url` 的必填检查
- `captcha_secret_key` 为空时，builtin 模式下自动生成并持久化到 `~/.peekview/.captcha_secret`（文件权限 0o600，仅所有者可读）

### 4.6 Auth 集成变更

`peekview/api/captcha.py` 中的 `verify_captcha_token` 增加内置分支:

```python
async def verify_captcha_token(token, site_key, secret_key, verify_url, timeout=5.0):
    if not token: raise CaptchaRequiredError("Captcha token is required")
    # Builtin mode
    if not verify_url or verify_url.strip() == "" or verify_url == "builtin":
        from peekview.captcha_engine import siteverify_token
        if siteverify_token(secret_key, site_key, token): return True
        raise CaptchaInvalidError("Captcha verification failed")
    # External mode (v0.1.43 existing logic)
    verify_endpoint = f"{verify_url}/{site_key}/siteverify"
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(verify_endpoint, json={"secret": secret_key, "response": token})
        resp.raise_for_status()
        data = resp.json()
    return bool(data.get("success", False))
```

---

## 5. 前端设计

### 5.1 依赖变更与 WASM 本地打包

`frontend-v3/package.json` 新增:
```json
"dependencies": {
  "@cap.js/widget": "^1.0.0",
  ...
}
```

**关键：WASM 本地打包（满足 NFR1/NFR5 零外部依赖）**

`@cap.js/widget` 默认从 CDN (`https://cdn.jsdelivr.net/npm/@cap.js/wasm@0.0.7/browser/cap_wasm_bg.wasm`) 加载 WASM。
为实现完全离线可用，必须：

1. **安装 `@cap.js/wasm` 为 devDependency**:
   ```bash
   cd frontend-v3 && npm install -D @cap.js/wasm
   ```

2. **将 WASM 文件复制到 public 目录**:
   ```bash
   mkdir -p frontend-v3/public/cap
   cp frontend-v3/node_modules/@cap.js/wasm/browser/cap_wasm_bg.wasm frontend-v3/public/cap/
   ```

3. **在 `index.html` 中设置 `CAP_CUSTOM_WASM_URL`**:
   ```html
   <script>
     window.CAP_CUSTOM_WASM_URL = '/cap/cap_wasm_bg.wasm'
   </script>
   ```

4. **Vite 构建后检查**: `dist/cap/cap_wasm_bg.wasm` 必须存在于构建输出中。

5. **后端静态文件服务**: `backend/peekview/static/cap/cap_wasm_bg.wasm` 必须可访问。

### 5.2 LoginDialog.vue 集成方案

```vue
<template>
  ...
  <form @submit.prevent="submit" class="login__form">
    <!-- existing fields -->
    <div v-if="captchaEnabled" class="login__captcha">
      <cap-widget
        :data-cap-api-endpoint="captchaEndpoint"
        @solve="onCaptchaSolve"
        @error="onCaptchaError"
      />
    </div>
    <button type="submit" :disabled="loading || (captchaEnabled && !captchaToken)">
      ...
    </button>
  </form>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import '@cap.js/widget'

const captchaEnabled = ref(false)
const captchaEndpoint = ref('')
const captchaToken = ref<string | null>(null)

onMounted(async () => {
  try {
    const resp = await fetch('/api/v1/config/captcha')
    if (resp.ok) {
      const cfg = await resp.json()
      captchaEnabled.value = cfg.enabled
      // Widget appends 'challenge'/'redeem' directly to apiEndpoint.
      // Must end with trailing slash to avoid '/api/v1/captchachallenge'.
      let ep = cfg.endpoint || '/api/v1/captcha'
      if (!ep.endsWith('/')) ep += '/'
      captchaEndpoint.value = ep
    }
  } catch {
    captchaEnabled.value = false
  }
})

function onCaptchaSolve(e: CustomEvent) { captchaToken.value = e.detail.token }
function onCaptchaError(e: CustomEvent) {
  console.error('Captcha error:', e.detail)
  error.value = 'Captcha verification failed. Please try again.'
}

async function submit() {
  try {
    if (mode.value === 'login') {
      await authStore.login(username.value, password.value, captchaToken.value || undefined)
    } else {
      await authStore.register(username.value, password.value, displayName.value, captchaToken.value || undefined)
    }
  } catch (err: any) {
    const code = err?.response?.data?.error?.code
    if (code === 'CAPTCHA_REQUIRED') error.value = 'Please complete the captcha verification.'
    else if (code === 'CAPTCHA_INVALID') error.value = 'Captcha verification failed. Please try again.'
    else error.value = err?.response?.data?.error?.message || 'Operation failed'
    captchaToken.value = null
  }
}
</script>
```

### 5.3 API Client 变更

```typescript
async login(username: string, password: string, captchaToken?: string): Promise<AuthResponse> {
  const response = await this.client.post<AuthApiResponse>('/auth/login', {
    username, password, captcha_token: captchaToken || null,
  })
  ...
}

async register(username: string, password: string, displayName?: string, captchaToken?: string): Promise<AuthResponse> {
  const response = await this.client.post<AuthApiResponse>('/auth/register', {
    username, password, display_name: displayName || null, captcha_token: captchaToken || null,
  })
  ...
}
```

### 5.4 Auth Store 变更

```typescript
async function login(username: string, password: string, captchaToken?: string): Promise<void> {
  authLoading.value = true
  try {
    const result = await api.login(username, password, captchaToken)
    token.value = result.accessToken
    user.value = result.user
  } finally { authLoading.value = false }
}

async function register(username: string, password: string, displayName?: string, captchaToken?: string): Promise<void> {
  authLoading.value = true
  try {
    const result = await api.register(username, password, displayName, captchaToken)
    token.value = result.accessToken
    user.value = result.user
  } finally { authLoading.value = false }
}
```

### 5.5 公开 Config 端点变更

```python
class PublicCaptchaConfig(BaseModel):
    enabled: bool
    site_key: str
    endpoint: str
    mode: str  # "builtin" | "external"

@router.get("/captcha", response_model=PublicCaptchaConfig)
async def get_captcha_config(request: Request) -> PublicCaptchaConfig:
    config = request.app.state.config
    auth = config.auth
    mode = "builtin"
    verify_url = getattr(auth, "captcha_verify_url", "")
    if verify_url and verify_url.strip() and verify_url != "http://localhost:3000":
        mode = "external"
    return PublicCaptchaConfig(
        enabled=getattr(auth, "captcha_enabled", False),
        site_key=getattr(auth, "captcha_site_key", ""),
        endpoint="/api/v1/captcha" if mode == "builtin" else verify_url,
        mode=mode,
    )
```

---

## 6. 测试策略（TDD）

### 6.1 后端单元测试（先写测试，预期失败）

**新建 `backend/tests/test_captcha_builtin.py`**

| # | 测试用例 | 类型 | 预期初始状态 |
|---|----------|------|-------------|
| T1 | `test_fnv1a_known_values` | 算法 | 失败（未实现） |
| T2 | `test_fnv1a_resume_known_values` | 算法 | 失败 |
| T3 | `test_prng_from_hash_known_values` | 算法 | 失败 |
| T4 | `test_sha256_pow_matches` | 算法 | 失败 |
| T5 | `test_jwt_sign_verify_roundtrip` | 算法 | 失败 |
| T6 | `test_generate_challenge_returns_valid_jwt` | 引擎 | 失败 |
| T7 | `test_generate_challenge_jwt_payload_fields` | 引擎 | 失败 |
| T8 | `test_generate_challenge_respects_custom_params` | 引擎 | 失败 |
| T9 | `test_redeem_valid_solutions_succeeds` | 引擎 | 失败 |
| T10 | `test_redeem_invalid_solutions_fails` | 引擎 | 失败 |
| T11 | `test_redeem_expired_challenge_fails` | 引擎 | 失败 |
| T12 | `test_redeem_wrong_solution_count_fails` | 引擎 | 失败 |
| T13 | `test_redeem_non_int_solution_fails` | 引擎 | 失败 |
| T14 | `test_siteverify_valid_token_succeeds` | 引擎 | 失败 |
| T15 | `test_siteverify_expired_token_fails` | 引擎 | 失败 |
| T16 | `test_siteverify_wrong_site_key_fails` | 引擎 | 失败 |
| T17 | `test_siteverify_tampered_token_fails` | 引擎 | 失败 |
| T18 | `test_api_challenge_endpoint_format` | HTTP | 失败 |
| T19 | `test_api_redeem_endpoint_success` | HTTP | 失败 |
| T20 | `test_api_redeem_endpoint_failure` | HTTP | 失败 |
| T21 | `test_api_siteverify_endpoint` | HTTP | 失败 |
| T22 | `test_auth_login_with_builtin_captcha` | 集成 | 失败 |
| T23 | `test_auth_register_with_builtin_captcha` | 集成 | 失败 |
| T24 | `test_captcha_disabled_no_regression` | 回归 | 通过（已有） |

**算法交叉验证**: T1-T5 必须与 Cap JS 实现输出一致。

### 6.2 E2E Playwright 测试（先写测试，预期失败）

**新建 `frontend-v3/e2e/captcha.spec.ts`**

```typescript
import { test, expect } from '@playwright/test'

test.describe('Captcha Login/Register Flow', () => {
  test('captcha disabled: login without widget succeeds', async ({ page }) => {
    await page.goto('/')
    await page.click('[data-testid="login-btn"]')
    await expect(page.locator('cap-widget')).toHaveCount(0)
    await page.fill('#login-username', 'testuser')
    await page.fill('#login-password', 'testpass123')
    await page.click('button[type="submit"]')
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()
  })

  test('captcha enabled: widget appears in login dialog', async ({ page }) => {
    await page.goto('/')
    await page.click('[data-testid="login-btn"]')
    await expect(page.locator('cap-widget')).toBeVisible()
  })

  test('captcha enabled: submit disabled until solved', async ({ page }) => {
    await page.goto('/')
    await page.click('[data-testid="login-btn"]')
    const submitBtn = page.locator('button[type="submit"]')
    await expect(submitBtn).toBeDisabled()
    // Wait for widget to be ready (WASM loaded)
    await page.waitForFunction(() => {
      const widget = document.querySelector('cap-widget') as any
      return widget && widget.shadowRoot && widget.shadowRoot.querySelector('.cap-button')
    }, { timeout: 10000 })
    await page.evaluate(async () => {
      const widget = document.querySelector('cap-widget') as any
      if (widget) await widget.solve()
    })
    await expect(submitBtn).toBeEnabled()
  })

  test('captcha enabled: login succeeds after solve', async ({ page }) => {
    await page.goto('/')
    await page.click('[data-testid="login-btn"]')
    await page.fill('#login-username', 'captchatest')
    await page.fill('#login-password', 'testpass123')
    // Wait for widget to be ready
    await page.waitForFunction(() => {
      const widget = document.querySelector('cap-widget') as any
      return widget && widget.shadowRoot && widget.shadowRoot.querySelector('.cap-button')
    }, { timeout: 10000 })
    await page.evaluate(async () => {
      const widget = document.querySelector('cap-widget') as any
      if (widget) await widget.solve()
    })
    await page.click('button[type="submit"]')
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()
  })

  test('captcha enabled: register first user exempt', async ({ page }) => {
    await page.goto('/')
    await page.click('[data-testid="login-btn"]')
    await page.click('button:has-text("Register")')
    await page.fill('#login-username', 'firstadmin')
    await page.fill('#login-password', 'adminpass123')
    await page.fill('#login-confirm', 'adminpass123')
    await page.click('button[type="submit"]')
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()
  })
})
```

**E2E 加速策略**:
- Debug 后端配置 `captcha_builtin_difficulty=1`, `captcha_builtin_challenge_count=5`
- difficulty=1 时 PoW 平均只需 16 次哈希，浏览器可在 <500ms 内完成

### 6.3 回归测试范围

- 全部已有 backend tests（当前 432 passed）必须仍通过
- 全部已有 E2E tests 必须仍通过
- `captcha_enabled=false` 路径的行为与 v0.1.43 完全一致

---

## 7. 安全设计

| # | 风险 | 缓解措施 |
|---|------|----------|
| S1 | PoW 难度太低被暴力绕过 | 默认 difficulty=4（平均 65,536 次哈希/ challenge）；生产可调高 |
| S2 | Challenge JWT 被伪造 | HS256 签名，`captcha_secret_key` 独立密钥，默认自动生成并持久化 |
| S3 | Redeem token 重放 | JWT 含短有效期（20min）+ jti；当前版本不持久化 jti（见 4.3 设计决策） |
| S4 | Challenge 被预计算 | 每次 challenge 含随机 `n`（25 bytes hex），不可预测 |
| S5 | DoS（大量 challenge 请求） | challenge/redeem 端点显式配置 rate limit（30 req/min per IP） |
| S6 | 前端配置泄露 | 仅泄露 `endpoint`（公开路径），`captcha_secret_key` 永不外泄 |
| S7 | 算法实现差异导致验证绕过 | 所有算法从 Cap 源码精确移植；T1-T5 交叉验证测试确保一致性 |
| S8 | PoW 验证阻塞事件循环 | `validate_challenge` 在 `run_in_executor` 中执行，不阻塞 FastAPI async loop |
| S9 | captcha JWT 与 auth JWT 密钥混淆 | `captcha_secret_key` 与 `auth.secret_key` 完全隔离，降低影响面 |

---

## 8. 风险与缓解

| 风险 | 等级 | 缓解 |
|------|------|------|
| Cap widget 协议/算法细节变化导致不兼容 | **高** | 协议基于 Cap v3.1.5（锁定版本）；`@cap.js/widget` 锁定版本号；算法实现配套单元测试（T1-T5）可在升级时快速发现差异 |
| Python 算法与 JS 实现存在微妙差异（如整数溢出、字节序） | **高** | 从源码精确移植；`& 0xFFFFFFFF` 确保无符号 32-bit 行为；大量交叉验证测试 |
| E2E 测试中 PoW 计算过慢 | **中** | 测试配置降低 difficulty=1, count=5；Playwright timeout 60s |
| v0.1.43 外部模式向后兼容断裂 | **低** | 保留 external 分支；`captcha_mode` 显式区分；`verify_captcha_token` 签名不变 |
| 内置引擎性能不足（高并发） | **低** | PoW 验证是纯 CPU 计算，单个 redeem < 50ms；FastAPI async 不阻塞；难度参数可调 |

---

## 9. 验收标准（Checklist）

- [ ] **AC1**: `pipx install peekview` 后，不启动任何额外服务即可使用 captcha
- [ ] **AC2**: 前端 LoginDialog 在 captcha enabled 时正确显示 `<cap-widget>`，disabled 时完全隐藏
- [ ] **AC3**: captcha enabled 时，未 solve 的 widget 使 submit 按钮禁用
- [ ] **AC4**: captcha enabled 时，solve 后登录/注册成功
- [ ] **AC5**: captcha enabled 时，提交无效 token 后端返回 `CAPTCHA_INVALID`
- [ ] **AC6**: captcha disabled 时，登录/注册与 v0.1.43 行为完全一致
- [ ] **AC7**: 第一个用户注册自动豁免 captcha
- [ ] **AC8**: 后端新增 >= 24 个单元测试，全部通过
- [ ] **AC9**: E2E 新增 >= 5 个 Playwright 测试，全部通过
- [ ] **AC10**: 已有 432 个 backend tests 全部通过，零回归
- [ ] **AC11**: `make debug` 联调通过，手动验证登录/注册/captcha 全链路
- [ ] **AC12**: CHANGELOG.md 更新，记录 v0.1.44 变更

---

## 10. 实施计划（WBS - 一镜到底执行顺序）

### Phase A: 后端引擎 TDD（预计 2-3 小时）

| 步骤 | 任务 | 验收 |
|------|------|------|
| A0 | **前置：交叉验证脚本**。用 Node.js 调用 `capjs-core` 的 fnv1a/prng，与 Python 实现对比 1000 组随机输入，确保 100% 一致 | 脚本输出 "ALL MATCHED" |
| A1 | 新建 `tests/test_captcha_builtin.py`，编写 T1-T24（先写测试，此时导入会失败） | `pytest tests/test_captcha_builtin.py` 因 ImportError 失败（预期） |
| A2 | 新建 `peekview/captcha_engine.py`，实现 fnv1a/prng/JWT | T1-T5 通过 |
| A3 | 实现 generate_challenge / validate_challenge / siteverify_token | T6-T17 通过 |
| A4 | 新建 `peekview/api/captcha_router.py`，实现 HTTP 端点（**注意：去掉 siteKey 路径参数**） | T18-T21 通过 |
| A5 | 修改 `peekview/api/captcha.py`，在 `verify_captcha_token` 中增加内置分支；**builtin 模式跳过 verify_url 检查** | T22-T23 通过 |
| A6 | 修改 `peekview/api/config_router.py`，返回 mode/endpoint | 手动 curl 验证 |
| A7 | 修改 `peekview/config.py`，新增 `captcha_secret_key` 和 `captcha_builtin_*` 字段 | 配置加载正常 |
| A8 | 修改 `peekview/main.py`，注册 captcha_router | 路由可达 |
| A9 | 运行全部 backend tests（`make test-quick`），确保零回归 | 432+24 全部 passed |

### Phase B: 前端集成（预计 1-2 小时）

| 步骤 | 任务 | 验收 |
|------|------|------|
| B1 | `cd frontend-v3 && npm install @cap.js/widget` | package.json 更新 |
| B2 | 修改 `src/api/client.ts`，login/register 增加 `captchaToken` 参数 | TypeScript 编译通过 |
| B3 | 修改 `src/stores/auth.ts`，同步更新 | 编译通过 |
| B4 | 修改 `src/components/LoginDialog.vue`，集成 cap-widget | 编译通过 |
| B5 | `npm run build`，复制静态文件到 backend | `backend/peekview/static/` 更新 |

### Phase C: E2E TDD（预计 2-3 小时）

**E2E 基础设施更新（关键）**:

1. **修改 `scripts/dev-server.sh`**: 支持通过环境变量启用 captcha:
   ```bash
   export PEEKVIEW_AUTH__CAPTCHA_ENABLED=${PEEKVIEW_AUTH__CAPTCHA_ENABLED:-false}
   export PEEKVIEW_AUTH__CAPTCHA_BUILTIN_DIFFICULTY=${PEEKVIEW_AUTH__CAPTCHA_BUILTIN_DIFFICULTY:-4}
   ```

2. **修改 `scripts/run-e2e-tests.sh`**: 分两次运行 E2E:
   - 第一次：captcha disabled（默认），运行已有 E2E + `captcha-disabled.spec.ts`
   - 第二次：captcha enabled，运行 `captcha-enabled.spec.ts`

3. **captcha E2E 测试分两个文件**:
   - `e2e/captcha-disabled.spec.ts`: captcha disabled 场景（与现有 debug 后端兼容）
   - `e2e/captcha-enabled.spec.ts`: captcha enabled 场景（需要独立后端实例或 test fixture 重置数据库）

| 步骤 | 任务 | 验收 |
|------|------|------|
| C1 | 修改 `scripts/dev-server.sh` 和 `scripts/run-e2e-tests.sh`，支持 captcha 环境变量 | 脚本可正常启动 captcha-enabled 后端 |
| C2 | 新建 `e2e/captcha-disabled.spec.ts` 和 `e2e/captcha-enabled.spec.ts` | 测试因缺少实现而失败（预期） |
| C3 | 配置 debug 后端 `captcha_builtin_difficulty=1, count=5` | 后端启动正常 |
| C4 | 运行 E2E，根据失败项修复（widget 选择器、事件时序、按钮状态、WASM 加载） | 全部测试通过 |
| C5 | 运行全部已有 E2E，确保零回归 | 全部通过 |

### Phase D: 联调与文档（预计 1 小时）

| 步骤 | 任务 | 验收 |
|------|------|------|
| D1 | `make debug` 启动完整环境 | 服务在 :8888 正常 |
| D2 | 手动验证: captcha enabled 登录流程 | 截图/确认 |
| D3 | 手动验证: captcha disabled 登录流程 | 截图/确认 |
| D4 | 手动验证: 第一个用户豁免 | 截图/确认 |
| D5 | 更新 CHANGELOG.md（v0.1.44） | 含 captcha 内置引擎、前端集成、E2E |
| D6 | 更新 `docs/plans/captcha-integration.md` 状态为已完成 | 文档一致 |

---

## 附录 A: 与 v0.1.43 的向后兼容矩阵

| v0.1.43 配置 | v0.1.44 推断行为 | 兼容性 |
|-------------|-----------------|--------|
| `captcha_enabled=false` | captcha 完全关闭，行为不变 | 完全兼容 |
| `captcha_enabled=true`, `captcha_verify_url=""` 或默认值 `"http://localhost:3000"` | **builtin 模式**（使用内置引擎） | 行为变化（更符合用户预期） |
| `captcha_enabled=true`, `captcha_verify_url="https://custom-cap.example.com"` | **external 模式**（自动推断，打印 deprecation warning） | 完全兼容（自动推断） |

**决策**: `captcha_mode` 采用**自动推断**而非固定默认值:
1. `captcha_enabled=False` -> captcha 关闭
2. `captcha_enabled=True` + `captcha_verify_url` 为空/默认 -> **builtin**
3. `captcha_enabled=True` + `captcha_verify_url` 非空且非默认 -> **external**（打印 warning，建议显式配置）

此设计避免 v0.1.43 已配置 external 服务的用户升级后 captcha 断裂。

---

## 附录 B: 算法 Python 实现草案

```python
HASH_OFFSET = 2166136261

def fnv1a(s: str) -> int:
    h = HASH_OFFSET
    for ch in s:
        h ^= ord(ch)
        h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)
        h &= 0xFFFFFFFF
    return h

def fnv1a_resume(state: int, s: str) -> int:
    h = state
    for ch in s:
        h ^= ord(ch)
        h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)
        h &= 0xFFFFFFFF
    return h

def prng_from_hash(initial_hash: int, length: int) -> str:
    state = initial_hash
    result = ""
    while len(result) < length:
        state ^= (state << 13) & 0xFFFFFFFF
        state ^= (state >> 17) & 0xFFFFFFFF
        state ^= (state << 5) & 0xFFFFFFFF
        state &= 0xFFFFFFFF
        result += format(state, "08x")
    return result[:length]
```

**交叉验证脚本**（评审后实施阶段执行）:
1. 用 Node.js 运行调用 `capjs-core` 的脚本，输出已知输入的 fnv1a/prng 结果
2. 用 Python 运行相同输入
3. 对比输出，必须 100% 一致

---

*文档结束*
