---
phase: P3
task_id: T025-user-page
type: test-cases
parent: P2-design.md
trace_id: T025-P3-BE-20260628
status: draft
created: 2026-06-28
---

# P3 后端测试用例 — 用户公开页

## 1. 覆盖范围

| BDD ID | 测试函数 | 关键断言 |
|--------|---------|---------|
| BE-1 | `test_list_entries_owner_username_returns_user_entries` | total=3, 全部属于 alice, owner_found=True |
| BE-2 | `test_list_entries_owner_username_case_insensitive` | owner="ALICE" 与 owner="alice" 行为一致 |
| BE-3 | `test_list_entries_owner_nonexistent_user` | items=[], total=0, owner_found=False |
| BE-4 | `test_list_entries_owner_exists_but_no_visible_entries` | items=[] (匿名), owner_found=True |
| BE-5 | `test_list_entries_owner_me_regression` | owner="me" 行为不变, owner_found=None |
| BE-6 | `test_list_entries_owner_admin_sees_all` | admin 看到私有 entry, owner_found=True |
| BE-7 | `test_list_entries_owner_anonymous_sees_public_only` | 匿名只看到公开 entry, owner_found=True |
| BE-8 | `test_list_entries_owner_with_fts_match` | owner="alice" + q="keyword" 组合, owner_found=True |
| BE-9 | `test_list_entries_owner_with_fts_no_match` | owner="alice" + q="nonexistent", items=[], owner_found=True |

## 2. 测试环境

- 测试文件: `backend/tests/test_user_page.py`（新建）
- fixture: 复用 `test_entry_service.py` 的 `entry_service` 模式（独立 db_path + data_dir per test）
- 辅助函数: `_create_user(entry_service, username, is_admin=False)` — 直接在 engine session 中创建 User 记录

## 3. 预期失败模式（TDD 红灯）

当前 `list_entries` 代码:
- 不支持 `owner="alice"`（非 "me" 的 username）→ 行为退化为「全部可见 entry」
- `EntryListResponse` 无 `owner_found` 字段
- owner_filter 与 visibility_filter 未解耦

| 测试 | 失败类型 | 原因 |
|------|---------|------|
| BE-1 | AssertionError | total 不正确（返全部 entry，非仅 alice 的） |
| BE-2 | AssertionError | total 不正确（当前不处理 owner="ALICE"） |
| BE-3 | AssertionError | items 非空（返全部 public entry） |
| BE-4 | AssertionError | items 非空（返全部 public entry） |
| BE-5 | **AttributeError** | `owner_found` 字段不存在（但 entry count 正确 — `owner="me"` 已支持） |
| BE-6 | AssertionError | total 不正确 |
| BE-7 | AssertionError | total 不正确（返全部 public，非仅 alice 的） |
| BE-8 | **AttributeError** | `owner_found` 字段不存在（但 FTS 本身可能正确） |
| BE-9 | **AttributeError** | `owner_found` 字段不存在 |

> 注意：BE-5/BE-8/BE-9 的 count 断言在现有代码中**可能意外通过**（owner="me" 已支持、FTS 独立工作），但 `owner_found` 断言必失败。P3 的「红灯」门槛仍满足。

## 4. 测试用例详情

### TC-BE-1: owner=username 返回用户全部 entry

```
Given: 数据库有 alice（3 entry） + bob（5 entry），全部 is_public=True
When:  list_entries(owner="alice")
Then: total=3, items 全部 username=="alice", owner_found=True
```

### TC-BE-2: username 大小写不敏感

```
Given: 用户 alice（lowercase）有 2 个 entry
When:  list_entries(owner="ALICE") 和 list_entries(owner="alice")
Then: 两者行为一致, owner_found=True
```

### TC-BE-3: 不存在的 username → 空列表

```
Given: 数据库无用户 nonexistent
When:  list_entries(owner="nonexistent")
Then: items=[], total=0, owner_found=False
```

### TC-BE-4: username 存在但无可见 entry（全私有）

```
Given: 用户 bob 只有 is_public=False 的 entry
When:  匿名调用 list_entries(owner="bob")
Then: items=[], total=0, owner_found=True
```

### TC-BE-5: owner="me" 回归保护

```
Given: alice 有 1 个 public + 1 个 private entry
When:  alice 调用 list_entries(owner="me", current_user_id=alice_id)
Then: total=2 (含 private), owner_found=None
```

### TC-BE-6: admin 看全部

```
Given: alice 有 1 个 public + 1 个 private entry
When:  admin 调用 list_entries(owner="alice", is_admin=True)
Then: total=2 (含 private), owner_found=True
```

### TC-BE-7: 匿名只看公开

```
Given: alice 有 1 个 public + 1 个 private entry；bob 有 1 个 public entry（用于制造干扰）
When:  匿名调用 list_entries(owner="alice")
Then: total=1 (仅 alice 的 public), owner_found=True
```

### TC-BE-8: FTS + owner filter 组合（结果非空）

```
Given: alice 有 2 个含 "python" 的 entry；bob 有 1 个不含 "python" 的 entry
When:  list_entries(owner="alice", q="python")
Then: 结果非空, 全部属于 alice, owner_found=True
```

### TC-BE-9: FTS + owner filter 组合（结果为空）

```
Given: alice 有 2 个 entry
When:  list_entries(owner="alice", q="NoSuchKeywordXYZ")
Then: items=[], total=0, owner_found=True
```

## 5. 非测试项

- 不测 FTS5 细节（tokenizer、中文分词等）
- 不测 tags + owner 组合（tags 独立 filter，无新增交互路径）
- 不测分页 + owner 组合（分页在 owner filter 之后，无新增代码路径）
- 不测 status filter + owner 组合（status 是现有独立 filter）

## 6. 与 P2-design.md 构造点对应

| 构造点 | 测试覆盖 |
|--------|---------|
| #1 (L327, owner="me"+未登录) | BE-5 — 已登录路径，未登录路径被现有 `owner="me"` 测覆盖 |
| #2 (L365-367, FTS early return) | BE-8, BE-9 |
| #3 (L411, 最终 return) | BE-1, BE-2, BE-4, BE-6, BE-7 |
| #4 (新增, username 不存在提前 return) | BE-3 |
