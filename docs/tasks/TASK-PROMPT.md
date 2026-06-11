# Agent 新任务执行提示词（完整版）

> 当你有一个新需求时，把这个提示词发给 Agent，它会自动按 workflow-v2 流程执行。

---

```
# 新任务启动

## 你的任务

我有一个新需求，请按照 `docs/process/workflow-v2.md` 定义的流程来执行。

## 执行步骤（Agent 自动执行）

### 第 1 步：读取流程规范

首先读取以下文件，理解流程规范：
- `docs/process/workflow-v2.md`
- `docs/tasks/active-tasks.md`（任务看板）

### 第 2 步：确定任务编号

从 `docs/tasks/active-tasks.md` 中找到当前最大任务编号，下一个编号 = 最大编号 + 1

### 第 3 步：创建任务目录

```bash
mkdir -p docs/tasks/T{xxx}-{task-name}/
```

### 第 4 步：创建 P1-problems.md

根据我提供的需求，创建 `P1-problems.md`，包含以下内容：

```yaml
---
phase: P1
task_id: T{xxx}
task_name: {task-name}
type: problems
trace_id: T{xxx}-P1-{日期}
created: {日期}
status: draft
parent: {需求来源描述}
---

# 问题定义：{任务名称}

## 原始需求
（把你收到的需求粘贴在这里）

## 期望行为
（描述期望的结��）

## 验收标准
- [ ] 标准1
- [ ] 标准2
- [ ] 标准3
```

### 第 5 步：更新任务看板

在 `docs/tasks/active-tasks.md` 的任务列表中添加一行：

```markdown
| T{xxx} | {task-name} | ⬜ 待开始 | P1 | P{0-3} | {日期} | {日期} |
```

### 第 6 步：继续执行 P1 剩余工作

创建 `P1-test-strategy.md`，定义测试策略：

```yaml
---
phase: P1
task_id: T{xxx}
task_name: {task-name}
type: test_strategy
trace_id: T{xxx}-P1-{日期}
created: {日期}
status: draft
parent: T{xxx}/P1-problems.md
---

# 测试策略

| 验收标准 | 测试类型 | 测试文件/方法 |
|----------|----------|---------------|
| 标准1    | 单元测试 / 手工验证 | test_xxx.py / manual-checklist.md |
| 标准2    | 单元测试 / E2E      | test_yyy.ts       |
```

### 第 7 步：更新看板状态

完成后更新 `docs/tasks/active-tasks.md`：
- 状态：待开始 → 进行中
- 阶段：P1
- 更新日期：今天

---

## 完整示例

假设我的需求是："给 PeekView ���加深色主题支持"

你执行后的结果应该是：

```
✅ 任务已创建

任务编号：T002
任务名称：dark-theme-support

产出文件：
- docs/tasks/T002-dark-theme-support/
  ├── P1-problems.md       # 问题定义
  └── P1-test-strategy.md  # 测试策略

任务看板已更新：
| T002 | dark-theme-support | 🔄 进行中 | P1 | P2 | 2026-06-11 | 2026-06-11 |

现在进入 P2 阶段吗？
```

---

## 关键约束

1. **每个文件必须有 Header**：phase, task_id, parent, trace_id
2. **任务编号自动递增**：不能手动指定，必须从看板读取最大编号+1
3. **任务目录必须在 docs/tasks/ 下**
4. **完成后必须更新看板**

## 需求格式

请按以下格式提供需求：

```
## 需求内容
（描述你的需求）

## 期望结果
（描述你希望看到的结果）

## 优先级
（P0/P1/P2/P3）
```

现在开始执行！