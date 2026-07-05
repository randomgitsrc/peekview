---
phase: P8
task_id: T046
type: release
parent: P6-acceptance.md
trace_id: T046-P8-20260705
status: ready
agent: main
created: 2026-07-05
bump_type: patch
packages:
  - name: peekview
    version: 0.5.3
    reason: 前端新增 content-link-resolution 功能（Markdown 图片/链接路径重写）
  - name: "@peekview/mcp-server"
    version: unchanged
    reason: 无 MCP 相关变更
---

# T046 P8 发布准备

## 发布内容
- T046 content-link-resolution：Markdown/HTML 文件内链路径重写
- P0: 图片引用重写为文件 API URL（3/3 本地图片加载验证通过）
- P1: 链接重写为文件切换 URL（3/3 链接重写+点击切换验证通过）
- P2/P3: defer 到后续迭代

## 变更文件
- `frontend-v3/src/utils/path-map.ts`（新建）
- `frontend-v3/src/composables/useMarkdown.ts`
- `frontend-v3/src/components/MarkdownViewer.vue`
- `frontend-v3/src/views/EntryDetailView.vue`

## 验证
- 741 pytest + 675 vitest + 38 path-map tests 全绿
- vue-tsc 无错误
- Playwright CDP 实跑：3 图片加载 + 链接点击切换
