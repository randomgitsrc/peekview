
## P8 releaser 进度（2026-08-16）

- 已读 dispatch-context（发布准备 5 项）、implementer.md、P0/P2/P7/P6、CHANGELOG、VERSIONS.json、tech-debt.md
- 版本确认：VERSIONS.json peekview=0.20.0 / mcp_server=0.11.0；pyproject/__init__.py 均 0.20.0；最后 tag v0.20.0
- 未发布变更范围：TPV0093 P1-P7（8 commit）+ TPV0092 后置 docs（AGENTS.md 基础设施沉淀 / MCP README 重写，纯文档无代码影响，随 0.21.0 一并发布）
- MCP 包零代码改动（diff 仅 README docs）→ 不 bump，保持 0.11.0
- debt：tech-debt.md 含 DEBT0004/0005/0006；DEBT0006 为本任务 [SCOPE+] 登记（backup/restore merge 不导入新表）
- 临时资源：debug :8888 运行中（PID 906295）、/tmp/peekview-debug/、/tmp/peekview-debug-8890.log、/tmp/pv_minval_stars.py
- 产出 P8-release.md（bump_type=minor 0.21.0 + CHANGELOG 建议 + debt_check + 临时资源清单）
- P8-release.md 落盘完成（127 行）：bump_type=minor（0.20.0→0.21.0）+ CHANGELOG 条目建议 + debt_check=reviewed（DEBT0006）+ 临时资源清单（debug :8888 / /tmp/peekview-debug/ / 8890.log / pv_minval_stars.py）+ Lessons Learned
