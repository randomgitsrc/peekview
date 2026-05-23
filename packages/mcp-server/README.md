# PeekView MCP Server

Model Context Protocol (MCP) server for [PeekView](https://github.com/randomgitsrc/peekview) with SSE transport and multi-user authentication.

## Quick Start

### 1. 配置 MCP Server

```bash
# 设置 PeekView 服务器地址（内部通信）
peekview-mcp config set peekview.url http://localhost:8080

# 设置公开地址（生成给用户的链接）
peekview-mcp config set peekview.public_url https://peek.example.com

# （可选）修改服务端口（默认 33333）
peekview-mcp config set server.port 33334

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
  --transport sse http://localhost:33333/sse \
  --header "Authorization: Bearer pv_xxxxxxxx..."
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
| `peekview.url` | `PEEKVIEW_URL` | - | **必填**。PeekView API 内部地址，MCP Server 用此地址调用 PeekView API |
| `peekview.public_url` | `PEEKVIEW_PUBLIC_URL` | - | **必填**。公开访问地址，生成给用户查看条目的链接 |
| `server.port` | `MCP_PORT` | `33333` | MCP Server 监听端口 |
| `server.host` | `MCP_HOST` | `0.0.0.0` | 绑定地址，`127.0.0.1` 仅本地，`0.0.0.0` 所有接口 |
| `server.cors_origins` | `MCP_CORS_ORIGINS` | `*` | CORS 来源，逗号分隔多个域名 |
| `logging.level` | `LOG_LEVEL` | `info` | 日志级别：`debug`, `info`, `warn`, `error` |

### peekview.url vs peekview.public_url 的区别

```
┌─────────────────────────────────────────────────────────────┐
│                      网络架构                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Claude Code (用户机器)                                     │
│       │                                                     │
│       │ SSE 连接                                            │
│       ▼                                                     │
│  ┌─────────────┐         ┌─────────────┐                 │
│  │ MCP Server  │ ──────► │  PeekView    │                 │
│  │  :33333     │  HTTP   │  :8080       │                 │
│  │             │         │              │                 │
│  │ 内部通信    │         │ 生成条目     │                 │
│  └─────────────┘         └─────────────┘                 │
│                                  │                         │
│                                  ▼                         │
│                           浏览器查看                      │
│                           （使用 public_url）              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

- **`peekview.url`**: MCP Server → PeekView 的内部通信地址
  - 如果同一机器：`http://localhost:8080`
  - 如果 Docker 内：`http://peekview:8080`
  
- **`peekview.public_url`**: 生成给用户查看条目的链接
  - 外网访问：`https://peek.example.com`
  - 内网访问：`http://192.168.1.100:8080`

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
export LOG_LEVEL=info

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
    image: peekview:latest
    ports:
      - "8080:8080"
    volumes:
      - peekview-data:/data

  mcp-server:
    image: peekview/mcp-server:latest
    ports:
      - "33333:33333"
    environment:
      - PEEKVIEW_URL=http://peekview:8080
      - PEEKVIEW_PUBLIC_URL=https://peek.example.com
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
  --transport sse https://peek.example.com:33333/sse \
  --header "Authorization: Bearer pv_xxx"
```

## 故障排查

```bash
# 检查配置
peekview-mcp config list

# 前台启动查看日志
peekview-mcp serve
LOG_LEVEL=debug peekview-mcp serve

# 查看服务日志
journalctl --user -u peekview-mcp -f

# 测试连接
curl http://localhost:33333/health
curl -H "Authorization: Bearer pv_xxx" http://localhost:33333/sse
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
npm test
npm start
```

## License

MIT
