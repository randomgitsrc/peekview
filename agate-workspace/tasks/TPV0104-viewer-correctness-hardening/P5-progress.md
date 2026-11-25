# P5 progress (verifier) — TPV0104

- 2026-11-25T17:23:43+08:00 启动：dispatch-context + verifier.md 已读；gate_commands 11 条已确认（P2 §5）
- 2026-11-25T17:23:43+08:00 环境探活：:8888=200 :8890=200，:8080 不可达（timeout/blocked）；git HEAD=4ec6b1b6；工作区干净（仅 orchestrator-log 与 dispatch-context 未提交，非我改动）
- 2026-11-25T17:26:32+08:00 P5 (make test-quick): exit=1, 1 failed / 1221 passed / 3 skipped — 唯一失败=预存 test_cli_remote::test_config_set_remote_api_key（Errno 30 沙箱只读）
- 2026-11-25T17:26:32+08:00 P5_frontend (make test-frontend): exit=0, 127 files / 1514 passed / 4 skipped / 0 failed
- 2026-11-25T17:26:45+08:00 P5_typecheck (make typecheck): exit=0 (vue-tsc passed)
- 2026-11-25T17:26:56+08:00 P5_lint (make lint): exit=0 (All checks passed)
- 2026-11-25T17:26:56+08:00 P5_docs (make check-docs): exit=0（文档一致性检查完成）
- 2026-11-25T17:28:09+08:00 P5_e2e（首次尝试）: exit=2 — scripts/e2e-safety-check.sh Check 6「静态产物新鲜度」拦截：frontend-v3/src/composables/useCsvParser.ts (08:30) 比 backend/peekview/static/index.html (07:10) 新 → 需 make build-frontend（脚本自身规定的处置动作），非测试失败
- 2026-11-25T17:28:47+08:00 make build-frontend: exit=0（7 files 已同步，392 static files）；--test-mtime 复查通过
- 2026-11-25T17:39:44+08:00 P5_e2e (tpv0104-viewer-hardening): exit=1 — 78 tests: 47 passed / 24 failed / 7 flaky（3.0m）。失败归因待查（候选：yaml 走 TreeView 致 toContain('kind: X') 断言机制错 / 8 worker 并发下 30s 超时 / 少量几何度量）
- 2026-11-25T17:42:42+08:00 P5_e2e_mobile_widths: exit=0, 18 passed / 0 failed (8.2s) — 360/375/390 三档 × 3 entry 全绿
- 2026-11-25T17:48:19+08:00 P5_e2e_legacy_viewer: exit=1, 18 failed / 20 passed (2.5m) — 失败集与基线 18F/20P 完全一致（根因 TPV0095 遗留：markdown-test 团队归属致匿名 404；另有 mobile-bottom-bar/.diagram-viewer 缺失与 drawer 超时，均属基线同源）
- 2026-11-25T17:55:58+08:00 P5_e2e_legacy_t091: exit=1, 14 failed / 12 passed (2.8m)。基线记 12F/12P（=24 项）但 spec 实为 13 test × 2 project = 26 项 → 基线很可能漏计 2 个 flaky。失败全部是 markdown-test 上 meta-tags-bar / mobile-bottom-bar / markdown-body「element not found」→ 匿名 404（TPV0095 遗留，与基线同源）；需进一步归因 2 条增量
- 2026-11-25T18:19:15+08:00 P5_e2e_legacy_tpv0099: 第1次 exit=1 4F/2P（BDD-9 markdown-test/raw 404 + BDD-15 .diagram-block 缺失）；**第2次重跑 exit=0 6P/0F**（8.3s）→ 判定环境抖动/flaky，非代码回归
- 2026-11-25T18:52 产出落盘：P5-test-results/{unit.md, fail-list.txt, e2e.md}；fail-list 改为纯 `FAILED <id>` 45 行（1 预存 + 12 新spec + 18 viewer + 14 t091 + 0 tpv0099）
- 2026-11-25T18:52 ⚠️ 发现 `frontend-v3/e2e/tpv0104-viewer-hardening.spec.ts` 被**并发修改**（mtime 18:52:42 → 18:53:28，非本 verifier 所为）：改动内容 = 把 `kind: Deployment`→`Deployment`、`share.json().token`→从 share_url 解析、`kind: Service`→`Service` —— 与我 §四 的测试缺陷诊断一致。我的 P5_e2e 结果对应**改动前**的 spec，现已 stale，需重跑
- 2026-11-25T18:53 自检：三文件齐备；签名校验 unit.md=1 / fail-list=45（>0）；PROD_NOT_TOUCHED 已标注；HEAD 仍 4ec6b1b6（未 commit）
