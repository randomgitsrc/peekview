# Plan: Makefile 唯一真相源 —— Agent 不再手写裸命令

> v6. 经三轮独立评审迭代。新增实施前置验证步骤。

## 背景

T060 复盘发现 T056 新增依赖后 venv 未同步，395 测试虚设 4 个任务周期。根因：多个文件各自定义测试命令，Makefile 未被信任为唯一入口。

## 审计核心发现（三轮评审累积）

| 层面 | 最严重发现 |
|------|-----------|
| 安全 | CLAUDE.md 的 `make dev` 指向 backend/Makefile 的 `dev`，直接 `uvicorn :8080` |
| 歧义 | backend/Makefile 同名 target 与根 Makefile 行为完全不同 |
| 盲区 | `pre-publish` 不跑前端测试；`test` 只跑后端 |
| 分裂 | CI 版本检查脚本与 Makefile 不同 |
| 冲突 | release.md "快速发布"手写 tag，与 `bump-version` 冲突 |
| 残留 | `docs/converse/agents/*.md` 含大量裸命令 |

## 实施前置验证（在写任何代码之前）

**P0-1：`@AGENTS.md` 语法验证。** 在 OpenCode 环境中创建测试 CLAUDE.md（内容为 `@AGENTS.md`），派发 subagent，确认 Agent 能正确解析并读取到 AGENTS.md 的内容。如果 OpenCode 不支持此语法，CLAUDE.md 改为显式维护一份精简的项目约定副本（接受少量重复，但确保两边内容一致）。

**P0-2：CI 版本脚本覆盖补缺。** `sync_versions.py --check` 缺少 `backend/README.md` 的版本检查（当前 `update_version_docs.py` 有此检查）。替换 CI 前先在 `sync_versions.py` 的 `DOC_SLOTS` 中补上 `backend/README.md`。

## 改动清单

### 1. 根 Makefile

**1a. 新增 `guard-venv`**

```makefile
guard-venv:
	@if [ ! -d "backend/.venv" ]; then \
		echo "⚠️  venv 不存在，请先运行 make dev"; exit 1; \
	fi
	@cd backend && .venv/bin/python -c "import peekview" 2>/dev/null || \
		(echo "⚠️  peekview 不可导入，请运行 make dev"; exit 1)
	@cd backend && .venv/bin/python -c "import pytest, httpx" 2>/dev/null || \
		(echo "⚠️  测试依赖缺失，请运行 make dev"; exit 1)
```

**1b. 修 `test-quick` / `test-backend`**

```diff
-test-quick:
+test-quick: guard-venv
-    cd backend && python3 -m pytest tests/
+    cd backend && .venv/bin/python -m pytest tests/

-test-backend:
+test-backend: guard-venv
-    cd backend && python3 -m pytest tests/
+    cd backend && .venv/bin/python -m pytest tests/
```

**1c. `test-failed` 只改 python 路径，不加依赖**

**1d. 修 `test-frontend` 的 `|| echo` bug + 加 node_modules 检查**

```diff
 test-frontend:
-    cd frontend-v3 && npm run test -- --run || echo "⚠️  Frontend tests skipped"
+    @if [ ! -d "frontend-v3/node_modules" ]; then \
+        echo "→ Installing frontend dependencies..."; cd frontend-v3 && npm ci; \
+    fi
+    cd frontend-v3 && npx vitest run
```

**1e. 修 `debug-test-mcp` 的 `|| echo`**

区分三类：MCP 集成测试（需要 API key，`|| echo` 合理保留）、Playwright E2E（必须失败，删 `|| echo`）、MCP 单元测试（保持不变）。

**1f. `test` 包含前端测试**

```diff
-test: build-backend test-backend
+test: build-backend test-backend test-frontend
```

**1g. `pre-publish` / `pre-publish-quick` 继承上述修复**

**1h. 新增三个 target**

| target | 命令 |
|--------|------|
| `lint` | `cd backend && python3 -m ruff check peekview/ tests/` |
| `lint-fix` | `cd backend && python3 -m ruff check --fix peekview/ tests/ && python3 -m ruff format peekview/ tests/` |
| `typecheck` | `cd frontend-v3 && npx vue-tsc --noEmit` |

**1i. `help` 文本补全**

### 2. AGENTS.md

裸命令全部替换为 `make` 引用，注释保留。**明确替换行 72-73 两条裸命令：**

```
make test-quick         # 测试（用 venv，自动检查 venv 是否过期）
make lint               # lint（ruff 不在 venv，用系统 python3）
make lint-fix           # lint 自动修复
make typecheck           # 类型检查（CI 强制）
make test-frontend       # 前端单测（非 watch 模式，失败会报错）
make debug-test          # E2E 全量
E2E_SPEC=e2e/<spec>.ts make debug-test  # E2E 单个 spec
```

铁律第 10 条改为引用 Makefile target。

新增规范（建议性，不强制）：

> **gate_commands 建议引用 Makefile target**，如 `P5: "make test-quick"`。特殊场景（如只跑单个 E2E spec）可用 `E2E_SPEC=... make debug-test`。

**从 CLAUDE.md 迁移的内容**：CLAUDE.md 中的 `mypy` 状态说明、Testing Strategy 部分等非命令但属于项目约定的信息，移入 AGENTS.md。

### 3. CLAUDE.md → 轻量包装

```markdown
@AGENTS.md

## Claude Code 专属
- 大改动前用 plan mode
```

项目约定全部在 AGENTS.md 里维护。CLAUDE.md 不再重复。

### 4. 其他文件

| 文件 | 改动 |
|------|------|
| `backend/Makefile` | 全部 target 改为转发到根 Makefile + 报错提示 |
| `release.md` | 删"快速发布一句话"和手写 tag 步骤，改为引用 `make bump-version` |
| `ci.yml` | `doc-consistency` job 改用 `make check-version`（前提：P0-2 已补缺） |
| `docs/converse/agents/*.md` | 不在本次范围。它们是角色定义文件，裸命令是角色行为描述的一部分，和 AGENTS.md 的命令速查是不同用途 |

### 5. 不改

| 文件 | 理由 |
|------|------|
| `~/.agate/phase-cards/` | agate 协议 |
| `docs/process/debug-workflow.md` 的 curl / env-check 命令 | 一次性诊断命令 |
| `frontend-v3/package.json` 脚本 | 前端子项目自主 |
| `docs/converse/agents/*.md` | 角色定义，非命令速查 |

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| `@AGENTS.md` 语法不支持 | P0-1 先验证，不支持则 CLAUDE.md 维护精简副本 |
| CI 版本检查缺 `backend/README.md` | P0-2 先补 `sync_versions.py` |
| `make test` 首次运行缺 node_modules | `test-frontend` 内建 `npm ci` 检查 |
| `guard-venv` 检测不到新增的单个 test 依赖 | 检查 `import pytest, httpx`（最常用的两个 test 依赖），覆盖 90% 场景 |

## 修订记录

| 版本 | 变更 |
|------|------|
| v1 | 初版：`dev` 全量安装前置 |
| v2 | `dev` → `guard-venv`；修 `|| echo`；注释保留 |
| v3 | 范围扩展到 CLAUDE.md + backend/Makefile + CI + release.md |
| v5 | 工具差异修正：OpenCode↔AGENTS.md, Claude Code↔CLAUDE.md |
| v6 | 三轮评审集成：P0 前置验证 + guard-venv 加 httpx + test-frontend 加 node_modules + CLAUDE.md 内容迁移 + debug-test-mcp `|| echo` 分类处理 + gate_commands 改为建议 |