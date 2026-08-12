---
phase: P8
task_id: T049
type: release
trace_id: T049-P8-20260708
status: draft
created: 2026-07-08
agent: orchestrator
---

# P8 发布准备 — T049 mobile-header-diagram-sanitize

## bump_type: patch

**建议版本：peekview 0.5.5**

理由：
- 无破坏性变更（所有新增 API 端点是 additive）
- 改动范围：后端 config + CLI 增强 + 前端清洗/错误 UI + 移动端 header
- 未引入新公共 API 契约（config/diagram 端点仅供前端使用）

## P2 packages 发布检查

| Package | 当前版本 | 需要发布？ | 发布命令 |
|---------|----------|-----------|----------|
| peekview (PyPI) | 0.5.4 | ✅ 包含 backend + frontend 变更 | `make publish` |
| @peekview/mcp-server (npm) | 0.9.2 | ❌ 未修改 | — |

### peekview 变更验证

```bash
# 版本 bump
make bump-version NEW_VERSION=0.5.5
# 检查
make pre-publish-quick
```

## 临时资源清单

| 资源 | 状态 | 清理方式 |
|------|------|---------|
| 调试服务 :8888 | ⬜ 待检查 | `make debug-stop` |
| /tmp/peekview-debug/ | ⬜ 待检查 | `rm -rf /tmp/peekview-debug/` |
| 测试 entry（debug 数据库） | ⬜ 待检查 | 调试数据库自动在 debug-stop 时清理 |

## CHANGELOG 更新

[Unreleased] 内容归集到 [0.5.5]:

摘录 T049 改动：

### 新增

- **移动端 Header 智能滚动**（T049）：header-tags 在手机端自动截断显示 "+N" 溢出指示器，向下滚动时隐藏 header 以释放内容空间，向上滚动时恢复，桌面端不受影响
- **Diagram 源码自动清洗**（T049）：前端 diagramSanitize 管线（register 架构），两阶段清洗（确定性 + 启发式），支持 mermaid/plantuml/svg 源码自动修正
- **统一错误 UI**（T049）：Mermaid/PlantUML/SVG 渲染失败的统一错误面板，含引擎名 + 可折叠详情 + 查看源码按钮
- **可配置清洗开关**（T049）：`PEEKVIEW_DIAGRAM__SANITIZE_ENABLED` 环境变量 + `GET /api/v1/config/diagram` 端点 + CLI `peekview config set diagram.sanitize_enabled`

### 变更

- 后端 CLI bool key 输入校验加强：无效值报错退出（之前静默接受）

### 修复

- PlantUML 渲染失败不再自动切到 code mode，改用统一错误 UI

## Pre-publish 检查清单

- [ ] VERSIONS.json peekview → 0.5.5
- [ ] backend/peekview/__init__.py __version__ → 0.5.5
- [ ] frontend-v3/package.json version → 0.5.5
- [ ] CHANGELOG [Unreleased] → [0.5.5]
- [ ] P5 gate 重跑全绿
- [ ] git tag v0.5.5
