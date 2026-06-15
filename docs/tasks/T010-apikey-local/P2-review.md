---
phase: P2
task_id: T010
parent: P2-design.md
trace_id: T010-P2-review-20260615
reviewer: Staff Engineer
status: approved
---

方案简洁正确。remote 路径完全不变，local 路径加 --user 参数查 user_id 后调 ApiKeyService。

唯一需要注意：ApiKeyService 构造函数只需要 engine，不需要 storage，和 AdminService 不同，这个方案是对的。

无 BLOCKER。
