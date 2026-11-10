---
phase: P8
task_id: TPV0102
type: release
parent: P7-consistency.md
trace_id: TPV0102-P8-20261111
status: draft
created: 2026-11-11
agent: implementer
# ── 三必声明字段（check-gate.py P8 判定） ──
bump_type: minor
delivery:
  method: release-notes
  ref:
  - CHANGELOG.md
  - docs/process/upgrading.md
  - backend/peekview/timefmt.py
  - frontend-v3/src/components/TimeDisplay.vue
  - frontend-v3/src/components/VisibilityMenu.vue
  reason: 三个包均为 git 仓库内同仓交付（无独立包发布物）。本任务对外可见的交付载体是 CHANGELOG [Unreleased] 的 6 条条目 + upgrading.md 的 v0.26.1→v0.27.0 迁移节（破坏性变更的时间字段 Z 后缀需消费者侧迁移指引），故 method 取 release-notes 而非 tag-release——tag 与 PyPI/npm 发布属独立发布流程 + 人工授权，不在 P8 范围
debt_check: reviewed
# ── 客观信息 ──
packages:
- peekview
- frontend-v3
- docs
domains:
- backend
- frontend
- api
- cli
ui_affected: true
prod_touched: false
---

# P8 交付收尾 — TPV0102：Explore 卡片列表体验修正

> **角色**：releaser（implementer P8 交付收尾模式）。本文件**只做交付收尾声明**——
> **未执行** `git commit` / `git push` / `git tag` / `make bump-version` / `make publish`，
> **未修改** `VERSIONS.json` / `CHANGELOG.md` / 任何源码。
> 状态标记：**`[PROD_NOT_TOUCHED]`** —— 全程未触碰生产 `:8080` 与 `~/.peekview/`。
>
> **上游**：`P1-requirements.md`（三包 + 4 项需求）→ `P2-design.md`（`packages` + §9 `gate_commands`）
> → `P5-test-results/`（证据）→ `P6-acceptance.md`（30/30 PASS）→ `P6.5-judge-verdict.md`（passed）
> → `P7-consistency.md`（approved，BLOCKER=0，DG 13/13 配对）。

---

## 1. 交付范围：三包（**不以 P4 的 packages 声明为准**）

| 项 | 值 | 依据 |
|---|---|---|
| `bump_type` 意图 | **`minor`** | 见 §2 |
| `delivery.method` | **`release-notes`** | 见 §3 |
| `debt_check` | **`reviewed`** | 见 §6 |
| 受影响包 | **`peekview` / `frontend-v3` / `docs`**（3 包） | `P1-requirements.md:19-22` + `P2-design.md:11-14` |
| 当前版本 | `peekview` **0.26.1** / `mcp_server` **0.12.0** | `VERSIONS.json`（唯一版本源） |
| 建议目标版本 | `peekview` **0.26.1 → 0.27.0** | 与 `docs/process/upgrading.md:11` 已写的节标题 `v0.26.1 → v0.27.0` 对齐（DG11 自主决策已由 P7 `design_gap_reviews` 判 accepted） |
| **不 bump** 的包 | **`mcp_server`**（保持 0.12.0） | 本任务零 MCP 源码改动；`upgrading.md:15` 明写「MCP 代码未改」 |

### 1.1 F6 纠偏（P7 已登记，本文件执行）

`P4-implementation.md` 的 frontmatter 只有 `packages: [peekview]`——**这是 P4 的笔误**
（P7 `findings` F6 / P7 §7 第 6 行；P4 提交 `d8adbec7` 实际触及 backend 6 + frontend-v3 28 + docs 1 + CHANGELOG.md 1）。
**本文件的检查范围与 bump 范围一律以 P1/P2 的三包为准**，不继承 P4 的错误声明。

---

## 2. `bump_type: minor`（意图，不执行）

**判定**：**`minor`**。

**理由（一句）**：本任务含对外可见的破坏性变更（API/CLI `--json` 的 datetime 补 `Z`），按 P8 卡
「破坏性变更 → major」字面应判 `major`；但项目处于 **`0.x`**（当前 `0.26.1`），semver 规定
`0.x` 的 minor 位即为破坏性变更承载位，且 P4 `docs-changelog` 批已把 `upgrading.md` 目标版本
写作 `v0.26.1 → v0.27.0`（minor），全仓版本节历史亦无 1.0 之前的 major 先例 ⇒ **判 `minor`**。

**为什么不判 `major`**：`0.26.1 → 1.0.0` 会把「项目尚未稳定」的信号误报为「API 已冻结」，
与 `0.x` 惯例相反；且 `upgrading.md` 的节标题、CHANGELOG 的 `### ⚠️ Breaking Change` 子节
（Keep a Changelog 的既有用法）已承载破坏性语义，无需借 major 位表达。

**为什么不判 `patch`**：本任务有**新增用户可见功能**（绝对时间主显 + 真实 DOM tooltip、
可见性下拉菜单四处统一、0 文件专用空态）与**响应格式变更**，非纯修 bug。

> **最终裁决归主 Agent**。若主 Agent 判 `major`，需同步改 `upgrading.md:11` 的节标题
> `v0.26.1 → v0.27.0` 为目标版本，否则文档与版本号脱节。

### 2.1 `bump_type` 与「测试缺陷不应影响版本号决策」

`make test-quick` 有 1 条 failed（见 §4），但 P5 已独立取证为**沙箱环境性预存失败**
（`OSError: [Errno 30] Read-only file system: '~/.peekview/config.yaml'`），**非本任务引入、
非产品缺陷**。按 P8 卡「测试缺陷不应影响版本号决策」，该 1 条 failed **不参与** `bump_type` 判定。

---

## 3. `delivery`（结构化，三字段）

```yaml
delivery:
  method: release-notes
  ref: [CHANGELOG.md, docs/process/upgrading.md, backend/peekview/timefmt.py,
        frontend-v3/src/components/TimeDisplay.vue, frontend-v3/src/components/VisibilityMenu.vue]
  reason: 同仓交付，交付载体 = CHANGELOG [Unreleased] 6 条 + upgrading.md 迁移节
```

### 3.1 ⚠️ 与派发单的偏差：`git-commit` → `release-notes`（**不可自行忽略**）

派发单 `P8-dispatch-context-implementer.md:34` 与 §「三个必声明字段」建议 `method: git-commit`，
并对结构化 `delivery` 加了注 `# 如 git-commit（本任务不发布包，只交付代码）`。
**实测该值会让 P8 gate 直接 exit 1**：

| 探针 | `delivery.method` | `check-gate.py P8` 结果 |
|---|---|---|
| A | `git-commit` | **exit 1** — `delivery.method='git-commit' 不在快照 delivery.method_enum=['release-notes', 'tag-release', 'none'] 内` |
| B | `release-notes` | **exit 2**（脚本化检查通过）+ 两条 WARNING（与本字段无关，见 §7） |

**根因**：本任务账本 `gate-events.jsonl` 首行 `task_created` 带 `contract_level: 2`
⇒ `task_level() = 2` ⇒ 消费 `rules/task-data/level-2.yaml` 的
`delivery.method_enum: [release-notes, tag-release, none]`（三值枚举，`UPGRADING.md:389-395`
记录了该次「`method` 由任意非空收紧为三值枚举」的破坏性准入变化）。
`git-commit` **不在枚举内**，故被硬拦。

**处置**：按 gate 实际契约取 `release-notes`——它精确描述本任务的交付性质（同仓 + CHANGELOG +
迁移指引，无独立包发布物），且语义上比 `git-commit` 更贴切（P8 消费 `delivery` 是为了知道
「交付物怎么给出去」，而不是「用什么 git 动作提交」；后者主 Agent 必做，无需声明）。
**这不是为凑绿灯改数据**——`git-commit` 是派发单的笔误级错误，两条探针可复现。

> **回归主 Agent**：`P8-dispatch-context-implementer.md` 的 `method: git-commit` 建议应修正为
> `release-notes`（或 `tag-release`），否则后续同类任务的 releaser 会重复踩。建议登记为协议侧债。

---

## 4. 逐包交付检查命令（**全部真跑，记录 exit code**）

命令真相源：`Makefile`（P2 §9 `gate_commands` 只覆盖了其中一部分）。

| # | 包 | 命令 | **exit** | 结果摘要 |
|---|---|---|---|---|
| 1 | `peekview` | `make test-quick` | **2** | `1 failed, 1205 passed, 3 skipped, 25 warnings in 59.91s` —— 唯一 failed 为预存失败（见 §4.1） |
| 2 | `peekview` | `make lint` | **0** | `All checks passed!`（ruff `peekview/` + `tests/`） |
| 3 | `frontend-v3` | `make test-frontend` | **0** | `Test Files 119 passed (119)` / `Tests 1456 passed \| 4 skipped (1460)`，36.62s |
| 4 | `frontend-v3` | `make build-frontend` | **0** | vite build 15.68s ✓；`392 static files`；dist/static 计数一致性校验通过 |
| 5 | `frontend-v3` | `make typecheck` | **0** | `✓ type check passed`（`vue-tsc --noEmit`） |
| 6 | `docs` | `make check-docs` | **0** | 环境变量命名规范 ✓ / systemd 配置 ✓ / `✓ 所有文档与代码保持一致` |

**exit code 汇总**：`0 / 0 / 0 / 0 / 0` × 5 项 + `test-quick` **exit 2**（1 条预存失败，归因见下）。

### 4.1 `make test-quick` exit 2 的归因（**非本任务引入**）

- **失败项**：`tests/test_cli_remote.py::TestCLIRemoteConfig::test_config_set_remote_api_key`
- **根因**（已独立复跑取证）：`OSError: [Errno 30] Read-only file system: '/home/kity/.peekview/config.yaml'`
  —— DSH 沙箱把 `~/.peekview/` 挂只读，该用例 `subprocess.run(... "config" "set" "remote.api_key" ...)`
  未 `patch.dict(os.environ, {"HOME": tmp_path})` 隔离 HOME。
- **与 P5 完全一致**：`P5-test-results/unit.md:96` 已登记同一条（「预存失败：1 —— 与本次改动无关」，
  对照组 `test_config_set_remote_url` 隔离 HOME 后 1 passed），计数 `1205 passed / 1 failed / 3 skipped`
  与本次逐项相同。归属 `known-failures.md` 第 1 条（WARNING 级，不阻断）。
- **该文件本任务零改动**：`backend/tests/test_cli_remote.py` 不在 P4 提交 `d8adbec7` 的改动面内。
- ⇒ **本任务引入的失败 = 0**。

### 4.2 复用的 P5 证据（`AUDIT7_RESULT: reuse_allowed`）

已跑 `python3 check-p6-provenance.py --audit7-only $TASK_DIR` → **`AUDIT7_RESULT: reuse_allowed`**（exit 0），
故 P2 `gate_commands` 中的以下三项**按协议复用 P5 证据、未重跑**：

| gate key | P5 结果 | 处置 |
|---|---|---|
| `P5_e2e`（`E2E_SPEC=e2e/tpv0102-explore-card-list-ux.spec.ts`） | exit 0，61 passed / 3 skipped / 0 failed | 复用 |
| `P5_e2e_legacy`（`E2E_SPEC=e2e/team-visibility.spec.ts`） | exit 2，6 passed / 2 failed（`proj-a` 不在 debug seed → POST 422，已知 fixture 缺失，`known-failures.md` 第 2 条） | 复用 |
| `P5_fitness`（`-k mixin_not_in_table_mro`） | exit 0，1 passed | 复用 |

> **为何仍实跑 #1–#6**：派发单要求真跑 `check-docs` 与 `build-frontend`（P5 未作为 gate 项）；
> 其余四项 `test-quick`/`lint`/`test-frontend`/`typecheck` 一并实跑，用于给主 Agent 提供
> **当次**证据而非仅转述 P5——成本低（后端 60s / 前端 37s / typecheck 30s / lint 5s）。

### 4.3 构建产物实存核对（P5 未验，本阶段补）

| 核对项 | 结果 |
|---|---|
| `frontend-v3/dist/index.html` | 存在，mtime `2026-11-11 04:30:19`（本次构建） |
| `backend/peekview/static/index.html` | 存在，mtime `2026-11-11 04:30:19`（已复制） |
| dist / static 顶层项数 | `7 / 7` 一致（Makefile 内置一致性校验亦通过） |
| `dist/assets` 文件数 | 392 |
| 本任务新组件是否真的进产物 | ✅ `time-display__main`、`visibility-menu`（`dist/assets/expires-*.js` + `.css`）、`此 entry 无文件`（`dist/assets/zsh-*.js`）均在 bundle 中命中 |

> `frontend-v3/dist/` 与 `backend/peekview/static/` **均被 `.gitignore` 忽略**（`.gitignore:44` / `:25`，
> `git check-ignore` 实测通过）⇒ 构建产物不进 commit，无需在交付物引用中列出。

---

## 5. CHANGELOG `[Unreleased]` 核对（**已合规，未重写**）

`grep -c TPV0102 CHANGELOG.md` = **6**，全部位于 `[Unreleased]` 区域内（P4 `docs-changelog` 批产出）。

| # | 行 | 节 | 覆盖的 P1 需求 |
|---|---|---|---|
| 1 | 12 | `### ⚠️ Breaking Change` | 需求 1 的后端侧（datetime 补 `Z`，13 字段全列 + 指向 `upgrading.md`） |
| 2 | 16 | `### 变更` | **需求 1**（时间主显绝对化 + 悬停三段式 tooltip，四处共用组件） |
| 3 | 17 | `### 变更` | **需求 2**（文件数 `0`/`1` 隐、`2+` 显 `N files`） |
| 4 | 18 | `### 变更` | **需求 3**（可见性下拉菜单四处统一，含二次确认 / 失败保持 / revokedShares / 团队空占位移除） |
| 5 | 19 | `### 变更` | **需求 3 连带**（详情页 `.status-tag` 只保留 Archived/Expired + overflow 菜单项移除） |
| 6 | 23 | `### 修复` | **需求 4**（0 文件 entry 专用空态） |

**结论**：P1 的四项需求 **全部覆盖**（需求 1 拆 Breaking Change 后端 + 变更前端两条，需求 3 拆主条目 + 详情页连带一条）。
**与派发单描述一致**（派发单 §「核对 CHANGELOG」列的 `### 变更 ×3` + 第 4 条连带 + `### 修复 ×1` + Breaking ×1 = 6 处）。
**未发现遗漏，故未改动 CHANGELOG**（CHANGELOG 属 P4 产出，P8 不重写）。

### 5.1 ⚠️ `check-changelog.py TPV0102` **exit 1**（协议正则缺陷，非 CHANGELOG 内容问题）

派发单门槛要求「`check-changelog.py TPV0102` 通过」。**实测 exit 1，但 CHANGELOG 内容完全正确**：

```
$ python3 check-changelog.py TPV0102
GATE CHANGELOG: [Unreleased] 区域未找到 TPV0102（或 TPV0102）
exit 1
```

**根因**（已定位到具体正则，并用最小变体逐条实测）：`check-changelog.py:79-83` 用

```python
re.search(rf"(^|[^0-9]){task_id}( |:|$|,|-)", unreleased, flags=re.M)
```

**右边界只认**「空格 / `:` / 行尾 / `,` / `-`」五种。而本项目 CHANGELOG 的惯例写法是
**全角括号紧跟**：`（TPV0102）`——其右邻字符是全角 `）`（U+FF09），**不在上述字符集内**。

| 变体（`[Unreleased]` 内单行） | `check-changelog.py` |
|---|---|
| `- x（TPV0102）` ← **本仓实际写法** | **FAIL** |
| `- x（TPV0102）.` / `- x（TPV0102）;` / `- x（见 TPV0102）` | FAIL |
| `- x（TPV0102 ）`（括号内加一空格） | PASS |
| `- x TPV0102` / `- x TPV0102:` / `- x TPV0102,` / `- x TPV0102-` | PASS |

**普遍性核验**：对 `CHANGELOG.md` 全文出现的 **12 个历史 task_id**（TPV0092/TPV0095/…/TPV0101）逐个真跑，
**12/12 全部 exit 1**；已发布历史节中「全角括号紧邻」10 处、「半角括号紧邻」12 处，
两种紧邻写法**都**不被该正则接受（半角 `)` 同样不在字符集内）。⇒ **这是协议脚本的边界字符集缺陷，
不是本任务的 CHANGELOG 违规**；`pre-commit-gate.py:1086` 对该检查只输出 **WARNING 不阻断**
（`sys.stderr.write("GATE CHANGELOG: 警告 — [Unreleased] 未记录 …")`，无 `sys.exit`），
故**不会拦下 P8 提交**。

**处置（严格遵守「P8 不改 CHANGELOG」）**：
1. **未修改 CHANGELOG** 去凑这个正则——那属于为绿灯改产出，且会把 6 条内容正确的条目改成非本仓惯例的形态。
2. **如实记录 exit 1 + 根因 + 最小复现**，交主 Agent 裁决。
3. **建议登记协议侧债**：`check-changelog.py` 的右边界字符集应纳入 `）` / `)` / `.` / `;` 等
   常见收尾符（或改用 `\b` 类负向断言排除数字/字母），否则**所有采用括号注释惯例的项目都会被误判**。

> **门槛口径澄清**：派发单并列要求「`check-changelog.py TPV0102` 通过」与「未执行任何 git 写命令」。
> 前者在不改 CHANGELOG 的前提下**不可能同时满足**（探针已证明是脚本缺陷）。本文件选择
> **保内容正确 + 如实报 red**，而非改 CHANGELOG 换绿灯。

---

## 6. 债务核对（`debt_check: reviewed`）

已读 `{AGATE_WORKSPACE}/debt/tech-debt.md`（48.6 KB，**最大编号 `DEBT0021`**，`source_ref` 键 0 处）。
**P8 未在 `tech-debt.md` 写入任何新条目**（不在 P8 职责内），以下为**条目 id 清单 + 建议去向**，由主 Agent 裁决。

### 6.1 既有债 / 判据瑕疵（4 条，**不属本任务**）

| id | 内容 | 性质 | P7 状态 | 建议去向 |
|---|---|---|---|---|
| **F1** | 卡片长标题与右上 hover 操作区重叠（最坏 34px） | **既有视觉债**。pre-task `.card-actions` 60px/覆盖 332px → 本任务 48px/覆盖 211px，**减轻 121px** | `note / deferred` | 转 roadmap 独立任务。**不得记为本任务缺陷** |
| **F2** | `BaseBadge` 的 `label` 在 setup 期求值一次 → 可见性切换后徽章文字 stale | **既有缺陷**。该文件本任务**零改动**（末次提交 `2b382c9c` = TPV0095 P4） | `note / deferred` | 转 roadmap（`label` 改 `computed`）；不阻断 BDD-20 |
| **F3** | BDD-25 后半条对有文件 entry **不可测**（`entryDetail.loadEntry` 恒把 `activeFile` 置 `files[0]`） | **P1 判据瑕疵** | `note / deferred` | 留待 P1 判据回归修正；P6 已用等价判据 PASS |
| **F4** | P2 VC-5「`<=2px` 基线」几何上不可满足（280px 卡宽 + 207px 绝对时间 ⇒ en-US 桌面 20/20 换行） | **P2 判据瑕疵** | `note / deferred` | 留待 P2 判据回归改「同行或换行皆可」；本任务由 BDD-01/02 形态判据承担 |

### 6.2 本任务实现期发现 → **建议新增 DEBT 条目**（2 条）

| 建议 id | 来源 | 内容 | 建议 `category` / `priority` | 建议去向 |
|---|---|---|---|---|
| **DEBT0022**（建议） | **F8 / DG7** | `frontend-v3/src/stores/team.ts` 的 `loadMyTeams` catch 分支**只置 `error` 不置 `teamsLoaded`** ⇒ 失败后每次 `ensureMyTeamsLoaded()` 都重试，视图层「已加载则跳过」判据失效 → **请求风暴**。本批按 P2 原样实现、store 不在本批范围 | `technical` / `medium` | 建议登记：catch 里补置 `teamsLoaded`（或加重试上限/退避） |
| **DEBT0023**（建议） | **F1 + F2** | ① 卡片长标题与 hover 操作区重叠（最坏 34px，本任务已减轻 121px 但未消除）；② `BaseBadge.label` setup 期求值导致切换后 stale | `technical` / `low` | 建议**合并登记为一条「Explore 卡片视觉/状态残留债」**，或按 F1/F2 分两条 |

> **为何 P7 未用 `basis: followup:DEBT<n>` 声明**（转录 P7 §7 的记账口径，供主 Agent 对齐）：
> 该 basis 要求 gate 在 `tech-debt.md` 找到对应条目、且 `source_ref` 以 `TPV0102:DG7` 双向回指；
> 实测该文件 `source_ref` 键 **0 处**、且 P7 无写权限 ⇒ 强行声明会让 gate 以「DEBT 条目不存在」exit 1。
> 故 P7 用 `out_of_scope` + 把去向留给 P8 决定（诚实优先于形式）。**本次 P8 按此把 F8/DG7 明确建议为 `DEBT0022`。**

### 6.3 `debt_check` 取值说明

取 **`reviewed`**（非 `none`）：既有债 4 条已逐条核对 + 去向明确，且本任务**建议新增 2 条 DEBT**。
按 P8 卡「`debt_check` 只查留痕存在，不查内容达标、不阻断发布」，本字段本身不构成门禁。

---

## 7. `check-gate.py P8` 自查结果

```
$ python3 check-gate.py P8 $TASK_DIR
GATE P8 WARNING: .agate-tmp/ 内有 20 个文件名匹配**测试收集模式**（如 test_probe.py）…
GATE P8: 脚本化检查通过。仍需主 Agent：① 从 P2 gate_commands 逐包读取发布检查命令
② 重跑 P5 gate ③ 用 git log 对照 CHANGELOG 无遗漏
exit 2
```

- **exit 2 = 脚本化检查通过**（P8 的通过码是 2，不是 0；`WORKFLOW.md:327` 已列为 P8 标准判定）。
- 两条 WARNING 均与交付内容无关，但**需主 Agent 在 READY 收尾时处理**：
  1. **`.agate-tmp/` 内有 20 个文件名匹配测试收集模式**（`*.test.*` / `*.spec.*` / `test_*.py`）——
     实测分布：**`.agate-tmp/ve/scripts/` 9 个**（vision-engine 副本自带测试）+ `.agate-tmp/p3probe*` 7 个
     + `.agate-tmp/probe3` `probe4` `probe5` 3 个 + `.agate-tmp/fitprobe` 1 个 = **20**。
     这些会被测试框架默认 `include` 扫到、静默抬高基线。**建议 READY 清理时整体删除 `.agate-tmp/`**
     （该目录已被 `.gitignore:105` 忽略，`git check-ignore` 实测通过 ⇒ 无凭证入库风险）。
  2. `.agate-tmp/` 已被 `.gitignore` 忽略 ⇒ 上面那条「未被忽略」的 WARNING **未触发**，符合约定。
- `roadmap.md` 反查（RM-AG0043）：`agate-workspace/roadmap/roadmap.md` **不存在** ⇒ 无关联 RM 条目需回写 `done`。

---

## 8. 临时资源清单（releaser → 主 Agent 的 READY 清理交接）

> 本任务执行期间启动的临时服务 / 创建的临时数据 / 做的开发安装。
> **主 Agent P8 gate 通过后执行 READY 收尾检查时按此清单清理。**

### 8.1 临时服务 / 进程

| 资源 | 位置 | 归属 | 清理动作 |
|---|---|---|---|
| debug backend | `127.0.0.1:**8888**`，数据 `/tmp/peekview-debug/`（DB `/tmp/peekview-debug/peekview.db`） | **P6 期由主 Agent 用后台 job 托底启动**（`make debug-quick`）；**P8 未启动也未停止它** | 主 Agent：`make debug-stop`（停服务 + 清 `/tmp/peekview-debug/`）；确认 `ss -ltn` 无 8888 监听 |
| Chrome CDP `:18800` | `localhost:18800`（Windows GPU 侧） | **外部服务，不属本任务** | **不要停、不要建议停** |

### 8.2 临时数据 / 目录

| 资源 | 位置 | 说明 | 清理动作 |
|---|---|---|---|
| 项目根 canonical 临时目录 | `/home/kity/oclab/peekview/.agate-tmp/`（**现存 440 个文件**） | 本任务全程探针/脚本/副本的落点，含：`p3probe*/`（P3 红灯探针，5 个含 `test_*.py`/`*.test.ts`）、`probe3/4/5`（3 个 `test_probe.py`）、`fitprobe/`（fitness 探针）、`gatecopy/`+`gate_copy.out`+`gate_p2.*`+`gate-p3.log`（gate 取证副本）、`b1/b2/b3*.out`+`b3_*.py`（后端批量验证）、`check_bdd.py`/`check_models.py`/`ast_check_models.py`（一次性检查脚本）、`fakehome/`（HOME 隔离探针）、`e2e-rev1.log`、`GIT_*.txt`（git 基线快照）。**本 P8 自建的 `p8probe/` + `p8probe2/`（gate 探针 + CHANGELOG 正则最小复现）已由本 releaser 自行删除**，不在交接范围内 | **建议整体删除**（已被 `.gitignore:105` 忽略；`git check-ignore` 实测通过）。命中测试收集模式的文件按目录分组：`ve/scripts/` 9 个（vision-engine 副本自带）、`p3probe*` 7 个、`probe3/4/5` 3 个、`fitprobe` 1 个 = **20 个**（见 §7 WARNING 1） |
| vision-engine 副本 | `/home/kity/oclab/peekview/.agate-tmp/ve/` | skill 拷贝 + ratelimit 重定向（因沙箱下 `~/.local/share/vision-engine` 只读）；**自带 9 个 `test_*.py`** 是 §7 WARNING 的主要来源 | 随 `.agate-tmp/` 一并删除 |
| P6 证据隔离副本 | `agate-workspace/tasks/TPV0102-…/.agate-tmp/`（`dryrun-ws/`、`p1.before.md5`、`gen.py`、`probe/`） | P1/P7 的 dry-run 工作区与 md5 探针 | 可删；或保留在任务目录内（任务目录本身是任务产出） |
| P5/P6 证据 | `P5-test-results/`、`P6-evidence/`、`vision-reports/` | **不是临时资源**——是任务产出证据，**必须保留** | 保留 |
| 构建产物 | `frontend-v3/dist/`（392 assets）、`backend/peekview/static/`（392 assets） | 本次 `make build-frontend` 产出；**均被 `.gitignore` 忽略**（`:44` / `:25`） | 可保留（服务 :8888 需要 static），无需清理 |

### 8.3 开发安装 / 全局变更

| 项 | 状态 |
|---|---|
| `pip install` / `pip3 install --break-system-packages` / `-e .` | **无**（未做任何 Python 安装；后端测试走既有 `backend/.venv/`） |
| `npm ci` 重装 | **有**——`make build-frontend` 第 1 步执行 `cd frontend-v3 && npm ci`（~2-3 min），按 `package-lock.json` 重装既有依赖，未新增包 |
| 系统级 / 全局依赖、系统配置、CI/CD、生产环境变量 | **无** |
| `VERSIONS.json` / `pyproject.toml` / `package.json` 版本号 | **未改**（P8 不 bump） |

### 8.4 生产隔离

- **`:8080` 全程未触碰**；`~/.peekview/` 未读写（沙箱挂只读，见 §4.1）。
- 未用 `peekview create` CLI 造数据；未用 `sqlite3` 操作生产 DB。
- 本任务所有 entry 测试数据只经 debug backend `:8888` 的 HTTP API 创建（P6 期，主 Agent 执行）。

**[PROD_NOT_TOUCHED]**

---

## 9. git 写操作声明（**零写**）

| 命令 | 是否执行 |
|---|---|
| `git commit` / `git push` / `git tag` | ❌ **未执行** |
| `git add` / `git reset` / `git checkout` / `git restore` / `git stash` / `git clean` | ❌ **未执行** |
| `make bump-version` / `make bump-mcp-version` / `make publish` / `make publish-npm` | ❌ **未执行** |
| 改 `VERSIONS.json` / `CHANGELOG.md` / 任何源码 | ❌ **未修改** |
| 写 `debt/tech-debt.md` | ❌ **未写入**（只给建议，见 §6.2） |

**本阶段写入的文件**（全部在本任务目录内 + `/tmp` 级探针目录，已清理可忽略）：

- `agate-workspace/tasks/TPV0102-explore-card-list-ux/P8-release.md`（本文件，新增）
- `agate-workspace/tasks/TPV0102-explore-card-list-ux/P8-progress.md`（分阶段落盘，追加）
- `.agate-tmp/p8probe/`、`.agate-tmp/p8probe2/`（gate 探针 + 正则最小复现，临时）

> 注：`gate-events.jsonl` 的 ` M` 状态由主 Agent 的 gate 脚本运行产生，非本 releaser 写入。

---

## 10. 门槛自检

| 门槛 | 状态 | 证据 |
|---|---|---|
| `P8-release.md` 存在 + frontmatter 含 `bump_type` / 结构化 `delivery`（method 非空）/ `debt_check` | ✅ | 本文件 frontmatter；`agate-md-field-set.py --list` 三字段均可写且已 set |
| `bump_type` 意图 + 理由 | ✅ | §2（`minor`，含不判 major/patch 的理由） |
| CHANGELOG `[Unreleased]` 已含 `TPV0102` | ✅ **内容侧** | 6 处，覆盖 4 项需求（§5） |
| `check-changelog.py TPV0102` 通过 | ❌ **exit 1（脚本正则缺陷，已定位 + 最小复现，未改 CHANGELOG 凑绿）** | §5.1 |
| 三包检查命令已跑并记录 exit code | ✅ | §4（6 条命令，5× exit 0 + test-quick exit 2 归因预存） |
| 构建产物存在性核对 | ✅ | §4.3 |
| 临时资源清单已写 | ✅ | §8 |
| 债务核对已写（4 条既有 + F8/DG7 建议新增） | ✅ | §6 |
| **未执行任何 git 写命令 / 未 bump / 未 tag** | ✅ | §9 |
| 生产未触碰 | ✅ | `[PROD_NOT_TOUCHED]` |

### 10.1 需主 Agent 裁决的 3 项（**均非本 releaser 可自决**）

1. **`delivery.method`**：派发单写 `git-commit`（gate exit 1）→ 本文件取 `release-notes`（gate exit 2 通过）。
   请确认接受，并修正派发模板（§3.1）。
2. **`check-changelog.py` 的红灯**：脚本右边界字符集缺 `）`/`)`，全仓 12/12 历史 task_id 均不可通过。
   请确认「不改 CHANGELOG + 登记协议债」（§5.1），或指示改 CHANGELOG 形态（不建议）。
3. **`bump_type`**：本文件判 `minor`；若判 `major`，须同步改 `upgrading.md:11` 的节标题目标版本（§2）。

---

## Lessons Learned

| 类别 | 教训 | 来源任务 | 日期 |
|---|---|---|---|
| 流程 | **派发单里的枚举值建议必须先在 gate 上跑一遍**：`delivery.method: git-commit` 是笔误级错误，但 level-2 契约的三值枚举会硬拦（exit 1）。releaser 若照抄派发单就会卡死，且容易误判为「gate 有问题」而去找绕过手段。成本对比：两条探针 < 30 秒 vs 一轮返工。凡派发单给出的**枚举型字段值**，先用临时副本 `check-gate.py` 探针验证，再写正式产出 | TPV0102 | 2026-11-11 |
| 流程 | **「为绿灯改产出」的诱惑出现在协议脚本缺陷上**：`check-changelog.py` 的右边界字符集不接受全角 `）`，全仓 12/12 历史 task_id 都过不了。此时最省事的动作是给 CHANGELOG 的 `（TPV0102）` 加个空格（实测立刻 PASS）——但那把 6 条内容正确的条目改成非本仓惯例形态，且掩盖了会让**所有**采用括号注释惯例的项目误判的协议缺陷。正确动作：定位到具体正则 → 最小变体逐条实测 → 记录 exit 1 + 根因 → 交裁决。**红灯指向脚本的问题，不指向你的产出** | TPV0102 | 2026-11-11 |
| 测试 | **长命令的日志别落 `/tmp`**：DSH 沙箱下 `/tmp` 在两次 bash 调用之间不保留，`make test-quick > /tmp/x.log` 后下一条调用 `tail` 必失败（本次实测踩到，改为落 `.agate-tmp/` 后正常）。**日志落点用项目内被 `.gitignore` 忽略的目录**（`.agate-tmp/`），既跨调用可读，又不进 commit | TPV0102 | 2026-11-11 |
