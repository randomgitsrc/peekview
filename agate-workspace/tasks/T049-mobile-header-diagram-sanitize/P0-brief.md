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
1. 后端新增配置项 `PEEKVIEW_DIAGRAM__SANITIZE_ENABLED`（默认 `true`），通过 `/api/v1/config/diagram` 端点暴露给前端
2. CLI `peekview config set diagram.sanitize_enabled true/false` 支持开关管理（需在 `SUPPORTED_CONFIG_KEYS` + `config_set` 类型转换 + `config_list` 描述中注册）
3. 前端在 diagram code block 渲染前，检查配置决定是否执行清洗
4. 清洗模块独立文件 `utils/diagramSanitize.ts`，每个引擎一个清洗函数，可扩展
5. 清洗规则分两类：
   - **确定性修正**（无条件应用）：补 `@startuml`/`@enduml`、闭合 XML 标签、修引号配对
   - **启发式修正**（有条件应用）：修 mermaid 箭头语法、去多余空行——仅当渲染失败后重试时才触发
6. 清洗管线：先确定性修正 → 尝试渲染 → 失败则启发式修正 → 再次尝试渲染 → 仍失败则显示错误

### 需求 C：图表渲染错误 UI 优化

**问题**：
当前 mermaid 渲染失败时，mermaid 库自身会在 DOM 中插入一个巨大的错误 SVG（显示 "Syntax error in text mermaid version 10.9.6"），占据大量页面空间，体验极差。DiagramBlock 的 `hasError` 逻辑虽然会显示 "Failed to render diagram" 提示，但 mermaid 的错误 SVG 仍然可见。PlantUML 和 SVG 渲染失败时也需要统一处理。

**现状分析**：
- **MermaidRenderer**：`mermaid.render()` 失败时 emit `renderError`，DiagramBlock 设 `hasError=true` 隐藏 `.diagram-viewer`，但 mermaid 在 `render()` 调用过程中已向 DOM 插入了错误 SVG（`#dmermaid-{id}` 临时元素），该 SVG 未被清理
- **PlantUmlRenderer**：失败时 emit `renderError`，DiagramBlock 切换到 code mode——行为合理
- **SvgRenderer**：DOMPurify 返回空时 emit `renderError`，DiagramBlock 设 `hasError=true`——行为合理
- **DiagramBlock 错误提示**：`<div class="diagram-error">Failed to render diagram</div>` 只显示一行文字，无错误详情、无"查看源码"快捷入口

**方案**：
1. **MermaidRenderer**：`render()` 失败后，主动清理 mermaid 注入的错误 SVG DOM 元素（`document.getElementById('dmermaid-{id}')`），确保页面不留大块错误图
2. **统一错误 UI**：DiagramBlock 的 `.diagram-error` 改为紧凑内联样式，包含：
   - 引擎名 + "渲染失败" 标题
   - 错误详情（可折叠，默认收起，截取前 200 字符）
   - "查看源码" 按钮（切换到 code mode）
3. **Mermaid 初始化配置**：设置 `suppressErrors: true`（mermaid v10+ 支持），阻止 mermaid 自行在 DOM 中渲染错误信息

## 环境约束

- debug_env: `make debug-start`（:8888, /tmp/peekview-debug/）
- 移动端验证：Playwright CDP `Emulation.setDeviceMetricsOverride`（iPhone 14 尺寸 390×844）
- 前端 `npx vue-tsc --noEmit` CI 强制

## 已知风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| 滚动收缩动画可能影响固定定位元素 | header 用 `flex-shrink: 0` + `position: sticky` 可能与 scroll 监听冲突 | 用 `position: sticky` + `top` 而非 fixed；测试多种移动端浏览器 |
| 标签单行截断可能丢失信息 | owner 看不到完整标签列表 | 详情页 body 内标签不受限（仅 header 收缩）；或滚动到顶部时恢复 |
| 源码清洗可能误改合法内容 | 把正确的特殊语法"修正"成错的 | 清洗规则只做确定性修正（可逆/无损），启发式修正仅渲染失败后重试时触发；配置开关可关闭 |
| 清洗规则需持续维护 | 新的 agent 错误模式不断出现 | 清洗函数独立模块，规则注册式设计（每条规则独立函数+描述），易扩展；加 console.warn 日志记录被清洗的模式 |
| 后端配置需新增端点 | `/api/v1/config/diagram` 是新 API | 复用现有 `config_router.py` 模式，改动量小 |
| CLI config 需注册新 key | `diagram.sanitize_enabled` 需加入 SUPPORTED_CONFIG_KEYS + 类型转换 + 描述 | 按现有模式添加，3 处改动 |
| mermaid 错误 SVG 残留 DOM | mermaid.render() 失败后向 DOM 插入大块错误 SVG，即使 hasError 隐藏 viewer 仍可见 | render 失败后主动清理 `#dmermaid-{id}` 元素 + 设置 `suppressErrors: true` |
| 错误 UI 信息不足 | 当前只显示 "Failed to render diagram"，无错误详情和操作入口 | 改为紧凑内联样式 + 可折叠详情 + "查看源码"按钮 |

## 裁剪倾向

- P3（TDD）保留：清洗函数需要单元测试覆盖各种错误模式
- P6（验收）保留：移动端 header 动画需 Playwright 实跑+截图
- P7（一致性）可裁剪：改动涉及前后端+CLI，但各端改动独立无交叉，一致性检查价值低

## packages

- `backend/peekview/`：config.py (PeekDiagram), api/config_router.py (新端点), cli.py (SUPPORTED_CONFIG_KEYS + 类型转换 + 描述)
- `frontend-v3/src/`：views/EntryDetailView, styles/layout.css, composables/useMarkdown, api/client (获取配置), 新模块 utils/diagramSanitize, components/DiagramBlock.vue (错误 UI), components/renderers/MermaidRenderer.vue (清理错误 SVG)

## domains

- `mobile-header-shrink`：移动端 header 滚动收缩行为
- `diagram-sanitize`：mermaid/plantuml/svg 源码前置清洗
- `diagram-config`：后端清洗开关配置 + 前端配置获取 + CLI 管理
- `diagram-error-ui`：渲染错误展示优化（mermaid SVG 清理 + 统一错误 UI）

## ui_affected

- EntryDetailView header：标签单行模式 + 滚动收缩
- DiagramBlock：错误 UI 重构（紧凑内联 + 可折叠详情 + 查看源码按钮）
- MermaidRenderer：清理错误 SVG DOM + suppressErrors 配置
- PlantUmlRenderer/SvgRenderer：间接（统一错误 UI）

## gate_commands

```bash
cd backend && .venv/bin/python -m pytest tests/ -v --tb=short
cd frontend-v3 && npx vue-tsc --noEmit
cd frontend-v3 && ./node_modules/.bin/vitest run
```
