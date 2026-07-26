---
phase: P4
task_id: T073
type: implementation
parent: P2-design.md
trace_id: T073-P4-20260726
status: draft
created: 2026-07-26
agent: implementer
---

## implementation_dir

`backend/peekview/` + `backend/tests/` + `backend/pyproject.toml`

## 修复清单

### `not Column` → `~Column`（4 处）

| 文件:行 | 修复 |
|---------|------|
| admin_service.py:131 | `not Entry.is_public` → `~Entry.is_public` |
| entry_service.py:96 | `not File.is_binary` → `~File.is_binary` |
| database.py:485 | `not File.is_binary` → `~File.is_binary` |
| test_read_tracking.py:365 | `not EntryRead.is_self_read` → `~EntryRead.is_self_read` |

### `Column is not None` → `Column.isnot(None)`（5 处）

| 文件:行 | 修复 |
|---------|------|
| admin_service.py:135 | `Entry.expires_at is not None` → `Entry.expires_at.isnot(None)` |
| admin_service.py:156 | `ApiKey.expires_at is not None` → `ApiKey.expires_at.isnot(None)` |
| admin_service.py:196 | `Entry.expires_at is not None` → `Entry.expires_at.isnot(None)` |
| admin_service.py:220 | `Entry.archived_at is not None` → `Entry.archived_at.isnot(None)` |
| apikey_service.py:161 | `ApiKey.expires_at is not None` → `ApiKey.expires_at.isnot(None)` |

### `Column is None` → `Column.is_(None)`（6 处）

| 文件:行 | 修复 |
|---------|------|
| share_service.py:71 | `EntryShare.revoked_at is None` → `EntryShare.revoked_at.is_(None)` |
| share_service.py:179 | `EntryShare.revoked_at is None` → `EntryShare.revoked_at.is_(None)` |
| share_service.py:201 | `EntryShare.revoked_at is None` → `EntryShare.revoked_at.is_(None)` |
| share_service.py:223 | `EntryShare.revoked_at is None` → `EntryShare.revoked_at.is_(None)` |
| share_service.py:244 | `EntryShare.revoked_at is None` → `EntryShare.revoked_at.is_(None)` |
| share_service.py:267 | `EntryShare.revoked_at is None` → `EntryShare.revoked_at.is_(None)` |

### 裸 Column → `Column.is_(True)`（4 处）

| 文件:行 | 修复 |
|---------|------|
| entry_service.py:444 | `Entry.is_public` → `Entry.is_public.is_(True)` |
| entry_service.py:445 | `Entry.is_public` → `Entry.is_public.is_(True)` |
| entry_service.py:448 | `(Entry.is_public)` → `Entry.is_public.is_(True)` |
| entry_service.py:451 | `(Entry.is_public)` → `Entry.is_public.is_(True)` |

### pyproject.toml 回归防护（1 处）

添加 `E711`, `E712` 到 `[tool.ruff.lint] ignore` 列表。

## 自查结果

- 159 个关键测试全部通过（admin_stats, share, read_tracking, fts_content, apikey, entry_service, BDD T073 专项）
- `ruff check --select E711,E712` 无违规
- `ruff check --fix --unsafe-fixes` 幂等（不再改变 SQLAlchemy 比较语法）
- Python 上下文的 `is None`/`is not None`/`not` 未被误改

[PROD_NOT_TOUCHED]
