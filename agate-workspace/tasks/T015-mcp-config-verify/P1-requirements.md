---
phase: P1
task_id: T015
parent: P0-brief.md
trace_id: T015-P1-20260615
---

# P1 需求基线 — T015 MCP config verify + unset

## 1. 需求复述

`peekview-mcp config verify`：用户配置好 URL 和 key 后，不知道连不连得上、key 对不对，
只能真的运行一次 MCP 调用才能发现问题。需要一个命令能立刻告知配置是否有效。

`peekview-mcp config unset <key>`：目前删除配置项只能手改 YAML，
没有命令行接口。

## 2. 隐含需求识别

- **verify 调用已有 /health 端点**：server.ts 已有 `GET /health`，返回 status/peekview/config 等信息。
  verify 命令读取本地配置 → 直接 HTTP GET `{peekview.url}/health`（内部地址）验证连通性和认证。
  不需要 MCP Server 运行，直接从 CLI 调 PeekView backend。

- **verify 的认证验证**：`/health` 端点不需要认证（无 api_key 也能访问），无法验证 key 是否有效。
  需要额外调一个需要认证的端点（如 `GET /api/v1/entries?per_page=1`）来验证 api_key 是否正确。

- **verify 在无配置文件时的行为**：应该报错「配置文件不存在」，不应 crash。

- **unset 的 key 格式**：和 `config set` 一致，`section.key` 格式（如 `peekview.url`）。

- **unset 删除后 section 变空时的处理**：若 section 下所有 key 都删了，应同时删掉空的 section 对象，
  避免 YAML 里出现 `peekview: {}` 这样的空节。

- **unset 不存在的 key**：提示「key 未设置」，不报错退出，行为一致于 `config get` 未设置时的提示。

## 3. BDD 验收条件

**AC1：verify 全部通过**
```
Given mcp-config.yaml 配置了有效的 peekview.url 和 api_key
  And PeekView backend 正在运行
When peekview-mcp config verify
Then 输出每项状态（✅/❌）：
  ✅ 配置文件：~/.peekview/mcp-config.yaml
  ✅ peekview.url：http://127.0.0.1:8080 — 可达
  ✅ api_key：pv_xxx...（已脱敏）— 认证有效
  ✅ peekview.public_url：已配置
And exit code 0
```

**AC2：verify URL 不可达**
```
Given peekview.url 配置为 http://127.0.0.1:9999（无服务）
When peekview-mcp config verify
Then 输出：
  ✅ 配置文件：存在
  ❌ peekview.url：http://127.0.0.1:9999 — 连接失败
And exit code 1
```

**AC3：verify api_key 无效**
```
Given peekview.url 正确，api_key 是无效值
When peekview-mcp config verify
Then 输出：
  ✅ peekview.url：可达
  ❌ api_key：认证失败（401）
And exit code 1
```

**AC4：verify 无配置文件**
```
Given ~/.peekview/mcp-config.yaml 不存在
When peekview-mcp config verify
Then 输出：❌ 配置文件不存在：~/.peekview/mcp-config.yaml
And exit code 1
```

**AC5：verify peekview.url 未配置**
```
Given 配置文件存在但 peekview.url 未设置
When peekview-mcp config verify
Then 输出：❌ peekview.url 未配置（必填）
And exit code 1
```

**AC6：unset 已有的 key**
```
Given peekview.url 已设置
When peekview-mcp config unset peekview.url
Then mcp-config.yaml 中 peekview.url 被删除
  And 提示「✓ 已删除 peekview.url」
```

**AC7：unset 后 section 变空时删除空 section**
```
Given peekview section 只有 url 一个 key
When peekview-mcp config unset peekview.url
Then mcp-config.yaml 中 peekview section 整体被删除（不留 `peekview: {}`）
```

**AC8：unset 不存在的 key**
```
Given peekview.url 未设置
When peekview-mcp config unset peekview.url
Then 提示「peekview.url 未设置，无需删除」
  And exit code 0（不报错）
```

**AC9：unset 格式错误的 key**
```
When peekview-mcp config unset invalidkey
Then 提示「Error: Invalid key format. Use 'section.key' format.」
  And exit code 1
```

## 4. 裁剪说明

```yaml
phases: [P1, P2, P3, P4, P5, P8]
single_agent_mode: true
```

跳过 P6：无 UI
跳过 P7：单包

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
    why: npm test
    status: GAP（claude-project 环境）
    supplement: P3-P8 交接 OpenCode
```
