---
phase: P3
task_id: T005-default-expires-15d
parent: T005-P2/P2-design.md
trace_id: T005-P3-20260612
---

# P3 测试用例清单：默认 15 天过期策略

## 覆盖率分析

P4 已实现代码，现有测试提供部分覆盖。以下为独立分析后发现的**缺失**增量测试：

| AC | 描述 | 现有覆盖 | 缺口 |
|----|------|----------|------|
| AC1 | `parse_expires_in("0")` → None | ✓ `test_expires_in_zero` | 无 |
| AC2 | `parse_expires_in("0d"/"0h"/"0m")` → None | ✓ `test_expires_in_zero_unit` | 无 |
| AC3 | `parse_expires_in("7d")` 不变 | ✓ `test_expires_in_7d` 等 | 无 |
| AC4 | 不传 expires_in → now+15d | △ 仅检查 `is not None` | **需验证精确~15d** |
| AC5 | env `30d` → now+30d | ✗ 无 | **缺失** |
| AC6 | 无效配置 → warning + fallback | ✗ 无 | **缺失** |
| AC7 | CreateEntryResponse 含 expires_at | △ 通过 get_entry 间接检查 | **需直接断言 response 字段** |
| AC8 | EntryListItem 含 expires_at | ✗ 无 | **缺失** |
| AC9 | GET /api/v1/config/limits | ✗ **P4 报告标注为 done 但无测试** | **缺失** |
| AC18 | expires_in="" → 默认值 | ✗ 无 | **缺失** |
| AC19 | expires_at=NULL 序列化 | ✗ 无 | **缺失** |
| — | API key expires_in="0" → 永不过期 | △ apikey 测试用 "30d" | **需测 "0"** |

---

## 测试用例清单

### T001 — parse_expires_in 无效单位 "7s"
- **对应 AC**: AC3（再生：现有有效输入不变）
- **对应 P1**: P1-3
- **Given**: `parse_expires_in("7s")`
- **Then**: 抛出 ValueError（"s" 不是 h/m/d）
- **在**: test_file_service.py

### T002 — parse_expires_in 空字符串
- **对应 AC**: AC3（再生：边界输入）
- **对应 P1**: P1-9
- **Given**: `parse_expires_in("")`
- **Then**: 抛出 ValueError
- **在**: test_file_service.py

### T003 — parse_expires_in 前导空格
- **对应 AC**: AC3（再生：边界输入）
- **对应 P1**: P1-3
- **Given**: `parse_expires_in(" 7d")`
- **Then**: 抛出 ValueError（空格不匹配正则）
- **在**: test_file_service.py

### T004 — PeekLimits.default_expires_in 默认值
- **对应 AC**: AC5（前置：确认默认值存在）
- **对应 P1**: P1-2
- **Given**: `PeekLimits()` 默认构造
- **Then**: `limits.default_expires_in == "15d"`
- **在**: test_config.py

### T005 — PeekLimits.default_expires_in 自定义值
- **对应 AC**: AC5
- **对应 P1**: P1-2
- **Given**: `PeekLimits(default_expires_in="30d")`
- **Then**: `limits.default_expires_in == "30d"`
- **在**: test_config.py

### T006 — PeekLimits.default_expires_in="0" 有效
- **对应 AC**: AC6（再生：零值有效）
- **对应 P1**: P1-3, P1-10
- **Given**: `PeekLimits(default_expires_in="0")`
- **Then**: 不抛异常，`default_expires_in == "0"`
- **在**: test_config.py

### T007 — 无效 default_expires_in → fallback + WARNING
- **对应 AC**: AC6
- **对应 P1**: P1-10
- **Given**: `PeekLimits(default_expires_in="999999d")`
- **Then**: 不抛异常，`default_expires_in` fallback 到 `"15d"`，记录 WARNING 日志
- **在**: test_config.py

### T008 — PEEKVIEW_LIMITS__DEFAULT_EXPIRES_IN 环境变量
- **对应 AC**: AC5
- **对应 P1**: P1-2
- **Given**: 设置 `PEEKVIEW_LIMITS__DEFAULT_EXPIRES_IN=30d`
- **Then**: `PeekConfig().limits.default_expires_in == "30d"`
- **在**: test_config.py

### T009 — create_entry 不传 expires_in → expires_at ≈ now+15d
- **对应 AC**: AC4
- **对应 P1**: P1-1
- **Given**: `create_entry(summary="test")` 不传 `expires_in`
- **Then**: `result.expires_at` 非空，≈ `now + 15d`（容差 5s）
- **在**: test_entry_service.py

### T010 — create_entry expires_in="0" → expires_at=None
- **对应 AC**: AC1（集成验证）
- **对应 P1**: P1-3
- **Given**: `create_entry(summary="perm", expires_in="0")`
- **Then**: `result.expires_at is None`
- **在**: test_entry_service.py

### T011 — CreateEntryResponse 直接检查 expires_at 字段
- **对应 AC**: AC7
- **对应 P1**: P1-5
- **Given**: `create_entry` 返回 `CreateEntryResponse`
- **Then**: `result.expires_at` 非空（默认 15d）
- **在**: test_entry_service.py

### T012 — create_entry expires_in="" → 默认 15d
- **对应 AC**: AC18
- **对应 P1**: P1-9
- **Given**: `create_entry(summary="empty", expires_in="")`
- **Then**: `result.expires_at` ≈ `now + 15d`（等同于 None）
- **在**: test_entry_service.py

### T013 — create_entry expires_in="   " → 默认 15d
- **对应 AC**: AC18（再生：纯空白）
- **对应 P1**: P1-9
- **Given**: `create_entry(summary="ws", expires_in="   ")`
- **Then**: `result.expires_at` ≈ `now + 15d`
- **在**: test_entry_service.py

### T014 — list_entries 返回 items 含 expires_at
- **对应 AC**: AC8
- **对应 P1**: P1-11
- **Given**: 创建条目后 `list_entries()`
- **Then**: 每个 `item.expires_at` 不为 None（默认 15d 下）
- **在**: test_entry_service.py

### T015 — EntryListItem expires_at=None 序列化为 None
- **对应 AC**: AC19
- **对应 P1**: P1-5
- **Given**: `create_entry(expires_in="0")` 再 `list_entries()`
- **Then**: 条目 `item.expires_at is None`
- **在**: test_entry_service.py

### T016 — GET /api/v1/config/limits 返回 200
- **对应 AC**: AC9
- **对应 P1**: P1-12
- **Given**: `GET /api/v1/config/limits`
- **Then**: 状态码 200，响应含 `default_expires_in`, `max_file_size` 等字段
- **在**: test_config.py

### T017 — GET /api/v1/config/limits 反映 env var 覆盖
- **对应 AC**: AC9（再生：动态配置）
- **对应 P1**: P1-12
- **Given**: 设置 `PEEKVIEW_LIMITS__DEFAULT_EXPIRES_IN=7d`，`GET /api/v1/config/limits`
- **Then**: `default_expires_in == "7d"`
- **在**: test_config.py

---

## 汇总

| # | 测试用例 | AC | 文件 |
|---|----------|----|------|
| T001 | parse_expires_in invalid unit "7s" | AC3 | test_file_service.py |
| T002 | parse_expires_in empty string | AC3 | test_file_service.py |
| T003 | parse_expires_in leading whitespace | AC3 | test_file_service.py |
| T004 | default_expires_in 默认 "15d" | AC5 | test_config.py |
| T005 | default_expires_in 自定义 "30d" | AC5 | test_config.py |
| T006 | default_expires_in="0" 有效 | AC6 | test_config.py |
| T007 | 无效配置 fallback + WARNING | AC6 | test_config.py |
| T008 | env var PEEKVIEW_LIMITS__DEFAULT_EXPIRES_IN | AC5 | test_config.py |
| T009 | 不传 expires_in → now+15d | AC4 | test_entry_service.py |
| T010 | expires_in="0" → expires_at=None | AC1 | test_entry_service.py |
| T011 | CreateEntryResponse.expires_at | AC7 | test_entry_service.py |
| T012 | expires_in="" → 默认 15d | AC18 | test_entry_service.py |
| T013 | expires_in="   " → 默认 15d | AC18 | test_entry_service.py |
| T014 | list_entries items 含 expires_at | AC8 | test_entry_service.py |
| T015 | EntryListItem expires_at=None 序列化 | AC19 | test_entry_service.py |
| T016 | GET /api/v1/config/limits → 200 | AC9 | test_config.py |
| T017 | config/limits 反映 env var | AC9 | test_config.py |
| T018 | config/limits 无需认证 | AC9 | test_config.py |
| T019 | default_expires_in="30d" 生效 | AC5 | test_entry_service.py |

**总计: 19 个增量测试用例**
