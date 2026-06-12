# PeekView 部署与使用指南

> 完整的环境部署、使用教程和卸载说明

## 📋 目录

1. [环境要求](#环境要求)
2. [安装部署](#安装部署)
3. [配置说明](#配置说明)
4. [使用教程](#使用教程)
5. [卸载清理](#卸载清理)
6. [故障排除](#故障排除)

---

## 环境要求

| 项目 | 最低版本 | 推荐版本 |
|------|---------|---------|
| Python | 3.12 | 3.12+ |
| 操作系统 | Linux/macOS/Windows | Linux |
| 内存 | 512MB | 1GB+ |
| 磁盘空间 | 100MB | 500MB+ |

---

## 安装部署

### 方式一：pipx 安装（推荐）

[pipx](https://pypa.github.io/pipx/) 是安装 Python CLI 应用的最佳方式，它会自动创建隔离的虚拟环境，避免依赖冲突。

```bash
# 安装 pipx（如果尚未安装）
# macOS: brew install pipx && pipx ensurepath
# Ubuntu/Debian: sudo apt install pipx && pipx ensurepath

# 安装 peekview
pipx install peekview

# 验证安装
peekview --version
```

**pipx 优势：**
- 自动隔离依赖，不会与系统 Python 包冲突
- 自动添加到 PATH
- 支持一键升级：`pipx upgrade peekview`
- 支持卸载：`pipx uninstall peekview`

### 方式二：pip 安装

如果无法使用 pipx，也可以用 pip 安装（建议使用虚拟环境）：

```bash
# 创建虚拟环境（避免与系统 Python 冲突）
python3 -m venv ~/.venvs/peekview
source ~/.venvs/peekview/bin/activate

# 安装
pip install peekview

# 创建符号链接到 PATH（可选）
ln -s ~/.venvs/peekview/bin/peekview ~/.local/bin/peekview
```

### 方式三：从源码安装（当前可用）

```bash
# 1. 克隆仓库
git clone https://github.com/randomgitsrc/peekview.git
cd peekview/backend

# 2. 创建虚拟环境（推荐）
python3 -m venv venv

# 3. 激活虚拟环境
# Linux/macOS:
source venv/bin/activate
# Windows:
# venv\Scripts\activate

# 4. 安装
pip install -e .

# 5. 验证安装
peekview --version
```

### 方式四：Docker 部署（可选）

```bash
# 构建镜像
docker build -t peek .

# 运行容器
docker run -d -p 8080:8080 -v peek-data:/data peek
```

### 方式五：系统服务部署（推荐生产环境）

PeekView 0.1.6+ 内置了服务管理命令，支持一键安装为系统服务：

#### Linux (systemd)

```bash
# 安装为系统服务（需要 sudo）
sudo peekview service install --base-url https://yourdomain.com

# 或使用用户级服务（无需 sudo，仅当前用户可用）
peekview service install --user --base-url https://yourdomain.com

# 管理命令
peekview service status    # 查看服务状态
peekview service start     # 启动服务
peekview service stop      # 停止服务
peekview service uninstall # 卸载服务
```

服务特性：
- 开机自启动
- 自动重启（崩溃后 5 秒重启）
- 日志管理（通过 `journalctl -u peekview` 查看）

#### macOS (launchd)

```bash
# 安装为用户服务
peekview service install --user

# 管理命令与 Linux 相同
peekview service status
```

#### 使用反向代理（Nginx + HTTPS）

结合 `--base-url` 选项使用反向代理：

```bash
# 1. 安装服务并指定外部域名
sudo peekview service install --base-url https://peek.yourdomain.com

# 2. 配置 Nginx
```

```nginx
server {
    listen 80;
    server_name peek.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name peek.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**为什么需要 `--base-url`**：
- 当使用反向代理时，PeekView 内部生成的 URL（如创建条目时返回的链接）需要知道外部域名
- 例如：`peekview create` 会返回 `https://peek.yourdomain.com/xxxxx` 而不是 `http://127.0.0.1:8080/xxxxx`

---

## 启动服务

### 本地开发模式

```bash
# 默认启动（localhost:8080）
peekview serve

# 指定端口
peekview serve --port 3000

# 允许外部访问（局域网/服务器）
peekview serve --host 0.0.0.0 --port 8080

# 后台运行（Linux）
nohup peekview serve --host 0.0.0.0 --port 8080 > peekview.log 2>&1 &
```

### 生产环境部署

#### Linux 服务器 + systemd

创建服务文件 `/etc/systemd/system/peekview.service`：

```ini
[Unit]
Description=Peek Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/peek
Environment=PEEKVIEW_STORAGE__DATA_DIR=/var/peek/data
Environment=PEEKVIEW_STORAGE__DB_PATH=/var/peek/peekview.db
Environment=PEEKVIEW_SERVER__HOST=0.0.0.0
Environment=PEEKVIEW_SERVER__PORT=8080
ExecStart=/opt/peek/venv/bin/peekview serve
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

启动服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable peek
sudo systemctl start peek
sudo systemctl status peek
```

#### Nginx 反向代理（推荐）

```nginx
server {
    listen 80;
    server_name peek.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name peek.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 配置说明

### 环境变量

| 变量 | 默认值 | 说明 | 示例 |
|------|--------|------|------|
| `PEEKVIEW_SERVER__HOST` | `0.0.0.0` | 服务绑定地址（仅本机访问设为 `127.0.0.1`） | `127.0.0.1` |
| `PEEKVIEW_SERVER__PORT` | `8080` | 服务端口 | `80` |
| `PEEKVIEW_SERVER__BASE_URL` | - | 外部访问 URL（用于反向代理） | `https://example.com` |
| `PEEKVIEW_SERVER__API_KEY` | - | 全局 API 认证密钥（创建 ownerless 条目） | `your-secret-key` |
| `PEEKVIEW_SERVER__CORS_ORIGINS` | `http://localhost:5173` | CORS 允许来源 | `https://yourdomain.com` |
| `PEEKVIEW_STORAGE__DATA_DIR` | `~/.peekview/data` | 文件存储目录 | `/var/peek/data` |
| `PEEKVIEW_STORAGE__DB_PATH` | `~/.peekview/peekview.db` | SQLite 数据库路径 | `/var/peek/peekview.db` |
| `PEEKVIEW_STORAGE__ALLOWED_PATHS` | `[]` | 允许读取的本地路径 | `/home/user/docs,/data` |
| `PEEKVIEW_AUTH__SECRET_KEY` | - | JWT 签名密钥（空=自动生成） | `your-jwt-secret` |
| `PEEKVIEW_AUTH__TOKEN_EXPIRE_DAYS` | `7` | JWT Token 有效期（天） | `30` |
| `PEEKVIEW_AUTH__ALLOW_REGISTRATION` | `true` | 是否允许新用户注册 | `false` |
| `PEEKVIEW_AUTH__ALLOW_ANONYMOUS_CREATE` | `true` | 是否允许匿名创建条目 | `false` |
| `PEEKVIEW_LIMITS__MAX_FILE_SIZE` | `10485760` | 单文件最大大小（10MB） | `20971520` |
| `PEEKVIEW_LIMITS__MAX_ENTRY_FILES` | `50` | 单条目最大文件数 | `100` |
| `PEEKVIEW_LIMITS__MAX_PER_PAGE` | `50` | 每页最大条目数 | `100` |
| `PEEKVIEW_CLEANUP__CHECK_ON_START` | `true` | 启动时检查过期条目 | `false` |
| `PEEKVIEW_CLEANUP__INTERVAL_SECONDS` | `3600` | 清理间隔（0=禁用） | `7200` |
| `PEEKVIEW_LOGGING__LEVEL` | `INFO` | 日志级别 | `DEBUG` |
| `PEEKVIEW_REMOTE__URL` | - | 远程服务端地址（远程 CLI 模式）| `https://peek.example.com` |
| `PEEKVIEW_REMOTE__API_KEY` | - | 远程 API 认证密钥 | `pv_your-key` |
| `PEEKVIEW_REMOTE__TOKEN` | - | 远程 JWT 用户 token | - |
| `PEEKVIEW_REMOTE__TIMEOUT` | `30` | 远程请求超时（秒）| `60` |
| `PEEKVIEW_REMOTE__VERIFY_SSL` | `true` | 远程 SSL 证书校验 | `false` |

**注意**：`__` 分隔符用于访问嵌套配置（如 `storage.data_dir` → `PEEKVIEW_STORAGE__DATA_DIR`）

### 配置文件（推荐生产环境）

创建 `~/.peekview/config.yaml`：

```yaml
server:
  host: 0.0.0.0
  port: 8080
  base_url: https://peek.yourdomain.com
storage:
  data_dir: /var/peek/data
  db_path: /var/peek/peekview.db
  allowed_paths:
    - /home/user/documents
auth:
  secret_key: ""  # 空=自动生成
  token_expire_days: 7
  allow_registration: true
  allow_anonymous_create: true
limits:
  max_file_size: 10485760
  max_entry_files: 50
  max_per_page: 50
remote:
  url: https://peek.yourdomain.com
  api_key: pv_your-api-key
  timeout: 30
  verify_ssl: true
```

**Remote CLI 配置说明**（v0.1.25+）：
- `remote.url`: 远程服务端地址，设置后 CLI 自动使用远程模式
- `remote.api_key`: 用户级 API Key（`pv_` 前缀）或全局 API Key
- `remote.token`: JWT 用户认证 token（通过 `peekview login` 获取）
- `remote.timeout`: HTTP 请求超时时间（秒）
- `remote.verify_ssl`: 是否验证 SSL 证书（自签名证书可设为 `false`）

### .env 文件（适合 Docker/临时配置）

```bash
# 数据和数据库
PEEKVIEW_STORAGE__DATA_DIR=/var/peek/data
PEEKVIEW_STORAGE__DB_PATH=/var/peek/peekview.db

# 网络配置
PEEKVIEW_SERVER__HOST=0.0.0.0
PEEKVIEW_SERVER__PORT=8080

# 安全（建议生产环境启用）
PEEKVIEW_SERVER__API_KEY=your-random-secret-key-here

# CORS（多域名用逗号分隔）
PEEKVIEW_SERVER__CORS_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

加载配置：

```bash
# 方式1：导出环境变量
export $(cat .env | xargs)
peekview serve

# 方式2：使用 direnv（自动加载）
# 安装 direnv，创建 .envrc 文件包含上述内容
```

---

## MCP Server 部署

MCP Server 允许 AI Agent（Claude Code、Cursor 等）通过 MCP 协议直接操作 PeekView。

### 方式一：Docker Compose（推荐）

```bash
# 使用项目自带的 docker-compose.yml
docker compose up -d

# 包含两个服务：
# - peekview (端口 8080)：主服务
# - mcp-server (端口 33333)：MCP Server
```

### 方式二：npm 全局安装

```bash
# 安装
npm install -g @peekview/mcp-server

# 启动（需要先运行 PeekView 后端）
PEEKVIEW_URL=http://127.0.0.1:8080 \
PEEKVIEW_PUBLIC_URL=http://127.0.0.1:8080 \
peekview-mcp serve
```

### 配置 AI Agent

**Claude Code：**

```bash
# 添加 MCP Server（使用你的 pv_ API Key）
claude mcp add peekview -t http http://localhost:33333/mcp \
  --header "Authorization: Bearer pv_your_api_key_here"
```

**Cursor / 其他 MCP 客户端：**

在 MCP 配置文件中添加：

```json
{
  "peekview": {
    "url": "http://localhost:33333/mcp",
    "headers": {
      "Authorization": "Bearer pv_your_api_key_here"
    }
  }
}
```

### MCP Server 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PEEKVIEW_URL` | 必填 | PeekView 后端 URL（内部访问） |
| `PEEKVIEW_PUBLIC_URL` | 必填 | PeekView 公开 URL（用于生成链接） |
| `MCP_PORT` | `33333` | MCP Server 端口 |
| `MCP_HOST` | `0.0.0.0` | 绑定地址 |
| `MCP_CORS_ORIGINS` | `*` | CORS 允许来源 |
| `LOG_LEVEL` | `info` | 日志级别 |

> **注意：** MCP Server v0.2.0 不再需要 `MCP_TOKEN` 或 `PEEKVIEW_API_KEY` 环境变量。用户通过 `pv_` API Key 认证，每个用户使用自己的 Key。

---

## 使用教程

### 一、命令行（CLI）使用

#### 1. 创建条目

```bash
# 从单个文件创建
peekview create script.py -s "Python脚本" -t python

# 从多个文件创建
peekview create src/*.py README.md -s "Python项目" -t python -t project

# 从目录创建（递归）
peekview create ./docs -s "文档集合" -t docs

# 从标准输入创建
echo "console.log('hello')" | peekview create -s "JS代码" --from-stdin

# 指定自定义 slug
peekview create report.md -s "月度报告" --slug monthly-report-2024

# 使用自定义域名（适用于反向代理场景）
peekview create report.md -s "月度报告" --base-url https://example.com
# 输出: URL: https://example.com/monthly-report-2024
```

**注意**：`--base-url` 用于指定外部访问域名，当你使用反向代理（如 Nginx、Cloudflare Tunnel）时，
创建条目返回的 URL 会使用这个域名而不是默认的 `http://127.0.0.1:8080`。

#### 2. 查看条目

```bash
# 查看详情
peekview get monthly-report-2024

# 以 JSON 格式输出
peekview get monthly-report-2024 --format json
```

#### 3. 列出入库

```bash
# 基本列表
peekview list

# 分页
peekview list --page 2 --per-page 50

# 搜索
peekview list -q "python function"

# 按标签过滤
peekview list -t python -t cli

# 组合查询
peekview list -q "api" -t python --page 1 --per-page 10
```

#### 4. 删除条目

```bash
# 删除（会要求确认）
peekview delete monthly-report-2024

# 强制删除（无需确认）
peekview delete monthly-report-2024 --force
```

#### 5. 用户管理

```bash
# 创建用户（提示输入密码）
peekview user create <username>

# 列出所有用户
peekview user list

# 提升为管理员
peekview user promote <username>

# 降级管理员
peekview user demote <username>

# 登录远程服务器（获取 JWT token）
peekview login --remote-url https://peek.example.com --username <user>
```

#### 6. API Key 管理（v0.1.26+）

```bash
# 创建 API Key
peekview apikey create "CI Bot"

# 带过期时间
peekview apikey create "Temp Key" --expires 30d

# 列出所有 API Key
peekview apikey list

# 撤销 API Key
peekview apikey revoke <key_id>

# 清理过期 Key
peekview apikey cleanup
```

**API Key 说明**：
- 格式：`pv_` 前缀 + 24 字符 token
- 用户级 API Key = JWT 等价权限（正常所有权检查）
- 全局 API Key (`PEEKVIEW_SERVER__API_KEY`) 创建 ownerless 条目
- 每用户最多 10 个活跃 Key
- 支持过期时间：7d、30d、90d、永不

#### 7. Remote CLI 模式（v0.1.25+）

Remote CLI 模式允许你从其他机器通过 CLI 连接远程 PeekView 服务端：

```bash
# 配置远程服务端（方式1：Config 文件）
peekview config set remote.url https://peek.example.com
peekview config set remote.api_key sk-your-api-key

# 配置远程服务端（方式2：环境变量）
export PEEKVIEW_REMOTE__URL=https://peek.example.com
export PEEKVIEW_REMOTE__API_KEY=sk-your-api-key

# 配置远程服务端（方式3：命令行参数）
peekview create file.txt -s "My code" --remote-url https://peek.example.com

# 所有 CLI 命令在配置后自动使用远程模式
peekview create file.txt -s "Test"           # 上传到远程服务端
peekview list                                 # 列出远程条目
peekview get my-entry                         # 获取远程条目详情
peekview delete my-entry                      # 删除远程条目

# 临时使用本地模式（覆盖远程配置）
peekview create file.txt -s "Local only" --remote-url ""
```

**Remote CLI 限制**：
- 仅支持文本文件（二进制文件会被跳过）
- 不支持 `local_path` 模式（无法访问服务端本地文件）
- 目录扫描在客户端完成，然后上传文件内容

### 二、Web 界面使用

启动服务后，通过浏览器访问 `http://localhost:8080`（或配置的地址）。

#### 1. 首页 - 条目列表

- 查看所有条目卡片
- 使用搜索框搜索内容
- 点击标签过滤
- 分页导航

#### 2. 条目详情页

- **代码文件**：语法高亮、行号、复制按钮、换行切换
- **Markdown**：渲染后的文档、目录导航
- **多文件**：左侧文件树点击切换
- **移动端**：底部工具栏操作（复制、下载、主题切换）

#### 3. 主题切换

- 点击右上角主题按钮切换深色/浅色模式
- 自动保存偏好到本地存储

### 三、API 使用

```bash
# 创建条目
curl -X POST http://localhost:8080/api/v1/entries \
  -H "Content-Type: application/json" \
  -d '{
    "summary": "Test Entry",
    "files": [{"filename": "test.py", "content": "print(1)"}]
  }'

# 创建私有条目（需 JWT）
curl -X POST http://localhost:8080/api/v1/entries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <jwt>" \
  -d '{"summary": "Private", "is_public": false, "files": [...]}'

# 使用 API Key 创建条目
curl -X POST http://localhost:8080/api/v1/entries \
  -H "Content-Type: application/json" \
  -H "X-API-Key: pv_your-key" \
  -d '{"summary": "Via API Key", "files": [...]}'

# 获取条目列表
curl http://localhost:8080/api/v1/entries

# 筛选自己的条目
curl -H "Authorization: Bearer <jwt>" \
  "http://localhost:8080/api/v1/entries?owner=me"

# 搜索
curl "http://localhost:8080/api/v1/entries?q=python"

# 用户注册
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "user1", "password": "pass123"}'

# 用户登录
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "user1", "password": "pass123"}'

# 创建 API Key（需 JWT）
curl -X POST http://localhost:8080/api/v1/apikeys \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <jwt>" \
  -d '{"name": "CI Bot", "expires_in": "30d"}'

# 列出 API Key
curl -H "Authorization: Bearer <jwt>" \
  http://localhost:8080/api/v1/apikeys

# 删除条目
curl -X DELETE http://localhost:8080/api/v1/entries/{slug}
```

---

## 卸载清理

### 方式一：pip 卸载（如果是 pip 安装）

```bash
# 1. 停止服务
pkill -f "peekview serve"

# 2. 卸载包
pip uninstall peekview -y

# 3. 清理数据（可选）
rm -rf ~/.peekview
```

### 方式二：源码卸载

```bash
# 1. 停止服务
pkill -f "peekview serve"

# 2. 退出虚拟环境
deactivate

# 3. 删除项目目录
cd ..
rm -rf peek

# 4. 清理数据（可选）
rm -rf ~/.peekview
# 或如果自定义了数据目录
rm -rf /var/peek
```

### 方式三：系统服务卸载（推荐）

如果你使用 `peekview service install` 安装的服务：

```bash
# 卸载系统服务
sudo peekview service uninstall

# 或卸载用户服务
peekview service uninstall --user

# 4. 卸载程序
pip uninstall peekview -y

# 5. 清理数据（可选）
rm -rf ~/.peekview
```

### 方式四：手动 systemd 服务卸载（旧方式）

### 清理内容清单

| 路径 | 内容 | 是否必须清理 |
|------|------|-------------|
| `~/.peekview/data/` | 上传的文件 | 可选 |
| `~/.peekview/peekview.db` | SQLite 数据库 | 可选 |
| 安装目录 | 程序文件 | 是 |
| 虚拟环境 | Python 依赖 | 是 |

---

## 故障排除

### 安装问题

#### 1. pip install 失败

```bash
# 错误：externally-managed-environment
# 解决方案：使用虚拟环境
python3 -m venv venv
source venv/bin/activate
pip install -e .
```

#### 2. 权限不足

```bash
# 安装到用户目录
pip install --user -e .

# 或使用虚拟环境（推荐）
```

### 启动问题

#### 1. 端口被占用

```bash
# 错误：Address already in use
# 解决方案：更换端口
peekview serve --port 8081

# 或查找并停止占用进程
lsof -i :8080
kill -9 <PID>
```

#### 2. 权限拒绝

```bash
# 低端口需要 root（不推荐）
# 推荐：使用 Nginx 反向代理到 80/443
```

### 使用问题

#### 1. 前端白屏/404

```bash
# 确认静态文件存在
ls backend/peekview/static/index.html

# 重新构建前端
cd frontend-v3
npm run build
cp -r dist ../backend/peekview/static
```

#### 2. API 返回 500

```bash
# 查看日志
peekview serve  # 前台运行查看报错

# 检查数据库权限
ls -la ~/.peekview/peekview.db
```

### 数据备份

```bash
# 备份数据和数据库
cp -r ~/.peekview /backup/peek-backup-$(date +%Y%m%d)

# 恢复
cp -r /backup/peek-backup-xxx ~/.peekview
```

---

## 获取帮助

- **CLI 帮助**: `peekview --help` 或 `peek <command> --help`
- **API 文档**: 启动服务后访问 `http://localhost:8080/docs`
- **项目主页**: https://github.com/randomgitsrc/peekview
