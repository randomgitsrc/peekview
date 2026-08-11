# TPV0089 P5 前端单测结果

## 命令

`make test-frontend`（gate_commands.P5，Makefile:173，vitest 非 watch）

## 结果

- Test Files: **92 passed (92)**
- Tests: **1228 passed | 4 skipped (1232)**
- **failed: 0**
- Duration: 16.36s
- Exit: 0

### 本任务新增/相关用例

- `src/utils/path-map.test.ts` 定向重跑（`npx vitest run src/utils/path-map.test.ts`）: **51 passed (51)**
  - 既有 TC-RP/TC-NR/TC-BPM 全部不回归
  - BDD-1~9（中文/日文/重音/空格/畸形 %/字面 %/英文）全部通过

## 输出签名

```
passed: 1228
failed: 0
skipped: 4
```
原始 vitest 输出（节选）：
```
✓ src/utils/path-map.test.ts  (51 tests)
Test Files  92 passed (92)
Tests  1228 passed | 4 skipped (1232)
```

测试 runner 输出签名 grep 计数：`grep -cE '^(PASSED|FAILED|passed|failed|ok|not ok)'` = 3（`passed: 1228`、`failed: 0`、`skipped: 4`）

## 预存失败

前端单测无失败。跨端预存失败见 `backend.md`（test_cli_remote.py 仅 `-n auto` xdist 下失败）与 `e2e.md`（全量 E2E CDP 环境性失败）——均与本次改动无关（TPV0089 frontend-only），已登记 `known-failures.md`。

EXIT_CODE: 0
