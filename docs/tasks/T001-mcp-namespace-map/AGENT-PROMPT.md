# Agent 任务执行提示词模板

> 给主 Agent（编排者）的提示词模板
> **使用方法**：复制下方模板，填充任务信息后发送给 Agent

---

## 模板：启动新任务

```
# 任务执行

## 背景

请根据 workflow-v2 流程规范执行任务。

## 任务信息

- **任务编号**: T001
- **任务名称**: mcp-namespace-map
- **当前阶段**: P2（方案设计+评审已完成，等待进入 P3）
- **流程规范**: `docs/process/workflow-v2.md`
- **任务目录**: `docs/tasks/T001-mcp-namespace-map/`

## 已完成的阶段产出

### P1 问题定义
- 文件: `docs/tasks/T001-mcp-namespace-map/P1-problems.md`
- 状态: ✅ 完成

### P2 方案设计+评审
- 方案设计: `docs/tasks/T001-mcp-namespace-map/P2-design.md`
- 评审记录: `docs/tasks/T001-mcp-namespace-map/P2-review.md`
- 评审结论: ✅ 通过（status: approved）
- 状态: ✅ 完成

## 你需要执行的阶段

### P3: 测试设计（TDD）

**目标**：设计测试用例，编写单元测试（当前应该失败）

**输入文件**：
- `docs/tasks/T001-mcp-namespace-map/P1-problems.md`
- `docs/tasks/T001-mcp-namespace-map/P2-design.md`
- `docs/process/workflow-v2.md`

**必须产出的文件**：

1. `P3-test-cases.md` - 测试用例文档
   - Header 必须包含: `phase: P3`, `task_id: T001`, `parent: T001/P2-review.md`

2. `P3-test-code/` 目录 - 测试代码
   - 至少 1 个测试文件（.ts / .py）
   - Header 必须包含: `phase: P3`, `task_id: T001`, `parent: T001/P3-test-cases.md`

**TDD 原则**：
- 先写测试，测试应该**失败**（因为代码还没实现）
- 然后再去实现代码（P4 阶段）

**门禁条件**：
- P3-test-cases.md 必须存在
- 单元测试代码必须存在且当前失败

## 执行步骤

1. 读取 `docs/process/workflow-v2.md`（掌握流程规范）
2. 读取任务目录下的已完成文件
3. 创建 `P3-test-cases.md`
4. 创建 `P3-test-code/` 目录并编写测试代码
5. 更新任务看板 `docs/tasks/active-tasks.md`
   - 将阶段从 P2 更新为 P3
   - 更新状态为"进行中"
   - 更新"更新日期"为今天
6. 返回执行结果

## 返回格式

请在完成时报告：

```
✅ P3 完成

产出文件：
- P3-test-cases.md
- P3-test-code/test_xxx.ts

测试结果：
- test_xxx: ❌ 失败（预期行为，TDD 第一步）

看板已更新：
- 阶段: P2 → P3
- 状态: 🔄 进行中
```

---

## 模板：继续被中断的任务

```
# 继续执行任务

## 背景

上一个会话中任务被中断，现在继续执行。

## 任务信息

- **任务编号**: T001
- **任务名称**: mcp-namespace-map
- **当前阶段**: P3（进行中）
- **流程规范**: `docs/process/workflow-v2.md`
- **任务目录**: `docs/tasks/T001-mcp-namespace-map/`

## 已完成文件检查

请先检查以下文件是否存在：

- P1-problems.md ✅
- P2-design.md ✅
- P2-review.md ✅

## 当前状态

- P1: ✅ 完成
- P2: ✅ 完成（评审通过）
- P3: 🔄 进行中（测试用例设计）

## 你需要做什么

继续完成 P3 阶段：

1. 检查现有产出
2. 继续编写测试用例
3. 更新任务看板
4. 报告结果

## 返回格式

```
当前状态：P3 进行中

产出文件：
- P3-test-cases.md ✅/❌
- P3-test-code/test_xxx.ts ✅/❌

下一步：
- [x] 完成 P3
- [ ] 进入 P4
```