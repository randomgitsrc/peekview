---
phase: P1
task_id: T005-default-expires-15d
parent: 用户需求（默认15天过期策略）
trace_id: T005-P1-20260612
---

# P1 问题定义：默认 15 天过期策略（重新分析）

## 相比 T004 的增量

T004 的 P1 定义了 4 个显式问题（P1-1 到 P1-4），但遗漏了多项隐含需求。本次 T005 重新分析，补全以下维度：

1. **用户可见性**：创建/查看时如何感知过期时间
2. **可发现性**：各入口 (CLI/MCP/API) 如何让用户知道默认过期存在
3. **配置一致性**：MCP tool description 硬编码默认值如何与 backend config 保持同步
4. **现有数据**：expires_at=NULL 的存量条目是否需要处理工具
5. **边界情况**：空字符串、无效配置值等
6. **前端消费**：未来创建 UI 和当前查看 UI 缺少什么数据
7. **响应完整性**：CreateEntryResponse 缺少 expires_at 字段

---

## 显式需求（来自用户）

- E1: 所有入口 expires_in 默认 15 天，不再永不过期
- E2: 默认值集中管理在 config，不各处硬编码
- E3: 支持 expires_in="0" 表示永不过期
- E4: 涉改：backend (config/models/service/cli/api) + MCP + 前端

---

## P1-1 (E1/E2): 所有创建路径 expires_in 默认 None → expires_at NULL（永不过期）

**现象**：API (`POST /entries`)、CLI (`peekview create`)、MCP (`create_entry` / `publish_files`) 在不传 `expires_in` 时均生成 `expires_at=NULL`（永不过期）。

**影响**：
- Agent 高频创建后旧条目无限累积，占用存储、污染列表
- 默认行为与用户预期不符（临时分享应自动清理）

**验证方式**：
- Given 任意创建入口不传 `expires_in`，Then 条目 `expires_at` = now + 15d
- Given `PEEKVIEW_LIMITS__DEFAULT_EXPIRES_IN=30d`，Then 不传时 `expires_at` = now + 30d

**相关文件**：`models.py:302-305,421`、`entry_service.py:90,135-138`、`cli.py:201`、`publishFiles.ts:476`、`createEntry.ts:92`

---

## P1-2 (E2): PeekLimits 无 default_expires_in 配置项

**现象**：`PeekLimits` 没有 `default_expires_in` 字段，无法通过环境变量或配置文件管理默认过期时长。T004 将其归为"隐含问题"，实则是 E2 的显式需求——集中管理的前提就是有配置项。

**影响**：
- 部署者无法根据场景调整默认过期（企业内部 30d、演示环境 1h）
- 修改需改代码后重建部署

**验证方式**：
- Given `PEEKVIEW_LIMITS__DEFAULT_EXPIRES_IN=30d`，Then `PeekConfig().limits.default_expires_in == "30d"`
- Given `peekview config set limits.default_expires_in 7d`，Then 配置文件写入正确且服务重启后生效
- Given `peekview config list`，Then 输出包含 `limits.default_expires_in` 及其描述

**相关文件**：`config.py` (PeekLimits)、`cli.py` (SUPPORTED_CONFIG_KEYS, _DESC, CONFIG_KEYS_HELP)

---

## P1-3 (E3): parse_expires_in 不支持 "0" 表示永不过期

**现象**：`parse_expires_in("0")` 正则不匹配（要求 `\d+[hmd]`），抛出 ValueError。"0d"/"0h"/"0m" 在末尾 bounds 检查时被 `_MIN_EXPIRES` 拦截（"0" → delta < 1 minute）。

**影响**：
- 默认改为 15d 后，用户无法创建永久保留的条目
- 变通方案 "365d" 语义不清且一年后仍会消失

**验证方式**：
- Given `expires_in="0"` → `parse_expires_in` 返回 `None`
- Given `expires_in="0d"` / `"0h"` / `"0m"` → 同上
- Given 现有有效输入 `"7d"`、`"1h"` → 行为不变

**相关文件**：`file_service.py:171-213`

---

## P1-4 (E4): 改动跨 backend + MCP + 前端，无统一验证方案

**现象**：默认过期改动涉及 3 个独立项目（Python backend、Node.js MCP、Vue 前端），各自有独立测试套件和发版流程。改动应一致但难以在一次发布中原子化。

**影响**：
- MCP 更新了 tool description 但行为不变（仍依赖后端兜底），用户可能看到不一致
- 前端尚无创建 UI，但条目详情页应展示过期信息

**验证方式**：
- Given `make debug` 启动全套本地环境，Then MCP `publish_files` 不传 `expires_in` → 条目 `expires_at` = now + 15d
- Given 前端查看条目详情，Then 能看到过期时间（如 "Expires in 14 days"）

**相关文件**：`packages/mcp-server/`、`frontend-v3/`、`backend/`

---

## 隐含需求

### P1-5 (隐含 #1 — 用户可见性): CreateEntryResponse 缺少 expires_at 字段

**现象**：`CreateEntryResponse` (models.py:426) 包含 `id, slug, url, is_public, owner_id, created_at, files`，但不含 `expires_at`。API 消费者（MCP Server、前端）创建条目后无法得知过期时间。

**影响**：
- MCP `publish_files` / `create_entry` 返回给 Agent (LLM) 的响应中无过期信息
- Agent 不知道内容将在 15 天后消失，可能错误决策（如把文档链接嵌入 issue，15 天后 404）
- 这是本次改动最关键的隐含需求——**创建响应必须告知过期时间**

**验证方式**：
- Given 创建条目（任意入口），Then API 响应 `CreateEntryResponse` 包含 `expires_at` 字段
- Given MCP `create_entry` 调用，Then 返回文本包含过期信息（如 "Expires: 2026-06-27"）

**相关文件**：`models.py:426-435` (CreateEntryResponse)、`entry_service.py:246-254`、`createEntry.ts:96-103`、`publishFiles.ts:480-492`

---

### P1-6 (隐含 #2 — 可发现性): CLI help text 和 MCP tool description 未声明默认过期行为

**现象**：
- CLI `--expires-in` option (cli.py:201) 无 `show_default` 参数，`--help` 不显示默认值
- MCP `createEntry.ts` tool description 示例用 `"7d"`，未说明默认行为
- MCP `publishFiles.ts` `expires_in` description 为 `'Expiration duration (e.g., "7d", "1h")'`，需改为 `'Expiration duration (e.g., "7d", "1h"). Default: 15d (server-side). Use "0" for no expiration.'`
- API OpenAPI schema (via FastAPI auto-generated from models) 的 `expires_in` description 不包含默认值说明

**影响**：
- 用户/Agent 不知道默认 15 天过期，内容意外消失
- 这是 T004 完全遗漏的维度——方案改了行为，但没有配套的发现性

**验证方式**：
- Given `peekview create --help`，Then `--expires-in` 行显示默认值 15d 和 "0" = 永不过期
- Given MCP `create_entry` tool description，Then 明确说明默认过期和永不过期写法
- Given API OpenAPI docs (`/docs`)，Then `expires_in` description 包含默认行为说明

**相关文件**：`cli.py:201`、`createEntry.ts:22-39,66`、`publishFiles.ts:291`、`models.py:302-305`

---

### P1-7 (隐含 #3 — 配置一致性): MCP tool description 硬编码默认值与 backend config 不同步

**现象**：如果 MCP tool description 写死 "Default: 15d"，而部署者通过 `PEEKVIEW_LIMITS__DEFAULT_EXPIRES_IN=30d` 修改了后端配置，Agent 看到的 tool description 与实际后端行为不一致。

**分析**：
- T004 P2 方案选择"后端兜底，MCP 不注入默认值"——这是正确的
- 但把 MCP tool description 从写死 "15d" 改为 "server-side" 更好：`"Expiration duration (e.g., '7d', '1h'). Default: configured on server. Use '0' for no expiration."`
- 更进一步：MCP Server 启动时调用 `GET /api/v1/config/limits` 读取实际 `default_expires_in` 值，动态注入到 tool description

**影响**：
- MCP 与后端版本可独立发布，不同步时 tool description 误导 Agent
- Agent 被告知 "15d" 但实际是 "30d" → Agent 可能为"30d" 的条目再传 `expires_in="15d"` → 行为不一致

**验证方式**：
- Given MCP tool description 不硬编码数字，Then 描述中不出现 "15d" 具体天数
- Given `GET /api/v1/config/limits` 返回 `default_expires_in: "30d"`，Then MCP 可据此生成精确 tool description

**相关文件**：`createEntry.ts:66`、`publishFiles.ts:291`、`config_router.py`（需新增端点）

---

### P1-8 (隐含 #4 — 现有数据): 存量 expires_at=NULL 条目无管理工具

**现象**：过期策略变更后，已有 `expires_at=NULL` 条目不受影响（清理任务不删除 NULL 条目）。但管理员可能需要：
- 批量给旧条目设置过期时间
- 查看有多少个永不过期的条目

当前 CLI 无 `peekview update` 命令，也无 `peekview clean`（批量清理）命令。

**影响**：
- 长期运行的部署中，大量旧条目是噪音
- 管理员无法从 CLI 了解/处理存量条目

**优先级**：此问题可推迟处理（现有条目不紧急），但应在 P1 中标记为已知缺口。

**验证方式**（推迟到后续任务）：
- Given 管理员能通过 CLI 查询 expires_at=NULL 的条目数量
- Given 管理员能通过 CLI 批量设置过期时间

**相关文件**：`cli.py`（缺 update/clean 子命令）

---

### P1-9 (隐含 #5 — 边界情况): expires_in="" 空字符串未定义行为

**现象**：如果 API 收到 `{"expires_in": ""}`（空字符串），当前行为：
- `CreateEntryRequest.expires_in` 为 `""`（不是 `None`）
- `entry_service.create_entry(expires_in="")` 走 `if expires_in:` → False → 不调用 `parse_expires_in`
- 结果：`expires_at = None`（永不过期）——**这是旧代码的意外行为**

新的默认逻辑下，`expires_in=""` 应该如何处理？
- 选项 A：等同于 `None` → 使用默认 15d
- 选项 B：拒绝请求，返回 422（严格模式）
- 选项 C：保持旧行为（但会被默认值覆盖）

**影响**：
- 不改：空字符串绕过默认 15d，产生永不过期条目（与需求矛盾）
- 改 A：对宽松调用者友好
- 改 B：对 schema 严格性友好

**验证方式**：
- Given `expires_in=""` 被传入 service，Then 行为与 `expires_in=None` 一致（使用默认值 15d）
- 或：Given `expires_in=""` 被传入 API，Then 返回 422 验证错误（"空字符串无效"）

**相关文件**：`entry_service.py:135-138`、`models.py:302`

---

### P1-10 (隐含 #6 — 配置验证): default_expires_in 配置值无效时服务启动失败无提示

**现象**：如果部署者设 `PEEKVIEW_LIMITS__DEFAULT_EXPIRES_IN=99999d`（超过上限 365d），条目创建时会因 `parse_expires_in` 抛出 ValueError 而失败。但服务启动时不会检测此问题——错误延迟到第一次创建时才暴露。

**影响**：
- 部署者设了无效值，服务正常运行数天，第一个条目创建时才崩溃
- 这是可预防的——启动时校验 `default_expires_in`

**验证方式**：
- Given `default_expires_in` 解析失败，Then 服务启动时记录 WARNING 日志（不 crash，因为可热修复）
- Given `default_expires_in` 超出范围（>365d 或 <1m 且非"0"），Then 启动时警告

**相关文件**：`config.py`（PeekLimits validator）、`main.py`（startup check）

---

### P1-11 (隐含 #7 — 前端查看): 条目详情页不展示过期信息

**现象**：前端 `EntryDetailView.vue` 展示条目细节时不显示 `expires_at`。`EntryListItemResponse`（`api/types.ts:16`）也不含 `expires_at`。用户浏览条目时无法感知哪些即将过期。

**影响**：
- 用户看到一条 14 天前创建的条目，不知道明天就过期
- 前端 "expired" status 当前不联动 `expires_at`（数据库中过期条目是 `cleanup` 任务处理后标记的）

**验证方式**：
- Given 条目有 `expires_at`（如 now + 3d），Then 详情页显示 "Expires in 3 days" 或具体日期
- Given 条目 `expires_at` 已过，Then 详情页显示 "Expired" 状态

**相关文件**：`frontend-v3/src/views/EntryDetailView.vue`、`EntryListView.vue`、`api/types.ts`

---

### P1-12 (隐含 #8 — API 配置端点): 无 /api/v1/config/limits 端点供前端和 MCP 消费

**现象**：`config_router.py` 只暴露 `/api/v1/config/captcha`，没有 `/api/v1/config/limits`。前端/MCP 无法获知：
- `default_expires_in` 当前值
- 允许的过期范围（最小值、最大值）
- 其他限制（max_file_size 等）

**影响**：
- 未来前端创建 UI 无法预填默认过期选项
- MCP 无法动态获取实际默认值以生成 tool description
- `max_summary_length`、`max_file_size` 等前端需要但无法读取

**验证方式**：
- Given `GET /api/v1/config/limits`，Then 返回 200，包含 `default_expires_in` 字段
- Given 修改 `PEEKVIEW_LIMITS__DEFAULT_EXPIRES_IN=7d` 并重启，Then `/api/v1/config/limits` 返回 `{"default_expires_in": "7d"}`

**相关文件**：`config_router.py`、可能新增 `PublicLimitsConfig` Pydantic model

---

## 改动范围汇总

| 问题 | 文件 | 改动类型 |
|------|------|----------|
| P1-1 | `entry_service.py` | `create_entry`: 默认 fallback 到 `config.limits.default_expires_in` |
| P1-2 | `config.py` | PeekLimits 新增 `default_expires_in: str = "15d"` |
| P1-2 | `cli.py` | SUPPORTED_CONFIG_KEYS + _DESC + CONFIG_KEYS_HELP 添加 |
| P1-3 | `file_service.py` | `parse_expires_in` 返回类型 `timedelta \| None`，支持 "0"/"0d"/"0h"/"0m" |
| P1-5 | `models.py` | `CreateEntryResponse` 新增 `expires_at` 字段 |
| P1-5 | `createEntry.ts`, `publishFiles.ts` | 响应文本包含过期时间 |
| P1-6 | `cli.py:201` | `--expires-in` help text 声明默认值和 "0" 永不过期 |
| P1-6 | `createEntry.ts:22-39,66` | tool description 和 expires_in description 声明默认行为 |
| P1-6 | `publishFiles.ts:291` | expires_in description 声明默认行为 |
| P1-7 | `createEntry.ts`, `publishFiles.ts` | tool description 不硬编码天数，改为 "server-side" |
| P1-7 | `config_router.py` | 新增 `GET /api/v1/config/limits` |
| P1-9 | `entry_service.py` | 空字符串 `""` → 视为 `None`（使用默认值） |
| P1-10 | `config.py` | PeekLimits validator 校验 `default_expires_in` |
| P1-11 | `EntryDetailView.vue`, `EntryListView.vue` | 展示 `expires_at` |
| P1-12 | `config_router.py` | 新增 `GET /api/v1/config/limits` 端点（与 P1-7 共享） |

---

## 阶段声明

```yaml
phases: [P1, P2, P4, P5]
```

**理由**：此任务跨 backend + MCP + 前端，涉及配置新增、返回类型变更、API 端点新增、UI 展示新增。改动范围在中任务边界（~12 个改动点），需要 P2 方案设计来明确数据流和跨组件交互，避免各组件改动不一致。

对比 T004 声明 `[P1, P4, P5]`（小任务），T005 增加了 P1-5~P1-12 的隐含需求后已升级为中任务，需要 P2 方案设计。
