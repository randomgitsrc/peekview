---
phase: P7
task_id: T048-entry-lifecycle
type: consistency
parent: P6-acceptance.md
trace_id: T048-P7-20260707
status: draft
created: 2026-07-07
agent: main
---

# T048 P7: 一致性检查

## 1. DESIGN_GAP 配对

### G1: get_entry_with_share() 对 archived 行为未指定

- **出处**: P4-implementation.md `[DESIGN_GAP: P2 未指定 get_entry_with_share() 对 archived entry 的行为]`
- **P4 处理**: 实现中加 `status=="archived"` 检查返回 None
- **P7 核实**: 已读 `entry_service.py` 中 `get_entry_with_share()`，有 archived 检查返回 None。share_service 的 `verify_share_cookie` 也会调 `get_entry_with_share`，archived entry 的 share token 自动失效。行为合理。
- **[DESIGN_GAP_REVIEWED]**：get_entry_with_share 的 archived 检查与 share_service 的 archived 拒绝保持一致，share token 自动失效是预期行为。

### G2: 无其他 DESIGN_GAP

P4-implementation.md 只声明了 1 条 DESIGN_GAP，已覆盖。

## 2. SCOPE+ 闭环

- P1-requirements.md: `[SCOPE_RESOLVED: P2 2.8 确认无新增隐含需求]`
- P2-design.md 的 `[SCOPE+]` 确认无新增隐含需求
- 闭环确认：P1 基线已覆盖全部隐含需求

## 3. 跨文件一致性

### BDD 数量对照

| 来源 | BDD 数量 |
|------|---------|
| P1-requirements.md | 14 条 |
| P6-acceptance.md | 14 条 (14 PASS, 0 FAIL) |
| 一致? | ✅ |

### packages 对照

| P2 声明 | 实际改动 | 一致? |
|---------|---------|-------|
| backend/peekview | config, models, database, admin_service, entry_service, share_service, api/entries, cli | ✅ |
| frontend-v3/src | types, api/client, api/types, EntryDetailView, EntryCard, EntryListRow, BaseBadge, variables.css, ExpiresInDialog | ✅ |

### 方案一致性 (P2设计 → P4实现)

| P2 Design | P4 实现 | 匹配? |
|-----------|---------|-------|
| 两阶段 cleanup | admin_service.py 两阶段实现 | ✅ |
| PATCH expires_in | entry_service.py 处理 expires_in + reactivate | ✅ |
| Archived 访问控制 | get_entry() + update_entry() + list_entries() 均实现 | ✅ |
| 前端 status 类型 align | types/index.ts `'active'|'archived'` | ✅ |
| ExpiresInDialog | 新组件含 error/loading/success 状态 | ✅ |
| BaseBadge archived 变体 | props 扩展 + CSS 变量 | ✅ |
| 移动端布局 | EntryDetailView mobile visible | ✅ |

## 4. 未决项清零

- NEED_CONFIRM count: 0
- BLOCKER count: 0
- DEVIATION-CRITICAL count: 0

## 一致性结论

✅ 所有检查通过。DESIGN_GAP 已转抄核实，SCOPE_+ 闭环，跨文件一致。
