# 任务看板 (Task Board)

> PeekView 项目任务管理主文件
> **核心原则**：所有任务必须走 [agate](https://github.com/randomgitsrc/agate) 流程（P0-P8），每个阶段有文件产出
> **位置**：`docs/tasks/` 目录下每个任务一个子目录

---

## 任务列表

### 进行中的任务

| 编号 | 任务名称 | 状态 | 阶段 | 优先级 | 依赖 | 创建日期 | 更新日期 |
|------|----------|------|------|--------|------|----------|----------|
| T068 | account-settings | 🔄 进行中 | P3 | 🟠 | 无 | 2026-07-22 | 2026-07-23 |

### 待开始

| 编号 | 任务名称 | 状态 | 阶段 | 优先级 | 依赖 | 创建日期 | 更新日期 |
|------|----------|------|------|--------|------|----------|----------|
| T052 | entry-detail-header-redesign | ✅ 完成 | DONE | 🟠 | T051 | 2026-07-10 | 2026-07-10 |
| T031 | cold-open-performance | ✅✅ 已完成 | P8→v0.10.0 | 🔴 | 无 | 2026-06-29 | 2026-07-22 |
| T035 | ci-publish-pipeline | ⬜ 待开始 | P0 | 🟡 | 无 | 2026-06-29 | 2026-06-29 |
| T053 | agent-raw-discovery | ✅ READY | READY | 🔴 | P8 裁剪（internal_only） | 2026-07-12 | 2026-07-13 |
| T054 | api-safety-idempotency | ✅✅ 已完成 | P8→v0.6.3 | 🔴 | 无 | 2026-07-14 | 2026-07-14 |
| T055 | admin-backup-export | ✅✅ 已完成 | P8→v0.7.0 | 🔴 | 无 | 2026-07-14 | 2026-07-17 |
| T056 | prometheus-metrics | ✅✅ 已完成 | P8→v0.8.0 | 🟡 | 无 | 2026-07-14 | 2026-07-17 |
| T058 | overflow-share-redesign | ✅✅ 已完成 | P8→v0.9.0 | 🟠 | 无 | 2026-07-16 | 2026-07-17 |
| T059 | markdown-extensions | ✅✅ 已完成 | P8→v0.9.3 | 🟠 | 无 | 2026-07-20 | 2026-07-20 |
| T060 | archived-visibility-auth-refresh | ✅✅ 已完成 | P8→v0.9.4 | 🟠 | 无 | 2026-07-21 | 2026-07-21 |
| T061 | t032-probe-data-review | ⬜ 待开始 | P0 | 🔴 | 无 | 2026-07-21 | 2026-07-21 |
| T062 | entry-reference-fields | ⬜ 待开始 | P0 | 🟠 | T061 | 2026-07-21 | 2026-07-21 |
| T063 | task-category-field | ⬜ 待开始 | P0 | 🟠 | 无 | 2026-07-21 | 2026-07-21 |
| T064 | storage-backend-abstraction | ⬜ 待开始 | P0 | 🟡 | 商业化决策 | 2026-07-21 | 2026-07-21 |
| T065 | login-state-bug | ✅✅ 已完成 | P8→v0.9.5 | 🔴 | 无 | 2026-07-22 | 2026-07-22 |
| T066 | explore-card-display-config | ⬜ 待开始 | P0 | 🟠 | T031 | 2026-07-22 | 2026-07-23 |
| T067 | detail-page-framework | ✅✅ 已完成 | P8→v0.10.1 | 🟠 | T065 | 2026-07-22 | 2026-07-23 |
| T068 | account-settings | ⬜ 待开始 | P0 | 🟠 | 无 | 2026-07-22 | 2026-07-22 |

### 已完成

| 编号 | 任务名称 | 状态 | 最终阶段 | 优先级 | 完成日期 |
|------|----------|------|----------|--------|----------|
| T048 | entry-lifecycle | ✅✅ 已完成 | P8→v0.5.4 | 🟠 | 2026-07-07 |
| T049 | mobile-header-diagram-sanitize | ✅✅ 已完成 | P8→v0.5.5 | 🟠 | 2026-07-08 |
| T050 | mobile-header-diagram-sanitize-fix | ✅✅ 已完成 | P8→v0.5.6 | 🟠 | 2026-07-08 |

### 已完成

| 序号 | 任务名称 | 状态 | 最终阶段 | 优先级 | 完成日期 |
|------|----------|------|----------|--------|----------|
| T047 | content-link-fix | ✅✅ 已完成 | P8→v0.5.3 | 🔴 | 2026-07-05 |
| T046 | content-link-resolution | ❌ 失败 | P8→FAILED | 🔴 | 2026-07-05 |
| T044 | frontend-interaction-fixes | ✅✅ 已完成 | P6→v0.5.1 | 🟠 | 2026-07-01 |
| T045 | code-block-rendering-fix | ✅✅ 已完成 | P6→v0.5.2 | 🟠 | 2026-07-01 |
| T020 | svg-codeblock-viewer | ✅✅ 已完成 | P8→v0.2.4 | 🟠 | 2026-06-28 |
| T023 | page-basics | ✅✅ 已完成 | P6 | 🟠 | 2026-06-28 |
| T025 | user-page | ✅✅ 已完成 | P7 | 🟠 | 2026-06-28 |
| T024 | landing-page | ✅✅ 已完成 | P8→v0.2.5 | 🟠 | 2026-06-28 |
| T026 | search-url | ✅✅ 已完成 | P8→v0.3.0 | 🟡 | 2026-06-28 |
| T027 | share-link | ✅✅ 已完成 | P8→v0.3.0 | 🟠 | 2026-06-29 |
| T028 | frontend-design-system-refactor | ✅✅ 已完成 | P8→v0.3.1 | 🟠 | 2026-06-29 |
| T029 | card-list-layout-polish | ✅✅ 已完成 | P8→v0.4.0 | 🟠 | 2026-06-30 |
| T030 | frontend-interaction-enhancements | ✅✅ 已完成 | P8→v0.4.0 | 🟡 | 2026-06-30 |
| T032 | entry-read-tracking | ✅✅ 已完成 | P8→v0.4.0 | 🟡 | 2026-06-30 |
| T033 | share-semantic-security-fixes | ✅✅ 已完成 | P8→v0.4.0 | 🟡 | 2026-06-30 |
| T036 | detail-info-completeness | ✅✅ 已完成 | P8→v0.4.0 | 🟠 | 2026-06-30 |
| T037 | search-content-expansion | ✅✅ 已完成 | P6→v0.5.0 | 🟡 | 2026-06-30 |
| T038 | csharp-highlight-description-api | 🔀 已合并 | →T040 | 🟡 | 2026-06-30 |
| T039 | explore-ui-polish | ✅✅ 已完成 | P6→v0.5.0 | 🟠 | 2026-06-30 |
| T040 | shiki-language-coverage | ✅✅ 已完成 | P6→v0.5.0 | 🟡 | 2026-06-30 |
| T041 | html-sibling-inject-fix | ✅✅ 已完成 | P6→v0.5.0 | 🟡 | 2026-06-30 |
| T042 | html-module-script-inject | 🔀 已合并 | →T041 | 🔴 | 2026-06-30 |
| T043 | html-inject-ux-polish | 🔀 已合并 | →T041 | 🟡 | 2026-06-30 |
| T001 | mcp-namespace-map | ✅✅ 已完成 | P8 | 🟠 | 2026-06-15 |
| T002 | fix-db-migration | ✅✅ 已完成 | P7 | 🔴 | 2026-06-12 |
| T003 | csp-captcha-wasm | ❌ 已取消 | P1 | 🟠 | 2026-06-12 |
| T004 | captcha-wasm-root-cause | ✅✅ 已完成 | P6 | 🟠 | 2026-06-12 |
| T005 | admin-perm-fix | ✅✅ 已完成 | P5 | 🔴 | 2026-06-13 |
| T006 | admin-stats-cleanup | ✅✅ 已完成 | P5 | 🟠 | 2026-06-13 |
| T007 | entry-raw-api | ✅✅ 已完成 | P6 | 🟠 | 2026-06-14 |
| T008 | mcp-stateless | ✅✅ 已完成 | P8 | 🟠 | 2026-06-14 |
| T009 | raw-shortlink | ✅✅ 已完成 | P8 | 🟡 | 2026-06-15 |
| T010 | apikey-local | ✅✅ 已完成 | P8 | 🔴 | 2026-06-15 |
| T011 | user-management | ✅✅ 已完成 | P8 | 🔴 | 2026-06-16 |
| T014 | mcp-namespace-cli | ✅✅ 已完成 | P8 | 🔴 | 2026-06-16 |
| T015 | mcp-config-verify | ✅✅ 已完成 | P8 | 🟠 | 2026-06-16 |
| T016 | plantuml-rendering | ✅✅ 已完成 | P8 | 🟠 | 2026-06-20 |
| T017 | theme-media-query-fix | ✅✅ 已完成 | P8 | 🟠 | 2026-06-21 |
| T018 | plantuml-start-markers | ✅✅ 已完成 | P8 | 🟠 | 2026-06-21 |
| T019 | html-viewer-srcdoc-csp | ✅✅ 已完成 | P8 | 🔴 | 2026-06-23 |
| T021 | zen-mode | ✅✅ 已完成 | P8 | 🟡 | 2026-06-25 |
| T022 | diagram-renderer-refactor | ❌ 已回退 | P8→REVERTED | 🟠 | 2026-06-26 |

> **依赖列说明**：主 Agent 启动任务前检查依赖列。所有依赖任务状态为 ✅✅ 已完成 才启动。
> **active-tasks.md 降级为汇总视图**：不再由 subagent 直接修改，由主 Agent 扫描所有 `.state.yaml` 重建。消除多 Agent 并发 git 冲突。

---

## 状态说明

| 状态 | 符号 | 定义 | 触发条件 |
|------|------|------|----------|
| **待开始** | ⬜ | 任务已创建，P1 尚未开始 | 任务目录 + P1 文件已创建 |
| **进行中** | 🔄 | 正在执行某个阶段 | 正在执行 P1-P7 中��某个阶段 |
| **暂停** | ⏸️ | 被阻塞，等待外部条件 | 等待评审/用户确认/外部依赖 |
| **待验证** | ⏳ | 阶段完成，等待评审或验证 | P2 评审完成 / P5 验证完成 |
| **失败** | ❌ | 评审不通过或验证失败 | P2 评审 rejected / P5 有失败项 |
| **已完成** | ✅✅ | P7 发布完成 | 已生成 P7-release.md |

---

## 阶段说明

| 阶段 | 名称 | 门槛 | 产出文件 |
|------|------|------|----------|
| P1 | 问题定义 | 无 | `P1-problems.md`, `P1-test-strategy.md` |
| P2 | 方案设计+评审 | review.status=approved | `P2-design.md`, `P2-review.md` |
| P3 | 测试设计（TDD）| 真红灯（assertion failure，非import error）| `P3-test-cases.md`, `P3-test-code/` |
| P4 | 代码实现 | 无 | `P4-implementation/` |
| P5 | 逐项验证 | 所有测试通过 | `P5-test-results/unit.md`, `P5-test-results/manual.md` |
| P6 | 一致性检查 | 无 | `P6-consistency.md` |
| P7 | 发布 | 无 | `P7-release.md` |

---

## 优先级说明

| 优先级 | 符号 | 定义 |
|--------|------|------|
| P0 | 🔴 | 紧急/阻塞性问题，必须立即处理 |
| P1 | 🟠 | 近期需要完成，影响功能发布 |
| P2 | 🟡 | 中期规划，可以安排在当前迭代 |
| P3 | 🟢 | 长期改进，可以后续处理 |

---

## 重试追踪

> agate 要求：每阶段独立计数，落盘防丢失

| 任务 | 阶段 | 重试次数 | 上限 | 最后失败原因 |
|------|------|----------|------|-------------|
| T002 | P3 | 0 | 3 | — |

---

## 任务目录结构规范

```
docs/tasks/
├── active-tasks.md          # 本文件：任务看板
├── T001-xxx/
│   ├── P1-problems.md       # 必选
│   ├── P1-test-strategy.md  # 必选
│   ├── P2-design.md         # 必选
│   ├── P2-review.md         # 必选（评审后）
│   ├── P3-test-cases.md     # 必选
│   ├── P3-test-code/        # 可选（至少1个测试文件）
│   ├── P4-implementation/   # 必选（至少1个代码文件）
│   ├── P5-test-results/     # 必选
│   │   ├── unit.md
│   │   ├── manual.md
│   │   └── evidences/       # 截图证据
│   ├── P6-consistency.md    # 必选
│   ├── P7-release.md        # 必选
│   └── TRACEBILITY.md       # 可选（追溯总览）
└── T002-yyy/
    └── ...
```

---

## 任务创建流程

### 步骤 1：确定任务编号

读取本文件，找到当前最大序号，下一个编号 = 最大序号 + 1

```bash
# 查看当前最大序号
grep -E '^\| T[0-9]+' docs/tasks/active-tasks.md | tail -1
```

### 步骤 2：创建任务目录

```bash
mkdir -p docs/tasks/T{xxx}-{task-name}
```

### 步骤 3：创建 P1 文件

必须包含以下 Header 字段：

```yaml
---
phase: P1
task_id: T001
task_name: mcp-namespace-map
type: problems
trace_id: T001-P1-20250611
created: 2026-06-11
status: draft
parent: (外部需求或 Bug 报告来源)
---
```

### 步骤 4：更新任务看板

在本文件的"任务列表"表格中添加一行：

```markdown
| T001 | mcp-namespace-map | ⬜ 待开始 | P1 | P1 | 2026-06-11 | 2026-06-11 |
```

---

## 任务状态更新规则

### 阶段完成时更新

| 阶段完成 | 状态变化 | 需更新的列 |
|----------|----------|------------|
| P1 → P2 | 进行中 | 阶段: P2 |
| P2 评审通过 | 待验证 → 进行中 | 状态: 🔄 进行中, 阶段: P3 |
| P2 评审不通过 | 失败 | 状态: ❌ 失败 |
| P3 → P4 | 进行中 | 阶段: P4 |
| P4 → P5 | 进行中 | 阶段: P5 |
| P5 全部通过 | 待验证 → 进行中 | 状态: 🔄 进行中, 阶段: P6 |
| P5 有失败 | 失败 | 状态: ❌ 失败 |
| P6 → P7 | 进行中 | 阶段: P7 |
| P7 完成 | 已完成 | 状态: ✅✅ 已完成 |

### 更新示例

```markdown
# 修改前
| T001 | mcp-ns-map | 🔄 进行中 | P5 | P1 | 2026-06-10 | 2026-06-10 |

# P1 完成，进入 P2 后
| T001 | mcp-ns-map | 🔄 进行中 | P5 | P1 | 2026-06-10 | 2026-06-11 |

# P2 评审通过，进入 P3 后
| T001 | mcp-ns-map | 🔄 进行中 | P5 | P1 | 2026-06-10 | 2026-06-11 |
```

---

## 快速入口

- **流程规范**: `~/.agate/WORKFLOW.md`（[agate](https://github.com/randomgitsrc/agate)）
- **任务目录**: `docs/tasks/Txxx-xxx/`
- **评审记录**: `docs/reviews/`
- **项目索引**: `INDEX.md`
- **变更记录**: `CHANGELOG.md`

---

## 更新日志

| 日期 | 操作 | 内容 |
|------|------|------|
| 2026-07-23 | 完成 T067 | detail-page-framework → v0.10.1 发布（品牌字标+Sign in入口+Explore导航+zen mode修复+reads统一+底栏文案修正） |
| 2026-07-22 | P0 审计纠正 + T066 deferred + T068 立项 | 代码核查纠正 brief 错误断言：T065 删"T060 回归"（watcher predates T060，LandingView:19 Sign in 无 authState 绑定是既有缺口）/ T067 收窄"无品牌/无tooltip"（桌面已有 logo+tooltip，真缺口是 Sign in/字标/导航/移动端）/ T066 发现 summary=标题术语冲突+reads 需后端→范围方向反→defer backlog / T068 account-settings 立项（Profile+改密码+API Keys hub，暴露 T011 已有后端能力，新增 PATCH /auth/me）|
| 2026-07-22 | 创建 T065/T066/T067 + 重写 T031 | 冷打开审计后续拆分：T065 登录状态 bug（疑似 T060 回归）/ T066 卡片显示站点级配置（照抄 PeekDiagram）/ T067 详情页框架（品牌条+Sign in 绑定）；T031 重写为 explore 性能+交互（并行加载+卡片真链接+显示打磨）。执行顺序 T065→T031→T066→T067 |
| 2026-07-09 | 创建 T051 | T048 生命周期缺口修复（定时清理/archived筛选/过期警告） |
| 2026-07-08 | 创建 T050 | T049 问题归零修复（config_get bug + 规则系统补充 + 移动端 header 布局） |
| 2026-07-08 | 完成 T049 | mobile-header-diagram-sanitize → v0.5.5 发布到 PyPI（移动端 header 滚动 + Diagram 源码清洗 + 统一错误 UI） |
| 2026-07-08 | 创建 T049 | mobile-header-diagram-sanitize 立项 — 移动端 header 滚动收缩 + 图表源码自动清洗 |
| 2026-07-07 | 完成 T048 | entry-lifecycle v0.5.4 发布到 PyPI（两阶段生命周期+PATCH expires_in+archived UI） |
| 2026-07-05 | 完成 T047 | content-link-fix v0.5.3 发布到 PyPI（后端 Content-Type 三级 fallback + 前端 path-map 路径重写） |
| 2026-07-05 | T046 失败 | content-link-resolution 宣告失败，后端 Content-Type 返回 text/plain 导致图片不渲染 |
| 2026-07-05 | 创建 T047 | content-link-fix P0-brief — 从 T046 失败复盘中恢复：修复后端 Content-Type + 恢复前端重写 |
| 2026-06-30 | 合并精简 | T042+T043→T041（html-sibling-inject-fix）；T040 改为按需动态加载；删除 T038/T042/T043 目录 |
| 2026-06-30 | 创建 T039-T043 | 问题重组：T038→T040（Shiki 语言覆盖）；T037 HTML 部分拆出→T041/T042/T043；新增 T039（Explore UI 修正）。实测发现 sandbox 缺 allow-forms（🔴）+ module script 注入失效（🔴） |
| 2026-06-26 | 完成 T022 | diagram-renderer-refactor v0.2.0 发布到 PyPI（frontend-only 重构 + 行为保真 9 维度） |
| 2026-06-25 | 创建 T024-T027 | 路由/页面/分享批任务 P0 全部立项完成（T024 Landing / T025 用户公开页 / T026 搜索 URL 化 / T027 临时分享链接） |
| 2026-06-25 | 创建 T023 | page-basics 立项，P0-brief 已写（删 HomeView 僵尸 + 404 兜底，路由/页面批任务依赖链根） |
| 2026-06-25 | 创建 T022 | diagram-renderer-refactor 立项，P0-brief 已写（Markdown 渲染管线重构，B+温和C路线） |
| 2026-06-24 | 创建 T021 | zen-mode 立项，P0-brief 已写（详情页 f 键专注模式） |
| 2026-06-23 | 完成 T019 | html-viewer-srcdoc-csp v0.1.65 发布到 PyPI |
| 2026-06-21 | 完成 T018 | plantuml-start-markers v0.1.64 发布到 PyPI |
| 2026-06-21 | 完成 T017 | theme-media-query-fix v0.1.63 发布到 PyPI |
| 2026-06-20 | 完成 T016 | plantuml-rendering v0.1.62 发布到 PyPI |
| 2026-06-20 | 创建 T016 | plantuml-rendering 立项，P0-brief 已写，原型验证通过（路线 A 确定可行） |
| 2026-07-21 | 创建 T060 | archived-visibility-auth-refresh — 归档条目可见性策略修正 + 登录退出内容刷新 |
| 2026-06-11 | 创建 | 初始版本，基于 workflow-v2 |
