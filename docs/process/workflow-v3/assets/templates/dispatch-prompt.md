# 派发 Prompt 模板

> 主 Agent 调用 task 工具派发 subagent 时，prompt 用这个结构

```
你是 {阶段 Pn} 阶段的 {角色名} 子 Agent。

## 你的角色定义
读取并严格遵循：
docs/process/workflow-v3/assets/{execution-roles|review-roles}/{role}.md

## 输入（自己读取，不要等我提供内容）
- docs/tasks/{Txxx}/{上一阶段产出文件}
- docs/process/workflow-v3/README.md
{按角色定义补充其他需要读的文件}

## 任务
{这个阶段要做什么，一两句话}

## 输出
产出文件：docs/tasks/{task_dir}/{本阶段产出文件}
（task_dir 是完整目录名，如 T002-fix-db-migration，不是纯编号）

文件必须以这段 Header 开头（直接复制，主 Agent 已填好所有值）：
---
phase: {Pn}
task_id: {完整 task_id，如 T002-fix-db-migration}
parent: {上一阶段文件名}
trace_id: {Txxx}-{Pn}-{YYYYMMDD}
---

## 门槛（什么算完成）
{可判定的完成条件，能从文件读出明确值}

## 返回给我（重要）
只返回两行：
  1. 产出文件路径
  2. 一句话摘要（不超过 30 字）
绝对不要返回文件全文——我只需要路径和摘要。
```

## 关键提醒
- prompt 里只写文件**路径**，绝不复制文件内容
- 明确要求 subagent 只返回路径+摘要
- **Header 给成品不给格式**：主 Agent 派发时已知道所有值（phase/task_id/日期），直接填好让 subagent 复制，避免 subagent 自己拼 trace_id 拼错导致门槛校验失败
- **路径用完整目录名**：task_dir 是 Txxx-描述（如 T002-fix-db-migration），不是纯 Txxx
- 这两条是上下文不爆炸的保证
