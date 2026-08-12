---
phase: P1
task_id: T004-default-expires-15d
parent: 用户需求（默认15天过期策略）
trace_id: T004-P1-20260612
---

# P1 问题定义：默认 15 天过期策略

## 根因分析

Agent（AI）通过 API/CLI/MCP 创建条目时，`expires_in` 在所有入口均默认 `None`，导致 `expires_at` 为空 → 条目永不过期。Agent 频繁生产内容，旧条目成为噪声并占用存储。默认值应保护最常见场景（Agent 随手发一条，信息很快过时），同时保留永不过期的显式选择。

受影响的创建路径（共 5 处）：
- `models.py:302-305` — `EntryCreate.expires_in` 默认 `None`
- `models.py:421` — `CreateEntryRequest.expires_in` 默认 `None`
- `entry_service.py:90` — `create_entry(expires_in)` 默认 `None`
- `cli.py:201` — `--expires-in` Click option 无默认值
- MCP `publishFiles.ts:99` / `createEntry.ts:17` — schema 中 `expires_in` 为 optional，无默认注入
- `file_service.py:171-213` — `parse_expires_in` 不支持 `"0"` → 永不过期
- `config.py` — `PeekLimits` 无 `default_expires_in` 字段

---

## P1-1: 默认无过期导致旧条目无限累积

**现象**：所有创建路径（API / CLI / MCP）的 `expires_in` 默认 `None`，生成的 `expires_at` 为 `NULL`，条目永不过期。

**影响**：
- Agent 高频创建条目后，列表中充斥大量已无参考价值的旧内容
- 磁盘空间持续增长（文件 + DB），无自动回收机制
- 浏览体验下降：过期信息与有效信息混杂，无区分

**验证方式**：
- Given API/CLI/MCP 创建条目时不传 `expires_in`，Then 条目自动获得 15 天后的 `expires_at`，且写入 DB 时值非 NULL
- Given 条目创建超过 15 天后，When cleanup 任务扫描，Then 过期条目被标记删除

**相关文件**：`models.py`, `entry_service.py`, `cli.py`, MCP `publishFiles.ts`, `createEntry.ts`

---

## P1-2: 无配置项允许部署者自定义默认过期时长

**现象**：`PeekLimits` 没有 `default_expires_in` 字段，无法通过 `PEEKVIEW_LIMITS__DEFAULT_EXPIRES_IN` 环境变量或 `peekview config set` 修改默认值。

**影响**：
- 部署者无法根据自身场景调整（例如企业内部可能想设 30 天，演示环境可能想设 1 小时）
- 15 天硬编码在代码中，修改需要重新构建/部署

**验证方式**：
- Given `PEEKVIEW_LIMITS__DEFAULT_EXPIRES_IN=30d`，When 创建条目时不传 `expires_in`，Then `expires_at` = now + 30 天
- Given `peekview config set limits.default_expires_in 7d`，When 重启服务后创建条目不传 `expires_in`，Then `expires_at` = now + 7 天

**相关文件**：`config.py` (PeekLimits)

---

## P1-3: 无法显式选择"永不过期"

**现象**：`parse_expires_in` 只接受 `{digit}{h|m|d}` 格式，最小 1 分钟。若默认改为 "15d"，用户无法表达"这条不要自动过期"。

**影响**：
- 需要长期保留的条目（如文档、存档）无法创建
- 用户只能用超过 365 天的值（如 "365d"）作为变通手段，语义不清晰且受上限约束

**验收标准**：
- Given `expires_in="0"`，Then 条目 `expires_at=NULL`（永不过期）
- Given `expires_in="0d"`，Then 同上（两种写法等效）
- Given `expires_in="0h"` 或 `"0m"`，Then 同上（零值语义一致）

**相关文件**：`file_service.py:171-213`

---

## P1-4: MCP 工具未注入默认 expires_in

**现象**：`publishFiles.ts:476` 和 `createEntry.ts:92` 在调用 `client.createEntry()` 时直接透传 `params.expires_in`（可能 `undefined`），没有 fallback 到 "15d"。

**影响**：
- MCP 是 Agent 最常用的创建路径，若不改则此入口仍产生永不过期的条目
- 与后端 API/CLI 的默认行为不一致

**验证方式**：
- Given MCP `publish_files` 调用不传 `expires_in`，Then 后端收到的 `CreateEntryRequest.expires_in` 为 `"15d"`
- Given MCP `create_entry` 调用不传 `expires_in`，Then 同上

**相关文件**：`packages/mcp-server/src/tools/publishFiles.ts`, `createEntry.ts`

---

## 改动范围汇总

| 问题 | 文件 | 改动类型 |
|------|------|----------|
| P1-1 | `models.py` (EntryCreate, CreateEntryRequest) | 默认值 `None` → `"15d"` |
| P1-1 | `entry_service.py` (create_entry 签名) | 默认值 `None` → `"15d"` |
| P1-1 | `cli.py` (`--expires-in` option) | 默认值 `None` → `"15d"` |
| P1-2 | `config.py` (PeekLimits) | 新增 `default_expires_in: str` 字段 |
| P1-3 | `file_service.py` (parse_expires_in) | 支持 `"0"` / `"0d"` / `"0h"` / `"0m"` → 永不过期 |
| P1-4 | `publishFiles.ts` | `expires_in` 默认注入 `"15d"` |
| P1-4 | `createEntry.ts` | `expires_in` 默认注入 `"15d"` |

## 阶段声明

```yaml
phases: [P1, P4, P5]
```

小任务：改动逻辑简单（默认值替换 + 解析扩展），无需独立方案设计（P2/P3/P6），按裁剪流程 P1→P4→P5。
