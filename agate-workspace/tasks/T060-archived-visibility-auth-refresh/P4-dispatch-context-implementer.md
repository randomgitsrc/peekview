---
phase: P4
generated_by: agate-inject-card.sh + 主 Agent
task_id: T060
role: implementer
---

<dispatch_guide>
### 目标
按 P2-design.md 方案 A 实现 archived 可见性 + auth 刷新。修改后端/前端/MCP 代码，让 P3 红灯全部转绿。

### 约束
- 严格按 P2-design.md 的方案 A 实现，不要自创方案
- 不要做范围外改动——发现新需求标 scope-plus 标记而非直接做
- 按 P2 files_to_read 清单读取代码（标了行号的只读片段），不要全文搜索
- 后端 404-not-403 模式不可变
- debug 环境：make debug（:8888, /tmp/peekview-debug/），严禁触碰生产 :8080
- 写完代码后自跑测试确认功能（自查），但不要声称"P5 已过"

### 修改清单（按 P2-design.md）

**后端（2 处改动）**：
1. `backend/peekview/services/entry_service.py:404-416`：统一所有角色无 status 时排除 archived（删除 mixed/owner/admin 分支，统一为 `status != ARCHIVED`）
2. `backend/peekview/api/entries.py:190-223`：增加 status 参数值校验，非法值返回 422

**前端（5 处改动）**：
1. `frontend-v3/src/stores/entry.ts:53-72`：loadEntries 增加序列号去重 + clearOnError 选项
2. `frontend-v3/src/stores/entry.ts:175-178`：删除 filterPrivateEntries（若确认无其他调用者）
3. `frontend-v3/src/views/EntryListView.vue:444-455`：authState watcher 扩展（登录/退出/auth 过期统一处理，oldState guard）
4. `frontend-v3/src/views/EntryListView.vue:379-384`：handleLogout 简化（删 filterPrivateEntries，靠 watcher 触起重载）
5. `frontend-v3/src/views/EntryListView.vue:88-101`：增加 a11y 属性（aria-live 通知 + role="status" 到 loading）

**MCP（2 处改动）**：
1. `packages/mcp-server/src/tools/listEntries.ts`：schema 增加 status 参数（z.enum）
2. `packages/mcp-server/src/client.ts:97-112`：listEntries 方法增加 status 参数

### 输入文件（按 P2 files_to_read 清单）
- backend/peekview/services/entry_service.py:404-416
- backend/peekview/api/entries.py:190-223
- backend/peekview/models.py:29-34
- frontend-v3/src/views/EntryListView.vue:379-384,444-455,88-101
- frontend-v3/src/stores/auth.ts:48-51,63-67
- frontend-v3/src/stores/entry.ts:53-72,175-178
- packages/mcp-server/src/tools/listEntries.ts
- packages/mcp-server/src/client.ts:97-112
- docs/tasks/T060-archived-visibility-auth-refresh/P2-design.md（§2.1-2.11 详细设计）
</dispatch_guide>

<objective_info>
- 测试命令：cd backend && .venv/bin/python -m pytest tests/test_archived_visibility.py -q --tb=no
- 前端类型检查：cd frontend-v3 && npx vue-tsc --noEmit
- MCP 构建：cd packages/mcp-server && npm run build
</objective_info>
