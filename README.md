# PeekView — 读取机器

> Agent 可写的高质量可分享渲染器。Agent 发布 → 人看。

```
Agent 产出 ──▶ PeekView 渲染 ──▶ 人看（浏览器）
 (MCP/CLI/API)                ──▶ Agent 读（/raw 原始内容）
```

[![Version](https://img.shields.io/badge/version-0.3.0-blue.svg)](https://github.com/randomgitsrc/peekview/releases)
[![Python 3.12+](https://img.shields.io/badge/python-3.12+-blue.svg)](https://www.python.org/downloads/)
[![Vue 3](https://img.shields.io/badge/vue-3.4+-green.svg)](https://vuejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 两个包

| 包 | 安装 | 作用 |
|---|------|------|
| **peekview** | `pipx install peekview` | 后端 + 前端 + CLI — 提供渲染服务、REST API |
| **@peekview/mcp-server** | `npm install -g @peekview/mcp-server` | MCP 桥接 — 让 Agent 通过 MCP 协议调用 PeekView |

## 快速开始

```bash
# 1. 安装并启动
pipx install peekview
peekview serve                          # http://localhost:8080

# 2. 创建一个条目
peekview create file.py -s "我的代码"   # → http://localhost:8080/wo-de-dai-ma

# 3. 接入 Agent（可选）
npm install -g @peekview/mcp-server
peekview-mcp config set peekview.url http://localhost:8080
peekview-mcp serve
```

## 给人看：浏览条目

浏览器打开任意条目链接，PeekView 渲染：

- **代码** — Shiki 语法高亮，100+ 语言，行号定位
- **Markdown** — GFM 渲染，自动目录，DOMPurify 净化
- **图表** — Mermaid、PlantUML
- **HTML** — 沙箱 iframe，支持 CSS/JS/图片注入（Three.js、Canvas、WebGL）
- **图片** — PNG/JPG/GIF/WebP/SVG，缩放查看
- **多文件** — 文件树导航，ZIP 下载
- **搜索** — 全文检索

暗色/亮色主题、移动端适配、自定义 slug、私有条目、用户认证、API Key 管理。

## 给 Agent 用：MCP 集成

### 工具列表

| 工具 | 模式 | 签名 | 返回 |
|------|------|------|------|
| `publish_files` | local | `(paths: string[], summary: string, slug?, tags?, is_public?, expires_in?, include_patterns?, exclude_patterns?)` | 条目 URL |
| `create_entry` | remote | `(files: {filename, content, path?}[], summary: string, slug?, tags?, is_public?, expires_in?)` | 条目 URL |
| `get_entry` | both | `(slug: string)` | 条目详情 + 文件列表 |
| `list_entries` | both | `(query?, tags?, page?, per_page?)` | 条目列表 |
| `delete_entry` | both | `(slug: string, confirm: boolean)` | 确认 |

### Local vs Remote

- **Local**（默认）：MCP Server 直接读本地文件，Agent 只传路径不传内容，绕过 LLM 上下文
- **Remote**：Agent 通过 MCP 发送文件内容，适用于跨机器部署

完整配置、安全模型、部署拓扑：[packages/mcp-server/README.md](packages/mcp-server/README.md)

### 接入 Agent

**Claude Code：**
```bash
claude mcp add peekview \
  --transport http http://localhost:33333/mcp \
  --header "Authorization: Bearer pv_your_api_key"
```

**Cursor / OpenCode / 其他 MCP 客户端：**
```json
{
  "peekview": {
    "url": "http://localhost:33333/mcp",
    "headers": { "Authorization": "Bearer pv_your_api_key" }
  }
}
```

## CLI 速查

```bash
peekview create <文件...> -s "摘要"        # 创建条目（支持通配符、stdin、--visibility private）
peekview get <slug>                         # 查看条目信息
peekview list [-q "搜索"] [-t 标签]         # 列出/搜索条目
peekview delete <slug>                      # 删除条目
peekview serve                              # 启动服务
peekview user create <用户名>               # 创建用户
peekview apikey create "标签"               # 创建 API Key
```

完整 CLI 参考：`peekview --help` | [部署指南](docs/guides/DEPLOYMENT.md)

## 配置

主要环境变量（前缀 `PEEKVIEW_`，`__` 分隔嵌套）：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `SERVER__HOST` | `0.0.0.0` | 绑定地址（`127.0.0.1` 仅本地） |
| `SERVER__PORT` | `8080` | 服务端口 |
| `SERVER__API_KEY` | `""` | 全局 API Key（空=无需认证） |
| `STORAGE__DATA_DIR` | `~/.peekview/data` | 文件存储目录 |
| `STORAGE__DB_PATH` | `~/.peekview/peekview.db` | SQLite 数据库路径 |
| `AUTH__SECRET_KEY` | `""` | JWT 签名密钥（空=自动生成） |
| `AUTH__ALLOW_REGISTRATION` | `true` | 允许新用户注册 |
| `LIMITS__MAX_FILE_SIZE` | `10485760` | 单文件最大体积（10MB） |

完整列表（33 项）：[CLAUDE.md](CLAUDE.md) · 配置文件：`~/.peekview/config.yaml` · 优先级：环境变量 > 配置文件 > 默认值

## 技术栈

FastAPI + SQLModel + SQLite (WAL + FTS5) · Vue 3 + Vite + TypeScript + Shiki · Node.js/TypeScript MCP Server · Click + Rich CLI

## 文档

- [部署指南](docs/guides/DEPLOYMENT.md) — 安装、配置、部署
- [Agent 部署指南](docs/guides/agent-deployment-guide.md) — VPS 部署 AI Agent
- [调试指南](docs/guides/DEBUGGING.md) — 本地开发
- [MCP Server README](packages/mcp-server/README.md) — 完整 MCP 配置与安全说明
- [更新日志](CHANGELOG.md) — 版本历史

## License

MIT
