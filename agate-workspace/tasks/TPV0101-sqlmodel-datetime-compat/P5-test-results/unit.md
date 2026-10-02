# P5 技术验证结果 — TPV0101（sqlmodel 0.0.47 naive datetime 兼容修复）

- task_id: TPV0101
- phase: P5
- role: verifier
- 执行日期: 2026-10-02
- ui_affected: false → **不跑 E2E / Playwright**（无 UI）
- 全量测试: **是**（两个全量 key `P5` 与 `P5_ci_repro` 均已执行）

## 环境自检（执行前）

| 环境 | 解释器 | sqlmodel | sqlalchemy | pytest |
|------|--------|----------|------------|--------|
| 本地 | `backend/.venv/bin/python` | 0.0.38 | 2.0.51 | 9.1.1 |
| 隔离（CI 等价） | `/tmp/ci-repro-venv/bin/python` | 0.0.47 | 2.0.54 | 9.1.1 |

- 两环境均为主 Agent 预置，verifier 未自行新建/启动环境。
- 无 UI → 无 `P5_e2e` key（P2 未声明）。

## gate_commands 逐 key 结果

### P5 — 本地全量（sqlmodel 0.0.38）

命令：
```bash
backend/.venv/bin/python -m pytest backend/tests/ -q --tb=short --rootdir=backend
```
- exit code: **0**
- 计数（junitxml 复核）：tests=1189, failures=0, errors=0, skipped=3
- passed 1186 / failed 0 / error 0 / skipped 3
- timeout: 300s（未超时）

### P5_ci_repro — 隔离全量（sqlmodel 0.0.47，CI 等价核心）

命令：
```bash
/tmp/ci-repro-venv/bin/python -m pytest backend/tests/ -q --tb=short --rootdir=backend
```
- exit code: **0**
- 计数（junitxml 复核）：tests=1189, failures=0, errors=0, skipped=3
- passed 1186 / failed 0 / error 0 / skipped 3
- timeout: 600s（未超时）

### P5_dep_guard — 依赖守卫（BDD-15）

命令：
```bash
backend/.venv/bin/python -m pytest backend/tests/test_dependency_guard.py -q --tb=short --rootdir=backend
```
- exit code: **0**
- passed 3 / failed 0
- timeout: 120s（未超时）

### P5_schema_guard — 列语义静态核验（BDD-16）

命令：
```bash
backend/.venv/bin/python -m pytest backend/tests/test_datetime_naive_compat.py -q --tb=short --rootdir=backend -k Bdd16
```
- exit code: **0**
- passed 2 / failed 0（`test_bdd_16_all_datetime_columns_explicit_naive`、`test_bdd_16_column_type_is_plain_datetime_not_decorator`）
- timeout: 120s（未超时）

## 汇总（N5 签名计数行）

```text
PASSED P5: 1189 tests, 1186 passed, 0 failed, 3 skipped, 0 errors (exit 0)
PASSED P5_ci_repro: 1189 tests, 1186 passed, 0 failed, 3 skipped, 0 errors (exit 0)
PASSED P5_dep_guard: 3 passed, 0 failed (exit 0)
PASSED P5_schema_guard: 2 passed, 0 failed (exit 0)
passed 1186 (P5) + 1186 (P5_ci_repro) + 3 + 2
failed 0
```

- **failed 总数：0**
- 两个全量 key 均全绿；本地 0.0.38 与隔离 0.0.47 行为一致（无版本分叉，RK-3 未触发）。

## 失败清单

无失败。`fail-list.txt` 为空文件。

## 已知 flake 检查

- `backend/tests/test_cli_remote.py::TestCLIRemoteDelete::test_delete_entry`（integration，起 :18888）本次**未命中**，两个全量 key 均通过，无需重跑。

## 预存失败

无预存失败。

## 生产环境隔离

- 未触碰生产 `:8080` / `~/.peekview/`。
- 测试前后对比生产库：`~/.peekview/peekview.db` mtime 保持改动前（1790904554），entries=132 不变。
- 测试全部走 conftest `isolate_config_file`（autouse）隔离到 tmp_path。

## 判定

| key | exit | failed | 结论 |
|-----|------|--------|------|
| P5 | 0 | 0 | PASS |
| P5_ci_repro | 0 | 0 | PASS |
| P5_dep_guard | 0 | 0 | PASS |
| P5_schema_guard | 0 | 0 | PASS |

[PROD_NOT_TOUCHED]
