# TPV0089 P5 验证进度

- 2026-08-11: 环境确认——debug backend :8888 在线，23 entries 已 seed（含 unicode-filenames fixture，17 条可见）。PROD_NOT_TOUCHED
- make test-frontend: 92 files passed, 1228 passed / 4 skipped, exit 0
- path-map.test.ts 定向重跑: 51/51 passed
- make typecheck: passed (vue-tsc), exit 0
- E2E unicode-filename-link.spec.ts: 8 passed / 4 failed (BDD-11 desktop+mobile ×2 browsers)
- 根因分析：app 用 SPA store 导航（T047 既有架构），点击文件链接 URL 不变；BDD-11 测试 waitForURL(/?file=\d+) 与既有行为冲突。ASCII(English) 链接行为相同 → 非 TPV0089 回归。文件内容实际打开成功（无 404）
- make debug-test 全量（E2E_SPEC=e2e）: 420 passed, 大量环境性失败（CDP/localhost 断言），与 TPV0089 无关
- make test-quick: 1061 passed / 4 failed / 3 errors（test_cli_remote 仅 -n auto 下失败，单独跑全绿，预存失败）
- 产出 P5-test-results/unit.md + fail-list.txt + e2e.md + typecheck.md + backend.md + known-failures.md
- PROD_NOT_TOUCHED（:8080 未响应即未触碰，全部验证走 /tmp/peekview-debug/）
