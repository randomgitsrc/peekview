# P5 后端单元/回归验证结果 — T075 structured-data-viewer

- 阶段：P5 技术验证（backend verifier subagent）
- 日期：2026-08-01
- 环境：venv Python（`backend/.venv/bin/python`，Python 3.12.3），pytest conftest autouse tmp_path 隔离
- 状态标记：`[PROD_NOT_TOUCHED]` 本次只运行 pytest（tmp_path 隔离）与 ruff（静态检查），未接触生产服务/生产数据库/`~/.peekview/`

## gate_commands.P5_backend — test_language.py 定向测试

命令：`.venv/bin/python -m pytest tests/test_language.py -q --tb=no`

```
============================= test session starts ==============================
platform linux -- Python 3.12.3, pytest-9.1.1, pluggy-1.6.0
rootdir: /home/kity/oclab/peekview/backend
configfile: pyproject.toml
plugins: asyncio-1.4.0, anyio-4.14.0, cov-7.1.0
asyncio: mode=Mode.AUTO, debug=False, asyncio_default_fixture_loop_scope=function, asyncio_default_test_loop_scope=function
collected 63 items

tests/test_language.py ................................................. [ 77%]
..............                                                           [100%]

============================== 63 passed in 1.58s ==============================
```

- failed 数量：**0**
- test runner 输出签名：`63 passed`（passed 计数 >0）
- gate 签名行：
```
passed: 63
failed: 0
```
- EXIT_CODE: 0

## 全量回归 — tests/（P5 应运行全量测试套件）

命令：`.venv/bin/python -m pytest tests/ -q --tb=short`

```
=========== 1008 passed, 2 skipped, 10 warnings in 176.37s (0:02:56) ===========
```

- failed 数量：**0**
- test runner 输出签名：`1008 passed, 2 skipped`（passed 计数 >0）
- gate 签名行：
```
passed: 1008
failed: 0
```
- 2 skipped 与本次改动无关（既有 skip 用例），10 warnings 为 httpx cookie / datetime.utcnow 等既有 DeprecationWarning，非失败
- 无回归、无预存失败
- EXIT_CODE: 0

## ruff lint

命令：`python3 -m ruff check peekview/ tests/`

```
All checks passed!
```

- EXIT_CODE: 0

## 实现独立核实（不信 P4 自报，直查行为）

```
detect_language('file.tsv') = tsv     # P2 要求：返回 "tsv" 而非 "csv" ✓
detect_language('file.csv') = csv     # csv 不受影响 ✓
'tsv' in PLAIN_TEXT_LANGS = True      # P2 要求 ✓
PLAIN_TEXT_LANGS count = 15           # P2 要求 14→15 ✓
```

## 结论

- 后端验证全部通过：target 63 passed / 全量 1008 passed, 2 skipped / ruff All checks passed，failed=0
- 无预存失败需要登记 known-failures.md
- `[PROD_NOT_TOUCHED]` 未触发任何生产触达

EXIT_CODE: 0
