---
phase: P8
task_id: T070
type: release
parent: P7-consistency.md
trace_id: T070-P8-20260725
status: draft
created: 2026-07-25
agent: releaser
---

## bump_type

minor

## 版本号变更

| 包 | 当前版本 | 新版本 | 变更类型 |
|----|----------|--------|----------|
| @peekview/mcp-server | 0.9.3 | 0.10.0 | minor |
| peekview (后端) | 0.11.0 | 0.11.0 | 不变 |

### bump 判定依据

- 新功能为主：/health 增强（cwd/mode/allowed_paths 诊断字段）、config list 增强（runtime 节）、config verify 增强（allowed_paths 可读性测试）、publish_files 工具描述增强、Docker 部署指引文档
- bug fix 为辅：CWD guard 修复、allowed_paths 容错、README 语义/格式修正
- 综合判定：minor（新功能为主，向后兼容）
- PeekView 后端无改动，版本不变

## packages

```json
["@peekview/mcp-server"]
```

## CHANGELOG 更新确认

[Unreleased] 条目已写入 CHANGELOG.md（L8-27），包含 T070 全部改动：

### 新增（6 条）
- MCP Server Docker 部署指引（三份 README）
- MCP Server 根 README OpenCode/Cursor 接入示例
- MCP Server `/health` 端点 cwd/mode/allowed_paths 诊断字段
- MCP Server `config list` runtime 节
- MCP Server `config verify` allowed_paths 可读性测试
- MCP Server `publish_files` 工具描述增强

### 修复（6 条）
- CWD guard bug：cwd=/ 且已配 allowed_paths 时不再错误拒绝
- 错误信息区分：cwd=/ 拒绝时明确两个原因
- allowed_paths 容错：YAML 字符串自动解析为数组
- README namespace 语义修正
- README allowed_paths 格式描述修正
- README Docker Compose 示例修正

**主 Agent 操作**：bump-version 后需将 `[Unreleased]` 移至 `[mcp-v0.10.0]` 下。

## 版本文件路径

| 文件 | 字段 | 当前值 | 目标值 |
|------|------|--------|--------|
| `VERSIONS.json` | `mcp_server` | `"0.9.3"` | `"0.10.0"` |
| `packages/mcp-server/package.json` | `version` | `"0.9.3"` | `"0.10.0"` |

`make bump-mcp-version NEW_MCP_VERSION=0.10.0` 将通过 `scripts/sync_versions.py` 同步以上文件。

## 发布检查命令

```bash
# P5 gate 重跑
cd packages/mcp-server && npm run test:unit 2>&1 | tail -40

# MCP 构建
make build-mcp

# MCP npm 发布前检查
make pre-publish-npm

# MCP npm 发布
make publish-npm
```

## 临时资源清单

本任务未启动调试服务、未创建临时数据、未做开发安装、未触碰生产环境。

| 资源类型 | 状态 | 说明 |
|----------|------|------|
| 调试服务 (:8888) | 未启动 | P4/P5/P6 使用 debug backend，P8 不需要 |
| 临时数据 (/tmp/peekview-debug/) | 未创建 | P5 测试数据已随 debug-stop 清理 |
| 开发安装 (pip install -e / npm link) | 未执行 | P4 实现通过文件编辑完成 |
| 生产环境 (:8080 / ~/.peekview/) | 未触碰 | [PROD_NOT_TOUCHED]（P6 确认） |
| Docker 容器 | 未启动 | P5/P6 测试用 node:20-alpine 容器已退出 |

## 主 Agent 交接步骤

1. `make bump-mcp-version NEW_MCP_VERSION=0.10.0`
2. 编辑 CHANGELOG.md：`[Unreleased]` → `[mcp-v0.10.0] - 2026-07-25`
3. `git add CHANGELOG.md VERSIONS.json packages/mcp-server/package.json && git commit --amend --no-edit`
4. P5 gate 重跑：`cd packages/mcp-server && npm run test:unit`
5. `make pre-publish-npm && make publish-npm`
6. `git push && git push origin vmcp-v0.10.0`
7. READY 收尾检查（参考临时资源清单：全部为"未启动/未创建/未执行"，无需清理）
