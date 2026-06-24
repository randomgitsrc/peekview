# 任务看板 (Task Board)

> PeekView 项目任务管理主文件
> **核心原则**：所有任务必须走 [agate](https://github.com/randomgitsrc/agate) 流程（P0-P8），每个阶段有文件产出
> **位置**：`docs/tasks/` 目录下每个任务一个子目录

---

## 任务列表

### 进行中的任务

| 序号 | 任务名称 | 状态 | 阶段 | 优先级 | 创建日期 | 更新日期 |
|------|----------|------|------|--------|----------|----------|
| T020 | svg-codeblock-viewer | 🔄 进行中 | P3 | 🟠 | 2026-06-24 | 2026-06-24 |
| T021 | zen-mode | 🔄 进行中 | P0 | 🟡 | 2026-06-24 | 2026-06-24 |

### 待开始

| 序号 | 任务名称 | 状态 | 阶段 | 优先级 | 依赖 | 创建日期 | 更新日期 |
|------|----------|------|------|--------|------|----------|----------|

### 已完成

| 序号 | 任务名称 | 状态 | 最终阶段 | 优先级 | 完成日期 |
|------|----------|------|----------|--------|----------|
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

必��包含以下 Header 字段：

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
| 2026-06-24 | 创建 T021 | zen-mode 立项，P0-brief 已写（详情页 f 键专注模式） |
| 2026-06-23 | 完成 T019 | html-viewer-srcdoc-csp v0.1.65 发布到 PyPI |
| 2026-06-21 | 完成 T018 | plantuml-start-markers v0.1.64 发布到 PyPI |
| 2026-06-21 | 完成 T017 | theme-media-query-fix v0.1.63 发布到 PyPI |
| 2026-06-20 | 完成 T016 | plantuml-rendering v0.1.62 发布到 PyPI |
| 2026-06-20 | 创建 T016 | plantuml-rendering 立项，P0-brief 已写，原型验证通过（路线 A 确定可行） |
| 2026-06-11 | 创建 | 初始版本，基于 workflow-v2 |
