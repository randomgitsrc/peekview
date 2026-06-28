# P3 Progress Log — T026 search-url

## 2026-06-28 21:40 — 开始 P3 阶段

### 输入文件读取
- ✅ P0-brief.md — 已读。搜索 URL 化，防抖 300ms，Enter 立即，Esc 清空，与 owner tab 组合。
- ✅ P1-requirements.md — 已读。16 条 BDD 验收条件，ui_affected=true。
- ✅ P2-design.md — 已读。核心函数签名：updateURL() merge 函数、flushSearch()、clearSearch()、restoreFromURL() 扩展。
- ✅ EntryListView.vue (1-426 行) — 已读。现有 setOwner(完全替换 query → 丢 q)、clearOwnerFilter(完全清空 query → 丢 q)、restoreFromURL(只读 owner)、currentPage watcher(不写 URL)。
- ✅ EntryListView.logic.spec.ts — 已读。现有纯逻辑测试模式：纯函数定义在测试文件中，直接 import 并 test。
- ✅ useDebounce.spec.ts — 已读。防抖 composable 已有测试；P3 不重复测试 useDebounce 本身，仅测试搜索场景下的防抖交互。
- ✅ router.ts — 已读。/explore 和 /users/:username 共用 EntryListView。
- ✅ vitest.config.ts — jsdom 环境，globals: true。

### 测试目标函数（从 P2 设计提取）
1. **mergeQuery** — URL query 合并纯函数（核心）
2. **parseRestoreQuery** — URL query 解析（restoreFromURL 核心）
3. **resolveSearchKeyAction** — 键盘事件→搜索动作（Enter/Esc/其他）
4. **防抖交互** — 300ms 防抖 + Enter 立即触发（复用 useDebounce）

### 现有测试基线
- 34 个测试文件，429 个测试，全部通过。

### 2026-06-28 21:42 — P3-test-cases.md 已创建
- 31 个测试用例，覆盖 12/16 条 BDD 条件
- BDD-10/11/15/16 留给 P5/P6 层验证

### 2026-06-28 21:42 — TDD 红灯验证通过

**运行结果**：
- `searchUrl.logic.spec.ts`: 50 tests (32 failed, 18 passed)
- 全量测试: 35 files, 479 tests (447 passed, 32 failed)
- 0 collection errors, 32 assertion failures
- 现有 34 个测试文件全部通过 (447 tests) — 无退化

**失败原因**：`searchUrl.logic.ts` stub 函数返回错误值：
- `mergeQuery`: 返回 '' (忽略所有输入) → 17 tests fail
- `parseRestoreQuery`: 返回 hardcoded defaults → 8 tests fail
- `resolveSearchKeyAction`: 返回 'none' for Enter/Escape → 2 tests fail
- `createDebouncedSearch`: debounced 不调用 fn → 3 tests fail
- Round-trip: 依赖两个 stub → 5 tests fail (部分断言因 stub defaults 巧合通过)

**通过的 18 个测试**：
- `resolveSearchKeyAction` 的非 Enter/Esc 键测试：stub 返回 'none' = 预期 'none'
- `parseRestoreQuery` 的默认值边界测试：stub harcoded defaults 巧合命中
- `mergeQuery` 的空返回值边界：stub 返回 '' 巧合命中空字符串期望
- 真实 `useDebounce` composable 测试：使用已实现的 composable，正确通过

**门槛判定**：✅ 满足 — `assertion_failures=32 > 0 AND collection_errors=0`
