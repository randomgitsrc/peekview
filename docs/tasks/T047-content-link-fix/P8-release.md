---
phase: P8
task_id: T047
task_name: content-link-fix
type: release
parent: P7-consistency.md
trace_id: T047-P8-20260705
status: draft
created: 2026-07-05
agent: implementer
---

# T047 发布准备

## 版本变更

| 包 | 旧版本 | 新版本 | bump_type |
|----|--------|--------|-----------|
| peekview | 0.5.2 | 0.5.3 | patch |

MCP Server 不受影响（P2 声明 `packages: [peekview]`），版本保持 0.9.2。

## 版本 bump 判定

- 本次改动以后端 bug fix 为主（Content-Type 修复），前端路径重写是补全 T046 原计划功能
- 无新增公开 API、无 schema 变更、无 breaking change
- 判定：patch（0.5.2 → 0.5.3）

## 已更新文件

| 文件 | 改动 |
|------|------|
| `backend/peekview/__init__.py` | `__version__` 0.5.2 → 0.5.3 |
| `VERSIONS.json` | `peekview` 0.5.2 → 0.5.3 |
| `INDEX.md` | 版本号引用 0.5.2 → 0.5.3 |
| `CHANGELOG.md` | [Unreleased] 条目归集到 [0.5.3] - 2026-07-05 |

## CHANGELOG 条目确认

[0.5.3] 包含 2 条修复：

1. **后端二进制文件 Content-Type 修复**（T047）：`/content` 端点对 PNG/JPEG/SVG 等二进制文件返回 `text/plain`，改为三级 fallback（`_LANGUAGE_TO_MIME` → `mimetypes.guess_type()` → `application/octet-stream`），新增 `_determine_content_type` 函数
2. **前端 Markdown 图片/链接路径重写恢复**（T047）：从 T046 patch 恢复 path-map.ts + useMarkdown.ts + MarkdownViewer.vue + EntryDetailView.vue 改动，Markdown 中 `![alt](image.png)` 和 `[doc](guide.md)` 引用自动重写为 API URL

条目完整且准确，与 P1 需求基线和 P2 设计一致。

## 验证命令

```bash
cd backend && python3 -c "from peekview import __version__; assert __version__ == '0.5.3', f'Expected 0.5.3, got {__version__}'"
cat VERSIONS.json | python3 -c "import json,sys; d=json.load(sys.stdin); assert d['peekview']=='0.5.3', f'Expected 0.5.3, got {d[\"peekview\"]}'"
```

## Lessons Learned

1. **P2 最小验证必须覆盖外部系统行为**：T046 未验证后端 Content-Type 导致根因在设计阶段就应被发现却未发现。T047 P2 的 `minimal_validation` 确认了 bug 存在，方案设计基于事实而非假设。
2. **否定证据先追查再反驳**：T046 中 vision-helper 三次报告图片未渲染被三次反驳。T047 规定异常时先 `curl -I` 检查响应头再做判断。
3. **分流策略规避 mimetypes 误判**：`mimetypes.guess_type` 对 `.rs`/`.ts` 返回错误 MIME，统一 fallback 路径会导致回归。文本文件走 `_language_to_content_type`、二进制文件走三级 fallback 的分流策略零回归。

## 临时资源清单

- 无临时服务/进程启动（P8 仅做版本号更新和 CHANGELOG 归集）
- 无临时数据创建
- 无开发安装
