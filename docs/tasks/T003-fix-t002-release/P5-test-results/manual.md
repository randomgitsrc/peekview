---
phase: P5
task_id: T003-fix-t002-release
parent: T003-P4/P4-implementation.md
trace_id: T003-P5-20260612
---

# P5 手动验证结果 — T002 发布准备收尾

## 检查项 1: `__init__.py __version__`

| 文件 | 行号 | 值 | 结果 |
|------|------|-----|------|
| `backend/peekview/__init__.py` | 3 | `__version__ = "0.1.53"` | ✅ 通过 |

## 检查项 2: `pyproject.toml version`

| 文件 | 行号 | 值 | 结果 |
|------|------|-----|------|
| `backend/pyproject.toml` | 7 | `version = "0.1.53"` | ✅ 通过 |

## 检查项 3: `make pre-publish-quick` 通过

| 子项 | 状态 |
|------|------|
| 版本一致性 (__init__.py / cli.py / main.py) | ✅ |
| CHANGELOG.md 含 v0.1.53 条目 | ✅ |
| 后端测试 (486 passed, 0 failed) | ✅ |
| Wheel 内容验证 (317 static files) | ✅ |
| 退出码 | 0 |

## 检查项 4: T002 代码改动无遗漏

| T002 改动 | 文件 | 验证 |
|-----------|------|------|
| `SchemaMismatchError` 异常 | `backend/peekview/exceptions.py:200` | ✅ 存在 |
| `check_schema()` 函数 | `backend/peekview/database.py:105` | ✅ 存在 |
| `_run_migrations()` 独立 commit | `backend/peekview/database.py:36` | ✅ 存在 |
| `init_db(run_migrations=False)` 参数 | `backend/peekview/database.py:143` | ✅ 存在 |
| `create_app(..., run_migrations=True)` | `backend/peekview/main.py:104` | ✅ 存在 |
| `serve_command init_db(run_migrations=True)` | `backend/peekview/cli.py:163` | ✅ 存在 |
| `test_apikey.py` 重复 yield 已移除 | `backend/tests/test_apikey.py:30` | ✅ 仅一个 `yield c, app` |

---

## P1 问题逐项验证

### P1-1: P7 gate 未执行 → ✅ 已解决

`make pre-publish-quick` exit 0, 486 passed, 0 failed。发布就绪性已验证。

### P1-2: 文档版本引用未同步 → ❌ 未解决

| 文件 | 行号 | 当前值 | 期望值 |
|------|------|--------|--------|
| `INDEX.md` | 4 | `v0.1.52` | `v0.1.53` |
| `CLAUDE.md` | 10 | `v0.1.52` | `v0.1.53` |

> **备注：** P4-implementation.md 仅修复了 test_apikey.py 重复 yield 问题，未更新 INDEX.md 和 CLAUDE.md 中的版本引用。此问题超出 T003 任务定义的 4 项检查范围，但属于 P1 定义的待解决问题。

### P1-3: 未发布到 PyPI → ⏳ 待人工操作

P1-1 已通过。P1-2 未解决但不阻塞发布（文档引用是辅助信息）。人工执行 `make publish` 后 PyPI 将更新至 v0.1.53。

---

## 总判定

| 检查项 | 结果 |
|--------|------|
| 1. `__init__.py __version__` = 0.1.53 | ✅ |
| 2. `pyproject.toml version` = 0.1.53 | ✅ |
| 3. `make pre-publish-quick` exit 0 | ✅ |
| 4. T002 代码改动无遗漏 | ✅ |

**4/4 全部通过。**
