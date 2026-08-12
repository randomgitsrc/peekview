---
phase: P0
task_id: T055
task_name: admin-backup-export
type: brief
trace_id: T055-P0-20260714
created: 2026-07-14
status: draft
parent: 运维刚需 — 无备份/导出命令
---

# T055: Admin Backup/Export 命令

## 任务简报

### 问题

CLI 有 `admin stats` 和 `admin cleanup`，但**无 backup/export**。用户必须手动 `cp` 数据库和 data 目录。

手动备份风险：
- SQLite WAL 模式下直接 `cp` 可能得到不一致快照
- 文件存储和 DB 之间可能不一致（备份期间有写入）
- 用户不知道需要备份哪些文件（config.yaml 也应包含）

### 方案

1. `peekview admin backup [--output PATH]`：WAL checkpoint → SQLite `.backup` API（保证一致性）→ 复制 data 目录 → 复制 config.yaml → 打包 tar.gz
2. `peekview admin export [--slug SLUG] [--format json|zip]`：单条目导出为 JSON（含 metadata + file contents base64）或 ZIP
3. `peekview admin restore <backup-file>`：从备份恢复（处理版本兼容和 ID 冲突）

## executor_env

```yaml
platform: "claude-code"
has_task_tool: false
has_local_runtime: true
network: "full"
```

## 环境约束

- debug_env: `make debug-start`（:8888, /tmp/peekview-debug/）
- 后端 `python3 -m ruff check` + `pytest` CI 强制

## 已知风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| 大数据库备份耗时 | 阻塞 CLI | SQLite backup API 是在线操作，不阻塞写入 |
| restore 版本兼容 | 旧版本备份恢复到新版本 | 先检查版本号，不兼容时提示 |
| restore ID 冲突 | 备份中的 ID 与现有数据冲突 | restore 时重新分配 ID |

## 裁剪倾向

- P3（TDD）保留：backup 一致性需要测试验证
- P6（验收）简化：CLI 命令，pytest 验证即可
- P7（一致性）可裁剪：纯后端 CLI 改动

## packages

- `backend/peekview/`：cli.py（新命令组）、services/admin_service.py（新方法）

## domains

- `backup`：全量备份（DB + 文件 + 配置）一致性保证
- `export`：单条目/全量导出为可移植格式
- `restore`：从备份恢复
