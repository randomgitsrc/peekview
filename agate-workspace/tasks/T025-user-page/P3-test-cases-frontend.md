---
phase: P3
task_id: T025-user-page
type: test-cases
parent: P2-design.md
trace_id: T025-P3-FE-20260628
status: draft
created: 2026-06-28
---

# P3 前端测试用例 — T025 user-page

## BDD 覆盖映射

| BDD | 测试文件 | 用例数 |
|-----|---------|--------|
| FE-1 (banner) | BannerBar.spec.ts, EntryListView.logic.spec.ts | 5 + 7 |
| FE-2 (not found) | EntryListView.logic.spec.ts | 1 (v-if chain) |
| FE-3 (username click) | EntryListView.logic.spec.ts | 3 |
| FE-4 (own username) | EntryListView.logic.spec.ts | 1 |
| FE-5 (tab URL sync) | EntryListView.logic.spec.ts | 3 |
| FE-6 (URL restore) | EntryListView.logic.spec.ts | 2 |
| FE-7 (chip mode) | FilterChip.spec.ts, EntryListView.logic.spec.ts | 6 + 4 |
| FE-8 (typecheck+build) | gate — 不在此阶段 | 0 |
| FE-9 (no nested <a>) | gate — Playwright E2E | 0 |

---

## 1. API client: listEntries ownerFound passthrough

**文件**：`src/api/__tests__/client.spec.ts`

**覆盖 P2 设计节**：2.3

### TC-API-1: owner_found=true → ownerFound=true
- Given API 返回 `{ owner_found: true }`
- When 调用 `listEntries({ owner: 'alice' })`
- Then 返回对象的 `ownerFound === true`

### TC-API-2: owner_found=false → ownerFound=false
- Given API 返回 `{ owner_found: false }`
- When 调用 `listEntries({ owner: 'nonexistent' })`
- Then 返回对象的 `ownerFound === false`

### TC-API-3: owner_found 缺失 → ownerFound=null
- Given API 返回对象不含 `owner_found` 字段（普通 /explore 请求）
- When 调用 `listEntries()`
- Then 返回对象的 `ownerFound === null`

### TC-API-4: owner_found=null → ownerFound=null
- Given API 返回 `{ owner_found: null }`（owner="me" 场景）
- When 调用 `listEntries({ owner: 'me' })`
- Then 返回对象的 `ownerFound === null`

### TC-API-5: ownerFound 不影响 entry 列表转换
- Given API 返回 1 个 entry + `owner_found: true`
- When 调用 `listEntries({ owner: 'alice' })`
- Then entry 的 slug/username 正确转换，`ownerFound === true`

---

## 2. entry store: loadEntries ownerFound storage

**文件**：`src/stores/__tests__/entry.spec.ts`

**覆盖 P2 设计节**：2.3

### TC-STORE-1: 存储 ownerFound=true
- Given API mock 返回 `ownerFound: true`
- When `loadEntries({ owner: 'alice' })`
- Then store 的 `ownerFound` ref 值为 `true`

### TC-STORE-2: 存储 ownerFound=false
- Given API mock 返回 `ownerFound: false`
- When `loadEntries({ owner: 'nonexistent' })`
- Then store 的 `ownerFound` ref 值为 `false`

### TC-STORE-3: 存储 ownerFound=null（owner 未指定）
- Given API mock 返回 `ownerFound: null`
- When `loadEntries()`（无 owner 参数）
- Then store 的 `ownerFound` ref 值为 `null`

### TC-STORE-4: ownerFound=null（API 未传字段）
- Given API mock 返回对象不含 `ownerFound` 字段
- When `loadEntries()`
- Then store 的 `ownerFound` ref 值为 `null`

### TC-STORE-5: ownerFound 与 entries 共存
- Given API mock 返回 1 个 entry + `ownerFound: true`
- When `loadEntries({ owner: 'alice' })`
- Then store.entries 有 1 条且 ownerFound 为 true

---

## 3. EntryListView 计算属性逻辑

**文件**：`src/views/__tests__/EntryListView.logic.spec.ts`

**覆盖 P2 设计节**：2.5

### 3a. isBannerMode（7 用例）

| # | owner prop | ownerFound | 期望 |
|---|-----------|-----------|------|
| TC-LOGIC-1 | `"alice"` | `true` | `true` |
| TC-LOGIC-2 | `"alice"` | `null` | `true`（乐观显示 banner） |
| TC-LOGIC-3 | `"me"` | `null` | `false`（不显示 banner） |
| TC-LOGIC-4 | `"me"` | `true` | `false` |
| TC-LOGIC-5 | `"nonexistent"` | `false` | `false`（用户不存在） |
| TC-LOGIC-6 | `undefined` | `null` | `false`（explore 模式） |
| TC-LOGIC-7 | `""` | `null` | `false`（空字符串） |

### 3b. showTabs（4 用例）

| # | authState | isBannerMode | 期望 |
|---|-----------|-------------|------|
| TC-LOGIC-8 | `"authenticated"` | `false` | `true` |
| TC-LOGIC-9 | `"anonymous"` | `false` | `false` |
| TC-LOGIC-10 | `"loading"` | `false` | `false` |
| TC-LOGIC-11 | `"authenticated"` | `true` | `false` |

### 3c. showChip（5 用例）

| # | currentOwner | ownerProp | 期望 |
|---|-------------|----------|------|
| TC-LOGIC-12 | `"alice"` | `undefined` | `true` |
| TC-LOGIC-13 | `null` | `undefined` | `false` |
| TC-LOGIC-14 | `"me"` | `undefined` | `false` |
| TC-LOGIC-15 | `"alice"` | `"alice"` | `false`（banner 优先） |
| TC-LOGIC-16 | `"bob"` | `"alice"` | `false`（banner 优先） |

### 3d. effectiveOwner（4 用例）

| # | ownerProp | currentOwner | 期望 |
|---|----------|-------------|------|
| TC-LOGIC-17 | `"alice"` | `null` | `"alice"` |
| TC-LOGIC-18 | `undefined` | `"me"` | `"me"` |
| TC-LOGIC-19 | `undefined` | `null` | `undefined` |
| TC-LOGIC-20 | `"alice"` | `"bob"` | `"alice"`（prop 优先） |

---

## 4. v-if 链优先级

**文件**：`src/views/__tests__/EntryListView.logic.spec.ts`

**覆盖 P2 设计节**：2.5（v-if 链整合 M-1）

按 P2 设计优先级：loading → ownerFound=false → error → empty → grid

| # | 状态 | 期望结果 |
|---|------|---------|
| TC-VIF-1 | loading=true + 其他都 true | `"loading"` |
| TC-VIF-2 | loading=false + ownerFoundFalse=true + error=true | `"user-not-found"` |
| TC-VIF-3 | loading=false + ownerFoundFalse=false + error="..." | `"error"` |
| TC-VIF-4 | 全正常但 entries 为空 | `"empty"` |
| TC-VIF-5 | 全正常、有 entries | `"grid"` |

---

## 5. setOwner URL 同步

**文件**：`src/views/__tests__/EntryListView.logic.spec.ts`

**覆盖 P2 设计节**：2.10

| # | owner 参数 | 期望 router.replace 调用 |
|---|-----------|------------------------|
| TC-URL-1 | `"me"` | `{ path: '/explore', query: { owner: 'me' } }` |
| TC-URL-2 | `"alice"` | `{ path: '/explore', query: { owner: 'alice' } }` |
| TC-URL-3 | `null`（All） | `{ path: '/explore' }`（无 query） |

---

## 6. mount 协调

**文件**：`src/views/__tests__/EntryListView.logic.spec.ts`

**覆盖 P2 设计节**：2.5（mount/route change 协调）

| # | owner prop | 行为 |
|---|-----------|------|
| TC-MOUNT-1 | `"alice"` | 跳过 URL 恢复（prop 是权威） |
| TC-MOUNT-2 | `undefined` | 从 URL query 恢复 owner |

---

## 7. username 点击跳转

**文件**：`src/views/__tests__/EntryListView.logic.spec.ts`

**覆盖 P2 设计节**：2.9

| # | entry username | currentUserUsername | 期望跳转 |
|---|---------------|-------------------|---------|
| TC-UNAME-1 | `"alice"` | `null`（匿名） | `/users/alice` |
| TC-UNAME-2 | `"alice"` | `"bob"`（其他用户） | `/users/alice` |
| TC-UNAME-3 | `"alice"` | `"alice"`（自己） | `/explore?owner=me` |

---

## 8. FilterChip 组件（未来实现）

**文件**：`src/components/__tests__/FilterChip.spec.ts`

**覆盖 P2 设计节**：2.7

| # | 用例 | 验证点 |
|---|------|--------|
| TC-CHIP-1 | 渲染 label | `wrapper.text()` 含 label |
| TC-CHIP-2 | 渲染关闭按钮 | `button` 存在 |
| TC-CHIP-3 | emit dismiss | 点击 button → `emitted('dismiss')` |
| TC-CHIP-4 | 自定义 label | `@bob` 正确显示 |
| TC-CHIP-5 | 根元素 class | `.filter-chip` class 存在 |
| TC-CHIP-6 | aria-label | button 含 `aria-label` |

---

## 9. BannerBar 组件（未来实现）

**文件**：`src/components/__tests__/BannerBar.spec.ts`

**覆盖 P2 设计节**：2.8

| # | 用例 | 验证点 |
|---|------|--------|
| TC-BANNER-1 | 渲染 username | `wrapper.text()` 含 username |
| TC-BANNER-2 | Back to Home 链接 | `<a>` 标签存在，指向 /explore |
| TC-BANNER-3 | 标题含 username | 文本含 username |
| TC-BANNER-4 | @ 符号 | 文本匹配 `/@/` |
| TC-BANNER-5 | 不同 username | `charlie` 正确显示 |

---

## 10. 路由注册

**文件**：`src/__tests__/router.spec.ts`

**覆盖 P2 设计节**：2.4

| # | 用例 | 验证点 |
|---|------|--------|
| TC-ROUTE-1 | route 存在 | `name === 'user-entries'`, `path === '/users/:username'` |
| TC-ROUTE-2 | 匹配优先级 | `/users/alice` → user-entries（不是 detail） |
| TC-ROUTE-3 | slug 仍匹配 | `/some-entry-slug` → detail |
| TC-ROUTE-4 | explore 不变 | `/explore` → explore |
| TC-ROUTE-5 | params 传递 | `params.username === 'alice'` |

---

## 预期测试运行状态（TDD 红灯/绿灯）

| 测试 | 状态 | 原因 |
|------|------|------|
| client.spec.ts (5) | 🔴 红灯 | `listEntries` 尚未返回 `ownerFound` |
| entry.spec.ts (5) | 🔴 红灯 | store 尚无 `ownerFound` ref |
| EntryListView.logic.spec.ts (33) | 🟢 绿灯 | 纯逻辑函数测试，已自包含 |
| FilterChip.spec.ts (6) | 🟡 部分红灯 | 骨架组件存在但实现不完整 |
| BannerBar.spec.ts (5) | 🟡 部分红灯 | 骨架组件存在但实现不完整 |
| router.spec.ts (5) | 🔴 红灯 | router 尚无 `/users/:username` |

**总计：59 用例**

其中 33 逻辑用例预期绿灯（自包含纯函数），15 用例预期红灯（P4 实现后转绿），11 用例预期部分红灯（骨架→完整实现转绿）。
