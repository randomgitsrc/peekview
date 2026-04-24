# PeekView

A lightweight code & document formatting display service.

> Agent（AI）产出 → Peek 格式化 → 人类友好查看

## 快速开始

### 安装

```bash
pip install peekview
```

### 启动服务

```bash
# 本地开发
peekview serve

# 生产部署（指定端口和主机）
peekview serve --host 0.0.0.0 --port 8080
```

服务启动后，访问 http://localhost:8080 即可使用 Web 界面。

## 命令行用法

### 创建条目

```bash
# 从文件创建
peekview create file.txt -s "My document"

# 从多文件创建
peekview create src/*.py -s "Python project" -t python -t cli

# 从标准输入创建
echo "print('hello')" | peekview create -s "From stdin" --from-stdin

# 指定自定义 slug
peekview create README.md -s "Documentation" --slug docs
```

### 查看条目

```bash
# 查看条目详情
peekview get my-entry

# 列出入库（支持分页）
peekview list
peekview list --page 2 --per-page 50

# 搜索条目（FTS5 全文搜索）
peekview list -q "python function"

# 按标签过滤
peekview list -t python -t cli
```

### 删除条目

```bash
# 删除条目（会要求确认）
peekview delete my-entry

# 强制删除（无需确认）
peekview delete my-entry --force
```

## 配置

通过环境变量配置：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PEEKVIEW_DATA_DIR` | `~/.peekview/data` | 文件存储目录 |
| `PEEKVIEW_DB_PATH` | `~/.peekview/peek.db` | SQLite 数据库路径 |
| `PEEKVIEW_ALLOWED_PATHS` | `[]` | 允许读取的本地路径列表 |
| `PEEKVIEW_HOST` | `127.0.0.1` | 服务绑定地址 |
| `PEEKVIEW_PORT` | `8080` | 服务端口 |
| `PEEKVIEW_API_KEY` | `` | API 认证密钥（可选） |
| `PEEKVIEW_CORS_ORIGINS` | `http://localhost:5173` | CORS 允许来源 |

### 配置文件

也可以将配置写入 `.env` 文件：

```bash
PEEKVIEW_DATA_DIR=/var/peekview/data
PEEKVIEW_DB_PATH=/var/peekview/peekview.db
PEEKVIEW_HOST=0.0.0.0
PEEKVIEW_PORT=8080
PEEKVIEW_API_KEY=your-secret-key
```

## 特性

- 🎨 **代码高亮** - 基于 Shiki 的语法高亮，支持 100+ 语言
- 📝 **Markdown 渲染** - 支持 GitHub 风格 Markdown
- 🔍 **全文搜索** - 基于 SQLite FTS5 的高性能搜索
- 📂 **多文件支持** - 单条目支持多文件，树形展示
- 🌓 **主题切换** - 深色/浅色模式，自动跟随系统
- 📱 **移动端适配** - 响应式设计，底部工具栏
- 🔗 **URL 友好** - 支持 slug 和文件路径参数
- 🔒 **安全防护** - 路径遍历防护、API 认证、XSS 过滤

## 技术栈

- **后端**: FastAPI + SQLModel + SQLite (FTS5)
- **前端**: Vue 3 + Vite + Shiki + TypeScript
- **CLI**: Click + Rich

## 开发

```bash
# 克隆仓库
git clone https://github.com/randomgitsrc/peek.git
cd peek/backend

# 安装开发依赖
pip install -e ".[test,dev]"

# 运行测试
make test

# 格式化代码
make format

# 启动开发服务器
make dev
```

## 许可证

MIT License
