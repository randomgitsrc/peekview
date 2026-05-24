# 决策记录：MCP vs CLI+Skill 的定位

> 日期：2026-05-24
> 背景：MCP Server 实现完成后，用户反馈"不如之前 CLI+Skill 顺手，付出的代价有点大"

---

## 结论

**MCP 和 CLI+Skill 适用于不同场景，不是替代关系。**

当前 PeekView 的 MCP Server 主要价值还未充分体现，因为大多数使用场景仍是"用户主动操作"，而非"Agent 自主决策"。

---

## 两种模型的本质差异

### CLI + Skill（用户主动操作）

```
用户说 → Claude 理解 → 执行 shell 命令 → 完成
```

- 文件路径和内容完全在 shell 层处理，不经过 Claude 上下文
- 速度：秒级
- 复杂度：一个 skill 文件
- 局限：需要用户在场发出指令

### MCP（Agent 自主决策）

```
Agent 执行任务 → 自主判断需要发布 → 调用 MCP 工具 → 继续任务
```

- 无需用户干预，Agent 全程自主
- 速度：正常（秒级到十几秒）
- 复杂度：独立 Server、认证、配置
- 价值：用户不在场时 Agent 仍可完成发布

---

## MCP 真正的价值场景

以下场景中，CLI+Skill 无法替代 MCP：

1. **CI/CD 自动化**：流水线里 Agent 跑完测试，自动把报告发布到 PeekView
2. **Agent 工作流中转**：Agent A 把分析结果发布，Agent B 读取继续处理
3. **无人值守任务**：Agent 执行长时间任务，过程中自动把阶段性结果发布出去
4. **多 Agent 协作**：PeekView 作为 Agent 之间的共享内容平台

这些场景的共同特征：**没有用户在旁边实时输入指令**。

---

## 当前问题：为什么用起来不如 CLI+Skill 顺手

用户的使用场景主要是"我告诉 Claude，Claude 帮我发布"——这是**用户主动操作**场景，CLI+Skill 天然更适合：

1. **文件内容不经过 Claude 上下文**：CLI 直接读文件传 API，MCP 需要 Claude 搬运内容（慢）
2. **零配置**：CLI+Skill 只需一个 skill 文件；MCP 需要部署 Server、配置认证
3. **无额外延迟**：CLI 是同步调用；MCP 有 SSE 连接、认证等开销

---

## 正确的分工

| 场景 | 推荐方式 |
|------|---------|
| 用户主动发布，路径明确 | `/peeklink` 斜杠命令 |
| 用户主动发布，需要 Claude 组织内容 | `create_entry` MCP（Claude 生成内容后直传）|
| 用户主动发布本地文件 | `publish_files` MCP（MCP 读文件，Claude 不搬运）|
| Agent 自主决策发布 | `create_entry` / `publish_files` MCP |
| CI/CD、自动化流水线 | MCP（无用户介入）|

---

## 对未来开发的指导

1. **不要用 MCP 复制 CLI 的功能**——MCP 的价值在于 Agent 自主，不在于替代用户操作
2. **CLI 继续作为主要的人机交互工具**——速度快、零配置、无上下文污染
3. **MCP 的投入应该聚焦在 Agent 协作场景**——等 Agent 生态更成熟后再深度投入
4. **性能问题的根本解法是 `publish_files`**——让 MCP 工具也能绕过 Claude 上下文处理文件

---

## 相关文档

- `docs/specs/spec-mcp-publish-files.md` — publish_files 工具设计
- `docs/specs/spec-mcp-peeklink-command.md` — /peeklink 斜杠命令设计
- `docs/reviews/expert-review-mcp-performance.md` — MCP 性能问题分析

---

*决策记录：2026-05-24*
