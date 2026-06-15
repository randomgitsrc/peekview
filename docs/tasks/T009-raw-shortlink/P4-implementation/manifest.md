---
phase: P4
task_id: T009
parent: P1-requirements.md
trace_id: T009-P4-20260615
---

## 改动文件

| 文件 | 改动 |
|------|------|
| `backend/peekview/main.py` | 添加 `/{slug}/raw` 302 redirect 路由（在 `_setup_static_files` 之前）；API key auth 中间件增加 shortlink 路径跳过 |
| `backend/tests/test_raw_api.py` | 添加 3 个测试用例：AC1 公开 entry redirect、AC2 不存在 slug redirect、AC3 私有 entry redirect+认证 |

## 测试结果

- 552 passed, 0 failed, 1 skipped
- ruff check + format: pass
