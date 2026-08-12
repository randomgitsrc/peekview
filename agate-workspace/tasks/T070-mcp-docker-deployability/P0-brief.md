---
phase: P0
task_id: T070
task_name: mcp-docker-deployability
type: brief
trace_id: T070-P0-20260724
created: 2026-07-24
status: draft
parent: 实测验证 + 网友B 部署反馈
---

## 任务简述

peekview-mcp 在 Docker 场景下无法正常使用 `publish_files`，同时三份 README 存在事实性错误误导用户。本任务修复 CWD guard bug、增强诊断能力、修正文档，使 MCP Server 在 Docker/systemd/K8s 等 cwd=/ 环境下可用。

## 问题清单

### 代码 bug（🔴 阻断性）

1. **CWD guard bug**（`publishFiles.ts` L338-346）：`process.cwd() === '/'` 时无差别拒绝 `publish_files`，即使 `allowed_paths` 已显式配置。影响 Docker（默认 WORKDIR=/）、systemd（不设 WorkingDirectory）、cron、K8s Pod（不设 workingDir）。

2. **错误信息误导**：报"未配置 allowed_paths"，实际原因是 cwd=/。用户按错误信息排查方向完全错。需区分"真的没配 allowed_paths"和"cwd=/ guard 触发"两种情况。

3. **allowed_paths 解析不容错**：YAML 里写冒号分隔字符串（如 `allowed_paths: /a:/b`）导致 `.map is not a function` 崩溃，无明确提示。

### 功能缺失（🟠 影响排查）

4. **无诊断命令**：用户配完无法验证"配置是否生效"。需加 `peekview-mcp config show`（显示生效配置含 cwd/mode/allowed_paths）和 `peekview-mcp config check`（验证配置 + 测试文件访问）。

5. **无健康检查端点**：Docker `HEALTHCHECK` 无法用。需加 `GET /health`。

### 文档错误（🟠 误导用户）

6. **mcp-server/README.md namespace 语义错误**（L96-100, L353-372）：描述为"容器路径自动翻译为主机路径"，实际 namespace 是 Agent 侧短路径别名，volume mount 必须同路径。网友B踩坑4 已证明。

7. **mcp-server/README.md allowed_paths 格式描述误导**（L169）：写"冒号分隔"未区分配置文件（YAML 数组）和环境变量（冒号分隔），导致用户在 YAML 里写冒号分隔崩溃。

8. **mcp-server/README.md Docker 示例基于错误理解**：path_namespaces 示例暗示"容器内路径映射到主机路径"，实际 volume mount 必须同路径。

9. **三份 README 均缺 Docker 场景指引**：根 README 只有 pipx 安装，backend/README 只有 pip 安装，mcp-server/README 的 Docker Compose 用了不存在的镜像名。无 `-w /tmp` 规避、无 `--network host` 选择说明。

10. **根 README 缺 OpenCode/Cursor 接入示例**：只有 Claude Code。

### 工具描述不足（🟡 影响 Agent）

11. **publish_files 工具描述**缺：Docker 场景提示（cwd=/ 问题）、错误恢复指引、namespace 使用指引、诊断命令提示。

## executor_env

```yaml
platform: opencode
has_task_tool: true
has_local_runtime: true
network: full
```

## 环境约束

- 改动范围：`packages/mcp-server/`（代码 + README）、根 `README.md`、`backend/README.md`
- 不改 PeekView 后端代码
- 不改 PeekView 前端代码
- MCP server 当前版本 0.9.3，本次改动应 bump mcp version（patch 或 minor，P8 决定）
- Docker 测试用 `node:20-alpine` + `npm install -g @peekview/mcp-server`（无官方镜像，不在本任务范围）

## env_constraints

```yaml
debug_env: "make debug (127.0.0.1:8888, /tmp/peekview-debug/); MCP 单测: cd packages/mcp-server && npm run test:unit"
pruning_tendency: "保守"
```

## 已知风险

- CWD guard 修复需保证不破坏现有的"未配 allowed_paths + cwd=/ "保护逻辑
- `config show` / `config check` 是新命令，需设计输出格式
- README 修正量大，需保证三份文档一致性
- 工具描述增强不能过长（MCP 协议对 tool description 长度无硬限制，但过长影响 Agent 上下文）

## 不在本任务范围

- 官方 Docker 镜像发布（独立 task，记录到 improvement-backlog）
- type/mode 命名重构（breaking change，独立 task，记录到 improvement-backlog）
- 11 种部署场景完整矩阵文档（本任务只做 Docker 场景，其余场景后续补充）
- PeekView 本身的 Docker 部署（PeekView 无官方镜像，记录到 backlog）

## 裁剪倾向

- risk=medium：代码改动有现成测试覆盖（publishFiles 有单测），文档改动无风险
- P1 不可裁（评审）
- P2 可简化（bug fix follows_existing_pattern，诊断命令为新增功能需设计）
- P3 必须走（CWD guard bug 修复需 TDD 红灯）
- P6 不可裁（BDD 验收需实测 Docker 场景：cwd=/ + allowed_paths 配置后能 publish_files）
- P7 必须走（多文件改动：代码 + 3 份 README + 工具描述）
- P8 bump mcp version

## 验证标准

- Docker 容器内（cwd=/）配置 allowed_paths 后 `publish_files` 能正常工作，无需 `-w /tmp` 规避
- `peekview-mcp config show` 输出生效配置（含 cwd、mode、allowed_paths、path_namespaces）
- `peekview-mcp config check` 验证配置 + 测试 allowed_paths 内文件可读
- `GET /health` 返回 200
- mcp-server/README.md 无事实性错误（namespace 语义、allowed_paths 格式、Docker 示例）
- 三份 README 均有 Docker 场景指引
