# PeekView + MCP Server 完整部署指南

> 适用于 VPS 的 Agent 部署手册

---

## 📋 环境要求

| 项目 | 要求 | 说明 |
|------|------|------|
| Python | >=3.10 | PeekView 后端运行环境 |
| Node.js | >=18 | MCP Server 运行环境 |
| 内存 | 512MB+ | 建议 1GB |
| 磁盘 | 500MB+ | 数据存储 |
| 端口 | 8080, 33333 | PeekView 和 MCP Server |

---

## 🚀 快速部署（5 分钟）

### Step 1: 安装 PeekView（Python）

```bash
# 安装 pipx（推荐）
pip install pipx
pipx ensurepath

# 安装 PeekView
pipx install peekview

# 验证安装
peekview --version
# 输出: 0.1.31
```

### Step 2: 启动 PeekView

```bash
# 方式 1: 前台运行（测试）
peekview serve --host 0.0.0.0 --port 8080

# 方式 2: 后台运行（生产）
nohup peekview serve --host 0.0.0.0 --port 8080 > peekview.log 2>&1 &

# 方式 3: 系统服务（推荐）
sudo peekview service install --host 0.0.0.0 --port 8080
peekview service status
```

### Step 3: 获取 API Key

```bash
# 注册用户（第一个用户自动成为管理员）
peekview user create admin

# 创建 API Key
peekview apikey create "MCP Server"
# 输出: pv_xxxxxxxxxx（保存这个 Key）
```

### Step 4: 安装 MCP Server（Node.js）

```bash
# 确保 Node.js >=18
node --version

# 安装 MCP Server
npm install -g @peekview/mcp-server

# 验证安装
peekview-mcp --version
# 输出: 0.2.2
```

### Step 5: 配置并启动 MCP Server

```bash
# 设置环境变量
export PEEKVIEW_URL=http://127.0.0.1:8080
export PEEKVIEW_PUBLIC_URL=http://your-vps-ip:8080
export PEEKVIEW_API_KEY=pv_your_api_key_here

# 启动 MCP Server
peekview-mcp serve

# 或后台运行
nohup peekview-mcp serve > mcp.log 2>&1 &
```

### Step 6: 验证部署

```bash
# 测试 PeekView
curl http://localhost:8080/health

# 测试 MCP Server
curl http://localhost:33333/health
```

---

## 🔧 配置为系统服务（推荐生产环境）

### PeekView 服务

```bash
# 创建服务
sudo tee /etc/systemd/system/peekview.service << 'EOF'
[Unit]
Description=PeekView Service
After=network.target

[Service]
Type=simple
User=$USER
Environment=PEEKVIEW_SERVER__HOST=0.0.0.0
Environment=PEEKVIEW_SERVER__PORT=8080
Environment=PEEKVIEW_STORAGE__DATA_DIR=/home/$USER/.peekview/data
Environment=PEEKVIEW_STORAGE__DB_PATH=/home/$USER/.peekview/peekview.db
ExecStart=/home/$USER/.local/bin/peekview serve
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# 启动服务
sudo systemctl daemon-reload
sudo systemctl enable peekview
sudo systemctl start peekview
sudo systemctl status peekview
```

### MCP Server 服务

```bash
# 创建服务
sudo tee /etc/systemd/system/peekview-mcp.service << 'EOF'
[Unit]
Description=PeekView MCP Server
After=network.target peekview.service

[Service]
Type=simple
User=$USER
Environment=PEEKVIEW_URL=http://127.0.0.1:8080
Environment=PEEKVIEW_PUBLIC_URL=http://127.0.0.1:8080
Environment=PEEKVIEW_API_KEY=pv_your_api_key_here
ExecStart=/home/$USER/.npm-global/bin/peekview-mcp serve
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# 启动服务
sudo systemctl daemon-reload
sudo systemctl enable peekview-mcp
sudo systemctl start peekview-mcp
sudo systemctl status peekview-mcp
```

---

## 🔗 配置到 Claude Code / Cursor

### 使用 SSE 传输

```bash
# 添加到 Claude Code
claude mcp add peekview \
  -t sse \
  http://your-vps-ip:33333/sse \
  --header "Authorization: Bearer pv_your_api_key"

# 验证连接
claude mcp list
```

### MCP 工具列表

配置成功后，Agent 可以使用以下工具：

| 工具 | 功能 |
|------|------|
| `create_entry` | 创建代码/文档条目 |
| `get_entry` | 获取条目详情 |
| `list_entries` | 列出现有条目 |
| `delete_entry` | 删除条目 |

---

## ⚠️ 踩坑记录

### 问题 1: `peekview-mcp: command not found`

**原因**: npm 全局 bin 目录不在 PATH 中

**解决**:
```bash
# 添加到 PATH
echo 'export PATH="$PATH:$(npm config get prefix)/bin"' >> ~/.bashrc
source ~/.bashrc

# 或直接使用 npx
npx -y @peekview/mcp-server --version
```

### 问题 2: `pipx install peekview` 失败（Python 版本）

**原因**: Python < 3.10

**解决**:
```bash
# 安装 Python 3.10+
# Ubuntu/Debian:
sudo apt update
sudo apt install python3.10 python3.10-pip

# 然后使用指定 Python
pipx install peekview --python python3.10
```

### 问题 3: MCP Server `PEEKVIEW_URL: Required` 错误

**原因**: 缺少环境变量

**解决**:
```bash
# 设置必要的环境变量
export PEEKVIEW_URL=http://127.0.0.1:8080
export PEEKVIEW_PUBLIC_URL=http://your-vps-ip:8080

# 然后启动
peekview-mcp serve
```

### 问题 4: `--version` 也需要配置

**已修复**: 升级到 MCP Server >=0.2.2

```bash
npm install -g @peekview/mcp-server@latest
peekview-mcp --version  # 现在不需要配置了
```

### 问题 5: npm install 警告 `uuid@9` deprecated

**已修复**: 升级到 MCP Server >=0.2.1

```bash
npm cache clean --force
npm install -g @peekview/mcp-server@latest
```

### 问题 6: 端口被占用

```bash
# 检查端口占用
lsof -i :8080
lsof -i :33333

# 使用其他端口
peekview serve --port 8081
peekview-mcp serve  # MCP 默认 33333
```

### 问题 7: 防火墙阻止访问

```bash
# Ubuntu/Debian (ufw)
sudo ufw allow 8080/tcp
sudo ufw allow 33333/tcp
sudo ufw reload

# CentOS/RHEL (firewalld)
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --permanent --add-port=33333/tcp
sudo firewall-cmd --reload
```

---

## 📁 数据目录

| 服务 | 数据位置 | 说明 |
|------|---------|------|
| PeekView | `~/.peekview/data/` | 上传的文件 |
| PeekView | `~/.peekview/peekview.db` | SQLite 数据库 |
| MCP | 无本地存储 | 纯 API 转发 |

**备份**:
```bash
# 备份数据
tar czf peekview-backup-$(date +%Y%m%d).tar.gz ~/.peekview/

# 恢复数据
tar xzf peekview-backup-xxxx.tar.gz -C ~/
```

---

## 🔍 日志和调试

### 查看日志

```bash
# PeekView 日志
journalctl -u peekview -f

# MCP Server 日志
journalctl -u peekview-mcp -f

# 手动运行时的日志
peekview serve --log-level debug
peekview-mcp serve  # debug 日志在 stderr
```

### 健康检查

```bash
# PeekView
curl http://localhost:8080/health
# 预期: {"status":"ok","version":"0.1.31",...}

# MCP Server
curl http://localhost:33333/health
# 预期: {"status":"ok","version":"0.2.2",...}
```

---

## 🔄 升级

```bash
# 升级 PeekView
pipx upgrade peekview

# 升级 MCP Server
npm install -g @peekview/mcp-server@latest

# 重启服务
sudo systemctl restart peekview
sudo systemctl restart peekview-mcp
```

---

## 🗑️ 卸载

```bash
# 停止服务
sudo systemctl stop peekview peekview-mcp
sudo systemctl disable peekview peekview-mcp

# 卸载 PeekView
pipx uninstall peekview

# 卸载 MCP Server
npm uninstall -g @peekview/mcp-server

# 删除数据（谨慎）
rm -rf ~/.peekview/
```

---

## 📚 相关文档

- [PeekView README](https://github.com/randomgitsrc/peekview/blob/main/README.md)
- [MCP Server README](https://github.com/randomgitsrc/peekview/blob/main/packages/mcp-server/README.md)
- [完整部署指南](https://github.com/randomgitsrc/peekview/blob/main/docs/DEPLOYMENT.md)

---

## 💡 Agent 使用提示

**创建条目**: 使用 `create_entry` 工具，支持多文件
**访问链接**: 创建后会返回 `view_url`，可直接分享给人类
**私有条目**: 使用 `is_public: false` 创建私有条目
**API Key**: 通过 `pv_` 开头的 Key 认证，在 MCP 配置中设置

**一句话工作流**:
```
Agent: "我创建了一个代码审查报告"
→ create_entry(files=[{path:"review.md",content:"..."}], summary="代码审查")
→ 返回: http://vps-ip:8080/abc123
→ 人类点击链接查看格式化文档
```
