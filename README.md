# PeekView

> 轻量级代码与文档格式化展示服务

Agent（AI）产出 → PeekView 格式化 → 人类友好查看

[![Python 3.12+](https://img.shields.io/badge/python-3.12+-blue.svg)](https://www.python.org/downloads/)
[![Vue 3](https://img.shields.io/badge/vue-3.4+-green.svg)](https://vuejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 快速开始

### 安装

**推荐：使用 pipx 安装（隔离环境，无依赖冲突）**

```bash
# 安装 pipx（如果尚未安装）
# macOS: brew install pipx && pipx ensurepath
# Ubuntu/Debian: sudo apt install pipx && pipx ensurepath

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
- 📂 **多文件支持** - 单条目多文件，树形展示
- 🌓 **主题切换** - 深色/浅色模式，自动跟随系统
- 📱 **移动端适配** - 响应式设计，底部工具栏
- 🔗 **URL 友好** - 支持 slug、文件参数、行号高亮
- 🔒 **安全防护** - 路径遍历防护、API 认证、XSS 过滤

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

# 自定义 slug
peekview create README.md -s "Documentation" --slug docs
```

### 查看条目

```bash
# 查看详情
peekview get my-entry

# 列出入库（支持分页）
peekview list
peekview list --page 2 --per-page 50

# 搜索（FTS5 全文搜索）
peekview list -q "python function"

# 按标签过滤
peekview list -t python -t cli
```

### 删除条目

```bash
# 删除（会要求确认）
peekview delete my-entry

# 强制删除
peekview delete my-entry --force
```

---

## 配置

通过环境变量配置：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PEEKVIEW_DATA_DIR` | `~/.peekview/data` | 文件存储目录 |
| `PEEKVIEW_DB_PATH` | `~/.peekview/peek.db` | SQLite 数据库路径 |
| `PEEKVIEW_ALLOWED_PATHS` | `[]` | 允许读取的本地路径列表 |
| `PEEKVIEW_HOST` | `127.0.0.1` | 服务绑定地址 |
| `PEEKVIEW_PORT` | `8080` | 服务端口 |
| `PEEKVIEW_API_KEY` | - | API 认证密钥（可选） |
| `PEEKVIEW_CORS_ORIGINS` | `http://localhost:5173` | CORS 允许来源 |

也可使用 `.env` 文件：

```bash
PEEKVIEW_DATA_DIR=/var/peek/data
PEEKVIEW_DB_PATH=/var/peek/peek.db
PEEKVIEW_HOST=0.0.0.0
PEEKVIEW_PORT=8080
PEEKVIEW_API_KEY=your-secret-key
```

## 使用自定义域名

如果使用反向代理（如 Cloudflare Tunnel、Nginx），可通过 `--base-url` 指定外部域名：

```bash
# 服务端
peekview serve --base-url https://example.com

# 创建条目时使用自定义域名
peekview create file.txt -s "My code" --base-url https://example.com
# 输出: URL: https://example.com/xxxxx
```

## 作为系统服务运行

### Linux (systemd)

```bash
# 安装为系统服务
sudo peekview service install --base-url https://example.com

# 或使用用户级服务（无需 sudo）
peekview service install --user

# 管理命令
peekview service status   # 查看状态
peekview service start    # 启动服务
peekview service stop     # 停止服务
peekview service uninstall # 卸载服务
```

### macOS (launchd)

```bash
# 安装为用户服务
peekview service install --user

# 管理命令与 Linux 相同
peekview service status
```

服务配置：
- 开机自启动
- 自动重启（崩溃后 5 秒重启）
- 日志位置：`/var/log/peekview.log` (系统服务) 或 `~/.peekview/service.log` (用户服务)

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | FastAPI + SQLModel + SQLite (FTS5) |
| 前端 | Vue 3 + Vite + TypeScript + Shiki (**frontend-v3/**) |
| CLI | Click + Rich |
| 测试 | pytest + Vitest + Playwright |

**注意：** `frontend/` 目录为旧版本，已弃用。当前使用 `frontend-v3/`。

---

## 项目文档

- [部署指南](docs/DEPLOYMENT.md) - 完整安装、配置、部署教程
- [项目索引](INDEX.md) - 实现进度与文档清单
- [需求规格](docs/specs/spec-requirements.md) - 用户故事与验收标准
- [技术设计](docs/specs/spec-design.md) - 架构设计文档
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
