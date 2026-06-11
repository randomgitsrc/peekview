# Plan: Rate Limiting 配置化真正落地 (#2) — v2 (专家评审后)

## 问题

1. **auth.py `@limiter.limit(login_rate_limit)`** — callable 方式虽能工作，但职责不清
2. **captcha_router.py `@limiter.limit("30/minute")`** — 硬编码，不可配置
3. **`rate_limit_per_minute` 字段形同虚设** — config 里有值但无端点使用

## 方案

### 核心思路

1. auth.py / captcha_router.py 去掉 `@limiter.limit` 装饰器
2. main.py `create_app()` 中直接 import 函数 + `limiter.limit(str)(func)` 绑定
3. `rate_limit_per_minute` 作为 `limiter.default_limits`，让所有未显式限速的 API 端点也有兜底保护
4. 删除 `login_rate_limit()` / `set_login_rate_limit()` callable provider 机制

### 改动清单

#### 1. auth.py — 去掉装饰器

```python
# Before:
from peekview.api.rate_limit import limiter, login_rate_limit

@router.post("/register", status_code=201)
@limiter.limit(login_rate_limit)
async def register(...):

@router.post("/login")
@limiter.limit(login_rate_limit)
async def login(...):

# After:
# (无 limiter import)

@router.post("/register", status_code=201)
async def register(...):

@router.post("/login")
async def login(...):
```

#### 2. captcha_router.py — 去掉装饰器

```python
# Before:
from peekview.api.rate_limit import limiter

@router.post("/challenge")
@limiter.limit("30/minute")
async def challenge(...):

@router.post("/redeem")
@limiter.limit("30/minute")
async def redeem(...):

@router.post("/siteverify")
@limiter.limit("60/minute")
async def siteverify(...):

# After:
# (无 limiter import)

@router.post("/challenge")
async def challenge(...):

@router.post("/redeem")
async def redeem(...):

@router.post("/siteverify")
async def siteverify(...):
```

#### 3. main.py — create_app() 中统一绑定

```python
# --- Rate limiting binding (after include_router) ---

# Auth: login/register 用专用限制
from peekview.api.auth import register, login
login_limit = f"{config.server.rate_limit_login_per_minute}/minute"
limiter.limit(login_limit)(register)
limiter.limit(login_limit)(login)

# Captcha: 用通用默认限制
from peekview.api.captcha_router import challenge, redeem, siteverify
default_limit = f"{config.server.rate_limit_per_minute}/minute"
limiter.limit(default_limit)(challenge)
limiter.limit(default_limit)(redeem)
limiter.limit(default_limit)(siteverify)

# 全局默认限制（其他 API 端点的兜底）
limiter.default_limits = [default_limit]
```

注意：`default_limits` 是 slowapi 的正式 API，对**没有显式绑定 limit 的路由**生效。已显式绑定的路由用自己的值，不受 default_limits 影响。

#### 4. rate_limit.py — 简化

删除 `login_rate_limit()` / `set_login_rate_limit()` / `_login_rate_limit_provider`。
只保留 `limiter` 实例和 `RateLimitExceeded` import。

#### 5. config.py — 无变更

现有 3 个字段正好够用：
- `rate_limit_enabled: bool = True` — 总开关
- `rate_limit_per_minute: int = 60` — 通用端点 + captcha 兜底
- `rate_limit_login_per_minute: int = 10` — login/register 专用

#### 6. 测试更新

现有测试不变。新增：
- `test_rate_limit_login_config_value` — `create_app()` 传 `rate_limit_login_per_minute=3`，验证 3 次后 429
- `test_default_rate_limit_on_api_endpoints` — 验证非 login/captcha 的 API 端点也受 `rate_limit_per_minute` 限制
- 验证 captcha 端点使用 `rate_limit_per_minute` 值

## 验证

- [ ] `PEEKVIEW_SERVER__RATE_LIMIT_LOGIN_PER_MINUTE=3` → 3 次登录后 429
- [ ] `PEEKVIEW_SERVER__RATE_LIMIT_PER_MINUTE=5` → captcha 5 次后 429
- [ ] `PEEKVIEW_SERVER__RATE_LIMIT_ENABLED=false` → 无 429
- [ ] auth.py 无 `@limiter.limit` 装饰器
- [ ] captcha_router.py 无 `@limiter.limit` 装饰器
- [ ] main.py 是唯一的 rate limit 绑定位置
- [ ] `rate_limit_per_minute` 真正生效（通用端点兜底 + captcha）

## 不做的事

- 不加 trust_proxy（后续单独做）
- 不加 captcha 专用 config 字段（过度设计，用 rate_limit_per_minute 足够）
- 不改 API 路由签名
- 不删除 rate_limit_per_minute 字段（现在让它真正生效）
