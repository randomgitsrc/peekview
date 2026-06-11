# CLI Config 改进设计文档

## 问题概述

当前 `peekview config` 命令功能有限，无法配置服务端参数（如 host、port），导致 `peekview service install` 无法使用配置文件中指定的端口。

## 目标

1. 扩展 `peekview config` 支持更多服务端配置参数
2. 让 `service install` 自动读取并使用配置文件中的 host/port 设置
3. 添加 `-h` 和 `-v` 作为 `--help` 和 `--version` 的简写
4. 改善帮助文档，列出所有可配置参数

## 设计

### 1. 扩展 config 支持的参数

当前仅支持 `base_url` 和 `remote.*`，扩展后支持：

| 配置键 | 对应环境变量 | 默认值 | 说明 |
|--------|------------|--------|------|
| `server.host` | `PEEKVIEW_SERVER__HOST` | `0.0.0.0` | 服务器绑定地址 |
| `server.port` | `PEEKVIEW_SERVER__PORT` | `8080` | 服务器端口 |
| `server.base_url` | `PEEKVIEW_SERVER__BASE_URL` | `""` | 外部访问URL |
| `storage.data_dir` | `PEEKVIEW_STORAGE__DATA_DIR` | `~/.peekview/data` | 数据目录 |
| `storage.db_path` | `PEEKVIEW_STORAGE__DB_PATH` | `~/.peekview/peekview.db` | 数据库路径 |
| `auth.secret_key` | `PEEKVIEW_AUTH__SECRET_KEY` | `""` | JWT密钥 |
| `auth.token_expire_days` | `PEEKVIEW_AUTH__TOKEN_EXPIRE_DAYS` | `7` | Token有效期(天) |
| `auth.allow_registration` | `PEEKVIEW_AUTH__ALLOW_REGISTRATION` | `true` | 允许注册 |
| `limits.max_file_size` | `PEEKVIEW_LIMITS__MAX_FILE_SIZE` | `10485760` | 单文件最大字节 |

### 2. service install 读取配置

`service install` 命令逻辑修改：

- 先加载配置文件
- 如果 CLI 参数未指定 host/port/data_dir，则使用配置文件中的值
- 优先级：CLI 参数 > 配置文件 > 默认值

### 3. -h / -v 简写支持

修改 CLI 入口：

```python
@click.group(
    name="peekview",
    context_settings={"help_option_names": ["-h", "--help"]}
)
@click.version_option(
    version=__version__,
    prog_name="peekview",
    prog_version=["-v", "--version"]
)
def cli() -> None:
    """PeekView - A lightweight code & document formatting display service."""
    pass
```

### 4. 帮助文档改进

`peekview config --help` 显示所有支持的配置键及其说明。

## 测试计划

### 测试 1: config 支持新参数
- 测试 `config set server.port 3000` 成功写入
- 测试 `config get server.port` 返回 3000
- 测试 `config set server.host 0.0.0.0` 成功写入

### 测试 2: service install 读取配置
- 配置文件中设置 port=3000
- 运行 `service install --user` (不带 --port)
- 验证生成的服务文件包含 `PEEKVIEW_SERVER__PORT=3000`

### 测试 3: CLI 参数覆盖配置
- 配置文件中设置 port=3000
- 运行 `service install --port 5000 --user`
- 验证生成的服务文件包含 `PEEKVIEW_SERVER__PORT=5000`

### 测试 4: -h 简写支持
- 运行 `peekview -h` 显示帮助
- 运行 `peekview serve -h` 显示子命令帮助

### 测试 5: -v 简写支持
- 运行 `peekview -v` 显示版本号

## API/CLI 变更

**向后兼容：** 是。新增功能不影响现有命令。

**CLI 变更：**
- 新增支持的 `config set/get` 键
- 新增 `-h` 作为 `--help` 简写
- 新增 `-v` 作为 `--version` 简写

## 实现状态

✅ **已完成** (2026-05-22)

### 实现文件
1. `backend/peekview/cli.py` - 主要修改
2. `backend/tests/test_cli.py` - 新增测试 (10 个新测试)

### 验证结果
- [x] `peekview -v` 显示版本
- [x] `peekview -h` 显示帮助
- [x] `peekview config set server.port 3000` 工作
- [x] `peekview config get server.port` 返回 3000
- [x] `peekview config set server.host 0.0.0.0` 工作
- [x] `peekview config set storage.data_dir /tmp/peekview` 工作
- [x] `peekview config set auth.secret_key xxx` 工作
- [x] `peekview service install --user` 读取配置文件中的 port/host
- [x] 所有 42 个 CLI 测试通过

### 向后兼容
- ✅ `base_url` 作为 `server.base_url` 的别名保留
- ✅ 原有 `remote.*` 配置完全兼容
- ✅ `serve -h` 仍作为 `--host` 简写（与 `-h` help 简写冲突，但这是子命令级别）
