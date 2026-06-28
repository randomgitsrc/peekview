---
phase: P1
task_id: T025-user-page
type: resolution
parent: P1-requirements.md
trace_id: T025-P1-resolution-20260628
status: resolved
created: 2026-06-28
---

# PAUSED 决议 — T025 user-page

P1 需求分析产出 3 个待确认项，用户已逐项拍板。

## Q1：已删除用户 vs 不存在用户

**用户决策**：接受 P1 建议。统一为「空列表 + `owner_found=false`」，前端显示 "User not found"。不加软删除/日志表机制。

理由：两个场景在 DB 层面不可区分（User 物理删除 + FK CASCADE），统一处理成本最低、体验合理。

## Q2：`/explore?owner=alice` 的 UI 行为

**用户决策**：选项 A — 纯 filter，不做 banner。

| 场景 | 行为 |
|------|------|
| `/users/alice` | 用户专页：大 banner + 隐藏 tab |
| `/explore?owner=alice` | 临时筛选：无 banner，tab 保留但不高亮，加轻量 dismissible chip（`@alice ×`） |
| `/explore?owner=me` | Mine tab 高亮（现有行为不变）|

chip 用途：「解释为什么只看到特定用户的条目」，用户点 `×` 清除 filter 回到 explore 全部。

## Q3：username 大小写

**用户决策**：写端 lowercase 入库 + 查端 `func.lower()`，不 migration 现有数据。

- 注册时强制 `username.lower()` 再写 DB。未来不再有大小写变体并存
- 查询时 `func.lower(User.username) == owner.lower()`（大小写不敏感查）
- 不批量改现有数据（风险极低，无实际冲突用户）
