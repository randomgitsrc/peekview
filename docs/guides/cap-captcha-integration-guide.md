# Cap Captcha 集成与测试总结

> 适用版本：PeekView v0.1.52+（内置 Cap-compatible 引擎）
> 前端依赖：`@cap.js/widget`
> 撰写日期：2026-06-11

---

## 1. 架构概览

```
用户浏览器                   PeekView 后端
┌──────────────┐            ┌─────────────────────┐
│ LoginDialog  │──GET /api/v1/config/captcha──→  │ 返回 enabled/site_key/endpoint/mode
│              │                                  │
│  cap-widget  │──POST /api/v1/captcha/challenge→ │ captcha_engine.py
│  (PoW计算)   │←── {challenge, token} ────────── │   generate_challenge()
│              │                                  │
│  cap-widget  │──POST /api/v1/captcha/redeem───→ │   validate_challenge()
│  (提交答案)   │←── {result: "token"} ─────────── │
│              │                                  │
│  Login/Reg   │──POST /api/v1/auth/login────────→ │ captcha.py
│  (带cap-token)│       {captcha_token}             │   siteverify_token()
└──────────────┘            └─────────────────────┘
```

**两种模式**：
- **builtin**（默认）：纯 Python 内置引擎，零外部依赖，自签名 JWT
- **external**：对接独立 Cap standalone 服务（`captcha_verify_url` 指向外部服务）

---

## 2. 后端集成

### 2.1 文件清单

| 文件 | 职责 |
|------|------|
| `backend/peekview/config.py` | `PeekAuth` 中 11 个 captcha 字段 |
| `backend/peekview/captcha_engine.py` | 内置引擎：PoW 生成/验证、JWT 签发/校验 |
| `backend/peekview/api/captcha.py` | 验证码校验逻辑（`enforce_captcha`, `_config_to_dataclass`） |
| `backend/peekview/api/captcha_router.py` | 公开端点：`/challenge`, `/redeem`, `/siteverify` |
| `backend/peekview/api/config_router.py` | 前端 bootstrap 端点：`GET /api/v1/config/captcha` |
| `backend/peekview/api/auth.py` | `login/register` 中调用 `enforce_captcha()` |
| `backend/peekview/api/rate_limit.py` | captcha 端点限速（`captcha_rate_limit` callable） |

### 2.2 配置项（PeekAuth 类）

```python
# 开关（默认关闭）
captcha_enabled: bool = False

# 公开标识（内置模式建议 "peekview-default"）
captcha_site_key: str = "peekview-default"

# 密钥（为空时自动生成，存储于 ~/.peekview/.captcha_secret）
captcha_secret_key: str = ""

# 外部模式验证 URL（默认值 "http://localhost:3000" 走内置模式）
captcha_verify_url: str = "http://localhost:3000"

# 首个用户豁免（管理员首次注册无需验证码）
captcha_exempt_first_user: bool = True

# PoW 参数（内置引擎）
captcha_builtin_difficulty: int = 2       # hex 前缀匹配位数（2 = 256 次 hash 期望值）
captcha_builtin_challenge_count: int = 10  # 每次验证的 challenge 数量
captcha_builtin_challenge_size: int = 32   # nonce 字节数
captcha_builtin_challenge_ttl_ms: int = 600_000  # challenge 过期（10 分钟）
captcha_builtin_token_ttl_ms: int = 300_000     # redeem token 过期（5 分钟）
```

### 2.3 CLI 开放给用户的 key

只开放两个（内部引擎参数用默认值）：`auth.captcha_enabled`, `auth.captcha_site_key`

```bash
peekview config set auth.captcha_enabled true
peekview service restart
```

### 2.4 关键代码路径

**开启验证码后的注册流程**（`auth.py` → `captcha.py`）：
```python
# auth.py
await enforce_captcha(token=data.captcha_token, auth_config=config.auth, is_first_user=is_first_user)

# captcha.py → _config_to_dataclass
# 1. 检查 secret_key：为空时回退读取 ~/.peekview/.captcha_secret
# 2. 检查 verify_url：为默认值 "http://localhost:3000" 时清空 → 走内置模式
# 3. 缺少必要字段 → raise CaptchaConfigError

# captcha.py → verify_captcha_token
# 1. verify_url 为空 → siteverify_token() 内置验证
# 2. verify_url 有值 → HTTP POST 外部验证
```

---

## 3. 前端集成

### 3.1 文件清单

| 文件 | 职责 |
|------|------|
| `frontend-v3/src/components/LoginDialog.vue` | 集成 `<cap-widget>`，读取 config 端点 |
| `frontend-v3/index.html` | 设置 `window.CAP_CUSTOM_WASM_URL` |
| `frontend-v3/public/wasm/cap_wasm_bg.wasm` | 本地 WASM（22KB） |
| `frontend-v3/src/api/client.ts` | API 客户端（无直接 captcha 交互） |

### 3.2 LoginDialog 集成要点

```html
<!-- cap-widget 条件渲染 -->
<div v-if="captchaEnabled" class="login__captcha">
  <cap-widget
    :data-cap-api-endpoint="captchaEndpoint"
    @solve="onCaptchaSolve"
    @error="onCaptchaError"
  />
</div>
```

```typescript
// 启动时读取 config
const resp = await fetch('/api/v1/config/captcha')
const cfg = await resp.json()
captchaEnabled.value = cfg.enabled
captchaEndpoint.value = cfg.endpoint || '/api/v1/captcha'

// 提交时携带 token
await authStore.login(username, password, captchaToken.value || undefined)
```

### 3.3 WASM 本地离线化

**原理**：`@cap.js/widget` 源码第 246 行检查全局变量 `window.CAP_CUSTOM_WASM_URL`，如果设置则使用本地路径，否则从 CDN 加载。

**实现**：
1. 下载 `cap_wasm_bg.wasm`（22KB）到 `public/wasm/`
2. 在 `index.html` 的 `<head>` 中，Vue 加载前设置：
   ```html
   <script>window.CAP_CUSTOM_WASM_URL = '/wasm/cap_wasm_bg.wasm'</script>
   ```
3. 无需额外配置，Vite 构建时自动复制 `public/` 到 `dist/`

**注意**：必须在任何 `<script type="module">` 之前设置，因为 `@cap.js/widget` 在模块 import 时就开始预加载 WASM。

---

## 4. CSP 要求

### 4.1 必需的 CSP 指令

```python
# main.py — SPA 页面 CSP
"worker-src blob:"      # cap widget 用 blob: URL 创建 Web Worker 做 PoW
"connect-src 'self'"    # WASM 从同源加载（/wasm/cap_wasm_bg.wasm）
```

### 4.2 不需要的（常见误区）

| 指令 | 是否需要 | 原因 |
|------|---------|------|
| `connect-src` 加 CDN | ❌ | WASM 已本地化 |
| `script-src blob:` | ❌ | Worker 用 `worker-src`，不用 `script-src` |
| `unsafe-eval` 为 captcha | ❌ | WASM 不需要 eval |

---

## 5. 测试策略

### 5.1 单元测试

**后端**（`tests/test_captcha.py` + `tests/test_captcha_builtin.py`）：
- `_config_to_dataclass` 各种配置组合
- `enforce_captcha` 豁免/拒绝/验证逻辑
- 内置引擎：challenge 生成、PoW 验证、JWT 签名/校验
- 外部模式：HTTP mock 验证

### 5.2 E2E 测试

**独立测试文件**（`e2e/debug-captcha.spec.ts`）：

必须用独立文件，因为 captcha 开启/关闭是全局状态，会影响其他测试（login/register 行为不同）。

**启动方式**：
```bash
# captcha 开启的 debug server
PEEKVIEW_AUTH__CAPTCHA_ENABLED=true make debug-start

# 运行 captcha 专用测试
cd frontend-v3
BASE_URL=http://127.0.0.1:8888 npx playwright test e2e/debug-captcha.spec.ts
```

**测试用例设计**：
1. `config endpoint shows captcha enabled` — 确认 `/api/v1/config/captcha` 返回正确
2. `challenge endpoint works` — `POST /api/v1/captcha/challenge` 返回 challenge 数据
3. `siteverify rejects invalid token` — 假 token 被拒绝
4. `login without captcha token is rejected` — 缺 token 返回 CAPTCHA 错误
5. `builtin verification returns CAPTCHA error for invalid token` — 不能是 INTERNAL_ERROR
6. `login dialog contains captcha widget` — `<cap-widget>` 元素存在

### 5.3 常见测试陷阱

1. **速率限制**：captcha 测试和 auth 测试不能同时跑（共用 login/register 限速计数器）
2. **首个用户豁免**：`captcha_exempt_first_user=true` 时第一个注册用户不需要验证码
3. **密码长度**：PeekView 要求密码 ≥ 8 字符，短密码返回 422 而非 CAPTCHA 错误
4. **并行 vs 串行**：captcha 测试建议 `--workers=1` 避免资源竞争

---

## 6. 调试诊断清单

当 captcha 不工作时，按顺序检查：

| 步骤 | 命令 | 预期 |
|------|------|------|
| 1. 是否启用 | `peekview config get auth.captcha_enabled` | `true` |
| 2. config 端点 | `curl /api/v1/config/captcha` | `enabled: true` |
| 3. challenge | `POST /api/v1/captcha/challenge` | 返回 `{challenge, token}` |
| 4. 浏览器控制台 | F12 → Console | 无 CSP 错误、无 WASM 加载失败 |
| 5. 浏览器网络 | F12 → Network | `/wasm/cap_wasm_bg.wasm` 200 OK |
| 6. 服务日志 | `journalctl -u peekview -n 20` | 无 `httpx.ConnectTimeout` |

**最常见的 3 个问题**：

| 现象 | 根因 | 修复 |
|------|------|------|
| `cap wasm load failed` | CSP 缺少 `connect-src` CDN 或 WASM 路径错误 | 检查 `index.html` 中 `CAP_CUSTOM_WASM_URL` |
| `Captcha is enabled but missing config: captcha_secret_key` | `secret_key` 为空且 `~/.peekview/.captcha_secret` 不存在 | 重启服务触发自动生成 |
| `INTERNAL_ERROR` / `ConnectTimeout` | `verify_url` 为 `localhost:3000` 走 external 模式 | 确认 `_config_to_dataclass` 中默认值清空逻辑 |
| PoW 太慢（>20s） | `difficulty` 过大 | 修改 `captcha_builtin_difficulty` 和 `captcha_builtin_challenge_count` |

---

## 7. 发布检查清单

新版本涉及 captcha 时：

- [ ] 后端单元测试全部通过（`pytest tests/test_captcha*.py`）
- [ ] E2E captcha 测试全部通过（`debug-captcha.spec.ts`）
- [ ] E2E 主测试全部通过（`debug-server.spec.ts`，captcha 关闭）
- [ ] `pyproject.toml` 中 `httpx` 在主 `dependencies` 列表（非 `optional-dependencies`）
- [ ] `frontend-v3/public/wasm/cap_wasm_bg.wasm` 存在
- [ ] `index.html` 中 `CAP_CUSTOM_WASM_URL` 已设置
- [ ] 前端构建无错误（`npm run build`）
- [ ] 生产环境升级后 `pipx install peekview` 能正常启动
- [ ] `config list` 能看到 `auth.captcha_enabled`

---

## 8. 关键教训

1. **不可仓促发版** — captcha 涉及前后端 + CSP + WASM 多层依赖，改动后必须完整跑 E2E 验证
2. **默认值陷阱** — `verify_url="http://localhost:3000"` 不是空字符串，会被当作 external 模式
3. **`pipx upgrade` 不装新依赖** — `httpx` 从 optional 移到主依赖后需全新安装
4. **cap.js WASM 全局变量** — `window.CAP_CUSTOM_WASM_URL` 必须在模块 import 之前设置
5. **CSP 排查顺序** — 先看浏览器 Console 标签，再看 Network 标签，最后看服务日志
