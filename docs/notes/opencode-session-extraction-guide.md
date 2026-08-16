# OpenCode Session 记录提取指南

> 从 opencode 本地数据库提取会话（主 agent + subagents）执行记录的实操指南。
> 用途：复盘、事故分析、subagent 行为审计、命令耗时定位。
> 来源：TPV0093 复盘实践（2026-08-16），已验证。

## 1. 数据在哪

```
~/.local/share/opencode/opencode.db        # SQLite 数据库（⚠️ 可能很大，数 GB）
~/.local/share/opencode/log/               # 日志目录
~/.local/share/opencode/storage/           # 辅助存储（session_diff 等）
```

**⚠️ 危险信号**：`opencode.db` 可能达到 7.6GB 级（长期使用累积）。**绝对不要** `SELECT *` 全表扫描或用 Python 整表加载——会卡死（TPV0093 复盘评审 r1 就因此卡死一次）。

## 2. 核心表结构

| 表 | 关键字段 | 用途 |
|----|---------|------|
| `session` | `id`(PK), `project_id`, `parent_id`, `slug`, `directory`, `time_created` | 会话本体；`parent_id IS NULL` = 主会话（顶层），`parent_id` 指向主会话 = subagent 会话 |
| `message` | `id`(PK), `session_id`, `time_created`, `data`(JSON) | 消息；`data` 含 role/agent/model/summary/time |
| `part` | `id`(PK), `message_id`, `session_id`, `time_created`, `data`(JSON) | **消息组成部分（重点）**：工具调用、文本、推理。工具调用含 state/input/time |
| `todo` | `session_id`, `content`, `status` | 任务列表 |

## 3. 常用查询

### 3.1 找项目会话（按目录过滤）

```bash
cd ~/.local/share/opencode
sqlite3 opencode.db "SELECT id, substr(slug,1,20), parent_id IS NULL as is_main, \
  datetime(time_created/1000,'unixepoch','+8 hours') FROM session \
  WHERE directory LIKE '%peekview%' ORDER BY time_created DESC LIMIT 10;"
```

### 3.2 找主会话 + 它的全部 subagent 子会话

```bash
# 主会话 = parent_id IS NULL 的那个（项目最早的顶层会话）
sqlite3 opencode.db "SELECT id, slug, datetime(time_created/1000,'unixepoch','+8 hours') \
  FROM session WHERE parent_id IS NULL AND directory LIKE '%peekview%';"

# 子会话（subagents）：parent_id = 主会话 id
sqlite3 opencode.db "SELECT s.id, substr(s.slug,1,30), \
  datetime(s.time_created/1000,'unixepoch','+8 hours'), \
  (SELECT count(*) FROM message m WHERE m.session_id=s.id) as msgs \
  FROM session s WHERE s.parent_id='<主会话id>' ORDER BY s.time_created;"
```

### 3.3 提取 subagent 的工具调用序列（part 表）

```bash
# 单个会话的所有工具调用（type=tool），含状态
sqlite3 opencode.db "SELECT json_extract(p.data,'$.type'), json_extract(p.data,'$.tool'), \
  json_extract(p.data,'$.state.status') FROM part p \
  WHERE p.session_id='<会话id>' AND json_extract(p.data,'$.type')='tool' \
  ORDER BY p.time_created;"

# 工具调用的命令内容（bash 时）
sqlite3 opencode.db "SELECT json_extract(p.data,'$.state.input.command') FROM part p \
  WHERE p.session_id='<会话id>' AND json_extract(p.data,'$.tool')='bash';"
```

### 3.4 定位卡死命令（耗时计算）⭐

**关键路径**：part 的 tool data 里，时间戳在 **`$.state.time.start/end`**（毫秒），不在顶层。

```bash
# 按耗时降序找最久的命令（分钟）
sqlite3 opencode.db "SELECT json_extract(p.data,'$.tool'), \
  round((json_extract(p.data,'$.state.time.end')-json_extract(p.data,'$.state.time.start'))/60000.0,1)||'min' \
  FROM part p WHERE p.session_id='<会话id>' \
  AND json_extract(p.data,'$.type')='tool' \
  AND json_extract(p.data,'$.state.time.end') IS NOT NULL \
  ORDER BY (json_extract(p.data,'$.state.time.end')-json_extract(p.data,'$.state.time.start')) DESC LIMIT 5;"

# 找被中止的命令（state.error + interrupted 标记）
sqlite3 opencode.db "SELECT json_extract(p.data,'$.tool'), json_extract(p.data,'$.state.error'), \
  json_extract(p.data,'$.state.metadata') FROM part p \
  WHERE p.session_id='<会话id>' AND json_extract(p.data,'$.state.status')='error';"
```

**卡死判定法**：某条命令的 `state.time.end - state.time.start` 远超正常耗时（如 `cat` 命令跑 188 分钟）= subagent 卡死点。

### 3.5 提取 subagent 的关键文本（推理/结论）

```bash
sqlite3 opencode.db "SELECT substr(json_extract(p.data,'$.text'),1,200) FROM part p \
  WHERE p.session_id='<会话id>' AND json_extract(p.data,'$.type')='text' \
  ORDER BY p.time_created;"
```

## 4. 实践要点与坑

| # | 要点 | 说明 |
|---|------|------|
| 1 | **时间戳是毫秒** | `time_created`/`state.time.start/end` 都是 epoch 毫秒；显示用 `datetime(x/1000,'unixepoch','+8 hours')`（UTC+8） |
| 2 | **part 的 time 在 `$.state.time`** | 不是顶层 `$.time`（顶层 time 只在 message 表 data 里，是 assistant 消息的响应时间）——TPV0093 复盘踩坑 |
| 3 | **必须限定 session_id** | part/message 表可能千万行；`WHERE p.session_id=...` 是性能关键；用 sqlite3 命令行而非 Python 大内存加载 |
| 4 | **别查大 DB 的 SELECT *** | 7.6GB DB 全表扫描会挂起；任何查询都要 WHERE 限定 + LIMIT |
| 5 | **subagent 会话如何识别** | `parent_id` 指向主会话 = subagent；不同 subagent 是不同 session 行（slug 随机命名如 `kind-pixel`） |
| 6 | **工具调用状态机** | `state.status`: completed / error（含 interrupted 标记 = 被中止）/ 可能 running（卡死时无 end） |
| 7 | **复查数据要交叉** | 复盘引用数据前，用证据包（预先提取的 SQL 结果文件）隔离评审查大库——评审查 7.6GB DB 会再次卡死 |
| 8 | **成本/模型信息** | message.data 含 `cost`/`tokens`/`modelID`——可统计 subagent 消耗 |

## 5. 复盘工作流（推荐）

```
1. 定位主会话 + 子会话列表（3.1/3.2）
2. 对关键 subagent 提取工具调用序列（3.3）
3. 按耗时降序找卡死点/异常命令（3.4）
4. 提取关键文本消息还原决策（3.5）
5. 把提取结果写入"证据包"文件（避免评审/后续环节直接查大库）
6. 复盘文档引用证据包条目号（如 [35] 第 35 个工具调用）
```

## 6. 与 agate 结合

- subagent 的 dispatch-context 要求"分阶段落盘 progress 文件"——这是**运行时心跳**；而 session 记录是**事后审计**（含 progress 文件没写到的命令级细节，如某命令跑了多久、是否被中止）
- 复盘时两者互补：progress 看"subagent 认为自己在做什么"，session 记录看"subagent 实际做了什么"（工具调用序列 + 耗时）
- 卡死事故取证标准流程：定位最后一条 `state.status='error'`（interrupted）或耗时异常的命令 → 对照 dispatch-context 的约束 → 判定是"subagent 偏离约束"还是"基础设施无兜底"
