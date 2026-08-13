# P5 单元/回归测试结果 — TPV0091-unicode-download-header-fix

## 汇总

| 指标 | 值 |
|------|-----|
| 后端 pytest 全量 | **1071 passed, 1 failed, 3 skipped** |
| failed 计数 | **1**（预存失败，见下） |
| 预存失败 | `tests/test_cli_remote.py::TestCLIRemoteList::test_list_with_tag_filter`（与本次改动无关） |
| lint | PASS（`make lint` 中 ruff 不在 venv，用 fallback `cd backend && python3 -m ruff check peekview/ tests/` → All checks passed） |
| typecheck | PASS（`make typecheck` → vue-tsc passed） |
| 全量测试 | 已运行（非定向） |

## 后端 pytest 全量（`cd backend && .venv/bin/python -m pytest tests/ -n auto --tb=short`）

- **exit code: 1**（因 1 个预存失败）
- **passed: 1071, failed: 1, skipped: 3**，warnings 25（均为既有 deprecation/unknown-mark 警告，非本任务引入）
- 本任务新增用例全绿：
  - `TestFileDownload` 中文/日文/é/ASCII 文件名 download 用例（BDD-4/5/6，TC-B1/B2/B3）全部通过
  - `TestFilenameSanitization`（BDD-7，净化回归）全绿（1 skip 为既有 skip）
  - `TestFileContentEndpoint` 相关（BDD-8 依赖的 /content 端点）全绿

### 失败明细

```
FAILED tests/test_cli_remote.py::TestCLIRemoteList::test_list_with_tag_filter
```

- **预存失败**：`test_cli_remote.py` 是 remote CLI 集成测试（`pytest.mark.integration`），需连远程 backend `127.0.0.1:18888`（Connection refused）。与 TPV0091 改动（Content-Disposition header / 前端 URL）无任何关联；该文件未被 TPV0091 commit 触碰（git 已核实）。
- 该失败与 dispatch-context 预警一致（TPV0090 待办：`test_cli_remote.py` 在 `-n auto` 下有已知预存失败）。
- → 已登记 `known-failures.md`，不阻断 P5 推进。

## lint

- `make lint` → **exit 2**：`ruff: 未找到命令`（AGENTS.md 已知：ruff 不在 venv，用系统 python3）。
- fallback `cd backend && python3 -m ruff check peekview/ tests/` → **exit 0，All checks passed**（含 files.py 改动）。
- 判定：**PASS**（等效于 make lint 的 ruff 检查全部通过）。

## typecheck

- `make typecheck`（vue-tsc --noEmit）→ **exit 0，passed**。
- 判定：**PASS**。

## 预存失败

`tests/test_cli_remote.py::TestCLIRemoteList::test_list_with_tag_filter`（1 个，与本次改动无关，见 `known-failures.md`）。

## 结论

- **failed = 1（全部为预存失败，非本任务引入）**
- 本任务引入的后端新用例 + 全量回归：**0 failed**
- lint/typecheck：**PASS**
- 测试环境隔离正常（pytest conftest autouse 隔离，不触生产 DB）
