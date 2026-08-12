---
phase: P4
task_id: T048-entry-lifecycle
type: implementation
parent: P3-test-cases.md
trace_id: T048-P4-20260707
status: draft
created: 2026-07-07
agent: implementer
---

# T048 P4: Entry 生命周期管理 — 实现

## implementation_dir

项目根目录 `/home/kity/oclab/peekview/`（改动直接写入项目文件）

## 改动文件清单

### 后端（backend/peekview/）

| 文件 | 改动 |
|------|------|
| `models.py:98` | EntryBase +`archived_at: datetime | None = None` |
| `models.py:421` | EntryUpdate +`expires_in: str | None` |
| `models.py:475` | EntryResponse +`archived_at: datetime | None = None` |
| `models.py:496` | EntryListItem +`archived_at: datetime | None = None` |
| `models.py:695-700` | AdminCleanupResponse 重组：+archived_count/archived_slugs, 所有字段有默认值 |
| `config.py:199-214` | PeekCleanup +`archive_retention_days: int = 90` +field_validator |
| `database.py:65-68` | +archived_at ADD COLUMN migration |
| `admin_service.py:5-6` | +timedelta import |
| `admin_service.py:115-173` | cleanup_expired 两阶段实现（Phase 1 归档 + Phase 2 物理删除） |
| `entry_service.py:324-328` | get_entry +archived 访问控制 |
| `entry_service.py:366-390` | list_entries +status=archived 显式过滤 +owner OR 条件 +admin/anon 分支 |
| `entry_service.py:504-523` | update_entry +expires_in 参数 +archived 访问控制 +reactivate 逻辑 |
| `entry_service.py:468-486` | EntryListItem 构建 +archived_at |
| `entry_service.py:892` | _build_response +archived_at |
| `entry_service.py:967-968` | get_entry_with_share +archived 检查（返回 None） |
| `share_service.py:59-60` | create_share +status==archived ValidationError |
| `api/entries.py:376` | PATCH 路由传 expires_in |
| `cli.py:2022-2045` | admin cleanup 输出区分 archived/deleted |

### 前端（frontend-v3/src/）

| 文件 | 改动 |
|------|------|
| `types/index.ts:14-15` | status 改为 `'active' | 'archived'`, +archivedAt |
| `api/types.ts:14-15,39` | +archived_at on EntryListItemResponse + EntryResponse |
| `api/client.ts:49,66,57,75` | transform +archivedAt, status cast `'active'|'archived'` |
| `api/client.ts:133-138` | +updateEntry 方法（data 排除 status） |
| `components/BaseBadge.vue:7-9,38-42` | +`'archived'` variant +CSS |
| `styles/variables.css:54,109` | +`--c-badge-archived-bg`（dark + light） |
| `components/ExpiresInDialog.vue` | 新组件（全文） |
| `views/EntryDetailView.vue:324,351,59-67,128-138,289-313,388,438-444,730-758` | +archived banner +reactivate +ExpiresInDialog +expires Edit +hide Share for archived |
| `components/EntryCard.vue:2,36-38,204-207` | +`entry-card--archived` class +archived badge +opacity |
| `components/EntryListRow.vue:3,22,85-89` | +`entry-list-row--archived` class +archived badge +opacity |

### 测试文件更新

| 文件 | 改动 |
|------|------|
| `backend/tests/test_entry_lifecycle.py` | monkeypatch.setenv → 专用 fixture（cleanup_client/retention_zero_client）；datetime 断言统一为 naive（SQLite 不存 tzinfo） |
| `backend/peekview/services/entry_service.py` | get_entry archived 访问控制补充（匿名用户不可访问任何 archived entry）；expires_at 用 aware datetime |
| `backend/tests/test_admin_stats_cleanup.py:300-330,347-351,381-386,490-494,435` | archived_count 替代 deleted_count, CLI output 匹配更新 |
| `frontend-v3/src/__tests__/entry-lifecycle.test.ts` | +archivedAt to makeEntry, +archived_at to mock data, 简化类型断言 |
| `frontend-v3/src/components/__tests__/EntryListRow.spec.ts:17` | +archivedAt |
| `frontend-v3/src/api/__tests__/client.spec.ts:93,144` | +archived_at |
| `frontend-v3/src/stores/__tests__/entry.spec.ts:103` | +archivedAt |

## DESIGN_GAP 声明

[DESIGN_GAP: P2 未指定 `get_entry_with_share()` 对 archived entry 的行为。实现中加了 `status=="archived"` 检查返回 None，与 share_service 的 archived 拒绝保持一致。理由：archived entry 不应通过 share token 访问（share 创建已被拒绝），即使之前创建的 share token 也应无效。]

## SCOPE_GAP 检查

无。P2 声明 packages 含 `backend/peekview`，本次 prompt 要求改动覆盖了 P2 清单中的所有后端和前端文件。MCP 不涉及（P2 明确声明不改 MCP）。

## P3 测试覆盖状态

所有 33 个 P3 测试用例有对应实现：
- B1-B10, B14: 后端 pytest 测试（test_entry_lifecycle.py）
- B11-B13: 前端 vitest 测试（entry-lifecycle.test.ts）

## 代码规范遵守

- 无注释（除非文档/测试需要）
- DI 模式：service 通过 app.state 获取，request.app.state.entry_service/admin_service
- 配置用 PEEKVIEW_* env：archive_retention_days → PEEKVIEW_CLEANUP__ARCHIVE_RETENTION_DAYS
- EntryStatus 使用字符串值（与现有代码一致）
