---
phase: P8
task_id: TPV0088-e2e-test-infra-hardening
type: release
parent: P7-consistency.md
trace_id: TPV0088-P8-20260812
status: draft
created: 2026-08-12
agent: implementer
# ── v2.0 机器字段 ──
bump_type: patch
packages: [peekview]
---

# P8 — 发布准备：TPV0088 e2e-test-infra-hardening

[PROD_NOT_TOUCHED] 本阶段为纯文档/读操作：未执行 bump-version/commit/tag、未启动/停止任何服务、未触碰生产 :8080 与 `~/.peekview/`。仅读取 P1-P7 产出与 git diff/status 只读命令。

## 1. bump_type 判定

**bump_type: patch（0.18.3 → 0.18.4）**

判定理由：

1. **P1 显式声明 "release 流程照常"**（P1-requirements.md §5 P8 裁剪说明）：虽然改动为纯测试基础设施、无用户可见功能变更，但 P1 基线已明确走正常发布流程。
2. **T082 先例**：CHANGELOG 0.12.2 收录了 E2E 测试修复（`.btn-login` 选择器失效、路由 `/`→`/explore`、Playwright CDP 模式），说明本项目对"测试基础设施修复"有记录进 CHANGELOG 随版本发布的先例。
3. **发布单元 = peekview**：P2 packages 声明 `[frontend-v3, makefile, scripts]` 是文件位置，非独立版本包。viewer.spec.ts 属于 frontend-v3（随 peekview 包发布），e2e-safety-check.sh + Makefile 在仓库根。实际唯一发布单元为 **peekview**。
4. **风险考量**：mtime 新鲜度校验（Check 6）会影响 CI 与本地调试流程的执行路径（BDD-6/7/8 已实测），属 CI/开发者体验行为变更，值得随版本记录。

**mcp_server 不 bump**：本任务无 MCP 改动（P1 IMPL-M1 明确），0.10.0 保持不变。

## 2. 版本变更确认

| 包 | 当前版本（VERSIONS.json） | 目标版本 | 变更类型 |
|----|--------------------------|----------|----------|
| peekview | 0.18.3 | **0.18.4** | patch |
| mcp_server | 0.10.0 | 0.10.0（不变） | — |

版本源：`VERSIONS.json`（唯一版本源）。主 Agent 执行 `make bump-version NEW_VERSION=0.18.4` 后将同步到所有文件（pyproject.toml / package.json / frontend 等）。

## 3. CHANGELOG 更新计划

当前 CHANGELOG `[Unreleased]` 为空（v0.18.3 已于 2026-08-12 发布并收尾）。按发布流程：CHANGELOG 内容先入 `[Unreleased]`，bump-version 时移动到 `[0.18.4]`。

### 3.1 待写入 [Unreleased] 的内容（供主 Agent bump 时落盘）

```markdown
## [Unreleased]

### 修复

- E2E 测试修复：`frontend-v3/e2e/viewer.spec.ts` 19 用例全部修复通过——路由格式 `/#/entry/{slug}` 改为 history 模式 `/{slug}`，失效 seed slug `lu4prg`/`ngajri` 重映射到现存 entry（python-entry-service / markdown-test / mermaid-charts / json-api-config），12 处死选择器/过时断言替换为现存 DOM 节点（此前 20 用例全部预期失败）(TPV0088)
- `make debug-test` 前置检查（e2e-safety-check.sh）新增 static 产物新鲜度校验（Check 6）：`frontend-v3/src/` 最新 mtime 晚于 `backend/peekview/static/index.html` 时拦截并提示 `make build-frontend`，防止前端改动未重建 static 时 E2E/验收基于过期产物假通过 (TPV0088)
```

### 3.2 落盘后结构

bump 后 `[Unreleased]` 内容移到 `[0.18.4]`，`[Unreleased]` 区留空待下个版本。条目内保留 `(TPV0088)` 追溯标记，与现有 CHANGELOG 风格一致。

## 4. 发布检查（主 Agent gate 执行，本文件不落执行结果）

主 Agent 需亲自执行（不可委托）：

1. 从 P2 gate_commands 读取发布相关命令并逐条执行：
   - `make test-quick`（P5，确认 bump 后全绿）
   - `make typecheck`（CI 强制）
   - `E2E_SPEC=e2e/viewer.spec.ts make debug-test`（P5_e2e，19 用例 ×2 项目 = 38）
   - `bash scripts/e2e-safety-check.sh --test-mtime`（Check 6 自检）
2. `git log v0.18.3..HEAD --oneline` 对照 CHANGELOG 无遗漏（本次改动仅 TPV0088，无其他未记录改动）
3. 从 P2 packages 验证 version 文件路径（VERSIONS.json 为源，bump 脚本同步）

## 5. 临时资源清单（releaser → 主 Agent READY 收尾交接）

### 5.1 运行中的服务/进程

| 资源 | 状态 | 清理动作 |
|------|------|----------|
| debug backend uvicorn `:8888`（`backend/.venv` 启动，PID 见 `ps aux \| grep uvicorn`） | **仍在线**（本次派发时确认） | `make debug-stop`（同时清理 `/tmp/peekview-debug/`） |
| CDP Chrome `:18800`（Windows 侧共享浏览器） | 在线 | 不属于本任务启动，不动 |
| 生产 pipx peekview `:8080` + peekview-mcp | 在线 | 本任务全程未触碰，禁止停止 |

### 5.2 临时数据

| 资源 | 说明 | 清理动作 |
|------|------|----------|
| `/tmp/peekview-debug/` | debug 数据目录（含 peekview.db + seed 23 entries） | `make debug-stop` 自动清理 |
| `docs/tasks/TPV0088-*/P6-evidence/logs/` | P6 验收证据日志（8 个） | 保留（任务证据，随 docs 提交） |
| `docs/tasks/TPV0088-*/P3-test-code/` | mtime 校验 fixture 测试脚本 | 保留（P3 产出） |

### 5.3 工作区改动（git status 核实）

| 改动 | 说明 | 处理 |
|------|------|------|
| `backend/zip-*.test.zip`（3 个已跟踪二进制，M 状态） | 后端 zip 相关测试运行产生的二进制变动（`make test-quick` 副作用），非本任务改动 | 若确认是测试写入残留，主 Agent 判定是否还原（`git checkout`）后再 commit；若属既有脏状态则保持原状 |
| `docs/tasks/TPV0088-*/P8-dispatch-context-implementer.md`（未跟踪） | 本次派发产物，随任务 docs 提交 | 保留 |
| `frontend-v3/e2e/viewer.spec.ts` / `scripts/e2e-safety-check.sh` / `Makefile` | 本任务核心改动（已提交于 P4/P5） | 随 P8 发布 commit |

### 5.4 开发安装

无。本任务未做 editable install / 全局包安装（P0 env_constraints 明确走 venv 与 debug backend）。

## 6. 生产环境标记

`[PROD_NOT_TOUCHED]` 本任务 P1-P8 全程未触碰生产 :8080、`~/.peekview/`、生产 DB。P6 已声明；本 P8 复查 git status 无生产相关改动。

## 7. Lessons Learned

| 类别 | 教训 | 来源任务 | 日期 |
|------|------|----------|------|
| 测试 | 测试代码自身的修复无现有测试兜底时，必须把"P6 逐条实跑非抽样"作为唯一验收锚点；仅改路由格式/选择器不实跑会产生假绿（本任务 20 用例全部预期失败，全靠 BDD-1 38 次实跑兜底） | TPV0088 | 2026-08-12 |
| 测试 | E2E spec 的 seed slug 是脆弱耦合——seed-data 目录结构变化（新增/删除 entry）会让硬编码 slug 静默失效；应在 spec 顶部集中维护 slug→entry 映射并加注释（P1 风险登记"seed 数据后续被删导致 slug 再次失效"为 low 已接受，但映射集中化已落地） | TPV0088 | 2026-08-12 |
| 流程 | 测试基础设施的"前置检查加固"（本任务 Check 6 mtime 校验）要防止误伤正常流程：以既有完整链路（`make debug-quick` → `debug-test`）做 BDD-8 回归，并以 `--test-mtime` 自检模式隔离 fixture 验证，避免为修测试而破坏开发者日常命令 | TPV0088 | 2026-08-12 |

## 8. 主 Agent 后续动作（本文件不执行）

1. gate 验证（§4）通过后执行 `make bump-version NEW_VERSION=0.18.4`
2. 将 §3.1 内容写入 CHANGELOG `[Unreleased]` 并 bump 时移动到 `[0.18.4]`，`git commit --amend --no-edit`
3. `git push && git push origin v0.18.4`
4. 升级生产（⚠️ 人工）：`pipx upgrade peekview && sudo systemctl restart peekview`
5. 按 §5 清理临时资源（`make debug-stop` 等）
6. 更新 `.state.yaml` phase → READY → DONE + active-tasks.md
