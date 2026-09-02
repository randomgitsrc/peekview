---
phase: P8
task_id: TPV0095-team-visibility
type: release
parent: P7-consistency.md
trace_id: TPV0095-P8-releaser-20260902
status: ready
agent: implementer (releaser P8 模式)
created: 2026-09-03
# ── 机器字段 ──
bump_type: minor
debt_check: reviewed
packages: [backend/peekview, frontend-v3, packages/mcp-server]
---

# P8 发布准备记录 — TPV0095 团队可见性机制（Team Visibility）

> 本文件为发布准备（releaser 产出物），**不含任何 bump-version / git commit / git tag 执行**——这些由主 Agent 在 gate 验证通过后亲自执行。
> 状态标记：`[PROD_NOT_TOUCHED]`（本阶段只读 VERSIONS.json / CHANGELOG.md / Makefile / git 日志与任务目录文件；未触碰生产 :8080 / ~/.peekview/ / pipx peekview；未运行任何 bump 命令）。
> 验证锚点：P7-consistency.md（BLOCKER=0 / DESIGN_GAP 8/8 REVIEWED / BDD 44↔P6 44↔judge 44）/ P6-acceptance.md（44/44 PASS）/ P5-test-results（1164+1338+277 全绿，见 §7）。

## 1. bump 建议汇总

- **bump_type: minor**（两包均为 minor；功能任务、非破坏，peekview 含 schema 迁移）
- 依据（跨任务声明一致）：
  - P0-brief env_constraints 版本锚 `peekview 0.21.0 / mcp 0.11.0`
  - P2-design.md §13 备注（:573）「peekview 0.21.0→0.22.0（minor，新功能+schema）+ mcp_server 0.11.0→0.12.0（schema 向后兼容）；VERSIONS.json 唯一源双路径检查」
  - P2-design.md :76（mcp_server 0.11.0→0.12.0 P8 执行；peekview 0.21.0→0.22.0 由 P8 定）
  - P0-brief MCP 改动清单（:70）「MCP server bump minor（v0.11.0 → v0.12.0，schema 向后兼容）」
- **semver 理由**：新功能（teams CRUD/成员流/可见性档位 + MCP `list_teams`）+ backend schema 迁移（新增 teams/team_members 表、entries.team_id 列）→ 非破坏 minor；无 breaking API 移除、无既有端点语义回退 → 不升 major。

## 2. 每包版本号变更确认（旧 → 新 + 依据）

| 包 | 角色 | 旧版本 | 新版本（建议） | 变更依据 | VERSIONS.json 同步文件 |
|---|---|---|---|---|---|
| `backend/peekview` | 主发布 | 0.21.0 | **0.22.0** | 新功能 + schema 迁移（teams/team_members 表 + entries.team_id + 索引）；P2 §13 | 见 §3 |
| `frontend-v3` | **不独立 bump**（随 peekview 包发布） | 0.21.0（与 peekview 同号，随同步脚本走） | 随 peekview 至 0.22.0 | VERSIONS.json 无 frontend 独立版本键；`frontend-v3/package.json` 版本由 sync_versions.py 按 peekview 键同步（SOURCE_SLOTS :47） | — |
| `packages/mcp-server` | 独立发布 | 0.11.0 | **0.12.0** | 新只读工具 `list_teams` + createEntry/publishFiles schema 加可选 `team_id`（向后兼容）+ getEntry 输出加 team 字段；P2 §13 | 见 §3 |

- **实测确认（发布前基线）**：`VERSIONS.json` = `{"peekview": "0.21.0", "mcp_server": "0.11.0"}`；`python3 scripts/sync_versions.py --check` exit 0（全部文件版本同步一致，当前工作树版本锚干净）。
- **无 [SCOPE_GAP]**：P2 packages 声明 = [backend/peekview, frontend-v3, packages/mcp-server]，三包均已覆盖（frontend 明确不独立 bump 并给依据），无漏包。

## 3. 版本文件路径（主 Agent gate 校验用）

- 版本源：`VERSIONS.json`（唯一真相源）
- 主 bump（`make bump-version NEW_VERSION=0.22.0`，Makefile :251）：sync_versions.py `--bump-peekview` 同步 4 个源码槽 + 文档槽：
  - `backend/pyproject.toml`（version = "0.21.0"）
  - `backend/peekview/__init__.py`（`__version__ = "0.21.0"`，实测 :3 仍为 0.21.0）
  - `frontend-v3/package.json`（随 peekview 键）
  - 文档槽：`README.md` badge / `INDEX.md`（Backend/Frontend v） / `docs/roadmap/improvement-backlog.md`（Backend v） / `backend/README.md` health-check version
- MCP bump（`make bump-mcp-version NEW_MCP_VERSION=0.12.0`，Makefile :295）：mcp_server 键同步：
  - `packages/mcp-server/package.json`（实测 :3 = "0.11.0"，待同步）
  - `INDEX.md`（MCP Server v）/ `docs/roadmap/improvement-backlog.md`（MCP Server v）
  - Makefile bump-mcp-version Step 3 会 `npm install --package-lock-only` 同步 lock 元数据 + Step 4 重建 MCP dist
- **顺序建议（避免中间态 CHECK 冲突）**：按卡片 gate 规则——先 `make bump-version NEW_VERSION=0.22.0` + amend CHANGELOG + `make bump-mcp-version NEW_MCP_VERSION=0.12.0` + amend CHANGELOG，创建两个 tag 后，P5 gate 重跑（若 `check-protocol-consistency.py` CHECK 7 涉及 README badge ↔ tag 一致性，P5 重跑排在 tag 之后执行，见卡片 DEBT0013 时序注意）。

## 4. CHANGELOG 计划

### 4.1 现状（实测 CHANGELOG.md HEAD）

- `## [Unreleased]` 段（:8-23）现有内容分两节，均为**非 TPV0095 内容**（v0.21.0 tag 之后的仓库整理提交引入，TPV0095 未写 CHANGELOG）：
  - `### 测试修复（无用户可见行为变化）`：DEBT0005 mcp-server.spec.ts 移动端修复 + DEBT0007 登记（b590096b / fd462cc7）
  - `### 仓库整理（内部，无用户可见行为变化）`：解除误跟踪构建产物 / 磁盘清理 / 文档归档 / repomap 机制等（b590096b / cb32cf09）
- **口径核对**：`[0.21.0] - 2026-08-16` 节在其自身 tag（2e18b902）上即空节（0.21.0 的星标功能条目实际由后续仓库整理提交写入 `[Unreleased]`，未回填——历史已发布，本次不动，如实说明）。
- 主 Agent 需在 bump 后手动执行（sync_versions.py 的 ensure_changelog 只插入空节标题，`[Unreleased]` 内容不会自动搬运——见该脚本 :129-137 行为）：

### 4.2 TPV0095 变更条目（bump 后随 [Unreleased] 移入 `[0.22.0]`）

**建议条目（供主 Agent 写入，依 CHANGELOG 惯例逐条引用 BDD/P6 证据）**：

```markdown
## [0.22.0] - 2026-09-03

### 新增（team-visibility，TPV0095）

- **后端**：teams/team_members 数据模型 + 幂等迁移（entries.team_id FK ON DELETE SET NULL + 索引）；「团队内可见」档位——team_id 非空强制 is_public=false；权限收敛 `can_read_entry()`（is_public OR owner/admin OR team 成员/owner，owner 视为团队可见范围成员）替换 7 处分散读路径检查；`/api/v1/teams` CRUD + 成员添加/移除/退出 + CLI `peekview teams` / `create|list --team --user`；share 三接口 403→404 防枚举；starred 列表含团队 entry；修复全局 API key `get_entry_by_api_key` 缺失（/download 路径）；空文件 entry download 改空 zip 200
- **CLI**：本地 create/list 的 team 场景归属 `--user`（R4 契约），`--team + --visibility public` fail fast
- **前端**：explore 顶栏 5-tab（新增 Teams）+ team chips（`?team=`）+ team entry badge（team 变体）+ 单一「团队不可用」态；`/teams` 管理页（owned 管理 / joined 退出，UserMenu + explore 双入口）；卡片 toggle 隐藏团队内容 + store 守卫；detail 状态标签三态（team ≠ Private）；移动端 tab 可横向滚动（≥44px 触达）+ a11y tablist/aria-selected/live region（BDD-38~44）
- **MCP**：新增只读工具 `list_teams`（owned/joined 两分区）；`create_entry` / `publish_files` schema 加可选 `team_id` + description 引导块（omitting team_id → default PUBLIC 硬提示）；`get_entry` 输出加 `team: {slug,name}|null`

### 修复（TPV0095 连带）

- share 三接口（create/list/revoke）非 owner 403 → 404（防存在性枚举）
- 空文件 entry download 从 NO_FILES 404 改为空 zip 200（对齐 7 读路径权限矩阵）
- `_is_global_api_key_auth` 收紧为请求时配置精确比对 + 裸 Authorization 兼容
```

### 4.3 [Unreleased] 存量归置

- 将上述 4.2 条目与 [Unreleased] 现有两节（DEBT0005 测试修复 + 仓库整理）一起整体移入 `[0.22.0]`（仓库整理内容属同发布周期，归入 0.22.0 合理；若主 Agent 判内部整理条目不宜对外发布，可保留在 Unreleased 待下一版——**不阻断**，仅提示）。

### 4.4 MCP CHANGELOG 计划

- sync_versions.py 会在 `## [Unreleased]` 下插入 `## [mcp-v0.12.0] - {date}` 空节标题；主 Agent amend 时补条目。建议 `[mcp-v0.12.0]` 新增条目：

```markdown
### 新增（TPV0095）

- 新工具 `list_teams`：无参只读，返回 owned/joined 两分区（slug/name/member_count，空分区显式 "(none)"）(TPV0095)
- `create_entry` / `publish_files` 新增可选 `team_id` 参数：发布到指定团队（服务端强制 is_public=false，省略时默认 public——description 含引导提示）(TPV0095)
- `get_entry` 输出新增 `team: {slug,name} | null`：团队内 entry 附团队信息（成员/owner/全局 key 可见）(TPV0095)
```

### 4.5 遗漏核对（gate 要求：`git log v{prev_version}..HEAD` 对照 CHANGELOG 无遗漏）

- `git log v0.21.0..HEAD --oneline`（25 条）内**需进 0.22.0 发布说明的用户可见改动**：
  - `31e1196a wf(TPV0095-P7)` … `5525c319 docs(design) TPV0095` 整条 TPV0095 链（P1-P7 全部流程 commit，无独立代码 commit）→ 归入 §4.2 单条 TPV0095 功能条目
  - `fd462cc7 fix(e2e): DEBT0005 移动端 FileTree 3 例` → 已入 [Unreleased] 测试修复节
  - `b590096b chore(repo) 仓库清理` / `cb32cf09 chore(repo) repomap` → 已入 [Unreleased] 仓库整理节
  - 其余为 wf/chore 流程 commit（P0-P7 中间态）→ 不进 CHANGELOG（惯例）
- 结论：无用户可见改动遗漏。

## 5. 发布检查命令（主 Agent gate 逐包执行，从 P2 gate_commands 读取）

> P2-design.md §6 gate_commands 全部键（P5/P6 已全绿——P5-test-results 实测：backend 1164 passed / frontend 1338 / mcp 277；P6 44/44；E2E spec a+b 26/26）；P8 gate 后按卡片「gate 规则」条件化重跑（audit7 判定复用或重跑 + DEBT0013 时序）。此处列 P8 发布前应执行的检查命令（Makefile 引用）：

```bash
make bump-version NEW_VERSION=0.22.0          # 主 Agent 执行（含 build-frontend-fast 重建 static）
# → 编辑 CHANGELOG（§4.2/§4.3）→ git add CHANGELOG.md && git commit --amend --no-edit
make bump-mcp-version NEW_MCP_VERSION=0.12.0  # 主 Agent 执行（含 npm lock + MCP dist 重建）
# → 编辑 CHANGELOG（§4.4）→ git add CHANGELOG.md && git commit --amend --no-edit
make pre-publish-quick                        # quick 检查（dev/check-version/check-changelog/test-quick/verify-wheel）
make pre-publish-npm                          # = test-mcp-unit
# 正式发布（P8 之后）：make publish（PyPI）/ make publish-npm（npm）
```

- 注意（P2 §6 拆键说明）：pytest 全量 1164 passed 里已知 1 环境性失败（test_cli_remote Errno 30 写 `~/.peekview/config.yaml`，沙箱只读）+ 1 flaky（backup .tmp，重跑绿）已登记 known-failures.md，与本次改动无关，不阻断。

## 6. debt_check 字段（TAG0001 Phase 3）

- **debt_check: reviewed**（非 none——本次存在需留痕的关联债务核对，见下）
- 核对对象：`agate-workspace/debt/tech-debt.md`（schema 校验 exit 0 的登记簿），逐条比对本任务关联：
  - **DEBT0004**（净化正则双实现）——关联技术债：本任务在 getEntry raw 面复用后端 ?purify= 路径，未新增净化正则，债不加剧；保持 open 等待后端统一后评估 MCP 兜底移除。无关闭动作。
  - **DEBT0005**（移动端 FileTree e2e）——closed（2026-08-28 关闭，task_id TPV0092）；本次无关。
  - **DEBT0006**（backup/restore merge 不导入 stars/tombstones）——关联开放债：TPV0095 引入 teams/team_members/entries.team_id 后，merge-restore 不拷贝 team 关联（P2 §12 SCOPE+3 裁定为已知限制，不改、记 backlog）；DEBT0006 的关闭判据不含 teams 表，债描述与关闭判据维持原状即可，或待后续恢复任务一并扩。不阻断发布。
  - **DEBT0007**（debug-server.spec.ts 3 例 auth 预存失败）——开放；本次 P5/P6 E2E 26/26 全绿（team spec 不含该 3 例），债不受影响。
- **无 TPV0095 引入的新增债务**（P4 登记的 known-violations 2 条为维护性反模式登记，非 tech-debt 登记簿条目，不入 debt_check 计数）。
- 结论：**无未关闭债务阻断本次发布**；debt_check 内容达标留痕完成。

## 7. 版本 bump 前置证据链（P5/P6/P7 全绿确认）

| 检查 | 结果 | 证据 |
|---|---|---|
| P5 backend | 1164 passed / 3 skipped / 1 预存 env-fail | P5-test-results/unit.md |
| P5 frontend | 1338 passed | 同上（frontend 单测） |
| P5 mcp | 277 passed / 1 预存 EROFS | 同上（mcp 单测） |
| P5 typecheck / lint | 全绿 | P5-progress.md / P5-test-results |
| P5 E2E | spec a+b 26/26（teams-page 14/14 修复后） | P5-test-results/e2e.md |
| P6 验收 | 44/44 PASS（V1 backend 37 + V2 frontend 7） | P6-acceptance.md |
| P6.5 judge | 44/44 PASS，status passed | P6.5-judge-verdict.md |
| P7 一致性 | BLOCKER=0 / DEVIATION=0 / DESIGN_GAP 8/8 REVIEWED | P7-consistency.md |
| roadmap 关联 | docs/roadmap/improvement-backlog.md #48「Team 可见性机制」→ 🔄 TPV0095 已立项 | 发布完成后需按卡片 gate 回写该行状态为 done（RM-AG0043；agate-workspace/roadmap/roadmap.md 不存在，关联 RM 在 docs/roadmap/improvement-backlog.md，主 Agent 回写） |

## 8. 临时资源清单（releaser → 主 Agent READY 收尾交接）

> 主 Agent gate 通过后按此清单逐项实跑清理（卡片 READY 收尾检查，不得仅凭记忆打勾）。

| # | 类型 | 资源 | 状态（releaser 观测，2026-09-03） | 清理动作 |
|---|---|---|---|---|
| 1 | 临时服务 | debug server :8888（`/tmp/peekview-debug/` 数据） | **运行中**（端口 LISTEN 200，服务无响应体/健康正常）；P6-progress 记录 P5 起由主 Agent bash job 持住，P6/P6.5/P7 期未停止 | 主 Agent 执行 `make debug-stop`（含 `/tmp/peekview-debug/` 清理）；确认 `ss -ltnp` :8888 释放 |
| 2 | 临时服务 | debug-extra :8889（TPV0092 多实例机制，本任务未启用） | 未运行（:8889 无监听） | 无需动作（确认即可） |
| 3 | 临时服务 | CDP Chrome :18800（Playwright 截图/vision 用） | P6 使用后由 P6 verifier 关闭（P6-progress :91 收尾声明）；当前无残留 | 确认无残留即可；如有残留用 `make debug-stop` 同款清理或 kill Chrome CDP 进程 |
| 4 | 临时数据 | debug DB 数据（`:8888` 内 seed + team fixture：proj-a + alice/bob/carol/dave + team entries）+ P6 BDD-34 远程 CLI 实测创建的 entry y5yyna | 随 #1 数据目录驻留 | `make debug-stop` 清理 `/tmp/peekview-debug/` 一并清除 |
| 5 | 临时文件 | P5/P6 验证脚本：`/home/kity/Downloads/tpv0095_b2_verify.py`、`tpv0095_retry2_verify.py`（P4 retry 批隔离实测，声明"临时不落仓库"） | 存在（Downloads 可写区） | 主 Agent 按需删除（Downloads 非仓库，不阻断 git 干净；建议清理） |
| 6 | 临时文件 | P6 BDD-34 临时 HOME：`/tmp/pv-bdd34-home` | P6 实测用过（P6-progress :23） | 确认已删或清理（/tmp 自清，非仓库） |
| 7 | 环境 | 开发安装：无（P4 全程 venv/conftest 隔离，未做 editable install / 未装全局包） | — | 无需动作 |
| 8 | 工作树 | git status 非干净项：`M gate-events.jsonl` + `?? P8-dispatch-context-implementer.md`（+ 本 P8-release.md 产出后新增） | P8 产出文件属任务目录正常留痕 | 主 Agent READY 收尾 `git add` 任务目录 + commit；P8-dispatch-context 与 gate-events 一并提交 |
| 9 | 测试残留 | MCP EROFS / CLI remote Errno 30 两预存失败为沙箱环境性，非资源 | — | 无资源清理动作；known-failures.md 已登记 |

- **生产无残留**：`[PROD_NOT_TOUCHED]`——全程未触 :8080 / ~/.peekview/ / pipx peekview（P5/P6/P6.5/P7 各文件状态标记一致；:8080 探测 000 不可达）。

## 9. Lessons Learned

1. **（流程）CHANGELOG 空节陷阱**：`sync_versions.py` 的 ensure_changelog 只插入空版本节标题、**不搬运 [Unreleased] 内容**（脚本 :129-137），且 P8 阶段主 Agent bump 后必须手动 `git add CHANGELOG.md && git commit --amend --no-edit`。TPV0095 全链（P1-P7 十余个 commit）无一条写入 CHANGELOG，全靠 P8 一次性补齐——发布前若不按 `git log v{prev}..HEAD` 逐 commit 对照会漏功能条目。教训：用户可见改动落地即写 CHANGELOG（项目铁律 8），P8 的 [Unreleased]→版本搬运只应收尾，不应是首次记录。
2. **（流程）多包 bump 是两次独立发布**：TPV0095 同时动 peekview（minor + schema 迁移）与 mcp_server（minor），但两者走**不同 Makefile target、不同 tag 命名空间**（`v0.22.0` vs `mcp-v0.12.0`）、CHANGELOG 各自插节（`[0.22.0]` 与 `[mcp-v0.12.0]` 是两个独立 marker，sync 脚本按 marker 分别 ensure）——bump 顺序与 amend 次数都要按包分别执行，漏任一 tag/节即 P8 门槛不过（T005 教训同源）。
3. **（技术）权限收敛的连带行为修订要进 CHANGELOG**：本任务 can_read_entry 收敛顺带修订了两处既有行为（share 三接口 403→404 防枚举、空文件 download 404→空 zip 200、全局 key 判定精确化），这些是**对外的可观察语义变化**，即使非新功能也应写进发布说明，否则下游 API 使用者（MCP/CLI/脚本）在升级后遇到 404/200 差异无从追溯。

---

> 本文件不含 bump/commit/tag 执行记录——由主 Agent gate 通过后执行并回填。
