P7 progress — T082-arch-refactor

[CHECK-1] DESIGN_GAP 配对：P4 backend 2 GAPs + P4 frontend 1 GAP = 3 total, all will be transcribed with [DESIGN_GAP_REVIEWED]
[CHECK-2] SCOPE+ 闭环：P1 无 [SCOPE+] 标记 → 无需检查
[CHECK-3] P2 packages [backend, frontend] vs P4 impl_dir [backend/peekview/, frontend-v3/src/] → 一致
[CHECK-4] P1 BDD 数 41 vs P6 PASS 数 41 → 一致
[CHECK-5] P2 gate_commands [test-quick, test-frontend, typecheck, lint] vs P5 executed [test-quick, test-frontend, typecheck, lint] → 一致
[CHECK-6] P4 实现路径 vs P2 方案设计：R1-R7 全部验证通过（_shared.py, flush, store files, component line counts, error.message）
[CHECK-7] 未决项清零：无 [NEED_CONFIRM]/[BLOCKER]/[DEVIATION-CRITICAL] 残留（仅 dispatch-context 中引用这些标记名）；P1 有 [NO_NEED_CONFIRM]
[CHECK-8] P6 BDD 二值规则：41 条全 PASS，无中间态
[CHECK-9] DEVIATION 发现：P4 前端 4 composables vs P2 设计 2 composables → [EXTENSION]（合理扩展，非 BLOCKER）
[CHECK-10] DEVIATION 发现：P6 BDD-22~38 用 vitest 单测验证 vs P2 建议 Playwright → [DEVIATION]（非核心，行为已验证）
[CHECK-11] P2 get_entry_service 删除 vs P4 实际删除 → 一致
[CHECK-12] P2 不改清单 vs P4 实现：main.py 基础设施 HTTPException 保留 → 一致
