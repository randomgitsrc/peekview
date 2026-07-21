# 为什么 MCP 不暴露 `updateEntry`

> 设计理由文档。回答"REST API 有更新，为什么 MCP Server 没有"。

## 决策

MCP Server 只暴露 5 个工具，**刻意不包含 `updateEntry`**。这是有意为之，不是遗漏。

## 理由

### 1. 减少 Agent 选错工具的概率

MCP 工具是给 Agent（LLM）调用的，不是给人用的。每多一个工具，Agent 选错工具的概率就增加。`updateEntry` 和 `createEntry` 的语义差异对 LLM 来说不够直观——"更新"和"重建"在自然语言层面接近，容易混淆。

只给 `deleteEntry` + `createEntry`（删了重建），不给 `updateEntry`（原地改），是一种**工具集最小化**策略：用一个明确的、不可逆的操作模式（删旧→建新）替代模糊的"部分更新"语义，降低 Agent 决策出错的可能。

### 2. 版本化语义土壤

当前 PeekView 是覆盖式更新，没有版本历史。如果未来要做"替换时保留历史快照"（竞品已普遍支持），`updateEntry` 的语义会从"改一改"变成"保留上一版、生成新版"——这个语义在 `deleteEntry` + `createEntry` 模式下是天然的（旧 entry 删了/归档了，新 entry 是新的），但在 `updateEntry` 模式下需要额外设计"什么算更新、什么算新版本"。

不给 `updateEntry` 保留了未来做版本化时的语义土壤——不需要回头解释"为什么 updateEntry 的行为从覆盖变成了版本追加"。

### 3. REST API 层保留给人用

REST API 有 `PATCH /api/v1/entries/{slug}` 更新能力，这是给人或脚本直接调用的。人在更新时能理解"我在改这个 entry 的过期时间/tags/标题"，但 Agent 调用时更容易产生"我只是改了一个字段，为什么整个版本链断了"的语义模糊。

两层策略：**REST API 层：功能完整，给人。MCP 层：工具最小，给 Agent。**

## 不做的事

- 不在 MCP 加 `updateEntry`，除非 T032 探针数据显示"Agent 因为缺乏更新能力而频繁删了重建"是一个真实痛点
- 不在自然语言文档中暗示"未来会加"——避免给 Agent 或使用者制造错误预期
