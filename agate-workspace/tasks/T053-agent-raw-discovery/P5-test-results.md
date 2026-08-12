---
phase: P5
task_id: T053
type: test-results
parent: P4-implementation.md
trace_id: T053-P5-20260713
status: complete
created: 2026-07-13
agent: main
---

# T053 P5 技术验证

## gate_commands.P5

```
cd backend && .venv/bin/python -m pytest tests/ -q --tb=no
```

**结果**：851 passed, 1 skipped, 9 warnings (148.64s)

## Content Negotiation 专项测试

```
cd backend && .venv/bin/python -m pytest tests/test_content_negotiation.py -q --tb=no
```

**结果**：33 passed

## ruff check

```
cd backend && python3 -m ruff check peekview/main.py peekview/api/files.py
```

**结果**：无新增错误（仅有 N806/B008 已有错误）

## curl 实测验证（debug :8888）

| BDD | 验证命令 | 预期 | 实际 | 结果 |
|-----|---------|------|------|------|
| B1 | `curl -H "Accept: application/json" /test-cn` | JSON | JSON (含 files 字段) | PASS |
| B2 | `curl -H "Accept: text/html, application/json" /test-cn` | HTML | text/html | PASS |
| B3 | `curl -H "Accept: */*" /test-cn` | HTML | text/html | PASS |
| B5 | `curl -H "Accept: application/json;q=0.9, text/html;q=0.8" /test-cn` | HTML | text/html | PASS |
| B8 | `curl -H "Accept: application/json" /nonexistent-slug` | 404 JSON | error.code=NOT_FOUND | PASS |
| B9 | `curl /nonexistent-slug` | HTML | text/html | PASS |
| B10 | `curl /test-cn` | 含 <link> | <link rel="alternate" ...> 存在 | PASS |
| B12 | `curl /explore` | 无 <link> | 0 匹配 | PASS |
| B13 | `curl -I /test-cn` | 含 Link header | link: </api/v1/entries/test-cn/raw> | PASS |

## 数据隔离

debug 模式使用 /tmp/peekview-debug/，数据隔离正常。

## 结论

P5 技术验证通过。所有测试绿，ruff 无新增错误，curl 实测核心 BDD 全部 PASS。
