---
phase: P1
task_id: T014
parent: P0-brief.md
trace_id: T014-P1-20260615
---

# P1 需求基线 — T014 MCP path_namespace CLI

## 1. 需求复述

v0.9.0 新增的 path_namespaces 功能只能手改 `~/.peekview/mcp-config.yaml`。格式出错没有提示，没有命令可以验证配置是否正确，对 Docker 场景的用户不友好。补充 `peekview-mcp config namespace add/remove/list` 三个子命令。不含 test 子命令（运行时 server.ts 已校验 unknown namespace → 400，CLI test 价值低）。

## 2. 隐含需求识别

- **ConfigFileData TypeScript 类型缺 path_namespaces 字段**：读写 YAML 时会导致类型错误，需补声明
- **YAML 读写保留注释和格式**：目前 config set/get 用的是什么 YAML 库，需确认是否保留注释
- **config list 输出需补 path_namespaces 展示**：现在 list 不显示 namespace 配置
- **add 命令的路径校验**：container_path 必须以 `/` 开头；host_path 可含 `~`（会被 server.ts 的 expandHome 展开，CLI 不展开，原样存储）
- **remove 无 container_path 时删整个 namespace**：防止误删，需要确认提示
- **namespace ID 命名约束**：是否限制字符集（如只允许 `[a-z0-9-_]`）？v3 plan 未说明，建议不限制，让用户灵活命名

## 3. BDD 验收条件

**AC1：add 新 namespace**
```
Given ~/.peekview/mcp-config.yaml 无 docker-a namespace
When peekview-mcp config namespace add docker-a /opt/data ~/docker-data1
Then mcp-config.yaml 中新增 path_namespaces.docker-a./opt/data = ~/docker-data1
  And 提示「已添加 namespace docker-a: /opt/data → ~/docker-data1」
```

**AC2：add 到已有 namespace（追加映射）**
```
Given docker-a 已有 /opt/data → ~/docker-data1
When peekview-mcp config namespace add docker-a /opt/cache ~/docker-cache1
Then docker-a 下新增 /opt/cache → ~/docker-cache1（原映射保留）
```

**AC3：list 所有 namespace**
```
When peekview-mcp config namespace list
Then 格式化输出所有 namespace 和映射关系
```

**AC4：list 单个 namespace**
```
When peekview-mcp config namespace list docker-a
Then 只显示 docker-a 的映射
```

**AC5：remove 单条映射**
```
Given docker-a 有两条映射
When peekview-mcp config namespace remove docker-a /opt/data
Then 只删除 /opt/data 的映射，保留其他
```

**AC6：remove 整个 namespace（需确认）**
```
Given docker-a 有映射
When peekview-mcp config namespace remove docker-a
Then 提示「将删除 namespace docker-a 的所有映射，确认？[y/N]」
  And 确认后删除整个 namespace
```

**AC7：container_path 非绝对路径报错**
```
When peekview-mcp config namespace add docker-a relative/path ~/d
Then 报错「container_path 必须是绝对路径（以 / 开头）」
```

**AC8：config list 展示 path_namespaces**
```
When peekview-mcp config list
Then 输出包含 path_namespaces 部分（如有配置）
```

**AC9：无配置文件时友好提示**
```
Given ~/.peekview/mcp-config.yaml 不存在
When peekview-mcp config namespace list
Then 提示「未找到配置文件，path_namespaces 为空」
```

## 4. 裁剪说明

```yaml
phases: [P1, P2, P3, P4, P5, P8]
single_agent_mode: true
```

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
    status: GAP（claude-project 环境）
    supplement: P3-P8 交接 OpenCode
```
