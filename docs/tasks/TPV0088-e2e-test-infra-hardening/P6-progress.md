# P6 验收进度（verifier）

## 2026-08-12 环境确认
- debug backend :8888 health OK（/health 200, {"status":"ok"}), entries API 返回 27 条
- seed 4 关键 entry 全部 FOUND：python-entry-service / markdown-test / mermaid-charts / json-api-config
- CDP Chrome :18800 可用（200）
- static 新鲜：`find frontend-v3/src -type f -newer backend/peekview/static/index.html` 无输出（BDD-7 前置成立）
- viewer.spec.ts 19 个 test()；grep 判定：无 /#/entry/、无 lu4prg/ngajri、无死选择器（.code-header/.mobile-actions/.toc-btn/.list-header/.btn-icon/.menu-btn）
- TC-041 断言核实：goto /json-api-config + .file-sidebar count === 0；json-api-config seed 单内容文件（config.json）确认
- [PROD_NOT_TOUCHED]

## 待执行
- BDD-1：E2E 实跑 19 用例
- BDD-6/7/8：三态
- BDD-9：安全检查

## 2026-08-12 BDD 验证结果（全部完成）
- BDD-1 PASS: E2E 实跑 38/38 passed（19 用例 × 2 项目），EXIT=0（bdd1-e2e.log）
- BDD-2 PASS: grep 无 /#/entry/ 残留（bdd234-grep.log）
- BDD-3 PASS: 死选择器全部清除（.code-header/.mobile-actions/.toc-btn/.list-header/.btn-icon 均无）；活选择器在册（file-sidebar×3, toc-sidebar×2, mobile-bottom-bar×1, theme-toggle×2, file-item×2, data-testid×7）
- BDD-4 PASS: 无 lu4prg/ngajri；新 slug 映射：python-entry-service×5, markdown-test×6, mermaid-charts×1, json-api-config×1
- BDD-5 PASS: TC-041 单文件断言 .file-sidebar count===0 + json-api-config seed 单内容文件支撑（bdd5-tc041-data.log）
- BDD-6 PASS: touch ThemeToggle.vue 不 rebuild → Step 1 Check 6 FATAL 拦截 + 提示 make build-frontend + make exit 2（bdd6-stale-block.log）
- BDD-7 PASS: build-frontend 恢复新鲜 → debug-test 38/38 通过，Check 6 ✓（bdd7-fresh-pass.log）
- BDD-8 PASS: make debug-quick（build→start→seed）→ debug-test 38/38 通过，不误伤（bdd8-debug-quick-pass.log）
- BDD-9 PASS: e2e-safety-check.sh 全 5 项既有检查 + Check 6 全过，无 e2e- 前缀 WARNING（生产无 e2e- 数据）（bdd9-safety-check.log）
- [PROD_NOT_TOUCHED]（全部验证走 :8888；生产 DB 仅脚本内只读 SELECT COUNT 统计）

## 2026-08-12 产出与自检
- P6-acceptance.md 已产出：9 PASS / 0 FAIL，frontmatter pass:9 fail:0 ui_affected:false
- 三预检全部通过：check-p6-format FORMAT=0 / check-p6-evidence EVIDENCE=0 / check-p6-provenance PROVENANCE=0
- 注意：P6-evidence/logs/*.log 被 .gitignore 的 `*.log` 规则忽略，主 Agent git add 时需 `git add -f docs/tasks/TPV0088-e2e-test-infra-hardening/P6-evidence/`
