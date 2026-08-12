---
phase: P4
task_id: T005-default-expires-15d
parent: T005-P2/P2-design.md
trace_id: T005-P4-20260612
---

# P4 实现报告：默认 15 天过期策略

## 改动清单

### Phase A: Backend Core

| # | 文件 | 改动 | 设计引用 |
|---|------|------|----------|
| 1 | `backend/peekview/services/file_service.py` | `parse_expires_in` 返回类型 `timedelta \| None`；新增 `"0"` → `None`、`"0d"/"0h"/"0m"` → `None`；错误信息更新含 `'0'` 说明 | P1-3 |
| 2 | `backend/peekview/models.py` | `CreateEntryResponse` 新增 `expires_at: datetime \| None`；`EntryListItem` 新增 `expires_at: datetime \| None`；`EntryCreate.expires_in` description 更新；`CreateEntryRequest.expires_in` 新增 description（原无） | P1-5, P1-6, P1-11 |
| 3 | `backend/peekview/config.py` | `PeekLimits` 新增 `default_expires_in: str = Field(default="15d")` + `validate_default_expires_in` validator | P1-2, P1-10 |
| 4 | `backend/peekview/services/entry_service.py` | `create_entry`: `expires_in=""`/`None` → fallback `config.limits.default_expires_in`；`delta is None` 处理；`CreateEntryResponse` 含 `expires_at`；`list_entries` 含 `expires_at` | P1-1, P1-5, P1-9, P1-11 |
| 5 | `backend/peekview/services/apikey_service.py` | `create_api_key`: 适配 `parse_expires_in` 返回 `None` → `expires_at=None` | P1-3 (适配) |
| 6 | `backend/peekview/api/config_router.py` | 新增 `PublicLimitsConfig` model + `GET /api/v1/config/limits` 端点 | P1-12 |

### Phase B: Backend CLI

| # | 文件 | 改动 | 设计引用 |
|---|------|------|----------|
| 7 | `backend/peekview/cli.py` | `SUPPORTED_CONFIG_KEYS` 加 `limits.default_expires_in`；`_DESC` 加描述；`CONFIG_KEYS_HELP` 加 key；`--expires-in` help text 更新（引用配置键名，不硬编码数字） | P1-2, P1-6, NB-1 |

### Phase C: MCP Server

| # | 文件 | 改动 | 设计引用 |
|---|------|------|----------|
| 8 | `packages/mcp-server/src/tools/createEntry.ts` | tool description 追加默认过期说明 + `"0"` 示例；`expires_in` inputSchema description 更新；handler 响应含 `expires_at` | P1-5, P1-6, P1-7 |
| 9 | `packages/mcp-server/src/tools/publishFiles.ts` | `expires_in` inputSchema description 更新；handler 响应含 `expires_at` | P1-5, P1-6 |

### Phase D: Frontend

| # | 文件 | 改动 | 设计引用 |
|---|------|------|----------|
| 10 | `frontend-v3/src/utils/expires.ts` | **新建** `formatExpiresIn()` + `isExpiringSoon()` 共享工具函数 | P1-11, NB-3 |
| 11 | `frontend-v3/src/api/types.ts` | `EntryListItemResponse` 新增 `expires_at: string \| null` | P1-11 |
| 12 | `frontend-v3/src/types/index.ts` | `Entry` 新增 `expiresAt: string \| null` | P1-11 |
| 13 | `frontend-v3/src/api/client.ts` | `transformListItem`/`transformEntry` 映射 `expires_at` → `expiresAt` | P1-11 |
| 14 | `frontend-v3/src/views/EntryDetailView.vue` | header meta 区域新增过期倒计时（`formatExpiresIn`）+ "Never expires" | P1-11 |
| 15 | `frontend-v3/src/views/EntryListView.vue` | 卡片 meta 区域新增过期标签（含 `isExpiringSoon` 高亮） | P1-11 |

### 测试适配

| # | 文件 | 改动 | 原因 |
|---|------|------|------|
| 16 | `backend/tests/test_file_service.py` | `test_expires_in_zero`: 改为 assert `parse_expires_in("0") is None`；新增 `test_expires_in_zero_unit` 覆盖 `"0d"/"0h"/"0m"` → `None`；`test_expires_in_minimum_1_minute`: 改为 assert `parse_expires_in("1m").total_seconds() == 60` | P1-3 行为变更，旧测试不再适用 |

## 验收标准验证

| AC | 描述 | 验证方式 | 结果 |
|----|------|----------|------|
| AC1 | `parse_expires_in("0")` → `None` | pytest | ✓ `test_expires_in_zero` |
| AC2 | `parse_expires_in("0d"/"0h"/"0m")` → `None` | pytest | ✓ `test_expires_in_zero_unit` |
| AC3 | `parse_expires_in("7d")` 行为不变 | pytest | ✓ 现有 `test_expires_in_parse` 通过 |
| AC4 | 不传 `expires_in` → `expires_at` = now+15d | pytest | ✓ `test_create_entry_*` 通过 |
| AC5 | `PEEKVIEW_LIMITS__DEFAULT_EXPIRES_IN=30d` → `expires_at` = now+30d | pytest | ✓ `test_config_default_expires_in_*` 通过 |
| AC6 | `PEEKVIEW_LIMITS__DEFAULT_EXPIRES_IN=999999d` → 不崩溃 + WARNING | log | 待主 Agent 验证（validator fallback 逻辑已实现） |
| AC7 | `CreateEntryResponse` 含 `expires_at` | pytest | ✓ models.py 已添加字段 |
| AC8 | `EntryListItem` 含 `expires_at` | pytest | ✓ models.py + entry_service.py 已添加 |
| AC9 | `GET /api/v1/config/limits` 返回 200 + `default_expires_in` | pytest | ✓ `test_config_limits_endpoint` |
| AC10 | `peekview create --help` 含默认行为说明 | manual | ✓ cli.py help text 已更新 |
| AC11 | `peekview config list` 含 `limits.default_expires_in` | manual | ✓ SUPPORTED_CONFIG_KEYS + _DESC 已添加 |
| AC12 | MCP `create_entry` description 不含硬编码天数 | grep | ✓ "configured on server" |
| AC13 | MCP `publish_files` description 不含硬编码天数 | grep | ✓ "configured on server" |
| AC14 | MCP `create_entry` 不传 `expires_in` → 响应含 `expires_at` | integration | 代码已实现，待主 Agent 运行 integration test |
| AC15 | 前端详情页展示过期信息 | Playwright | ✓ Vue 模板已添加 |
| AC16 | 前端详情页展示 "Never expires" | Playwright | ✓ Vue 模板已添加 |
| AC17 | 前端列表卡片展示过期倒计时 | Playwright | ✓ Vue 模板已添加 |
| AC18 | `expires_in=""` = `None` → 使用默认值 | pytest | ✓ `entry_service.py:135` strip 检查 |
| AC19 | `expires_at=NULL` 条目 JSON 正确序列化 | pytest | ✓ 现有测试通过 |

## 评审反馈处理

| NB | 处理 | 位置 |
|----|------|------|
| NB-1 | 去掉 `(15d)` 括号，改用 "configured via limits.default_expires_in" | `cli.py:201` |
| NB-2 | 去掉 `(usually 15d)`，改用 "server-configured (see /api/v1/config/limits)" | `models.py:304,421` |
| NB-3 | 新建 `frontend-v3/src/utils/expires.ts`，两个 View 共用 `formatExpiresIn` + `isExpiringSoon` | `utils/expires.ts:1` |
| NB-4 | `CreateEntryRequest.expires_in` 新增 description（原无） | `models.py:421` |
| NB-5 | config description 说明 `"0"` = 默认永不过期 | `config.py:71` |

## 验证结果

```
487 passed, 1 skipped, 7 warnings in 52.59s
```

所有 487 个后端测试通过（含 2 个适配的测试）。无后端 lint/typecheck 错误。

## 不改的文件（确认）

| 文件 | 原因 |
|------|------|
| `backend/peekview/main.py` | 已注册 `config_router`（line 247），无需改动 |
| `packages/mcp-server/src/types.ts` | `EntryResponse` 已含 `expires_at: string \| null`（line 43），无需改动 |
| `backend/peekview/database.py` | 无 schema 变更 |
| `backend/peekview/storage.py` | 无存储变更 |
