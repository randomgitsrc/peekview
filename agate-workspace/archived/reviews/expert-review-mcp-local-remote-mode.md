# MCP 本地/远程双模式设计评审

> 评审日期：2026-06-08
> 评审对象：
> - docs/specs/spec-mcp-local-remote-mode.md
> - docs/decisions/mcp-vs-cli-positioning.md（补充章节）
> 交叉参考：
> - docs/specs/spec-mcp-publish-files.md（旧版 publish_files 设计）
> - docs/specs/spec-mcp-peeklink-command.md（斜杠命令设计）

---

## 总体评价

设计方向正确。A=B 与 A≠B 的拓扑分析精准地识别了"MCP 工具参数必须经过 LLM 上下文"这一根本限制，本地/远程双模式的分离思路清晰。

主要风险点：
1. 工具策略过于刚性——本地模式只暴露 publish_files 会中断 Agent 生成内容的发布路径
2. 两个 spec 之间的安全模型矛盾需要解决
3. 远程模式不应暴露 publish_files

---

## Critical Issues

### C1: 本地模式工具策略需要调整

**问题：** spec 第四节规定本地模式只暴露 `publish_files`，不暴露 `create_entry`。这意味着 Agent 自己生成的代码/分析结果无法通过 MCP 发布——除非先落盘再用 publish_files，但 Agent 不一定会这么做。

**分析：** 这个设计的目标是"两种模式工具不重叠，Agent 无需感知部署拓扑"。但实际场景中：

| 场景 | Agent 操作 | 本地模式下能否完成 |
|------|-----------|-------------------|
| 发布本地已有文件 | publish_files(路径) | ✅ |
| 发布 Agent 生成的短内容 | create_entry(内容) | ❌ 工具不存在 |
| 发布 Agent 生成的长内容 | 先 Write → 再 publish_files | ✅ 但多一步，Agent 可能不知道 |

**关键洞察：** 对于 Agent 生成的短内容（如一段代码、一个分析结果），`create_entry` 传 content 是合理的——token 开销小。真正浪费的是 Agent 读已有大文件再传 create_entry。`publish_files` 解决的是"读文件"的问题，不是"传 content"的问题。

**建议修复：**

本地模式暴露两种工具，但用描述引导 Agent 选择正确工具：

| 模式 | 暴露工具 |
|------|---------|
| local | create_entry + publish_files + get/list/delete |
| remote | create_entry + get/list/delete（不含 publish_files） |

`create_entry` 的描述加明确引导：
```
⚠️ For Agent-generated content only (short, < 100 lines).
Do NOT read_file first then call this tool — it wastes context.
For existing local files, use publish_files instead.
```

`publish_files` 的描述：
```
For existing files on disk. MCP Server reads directly.
Use this instead of create_entry when publishing local files.
```

这样 Agent 看到两个工具，描述明确区分用途。Agent 选错的风险可以通过描述质量来降低——实测中 Claude Code 对工具描述的遵循度很高。

---

### C2: 两个 spec 安全模型矛盾

**问题：** `spec-mcp-publish-files.md` 设计了三层安全模型：
1. 黑名单（始终拒绝）
2. 用户配置的 allowedPaths（显式允许）
3. sessionCwd 兜底（未配置时只允许 cwd 下的路径）

`spec-mcp-local-remote-mode.md` 改为两层：
1. 黑名单
2. allowedPaths（必须配置，否则拒绝启动）

两层模型更严格但更不实用——本地模式的用户需要先配置 allowedPaths 才能启动，增加了上手门槛。

**建议：** 在本地模式下保留三层模型，但明确 sessionCwd 的来源：
- 本地模式中 MCP Server 运行在 Agent 同机器，CWD 即 Agent 的项目目录
- 未配置 allowedPaths 时，只允许 CWD 下的路径（足够覆盖大多数"发布当前项目文件"的场景）
- 配置了 allowedPaths 时，严格按照配置执行

启动校验改为：
```
if local mode AND allowedPaths is empty:
  log("⚠ 未配置 allowed_paths，仅允许当前工作目录下的路径")
  // 不拒绝启动，但限制范围
```

---

### C3: 远程模式不应暴露 publish_files

**问题：** 评审提出"远程模式也可以暴露 publish_files，因为 B 机器上可能有文件"。但 Agent 在 A 机器，不知道 B 机器的文件系统。如果 Agent 传了 A 机器的路径给远程 MCP Server，Server 在 B 机器找不到文件，会报错。

这不是功能问题，而是**语义问题**——工具描述说"publish local files"，但"local"对 Agent 和 MCP Server 意味着不同的机器。暴露这个工具会让 Agent 理解出错。

**建议：** 远程模式不暴露 publish_files。如果确实需要在 B 机器上发布文件（如运维场景），那是完全不同的用户（B 机器的管理员），应该部署另一个本地模式的 MCP Server 在 B 机器上。

---

## Important Issues

### I1: 版本号与实际不符

spec 第九节写"MCP Server v0.6.0"，但 v0.6.0 已发布（当前的 service 自动检测功能）。本次改动应为 v0.7.0 或更高。

### I2: 配置字段命名不一致

- spec 用 `mode: local` / `mode: remote`（YAML snake_case）
- TypeScript 类型用 `allowedPaths`（camelCase）
- 环境变量用 `MCP_MODE` / `MCP_ALLOWED_PATHS`

需要统一规范。建议：
- YAML/配置文件：snake_case（`mode`, `allowed_paths`）
- TypeScript：camelCase（`mode`, `allowedPaths`）
- 环境变量：大写（`MCP_MODE`, `MCP_ALLOWED_PATHS`）
- merge.ts 做转换层

### I3: 拓扑变更的迁移路径缺失

用户从本地模式切换到远程模式（或反之）时：
- 配置文件需要改 `mode` 字段
- MCP Server 需要重启
- Claude Code 的 MCP 连接配置可能需要改（本地 SSE vs 远程 SSE）

建议增加迁移章节，并在 CLI 增加诊断命令：
```bash
peekview-mcp config get mode          # 查看当前模式
peekview-mcp config set mode local    # 切换模式（需要重启）
```

### I4: 远程模式的 prompt injection 风险未提及

spec 侧重本地模式安全，但远程模式下恶意 prompt 可能指示 Agent 通过 create_entry 发布敏感内容（Agent 有 read_file 能力，create_entry 接受任意 content）。

建议：
1. 在 spec 中明确提及此风险
2. 远程模式下 `is_public` 默认值改为 `false`
3. 建议使用用户级 `pv_` key 而非全局 API key

### I5: 旧 spec-mcp-publish-files.md 需要明确声明被取代

两个 spec 存在矛盾，但没有明确声明哪个是权威版本。建议在旧 spec 顶部加：
```
> ⚠️ 此文档已被 docs/specs/spec-mcp-local-remote-mode.md 取代。
> 本文档的安全模型部分（三层防护）仍可参考，但工具设计已改为双模式。
```

---

## Minor Issues

- **M1:** `create_entry` 的远程模式描述引用了 `publish_files`，但远程模式下 Agent 看不到该工具。应改为引用 `/peeklink` 斜杠命令或本地模式配置说明
- **M2:** 环境变量 `MCP_MODE` 与现有 `MCP_PORT`/`MCP_HOST` 前缀一致，没问题。但考虑用 `MCP_SERVER_MODE` 更明确
- **M3:** 文件大小限制（5MB/50MB）未考虑 base64 编码开销（33%膨胀），文本文件上限可调为 7MB
- **M4:** `paths` schema 缺少 `.max(50)` 约束（旧 spec 有此约束）
- **M5:** publish_files 没有指定错误处理策略，应声明与 create_entry 使用相同的 translateError
- **M6:** `mode` 和 `allowed_paths` 在 YAML 中是顶级键，其他配置嵌套在 `peekview:` 或 `server:` 下。考虑放在 `server:` 下保持一致性

---

## Strengths

1. **拓扑分析精准** — A=B vs A≠B 正确识别了"参数必须经 LLM"这一根本限制
2. **远程模式不暴露 publish_files** — 避免语义歧义，Agent 不会传 A 机器路径给 B 机器
3. **黑名单 + allowlist 安全模型** — 硬编码敏感路径防止灾难性泄露
4. **向后兼容** — 默认 `mode: remote`，现有部署无影响
5. **绝对路径要求** — 消除不同 Agent 的 cwd 歧义
6. **跳过反馈机制** — SkippedFile 及原因码为 Agent 提供可操作信息

---

## 需要更新到 spec 的内容汇总

| 文档 | 变更 |
|------|------|
| spec-mcp-local-remote-mode.md | 1. 本地模式工具改为 create_entry + publish_files + read/delete<br>2. 安全模型恢复三层（黑名单 > allowlist > CWD 兜底）<br>3. 远程模式确认不暴露 publish_files<br>4. 版本号更新<br>5. 加迁移章节 |
| spec-mcp-publish-files.md | 顶部加取代声明 |
| mcp-vs-cli-positioning.md | 补充章节中"MCP over SSE 协议的根本限制"改为"Agent LLM-in-the-loop 架构的根本限制" |

---

*评审完成：2026-06-08*