# Security Hardening Spec 评审

> 评审框架：gstack review（Staff Engineer + /cso 安全官）
> 日期：2026-05-23
> 评审对象：`docs/specs/spec-security-hardening-20260523.md`
> 参考：当前实现（`main.py`、`auth.py`、`config.py`、`rate_limit.py`、`test_security.py`）

---

## 现状梳理

spec 涵盖 5 项修复：

| 项目 | Spec 状态 | 实现状态 |
|------|-----------|---------|
| #209 默认监听地址 0.0.0.0 | 已设计 | ❌ 未实现（`config.py` 仍是 127.0.0.1） |
| P0-4 Content-Disposition 注入 | 已设计 | ✅ 已实现（entries.py:265+_sanitize_filename） |
| P0-2 安全头中间件 | 已设计 | ✅ 已实现（main.py:115） |
| P0-3 Health Check 增强 | 已设计 | ✅ 已实现（main.py:213-250） |
| P0-1 Rate Limiting | 已设计 | ✅ 已实现（slowapi，auth.py 装饰器） |

**结论：4/5 已实现，剩余 #209（默认监听地址）未实现。**

---

## Spec 本身的问题

### 🔴 P0 — 设计错误，实现后行为不符预期

#### P0-1 Rate Limiting 的 `@limiter.limit` 应从 config 读取，spec 和实现都用了硬编码

**Spec 写法（伪代码）：**
```python
@limiter.limit(f"{config.server.rate_limit_login_per_minute}/minute")
```

**实际实现（auth.py:36, 105）：**
```python
@limiter.limit("10/minute")
```

两处都有问题：
- Spec 的写法在技术上不可行——`@limiter.limit()` 是编译时装饰器，函数参数里的 `config` 在装饰器求值时还不存在
- 实际实现改为硬编码 `"10/minute"`，但 spec 声明了 `rate_limit_login_per_minute` 配置项（默认 `5`），用户无法通过配置改变 login 限速，配置项形同虚设
- Spec 里 `rate_limit_login_per_minute` 默认值是 `5`，实现里是 `10`，两者不一致

**正确方案：** 装饰器的 limit 字符串必须在模块加载时确定。要让 limit 可配置，有两种方式：

**方案 A（推荐）**：在启动时动态注册，不用装饰器：
```python
# main.py 里，create_app 时
@router.post("/login")
async def login(...):
    ...

# 在 create_app 中
limiter.limit(f"{config.server.rate_limit_login_per_minute}/minute")(
    auth_router.routes_by_name["login"].endpoint
)
```

**方案 B（简单）**：固定 limit 值，从 Config 里去掉 `rate_limit_login_per_minute` 字段，避免误导用户以为可以配置：
```python
@limiter.limit("10/minute")  # 固定值，文档说明
```

**决策应在 spec 里明确**：到底要不要运行时可配置？不同选择影响实现方式。

---

#### P0-2 安全头 `Content-Security-Policy` 与前端静态资源冲突

**Spec 设计：**
```
只对 /api/* 和 /health 添加安全头
```

**实现（main.py:117）：**
```python
if request.url.path.startswith("/api") or request.url.path == "/health":
    response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
```

这是 API 专用的 CSP，当用户直接访问 PeekView 前端时（静态资源），不会有 CSP 头——**这是正确的**，前端资源的 CSP 需要另行设计（允许 JS/CSS/字体等）。

**但问题在于：** `default-src 'none'` 作为 API 响应头是正确的，因为 API 返回 JSON，不加载任何资源。然而 spec 里没有说明"前端页面将来是否需要 CSP"。如果将来有人为前端也加 CSP（比如防止 XSS 渲染 Markdown），可能会和这里的逻辑混淆。

**建议在 spec 里明确：**
> API 端点的 CSP（`default-src 'none'`）只适用于 JSON 响应，不影响前端页面渲染。前端页面的 CSP 属于独立的安全议题，需单独设计（需允许 inline scripts 给 Shiki、允许 blob: 给 HtmlViewer）。

---

### 🟠 P1 — 实现与 Spec 不一致

#### P1-1 Error code 不一致：spec 写 `RATE_LIMIT_EXCEEDED`，实现是 `RATE_LIMITED`

**Spec（第 2 节）：**
```json
{"error": {"code": "RATE_LIMIT_EXCEEDED", ...}}
```

**实现（main.py:195）：**
```python
content={"error": {"code": "RATE_LIMITED", ...}}
```

**测试（test_security.py:701）：**
```python
assert data["error"]["code"] == "RATE_LIMITED"
```

测试和实现一致，但和 spec 不一致。选择一个，更新另一个。建议保留 `RATE_LIMITED`（更简洁），更新 spec。

---

#### P1-2 Health Check 状态码设计决策有争议，未在 spec 里说明理由

**Spec 设计决策：**
> 始终返回 200：即使降级也返回 200，避免负载均衡器误判为服务不可用

**当前实现：** 确实始终返回 200（FastAPI 默认），`status` 字段用 `"degraded"` 表示。

**问题：** 这个决策是有争议的设计选择，spec 只给了一个理由（"避免负载均衡器误判"），但这个理由本身存在问题：

- 标准做法是降级返回 503，让负载均衡器把流量切走——这才是 503 的语义
- "避免误判"的背后假设是"服务降级时仍可提供部分服务"，但对于 DB 不可达的 PeekView，所有写操作都会失败，"部分服务"的价值有限
- 监控系统解析 JSON body 里的 `status: "degraded"` 远不如 HTTP 503 直接

**建议：** spec 里补充完整的决策分析，或改为：
- DB 错误 → 503（服务不可用）
- 存储错误 → 503
- 磁盘空间低 → 200 + warnings（服务仍可用，只是预警）

---

#### P1-3 `#209` 默认监听地址未实现，spec 写的是"已完成"状态

Spec 第 1 节是该项的完整设计，但 `config.py:133` 仍是：
```python
host: str = Field(default="127.0.0.1", ...)
```

这是 spec 还未落地的部分，不是评审问题，而是**提醒：这是唯一未实现的项**，需要在 v0.1.39 里完成。

**实施注意事项（spec 未提及）：**
- `0.0.0.0` 是破坏性变更：本地开发者的服务将暴露给局域网
- 应在 CHANGELOG 里明确标注 breaking change
- CLI help 文本需同步更新：`--host` 参数的说明从"默认 127.0.0.1"改为"默认 0.0.0.0（所有网卡），使用 127.0.0.1 仅限本地访问"

---

### 🟡 P2 — 细节和完整性

#### P2-1 测试策略：`TestRateLimiting` 的 `@pytest.mark.skip` 已移除，但 spec 仍说"移除现有 skip"

Spec 第 2 节：
> 移除现有 TestRateLimiting 的 @pytest.mark.skip（第682行附近）

查看实现，`TestRateLimiting` 确实没有 `@pytest.mark.skip`——已经移除了。但 spec 里这句话描述的是"待做事项"，没有更新为"已完成"状态，会让读者困惑。

#### P2-2 Rate limiting 对 proxy 后部署的 IP 获取不准确

`rate_limit.py` 用 `get_remote_address`（slowapi 默认），直接取 `request.client.host`。

在 Nginx/Cloudflare 等反向代理后面部署时，`request.client.host` 是代理服务器的 IP，所有用户共享同一个"IP"，rate limit 会对整个站点生效而非单个用户。

**Spec 没有提到这个问题。** 建议补充：
```python
# rate_limit.py
from slowapi.util import get_remote_address

def get_real_ip(request: Request) -> str:
    """获取真实 IP，支持反向代理场景。"""
    # 优先取 X-Forwarded-For（Nginx/Cloudflare 设置）
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # 取第一个 IP（最原始的客户端 IP）
        return forwarded_for.split(",")[0].strip()
    return get_remote_address(request)

limiter = Limiter(key_func=get_real_ip, swallow_errors=True)
```

**安全注意**：只有在受信任的代理后面才能信任 `X-Forwarded-For`，否则客户端可以伪造。建议加配置项 `trust_proxy: bool = Field(default=False)`。

#### P2-3 `swallow_errors=True` 隐患未在 spec 中说明

`rate_limit.py:7`：
```python
limiter = Limiter(key_func=get_remote_address, swallow_errors=True)
```

`swallow_errors=True` 的含义是：如果 rate limiter 本身出错（如存储后端异常），不抛异常，允许请求通过。这是正确的降级策略（rate limiter 出错不应影响正常服务），但 spec 没有说明这个选择，也没有说明"当前使用内存存储，重启后计数清零"的局限。

建议在 spec 里记录：
> Rate limiter 使用内存存储（进程级别），服务重启后计数重置。重启频繁的场景（如 Docker 容器频繁重启）会降低限速效果。如需持久化，可配置 Redis 作为 slowapi 后端（当前不需要，记录为未来升级路径）。

---

## 安全评估（/cso 视角）

### 修复覆盖的威胁

| 威胁 | 修复项 | 有效性 |
|------|--------|--------|
| 暴力破解登录 | Rate limiting (10/min) | ✅ 有效，但 proxy 后失效（P2-2） |
| 点击劫持 | X-Frame-Options: DENY | ✅ 有效 |
| XSS 内容嗅探 | X-Content-Type-Options: nosniff | ✅ 有效 |
| API 响应缓存泄露 | Cache-Control: no-store | ✅ 有效 |
| 引用头信息泄露 | Referrer-Policy | ✅ 有效 |
| API 响应 XSS | CSP: default-src 'none' | ✅ 对 JSON 响应有效 |
| 文件名头注入 | _sanitize_filename | ✅ 有效 |
| 服务可观测性 | Health check 增强 | ✅ 有效 |
| **已知缺口** | | |
| 局域网暴露（默认 0.0.0.0） | #209 未实现 | ⬜ 待完成 |
| 前端页面 XSS | 未在本 spec 覆盖 | ❌ 未覆盖（Markdown 渲染等） |
| JWT secret 轮换 | 未在本 spec 覆盖 | ❌ 未覆盖 |

### 未覆盖的安全点（记录为后续议题）

1. **前端 CSP**：HtmlViewer（iframe sandbox）、MarkdownViewer（sanitize-html）的 XSS 防护，应该有专项 spec
2. **JWT secret**：当前 JWT secret 是否有轮换机制？secret 泄露后如何失效所有 token？
3. **SSRF**：如果将来支持 URL 导入（agent 提交远程 URL），需要 SSRF 防护
4. **文件上传限制**：当前有 `PayloadTooLargeError`，但对文件类型有无校验？

---

## 总结

### 评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 覆盖范围 | 8/10 | 覆盖了最重要的 5 个安全点 |
| 设计正确性 | 7/10 | Health check 200 vs 503 有争议；rate limit 可配置设计不可行 |
| 实现与 Spec 一致性 | 6/10 | error code 不一致；#209 未实现；rate limit 硬编码 |
| 测试策略 | 7/10 | 主要场景覆盖，但 proxy 场景未测 |

**综合：7/10**

### 最优先的三件事

1. **决策 P0-1**（rate limit 可配置方案）：spec 和实现目前都是半途而废——配置项有但不生效，装饰器硬编码。需要选定方案 A（动态注册）或方案 B（固定值+去掉配置项），然后 spec 和实现同步。

2. **完成 #209**（默认监听地址）：这是唯一未实现的项，是影响 VPS 部署体验的直接改动。注意在 CHANGELOG 和 CLI help 同步更新。

3. **补充 P2-2**（proxy 后的 IP 获取）：VPS 部署通常会在 Nginx 后面，当前实现的 rate limit 在代理后完全失效。spec 应该明确支持或不支持 proxy 场景，并给出配置指引。

---

*评审完成：2026-05-23*
