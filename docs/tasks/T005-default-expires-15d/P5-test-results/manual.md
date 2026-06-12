---
phase: P5
task_id: T005-default-expires-15d
parent: T005-P4/P4-implementation.md
trace_id: T005-P5-20260612
---

# P5 手动验证结果：默认 15 天过期策略

## P1 问题逐项验证

### P1-1: 所有创建路径默认不传 → 15 天过期 ✅

**入口覆盖**：

| 入口 | 验证方式 | 结果 |
|------|----------|------|
| API `POST /entries` | 代码审计：`entry_service.py:136` strip 检查后走 else 分支 → `config.limits.default_expires_in` | ✅ |
| CLI `peekview create` | 代码审计：CLI 不显式传 `expires_in` → `expires_in=None` → service fallback | ✅ |
| MCP `create_entry` | 代码审计：`createEntry.ts:95` `expires_in: params.expires_in`（不注入默认值） → 后端兜底 | ✅ |
| MCP `publish_files` | 代码审计：`publishFiles.ts:476` `expires_in: params.expires_in`（不注入默认值） → 后端兜底 | ✅ |

**代码路径**（`entry_service.py:135-144`）：
```python
expires_at = None
if expires_in and expires_in.strip():
    delta = parse_expires_in(expires_in)
    if delta is not None:
        expires_at = datetime.now(timezone.utc) + delta
else:
    default_expires = self.config.limits.default_expires_in
    delta = parse_expires_in(default_expires)
    if delta is not None:
        expires_at = datetime.now(timezone.utc) + delta
```

### P1-2: PeekLimits 有 default_expires_in 配置项 ✅

- `config.py:68-71`: `default_expires_in: str = Field(default="15d", description=...)`
- `config.py:73-87`: `validate_default_expires_in` validator
- `cli.py:544`: `"limits.default_expires_in"` 加入 `SUPPORTED_CONFIG_KEYS`
- `cli.py:751`: `("limits", "default_expires_in"): "# 默认过期时长（如 15d、7d、1h，'0' 为永不过期）"` 加入 `_DESC`
- `cli.py:562`: `limits.default_expires_in` 加入 `CONFIG_KEYS_HELP`
- 环境变量 `PEEKVIEW_LIMITS__DEFAULT_EXPIRES_IN=30d` 自动生效

### P1-3: parse_expires_in 支持 "0" ✅

- `file_service.py:190-191`: `if expires_in == "0": return None`
- `file_service.py:211-212`: `if value == 0: return None`（处理 "0d"/"0h"/"0m"）
- 现有有效输入（"7d"/"1h"/"30m"）行为不变
- 错误信息已更新含 `'0' for no expiration` 提示

### P1-4: 跨组件统一验证 ✅

| 层级 | 状态 |
|------|------|
| Backend unit | 487 passed, 0 failed |
| MCP unit | 167 passed, 1 pre-existing failure (non-T005) |
| Frontend build | ✓ built successfully |
| Frontend unit | 74 passed, 1 pre-existing failure (non-T005) |

### P1-5: CreateEntryResponse 含 expires_at ✅

- `models.py:438`: `expires_at: datetime | None` 字段已添加
- `entry_service.py:258`: `expires_at=expires_at` 传入响应构造
- MCP `createEntry.ts:108-113`: 响应文本包含 `Expires: YYYY-MM-DD` 或 `Expires: never`
- MCP `publishFiles.ts:493-498`: 同上

### P1-6: CLI/MCP/API 可发现性 ✅

- **CLI**: `cli.py:201` — help text: `"Expiration duration (e.g., '7d', '1h', '30m'). Default: configured via limits.default_expires_in. Use '0' for no expiration."`
- **API**: `models.py:302-304` — `description="Duration like '7d', '1h', '30m'. Default: server-configured (see /api/v1/config/limits). Use '0' for no expiration."`
- **API**: `models.py:422-424` — `CreateEntryRequest.expires_in` 同样 description
- **MCP createEntry** `createEntry.ts:39-42`: tool description 末尾追加 `"Default: If expires_in is omitted, the server's default expiration applies. Check /api/v1/config/limits for current setting."`
- **MCP createEntry** `createEntry.ts:69`: `description: 'Expiration duration (e.g., "7d", "1h"). Default: configured on server. Use "0" for no expiration.'`
- **MCP publishFiles** `publishFiles.ts:291`: 同上 description

### P1-7: MCP description 不硬编码天数 ✅

- `grep "15d\|15 days" packages/mcp-server/src/` → **0 matches**
- 均使用 `"configured on server"` / `"server-configured"` 措辞

### P1-8: 存量数据 ✅ [推迟]

- 按设计推迟，不在本次范围
- `expires_at=NULL` 的条目不受清理任务影响

### P1-9: expires_in="" 空字符串 ✅

- `entry_service.py:135-136`: `if expires_in and expires_in.strip():` → 空字符串为 falsy → 走 else 分支 → 使用默认值

### P1-10: 无效配置启动告警 ✅

- `config.py:73-87`: validator 捕获 `ValueError` → `logging.getLogger("peekview.config").warning(...)` → fallback "15d"
- 服务不崩溃继续运行

### P1-11: 前端展示过期信息 ✅

- `utils/expires.ts`: `formatExpiresIn` + `isExpiringSoon` 共享工具函数
- `EnumDetailView.vue:34-39`: 有 `expiresAt` → `Expires {{ formatExpiresIn(...) }}`；无 → `Never expires`
- `EntryListView.vue:84-87`: 卡片 meta 区域显示过期标签，`isExpiringSoon` 时 ccs class `meta-expires-soon` 高亮

### P1-12: /api/v1/config/limits 端点 ✅

- `config_router.py:49-76`: `PublicLimitsConfig` model + `GET /limits` 端点
- 无认证要求（public 安全信息）
- 返回 `default_expires_in`, `max_file_size`, `max_entry_files`, `max_entry_size`, `max_slug_length`, `max_summary_length`

## P1 问题验证汇总

| 问题 | 描述 | 验证结果 |
|------|------|----------|
| P1-1 | 所有创建路径默认 15d | ✅ |
| P1-2 | PeekLimits 有 default_expires_in | ✅ |
| P1-3 | parse_expires_in 支持 "0" | ✅ |
| P1-4 | 跨组件统一验证方案 | ✅ |
| P1-5 | CreateEntryResponse 含 expires_at | ✅ |
| P1-6 | CLI/MCP/API 可发现性 | ✅ |
| P1-7 | MCP description 不硬编码天数 | ✅ |
| P1-8 | 存量数据（推迟） | ✅ 推迟 |
| P1-9 | expires_in="" 空字符串 | ✅ |
| P1-10 | 无效配置启动告警 | ✅ |
| P1-11 | 前端展示过期信息 | ✅ |
| P1-12 | /api/v1/config/limits 端点 | ✅ |

**12/12 通过。**

## 质量门槛

- [x] P1 每个问题都有对应验证结论（通过/未通过）
- [x] 有失败项 → 无（T005 相关 0 失败）
- [x] **门槛通过**
