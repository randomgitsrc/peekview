---
phase: P1
task_id: T001
parent: P0-brief.md
trace_id: T001-P1-20260615
---

# P1 需求基线 — T001 MCP Path Namespace Mapping

## 1. 需求复述

Docker 容器内的 Agent（Hermes/OpenClaw）通过网络连接主机上的 MCP Server。容器内路径（如 `/opt/data`）和主机路径（如 `~/docker-data1`）不同，Agent 调用 `publish_files` 时传入容器内路径，MCP Server 在主机找不到文件。

解决方案：在 MCP Server 配置里定义「命名空间」（容器路径 → 主机路径的映射），Agent 连接时通过 HTTP header `X-Peekview-Namespace` 声明自己的命名空间，MCP Server 在处理每次请求时从 header 读取命名空间，翻译路径后再走现有安全链。

## 2. 隐含需求识别

- **无状态适配**：T008 已删除 session，namespace 必须从每次请求的 header 读取，存入 SessionContext 传给工具 handler——不能「只在 initialize 时捕获」
- **expandHome bug 顺带修**：`allowed_paths` 配 `~/xxx` 当前静默失效（`path.resolve('~/x')` 不展开 `~`），本任务实现 `expandHome` 并统一应用到所有路径配置
- **unknown namespace 在请求时拒绝**：无状态下没有 initialize 阶段可以拦截，改为在每次 POST /mcp 处理时检查，unknown namespace → 400
- **翻译只在 publish_files 的顶层路径**：`scanDirectory` 内部递归不二次翻译（递归拿到的子路径已是主机真实路径）
- **错误信息不暴露主机路径**：返回给 Agent 的错误只含容器内路径，主机路径只入服务端日志
- **向后兼容**：无 namespace header 时不翻译，走现有 allowlist 逻辑，不影响本机 Agent
- **多容器隔离**：不同容器配不同 namespace，各自映射各自的主机目录，不串
- **OpenClaw 风险**：issue #65590 显示 streamable-http 可能不转发 header，需用户实测；Hermes 已确认支持

## 3. BDD 验收条件

**AC1：基本路径翻译**
```
Given 配置了 namespace docker-a: /opt/data → ~/docker-data1
  And Agent 请求带 X-Peekview-Namespace: docker-a
  And ~/docker-data1/report.md 存在且在 allowed_paths 内
When publish_files({ paths: ["/opt/data/report.md"] })
Then 文件成功上传到 PeekView
  And 返回结果不含主机路径 ~/docker-data1
```

**AC2：翻译后路径走完整安全链**
```
Given 配置了 namespace docker-a: /opt/data → ~/docker-data1
  And ~/docker-data1 不在 allowed_paths 内
When publish_files({ paths: ["/opt/data/report.md"] })
Then 返回错误，提示路径不在允许范围
  And 错误信息只含容器路径 /opt/data/report.md，不含主机路径
```

**AC3：unknown namespace 拒绝**
```
Given 配置中只有 namespace docker-a 和 docker-b
When 请求带 X-Peekview-Namespace: docker-c
Then 返回 400，提示 unknown namespace: docker-c
  And 不静默 fallback 到本机路径
```

**AC4：无 namespace header 向后兼容**
```
Given 请求不带 X-Peekview-Namespace header
When publish_files({ paths: ["/home/user/project/file.md"] })
Then 不做路径翻译，走现有 allowlist 逻辑（行为与 T001 前完全一致）
```

**AC5：最长前缀匹配**
```
Given namespace docker-x 有两条映射：
  /opt/data → ~/d1
  /opt/data/sub → ~/d2
When publish_files({ paths: ["/opt/data/sub/x.md"] })
Then 选择更长的前缀 /opt/data/sub，翻译为 ~/d2/x.md
```

**AC6：多 namespace 隔离**
```
Given 同时有 docker-a（/opt/data → ~/data1）和 docker-b（/opt/data → ~/data2）
When docker-a 的 Agent 发 publish_files({ paths: ["/opt/data/x.md"] })
Then 翻译为 ~/data1/x.md（不串到 data2）
```

**AC7：expandHome 修复**
```
Given allowed_paths 配置为 ["~/projects"]
When publish_files({ paths: ["/home/user/projects/file.md"] })
Then 路径校验通过（~ 被正确展开为 /home/user）
```

**AC8：翻译后路径命中 denylist 被拒绝**
```
Given 翻译后路径落在 denylist 范围内
When publish_files 触发翻译
Then 请求被拒绝，安全链不被绕过
```

## 4. 裁剪说明

```yaml
phases: [P1, P2, P3, P4, P5, P8]
single_agent_mode: true   # executor_env.has_task_tool=false，P3-P8 需交接 OpenCode
```

- 跳过 P6：无 UI 变化，验收条件由测试覆盖
- 跳过 P7：单包改动，无需专项一致性检查
- P3-P8 需在有 node_modules 的环境执行，本环境交接 OpenCode

## 5. 范围声明

```yaml
packages: [mcp-server]
domains: [mcp]
ui_affected: false
gate_commands:
  P5: "cd packages/mcp-server && npm test"
```

## 6. 能力需求

```yaml
capability_requirements:
  - need: local-node-runtime
    why: npm test、TypeScript 编译
    status: GAP（当前 Claude Project 环境）
    supplement: 交接 OpenCode 执行 P3-P5
```
