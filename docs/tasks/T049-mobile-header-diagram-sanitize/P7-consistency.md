---
phase: P7
task_id: T049
type: consistency
trace_id: T049-P7-20260708
status: draft
created: 2026-07-08
agent: orchestrator
---

# P7 一致性检查 — T049 mobile-header-diagram-sanitize

## 1. DESIGN_GAP 配对

P4-implementation.md 声明了 2 条 DESIGN_GAP，逐一转抄 + 配对 REVIEWED：

### GAP 1: CLI config_list bool 输出大小写
```
[DESIGN_GAP: P2 didn't specify capitalization for CLI config_list bool output.
Test `test_cli_diagram_sanitize_list_shows_key` expects `"False"` (capitalized),
so output changed from `"true"/"false"` to `"True"/"False"`.
Existing test `test_config_list_shows_all` updated to match.]
```
**[DESIGN_GAP_REVIEWED: 接受。** 输出使用 Python 标准 bool 字符串表示（`str(False)` → `"False"`），符合 Python CLI 惯例。现有测试已同步更新。不影响用户功能。]

### GAP 2: CLI sanitize_enabled 无效值校验
```
[DESIGN_GAP: P2 didn't specify that `sanitize_enabled` CLI bool validation
should reject invalid values. P3 test `test_cli_diagram_sanitize_invalid_value`
expects `exit_code != 0`. Added validation in the type conversion block for
all bool keys (not just sanitize_enabled).]
```
**[DESIGN_GAP_REVIEWED: 接受。** 实际是提升——P2 未指定需要校验，实现时主动增加了 bool 类型验证，确保无效值不被静默接受。影响范围超出 sanitize_enabled（作用于所有 bool keys），属于合理的防御性增强。]

## 2. SCOPE+ 闭环

**结果：通过。** P1-requirements.md 含 `[SCOPE_RESOLVED]`（行 287），对应 P4-dispatch-context.md 中模板自带的 `[SCOPE+]` 提示（被判定为 false positive — 模板通用提示，非本任务新增需求）。SCOPE+ 闭环确认。

## 3. 跨文件一致性

### 3.1 P2 packages 与 P4 实现范围

| P2 声明包 | P4 实际修改文件 | 一致？ |
|-----------|-----------------|--------|
| `backend/peekview/` | `config.py`, `api/config_router.py`, `cli.py` | ✅ |
| `frontend-v3/src/` | `EntryDetailView.vue`, `DiagramBlock.vue`, `MermaidRenderer.vue`, `PlantUmlRenderer.vue`, `SvgRenderer.vue`, `utils/diagramSanitize.ts`, `api/client.ts`, `api/types.ts`, `styles/layout.css` | ✅ 含 P2 未显式列出的 `layout.css`，属于 frontend-v3/src/ 范围内 |
| `frontend-v3/src/` 测试文件 | `__tests__/DiagramBlock.spec.ts`, `__tests__/diagramSanitize.spec.ts` | ✅ 配套测试 |

**结论：一致。** 无超范围改动。

### 3.2 BDD 数量对照

| 来源 | 数量 | 结果 |
|------|------|------|
| P1-requirements.md BDD 总数 | 23（A:6 + B:9 + C:8） | — |
| P6-acceptance.md 总 PASS | 22（UI:13 + backend:9） | ✅ 数量差 1 |
| 差异说明 | C-BDD-3（错误 UI 显示引擎名）与 C-BDD-5（错误详情默认收起）在 Playwright 测试中合并为 `C-BDD-3+5`，两个 Gherkin 场景在同一测试中验证 | — |
| P5 unit tests | 30 条 PASS | ✅ |

**结论：一致。** C-BDD-3+5 合并测试同时覆盖了两个行为的验证。

### 3.3 P2 方案 vs P4 实现

| P2 设计的方案 | P4 实现 |
|---------------|---------|
| 后端 `PeekDiagram` config 类 + API 端点 | `config.py` 中实现 `PeekDiagram(BaseSettings)` + `GET /api/v1/config/diagram` ✅ |
| CLI subcommand `peekview config set diagram.sanitize_enabled` | `cli.py` 中注册 `SUPPORTED_CONFIG_KEYS` + 类型转换 ✅ |
| `diagramSanitize.ts` 模块（register 架构，两阶段清洗） | 新建 `utils/diagramSanitize.ts`，registerRule/sanitize/sanitizeWithRetry 实现 ✅ |
| 统一错误 UI（DiagramBlock.vue） | 含 engine name + collapsible details + "查看源码"按钮 ✅ |
| Mermaid suppressErrors + DOM cleanup | `useMermaid.ts` suppressErrors:true + `MermaidRenderer.vue` catch 清理 ✅ |
| PlantUML 统一错误 UI（不再 auto-switch to code mode） | `DiagramBlock.vue` 统一处理 error+code mode 切换 ✅ |
| 移动端 header 滚动收缩 | `EntryDetailView.vue` visibleTags + scroll handler + `layout.css` sticky/transition ✅ |

**结论：完全一致。** 无偏离。

### 3.4 P5 技术验证与 P6 验收

| 检查项 | P5（单元测试） | P6（验收） |
|--------|---------------|-----------|
| 后端测试 | 805 条 PASS（含新增 T049 测试） | backend B-BDD-1~9 PASS ✅ |
| 前端单元测试 | 702 条 PASS（含 DiagramBlock.spec + diagramSanitize.spec） | — |
| vue-tsc 类型检查 | 通过 | — |
| UI 验收 | — | 13/13 CDP Playwright BDD PASS ✅ |

**结论：一致。** P5+P6 覆盖了从单元到集成的完整验证链。

## 4. 未决项清零

| 标记 | 全阶段产出中是否存在 | 结果 |
|------|---------------------|------|
| `[NEED_CONFIRM]` | 无（仅 P6-card 中 checklist 的引用） | ✅ 清零 |
| `[BLOCKER]` | 无 | ✅ 清零 |
| `[DEVIATION-CRITICAL]` | 无 | ✅ 清零 |

## 5. 附加项：代码质量检查

| 检查项 | 状态 |
|--------|------|
| 后端 ruff lint | `cd backend && python3 -m ruff check peekview/ tests/` — 通过 |
| vue-tsc 类型检查 | `cd frontend-v3 && npx vue-tsc --noEmit` — 通过（P5 已确认） |
| 前端单元测试 | 702 条 PASS（P5 已验证） |
| CHANGELOG.md 未缺失改动日志 | CHANGELOG 已有 T049 [Unreleased] 条目（见后续 P8 完善） |

## 6. 结论

**P7 一致性检查：通过。** 所有检查项均满足条件，无 `[BLOCKER]` / `[DEVIATION-CRITICAL]` 残留。`[DESIGN_GAP]` 已全部 REVIEWED 配对。
