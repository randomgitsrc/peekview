---
phase: P2
task_id: T025-user-page
type: review
parent: P2-design.md
trace_id: T025-P2-review-design-2-20260628
status: approved
created: 2026-06-28
revision: 2
---

# P2 设计评审（第二轮：HIGH 问题复检）

## 复检目标

验证上轮汇总 `P2-review.md` 中 3 个 HIGH 问题是否已在修订版 `P2-design.md` 中修正。

## HIGH 问题复检

### H-1: BannerBar 与 ownerFound=false 的 UI 矛盾 — ✅ 已修正

| 项目 | 状态 |
|------|------|
| 问题 | `/users/nonexistent` 时 `isBannerMode` 为 `true`，banner 显示 "@nonexistent's entries" 同时下方显示 "User @nonexistent not found" |
| 修正 | `isBannerMode` computed 加入 `ownerFound.value !== false` 条件（§2.5 第 271 行） |
| 组合场景表 | `/users/nonexistent` 行明确标记 Banner: **否**（§2.11 第 659 行） |
| BDD 对齐 | BDD-FE-2 覆盖「不存在的 username → 不显示 banner」（§2.8 第 601 行） |

**判定**：✅ 矛盾已消除。`ownerFound=false` 时 banner 不再渲染，与 user-not-found 提示不再并存。

**微建议**（非阻塞）：`ownerFound` 初始值为 `null`，在 `/users/alice` 首次加载时 `isBannerMode` 为 `true`（`null !== false`），banner 会在 API 返回前短暂显示。若用户不存在，banner 闪烁后消失。属异步加载固有行为，不阻塞。

---

### H-2: 可访问性退化 — ✅ 已修正

| 项目 | 状态 |
|------|------|
| 问题 | 卡片外层 `<div @click>` 替代 `<router-link>` 丢失原生 `<a>` 行为（Tab/Enter/Space/屏幕阅读器/状态栏 URL） |
| 修正 | 外层 `<div>` 添加 `role="link"` + `tabindex="0"` + `@keydown.enter.prevent` + `@keydown.space.prevent`（§2.6 第 416-421 行） |
| 措施表 | 4 项可访问性措施逐一说明作用（§2.6 第 453-459 行） |
| 嵌套检查 | username 区域 `<span @click.stop>` + 内部 `<router-link>` 保证无 `<a>` 嵌套（§2.6 第 463-464 行） |

**判定**：✅ 键盘导航、屏幕阅读器语义均已补充。`div[role="link"]` 是成熟模式，Chrome/Firefox 验证支持。

**已知限制**（非阻塞）：`div` 无 `href`，用户无法右键「在新标签页打开」卡片整体、状态栏不显示目标 URL。这是嵌套可点击区域的架构权衡，username 子链接保留了完整的 `<a>` 行为。

---

### H-3: authState race condition — ✅ 已修正

| 项目 | 状态 |
|------|------|
| 问题 | 直接访问 `/explore?owner=me` 时 `onMounted` 早于 `fetchMe()` 完成，`authState` 为 `'loading'`，Mine tab 恢复静默失败 |
| 修正 | 新增 `watch(authState, ...)` 在变为 `'authenticated'` 时检查 URL `?owner=me`（§2.5 第 312-322 行） |
| 协调逻辑 | `restoreFromURL` 只在 `authState === 'authenticated'` 时才设置 `currentOwner = 'me'`（§2.5 第 331 行） |
| 防重复 | watch 内检查 `currentOwner.value !== 'me'` 避免重复加载（§2.5 第 317 行） |
| 上下文隔离 | watch 受 `!props.owner` 保护，不影响 banner 模式（§2.5 第 313 行） |

**判定**：✅ race condition 已覆盖。`onMounted` → `restoreFromURL`（auth 未 ready 时跳过 'me'）→ `watch(authState)`（auth ready 后补检 URL）形成完整闭环。

---

## 评分（0-10）

| 维度 | 分数 | 说明 |
|------|------|------|
| 交互状态覆盖率 | 9 | loading/error/empty/user-not-found/auth-race 均已覆盖。banner 加载闪烁属异步固有行为。 |
| AI Slop 风险 | 10 | 无「随便搞」空间。具体代码片段、CSS 值、数据结构一览到位。 |
| 移动端考虑 | 9 | BannerBar 双断点（480px/360px）具体化。卡片列表复用现有响应式。FilterChip flex-wrap 自然换行。 |
| 可访问性 | 9 | 核心问题已解决。div-as-link 模式的右键新标签页限制属架构权衡。 |

**总分**：37/40

## 结论

3 个 HIGH 问题全部修正，BLOCKER（BLK-1/2）和 MEDIUM（M-1~M-7）亦在修订版中完整解决。设计可进入 P4 实现阶段。

**Status**: `approved`
