---
phase: P3
generated_by: agate-inject-card.sh + 主 Agent
task_id: T060
role: test-designer
---

<dispatch_guide>
### 目标
仅产出后端 pytest 测试：为 BDD A1-A7, A1b-A3b 设计测试用例并写测试代码（backend/tests/test_archived_visibility.py）。TDD 红灯。

### 约束
- 只写 backend/tests/test_archived_visibility.py，不要碰前端/MCP
- 测试必须真红灯（assertion failure，非 import/syntax error）
- 同时更新 backend/tests/test_entry_lifecycle.py 行 672-724 的两个测试断言（反转）
- pytest 命令：cd backend && .venv/bin/python -m pytest tests/test_archived_visibility.py tests/test_entry_lifecycle.py::test_owner_list_includes_archived_entries tests/test_entry_lifecycle.py::test_owner_list_total_includes_archived -q --tb=short
- debug 环境：make debug（:8888, /tmp/peekview-debug/）

### 上游关联
- P1 BDD A1-A7, A1b-A3b（共10条）：archived 可见性 + 边界场景
- P2-design.md §2.1-2.2：后端修改点
- P2-design.md §5：现有测试影响评估

### 输入文件
- docs/tasks/T060-archived-visibility-auth-refresh/P1-requirements.md（BDD 条件节）
- docs/tasks/T060-archived-visibility-auth-refresh/P2-design.md（§2.1-2.2，§5）
- backend/peekview/services/entry_service.py（行 362-535 list_entries）
- backend/peekview/models.py（EntryStatus 枚举）
- backend/tests/test_entry_lifecycle.py（行 672-724）
- backend/tests/conftest.py（test fixtures）
- backend/tests/factories.py（test data builders）
</dispatch_guide>

<objective_info>
- 测试环境：backend/.venv/bin/python -m pytest
- 关键标识：10 条 BDD（A1-A7, A1b-A3b），2 个现有测试需反转
</objective_info>
