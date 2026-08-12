
## P5 (frontend verifier) — 2026-08-01
- 已读 dispatch-context / P2-design gate_commands.P5 / P0-brief / verifier role
- debug backend :8888 在线（HTTP 200），E2E 前置满足
- 开始执行：vitest 全量 → vue-tsc → build → E2E
# P5 验证进度 — backend verifier

## 2026-08-01 输入读取完成
- 已读 P5-dispatch-context-backend-verifier.md（派发指引：3 条验证命令）
- 已读 P2-design.md gate_commands.P5_backend（`cd backend && .venv/bin/python -m pytest tests/test_language.py -q --tb=no`）
- 已读 P4-implementation-backend.md（改动面：language.py EXTENSION_MAP L69 .tsv + PLAIN_TEXT_LANGS 加 tsv，自查 1008 passed）
- 已读 P0-brief.md（环境约束：后端改动面小、隔离要求）
- 环境确认：backend/.venv 存在，Python 3.12.3；conftest autouse 隔离 tmp_path

## 执行开始

## gate_commands.P5_backend（test_language.py）
```
.venv/bin/python -m pytest tests/test_language.py -q --tb=no
→ 63 passed in 1.58s, EXIT_CODE: 0
```

## 全量回归（tests/）
```
.venv/bin/python -m pytest tests/ -q --tb=short
→ 1008 passed, 2 skipped, 10 warnings in 176.37s, EXIT_CODE: 0
→ 无 failed，无回归
```

## ruff lint
```
python3 -m ruff check peekview/ tests/
→ All checks passed!, EXIT_CODE: 0
```

## 实现独立核实
```
detect_language('file.tsv') = tsv ✓（非 csv）
detect_language('file.csv') = csv ✓
'tsv' in PLAIN_TEXT_LANGS = True ✓
PLAIN_TEXT_LANGS count = 15 ✓
```

## 产出落盘
- P5-test-results/backend-unit.md（63 passed + 1008 passed/2 skipped + ruff 签名，failed=0）
- P5-test-results/backend-fail-list.txt（无失败，空清单）
- [PROD_NOT_TOUCHED] 只跑 pytest（tmp_path 隔离）+ ruff，未触生产

## P5 backend 结论
target 63 passed / 全量 1008 passed, 2 skipped / ruff All checks passed，failed=0，无预存失败。

## 修正：gate 签名校验
- 初始 grep 计数 0（pytest 汇总行以 `=` 开头不匹配 gate 正则）→ 在 backend-unit.md 补显式签名行 `passed:`/`failed:`
- 修正后 grep -cE 计数 = 4（>0），两产出文件末行均为 `EXIT_CODE: 0`
- 门槛自查：两文件存在 ✓ / 签名计数>0 ✓ / 全量无回归（1008 passed, 2 skipped, failed=0）✓ / [PROD_NOT_TOUCHED] ✓
- vitest: 全量 1177 passed | 1 skipped（2 unhandled RPC timeout errors, 源自 TableView BDD-22 50000 行长测试）
- 分离验证: TableView.spec.ts 单独 13/13 EXIT=0；排除后 1168 passed | 1 skipped EXIT=0 → 0 真失败，RPC timeout 属环境问题
- vue-tsc: 0 errors
- build: success (12.7s)
- 开始 E2E
- E2E: 74 passed / 10 failed（5 唯一失败 × chromium + Mobile Chrome）
- 失败定性（CDP 实测）:
  - BDD-18 filter: spec 期望 6 行，CSV_120 中 'user5' 实际匹配 11 行 → spec 断言错误（实现正确）
  - BDD-20 per-page: CSV_120 仅 120 行 per_page=100 只有 2 页，spec 点第 3 页不存在 → spec 数据不足
  - BDD-30 search aria-live: spec 用 [aria-live="polite"].first() 选到页面其他 sr-only 空 span，TreeView 的 .search-match-count 播报正常 → spec 选择器缺陷
  - BDD-42 file switch: 真 bug — selectFile 异步加载 fileContent=''，TreeView 以空 content mount → JSON.parse('') 抛错 → parseError 残留 → 停在源码视图
  - BDD-52 mobile: 用 3 列 t075-csv 测横向滚动，390px 不溢出 → spec 数据错误（应像 BDD-21 用 30 列 CSV_WIDE）
- 结论: 4 spec 缺陷 + 1 真 bug(BDD-42) → E2E gate 不通过，需主 Agent 判定（回 P4 修 BDD-42 / P3 修 spec）
- 产出文件已写入 P5-test-results/: frontend-unit.md / frontend-fail-list.txt / e2e.md（末行均 EXIT_CODE）
- frontend-unit.md 签名: passed: 1177 / failed: 0（grep 计数 2 > 0）
- 门槛状态: 3 文件存在 ✓ / 签名计数 ✓ / E2E 已执行 ✓ / [PROD_NOT_TOUCHED] ✓ / 全量无回归（unit 0 failed）✓
- 但 E2E 有 1 真 bug (BDD-42) + 4 spec 缺陷 → E2E gate 不通过，返回主 Agent 判定

## [2026-08-01] P4 BDD-42 回退修复轮
- 复读 dispatch-context + e2e.md BDD-42 段，确认根因：selectFile 异步 `fileContent.value = ''` → TreeView 空 content mount 触发 immediate watch → JSON.parse('') 抛 SyntaxError → emit parse-error → EntryDetailContent.parseError 置位无清除 → showSourceView 恒 true → 停留 CodeViewer
- 已修复 TreeView.vue parseTree：开头加 `if (!props.content.trim()) { treeData=[]; emptyMessage='无数据'; return }`——空 content = 加载中状态，不 emit parse-error；fetch 完成后 watch 重触发正常 parse
- 自查中（vue-tsc / TreeView spec / E2E BDD-42）
- 自查全绿：vue-tsc 零错误 ✓ / TreeView.spec 13/13 ✓ / E2E `-g bdd_42` chromium + Mobile Chrome 2/2 passed ✓（先 make build-frontend 重建 dist——旧产物导致首轮 E2E 误报失败）
- 已更新 P4-implementation-frontend.md §10 追加修复记录
- [PROD_NOT_TOUCHED] 仅改 TreeView.vue + 重建前端，未触碰生产

## specfix（P3 test-designer 修复派发）

- 2026-08-01：读取 dispatch-context + P5-test-results/e2e.md + spec 全文；核实实现（TreeView.vue `.search-match-count`、Pagination.vue visiblePages、TableView.vue filter 走 includesString 全量过滤）。确认 4 项修复方向：BDD-18 断言 6→11、BDD-20 数据 120→CSV_300（3 页）、BDD-30 定位 `.search-match-count`、BDD-52 用 t075-csv-wide。

- 2026-08-01：4 项 spec 修复已落盘（frontend-v3/e2e/structured-data-viewer.spec.ts）：
  - BDD-18：filter 'user5' 断言 6→11（CSV_120 真实匹配 user5+user50~59）
  - BDD-20：改用新增 CSV_300/t075-csv-300，第 3 页断言 user200，切 50 后 50 行回第 1 页
  - BDD-30：`[aria-live="polite"].first()` → `.search-match-count`（TreeView.vue 专用计数播报）
  - BDD-52：390px 横向滚动改用 t075-csv-wide（30 列，同 BDD-21）
- 副本已同步：`diff` 为空（frontend-v3/e2e/ ↔ P3-test-code/）
- E2E 验证：84/84 全绿（--workers=1 分 6 chunk 串行；8-worker 全量一次跑在 7.6Gi 内存机上 OOM 崩溃，属环境问题非 spec 缺陷）。[PROD_NOT_TOUCHED] 全程仅访问 :8888 debug backend（/tmp/peekview-debug/），未触碰生产 :8080 / ~/.peekview/
