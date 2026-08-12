# P3 Progress — TPV0088 e2e-test-infra-hardening

## 2026-08-12 test-designer 派发开始

- [x] 读取 role 定义 `~/.agate/assets/execution-roles/test-designer.md`
- [x] 读取 P3-dispatch-context-test-designer.md
- [x] 读取 P0-brief.md
- [x] 读取 P2-design.md
- [x] 读取 P1-requirements.md（9 BDD，19 用例核实）
- [x] 读取 scripts/e2e-safety-check.sh（现状无 Check 6 / 无 --test-mtime / 无 check_static_freshness）
- [x] 读取 AGENTS.md（项目约定，已在上下文中）
- [x] 读取 Makefile:540-650（debug-build/debug-test Step 1 现状）
- [x] 读取 viewer.spec.ts（19 用例确认，6 describe）
- [x] 核实 seed-data：json-api-config(单文件config.json)/python-entry-service(3文件,8处def)/markdown-test(2文件,含TOC)/mermaid-charts(3个mermaid文件)
- [x] grep 核实活选择器：mobile-bottom-bar/filetree-btn/toc-btn/wrap-btn/copy-btn、theme-toggle、file-name、diagram-viewer、aria-label Copy、content-area、wrap-enabled、overflow-menu-trigger 全部命中
- [ ] 运行 gate 命令确认红灯
- [x] 运行 gate 命令确认红灯（`--test-mtime` 未实现 → 命中 Check 1 guard, exit 1）
- [x] 完成 test-mtime.sh 红灯自检：PASS=1 FAIL=5（TC-B1/B2/B3/B4/B6 红 = B 类目标缺失；TC-B7 回归守卫绿），HARNESS_EXIT=1
- [x] 产出 P3-test-cases.md（header 精确复制 + test_code_dir 声明 + 子任务 B 7 用例 + 子任务 A 19 用例修复清单）
- [x] 自检：harness 无 fixture 泄漏、无生产触碰 [PROD_NOT_TOUCHED]
