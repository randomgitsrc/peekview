---
phase: P2
task_id: T060-archived-visibility-auth-refresh
type: review
parent: P2-design.md
trace_id: T060-P2-review-20260721
status: approved
created: 2026-07-21
agent: plan-design-review
---

# P2 Design Review (Round 2): Archived 条目可见性策略 + 登录退出内容刷新

## 修改项逐项确认

| Review # | 严重度 | 原问题 | 修订位置 | 处理结果 | 判定 |
|----------|--------|--------|----------|----------|------|
| 1 | HIGH | 重载请求竞态未处理 | §2.8 | 新增请求序列号去重方案（`loadSeq` 递增，陈旧响应丢弃），选择理由充分（比 AbortController 改动范围小，比 debounce 更精确），实现代码完整 | ✅ 已处理 |
| 2 | HIGH | 重载失败 fallback 未定义 | §2.9 | 新增 `clearOnError` 选项：退出/过期传 false 保留旧数据+error+retry，登录默认 true 清空+error。分层策略合理 | ⚠️ 已处理，有语法错误（见下） |
| 3 | MEDIUM | 初始化 loading→authenticated 误触发 | §2.3 | `oldState !== 'authenticated'` guard 排除 loading→authenticated；`oldState === 'authenticated'` guard 排除 loading→anonymous。同步时序假设已声明（`auth.ts:48-51` logout 同步） | ✅ 已处理 |
| 4 | MEDIUM | Auth 转换后无 a11y 通知 | §2.11 | 新增 `aria-live="polite"` 区域播报 auth 转换通知，与搜索 `aria-live` 分离，`aria-atomic="true"`，消息简洁 | ✅ 已处理 |
| 5 | MEDIUM | 移动端延迟和闪烁未考虑 | §2.10 | 声明移动端不在本次范围，记录 3 项已知影响供后续参考。范围声明合理：核心改动不涉及新 UI 组件或布局 | ✅ 已处理 |
| 6 | LOW | watcher flush 模式未声明 | §2.3 | 显式声明 `flush: 'pre', immediate: false`，并说明 pre-flush 保证 watcher 在 DOM 更新前触发、reactive state 已更新 | ✅ 已处理 |
| 7 | LOW | Archived tab 重置后焦点管理 | §2.11 | `nextTick` 后 `focus()` All tab 按钮，使用 `document.querySelector<HTMLButtonElement>('.owner-tab')` | ✅ 已处理 |

### §2.9 语法错误

§2.9 中 watcher 伪代码存在语法错误：

```typescript
loadEntries({...}).catch: false,  // 新参数：auth 转换重载失败时不清空 entries
```

这不是合法 TypeScript/JavaScript 语法。正确写法应为通过 `options` 第二参数传递：

```typescript
loadEntries({...}, { clearOnError: false })
```

后面的 `entry.ts` 代码段（`loadEntries` 函数签名和 catch 分支）写法是正确的，此处仅为 watcher 伪代码的笔误。P4 implementer 不太可能误解（因为函数签名定义清晰），但建议修正以避免歧义。

**严重度**：LOW（伪代码笔误，不影响设计意图理解）

## 修订引入的新问题检查

### 1. 序列号方案的边界情况（§2.8）

`loadSeq` 在 store 模块作用域内递增，不会溢出（JavaScript Number 安全整数上限 2^53）。无问题。

**陈旧响应的 error 丢弃**：`if (seq !== loadSeq) return` 在 catch 中也执行，意味着陈旧请求的错误不会覆盖 `error.value`。这是正确行为——只关心最新请求的错误。

**loading 状态一致性**：finally 中 `if (seq === loadSeq) loading.value = false`，陈旧请求不会重置 loading。正确。

**无新问题。**

### 2. clearOnError 选项的安全边界（§2.9）

退出/auth 过期重载失败时保留旧数据（可能含 private 条目）。设计已声明"网络断开时无法避免"。这是合理的权衡——清空后用户看到空白页更差，且 private 条目仅在本地浏览器内存中，非通过网络暴露。

**一个潜在问题**：若 auth 过期后网络恢复，旧数据（含 private 条目）会一直显示直到用户手动操作触发 loadEntries。设计未声明是否需要自动重试机制。

**判定**：LOW。当前设计的 retry 按钮已覆盖主动重试场景。自动重试增加复杂度，不在本次必要范围内。

### 3. a11y 通知的触发时序（§2.11）

`authChangeAnnouncement` watcher 与 authState 重载 watcher 是两个独立 watcher。两者都在同一 authState 变化时触发。Vue 同一 flush 阶段的多个 watcher 按创建顺序执行。

**潜在问题**：若 a11y 通知 watcher 先于重载 watcher 执行，屏幕阅读器播报"Signed out. List refreshed."时列表尚未刷新。但实际上 `aria-live="polite"` 的播报是异步的（由屏幕阅读器自行调度），且"refreshed"指的是"触发刷新"而非"刷新完成"，语义可接受。

**无实质问题。**

### 4. 焦点管理的 DOM 查询（§2.11）

`document.querySelector<HTMLButtonElement>('.owner-tab')` 依赖 CSS class 名。若 P4 实现时 class 名变更则 focus 失败（静默失败，不报错）。

**判定**：LOW。设计文档已标明查询目标，P4 implementer 可根据实际 DOM 调整。建议 P4 实现时考虑使用 `ref` 替代 class 查询，但这不阻碍 P2 通过。

### 5. handleLogout 中 currentStatus 重置时序（§2.4）

设计声明 `currentStatus` 重置在 `authStore.logout()` 之前执行。验证当前代码（`EntryListView.vue:379-384`）：

```typescript
function handleLogout() {
  showUserMenu.value = false
  authStore.logout()       // 同步设 user=null → authState→anonymous
  entryStore.filterPrivateEntries()
  toast.show('Logged out', 'success')
}
```

修改后：
```typescript
function handleLogout() {
  showUserMenu.value = false
  if (currentStatus.value === 'archived') {
    currentStatus.value = null    // 在 logout 之前
  }
  authStore.logout()              // 触发 watcher
  toast.show('Logged out', 'success')
}
```

`currentStatus` 重置在 `authStore.logout()` 之前，watcher 在 pre-flush 阶段执行时读到已重置的 `currentStatus`。时序正确。

**验证**：`authStore.logout()` 是同步的（`auth.ts:48-51`：`api.logout(); user.value = null`）。`user.value = null` 触发 `authState` computed 重新计算为 `'anonymous'`。Vue 的 pre-flush watcher 在当前同步代码执行完毕后的微任务阶段触发。因此 handleLogout 中 `authStore.logout()` 后的 `toast.show()` 会先执行，然后 watcher 执行。此时 `currentStatus` 已重置，`effectiveStatus` 也已更新。**时序正确。**

### 6. §2.3 watcher 搜索词保留

修订后设计在 §2.3 关键设计决策 #3 中明确声明搜索词保留，并解释搜索结果集因权限变化而不同是预期行为。覆盖了第一轮 Review #1 第 5 点"搜索状态与 auth 转换交互"。

**无问题。**

## 评分总览

| 维度 | 上轮 | 本轮 | 说明 |
|------|------|------|------|
| 交互状态覆盖率 | 7/10 | 9/10 | 竞态去重（§2.8）+ 失败 fallback（§2.9）+ 初始化 guard（§2.3）补齐，仅剩 clearOnError 保留旧数据时的自动重试未涉及（LOW，非必要） |
| AI Slop 风险 | 8/10 | 9/10 | filterPrivateEntries 明确删除（非 @deprecated），watcher 配置显式声明，status 校验位置明确唯一校验点。§2.9 伪代码笔误（LOW） |
| 移动端考虑 | 4/10 | 6/10 | §2.10 声明范围外 + 记录 3 项已知影响，范围声明合理但分数受限于"不在范围"本身 |
| 可访问性 | 5/10 | 8/10 | §2.11 覆盖 auth 转换通知（aria-live）+ 焦点管理（nextTick+focus）+ loading role=status，tab ARIA role 已声明非本次范围 |

## 结论

7 项修改意见全部已处理。修订引入 1 个 LOW 级伪代码笔误（§2.9 `.catch: false`），不影响设计意图。无 CRITICAL 或 HIGH 级新问题。

**status: approved**

### 建议（非阻塞）

1. 修正 §2.9 watcher 伪代码中的 `.catch: false` 为 `{ clearOnError: false }` 第二参数写法
2. P4 实现时考虑用 `ref` 替代 `.owner-tab` class 查询做焦点管理
