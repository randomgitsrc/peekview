# 升级指南

> 本文档记录 PeekView 跨版本升级的**破坏性变更、升级顺序与注意事项**。
> 规则：**有破坏性变更或升级顺序要求时，在这里追加一节**（按版本号，最新在上），
> **不要**写进 `CHANGELOG.md` 的 `[Unreleased]`（bump 时会随新版本滚动错位），
> 也**不要**写进 `README.md`（具体版本信号易过时遗留）。
> 版本条目在发布后保留，不随后续版本修改（历史事实）。

---

## v0.26.1 → v0.27.0（时间字段带 `Z` 后缀，UTC 语义显式化）

**升级顺序：任意顺序**。后端（peekview 0.27.0）与 MCP（0.12.0）之间**无版本协同要求**——MCP 代码未改，其两处 `new Date(...)` 消费（`createEntry.ts` / `publishFiles.ts`）在本次变更后由「错 8 小时」变为正确。

升级动作与其他版本一致：`pipx upgrade peekview` → `sudo systemctl restart peekview`（`pipx upgrade` 只更新包文件，不重启服务；CLI 与后端同包，升级后端即更新 CLI）。

### 破坏性变更：API / CLI `--json` 的 datetime 字段补 `Z`

受影响的字段（响应体与 `--json` 输出中出现的全部 datetime）：

`created_at` / `updated_at` / `expires_at` / `archived_at` / `archive_delete_at` / `revoked_at` / `starred_at` / `last_read_at` / `read_at` / `deleted_at` / `last_used_at` / `disabled_at` / `latest_created_at`

```text
0.26.1（旧）：{"created_at": "2026-11-10T09:43:00"}
0.27.0（新）：{"created_at": "2026-11-10T09:43:00Z"}
```

管理备份导出的 JSON 同样改为带 `Z`。数据库存储形态与内部语义**不变**（仍是 naive-UTC），变更只发生在序列化出口。

#### 谁会受影响

**直接消费 API 响应或 CLI `--json` 输出的第三方脚本**：自建看板、定时同步任务、把 PeekView 当内容源抓取的下游系统。仅通过网页界面使用的用户不受影响。MCP 客户端也不受影响（见下方「MCP 无需改动」）。

#### 为什么改

旧字符串**不带时区标记**，而值是 UTC。`new Date("2026-11-10T09:43:00")` 在 ECMAScript 规范下按**本地时间**解析，于是同一份数据：

- `Asia/Shanghai`（UTC+8）用户看到 `17:43` 的墙上时间，实际该时刻是 `09:43 UTC` = 本地 `17:43`——**看起来对，但这是巧合**：脚本做的时间差、跨时区比较、`toISOString()` 回写全部偏移 8 小时；
- 任何把该字符串与另一条带 `Z` 的时间（如 `Date.now().toISOString()`）相比的脚本，会得到 8 小时的固定误差。

此前该缺陷被「Explore 页主显相对时间（`3h ago`）」掩盖——相对时间不暴露绝对时刻。本版本主显改为绝对时间后，错 8 小时会直接呈现在界面上，故必须在同一版本内修正序列化出口。`Z` 是 ISO 8601 规定的 UTC 设计符，补上它是**修正错误**而非新增语义。

#### 怎么迁移

- **合规 ISO 8601 解析器：无需改动。** JavaScript `new Date()`、Go `time.RFC3339`、Java `Instant.parse`、Rust `chrono::DateTime::parse_from_rfc3339`、Python 3.11+ 的 `datetime.fromisoformat()` 都能读 `Z`，且读出的时刻**与之前语义正确时期望的一致**。若你的脚本此前已经手工加过 8 小时或调用 `+ "Z"` / `+ " UTC"` 拼接过字符串，**删掉那段补偿**，否则会反向偏移。
- **Python 3.10 是唯一需要改的例外。** `datetime.fromisoformat()` 在 3.10 不接受 `Z`（3.11 起才支持），会抛 `ValueError: Invalid isoformat string`：

  ```python
  # Python 3.10 —— 会抛 ValueError
  dt = datetime.fromisoformat(value)

  # 兼容写法（3.10 / 3.11+ 皆可）
  dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
  ```

  生产代码里出现该模式的第三方脚本必须同步修改；若脚本以 `python3` 直跑，先确认解释器版本（`python3 -V`）。
- **字符串比对/正则**：若有断言形如 `assert created_at == "2026-11-10T09:43:00"` 或正则 `\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$`（以字符串结尾定位），需放宽为允许可选的 `Z`。
- **CLI `--json` 消费方**：CLI 与 API 现为同一形态，此前若为两者分别写了两套解析（一套吃 `+00:00`、一套吃裸字符串），可合并为一套。

#### MCP 无需改动

`packages/mcp-server` 的 `createEntry.ts` / `publishFiles.ts` 用 `new Date(...)` 处理后端时间字符串——补 `Z` 后由「按本地时间误读」变为「按 UTC 正确读」，代码零改动、行为**修正**。若在 MCP 输出里观察到时间文本变化，那是修复而非回归。

### 窗口期风险

本次无「先升哪个」的约束：0.26.1 后端 + 0.12.0 MCP、0.27.0 后端 + 0.12.0 MCP 两种组合均可运行。唯一不对称在于 0.26.1 后端的时间字符串缺少 `Z`——若你的下游脚本已按新形态（允许/期望 `Z`）编写，请**先升级后端再改脚本**，顺序颠倒会出现短暂解析失败。

---

## v0.21.0 → v0.22.0（2026-09-03，team 可见性）

**升级顺序：先升后端（peekview 0.22.0），再升 MCP（0.12.0）**，不要颠倒。

### 后端（pipx peekview 0.21.0 → 0.22.0）——安全升级

- 数据迁移幂等（`CREATE TABLE IF NOT EXISTS` + 列存在检查），旧库（无 teams 表、entries 无 team_id）升级启动成功、存量数据完好
- CLI / 前端跟随服务端版本发布，旧命令与旧 API 调用不变
- 行为变化（收紧/更友好，不影响正常使用）：
  - share 三接口（create / list / revoke）非 owner 403 → 404（防存在性枚举）
  - 空文件 entry download：NO_FILES 404 → 空 zip 200

### MCP（npm @peekview/mcp-server 0.11.0 → 0.12.0）——向后兼容，但依赖后端顺序

- 新增 `list_teams` 工具 + `create_entry`/`publish_files` 可选 `team_id` 参数 + `get_entry` 输出新增 `team` 字段（JSON 增量）
- **`list_teams` 依赖后端 `/api/v1/teams` 端点（0.22 才有）**——若 MCP 先升而后端仍为 0.21，`list_teams` 会 404

### ⚠️ 窗口期风险

0.21 后端 + MCP 0.12 时，agent 传 `team_id` 会被 Pydantic 静默忽略（0.21 的 `CreateEntryRequest` 无 `extra=forbid`），内容按默认 `is_public=true` 发布——**团队内容意外变 public**。

两端无法同时升级时：MCP 0.12 配 0.21 后端的窗口期内，**不要让 agent 传 `team_id`**。

---
