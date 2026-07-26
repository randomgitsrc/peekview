---
phase: P2
task_id: T073
type: design
parent: P1-requirements.md
trace_id: T073-P2-20260726
status: draft
created: 2026-07-26
agent: architect
---

## 影响域分析

### 改什么

| 文件 | 行 | 当前（误改） | 修复为 | 上下文 |
|------|-----|-------------|--------|--------|
| admin_service.py | L131 | `not Entry.is_public` | `~Entry.is_public` | `case()` 内 |
| admin_service.py | L135 | `Entry.expires_at is not None` | `Entry.expires_at.isnot(None)` | `.where()` 内 |
| admin_service.py | L156 | `ApiKey.expires_at is not None` | `ApiKey.expires_at.isnot(None)` | `.where()` 内 |
| admin_service.py | L196 | `Entry.expires_at is not None` | `Entry.expires_at.isnot(None)` | `.where()` 内 |
| admin_service.py | L220 | `Entry.archived_at is not None` | `Entry.archived_at.isnot(None)` | `.where()` 内 |
| share_service.py | L71 | `EntryShare.revoked_at is None` | `EntryShare.revoked_at.is_(None)` | `.where()` 内 |
| share_service.py | L179 | `EntryShare.revoked_at is None` | `EntryShare.revoked_at.is_(None)` | `.where()` 内 |
| share_service.py | L201 | `EntryShare.revoked_at is None` | `EntryShare.revoked_at.is_(None)` | `.where()` 内 |
| share_service.py | L223 | `EntryShare.revoked_at is None` | `EntryShare.revoked_at.is_(None)` | `update().where()` 内 |
| share_service.py | L244 | `EntryShare.revoked_at is None` | `EntryShare.revoked_at.is_(None)` | `.where()` 内 |
| share_service.py | L267 | `EntryShare.revoked_at is None` | `EntryShare.revoked_at.is_(None)` | `.where()` 内 |
| apikey_service.py | L161 | `ApiKey.expires_at is not None` | `ApiKey.expires_at.isnot(None)` | `.where()` 内 |
| entry_service.py | L96 | `not File.is_binary` | `~File.is_binary` | `.where()` 内 |
| entry_service.py | L444 | `Entry.is_public` | `Entry.is_public.is_(True)` | `.where()` 内（裸 Column→明确语义） |
| entry_service.py | L445 | `Entry.is_public` | `Entry.is_public.is_(True)` | `.where()` 内 |
| entry_service.py | L448 | `(Entry.is_public)` | `Entry.is_public.is_(True)` | `.where()` 内 OR 表达式 |
| entry_service.py | L451 | `(Entry.is_public)` | `Entry.is_public.is_(True)` | `.where()` 内 OR 表达式 |
| database.py | L485 | `not File.is_binary` | `~File.is_binary` | `.where()` 内 |
| test_read_tracking.py | L365 | `not EntryRead.is_self_read` | `~EntryRead.is_self_read` | `.where()` 内 |
| pyproject.toml | — | 无 E711/E712 ignore | 添加 `E711`, `E712` 到 ignore | 回归防护 |

### 不改什么

- 前端代码（无涉及）
- MCP server 代码（无涉及）
- Python 对象属性访问（如 `if not entry.is_public`、`if entry.expires_at`）——这些是 Python 上下文，不是 SQLAlchemy 查询上下文，`is None`/`not` 是正确的
- `apikey_service.py:127` 的 `ApiKey.expires_at.is_(None)` ——已经是正确语法，无需修改
- 其他 service 文件中未列出的代码

### 风险在哪

1. **误改 Python 上下文**：修复时必须严格区分 SQLAlchemy 查询上下文（`.where()`/`case()`/`update().where()` 内）和 Python 对象上下文（`if` 语句内）。Python 上下文的 `not obj.attr`/`obj.attr is None` 是正确的
2. **裸 Column 语义**：`Entry.is_public` 在 `.where()` 中功能正确（SQLAlchemy 接受），但改为 `is_(True)` 更明确且与 `~Entry.is_public` 风格一致
3. **ruff ignore 副作用**：全局 ignore E711/E712 会让 Python 上下文的 `== None`/`!= None` 也不再被检查——但这些在 Python 代码中本就不推荐，实际影响极小

## §1 候选方案

### 方案 A：修复 + 全局 ignore E711/E712（推荐）

**修复**：将所有 19 处误改恢复为 SQLAlchemy 正确语法（`.is_(None)`/`.isnot(None)`/`~Column`/`.is_(True)`）

**回归防护**：在 `pyproject.toml` 的 `[tool.ruff.lint] ignore` 中添加 `E711` 和 `E712`

**优点**：
- 简单直接，一处配置永久防护
- E711/E712 在 SQLAlchemy 项目中几乎总是误报（正确写法 `== None`/`!= None` 会被 ruff 错误地"修复"）
- Python 代码中 `is None`/`is not None` 已是 PEP 8 推荐写法，开发者不会写 `== None`，所以 ignore E711 不会漏掉真正的 Python 代码问题
- ignore E712 同理：Python 代码中 `== True`/`== False` 本就不推荐，开发者不会写

**风险**：
- 全局 ignore 意味着 Python 上下文中如果有人写了 `x == None` 也不会被 ruff 捕获——但这是极低概率事件，且 code review 可以覆盖
- 如果未来项目不再使用 SQLAlchemy，需要重新评估 ignore 列表

**工作量**：19 处代码修复 + 1 处配置修改

### 方案 B：修复 + per-file-ignores

**修复**：同方案 A

**回归防护**：在 `pyproject.toml` 的 `[tool.ruff.lint.per-file-ignores]` 中对包含 SQLAlchemy 查询的文件单独 ignore E711/E712

**优点**：
- 精确控制，只对需要的文件 ignore
- 其他文件仍受 E711/E712 检查

**风险**：
- 新增 service 文件如果也使用 SQLAlchemy 查询，需要手动添加到 per-file-ignores——容易遗漏
- 维护成本高：每次新增含 SQLAlchemy 查询的文件都要更新配置
- 当前 6 个文件已需要 ignore，未来可能更多

**工作量**：19 处代码修复 + 1 处配置修改（per-file-ignores 列表较长）

### 方案 C：修复 + noqa 注释（不推荐）

**修复**：同方案 A

**回归防护**：在每处 SQLAlchemy 比较旁加 `# noqa: E711` 或 `# noqa: E712` 注释

**优点**：
- 最精确，只抑制特定行

**风险**：
- 维护成本最高：每处都要加注释，新增代码也必须记得加
- ruff `--fix --unsafe-fixes` 会删除 noqa 注释并"修复"代码——这正是 T073 的根因！noqa 注释无法防止 `--unsafe-fixes` 的破坏
- 已被证明无效：原代码有 noqa 注释，ruff `--fix --unsafe-fixes` 把 noqa 删掉的同时改了代码

**工作量**：19 处代码修复 + 19 处 noqa 注释

### 权衡与选择

| 维度 | 方案 A（全局 ignore） | 方案 B（per-file） | 方案 C（noqa） |
|------|---------------------|-------------------|---------------|
| 防护强度 | 强（全项目覆盖） | 中（需手动维护列表） | 弱（--unsafe-fixes 会删 noqa） |
| 维护成本 | 低（一次配置） | 中（新文件需更新） | 高（每行需加） |
| 精确性 | 低（全项目忽略） | 中 | 高 |
| 实际副作用 | 极小（Python 代码不会用 == None） | 无 | 无 |

**选择方案 A**：全局 ignore E711/E712。理由：
1. PeekView 是 SQLAlchemy 项目，E711/E712 在此项目中几乎总是误报
2. Python 代码中 `== None`/`== True` 本就不符合 PEP 8，开发者不会写，ignore 不会漏掉真正问题
3. 维护成本最低，一次配置永久防护
4. 方案 C 已被证明无效（noqa 会被 --unsafe-fixes 删除）

## §2 修复映射表

### `not Column` → `~Column`（4 处）

| 文件:行 | 误改 | 修复 |
|---------|------|------|
| admin_service.py:131 | `not Entry.is_public` | `~Entry.is_public` |
| entry_service.py:96 | `not File.is_binary` | `~File.is_binary` |
| database.py:485 | `not File.is_binary` | `~File.is_binary` |
| test_read_tracking.py:365 | `not EntryRead.is_self_read` | `~EntryRead.is_self_read` |

### `Column is not None` → `Column.isnot(None)`（5 处）

| 文件:行 | 误改 | 修复 |
|---------|------|------|
| admin_service.py:135 | `Entry.expires_at is not None` | `Entry.expires_at.isnot(None)` |
| admin_service.py:156 | `ApiKey.expires_at is not None` | `ApiKey.expires_at.isnot(None)` |
| admin_service.py:196 | `Entry.expires_at is not None` | `Entry.expires_at.isnot(None)` |
| admin_service.py:220 | `Entry.archived_at is not None` | `Entry.archived_at.isnot(None)` |
| apikey_service.py:161 | `ApiKey.expires_at is not None` | `ApiKey.expires_at.isnot(None)` |

### `Column is None` → `Column.is_(None)`（6 处）

| 文件:行 | 误改 | 修复 |
|---------|------|------|
| share_service.py:71 | `EntryShare.revoked_at is None` | `EntryShare.revoked_at.is_(None)` |
| share_service.py:179 | `EntryShare.revoked_at is None` | `EntryShare.revoked_at.is_(None)` |
| share_service.py:201 | `EntryShare.revoked_at is None` | `EntryShare.revoked_at.is_(None)` |
| share_service.py:223 | `EntryShare.revoked_at is None` | `EntryShare.revoked_at.is_(None)` |
| share_service.py:244 | `EntryShare.revoked_at is None` | `EntryShare.revoked_at.is_(None)` |
| share_service.py:267 | `EntryShare.revoked_at is None` | `EntryShare.revoked_at.is_(None)` |

### 裸 Column → `Column.is_(True)`（4 处）

| 文件:行 | 误改 | 修复 |
|---------|------|------|
| entry_service.py:444 | `Entry.is_public` | `Entry.is_public.is_(True)` |
| entry_service.py:445 | `Entry.is_public` | `Entry.is_public.is_(True)` |
| entry_service.py:448 | `(Entry.is_public)` | `Entry.is_public.is_(True)` |
| entry_service.py:451 | `(Entry.is_public)` | `Entry.is_public.is_(True)` |

### pyproject.toml 回归防护（1 处）

```toml
[tool.ruff.lint]
ignore = [
    "E501",  # line too long (handled by formatter)
    "B008",  # function call in default argument (FastAPI Depends pattern)
    "E711",  # Comparison to None (SQLAlchemy .is_()/.isnot() required)
    "E712",  # Comparison to True/False (SQLAlchemy .is_()/~ required)
]
```

## §3 BDD 覆盖映射

| BDD | 修复位置 | 覆盖方式 |
|-----|---------|---------|
| BDD-1 admin_stats 不再 500 | admin_service.py:131/135/156 | 修复 `not Entry.is_public`→`~Entry.is_public` + `is not None`→`.isnot(None)` |
| BDD-2 share 创建 revoked_at 过滤 | share_service.py:71 | 修复 `is None`→`.is_(None)` |
| BDD-3 share token 验证跳过已撤销 | share_service.py:201 | 修复 `is None`→`.is_(None)` |
| BDD-4 share cookie 验证跳过已撤销 | share_service.py:244 | 修复 `is None`→`.is_(None)` |
| BDD-5 revoke 只撤销未撤销的 | share_service.py:179 | 修复 `is None`→`.is_(None)` |
| BDD-6 API key 过期统计 | admin_service.py:156 | 修复 `is not None`→`.isnot(None)` |
| BDD-7 cleanup_expired 识别过期 | admin_service.py:196 | 修复 `is not None`→`.isnot(None)` |
| BDD-8 cleanup_expired 识别旧归档 | admin_service.py:220 | 修复 `is not None`→`.isnot(None)` |
| BDD-9 ruff 不报 E711/E712 | pyproject.toml | ignore E711/E712 |
| BDD-10 make lint-fix 不破坏 | pyproject.toml | ignore E711/E712 + 代码用 .is_()/.isnot()/~ |
| BDD-11 全部测试通过 | 所有 19 处修复 | pytest 全量通过 |
| BDD-12 entry 列表匿名只返回公开 | entry_service.py:444/445/448/451 | 修复裸 Column→`.is_(True)` |
| BDD-13 FTS 搜索找到非二进制文件 | entry_service.py:96 + database.py:485 | 修复 `not File.is_binary`→`~File.is_binary` |

## §4 完成标准

1. 所有 19 处误改已修复为 SQLAlchemy 正确语法
2. pyproject.toml 已添加 E711/E712 到 ignore 列表
3. `make test-quick` 全量通过（0 failed）
4. `ruff check --select E711,E712` 无违规
5. `make lint-fix` 不改变任何 SQLAlchemy Column 比较语法

## 声明字段

```yaml
packages: [backend/peekview]
domains: [backend]
ui_affected: false
gate_commands:
  P5: "cd backend && .venv/bin/python -m pytest tests/ -q --tb=no"
  P6: "cd backend && .venv/bin/python -m pytest tests/ -q --tb=no"
env_constraints:
  debug_env: "make debug (127.0.0.1:8888)"
  isolation_check: "make test-quick uses venv pytest with conftest autouse isolation (PEEKVIEW_STORAGE__DATA_DIR/DB_PATH → tmp_path)"
files_to_read:
  - path: backend/peekview/services/admin_service.py:123-160
    why: get_stats() 中 5 处误改（L131 not Entry.is_public, L135/156 is not None）
  - path: backend/peekview/services/admin_service.py:189-223
    why: cleanup_expired() 中 2 处误改（L196/220 is not None）
  - path: backend/peekview/services/share_service.py:68-73
    why: create_share() 中 L71 revoked_at is None
  - path: backend/peekview/services/share_service.py:175-181
    why: revoke_shares() 中 L179 revoked_at is None
  - path: backend/peekview/services/share_service.py:198-227
    why: verify_share_token() 中 L201/223 revoked_at is None
  - path: backend/peekview/services/share_service.py:240-246
    why: verify_share_cookie() 中 L244 revoked_at is None
  - path: backend/peekview/services/share_service.py:264-269
    why: revoke_all_for_entry() 中 L267 revoked_at is None
  - path: backend/peekview/services/apikey_service.py:158-164
    why: cleanup_expired_keys() 中 L161 is not None
  - path: backend/peekview/services/entry_service.py:90-97
    why: _update_fts_content() 中 L96 not File.is_binary
  - path: backend/peekview/services/entry_service.py:441-452
    why: list_entries() 中 L444/445/448/451 裸 Entry.is_public
  - path: backend/peekview/database.py:482-487
    why: _aggregate_entry_content() 中 L485 not File.is_binary
  - path: backend/tests/test_read_tracking.py:363-367
    why: test 中 L365 not EntryRead.is_self_read
  - path: backend/pyproject.toml:80-95
    why: ruff lint 配置，需添加 E711/E712 ignore
minimal_validation:
  result: not_needed
  note: 纯代码逻辑修复，SQLAlchemy .is_()/.isnot()/~ 语法是文档化 API，无需验证外部行为
```
