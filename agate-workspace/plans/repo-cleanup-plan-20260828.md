# PeekView 仓库清理计划（repo-cleanup-2026-08-28）

> 创建：2026-08-28 | v2（合并独立评审修正）
> 独立评审：needs-revision（轻度）→ 4 个必须修正已合并，2 个建议采纳
> 目的：整理项目全部文件，判定有效/过期/失效，归档过时文档、清除失效垃圾。
> 判定原则：**保留**（活跃/被引用）→ **归档 archived**（过时但有历史价值）→ **删除**（纯垃圾/构建产物/缓存）。

---

## 一、审计方法

- `git ls-files` 全量清单 + `git check-ignore --no-index` 识别"被跟踪但本应忽略"的文件（全量穷尽比对，确认无遗漏）
- `du` 体积统计 + `find` 目录树
- 交叉引用核查（`grep -rl`）判断文档活跃度
- 全程只读，不改动生产数据

---

## 二、问题分类与处置

### A 类：被 git 跟踪但按 `.gitignore` 应忽略的构建产物（6 项，共 8958 文件）

| # | 路径 | 数量/体积 | 处置 |
|---|------|----------|------|
| A1 | `frontend-v3/node_modules/` | **8779 文件 / 271MB** | `git rm -r --cached`（停止跟踪，磁盘保留供构建） |
| A2 | `backend/peekview/static/` | 167 文件 / 25MB | `git rm -r --cached` |
| A3 | `frontend-v3/dist/` | 7 文件 / 25MB | `git rm -r --cached` |
| A4 | `backend/zip-*-test.zip` | 3 文件 | `git rm --cached`（运行时测试产物，非 fixture） |
| A5 | `agate-workspace/tasks/T086-*/P6-evidence/logs/*.log` | 2 文件 | **保留跟踪** + gitignore 豁免（见下） |
| A6 | `docs/.agate-env-baseline-cache/` | 1 文件 | `git rm --cached` + 加 gitignore（运行时生成缓存） |

> **说明**：
> - `git rm --cached` 只从索引移除（git 历史仍保留记录），磁盘文件不删。
> - **A5 决策**（评审修正 R3）：T086 的 2 个 log 是全仓唯一被跟踪的 .log，任务证据入库是本仓库惯例（其他任务 P6 证据 json 均正常跟踪）。→ 改为 **gitignore 豁免保留跟踪**：在 `*.log` 规则后加 `!agate-workspace/tasks/**/P6-evidence/logs/*` 文件级豁免，与 E 类"任务记录完整保留"对齐。
> - **A1 补充**：`packages/mcp-server/node_modules/`（111M 磁盘）与 A1 同逻辑保留（MCP 开发/单测需要），点名防止过度删除。
> - `.git` 目录 194MB 的历史膨胀暂不处理（历史重写风险高，另行决策）。

### B 类：未跟踪的物理垃圾（磁盘删除，**仅限显式路径**）

| # | 路径 | 体积 | 处置 |
|---|------|------|------|
| B1 | `backend/peekview-backup-*.tar.gz` | **562 个 / 2.5MB** | 删除（测试残留备份） |
| B2 | `backend/dist/`（wheel） | 6.5MB | 删除（`make build-backend` 可重建；publish 缺 whl 会自动 make build） |
| B3 | `.ruff_cache/`、`.pytest_cache/`、`frontend-v3/.ruff_cache/` | ~170KB | 删除（缓存） |
| B4 | `backend/peekview/__pycache__/` | 8KB | 删除（缓存） |
| B5 | `frontend-v3/docs/tasks/` | 57 文件 / 10MB | 删除（gitignore 的临时任务证据，全为 png 截图） |
| B6 | `test-results/`、`frontend-v3/test-results/`、`frontend-v3/playwright-report/` | 少量 | 删除（测试产物） |
| B7 | `FEATURES.json`、`FEATURES.md` | 2KB | 删除（已 gitignore 的过期自动生成矩阵；`make update-docs` 可重建，doc_checklist 不因缺失失败） |
| B8 | `.gate-result.json`、`.gate-history.jsonl` | 84KB | 删除（gate 临时文件；PAUSED 校验已由 HEAD/staged diff 机制覆盖） |
| B9 | 空目录 `docs/analysis/`、`docs/releases/`、`docs/review/` | 0 | 删除空目录 |
| B10 | `packages/mcp-server/dist/` | 500K | 删除（已忽略，`make build-mcp` 可重建） |

> **⚠️ 执行约束（评审修正 R2）**：B 类**只能按上述显式路径逐项删除**，**严禁裸 `git clean -fdX` / `-fd` 批量执行**——约 19+ 个任务（T019/T032/T044/T047/T048/T051/T052/T054/T055/T056/T058/T060/T065/T067/T069/T070/T073/T075/T076 等）的 P6 证据（*.log、vision-reports/、screenshots/、traces/）仅存磁盘且被 ignore，批量 clean 会连带销毁审计证据。

### C 类：过期/失效文档（归档 archived 或删除）

| # | 路径 | 判定 | 处置 |
|---|------|------|------|
| C1 | `docs/plans/*.md`（7 个） | 全部 0 活跃引用，方案已实现（Makefile 进度标记 / AGENTS 铁律 / CLI 命令集落地均有代码证据） | **归档** → `agate-workspace/archived/plans/`（无重名冲突） |
| C2 | `docs/superpowers/` | 2026-06-27 diagram 重构计划，DiagramBlock.vue/useDiagramViewer.ts 均已存在→已实现 | **归档** → `agate-workspace/archived/superpowers/`（历史先例已存在） |
| C3 | `docs/experiments/` | 2026-06-28 dispatch 实验 | **归档** → `agate-workspace/archived/experiments/` + 同步更新 `docs/process/subagent-dispatch-guide.md:5` 引用 |
| C4 | `docs/process/workflow-v4/` | README 自述"已迁移至 agate，本目录保留作为历史归档" | **归档** → `docs/process/archived/workflow-v4/`（与 workflow-v2 同处） |
| C5 | `cdp-smoke-test.ts`、`e2e-diagram-test.ts` | 2026-06-27 一次性调试脚本，0 引用、无 CI/ Makefile 引用 | **归档** → `scripts/archived/`（需先 `mkdir -p scripts/archived`，git mv 目标目录须先存在） |

> **C1 附注**：infra-improvements 系列 5 个文件（2026-08-06）文件头仍写"待实施/待复审"，但代码已落地。归档到 archived/plans 本身即表明"已完成/历史"，且 archived/README.md 已声明"不代表当前状态"——不改文件内容（保持历史原样），仅在归档目录聚合处体现。

### D 类：悬空/失效引用修复（编辑）

| # | 文件 | 问题 | 处置 |
|---|------|------|------|
| D1 | `INDEX.md` L38-39 | 「活跃计划」区引用 2 个已归档 plan（实际在 `agate-workspace/archived/plans/`） | 删除两行；「活跃计划」节将变空 → 整节删除或改指 `docs/roadmap/improvement-backlog.md` |
| D2 | `docs/process/subagent-dispatch-guide.md:5` | 引用 `docs/experiments/2026-06-28-dispatch-test/`（C3 归档后断链） | 更新为新归档路径 |
| D3 | `docs/process/multi-device-guide.md:71` | 引用 `docs/plans/impl-plan.md`（本就不在 docs/plans/，实际在 archived） | 更新为归档实际路径 |

### E 类：保留（确认有效，不动）

- `docs/guides/`（DEPLOYMENT/DEBUGGING/agent-deployment 均被引用）、`docs/process/`（release.md 117 引用等）、`docs/decisions/`、`docs/roadmap/`、`docs/strategy/`、`docs/research/`、`docs/reviews/`（历史复盘，刻意保留）
- `docs/converse/`（agent 角色文档，被 AGENTS 体系引用）
- `agate-workspace/tasks/*`（P0-P8 任务记录 + P6 证据，历史与审计价值）
- `agate-workspace/debt/`、`agate-workspace/agents/`、`scripts/`、`.github/`、`packages/mcp-server/src/`、backend/frontend 源码、`frontend-v3/public/vendor/`（plantuml 运行时资产，被 usePlantUML.ts 引用）

---

## 三、风险与边界

1. **不重写 git 历史**：node_modules 等从索引移除即可，`.git` 体积优化属独立决策（需 filter-repo，风险高）
2. **不删磁盘 node_modules**（frontend + mcp-server）：仅解除跟踪
3. **不碰生产环境**：`~/.peekview/`、pipx `:8080` 一律不动
4. **归档用 `git mv`**：C 类保留历史，git 能追踪移动
5. **B 类严禁 `git clean` 批量**：只显式路径删除（防连带销毁 P6 证据）
6. **R1（评审必须项）**：A2 解除跟踪后，`make publish` Step 1 的 `git status --porcelain backend/peekview/static/` 守卫永久 no-op（ignored 文件永不出现在 status），`git checkout backend/peekview/static/` 建议也将失效 → **同步修改 publish Step 1**：改为磁盘存在性检查（`test -f backend/peekview/static/index.html`，类似 debug-build），真正兜底是 Step 3 的 `verify-wheel`
7. **执行后验证**：`git status` 干净 + `make lint && make typecheck` 不受影响（无代码改动，仅 Makefile publish Step1 一处守卫调整）

---

## 四、执行顺序

1. **A 类**：`git rm --cached`（A1/A2/A3/A4/A6；A5 改为豁免保留跟踪）
2. **.gitignore 更新**：补 `docs/.agate-env-baseline-cache/` + A5 log 豁免规则（`!agate-workspace/tasks/**/P6-evidence/logs/*`）
3. **B 类**：显式路径删除磁盘垃圾（10 项，不用 git clean）
4. **C 类**：`mkdir -p scripts/archived` → `git mv` 归档（5 项）
5. **D 类**：修复 INDEX.md / subagent-dispatch-guide.md / multi-device-guide.md 悬空引用
6. **R1**：修改 Makefile publish Step 1 static 守卫为磁盘存在性检查
7. **验证**：`git status` + `make lint && make typecheck`
8. **CHANGELOG 记录**（[Unreleased] 内部整理说明）
