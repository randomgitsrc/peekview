# SQLite 并发边界

> 面向自托管用户的运行预期文档。不是设计文档，是"这台机器大概能扛多少"的实话。

## 当前配置

```
journal_mode    = WAL（Write-Ahead Logging）
busy_timeout    = 5000ms（5 秒忙等待）
check_same_thread = False（多线程安全）
synchronous     = 默认（FULL in WAL mode）
```

`pool_size` 和 `max_overflow` 使用 SQLAlchemy 默认值（`pool_size=5`, `max_overflow=10`），未显式调优。

## 并发模型

**读操作**：WAL 模式下读不阻塞写，写不阻塞读。但写操作在 WAL 中是串行的——同时只有一个写入者持有写锁。

**瓶颈**：
- **写入吞吐**：单机单 SQLite 的写入上限约 100-200 写入/秒（视机器性能和 SQL 复杂度）。所有 `INSERT`/`UPDATE`/`DELETE` 共享这个预算。
- **share `view_count` 增加**：每次分享链接被访问时执行 `UPDATE entry_shares SET view_count = view_count + 1`。高流量分享链接会让这条 UPDATE 成为热点——虽然单条 UPDATE 很快，但几百 QPS 时写入串行化瓶颈会显现。
- **FTS5 全文搜索**：FTS5 有自己的 b-tree 写入路径，不额外占用主库的写入带宽，但重建 FTS 索引需要全表扫描。

## 实际建议

| 场景 | 预期表现 | 建议 |
|------|---------|------|
| 单用户偶尔发 entry | 稳如磐石 | 无需任何调优 |
| 10 人团队日常用 | 正常 | 监控 SQLite busy 错误日志 |
| 单个分享链接被大量访问（>100 QPS） | `view_count` 写入成为瓶颈 | 考虑 view_count 异步批量写入，或换 PostgreSQL |
| 大量并发写入（>50 写入/秒持续） | busy_timeout 可能不够 | 增大 `busy_timeout` 或换 PostgreSQL |
| 多进程共享同一 db 文件 | 不推荐 | 用一个 FastAPI 进程 + uvicorn workers，不要让多个进程各自打开同一个 db |

## 监控信号

如果出现以下信号，说明接近并发上限：
1. 日志中出现 `database is locked` 错误
2. API 响应时间突然增大（P95 > 2s）
3. `busy_timeout` 触达时客户端收到 5 秒延迟

## 升级路径

如果单机 SQLite 不够用：
1. 短期：增加 `busy_timeout`，启用 `WAL` checkpoint 自动清理
2. 中期：将高频写入（如 view_count）异步批量处理
3. 长期：将 StorageBackend 抽象为接口，支持 PostgreSQL 后端（T064 规划中）
