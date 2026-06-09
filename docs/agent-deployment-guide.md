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

### Step 5: 配置 MCP Server

```bash
# 配置 PeekView 地址
peekview-mcp config set peekview.url http://127.0.0.1:8080
peekview-mcp config set peekview.public_url http://your-vps-ip:8080

# 验证配置
peekview-mcp config list
```

### Step 6: 启动服务（两种方式）

**方式 1：前台启动（测试）**
```bash
peekview-mcp serve
```

**方式 2：安装为系统服务（推荐生产环境）**
```bash
# 安装为 systemd 用户服务（无需 sudo）
peekview-mcp service install --user

# 启动服务
peekview-mcp service start
peekview-mcp service status
```

### Step 7: 验证部署

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

**推荐方式：使用 service 命令（自动配置）**

```bash
# 确保配置已创建
peekview-mcp config list

# 安装为 systemd 服务
peekview-mcp service install --user     # 用户级服务（无需 sudo，推荐）
# 或
sudo peekview-mcp service install       # 系统级服务（需要 sudo）

# 管理服务
peekview-mcp service start
peekview-mcp service status
peekview-mcp service restart
peekview-mcp service stop

# 卸载服务
peekview-mcp service uninstall --user
```

**备选方式：手动创建服务文件**

如果 `service` 命令无法使用，可以手动创建：

```bash
# 创建服务
sudo tee /etc/systemd/system/peekview-mcp.service << 'EOF'
[Unit]
Description=PeekView MCP Server
After=network.target peekview.service

[Service]
Type=simple
User=$USER
Environment="PEEKVIEW_URL=http://127.0.0.1:8080"
Environment="PEEKVIEW_PUBLIC_URL=http://127.0.0.1:8080"
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

### 使用 Streamable HTTP 传输

```bash
# 添加到 Claude Code
claude mcp add peekview \
  -t http \
  http://your-vps-ip:33333/mcp \
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

### 问题 3: `PEEKVIEW_URL: Required` 错误

**原因**: 缺少配置

**解决**:
```bash
# 方法 1：使用 config 命令（推荐）
peekview-mcp config set peekview.url http://127.0.0.1:8080
peekview-mcp config set peekview.public_url http://your-vps-ip:8080
peekview-mcp config list  # 验证

# 方法 2：使用环境变量
export PEEKVIEW_URL=http://127.0.0.1:8080
export PEEKVIEW_PUBLIC_URL=http://your-vps-ip:8080
peekview-mcp serve
```

### 问题 4: `peekview.url` 和 `peekview.public_url` 有什么区别？

**一句话总结**：
- `peekview.url`: MCP Server 调用 PeekView API 的地址（只需要 MCP Server 能访问即可）
- `peekview.public_url`: 生成给用户浏览器查看条目的地址（必须能被用户浏览器访问）

**三种典型部署场景**：

#### 场景一：单服务器部署（最简单）

MCP Server 和 PeekView 在同一台机器上：

```
┌─────────────────────────────────────────┐
│              服务器                      │
│  ┌─────────────┐    ┌─────────────┐   │
│  │ MCP Server  │───►│  PeekView   │   │
│  │  :33333     │    │  :8080      │   │
│  └─────────────┘    └─────────────┘   │
└─────────────────────────────────────────┘
```

```bash
peekview-mcp config set peekview.url http://localhost:8080
peekview-mcp config set peekview.public_url http://localhost:8080
```

---

#### 场景二：多服务器 + 内网互通（推荐生产环境）

两台服务器有内网互通，PeekView 不直接暴露公网：

```
┌─────────────────┐         内网          ┌─────────────────┐
│   MCP Server    │◄────────────────────►│    PeekView      │
│   (服务器A)      │    10.0.0.x 网段    │    (服务器B)      │
│   公网:33333    │                     │    内网:8080     │
└────────┬────────┘                     └────────┬────────┘
         │                                         │
         │                                         │
     用户电脑 (HTTP)                          Nginx 反向代理
    (外网访问)                                peek.example.com
```

```bash
# MCP Server 通过内网访问 PeekView
peekview-mcp config set peekview.url http://10.0.0.5:8080

# 用户通过公网域名查看条目
peekview-mcp config set peekview.public_url https://peek.example.com
```

**优势**：
- MCP Server 通过内网调用 PeekView（更安全、更低延迟）
- PeekView 不直接暴露公网，通过 Nginx 反向代理

---

#### 场景三：多服务器 + 仅公网互通

两台服务器没有内网互通，只能通过公网访问：

```
┌─────────────────┐         公网           ┌─────────────────┐
│   MCP Server    │◄────────────────────►│    PeekView      │
│   (服务器A)      │                      │    (服务器B)      │
│   公网:33333    │                      │    公网:8080     │
└────────┬────────┘                      └────────┬────────┘
         │                                         │
         │                                         │
     用户电脑 (HTTP)                          用户浏览器
    (外网访问)                                (外网访问)
```

```bash
# 两台服务器只能通过公网通信
peekview-mcp config set peekview.url https://peek.example.com
peekview-mcp config set peekview.public_url https://peek.example.com
```

**适用场景**：云服务器分布在不同地域/可用区，无内网互通

---

**常见问题**：

Q: 服务器 A 和 B 不在一个内网，`peekview.url` 能访问到吗？  
A: 如果 B 的 8080 端口在公网可访问（或绑定了公网 IP），可以。此时 `peekview.url` 应该填 B 的公网地址。

Q: PeekView 监听 `0.0.0.0:8080` 时可以设置 `url` 为公网 `example.com` 吗？  
A: 可以。`0.0.0.0` 表示监听所有接口，包括公网。只要防火墙/安全组允许，就可以用公网域名访问。

---

**配置速查表**：

| 部署方式 | peekview.url | peekview.public_url |
|---------|-------------|---------------------|
| 单服务器/本地开发 | `http://localhost:8080` | `http://localhost:8080` |
| 多服务器+内网 | `http://<内网IP>:8080` | `https://<公网域名>` |
| 多服务器+仅公网 | `https://<公网域名>` | `https://<公网域名>` |

### 问题 5: `--version` 也需要配置

**已修复**: 升级到 MCP Server >=0.2.2

```bash
npm install -g @peekview/mcp-server@latest
peekview-mcp --version  # 现在不需要配置了
```

### 问题 6: npm install 警告 `uuid@9` deprecated

**已修复**: 升级到 MCP Server >=0.2.1

```bash
npm cache clean --force
npm install -g @peekview/mcp-server@latest
```

### 问题 7: 端口被占用

```bash
# 检查端口占用
lsof -i :8080
lsof -i :33333

# 修改 MCP Server 端口
peekview-mcp config set server.port 33334
peekview-mcp serve  # 现在使用 33334 端口

# 或使用环境变量临时修改
MCP_PORT=33334 peekview-mcp serve
```

### 问题 8: service 命令失败

**原因**: 未创建配置文件

**解决**:
```bash
# 必须先创建配置才能安装服务
peekview-mcp config set peekview.url http://localhost:8080
peekview-mcp config set peekview.public_url http://localhost:8080

# 然后安装服务
peekview-mcp service install --user
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

### 推荐方式：使用 uninstall 命令（最简单）

```bash
# 卸载 PeekView（交互式，会询问确认）
peekview uninstall

# 跳过确认直接卸载
peekview uninstall -y

# 卸载但保留数据目录
peekview uninstall -y --keep-data

# 查看 MCP Server 卸载说明
peekview-mcp uninstall

# 然后执行卸载
npm uninstall -g @peekview/mcp-server
```

### 方式一：完全卸载（删除所有内容）

```bash
#!/bin/bash
# save as: uninstall-peekview.sh
# chmod +x uninstall-peekview.sh
# ./uninstall-peekview.sh

echo "=== PeekView + MCP Server 完全卸载 ==="

# 1. 停止并删除系统服务
echo "→ 停止服务..."
sudo systemctl stop peekview peekview-mcp 2>/dev/null || true
sudo systemctl disable peekview peekview-mcp 2>/dev/null || true
sudo rm -f /etc/systemd/system/peekview.service
sudo rm -f /etc/systemd/system/peekview-mcp.service
sudo systemctl daemon-reload

# 2. 卸载 PeekView
echo "→ 卸载 PeekView..."
pipx uninstall peekview 2>/dev/null || pip uninstall -y peekview 2>/dev/null || true

# 3. 卸载 MCP Server
echo "→ 卸载 MCP Server..."
npm uninstall -g @peekview/mcp-server 2>/dev/null || true

# 4. 清理数据
echo "→ 清理数据目录..."
read -p "⚠️  确定要删除所有数据吗？包括数据库和上传的文件？[y/N] " confirm
if [ "$confirm" = "y" ]; then
    rm -rf ~/.peekview/
    rm -rf /tmp/peekview-*
    echo "✓ 数据已删除"
else
    echo "ℹ  保留数据目录: ~/.peekview/"
fi

# 5. 清理日志
echo "→ 清理日志..."
sudo rm -f /var/log/peekview*.log 2>/dev/null || true
sudo journalctl --vacuum-time=1s --unit=peekview --unit=peekview-mcp 2>/dev/null || true

echo ""
echo "=== 卸载完成 ==="
echo "如需重新安装，请运行:"
echo "  pipx install peekview"
echo "  npm install -g @peekview/mcp-server"
```

### 方式二：分步卸载（按需选择）

#### 只卸载服务（保留数据和配置）

```bash
# 停止并禁用服务
sudo systemctl stop peekview peekview-mcp
sudo systemctl disable peekview peekview-mcp

# 删除服务文件
sudo rm -f /etc/systemd/system/peekview.service
sudo rm -f /etc/systemd/system/peekview-mcp.service
sudo systemctl daemon-reload

echo "✓ 服务已卸载，数据保留在 ~/.peekview/"
```

#### 卸载 PeekView（保留 MCP Server）

```bash
# 停止服务
sudo systemctl stop peekview 2>/dev/null || true

# 卸载
pipx uninstall peekview

# 或如果是 pip 安装
pip uninstall peekview
```

#### 卸载 MCP Server（保留 PeekView）

```bash
# 停止服务
sudo systemctl stop peekview-mcp 2>/dev/null || true

# 卸载
npm uninstall -g @peekview/mcp-server

# 清理环境变量（从 ~/.bashrc 或 ~/.profile 中删除）
sed -i '/PEEKVIEW_URL/d' ~/.bashrc
sed -i '/PEEKVIEW_API_KEY/d' ~/.bashrc
```

### 方式三：手动清理（如果自动卸载失败）

```bash
# 查找并删除 PeekView 相关文件
which peekview
# 手动删除: rm -f /path/to/peekview

# 查找并删除 MCP Server
which peekview-mcp
ls $(npm config get prefix)/bin/peekview-mcp
rm -f $(npm config get prefix)/bin/peekview-mcp

# 清理 npm 缓存
npm cache clean --force

# 清理 pip/pipx 缓存
pipx uninstall peekview 2>/dev/null || true
pip cache purge
```

### 卸载检查清单

卸载后确认以下内容已删除：

```bash
# 检查服务
systemctl status peekview 2>&1 | grep "Active: failed" && echo "✓ PeekView 服务已停止" || echo "✗ 服务仍在运行"
systemctl status peekview-mcp 2>&1 | grep "Active: failed" && echo "✓ MCP 服务已停止" || echo "✗ 服务仍在运行"

# 检查命令
which peekview && echo "✗ peekview 命令仍存在" || echo "✓ peekview 已删除"
which peekview-mcp && echo "✗ peekview-mcp 命令仍存在" || echo "✓ peekview-mcp 已删除"

# 检查数据（确认是否保留）
ls -la ~/.peekview 2>/dev/null && echo "ℹ 数据目录仍存在" || echo "✓ 数据目录已删除"

# 检查端口
lsof -i :8080 2>/dev/null | grep peekview && echo "✗ 端口 8080 仍被占用" || echo "✓ 端口 8080 已释放"
lsof -i :33333 2>/dev/null | grep peekview-mcp && echo "✗ 端口 33333 仍被占用" || echo "✓ 端口 33333 已释放"
```

### 重新安装

卸载后如需重新安装：

```bash
# 完整重装
pipx install peekview
npm install -g @peekview/mcp-server

# 恢复数据（如果备份了）
tar xzf peekview-backup-xxxx.tar.gz -C ~/

# 重新配置服务
sudo systemctl start peekview
sudo systemctl start peekview-mcp
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
