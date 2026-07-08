---
phase: P0
task_id: T050
task_name: T049 问题归零修复
type: brief
trace_id: T050-P0-20260708
created: 2026-07-08
status: draft
parent: T049 发布后用户验证暴露的 3 个缺陷
---

# T050: T049 问题归零修复

## 任务简报

T049 发布后用户立即发现 3 个问题。本任务针对每个问题做根因修复，并在流程层面确保类似遗漏不再发生。

### 问题 A：`config get diagram.sanitize_enabled` 默认值不显示

**现象**：`peekview config list` 显示 `sanitize_enabled: True`，但 `config get diagram.sanitize_enabled` 返回 `(not set)`。

**根因**：`cli.py` 中 `config_get` 命令的 `get_default` helper 函数缺少 `section == "diagram"` 分支——而 `config list` 的 `_get_default` 有。P4 实现时改了 `_get_default` 忘了改 `get_default`。

**修复**：
1. `cli.py` `get_default` 补 `elif section == "diagram"` 分支
2. 追加测试：验证 `config get` 返回与 `config list` 一致

### 问题 B：清洗规则不全面

**现象**：`diagram.sanitize_enabled = True` 开启后，前端仍显示 Mermaid 渲染错误：
- `UnknownDiagramError: No diagram type detected... gitgraph...`
- `Parse error on line 7... Expecting 'NEWLINE'... SequenceDiagram...`
- `Lexical error on line 2... TBsubgraph 一期 ~50万...`

**根因**：T049 的清洗规则凭经验猜测编写，未收集用户真实错误数据。只有 7 条规则（mermaid 箭头归一、plantuml 起止标记、svg 属性闭合），不覆盖：
- mermaid：`gitgraph`（应为 `gitGraph`）、`TBsubgraph` 缺换行、中文/全角字符、智能引号、HTML 混合
- plantuml：未知（需调查用户的 plantuml 条目）
- svg：未知（需调查用户的 svg 条目）

**修复**：
1. **P1 阶段收集真实数据**：扫描线上条目，收集所有包含 mermaid/plantuml/svg 的条目，识别渲染失败的类型和错误模式
2. **P2 基于数据设计规则**：输出错误模式 × 规则覆盖对照表
3. **P4 实现补充规则**
4. **P6 用真实条目做验收**

### 问题 C：移动端 header tags 布局挤压

**现象**：登录状态时，`header-right` 包含 4 个元素（Expires in 15d / Edit / TOC / Theme toggle），宽度` > 200px`，`header-tags` 被挤压到 1~2 列。

**根因**：
- T049 P2 未量化计算 header-right 实际宽度
- T049 P6 仅在非登录态测试，未暴露宽度挤压问题
- CSS `flex-shrink: 1`（默认值）使 `title-group` 可被压缩

**修复**：
1. 移动端（<768px）`header-right` 部分按钮折叠到 `⋯` 菜单
2. 或 `header-right` 在移动端换行到下一行
3. P6 在登录态 + 非登录态两态测试

## packages

- `backend/peekview/cli.py` — config_get 补充分支
- `backend/tests/test_diagram_config.py` — 追加 config_get 测试
- `frontend-v3/src/utils/diagramSanitize.ts` — 补充清洗规则
- `frontend-v3/src/utils/__tests__/diagramSanitize.spec.ts` — 补充测试
- `frontend-v3/src/views/EntryDetailView.vue` — header CSS 布局调整
- `frontend-v3/src/styles/layout.css` — 移动端 header 布局规则
- `frontend-v3/e2e/` — 新增移动端 header 测试

## domains

- `config-get-fix`：CLI config_get 默认值 bug 修复
- `sanitizer-rules-systematic`：基于真实数据的清洗规则系统补充
- `mobile-header-layout`：移动端 header-right 折叠/换行

## ui_affected

- EntryDetailView header 移动端布局
- config list/get CLI 输出（行为修复，显示不变）

## 已知风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| 真实数据收集需要线上实例可访问 | 无法获取错误模式 | 用户提供条目 slug；或自己构造已知错误模式 |
| 补充规则仍可能遗漏 | 再次发布后仍有用户报告的遗漏 | P1 要求输出覆盖对照表，P7 要求逐一配对验证 |
| header-right 折叠可能隐藏重要信息 | 用户找不到 Edit 按钮 | 折叠到 `⋯` 菜单，至少 1 次点击可访问；非移动端不变 |

## 环境约束

- 调试：`make debug`（:8888）
- 前端 CI：`npx vue-tsc --noEmit` + `vitest run`
- 后端 CI：`pytest -q`
- 移动端验证：Playwright CDP `Emulation.setDeviceMetricsOverride` iPhone 14 (390×844)
- 移动端双态验证：登录 + 非登录

## 裁剪倾向

- 不裁剪任何阶段
- P7 必须做实质性审查（方案有效性验证）

## gate_commands

```bash
# 后端测试
cd backend && .venv/bin/python -m pytest tests/test_diagram_config.py -v --tb=short
cd backend && .venv/bin/python -m pytest tests/ -q

# 前端测试
cd frontend-v3 && npx vue-tsc --noEmit
cd frontend-v3 && ./node_modules/.bin/vitest run

# 验证 config_get 一致性
peekview config get diagram.sanitize_enabled
peekview config list | grep sanitize
```
