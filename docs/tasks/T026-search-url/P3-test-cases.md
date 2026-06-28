---
phase: P3
task_id: T026-search-url
type: test-cases
parent: P2-design.md
trace_id: T026-P3-20260628
status: draft
created: 2026-06-28
---

# P3 测试用例 — T026 search-url

## 测试策略

纯逻辑单元测试，不 mount 组件。测试文件：`frontend-v3/src/views/__tests__/searchUrl.logic.spec.ts`

测试 4 个纯函数 + 1 个防抖交互场景，覆盖 P1 的 12 条可纯逻辑测试的 BDD 条件。

BDD-10（空搜索结果 UI）、BDD-15（测试不退化）、BDD-16（类型检查）是集成/验证层关注点，不在纯逻辑测试范围 — 由 P5/P6 覆盖。

## 测试函数

| 函数 | 对应 P2 设计 | 类型 |
|------|-------------|------|
| `mergeQuery` | `updateURL()` 核心 | 纯字符串→字符串 |
| `parseRestoreQuery` | `restoreFromURL()` 核心 | 纯字符串→结构化对象 |
| `resolveSearchKeyAction` | `onSearchKeydown()` 核心 | 纯字符串→枚举 |
| 防抖交互 | `flushSearch` + `onSearchInput` | 定时器模拟 |

## 测试用例清单

---

### TC-01: mergeQuery — 添加 q 到空 query
- **BDD**: BDD-1 (基本搜索)
- **Given**: 当前 URL 无 query 参数
- **When**: 调用 `mergeQuery('', { q: 'python' })`
- **Then**: 返回 `q=python`

---

### TC-02: mergeQuery — 添加 q 到已有 owner 的 query
- **BDD**: BDD-5 (Tab + 搜索组合)
- **Given**: 当前 URL `?owner=me`
- **When**: 调用 `mergeQuery('owner=me', { q: 'test' })`
- **Then**: 返回 `owner=me&q=test`（保留 owner）

---

### TC-03: mergeQuery — 添加 owner 到已有 q 的 query
- **BDD**: BDD-4 (搜索 + Tab 组合)
- **Given**: 当前 URL `?q=python`
- **When**: 调用 `mergeQuery('q=python', { owner: 'me' })`
- **Then**: 返回 `q=python&owner=me`（保留 q）

---

### TC-04: mergeQuery — 移除 q 保留 owner
- **BDD**: BDD-6 (清空搜索保留 Tab)
- **Given**: 当前 URL `?q=test&owner=me`
- **When**: 调用 `mergeQuery('q=test&owner=me', { q: undefined })`
- **Then**: 返回 `owner=me`（移除 q，保留 owner）

---

### TC-05: mergeQuery — 移除 owner 保留 q
- **BDD**: BDD-4 反向 (All tab 保留搜索)
- **Given**: 当前 URL `?q=test&owner=me`
- **When**: 调用 `mergeQuery('q=test&owner=me', { owner: undefined })`
- **Then**: 返回 `q=test`（移除 owner，保留 q）

---

### TC-06: mergeQuery — 添加 page 参数
- **BDD**: BDD-7 (搜索 + 分页组合)
- **Given**: 当前 URL `?q=demo`
- **When**: 调用 `mergeQuery('q=demo', { page: '2' })`
- **Then**: 返回 `q=demo&page=2`

---

### TC-07: mergeQuery — page=1 省略
- **BDD**: BDD-12 (搜索词变化时 page 回到 1)
- **Given**: 当前 URL `?q=other`
- **When**: 调用 `mergeQuery('q=other', { page: '1' })`
- **Then**: 返回 `q=other`（page=1 不写入 URL）

---

### TC-08: mergeQuery — 搜索词变化时重置分页
- **BDD**: BDD-12
- **Given**: 当前 URL `?q=demo&page=3`
- **When**: 调用 `mergeQuery('q=demo&page=3', { q: 'other', page: undefined })`
- **Then**: 返回 `q=other`（page 被移除，回到 1）

---

### TC-09: mergeQuery — 空字符串值删除 key
- **BDD**: BDD-13 (空白查询清理)
- **Given**: 当前 URL `?q=python`
- **When**: 调用 `mergeQuery('q=python', { q: '' })`
- **Then**: 返回空字符串（q 被删除）

---

### TC-10: mergeQuery — undefined 值删除 key
- **BDD**: BDD-3 (Esc 清空搜索)
- **Given**: 当前 URL `?q=keyword`
- **When**: 调用 `mergeQuery('q=keyword', { q: undefined })`
- **Then**: 返回空字符串

---

### TC-11: mergeQuery — 同时更新多个参数
- **BDD**: BDD-14 (搜索 + owner + 分页三组合)
- **Given**: 当前 URL `?q=old&page=3`
- **When**: 调用 `mergeQuery('q=old&page=3', { q: 'code', owner: 'me', page: '2' })`
- **Then**: 返回包含 `q=code`, `owner=me`, `page=2` 的字符串

---

### TC-12: mergeQuery — 从空开始构建完整 query
- **BDD**: BDD-14
- **Given**: 当前 URL 无 query
- **When**: 调用 `mergeQuery('', { q: 'code', owner: 'me', page: '2' })`
- **Then**: 返回包含三个参数的 query string

---

### TC-13: mergeQuery — 空对象不改变 query
- **BDD**: 边界
- **Given**: 当前 URL `?q=python&owner=me`
- **When**: 调用 `mergeQuery('q=python&owner=me', {})`
- **Then**: 返回原 query string

---

### TC-14: mergeQuery — 特殊字符保留（URL 编码由 URLSearchParams 处理）
- **BDD**: 边界（FTS5 特殊字符）
- **Given**: 当前 URL 无 query
- **When**: 调用 `mergeQuery('', { q: 'hello world' })`
- **Then**: 返回 `q=hello+world`（空格编码为 +）

---

### TC-15: parseRestoreQuery — 恢复全部三个参数
- **BDD**: BDD-8 (直接访问带搜索 URL), BDD-14
- **Given**: URL `?q=keyword&page=2&owner=me`
- **When**: 调用 `parseRestoreQuery('q=keyword&page=2&owner=me')`
- **Then**: 返回 `{ q: 'keyword', owner: 'me', page: 2 }`

---

### TC-16: parseRestoreQuery — 只有 q 参数
- **BDD**: BDD-8
- **Given**: URL `?q=hello`
- **When**: 调用 `parseRestoreQuery('q=hello')`
- **Then**: 返回 `{ q: 'hello', owner: null, page: 1 }`

---

### TC-17: parseRestoreQuery — 只有 owner 参数
- **BDD**: Tab 还原
- **Given**: URL `?owner=me`
- **When**: 调用 `parseRestoreQuery('owner=me')`
- **Then**: 返回 `{ q: '', owner: 'me', page: 1 }`

---

### TC-18: parseRestoreQuery — 空 query string
- **BDD**: 边界
- **Given**: 空 URL query
- **When**: 调用 `parseRestoreQuery('')`
- **Then**: 返回 `{ q: '', owner: null, page: 1 }`

---

### TC-19: parseRestoreQuery — page 非数字回退
- **BDD**: 边界
- **Given**: URL `?page=abc`
- **When**: 调用 `parseRestoreQuery('page=abc')`
- **Then**: 返回 `{ q: '', owner: null, page: 1 }`（page 回退为 1）

---

### TC-20: parseRestoreQuery — page 负数回退
- **BDD**: 边界
- **Given**: URL `?page=-5`
- **When**: 调用 `parseRestoreQuery('page=-5')`
- **Then**: 返回 `{ q: '', owner: null, page: 1 }`（page clamp 到 1）

---

### TC-21: parseRestoreQuery — page=0 回退
- **BDD**: 边界
- **Given**: URL `?page=0`
- **When**: 调用 `parseRestoreQuery('page=0')`
- **Then**: 返回 page=1（0 不是合法页码）

---

### TC-22: parseRestoreQuery — q 为空字符串参数
- **BDD**: BDD-13 还原场景
- **Given**: URL `?q=`
- **When**: 调用 `parseRestoreQuery('q=')`
- **Then**: 返回 `{ q: '', ... }`（空 q 还原为空字符串）

---

### TC-23: parseRestoreQuery — 用户页搜索组合
- **BDD**: BDD-9 (搜索 + 用户页组合)
- **Given**: URL `?q=notes`（在 /users/alice 路由下，owner 来自 props）
- **When**: 调用 `parseRestoreQuery('q=notes')`
- **Then**: 返回 `{ q: 'notes', owner: null, page: 1 }`（owner 由 props.owner 提供，不在 query 中）

---

### TC-24: resolveSearchKeyAction — Enter 键
- **BDD**: BDD-2 (Enter 立即触发)
- **Given**: 键盘事件 `key: 'Enter'`
- **When**: 调用 `resolveSearchKeyAction('Enter')`
- **Then**: 返回 `'flush'`

---

### TC-25: resolveSearchKeyAction — Escape 键
- **BDD**: BDD-3 (Esc 清空搜索)
- **Given**: 键盘事件 `key: 'Escape'`
- **When**: 调用 `resolveSearchKeyAction('Escape')`
- **Then**: 返回 `'clear'`

---

### TC-26: resolveSearchKeyAction — 普通字符键
- **BDD**: BDD-1 (防抖输入)
- **Given**: 键盘事件 `key: 'a'`
- **When**: 调用 `resolveSearchKeyAction('a')`
- **Then**: 返回 `'none'`（走 @input + 防抖路径）

---

### TC-27: resolveSearchKeyAction — Backspace 键
- **BDD**: BDD-13 边界
- **Given**: 键盘事件 `key: 'Backspace'`
- **When**: 调用 `resolveSearchKeyAction('Backspace')`
- **Then**: 返回 `'none'`

---

### TC-28: resolveSearchKeyAction — Tab 键
- **BDD**: 边界（不应触发搜索）
- **Given**: 键盘事件 `key: 'Tab'`
- **When**: 调用 `resolveSearchKeyAction('Tab')`
- **Then**: 返回 `'none'`

---

### TC-29: 防抖 — 300ms 内连续输入只触发一次
- **BDD**: BDD-1 (防抖)
- **Given**: 防抖函数（300ms delay）被连续调用 3 次，间隔 50ms
- **When**: 快进 300ms
- **Then**: 原函数只被调用 1 次，参数为最后一次的值

---

### TC-30: 防抖 — Enter 立即触发取消防抖
- **BDD**: BDD-2 (Enter 立即触发)
- **Given**: 防抖函数已调度但未到期
- **When**: 手动 clearTimeout + 直接调用原函数
- **Then**: 原函数立即执行，之前的定时器被取消

---

### TC-31: 防抖 — 300ms 到期后正常触发
- **BDD**: BDD-1
- **Given**: 防抖函数被调用一次
- **When**: 快进 300ms
- **Then**: 原函数被调用 1 次

---

## BDD 覆盖矩阵

| BDD | 描述 | TC 编号 | 测试类型 |
|-----|------|---------|---------|
| BDD-1 | 基本搜索（防抖） | TC-01, TC-26, TC-29, TC-31 | 纯逻辑 |
| BDD-2 | Enter 立即触发 | TC-24, TC-30 | 纯逻辑 |
| BDD-3 | Esc 清空搜索 | TC-10, TC-25 | 纯逻辑 |
| BDD-4 | 搜索 + Tab 组合 | TC-03, TC-05 | 纯逻辑 |
| BDD-5 | Tab + 搜索组合 | TC-02 | 纯逻辑 |
| BDD-6 | 清空搜索保留 Tab | TC-04 | 纯逻辑 |
| BDD-7 | 搜索 + 分页组合 | TC-06 | 纯逻辑 |
| BDD-8 | 直接访问带搜索 URL | TC-15, TC-16 | 纯逻辑 |
| BDD-9 | 搜索 + 用户页组合 | TC-23 | 纯逻辑 |
| BDD-10 | 空搜索结果 | — | P6 E2E |
| BDD-11 | 浏览器后退 | — | P6 E2E |
| BDD-12 | 搜索词变化重置分页 | TC-07, TC-08 | 纯逻辑 |
| BDD-13 | 空白查询清理 | TC-09, TC-22, TC-27 | 纯逻辑 |
| BDD-14 | 三组合 | TC-11, TC-12, TC-15 | 纯逻辑 |
| BDD-15 | 测试不退化 | — | P5 验证 |
| BDD-16 | 类型检查通过 | — | P5 验证 |

统计：31 个测试用例，覆盖 12/16 条 BDD。
