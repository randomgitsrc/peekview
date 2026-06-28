---
phase: P6
task_id: T025-user-page
type: acceptance
parent: P1-requirements.md
trace_id: T025-P6-20260628
created: 2026-06-28
---

# P6 验收报告 — 用户公开页

## 概述

| 类别 | PASS | FAIL | [NEED_CONFIRM] | 总计 |
|------|------|------|----------------|------|
| 后端 (BE-1~9) | 9 | 0 | 0 | 9 |
| 前端 (FE-1~9) | 6 | 3 | 0 | 9 |
| **合计** | **15** | **3** | **0** | **18** |

**Gate 状态: 不通过** — 3 条 FAIL (FE-1, FE-2, FE-7)

---

## 后端 BDD

### BE-1: 通过 username 过滤 entry — PASS

**验证方法**: pytest 单元测试 `test_owner_username_returns_user_entries`

**证据**: 
```
tests/test_user_page.py::TestListEntriesByUsername::test_owner_username_returns_user_entries PASSED
```
- 创建 alice (3 entries) + bob (5 entries)，调用 `list_entries(owner="alice")`，返回 3 个 entry 全部属于 alice，total=3，owner_found=True。

---

### BE-2: 大小写不敏感 — PASS

**验证方法**: pytest 单元测试 `test_owner_username_case_insensitive`

**证据**:
```
tests/test_user_page.py::TestListEntriesByUsername::test_owner_username_case_insensitive PASSED
```
- `list_entries(owner="ALICE")` 返回与 `owner="alice"` 相同的 2 个 entry，owner_found=True。

---

### BE-3: 不存在的 username 返回空列表 — PASS

**验证方法**: pytest 单元测试 `test_owner_nonexistent_user_empty_list`

**证据**:
```
tests/test_user_page.py::TestListEntriesByUsername::test_owner_nonexistent_user_empty_list PASSED
```
- `list_entries(owner="nonexistent")` 返回 `items=[], total=0, owner_found=False`。

---

### BE-4: username 存在但用户无公开 entry — PASS

**验证方法**: pytest 单元测试 `test_owner_exists_but_no_visible_entries`

**证据**:
```
tests/test_user_page.py::TestListEntriesByUsername::test_owner_exists_but_no_visible_entries PASSED
```
- bob 只有 private entry，匿名调用 `list_entries(owner="bob")` 返回 `items=[], total=0, owner_found=True`。

---

### BE-5: owner="me" 行为不变（回归保护）— PASS

**验证方法**: pytest 单元测试 `test_owner_me_regression`

**证据**:
```
tests/test_user_page.py::TestListEntriesByUsername::test_owner_me_regression PASSED
```
- alice 调用 `list_entries(owner="me", current_user_id=alice_id)` 返回 2 个 entry（含私有），owner_found=None。

---

### BE-6: admin 查看用户页看到全部（含私有）— PASS

**验证方法**: pytest 单元测试 `test_owner_admin_sees_all`

**证据**:
```
tests/test_user_page.py::TestListEntriesByUsername::test_owner_admin_sees_all PASSED
```
- admin 调用 `list_entries(owner="alice", is_admin=True)` 返回 2 个 entry（含私有），owner_found=True。

---

### BE-7: 匿名用户查看用户页只看到公开 — PASS

**验证方法**: pytest 单元测试 `test_owner_anonymous_sees_public_only`

**证据**:
```
tests/test_user_page.py::TestListEntriesByUsername::test_owner_anonymous_sees_public_only PASSED
```
- 匿名调用 `list_entries(owner="alice")`，alice 有 1 public + 1 private，返回 1 个 entry，owner_found=True。

---

### BE-8: FTS 搜索与 owner filter 组合（结果非空）— PASS

**验证方法**: pytest 单元测试 `test_owner_with_fts_match`

**证据**:
```
tests/test_user_page.py::TestListEntriesByUsername::test_owner_with_fts_match PASSED
```
- `list_entries(owner="alice", q="python")` 返回 2 个 entry（alice 的 2 个 Python 相关 entry），忽略 bob 的 Python entry，owner_found=True。

---

### BE-9: FTS 搜索与 owner filter 组合（结果为空）— PASS

**验证方法**: pytest 单元测试 `test_owner_with_fts_no_match`

**证据**:
```
tests/test_user_page.py::TestListEntriesByUsername::test_owner_with_fts_no_match PASSED
```
- `list_entries(owner="alice", q="NoSuchKeyword")` 返回 `items=[], total=0, owner_found=True`。

---

## 前端 BDD

### FE-1: 用户页加载 + banner 显示 — FAIL

**验证方法**: Playwright E2E test #1 + manual verification

**实际行为**:
- Banner 正确显示: `@verify_xxx's entries` + "Back to Home" 链接 ✓
- All/Mine tab 不显示 ✓
- **Entry 列表为空**（显示 "No entries found"）— 应为 1 个 entry ✗

**Root cause** (`EntryListView.vue:390-401`):
`onMounted` 中 banner 模式（`props.owner` 存在）不调用 `loadEntries`。`watch(() => props.owner, ...)` 缺少 `immediate: true`，初始挂载时不触发。结果：store 保持初始状态（loading=false, entries=[], ownerFound=null），页面显示空状态。

**证据**:
- E2E test #1 (chromium + Mobile Chrome): `expect .entry-card toHaveCount 1` → Received 0
- Manual verification: Playwright 截图 `/tmp/e2e-results/t025-verify-fe1.png` — banner 可见，bodyHTML 包含 `<div class="empty">No entries found</div>`
- Backend API 正常：curl 确认 `owner=verify_xxx` 返回正确 entry

---

### FE-2: 不存在的 username 显示空状态 — FAIL

**验证方法**: Playwright E2E test #9 + manual verification

**实际行为**:
- `.user-not-found` div 不存在 — 应为 "User @xxx not found" ✗
- 页面显示泛用 "No entries found" ✗
- **Banner 错误显示**（应为不显示）✗

**Root cause**: 同 FE-1。`loadEntries` 未调用 → `ownerFound` 为 `null` → `isBannerMode` 条件中 `ownerFound.value !== false` 为 `true (null !== false)` → banner 错误显示。v-if 链 `ownerFound === false && props.owner` 为 false → 不渲染 `.user-not-found`。

**证据**:
- E2E test #9 (chromium + Mobile Chrome): `expect .user-not-found toBeVisible` → element not found
- Manual verification: Playwright 截图 `/tmp/e2e-results/t025-verify-fe2.png` — banner 可见，emptyState 显示 "No entries found"

---

### FE-3: 卡片 username 可点击跳转 — PASS

**验证方法**: Playwright manual verification

**证据**: Playwright 截图 `/tmp/e2e-results/t025-verify-fe3-fe7.png`
- `.username-link` href = `/users/{username}` ✓
- 点击 username link 导航至 `/users/{username}` ✓
- Card body 为 `<div role="link">` → 点击导航至 entry detail (`/{slug}`) ✓
- Card body 内 1 个 `<a>` (username link)，无嵌套 `<a>` 标签 ✓

> E2E test #5 因 debug DB 有 20 条残留数据失败（`expect .entry-card count 1` → Received 20）。实际行为经手动验证正确。

---

### FE-4: 已登录用户点自己 username 跳 /explore?owner=me — PASS

**验证方法**: Playwright manual verification

**证据**: Playwright 截图 `/tmp/e2e-results/t025-verify-fe3-fe7.png`
- 已登录用户 `me_xxx` 的 entry 卡片中，`.username-link` href = `/explore?owner=me` ✓
- link text = 当前用户 username ✓

> E2E test #6 同样因 DB 污染失败。实际行为经手动验证正确。

---

### FE-5: tab 切换 URL 同步（不污染历史栈）— PASS

**验证方法**: Playwright E2E test #7

**证据**: E2E test #7 PASS (chromium + Mobile Chrome)
- 初始 All tab active ✓
- 点击 Mine tab → URL 变为 `/explore?owner=me`，Mine tab active ✓
- 点击 All tab → URL 变为 `/explore`，All tab active ✓

---

### FE-6: 通过 URL 直接访问 tab 状态 — PASS

**验证方法**: Playwright E2E test #8

**证据**: E2E test #8 PASS (chromium + Mobile Chrome)
- 直接访问 `/explore?owner=me` → Mine tab 高亮 (`.owner-tab.active` contains "Mine") ✓
- All tab 不高亮 ✓

---

### FE-7: 通过 URL filter 用户（chip + tab 非激活 + dismiss）— FAIL

**验证方法**: Playwright E2E test #3 + #4 + manual verification

**证据**: E2E test #4 PASS (chip dismiss 正确); E2E test #3 FAIL; Playwright 截图 `/tmp/e2e-results/t025-verify-fe3-fe7.png`

**通过的部分**:
- Chip `@username ×` 可见且内容正确 ✓
- 无 banner ✓
- Tabs 存在 ✓
- Dismiss chip → filter 清除，URL 回到 `/explore`，列表恢复完整 ✓

**失败的部分**:
- All tab 处于 **active** 状态（class="owner-tab active"）— BDD 要求两者均**非激活** ✗

**Root cause** (`EntryListView.vue:34`):
```html
:class="{ active: currentOwner !== 'me' }"
```
当 `currentOwner = "alice"`（chip 模式），`"alice" !== "me"` 为 `true`，All tab 错误激活。应改为区分 chip 模式和 explore 模式。

---

### FE-8: 构建+类型检查通过 — PASS

**验证方法**: CLI 命令

**证据**:
```
$ npx vue-tsc --noEmit
(no output — 0 errors)

$ npm run build
✓ built in 10.64s
```

---

### FE-9: 嵌套 router-link 不存在（HTML 合法性）— PASS

**验证方法**: Playwright DOM 查询

**证据**: Playwright evaluate 结果
- Card body 外层为 `<div>` (outerTag = "DIV")
- `.card-body a` 数量 = 20 (每个 card 1 个 username `<router-link>`)
- `a a` (嵌套 `<a>` 标签) 数量 = 0
- Card body 属性: `role="link" tabindex="0"` ✓

---

## 失败项汇总

| BDD | 失败点 | 根因 | 修复建议 |
|-----|--------|------|---------|
| FE-1 | User page shows "No entries found" | `onMounted` 不调用 `loadEntries` 在 banner 模式 | 加 `immediate: true` 到 `watch(() => props.owner, ...)` 或在 `onMounted` 中 conditionally 调用 |
| FE-2 | "User not found" 不渲染；banner 错误显示 | 同上 + `isBannerMode` 对 `ownerFound=null` 判断不正确 | 同上修复即可连带解决 |
| FE-7 | All tab active during chip filter | tab `active` class 逻辑未区分 chip 模式 | `All tab active` 条件从 `currentOwner !== 'me'` 改为 `currentOwner === null`（无 filter 时激活） |

## 截图索引

| 图片 | 路径 | 对应 BDD |
|------|------|---------|
| FE-1 故障截图 | `/tmp/e2e-results/t025-verify-fe1.png` | FE-1 (banner + "No entries found") |
| FE-2 故障截图 | `/tmp/e2e-results/t025-verify-fe2.png` | FE-2 (banner + "No entries found" for nonexistent user) |
| FE-3/FE-7 验证截图 | `/tmp/e2e-results/t025-verify-fe3-fe7.png` | FE-3 (username link), FE-7 (chip + active All tab) |

---

## Gate 判定

**P6 gate: 不通过** — 3 条 FAIL (FE-1, FE-2, FE-7)

需要回 P4 修复 `onMounted` 的 `loadEntries` 调用时机和 tab active 状态逻辑，修复后重新跑 E2E 验收。
