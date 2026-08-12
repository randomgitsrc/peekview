# P3 Progress: test-designer (frontend + MCP)

## 步骤 1: 读取输入文件

- [x] P1-requirements.md - BDD B1-B2, C1-C2, D1-D2, M1-M3
- [x] P2-design.md - §2.3-2.6, §2.8-2.9
- [x] frontend-v3/src/stores/entry.ts - loadEntries, filterPrivateEntries
- [x] frontend-v3/src/stores/auth.ts - authState, logout, peekview:auth-expired
- [x] frontend-v3/src/api/client.ts - PeekAPI class, listEntries
- [x] frontend-v3/src/types/index.ts - Entry, ListEntriesParams, AuthState
- [x] packages/mcp-server/src/tools/listEntries.ts - zod schema, handler
- [x] packages/mcp-server/src/client.ts - listEntries method
- [x] P0-brief.md - env constraints

### 关键发现

1. **Entry store 当前 loadEntries**：无序列号去重，无 clearOnError 选项
2. **Auth store logout**：仅设 user=null，不触发列表重载
3. **API client listEntries**：已支持 status 参数（`client.ts:112`），前端通路已通
4. **MCP listEntries schema**：当前无 status 参数（`z.object({ query, tags, page, per_page })`）
5. **MCP client listEntries**：当前无 status 参数
6. **MCP vitest config**：`include: ['tests/**/*.test.ts']`，test 文件在 tests/ 目录

### 测试策略

- **Vitest store 测试**：直接用 entries/auth store actions，mock API client
- **Playwright E2E 测试**：注册用户 → 创建 entries → 登录/退出 → 验证列表
- **MCP 测试**：MSW mock server，测试 zod schema + client 参数传递

## 步骤 2: 写测试

### 2.1 entry-store-auth.spec.ts

测试覆盖：
- BDD-B1: 登录后需要列表刷新 (store 级别：loadEntries 被调用)
- BDD-C1: 退出后需要列表刷新 (store 级别：loadEntries 替代 filterPrivateEntries)
- BDD-D1/D2: auth 过期需要列表刷新
- P2 §2.8: 请求序列号去重
- P2 §2.9: clearOnError 选项
- auth store: authState computed, logout, peekview:auth-expired

### 2.2 archived-visibility.spec.ts (Playwright E2E)

测试覆盖：
- BDD-B1: 登录后 All tab 列表刷新
- BDD-B2: 登录后 Mine tab 自动切换
- BDD-C1: 退出后列表刷新为匿名视图
- BDD-C2: 退出后 Archived tab 刷新为空
- BDD-D1: Auth 过期后列表刷新为匿名视图

### 2.3 list-entries-status.test.ts (MCP)

测试覆盖：
- BDD-M1: 无 status 参数 → client 不传 status (默认 active)
- BDD-M2: status="archived" → client 传 status
- BDD-M3: 非法 status → zod 错误

注意：文件实际落盘在 `packages/mcp-server/tests/list-entries-status.test.ts`，因为 MCP vitest.config.ts 只 include `tests/**/*.test.ts`。

## 步骤 3: 验证红灯

### frontend-v3 vitest store 测试
- 命令：`cd frontend-v3 && ./node_modules/.bin/vitest run src/__tests__/entry-store-auth.spec.ts`
- 结果：17 tests: 15 passed, 2 failed ✓
  - 红灯1: sequence number dedup — 当前 loadEntries 无序列号去重 (§2.8)
  - 红灯2: clearOnError=false — 当前 loadEntries 无此选项 (§2.9)
  - 绿灯: API 参数传递、正常加载、错误处理、filterPrivateEntries、authState computed、logout、peekview:auth-expired

### MCP vitest 测试
- 命令：`cd packages/mcp-server && npx vitest run tests/list-entries-status.test.ts`
- 结果：11 tests: 3 passed, 8 failed ✓
  - 红灯: BDD-M2 (status param 不在 schema/不传 API)、BDD-M3 (无 zod 校验)、client 无 status 参数
  - 绿灯: BDD-M1 默认行为、client 不传 status 时正常

### Playwright E2E
- 未跑（需要 debug backend :8888 在线，且实现后才会有绿灯）
