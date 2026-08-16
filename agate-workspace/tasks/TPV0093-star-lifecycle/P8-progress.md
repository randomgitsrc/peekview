
## P8 releaser 进度（2026-08-16）

- 已读 dispatch-context（发布准备 5 项）、implementer.md、P0/P2/P7/P6、CHANGELOG、VERSIONS.json、tech-debt.md
- 版本确认：VERSIONS.json peekview=0.20.0 / mcp_server=0.11.0；pyproject/__init__.py 均 0.20.0；最后 tag v0.20.0
- 未发布变更范围：TPV0093 P1-P7（8 commit）+ TPV0092 后置 docs（AGENTS.md 基础设施沉淀 / MCP README 重写，纯文档无代码影响，随 0.21.0 一并发布）
- MCP 包零代码改动（diff 仅 README docs）→ 不 bump，保持 0.11.0
- debt：tech-debt.md 含 DEBT0004/0005/0006；DEBT0006 为本任务 [SCOPE+] 登记（backup/restore merge 不导入新表）
- 临时资源：debug :8888 运行中（PID 906295）、/tmp/peekview-debug/、/tmp/peekview-debug-8890.log、/tmp/pv_minval_stars.py
- 产出 P8-release.md（bump_type=minor 0.21.0 + CHANGELOG 建议 + debt_check + 临时资源清单）
- P8-release.md 落盘完成（127 行）：bump_type=minor（0.20.0→0.21.0）+ CHANGELOG 条目建议 + debt_check=reviewed（DEBT0006）+ 临时资源清单（debug :8888 / /tmp/peekview-debug/ / 8890.log / pv_minval_stars.py）+ Lessons Learned

## P8 复盘独立评审进度（retrospective-review）
- 已读 dispatch-context（评审重点 5 项）+ requirements-review 角色规范 + 复盘文档全文
- 开始抽查客观证据：git log / run-e2e-tests.sh / star.spec.ts / opencode.db
=== [23:02:52] r2 复盘评审开始 ===
- 已读 dispatch-context + requirements-review 角色规范 + 证据包 + 复盘文档正文
=== [23:05:48] 抽查完成 ===
- run-e2e-tests.sh:95 timeout包裹 ✓ / star.spec.ts:39,48 login修复 ✓ / entry_service.py:592 set解包 ✓ / StarManageView.vue:189 Math.ceil ✓ / git log P1-P8+bump ✓ / P6-dispatch-context:210 只写脚本 ✓ / verify-ui.ts:30-34 HARD_TIMEOUT ✓ / P5-test-results e2e.md 主Agent复跑发现
- 发现§2.1时间戳与证据包不一致：backend[52] 实际15:57:25→19:06:10(188min) vs 复盘'17:17→18:26(69min)'; frontend[104] 终止19:06:10 vs 复盘18:26
=== [23:06:23] 评审文件已写入: docs/reviews/TPV0093-retrospective-review-20260816.md (101 行, status=needs-revision) ===
=== [23:08:00] r2 复核计算完成 ===
- 修正1验证：backend[52] diff=11,324,420ms=188.74min≈188分钟✓; frontend[104] diff=11,290,057ms=188.17min≈188分钟✓（时间戳+8区 15:57:25→19:06:10）
- 修正2验证：§2.1 E1行 + §4.2 T-4 均"4次累计1败"（[93]全量通过+[98]for3次run1失败）与证据包一致✓
- ⚠️ 发现残留：§6.2 P-1（line 127）仍写"TC-BDD20-02 flaky（复现 4 次 2 败）"——与证据包(仅1败)及修正后正文(4次累计1败)矛盾，修正2未完全闭合
=== [23:10:00] r2 评审文件已写入 ===
- docs/reviews/TPV0093-retrospective-review-20260816.md 已覆盖写回（status=needs-revision）
- 结论：修正1闭合✓（188分钟时间戳验证）；修正2部分闭合✗（§6.2 P-1 line127 残留"复现4次2败"与证据包及正文矛盾）
