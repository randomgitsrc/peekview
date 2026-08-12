# MCP Server 配置系统设计文档

> 状态: Draft  
> 作者: Claude  
> 日期: 2026-05-22

---

## 问题概述

当前 MCP Server 配置只能通过环境变量传递，生产环境部署不友好：

```bash
# 当前方式：必须设置环境变量
export PEEKVIEW_URL=http://127.0.0.1:8080
export PEEKVIEW_API_KEY=pv_xxx
peekview-mcp serve
```

**问题：**
1. 无配置文件支持，配置项多时不便管理
2. 无 service 管理命令，需手动编写 systemd 脚本
3. 配置分散在文档各处，无统一入口

---

## 目标

1. **配置文件支持**: `~/.peekview/mcp-config.yaml`
2. **配置层级**: CLI 参数 > 环境变量 > 配置文件 > 代码默认值
3. **CLI 命令**: `peekview-mcp config set/get/list`
4. **服务管理**: `peekview-mcp service install/start/stop/status/uninstall`

---

## 配置层级

```
1. CLI 参数 (最高优先级)
   peekview-mcp serve --port 33334

2. 环境变量
   PEEKVIEW_MCP_PORT=33334

3. 配置文件 (~/.peekview/mcp-config.yaml)

4. 代码默认值 (最低优先级)
```

---

## 配置文件结构

### mcp-config.yaml

```yaml
# MCP Server 配置文件
# 位置: ~/.peekview/mcp-config.yaml
# ⚠️ 安全警告: 不要将 api_key 提交到版本控制
# 建议使用环境变量 PEEKVIEW_API_KEY 替代配置文件中的 api_key

# === 连接 PeekView ===
peekview:
  url: http://127.0.0.1:8080          # PeekView API 地址
  public_url: http://localhost:8080   # 对外暴露的 URL（用于生成链接）
  # api_key: ""                       # 可选：建议改用环境变量 PEEKVIEW_API_KEY

# === 服务器配置 ===
server:
  host: "0.0.0.0"                     # 监听地址
  port: 33333                         # 监听端口
  cors_origins: "*"                   # CORS 源（逗号分隔）

# === 日志配置 ===
logging:
  level: info                         # debug | info | warn | error
```

### 环境变量映射

| 环境变量 | 配置键 | 默认值 |
|----------|--------|--------|
| `PEEKVIEW_URL` | `peekview.url` | - (必填) |
| `PEEKVIEW_PUBLIC_URL` | `peekview.public_url` | - (必填) |
| `PEEKVIEW_API_KEY` | `peekview.api_key` | "" |
| `PEEKVIEW_MCP_HOST` | `server.host` | "0.0.0.0" |
| `PEEKVIEW_MCP_PORT` | `server.port` | 33333 |
| `PEEKVIEW_MCP_CORS_ORIGINS` | `server.cors_origins` | "*" |
| `PEEKVIEW_MCP_LOG_LEVEL` | `logging.level` | "info" |

---

## CLI 命令设计

### 全局选项

```bash
# 显示帮助
peekview-mcp --help
peekview-mcp -h

# 显示版本
peekview-mcp --version
peekview-mcp -v

# 示例输出
$ peekview-mcp --help
PeekView MCP Server - Model Context Protocol Server for PeekView

Usage: peekview-mcp [command] [options]

Commands:
  serve [options]    Start the MCP Server
  config             Manage configuration
  service            Manage system service
  version            Show version

Global Options:
  -h, --help         Show help
  -v, --version      Show version

Examples:
  peekview-mcp serve                    # Start with config file
  peekview-mcp serve --port 33334       # Start with custom port
  peekview-mcp config set server.port 33334
  peekview-mcp service install --user

Config file: ~/.peekview/mcp-config.yaml
```

### serve 命令（现有，需更新帮助格式）

```bash
# 启动服务（使用配置文件）
peekview-mcp serve

# 启动并覆盖配置
peekview-mcp serve --port 33334 --host 127.0.0.1

# 帮助
peekview-mcp serve --help
# Output:
# Usage: peekview-mcp serve [options]
#
# Start the MCP Server
#
# Options:
#   --port <port>      Server port (default: 33333, or from config)
#   --host <host>      Server host (default: 0.0.0.0, or from config)
#   --help             Show help
#
# Environment:
#   PEEKVIEW_URL       PeekView API URL (required)
#   PEEKVIEW_PUBLIC_URL  PeekView public URL (required)
#   PEEKVIEW_API_KEY   API Key for authentication (optional)
```

### config 子命令

```bash
# 帮助
peekview-mcp config --help
# Output:
# Usage: peekview-mcp config [command]
#
# Manage MCP Server configuration
#
# Commands:
#   set <key> <value>  Set a configuration value
#   get <key>          Get a configuration value
#   list               List all configuration values
#
# Examples:
#   peekview-mcp config set peekview.url http://localhost:8080
#   peekview-mcp config get server.port
#   peekview-mcp config list

# 设置配置值
peekview-mcp config set peekview.url http://127.0.0.1:8080
peekview-mcp config set server.port 33334
peekview-mcp config set logging.level debug

# 获取配置值
peekview-mcp config get peekview.url
# Output: http://127.0.0.1:8080

# 获取全部配置
peekview-mcp config list
# Output:
# Configuration from ~/.peekview/mcp-config.yaml
# 
# peekview:
#   url: http://127.0.0.1:8080
#   public_url: http://localhost:8080
# server:
#   host: 0.0.0.0
#   port: 33333
```

### service 子命令

```bash
# 帮助
peekview-mcp service --help
# Output:
# Usage: peekview-mcp service [command] [options]
#
# Manage MCP Server as a system service (systemd)
#
# Commands:
#   install            Install systemd service
#   uninstall          Remove the systemd service
#   start              Start the service
#   stop               Stop the service
#   restart            Restart the service
#   status             Check service status
#
# Options:
#   --user             Install as user service (no sudo)
#   --force            Overwrite existing service
#
# Examples:
#   peekview-mcp service install --user
#   peekview-mcp service restart
#   peekview-mcp service status

# 安装为系统服务
peekview-mcp service install --user

# 启动服务
peekview-mcp service start

# 停止服务
peekview-mcp service stop

# 重启服务
peekview-mcp service restart

# 查看状态
peekview-mcp service status

# 卸载服务
peekview-mcp service uninstall [--user]
```

### version 命令

```bash
peekview-mcp version
# Output: 0.3.0

peekview-mcp --version
# Output: 0.3.0

peekview-mcp -v
# Output: 0.3.0
```

**service install 行为:**

1. 检查 `~/.peekview/mcp-config.yaml` 是否存在（不存在则报错提示）
2. 生成 systemd service 文件（路径: `~/.config/systemd/user/peekview-mcp.service`）
3. 服务文件内容（**注意：不写入任何环境变量**）:

```ini
[Unit]
Description=PeekView MCP Server
After=network.target

[Service]
Type=simple
User=kity                          # 必须指定，否则 systemd 用 root 运行
ExecStart=/home/kity/.local/bin/peekview-mcp serve
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
```

4. `--user` 标志：安装为用户服务（无需 sudo）
5. `--force` 标志：覆盖现有服务文件

**service uninstall 行为:**

1. 停止服务（如果正在运行）
2. 禁用服务（`systemctl disable`）
3. 删除服务文件
4. 重新加载 systemd

```bash
# 卸载用户服务
peekview-mcp service uninstall --user

# 卸载系统服务（需要 sudo）
peekview-mcp service uninstall
```

**关键点:**
- 必须指定 `User=`，否则服务以 root 运行，读取 root 的 `~/.peekview/mcp-config.yaml`
- 不写入 `Environment=`，配置完全依赖 `~/.peekview/mcp-config.yaml`

---

## CLI 解析器选型

**选择: Commander.js**

理由：
- PeekView MCP Server 已使用 Node.js
- Commander 是 Node.js 最成熟的 CLI 框架
- 支持子命令、全局选项、帮助自动生成
- 与现有代码风格一致

**替代方案:**
- `yargs`: 功能强大但较复杂
- `oclif`: 适合大型 CLI，过重
- `cac`: 轻量但生态较小

**实现要点:**
```typescript
// index.ts 入口
#!/usr/bin/env node
import { Command } from 'commander';
import { version } from '../package.json';

const program = new Command();

program
  .name('peekview-mcp')
  .description('PeekView MCP Server')
  .version(version, '-v, --version');

// 子命令注册
program.addCommand(serveCommand);
program.addCommand(configCommand);
program.addCommand(serviceCommand);

// 全局 help
program.helpOption('-h, --help', 'Show help');

program.parse();
```

| 文件 | 说明 |
|------|------|
| `packages/mcp-server/src/config/` | 配置模块 |
| `packages/mcp-server/src/config/loader.ts` | 配置加载器 |
| `packages/mcp-server/src/config/schema.ts` | 配置结构定义 |
| `packages/mcp-server/src/config/file.ts` | YAML 文件读写 |
| `packages/mcp-server/src/cli/config.ts` | config 命令实现 |
| `packages/mcp-server/src/cli/service.ts` | service 命令实现 |
| `packages/mcp-server/src/index.ts` | CLI 入口更新 |

---

## 测试计划

### 测试 1: 配置层级
- 环境变量覆盖配置文件值
- CLI 参数覆盖环境变量

### 测试 2: config 命令
- `config set` 写入 yaml 文件
- `config get` 读取值（含默认值）
- `config list` 显示全部配置

### 测试 3: service 命令
- service install 创建 systemd 服务文件
- 服务文件不包含环境变量
- service start/stop/status 正常工作

---

## 验证清单

- [ ] `peekview-mcp config set peekview.url http://localhost:8080` 工作
- [ ] `~/.peekview/mcp-config.yaml` 正确生成
- [ ] `peekview-mcp config get server.port` 显示默认值 33333
- [ ] `PEEKVIEW_MCP_PORT=33334` 覆盖配置文件
- [ ] `peekview-mcp service install --user` 不写入环境变量
- [ ] 生成的 systemd 服务文件只包含 `ExecStart=peekview-mcp serve`

---

## 文档更新

更新 `docs/agent-deployment-guide.md`:
1. Step 5 简化为使用 `peekview-mcp config set`
2. 🔧 配置为系统服务章节使用 `peekview-mcp service install`
3. 移除手动 systemd 脚本示例

---

## 依赖

- `yaml` 或 `js-yaml` 库（Node.js YAML 解析）
- `chalk` 或 `picocolors`（终端颜色）

---

## 评审记录

| 轮次 | 评审人 | 状态 | 主要反馈 |
|------|--------|------|----------|
| 1 | CEO | ✅ | API Key 安全警告已添加 |
| 1 | Design | ✅ | User 设置已明确；systemd 路径已指定 |
| 1 | DX | ✅ | CLI 命名统一；使用 Commander.js |
| 2 | Self | - | 待实现后自测 |

### 设计决策

**CLI 解析器: Commander.js**
- 成熟稳定，生态丰富
- 支持子命令、全局选项、自动生成帮助
- 与 TypeScript 配合良好

**配置层级:**
```
CLI args > Env vars > Config file > Defaults
```

**文件隔离:**
- `~/.peekview/config.yaml` → PeekView Python
- `~/.peekview/mcp-config.yaml` → MCP Server Node.js
- 完全独立，无交叉读取

**服务安装:**
- 必须检查 config 文件存在
- 必须指定 `User=`
- 绝不写入环境变量