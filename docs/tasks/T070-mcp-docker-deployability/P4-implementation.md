---
phase: P4
task_id: T070
type: implementation
parent: P2-design.md
trace_id: T070-P4-20260725
status: draft
created: 2026-07-25
agent: implementer
implementation_dir: packages/mcp-server/src/
---

## 实现摘要

按 P2-design.md 方案 A 实现 T070 的 7 项改动，使 P3 的 17 个红灯测试变绿。

## 代码改动

### 1. CWD guard 修复（publishFiles.ts L338-346）

- 旧逻辑：`cwd=/` 无差别拒绝
- 新逻辑：`isCwdRoot && !trustAllPaths && allowedPaths.length === 0` → 拒绝
- 错误信息区分两个原因（cwd 为根目录 + 未配置 allowed_paths），含 3 种解决方案 + 诊断命令

### 2. allowed_paths 容错（merge.ts L81-82）

- 旧逻辑：`fileConfig.server.allowed_paths.map(expandHome)` — 字符串时 `.map` 崩溃
- 新逻辑：`typeof raw === 'string' ? raw.split(':').filter(...) : Array.isArray(raw) ? raw : []`
- 空数组、字符串、数组三种输入均正确处理

### 3. /health 增强（server.ts L231-266）

- config 对象追加 `cwd`、`mode`、`allowed_paths` 字段
- remote 模式下 `allowed_paths` 为空数组

### 4. config list 增强（cli/config.ts configListAction）

- 追加 `runtime:` 节，显示 cwd、mode、allowed_paths（env-merged 最终值）
- 调 mergeConfig 获取最终生效值，try/catch 防止缺少必填配置时阻断

### 5. config verify 增强（cli/config.ts verifyAction）

- 末尾追加 `allowed_paths 可读性检查`
- 逐路径 `fs.access(R_OK)`，可读标 ✅，不可读标 ❌ 并设 allOk=false

### 6. publish_files 工具描述增强

- description 末尾追加 3 行：Docker 场景提示、诊断命令提示、namespace 提示

## 文档改动

### 7. mcp-server/README.md

- L96: namespace 语义修正（"容器路径自动翻译" → "Agent 侧短路径别名，volume mount 必须同路径"）
- L169: allowed_paths 格式区分（YAML 数组 vs 环境变量冒号分隔）
- L353-372: Docker 容器部署示例修正（同路径 mount，namespace 只做前缀替换）
- L425-441: Docker Compose 示例修正（`node:20-alpine` + `npm install -g`，含 `MCP_ALLOWED_PATHS`）
- 新增 Docker 场景指引节（cwd=/ 问题、网络选择、volume mount 同路径原则、完整 Compose 示例）

### 8. README.md（根）

- MCP 接入节增加 OpenCode 和 Cursor 配置示例
- 新增 Docker 场景简版指引（链接到 mcp-server/README.md）

### 9. backend/README.md

- 新增 Docker 场景简版指引（链接到 mcp-server/README.md）

## 自查结果

- T070 专项测试：5 files, 17 tests, all passed
- 全量测试：14 files, 220 tests, all passed（无回归）

## 环境隔离

[PROD_NOT_TOUCHED]
