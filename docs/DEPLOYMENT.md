# Peek 部署与使用指南

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

### 方式一：从 PyPI 安装（推荐，发布后可用）

```bash
pip install peek
```

### 方式二：从源码安装（当前可用）

```bash
# 1. 克隆仓库
git clone https://github.com/randomgitsrc/peek.git
cd peek/backend

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
peek --version
```

### 方式三：Docker 部署（可选）

```bash
# 构建镜像
docker build -t peek .

# 运行容器
docker run -d -p 8080:8080 -v peek-data:/data peek
```

---

## 启动服务

### 本地开发模式

```bash
# 默认启动（localhost:8080）
peek serve

# 指定端口
peek serve --port 3000

# 允许外部访问（局域网/服务器）
peek serve --host 0.0.0.0 --port 8080

# 后台运行（Linux）
nohup peek serve --host 0.0.0.0 --port 8080 > peek.log 2>&1 &
```

### 生产环境部署

#### Linux 服务器 + systemd

创建服务文件 `/etc/systemd/system/peek.service`：

```ini
[Unit]
Description=Peek Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/peek
Environment=PEEK_DATA_DIR=/var/peek/data
Environment=PEEK_DB_PATH=/var/peek/peek.db
Environment=PEEK_HOST=0.0.0.0
Environment=PEEK_PORT=8080
ExecStart=/opt/peek/venv/bin/peek serve
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
| `PEEK_DATA_DIR` | `~/.peek/data` | 文件存储目录 | `/var/peek/data` |
| `PEEK_DB_PATH` | `~/.peek/peek.db` | SQLite 数据库路径 | `/var/peek/peek.db` |
| `PEEK_HOST` | `127.0.0.1` | 服务绑定地址 | `0.0.0.0` |
| `PEEK_PORT` | `8080` | 服务端口 | `80` |
| `PEEK_API_KEY` | - | API 认证密钥 | `your-secret-key` |
| `PEEK_CORS_ORIGINS` | `http://localhost:5173` | CORS 允许来源 | `https://yourdomain.com` |
| `PEEK_ALLOWED_PATHS` | `[]` | 允许读取的本地路径 | `/home/user/docs,/data` |

### 配置文件（.env）

在项目目录创建 `.env` 文件：

```bash
# 数据和数据库
PEEK_DATA_DIR=/var/peek/data
PEEK_DB_PATH=/var/peek/peek.db

# 网络配置
PEEK_HOST=0.0.0.0
PEEK_PORT=8080

# 安全（建议生产环境启用）
PEEK_API_KEY=your-random-secret-key-here

# CORS（多域名用逗号分隔）
PEEK_CORS_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

加载配置：

```bash
# 方式1：导出环境变量
export $(cat .env | xargs)
peek serve

# 方式2：使用 direnv（自动加载）
# 安装 direnv，创建 .envrc 文件包含上述内容
```

---

## 使用教程

### 一、命令行（CLI）使用

#### 1. 创建条目

```bash
# 从单个文件创建
peek create script.py -s "Python脚本" -t python

# 从多个文件创建
peek create src/*.py README.md -s "Python项目" -t python -t project

# 从目录创建（递归）
peek create ./docs -s "文档集合" -t docs

# 从标准输入创建
echo "console.log('hello')" | peek create -s "JS代码" --from-stdin

# 指定自定义 slug
peek create report.md -s "月度报告" --slug monthly-report-2024
```

#### 2. 查看条目

```bash
# 查看详情
peek get monthly-report-2024

# 以 JSON 格式输出
peek get monthly-report-2024 --format json
```

#### 3. 列出入库

```bash
# 基本列表
peek list

# 分页
peek list --page 2 --per-page 50

# 搜索
peek list -q "python function"

# 按标签过滤
peek list -t python -t cli

# 组合查询
peek list -q "api" -t python --page 1 --per-page 10
```

#### 4. 删除条目

```bash
# 删除（会要求确认）
peek delete monthly-report-2024

# 强制删除（无需确认）
peek delete monthly-report-2024 --force
```

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

# 获取条目列表
curl http://localhost:8080/api/v1/entries

# 获取条目详情
curl http://localhost:8080/api/v1/entries/{slug}

# 搜索
curl "http://localhost:8080/api/v1/entries?q=python"

# 删除条目
curl -X DELETE http://localhost:8080/api/v1/entries/{slug}
```

---

## 卸载清理

### 方式一：pip 卸载（如果是 pip 安装）

```bash
# 1. 停止服务
pkill -f "peek serve"

# 2. 卸载包
pip uninstall peek -y

# 3. 清理数据（可选）
rm -rf ~/.peek
```

### 方式二：源码卸载

```bash
# 1. 停止服务
pkill -f "peek serve"

# 2. 退出虚拟环境
deactivate

# 3. 删除项目目录
cd ..
rm -rf peek

# 4. 清理数据（可选）
rm -rf ~/.peek
# 或如果自定义了数据目录
rm -rf /var/peek
```

### 方式三：systemd 服务卸载

```bash
# 1. 停止并禁用服务
sudo systemctl stop peek
sudo systemctl disable peek

# 2. 删除服务文件
sudo rm /etc/systemd/system/peek.service
sudo systemctl daemon-reload

# 3. 卸载程序和数据
sudo rm -rf /opt/peek
sudo rm -rf /var/peek
```

### 清理内容清单

| 路径 | 内容 | 是否必须清理 |
|------|------|-------------|
| `~/.peek/data/` | 上传的文件 | 可选 |
| `~/.peek/peek.db` | SQLite 数据库 | 可选 |
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
peek serve --port 8081

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
ls backend/peek/static/index.html

# 重新构建前端
cd frontend
npm run build
cp -r dist ../backend/peek/static
```

#### 2. API 返回 500

```bash
# 查看日志
peek serve  # 前台运行查看报错

# 检查数据库权限
ls -la ~/.peek/peek.db
```

### 数据备份

```bash
# 备份数据和数据库
cp -r ~/.peek /backup/peek-backup-$(date +%Y%m%d)

# 恢复
cp -r /backup/peek-backup-xxx ~/.peek
```

---

## 获取帮助

- **CLI 帮助**: `peek --help` 或 `peek <command> --help`
- **API 文档**: 启动服务后访问 `http://localhost:8080/docs`
- **项目主页**: https://github.com/randomgitsrc/peek
