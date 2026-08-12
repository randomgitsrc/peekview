---
phase: P6
task_id: TPV0088-e2e-test-infra-hardening
type: acceptance
parent: P5-verification.md
trace_id: TPV0088-P6-20260812
status: draft
created: 2026-08-12
agent: verifier
# ── v2.0 机器汇总 ──
pass: 9
fail: 0
ui_affected: false
---

# P6 验收报告 — TPV0088 E2E 测试基础设施加固

- 验收人：verifier
- 验收日期：2026-08-12
- 验收环境：debug backend 127.0.0.1:8888 (`/tmp/peekview-debug/` 隔离) + CDP Chrome :18800 + 新鲜 static
- 状态标记：`[PROD_NOT_TOUCHED]`（全部验证走 :8888 与隔离数据；生产 DB 仅在 e2e-safety-check.sh Check 4/5 内只读统计，未做任何写操作）
- BDD 对照依据：P1-requirements.md §4（9 条 BDD）

## 逐条验收结果

- PASS BDD-1: 全部 19 用例在 debug backend 实跑通过。`E2E_SPEC=e2e/viewer.spec.ts make debug-test` 结果 `38 passed (11.5s)`, EXIT=0（38 次运行 = 19 用例 × 2 项目 [chromium + Mobile Chrome], 非抽样）(logs/bdd1-e2e.log)
- PASS BDD-2: 路由全部 history 模式, 无 `/#/entry/` 残留。全文件 `page.goto` 均为 `/{slug}` / `/explore` / `/` 形式, grep `/#/entry/` 零命中 (logs/bdd234-grep.log)
- PASS BDD-3: 死选择器全部替换为现存 DOM。`.code-header` `.mobile-actions` `.toc-btn` `.list-header` `.btn-icon` 在 viewer.spec.ts 零命中; 活选择器在册: `.file-sidebar`×3、`.toc-sidebar`×2、`[data-testid="mobile-bottom-bar"]`×1、`.theme-toggle`×2、`.file-item`×2、`data-testid`×7 (logs/bdd234-grep.log, logs/bdd3-live-selectors.log)
- PASS BDD-4: 硬编码 slug 全部映射到现存 seed entry。无 `lu4prg`/`ngajri` 残留; 新映射: python-entry-service×5（TC-004/005/030/042）、markdown-test×6（TC-010~012/020~023/040）、mermaid-charts×1（TC-013）、json-api-config×1（TC-041）, 均已在 debug seed 中存在 (logs/bdd234-grep.log)
- PASS BDD-5: TC-041 单文件断言有数据支撑。断言 goto '/json-api-config' 后 `.file-sidebar` count === 0（spec:292-300）; seed 数据支撑: `scripts/seed-data/json-api-config/` 仅含 config.json 一个内容文件（meta.json 非内容文件）, `isMultiFile=false` 不渲染 file-sidebar; E2E 两个项目 TC-041 均 PASS (logs/bdd5-tc041-data.log)
- PASS BDD-6: 过期 static 被拦截。`touch frontend-v3/src/components/ThemeToggle.vue`（不 rebuild）后跑 `make debug-test`: Step 1 Check 6 输出 `✗ FATAL: frontend 源码比 static 产物新, E2E 将基于过期产物运行` + `请先运行: make build-frontend`, `make: *** [Makefile:636：debug-test] 错误 1` EXIT=2 (logs/bdd6-stale-block.log)
- PASS BDD-7: 新鲜 static 放行。恢复（`make build-frontend`, static 重新拷贝, `find src -newer static` 零输出）后跑 `make debug-test`: Check 6 `✓ 静态产物新鲜`, E2E `38 passed (11.3s)` EXIT=0 (logs/bdd7-fresh-pass.log)
- PASS BDD-8: 先 build 后 debug-test 正常流程不被误伤。依次 `make debug-quick`（build-frontend-fast → debug-start → debug-seed, seed 23 entries）后跑 `make debug-test`: Check 6 放行, E2E `38 passed (10.7s)` EXIT=0 (logs/bdd8-debug-quick-pass.log)
- PASS BDD-9: 数据隔离不被破坏。`e2e-safety-check.sh` 全部 5 项既有检查（Check 1 运行方式 / Check 2 :8888 health / Check 3 独立 DB / Check 4 生产备份统计 / Check 5 e2e- 前缀）通过, Check 6 通过, 输出 `=== ✓ 安全检查通过, 可以运行 E2E 测试 ===` EXIT=0; Check 5 无 `⚠ WARNING: 生产数据库已有 e2e- 数据` 输出, 生产 DB 无新增 e2e- 数据 (logs/bdd9-safety-check.log)

## 验证纪律备注

- 全部 9 条 BDD 均实跑取得客观输出后判定（无"应该能过"式推断），证据文件均在 P6-evidence/logs/。
- BDD-6 构造过期场景后已恢复：`make build-frontend` 重建 static，恢复后 `find frontend-v3/src -type f -newer backend/peekview/static/index.html` 零输出（新鲜态），未污染后续 BDD-7/8 验证。
- BDD-6 为负向测试（预期 make 以非零退出拦截），`bdd6-stale-block.log` 捕获的正是被拦截时的完整输出（含 `✗ FATAL` 提示 + `make: *** ... 错误 1`），即为证据本体；该日志无 EXIT_CODE 尾行，provenance 对其按非阻塞跳过处理。
- E2E 实跑共 3 次全量（BDD-1/7/8），均 38/38 passed。

## 证据索引

| 证据文件 | 对应 BDD | 内容 |
|----------|----------|------|
| logs/bdd1-e2e.log | BDD-1 | E2E 全量实跑输出（38 passed） |
| logs/bdd234-grep.log | BDD-2/3/4 | 路由残留 / 死选择器 / slug 残留 grep 判定 |
| logs/bdd3-live-selectors.log | BDD-3 | 活选择器使用统计 |
| logs/bdd5-tc041-data.log | BDD-5 | TC-041 断言原文 + seed 单文件数据支撑 + 实跑结果 |
| logs/bdd6-stale-block.log | BDD-6 | 过期 static 拦截输出（Check 6 FATAL + EXIT=2） |
| logs/bdd7-fresh-pass.log | BDD-7 | 新鲜 static 放行 + 38 passed |
| logs/bdd8-debug-quick-pass.log | BDD-8 | debug-quick → debug-test 全链路放行 |
| logs/bdd9-safety-check.log | BDD-9 | 安全检查 5+6 全过输出 |

**Summary**: PASS: 9 / FAIL: 0
