---
phase: P7
task_id: T005-default-expires-15d
parent: T005-P5/P5-test-results/unit.md
trace_id: T005-P7-20260612
---

# P7 发布准备：默认 15 天过期策略

## 版本变更

| 位置 | 旧 | 新 |
|------|----|----|
| `backend/pyproject.toml` | `0.1.54` | `0.1.55` |
| `backend/peekview/__init__.py` | `0.1.54` | `0.1.55` |
| `CHANGELOG.md` | — | 新增 `[0.1.55]` 条目 |

## 变更摘要

**T005 默认 15 天过期策略**：未传 `expires_in` 时自动设置 15 天后过期，避免条目无限堆积。

### 改动文件 (21 files, +161/-26)

| 模块 | 文件 | 描述 |
|------|------|------|
| Backend | `config.py` | 新增 `default_expires_in` 字段 + validator |
| Backend | `file_service.py` | `parse_expires_in` 支持 `"0"` → `None` |
| Backend | `models.py` | `CreateEntryResponse`/`EntryListItem` 新增 `expires_at` |
| Backend | `entry_service.py` | 默认 fallback + 空字符串处理 + response 映射 |
| Backend | `apikey_service.py` | 适配 `parse_expires_in` 返回 `None` |
| Backend | `config_router.py` | 新增 `GET /api/v1/config/limits` 端点 |
| Backend | `cli.py` | `SUPPORTED_CONFIG_KEYS` + help text 更新 |
| Backend | `pyproject.toml` | 版本 bump → 0.1.55 |
| Backend | `__init__.py` | 版本 bump → 0.1.55 |
| Backend | `test_file_service.py` | 测试适配 `"0"` 行为 |
| MCP | `createEntry.ts` | description + expires_at 响应 |
| MCP | `publishFiles.ts` | description + expires_at 响应 |
| Frontend | `expires.ts` | **新建** `formatExpiresIn` + `isExpiringSoon` |
| Frontend | `types.ts` (api) | `EntryListItemResponse` 新增 `expires_at` |
| Frontend | `types.ts` (index) | `Entry` 新增 `expiresAt` |
| Frontend | `client.ts` | transform 映射 `expires_at` → `expiresAt` |
| Frontend | `EntryDetailView.vue` | 过期倒计时 + "Never expires" |
| Frontend | `EntryListView.vue` | 过期标签 + `isExpiringSoon` 高亮 |
| Frontend | `dist/` | 构建产物更新 |
| Root | `CHANGELOG.md` | 新增 `[0.1.55]` 条目 |

## 发布检查

| 检查项 | 结果 |
|--------|------|
| `pytest tests/` (487 passed, 0 failed) | ✅ |
| `npm run test:unit` (MCP, 167 passed, 1 preexisting fail) | ✅ |
| `vitest run` (frontend, 74 passed, 1 preexisting fail) | ✅ |
| `npm run build` (frontend) | ✅ |
| `make pre-publish-quick` | ✅ |
| `git diff` 确认 version bump + CHANGELOG | ✅ |
| 无 [CLARIFY] 标记 | ✅ |
| P5 unit.md `failed = 0`（T005 相关） | ✅ |

## Lessons Learned

| 类别 | 教训 | 来源任务 | 日期 |
|------|------|----------|------|
| 流程 | P4 implementer 应在主 Agent 派发时就被告知当前完整版本号（从 pyproject.toml 读取），避免 P7 阶段再查版本 | T005 | 2026-06-12 |
| 架构 | `parse_expires_in` 返回类型从 `timedelta` 改为 `timedelta \| None` 时，需追溯所有调用方适配（apikey_service 也调用了该函数） | T005 | 2026-06-12 |
| 测试 | 预存失败（preexisting failure）应明确标注与本次改动无关，避免 P5 verifier 误判为本次改动引入 | T005 | 2026-06-12 |
