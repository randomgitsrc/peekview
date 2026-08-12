---
phase: P1
task_id: T070
type: requirements
parent: P0-brief.md
trace_id: T070-P1-20260725
status: revised
created: 2026-07-25
agent: analyst
---

## 需求复述

MCP Server 在 Docker/systemd/K8s 等 cwd=/ 环境下无法使用 `publish_files`，同时三份 README 存在事实性错误误导用户。本任务修复 CWD guard bug、增强诊断能力、修正文档，使 MCP Server 在非交互式 cwd=/ 环境下可用。

P0-brief 列出 11 项问题，经质疑后调整为 9 项（问题 5 降级，问题 4 重新定义）。

## 隐含需求识别

### 1. CWD guard 修复后的保护语义不变

**为什么必须**：CWD guard 的原始意图是"未配 allowed_paths + cwd=/ → 拒绝"（防止意外暴露整个文件系统）。修复后必须保持这个保护：只有"已配 allowed_paths + cwd=/"才放行。如果修复破坏了"未配 allowed_paths + cwd=/"的拒绝逻辑，等于引入安全漏洞。

### 2. 错误信息需区分两种拒绝原因

**为什么必须**：当前错误信息统一说"未配置 allowed_paths"，但实际有两种拒绝原因：(a) 真的没配 allowed_paths 且 cwd=/；(b) 已配 allowed_paths 但 cwd=/ guard 仍拦截。用户按错误信息排查方向完全错误，这是网友B踩坑的直接原因。

### 3. allowed_paths 容错需覆盖 YAML 手写场景

**为什么必须**：merge.ts L82 假设 `fileConfig.server.allowed_paths` 是数组，但 YAML 手写 `allowed_paths: /a:/b` 解析为字符串，`.map()` 崩溃。CLI `config set` 写入的是数组格式不会触发此问题，但用户手写 YAML 是常见操作，必须有容错。

### 4. config list 不显示运行时最终生效值

**为什么必须**：config list 只读文件配置，不显示 env 覆盖后的最终值、不显示运行时 cwd。Docker 场景下用户用 env 配置，config list 看不到实际生效配置，无法排查问题。这不是"新增命令"需求，而是"增强现有命令"需求。

### 5. config verify 不测试 allowed_paths 文件可读性

**为什么必须**：Docker 场景下 allowed_paths 配置了路径但容器内可能无读权限（volume mount 权限问题）。config verify 只验证 PeekView 连通性+认证，不验证文件可读性，用户配完以为 OK 实际 publish_files 会失败。

### 6. /health 端点已存在，但缺 cwd 诊断信息

**为什么必须**：Docker HEALTHCHECK 已用 /health，但 /health 不返回 cwd 和 allowed_paths 信息。Docker 场景下 cwd=/ 是核心问题，/health 不暴露此信息导致运维无法通过健康检查发现配置问题。这是"增强现有端点"而非"新增端点"。

### 7. 三份 README 修正需保证一致性

**为什么必须**：mcp-server/README.md 是 Docker 部署的详细文档，根 README.md 和 backend/README.md 引用或简述 MCP 接入方式。三份文档对 namespace 语义、allowed_paths 格式、Docker 场景的描述必须一致，否则用户按不同文档操作会得到矛盾结果。

### 8. publish_files 工具描述增强不能过长

**为什么必须**：工具描述进入 Agent LLM 上下文，过长影响 Agent 效率。Docker 场景提示、错误恢复指引、namespace 指引需精炼，不能把 README 全文塞进去。

### 9. Docker Compose 示例用不存在的镜像名

**为什么必须**：mcp-server/README.md L425-441 用 `peekview:latest` 和 `peekview/mcp-server:latest`，这两个镜像不存在。用户按文档操作直接失败。需改为 `node:20-alpine` + `npm install -g` 的方式（与 Dockerfile 一致），或标注"需先构建镜像"。

### 10. 根 README 缺 OpenCode/Cursor 接入示例

**为什么必须**：P0-brief 问题 10 明确指出。当前只有 Claude Code 示例，OpenCode 和 Cursor 用户无参考。但此需求优先级低于 Docker 场景修复，且改动范围在根 README.md 内。

## P0-brief 问题清单质疑

### 问题 5（无健康检查端点）— 应降级

**质疑**：server.ts L231-266 已有 `GET /health`，返回 status/version/peekview/config 信息。Dockerfile L21-22 已使用 `wget http://localhost:33333/health`。P0-brief 说"无健康检查端点"与代码不符。

**结论**：问题 5 降级为"增强 /health 端点诊断信息"（增加 cwd、allowed_paths、mode），不再是"新增端点"。

### 问题 4（无诊断命令）— 应重新定义

**质疑**：`config list`（cli/config.ts L140-205）和 `config verify`（L423-510）已存在。P0-brief 说"需加 `config show` 和 `config check`"不准确——实际需求是增强现有命令而非新增。

**结论**：问题 4 重新定义为：
- 增强 `config list`：显示运行时最终生效值（含 env 覆盖）、显示 cwd、显示 mode
- 增强 `config verify`：增加 allowed_paths 文件可读性测试
- 不新增 `config show` / `config check` 命令（避免命令膨胀，增强现有命令更符合用户心智模型）

### 问题 1-3（代码 bug）— 确认，无质疑

CWD guard bug、错误信息误导、allowed_paths 容错均为实测确认的阻断性问题。

### 问题 6-9（文档错误）— 确认，无质疑

namespace 语义错误、allowed_paths 格式误导、Docker 示例错误、缺 Docker 场景指引均为事实性错误。

### 问题 10（缺 OpenCode/Cursor 示例）— 确认但优先级低

根 README 缺 OpenCode/Cursor 接入示例，但此需求与 Docker 场景无直接关联，可在文档修正时一并处理。

### 问题 11（工具描述不足）— 确认

publish_files 工具描述缺 Docker 场景提示和诊断指引。

## BDD 验收条件

### CWD Guard 修复

#### BDD-1: 已配 allowed_paths 且 cwd=/ 时 publish_files 正常工作
- Given MCP Server 运行在 local 模式，cwd=/，已配置 `server.allowed_paths: ["/data"]`
- When Agent 调用 `publish_files` 传入 `/data/test.py`
- Then publish_files 成功发布文件，返回 entry URL

#### BDD-2: 未配 allowed_paths 且 cwd=/ 时 publish_files 被拒绝
- Given MCP Server 运行在 local 模式，cwd=/，未配置 `server.allowed_paths`，`trust_all_paths=false`
- When Agent 调用 `publish_files` 传入任意路径
- Then 返回错误，publish_files 失败

#### BDD-3: 已配 allowed_paths 且 cwd 非根目录时行为不变
- Given MCP Server 运行在 local 模式，cwd=/home/user，已配置 `server.allowed_paths: ["/data"]`
- When Agent 调用 `publish_files` 传入 `/data/test.py`
- Then publish_files 成功发布文件（与修复前行为一致）

#### BDD-4: 未配 allowed_paths 且 cwd 非根目录时行为不变
- Given MCP Server 运行在 local 模式，cwd=/home/user，未配置 `server.allowed_paths`
- When Agent 调用 `publish_files` 传入 `/home/user/test.py`
- Then publish_files 成功发布文件（默认允许 cwd，与修复前行为一致）

#### BDD-5: trust_all_paths=true 且 cwd=/ 时 publish_files 正常工作
- Given MCP Server 运行在 local 模式，cwd=/，`trust_all_paths=true`，未配置 `server.allowed_paths`
- When Agent 调用 `publish_files` 传入 `/data/test.py`
- Then publish_files 成功发布文件（trust_all_paths 跳过 CWD guard）

### 错误信息区分

#### BDD-6: cwd=/ 且未配 allowed_paths 时错误信息包含两个原因
- Given MCP Server 运行在 local 模式，cwd=/，未配置 `server.allowed_paths`
- When Agent 调用 `publish_files`
- Then 错误信息同时包含"cwd 为根目录"和"未配置 allowed_paths"两个原因

### allowed_paths 容错

#### BDD-7: YAML 文件中 allowed_paths 写为冒号分隔字符串时自动解析为数组
- Given YAML 配置文件中 `allowed_paths: /data:/tmp`（字符串而非数组）
- When MCP Server 启动加载配置
- Then allowed_paths 被解析为 ["/data", "/tmp"]，不抛出错误

#### BDD-8: YAML 文件中 allowed_paths 写为数组时正常工作
- Given YAML 配置文件中 `allowed_paths: ["/data", "/tmp"]`（数组格式）
- When MCP Server 启动加载配置
- Then allowed_paths 正常解析为 ["/data", "/tmp"]

#### BDD-9: 空 allowed_paths 数组等同于未配置
- Given YAML 配置文件中 `allowed_paths: []`（空数组），cwd=/
- When MCP Server 启动加载配置并调用 `publish_files`
- Then 空数组视为未配置 allowed_paths，CWD guard 拒绝 publish_files

### 诊断增强

#### BDD-10: config list 显示运行时 cwd
- Given MCP Server 配置存在
- When 执行 `peekview-mcp config list`
- Then 输出包含当前工作目录（cwd）信息

#### BDD-11: config list 显示 env 覆盖后的最终生效值
- Given 环境变量 `MCP_ALLOWED_PATHS=/data:/tmp` 已设置，配置文件中 `allowed_paths` 未设置
- When 执行 `peekview-mcp config list`
- Then 输出的 allowed_paths 显示 env 覆盖后的最终值 `/data:/tmp`，而非"(not set)"

#### BDD-12: config list 新增字段不改变现有输出格式
- Given MCP Server 配置存在
- When 执行 `peekview-mcp config list`
- Then 现有输出字段（server/port/url 等）格式不变，新增字段（cwd/mode/resolved allowed_paths）追加在现有字段之后

#### BDD-13: config verify 测试 allowed_paths 文件可读性
- Given 已配置 `server.allowed_paths: ["/data"]`，且 `/data` 目录存在且可读
- When 执行 `peekview-mcp config verify`
- Then 输出包含 allowed_paths 文件可读性验证结果

#### BDD-14: config verify 报告不可读的 allowed_paths
- Given 已配置 `server.allowed_paths: ["/nonexistent"]`，且 `/nonexistent` 不存在
- When 执行 `peekview-mcp config verify`
- Then 输出报告 `/nonexistent` 不可读

### /health 端点增强

#### BDD-15: /health 返回 cwd 和 mode 信息（local 模式）
- Given MCP Server 运行在 local 模式
- When 请求 `GET /health`
- Then 响应包含 `cwd` 和 `mode` 字段，且现有字段（status/version）不变

#### BDD-16: /health 返回 allowed_paths 信息（local 模式）
- Given MCP Server 运行在 local 模式，已配置 `server.allowed_paths: ["/data"]`
- When 请求 `GET /health`
- Then 响应包含 `allowed_paths` 字段，值为 ["/data"]，且现有字段（status/version）不变

#### BDD-17: /health 在 remote 模式下 cwd/allowed_paths 语义正确
- Given MCP Server 运行在 remote 模式
- When 请求 `GET /health`
- Then 响应中 `cwd` 和 `allowed_paths` 字段反映 remote 模式语义（allowed_paths 不适用或为空），且现有字段（status/version）不变

### 文档修正

#### BDD-18: mcp-server/README.md namespace 语义描述正确
- Given mcp-server/README.md 文件内容
- When 搜索 path_namespaces 相关段落
- Then 不包含"自动翻译"或"映射到主机"等错误表述，且包含"volume mount 必须同路径"的说明

#### BDD-19: mcp-server/README.md allowed_paths 格式区分配置文件和环境变量
- Given mcp-server/README.md 文件内容
- When 搜索 allowed_paths 配置说明段落
- Then 同时包含 YAML 数组格式示例和 env 冒号分隔格式示例

#### BDD-20: mcp-server/README.md Docker 示例不使用不存在的镜像名
- Given mcp-server/README.md 文件内容
- When 检查 Docker Compose 示例中的 image 字段
- Then 不包含 `peekview:latest` 或 `peekview/mcp-server:latest`

#### BDD-21: 三份 README 均有 Docker 场景指引
- Given 根 README.md、backend/README.md、mcp-server/README.md 文件内容
- When 检查三份文档
- Then 三份文档均包含"Docker"关键词和"allowed_paths"配置说明

#### BDD-22: 根 README.md 包含 OpenCode/Cursor 接入示例
- Given 根 README.md 文件内容
- When 检查 MCP 接入章节
- Then 包含"OpenCode"和"Cursor"关键词及对应配置示例

### 工具描述增强

#### BDD-23: publish_files 工具描述包含 Docker 场景提示
- Given publish_files 工具的 description 字段
- When Agent 读取工具列表
- Then description 包含 Docker 场景下 cwd=/ 问题的提示和解决方案（配置 allowed_paths）

#### BDD-24: publish_files 工具描述包含诊断命令提示
- Given publish_files 工具的 description 字段
- When Agent 读取工具列表
- Then description 包含诊断命令提示（如"配置问题请运行 peekview-mcp config verify"）

## 待确认清单

[NO_NEED_CONFIRM]

所有隐含需求均有明确的技术判断依据，不涉及业务方向选择：
- CWD guard 修复语义：安全保护不变是硬约束
- 问题 5 降级：代码实测确认 /health 已存在
- 问题 4 重新定义：增强现有命令比新增命令更合理（用户心智模型一致）
- allowed_paths 容错：字符串→数组转换是标准防御性编程
- 三份 README 一致性：以 mcp-server/README.md 为主，其他引用

## 裁剪说明

```yaml
phases: [P1, P2, P3, P4, P5, P6, P7, P8]
```

| 阶段 | 裁剪 | 理由 |
|------|------|------|
| P1 | 否 | 不可裁（评审） |
| P2 | 简化 | CWD guard bug follows_existing_pattern；诊断增强为新增功能需设计但范围明确 |
| P3 | 否 | CWD guard bug 修复需 TDD 红灯，安全相关 |
| P4 | 否 | 代码+文档实现 |
| P5 | 否 | 需验证 Docker 场景 |
| P6 | 否 | BDD 验收需实测 Docker 场景 |
| P7 | 否 | 多文件改动：代码 + 3 份 README + 工具描述 |
| P8 | 否 | bump mcp version |

## 范围声明

```yaml
packages:
  - packages/mcp-server/    # 代码修复 + README 修正 + 工具描述增强
  - README.md               # Docker 场景指引 + OpenCode/Cursor 示例
  - backend/README.md        # Docker 场景指引

domains:
  - mcp          # MCP Server 代码修复（CWD guard、容错、诊断增强、/health 增强）
  - docs         # 三份 README 修正 + 工具描述增强
  - security     # CWD guard 修复需保证安全语义不变

risk_level: medium

rationale: |
  代码改动有现成测试覆盖（publishFiles 有单测），CWD guard 修复逻辑明确。
  文档改动无功能风险但量大（3 份 README + 工具描述）。
  allowed_paths 容错涉及配置解析核心路径，需回归测试。
  安全相关（CWD guard 保护语义），但修复方向明确。
```

## 能力需求声明

```yaml
capability_requirements:
  - need: docker-runtime
    why: P5/P6 验收需在 Docker 容器内测试 cwd=/ 场景
    available:
      - "node:20-alpine Docker image + npm install -g（P0-brief 验证标准指定）"
    status: available

  - need: unit-test-runner
    why: P3 TDD 红灯 + P5 回归测试
    available:
      - "cd packages/mcp-server && npm run test:unit"
    status: available

  - need: browser-vision
    why: P6 验收可能需要截图验证 /health 端点响应和 config list 输出
    available:
      - "vision-analyst（agate 内置执行角色）"
      - "playwright-cdp skill"
    status: supplementable
    note: "P6 验收以 CLI 输出和 HTTP 响应为主，浏览器截图为辅"
```

## 调整后的问题清单（9 项）

| # | 原编号 | 类别 | 描述 | 调整 |
|---|--------|------|------|------|
| 1 | 1 | 🔴 代码 bug | CWD guard bug：cwd=/ 时无差别拒绝 | 无调整 |
| 2 | 2 | 🔴 代码 bug | 错误信息误导：不区分拒绝原因 | 无调整 |
| 3 | 3 | 🔴 代码 bug | allowed_paths 解析不容错 | 无调整 |
| 4 | 4 | 🟠 功能缺失 | 诊断能力不足：config list 不显示运行时值，config verify 不测试文件可读性 | 重新定义：增强现有命令而非新增 |
| 5 | 5→降级 | 🟡 增强 | /health 端点缺 cwd/allowed_paths 诊断信息 | 降级：端点已存在，增强信息 |
| 6 | 6 | 🟠 文档错误 | namespace 语义错误 | 无调整 |
| 7 | 7 | 🟠 文档错误 | allowed_paths 格式描述误导 | 无调整 |
| 8 | 8 | 🟠 文档错误 | Docker 示例基于错误理解 | 无调整 |
| 9 | 9 | 🟠 文档错误 | 三份 README 缺 Docker 场景指引 | 无调整 |
| 10 | 10 | 🟡 文档缺失 | 根 README 缺 OpenCode/Cursor 示例 | 无调整 |
| 11 | 11 | 🟡 工具描述 | publish_files 描述缺 Docker/诊断提示 | 无调整 |
