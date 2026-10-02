# P6 进度 — TPV0101 verifier

- 读取 dispatch-context + verifier.md + P1/P2/P3/P4/P5。
- 口径确认：change_type=refactor → 回归三段式；18 BDD；BDD-5 承载 regression.log；BDD-15 注入漂移实测；BDD-18 [PROD_NOT_TOUCHED]。
- 环境确认：backend/.venv=0.0.38/2.0.51/9.1.1；/tmp/ci-repro-venv=0.0.47/2.0.54/9.1.1。

## 验收实跑完成
- BDD-5 全量回归：regression.log(0.0.38)=1186 passed/0 failed/3 skipped, EXIT_CODE: 0；regression-047.log(0.0.47 CI 等价) 同。
- 18 BDD 逐条 PASS，证据 23 文件。
- BDD-15 注入漂移实测：去掉上限 → 守卫 exit 1（no upper bound）→ 恢复 → exit 0；git diff pyproject 空。
- BDD-7/17：pre-fix(01923d5d) vs post(0.0.38/0.0.47) 逐字段形态 CONTRACT_UNCHANGED: True；entry.expires_at 的 Z 后缀预先存在。
- post-test 残留检查：清理钩子 PASSED、repo 无产物、worktree 已清、双 venv 完好、pyproject 已恢复。
- 预检：format exit 0；evidence exit 0；provenance exit 2（仅 P1-dispatch-context-analyst-revision.md 缺 agent 字段，协作规范 WARNING，非阻塞）；gate P6 exit 2（FAIL=0，P6_TOTAL=18）。
