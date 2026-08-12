---
phase: P2
task_id: T026-search-url
type: review
parent: P1-requirements.md
reviewer: plan-design-review
trace_id: T026-P2R-d-20260628
status: needs-revision
created: 2026-06-28
---

# P2 设计评审 — T026 search-url

## 评分

| 维度 | 得分 | 说明 |
|------|------|------|
| 交互状态覆盖率 | 7/10 | Loading/empty/clear 大部分覆盖，但 error 状态和 X 按钮缺失 BDD |
| AI Slop 风险 | 3/10 | 风险低。spec 非常具体，决策有据，实现自由度小 |
| 移动端考虑 | 4/10 | 提及全宽需求但无 BDD、无触屏交互、无 viewport 测试 |
| 可访问性 | 2/10 | 几乎完全缺失：无 label、aria、role、focus management、screen reader |

**总评：needs-revision** — 核心功能基线扎实（16 条 BDD，URL 参数组合覆盖完整），但 a11y 完全缺失是 UI 交互任务的显著缺口。以下列出必须补充和强烈建议补充的项目。

---

## 一、BLOCKER（必须补充）

无。当前 spec 具备可实施性，不阻塞进入 P2 设计/P3 测试/P4 实现。

---

## 二、需补充项（计入 needs-revision 重试）

### R1. 无障碍（a11y）基线 — 严重缺失

搜索输入框是 UI 交互组件的核心，当前 spec 对所有无障碍维度均未提及：

| 缺失项 | 最低要求 | 优先级 |
|--------|----------|--------|
| `<label>` 或 `aria-label` | `<input type="search" aria-label="Search entries">` — 屏幕阅读器需要知道这个输入框的用途。placeholder 不替代 label | 必须 |
| `role="search"` | 搜索表单容器应有 `role="search"` landmark，方便屏幕阅读器快速跳转 | 必须 |
| 搜索结果通知 | 搜索完成后应通过 `aria-live="polite"` 区域通知结果数量（"N entries found" / "No entries found"），否则屏幕阅读器用户不知道搜索是否完成 | 强烈建议 |
| 清除后焦点管理 | BDD-3 规定 Esc 后 blur，但未指定焦点去向。焦点落到 `<body>` 会导致键盘用户迷失。应 focus 到搜索框本身（便于重新输入）或 tab 列表 | 强烈建议 |
| `aria-busy` | 搜索 loading 期间输入框所在区域应设 `aria-busy="true"` | 建议 |

**建议**：在 P1 需求基线中新增 "### 无障碍层" 小节，或在 BDD 中新增 2 条 a11y 验收条件（label 存在 + 搜索完成通知）。

### R2. X 清除按钮缺少 BDD

§2 前端层 line 43 描述了 X 清除按钮行为（"点击行为和 Esc 一致——清空输入 + 移除 URL `?q=` + blur"），但无对应的 BDD 验收条件。Esc 有 BDD-3 覆盖，X 按钮没有——两者行为一致但不代表实装后一致。

**建议**：新增 BDD：
> **BDD-X**: Given 用户在 `/explore?q=keyword` 页面，搜索框显示 "keyword"
> When 用户点击搜索框内的 X 清除按钮
> Then 搜索框清空，URL 变为 `/explore`，搜索框失去焦点

### R3. Loading 指示器缺少 BDD

§2 前端层 line 46 提及"输入框旁应有 loading 指示器"，但无 BDD 验证。当前 store `loading` 状态在 `loadEntries` 期间为 `true`，模板已有 `<div v-if="loading" class="loading">Loading...</div>`——但 P1 说"输入框旁"而非全局 loading div。这是 UI 细节差异，需要在 P2 设计时明确。

**建议**：在现有 BDD 中追加 loading 状态验证（如 BDD-1 在 300ms 触发后到响应返回前，loading 指示器应可见），或在 P2 设计中明确是复用全局 loading div 还是新增输入框旁的 inline loading。

### R4. API 错误状态处理未定义

当前 spec 未描述搜索 API 调用失败时的行为：
- 搜索框内容是否保留？
- URL `?q=` 是否保留？
- 错误信息如何展示？（现有全局 `<div v-if="error" class="error">{{ error }}</div>` 可用，但 spec 未提及）
- 用户如何重试？（重新输入触发防抖？手动点击？）

**建议**：在 §2 前端层中补充错误状态描述，或标注"复用现有 error 展示，无特殊处理"。

### R5. URL 边界值处理缺失

以下 URL 直接访问的边界情况未在 BDD 或隐含需求中覆盖：

| 边界情况 | 示例 | 建议行为 |
|----------|------|----------|
| `page` 非法值 | `/explore?q=foo&page=-1` | 后端返回 page=1（已有后端校验）— 标注依赖后端即可 |
| `page` 非数字 | `/explore?q=foo&page=abc` | 同上 |
| 空 `q` 参数 | `/explore?q=` | 视为无搜索，不显示搜索结果 |
| 超长 `q` | `/explore?q=<10000 chars>` | 后端 `max_summary_length=500` 限制 API 参数？不考虑。标注浏览器 URL 长度自然截断 |

**建议**：在 §2 边界层标注这些 case 的处理策略（"依赖后端校验"/"视为无搜索"），不必须新增 BDD。

### R6. `/users/:username?q=` 路由的 restoreFromURL 缺口

当前代码（EntryListView.vue:390-403）在 `props.owner` 存在时跳过 `restoreFromURL()`，但 BDD-9 要求 `/users/alice?q=notes` 正常工作。这意味着 P4 实现时必须补这个缺口——P1 已识别这一隐含需求（§2 line 34-35："当前 `restoreFromURL()` 只读 `owner`，需扩展为同时读 `q`"），但 `onMounted` 分支逻辑也需调整。

**建议**：在 §2 前端层明确标注 `onMounted` 中 `props.owner` 分支也需调用 `restoreFromURL()` 读取 `q`（或等效逻辑）。

---

## 三、已验证通过项（确认无误）

以下维度评审通过，无需修改：

### 3.1 URL 参数组合完整性 — PASS

16 条 BDD 覆盖了所有关键组合：
- `q` 单独 (BDD-1, BDD-8)
- `q` + `owner` 两种顺序 (BDD-4, BDD-5)
- `q` + `page` (BDD-7)
- `q` + `owner` + `page` (BDD-14)
- 清空搜索保留 owner (BDD-6)
- 搜索词变化重置分页 (BDD-12)
- 空输入移除 q (BDD-13)
- 用户页 + q (BDD-9)

参数合并逻辑在隐含需求识别中描述准确（§2 line 35-38）：当前 `setOwner()` 用 `router.replace({ query: { owner } })` 完全替换 query 会丢 `q`，必须改为合并模式。`clearOwnerFilter()` 同理。

### 3.2 键盘交互 — PASS（基本）

- Enter 立即触发：BDD-2 覆盖
- Esc 清空：BDD-3 覆盖
- 防抖 300ms vs Enter 立即：§2 line 39-40 明确了双路径（防抖路径和立即路径），设计清晰

Tab 键导航顺序未描述，但在 P2 设计阶段补充即可（对 P1 需求基线不是硬要求）。

### 3.3 浏览器导航 — PASS

BDD-11 正确验证了 `router.replace` 语义下的后退行为：搜索 → replace → push 到详情 → back 回到搜索状态而非 landing。P0 和 P1 一致使用 `router.replace`，历史栈不污染。

### 3.4 范围裁剪 — PASS

- P7/P8 裁剪理由合理：单文件改动（EntryListView.vue），无需跨文件一致性检查；前端无独立发布单元
- P3 保留理由合理：URL 合并逻辑（`buildQuery` / `mergeQuery` 纯函数）适合单元测试
- "不做"清单明确：搜索历史/建议/高亮/独立路由/语法暴露

### 3.5 与现有代码的兼容性 — PASS

- T025 BannerBar 在 content 区，search input 在 header 区，物理不冲突
- CSP 兼容：`<input type="search">` 不引入内联事件
- 现有 `loading`/`error`/`empty` 状态展示可复用
- 后端 FTS5 已有 try/except 兜底

### 3.6 能力需求 — PASS

- Playwright（P6 BDD 实跑）：`make debug-test` 可用
- vitest（P3 纯逻辑测试）：已安装
- vue-tsc（P5 类型检查）：已安装

---

## 四、P2 设计阶段建议关注点

以下不属于 P1 需求基线缺陷，但在 P2 方案设计时应解决：

1. **`restoreFromURL` 调用时机统一**：当前 `onMounted` 中 `props.owner` 分支（user page）跳过 `restoreFromURL()`，但 P1 要求 user page 也读 `q`。P2 设计需决策：是统一调用 `restoreFromURL` 还是新增 `restoreSearchFromURL` 单独处理 `q`。

2. **`currentPage` watcher 与 URL 同步**：P1 识别了分页未写入 URL 的隐含缺口（§2 line 38）。P2 需设计：是让 `currentPage` watcher 同时写 URL，还是新增 `navigateToPage` 函数统一入口。

3. **防抖实现方式**：`setTimeout` + `clearTimeout`（组件本地） vs `useDebounceFn`（VueUse）vs 自定义 composable。当前项目未引入 VueUse，倾向简易实现。

4. **search input 在 header 中的布局**：当前 header 是 `justify-content: space-between`，左侧 logo，右侧 header-actions。search input 放在何处？（居中？logo 右侧？）P2 需明确。

5. **`ownerFound` 状态与搜索空结果的交互**：当前模板 line 57-62 根据 `ownerFound` 决定显示 "No entries from @..." 还是 "No entries found"。当 `q` 存在且 `props.owner` 存在时（如 `/users/alice?q=nonexistent`），`ownerFound` 可能为 `true`（alice 存在），但搜索结果为空——此时显示 "No entries from @alice" 而非 "No entries found"，语义不准确。BDD-10 仅覆盖了 `/explore` 路由，未覆盖 `/users/:username` 路由下的空搜索。

---

## 评审结论

P1 需求基线在核心功能维度（URL 参数组合、键盘触发、浏览器导航、范围裁剪）上质量高，16 条 BDD 覆盖了关键交互路径。

**打回理由**：a11y 完全缺失（6 个维度中得分 2/10）是 UI 交互任务的结构性缺口。R1（无障碍基线）和 R2（X 按钮 BDD）是本次必须补充的项目；R3-R6 是强烈建议补充但可在 P2 设计阶段消化。

**重试路径**：
1. P1 需求基线中新增 a11y 小节（label/aria/role/focus management），新增 1-2 条 a11y BDD
2. 新增 X 清除按钮 BDD
3. R3-R6 可在 P1 中追加或标注为"P2 设计时解决"
4. 更新后重新提交 plan-design-review
