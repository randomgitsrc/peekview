# PeekView 远程 CLI 技术设计文档

> 版本: 1.0
> 日期: 2026-05-16
> 状态: 草案
> 关联: 场景2 — 多机分布式 CLI → 集中式服务端

---

## 1. 需求背景

### 1.1 场景1（已支持）

机器 A 同时作为服务端和客户端：
```
机器 A (pipx install peekview)
├── peekview serve --base-url domain_a.com     # 服务端
└── peekview create file.txt -s "My code"      # 客户端（直连本地 SQLite）
```

- `create/get/list/delete` 直接操作本地 SQLite 和文件系统
- 适用：单机使用，服务端和客户端同机

### 1.2 场景2（待实现）

机器 A 作为服务端，机器 B/C/D 作为远程客户端：
```
机器 A (pipx install peekview)
└── peekview serve --base-url domain_a.com    # 仅服务端

机器 B (pipx install peekview)
└── peekview create file.txt -s "My code"      # 客户端 → HTTP POST 到机器 A

机器 C (pipx install peekview)
└── peekview get my-entry                        # 客户端 → HTTP GET 到机器 A
```

- `create/get/list/delete` 通过 HTTP 调用远程服务端 API
- 适用：团队共用一台服务端，或本地开发推送至远程展示

---

## 2. 设计目标

| 目标 | 说明 |
|------|------|
| **透明切换** | 用户无感知切换本地/远程模式，命令语法完全一致 |
| **零服务端改动** | 复用现有 FastAPI 端点，服务端无需任何修改 |
| **配置驱动** | 通过 `remote.url` 配置项自动启用远程模式 |
| **安全默认** | 远程模式强制 API Key 认证提示（服务端启用 key 时） |
| **降级可用** | 网络异常时给出清晰错误，不静默失败 |

---

## 3. 技术方案

### 3.1 架构图

```
┌─────────────────┐     HTTP/JSON      ┌─────────────────┐
│   机器 B (CLI)   │ ────────────────▶ │   机器 A (API)   │
│                 │    Authorization   │                 │
│  ┌───────────┐  │    Bearer xxx      │  ┌───────────┐  │
│  │  CLI cmd  │  │                    │  │ FastAPI   │  │
│  │  create   │  │                    │  │ /api/v1/* │  │
│  └─────┬─────┘  │                    │  └─────┬─────┘  │
│        │        │                    │        │        │
│  ┌─────▼─────┐  │                    │  ┌─────▼─────┐  │
│  │ PeekClient│  │  ────────────────▶ │  │EntryService│  │
│  │ (HTTP)    │  │                    │  │ (本地)     │  │
│  └───────────┘  │                    │  └───────────┘  │
└─────────────────┘                    └─────────────────┘
```

### 3.2 模式判定逻辑

```python
def get_backend(config, cli_remote_url: str | None = None):
    """统一入口：返回本地 EntryService 或远程 PeekClient"""

    # 优先级1: CLI 参数 --remote-url（空字符串表示显式禁用远程）
    if cli_remote_url is not None:
        remote_url = cli_remote_url
    else:
        # 优先级2: 环境变量 PEEKVIEW_REMOTE__URL
        # 优先级3: 配置文件 remote.url
        remote_url = os.environ.get("PEEKVIEW_REMOTE__URL") or config.remote.url

    # 空字符串视为禁用远程，回退本地模式
    if remote_url:
        return PeekClient(
            base_url=remote_url,
            api_key=config.remote.api_key,
            timeout=config.remote.timeout,
        )

    # 本地模式（当前行为）
    engine = init_db(config.db_path)
    storage = StorageManager(config=config)
    return EntryService(engine=engine, storage=storage, config=config)
```

---

## 4. 配置设计

### 4.1 新增配置组 `PeekRemote`

```python
class PeekRemote(BaseSettings):
    """Remote CLI client configuration."""

    url: str = Field(
        default="",
        description="Remote server base URL (e.g., https://domain_a.com)",
    )
    api_key: str = Field(
        default="",
        description="API key for remote authentication",
    )
    timeout: int = Field(
        default=30,
        description="HTTP request timeout in seconds",
    )
    verify_ssl: bool = Field(
        default=True,
        description="Verify SSL certificates",
    )
```

### 4.2 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PEEKVIEW_REMOTE__URL` | `""` | 远程服务端地址 |
| `PEEKVIEW_REMOTE__API_KEY` | `""` | API 认证密钥 |
| `PEEKVIEW_REMOTE__TIMEOUT` | `30` | 请求超时秒数 |
| `PEEKVIEW_REMOTE__VERIFY_SSL` | `true` | SSL 证书校验 |

### 4.3 配置文件示例

```yaml
# ~/.peekview/config.yaml (机器 B)
server:
  host: 127.0.0.1
  port: 8080
remote:
  url: https://domain_a.com
  api_key: sk-xxxxxxxxxxxxxxxx
  timeout: 30
  verify_ssl: true
```

---

## 5. 接口设计

### 5.1 `PeekClient` 类

新建文件：`peekview/client.py`

```python
from collections import namedtuple
from datetime import datetime

RemoteEntry = namedtuple(
    "RemoteEntry",
    ["id", "slug", "url", "summary", "status", "tags", "files", "expires_at", "created_at", "updated_at"]
)

RemoteFile = namedtuple(
    "RemoteFile",
    ["id", "path", "filename", "language", "is_binary", "size", "line_count"]
)


class PeekClient:
    """HTTP client for remote PeekView server.

    Mirrors EntryService interface, returns RemoteEntry/RemoteFile
    namedtuples for attribute-compatible access with SQLModel objects.
    """

    def __init__(self, base_url: str, api_key: str = "", timeout: int = 30, verify_ssl: bool = True):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.verify = verify_ssl
        self.headers = {}
        if api_key:
            self.headers["Authorization"] = f"Bearer {api_key}"

    def _parse_entry(self, data: dict) -> RemoteEntry:
        """Convert API JSON dict to RemoteEntry."""
        # 健壯性：检查必要字段
        slug = data.get("slug", "")
        if not slug:
            raise ValueError("Invalid API response: missing 'slug' field")

        files = [
            RemoteFile(
                id=f.get("id"),
                path=f.get("path"),
                filename=f.get("filename", ""),
                language=f.get("language"),
                is_binary=f.get("is_binary", False),
                size=f.get("size", 0),
                line_count=f.get("line_count"),
            )
            for f in data.get("files", [])
        ]

        def _parse_dt(key: str) -> datetime | None:
            v = data.get(key)
            return datetime.fromisoformat(v) if v else None

        # 优先使用服务端返回的 url，回退到客户端构造
        url = data.get("url") or f"{self.base_url}/{slug}"

        return RemoteEntry(
            id=data.get("id"),
            slug=slug,
            url=url,
            summary=data.get("summary", ""),
            status=data.get("status", "active"),
            tags=data.get("tags", []),
            files=files,
            expires_at=_parse_dt("expires_at"),
            created_at=_parse_dt("created_at"),
            updated_at=_parse_dt("updated_at"),
        )

    # -- entries --
    def create_entry(self, summary, slug, tags, files_data, dirs_data, expires_in):
        """POST /api/v1/entries — 返回 RemoteEntry."""
        payload = {
            "summary": summary,
            "slug": slug,
            "tags": tags or [],
            "files": files_data or [],
            "dirs": dirs_data or [],
            "expires_in": expires_in,
        }
        resp = requests.post(
            f"{self.base_url}/api/v1/entries",
            json=payload,
            headers=self.headers,
            timeout=self.timeout,
            verify=self.verify,
        )
        resp.raise_for_status()
        return self._parse_entry(resp.json())

    def list_entries(self, q=None, tags=None, status=None, page=1, per_page=20):
        """GET /api/v1/entries — 返回 dict（含 items/pagination）。"""
        params = {}
        if q:
            params["q"] = q
        if tags:
            params["tags"] = ",".join(tags)
        if status:
            params["status"] = status
        params["page"] = page
        params["per_page"] = per_page

        resp = requests.get(
            f"{self.base_url}/api/v1/entries",
            params=params,
            headers=self.headers,
            timeout=self.timeout,
            verify=self.verify,
        )
        resp.raise_for_status()
        return resp.json()

    def get_entry(self, slug):
        """GET /api/v1/entries/{slug} — 返回 RemoteEntry."""
        resp = requests.get(
            f"{self.base_url}/api/v1/entries/{slug}",
            headers=self.headers,
            timeout=self.timeout,
            verify=self.verify,
        )
        resp.raise_for_status()
        return self._parse_entry(resp.json())

    def delete_entry(self, slug):
        """DELETE /api/v1/entries/{slug}."""
        resp = requests.delete(
            f"{self.base_url}/api/v1/entries/{slug}",
            headers=self.headers,
            timeout=self.timeout,
            verify=self.verify,
        )
        resp.raise_for_status()
        return {"ok": True}
```

**说明**：`update_entry` 暂不实现（CLI 无 `update` 命令）。

**API 响应格式**：服务端通过 Pydantic 序列化：
- `EntryResponse`：包含 `id`, `slug`, `summary`, `status`, `tags`, `files`, `expires_at`, `created_at`, `updated_at`
- `EntryListResponse`：包含 `items` (EntryListItem 列表), `total`, `page`, `per_page`
- `FileResponse`：包含 `id`, `path`, `filename`, `language`, `is_binary`, `size`, `line_count`

### 5.2 返回值适配

远程 API 返回 JSON dict，本地 `EntryService` 返回 SQLModel 对象。`PeekClient._parse_entry()` 将 JSON 转换为 `RemoteEntry` namedtuple，属性访问方式与 SQLModel 对象一致：

```python
# CLI 命令中统一使用属性访问，无需区分本地/远程
result = backend.create_entry(...)

click.echo(f"✓ Created entry: {result.slug}")
click.echo(f"  URL: {result.url}")
click.echo(f"  Files: {len(result.files)}")
for f in result.files:
    click.echo(f"    - {f.path or f.filename}")
```

**RemoteEntry 字段**：`id`, `slug`, `url`, `summary`, `status`, `tags`, `files`, `expires_at`, `created_at`, `updated_at`
**RemoteFile 字段**：`id`, `path`, `filename`, `language`, `is_binary`, `size`, `line_count`

**关键区别**：`RemoteEntry.url` 优先使用服务端返回的 URL，回退到客户端构造（`base_url + slug`）。

---

## 6. CLI 命令变更

### 6.1 新增全局选项

```bash
peekview create file.txt -s "My code" --remote-url https://domain_a.com
peekview list --remote-url https://domain_a.com
peekview get my-entry --remote-url https://domain_a.com
```

### 6.2 扩展 `config` 子命令支持 remote 配置

> CLI 已有 `config` 命令（支持 `base_url`），需扩展支持 `remote` 配置。

```bash
# 设置远程服务端
peekview config set remote.url https://domain_a.com
peekview config set remote.api_key sk-xxx
peekview config set remote.timeout 60

# 查看配置
peekview config get remote.url
peekview config list
```

**实现说明**：扩展 `config_set()` 的 `supported_keys` 列表，增加 `remote.url`, `remote.api_key`, `remote.timeout`，写入 `config.yaml` 的 `remote` 层级。

### 6.3 远程模式提示

启用远程模式时，CLI 输出提示：
```
→ Remote mode: https://domain_a.com
✓ Created entry: abc123
  URL: https://domain_a.com/abc123
```

---

## 7. 文件上传处理

### 7.1 内容上传（主要方式）

机器 B 读取本地文件 → 文本编码 → JSON `content` 字段 → HTTP POST：

```python
# CLI 读取本地文件
content = Path("src/main.py").read_text(encoding="utf-8")

# HTTP payload
{
  "summary": "My code",
  "files": [
    {"path": "src/main.py", "filename": "main.py", "content": "..."}
  ]
}
```

### 7.2 目录扫描

**本地模式**：直接传递 `dirs_data` 给 `EntryService`，由服务端扫描。

**远程模式**：CLI 层完成目录扫描，结果展开为 `files[]` 上传（保留相对路径）：

```python
def scan_directory_local(base_path: Path, ignored_dirs: set[str]) -> list[dict]:
    """递归扫描目录，返回 files_data 列表。"""
    files_data = []
    for root, dirs, filenames in os.walk(base_path):
        # 跳过忽略的目录
        dirs[:] = [d for d in dirs if d not in ignored_dirs]

        for name in filenames:
            file_path = Path(root) / name
            try:
                content = file_path.read_text(encoding="utf-8", errors="replace")
                rel_path = file_path.relative_to(base_path)
                files_data.append({
                    "path": str(rel_path),
                    "filename": name,
                    "content": content,
                })
            except UnicodeDecodeError:
                # 二进制文件跳过
                click.echo(f"Warning: Skipping binary file: {rel_path}", err=True)
    return files_data


# CLI 层使用
if remote_mode and path.is_dir():
    # 远程模式：CLI 层展开目录
    files_data.extend(scan_directory_local(path, config.ignored_dirs))
else:
    # 本地模式：传递 dirs_data 给服务端
    dirs_data.append({"path": str(path.resolve())})
```

**限制**：
- 忽略 `.git`, `__pycache__`, `node_modules` 等目录（复用 `config.ignored_dirs`）
- 远程模式下目录扫描结果作为普通文件上传，不再保留 `dirs` 字段

### 7.3 `local_path` 禁用

远程模式下 `local_path` 字段禁用（文件在机器 B，服务端机器 A 无法访问）：

```python
if remote_mode and any(f.get("local_path") for f in files_data):
    raise click.UsageError("--local-path is not supported in remote mode")
```

### 7.4 大文件与二进制限制

| 限制项 | 本地模式 | 远程模式 |
|--------|----------|----------|
| 单文件大小 | `limits.max_file_size` (10MB) | 同上（服务端校验） |
| 上传方式 | 直接写入磁盘 | HTTP JSON payload |
| 二进制文件 | 支持 | **v1 暂不支持**（仅文本文件） |

**v1 远程模式明确限制**：仅支持文本文件上传。遇到二进制文件时：
- CLI 检测非 UTF-8 编码文件
- 报错退出：`Error: Binary file not supported in remote mode: {path}`
- 避免用户误以为上传成功

---

## 8. 安全设计

### 8.1 API Key 传递

```python
headers = {}
if api_key:
    headers["Authorization"] = f"Bearer {api_key}"
```

- 仅 HTTPS 环境下传输（`verify_ssl=True` 默认开启）
- CLI 报错提示：若服务端返回 401/403，提示检查 `remote.api_key`

### 8.2 SSL 校验

```python
if url.startswith("https://") and not verify_ssl:
    import urllib3
    urllib3.disable_warnings()
    click.echo("⚠ SSL verification disabled", err=True)
```

### 8.3 敏感信息保护

- `api_key` 不打印在日志中
- `config.yaml` 权限建议 `0o600`

---

## 9. 错误处理

### 9.1 HTTP 状态码映射

| 状态码 | 场景 | 远程模式处理 |
|--------|------|-------------|
| 200 | 成功 | 正常返回 |
| 201 | 创建成功 | 正常返回（`create_entry`） |
| 400 | 请求参数错误 | 显示服务端返回的错误消息 |
| 401 | API Key 无效或缺失 | `Authentication failed: check remote.api_key` |
| 403 | 权限不足 | `Permission denied` |
| 404 | 条目不存在 | `Entry not found: {slug}` |
| 409 | slug 已存在 | `Entry already exists: {slug}` |
| 413 | 文件过大 | `File too large: exceeds {max_size}` |
| 422 | 参数校验失败 | 显示详细校验错误 |
| 429 | 请求过于频繁 | `Rate limited: please retry later` |
| 500+ | 服务端错误 | `Server error ({code}): please check server logs` |

### 9.2 网络层错误

| 场景 | 本地模式 | 远程模式错误 |
|------|----------|-------------|
| 连接失败 | — | `ConnectionError: Cannot connect to https://domain_a.com` |
| DNS 解析失败 | — | `DNS resolution failed: domain_a.com` |
| SSL 证书错误 | — | `SSL verification failed (use --verify-ssl=false to skip)` |
| 超时 | — | `Timeout: Request exceeded {timeout}s` |
| 网络中断 | — | `Network error: connection reset` |

---

## 10. 测试策略

### 10.1 单元测试

- `test_client.py` — `PeekClient` 方法调用正确性（mock requests）
- `test_cli_remote.py` — CLI 远程模式参数解析和模式切换

### 10.2 集成测试

- 启动本地服务端 → CLI 通过 `http://localhost:8888` 远程调用
- 验证 `create/list/get/delete` 全链路

### 10.3 测试矩阵

| 测试项 | 本地模式 | 远程模式（有 key） | 远程模式（无 key） |
|--------|----------|-------------------|-------------------|
| create | ✅ | ✅ | ✅/❌ (401) |
| list | ✅ | ✅ | ✅ |
| get | ✅ | ✅ | ✅ |
| delete | ✅ | ✅ | ❌ (403) |
| local_path | ✅ | ❌ (报错) | — |
| 目录扫描 | ✅ | ✅ | ✅ |
| 二进制文件 | ✅ | ❌ (报错) | — |

### 10.4 边界测试

| 场景 | 测试内容 |
|------|----------|
| **离线模式** | 断开网络后 `create`，验证 `ConnectionError` 提示清晰 |
| **大文件** | 上传 10MB+ 文件，验证服务端返回 413 / 客户端提前拒绝 |
| **并发冲突** | 两个客户端同时 `create` 相同 slug，验证 409 冲突处理 |
| **超时** | 模拟慢网络，验证 `requests.Timeout` 被捕获并友好提示 |
| **SSL 错误** | 自签名证书 + `verify_ssl=false`，验证警告输出 |
| **空 remote.url** | `PEEKVIEW_REMOTE__URL=""` 显式设置，验证回退本地模式 |

---

## 11. 实现计划

| 任务 | 文件 | 说明 |
|------|------|------|
| T1 | `config.py` | 增加 `PeekRemote` 配置组 |
| T2 | `client.py` | 新建 `PeekClient` HTTP 客户端 |
| T3 | `cli.py` | 修改 `create/get/list/delete`，统一 `_get_backend()` 入口 |
| T4 | `test_client.py` | 客户端单元测试 |
| T5 | `test_cli_remote.py` | CLI 远程模式集成测试 |
| T6 | `README.md` | 更新文档：远程 CLI 使用说明 |

---

## 12. 兼容性

- **服务端**: 无需任何改动（复用现有 API）
- **CLI 本地模式**: 行为完全一致（无 breaking change）
- **配置**: 新增 `remote` 组，旧配置文件无冲突
