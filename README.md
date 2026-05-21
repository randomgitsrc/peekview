# PeekView

> 轻量级代码与文档格式化展示服务

**Agent（AI）产出 → PeekView 格式化 → 人类友好查看**

**一句话开始：** `pipx install peekview && peekview serve && peekview create file.py -s "Hello"`

[![Version](https://img.shields.io/badge/version-0.1.32-blue.svg)](https://github.com/randomgitsrc/peekview/releases)
[![Python 3.12+](https://img.shields.io/badge/python-3.12+-blue.svg)](https://www.python.org/downloads/)
[![Vue 3](https://img.shields.io/badge/vue-3.4+-green.svg)](https://vuejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Agent 快速场景

> 典型使用模式：Agent（AI）创建 → 人类在浏览器查看

### 场景 1：分享代码片段

```bash
# Agent 创建条目
peekview create solution.py -s "修复内存泄漏的方案"

# 返回可分享的链接
# http://localhost:8080/fix-memory-leak
```

### 场景 2：多文件项目展示

```bash
# Agent 上传整个项目目录
peekview create src/*.py config.yaml -s "Web 爬虫项目" -t python

# 人类在浏览器中看到：
# - 左侧层级文件树（支持嵌套目录）
# - 代码高亮 + 行号
# - 一键 Pack 下载 ZIP
```

### 场景 3：HTML 交互演示

```bash
# Agent 创建带资源的 HTML 条目
peekview create index.html style.css app.js -s "交互式图表演示"

# HTML 在 iframe 沙盒中渲染，CSS/JS/图片自动注入
```

### 场景 4：AI 工作流集成

```bash
# Agent 从 stdin 直接推送
claude code review.md | peekview create -s "代码审查报告" --from-stdin

# 或结合其他 AI 工具
cat analysis.json | jq -r '.summary' | peekview create -s "分析结果"
```

### 场景 5：MCP Server（Claude/Cursor 直接调用）

```bash
# 安装 MCP Server
npm install -g @peekview/mcp-server

# 配置到 Claude Code（使用你的 pv_ API Key）
claude mcp add peekview -t sse http://localhost:33333/sse --header "Authorization: Bearer pv_your_api_key"

# Agent 现在可以直接调用 create_entry / get_entry / list_entries / delete_entry
# 无需手动调用 CLI，Agent 自动通过 MCP 协议操作 PeekView
```

---

## 快速开始

### 安装

**推荐：使用 pipx 安装（隔离环境，无依赖冲突）**

```bash
pipx install peekview
```

**或使用 pip 安装（建议配合虚拟环境）**

```bash
pip install peekview
```

**从源码安装**

```bash
git clone https://github.com/randomgitsrc/peekview.git
cd peekview/backend
pip install -e .
```

### 启动服务

```bash
# 本地开发
peekview serve

# 生产部署
peekview serve --host 0.0.0.0 --port 8080
```

访问 http://localhost:8080 即可使用 Web 界面。

---

## 功能特性

- 🎨 **代码高亮** - 基于 Shiki 的语法高亮，支持 100+ 语言
- 📝 **Markdown 渲染** - GitHub 风格 Markdown，自动生成目录
- 🔍 **全文搜索** - SQLite FTS5 高性能搜索
- 📂 **多文件支持** - 单条目多文件，层级目录树展示（支持嵌套路径）
- 🖼️ **HTML 渲染** - 网页在 iframe 沙盒中渲染，支持 CSS/JS/图片自动注入
- 🖼️ **图片预览** - PNG/JPG/GIF/WebP/SVG 支持，缩放和下载
- 📦 **Pack 下载** - 多文件条目一键打包下载（ZIP）
- 📤 **文件上传** - 支持内容直传、本地路径引用、批量上传、二进制文件（Base64）
- 🌐 **REST API** - 完整的 RESTful CRUD 接口，支持 API Key 认证
- 🔐 **用户认证** - JWT 用户注册/登录，私有条目，所有者权限控制
- 🔑 **API Key 管理** - 用户级 API Key（`pv_` 前缀），支持过期时间，CLI 远程管理
- 🌓 **主题切换** - 深色/浅色模式，自动跟随系统
- 📱 **移动端适配** - 响应式设计，底部工具栏
- 🔗 **URL 友好** - 支持 slug、文件参数、行号高亮
- 🔒 **安全防护** - 路径遍历防护、API 认证、XSS 过滤、iframe 沙盒隔离
- 🤖 **MCP Server** - AI Agent 直接集成（SSE 传输、多用户 API Key 透传、npm 安装）

---

## CLI 用法

### 创建条目

```bash
# 从文件创建
peekview create file.txt -s "My document"

# 多文件 + 标签
peekview create src/*.py -s "Python project" -t python -t cli

# 从标准输入
echo "print('hello')" | peekview create -s "From stdin" --from-stdin

# 创建私有条目
peekview create file.py -s "Private" --visibility private
```

### 查看与管理条目

```bash
peekview get my-entry                       # 查看详情
peekview list                                # 列出入库
peekview list -q "python function"           # FTS5 全文搜索
peekview list -t python -t cli               # 按标签过滤
peekview delete my-entry                     # 删除（需确认）
```

### 用户管理

```bash
peekview user create <username>              # 创建用户
peekview user list                           # 列出用户
peekview user promote <username>             # 提升为管理员
peekview user demote <username>              # 降级管理员
```

### 远程认证

```bash
peekview login --remote-url <url> --username <user>  # 登录远程服务器
```

### API Key 管理

```bash
peekview apikey create "CI Bot"              # 创建 API Key
peekview apikey create "Temp" --expires 30d  # 带过期时间
peekview apikey list                         # 列出所有 Key
peekview apikey revoke <key_id>              # 撤销 Key
peekview apikey cleanup                      # 清理过期 Key
```

### API 文档

```bash
peekview api endpoints                       # 列出所有 API 端点
peekview api openapi                         # 显示 OpenAPI 文档地址
```

---

## 远程 CLI 模式

从 v0.1.25 开始，PeekView 支持远程 CLI 模式。你可以在一台机器上运行服务端，从其他机器通过 CLI 创建和管理条目。

### 配置远程服务端

**方式 1：Config 文件（推荐）**

```yaml
# ~/.peekview/config.yaml
remote:
  url: https://peek.example.com
  api_key: pv_your-api-key           # 用户级 API Key
  timeout: 60
  verify_ssl: true
```

**方式 2：环境变量**

```bash
export PEEKVIEW_REMOTE__URL=https://peek.example.com
export PEEKVIEW_REMOTE__API_KEY=pv_your-api-key
```

**方式 3：命令行参数（临时）**

```bash
peekview create file.txt -s "My code" --remote-url https://peek.example.com
```

### 远程模式限制

- **仅支持文本文件**：二进制文件会被跳过并显示警告
- **不支持 local_path**：远程模式无法访问服务端本地文件系统
- **目录扫描**：在客户端本地完成扫描后上传文件内容

---

## 配置

### 环境变量（最高优先级）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PEEKVIEW_SERVER__HOST` | `127.0.0.1` | 服务绑定地址 |
| `PEEKVIEW_SERVER__PORT` | `8080` | 服务端口 |
| `PEEKVIEW_SERVER__BASE_URL` | `""` | 外部 URL（空=自动检测） |
| `PEEKVIEW_SERVER__API_KEY` | `""` | 全局 API 认证密钥（空=无认证） |
| `PEEKVIEW_SERVER__CORS_ORIGINS` | `http://localhost:5173` | CORS 允许来源 |
| `PEEKVIEW_STORAGE__DATA_DIR` | `~/.peekview/data` | 文件存储目录 |
| `PEEKVIEW_STORAGE__DB_PATH` | `~/.peekview/peekview.db` | SQLite 数据库路径 |
| `PEEKVIEW_STORAGE__ALLOWED_PATHS` | `[]` | 允许读取的本地路径列表 |
| `PEEKVIEW_AUTH__SECRET_KEY` | `""` | JWT 签名密钥（空=自动生成） |
| `PEEKVIEW_AUTH__TOKEN_EXPIRE_DAYS` | `7` | JWT Token 有效期（天） |
| `PEEKVIEW_AUTH__ALLOW_REGISTRATION` | `true` | 是否允许新用户注册 |
| `PEEKVIEW_AUTH__ALLOW_ANONYMOUS_CREATE` | `true` | 是否允许匿名创建条目 |
| `PEEKVIEW_LIMITS__MAX_FILE_SIZE` | `10485760` | 单文件最大大小（10MB） |
| `PEEKVIEW_LIMITS__MAX_ENTRY_FILES` | `50` | 单条目最大文件数 |
| `PEEKVIEW_LIMITS__MAX_SUMMARY_LENGTH` | `500` | 摘要最大长度 |
| `PEEKVIEW_LIMITS__MAX_PER_PAGE` | `50` | 每页最大条目数 |
| `PEEKVIEW_CLEANUP__CHECK_ON_START` | `true` | 启动时检查过期条目 |
| `PEEKVIEW_CLEANUP__INTERVAL_SECONDS` | `3600` | 清理间隔（0=禁用） |
| `PEEKVIEW_LOGGING__LEVEL` | `INFO` | 日志级别 |
| `PEEKVIEW_REMOTE__URL` | `""` | 远程服务端地址 |
| `PEEKVIEW_REMOTE__API_KEY` | `""` | 远程 API Key |
| `PEEKVIEW_REMOTE__TOKEN` | `""` | 远程 JWT Token |
| `PEEKVIEW_REMOTE__TIMEOUT` | `30` | 远程请求超时（秒） |
| `PEEKVIEW_REMOTE__VERIFY_SSL` | `true` | SSL 证书校验 |

**注意**：`__` 分隔符用于访问嵌套配置（如 `storage.data_dir` → `PEEKVIEW_STORAGE__DATA_DIR`）

### Config 文件（持久化配置）

```yaml
# ~/.peekview/config.yaml
server:
  base_url: https://peek.example.com
  port: 8080
storage:
  data_dir: /var/peekview/data
  db_path: /var/peekview/peekview.db
```

**优先级**：环境变量 > Config 文件 > 默认值

---

## 作为系统服务运行

```bash
peekview service install --base-url https://example.com  # 安装系统服务
peekview service install --user                          # 用户级服务（无需 sudo）
peekview service status                                  # 查看状态
peekview service start                                   # 启动服务
peekview service stop                                    # 停止服务
peekview service uninstall                               # 卸载服务
```

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | FastAPI + SQLModel + SQLite (FTS5) |
| 前端 | Vue 3 + Vite + TypeScript + Shiki (**frontend-v3/**) |
| CLI | Click + Rich |
| 测试 | pytest + Vitest + Playwright |

---

## 项目文档

- [部署指南](docs/DEPLOYMENT.md) - 完整安装、配置、部署教程
- [调试指南](docs/DEBUGGING.md) - 本地源码调试指南
- [项目索引](INDEX.md) - 实现进度与完整文档清单
- [用户认证规格](docs/specs/spec-user-auth.md) - 认证系统设计
- [远程 CLI 规格](docs/specs/spec-remote-cli.md) - 远程 CLI 设计
- [开发流程](docs/process/workflow.md) - P0-P4 标准开发流程
- [发布流程](docs/process/release.md) - 版本发布规范
- [API 文档](backend/README.md) - 后端详细说明

---

## 开发

```bash
cd backend
pip install -e ".[test,dev]"
make test
make dev
```

---

## 许可证

MIT License
