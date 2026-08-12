---
phase: P3
generated_by: agate-inject-card.sh + 主 Agent
task_id: T060
role: test-designer
---

<dispatch_guide>
### 目标
产出前端 vitest 测试 + Playwright E2E + MCP vitest 测试。为 BDD B1-B2, C1-C2, D1-D2, M1-M3 设计测试用例并写测试代码。TDD 红灯。

### 约束
- 只写前端和 MCP 测试：
  - frontend-v3/src/__tests__/entry-store-auth.spec.ts（vitest + jsdom，store 逻辑）
  - frontend-v3/e2e/archived-visibility.spec.ts（Playwright E2E）
  - packages/mcp-server/src/__tests__/list-entries-status.test.ts（vitest）
- 前端单测启动命令：cd frontend-v3 && ./node_modules/.bin/vitest run src/__tests__/entry-store-auth.spec.ts
- E2E 启动命令：cd frontend-v3 && npx playwright test e2e/archived-visibility.spec.ts --reporter=line
- MCP 单测命令：cd packages/mcp-server && npm test
- debug 环境：make debug（:8888, /tmp/peekview-debug/）

### 上游关联
- P1 BDD B1-B2, C1-C2, D1-D2（6 条前端 BDD）+ M1-M3（3 条 MCP BDD）
- P2-design.md §2.3-2.6：前端 watcher + handleLogout + auth-expired + MCP schema
- P2-design.md §2.8-2.9：序列号去重 + clearOnError

### 输入文件
- docs/tasks/T060-archived-visibility-auth-refresh/P1-requirements.md（BDD 条件节）
- docs/tasks/T060-archived-visibility-auth-refresh/P2-design.md（§2.3-2.6, §2.8-2.9）
- frontend-v3/src/stores/entry.ts（loadEntries 当前实现）
- frontend-v3/src/stores/auth.ts（auth store）
- frontend-v3/src/api/client.ts（API client）
- frontend-v3/src/types/index.ts（类型定义）
- packages/mcp-server/src/tools/listEntries.ts（MCP tool schema）
- packages/mcp-server/src/client.ts（MCP client）
- AGENTS.md（项目约定：前端单测用 vitest run 非 npm run test）
</dispatch_guide>

<objective_info>
- 测试环境：frontend-v3 vitest + Playwright CDP :18800, MCP vitest
- 关键标识：6 条前端 BDD + 3 条 MCP BDD
</objective_info>
