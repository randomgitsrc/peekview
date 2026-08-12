---
phase: P1
task_id: T055
type: requirements
parent: P0-brief.md
trace_id: T055-P1-20260716
status: revised
created: 2026-07-16
revised: 2026-07-16
agent: analyst
---

# T055: Admin Backup/Export — Requirements Baseline

## 1. 需求复述

为 PeekView CLI 添加三个 admin 子命令，解决当前无备份/导出能力的运维痛点：

1. **`peekview admin backup [--output PATH]`**：全量一致性备份（DB + 文件存储 + 配置 + 密钥），输出 tar.gz
2. **`peekview admin export [--slug SLUG] [--format json|zip]`**：单条目导出为可移植格式（JSON 含 base64 文件内容，或 ZIP 含原始文件）
3. **`peekview admin restore <backup-file>`**：从备份恢复，处理版本兼容和 ID/slug 冲突

核心问题：手动 `cp` 在 SQLite WAL 模式下可能得到不一致快照；用户不知道需要备份哪些文件（config.yaml、.secret_key 等隐含文件）。

## 2. 隐含需求识别

### 2.1 P0-brief 未提及但技术上必须的

| # | 隐含需求 | 为什么必须 |
|---|---------|-----------|
| I1 | **备份须包含 `.secret_key` 和 `.captcha_secret`** | 这两个文件是 JWT/captcha 签名密钥。不备份则恢复后自动生成新密钥 → 所有现有 JWT token 失效 → 全部用户必须重新登录。多用户场景下这是严重回归 |
| I2 | **备份须包含 `metadata.json`（版本号 + 时间戳 + 校验和）** | 恢复时需要知道备份来自哪个版本，以判断 schema 兼容性。没有版本信息无法做安全的版本检查 |
| I3 | **恢复时 slug 冲突处理** | P0 提到 ID 冲突，但 slug 是 UNIQUE 约束。如果目标实例已有同名 slug 的 entry，仅重分配 ID 不够——slug 也必须处理（跳过/重命名/覆盖） |
| I4 | **恢复后须重建 FTS5 索引** | 备份/恢复可能跨不同 schema 版本，FTS5 虚拟表结构可能不兼容。恢复后必须 rebuild_fts_index() |
| I5 | **文件存储目录以 entry_id 命名，ID 重映射须同步重命名目录** | 文件存储在 `{data_dir}/default/{entry_id}/`。如果恢复时重分配了 entry ID，对应的文件目录名也必须更新，否则文件找不到 |
| I6 | **backup/restore 须拒绝 remote 模式** | 这两个命令需要直接访问 SQLite 和文件系统。remote 模式（PeekClient）只有 HTTP API，无法执行 .backup API 或读写文件 |
| I7 | **备份须包含 WAL 中尚未写入主 DB 文件的数据** | WAL 模式下，最近写入可能仅存在于 WAL 文件而非主 DB 文件。若备份只拷贝主 DB 文件，会丢失最近的数据。备份须确保获取完整数据快照 |
| I8 | **恢复须处理外键依赖顺序** | 表间 FK 链：users → entries → files, users → api_keys, users → entry_shares, entries → entry_reads。恢复时必须按依赖顺序插入，或临时禁用 FK 约束 |
| I9 | **备份文件须包含完整性校验** | 大文件传输/存储可能损坏。metadata.json 须含 file_checksums 字段（tar.gz 内除 metadata.json 外每个文件的 SHA256 列表），恢复时验证 |
| I10 | **恢复应有 `--dry-run` 选项** | 恢复是破坏性操作。用户应能预览会发生什么（哪些 entry 会冲突、多少数据会被导入），再决定是否执行 |

### 2.2 按维度快速过检

- **数据**：已有数据受影响吗？→ 恢复操作会影响目标实例数据（merge 模式下可能覆盖/跳过）
- **前端**：有显示/交互变化吗？→ 无，纯 CLI 改动
- **多端**：MCP / CLI / API 需要同步吗？→ 不需要。MCP Server 不暴露 admin 命令；API 层无新增端点
- **边界**：空值、极值、并发、回滚怎么处理？→ 空数据库备份/恢复、超大备份文件、恢复中断后的半完成状态
- **兼容**：破坏现有行为吗？→ 不破坏。新增命令，不修改现有命令

## 3. BDD 验收条件

### 3.1 backup 命令

**BDD-01: 一致性备份**
```
Given 一个运行中的 PeekView 实例（WAL 模式，有 entries 和 files）
When 执行 peekview admin backup
Then 生成 tar.gz 文件，包含：
  - peekview.db（一致性快照，非文件系统级拷贝）
  - data/ 目录（完整复制所有 entry 文件）
  - config.yaml
  - .secret_key
  - .captcha_secret（如存在）
  - metadata.json（含 version、timestamp、file_checksums）
And metadata.json 的 file_checksums 字段列出 tar.gz 内除 metadata.json 外每个文件的 SHA256
```

**BDD-02: 备份自定义输出路径**
```
Given 一个运行中的 PeekView 实例
When 执行 peekview admin backup --output /tmp/my-backup.tar.gz
Then 备份文件生成在 /tmp/my-backup.tar.gz
And 文件格式为 tar.gz
And 若路径已存在同名文件则覆盖
And 若输出路径的父目录不存在或无写权限，命令报错退出
```

**BDD-03: 备份拒绝 remote 模式**
```
Given PEEKVIEW_REMOTE__URL 已设置为远程服务器地址
When 执行 peekview admin backup
Then 命令报错退出，提示 backup 不支持远程模式
And 不产生任何备份文件
```

**BDD-04: 备份完整性**
```
Given 一个刚完成的备份文件
When 检查 metadata.json 中的 file_checksums 字段
Then 该字段列出 tar.gz 内除 metadata.json 外每个文件的 SHA256
And 每个列出的 SHA256 与对应文件的实际计算值一致
```

**BDD-05: 空实例备份**
```
Given 一个空的 PeekView 实例（无 entries、无 users）
When 执行 peekview admin backup
Then 成功生成 tar.gz，包含空的 DB 和 data 目录
And metadata.json 正确记录版本和时间戳
```

### 3.2 export 命令

**BDD-06: 单条目 JSON 导出**
```
Given 一个 entry（slug="my-code"，含 2 个文本文件和 1 个二进制文件）
When 执行 peekview admin export --slug my-code --format json
Then 输出 JSON 文件，包含：
  - entry 元数据（slug, summary, tags, status, is_public, created_at, updated_at, expires_at）
  - files 数组，每个 file 含 filename, path, language, is_binary, size, sha256
  - 文本文件的 content 字段（原始字符串）
  - 二进制文件的 content_base64 字段（base64 编码）
```

**BDD-07: 单条目 ZIP 导出**
```
Given 一个 entry（slug="my-code"，含 2 个文件）
When 执行 peekview admin export --slug my-code --format zip
Then 输出 ZIP 文件，包含：
  - entry.json（元数据 + 文件列表，不含文件内容）
  - 每个文件以原始路径存储在 ZIP 中
And ZIP 内文件可正常解压读取
```

**BDD-08: 导出不存在的 entry**
```
Given 一个 PeekView 实例
When 执行 peekview admin export --slug nonexistent
Then 命令报错退出，提示 entry 不存在
```

**BDD-09: 导出默认格式**
```
Given 一个 entry
When 执行 peekview admin export --slug my-code（不指定 --format）
Then 默认使用 JSON 格式输出
```

### 3.3 restore 命令

**BDD-10: 基本恢复（空目标实例）**
```
Given 一个空的目标 PeekView 实例
And 一个有效的备份文件（含 entries、users、files、api_keys、entry_shares、entry_reads）
When 执行 peekview admin restore backup.tar.gz
Then 目标实例包含备份中的所有 users、entries、files、api_keys、entry_shares、entry_reads
And 所有 entry 的文件可通过 data 目录正常访问
And FTS5 索引已重建，对备份中某 entry 的 summary 关键词搜索返回该 entry
```

**BDD-11: 恢复版本兼容检查——高版本拒绝**
```
Given 一个版本为 0.7.0 的备份文件
And 当前 PeekView 版本为 0.6.3
When 执行 peekview admin restore backup.tar.gz
Then 命令报错退出，提示备份版本 (0.7.0) 高于当前版本 (0.6.3)，不兼容
And 目标实例数据不变
```

**BDD-11a: 恢复版本兼容——同版本允许**
```
Given 一个版本与当前 PeekView 版本相同的备份文件
When 执行 peekview admin restore backup.tar.gz
Then 恢复正常执行，不报版本兼容错误
```

**BDD-11b: 恢复版本兼容——低版本允许**
```
Given 一个版本低于当前 PeekView 版本的备份文件
When 执行 peekview admin restore backup.tar.gz
Then 恢复正常执行，输出提示备份来自低版本
```

**BDD-12: 恢复 ID 冲突处理（merge 模式）**
```
Given 目标实例已有 entry ID=1 (slug="existing")
And 备份中有 entry ID=1 (slug="backup-entry")
When 执行 peekview admin restore backup.tar.gz
Then 备份中的 entry 获得新 ID（不与现有 ID 冲突）
And slug 冲突时备份 entry 的 slug 按 {slug}-{n} 规则重命名（n 从 1 递增直到唯一，如 "backup-entry-1"、"backup-entry-2"）
And 所有 FK 关系（files.entry_id, entries.owner_id, api_keys.user_id 等）正确映射到新 ID
And 文件存储目录名与新 entry ID 一致
```

**BDD-13: 恢复拒绝 remote 模式**
```
Given PEEKVIEW_REMOTE__URL 已设置
When 执行 peekview admin restore backup.tar.gz
Then 命令报错退出，提示 restore 不支持远程模式
```

**BDD-14: 恢复完整性验证**
```
Given 一个备份文件（metadata.json 含 sha256 校验和）
When 执行 peekview admin restore backup.tar.gz
Then 恢复前先验证备份文件完整性（SHA256 校验）
And 校验失败时报错退出，不执行恢复
```

**BDD-15: 恢复 dry-run**
```
Given 一个有效的备份文件
When 执行 peekview admin restore --dry-run backup.tar.gz
Then 输出人类可读的预览信息，包含：
  - entry_count（将导入的 entry 数量）
  - user_count（将导入的 user 数量）
  - api_key_count（将导入的 api_key 数量）
  - conflicts[]（ID/slug 冲突列表，含冲突类型和涉及的 entry slug）
  - version_check（版本兼容检查结果）
And 不修改目标实例的任何数据
```

**BDD-16: 恢复中断安全**
```
Given 一个正在执行的 restore 操作
When 恢复过程中发生错误（如磁盘空间不足）
Then DB 事务回滚，目标 DB 保持恢复前状态
And 已复制的文件被清理，目标文件存储目录保持恢复前状态
And 不留下半完成的恢复结果
```

### 3.4 通用

**BDD-17: debug 模式隔离**
```
Given PEEKVIEW_DEBUG_MODE=1 已设置
When 执行 peekview admin backup
Then 备份读取 /tmp/peekview-debug/ 下的数据（非 ~/.peekview/）
And 备份文件默认输出到当前工作目录
```

## 4. 待确认清单

| # | 问题 | 影响 | 建议 |
|---|------|------|------|
| C1 | **恢复策略：merge 还是 replace？** merge 保留目标数据+导入备份数据（ID 重映射）；replace 清空目标再导入（简单但破坏性大）。P0 说"重新分配 ID"暗示 merge，但 merge 复杂度显著更高 | 决定 restore 的核心行为和实现复杂度 | 默认 merge + `--replace` 可选标志（replace 模式需二次确认） |
| C2 | **export 是否支持 remote 模式？** 单条目导出理论上可通过 API 获取（GET /entries/{slug}/raw），但 P0 未提及 | 决定 export 命令是否需要 remote-url 选项 | 初版仅支持 local 模式，export 遇 remote 配置时报错退出（与 backup/restore 一致），remote export 作为后续增强 |
| C3 | **备份文件名默认格式？** 如 `peekview-backup-20260716-120000.tar.gz` 还是 `peekview-backup.tar.gz` | 影响用户体验和多次备份的文件管理 | 使用时间戳格式，避免覆盖 |

## 5. 裁剪说明

```yaml
phases: [P1, P2, P3, P4, P5, P6, P7, P8]
skipped: []
coupling_checklist: [api-schema: checked, data-model: checked, cross-package: checked, config: checked]
跳过风险: n/a — no phases skipped
# coupling_checklist 说明:
# - api-schema: 无新增 API 端点，纯 CLI 命令
# - data-model: 新增 BackupMetadata schema 仅 CLI 内部使用，不影响 API schema
# - cross-package: packages 仅 backend/peekview/，无跨包依赖
# - config: 读取现有 config.yaml，不修改配置结构
```

| 阶段 | 状态 | 理由 |
|------|------|------|
| P1 | 保留 | 本文件 — 需求基线 |
| P2 | 保留 | backup 一致性机制、restore ID 重映射策略需要设计 |
| P3 | 保留 | P0 明确要求：backup 一致性需要测试验证 |
| P4 | 保留 | 实现阶段 |
| P5 | 保留 | 需验证备份一致性机制在 WAL 模式下的保证，以及备份期间并发写入的数据一致性 |
| P6 | 简化 | CLI 命令，pytest 验证即可，无需 Playwright |
| P7 | 保留 | 源码文件数 13 > 5 上限，需一致性检查 |
| P8 | 保留 | 需 bump 版本号 |

## 6. 范围声明

```yaml
packages:
  - backend/peekview/    # cli.py（新命令）、services/admin_service.py（新方法）、models.py（新 schema）

domains:
  - backup     # 全量备份一致性保证
  - export     # 单条目可移植导出
  - restore    # 从备份恢复（版本兼容 + ID 重映射）
  - cli        # Click 命令注册

ui_affected: false

risk_level: medium-high
# 理由：restore 是破坏性操作（可能覆盖/合并生产数据），ID 重映射涉及 4 张表的多条 FK 链，
# 文件目录重命名与 DB 事务非原子性，中断回滚需同时处理 DB 和文件系统
```

## 7. 能力需求声明

```yaml
capability_requirements:
  - need: sqlite-consistent-backup
    why: backup 命令需要获取 WAL 模式下的一致性快照
    available:
      - "Python sqlite3 标准库"
      - "SQLAlchemy engine"
    status: available

  - need: cli-testing
    why: P6 验收需要通过 pytest 验证 CLI 命令行为
    available:
      - "pytest + Click testing（CliRunner，项目已有 test_cli.py）"
      - "conftest.py 隔离 fixtures（tmp_path, test DB）"
    status: available

  - need: large-file-handling
    why: 备份可能包含大量文件数据，需验证 tar.gz 打包不 OOM
    available:
      - "Python tarfile 标准库（流式写入，不需全量加载到内存）"
    status: available
```

[SCOPE_RESOLVED] No scope expansion during P4 implementation — all changes within P1 baseline
