---
phase: P5
task_id: TPV0096
parent: P2-design.md
trace_id: TPV0096-P5-20260907
agent: verifier
status: draft
---
# P5 E2E 实跑结果 — TPV0096（e2e.md）

> 被验证代码 = git `13594c9f`。三键串行执行，各为单次 bash 自包含链（make debug-start && make debug-seed && E2E_SPEC=<spec> make debug-test; rc=$?; timeout 120s make debug-stop; exit $rc），外层 timeout 900s。全部退出码为链透传 rc（= make debug-test 退出码）。[PROD_NOT_TOUCHED]。

## 键 3：P5_e2e — e2e/mermaid.spec.ts

- 退出码：**0**
- runner 签名（日志 /tmp/p5-e2e-1.log 摘录）：

```
Running 6 tests using 6 workers
  6 passed (8.9s)
```

- 双 project 计数（Playwright 汇总合并）：passed=6 / failed=0 / flaky=0 / skipped=0（3 test × chromium + Mobile Chrome）
- 耗时：6.9s（playwright 部分 8.9s 含 fixture 创建/清理）

## 键 4：P5_e2e_b — e2e/mermaid-check.spec.ts

- 退出码：**0**
- runner 签名（日志 /tmp/p5-e2e-2.log 摘录）：

```
Running 2 tests using 2 workers
  2 passed (6.0s)
```

- 双 project 计数：passed=2 / failed=0 / flaky=0 / skipped=0（1 test × 2 project）

## 键 5：P5_e2e_c — e2e/mermaid-visual.spec.ts

- 退出码：**0**
- runner 签名（日志 /tmp/p5-e2e-3.log 摘录）：

```
Running 6 tests using 6 workers
  6 passed (6.6s)
```

- 双 project 计数：passed=6 / failed=0 / flaky=0 / skipped=0（3 test × 2 project，测试体内自起 chromium 1280x800，两 project 各执行一遍——BDD-9 口径）

## 环境与隔离记录

- 三键均完成 debug-start（:8888 PID 在线）→ debug-seed（24 entries from seed-data/）→ E2E_SPEC 单 spec → debug-stop（exit 0，/tmp/peekview-debug/ 清理）；红灯/失败分支形态未触发（三键一次通过）。
- verification_env 轮次预算：消耗 0/2（无环境失败，无重试）。
- seed 输出 Total entries: 19（去重后 24 loaded）；E2E 运行前 DB 为干净 seed 态，运行后由 debug-stop 清理，无跨键污染。
- 对照 P3 §5 基线：三 spec 改造前为真红灯（NotFoundView fixture 红灯），本轮全绿，符合「fixture 自建 + 清理」预期；render-regression 既有 flaky 家族（bdd_3/4/5/7/8）不在本轮三 spec 范围内，未涉及。
- E2E 日志原件在 /tmp（p5-e2e-1/2/3.log），不入库；关键签名已转录本文件。

## 汇总

| 键 | spec | exit | passed | failed | flaky |
|---|---|---|---|---|---|
| P5_e2e | mermaid.spec.ts | 0 | 6 | 0 | 0 |
| P5_e2e_b | mermaid-check.spec.ts | 0 | 2 | 0 | 0 |
| P5_e2e_c | mermaid-visual.spec.ts | 0 | 6 | 0 | 0 |

合计 14 passed / 0 failed / 0 flaky，三键无跳过。

- N5 机器可读签名行（上方代码围栏为 verbatim 转录，本行行首对齐同内容，供 `^passed` 锚定正则校验）：

passed 14 failed 0 flaky 0 (playwright: mermaid.spec.ts 6 passed (8.9s) / mermaid-check.spec.ts 2 passed (6.0s) / mermaid-visual.spec.ts 6 passed (6.6s))

EXIT_CODE: 0
