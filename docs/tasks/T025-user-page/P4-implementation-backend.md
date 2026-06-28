---
phase: P4
task_id: T025-user-page
type: implementation
parent: P2-design.md
trace_id: T025-P4-20260628
created: 2026-06-28
---

# P4 后端实现 — owner=username 查询管线

## 改动摘要

2 个文件，共 ~50 行新增/修改。实现 P2-design.md 的「解析→过滤→权限叠加」三阶段管线，使 `list_entries` 支持 `owner=<username>` 查询，并在 `EntryListResponse` 中返回 `owner_found` 三态字段。

## 改动清单

### 1. `backend/peekview/models.py:429-442` — EntryListResponse 新增 owner_found

```python
class EntryListResponse(SQLModel):
    items: list[EntryListItem]
    total: int
    page: int
    per_page: int
    owner_found: bool | None = Field(
        default=None,
        description="Tri-state: None=owner not specified or 'me' (N/A), "
        "True=username exists in database, "
        "False=username not found",
    )
```

**对应 BDD**：BE-3 (`owner_found=False`)、BE-4 (`owner_found=True`)、BE-5 (`owner_found=None`)

`Field` 已在 `models.py` 顶部导入（line 19），无需新增导入。

### 2. `backend/peekview/services/entry_service.py:289-425` — list_entries 三阶段管线重构

**变更内容**：

**Phase 1（解析 owner → user_id）**：原 `if owner == "me": ... elif is_admin: ... elif current_user_id is None: ... else: ...` 交织逻辑，改为：
- 先解析 `owner` 参数（`"me"` 分支保留，真实 username 走 `func.lower(User.username)` 大小写不敏感查询）
- 解析结果存入 `owner_found`（三态：`None` / `True` / `False`）和 `owner_user_id`

**Phase 2（owner filter 施加）**：独立 `.where(Entry.owner_id == owner_user_id)` 施加在 query 和 count_query 上，与 Phase 3 解耦

**Phase 3（权限叠加）**：原 `is_admin` / `current_user_id is None` / `else` 三段逻辑**完全不变**，仅从原来嵌在 `if owner == "me": ... elif ...` 里移出为独立阶段

**4 个 EntryListResponse 构造点全部显式传 `owner_found`**：

| # | 位置 | 场景 | owner_found 值 |
|---|------|------|---------------|
| 1 | Phase 1 — `owner="me"` + 未登录 | 早期 return | `None` |
| 2 | Phase 1 — username 不存在 | 早期 return | `False` |
| 3 | FTS 搜索无结果 | 早期 return | 透传 `owner_found` |
| 4 | 正常最终返回 | 末端 return | 透传 `owner_found` |

**关键设计点**：

- `owner="me"` 行为语义零回归：Phase 1 中 `owner == "me"` 分支保留原有「未登录 → 空列表，已登录 → 按 owner_id 过滤」语义，仅代码结构变化（从 `.where()` 内联改为 Phase 2 独立施加）
- `func.lower(User.username)` 大小写不敏感查询：符合 PAUSED-resolution.md Q3 裁决。`User` 已在文件顶部导入（line 33），`func` 已在顶部导入（line 13）
- 已删除用户 vs 不存在用户统一返回 `owner_found=False`：PAUSED-resolution.md Q1 裁决
- 原 visibility filter 逻辑 100% 保留，仅从 Phase 1 移出为 Phase 3

**对应 BDD**：

| BDD | 验证行为 | 实现机制 |
|-----|---------|---------|
| BE-1 | owner=alice 返回 3 个 entry | Phase 1 解析 + Phase 2 owner filter |
| BE-2 | 大小写不敏感 | `func.lower(User.username)` |
| BE-3 | 不存在 username → items=[] + owner_found=false | Phase 1 构造点 2 提前 return |
| BE-4 | 存在但无可见 → items=[] + owner_found=true | Phase 2 + Phase 3 串联 → 构造点 4 |
| BE-5 | owner="me" → owner_found=None | Phase 1 构造点 1 |
| BE-6 | admin 看全部 | Phase 3 `is_admin` 跳过 visibility filter |
| BE-7 | 匿名只看公开 | Phase 3 `current_user_id is None` 分支 |
| BE-8 | owner=alice + q=keyword 组合 | 构造点 3/4 透传 owner_found=True |
| BE-9 | owner=alice + q=NoSuchKeyword 组合 | 构造点 3 透传 owner_found=True |

## 验证结果

```
$ cd backend && .venv/bin/python -m pytest tests/test_user_page.py -v --tb=short
9 passed in 0.65s

$ cd backend && .venv/bin/python -m pytest tests/ -q --tb=no
586 passed, 1 skipped in 111.13s
```

- 新增 9 个 TDD 测试全部绿
- 现有 577 测试零回归（586 total = 577 legacy + 9 new）

## 不改的文件

- `backend/peekview/api/entries.py` — `owner` query param 已透传（line 108-127），无需改
- `backend/peekview/auth.py` — 不涉及认证逻辑
- `backend/peekview/database.py` — 不涉及 schema 变更
- 前端文件 — 属于前端实现（另一个 P4 子任务），不在本次范围
