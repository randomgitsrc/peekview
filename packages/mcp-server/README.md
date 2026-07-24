# PeekView MCP Server

PeekView 的 MCP 桥接层 — 让 Agent 通过 Model Context Protocol 调用 PeekView。Streamable HTTP transport，多用户认证。

PeekView：Agent 写，人看，Agent 也能读。MCP Server 负责其中的「Agent 发布」环节。

## 核心概念：Dual Mode

MCP Server 根据部署拓扑提供不同工具集：

| 模式 | 拓扑 | 暴露工具 | 适用场景 |
|------|------|----------|----------|
| `remote`（默认） | Agent → MCP Server → PeekView | `create_entry`, `get_entry`, `list_entries`, `delete_entry` | MCP Server 不能读取 Agent 本地文件，只发布 Agent 生成内容 |
| `local` | Agent + MCP Server → PeekView | `publish_files`, `get_entry`, `list_entries`, `delete_entry` | MCP Server 与文件同机，直接读取本地文件/目录 |

local 模式不暴露 `create_entry`。如果 Agent 生成内容需要发布，请先用 Agent 的 write_file 能力落盘（建议写到 cwd 或系统临时目录），再调用 `publish_files`。

**local 模式路径规则（v0.7.1+）：**
- 默认允许发布 `cwd` 和系统临时目录（如 Linux `/tmp`）下的文件
- 不默认允许整个 `$HOME`
- 如需发布 `$HOME` 或其他目录，需显式配置 `server.allowed_paths`
- 完全本机自用时可设置 `server.trust_all_paths=true`（危险：跳过目录边界，denylist 仅 best-effort）

### Agent 读路径

MCP 工具聚焦于「写」（发布/创建/删除）。Agent 如需「读」已有条目的原始内容，直接调用 PeekView REST API：

- `GET /api/v1/entries/{slug}/raw` — 返回结构化 JSON（文本文件含 `content` 字段；二进制文件 `content=null` + `file_url`）
- 公开条目免认证；私有条目需 API key（`Authorization: Bearer pv_xxx`）

适用于 Agent 跨会话恢复上下文、读取之前发布的代码/文档场景。

## 何时用 MCP vs CLI

PeekView 提供两种方式让 Agent 创建条目，按场景选择：

| 场景 | 推荐 | 原因 |
|------|------|------|
| 用户让 Agent 发布指定文件 | CLI（`peekview create`） | 即开即用，零配置，文件内容不经过 LLM 上下文 |
| Agent 自主决定发布 | MCP（`publish_files` 或 `create_entry`） | 无需人工介入 |
| CI/CD 自动化流水线 | MCP | 无人值守执行 |
| Agent 发布本地文件（同机） | MCP local 模式（`publish_files`） | MCP 直接读文件，Agent 只传路径 |
| Agent 生成内容并远程发布 | MCP remote 模式（`create_entry`） | 内容经过 LLM 上下文，注意控制体积 |

**关键区别**：CLI 面向用户驱动操作，MCP 面向 Agent 驱动操作，两者互补不替代。

## 快速开始

### 1. 配置 MCP Server

```bash
# 设置 PeekView 服务器地址（内部通信）
peekview-mcp config set peekview.url http://localhost:8080

# 设置公开地址（生成给用户的链接）
peekview-mcp config set peekview.public_url https://peek.example.com

# （可选）修改服务端口（默认 33333）
peekview-mcp config set server.port 33334

# （可选）设置部署模式（默认 remote；本地文件发布使用 local）
peekview-mcp config set server.mode local
peekview-mcp config set server.allowed_paths /home/alice/projects

# （可选）设置日志级别（debug/info/warn/error）
peekview-mcp config set logging.level info

# 查看当前配置
peekview-mcp config list
```

### 2. 安装并启动服务

```bash
# 安装为 systemd 服务（用户级，无需 sudo）
peekview-mcp service install --user

# 启动服务
peekview-mcp service start

# 查看状态
peekview-mcp service status
```

### 3. 在 Claude Code 中配置

```bash
# 先创建 API Key（在 PeekView 服务器上）
peekview apikey create "Claude Code"

# 配置 MCP（在 Claude Code 中）
claude mcp add peekview \
  --transport http http://localhost:33333/mcp \
  --header "Authorization: Bearer pv_xxxxxxxx..."

# Docker 容器内的 Agent 需声明 namespace（namespace 是 Agent 侧的短路径别名，volume mount 必须同路径）
claude mcp add peekview \
  --transport http http://host.docker.internal:33333/mcp \
  --header "Authorization: Bearer pv_xxxxxxxx..." \
  --header "X-Peekview-Namespace: docker-a"
```

## 命令详解

### `peekview-mcp config` - 配置管理

```bash
# 设置配置项
peekview-mcp config set <key> <value>

# 支持的配置项：
#   peekview.url          - PeekView API 内部地址（必填）
#   peekview.public_url   - 公开访问地址（生成链接用，必填）
#   server.port           - MCP 服务端口（默认 33333）
#   server.host           - 绑定地址（默认 0.0.0.0）
#   server.cors_origins   - CORS 来源（默认 *）
#   logging.level         - 日志级别（默认 info）

# 示例
peekview-mcp config set peekview.url http://localhost:8080
peekview-mcp config set server.port 33334
peekview-mcp config set logging.level debug

# 获取配置项
peekview-mcp config get peekview.url

# 列出所有配置
peekview-mcp config list
```

### `peekview-mcp serve` - 启动服务

```bash
# 前台启动（按 Ctrl+C 停止）
peekview-mcp serve

# 使用自定义端口（覆盖配置文件）
peekview-mcp serve --port 33334
peekview-mcp serve --host 127.0.0.1
```

### `peekview-mcp service` - 系统服务管理

```bash
# 安装服务
peekview-mcp service install --user     # 用户级服务（推荐）
peekview-mcp service install            # 系统级服务（需要 sudo）

# 服务管理
peekview-mcp service start
peekview-mcp service stop
peekview-mcp service status
peekview-mcp service restart

# 卸载服务
peekview-mcp service uninstall --user
```

## 配置参数详解

| 配置项 | 环境变量 | 默认值 | 说明 |
|--------|----------|--------|------|
| `peekview.url` | `PEEKVIEW_URL` | - | **必填**。MCP Server 调用 PeekView API 的地址（可以是内网或公网） |
| `peekview.public_url` | `PEEKVIEW_PUBLIC_URL` | - | **必填**。生成给用户查看条目的链接（必须是用户浏览器能访问的地址） |
| `server.port` | `MCP_PORT` | `33333` | MCP Server 监听端口 |
| `server.host` | `MCP_HOST` | `0.0.0.0` | 绑定地址，`127.0.0.1` 仅本地，`0.0.0.0` 所有接口 |
| `server.cors_origins` | `MCP_CORS_ORIGINS` | `*` | CORS 来源，逗号分隔多个域名 |
| `server.mode` | `MCP_MODE` | `remote` | 部署模式：`remote`（默认）或 `local` |
| `server.allowed_paths` | `MCP_ALLOWED_PATHS` | - | local 模式显式路径白名单；YAML 配置文件用数组格式（`- /path1`），环境变量用冒号分隔（`MCP_ALLOWED_PATHS=/path1:/path2`）；配置后覆盖默认 cwd+系统临时目录；支持 `~` 展开 |
| `server.path_namespaces` | — | — | Docker 容器路径映射（仅配置文件），见下方「Docker 容器部署」 |
| `server.trust_all_paths` | `MCP_TRUST_ALL_PATHS` | `false` | 危险选项：跳过路径白名单，仅 best-effort 敏感路径保护 |
| `logging.level` | `MCP_LOG_LEVEL` | `info` | 日志级别：`debug`, `info`, `warn`, `error` |

### peekview.url vs peekview.public_url 的区别

```
┌─────────────────────────────────────────────────────────────┐
│                      网络架构                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Claude Code (用户机器)                                     │
│       │                                                     │
│       │ HTTP 连接                                            │
│       ▼                                                     │
│  ┌─────────────┐         ┌─────────────┐                 │
│  │ MCP Server  │ ──────► │  PeekView    │                 │
│  │  :33333     │  HTTP   │  :8080       │                 │
│  │             │         │              │                 │
│  │ API 调用    │         │ 生成条目     │                 │
│  └─────────────┘         └─────────────┘                 │
│       ▲                          │                         │
│       │ peekview.url             │                         │
│       │                          │ peekview.public_url       │
│       │                          ▼                         │
│       │                   浏览器查看                      │
│       │                   （用户点击链接）                  │
│       │                                                     │
│   返回 view_url ─────────────────┘                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

| 配置项 | 用途 | 谁能访问 | 典型值 |
|--------|------|---------|--------|
| **`peekview.url`** | MCP Server 调用 PeekView API | 只有 MCP Server 需要访问 | `http://localhost:8080` / `http://10.0.0.5:8080` |
| **`peekview.public_url`** | 生成给用户查看条目的链接 | 用户的浏览器需要能访问 | `https://peek.example.com` / `http://192.168.1.100:8080` |

**关键区别**：
- `peekview.url` 只需要 MCP Server 能访问到 PeekView 即可（可以用内网地址）
- `peekview.public_url` 必须能被**用户的浏览器**访问（如果用户在外网，必须用公网地址）

## 部署场景

### 场景一：单服务器部署（最简单）

MCP Server 和 PeekView 在同一台机器上。

```
┌─────────────────────────────────────────┐
│              服务器 A                    │
│  ┌─────────────┐    ┌─────────────┐   │
│  │ MCP Server  │───►│  PeekView   │   │
│  │  :33333     │    │  :8080      │   │
│  └─────────────┘    └─────────────┘   │
│         ▲                    │          │
│         │                    │          │
│    用户电脑 (HTTP)      浏览器查看        │
└─────────────────────────────────────────┘
```

配置：
```bash
peekview-mcp config set peekview.url http://localhost:8080
peekview-mcp config set peekview.public_url http://localhost:8080
```

**适用**：本地开发、单机部署测试

---

### 场景二：多服务器 + 内网互通（推荐生产环境）

MCP Server 和 PeekView 在不同服务器，但两台服务器有内网互通。

```
┌─────────────────┐         内网          ┌─────────────────┐
│    服务器 A      │◄────────────────────►│    服务器 B      │
│  ┌───────────┐  │    10.0.0.x 网段    │  ┌───────────┐  │
│  │MCP Server │  │                     │  │  PeekView  │  │
│  │  :33333   │  │                     │  │  :8080     │  │
│  └─────┬─────┘  │                     │  └─────┬─────┘  │
│        │        │                     │        │        │
│   公网IP:33333  │                     │  内网IP:8080    │
└────────┼────────┘                     └────────┼────────┘
         │                                       │
         ▼                                       ▼
     用户电脑 (HTTP)                          Nginx 反向代理
    (外网访问)                              peek.example.com
```

配置：
```bash
# 在服务器A（MCP Server）上配置
peekview-mcp config set peekview.url http://10.0.0.5:8080      # PeekView内网地址
peekview-mcp config set peekview.public_url https://peek.example.com  # 用户访问的公网地址
```

**适用**：
- 生产环境，MCP Server 和 PeekView 分离部署
- PeekView 不直接暴露公网，通过 Nginx/Traefik 反向代理
- MCP Server 通过内网调用 PeekView API（更安全、更低延迟）

---

### 场景三：多服务器 + 仅公网互通

两台服务器没有内网互通，只能通过公网访问。

```
┌─────────────────┐         公网           ┌─────────────────┐
│    服务器 A      │◄────────────────────►│    服务器 B      │
│  ┌───────────┐  │                      │  ┌───────────┐  │
│  │MCP Server │  │                      │  │  PeekView  │  │
│  │  :33333   │  │                      │  │  :8080     │  │
│  └─────┬─────┘  │                      │  └─────┬─────┘  │
│        │        │                      │        │        │
│   公网IP:33333  │                      │  公网IP:8080    │
└────────┼────────┘                      └────────┼────────┘
         │                                         │
         ▼                                         ▼
     用户电脑 (HTTP)                          用户浏览器
    (外网访问)                              (外网访问)
```

配置：
```bash
# 在服务器A（MCP Server）上配置
peekview-mcp config set peekview.url https://peek.example.com    # PeekView公网地址
peekview-mcp config set peekview.public_url https://peek.example.com  # 同上
```

**适用**：
- 云服务器分布在不同地域/可用区，无内网互通
- PeekView 直接暴露公网（或使用反向代理）

---

**如何选择场景？**

| 条件 | 推荐场景 |
|------|---------|
| 只有一台服务器 | 场景一（单服务器） |
| 多台服务器 + 有内网互通 | 场景二（多服务器+内网） |
| 多台服务器 + 无内网互通 | 场景三（多服务器+公网） |
| PeekView 不暴露公网 | 场景二（MCP通过内网访问） |
| Agent 在 Docker 容器内 | 场景四（Docker + path_namespaces） |

## 配置文件示例

`~/.peekview/mcp-config.yaml`:

```yaml
peekview:
  url: http://localhost:8080
  public_url: https://peek.example.com

server:
  port: 33333
  host: 0.0.0.0
  cors_origins: "*"

logging:
  level: info
```

local 模式示例：

```yaml
peekview:
  url: https://peek.example.com
  public_url: https://peek.example.com

server:
  mode: local
  # 默认已允许 cwd + 系统临时目录；如需额外目录：
  allowed_paths:
    - ~/projects       # ~ 会自动展开为 $HOME
    - /home/alice/notes
  # 完全本机自用（危险）：
  # trust_all_paths: true
```

Docker 容器部署示例（Agent 在容器内，MCP Server 在主机）：

```yaml
peekview:
  url: http://localhost:8080
  public_url: https://peek.example.com

server:
  mode: local
  allowed_paths:
    - /data/project1   # volume mount 的主机目录（容器内路径 = 主机挂载路径）
    - /data/project2
  # namespace 是 Agent 侧的短路径别名，用于 Agent 传入路径的前缀替换
  # volume mount 必须同路径（容器内路径 = 主机挂载路径）
  path_namespaces:
    docker-a:
      /data: /data     # Agent 传 /data/xxx → 确认归属 namespace docker-a
    docker-b:
      /data: /data
```

## 环境变量

所有配置都支持环境变量，优先级：**CLI 选项 > 环境变量 > 配置文件**

```bash
# 必需
export PEEKVIEW_URL=http://localhost:8080
export PEEKVIEW_PUBLIC_URL=https://peek.example.com

# 可选
export MCP_PORT=33333
export MCP_HOST=0.0.0.0
export MCP_CORS_ORIGINS="*"
export MCP_MODE=local
export MCP_ALLOWED_PATHS=/home/alice/projects:/tmp/staging
export MCP_TRUST_ALL_PATHS=false
export MCP_LOG_LEVEL=info

# 启动
peekview-mcp serve
```

## 认证方式

每个 Claude Code 用户使用自己的 PeekView API Key：

```
Claude Code (Alice)              Claude Code (Bob)
    │                                 │
    │ Authorization: Bearer pv_alice  │ Authorization: Bearer pv_bob
    ▼                                 ▼
┌──────────────────────────────────────────────────┐
│              MCP Server (:33333)                 │
│  1. 检查 pv_ 前缀                                │
│  2. 转发到 PeekView /auth/me 验证                │
│  3. 每个请求携带用户的 API Key                   │
└──────────────────────────────────────────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │   PeekView (:8080)    │
        │  pv_alice → Alice 条目 │
        │  pv_bob   → Bob 条目   │
        └───────────────────────┘
```

## 完整部署示例

### Docker Compose

```yaml
version: '3.8'
services:
  peekview:
    image: python:3.12-slim
    command: pip install peekview && peekview serve --host 0.0.0.0 --port 8080
    ports:
      - "8080:8080"
    volumes:
      - peekview-data:/data

  mcp-server:
    image: node:20-alpine
    command: npm install -g @peekview/mcp-server && peekview-mcp serve
    working_dir: /app
    ports:
      - "33333:33333"
    environment:
      - PEEKVIEW_URL=http://peekview:8080
      - PEEKVIEW_PUBLIC_URL=https://peek.example.com
      - MCP_MODE=local
      - MCP_ALLOWED_PATHS=/data:/app
    volumes:
      - mcp-data:/data
```

### 手动部署

```bash
# 1. 在 PeekView 服务器上
peekview serve --base-url https://peek.example.com

# 2. 在 MCP 服务器上（可以是同一台）
peekview-mcp config set peekview.url http://localhost:8080
peekview-mcp config set peekview.public_url https://peek.example.com
peekview-mcp config set server.port 33333

peekview-mcp service install --user
peekview-mcp service start

# 3. 用户配置 Claude Code
claude mcp add peekview \
  --transport http https://peek.example.com:33333/mcp \
  --header "Authorization: Bearer pv_xxx"
```

## Docker 场景指引

### cwd=/ 问题

Docker 容器默认 WORKDIR 为 `/`，MCP Server local 模式在 cwd 为根目录且未配置 `allowed_paths` 时会拒绝 `publish_files`（安全保护）。

**解决方案（任选其一）：**

1. **配置 `allowed_paths`**（推荐）：显式指定允许的目录
   ```bash
   # 环境变量方式
   MCP_ALLOWED_PATHS=/data:/app
   # 或配置文件方式
   peekview-mcp config set server.allowed_paths /data:/app
   ```

2. **设置 `working_dir`**：用非根目录启动容器
   ```yaml
   working_dir: /app
   ```

3. **`trust_all_paths=true`**（危险，仅限完全信任环境）

### 网络选择

| 方式 | 适用场景 | 配置 |
|------|---------|------|
| `--network host` | MCP Server 与 PeekView 同机 | `PEEKVIEW_URL=http://localhost:8080` |
| 端口映射 | MCP Server 在容器内 | `ports: ["33333:33333"]` + `PEEKVIEW_URL=http://host.docker.internal:8080` |

### Volume Mount 同路径原则

容器内路径必须与主机挂载路径一致（namespace 只影响 Agent 传入路径的前缀替换，不做路径翻译）：

```yaml
volumes:
  - /data/project:/data/project   # ✅ 同路径
  - /host/path:/container/path     # ❌ 不同路径，publish_files 无法找到文件
```

### Docker Compose 完整示例

```yaml
version: '3.8'
services:
  peekview:
    image: python:3.12-slim
    command: sh -c "pip install peekview && peekview serve --host 0.0.0.0 --port 8080"
    ports:
      - "8080:8080"
    volumes:
      - peekview-data:/data

  mcp-server:
    image: node:20-alpine
    command: sh -c "npm install -g @peekview/mcp-server && peekview-mcp serve"
    working_dir: /app
    ports:
      - "33333:33333"
    environment:
      - PEEKVIEW_URL=http://peekview:8080
      - PEEKVIEW_PUBLIC_URL=https://peek.example.com
      - MCP_MODE=local
      - MCP_ALLOWED_PATHS=/data:/app
    volumes:
      - mcp-data:/data
```

## 故障排查

```bash
# 检查配置
peekview-mcp config list

# 前台启动查看日志
peekview-mcp serve
MCP_LOG_LEVEL=debug peekview-mcp serve

# 查看服务日志
journalctl --user -u peekview-mcp -f

# 测试连接
curl http://localhost:33333/health
curl -X POST http://localhost:33333/mcp \
  -H "Authorization: Bearer pv_xxx" \
  -H "Accept: application/json, text/event-stream" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl-test","version":"1.0"}}}'
```

## 升级

```bash
# 升级 MCP Server
npm install -g @peekview/mcp-server@latest

# 重启服务
peekview-mcp service restart

# 验证版本
peekview-mcp --version
```

## 卸载

```bash
# 停止并卸载服务
peekview-mcp service stop
peekview-mcp service uninstall --user

# 卸载包
npm uninstall -g @peekview/mcp-server

# 清理配置（可选）
rm ~/.peekview/mcp-config.yaml
```

## 开发

```bash
cd packages/mcp-server
npm install
npm run build
npm test                 # 纯单元测试，隔离临时 HOME
npm run test:integration # 需要 debug backend + API key
npm start
```

## License

MIT
