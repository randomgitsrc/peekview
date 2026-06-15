---
phase: P2
task_id: T011
parent: P2-design.md
trace_id: T011-P2-review-20260615
reviewer: Staff Engineer + Security Officer
status: approved
---

方案完整，权限模型清晰，级联删除用 service 层而非裸 SQL 是正确选择。

**实现时注意**：
- entry_service.delete_entry() 的 is_admin=True 参数：确认该参数存在且能绕过 owner 检查
- 唯一 admin 检查用 `count_admins()` 函数，需要实现（query User where is_admin=True）
- `confirm_username` 通过 query param 传递，安全性足够（需要知道自己用户名才能确认）
- PeekClient.update_entry() 补充即可，本期不做 CLI，这个决策合理

无 BLOCKER。
