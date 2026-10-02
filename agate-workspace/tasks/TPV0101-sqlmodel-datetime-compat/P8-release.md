---
phase: P8
task_id: TPV0101
type: release
parent: P7-consistency.md
trace_id: TPV0101-P8-20261003
status: draft
created: 2026-10-03
agent: releaser
# ── v2.0 机器字段 ──
bump_type: patch
debt_check: reviewed
packages: [peekview]
domains: [backend]
ui_affected: false
---

# P8 发布准备 — TPV0101：sqlmodel 0.0.47 naive datetime 兼容修复

> 角色：releaser（implementer P8 模式）。**本文只给发布准备方案，不执行 bump/commit/tag/publish，不改任何版本文件/CHANGELOG/源码。**
> 上游：P2-design.md（`packages: [peekview]` + gate_commands）、P5-test-results/unit.md、P6-acceptance.md（18/18 PASS）、P6.5-judge-verdict.md（passed）、P7-consistency.md（approved，BLOCKER=0）。
> 工作区核对：`git diff --stat v0.26.0..HEAD -- . ':(exclude)agate-workspace'` 仅 4 个 backend 文件（见 §2），**零前端源改动、零 MCP 改动**。

---

## 1. 版本决策

### 1.1 bump_type: `patch`

**依据（语义化版本）**：本任务 `change_type: refactor`，P6 回归口径 `regression_pass: true`，18 条 BDD 证明「用户可见行为不变」——修复的是**依赖升级（sqlmodel 0.0.47）暴露的内部存储层类型契约缺陷**，非新增功能、非破坏性变更。

- 不含新功能（无 `minor` 语义）。
- 不含不兼容 API/数据变更（无 `major` 语义）：不改列名、不改 `nullable`/`server_default`/`onupdate`、不改迁移 SQL、不迁移数据、不改 API/备份/CLI 序列化契约（BDD-7/8/17）。
- 属缺陷修复（CI 后端测试在最新 sqlmodel 下长期红，DEBT0019）→ **`patch`**。

### 1.2 版本方案：`peekview 0.26.0 → 0.26.1`

| package | 旧版本 | 新版本 | 是否 bump | 依据 |
|---------|--------|--------|-----------|------|
| `peekview` | 0.26.0 | **0.26.1** | ✅ | P2 frontmatter `packages: [peekview]`；改动面全在 backend |
| `mcp_server` | 0.12.0 | 0.12.0 | ❌ **不 bump** | `packages/mcp-server/**` 零改动；`git diff v0.26.0..HEAD` 不含该目录；MCP 经 HTTP API 间接消费，无自有 ORM 时间列（P2 §0.2、BDD-17） |

> **前端不是独立 package**：`frontend-v3/package.json` 的 version 与 peekview 同源，由 `make bump-version` 经 `scripts/sync_versions.py` 自动同步为 0.26.1——这是「peekview 包版本同步」，不是「前端独立发版」，无需单独的 `bump-mcp-version` 式操作。

---

## 2. 受影响文件与版本同步面（主 Agent 执行，本阶段只读确认）

**本任务源码改动面**（`git diff --stat v0.26.0..HEAD`，排除 agate-workspace）：

```
backend/peekview/models.py                  | 152 +++++++++---   (25 列显式 naive)
backend/pyproject.toml                      |   2 +-            (sqlmodel>=0.0.14 → >=0.0.14,<1.0.0)
backend/tests/test_datetime_naive_compat.py | 353 +++++++++++    (P3 新增守卫)
backend/tests/test_dependency_guard.py      |  86 +++++          (P3 新增依赖守卫)
```

**`make bump-version NEW_VERSION=0.26.1` 将同步的版本槽位**（`scripts/sync_versions.py`，供主 Agent 核对）：

- 源码：`VERSIONS.json`、`backend/pyproject.toml`、`backend/peekview/__init__.py`、`frontend-v3/package.json`
- 文档：`README.md`（version badge）、`INDEX.md`（Backend/Frontend v）、`docs/roadmap/improvement-backlog.md`（Backend v）、`backend/README.md`（health check version）
- CHANGELOG：`ensure_changelog` 自动在 `## [Unreleased]` 下插入 `## [0.26.1] - <执行日>` 标题（正文需主 Agent 补，见 §3）

> `mcp_server` 槽位（`packages/mcp-server/package.json`、`INDEX.md` 的 MCP Server v、backlog 的 MCP Server v）保持 0.12.0 不变。

---

## 3. CHANGELOG 条目文本方案（方案，非执行）

**目标标题**：`## [0.26.1] - <执行日>`（`ensure_changelog` 用 `date.today()`；预期 2026-10-03；保持 `## [Unreleased]` 在上且为空）
**类别**：`### 修复`（本变更性质为缺陷修复）

**正文文本（建议逐字采用）**：

```markdown
### 修复

- sqlmodel 0.0.47 起把裸 `datetime` 列映射为 tz-aware 的 `UTCDateTime`，导致项目按 naive-UTC 写入时抛 `ValueError`（CI 后端测试大面积失败）：`models.py` 的全部 25 个 datetime 列（11 张表）改为显式 `Column(DateTime(timezone=False))`，naive 存储语义与 API 响应 / 备份 JSON / CLI 输出时间形态均保持不变；`sqlmodel` 依赖增加可机械校验上限 `<1.0.0`，并新增依赖守卫与列语义静态守卫测试，拦截未来同类依赖漂移（DEBT0019）
```

**主 Agent 收尾动作**（bump 之后）：将上述正文插入 `## [0.26.1] - <执行日>` 标题之下 → `git add CHANGELOG.md && git commit --amend --no-edit`（与 bump commit 同一 commit）。

---

## 4. 发布检查命令清单（真相源：Makefile / CI）

### 4.1 ⚠️ 发布阻断项（必须先处置）

**`make lint` 当前 exit 1，红灯在 P3 产出的本任务测试文件内**（主 Agent 于发布前必须修复，否则 `make lint` 无法作为通过项）：

```
F401 tests/test_datetime_naive_compat.py:29  `sqlmodel.SQLModel` imported but unused
F401 tests/test_datetime_naive_compat.py:40  `peekview.models.Team` imported but unused
F401 tests/test_datetime_naive_compat.py:41  `peekview.models.TeamMember` imported but unused
I001 tests/test_dependency_guard.py:16       import block un-sorted
→ Found 4 errors. (4 fixable with --fix)
```

- **为何漏到 P8**：P2 `gate_commands` 无 lint key；P4 自查只跑 `ruff check peekview/`（tests/ 未跑）。P4 §4 已记录此事但未修（当时判定测试文件属 P3 产出）。
- **建议最小修复（行为中性，不动任何断言）**：`cd backend && .venv/bin/ruff check --fix tests/`（修掉 4 项 F401/I001），随后 `make lint` 复跑至 exit 0。
  - 仅用 `ruff check --fix`，**不要**用 `make lint-fix`（后者附带 `ruff format`，可能扩大无关 diff）。
  - 该修复不触碰测试断言/逻辑，不影响 P6 验收与 P7 一致性结论；但如主 Agent 认为需重新留痕，可在 P8 gate 说明中记录本次仅 lint 清理。
- 若主 Agent 选择不放宽此项：`make lint` 是 AGENTS.md 铁律 10 的强制项，**不得跳过** —— 修复后复跑是唯一合规路径。

### 4.2 检查命令表（主 Agent 逐条实跑，全部须 exit 0）

| # | 命令（Makefile 真相源） | 作用 | 本任务实测状态 | 备注 |
|---|------------------------|------|----------------|------|
| 1 | `make lint` | ruff（peekview/ + tests/） | ❌ **exit 1**（4 fixable，见 §4.1） | 修复后复跑；AGENTS 铁律 10 强制 |
| 2 | `make test-quick` | 后端全量（本地 venv 0.0.38，xdist） | ✅ 实跑：**1186 passed / 3 skipped**，exit 0 | CI backend-test（本地版本等价） |
| 3 | `/tmp/ci-repro-venv/bin/python -m pytest backend/tests/ -q --tb=short --rootdir=backend` | 0.0.47 CI 等价核心（= P2 `gate_commands.P5_ci_repro`） | ✅ P5 实跑：1186 passed / 3 skipped，exit 0 | **本任务核心价值面**，建议发布前复跑一次 |
| 4 | `make check-version` | 版本一致性（`sync_versions.py --check`，CI doc-consistency job 1:1） | ✅ 基线实跑 exit 0；bump 后需复跑 | bump 后应仍 exit 0 |
| 5 | `make check-changelog` | CHANGELOG 含 `[0.26.1]` 与 `[mcp-v0.12.0]` | ✅ 基线 exit 0；补 CHANGELOG 后复跑 | mcp 节已存在，无需改 mcp |
| 6 | `make pre-publish-quick` | 官方快速发布组合（dev + check-version + check-changelog + test-quick + verify-wheel） | 建议作为收口命令 | 不含 lint，故 #1 需单独跑 |

### 4.3 零前端改动下前端检查的判断

| 命令 | 本任务是否需要 | 判断依据 |
|------|----------------|----------|
| `make typecheck` | **非必需**（可选兜底） | `frontend-v3/src/**` 零改动；`frontend-v3/package.json` 仅 version 字段由 sync_versions 同步，字符串变更不影响类型/构建。CI 的 `frontend-build` job（`vue-tsc --noEmit` + `npm run build`）在 push/PR 时仍会跑，提供兜底；本地跑不产出本任务相关信号。 |
| `make test-frontend` | **非必需** | 同上，无前端逻辑改动 |
| `make build-frontend` | **非必需**（发布流程内部会做） | 无前端源改动；但 `make bump-version` Step 3 内部执行 `build-frontend-fast` 并 `cp` 到 `backend/peekview/static/`，再由 Step 4 `git add -A` 提交——即**发布流程本身会重建一次静态文件**，无需手工前置执行 |

> 结论：本任务发布检查以**后端 + 版本/CHANGELOG 一致性**为必需面（#1–#6）；前端三命令可不跑，依据是改动面为纯 backend。若主 Agent 严格按 AGENTS 铁律 10 的字面要求执行 `make typecheck`，成本约 30–60s，可作为低成本兜底。

---

## 5. debt_check / 债务清单核对

**`debt_check: reviewed`**

| 条目 | 当前状态 | 与本任务关系 | 建议 |
|------|----------|--------------|------|
| **DEBT0019** | open / high / task_id `TPV0100-web-publish` | **本任务的来源与闭环目标**（本任务即为其立项修复） | **建议关闭**（见下） |
| DEBT0018 | open / medium / protocol | TPV0100 登记，`check-judge-verdict.py` 鲁棒性，与本任务无关 | 保持 open |
| DEBT0017 | open / high / protocol | `make bump-version` 的 `git add -A` 无暂存面防护，**与本任务 P8 提交动作直接相关** | 保持 open；本次提交前按 RM-AG0077⑤ 审查暂存面（见 §7） |

**DEBT0019 关闭判据逐条对照**（`agate-workspace/debt/tech-debt.md`）：

1. 「CI Backend Tests 在最新 sqlmodel 下全绿（或依赖已钉住且解释一致）」→ ✅ P5_ci_repro（0.0.47）1186 passed / 0 failed；CI 装 `<1.0.0` 仍解析到 0.0.47，即最新版下全绿。
2. 「全代码库时间字段存储约定统一且显式（naive 列显式 `DateTime(timezone=False)`）」→ ✅ BDD-16：ORM 枚举 25 列 / 11 表全部 `timezone=False`，无裸列。
3. 「pyproject / CI 依赖版本可控，本地与 CI 不再漂移」→ ⚠️ **部分满足**：加了可机械校验上限 `<1.0.0`，并以双版本（0.0.38 / 0.0.47）全量各自全绿证明了「跨版本行为一致」；但**未把本地与 CI 钉到同一版本**（本地 0.0.38 / CI 0.0.47）。按判据括号语义（"依赖已钉住**且解释一致**"）与本任务已交付的跨版本兼容性，建议**按满足处理**，差异点在此明示留痕，由主 Agent 最终裁决。
4. 「备份恢复/清理/star 生命周期等受影响域的回归测试通过」→ ✅ BDD-10/11/12/13/14。

**建议**：主 Agent 在 P8 将 DEBT0019 置 `closed`，`task_id` 改为 `TPV0101-sqlmodel-datetime-compat`，并按 schema 要求（closed 必须含 task_id + evidence 引用 P5/P6）在 `evidence` 追加：
- `path: agate-workspace/tasks/TPV0101-sqlmodel-datetime-compat/P5-test-results/unit.md`（双环境全量 0 failed）
- `path: agate-workspace/tasks/TPV0101-sqlmodel-datetime-compat/P6-acceptance.md`（18/18 PASS，BDD-16 显式列）
- `note: criteria #3 差异说明：未钉同版本，以 <1.0.0 上限 + 双版本行为一致满足`

> 是否关闭 DEBT0019 是主 Agent 决定；本文只给建议与逐条对照。

---

## 6. roadmap 回写

`agate-workspace/roadmap/roadmap.md` **不存在**（已核实无 `agate-workspace/roadmap/` 目录）→ 无关联 RM 条目，P8 gate 的「RM 状态回写」检查**不触发**。

---

## 7. 临时资源清单（releaser → 主 Agent 交接，供 READY 收尾清理）

| 资源 | 类型 | 现状/路径 | 建议处置 |
|------|------|-----------|----------|
| 隔离 venv（0.0.47 / sqlalchemy 2.0.54 / pytest 9.1.1） | 临时环境 | `/tmp/ci-repro-venv` | **保留至发布 gate 通过**（主 Agent 可能复跑 §4.2 #3）；READY 收尾可 `rm -rf /tmp/ci-repro-venv` |
| 本地开发 venv（0.0.38 / sqlalchemy 2.0.51） | 项目常规环境 | `backend/.venv` | 保留（非临时，开发用） |
| 探针/验证脚本（13 个） | 临时脚本 | `/tmp/opencode/tpv0101_*.py` | 工作区外、不进 repo；可删 |
| canonical 临时产物目录 | 仓库内临时目录 | `<repo>/.agate-tmp/`（**空**，已被 `.gitignore` 忽略：`git check-ignore .agate-tmp` 通过） | 保持为空；READY 时确认 `ls -A .agate-tmp` 无输出 |
| debug 日志残留 | 日志文件 | `/tmp/peekview-debug.log` | P5 时点即存在；无 debug 进程/数据目录；可删 |
| debug server / 数据目录 | 服务/数据 | 8888/8889/8890 **无监听**；无 `/tmp/peekview-debug*` 数据目录 | 无需停止动作（本就未运行） |
| E2E / Playwright worktree | — | 无（`ui_affected: false`）；P6 对比用 worktree 已移除（`git worktree list` 仅主工作区） | 无 |
| 开发安装 | — | **无**系统/PipX 安装；仅 `backend/.venv` 隔离安装 | 无污染 |
| 生产 `~/.peekview/` / `:8080` | 生产 | 全程未触碰（P5/P6 均 `[PROD_NOT_TOUCHED]`） | 无 |

**提交前暂存面审查（RM-AG0077⑤，DEBT0017 相关）**：`make bump-version` 的 Step 4 为 `git add -A`，主 Agent 必须在 commit 前过目 `git diff --cached --name-only`。当前工作区非 repo 内容仅有 `agate-workspace/tasks/TPV0101-.../` 下的任务文件（`.state.yaml`、`gate-events.jsonl` 属正常任务账本），`.agate-tmp/` 已忽略——**无明文凭证/临时目录风险**；若出现非预期路径，先 `git reset` 再补 `.gitignore`。

---

## 8. Lessons Learned（供主 Agent 汇入 `docs/notes/lessons.md`）

1. **测试文件也要纳入 lint 门禁** — 类别：测试｜来源：TPV0101｜日期：2026-10-03
   P3 新增的 2 个测试文件含 3 处 F401 + 1 处 I001，P4 自查只跑 `ruff check peekview/`、`gate_commands` 无 lint key，导致 4 项 lint 错误全程未被 gate 捕获，直到 P8 才发现 `make lint` 红灯。教训：任务新增的测试文件必须进同一 lint 面（`ruff check peekview/ tests/`），或把 lint 纳入 gate_commands。

2. **依赖"上游推断"的列类型是隐性契约，应显式化** — 类别：架构｜来源：TPV0101｜日期：2026-10-03
   裸 `datetime` 的存储语义随 sqlmodel 版本从 naive 变为 tz-aware，属上游可随时改动的推断行为。显式 `sa_column=Column(DateTime(timezone=False))` + 可机械校验的依赖上限守卫，是跨版本稳定且可静态核验的正解；守卫须"注入漂移可变红"，否则形同虚设。

3. **本地与 CI 双环境全量必须都跑** — 类别：流程｜来源：TPV0101｜日期：2026-10-03
   本任务根因正是「本地 0.0.38 全绿但 CI 拉到 0.0.47 后 38 failed + 502 errors」——单靠本地全绿会掩盖依赖漂移缺陷。修复验证须在本地版本与 CI 等价隔离版本上各跑一次全量。

---

## 9. 交接给主 Agent 的动作序列（P8 gate + READY）

1. **先修 §4.1**：`cd backend && .venv/bin/ruff check --fix tests/` → `make lint` 复跑至 exit 0（最小、行为中性；如判定需重留痕请在 gate 说明）。
2. **bump**：`make bump-version NEW_VERSION=0.26.1`（内部 `sync_versions` + `build-frontend-fast` + `git add -A` + commit + `git tag v0.26.1`）。**commit 前**过目 `git diff --cached --name-only`（§7）。
3. **补 CHANGELOG**：按 §3 文本填入 `## [0.26.1]` → `git add CHANGELOG.md && git commit --amend --no-edit`。
4. **复跑发布检查**：§4.2 #2–#6（其中 #3 为 0.0.47 CI 等价核心）。
5. **P5 provenance 条件化**：`check-p6-provenance.py --audit7-only` 判定复用/重跑；重跑须安排在 **tag 之后**（DEBT0013 时序）。
6. **debt**：按 §5 关闭 DEBT0019（附 P5/P6 evidence）。
7. **READY 收尾**：按 §7 清理（保留 `/tmp/ci-repro-venv` 至 gate 通过）、`.state.yaml` phase=READY、更新 `active-tasks.md`、确认工作区干净、`git tag` 已建。

---

[PROD_NOT_TOUCHED]
