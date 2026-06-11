# CLI Config 重构设计文档

## 问题概述

当前 `peekview service install` 会把 host/port/data_dir 硬编码到服务文件的环境变量中，导致用户后续修改 `~/.peekview/config.yaml` 不生效。

## 目标

1. `service install` 不再写入任何配置到服务文件（纯启动管理）
2. `config` 命令支持全量配置参数（约 25 个）
3. 配置层级清晰：CLI 参数 > 环境变量 > 配置文件 > 代码默认值

## 配置层级

```
1. CLI 参数 (临时，如 peekview serve --port 3000)
2. 环境变量 (高级，如 PEEKVIEW_SERVER__PORT=3000)
3. 配置文件 (~/.peekview/config.yaml)
4. 代码默认值
```

## 支持的配置参数

| 键 | 类型 | 默认值 | 说明 |
|----|------|--------|------|
| server.host | str | 127.0.0.1 | 绑定地址 |
| server.port | int | 8080 | 端口 |
| server.base_url | str | "" | 外部URL |
| server.api_key | str | "" | 全局API密钥 |
| server.cors_origins | list | ["http://localhost:5173"] | CORS源 |
| server.rate_limit_enabled | bool | true | 启用限速 |
| server.rate_limit_per_minute | int | 60 | 默认限速 |
| server.rate_limit_login_per_minute | int | 10 | 登录限速 |
| storage.data_dir | path | ~/.peekview/data | 数据目录 |
| storage.db_path | path | ~/.peekview/peekview.db | 数据库路径 |
| storage.allowed_paths | list | [] | 本地路径白名单 |
| storage.health_disk_warning_mb | int | 100 | 磁盘告警阈值 |
| auth.secret_key | str | "" | JWT密钥 |
| auth.token_expire_days | int | 7 | Token有效期 |
| auth.allow_registration | bool | true | 允许注册 |
| auth.allow_anonymous_create | bool | true | 匿名创建 |
| limits.max_file_size | int | 10485760 | 单文件上限(10MB) |
| limits.max_entry_files | int | 50 | 条目文件数上限 |
| limits.max_entry_size | int | 104857600 | 条目总大小上限(100MB) |
| cleanup.check_on_start | bool | true | 启动时清理 |
| cleanup.interval_seconds | int | 3600 | 清理间隔 |
| logging.level | str | INFO | 日志级别 |
| logging.log_file | path | null | 日志文件路径 |
| remote.url | str | "" | 远程服务器URL |
| remote.api_key | str | "" | 远程API密钥 |
| remote.timeout | int | 30 | 超时秒数 |
| remote.verify_ssl | bool | true | SSL验证 |

## 测试计划

### 测试 1: service install 不写环境变量
- 安装服务
- 检查服务文件不包含 PEEKVIEW_* 环境变量
- 服务文件只包含 ExecStart=peekview serve

### 测试 2: config set 支持全量参数
- 测试 server.host, server.port, storage.data_dir 等基本参数
- 测试 limits.max_file_size, auth.allow_registration 等新参数
- 测试值类型转换（int, bool, path）

### 测试 3: config get 显示默认值
- 未设置的参数显示 "(not set, default: xxx)"
- 已设置的参数显示实际值

### 测试 4: config list 显示全量配置
- 显示所有参数当前值和默认值

## API/CLI 变更

### service install 变更
```bash
# 之前
peekview service install --host 0.0.0.0 --port 3000 --user

# 之后（只保留基础选项）
peekview service install --user [--force]
```

### config set 扩展
支持所有上述 25+ 个配置键，自动处理类型转换：
- bool: true/false, yes/no, 1/0
- int: 直接转换
- path: 自动展开 ~/ 和相对路径
- list: 逗号分隔（如 cors_origins）

## 实现文件

1. `backend/peekview/cli.py` - 主要修改
2. `backend/tests/test_cli.py` - 新增测试

## 验证清单

- [ ] service install 不写入 PEEKVIEW_* 环境变量
- [ ] config set server.port 3000 工作
- [ ] config set auth.allow_registration false 工作
- [ ] config set limits.max_file_size 20971520 工作
- [ ] config get server.port 显示默认值
- [ ] config list 显示全量配置
- [ ] 所有现有测试通过
