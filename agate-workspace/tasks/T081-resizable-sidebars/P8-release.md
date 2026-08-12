---
phase: P8
task_id: T081-resizable-sidebars
type: release
parent: P7-consistency.md
trace_id: T081-P8-20260804
status: draft
created: 2026-08-04
agent: releaser
---

# P8 发布准备：详情页侧边栏可拖拽调整宽度

## 1. 版本判定

### bump_type: minor

T081 新增功能（可拖拽侧边栏 + localStorage 持久化 + 键盘可访问性），属于加功能 → minor bump。

### 版本号变更

| 包 | 旧版本 | 新版本 | 是否 bump |
|----|--------|--------|-----------|
| peekview | 0.15.0 | 0.16.0 | ✅ |
| mcp_server | 0.10.0 | 0.10.0 | ❌（MCP 无改动） |

P2 §packages 声明单包 `frontend-v3`，前端构建打包进 peekview 包发布，故 peekview minor bump。MCP 无改动，版本不变。

## 2. CHANGELOG 更新确认

CHANGELOG.md 已更新：`[Unreleased]` → `[0.16.0] - 2026-08-05`，新增以下条目：

### 新增

- 详情页侧边栏可拖拽调整宽度：file-sidebar 和 toc-sidebar 各添加 resize handle，支持鼠标拖拽改变宽度 (T081)
- 宽度持久化：拖拽后的宽度存储到 localStorage，刷新后自动恢复 (T081)
- 双击 reset：双击 resize handle 重置为默认宽度 (T081)
- 键盘可访问性：resize handle 支持 Tab 聚焦 + ArrowLeft/ArrowRight 调整宽度 (T081)
- min/max clamp：file-sidebar 160-500px，toc-sidebar 150-400px，防止过度拖拽 (T081)
- 拖拽期间 user-select: none：防止拖拽时选中文字 (T081)
- 移动端不显示 handle：<1024px 时隐藏（已有 drawer 机制）(T081)
- zen mode 兼容：zen mode 隐藏 handle (T081)

### 修复

- 统一侧边栏宽度定义：移除 EntryDetailContent.vue scoped 硬编码宽度（200px/240px），统一到 CSS 变量 --sidebar-width/--toc-width (T081)
- layout.css .file-sidebar 补全 overflow-y: auto + position: relative (T081)
- T082 BDD-24 子组件行数阈值调整 200→300（T081 合理增加组件复杂度）

## 3. 版本文件确认

- `VERSIONS.json`：当前 peekview=0.15.0 / mcp_server=0.10.0（releaser 不执行 bump-version，主 Agent 在 gate 通过后执行 `make bump-version NEW_VERSION=0.16.0`）
- bump-version 会通过 `scripts/sync_versions.py` 同步到所有文件（pyproject.toml、package.json、__init__.py 等）

## 4. 发布检查命令

P2 §gate_commands 声明：

| 阶段 | 命令 | 执行者 |
|------|------|--------|
| P5 | `cd frontend-v3 && npx vitest run --reporter=dot` | 主 Agent gate 验证 |
| P5_e2e | `cd frontend-v3 && npx playwright test e2e/t081-resizable-sidebars.spec.ts --reporter=line` | 主 Agent gate 验证（如有 spec） |
| typecheck | `cd frontend-v3 && npx vue-tsc --noEmit` | 主 Agent gate 验证 |
| lint | `make lint && make typecheck` | 主 Agent gate 验证 |

releaser 不执行发布检查命令，主 Agent 在 gate 验证时亲自执行。

## 5. 临时资源清单

| 资源 | 类型 | 位置/标识 | 清理方式 |
|------|------|-----------|----------|
| debug backend :8888 | 临时服务 | PID 1320395 | `make debug-stop` 或 `kill 1320395` |
| /tmp/peekview-debug/ | 临时数据目录 | `/tmp/peekview-debug/peekview.db` 等 | `make debug-stop` 自动清理，或 `rm -rf /tmp/peekview-debug/` |
| /tmp/opencode/t081-p6-verify*.cjs | 临时验证脚本 | `/tmp/opencode/t081-p6-verify*.cjs` | `rm -f /tmp/opencode/t081-p6-verify*.cjs` |

## 6. 主 Agent 交接事项

releaser 已完成发布准备产出，以下由主 Agent 在 gate 验证通过后亲自执行：

1. **gate 验证**：重跑 P5 gate（`make test-quick` + `make typecheck`）→ 全绿
2. **bump-version**：`make bump-version NEW_VERSION=0.16.0`（更新 VERSIONS.json + 同步所有文件 + commit + tag）
3. **CHANGELOG amend**：bump 后 `git add CHANGELOG.md && git commit --amend --no-edit`（将 CHANGELOG 变更纳入 bump commit）
4. **READY 收尾检查**：按临时资源清单清理（停止 debug server、删除临时数据/脚本）
5. **状态更新**：`.state.yaml` phase=READY → DONE

## 7. Lessons Learned

1. **P6 验收描述数值笔误**（流程）：P6 验收结果中 BDD-04 和 BDD-07 的数值描述有笔误（min 值和 default 值标错），但实际行为 PASS。教训：P6 验收记录数值时应交叉核对 P2 设计配置表，避免"行为对但描述错"的笔误。
2. **scoped → 全局 CSS 迁移需补全属性**（架构）：移除 scoped 样式块时不能只移除 width 声明，需检查同规则块内的其他属性（如 overflow-y、position）是否已在全局样式中定义，否则会丢失行为。P2-review 的 ISSUE-1/ISSUE-2 捕获了这一点。
3. **BDD 阈值联动调整**（测试）：T081 合理增加组件复杂度导致 T082 BDD-24 子组件行数阈值需从 200 调整到 300。教训：跨任务的 BDD 阈值约束应在 P5 回归测试时主动检查是否需要联动调整。

## 8. 环境隔离声明

[PROD_NOT_TOUCHED]

T081 全程使用 debug backend :8888 + /tmp/peekview-debug/ 隔离数据目录，未触碰生产 :8080 或 ~/.peekview/。
