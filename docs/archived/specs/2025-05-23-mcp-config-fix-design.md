---
title: MCP Server 配置管理架构修复设计
author: Claude
version: 0.2.0
---

# MCP Server 配置管理架构修复设计

## 问题回顾

| 问题 | 影响 | 根本原因 |
|------|------|----------|
| 1. 配置持久化机制错误 | `config set` 后需重装服务才生效 | systemd Environment 覆盖了配置文件 |
| 2. 配置验证缺失 | 允许保存 `url: 13001` 等无效值 | 缺少 URL 格式验证 |
| 3. 服务重装不清理旧进程 | 端口占用导致启动失败 | `--force` 不停止旧进程 |
| 4. 健康检查不报告配置错误 | 无法诊断配置问题 | health endpoint 信息不足 |

## 设计原则

**与 PeekView 后端保持一致**：
- 服务安装时不写 Environment 变量
- 运行时从配置文件读取
- `config set` + `service restart` = 配置生效
- 配置优先级：CLI > Env > File > Default

## 方案概述

### 1. 服务安装（修复问题 1 & 3）

**当前行为**：
```ini
[Service]
Environment="PEEKVIEW_URL=http://..."
Environment="PEEKVIEW_PUBLIC_URL=http://..."
```

**新行为**：
```ini
[Service]
# 无 Environment，运行时读取 ~/.peekview/mcp-config.yaml
ExecStart=/path/to/node /path/to/peekview-mcp serve
```

**附加功能**：
- `install --force` 时自动停止并清理旧进程
- **旧版服务检测**：`service status` 检测服务文件是否包含 Environment 变量，如是则提示迁移

#### `install --force` 行为语义

```typescript
async function installService(options: { force?: boolean }) {
  if (options.force && serviceExists()) {
    // 1. 停止服务
    await stopService();
    
    // 2. 等待进程退出（最多 10s）
    await waitForProcessExit(10000);
    
    // 3. 如果仍在运行，发送 SIGTERM
    if (processStillRunning()) {
      await killProcessGracefully();
      await waitForProcessExit(5000);
    }
    
    // 4. 如果仍在运行，强制 SIGKILL
    if (processStillRunning()) {
      await killProcessForcefully();
    }
    
    // 5. 等待端口释放
    await waitForPortRelease(33333, 5000);
  }
  
  // 6. 安装新服务
  await writeServiceFile();
}
```

### 2. 配置验证（修复问题 2）

**新增验证规则**：

```typescript
// 验证 URL 格式
validateUrl(value: string, field: string): void {
  if (!value) throw new Error(`${field}: Required`);
  if (!value.startsWith('http://') && !value.startsWith('https://')) {
    throw new Error(`${field}: Must start with http:// or https://`);
  }
  try {
    new URL(value);
  } catch {
    throw new Error(`${field}: Invalid URL format`);
  }
}

// 验证端口号
validatePort(value: number | string, field: string): void {
  const port = typeof value === 'string' ? parseInt(value, 10) : value;
  if (isNaN(port) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${field}: Must be an integer between 1 and 65535`);
  }
}

// 验证日志级别
validateLogLevel(value: string): void {
  const validLevels = ['debug', 'info', 'warn', 'error'];
  if (!validLevels.includes(value.toLowerCase())) {
    throw new Error(`logging.level: Must be one of ${validLevels.join(', ')}`);
  }
}

// 验证 CORS origins
validateCorsOrigins(value: string): void {
  const origins = value.split(',').map(s => s.trim());
  for (const origin of origins) {
    if (origin === '*') continue;
    if (origin.includes('://')) {
      try {
        new URL(origin);
      } catch {
        throw new Error(`CORS origin "${origin}" is not a valid URL`);
      }
    }
  }
}
```

**验证时机**：
- `config set` 时立即验证，无效值拒绝保存
- `serve` 启动时验证，无效配置报错退出
- **环境变量解析时验证**（MCP_PORT, MCP_HOST, MCP_CORS_ORIGINS 等）

### 3. 健康检查增强（修复问题 4）

**新增响应字段**：

```json
{
  "status": "ok",
  "version": "0.3.9",
  "peekview": "ok",
  "config": {
    "source": "file",
    "path": "/home/kity/.peekview/mcp-config.yaml",
    "peekview_url": "http://127.0.0.1:13001",
    "public_url": "http://127.0.0.1:13001",
    "api_key_configured": true
  }
}
```

**降级状态示例**：

```json
{
  "status": "degraded",
  "version": "0.3.9",
  "peekview": "unreachable",
  "peekview_error": "Failed to connect to PeekView at http://127.0.0.1:13001: Connection refused",
  "config": {
    "source": "env",
    "path": null,
    "peekview_url": "13001",
    "public_url": "13001",
    "api_key_configured": false,
    "config_error": "Invalid URL format: missing protocol"
  }
}
```

**注意**：`api_key_configured` 只显示布尔值，不暴露实际 API Key 值。

### 4. CLI 增强

#### 新增 `config validate` 命令

```bash
$ peekview-mcp config validate

✓ Configuration is valid
  Source: file (~/.peekview/mcp-config.yaml)
  
  peekview.url:          http://127.0.0.1:13001 (from file)
  peekview.public_url:   http://127.0.0.1:13001 (from file)
  peekview.api_key:      configured (from env)
  server.port:           33333 (default)
  server.host:           0.0.0.0 (default)
  logging.level:         info (from file)
```

**显示配置来源**：每个配置项显示来源（CLI | Env | File | Default）

#### 增强 `service status`

```bash
$ peekview-mcp service status

● peekview-mcp.service - PeekView MCP Server
     Loaded: loaded (/etc/systemd/system/peekview-mcp.service; enabled)
     Active: active (running) since Sat 2026-05-23 13:48:23 CST
   Main PID: 415984 (node)
     
⚠ WARNING: Service uses legacy format (Environment variables detected)
   Run 'peekview-mcp service install --force' to migrate to new format
   
Config:
   Source: file
   Path: /home/kity/.peekview/mcp-config.yaml
   peekview.url: http://127.0.0.1:13001
   
Connections:
   PeekView: connected (http://127.0.0.1:13001)
   API Key: configured
```

**旧版服务检测**：如果服务文件包含 `Environment=` 指令，显示迁移警告。

## 文件变更

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/cli/service.ts` | 修改 | 移除 Environment 写入，添加进程清理，添加旧版服务检测 |
| `src/cli/config.ts` | 修改 | 添加 `config validate` 命令，增强 `config set` 验证，显示配置来源 |
| `src/config/file.ts` | 修改 | 添加 `validateConfig` 函数，添加配置来源追踪 |
| `src/config/merge.ts` | 修改 | 添加 URL/Port/LogLevel/CORS 验证，增强错误信息 |
| `src/config/validators.ts` | 新增 | 独立的验证函数模块 |
| `src/server.ts` | 修改 | 扩展 health endpoint，添加 api_key_configured 字段 |
| `src/types.ts` | 修改 | 添加 ConfigSource 类型，HealthCheckResponse 类型 |

## 向后兼容

### 迁移路径

**旧版服务（v0.3.8 及之前）**：
- 服务文件包含 Environment 变量
- `config set` 后需 `service install --force` 才生效

**检测与提示**：
1. `service status` 自动检测旧版格式并显示警告
2. `config set` 后如检测到旧版服务，提示运行 `service install --force`
3. 警告信息包含迁移命令

**手动迁移**：
```bash
# 1. 重装服务（自动清理旧进程）
peekview-mcp service install --force

# 2. 验证新格式
peekview-mcp service status
# 应显示：✓ Service uses modern format (no Environment variables)
```

### 配置格式兼容性

- **配置文件格式**：无变更，向后兼容
- **CLI 命令**：新增命令，不影响现有功能
- **Health API**：新增字段，客户端可忽略

## 测试策略

1. **单元测试**：
   - URL 验证（有效/无效格式）
   - Port 验证（边界值、非数字）
   - CORS origins 验证（通配符、URL、逗号分隔）
   - 配置来源检测（Env vs File vs Default）

2. **集成测试**：
   - `config set` + `service restart` 流程
   - `config validate` 显示来源
   - `service install --force` 进程清理

3. **E2E 测试**：
   - 完整安装-配置-重启-验证流程
   - **迁移测试**：旧版服务 → 新版服务 → 配置生效
   - Health check 字段验证

4. **向后兼容测试**：
   - 旧版服务文件检测
   - 旧版服务迁移流程
   - 配置文件格式兼容性

---

**状态**: 设计完成，待实施

## 附录：设计评审反馈

评审者识别的问题及修复：

### Critical（已修复）

1. **Health check 缺少 apiKey 字段** ✅
   - 添加 `api_key_configured: boolean`（不暴露值）

2. **merge.ts 的环境变量验证缺失** ✅
   - 添加 MCP_PORT、MCP_HOST、MCP_CORS_ORIGINS 解析时验证

3. **旧版服务检测缺失** ✅
   - `service status` 检测 Environment 变量并提示迁移

### Important（已修复）

4. **CORS origins 验证** ✅
   - 添加 `validateCorsOrigins()` 函数

5. **配置来源显示** ✅
   - `config validate` 显示每个值的来源（Env/File/Default）

6. **install --force 行为语义** ✅
   - 明确定义：停止 → 等待 → SIGTERM → SIGKILL → 端口释放

7. **同时验证 public_url** ✅
   - URL 验证同时应用于 url 和 public_url

### Minor（可选）

8. **错误字段层级** - 已采用 `peekview_error` 和 `config.config_error` 区分
9. **logging.level 验证** - 已添加
10. **迁移场景测试** - 已添加到测试策略