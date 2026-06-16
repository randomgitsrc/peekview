# Agent 新任务执行提示词

> 当你有一个新需求时，把这个提示词发给 Agent，它会自动按 [agate](https://github.com/randomgitsrc/agate) 流程执行。

---

```
# 新任务启动

我有一个新需求，请按照 agate 流程（P0-P8）来执行。

## 执行步骤

### 第 1 步：读取流程规范

- `~/.agate/WORKFLOW.md`（P0-P8 主规则）
- `~/.agate/dispatch-protocol.md`（subagent 派发协议）
- `docs/tasks/active-tasks.md`（任务看板）
- `AGENTS.md`（项目铁律 + 常用命令）

### 第 2 步：确定任务编号

从 `docs/tasks/active-tasks.md` 读取最大任务编号，下一个 = 最大 + 1。

### 第 3 步：创建任务目录

mkdir -p docs/tasks/T{xxx}-{task-name}/

### 第 4 步：主 Agent 亲自写 P0-brief.md

P0 是主 Agent 不可委托的职责，包含：
- 任务简报（一句话概括）
- 环境约束（debug_env：端口、数据目录、隔离要求）
- 已知风险
- 裁剪倾向（哪些阶段计划保留/裁剪，及理由）

### 第 5 步：按 agate 阶段链派发

- P1 需求基线（analyst）→ BDD 验收条件
- P2 方案设计（声明 packages/domains/ui_affected/gate_commands）
- P3 TDD 测试
- P4 代码实现
- P5 技术验证（主 Agent 亲自跑 gate）
- P6 验收（BDD 实跑 + UI Playwright）
- P7 一致性检查（多文件改动时）
- P8 发布准备（每个 package 各自 bump + CHANGELOG）

### 第 6 步：每阶段 commit

格式：wf({task_id}-{phase}): {summary}

主 Agent 亲自跑 gate 命令，绝不信 subagent 自我报告。
```

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

## 关键约束

1. **P0-brief 主 Agent 亲自写**，不委托 subagent
2. **任务编号自动递增**，从看板读取最大编号 + 1
3. **任务目录必须在 docs/tasks/ 下**
4. **每阶段完成后必须更新看板**
5. **gate 判定**：主 Agent 亲自跑命令，subagent 的 ✅/[SCOPE_GAP] 仅供参考
