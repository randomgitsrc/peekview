---
phase: P0
task_id: T049
task_name: mobile-header-diagram-sanitize
type: brief
trace_id: T049-P0-20260708
created: 2026-07-08
status: draft
parent: 用户需求 — 移动端 header 滚动收缩 + 图表源码自动清洗
---

# T049: 移动端 Header 滚动收缩 + 图表源码自动清洗

## 任务简报

两个独立但均为体验优化的改动，合为一个任务。

### 需求 A：移动端 Header 滚动收缩

**问题**：
1. 移动端详情页 header 中，多个标签排成一列（`flex-wrap: wrap` + `flex-direction: column` 未约束），占用大量垂直空间，压缩正文区域
2. 滚动后 header 高度不变，标签持续占用空间

**方案**：
1. 标签改为 `flex-wrap: wrap` + 单行模式（`max-height` 限制为一行高度，超出部分隐藏或截断），移动端最多显示一行标签
2. header 滚动收缩：监听 scroll 事件，向下滚动时隐藏 `.header-tags` 部分（CSS transition 动画），向上滚动时恢复

### 需求 B：图表源码自动清洗（前置标准化）

**问题**：
Agent 写 mermaid/plantuml/svg 时常按自己的记忆写"差不多对"的语法，导致渲染出错或失败。常见错误：
- Mermaid：缺少空格、引号不匹配、箭头语法错误、subgraph 括号问题、缩进不一致
- PlantUML：缺少 `@startuml`/`@enduml` 标记、括号不匹配、声明顺序错误
- SVG：未闭合标签、属性值引号缺失、XML 声明问题

**方案**：
在 `useMarkdown.ts` 的 diagram code block 处理管线中，增加一个前置清洗步骤（`sanitizeMermaid`/`sanitizePlantUML`/`sanitizeSvg`），在源码传给渲染引擎之前自动修正常见错误。

## 环境约束

- debug_env: `make debug-start`（:8888, /tmp/peekview-debug/）
- 移动端验证：Playwright CDP `Emulation.setDeviceMetricsOverride`（iPhone 14 尺寸 390×844）
- 前端 `npx vue-tsc --noEmit` CI 强制

## 已知风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| 滚动收缩动画可能影响固定定位元素 | header 用 `flex-shrink: 0` + `position: sticky` 可能与 scroll 监听冲突 | 用 `position: sticky` + `top` 而非 fixed；测试多种移动端浏览器 |
| 标签单行截断可能丢失信息 | owner 看不到完整标签列表 | 详情页 body 内标签不受限（仅 header 收缩）；或滚动到顶部时恢复 |
| 源码清洗可能误改合法内容 | 把正确的特殊语法"修正"成错的 | 清洗规则只做确定性修正（可逆/无损），不确定的跳过；清洗后验证渲染是否通过 |
| 清洗规则需持续维护 | 新的 agent 错误模式不断出现 | 清洗函数独立模块，易扩展；加日志记录被清洗的模式便于后续补充 |

## 裁剪倾向

- P3（TDD）保留：清洗函数需要单元测试覆盖各种错误模式
- P6（验收）保留：移动端 header 动画需 Playwright 实跑+截图
- P7（一致性）可裁剪：纯前端改动，无跨包影响

## packages

- `frontend-v3/src/`：views/EntryDetailView, styles/layout.css, composables/useMarkdown, 新模块 utils/diagramSanitize

## domains

- `mobile-header-shrink`：移动端 header 滚动收缩行为
- `diagram-sanitize`：mermaid/plantuml/svg 源码前置清洗

## ui_affected

- EntryDetailView header：标签单行模式 + 滚动收缩
- DiagramBlock/MermaidRenderer/PlantUmlRenderer/SvgRenderer：间接（接收清洗后源码）

## gate_commands

```bash
cd frontend-v3 && npx vue-tsc --noEmit
cd frontend-v3 && ./node_modules/.bin/vitest run
```
