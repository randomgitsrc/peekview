---
phase: P6
generated_by: agate-inject-card.sh + 主 Agent
task_id: T060
role: verifier
---

<dispatch_guide>
### 目标
对 18 条 BDD 逐条验收，产出 P6-acceptance.md + P6-evidence/。ui_affected: true，需 Playwright 截图 + vision 分析。

### 约束
- BDD 二值判定：只允许 PASS 或 FAIL
- 每条 PASS 必须有证据引用，存入 P6-evidence/
- UI 类 BDD 截图必须互不相同（操作类 BDD），查询类可不截图
- debug 环境：make debug（:8888, /tmp/peekview-debug/）
- Playwright CDP: connectOverCDP :18800
- vision-helper subagent 用于截图分析（你无法 Read 图片）
- 后台测试已全绿，可直接用 pytest 输出作证据
- P6-evidence/ 必须非空

### 验收策略

**后端 BDD（A1-A7, A1b-A3b, M3）— pytest 证据**
跑 test_archived_visibility.py，截取 PASS 行作证据。

**前端 BDD（B1-B2, C1-C2, D1-D2）— Playwright + vision**
1. 启动 debug backend: make debug-start
2. 用 playwright-cdp 脚本测试登录/退出/auth 过期场景，截图
3. 派 vision-helper 分析截图

**MCP BDD（M1-M2）— vitest 证据**
跑 MCP vitest 测试，截取输出作证据。

### 输入文件
- docs/tasks/T060-archived-visibility-auth-refresh/P1-requirements.md（18 BDD）
- docs/tasks/T060-archived-visibility-auth-refresh/P2-design.md（方案设计）
- backend/tests/test_archived_visibility.py（后端测试）
- frontend-v3/e2e/archived-visibility.spec.ts（E2E 测试）
- packages/mcp-server/tests/list-entries-status.test.ts（MCP 测试）
</dispatch_guide>

<objective_info>
- 后端测试命令：cd backend && .venv/bin/python -m pytest tests/test_archived_visibility.py -q --tb=no
- E2E 测试命令：cd frontend-v3 && npx playwright test e2e/archived-visibility.spec.ts --reporter=line
- MCP 测试命令：cd packages/mcp-server && npm test
- Chrome CDP: :18800
- debug backend: make debug-start / :8888
</objective_info>
