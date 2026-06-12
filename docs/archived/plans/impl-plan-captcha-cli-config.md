# Plan: CLI 配置体验对齐 + Captcha 配置支持 (v5)

## 目标

peekview 和 peekview-mcp 两个 CLI 的配置命令（config set/get/list）在 UX 上互相补齐，形成一致的体验。

## 当前差距

| 能力 | peekview | peekview-mcp | 对齐方向 |
|------|----------|-------------|---------|
| `config list` 全量展示所有 key | ❌ 只显文件值 | ✅ 全量+默认值+注释 | peekview → MCP |
| `config --help` 列出可用 key | ❌ 只在错误时列 | ✅ help 文本里列出 | peekview → MCP |
| `config get` 默认值回退 | ✅ | ❌ 显示 "(not set)" | MCP → peekview |
| `config get` 无配置文件的处理 | ✅ 显示默认值 | ❌ error exit | MCP → peekview |
| `config set` 类型自动检测 | ❌ 硬编码键名 | ✅ auto (true/false/digits) | peekview → MCP |
| `config set` 后提示重启 | ❌ | ❌ (只在 --help) | 两者都补 |
| `config set` 输出文件路径 | ✅ | ❌ | MCP → peekview |

## 改动清单

### 一、peekview backend/cli.py

#### 1. `supported_keys` → 模块级 `tuple` + 补充 captcha

```python
SUPPORTED_CONFIG_KEYS = (
    "base_url",  # 兼容旧用法，等价于 server.base_url
    "server.host", "server.port", "server.base_url",
    "server.api_key", "server.cors_origins",
    "server.rate_limit_enabled", "server.rate_limit_per_minute",
    "server.rate_limit_login_per_minute",
    "storage.data_dir", "storage.db_path", "storage.allowed_paths",
    "storage.health_disk_warning_mb",
    "auth.secret_key", "auth.token_expire_days", "auth.allow_registration",
    "auth.allow_anonymous_create",
    "auth.captcha_enabled", "auth.captcha_site_key",
    "limits.max_file_size", "limits.max_entry_files", "limits.max_entry_size",
    "limits.max_slug_length", "limits.max_summary_length", "limits.max_per_page",
    "cleanup.check_on_start", "cleanup.interval_seconds",
    "logging.level", "logging.log_file",
    "remote.url", "remote.api_key", "remote.timeout", "remote.verify_ssl",
)
```

变化：
- 新增 `auth.captcha_enabled`, `auth.captcha_site_key`
- 保留 `base_url`（向后兼容）+ 新增 `server.base_url`
- 用 `tuple` 不变

#### 2. `config set` — 混合类型转换策略 (修正 R1)

纯自动检测（`"true"/"false" → bool, `isdigit()` → int）有误判风险：纯数字 host、全数字 API key 会被错误转换。改用混合策略：

```python
# 已知 bool 键
if key_name in ("allow_registration", "allow_anonymous_create",
                 "rate_limit_enabled", "check_on_start", "verify_ssl",
                 "captcha_enabled", "captcha_exempt_first_user"):
    value = value.lower() in ("true", "1", "yes", "on")
# 已知 int 键
elif key_name in ("port", "token_expire_days", "timeout",
                   "health_disk_warning_mb",
                   "max_file_size", "max_entry_files", "max_entry_size",
                   "max_slug_length", "max_summary_length", "max_per_page",
                   "interval_seconds",
                   "captcha_builtin_difficulty", "captcha_builtin_challenge_count",
                   "captcha_builtin_challenge_size", "captcha_builtin_challenge_ttl_ms",
                   "captcha_builtin_token_ttl_ms"):
    value = int(value)
# 已知 list 键
elif key_name in ("cors_origins", "allowed_paths"):
    value = [v.strip() for v in value.split(",")]
# 其他键 → 保持字符串
```

> 注：captcha 内部引擎参数虽不在 SUPPORTED_CONFIG_KEYS 中（用户不通过 CLI 改），但类型转换表里加它们是为了完备性——如果用户通过 config.yaml 手动设置，类型是正确的。

#### 3. `config set` 成功后加重启提示

```python
click.echo(f"✓ Set {key} = {value}")
click.echo(f"  Config file: {CONFIG_FILE}")
click.echo(f"  ⚠  Restart service to apply: peekview service restart")
```

#### 4. 重写 `config list` — 对齐 MCP 全量展示

- 读取 config 文件 + PeekConfig 默认值
- 按 section 分组展示所有 SUPPORTED_CONFIG_KEYS
- 文件有值 → 显示文件值，文件无值 → 显示默认值
- **按 `(section, key_name)` 去重**（修正 R2）：`"base_url"` 和 `"server.base_url"` 映射到同一个路径，只展示一次
- 每个 key 后加 `# 描述`（硬编码中文注释，因 Pydantic Field description 在实例上的访问方式不稳定）
- 空文件不 return，继续展示
- 底部列出 `Available config keys` 分组列表
- list 类型用逗号分隔展示

#### 5. `config get` 修复 `base_url` 无点号崩溃

```python
if "." in key:
    section, key_name = key.split(".", 1)
else:
    section, key_name = "server", key  # base_url → server.base_url
```

#### 6. `config --help` 补充可用 key 说明（对齐 MCP）

在 `config` 命令的 help 文本中列出分组 key 摘要。

### 二、peekview-mcp packages/mcp-server/src/cli/config.ts

#### 1. 提取 `DEFAULT_CONFIG` 模块常量 (修正 R3)

```typescript
const DEFAULT_CONFIG = {
  server: { port: 33333, host: '0.0.0.0', cors_origins: '*', mode: 'remote' },
  logging: { level: 'info' },
} as const;
```

`config list` 和 `config get` 共用此常量，避免两份硬编码不同步。

#### 2. `config get` 支持默认值回退（对齐 peekview）

```typescript
if (value === undefined) {
    const defaultVal = (DEFAULT_CONFIG[section] as any)?.[prop];
    if (defaultVal !== undefined) {
        console.log(`${defaultVal} (default)`);
    } else {
        console.log('(not set)');
    }
} else {
    console.log(value);
}
```

#### 3. `config get` 无配置文件不报错（对齐 peekview）

移除 `if (!config) { error exit }`，无文件时显示默认值。

#### 4. `config set` 成功后加重启提示

```typescript
console.log(`✓ Set ${key} = ${value}`);
console.log(`  ⚠ Restart service to apply: peekview-mcp service restart`);
```

#### 5. `config set` 成功后显示文件路径（对齐 peekview）

```typescript
console.log(`  Config file: ~/.peekview/mcp-config.yaml`);
```

### 三、config.py — 合并重复 `captcha_secret_key`

删除第 270-273 行（第一个定义），保留第 283-286 行。

## 不做的事

- 不改 `captcha_enabled` 默认值
- peekview 不暴露内部引擎参数到 CLI
- MCP 的 `config set` 类型检测保持不变（已用 auto-detection）

## 验证

```bash
# === peekview ===
peekview config list
# → 所有 key 分组展示，含默认值和注释
# → 底部显示 Available config keys

peekview config set auth.captcha_enabled true
# → ✓ + 重启提示 + 文件路径

peekview config get base_url
# → 不崩溃，显示值或默认值

peekview config get auth.captcha_enabled
# → 显示当前值

# === peekview-mcp ===
peekview-mcp config get server.port
# → 显示 13003 (默认值) 而不是 "(not set)"

peekview-mcp config set server.port 13003
# → ✓ + 重启提示 + 文件路径
```
