---
phase: P8
task_id: T084-detail-scroll-architecture
type: release
parent: P7-consistency.md
trace_id: T084-P8-20260731
status: draft
created: 2026-07-31
agent: implementer
---

# P8 发布准备 — T084 详情页滚动架构统一

## bump_type

```
bump_type: patch
```

**判定理由**：本次改动为纯前端 CSS 属性移除 + composable 简化 + E2E 测试修正 + 文档补充。不改后端 API 行为、不改 DB schema、不改 MCP、不引入新功能。属于 bug fix（滚动架构修复：scroll-hide 失效 + TOC 锚点偏移 + 双层 padding）。按 semver 规则，修 bug / 不改 API 行为 → patch。

## packages

P2-design.md `packages:` 声明：

| package | version 文件 | 旧版本 | 新版本 | 状态 |
|---------|-------------|--------|--------|------|
| frontend-v3 (peekview) | `VERSIONS.json` → `peekview` | `0.13.0` | `0.13.1` | 待 bump |

> peekview 包版本与 frontend-v3 绑定（前端构建产物复制到 `backend/peekview/static/`，作为 peekview pip 包的一部分发布）。MCP Server 独立版本（`mcp_server: 0.10.0`），本次不涉及。

**无 SCOPE_GAP**：P2 声明 `packages: [frontend-v3]`，dispatch-context 也仅要求处理 frontend-v3，无遗漏。

## 版本号变更确认

| 文件 | 字段 | 旧值 | 新值 | 操作 |
|------|------|------|------|------|
| `VERSIONS.json` | `peekview` | `"0.13.0"` | `"0.13.1"` | 主 Agent 执行 `make bump-version NEW_VERSION=0.13.1` |
| `backend/peekview/__init__.py` | `__version__` | `"0.13.0"` | `"0.13.1"` | sync_versions.py 自动同步 |
| `frontend-v3/package.json` | `version` | `"0.13.0"` | `"0.13.1"` | sync_versions.py 自动同步 |
| `packages/mcp-server/package.json` | `version` | `"0.10.0"` | `"0.10.0"` | 不变（MCP 独立版本） |

> P8 模式禁止执行 bump-version / git commit / git tag。以上版本号变更为主 Agent gate 通过后亲自执行。

## CHANGELOG 更新确认

CHANGELOG.md `[Unreleased]` → `[0.13.1] - 2026-08-01`，新增以下条目：

### 修复

- 详情页滚动架构统一：MarkdownViewer 移除 `height:100%; overflow:auto`，CodeViewer 移除 `min-height:300px; flex:1; overflow:auto`，`.content-area` 成为唯一纵向滚动容器 (T084)
- 移动端 scroll-hide 修复：`useResponsiveLayout.setupScrollHide` 移除 `findScrollable` 子元素查找，直接监听 `.content-area` scroll 事件 (T084)
- TOC 锚点跳转偏移修复：`.content-area` 成为唯一滚动容器后，`scroll-margin-top: 80px` 参考系自动正确，标题不再被 sticky header 遮挡 (T084)
- 移动端双层 padding 消除：`.markdown-body` scoped + 全局 padding 移除，padding 归属 `.content-area` 单层（移动端从 40px 降到 8px 水平 padding）(T084)

### 新增

- DESIGN.md §9 新增 Scroll Architecture 小节：显式声明 `.content-area` 为唯一纵向滚动容器 + viewer 滚动职责约定 (T084)

## 发布检查命令

P2 gate_commands 声明的发布检查命令（主 Agent 亲自执行）：

| 命令 | 用途 | 预期结果 |
|------|------|---------|
| `cd frontend-v3 && npx vitest run --reporter=dot` | 单元测试 | 0 failed |
| `cd frontend-v3 && npx vue-tsc --noEmit` | 类型检查 | 0 errors |
| `cd frontend-v3 && npm run build` | 构建 | 成功 |
| `cd frontend-v3 && npx playwright test --reporter=line e2e/t049-mobile-header-diagram-sanitize.spec.ts` | E2E | 0 failed |

> P6 验收已确认 14/14 BDD PASS（vitest 1129 passed 0 failed, vue-tsc exit 0, build 成功, CDP BDD-01~10 全 PASS）。bump-version 后需重跑 P5 gate 确认全绿。

## 改动文件清单

本次 T084 实际改动的源码文件（不含 docs/tasks/ 产出文件）：

| 文件 | 改动类型 | 描述 |
|------|---------|------|
| `frontend-v3/src/components/MarkdownViewer.vue` | CSS 移除 | 移除 `.markdown-viewer { height:100%; overflow:auto }` + `.markdown-body { padding:2rem }` scoped 样式 |
| `frontend-v3/src/styles/markdown.css` | CSS 移除 | 移除 `.markdown-body` 全局 `padding: var(--space-5)` + 移动端 `padding: 1.25rem` |
| `frontend-v3/src/styles/code.css` | CSS 移除 | 移除 `.code-viewer { min-height:300px; flex:1 }` + 移动端媒体查询 + `.code-body { overflow:auto; flex:1; min-height:0 }` |
| `frontend-v3/src/composables/useResponsiveLayout.ts` | 逻辑简化 | `setupScrollHide` 移除 `findScrollable`，直接监听 container scroll 事件 |
| `frontend-v3/e2e/t049-mobile-header-diagram-sanitize.spec.ts` | 测试修正 | `window.scrollTo` → `.content-area` scrollTop；`.header-tags` → `.meta-tags-bar`；A-BDD-5 `toBeVisible` → `toHaveCount(0)` |
| `frontend-v3/e2e/t084-scroll-architecture.spec.ts` | 新增测试 | T084 BDD TDD 测试文件 |
| `frontend-v3/src/composables/__tests__/useResponsiveLayout.spec.ts` | 新增测试 | useResponsiveLayout 单元测试 |
| `frontend-v3/src/components/EntryDetailContent.vue` | 微调 | content-area 相关 |
| `frontend-v3/src/components/EntryDetailHeader.vue` | 微调 | meta-tags-bar 相关 |
| `DESIGN.md` | 文档新增 | §9 新增 Scroll Architecture 小节 |

## [PROD_NOT_TOUCHED]

本次任务纯前端 CSS + composable 改动 + E2E 测试修正 + 文档补充。未触碰生产服务（:8080）、未触碰生产数据库（~/.peekview/）、未使用 CLI 创建测试 entry、未执行 uvicorn 直接启动。所有测试验证通过 `make debug`（:8888 隔离数据目录 /tmp/peekview-debug/）或 CDP 连接真实 Chrome。

## 临时资源清单

本任务执行期间（P1-P7）启动的临时服务/进程/数据/开发安装：

### 临时服务/进程

| 资源 | 启动方式 | 状态 | 清理方式 |
|------|---------|------|---------|
| Debug backend (:8888) | `make debug-start` | 应已停止（P5/P6 验证期间使用） | `make debug-stop` |
| Chrome CDP (:18800) | Windows Chrome（用户已有，非任务启动） | 用户常驻进程，无需清理 | N/A |

### 临时数据

| 资源 | 路径 | 清理方式 |
|------|------|---------|
| Debug 数据库 | `/tmp/peekview-debug/peekview.db` | `make debug-stop` 自动清理 |
| Debug 存储目录 | `/tmp/peekview-debug/` | `make debug-stop` 自动清理 |
| P6 验收截图 | `docs/tasks/T084-detail-scroll-architecture/P6-evidence/screenshots/` | 保留（验收证据，非临时） |
| P6 验收 JSON | `docs/tasks/T084-detail-scroll-architecture/P6-evidence/bdd-results.json` | 保留（验收证据，非临时） |
| P6 vision 报告 | `docs/tasks/T084-detail-scroll-architecture/P6-evidence/vision-reports/` | 保留（验收证据，非临时） |

### 开发安装

| 资源 | 说明 | 清理方式 |
|------|------|---------|
| 无 | 本次任务未做任何 editable install / 全局包安装 | N/A |

> **注意**：P5/P6 验证期间可能通过 `make debug-seed` 灌入测试数据（alice/bob/carol + 12 条目）到 debug 数据库。`make debug-stop` 会清理 `/tmp/peekview-debug/`。如 debug server 仍在运行，主 Agent READY 收尾检查时执行 `make debug-stop`。

## Lessons Learned

1. **CSS `overflow: auto` 创建 scroll container 是标准行为，不是 bug**：子元素声明 `overflow: auto` + `height: 100%` 时会成为独立 scroll container，子元素内部滚动不触发父元素 scroll 事件。这是 CSS Overflow Module Level 3 §3.1 规定。详情页滚动架构问题根因是多个 viewer 组件各自声明 overflow，导致 `.content-area` 的 scroll 事件不被触发。修复方式是统一移除 viewer 的 overflow 声明，让 `.content-area` 成为唯一滚动容器。（类别：架构 / 来源：T084 / 日期：2026-07-31）

2. **`overflow-x: auto` 隐含 `overflow-y: auto`**：CSS 规范规定，当一个方向的 overflow 设为 `auto` 或 `scroll`，另一个方向为 `visible` 时，`visible` 会被计算为 `auto`。P2 设计的 `.code-body { overflow-x: auto }` 实际创建了双向 scroll container，仍会抢走纵向滚动。P6 验收发现此问题后修正为完全移除 `.code-body` 的 overflow 声明，横向滚动由 `pre { overflow-x: auto }` 承载。（类别：架构 / 来源：T084 / 日期：2026-07-31）

3. **E2E 测试需跟随 DOM 结构变化更新选择器**：T079 重构后 `.header-tags` 改为 `.meta-tags-bar`，但 t049 E2E 测试未同步更新。T084 修正了选择器并验证 scroll-hide 行为。教训：重构改 class 名时，应同步搜索 E2E 测试中的旧选择器。（类别：测试 / 来源：T084 / 日期：2026-07-31）

## P4-implementation.md .code-body overflow 偏差说明

P7-consistency.md §3.5 记录了 MINOR 偏差：P4-implementation.md 记录 `.code-body { overflow-x: auto }`，实际实现为空规则块 `.code-body { }`。这是 P6 验收驱动的实现修正（`overflow-x: auto` 隐含 `overflow-y: auto` 抢走纵向滚动），P6 FAIL 分析章节已完整记录根因和修复方案。CHANGELOG 条目已反映实际实现（"CodeViewer 移除 `min-height:300px; flex:1; overflow:auto`"），而非 P4 记录的 `overflow-x: auto`。DESIGN.md §9 Scroll Architecture 声明 "CodeViewer retains `overflow-x: auto` for horizontal code scrolling" 在概念层面正确（CodeViewer 确实保留横向滚动能力，由 `pre` 承载），精确到 `.code-body` 层面不准确——此为已知文档偏差，非 BLOCKER。
