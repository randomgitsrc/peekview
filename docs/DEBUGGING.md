# 本地源码调试指南

> 本文档介绍如何从源码构建并调试 PeekView，适用于开发环境。

---

## 目录

1. [环境准备](#环境准备)
2. [构建项目](#构建项目)
3. [调试后端](#调试后端)
4. [调试前端](#调试前端)
5. [常见问题](#常见问题)

---

## 环境准备

### 1. 克隆源码

```bash
git clone https://github.com/randomgitsrc/peekview.git
cd peekview
```

### 2. 检查目录结构

```
peekview/
├── backend/          # FastAPI 后端
├── frontend-v3/      # Vue3 前端 (当前使用)
└── docs/             # 文档
```

---

## 构建项目

### 后端构建

```bash
cd backend

# 创建虚拟环境
python3 -m venv .venv

# 激活虚拟环境
source .venv/bin/activate

# 安装依赖（包含测试依赖）
pip install -e ".[test]"

# 验证安装
peekview --version
# 输出: peekview, version 0.1.4
```

### 前端构建

```bash
cd frontend-v3

# 安装依赖
npm install

# 构建（静态文件会自动复制到后端）
npm run build

# 验证构建
ls ../backend/peekview/static/index.html
```

---

## 调试后端

### 方法 1：直接运行（前台）

```bash
cd backend
source .venv/bin/activate

# 使用开发模式（带热重载）
uvicorn peekview.main:get_app --factory --reload --port 8080

# 或使用 CLI
peekview serve --reload
```

访问 http://localhost:8080

### 方法 2：在 tmux/screen 中运行（后台）

```bash
# 创建新 session
tmux new -s peekview

# 在 session 中运行
cd /home/kity/lab/projects/peekview/backend
source .venv/bin/activate
peekview serve

# 分离 session: Ctrl+B, 然后按 D

# 重新连接
tmux attach -t peekview
```

### 方法 3：使用完整路径（无需激活环境）

```bash
# 适用于脚本或其他终端
/home/kity/lab/projects/peekview/backend/.venv/bin/peekview serve

# 或创建别名（添加到 ~/.bashrc）
alias pv='/home/kity/lab/projects/peekview/backend/.venv/bin/peekview'
alias pvdev='cd /home/kity/lab/projects/peekview/backend && source .venv/bin/activate && uvicorn peekview.main:get_app --factory --reload'
```

### 后端调试技巧

#### 1. 查看日志输出

```bash
# 开启详细日志
peekview serve --log-level debug

# 或设置环境变量
export PEEKVIEW_LOG_LEVEL=debug
peekview serve
```

#### 2. 数据库检查

```bash
# SQLite 数据库位置
~/.peekview/peek.db

# 使用 sqlite3 命令行查看
sqlite3 ~/.peekview/peek.db

# 常用查询
sqlite> .tables
sqlite> SELECT * FROM entries;
sqlite> SELECT * FROM entries_fts;
```

#### 3. 数据目录结构

```bash
# 查看存储的文件
ls -la ~/.peekview/data/default/

# 查看配置
cat ~/.peekview/config.yaml  # 如存在
```

#### 4. 环境变量配置

```bash
# 开发时常用的环境变量
export PEEKVIEW_DATA_DIR=/tmp/peekview/data
export PEEKVIEW_DB_PATH=/tmp/peekview/peek.db
export PEEKVIEW_PORT=8080
export PEEKVIEW_HOST=127.0.0.1
export PEEKVIEW_CORS_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"
```

---

## 调试前端

### 开发服务器（热重载）

```bash
cd frontend-v3

# 启动 Vite 开发服务器
npm run dev

# 访问 http://localhost:5173
# 后端需同时运行在 http://localhost:8080
```

### 前端调试技巧

#### 1. API 代理配置

开发服务器自动代理 API 请求到后端。确保 `vite.config.ts` 包含：

```typescript
server: {
  proxy: {
    '/api': 'http://127.0.0.1:8080'
  }
}
```

#### 2. 调试 Shiki 代码高亮

```bash
# 查看 Shiki 主题加载
# 在浏览器 DevTools Console 中
localStorage.getItem('theme')  # 查看当前主题
```

#### 3. 检查构建输出

```bash
# 构建后检查
npm run build

# 查看生成的文件
ls -la dist/
ls -la ../backend/peekview/static/  # 应已自动复制
```

---

## 常见调试场景

### 场景 1：同时调试前后端

```bash
# 终端 1: 启动后端
cd backend && source .venv/bin/activate
uvicorn peekview.main:get_app --factory --reload --port 8080

# 终端 2: 启动前端开发服务器
cd frontend-v3 && npm run dev

# 浏览器访问 http://localhost:5173 (前端)
# API 请求自动代理到 http://localhost:8080 (后端)
```

### 场景 2：测试生产构建

```bash
# 1. 构建前端
cd frontend-v3 && npm run build

# 2. 启动生产服务器（使用静态文件）
cd backend && source .venv/bin/activate
peekview serve

# 访问 http://localhost:8080
# 此时前端代码从 backend/peekview/static/ 加载
```

### 场景 3：数据库重置

```bash
# 停止服务器后删除数据库
rm ~/.peekview/peek.db
rm -rf ~/.peekview/data/default/*

# 重新启动，数据库会自动初始化
peekview serve
```

### 场景 4：测试 CLI

```bash
# 确保虚拟环境已激活
source backend/.venv/bin/activate

# 创建测试条目
echo "console.log('hello')" | peekview create -s "Test" --from-stdin

# 查看条目
peekview list

# 获取详情
peekview get <slug>
```

---

## 常见问题

### Q1: 新终端中 `peekview` 命令找不到

**原因**：虚拟环境未激活

**解决**：
```bash
# 方法 1: 激活环境
cd backend && source .venv/bin/activate

# 方法 2: 使用完整路径
./backend/.venv/bin/peekview --version
```

### Q2: 前端无法连接到后端

**原因**：CORS 或代理配置问题

**解决**：
```bash
# 确保后端允许前端域名
export PEEKVIEW_CORS_ORIGINS="http://localhost:5173"

# 或使用通配符（仅开发环境）
export PEEKVIEW_CORS_ORIGINS="*"
```

### Q3: 热重载不生效

**原因**：文件监听限制

**解决**：
```bash
# 增加系统文件监听限制
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### Q4: 数据库被锁定

**原因**：多个进程同时访问 SQLite

**解决**：
```bash
# 确保只有一个 peekview 实例在运行
pkill -f "peekview serve"

# 或删除锁文件（如果存在）
rm ~/.peekview/peek.db-journal
rm ~/.peekview/peek.db-wal
rm ~/.peekview/peek.db-shm
```

### Q5: 前端样式未更新

**原因**：浏览器缓存

**解决**：
```bash
# 强制刷新
Ctrl + Shift + R

# 或清除缓存后刷新
Ctrl + F5
```

---

## 调试工具推荐

| 工具 | 用途 | 命令 |
|------|------|------|
| pytest | 后端单元测试 | `cd backend && make test` |
| ruff | 代码检查 | `cd backend && make lint` |
| Vitest | 前端单元测试 | `cd frontend-v3 && npm run test` |
| Playwright | E2E 测试 | `cd frontend-v3 && npm run test:e2e` |
| sqlite3 | 数据库查询 | `sqlite3 ~/.peekview/peek.db` |
| curl | API 测试 | `curl http://localhost:8080/api/v1/entries` |

---

## 快捷命令汇总

```bash
# 快速启动后端（添加到 ~/.bashrc）
alias pv-backend='cd /home/kity/lab/projects/peekview/backend && source .venv/bin/activate && uvicorn peekview.main:get_app --factory --reload'

# 快速启动前端
alias pv-frontend='cd /home/kity/lab/projects/peekview/frontend-v3 && npm run dev'

# 快速运行测试
alias pv-test='cd /home/kity/lab/projects/peekview/backend && source .venv/bin/activate && make test'
alias pv-test-fe='cd /home/kity/lab/projects/peekview/frontend-v3 && npm run test -- --run'

# 快速构建
alias pv-build='cd /home/kity/lab/projects/peekview/frontend-v3 && npm run build'
```

---

最后更新: 2026-04-24
