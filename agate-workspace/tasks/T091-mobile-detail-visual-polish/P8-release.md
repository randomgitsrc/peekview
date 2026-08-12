---
phase: P8
task_id: T091-mobile-detail-visual-polish
role: releaser (implementer P8 模式)
---

# P8 — 发布准备

```yaml
bump_type: patch
target_version: 0.18.2  # peekview 主包，MCP server 不涉及
```

## 1. 涉及包确认

P2-design.md 第 0 节声明 `packages: [frontend-v3]`，`domains: [frontend]`。本次发布只涉及 `frontend-v3` 对应的主包 `peekview`（PyPI 版本），不涉及 `packages/mcp-server`（本任务全程未改动 MCP 相关代码，`git diff v0.18.1..HEAD --stat` 确认改动文件均在 `frontend-v3/`、`DESIGN.md`、`backend/peekview/static/`（构建产物）、`docs/tasks/`，无 `packages/mcp-server/` 路径）。

## 2. 版本号变更确认

当前 `VERSIONS.json`：

```json
{
  "peekview": "0.18.1",
  "mcp_server": "0.10.0"
}
```

本文件未做任何修改（按约束不执行 `make bump-version`）。推荐目标版本：`peekview: 0.18.1 -> 0.18.2`（patch），`mcp_server` 保持 `0.10.0` 不变。

**bump_type 判定依据**：本任务是纯 bug 修复 + UX 打磨——

- meta-tags-bar 移动端留白/换行修复
- markdown 正文移动端边距恢复
- 底部操作栏 padding 上下对称性 bug 修复
- Copy/Wrap 按钮图标化（视觉一致性打磨，非行为新增）
- P4 重试#1 修复的 meta-tags-bar 与遗留全局 CSS 冲突导致的高度坍缩 bug

无新功能、无 API 变更、无破坏性变更 → `patch`。

## 3. CHANGELOG [Unreleased] 更新确认

已编辑 `CHANGELOG.md`（未 commit），在 `[Unreleased]` 区域写入以下条目：

```markdown
## [Unreleased]

### 修复

- 移动端详情页顶部标签/信息条恢复正常留白与自动换行，不再出现内容被裁切或需要横向滚动才能看全标签的问题 (T091)
- 移动端详情页底部操作栏的上下内边距恢复对称，不再一边挤一边空 (T091)
- 修复标签/信息条在正文内容较长、页面可滚动时高度异常坍缩、标签被遮挡丢失的问题 (T091)

### 变更

- 移动端 Markdown 正文左右留白恢复到合理宽度，不再贴边显示 (T091)
- 详情页 Copy/Wrap 按钮改为图标化风格，与其他操作按钮的视觉体系保持一致 (T091)
```

格式参考现有 `[0.18.1]` 条目风格（分类标题 + 用户可读描述 + `(T091)` 任务标记）。"修复" 分类用于覆盖 3 处 bug（留白/换行、padding 对称性、高度坍缩），"变更" 分类用于覆盖 2 处纯 UX 打磨（边距恢复、按钮图标化），未使用技术术语堆砌，面向最终用户可读。

## 4. 发布前置检查结果

| 检查项 | 命令 | 结果 |
|---|---|---|
| 前端类型检查 | `cd frontend-v3 && npx vue-tsc --noEmit` | ✅ PASS (exit 0，无输出) |
| 后端 lint | `make lint` | ✅ PASS (`ruff check peekview/ tests/` → All checks passed!) |
| commit 覆盖核对 | `git log v0.18.1..HEAD --oneline` 对照 CHANGELOG | ✅ 全部用户可见改动已覆盖 |

**commit 覆盖核对明细**（`git log v0.18.1..HEAD --oneline`，共 16 条）：

- 代码改动 commit：`34015a81`（P4 实现：meta-tags-bar/markdown-body/底部栏 padding、Copy/Wrap 图标化）、`25b035f0`（P4 重试#1：meta-tags-bar 遗留 CSS 冲突修复）——均已被 CHANGELOG 条目覆盖
- 其余 14 条均为 agate 流程 commit（`wf(T091-Pn)`、`retreat: P6 -> P5`、`retreat: P5 -> P4`），不产生用户可见改动，无需单独 CHANGELOG 条目
- `git diff v0.18.1..HEAD --stat -- frontend-v3` 确认实际源码改动文件：`EntryDetailMobileBar.vue`、`EntryMetaTagsBar.vue`、`MarkdownViewer.vue`（+ 对应 E2E 测试文件），均已在 CHANGELOG 条目中体现

无遗漏。

## 5. 临时资源清单（供主 Agent READY 收尾清理）

- **调试后端进程仍在运行**：`ps aux` 确认 PID 158008，`/home/kity/oclab/peekview/backend/.venv/bin/python -m uvicorn peekview.main:get_app --host 127.0.0.1 --port 8888 --factory` 占用 `:8888`，启动于 12:56（本任务 P5/P6 阶段验证遗留，未停止）。**主 Agent 需执行 `make debug-stop` 或等效方式停止**。
- **临时数据目录**：`/tmp/peekview-debug/` 存在，含 `data/` 子目录 + `peekview.db`（847KB）+ `peekview.db-shm`/`peekview.db-wal`（WAL 文件，最后写入 18:46，说明 debug 服务仍在活跃写入）。**需随调试服务停止一并清理**（`make debug-stop` 会自动清理该目录，无需手动 rm）。
- 未发现其他残留：无开发安装（`pip3 install -e` 类操作）痕迹，`git status --short` 除本次派发指引文件（`P8-dispatch-context-implementer.md`，主 Agent 派发时创建，非本 releaser 产生的资源）外无其他未追踪文件。
- 生产环境：全程未触碰生产服务（`:8080`）/生产数据库（`~/.peekview/peekview.db`）。`[PROD_NOT_TOUCHED]`。

## 约束遵守确认

- 未执行 `git commit` / `git tag` / `make bump-version` / `git push`
- 未修改 `VERSIONS.json`
- 未改动任何源代码文件（仅编辑 `CHANGELOG.md` 一个文件）
