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

```python
# rate_limit.py
from slowapi import Limiter
from slowapi.util import get_remote_address
limiter = Limiter(key_func=get_remote_address)

# main.py
from slowapi.errors import RateLimitExceeded
from peekview.api.rate_limit import limiter

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request, exc):
    return JSONResponse(
        {"error": {"code": "RATE_LIMIT_EXCEEDED", "message": "请求过于频繁，请稍后再试"}},
        status_code=429
    )

# 在 create_app 中
limiter.enabled = config.server.rate_limit_enabled
limiter.default_limits = [f"{config.server.rate_limit_per_minute}/minute"]
limiter.init_app(app)

# auth.py
@app.post("/auth/login")
@limiter.limit(f"{config.server.rate_limit_login_per_minute}/minute")  # 从配置读取
async def login(...):
    ...

@app.post("/auth/register")
@limiter.limit(f"{config.server.rate_limit_login_per_minute}/minute")
async def register(...):
    ...

# health check 豁免
@app.get("/health")
@limiter.exempt
async def health_check(...):
    ...
```

### 配置项
```python
# config.py
rate_limit_enabled: bool = Field(default=True)
rate_limit_per_minute: int = Field(default=60)
rate_limit_login_per_minute: int = Field(default=5)
```

### 测试
```python
# test_security.py - 移除现有 TestRateLimiting 的 @pytest.mark.skip（第682行附近）
# 重写测试：
- 连续 6 次登录请求 → 第 6 次返回 429
- health 端点不受限制
- RATE_LIMIT_ENABLED=False 时不限制
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
