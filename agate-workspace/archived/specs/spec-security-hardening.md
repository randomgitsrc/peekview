# 安全加固规格 (Security Hardening Spec)

> 来源：expert-review-v0.1.29 评审 P0 问题
> 日期：2026-05-21
> 状态：待实现

---

## P0-4: Content-Disposition 头注入修复

### 问题
`/api/v1/entries/{slug}/download` ZIP 下载端点直接使用 `entry.slug` 拼入 Content-Disposition 头，未经消毒。若 slug 含 `"`、`;`、`\r\n` 可注入额外 HTTP 头。

`/api/v1/entries/{slug}/files/{file_id}` 单文件下载端点已有 `_sanitize_filename()`（`files.py:20-30`），但 ZIP 端点未复用。

### 修复
- `backend/peekview/api/entries.py` — import `_sanitize_filename` from `files`，在 download 端点调用：
  ```python
  from peekview.api.files import _sanitize_filename
  filename = _sanitize_filename(f"{entry.slug}.zip")
  ```
- 新增测试覆盖 ZIP download 端点的注入场景

### 验收标准
- [ ] slug 含 `"`、`;`、`\r\n` 时 ZIP download 的 Content-Disposition 头已被消毒
- [ ] 正常 slug 的下载行为不受影响

---

## P0-2: 安全响应头中间件

### 问题
API 响应无安全头（CSP、X-Content-Type-Options 等），XSS/点击劫持/信息泄露无纵深防御。

### 修复
`backend/peekview/main.py` 在 CORS 中间件后添加安全头中间件，仅对 `/api` 和 `/health` 路径生效（静态文件不受影响，SPA 有自己的渲染策略）：

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

| 头 | 值 | 目的 |
|---|---|------|
| X-Content-Type-Options | nosniff | 阻止 MIME 嗅探 |
| X-Frame-Options | DENY | 阻止点击劫持 |
| Cache-Control | no-store | 私有条目不缓存 |
| Referrer-Policy | strict-origin-when-cross-origin | 限制 referrer 泄露 |
| Content-Security-Policy | default-src 'none'; frame-ancestors 'none' | API 只返回 JSON，最严格 CSP |

### 验收标准
- [ ] GET `/api/v1/entries` 响应包含全部 5 个安全头
- [ ] GET `/health` 响应包含全部 5 个安全头
- [ ] GET `/` (静态文件) 不含上述安全头
- [ ] 4xx/5xx 错误响应也包含安全头（中间件在 call_next 之后设置）

---

## P0-3: Health Check 增强

### 问题
当前 `/health` 只返回 `{"status": "ok", "version": "x.y.z"}`，不检查 DB 连通性、存储目录可写性、磁盘空间。DB 挂了仍报 ok。

### 修复
扩展 health check，检查 3 项：DB 连通性、存储目录可写、磁盘空间。始终返回 HTTP 200，降级报 `"status": "degraded"` + warnings。

#### 新配置
`PeekStorage` 类新增：
```python
health_disk_warning_mb: int = Field(default=100, description="磁盘空间低于此值(MB)时告警")
```
环境变量：`PEEKVIEW_STORAGE__HEALTH_DISK_WARNING_MB`

#### 响应格式
```json
// 正常
{"status": "ok", "version": "0.1.29", "checks": {"database": "ok", "storage": "ok", "disk_space_mb": 5432}}

// 降级（DB 异常）
{"status": "degraded", "version": "0.1.29", "checks": {"database": "error: ...", "storage": "ok", "disk_space_mb": 23}, "warnings": ["database_error", "disk_space_low"]}
```

#### 端点改动
`backend/peekview/main.py` — health_check 接收 `request: Request` 参数（为 P0-1 rate limit exempt 预置），从 `app.state.config` 和 `app.state.engine` 获取检查对象。

新增 import：`os`, `shutil`, `from sqlalchemy import text`

### 验收标准
- [ ] DB 正常时 status=ok，checks.database="ok"
- [ ] mock engine.connect() 抛异常时 status=degraded + warnings 含 database_error，HTTP 仍为 200
- [ ] disk_space_mb 为正整数
- [ ] 磁盘空间低于阈值时 warnings 含 disk_space_low

---

## P0-1: Rate Limiting

### 问题
无速率限制，暴力破解 API Key / 密码喷射无防护。`test_security.py` 已有 `TestRateLimiting` 但被 skip。

### 修复

#### 新依赖
`slowapi>=0.1.9`（`pyproject.toml` dependencies）

#### 新文件
`backend/peekview/api/rate_limit.py`：
```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
```

#### 新配置
`PeekServer` 类新增 3 个字段：

| 字段 | 默认值 | 环境变量 | 说明 |
|------|--------|---------|------|
| rate_limit_enabled | true | PEEKVIEW_SERVER__RATE_LIMIT_ENABLED | 启用速率限制 |
| rate_limit_per_minute | 60 | PEEKVIEW_SERVER__RATE_LIMIT_PER_MINUTE | 默认限制 |
| rate_limit_login_per_minute | 5 | PEEKVIEW_SERVER__RATE_LIMIT_LOGIN_PER_MINUTE | 登录限制 |

#### 限速端点
| 端点 | 限制 | 说明 |
|------|------|------|
| POST /api/v1/auth/login | 5/min | 防暴力破解 |
| POST /api/v1/auth/register | 5/min | 防批量注册 |
| 其他 /api/* | 60/min (default) | 默认限制 |
| GET /health | exempt | 不限制 |

#### main.py 集成
- 在 create_app 中配置 limiter（enabled、default_limits）
- `limiter.init_app(app)` 注册中间件
- 添加 `RateLimitExceeded` 异常处理器（返回 429 + 标准错误格式）
- health_check 添加 `@limiter.exempt`

#### auth.py 限速装饰器
- login: `@limiter.limit("5/minute")`
- register: `@limiter.limit("5/minute")`

### 验收标准
- [ ] 连续 6 次登录请求后返回 429
- [ ] /health 端点不受速率限制（大量请求仍 200）
- [ ] RATE_LIMIT_ENABLED=False 时无 429 响应
- [ ] 429 响应格式符合标准错误格式 `{error: {code, message, details}}`

---

## 实施顺序

1. P0-4 → P0-2 → P0-3 → P0-1
   （从简单到复杂：3 行改动 → 中间件 → health 增强 → 新依赖）

## 验证

```bash
cd backend && pip install -e ".[test]"
python3 -m pytest tests/test_security.py -v
python3 -m pytest tests/ -v --tb=short
make dev && curl -s http://127.0.0.1:8080/health | jq
```