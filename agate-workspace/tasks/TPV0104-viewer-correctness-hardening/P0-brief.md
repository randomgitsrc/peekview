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

修复 Viewer 四类共 7 项已确认缺陷（正确性 3 项 + 性能 1 项 + 资源边界 2 项 + 安全边界 1 项）。来源：外部核实报告 `docs/notes/issus-20261124-1429.md`（8 项 V-01~V-08）经本仓逐条复验后，**7 项成立、1 项部分成立（V-04 已被误判为已修复，实测仍未修复）**。

按修复顺序分三批：

### 第一批：正确性（用户看到的内容与导航必须可靠）

1. **V-02 Markdown 目录与正文标题 ID 不一致**（报告评为"本轮最明确的正确性问题"）
2. **V-01/V-04 多文件默认入口 + 截断态表头控件**（合并处理，见"合并说明"）

### 第二批：性能与资源边界（避免大型产物拖垮浏览器/服务端）

3. **V-03 CSV 截断未限制实际解析成本**
4. **V-06 HTML sibling 注入缺少总大小预算**
5. **V-07 注入 50 个上限静默截断**
6. **V-08 HTML 大文件判断用字符数而非字节数**

### 第三批：安全边界

7. **V-05 HTML Viewer 的 `connect-src https:` 外传通道**

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

## 实现要点（P1/P2 输入）

- **V-02**：`useMarkdown.ts` 导出 headings（已是现成数组）；`useEntryDetailComputed.ts` 的 `extractHeadings` 改为消费它；正文侧补重复 ID 去重
- **V-01**：`entryDetail.ts:50-52` 的 `entry.files[0]` 改为按优先级挑（`README.md` > `index.md` > `main.*` > 首个）；后端 `get_entry` 补**确定性 `order_by`**（当前无排序，默认文件选择不稳定）
- **V-03**：`useCsvParser.ts` 的 `parseRows` 增加提前终止
- **V-06/V-07**：`html_render_service.py` 的注入循环加预算累计 + 前端展示注入统计
- **V-08**：`HtmlViewer.vue` 的 `contentSize` 改用 `file.size`
- **V-04**：`TableView.vue` 给 `.th-sort-btn` / `.th-filter` 加 `v-if="!parsed.truncated"`

## 关键约束

- **不新增 schema 字段**（`is_primary` 属 roadmap #57，不在本任务）
- **不改 HTML CSP 默认策略**（见决策 6）
- **不引入 Web Worker / 虚拟滚动**（见决策 2）
- 现有测试契约不得擅改：`test_html_render.py` 的 `assert "https:" in csp` 是明确契约
- UI 可见改动（V-01/V-04/V-08）→ CHANGELOG `[Unreleased]`
- 后端改动（V-06/V-07）涉及资源限额 → **P6 不可裁**

## 验收基线（BDD 倾向，P1 细化）

### V-02（Markdown 目录一致性）

1. Given 两个同名 `## 设计方案` When 渲染 Then 正文两个标题 ID **唯一**，TOC 两项锚点均能正确定位
2. Given 代码围栏内含 `## 示例` When 渲染 Then TOC **不含**该项
3. Given Setext 标题（`===` 下划线式）When 渲染 Then TOC **包含**该项
4. Given 标题含粗体/链接 When 渲染 Then TOC 文本与正文 ID 一致
5. Given 中文重复标题 When 渲染 Then 去重正确

### V-01（默认入口）

6. Given 含 `README.md` 的多文件 entry When 从卡片打开 Then 默认展示 README
7. Given 无 README 但含 `index.md` When 打开 Then 默认展示 index
8. Given 无任何约定文件 When 打开 Then 回落首个文件（兼容现状）
9. Given 同一 entry 多次请求 When 获取文件列表 Then **顺序稳定**（后端有确定性 order_by）

### V-04（截断态控件）

10. Given CSV 超 maxRows When 渲染 Then 表头**无**排序按钮与过滤输入框
11. Given CSV 超 maxRows When 渲染 Then 截断提示 banner 可见且给出实际行数
12. Given CSV 未超限 When 渲染 Then 排序/过滤控件**正常存在且生效**（回归）

### V-03（CSV 解析成本）

13. Given 远超 maxRows 的 CSV When 解析 Then 不构造超限行数的完整数组（可用性能断言或 spy 验证）
14. Given 超限 CSV When 解析完成 Then `totalRows` **仍准确**（截断提示需要）

### V-06/V-07（注入预算）

15. Given sibling 总大小超预算 When 渲染 HTML Then 返回明确错误或降级提示，**非静默丢弃**
16. Given sibling 数量超 50 When 渲染 Then 明确告知被跳过数量
17. Given 单文件 text 超上限 When 注入 Then 该文件被跳过且有提示

### V-08（字节数判断）

18. Given 中文 HTML 内容（`length` 小但字节大）When 渲染 Then 按**真实字节数**判定是否进入手动渲染

### V-05（安全边界记录）

19. Given 私有 entry 含不可信 HTML When 打开 Then 行为符合已记录策略（沙箱隔离生效、外传通道存在但被文档化）

## 已知风险

- **V-02 改动面可能扩大**：`extractHeadings` 若被其它组件消费（如移动端 TOC、锚点滚动），需一并核对
- **V-03 的 `totalRows` 精度**：提前终止构造但仍需扫完输入以计数，二者平衡需实测
- **V-06 预算数值**：无真实样本前不设具体阈值，P2 需用 seed-data 或真实 entry 测量
- **V-05 仅记录不改策略**：可能被误读为"已修复安全风险"——P8 文档须显式说明"当前仍允许外传，收紧属独立决策"
- 报告明确声明"未 clone、未运行测试、未浏览器实测"——本仓复验为**静态源码比对**，P5 需实跑验证

## 裁剪倾向

- P1：不可裁（7 项跨前后端、含安全边界，BDD 需评审）
- P2：不可裁（V-02 单一来源重构、V-06 预算模型是设计核心）；domains 含 frontend + backend → 按 C8 可能需双评审，P1 定
- P3：保留（V-02/V-03/V-04/V-08 均有可单测行为）
- P5：不可裁（后端资源限额需实跑）
- P6：不可裁——19 条 BDD 逐条实跑 + UI 改动需截图
- P7：保留（多文件 + 跨前后端）
- P8：CHANGELOG `[Unreleased]`；若 V-02 改变了 TOC 行为，属用户可见变更需说明
