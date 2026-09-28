---
phase: P8
task_id: TPV0099
type: release
parent: P7-consistency.md
trace_id: TPV0099-P8-20260929
status: draft
created: '2026-09-29'
agent: releaser
# ── v2.0 机器字段 ──
bump_type: minor
debt_check: reviewed
---

# P8 发布准备 — TPV0099 全屏模式链接 `/{slug}/f`

> 状态标记：**`[PROD_NOT_TOUCHED]`** —— 全程只读 + 产出本文件，**未执行任何 `bump-version` / `git commit` / `git tag` / `make publish`**，未触碰 `:8080` / `~/.peekview/`。
> 本文件是 releaser → 主 Agent 的交接记录：版本与 CHANGELOG 变更动作由主 Agent 在 gate 通过后亲自执行；**临时资源清单**供 READY 收尾清理。

---

## 1. 发布判定

| 项 | 值 |
|---|---|
| `bump_type` | **`minor`** |
| 受影响包 | **`peekview`**（`VERSIONS.json` 唯一版本源，PyPI 包名 `peekview`） |
| 当前版本 | `peekview: 0.24.1` / `mcp_server: 0.12.0` |
| 目标版本 | **`0.25.0`** |
| **MCP 包** | **不 bump**（保持 `mcp_server: 0.12.0`） |
| 后端 | 随 `peekview` 同包（本任务 `backend/` 零改动，见 §3 实证） |

### 1.1 `bump_type: minor` 的依据

本任务交付**用户可见的新功能**：新增全屏分享链接 `/{slug}/f`（`frontend-v3/src/router.ts` 新增路由 `/:slug/f` + `meta:{zen:'locked'}`；`useZenMode.ts` 改 thunk 入参 + computed；`EntryDetailView.vue` 调用点）。按 semver，新增向后兼容的功能 = **minor**。

非 major：无破坏性变更 —— 既有 `f` 键 zen 的进出语义与外观**完全不变**（P6 BDD-4/6 正向对照实测）；`/{slug}/f` 是**新增路径**，不改变任何既有 URL 行为。
非 patch：不是纯缺陷修复，是新增能力。

LLM 复核确认区间内无其他产品代码改动可使 bump 升级为 major（`git diff --stat v0.24.1..HEAD -- frontend-v3/src backend/ packages/` 仅见 §3 所列 4 个前端文件）。

### 1.2 `packages` 声明与实际发布面对照（P2-design.md:11-13）

| P2 声明 | 发布层面 | 是否随本次 bump |
|---|---|---|
| `frontend-v3` | 产物经 `make build-frontend` 打入 `backend/peekview/static/`，随 pip 包发布 | ✓ |
| `docs` | 文档随仓库发布（`docs/process/debug-workflow.md` 等） | ✓ |
| `packages/mcp-server`（P2 未声明） | 零改动 | ✗ 不 bump（实测确认，见 §3） |

---

## 2. 版本号变更建议（现 → 目标 + 依据）

**建议：`0.24.1` → `0.25.0`**

依据（三条独立实测）：

1. **最新 tag = `v0.24.1`**。`git tag --sort=-v:refname | head -3` → `v0.24.1` / `v0.24.0` / `v0.23.0`；`git log -1 v0.24.1` → `578a0dc8 chore(release): bump to v0.24.1`（2026-09-07 19:35）。
2. **`VERSIONS.json` 与 tag 一致**：`peekview: 0.24.1`；`scripts/sync_versions.py` 是唯一版本源，同步槽位为 `backend/pyproject.toml` / `backend/peekview/__init__.py` / `frontend-v3/package.json`（+ 文档槽位 `README.md` badge / `INDEX.md` / `docs/roadmap/improvement-backlog.md` / `backend/README.md`）—— `make check-version` exit 0 实测确认四者当前同步。
3. **`0.24.1` 的 patch 位非 0 不构成阻碍**：`CHANGELOG.md:22` 已有 `## [0.24.1] - 2026-09-07` 段，说明 `0.24.1` **已发布**；下一个 minor 自然进位为 `0.25.0`（无需先补 `0.24.2`——本任务不是对 `0.24.1` 的缺陷修复）。先例：`0.20.0 → 0.21.0`（TPV0093）走同型 minor 进位。

**主 Agent 执行命令**：`make bump-version NEW_VERSION=0.25.0`（该 target 会 `sync_versions.py --bump-peekview 0.25.0` → `--check` → `build-frontend-fast` → `git add -A` → commit → tag `v0.25.0`）。

> ⚠️ **`make bump-version` 的 `git add -A`（Makefile:265）会把未跟踪的 `.agate-tmp/` 一并入库** —— 见 §7 的 `[P8-BLOCKER]`，执行前必须先处置。

---

## 3. 未发布变更范围（对照 `git log v0.24.1..HEAD`）

`v0.24.1..HEAD` 共 **29 commit**。产品代码（非 `agate-workspace/`）改动仅 23 文件 / +2051 −88，其中实际影响运行时的只有 **4 个前端文件**：

| 文件 | 归属 | CHANGELOG 条目 |
|---|---|---|
| `frontend-v3/src/router.ts`（+7） | TPV0099 | ✓ `[Unreleased]` 新增第 1 条 |
| `frontend-v3/src/composables/useZenMode.ts`（+29 −?） | TPV0099 | ✓ 同上 |
| `frontend-v3/src/views/EntryDetailView.vue`（1 行） | TPV0099 | ✓ 同上 |
| `frontend-v3/src/composables/__tests__/useZenMode.spec.ts`（+214，测试） | TPV0099 | — |
| `frontend-v3/e2e/tpv0099-*.spec.ts` ×2（+1080，测试） | TPV0099 | — |

**实证：`backend/` 与 `packages/mcp-server/` 在 `v0.24.1..HEAD` 区间零改动**
→ `git diff --stat v0.24.1..HEAD -- backend/peekview backend/pyproject.toml` = 空
→ `git diff --stat v0.24.1..HEAD -- packages/mcp-server/` = 空
两项均为空输出，故 **MCP 不 bump** 成立，且后端无需独立版本。

**区间内无 CHANGELOG 条目的改动（提示，非阻断）**：`2b7d3fcd Add MIT LICENSE file`（+21 行 LICENSE）落在 `v0.24.1..HEAD` 内但 `[Unreleased]` 无对应条目。性质为仓库级法律文件，非用户可见产品行为 —— 建议一并归入 `[0.25.0]` 的「变更」或不列（留主 Agent 裁决）。

---

## 4. CHANGELOG 更新确认

### 4.1 `[Unreleased]` 现状（`CHANGELOG.md:8-20`，共 6 条）

| # | 条目 | 归属 | 类型 |
|---|---|---|---|
| 1 | 全屏模式链接 `/{slug}/f` | **TPV0099** | 新增 |
| 2 | 渲染类 E2E spec 自建 entry 化 | **TPV0096** | 新增 |
| 3 | `docs/process/debug-workflow.md` 新增「E2E 编写规范」节 | **TPV0096** | 新增 |
| 4 | mermaid-visual.spec 假绿修复 | **TPV0096** | 修复 |
| 5 | 死选择器迁移 | **TPV0096** | 修复 |
| 6 | E2E 路由迁移 `/entries/:slug` → `/:slug` | **TPV0096** | 修复 |

### 4.2 结论：**TPV0096 的 5 条应随本次一起归入 `[0.25.0]`**

依据（四条独立实证，非照抄派发线索）：

1. **TPV0096 的代码确实未随 `v0.24.1` 发布**（决定性证据）。tag 与 TPV0096 完成的**时序**经 ancestry 实测：
   - `git merge-base --is-ancestor 578a0dc8 2f73b617` → **YES**（`v0.24.1` 是 TPV0096-DONE commit 的祖先）
   - `git merge-base --is-ancestor 2f73b617 v0.24.1` → **NO**
   - `git log v0.24.1..HEAD --oneline` **包含** `13594c9f wf(TPV0096-P4)`（spec 改造实现）与 `2f73b617 wf(TPV0096-DONE)`
   - `git log v0.24.0..v0.24.1 --oneline` 只含 TPV0096 的 **P0 立项与回退**（`20ecda00`/`e1700f95`），**不含** P2-P8 任何实现
   → TPV0096 在 `v0.24.1` 打 tag 时尚未开工实施，其产物**全部**落在 `v0.24.1` 之后。**未发版 = 事实**。
2. **TPV0096 的 `bump_type: none` 是"有意不单独发版"，不是"已发版"**。读 `agate-workspace/tasks/TPV0096-e2e-fixture-selfcontained/P8-release.md` 首行 frontmatter：`bump_type: none`；§1 理由「无产品代码改动、无用户可见行为变化」；§3「已在仓库根 `CHANGELOG.md` 新增 `## [Unreleased]` 节」；§2「本任务未修改任何版本文件，主 Agent 无需执行 `make bump-version`」。即 TPV0096 明确把内容**寄存到 `[Unreleased]` 等待下一次真实 bump**。若本次不归版，这批条目将无限期滞留。
3. **`docs/process/release.md` 把 `[Unreleased]` 定义为累积暂存区**，并显式说明攒多任务是设计意图：§「为什么」第 2 条「**避免重复：多个任务累积在 `[Unreleased]`，bump 时一次性归集**」；§「bump 时归集」给出范式 = 把 `[Unreleased]` 内容移到新版本号下、`[Unreleased]` 清空。本次即该机制的第一次实际触发。
4. **先例 TPV0093 同向**（但请注意其瑕疵）：`git log v0.20.0..v0.21.0` 同时含 TPV0092 与 TPV0093，TPV0093 的 P8-release.md §「未发布变更范围」明确「TPV0092 后置 docs（4 commit）——纯文档，无代码影响，**随 0.21.0 一并发布**」，同区间任务一并归版有先例。
   > ⚠️ **先例的瑕疵，切勿照抄**：`0.21.0` 在 `CHANGELOG.md:106` 是**空段**（`## [0.21.0] - 2026-08-16` 下一行直接是 `## [mcp-v0.11.0]`）。核对 `git show 2e18b902 -- CHANGELOG.md` 证实：bump commit 只在 `[Unreleased]` 下**新增了一行空标题**，TPV0093 的 P8-release.md 里建议的那一大段内容**从未填入**。这是一处真实的发布留痕事故。**本次必须实际填入条目内容，不能只加标题。**

### 4.3 归版建议（主 Agent 执行，步骤）

1. `make bump-version NEW_VERSION=0.25.0`（会先 `git add -A` + commit + tag —— **执行前先读 §7 的 `[P8-BLOCKER]`**）
2. 编辑 `CHANGELOG.md`：把 `[Unreleased]` 下 6 条整体移入新段（保持 `### 新增` / `### 修复` 分组次序），标题形如 `## [0.25.0] - 2026-09-29`，**`[Unreleased]` 保留为空标题行（`release.md` §「bump 时归集」范式）**
3. 可选：为 `0.24.1..HEAD` 内无条目的 `Add MIT LICENSE file` 补一条或不补
4. `git add CHANGELOG.md && git commit --amend --no-edit`（AGENTS.md 发布流程 + `bump-version` 尾部提示）
5. **归版后 `make check-changelog` 必从「校验 0.24.1」转为「校验 0.25.0」，届时才会 exit 0**（见 §6 状态说明）

> **不要**预先修改 `CHANGELOG.md` —— 按派发指令，releaser 只给建议，实际归版由主 Agent 在 gate 通过后做。本次未改。

---

## 5. `debt_check`

`debt_check: reviewed`

已核对 `agate-workspace/debt/tech-debt.md`（417 行，schema 校验 `check-debt.py FILE` → **exit 0**）。本任务期登记 4 条，前一任务期遗留若干。逐条结论：

| 条目 | category | status | 本次核对结论 | 阻断发布？ |
|---|---|---|---|---|
| **DEBT0013** | technical | **open** | **本任务关联**（`task_id: TPV0099-fullscreen-link`）。archived/expired banner 不在 zen 隐藏集 → `/{slug}/f` 分享归档 entry 时顶部残留 49px 满宽横条 + 可聚焦控件。本任务以「BDD-1/2/3 钉定非归档 seed `dsh-architecture`」规避，不影响本次验收。**产品缺口留存**，建议后续任务修（约 +2 行 CSS，需独立验收） | **否** |
| **DEBT0014** | protocol | **open** | agate 内置 `vitest.sh` 用环境变量传全量测试输出（1.5MB）超 `MAX_ARG_STRLEN` → formatter exit 126 → `check-tdd-red.py` 误判 A 类假红灯；**已实际威胁 CI 判定**（`ci-gate-backstop.py:181-183`），影响 4 个既有任务。修复点属 **agate 上游** `~/.agate/**`，**不在本任务修复**；本项目以任务级 formatter `agate-workspace/tasks/TPV0099-fullscreen-link/.agate/formatters/vitest.sh`（官方扩展点）规避 | **否** |
| **DEBT0015** | protocol | **open** | `check-scope-resolved.py` 对粗体 `**[SCOPE+]**` 不可见致真空早退（`exit 0` 恒真），且 `check-gate.py` **根本不调用**它 → 「P7 gate 通过 ≠ SCOPE+ 被校验过」。**不在本任务修复**（属 agate 上游）；本任务已按协议补齐 `[SCOPE_RESOLVED]` 标记并在 P7 记录该盲区 | **否** |
| **DEBT0016** | protocol | **open** | `check-p6-provenance.py` 剥离 frontmatter 用 `---` 逐对配对，奇数个 `---` 时末个吞掉其后至 EOF → 审计 2 对尾部行漏检（同一违规因位置判定相反）。**不在本任务修复**；本任务未因此出错（P7 §9 实证被吞区间行首 PASS/FAIL 命中 0） | **否** |
| DEBT0010 | technical | closed | TPV0096 交付后关闭（本次区间内 `[Unreleased]` 新增第 2 条即其闭环） | 否 |
| DEBT0011 | technical | in_progress | t022/verify-mermaid 同型死选择器+失效 seed，按 TPV0096 先例延后单独立项，归属 TPV0097/0098 | 否 |
| DEBT0012 | technical | in_progress | seed-debug.py 确定性 422 + `viewer.spec.ts` 18 预存红灯，归属 TPV0097/0098「用例可信治理」 | 否 |
| DEBT0008 / DEBT0009 / DEBT0006 / DEBT0004 / DEBT0005 / DEBT0007 | — | open / in_progress | 与本次发布面无交集（测试副作用 gate 缺失 / 净化正则双实现 / backup merge 不导新表 / 移动端 FileTree e2e 等），均非本次引入 | 否 |

**门禁判定**：**无阻断项**。DEBT0013 属产品缺口但已被本任务的验证侧规避（不影响本次交付）；DEBT0014/0015/0016 为 `category: protocol`，修复点是 agate 上游，**超本任务范围**，本任务仅以规避/登记方式处理。本次**未新增未登记债务**。

**已知失败（非债务）**：`known-failures.md` 登记 4 条预存失败，均与本任务改动无因果关系（详见 §6 第 4 项）。

---

## 6. 发布检查命令 —— 实际执行结果

> 全部由我在本次 P8 会话**实际执行**并读取 `[exit code]`；非"建议执行"。除 `pre-publish-quick` 外均含实测输出摘要。

| # | 命令 | exit code | 实测摘要 |
|---|---|---|---|
| 1 | `make check-version` | **0** | `peekview: v0.24.1  mcp_server: v0.12.0` / `✅ 所有文件版本同步完成` |
| 2 | `make check-changelog` | **0** | `✓ CHANGELOG.md contains peekview v0.24.1 and mcp v0.12.0` |
| 3 | `make verify-wheel` | **0** | `Found 399 static files` / `All referenced JS/CSS files exist in wheel` / `Wheel verification passed` |
| 4 | `make pre-publish-quick`（`dev + check-version + check-changelog + test-quick + verify-wheel`，600s） | **2** | **在 `test-quick` 步骤失败**：`1 failed, 1172 passed, 3 skipped in 58.81s`；`make: *** [Makefile:165：test-quick] 错误 1`。失败项 = `tests/test_cli_remote.py::TestCLIRemoteConfig::test_config_set_remote_api_key`（`OSError: [Errno 30] Read-only file system: '/home/kity/.peekview/config.yaml'`）。**步骤 1/2/3（dev/check-version/check-changelog）均通过，步骤 5（verify-wheel）因 make 短路未执行** —— 已由第 3 项单独补跑 exit 0。详见下方定性 |
| 5 | `make test-frontend` | **0** | `Test Files 111 passed (111)` / `Tests 1350 passed \| 4 skipped (1354)` / 15.73s |
| 6 | `make typecheck` | **0** | `✓ type check passed` |
| 7 | `make lint` | **0** | `All checks passed!` |
| 8 | `make check-docs` | **0** | `✓ 所有文档与代码保持一致` |
| 9 | `E2E_SPEC=e2e/tpv0099-fullscreen-link.spec.ts make debug-test` | **0** | `32 passed (12.0s)`（16 用例 × 2 project） |
| 10 | `E2E_SPEC=e2e/tpv0099-fullscreen-link-auth.spec.ts make debug-test` | **0** | `6 passed (8.0s)` |
| 11 | `check-debt.py agate-workspace/debt/tech-debt.md` | **0** | （无输出 = schema 合法） |
| 12 | `check-p6-evidence.py <task_dir>` | **0** | `19 条 BDD，证据目录非空`；1 组视觉相似截图已降级待复核且含人工复核记录 → 放行 |
| 13 | `curl :8888/health`（E2E 前置探活，两次） | 200 | `{"status":"ok","version":"0.24.1",...}` |

### 6.1 第 4 项失败的定性：**预存沙箱环境性失败，非本任务引入**

独立复核（三次互证）：

1. **隔离复跑仍失败**：`pytest tests/test_cli_remote.py::TestCLIRemoteConfig::test_config_set_remote_api_key` → **exit 1**，报同一 `OSError: [Errno 30]`。故**不是**并发/flaky 竞态，是**确定性环境失败**。
2. **根因直证**：`touch /home/kity/.peekview/.agate-write-probe` → `touch: 无法 touch '/home/kity/.peekview/.agate-write-probe': 只读文件系统`（exit 1）。该测试直写**真实** `~/.peekview/config.yaml`，而 DSH 沙箱将 `~/.peekview/` 挂为只读 → 必然失败。**与代码无关，与沙箱策略有关。**
3. **已在基线 worktree 复现**：`known-failures.md` 第 1 条已载「在 HEAD 基线 worktree（`.agate-tmp/baseline-0099`）复现确认预存」，且与 TPV0095 登记的同源条目一致。

**判读**：`pre-publish-quick` 的 exit 2 由**沙箱只读挂载**造成，**不指向本任务或发布产物的问题**。P2 的 `gate_commands` 并未声明 `make test-quick`（只声明 4 条前端/文档 + 2 条 E2E，见 P2-design.md:465-480），故该失败**不在本任务任何 gate 的判据内**；主 Agent 在 P5 期自行补跑时已同样遇到并登记。
**建议**：交付验收以第 5-10 项为准（本任务 `gate_commands` 的实际映射），第 1-3 项为版本/CHANGELOG/wheel 三件套，第 4 项按上述定性处理。

### 6.2 ⚠️ 第 1/2 项的 exit 0 是"当前中间态通过"，**bump 后归版前会失效**（预期，非缺陷）

`make check-changelog`（Makefile:223-235）的逻辑是：读 `VERSIONS.json` 的 `peekview` 值 `V`，断言 `CHANGELOG.md` 含 `## [V]`。
- **现在**：`V = 0.24.1`，`CHANGELOG.md:22` 有 `## [0.24.1]` → exit 0。
- **bump 到 0.25.0 之后、CHANGELOG 归版之前**：`V = 0.25.0`，CHANGELOG **尚无** `## [0.25.0]` → **exit 1**，输出 `✗ Error: Version 0.25.0 not found in CHANGELOG.md`。

**这是设计使然**：该检查校验的是「版本文件与 CHANGELOG 一致」的**发布完成态**，bump 未填 CHANGELOG 的中间态必然报红（`bump-version` 尾部提示第 1 步就是「编辑 CHANGELOG.md」，正因如此）。**该中间态红灯不阻断发布，是流程顺序问题** —— 按 §4.3 步骤 2/4 归版后即回到 exit 0。**不要为让它变绿而提前改 CHANGELOG**（本次未改）。

同样的时序注意适用于 `check-protocol-consistency.py` 的 CHECK 7（README version badge vs 最新 git tag）：bump 完成而 tag 未创建时必然报 `badge v0.25.0 != tag v0.24.1` —— 该检查需在 **commit + tag 之后**跑（与本任务 P5 卡「DEBT0013 时序注意」同源）。

### 6.3 ⚠️ `verify-wheel` 的 exit 0 对本次发布**是真空通过** —— 附带的 `[P8-BLOCKER]`

第 3 项虽 exit 0，但**它验证的是上一次发布的旧 wheel**，与本次产物无关：

| 证据 | 实测 |
|---|---|
| wheel 文件 | `backend/dist/peekview-0.24.1-py3-none-any.whl`，mtime **2026-09-07 19:37**（= `v0.24.1` 发布时构建） |
| wheel 内 `static/index.html` 引用的入口 | `/assets/index-`**`DIPwbbYc`**`.js` |
| 当前 `backend/peekview/static/index.html`（03:39 重建）引用的入口 | `/assets/index-`**`59aqOXFX`**`.js` |
| wheel 内是否存在当前产物 | `index-59aqOXFX.js` → **ABSENT in wheel**（wheel 只有旧 hash） |
| 内容比对 | `zipfile` 读出 wheel 内 `index.html` 与当前 `static/index.html` → `IDENTICAL: False` |

**风险链**：`make publish`（Makefile:417-435）Step 2 的条件是 `if [ ! -f "backend/dist/peekview-*.whl" ]; then make build; fi` —— **glob 命中旧 wheel 会跳过重建**；随后 Step 3 的 `verify-wheel` 只检查"存在且静态文件齐全"（对旧 wheel 同样为真）。故 **`make bump-version` + `make publish` 连跑会尝试上传上一版的 0.24.1 wheel**（PyPI 侧会因文件名已存在而拒绝，但流程已走到不可逆的最后一步）。
`pre-publish-quick` 之所以没暴露这点，是因为它**不含** `build`；含 `build` 的是 `pre-publish`（full，`clean build dev check-version check-changelog test verify-wheel`）。

**主 Agent 必须做的一步（其余发布动作之外）**：`make bump-version` 后、`make publish` 前，执行 **`make build`**（或 `make build-backend`，其内部 `rm -rf dist` 先行）重建 wheel，再 `make verify-wheel` 复验新 wheel 内引用的是 `index-59aqOXFX.js`。
> 注：`make bump-version` 的 Step 3 只跑 `build-frontend-fast`（重建 static），**不重建 wheel** —— 单靠它不足以消除该风险。

---

## 7. 临时资源清单（releaser → 主 Agent 交接，READY 收尾清理用）

> 口径：本节为**我实际核查**所得（命令实证，不照抄派发线索），标注「应清理 / 不应动」。**特别提醒：带 `[P8-BLOCKER]` 的两项必须在 `make bump-version` 之前处置。**

### 7.1 `[P8-BLOCKER]` 必须在 bump 前处置（否则污染发布 commit）

| 资源 | 实测证据 | 应如何处理 |
|---|---|---|
| **`.agate-tmp/`（未跟踪，76MB，3867 文件）** | `git check-ignore -v .agate-tmp/` → **exit 1（未被忽略）**；`.gitignore` 只忽略 `*.log`（:87）与 `.worktrees/`，**不含 `.agate-tmp/`**；`git status --porcelain -uall -- .agate-tmp \| wc -l` = **156**；剔除 `.log` 后仍有 **158** 个未跟踪文件 | **⚠️ BLOCKER**：`make bump-version` 的 Step 4 是 `git add -A`（Makefile:265），会把 **157 个 `.agate-tmp/` 路径**（`git add -A --dry-run \| grep -c agate-tmp` = 157）扫进 release commit。**处置（二选一）**：① bump 前先 `rm -rf .agate-tmp/`（见 7.2 的关闭前置）；② 或先把 `.agate-tmp/` 加入 `.gitignore` 再 bump |
| **`.agate-tmp/` 内的凭证类文件（10 个）** | `git add -A --dry-run` 命中 `alice-cookies.txt` / `alice-token-0099.txt` / `alice-token-0099-rev1.txt` / `alice-token.txt` / `bob-token.txt` / `carol-token.txt` / `probe-cookies.txt` / `dr-dg2-cookie-probe.cjs` / `p4-cookie-probe.mjs` / `probe-cookie-share.cjs`（`grep -icE "token\|cookie"` = **10**） | **⚠️ 高优先**：含 debug 环境 JWT/会话 cookie（明文）。属 debug 实例凭证（非生产），泄漏面有限，但**明确不应入库**。随 7.1 第一项一并处置 |
| **`.agate-tmp/baseline-0099/`（嵌套 git worktree）** | `git worktree list` → 注册在 `/home/kity/oclab/peekview/.agate-tmp/baseline-0099`（detached HEAD @ `72ff375f`）；`.agate-tmp/baseline-0099/.git` 是文件 `gitdir: /home/kity/oclab/peekview/.git/worktrees/baseline-0099`；`git add -A --dry-run` 报 `add '.agate-tmp/baseline-0099/'`（会把嵌入仓库入库为 gitlink，71MB） | **⚠️ BLOCKER**：不能用 `rm -rf` 单删（会在 `.git/worktrees/` 留孤儿注册）。**先 `git worktree remove .agate-tmp/baseline-0099`**，再删目录/随 7.1 第一项整体删除 |

### 7.2 P8 会话自身新增的临时产物（应清理）

| 资源 | 说明 | 清理动作 |
|---|---|---|
| `.agate-tmp/p8-pre-publish-quick.log`（5.5KB） | 第 4 项 `pre-publish-quick` 完整输出（含失败详情） | 删除（证据已转抄入 §6） |
| `.agate-tmp/p8-test-frontend.log`（1.5MB） | 第 5 项全量 vitest 输出 | 删除 |
| `.agate-tmp/p8-e2e-anon.log` / `p8-e2e-auth.log`（+ 两个 `.out` 旧副本） | 第 9/10 项 E2E 输出 | 删除 |
| `.agate-tmp/p8-check-docs.log` / `p8-lint.log` / `p8-typecheck.log` | 第 6/7/8 项输出 | 删除 |
| `.agate-tmp/p8-residue.json`（9.6KB） | 我用 alice token 拉取的 `GET /api/v1/entries?per_page=100` 响应（含 22 条 entry slug，**无凭证**） | 删除 |
| `frontend-v3/test-results/`（`git check-ignore` → 已忽略，.gitignore:47 附近） | 每次 playwright run 会清空重建；现仅 `.last-run.json`（此前一次的 bdd16 截图已被后续 run 清掉，**持久副本在已入库的 `P5-test-results/evidence/`**，4 文件已跟踪，无损） | 可删（会自动重建）；**注意勿删 `P5-test-results/evidence/`** |
| `.agate-tmp/` 其余历史产物（bdd3-*.cjs / tpv0099-rev*-probe.* / seed*.log / `vdata/` / `p6/` 等，约 140 文件） | P1-P7 各阶段探针脚本与日志（均为本任务期产生） | 随 7.1 整体清理 |

### 7.3 **不应动**（明确保留）

| 资源 | 实测证据 | 理由 |
|---|---|---|
| **debug backend `:8888`** | `ss -ltnp` → `LISTEN 127.0.0.1:8888`；`curl :8888/health` → **200**（`version: 0.24.1`）；**我未停止它** | ✅ **保留**（派发指令要求；主 Agent 负责收尾）。主 Agent 清理时用 `make debug-stop`（同时清 `/tmp/peekview-debug/`） |
| **Chrome CDP `:18800`** | `curl :18800/json/version` → **200** | ✅ **保留**：**外部既有常驻服务，非本任务启动**，与 TPV0093 P8 的处理一致（"不清理"） |
| **`backend/peekview/static/`（03:39 重建，388 文件）** | mtime 全为 `2026-09-29 03:39`；`index.html` 引用 `index-59aqOXFX.js`（实测含 `'locked'` 与 `'/f'` → **确认含本任务代码**）；`find frontend-v3/src -newer static/index.html` = **0 行**（新鲜） | ✅ **保留至 publish 之后**：这是本次发布的**实际产物**；删除将导致 `make publish` Step 1 直接报错。注意它已被 `.gitignore:25` 忽略（`backend/peekview/static/`），不进 git —— 靠 `bump-version`/`build` 重建 |
| **`backend/.venv` + editable 安装（`peekview 0.24.1`）** | `backend/.venv` 创建于 **2026-06-23**（远早于本任务）；`pip show peekview` → `Version: 0.24.1`；`import peekview` → `/home/kity/oclab/peekview/backend/peekview/__init__.py` | ✅ **保留**：venv 非本任务创建。⚠️ **但我的第 4 项 `pre-publish-quick` 的 `dev` 步骤确实执行了 `pip install -e ".[test]"`**（日志：`Successfully installed peekview-0.24.1`），即**刷新了 venv 内的 editable 安装** —— 属 `make dev` 的**设计行为**（`make test-quick` 依赖它），**隔离在 `backend/.venv`，未污染系统 Python**（`python3 -c "import peekview"` → `ModuleNotFoundError` 实测确认；`/home/kity/.local/bin/peekview` 符号链接指向 pipx venv，**未被触碰**）。无需卸载 |
| **`frontend-v3/node_modules`** | mtime **2026-09-08**（早于本任务 P1 开工 09-28） | ✅ 保留（非本任务安装） |
| **`backend/dist/peekview-0.24.1-py3-none-any.whl`（旧 wheel）** | mtime 2026-09-07，内容见 §6.3 | ⚠️ **不要当垃圾删**：必须先 `make build` 重建（`build-backend` 内部会 `rm -rf dist`），再 `make verify-wheel` 复验 —— 见 §6.3 的 `[P8-BLOCKER]` |
| **`/tmp/peekview-debug/`（debug 数据目录）** | 在我的挂载命名空间中 `ABSENT`（`test -d` 失败）；`:8888` 的 health 却回 200 且 `database: ok` | ✅ **保留**：debug 服务由主 Agent 的托底 job 持有、运行在**不同挂载/pid 命名空间**（`readlink /proc/self/ns/mnt` ≠ 服务侧）。**我看不到也管不到它**，请由主 Agent 用 `make debug-stop` 统一清理；**不要**在我的视角下"补删" |
| 生产 `:8080` / `~/.peekview/` | `curl :8080/health` → 超时（exit 124 / 000，**不可达**）；`touch ~/.peekview/...` → **只读文件系统** | ✅ **不应动且实际未能动**：`[PROD_NOT_TOUCHED]` |
| `git stash@{0}` / `stash@{1}` | `git stash list` 有 2 条（`14434722` T022-P4c1、`c94a8fca` v0.1.43） | ✅ **保留**：历史遗留，非本任务产生 |

### 7.4 我未做的动作（供核对）

- **未停止任何服务**（`:8888` 实测仍在运行、health 200）
- **未执行** `make bump-version` / `git commit` / `git tag` / `make publish` / `git add` / `git stash` —— 复核：`git status --short` 仍只有派发前既有条目（`.state.yaml` M、`gate-events.jsonl` M、`orchestrator-log.md` M、`.agate-tmp/` ??、`P8-dispatch-context-implementer.md` ??），**无新暂存**；`git diff --cached --name-only` 仅 `.state.yaml`（派发前既有，非我所加）
- **未修改** `VERSIONS.json` / `CHANGELOG.md` / 任何版本文件 —— `VERSIONS.json` 仍为 `0.24.1`，`CHANGELOG.md` diff 与 P7 期一致
- **未全量重跑 E2E**（`P5_e2e`/`P5_e2e_auth` 两条定向 spec 已重跑并全绿；E2E 全量 suite 在 CDP 模式下可能 >5min，AGENTS.md 明确建议逐项定向验证）
- **未做**任何 `pip install` 到系统 Python（仅 `make dev` 的 venv 内 editable）

### 7.5 残留与隔离核查

| 项 | 结果 |
|---|---|
| debug DB 测试残留（`e2e-` 前缀 / 含 `tpv0099`） | **0 条** —— 我以 alice token 调 `GET /api/v1/entries?per_page=100` 实测：`total 22 / returned 22`（分页取尽，口径与 P6 一致，不用失效的 `limit` 参数），RESIDUE = `[]` |
| 生产触达 | **无** —— `[PROD_NOT_TOUCHED]`（`:8080` 超时不可达、`~/.peekview/` 只读） |

---

## 8. 主 Agent 后续动作清单（顺序敏感）

1. **处置 §7.1 的两项 `[P8-BLOCKER]`**：`git worktree remove .agate-tmp/baseline-0099` → 删/忽略 `.agate-tmp/`
2. `make bump-version NEW_VERSION=0.25.0`（0.24.1 → 0.25.0，MCP 不动）
3. 填 `CHANGELOG.md`：`[Unreleased]` 6 条（本任务 1 条 + TPV0096 5 条）整体移入 `## [0.25.0] - 2026-09-29`，`[Unreleased]` 清空；`git add CHANGELOG.md && git commit --amend --no-edit`
   > 勿重演 `0.21.0` 的空段事故（§4.2 第 4 条）
4. **`make build`**（重建 wheel，消除 §6.3 的旧 wheel 风险）→ `make verify-wheel` 复验新 wheel 引用 `index-59aqOXFX.js`
5. `make check-version && make check-changelog`（归版后应回到 exit 0）→ `make pre-publish-quick`（**注意第 4 项 `test-quick` 的预存沙箱失败**，按 §6.1 定性处理）
6. P5 验证：`check-p6-provenance.py --audit7-only <task_dir>` → 我实测 **`AUDIT7_RESULT: reuse_blocked`（exit 1）**，故需**完整重跑** `gate_commands.P5`；且须安排在 **commit + tag 之后**（CHECK 7 时序，见 §6.2）
7. `make publish` → `git push && git push origin v0.25.0` → 人工 `pipx upgrade peekview && sudo systemctl restart peekview`（AGENTS.md：⚠️ 必须人工）
8. READY 收尾：按 §7 清单清理（`:8888` 用 `make debug-stop`；**不要动 `:18800`**；`~/.peekview/` 与 `:8080` 全程不碰）

---

## 9. 交付边界声明

本文件为**唯一产出**。releaser（implementer P8 模式）**只产出文件**：`bump_type`、版本建议、CHANGELOG 归版建议、`debt_check`、临时资源清单、发布检查实跑结果 —— 全部如上。**版本变更、CHANGELOG 归版、commit、tag、publish 一律由主 Agent 在 gate 通过后亲自执行**，我未执行、未部分执行、未在暂存区留下任何痕迹。
