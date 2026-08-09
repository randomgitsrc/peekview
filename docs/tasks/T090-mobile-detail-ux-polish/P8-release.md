---
phase: P8
task_id: T090-mobile-detail-ux-polish
type: release
parent: P7-consistency.md
trace_id: T090-P8-20260810
status: draft
created: 2026-08-10
agent: implementer
---

# P8-release — T090 移动端详情页 UX 打磨 发布准备

## 1. bump_type 判断

```yaml
bump_type: patch
packages_to_bump: [peekview]
current_version: "0.18.0"
target_version: "0.18.1"
```

### 理由

- P2-design.md §0 声明 `packages: [frontend-v3]`，P7-consistency.md §3.1 逐文件核对 P4 实际改动清单（`EntryMetaTagsBar.vue` 新增 + `useResponsiveLayout.ts`/`EntryDetailHeader.vue`/`EntryDetailContent.vue`/`EntryDetailMobileBar.vue`/`EntryDetailView.vue`/`MarkdownViewer.vue`/`variables.css` 修改 + 2 个测试文件删除 + 1 个测试文件修改）全部落在 `frontend-v3/` 内，唯一例外 `DESIGN.md` 已被 P1/P2 双重显式声明为文档类例外（纯文字同步，不产生代码行为）。核实成立：本次改动只影响 `frontend-v3`，对应 `peekview` 主包的前端部分，`packages/mcp-server/` 未被触碰，`VERSIONS.json` 的 `mcp_server: 0.10.0` 不应改动。
- bump_type 判定核实：本任务是 3 处既有 UI/交互缺陷的修复——①`meta-tags-bar` 滚动隐藏导致跳变（改为随内容流渲染）②底部操作栏 `EntryDetailMobileBar.vue` 定位不稳定（补齐 `position: fixed`，DESIGN.md 早已声明该行为，本次是补齐实现使其与既有设计文档一致，非新设计）③Markdown 正文移动端边距三层叠加过大（缩减为单层）。三处改动均：
  - 不新增用户可见能力（无新按钮/新页面/新数据字段）；
  - 不改变任何对外 API（后端零改动，前端组件对外 props/事件契约未变，仅组件内部实现 + CSS + 一次跨组件重构：`meta-tags-bar` 从 `EntryDetailHeader.vue` 抽到独立组件 `EntryMetaTagsBar.vue` 挂载在 `EntryDetailContent.vue` 内，属于内部重构非对外接口变化）；
  - `DESIGN.md` 文字变更（`### Scroll-Hide Meta Bar` → `### Meta Tags Bar (Mobile)`）是描述既有设计意图被修复后代码行为的文档同步，不构成"新增设计规范"（P7-consistency.md 已核实该章节修订与 P2 §3.1 定稿文字一致）。
  - 符合 AGENTS.md「修 bug / 不改 API 行为 → patch」惯例，dispatch-context 倾向判断成立，无需上调为 minor。

## 2. 发布前检查结果

| 命令 | 结果 |
|------|------|
| `make lint` | 通过（`ruff check peekview/ tests/` → `All checks passed!`） |
| `make typecheck` | 通过（`vue-tsc --noEmit` → `✓ type check passed`） |

未执行 `make pre-publish-quick`/`make pre-publish`/`make bump-version`/`make publish`——按 dispatch-context 指示，这些由主 Agent 在 gate 验证通过后亲自执行。P5/P6 阶段已分别独立跑过完整测试套件（vitest 92/92 文件 1215/1215 测试、E2E 12/12 BDD、vue-tsc 全过），本次仅重跑 lint/typecheck 确认无退化，未发现退化。

## 3. CHANGELOG.md 更新确认

`## [Unreleased]` 下原有 3 条 T090 记录（顶部标签/信息条随内容滚动、底部操作栏固定定位+安全区适配、Markdown 正文边距缩减）已整体移动到新增的 `## [0.18.1] - 2026-08-10` 段落下，内容原样保留未改写，仅移动位置 + 补版本号 + 日期。`## [Unreleased]` 标题保留在其上方，当前为空，供后续任务继续写入。此为工作区改动，未 commit。

## 4. 临时资源清单（供主 Agent READY 收尾清理参考）

### 4.1 调试服务

- debug backend：`127.0.0.1:8888`（进程 PID 2568699，`backend/.venv/bin/python -m uvicorn peekview.main:get_app --factory`），本任务 P2-P6 全程使用，产出本文档时仍在运行，**未停止**——需主 Agent 执行 `make debug-stop` 清理。
- Playwright CDP：`localhost:18800`（连接现有 Chrome，P2 assumption 验证 + P6 验收使用），非独立进程，随 Chrome 生命周期，无需单独清理。

### 4.2 调试数据（`/tmp/peekview-debug/peekview.db`）

- dispatch-context 列出的 4 个基础 seed entry：`t090-long-markdown`、`t090-long-code`、`t090-md-multifile`、`t090-py-multifile`。
- **额外发现**（核实时 `sqlite3 /tmp/peekview-debug/peekview.db "SELECT slug FROM entries WHERE slug LIKE 't090%'"` 实测，非仅凭 dispatch-context 记忆）：debug 库中实际存在 **121 条** `t090*` slug 的 entry，远超 4 条基础条目。原因是多轮 E2E/手动验证过程中重复调用创建接口触发 slug 冲突自动重命名（`t090-long-code` → `t090-long-code-2` → `t090-long-code-2-2` → … 逐层叠加后缀，四组各累加到 24-25 层），另有 1 条 `t090-verify`（P2 assumption 验证遗留的手动探测 entry，非 4 个基础 seed 之一）。
- 全部数据位于 `/tmp/peekview-debug/peekview.db`，与生产库 `~/.peekview/peekview.db` 物理隔离，未触碰生产环境（`[PROD_NOT_TOUCHED]`）。
- 清理方式：`make debug-stop` 会整体清理 `/tmp/peekview-debug/` 目录（含 db/db-shm/db-wal/data），无需逐条 `peekview delete`（这些是 debug 库数据非生产库，AGENTS.md 铁律 5/6 的「严禁 sqlite3 直接操作 / 严禁 CLI 创建测试 entry」约束目标是生产库，debug 库整体删除目录是标准清理方式）。

### 4.3 开发安装

- 本任务全程未执行任何 `pip install`/`npm link`/CLI 全局安装类操作；后端改动为 0（纯前端），`backend/.venv` 无需特殊清理（随 `make debug-stop`/正常开发流程管理）。
- 前端未新增依赖（`package.json`/`package-lock.json` 未见改动，P4/P7 改动清单均为既有依赖范围内的组件重构）。

### 4.4 端口占用

- `127.0.0.1:8888`（debug backend）：随 `make debug-stop` 释放。
- `localhost:18800`（Chrome CDP）：非本任务独占，长期驻留供其他任务复用，不属于本任务需清理范围。

## 5. 未执行操作确认

本 releaser 全程未执行：`make bump-version`、`git commit`、`git tag`、`make publish`。`VERSIONS.json` 未修改（仍为 `peekview: 0.18.0`），等待主 Agent 在 gate 通过后亲自执行 `make bump-version NEW_VERSION=0.18.1`。
