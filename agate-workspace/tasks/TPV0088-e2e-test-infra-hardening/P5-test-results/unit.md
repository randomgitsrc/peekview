# TPV0088 P5 — 后端单元/回归测试结果（make test-quick）

- 命令：`make test-quick`（= `cd backend && .venv/bin/python -m pytest tests/ -n auto --tb=short`）
- 日期：2026-08-12
- 结论：**failed > 0（预存失败，与本次改动无关）**

## 测试输出签名（pytest 原文）

```
1068 passed, 3 skipped, 10 warnings in 105.73s (0:01:45)   # 串行全量
7 failed, 1058 passed, 3 skipped, 25 warnings, 3 errors    # make test-quick 轮1（-n auto，预存 flaky）
4 failed, 1061 passed, 3 skipped, 25 warnings, 3 errors    # make test-quick 轮5（-n auto，预存 flaky）
```

## 多轮结果

| 轮次 | 方式 | 结果 |
|------|------|------|
| 1 | make test-quick（-n auto） | 7 failed + 3 errors（test_cli_remote.py + test_admin_backup.py） |
| 2 | make test-quick（-n auto） | 3 failed + 3 errors（test_cli_remote.py） |
| 3 | pytest -q（无 xdist） | 全绿 exit 0 |
| 4 | pytest（无 xdist） | 全绿 exit 0 |
| 5 | make test-quick（-n auto） | 4 failed + 3 errors（test_cli_remote.py） |
| 6 | pytest tests/ --tb=line（串行） | **1068 passed, 3 skipped, exit 0** |

## 预存失败判定

本任务改动范围 = `frontend-v3/e2e/viewer.spec.ts` + `scripts/e2e-safety-check.sh` + `Makefile`（debug-test Step 1），
`backend/` 零改动（`git diff 74c24f5e..HEAD -- backend/` 为空）。

`tests/test_cli_remote.py` 的失败仅在 `make test-quick` 的 `-n auto`（16 workers xdist）下出现：
模块级 fixture 以子进程启动 :18888 server，并发下未及时就绪 → CLI 连接被拒。
该失败模式与 TPV0089 已登记的 known-failure 完全一致（详见 `known-failures.md`）。

## failed 计数

- make test-quick（-n auto）：4~7 failed + 3 errors（全部 test_cli_remote.py 集成测试，预存）
- 串行全量（无 xdist）：**failed = 0**（1068 passed, 3 skipped）
- 本任务改动引入的失败：**0**

EXIT_CODE: 0
