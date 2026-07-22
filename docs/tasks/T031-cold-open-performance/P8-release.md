---
phase: P8
task_id: T031-cold-open-performance
type: release
parent: P7-consistency.md
trace_id: T031-P8-20260722
status: draft
created: 2026-07-22
agent: releaser
---

# P8 Release — T031 Cold Open Performance

## bump_type

bump_type: minor

## 版本号变更

| 包 | 当前版本 | 新版本 | 是否 bump |
|---|---|---|---|
| peekview | 0.9.5 | 0.10.0 | 是 |
| mcp_server | 0.9.3 | 0.9.3 | 否 |

理由：新增功能（原生 `<a>` 链接、并行加载、骨架屏）+ 修复 + 文案变更，符合 semver minor。MCP 无后端 API 改动，不受影响。

## CHANGELOG 更新确认

已在 `CHANGELOG.md` 的 `[Unreleased]` 区域添加以下条目：

### 新增
- Explore 列表页卡片/列表项改为原生 `<a>` 链接，支持右键"在新标签页打开"和"复制链接地址" (T031)
- 详情页并行加载：点击卡片后 entry 元数据和首个文件内容并发请求，减少等待时间 (T031)
- Explore 列表页和详情页加载态骨架屏（grid/list 双模式），替代纯文本 Loading (T031)

### 修复
- 元信息行分隔符 `·` 在部分字体 fallback 下渲染为灰色方块，改用 UI 字体栈确保正常显示 (T031)

### 变更
- 搜索框 placeholder 统一为英文 "Search titles, tags & content..." (T031)
- 首页导航按钮文案从 "Explore" 改为 "Browse public" (T031)

## 临时资源清单

| 资源 | 说明 | 清理方式 |
|---|---|---|
| debug backend :8888 | 调试服务（PID 见 /tmp/peekview-debug.log） | `make debug-stop` |
| /tmp/peekview-debug/ | 调试数据目录（SQLite + 上传文件） | `make debug-stop` 自动清理 |
| /tmp/opencode/t031-*.ts | Playwright 临时验证脚本 | 可手动删除 |

## 主 Agent 待执行（gate 通过后）

1. `make bump-version NEW_VERSION=0.10.0`（更新 VERSIONS.json + 同步所有文件 + commit + tag）
2. 将 CHANGELOG `[Unreleased]` 移到 `[0.10.0]` 下，`git add CHANGELOG.md && git commit --amend --no-edit`
3. 重跑 P5 gate（`make test-quick` + `make typecheck`）确认全绿
4. `git push && git push origin v0.10.0`
5. READY 收尾检查（参考上方临时资源清单清理）
