# Known Failures — T080-admin-user-management

## 预存失败 #1

- **测试文件**: `backend/tests/test_t073_bdd09_10_ruff_regression.py`
- **测试 ID**: `TestBdd10RuffCheckSelectE711E712::test_bdd_10_existing_code_passes_e711_e712_check`
- **失败数**: 1
- **根因**: hermes venv（`/home/kity/.hermes/hermes-agent/venv/bin/python3`）未安装 ruff 模块。测试通过 `python3 -m ruff check` 调用 ruff，但当前 shell 的 `python3` 解析到 hermes venv，该 venv 无 ruff。`make lint` 使用系统 python3（有 ruff），不受影响。
- **与 T080 相关**: 否（环境问题，非代码改动引入）
- **修复建议**: 推迟。ruff 在系统 python3 可用（`make lint` 正常），hermes venv 缺 ruff 是环境配置问题，不影响 CI（CI 不跑此测试或 CI 环境有 ruff）。修复成本 > 推迟成本。
- **登记时间**: 2026-08-06（P5）

## T080 E2E 失败（非预存，记录待修复）

- **测试文件**: `frontend-v3/e2e/admin.spec.ts`
- **失败数**: 2（BDD-01 desktop, chromium + Mobile Chrome）
- **根因**: E2E spec 选择器（`.admin-user-list` / `.admin-user-row` / `.overflow-menu-trigger`）与 AdminView.vue 实现（`.user-list` / `.user-row`）不匹配
- **与 T080 相关**: 是（P4 实现与 P3 测试用例契约偏差）
- **处置**: 建议退回 P4 对齐选择器，或在 P6 验收时修复。非预存失败，不在此登记为 known-failure，仅记录供主 Agent 决策。
