# 实现计划：P0 安全修复（4 项）

> 来源规格：docs/specs/spec-security-hardening.md
> 日期：2026-05-21

---

## Step 1: P0-4 Content-Disposition 头注入修复

已有 `_sanitize_filename()` 在 `backend/peekview/api/files.py:20-30`，但 `entries.py` 下载 ZIP 端点未使用。

**修改：**
- `backend/peekview/api/entries.py` — import `_sanitize_filename` 并在 line 264 调用：
  ```python
  from peekview.api.files import _sanitize_filename
  filename = _sanitize_filename(f"{entry.slug}.zip")
  ```
- `backend/tests/test_security.py` — 在 `TestFilenameSanitization` 类中新增 ZIP download 端点注入测试

---

## Step 2: P0-2 安全头中间件

`main.py` CORS 中间件（line 103）之后添加安全头中间件，仅对 `/api` 和 `/health` 路径生效：

```python
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/api") or request.url.path == "/health":
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Cache-Control"] = "no-store"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
    return response
```

**测试：** `TestSecurityHeaders` 类 — API/health 含安全头，静态文件不含。

---

## Step 3: P0-3 Health Check 增强

扩展 `/health` 检查 DB + 存储 + 磁盘。始终 200，降级报 `"degraded"`。

**config.py — `PeekStorage` 新增：**
```python
health_disk_warning_mb: int = Field(default=100)
```

**main.py — health_check 替换（line 176-179）：**
- 接收 `request: Request`（为 P0-1 预置）
- DB: `engine.connect()` + `text("SELECT 1")`
- 存储: `data_dir.exists()` + `os.access(W_OK)`
- 磁盘: `shutil.disk_usage(data_dir)`
- 新增 import: `os`, `shutil`, `from sqlalchemy import text`

**测试：** `TestHealthCheck` — ok/degraded/disk_space_mb

---

## Step 4: P0-1 Rate Limiting (slowapi)

**新依赖：** `slowapi>=0.1.9`

**新文件：** `backend/peekview/api/rate_limit.py`
```python
from slowapi import Limiter
from slowapi.util import get_remote_address
limiter = Limiter(key_func=get_remote_address)
```

**config.py — `PeekServer` 新增：**
| 字段 | 默认 | 环境变量 |
|------|------|---------|
| rate_limit_enabled | true | PEEKVIEW_SERVER__RATE_LIMIT_ENABLED |
| rate_limit_per_minute | 60 | PEEKVIEW_SERVER__RATE_LIMIT_PER_MINUTE |
| rate_limit_login_per_minute | 5 | PEEKVIEW_SERVER__RATE_LIMIT_LOGIN_PER_MINUTE |

**main.py：** limiter 配置 + `RateLimitExceeded` 异常处理器 + health `@limiter.exempt`

**auth.py：** login `@limiter.limit("5/minute")` + register `@limiter.limit("5/minute")`

**测试：** 移除 skip，重写 `TestRateLimiting`（6 次 login → 429，health exempt，disabled 无限制）

---

## 实施顺序

1 → 2 → 3 → 4（从简单到复杂）

## 验证

```bash
cd backend && pip install -e ".[test]"
python3 -m pytest tests/test_security.py -v
python3 -m pytest tests/ -v --tb=short
```