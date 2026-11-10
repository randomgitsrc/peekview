---
phase: P2
task_id: TPV0102
parent: P2-design.md
trace_id: TPV0102-P2-review-eng-20261110
status: approved
agent: plan-eng-review
created: '2026-11-10'
blockers: 0
---

# P2 工程经理评审（复审第 2 轮）— Explore 列表体验修正

> 被评审对象：`P2-design.md`（1227 行，`candidate_count: 7`，`ui_affected: true`）
> 上轮基准：本文件第 1 轮（4 阻塞 + 6 非阻塞）
> 状态标记：[PROD_NOT_TOUCHED]
> 本文件不含 PASS/FAIL 预判——那是 P6 的职责。

## 结论摘要

**4 个阻塞项（B-1~B-4）全部真实闭合**，我逐条独立复验而非采信 architect 的「18 项门槛全 PASS」自述。**B-3 争议裁决：architect 最终落地的三件事配置（`--tb=short` + `P3_formatter: "pytest.sh"` + 去 `tail`）完整正确**，我用真实 `run_test_with_formatter` + 真实 `check-tdd-red.py::judge_result` + 真实全量套件跑通端到端链路，判定为 B 类红灯（exit 0）。上轮确认通过的部分（数据流、状态机 5 转换、16/34 口径、`## UI 设计` 裸标题、frontmatter）**未被破坏**。

自跑机械门槛：`agate-frontmatter-check.py`（FILE=P2-design.md）**exit 0**；`check-gate.py P2` 在 scratch 副本（注入 approved 的 P2-review.md）上 **exit 2 = P2 通过码**，仅 2 条 cosmetic WARNING。architect 声称的「18 项全 PASS」在**实质结论上成立**，但有两处以我的实测为准则需修正措辞（见「对上游两处断言的修正」）。

新发现 6 项均为非阻塞（已给可执行修法），其中最值得顺手改的是 `P5_e2e_legacy_timeout_seconds: 600` 与本设计自己写下的「外层必须 > 内层」规则相矛盾。

---

## B-1~B-4 逐条闭合判定

### B-1 · `P5_e2e` 写死文件名 + legacy 独立 key — **已闭合**

| 核验点 | 实测 | 判定 |
|---|---|---|
| `:973` `P5_e2e` 用写死文件名、无正则 alternation | `E2E_SPEC=e2e/tpv0102-explore-card-list-ux.spec.ts make debug-test` | 符合 |
| 缺文件能被 exit code 捕获 | `npx playwright test --list e2e/tpv0102-explore-card-list-ux.spec.ts` → `Error: No tests found` + `Total: 0 tests in 0 files` + **exit 1** | 机制成立 |
| legacy 为独立 key | `:974` `P5_e2e_legacy: E2E_SPEC=e2e/team-visibility.spec.ts make debug-test`；`is_legal_gate_key('P5_e2e_legacy')` = **True** | 符合 |
| legacy key 指向的 spec 真能命中 | `--list e2e/team-visibility.spec.ts` → `Total: 12 tests in 1 file` + exit 0 | 有效命令 |
| §6.3 写明 P3 必须创建该文件名 | `:797` 标题即「文件名写死」；`:799` 写明「P3 必须创建该文件名的 spec」+ 缺文件 exit 1 的机制说明 | 符合 |

**判据从「命令被接受」改为「命中集合 == 期望集合」**（`:927` V9 已改为 `refuted` 并写明正确判据）——这正是我上轮指出的判据错误，已修正且表述准确。反向证据 `--list 'e2e/(tpv0102|team-visibility)'` 今天我复跑仍是 `12 tests in 1 file`（全部来自 team-visibility），上轮判定可复现。

### B-2 · `P5_e2e_timeout_seconds: 900` + §9 补理由 — **已闭合**

- `:980` `P5_e2e_timeout_seconds: 900` ✅
- `:1000` 声明要点含三要素：内层超时点（`scripts/run-e2e-tests.sh:92` `E2E_TIMEOUT:-600`）+ 「外层命令级超时必须大于内层硬超时」的因果链 + 量级论证（30 BDD × 2 project）+ TPV0099 先例 ✅
- 我独立核对 `scripts/run-e2e-tests.sh:92` 与 `:96` 的实际内容与引用一致（`timeout "$E2E_TIMEOUT" npx playwright test "$spec" --reporter=line` 在内，`exit 124` 分支在 `:98-105`）✅

### B-3 争议裁决 · 三件事配置是否完整正确 — **配置完整正确**

按派发要求，我在**真实执行通路**（`agate_common.run_test_with_formatter` → `assets/formatters/pytest.sh` → `check-tdd-red.py::judge_result`，`project_module='peekview'`）上跑矩阵。探针在仓外 `.agate-tmp/p3probe/`，`import` 尚不存在的 `peekview.timefmt`（模拟 P3 实现未写）：

| 格 | 命令形态 | 套件规模 | formatter | pytest exit | `import_errors[].module` | judge |
|---|---|---|---|---|---|---|
| A | `-q --tb=no`，无 tail | 单文件 | 无 | 1 | — | **A 类（exit 1）假红** |
| B | `-q --tb=no`，无 tail | 单文件 | pytest.sh | 1 | `[]`（`errors=1`） | **A 类（exit 1）假红** |
| C | `-q --tb=short`，无 tail | 单文件 | 无 | 1 | — | **A 类（exit 1）假红** |
| D | `-q --tb=short`，无 tail | 单文件 | pytest.sh | 1 | `'', peekview.timefmt` | **B 类（exit 0）✅** |
| E | `-q --tb=short` + `2>&1 \| tail -30` | **真实全量** | pytest.sh | 1 | 只剩 `''` | **A 类（exit 1）假红** |
| F | `-q --tb=short`，无 tail | **真实全量** | pytest.sh | 1 | `'', peekview.timefmt, ''` | **B 类（exit 0）✅** |
| G | architect 最终配置的**完整形态**（后端全量 + 注入 error + 前端真跑） | 真实全量 + vitest | pytest.sh | 1 | `'', peekview.timefmt, ''` | **B 类（exit 0）✅** |

**三件事各自的必要性（独立复现，非采信）**：

1. **`--tb=no` → `--tb=short` 必须**：B 格证明 `--tb=no` + formatter 时 `import_errors=[]` 而 `errors=1`（formatter 靠逐行扫 `ModuleNotFoundError` 提取，`--tb=no` 抑制了该行）→ 落 `judge_result` 的 `if errors > 0` A 类分支。
2. **`P3_formatter: "pytest.sh"` 必须**：A/C 格无 formatter → 走 `_fallback_json`（`raw_output` 保留、`import_errors` 空）→ 落 `exit_code==1 and re.search(r"...ImportError...", raw_output)` 的 A 类分支。**注意**：`project_module: "peekview"` 声明了却不被消费——它只在 formatter 给出结构化 `import_errors` 时才起作用。
3. **去 `tail` 必须**：E 格证明真实全量套件（warnings summary 占尾部 ~15 行）下 `ModuleNotFoundError` 被截到 EOF 30 行之外（`grep -c ModuleNotFoundError` = **0**），只剩 pytest 缩写形式 `ERROR  - ImportError while importing test module '/.../....'` → 正则取不到 module → A 类。**只做 ①② 不做 ③ 仍假红**（架构师这个第三件必要条件的发现，我独立复现成立）。

**派发要求我专门判定的两点**：

- **`npx vitest run --reporter=dot` 的退出码遮蔽风险 → 不成立**。三组实测：
  - 纯断言失败（`expect(1).toBe(2)`）→ `failed=1` → `classic red-light`（exit 0）✅
  - 模块解析失败（`Failed to resolve import "@/components/VisibilityMenu.vue"`，即 P3 期前端必然遇到的形态）→ `Test Files 1 failed` → `failed=1` → `classic red-light`（exit 0）✅
  - 后端全绿 + 前端红拼接 → 聚合 exit 1 → `classic red-light`（exit 0）✅
  - 精度确实下降（vitest 的失败被按 pytest 口径的 `failed=` 计数而非结构化分类），但**不误判**，与 `:997` 的自述一致。
- **`[ $b -eq 0 ] && [ $f -eq 0 ]` 聚合语义 → 正确**。四组合实测 `b=0f=0→0`、其余三组 `→1`；关键点是**两套测试都会被执行**（`b=$?;` 先把退出码取出，`&&` 只作用于两个 `[ ]` 判定，不是命令短路链）。`:989` 的「不是 `&&` 短路链」表述属实。

**裁决：三件事配置完整正确，B-3 闭合。** 我上轮「无 formatter → 必然 A 类」的表述确实**不完整**（A 格 `--tb=no` 无 formatter 在非 xdist 通路下可落 `red-light` exit 0，因 exit code / raw_output 形态不同而异），architect 与主 Agent 的根因分析更准确；`应加 formatter` 的方向仍成立，但它只是三件必要条件之一。

### B-4 · `setVisibility` 补 `revokedShares` warning + 单测 — **已闭合**

| 核验点 | 实测 | 判定 |
|---|---|---|
| §3.5 成功分支含 warning toast | `:550-552` `if (updated.revokedShares && updated.revokedShares > 0) toast.show(..., 'warning')` | 符合 |
| 明确「不得静默丢弃」 | `:574` 保留原 `toggleVisibility` 的 revokedShares toast（现状 `entryList.ts:64-68`） | 符合 |
| §6.2 补对应单测 | `:793` 新增 `entry-list-visibility.spec.ts`，含「`>0` 产生 warning」+「为 0/undefined **不产生**」两条 | 符合 |
| 登记面齐全 | §1.1 D4/D9、§5 success 项改「四态」、§8/§13.1 B-4 行、`files_to_read` 补 `models.py:805-815` | 符合 |
| 数据链路真实可达 | `entry_service.py:862-865` 返回 `revoked_shares` → `:954-955` 写入 `response.revoked_shares`；前端 `types/index.ts:56` `revokedShares?: number \| null` | 成立 |

---

## 6 个非阻塞项处置核验（上轮建议，全部已处置）

| 项 | 落点 | 判定 |
|---|---|---|
| `inFlight` 裸 `Set` 非响应式 | `:525` 改 `ref<Set<string>>(new Set())`；`:577` 明确 BDD-24 判据归 store 守卫、组件 `disabled` 为附加视觉反馈，并给 `ref<string[]>` 兜底 | 已处置 |
| `applyPatch` / `restore` 未定义 | `:534-535` 签名 + `:561-571` 字段契约表（三转换 × 三字段同写）+「必须同写」的理由 | 已处置 |
| 「当前团队」两来源 | `:448` 删除 `currentTeamSlug`，由 `teamId` + `teams` 反查派生；`:485` 标注为已删除 | 已处置 |
| `EntryDetailHeader` prop 口径不一致 | `:79-90` B5 明细表统一为 `:date-str`，并登记 `EntryDetailView.vue:203` 的 `useRelativeTime` 解构删除 | 已处置 |
| `P5_fitness` 依赖测试函数名 | §6.1 约束 2（`:781`）写死 `test_mixin_not_in_table_mro` + `-k` 零命中 exit 5。我实测 exit 5 属实 | 已处置 |
| `files_to_read` 缺 4 项 | 实测 49 条；`entry_service.py:800-870` / `api/entries.py:435-450` / `models.py:805-815` / `stores/entry.ts:1-40` 均在；§6.4 点名的既有测试文件全部补入；逐条 `os.path.exists` 检查 **0 缺失** | 已处置 |

另两项上轮意见也已处置：§6.4 新增第 11 项（`header-layout.test.ts:67-76`，我核对实际行号与内容一致）；§6.4#1 明写「必须拆掉 `if (count > 0)` 守卫」+ 前置 `toHaveCount(1)`；§6.3 `:808-811` 补 BDD-22 三处 × `toHaveCount(0)` 的具体断言形态及「为何用 count 不用 not.toBeVisible」。

---

## 上轮确认通过项是否被破坏 — **未被破坏**

| 项 | 核验方式 | 结论 |
|---|---|---|
| **数据流（mixin 通配 serializer）** | 读 §3.1/§3.2：`timefmt.py` 两函数 + `UtcSerializeMixin` 四条硬约束（`when_used="json"` 显式 / `check_fields=False` / 绝不进 `table=True` MRO / 非 datetime 原样透传）全文保留，未新增歧义 | 未被破坏 |
| **状态机 5 转换** | §3.5 `toPatchPayload` 三分支未变：`public` = `{is_public:true, team_id:null}`（两字段同传）、`private` = `{is_public:false, team_id:null}`、`team` = `{team_id:slug}`；`needsConfirm` 仅 `public`；5 转换论证（含 Team→Public 必须先清 team 才能过 `:846-856`）完整 | 未被破坏 |
| **16/34 口径处置** | 独立复现（union-aware 遍历 `peekview.models`）：**16 个叶模型 / 34 个 datetime 字段**，`ShareCreateResponse` 3 字段全继承自 `ShareResponse`，11 个 `table=True` 模型被正确排除。与 §12#2「以遍历为准、P3 不硬编码 15/31」一致 | 未被破坏（口径成立） |
| **`## UI 设计` 裸标题** | `:657` 实测为 `## UI 设计`（无编号前缀），满足 gate 正则 `^#{2,3}\s+UI 设计` | 未被破坏 |
| **frontmatter 各字段** | `agate-frontmatter-check.py`（FILE=P2-design.md）→ **exit 0**；`candidate_count: 7` / `packages` / `domains` / `ui_affected: true` / `ui_design_section: true` / `dispatch_plan`（5 批 ≤ `parallel_limit: 5`）齐全 | 未被破坏 |
| **决策点 A2 / B1 / C2 的权衡** | §2.1/§2.2/§2.3 候选与选择理由原样保留；C2（真实 DOM + `visibility`）仍由 V6 的 `refuted` 实测驱动 | 未被破坏 |

---

## 我自跑的机械门槛（不采信自述）

| 命令 | 结果 |
|---|---|
| `FILE=P2-design.md agate-frontmatter-check.py` | **exit 0** |
| `check-gate.py P2 <task_dir>` | **exit 1**，唯一原因 `P2-review.md 不存在`（预期，本文件产出后消除） |
| `check-gate.py P2`（scratch 副本 `.agate-tmp/gatecopy`，注入 approved + `agent: review-lead` 的 P2-review.md） | **exit 2 = P2 通过码**；2 条 WARNING：`gate_commands.P3` 首 token `(`、`P5_fitness` 首 token `cd` 不存在（`shutil.which` 对聚合命令首 token 的误报，纯 cosmetic，不阻断） |
| `agate-read-gate-commands.py`（GATE_FILE=P2-design.md） | exit 0，5 个命令 key 解析正确，`project_module: peekview` 带出，`RECONCILE 0 mismatches` |
| `is_legal_gate_key` 逐 key | `P5_e2e` / `P5_e2e_legacy` / `P5_frontend` / `P5_fitness` / `P3_formatter`(meta) / 各 `*_timeout_seconds`(meta) 全 True；**无 `P3_xxx` 检测键** |
| 批级 `tests_filter` 实跑（§2.4） | `mount-explore` → 3 files / 23 tests pass；`frontend-shared` → 22 files / 367 pass；`mount-detail` → 2 files / 31 pass（`backend-serialize` 指向 P3 新建文件，属先约定后实现，与 `P5_fitness` 同惯例） |
| 后端全量 / 前端全量（测 P3 预算） | 后端 `-n auto -q --tb=short` **32.8s**；`npx vitest run` **18.8s**（合计约 52s，`AGATE_TDD_TIMEOUT` 默认 120s，headroom 43%） |

---

## 对上游两处断言的修正（不影响结论，但主 Agent 后续引用需用修正版）

1. **主 Agent 的「更坏一格：`--tb=short` + formatter + 保留 `tail` + 保留 `b=$?` → judge 判 `tests pass, no red-light`（假绿）」——在真实执行通路上不可复现。**
   `agate_common.py:755-766` 执行命令时**强制前缀 `set -o pipefail;`**，故 `cmd | tail` 的管道退出码取左侧失败 → `b=1` → 聚合 exit 1。我实测该形态（内层 tail、外层 tail 各一次）均落 **B 类红灯 exit 0**，非假绿。假绿只在**无 pipefail** 的裸 shell 下出现（我验证过 `false | tail -3` → `b=0`），即该格很可能是用 `bash -c` 而非 `run_test_with_formatter` 测出的。
   **结论方向不变**（去 `tail` 仍必须），但**机制依据**应改为我复现的 E 格：保留 `tail` 的真实后果是**A 类假红**（假绿不成立）。`P2-design.md:993-995` 与 V10 表述与此一致，无需改。

2. **architect 的「18 项机械门槛全 PASS」**：在实质结论上成立（我复跑的两项门槛均通过），但 `check-gate.py P2` 在真实 task 目录上当前是 **exit 1**（缺 `P2-review.md`），而非 PASS——属正常流程态，不是缺陷。

---

## 新发现（全部非阻塞，给 P3/P4 的可执行处置）

1. **`P5_e2e_legacy_timeout_seconds: 600` 与本设计自己的规则矛盾**（`:981` vs `:1000`）。设计写明「外层命令级超时必须**大于**内层硬超时（默认 600s）」，但给 legacy key 的正是 600——**等值**，外层到期与内层硬超时同时触发，runner 的 `exit 124` 分支仍可能走不到，B-2 的归因错乱会在 legacy key 上重演。量级上单 spec 12 用例远低于 600s，实际触发概率低。**建议**：顺手改 900（与 `P5_e2e` 一致），一行改动。当前不构成阻塞——B-2 的原始危害（420 << 600 且量级严重不足）已消除。
2. **`toast` 归属重复 → 双 toast 风险**。§3.5（`:549-552`）在 store 内发 warning，§1.1 D9（`:110`）与 §5（`:698`）又在视图层定义「四态」含同一句 `N share link(s) revoked`。若两处都实现，升 public 时用户会看到两条相同 warning。**建议**：P4 二选一（推荐保留视图层四态、store 只 `return { revokedShares }`），并在 §3.5 或 D9 注明「store 与视图二者只居其一」。
3. **`[ $b -eq 0 ] && [ $f -eq 0 ]` 把所有非零码折叠为 1**：pytest `exit 5`（零收集）与 `exit 4`（usage error）都会变成 `classic red-light`（exit 0 = 可推进红灯）。我实测 `-k definitely_no_such_test_xyz`（exit 5）→ judge 0。P3 语义下「非绿即红」成立，且 P5 全量是兜底，故非阻塞；但若 P3 把用例写进一个**未被收集**的文件，P3 仍判红灯通过。**建议**：P3 执行者记录断言条数（`passed+failed+errors > 0` 作为附加自检），不要求改命令。
4. **§6.2 的 6 个前端单测文件没有「必须存在」的机制**（`P5_frontend: make test-frontend` 只跑已发现的 spec）。这与 B-1 同源（缺文件 → 静默绿），但严重度低：`P5` 全覆盖 + P6 逐条 BDD 实跑是兜底，且 `P5_e2e` / `P5_fitness` 已分别钉死 E2E spec 与后端测试文件。**建议**：§6.2 表下加一行「P3 必须创建这 6 个文件（其中 `visibility-menu.spec.ts` / `entry-list-visibility.spec.ts` 为新增）」；若要机械保障，可仿 `P5_fitness` 加一条 `-k` 直指某用例的 key。
5. **`useEntryDetailActions.ts` 的 `handleToggleVisibility` 在 D6 移除入口后成无触发路径**，但 §6.4#10 仍要求改其 `:52` 的 toast 文案。我核对：`EntryListView.vue:175/186` 用的是视图层自己的 `handleToggleVisibility`（`:637`），与 composable 内那个同名函数无关；composable 的仅由 `overflowItems`（`:78`）引用，入口移除后即不可达。**建议**：§6.4#10 注明「该文件仅改文案、函数保留（仍被 `t067`/`t031` 的 mock 返回引用）」，或直接标注为可删——P4 需明确其一，否则会困惑。
6. **`env_constraints` 未登记当前沙箱的预存失败**：`make test-quick`（= `P5` key）在本环境因 `tests/test_cli_remote.py::TestCLIRemoteConfig::test_config_set_remote_api_key` 写 `~/.peekview/config.yaml` 只读而 red（我实测：HOME 可写 → 该用例 exit 0 通过）。按 `AGENTS.md` 属「预存失败 → `known-failures.md` 登记（WARNING 不阻断）」，不是 P2 设计缺陷；**P5 阶段必须登记**，否则会被误读为本任务回归。

---

## 架构问题（阻塞级）

**无。**

## 架构问题（非阻塞）

见上节 1–6。均不需要 P2 再改方案骨架；第 1、2 项建议本轮顺手修（各 1 行）。

## 测试缺口

- BDD 账目复核：E2E 覆盖 `01-06 / 13-25 / 27-30`（26 条）+ 后端 pytest `07-12`（6 条）+ P6 人工 `26`（1 条）= **30 条全覆盖、无遗漏、无重号**。
- BDD-12（存量 UTC 审计）已明确「一次性脚本、不写成 pytest 用例」（`:782`），理由（`conftest.py` autouse 隔离到 `tmp_path` → 恒绿假象）正确。
- 上表第 4 项（前端单测文件存在性）是本轮唯一新增的测试面缺口，已给修法。

## 锁定决策

1. **B-3 裁决落定**：`P3` 的三件事配置（`--tb=short` + `P3_formatter: pytest.sh` + 去 `tail`）**完整正确**，三条各自必要且我已独立复现；`npx vitest run` 退出码无遮蔽、聚合语义正确。**P2 固化后 P4-P6 不得改动这三件事。**
2. **序列化契约锁定在叶模型 mixin（A2）**，`EntryBase`/`UserBase` 保持 `(SQLModel)`，`P5_fitness` 守 MRO——未变。
3. **tooltip 锁定为真实 DOM + `visibility` 切换（C2）**，`z-index: 10`——未变。
4. **可见性菜单锁定为新建 `VisibilityMenu.vue`（B1）**，业务规则收敛进两个纯函数——未变。
5. **16 类/34 字段以遍历口径为准**，P3 不硬编码 15/31，P6 记录差异为预期——未变，我独立复现一致。
6. **本评审不新增 DEBT 条目**：6 项新发现均为本任务内可一并处理的设计细节或 P5 阶段登记动作，不构成需登记的架构债。

## 修订验收（上轮 4 条，逐条闭合）

| 阻塞项 | 上轮闭合判据 | 本轮实测 | 判定 |
|---|---|---|---|
| B-1 | 写死文件名的 `P5_e2e`；§6.3 写明 P3 必须创建；legacy 独立 key | 三项全中 + 缺文件 exit 1 与 legacy 12 tests 均实测 | **已闭合** |
| B-2 | `P5_e2e_timeout_seconds: 900` + §9 补理由 | 全中，理由含内层超时点与因果链 | **已闭合** |
| B-3 | 声明 `P3_formatter`，或把「不误判」结论改为与实测一致 | 两者都做了，且额外补出第三件必要条件（去 tail），我复现成立 | **已闭合（配置完整正确）** |
| B-4 | 成功分支补 `revokedShares > 0` warning + §6.2 补单测 | 伪码 + 四态 toast + 单测两条（含负向）全中 | **已闭合** |

## 收尾自检

- `git status --porcelain`：仓库代码区**无任何改动**；`agate-workspace/tasks/TPV0102-.../` 下新增/修改均为编排侧文件（含本文件）。
- 探针全部落仓外 `.agate-tmp/`（`p3probe/`、`tddscratch/`、`gatecopy/`、`fakehome/`）；我在 `frontend-v3/src/` 与 `frontend-v3/agate-probe/` 临时建过的探针**已删除并复查**，`scripts/e2e-safety-check.sh --test-mtime` 仍 **exit 0**（静态产物新鲜度守卫未被我的临时文件破坏）。
- 未触碰生产 `:8080`、未写 `~/.peekview/`。[PROD_NOT_TOUCHED]
