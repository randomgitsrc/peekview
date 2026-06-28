# P1 Progress Log — T026 search-url

## Step 1: Read P0-brief.md
- task: EntryListView header 加 search input (防抖 300ms 同步 ?q=)，与 ?owner= 共存
- user_decisions: 位置在 header，URL 形态 /explore?q=xxx，防抖 300ms，不做搜索历史/建议/热词/高亮
- known_risks: FTS5 已有不碰后端；搜索+tab/分页组合；防抖+router 同步；Esc/Enter 快捷键；特殊字符转义
- env_constraints: 前端测试/构建/类型检查，Playwright E2E，禁止 CLI 创建测试 entry
- pruning_tendency: 激进（纯前端小活）
- coordination: T024 必须先（路由移到 /explore）；T025 完成后 T026 再开始（串行，避免冲突）

## Step 2: Read AGENTS.md
- 铁律确认：前端路由路径是 /{slug} 不是 /entries/{slug}
- 开发/调试用 make debug (127.0.0.1:8888)
- 变更后必须 vue-tsc --noEmit + npm run build

## Step 3: Read EntryListView.vue (current state)
- header 区域: PeekView logo + auth button/UserMenu + ThemeToggle — 无 search input
- owner tabs: All/Mine，通过 setOwner() 用 router.replace 同步 URL
- setOwner() 问题: 完全替换 query（{ owner: 'me' }），不保留其它参数（如 ?q=）
- clearOwnerFilter(): 同样替换 query 为 {}，不保留 ?q=
- restoreFromURL(): 只读 owner 参数，不读 q
- currentPage watch: 调用 loadEntries({ page, perPage, owner }) 不传 q
- onMounted: 调用 loadEntries 时不传 q
- loadEntries: 通过 entryStore 调用，store 的 loadEntries 接受 ListEntriesParams (含 q?)
- Pagination: 使用 v-model:page="currentPage"，不更新 URL ?page=
- 空结果: 显示 "No entries found" 或 "No entries from @owner"

## Step 4: Read API layer
- API client listEntries: 已透传 q 参数到后端 GET /api/v1/entries?q=...
- ListEntriesParams: 已包含 q?: string 字段
- 后端 FTS5: entry_service.py:379-397 已实现，用 MATCH 语法，异常静默吞掉

## Step 5: Read router.ts
- /explore → EntryListView (不含 owner prop)
- /users/:username → EntryListView (owner prop 来自 route.params.username)
- 无 /search 路由（确认不做）

## Step 6: Read existing composable useDebounce
- useDebounce.ts 已存在，通用防抖函数（延迟 N ms 后执行 fn）
- 可直接复用

## Step 7: Key gaps identified
1. restoreFromURL() 不读 q 参数
2. setOwner() 完全替换 query，不保留 q
3. clearOwnerFilter() 不保留 q
4. currentPage watch 不传 q
5. onMounted loadEntries 不传 q
6. Pagination 不更新 URL page 参数
7. 无 search input UI
8. 无 searchQuery 状态管理
9. 无 Esc/Enter 键盘处理
10. authState watch 不传 q

## Step 8: Write P1-requirements.md — COMPLETE
- 16 BDD acceptance conditions (Given/When/Then)
- 4 [NEED_CONFIRM] items all resolved internally (no pending questions)
- 4 phases retained: P1, P2, P3, P4, P5, P6; P7 (single file change) and P8 (no independent version) skipped with reasons
- Capability requirements: all "available" (playwright, vitest, vue-tsc)
- No CAPABILITY_GAP
- Scope: frontend-v3 only; domains: frontend, routing
- Key implicit gap found: pagination not currently synced to URL — must be added

## Quality Gate Check
- grep -cF '[NEED_CONFIRM]' → 0 ✅
- grep -c 'status: GAP' → 0 ✅
- BDD count: 16 ✅
