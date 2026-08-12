---
phase: P8
task_id: T083-cjk-search-fix
type: release
parent: P7-consistency.md
trace_id: T083-P8-20260731
status: draft
created: 2026-07-31
agent: releaser
---

# P8 发布准备 — T083: 中文搜索与 Tag 过滤修复

## bump_type 判定

```
bump_type: patch
```

**理由**：
- 本次改动为 bug 修复（中文 tag 过滤失效 + FTS5 中文子词搜索失效 + 连字符复合 tag 搜索盲区）
- 不改公共 API 行为（API 请求/响应格式 `GET /api/v1/entries?tags=<tag>&q=<query>` 不变）
- 不改数据库 schema（FTS5 表结构不变）
- 新增 jieba 依赖属内部实现细节，不影响 API 契约
- 按 semver：修 bug 不改 API 行为 → patch

## 版本号变更确认

| 包 | 旧版本 | 新版本 | 备注 |
|----|--------|--------|------|
| peekview (backend) | 0.12.2 | 0.12.3 | P2 packages=[backend]，仅 bump 此包 |
| mcp_server | 0.10.0 | 0.10.0 | 不受影响（MCP 走后端 API，无代码改动） |

> releaser 不执行 `make bump-version`（由主 Agent 在 gate 通过后亲自执行）。

## CHANGELOG 更新确认

CHANGELOG.md 已更新：`[Unreleased]` → `[0.12.3] - 2026-07-31`，内容如下：

### 修复
- 中文 tag 过滤失效：SQLModel JSON ensure_ascii 转义导致 LIKE 匹配失败，改用 SQLite json_each 精确匹配 (T083)
- FTS5 中文子词搜索失效：unicode61 tokenizer 不分词 CJK，改用 jieba 应用层预分词（写入 + 查询端）(T083)
- 连字符复合 tag 搜索盲区：FTS 索引文本连字符→空格，使 `google-gemini` 可被 `gemini` 搜到 (T083)
- FTS trigger 降级为仅 DELETE：消除 trigger 与应用层竞态窗口 + 垃圾 FTS token (T083)
- backfill 版本标记：PRAGMA user_version 确保 FTS 格式变化时全量重建 (T083)
- 新增 jieba>=0.42.1 依赖 (T083)

## 改动文件清单

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `backend/peekview/text_utils.py` | 新增 | jieba 分词模块 |
| `backend/peekview/database.py` | 改 | trigger 降级 + backfill 版本标记 + 分词 |
| `backend/peekview/services/entry_service.py` | 改 | FTS 写入分词 + tag 过滤 json_each + 查询分词 |
| `backend/peekview/main.py` | 改 | lifespan 预加载 jieba |
| `backend/pyproject.toml` | 改 | 添加 jieba>=0.42.1 依赖 |
| `backend/tests/test_cjk_search.py` | 新增 | CJK 搜索专项测试 |
| `backend/tests/test_database.py` | 改 | trigger 降级后测试同步 |
| `backend/tests/test_fts_content.py` | 改 | trigger 降级后测试同步 |

## 发布检查命令

主 Agent gate 验证时执行（releaser 不执行）：

```bash
# P5 重跑（全量测试）
make test-quick

# lint + typecheck
make lint && make typecheck
```

**P5 测试结果（来自上游）**：1001 passed + 2 skipped

## 临时资源清单

| 类别 | 项目 | 说明 |
|------|------|------|
| 临时服务/进程 | 无 | 纯后端代码改动 + pytest 测试，未启动 debug server 或其他服务 |
| 临时数据 | 无 | conftest.py autouse tmp_path 隔离，测试数据自动清理 |
| 开发安装 | jieba 0.42.1（venv） | pyproject.toml 已声明依赖，venv 中已安装，无需卸载（正式安装时会自动安装） |
| 端口占用 | 无 | 未占用任何端口 |
| 临时文件 | 无 | 未创建临时文件 |

## 生产环境隔离

`[PROD_NOT_TOUCHED]`

本次任务全程在后端开发环境（backend/.venv + pytest conftest tmp_path 隔离）中完成，未触碰生产数据库 `~/.peekview/peekview.db`，未启动 `:8080` 服务，未通过 CLI 创建测试 entry。

## Lessons Learned

1. **SQLModel JSON 序列化与 SQLite 原生 JSON 函数的语义鸿沟**（架构）：SQLModel 默认 `ensure_ascii=True` 将中文转为 `\uXXXX` 转义序列存储，导致 SQLite `LIKE` 匹配失败。跨 ORM 与原生 SQL 函数交互时，必须验证序列化格式是否兼容，不能假设存储值即原始值。（来源：T083，2026-07-31）

2. **FTS5 unicode61 tokenizer 的 CJK 盲区**（架构）：SQLite FTS5 默认 unicode61 tokenizer 对 CJK 字符不分词（每个汉字独立 token 或整体单 token），导致子词搜索失效。CJK 语言需要应用层预分词（如 jieba），不能依赖数据库 tokenizer。（来源：T083，2026-07-31）

3. **FTS trigger 与应用层写入的竞态**（架构）：当 trigger 和应用层同时负责 FTS 写入时，两者执行顺序不确定，可能产生重复或垃圾 token。trigger 应仅负责清理（DELETE），写入完全由应用层独占，职责单一避免竞态。（来源：T083，2026-07-31）

## SCOPE_GAP 检查

对照 P2-design.md `packages: [backend]` 声明：
- P2 声明仅 backend 包受影响，本次 P8 仅处理 peekview 版本 bump
- MCP server 无代码改动，无需 bump
- **无 SCOPE_GAP**

## 交接给主 Agent

1. **bump-version**：执行 `make bump-version NEW_VERSION=0.12.3`（同步 VERSIONS.json + 所有文件版本号 + commit + tag）
2. **CHANGELOG**：已更新，bump-version 后需 `git add CHANGELOG.md && git commit --amend --no-edit` 将 CHANGELOG 并入 bump commit
3. **P5 重跑**：bump-version 后重跑 `make test-quick` 确认全绿
4. **READY 收尾**：按临时资源清单检查（本任务无临时服务/数据/端口需清理，jieba 依赖保留在 venv 中）
