# PeekView 安全修复与配置改进设计文档

## 版本
- 日期：2026-05-23
- 涉及版本：v0.1.39

---

## 1. 默认监听地址改为 0.0.0.0

### 问题
当前默认监听 `127.0.0.1`，VPS 部署时外部无法直接访问，用户必须手动设置环境变量。

### 方案
```python
# config.py
host: str = Field(
    default="0.0.0.0",  # 从 127.0.0.1 改为 0.0.0.0
    description="Server bind address (0.0.0.0 for all interfaces, 127.0.0.1 for local only)",
)
```

### 影响
- ✅ VPS 部署开箱即用
- ⚠️ 本地开发时默认暴露给局域网（Docker 场景下通常是期望的）
- ⚠️ 需要 Rate Limiting 配合（防止暴力攻击）

### 文档更新
- README.md 中的启动示例
- 部署指南中的说明
- CLI help 文本

---

## 2. P0-1 Rate Limiting（速率限制）

### 目标
防止暴力破解、DDoS 等攻击。

### 方案
使用 `slowapi>=0.1.9`（FastAPI 专用 rate limiting 库）。

#### 设计决策：limit 值通过 create_app 注入，而非装饰器硬编码

`@limiter.limit()` 是编译时装饰器，在模块加载时求值，此时 `config` 对象尚不存在，
因此**不能**在 `auth.py` 里用 `@limiter.limit(f"{config.server...}")` 的写法。

正确做法：`auth.py` 定义裸路由函数，`create_app()` 里读取 config 后动态绑定 limit。
这样职责分离——业务路由不关心限速策略，限速策略集中在基础设施层（main.py）管理。

```python
# rate_limit.py
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address, swallow_errors=True)
# swallow_errors=True：rate limiter 自身出错时不阻断请求（降级策略）
# 注意：使用内存存储，进程重启后计数清零
```

```python
# auth.py — 路由函数不加 @limiter.limit 装饰器，保持干净
@router.post("/login")
async def login(data: UserLogin, request: Request) -> AuthResponse:
    ...

@router.post("/register", status_code=201)
async def register(data: UserRegister, request: Request) -> AuthResponse:
    ...
```

```python
# main.py — create_app() 中统一配置 rate limiting
from peekview.api.rate_limit import limiter
from peekview.api.auth import login, register

# include_router 之后再绑定 limit（确保函数已挂载）
app.include_router(auth_router)

# 从 config 读取 limit 值，动态绑定到具体路由函数
login_limit = f"{config.server.rate_limit_login_per_minute}/minute"
limiter.limit(login_limit)(login)
limiter.limit(login_limit)(register)

# 全局 default limit（非认证端点）
app.state.limiter = limiter
limiter.enabled = config.server.rate_limit_enabled

@app.exception_handler(RateLimitExceeded)
async def rate_limit_exceeded_handler(request, exc):
    return JSONResponse(
        {"error": {"code": "RATE_LIMITED", "message": "请求过于频繁，请稍后再试", "details": None}},
        status_code=429,
    )

# health check 豁免（在路由定义处或此处均可）
# slowapi 会自动豁免没有绑定 limit 的路由
```

#### 为什么这样合理

1. **config 字段真正生效**：`rate_limit_login_per_minute` 改变后，重启服务即生效
2. **可测试性**：`create_app(rate_limit_login_per_minute=3)` 可在测试中传入任意值
3. **风格统一**：`limiter.enabled = config.server.rate_limit_enabled` 也在 `create_app` 集中控制
4. **职责清晰**：auth.py 只管业务，main.py 管基础设施

### 配置项
```python
# config.py
rate_limit_enabled: bool = Field(default=True)
rate_limit_per_minute: int = Field(default=60)      # 通用端点（当前未启用全局限制）
rate_limit_login_per_minute: int = Field(default=10) # login/register 专用（更严格）
```

### 反向代理注意事项

VPS 部署通常在 Nginx 后面，此时 `get_remote_address` 取到的是 Nginx IP，
所有用户共用同一个限速计数器，rate limit 等同于对整站生效。

如需在反向代理后正确限速，需信任 `X-Forwarded-For` 头：

```python
# rate_limit.py（反向代理场景）
from slowapi.util import get_remote_address

def get_real_ip(request: Request) -> str:
    """获取真实 IP，支持反向代理。仅在受信任代理后面启用。"""
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return get_remote_address(request)
```

配合配置项 `trust_proxy: bool = Field(default=False)`，在启用时才使用 `get_real_ip`。
**安全警告**：`X-Forwarded-For` 可被客户端伪造，仅在受信任的反向代理后面启用。

### 测试
```python
# test_security.py
# TestRateLimiting 类（@pytest.mark.skip 已移除）：
- create_app(rate_limit_login_per_minute=3) → 连续 4 次登录 → 第 4 次返回 429
- 验证 error.code == "RATE_LIMITED"
- health 端点不受限制（20次请求均返回200）
- rate_limit_enabled=False 时不限制
- 验证 X-RateLimit-Limit 和 X-RateLimit-Remaining 响应头
```

---

## 3. P0-2 安全头中间件

### 目标
防止 XSS、点击劫持、信息泄露等攻击。

### 方案
```python
# main.py
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    # 只对 API 和 health 端点添加安全头
    if request.url.path.startswith("/api") or request.url.path == "/health":
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Cache-Control"] = "no-store"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
    return response
```

### 设计决策
- **为什么排除静态文件**：静态文件（JS/CSS/图片）不需要这些头，且可能影响缓存
- **路径匹配**：精确匹配 `/api/*` 和 `/health`，避免误伤

### 测试
- API 响应包含全部安全头
- health 端点包含安全头
- 静态文件不含这些头

---

## 4. P0-3 Health Check 增强

### 目标
真实反映服务健康状态，便于监控和告警。

### 方案
```python
@app.get("/health")
async def health_check(request: Request):
    config = request.app.state.config
    engine = request.app.state.engine
    checks = {}
    warnings = []

    # DB 连通性
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {e}"
        warnings.append("database_error")

    # 存储目录可写性
    data_dir = config.storage.data_dir
    if data_dir.exists() and os.access(data_dir, os.W_OK):
        checks["storage"] = "ok"
    else:
        checks["storage"] = "error: data_dir not accessible"
        warnings.append("storage_error")

    # 磁盘空间
    try:
        usage = shutil.disk_usage(data_dir)
        free_mb = usage.free // (1024 * 1024)
        checks["disk_space_mb"] = free_mb
        if free_mb < config.storage.health_disk_warning_mb:
            warnings.append("disk_space_low")
    except Exception:
        checks["disk_space_mb"] = "unknown"

    status = "ok" if not warnings else "degraded"
    result = {"status": status, "version": app.version, "checks": checks}
    if warnings:
        result["warnings"] = warnings
    return result
```

### 响应示例
```json
// 健康
{
  "status": "ok",
  "version": "0.1.39",
  "checks": {
    "database": "ok",
    "storage": "ok",
    "disk_space_mb": 15420
  }
}

// 降级
{
  "status": "degraded",
  "version": "0.1.39",
  "checks": {
    "database": "error: connection refused",
    "storage": "ok",
    "disk_space_mb": 45
  },
  "warnings": ["database_error", "disk_space_low"]
}
```

### 设计决策
- **始终返回 200**：即使降级也返回 200，避免负载均衡器误判为服务不可用
- **warnings 数组**：便于监控系统解析和告警

---

## 5. P0-4 Content-Disposition 头注入修复

### 问题
`entries.py` 下载 ZIP 端点直接使用用户可控的 filename 构造 HTTP 头，存在头注入风险。

### 方案
```python
# entries.py
from peekview.api.files import _sanitize_filename

@router.get("/{slug}/download")
async def download_entry(slug: str, ...):
    entry = ...
    # 修复：使用 sanitize（实际位置：entries.py:269）
    filename = _sanitize_filename(f"{entry.slug}.zip")
    response.headers["Content-Disposition"] = f'attachment; filename="{filename}"'
    ...
```

### 现有 `_sanitize_filename` 实现
```python
# files.py:20-30
# 已存在，过滤特殊字符和路径遍历
def _sanitize_filename(filename: str) -> str:
    # 过滤路径分隔符和特殊字符
    filename = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '', filename)
    # 防止路径遍历
    filename = os.path.basename(filename)
    return filename or "unnamed"
```

### 测试
```python
# test_security.py
async def test_download_zip_filename_sanitization(client):
    # 测试注入字符被过滤
    # 测试路径遍历被阻止
    # 测试空文件名默认处理
```

---

## 实施顺序（调整后）

1. **#209** - 默认监听地址改为 0.0.0.0（单行改动，影响部署体验，先做）
2. **P0-4** - Content-Disposition 头注入修复（3 行改动，零依赖）
3. **P0-2** - 安全头中间件（纯中间件，零依赖）
4. **P0-3** - Health Check 增强（零依赖，为 P0-1 预置 request 参数）
5. **P0-1** - Rate Limiting（新依赖 slowapi，最复杂）

**调整理由**：#209 是单行配置改动，先做可以减少后续测试时的环境变量设置。

---

## 依赖

```toml
# pyproject.toml
# slowapi 作为主依赖（rate limiting 默认启用）
dependencies = [
    ...
    "slowapi>=0.1.9",
]
```

---

## 测试策略

每个修复都包含：
1. 单元测试验证修复生效
2. 回归测试确保无破坏
3. E2E 测试验证端到端

---

## 回滚策略

- **监听地址**：用户可通过 `PEEKVIEW_SERVER__HOST=127.0.0.1` 恢复旧行为
- **Rate Limiting**：`PEEKVIEW_SERVER__RATE_LIMIT_ENABLED=false` 关闭
- **安全头**：无法单独关闭（设计决策：安全头应该始终启用）

---

## 附录：代码位置验证

已验证的实际代码位置：
- `entries.py:269` - Content-Disposition 头构造
- `test_security.py:682` - 现有 TestRateLimiting 类（带 @pytest.mark.skip）
