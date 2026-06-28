# PeekView Agent 双系统兼容指南

> `docs/converse/agents/` 下的 agent 定义同时兼容 **OpenCode** 和 **Claude Code** 两个系统。

---

## 架构

```
docs/converse/agents/      ← 规范定义（事实源，git 跟踪）
    ├── backend.md
    ├── build.md
    ├── frontend.md
    ├── mcp.md
    ├── orchestrator.md
    ├── plan.md
    ├── security.md
    └── thinker.md

.opencode/agents/          ← 软链接 → ../docs/converse/agents
.claude/agents/            ← 软链接 → ../docs/converse/agents
```

两个系统共享同一套 Markdown 文件。YAML frontmatter 中的字段各自系统按需读取，不认识的字段被忽略。

---

## Agent 清单

| Agent | 用途 | 调用场景 |
|-------|------|----------|
| **orchestrator** | agate P0-P8 编排，派发 subagent | 启动新任务、管理多阶段流程 |
| **build** | 全栈开发，实现功能/修 bug/写测试 | 需要跨前后端改代码 |
| **backend** | FastAPI/Python 后端 | 后端实现、数据库、API |
| **frontend** | Vue 3/TypeScript 前端 | 前端实现、组件、样式 |
| **mcp** | MCP Server (Node.js/TypeScript) | MCP 功能开发、测试 |
| **plan** | 只读分析，代码审查/架构分析/问题诊断 | Review 代码、分析架构 |
| **security** | 安全审计 | 漏洞扫描、权限审查 |
| **thinker** | 多视角思维伙伴 | 头脑风暴、方案讨论 |

---

## Claude Code 使用方式

### 方式 A：设为会话主 Agent

启动 Claude Code 时指定 agent，整个会话以该 agent 的角色运行：

```bash
# 用 plan agent 做代码审查
claude --agent plan

# 用 security agent 做安全审计
claude --agent security

# 用 thinker 做头脑风暴
claude --agent thinker "分析一下这个项目的架构风险"
```

### 方式 B：作为 background agent 派发

在 Claude Code 交互会话中，用 `Agent` 工具派发子任务：

```
> 用 security agent 审计最近的改动
```

Claude Code 会从 `.claude/agents/` 中匹配 `security` agent，用其系统提示词和工具限制派发子任务。

### 方式 C：在 settings.json 中设为默认

```json
{
  "agent": "build"
}
```

这样所有 Claude Code 会话默认以 `build` agent 运行。

### 查看可用 agent

```bash
# 列出 .claude/agents/ 目录
ls .claude/agents/

# 或在 Claude Code 中直接询问
claude --agent plan "列出所有可用的 agent"
```

---

## OpenCode 使用方式

OpenCode 通过 `.opencode/agents/` 软链接自动发现 agent。

```bash
# OpenCode 中直接按名称调用
opencode --agent backend "修复 models.py 的类型问题"

# 或作为 subagent 派发（在对话中）
> 派发 frontend agent 重构 DiagramBlock 组件
```

---

## 双系统对比

| 维度 | Claude Code | OpenCode |
|------|-------------|----------|
| **Agent 定义目录** | `.claude/agents/` | `.opencode/agents/` |
| **格式** | Markdown + YAML frontmatter | Markdown + YAML frontmatter |
| **必需字段** | `name`, `description` | `description`, `mode` |
| **权限模型** | `tools` / `disallowedTools` / `permissionMode` | `permission`（逐工具 allow/ask/deny） |
| **模型选择** | `model`（inherit/sonnet/opus/...） | 无（继承主会话） |
| **调用方式** | `--agent <name>` 或 `Agent` tool | `--agent <name>` 或 task 工具 |
| **UI 颜色** | `color` 字段控制 | 无 |

---

## Frontmatter 字段说明

`docs/converse/agents/*.md` 的 YAML frontmatter 包含两类字段：

### 通用字段（两系统共享）

| 字段 | 说明 |
|------|------|
| `description` | Agent 用途描述，两系统都使用 |

### Claude Code 专属

| 字段 | 说明 | 示例 |
|------|------|------|
| `name` | 唯一标识符（小写+连字符） | `backend` |
| `model` | 使用的模型 | `inherit`（继承主会话） |
| `tools` | 允许的工具列表 | `Read, Edit, Write, Bash, Grep, Glob, Agent` |
| `color` | UI 显示颜色 | `blue` / `red` / `green` / ... |

### OpenCode 专属

| 字段 | 说明 | 示例 |
|------|------|------|
| `mode` | Agent 类型 | `primary`（主 Agent）/ `subagent`（子 Agent） |
| `permission` | 逐工具权限控制 | `edit: allow`, `bash: { "pytest*": allow }` |
| `hidden` | 从 UI 中隐藏 | `true`（security agent） |

---

## 如何添加新 Agent

1. 在 `docs/converse/agents/` 下创建 `my-agent.md`
2. 写完整的 YAML frontmatter（两系统字段都要填）
3. 写系统提示词正文
4. 两个软链接自动生效 — 无需额外步骤

```markdown
---
name: my-agent
description: 我的自定义 Agent
model: inherit
tools: Read, Glob, Grep
color: green
mode: subagent
permission:
  edit: ask
  read: allow
  glob: allow
  grep: allow
---

你是 PeekView 的自定义 Agent...

## 铁律

见 `AGENTS.md`

## 完成后

...
```

---

## 注意事项

1. **不要删除 `name` 字段** — Claude Code 依赖它识别 agent（OpenCode 用文件名）
2. **`permission` 和 `tools` 不冲突** — 各自系统只读自己认识的字段
3. **软链接在 git 中** — `.opencode/agents` 和 `.claude/agents` 都应提交到 git（作为 symlink）
4. **frontmatter 顺序无影响** — YAML key 顺序不重要
