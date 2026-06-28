---
phase: P1
task_id: T026-search-url
type: requirements
parent: P0-brief.md
trace_id: T026-P1-20260628
status: draft
created: 2026-06-28
---

# P1 需求基线 — T026 search-url

## 1. 需求复述

**一句话**：在 EntryListView 的 header 区域加搜索输入框，输入关键词后通过 URL query 参数 `?q=keyword` 驱动列表搜索，搜索结果可分享/可书签/可链接，与现有 `?owner=` tab 筛选共存。

**结构化表述**：
- **搜索入口**：EntryListView header 加 `<input type="search">` 搜索框
- **搜索后端**：复用已有 FTS5 全文搜索（`GET /api/v1/entries?q=keyword`），前后端 API 均已就绪，仅缺前端 UI 和 URL 同步逻辑
- **URL 形态**：`/explore?q=keyword`（不开独立 `/search` 路由）
- **组合搜索**：`q` 与 `owner` 可组合（`/explore?q=keyword&owner=me`），`q` 与用户页可组合（`/users/alice?q=keyword`），`q` 与分页可组合（`/explore?q=foo&page=2`）
- **交互体验**：防抖 300ms 自动搜索；Enter 立即触发；Esc 清空输入框和 URL
- **不做**：搜索历史、搜索建议、搜索热词、搜索结果高亮、独立 `/search` 路由、搜索语法暴露

## 2. 隐含需求识别

逐维度扫描：

### 数据层
- **存量数据**：无需迁移。搜索过滤发生在查询层（FTS5 MATCH），不改变 entry 数据。
- **无**。

### 前端层（核心变动域）
- **URL 同步双向绑定**：搜索输入框必须同时支持"输入→URL 更新"和"URL→输入框回填"两个方向。当前 `restoreFromURL()` 只读 `owner`，需扩展为同时读 `q`。
- **query 参数共存与保留**：当前 `setOwner()` 用 `router.replace({ query: { owner } })` **完全替换** query，会丢掉已有的 `q` 参数。必须改为 **合并** 模式（保留不相关的 query 参数）。
- **同理**：`clearOwnerFilter()` 替换 query 为 `{}`，也会丢掉 `q`。
- **同理**：搜索操作写 `?q=` 时也要保留已有的 `?owner=`。
- **分页 URL 同步**：当前 `currentPage` watcher 直接调用 `loadEntries` 不更新 URL。搜索 + 分页组合要求 `?page=` 出现在 URL 中（否则 `/explore?q=foo&page=2` 无法实现）。需要确认：分页是否也应同步到 URL？P0-brief 明确写了验收条件"分页与搜索组合：`/explore?q=foo&page=2` 正确加载第 2 页"，所以分页也必须写入 URL。这是当前代码的 **隐含缺口**——EntryListView 的 pagination 从未写入过 URL。
- **防抖与 URL 更新分离**：防抖只延迟 API 调用（`loadEntries`），URL 更新和防抖的关系需要明确定义。P0 说"防抖 300ms 同步 ?q="——URL 更新本身也是防抖的。但 Enter 应立即更新 URL。这需要两个路径：防抖路径（自动）和立即路径（Enter）。
- **输入状态管理**：需要一个 `searchQuery` ref 跟踪输入框当前值。该值需要从 URL `q` 初始化（mount/route change），并在用户输入时驱动 URL 更新。但要注意：用户在输入时（未触发防抖），输入框显示的是打字中间态，URL 还没变——这是正确的行为（URL 只在防抖/Enter 后才更新）。
- **Esc 清空行为**：Esc 不仅要清空输入框，还要从 URL 移除 `?q=`。清空后焦点应从输入框移除（blur），否则用户继续打字会重新触发搜索。
- **空查询/空白查询处理**：用户输入纯空格 → trim 后为空 → 不应添加 `?q=` 到 URL；如果 URL 已有 `?q=`，应移除。前端应 trim 搜索词。
- **搜索框清除按钮**：搜索框应有 X 清除按钮（HTML `<input type="search">` 自带或自定义），点击行为和 Esc 一致——清空输入 + 移除 URL `?q=` + blur。
- **Placeholder 文案**：搜索框应显示 placeholder 如 "Search entries..."。
- **mount/路由变化时还原**：用户直接访问 `/explore?q=keyword` → mount 时 `restoreFromURL()` 应把 `keyword` 填入输入框并触发搜索。
- **搜索 loading 状态**：防抖 300ms 期间用户看到输入框值变化，但列表尚未更新。输入框旁应有 loading 指示器（复用现有 `loading` 状态即可，store 的 `loadEntries` 已经设置 `loading.value = true`）。
- **tab 切换保留搜索词**：当前在搜索状态（`?q=keyword`），点击 Mine tab → URL 应变为 `?q=keyword&owner=me`，输入框保留 "keyword"。
- **All tab 切换保留搜索词**：当前在 `?owner=me&q=keyword`，点击 All tab → URL 变为 `?q=keyword`（移除 owner，保留 q）。

### 多端层
- **MCP Server**：不涉及。搜索是前端 UI 功能，MCP 已有 `get_entry` / `list_entries` 工具但搜索不在 MCP 工具范围内。
- **CLI**：不涉及。CLI 已有 `peekview list` 但此任务不改 CLI。
- **API**：不涉及。后端 API 已支持 `q` 参数。
- **无**。

### 边界层
- **空搜索结果**：后端返回 `items: [], total: 0` → 前端显示 "No entries found"。当前 EntryListView 已有此文案（line 61），无需额外处理。
- **FTS5 特殊字符**：FTS5 的 MATCH 语法对 `"` 有特殊含义（短语匹配），对 `*` 有前缀匹配含义。如果用户输入 `"hello"` 或 `foo*`，可能触发 FTS5 语法解析。后端已有 try/except 静默处理（entry_service.py:395），异常时跳过 FTS 过滤返回全量结果。但这会导致用户输入特殊字符时搜索结果不准确（返回全量而非报错）。P1 建议：**前端做基础转义**（将 `"` 替换为 `""`，双引号在 FTS5 中用于转义），或者**不做转义靠后端兜底**。P0 user_decisions 未提及此点，此条标为隐含需求。
- **并发搜索请求**：防抖 300ms 导致每次按键重置定时器，只发最后一次请求。但如果前一次请求在 300ms 后发出、响应未返回时用户继续打字，可能出现旧请求覆盖新请求的竞态。当前 `loadEntries` 直接赋值 `entries.value = response.items`，无请求序列号/取消机制。对 300ms 防抖场景风险较低（响应通常在 100ms 内），但理论上存在。P1 建议：依赖防抖减轻风险，不引入请求取消（过度设计）。
- **浏览器后退/前进**：由于使用 `router.replace`（而非 `push`），每次过滤条件变化（tab/搜索/分页）都替换当前历史记录，不产生新历史条目。这意味着用户用浏览器后退按钮会回到进入 `/explore` **之前** 的页面，而非上一个过滤条件。这是 **正确行为**（P0 明确要求避免历史栈污染），但需在 BDD 验收条件中验证：后退不回退到上一个搜索词。
- **`page` 参数在 URL 中的生命周期**：当搜索词变化时，分页应重置为 page=1。搜索条件改变（q 变化）→ URL 为 `?q=new&page=1`（或省略 page=1）。当前代码 `setOwner` 已经手动重置 `currentPage.value = 1`，搜索词变化时也需要同样处理。
- **响应式**：移动端 search input 应全宽显示。P0 不做移动端专门样式，但全宽 input 是基础可用性需求。

### 兼容层
- **T025 BannerBar 兼容**：T025 在 EntryListView 加 `BannerBar`（条件渲染 `v-if="isBannerMode"`）和 `owner` prop。search input 在 header 区，BannerBar 在 content 区——不冲突。（注：P0 推荐 T025 完成后 T026 串行启动，本条假设 T025 已完成。）
- **T024 路由重构**：T024 已将 Explore 页路径从 `/` 移到 `/explore`。（P0 声明 T024 必须先完成。）
- **CSP**：search input 是普通 HTML `<input>`，不引入内联事件处理器或 inline script，CSP 兼容。
- **现有测试不破坏**：86 + 16 现有测试必须全绿。改动仅涉及 EntryListView 组件的 script setup 逻辑（新增 search 相关状态和方法），不影响其他组件。

## 3. BDD 验收条件

### BDD-1：基本搜索（防抖）
**Given** 用户在 `/explore` 页面，entry 列表正常显示
**When** 用户在搜索框输入 "python"，停止输入后等待 300ms
**Then** URL 更新为 `/explore?q=python`，列表显示标题/摘要包含 "python" 的公开 entry

### BDD-2：Enter 立即触发
**Given** 用户在 `/explore` 页面，搜索框获得焦点
**When** 用户输入 "react" 后立即按 Enter 键（不等待 300ms）
**Then** URL 立即更新为 `/explore?q=react`，列表立即显示搜索结果

### BDD-3：Esc 清空搜索
**Given** 用户在 `/explore?q=keyword` 页面，搜索框显示 "keyword"
**When** 用户按 Esc 键
**Then** 搜索框内容清空，URL 变为 `/explore`（移除 `?q=`），列表恢复为全部公开 entry，搜索框失去焦点

### BDD-4：搜索 + Tab 组合（搜索时保留 owner）
**Given** 用户在 `/explore?q=python` 页面（已搜索）
**When** 用户点击 "Mine" tab
**Then** URL 变为 `/explore?q=python&owner=me`，搜索框仍显示 "python"，列表显示用户自己的、且匹配 "python" 的 entry

### BDD-5：Tab + 搜索组合（owner 时加搜索）
**Given** 用户在 `/explore?owner=me` 页面（Mine tab）
**When** 用户在搜索框输入 "test"，等待 300ms
**Then** URL 变为 `/explore?q=test&owner=me`（保留 owner），搜索框显示 "test"，列表显示用户自己的、且匹配 "test" 的 entry

### BDD-6：清空搜索保留 Tab
**Given** 用户在 `/explore?q=test&owner=me` 页面
**When** 用户按 Esc 清空搜索
**Then** URL 变为 `/explore?owner=me`（保留 owner 参数），列表显示用户自己的全部 entry

### BDD-7：搜索 + 分页组合
**Given** 存在 30+ 个匹配 "demo" 的 entry（至少 2 页）
**When** 用户访问 `/explore?q=demo&page=2`
**Then** 页面加载第 2 页的搜索结果，分页组件显示当前在第 2 页

### BDD-8：直接访问带搜索的 URL
**Given** 存在匹配 "hello" 的 entry
**When** 用户直接在浏览器地址栏访问 `/explore?q=hello`
**Then** 搜索框自动填入 "hello"，列表显示匹配 "hello" 的 entry

### BDD-9：搜索 + 用户页组合
**Given** 用户 alice 有 entry 标题包含 "notes"
**When** 用户访问 `/users/alice?q=notes`
**Then** 搜索框显示 "notes"，列表只显示 alice 的且匹配 "notes" 的 entry

### BDD-10：空搜索结果
**Given** 不存在匹配 "nonexistentXYZ123" 的 entry
**When** 用户访问 `/explore?q=nonexistentXYZ123`
**Then** 列表区域显示 "No entries found"（不显示 "No entries from @..."），搜索框保留 "nonexistentXYZ123"

### BDD-11：浏览器后退
**Given** 用户从 Landing page (`/`) 导航到 `/explore`，然后搜索 "python"（触发 `router.replace`），然后点击一个 entry 进入详情页（`/some-entry`，`router.push`）
**When** 用户点击浏览器后退按钮
**Then** 回到 `/explore?q=python`（详情页之前的搜索状态），**不是** Landing page，**不是** `/explore` 无搜索状态

### BDD-12：搜索词变化时重置分页
**Given** 用户在 `/explore?q=demo&page=3`
**When** 用户修改搜索词为 "other"，按 Enter
**Then** URL 变为 `/explore?q=other`（page 回到 1），列表显示 "other" 的第 1 页结果

### BDD-13：空白查询清理
**Given** 用户在 `/explore?q=python` 页面
**When** 用户删除搜索框全部内容（变为空字符串），等待 300ms
**Then** URL 变为 `/explore`（移除 `?q=` 参数），列表恢复为全部公开 entry

### BDD-14：搜索 + owner + 分页三组合
**Given** 存在用户自己的、匹配 "code" 的 entry 足以超过 1 页
**When** 用户访问 `/explore?q=code&owner=me&page=2`
**Then** 搜索框显示 "code"，Mine tab 高亮，分页组件显示第 2 页，列表显示用户自己的、第 2 页的、匹配 "code" 的 entry

### BDD-15：前后端测试不退化
**Given** 代码改动完成
**When** 运行 `cd frontend-v3 && npx vitest run` 和 `cd backend && .venv/bin/python -m pytest tests/`
**Then** 前端 86 个测试全部通过，后端全部测试通过

### BDD-16：类型检查和构建通过
**Given** 代码改动完成
**When** 运行 `cd frontend-v3 && npx vue-tsc --noEmit` 和 `npm run build`
**Then** 0 类型错误，构建成功产出 `dist/`

## 4. 待确认清单

无。

> P1 分析过程中识别的 4 个待确认点已在需求基线内自行决议，无需向人提问：
>
> 1. **搜索结果高亮**：不做。P0 已倾向不做，P1 确认不做。搜索词在输入框中可见，高亮增加实现复杂度但边际收益有限。
> 2. **FTS5 特殊字符转义**：前端不做转义。后端 `entry_service.py:395` 已有 `try/except Exception: pass` 兜底，FTS5 语法错误时静默跳过 FTS 过滤返回全量结果。前端转义属于过度设计。
> 3. **分页同步到 URL**：纳入范围。P0-brief 验收条件明确包含 `/explore?q=foo&page=2`，且搜索可分享的愿景天然要求分页也在 URL 中。当前代码分页未写入 URL 是隐含缺口，本需求基线覆盖修复。
> 4. **空搜索结果特殊 UI**：不区分。共用现有 "No entries found" 文案。搜索词已在输入框中可见，无需在空结果区域重复提示"没有搜索到结果"。

## 5. 裁剪说明

**声明阶段链**：`phases: [P1, P2, P3, P4, P5, P6]`

| 阶段 | 状态 | 理由 |
|------|------|------|
| P1 | 执行中 | 需求基线（本阶段） |
| P2 | 保留 | 设计 URL 合并逻辑、searchQuery 状态管理、setOwner 重构方案——方案虽简单但涉及多处现有函数修改，需理清调用链 |
| P3 | 保留（轻量） | 纯逻辑单元测试（URL 合并函数、防抖逻辑、Esc/Enter 处理）——这些纯函数可测且值得测。裁剪倾向声明"防抖测试繁琐可省"但 URL 合并逻辑应覆盖 |
| P4 | 保留 | 代码实现——修改 EntryListView.vue、可能新增 SearchInput 组件或内联 |
| P5 | 保留 | `vue-tsc --noEmit` + `npm run build` + `vitest run`，验证全绿 |
| P6 | 保留 | BDD 验收——搜索→URL 更新→结果展示→清空→URL 移除，必须 Playwright 实跑（UI 交互行为无法仅靠单元测试覆盖） |
| P7 | 跳过 | T026 仅改 EntryListView（单文件改动），无需多文件一致性检查 |
| P8 | 跳过 | T026 是纯前端改动，无版本号 bump / CHANGELOG 需要（前端无独立发布单元） |

**裁剪 P7 理由**：T026 改动集中在 `EntryListView.vue` 及可能的 `stores/entry.ts`（如果需要新增 searchQuery store 状态），不涉及跨包或多文件结构变更。一致性由 P5（测试+构建）覆盖。

**裁剪 P8 理由**：PeekView 前端无独立版本号和发布流程。前端改动随 backend 发布时一起 bump（`make bump-version`），T026 不单独发布。

## 6. 范围声明

**packages**: `[frontend-v3]`
**domains**: `[frontend, routing]`
**ui_affected**: `true` — EntryListView header 新增 search input，header 布局需调整

**改动文件（初步）**：
- `frontend-v3/src/views/EntryListView.vue` — 主要改动文件（+search input UI，+searchQuery 状态，+setQuery/setOwner 重构，+restoreFromURL 扩展，+分页 URL 同步）
- `frontend-v3/src/stores/entry.ts` — 可能小改（如果需要在 store 中维护 searchQuery 状态，或用 EntryListView 本地 ref）
- `frontend-v3/src/views/__tests__/EntryListView.logic.spec.ts` — 新增搜索相关纯逻辑测试

**不改**：
- 后端任何文件（FTS5 已完成）
- MCP Server
- 路由定义（不新增 `/search` 路由）
- 样式系统（沿用现有 CSS 变量）
- 其他组件

## 7. 能力需求声明

```yaml
capability_requirements:
  - need: browser-playwright
    why: P6 BDD 验收需要 Playwright 实跑验证 search input 交互（URL 同步、清空、tab 组合、分页组合）
    available:
      - make debug-test（Playwright E2E，项目内已配置）
      - make debug（完整调试流程含 E2E）
    status: available

  - need: frontend-unit-test
    why: P3 纯逻辑测试（URL 合并函数、防抖逻辑）需要 vitest
    available:
      - frontend-v3/node_modules/.bin/vitest run（已安装）
    status: available

  - need: frontend-type-check
    why: P5 类型验证需要 vue-tsc
    available:
      - frontend-v3/node_modules/.bin/vue-tsc --noEmit（已安装）
    status: available
```
