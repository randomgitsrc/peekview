# P7 一致性检查进度 — consistency-reviewer

## 输入读取记录

- [x] P7-dispatch-context-consistency-reviewer.md — 派发指引（强制）：P4 无 DESIGN_GAP、P1 无 SCOPE+、8 BDD、4 耦合点、packages=files.py/test_api/client.ts/ImageViewer.vue+e2e
- [x] execution-roles/consistency-reviewer.md — 角色定义：DESIGN_GAP 逐条配对 + SCOPE+ 闭环 + 跨文件引用锚点（P1§BDD/P2§packages/P4 implementation）
- [x] P0-brief.md — 根因（latin-1 UnicodeEncodeError）、known_risks（组合最优）、P3/P6/P7 不可裁
- [x] P1-requirements.md — 8 BDD、[NO_NEED_CONFIRM] 无 [NEED_CONFIRM]、SUGGEST 3 条、packages 4 项、implicit_coupling + 4 耦合点
- [x] P1-review.md（grep）— O1（BDD-7 不新增引号断言）/O2（suggestedFilename 是 P6 唯一浏览器解析点）
- [x] P2-design.md — 候选 C、§2.1 helper 规格、§2.2 URL 变更、§3 gate_commands、packages 4 项
- [x] P2-review.md — 观察①②③（删 safe_name 防 F841 / café 补断言 / e2e 命名 tpv0091-）
- [x] P3-test-cases.md — 8/8 BDD 映射、test_code_dir（tpv0091- 前缀）、红灯/绿预期
- [x] P4-implementation.md — 改动清单（files.py + client.ts）、无 SCOPE+/无 DESIGN_GAP（:48-50）
- [x] P5-test-results/unit.md — 1071 passed/1 failed（test_cli_remote 预存）/3 skipped、lint/typecheck PASS
- [x] known-failures.md — 1 条预存失败登记（test_cli_remote）
- [x] P6-acceptance.md — 8/8 PASS 0 FAIL、vision 4 yaml blocker=0
- [x] backend/peekview/api/files.py — 实现已读：helper :74-80、download_file :213-217、get_file_content 未动、_sanitize_filename 未动
- [x] frontend-v3/src/api/client.ts — getFileAsBase64:160-171 URL→/content、getFileContent 未动、downloadFile 死代码保留
- [x] e2e/tpv0091-unicode-preview-download.spec.ts — test_bdd_1/2/3/5/8 + mobile bdd_1
- [x] 代码核查：test_api.py（TC-B1/B2/B3 用例）、test_security.py:577-613（BDD-7 净化）、ImageViewer.vue:119（getFileAsBase64 唯一调用方）

## 审查与产出

- [x] 跨文件一致性核对完成（P2 packages↔P1↔P4 改动面；P1 BDD 8↔P6 PASS 8；P4 实现逐行==P2 §2.1/§2.2；P3 用例↔P6 验收）
- [x] 耦合点 4 项全核对通过（backend-download-header / frontend-preview-path / read-tracking-action / security-injection-guard，均引用代码锚点）
- [x] 未决项清零（P1 无 [NEED_CONFLICT]/[BLOCKER]；P6 无残留；known-failures 已登记）
- [x] 产出 P7-consistency.md（status: approved）
- [x] gate P7 EXIT=0（frontmatter 机器计数: blocker=0, deviation=1, deviation_critical=0, design_gap=0, design_gap_reviewed=0）
- [x] 非阻塞偏差记录：P2 gate_commands.P5_e2e e2e spec 名旧前缀 t091-（P3 已改 tpv0091-，链路闭环）
