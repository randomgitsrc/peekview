---
phase: P0
task_id: TPV0104
task_name: viewer-correctness-hardening
trace_id: TPV0104
created: 2026-11-24
status: pending
parent: 无
---

# P0-brief — TPV0104 Viewer 正确性与资源边界加固

## task

修复 Viewer 四类共 **8 项**已确认缺陷（正确性 4 项 + 性能 1 项 + 资源边界 2 项 + 安全边界 1 项）。

**来源合并两份文档**：
- `docs/notes/issus-20261124-1429.md`（V-01~V-08 核实报告）——本仓在 `9a47df77` 逐条复验，**7 项成立**（V-04 曾被主 Agent 误判为"已修复"，实测仍未修复，已更正）
- `docs/notes/issues-20261124-1553.md`（多文件默认入口与全屏文件定位完整设计）——**取代** V-01 的一句话描述，扩展为「默认入口 + `?file=` 深链 + 全屏文件定位 + URL 状态同步」完整闭环（见决策 7）
- `docs/notes/issues-20261124-1612.md`（全屏阅读入口）——**补上 1553 假设却不存在的环节**：普通详情页的「全屏阅读」按钮（见决策 7.3 修订）

按修复顺序分三批：

### 第一批：正确性（用户看到的内容与导航必须可靠）

1. **V-02 Markdown 目录与正文标题 ID 不一致**（报告评为"本轮最明确的正确性问题"）
2. **V-01 多文件默认入口 + `?file=` 深链 + 全屏文件定位**（完整设计见决策 7，来源 `docs/notes/issues-20261124-1553.md`）
3. **V-04 截断态表头控件**（合并处理，见"合并说明"）

### 第二批：性能与资源边界（避免大型产物拖垮浏览器/服务端）

4. **V-03 CSV 截断未限制实际解析成本**
5. **V-06 HTML sibling 注入缺少总大小预算**
6. **V-07 注入 50 个上限静默截断**
7. **V-08 HTML 大文件判断用字符数而非字节数**

### 第三批：安全边界

8. **V-05 HTML Viewer 的 `connect-src https:` 外传通道**

## 需求来源与复验结论

外部核实报告基于 `1e0a57b9`（v0.27.1 前），本仓在 `9a47df77`（main，2026-11-24）**逐条复验**：

| 编号 | 报告结论 | 本仓复验（`9a47df77`） | 证据 |
|---|---|---|---|
| V-01 | 多文件默认入口无语义 | ✅ **仍存在** | `entryDetail.ts` 无 README/primary 逻辑；后端 `select(File)` 无 `order_by` |
| V-02 | TOC 与正文标题 ID 不一致 | ✅ **仍存在** | `useEntryDetailComputed.ts:51-55` 仍是 `split('\n')` + `/^(#{1,6})\s+(.+)$/` 逐行正则；`useMarkdown.ts:337-339` 独立 `slugify` + `headings.push` |
| V-03 | CSV 先全量 parse 再截断 | ✅ **仍存在** | `useCsvParser.ts:7` `const allRows = parseRows(cleaned, delimiter)` 在 `:12` 的 `slice(0, maxRows)` 之前 |
| V-04 | 截断后排序/过滤失效 | ✅ **仍存在**（**报告判断正确，本仓初判错误**） | 见下"合并说明" |
| V-05 | CSP `connect-src https:` 允许外传 | ✅ **仍存在** | `files.py:41` `connect-src blob: data: https:` |
| V-06 | 注入缺总大小预算 | ✅ **仍存在** | 仅 `_BINARY_SIZE_LIMIT = 768KB`（单文件），文本无单/总限额，无最终 HTML 限额 |
| V-07 | 50 个上限静默截断 | ✅ **仍存在** | `html_render_service.py:17,72` `_MAX_INJECT_IDS = 50` + `if len(result) >= _MAX_INJECT_IDS` 静默 break |
| V-08 | 大文件判断用 `length` | ✅ **仍存在** | `HtmlViewer.vue:87-94` `SIZE_WARN/BLOCK` + `props.content.length` |

## 合并说明（V-01 与 V-04，以及 V-01 与 roadmap #57）

### V-04 的本仓初判错误（已更正）

主 Agent 初判"V-04 已修复"，理由是 `TableView.vue:60` 有 `v-if="!parsed.truncated"`。**该判断错误**——那个 v-if 只控制**底部 `.table-controls`**（每页条数 + 分页），不是表头排序/过滤。

源码事实（`frontend-v3/src/components/TableView.vue`）：

| 元素 | 行号 | 截断时 |
|---|---|---|
| `.th-sort-btn` 排序按钮 | 25-31 | **无 v-if，始终渲染** |
| `.th-filter` 过滤输入框 | 32-37 | **无 v-if，始终渲染** |
| `<tbody>` 截断分支 | 42-46 | 遍历 `parsed.rows`（原始数据） |
| `<tbody>` 正常分支 | 48-54 | 遍历 `pageRows` = `table.getRowModel().rows`（应用排序+过滤） |
| `.table-controls` | 58 | `v-if="!parsed.truncated"` ✅ 唯一被隐藏 |

用户可见现象：点列头排序 → 指示器 `↑↓` 变化；输入过滤 → 输入框有内容；**但数据一行都不变**。比"控件不显示"更糟（用户以为功能坏了）。

完整分析见 `docs/reviews/v04-truncated-header-controls-20261124.md`。

### V-01 与 roadmap #57 的关系

同一问题的两个层次：

- **roadmap #57**（已登记待排期）= 完整方案（`is_primary` 字段 + MCP `primary_path` + schema 迁移）
- **本任务 V-01** = 报告建议的**轻量策略**（不改 schema，前端按约定优先级挑）

本任务**只做轻量策略**，不动 schema；#57 保持待排期。报告也明确建议"暂时不要增加 `main_file` 数据库字段"。

## 已确认的设计决策（P0 阶段）

### 决策 1：V-02 从"两套解析"改为"单一来源"

**当前**：正文走 markdown-it token 流（`useMarkdown.ts`），TOC 走**独立的逐行正则**（`useEntryDetailComputed.ts`）。两者 slug 规则相近但不一致：
- TOC 有重复 ID 去重（`-1` 后缀），正文**没有** → 第二个同名标题的 TOC 锚点指向不存在的 ID
- TOC 无围栏状态机 → 代码块里的 `## xxx` 被误收进目录
- TOC 只认 ATX（`#`），**Setext**（`===`/`---` 下划线式）标题收不到

**采纳**：**TOC 从 markdown-it 的 headings 数组取，不再独立解析**。`useMarkdown.ts` 已在 `:339` push `{level, text, id}`，只需把它作为 TOC 数据源导出；同时给正文加**重复 ID 去重**（与 TOC 用同一套），保证两侧 ID 完全一致。

**理由**：报告建议的 AST 单一来源是对的——两套逻辑必然漂移，且已产生 3 类可见缺陷。改动面集中在两个 composable，不动渲染管线。

### 决策 2：V-03 只做"限制解析成本"，不做 Web Worker

**当前**：`parseRows` 先构造完整二维数组，再 `slice(0, maxRows)` → 50,000 行限制**不限制解析时间与内存**。

**采纳（第一阶段）**：
1. 解析器增加 `maxRows` 参数，**达到上限即停止构造数据数组**（但仍继续扫描输入以统计 `totalRows`——否则截断提示的"N 行"不准）
2. 增加文件字节数上限保护（与 V-08 共用同一常量）
3. **不引入** Web Worker / 虚拟滚动（报告明确建议"不要因为 CSV Viewer 存在就把 Peekview 变成数据分析平台"）

**理由**：第一阶段应以最小改动消除"先全量后截断"的错误，而非重写解析架构。Web Worker 属第二阶段，需真实大数据样本触发。

### 决策 3：V-04 选"隐藏表头控件"而非"让排序过滤生效"

| 方案 | 评价 |
|---|---|
| **A（采纳）** 截断时隐藏 `.th-sort-btn` 与 `.th-filter` | 改动小；语义诚实——截断态本就是"只展示前 N 行"，排序/过滤无意义 |
| B 让排序/过滤作用于 `parsed.rows` | 需把截断数据喂给 TanStack；且"前 N 行内排序"≠"全量排序"，语义模糊易误导 |

### 决策 4：V-06/V-07 建立统一资源预算，超限显式反馈

**采纳**：注入侧建立四级预算（数值待 P2 依实测确定，**不拍脑袋**）：

| 层级 | 内容 |
|---|---|
| 单文件文本上限 | 文本资源单文件大小 |
| 总大小预算 | 全部 sibling 注入后的累计字节 |
| 最终 HTML 上限 | 注入完成后的响应体大小 |
| 数量上限 | 保留 50，但**超限必须显式告知**（不静默丢弃） |

**关键要求**：超限时**反馈而非静默**——当前前端传全部 sibling ID、后端静默取前 50，用户看到的是"渲染成功但资源不全"的假象。

### 决策 5：V-08 用后端 `size` 为主、`length` 为辅

`HtmlViewer.vue` 改用 `props.content.length` → **优先用后端返回的 `file.size`**（真实字节数），`content.length` 仅作兜底（如流式内容无 size 时）。同时明确区分「文件加载限制」与「HTML 执行/渲染限制」（当前策略只限制后者）。

另修一处细节：`>= 2MB` 使恰好 2MB 触发手动渲染，非严格大于——P1 确认这是否为预期。

### 决策 6：V-05 定义"安全预览 vs 交互式 Demo"两档，但**不在本任务改默认策略**

**当前**：`connect-src blob: data: https:` 允许 HTML 向外发请求；`sandbox="allow-scripts allow-forms"` 无 `allow-same-origin`（iframe opaque origin，无法读宿主 Cookie/DOM）。

**风险性质**（报告表述准确，本任务采信）：**不是宿主 XSS**，而是"用户打开不可信 HTML 时，HTML 自身内容可能被脚本外传"。对私有 entry 尤其值得关注。

**本任务只做**：
1. 在 `docs/architecture/` 或 `DESIGN.md` 明确记录两种模式的定义与当前默认
2. 增加安全测试（私有 entry + 不可信 HTML 的行为断言）

**本任务不做**：改默认 CSP。理由：HTML Demo 是 Peekview 核心场景，一次性收紧会破坏既有使用；且现有测试 `assert "https:" in csp` 是**明确的契约**（`test_html_render.py`），改策略须同步改契约，属独立决策。

> ⚠️ 报告指出："如果未来改变安全策略，应该同步调整测试契约，而不是只改实现。"——本任务遵守此原则，**不擅改契约**。

### 决策 7：多文件默认入口 + `?file=` 深链 + 全屏文件定位（完整设计）

**来源**：`docs/notes/issues-20261124-1553.md`（用户提供的完整设计文档）。本决策**取代**此前 V-01 的一句话描述。

#### 7.1 URL 语义（四条组合）

| URL | 行为 |
|---|---|
| `/{slug}` | 普通模式，打开**默认文件** |
| `/{slug}/f` | 全屏模式，打开**默认文件** |
| `/{slug}?file=123` | 普通模式，打开**指定文件** |
| `/{slug}/f?file=123` | 全屏模式，打开**指定文件** |

- `/f` 只负责阅读模式；`file` 只负责指定文件；两者**相互独立、可组合**
- `file` 用当前 Entry 下的 File ID，**不允许跨 Entry**
- `file` 是程序/深链参数，不要求用户手动输入

#### 7.2 默认入口规则（三级优先级）

1. 根目录 `README.md`
2. 根目录 `index.md`
3. 其他文件按**确定性排序**取第一个

约束：
- 文件名匹配**大小写不敏感**
- **只匹配根目录**，不递归子目录
- 文件列表排序必须**稳定**（按相对路径排序，`File ID` 作最终 tie-breaker）
- **默认入口选择 ≠ 文件列表排序**——不得为 README 优先而改变整个列表顺序

#### 7.3 全屏入口交互（**新增按钮**，来源 `issues-20261124-1612.md`）

**前置事实（已实测）**：详情页**当前没有任何全屏按钮**——zen 只能靠 `f` 键（`EntryDetailView.vue:239`）；唯一的"全屏"按钮是 `DiagramBlock.vue:177` 的**图表**全屏，与页面级全屏无关。

**所以 1553 文档 §4.1「复用现有全屏入口」的前提不成立**，必须新增按钮。1612 文档给出了具体要求：

**入口位置**（按优先序）：
1. 当前文件阅读区的 Header / 工具栏（若已有合适位置则复用）
2. 若布局无合适位置，增加轻量入口
3. **不得**只放在文件树中（用户可能已收起）
4. **不得**给文件树每个文件单独加按钮
5. **不得**新增文件选择器

**图标 + 文字**：`Maximize` / 全屏阅读，视觉遵循 `DESIGN.md`；桌面端与移动端都需可发现、可操作。

**点击行为**（以**当前实际选中文件**为目标）：
- **情况 A**：当前文件 == 默认入口文件 → `/{slug}/f`
- **情况 B**：当前文件 != 默认入口文件 → `/{slug}/f?file=<当前文件 ID>`
- **默认入口判断必须走统一 resolver**，不得假定 `files[0]`
- 用户无需看到或输入 File ID

**全屏模式内部**：
- 展示点击时选中的文件
- 保持现有 zen 行为
- **不新增**文件树/选择器/复杂导航
- **不改变**原纯内容定位

**手动追加 `/f`** 仍然有效，展示默认文件（不要求先经界面操作）。

#### 7.4 文件定位与 URL 状态同步

1. 初次加载读 `file` 参数
2. 有效且属当前 Entry → 打开指定文件
3. 缺失 → 用默认入口规则
4. **无效或不属于当前 Entry → 安全回退默认入口**（不跨 Entry 读取）
5. 页内通过文件链接切换时，**URL 同步更新**
6. 切回默认文件时**移除 `file` 参数**（避免冗余）
7. URL 更新用 `router.replace()`（不制造历史记录）
8. **`file` 与 `share` 等参数各自生效**，清理某个临时参数时不得误删其他

#### 7.4.1 ⚠️ `firstFileId` 与 `file` 不是同一个东西（机制替换，非改名）

这是本任务最易误解的一点，必须写清：

| 维度 | `firstFileId`（现状） | `file`（文档要求） |
|---|---|---|
| **语义** | 初次加载时先展示哪个文件 | **当前**正在看哪个文件 |
| **性质** | 命令式**一次性种子** | 声明式**持续状态** |
| **生命周期** | 加载完即清（`EntryDetailView.vue:238`） | 保留，仅切回默认文件时移除 |
| **来源** | 列表页（`EntryCard`/`EntryListRow`）塞进 URL | 详情页内用户切换文件产生 |
| **谁是真相** | URL 是输入，store 是真相 | URL 与 store **双向同步** |
| **刷新后** | **丢失**（回落 `files[0]`） | **保留**（文档 V-04 明确要求） |
| **页内切换** | **从不更新** | **必须同步** |

**结论**：不能靠「保留 `firstFileId` 但改名叫 `file`」满足文档要求。必须把机制从一次性种子改为持续状态同步。

**可复用部分**：`EntryDetailView.vue:234` 的「读 query → 传 loadEntry」思路可保留，但**清除时机与更新时机完全不同**。

**迁移影响**：现有 `?firstFileId=` 链接（卡片/列表自动生成）会失效。但本任务同时要**移除卡片/列表的该传递**（冲突 4），自动来源本就被替换 → 剩余风险仅为用户手动收藏的链接，P1 评估是否加重定向。

#### 7.5 ⚠️ 与现状的关键冲突（已实测，P1 必须解决）

| # | 文档假设 | 实测现状（`9a47df77`） | 影响 |
|---|---|---|---|
| 1 | `?file=` 是**持续态**参数 | 现状 `?firstFileId=` 是**一次性种子**：`EntryDetailView.vue:238` 加载完即 `router.replace({query:{}})` 清除，页内切文件也从不更新 | **不是改名，是机制替换**（见 §7.4.1）。`firstFileId` 无法满足「刷新保留 / 切换同步」要求，必须换掉 |
| 2 | 4.1 "复用现有全屏入口" | **详情页根本没有全屏按钮**——zen 只能靠 `f` 键（`EntryDetailView.vue:239` 的 keydown）；唯一的"全屏"按钮是 `DiagramBlock.vue:177` 的**图表**全屏 | ✅ **已解决**：由 `issues-20261124-1612.md` 明确要求**新增按钮**（见 §7.3 修订） |
| 3 | 页面加载后清 query | 现状 `EntryDetailView.vue:238`：`if (firstFileId || shareToken) router.replace({ path, query: {} })` **清空所有 query** | 正是文档 §5.100 警告的坑：会误删 `file`。必须改为**只删已消费的临时参数** |
| 4 | 卡片/列表不应绕过默认入口 | 现状 `EntryCard.vue:150` / `EntryListRow.vue:153` **无条件**传 `files[0].id` 作为 `firstFileId` | 正是文档 §3.49 警告的坑：会让 README 优先规则失效。**必须移除该传递** |

> **§7.5 冲突表第 4 行的更正（2026-11-24 17:10，P1 期间实测推翻）**：上表第 4 行的"现状"表述**不准确**，`files[0].id` 的传递在**当前代码路径下从不生效**。实测证据三条：
> ① 列表接口 `GET /api/v1/entries` 的 `EntryListItem` 响应**无 `files` 字段**（实测响应体只有 `file_count`，无 `files` 数组）；
> ② `frontend-v3/src/api/client.ts:91-99` 的 `transformListItem` **硬编码 `files: []`**；
> ③ `EntryCard`/`EntryListRow` 唯一挂载点是 `EntryListView.vue:169/184`，其 `entries` 全部来自 `listEntries` → `transformListItem`。
> 浏览器实测印证：点击多文件 entry `multi-format-demo`（4 文件）的卡片后 URL 为 `http://127.0.0.1:8888/multi-format-demo`，**不含 `firstFileId`**。
>
> **结论修正**：`EntryCard.vue:150-156` / `EntryListRow.vue:153-159` 的 `files?.[0]?.id` 分支是**死代码**（`files` 恒为空数组 → 恒走 `else` 分支）。因此「移除卡片/列表的该传递」这一改动**实际是删除死代码**，而非修复一个正在生效的 bug。**这不降低任务要求**——那段代码仍是「假定 `files[0]`」的错误范式，留着会在未来某次把 `files` 补进列表响应时突然生效并绕过 resolver。BDD 判据相应调整：不能靠"点卡片看 URL 有没有 firstFileId"来验证（现状本来就通过），须改为**代码级断言**（该分支不存在 / `files[0]` 不再出现在这两个组件的导航路径上）。

#### 7.6 明确不做（沿用文档 §8）

不新增 `main_file` 字段、不新增 Manifest/文件身份协议、不新增全屏文件树/选择器、不要求用户手输 File ID、不做跨实例稳定文件身份、不做文件版本管理。

> 注：`main_file` 字段属 **roadmap #57**，本任务只做前端 resolver。

## 实现要点（P1/P2 输入）

- **V-02**：`useMarkdown.ts` 导出 headings（已是现成数组）；`useEntryDetailComputed.ts` 的 `extractHeadings` 改为消费它；正文侧补重复 ID 去重
- **V-01（决策 7）**：抽 `resolveDefaultFile(files)` resolver（根 `README.md` > 根 `index.md` > 稳定排序首个）；`entryDetail.ts:50-52` 的 `entry.files[0]` 接入该 resolver；**移除** `EntryCard.vue:150` / `EntryListRow.vue:153` 的 `files[0].id` 传递（否则绕过 resolver）；后端 `get_entry` 补**确定性 `order_by`**（path + id tie-breaker）
- **`?file=` 参数（机制替换）**：`EntryDetailView.vue:234` 改读 `file` 并接入持续态同步（§7.4.1）；`:238` 的清 query **改为只删 `share` 等一次性凭证、保留 `file`**；页内切换时 `router.replace` 更新 `file`；切回默认文件时移除 `file`
- **全屏入口**：现状无按钮（仅 `f` 键）→ P1 决定是「新增按钮」还是「仅靠 `f` 键 + URL 同步」；若加按钮，需同时处理「默认文件→`/f`」与「非默认文件→`/f?file=`」两种跳转
- **V-03**：`useCsvParser.ts` 的 `parseRows` 增加提前终止
- **V-06/V-07**：`html_render_service.py` 的注入循环加预算累计 + 前端展示注入统计
- **V-08**：`HtmlViewer.vue` 的 `contentSize` 改用 `file.size`
- **V-04**：`TableView.vue` 给 `.th-sort-btn` / `.th-filter` 加 `v-if="!parsed.truncated"`

## 关键约束

- **不新增 schema 字段**（`is_primary` 属 roadmap #57，不在本任务）
- **不改 HTML CSP 默认策略**（见决策 6）
- **不引入 Web Worker / 虚拟滚动**（见决策 2）
- 现有测试契约不得擅改：`test_html_render.py` 的 `assert "https:" in csp` 是明确契约
- **`?file=` 必须实现为持续态，不得复用 `firstFileId` 的清除逻辑**（见 §7.4.1）——`firstFileId` 是「加载完即清」的种子，无法满足「刷新保留 / 切换同步」
- **全屏入口确定新增按钮**（`issues-20261124-1612.md` 明确要求）：现状无按钮，仅 `f` 键不构成可发现入口。P1 需定**放置位置**（Header 工具区 vs 新增轻量入口），但"是否加"已定
- **默认入口 resolver 必须单点**：卡片/列表/直接访问三条路径都必须走同一个 `resolveDefaultFile`，禁止任一处自行取 `files[0]`
- **URL 清理逻辑必须逐个参数处理**：禁止 `query: {}` 一锅端（会误删 `file`/`share`）
- UI 可见改动（V-01/V-04/V-08）→ CHANGELOG `[Unreleased]`
- 后端改动（V-06/V-07）涉及资源限额 → **P6 不可裁**

## 验收基线（BDD 倾向，P1 细化）

### V-02（Markdown 目录一致性）

1. Given 两个同名 `## 设计方案` When 渲染 Then 正文两个标题 ID **唯一**，TOC 两项锚点均能正确定位
2. Given 代码围栏内含 `## 示例` When 渲染 Then TOC **不含**该项
3. Given Setext 标题（`===` 下划线式）When 渲染 Then TOC **包含**该项
4. Given 标题含粗体/链接 When 渲染 Then TOC 文本与正文 ID 一致
5. Given 中文重复标题 When 渲染 Then 去重正确

### V-01 默认入口（决策 7）

6. Given 含根目录 `README.md` 的多文件 entry When 从卡片/列表/直接访问 URL Then 三者**一致**默认展示 README
7. Given 无 README 但含根目录 `index.md` When 打开 Then 默认展示 index
8. Given 两者都无 When 打开 Then 回落**稳定排序**后的第一个文件
9. Given 同一 entry 多次请求 When 获取文件列表 Then 顺序**稳定**（后端有确定性 `order_by`）
10. Given 子目录含 `README.md` 但根目录无 When 打开 Then **不**选中子目录的 README（只匹配根目录）
11. Given 根目录含 `readme.md`（小写）When 打开 Then 仍命中（大小写不敏感）

### V-02b `?file=` 深链（决策 7）

12. Given `/{slug}?file=123` When 访问 Then 打开指定文件
13. Given `/{slug}/f?file=123` When 访问 Then 打开指定文件**并**进入全屏
14. Given `?file=<不存在的 id>` When 访问 Then **回退默认入口**（不报错）
15. Given `?file=<其他 entry 的 file id>` When 访问 Then **拒绝并回退默认入口**（不跨 Entry 读取）
16. Given `?file=<非数字>` When 访问 Then 回退默认入口

### V-03b 全屏入口（决策 7）

17. Given 普通详情页当前展示**默认文件** When 触发全屏 Then URL 为 `/{slug}/f`（**不带** file 参数）
18. Given 普通详情页当前展示**非默认文件** When 触发全屏 Then URL 为 `/{slug}/f?file=<当前 id>`
19. Given 在 `/{slug}` 后手动追加 `/f` When 访问 Then 进入全屏并展示默认文件（不要求先操作界面）
20. Given 普通详情页 When 查看 Then 存在**可发现的「全屏阅读」入口**（图标 + 文字）
21. Given 详情页文件树已收起 When 查看 Then 全屏入口**仍然可见**（未藏在文件树内）
22. Given 多文件 entry When 展开文件树 Then **每个文件旁无**单独的全屏按钮
23. Given 移动端 When 查看详情页 Then 全屏入口可触达且**不遮挡主要内容**
24. Given 全屏模式 When 查看 Then **无**文件树、无文件选择器、无 Header/TOC（保持纯内容）
25. Given 全屏模式且 Markdown 正文含文件链接 When 点击 Then 仍可切换文件

### V-04b URL 状态一致性（决策 7）

26. Given 页面加载完成 When 检查 URL Then 与实际展示文件**一致**
27. Given 通过 Markdown 内部链接切换文件 When 切换完成 Then URL **同步更新**
28. Given 从非默认文件切回默认文件 Then `file` 参数被**移除**
29. Given URL 同时含 `file` 与 `share` When 加载完成 Then **两者各自生效**，清理时互不误删
30. Given 已指定 `?file=123` When **刷新页面** Then 仍打开该文件（不被清理逻辑抹掉）
31. Given 切换文件 When 观察浏览器历史 Then **不新增**历史记录（用 `router.replace`）
32. Given 通过 `?file=123` 打开 Then 该参数在加载后**仍保留在 URL**（不得像 `firstFileId` 那样被清除，见 §7.4.1）

### V-05b 回归兼容（决策 7）

33. Given 单文件 entry When 打开 Then 行为不变
34. Given 普通详情页 When 打开 Then 行为不变
35. Given Share 链接 When 访问 Then 权限验证行为不变

### V-04（截断态控件）

36. Given CSV 超 maxRows When 渲染 Then 表头**无**排序按钮与过滤输入框
37. Given CSV 超 maxRows When 渲染 Then 截断提示 banner 可见且给出实际行数
38. Given CSV 未超限 When 渲染 Then 排序/过滤控件**正常存在且生效**（回归）

### V-03（CSV 解析成本）

39. Given 远超 maxRows 的 CSV When 解析 Then 不构造超限行数的完整数组（可用性能断言或 spy 验证）
40. Given 超限 CSV When 解析完成 Then `totalRows` **仍准确**（截断提示需要）

### V-06/V-07（注入预算）

41. Given sibling 总大小超预算 When 渲染 HTML Then 返回明确错误或降级提示，**非静默丢弃**
42. Given sibling 数量超 50 When 渲染 Then 明确告知被跳过数量
43. Given 单文件 text 超上限 When 注入 Then 该文件被跳过且有提示

### V-08（字节数判断）

44. Given 中文 HTML 内容（`length` 小但字节大）When 渲染 Then 按**真实字节数**判定是否进入手动渲染

### V-05（安全边界记录）

45. Given 私有 entry 含不可信 HTML When 打开 Then 行为符合已记录策略（沙箱隔离生效、外传通道存在但被文档化）

## 已知风险

- **V-02 改动面可能扩大**：`extractHeadings` 若被其它组件消费（如移动端 TOC、锚点滚动），需一并核对
- **V-03 的 `totalRows` 精度**：提前终止构造但仍需扫完输入以计数，二者平衡需实测
- **V-06 预算数值**：无真实样本前不设具体阈值，P2 需用 seed-data 或真实 entry 测量
- **V-05 仅记录不改策略**：可能被误读为"已修复安全风险"——P8 文档须显式说明"当前仍允许外传，收紧属独立决策"
- 报告明确声明"未 clone、未运行测试、未浏览器实测"——本仓复验为**静态源码比对**，P5 需实跑验证
- **决策 7 与现状有四处冲突**（见 7.5 表）：参数名、全屏入口不存在、清 query 一锅端、卡片/列表绕过 resolver。若 P1 未逐一解决，验收看似通过但实际行为与文档不符
- **旧 `?firstFileId=` 链接会失效**：本任务同时移除卡片/列表的该传递，自动来源被替换；剩余风险为用户手动收藏的链接，P1 评估是否加重定向
- **全屏按钮的移动端遮挡风险**：1612 要求「不遮挡主要内容」，移动端空间紧张，P1 需给出具体位置方案
- **全屏 `f` 键的 URL 同步**：`f` 是键盘事件，触发时若不改 URL，则与 `/{slug}/f` 路由不同源——P1 需决定「按键是否也跳转路由」（会改变现有"纯前端 zen 切换"行为）
- 本次 BDD 从 19 条增至 **40 条**，P6 实跑成本显著上升；若 P1 决定缩减决策 7 范围，需同步删 BDD

## 裁剪倾向

- P1：不可裁（7 项跨前后端、含安全边界，BDD 需评审）
- P2：不可裁（V-02 单一来源重构、V-06 预算模型是设计核心）；domains 含 frontend + backend → 按 C8 可能需双评审，P1 定
- P3：保留（V-02/V-03/V-04/V-08 均有可单测行为）
- P5：不可裁（后端资源限额需实跑）
- P6：不可裁——19 条 BDD 逐条实跑 + UI 改动需截图
- P7：保留（多文件 + 跨前后端）
- P8：CHANGELOG `[Unreleased]`；若 V-02 改变了 TOC 行为，属用户可见变更需说明
