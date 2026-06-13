# 派发 Prompt 模板

> 主 Agent 调用 task 工具派发 subagent 时，prompt 用这个结构

```
你是 {阶段 Pn} 阶段的 {角色名} 子 Agent。

## 你的角色定义
读取并严格遵循：
docs/process/workflow-v4/assets/{execution-roles|review-roles}/{role}.md

## 项目上下文（必读，每个 subagent 都需要）
- {project_conventions_file}（项目约定、命名规范、目录结构）
- {project_index_file}（项目总览）
- docs/process/workflow-v4/README.md（流程规范）

## 输入（自己读取，不要等我提供内容）
- docs/tasks/{Txxx}/P0-brief.md（主 Agent 任务简报：环境约束、已知风险、裁剪倾向）
- docs/tasks/{Txxx}/{上一阶段产出文件}
- docs/process/workflow-v4/README.md
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

## 能力补充说明（若 P1 有 supplementable 条目，此节必填）
本任务需要以下补充能力：
- {能力名}：使用 {补充方式}（如：派发 vision-analyst / 注入 playwright-vision skill）

## 门槛（什么算完成）
{可判定的完成条件，能从文件读出明确值}

## 返回给我（重要）
只返回两行：
  1. 产出文件路径
  2. 一句话摘要（不超过 30 字）
绝对不要返回文件全文——我只需要路径和摘要。
```

## 项目占位符映射

> 占位符说明：各项目在自己的约定文件（如 CLAUDE.md）中定义具体映射。以下给出示例值供参考，不是 v4 本身的约定。

| 占位符 | 说明 | 示例值 |
|--------|------|--------|
| {project_conventions_file} | 项目约定文件 | `CLAUDE.md` / `CONTRIBUTING.md` |
| {project_index_file} | 项目总览文件 | `INDEX.md` / `README.md` |
| {test_code_dir} | 测试代码目录 | `tests/` / `backend/tests/` |
| {implementation_dir} | 源码目录 | `src/` / `app/` / `backend/pkg/` |
| {build_command} | 构建验证命令（从 P2 gate_commands 读取）| 项目自定义 |
| {lint_command} | 代码检查命令（从项目约定读取）| 项目自定义 |

## 关键提醒
- prompt 里只写文件**路径**，绝不复制文件内容
- 明确要求 subagent 只返回路径+摘要
- **Header 给成品不给格式**：主 Agent 派发时已知道所有值（phase/task_id/日期），直接填好让 subagent 复制，避免 subagent 自己拼 trace_id 拼错导致门槛校验失败
- **路径用完整目录名**：task_dir 是 Txxx-描述（如 T002-fix-db-migration），不是纯 Txxx
- 这两条是上下文不爆炸的保证