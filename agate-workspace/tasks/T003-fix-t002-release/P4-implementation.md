---
phase: P4
task_id: T003-fix-t002-release
parent: T003-P1/P1-problems.md
trace_id: T003-P4-20260612
---

# P4 实现 — T002 发布准备收尾

## 改动清单

| 文件 | 改动 | 原因 |
|------|------|------|
| `backend/peekview/__init__.py` | 无改动（已是 `0.1.53`） | P1 复盘后手动同步过 |
| `backend/tests/test_apikey.py:31` | 删除重复的 `yield c, app` | async generator fixture 重复 yield 导致 pytest-asyncio 报 26 个 teardown ERROR |

### 改动详情

`test_apikey.py` 中 `client_and_app` fixture 的 async generator 重复了 yield 语句：

```diff
-            yield c, app
             yield c, app
```

根因：双重 yield 导致 pytest-asyncio 报 `ValueError: Async generator fixture didn't stop.Yield only once.`，虽然 26 个 API Key 测试本身 PASS，但 teardown 全部 ERROR，导致 `make pre-publish-quick` 的非零退出码。

## `make pre-publish-quick` 结果

```
→ Checking version consistency...
  ✓ __init__.py: 0.1.53
  ✓ cli.py: imports __version__ correctly
  ✓ main.py: imports __version__ correctly

✓ CHANGELOG.md contains version 0.1.53

→ Running backend tests (quick)...
  486 passed, 1 skipped, 7 warnings in 56.18s
  ✓ Tests passed

→ Verifying wheel contents...
  Found 317 static files
  All referenced JS/CSS files exist in wheel
  Wheel verification passed

✓ Quick pre-publish checks passed
```

**exit 0** — 版本一致性检查通过，CHANGELOG 检查通过，后端 486 测试全绿，wheel 内容验证通过。
