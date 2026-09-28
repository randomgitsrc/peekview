---
phase: P7
task_id: TPV0099
type: consistency
parent: P6-acceptance.md
trace_id: TPV0099-P7-20260929
status: approved
created: '2026-09-29'
agent: consistency-reviewer
# ── v2.0 机器计数 ──
blocker_count: 0
deviation_count: 4
deviation_critical_count: 0
design_gap_count: 2
design_gap_reviewed_count: 2
---

# P7 一致性检查 — TPV0099 全屏模式链接 `/{slug}/f`

审查角色：consistency-reviewer（独立 subagent，`agent ≠ main`，**只审不写**）。
审查对象：本任务 P1→P6.5 全链产出 + git 阶段 commit 链 + 仓库源码静态核对 + `agate-workspace/debt/tech-debt.md`。
审查方法：P7 卡六项检查清单逐项交叉核对**到节名锚点**，关键声明**逐条独立实证**（grep / read / git show / 只读 API），不转述上游自述。

**审查基线 commit 链**（`git log --oneline` 实测，HEAD = `4e683ca1`）：
`72ff375f`(P1) → `88e27bc2`(P2) → `18f1e40f`(P3) → `f1cfd5c3`(P4) → `97848f25`(P5) → `0b7457ab`(P6) → `4e683ca1`(P6.5)。

**独立性声明**：本审查未启动/停止任何服务、未跑 E2E、未子派发；只读命令仅限 `grep` / `read` / `git log|show|status|rev-parse` / `curl` 只读 GET / 只读 python 复算；未修改任何 P1~P6 产出，**`P7-consistency.md` 之外零写入**。`[PROD_NOT_TOUCHED]`：`:8080` 实测 000 不可达，全程未触碰生产服务与 `~/.peekview/`。

---

## 1. DESIGN_GAP 配对（清单①，硬校验项）

**P4 声明核实（独立复算，非转述）**：`P4-implementation.md` §8 声明 2 条，逐字形态为行首 `[DESIGN_GAP: …]`（L289 / L290）。我按 `check-gate.py` 的 P4 侧口径（`allow_blockquote=False`，即 `^\s*-?\s*\[DESIGN_GAP:`）独立复算 → **2**，与 P4 §8 自检行（L298 声明 `grep -c` = 2）一致；`design_gap_count: 2` 满足 gate 的「P4 声明数 ≤ P7 转抄数」转抄核对层。

### 1.1 DG-1 转抄（测试代码缺陷：BDD-9 pathname 断言搬错语境）

- [DESIGN_GAP: `frontend-v3/e2e/tpv0099-fullscreen-link-auth.spec.ts:151` 断言 `pathname === '/markdown-test'` 与本用例自身 Given（`:101` 导航至 `/markdown-test/f`）及 BDD-2/8/13/14/18、本 spec BDD-15(`:210`) 的「/f 后缀必须保留」直接矛盾——该期望值系 P3 从 P1 §3.3「zen 态下 pathname 仍为 `/markdown-test`」的字面锚点搬入（P1 那次测量在 `/{slug}` 上用 f 键做，`/{slug}/f` 路由当时尚不存在），而 P1§BDD-9 的 Then 原文只要求「目录侧栏不可见 + `.content-area.scrollTop` 增加 > 0」（二者实测均已通过）。按 implementer 决策树第 2 条未改测试；请主 Agent 裁决（预期处置：修该断言为 `/${SLUG_MD}/f`，属 P3 产出修正，非本任务实现缺陷）]

- [DESIGN_GAP_REVIEWED: DG-1 已**真正消解**，且消解方式与 P4 预期处置逐字一致。独立实证（非采信 P5 自述）：`git diff 18f1e40f f1cfd5c3 -- frontend-v3/e2e/tpv0099-fullscreen-link-auth.spec.ts` 实跑 → 该行由 `.toBe(\`/${SLUG_MD}\`)` 改为 `.toBe(\`/${SLUG_MD}/f\`)`（断言消息同步改为「须保持在 /f 全屏视图」），修正随 P4 commit `f1cfd5c3` 落地；HEAD 侧 `sed -n 151p` 复查与该 diff 一致。**定性认同 P4**：该断言与实现正确性无关——P1§BDD-9 的 Then 原文（`P1-requirements.md:222`）只要求「`.toc-sidebar` 不可见 + `.content-area.scrollTop` 增量 > 0」，pathname 等值断言是 P3 追加的「附」断言，且与 P1 BDD-2/8/13/14/18 的「保留 `/f`」互斥。**对实现无提示**：`P4-implementation.md` §2 的 N1~N14 与 M1~M9 均不含为实现该断言而做的让步；`frontend-v3/src/` 三文件 diff（`git show --stat f1cfd5c3`）无任何 pathname/路由剥离逻辑。**唯一残留**是 P4 文档未随该修正同步（见 §7 D2），不构成设计缺口。]

### 1.2 DG-2 转抄（测试代码缺陷：BDD-10 匿名基线用了已登录 context）

- [DESIGN_GAP: `frontend-v3/e2e/tpv0099-fullscreen-link-auth.spec.ts:288` 的「匿名无 token 须 404」基线断言受 Playwright `request` 夹具自身 cookie 存储影响——`:255` 的 `aliceToken(request)` 调 `/auth/login` 后，`Set-Cookie: peekview_token=...` 进入该 `APIRequestContext`，此后无 Authorization 头的 `request.get`（`:285`/`:286`）被自动以 alice 身份发出 → 200 而非 404（独立探针实测：同 context 200 / 全新匿名 context 404）。该失败发生在任何页面交互之前，与本任务实现无关；BDD-10 的 Then 本体经独立探针（真匿名 browser context + 1280×800）实测全部通过且区分力三元组为 `[false,false,true]`（未退化恒真）。按决策树第 2 条未改测试（改后端忽略 Cookie 将违反 N8 后端零改动）；请主 Agent 裁决（预期处置：基线改用独立 `APIRequestContext`/`playwright.request.newContext()`，属 P3 产出修正）]

- [DESIGN_GAP_REVIEWED: DG-2 已**真正消解**，机制归因经独立复核**成立**。独立实证：HEAD 侧 `frontend-v3/e2e/tpv0099-fullscreen-link-auth.spec.ts:313` 现为 `const anonCtx = await pwRequest.newContext({ baseURL: BASE_URL })`，`:315`~`:319` 三态断言（无 token → 404 / 伪 token → 404 / 真 token → 200）全部打在 `anonCtx` 上，`:322` `finally { await anonCtx.dispose() }` 释放；`:22` 的 import 已补 `request as pwRequest`（`grep -n "pwRequest|newContext|anonCtx"` 实测 5 处命中）。**归因交叉验证**：`P4-implementation.md` §4.4 的独立探针三元组（`SAME_ctx_no_header: 200` / `FRESH_ctx_no_header: 404` / `cookies_in_login_ctx: ["peekview_token"]`）与该修复的因果指向一致；`P6-evidence/assert-bdd-10.json` 的 `then.triplet_distinct=true`（`page_states.triplet=[false,false,true]`）证明修复后区分力**未退化为恒真**。**对实现无提示**：`P4-implementation.md` §2 N8 声明后端全部未动，`P5-test-results/unit.md` §3 的 `make lint` 只覆盖后端 Python 且 exit 0 + `git status` 无 `backend/` 文件，双向证明「未以改后端的方式消解该 GAP」。]

**本项结论：design_gap_count = 2 = design_gap_reviewed_count = 2，配对成立；两条均为测试代码缺陷、实现无损，且均已随 `f1cfd5c3` 修正并经 P5/P6 实测复核。**

---

## 2. SCOPE+ 闭环（清单②）— 首轮记 1 条 [BLOCKER]，**已于 §9 复审闭环**

> ⚠️ **首轮结论（下 §2.2）保留为审查痕迹；终值：BLOCKER 已闭环、`blocker_count: 0`**——主 Agent 已在 `P1-requirements.md:35` 增补行首 `[SCOPE_RESOLVED: …]`，并经 §9.2 非真空反向对照验证。§2.1 的三要素核实与 §2.2 的「exit 0 系真空通过」判断**均仍成立**（后者已由 §9.2 的 A/D 组再次复现）。

### 2.1 实质闭环三要素——**逐项核实成立**

| 闭环要素 | 独立实证锚点 | 判定 |
|---|---|---|
| P2 裁决理由（不采纳三条） | `P2-design.md:120` 起 `[SCOPE+]` 条目正文 + §1.3 R-04 + §9 第 1 行「**本任务不采纳**（三条理由）…已裁决（主 Agent 已确认）」；三条理由（① 视觉增量为零——`/{slug}/f` 复用 zen 类，banner 在今天的 zen 态即可见 ② 匿名不可达——`legacy-deploy/raw` 匿名 404 ③ P1 §4.2 已作同类判定且无 BDD 引用该类 entry）均可追 | ✓ |
| P4 未擅自扩大范围 | `P4-implementation.md` §2 N12 逐字声明未给 banner 加 zen 隐藏规则；`git show --stat f1cfd5c3` 的 `frontend-v3/src/` 仅 3 文件（`useZenMode.ts` / `router.ts` / `EntryDetailView.vue`），**无 `styles/layout.css`、无 `EntryDetailBanners.vue`** | ✓ |
| P6 未擅自扩大范围 | `git show --name-only 0b7457ab` 与 `97848f25` 过滤 `agate-workspace/` 后**输出为空** → P5/P6 两阶段零产品代码改动；`P6-acceptance.md` §2 硬约束 1 落实「BDD-1/2/3 钉定 `dsh-architecture`」 | ✓ |
| DEBT0013 已登记 | `agate-workspace/debt/tech-debt.md` 的 `## DEBT0013` 块：`status: open` / `task_id: TPV0099-fullscreen-link`，`evidence` 3 条（P2 §4 V7、`layout.css:208`/`:649-654`、P1 §4.2 自相矛盾项）+ `closure_criteria` 3 条齐备 | ✓ |

### 2.2 [BLOCKER] SCOPE+ 闭环**标记缺失**，且所引 gate 证据为**真空通过**

- [BLOCKER: `P1-requirements.md` **全文无任何 `[SCOPE_RESOLVED]` 标记**（`grep -n "SCOPE_RESOLVED\|scope_resolved" P1-requirements.md` → 0 命中；P1 frontmatter 亦无 `scope_resolved` 列表，仅 `risk_level/phases/packages/domains/domains/ui_render_shape/ui_ux_dimensions`）。而本任务产出**确实含** `[SCOPE+]`（`P2-design.md:120`），按 `dispatch-protocol.md:955` 明文「产出含 `[SCOPE+]` 时，主 Agent **必须**在 P1-requirements.md 增补对应条目并标记 `[SCOPE_RESOLVED: 来源文件]`。未标记 `[SCOPE_RESOLVED]` 的 `[SCOPE+]` → gate 不通过」，且 P7 卡「推进条件」逐字列为 `- [ ] SCOPE+ 闭环（P1 有 [SCOPE_RESOLVED]）`、§实质锚点表列为「SCOPE+ 闭环 \| 条目 + SCOPE_RESOLVED」→ **该推进条件未满足**。]

- [BLOCKER 附证（**验证失效第 10 例**）：派发指引称「主 Agent 已跑 `check-scope-resolved.py` → **exit 0** ✓」。我**独立复跑**该脚本 → 确为 exit 0，但**exit 0 是真空通过、不构成闭环证据**。复现证据（按脚本自身的 `SCOPE_PLUS_RE = ^\s*-?\s*\[SCOPE\+\]` + `SKIP_NAME_RE` + AGATE_CARD 剥离三者逐字复算）：`scope_found = []` → 脚本在「无 `[SCOPE+]` → 早退 0」分支返回，**从未进入 `[SCOPE_RESOLVED]` 判定分支**。根因 = `P2-design.md:120` 的标记形态是 **`**[SCOPE+]** 发现：…`（粗体包裹、行首非 `[`）**，正则要求行首（可含 `-`）直接为 `[SCOPE+]` → `re.search` 对 L120 实跑返回 `False`（已用 Python 对 L120 原文逐字复算）。即：**本任务存在「`[SCOPE+]` 存在但无 `[SCOPE_RESOLVED]`」的真实状态，gate 因标记形态盲区而未拦下**——与 `orchestrator-log.md` 中 T059 同族现象（「`[SCOPE+]` 只在卡片块内触发」）同源。此为本任务反复出现的「验证声明需要被验证」形态的又一实例：**被引为闭环证据的 exit 0，其判据对本案恒真（不检测即通过）**。]

**最小消解动作（供主 Agent，二选一）**：① 采纳 TPV0096 先例（`f5bc4b6b` 在 P1 追加 `[SCOPE_RESOLVED: …]` 并标注「本标记为闭环记录，非语义变更 [BASELINE_CHANGE: 主 Agent 批准的闭环标记]」），在 `P1-requirements.md` 补一行指向 `P2-design.md:120` 的闭环标记（**不改 BDD、不改任何语义**）；或 ② 若主 Agent 判定「不采纳型 SCOPE+ 无需标记」，请以显式裁决替换该推进条件并留痕。**注**：P1 属 P1 产出，按本角色「只审不写」纪律我**不代为写入**。

---

## 3. 跨文件一致性（清单③，逐项给源文件节名）

### 3.1 P2 §packages ↔ P4 / P5 / P6 实际改动面

| 源文件节名 | 声明 | 实测 | 判定 |
|---|---|---|---|
| `P2-design.md` §frontmatter `packages:` / §9 第 6 行 | `packages: [frontend-v3, docs]`、`domains: [frontend]`、明示不含 backend | `P1-requirements.md` frontmatter `packages: [frontend-v3, docs]` / `domains: [frontend]` 与之一致；`git show --stat f1cfd5c3` 的产品侧改动 = `frontend-v3/src/{router.ts,composables/useZenMode.ts,views/EntryDetailView.vue}` + `DESIGN.md` + `CHANGELOG.md` + `docs/roadmap/improvement-backlog.md` + 3 个新测试文件 → **全部落在声明范围，零 `backend/`、零 `packages/mcp-server/`** | ✓ 一致 |
| `P4-implementation.md` §2 N8 / N10 | 后端与 MCP 未动 | `P5-test-results/unit.md` §3 `make lint`（`ruff check peekview/ tests/`）exit 0 + `git status` 无后端文件；`git show --name-only 97848f25`/`0b7457ab` 零产品文件 | ✓ 一致 |

**P2 §packages 的 P8 bump 口径提示**：`P2-design.md` §9 第 7 行定 `bump_type = minor`（用户可见功能 + 公开 URL 契约）。P8 未见产出，本项按「P2 声明 ↔ P4 实际改动」核对通过，**bump 范围一致（frontend-v3 + docs，无 backend）**。

### 3.2 P1 §BDD 基线 ↔ P3 ↔ P6 ↔ P6.5 的数量与内容

| 项 | 实测 | 判定 |
|---|---|---|
| `P1-requirements.md` §3（`#### BDD-1` ~ `#### BDD-19`） | 编号集合 = `{BDD-1…BDD-19}`，**连续、无缺号、无重号** | 19 |
| `P3-test-cases.md` §1 映射表 | 19 行，BDD-1~19 各命中 1 条用例（`grep -oE "BDD-[0-9]+"` 复核编号集合一致） | 19 |
| `P6-acceptance.md` §1 + frontmatter | `^- PASS BDD-N` 行 = **19**，编号集合 = `{BDD-1…BDD-19}`；frontmatter `pass: 19` / `fail: 0` | 19 |
| `P6.5-judge-verdict.md` frontmatter | `criteria_total: 19` / `criteria_passed: 19` / `partial: false` / `status: passed` | 19/19 |

**四方计数与编号集合全部一致（19 = 19 = 19 = 19/19），非仅计数吻合**。按 P7 卡「常见错误 2」防回归要求另做**内容错位抽查**（不只看数量）：

- `P1-requirements.md:196` §BDD-7（锁死不吞内容区内嵌组件 Escape）→ `P6-acceptance.md:36` PASS BDD-7 引 `assert-bdd-7.json` + 分页浮层开/闭两截图 + vision 前/后态 → 映射正确。
- `P1-requirements.md:218` §BDD-9（无目录侧栏 + 锚点滚动正常）→ `P6-acceptance.md:38` PASS BDD-9 判据绑 `.content-area.scrollTop`（0→13731）**并显式排除 `window.scrollY`**（后者恒 0，绑之则恒真失效）→ 映射正确且带负向对照。
- `P1-requirements.md:298` §BDD-17（独立 SVG）→ `P6-acceptance.md:46` PASS BDD-17（img 1 / error 0 / 800×600 / `.fullscreen-btn` 0）→ 映射正确（seed 选择的差异见 §3.6）。
- `P1-requirements.md` §BDD-3（无满宽顶部横条）→ `P6-acceptance.md:32` + `assert-bdd-3.json` 的**三态负向对照 ①0/②3/③1**，与 P1 rev2 基线一致 → 判据拦截力成立，非恒真。

### 3.3 P4 §implementation ↔ P2 §1.1「最终规格」表（M1~M9）

| P2 §1.1 规定 | 源码实测（只读） | 判定 |
|---|---|---|
| M1 `/frontend-v3/src/router.ts`：`/:slug/f` 插在 `/:slug` 后、catch-all 前，`name: 'detail-zen-locked'`、`props: true`、`meta: { zen: 'locked' }` | `router.ts:53-58` 逐字命中（`grep -n "detail-zen-locked" -B4 -A3` 实测位于 `:47-52` 的 `/:slug` 之后） | ✓ 逐字 |
| M2 签名 `useZenMode(locked: () => boolean = () => false)`；`zenMode` 为 computed；`zenAriaText` 为 computed；`updateZenAria` 整体移除；`handleZenKeydown` 首行锁死短路 | `useZenMode.ts:8` 签名逐字；`:10` `computed(() => locked() \|\| manualZen.value)`；`:11-14` `zenAriaText` computed 三分支；`:17` `if (locked()) return`；`:31-35` 返回对象**仅三键**（无 `updateZenAria`） | ✓ 逐字 |
| M3 调用点传 thunk + 可选链 | `EntryDetailView.vue:155` = `useZenMode(() => route.meta?.zen === 'locked')` | ✓ 逐字 |
| M4/M5/M6 三处文档 | `git show f1cfd5c3 -- DESIGN.md`（Zen Mode 节 +1 行，含 locked/无退出提示/`?share=<token>`）、`-- CHANGELOG.md`（`[Unreleased]`→「新增」+1 行，铁律 8 未延后）、`-- docs/roadmap/improvement-backlog.md`（#56 段内被证伪前提划除并更正 + 段末状态改「✅ 已完成」） | ✓ 三处齐备 |
| M7/M8/M9 用例数 16 / 3 / 7 | `grep -cE "^\s*test\("` → 16 / 3；`grep -cE "^\s*(it\|test)\("` → 7 | ✓ 一致 |
| §0 形态合规四条 + 三个禁止变体 | 独立复核：① 未传裸值（`:155` 为 thunk）；② `zenAriaText` 无任何赋值分支（`grep` 无 `zenAriaText.value =`）；③ 签名未退化为 `locked: boolean`；④ `zenMode` 为 computed 派生、锁定态**不落 ref**（`manualZen` 仅承载 f 键手动进出） | ✓ 全避开 |

### 3.4 P2 §6 gate_commands ↔ P5 实跑

| gate 键（`P2-design.md` §6） | P5 实测（`P5-test-results/unit.md` §0 表 + `e2e.md`） | 判定 |
|---|---|---|
| `P5` = `make test-frontend` | exit 0，`111 passed (111)` / `1350 passed \| 4 skipped (1354)` | ✓ |
| `P5_typecheck` = `make typecheck` | exit 0，`✓ type check passed` | ✓ |
| `P5_lint` = `make lint` | exit 0，`All checks passed!` | ✓ |
| `P5_docs` = `make check-docs` | exit 0，`✓ 所有文档与代码保持一致` | ✓ |
| `P5_e2e` = `E2E_SPEC=e2e/tpv0099-fullscreen-link.spec.ts make debug-test` | exit 0，`32 passed`（16×2 project） | ✓ |
| `P5_e2e_auth` = `E2E_SPEC=…-auth.spec.ts make debug-test` | exit 0，`6 passed`（3×2 project） | ✓ |

**6/6 exit 0，命令原样执行、无 `&&` 拼接、E2E 键全部 `E2E_SPEC=` 定向**（规避 `P2-design.md` §1.3 R-07 的裸调用假绿）；`e2e.md` §2 逐条列出 16+3 个目标用例名，可证 runner 加载的是目标 spec 而非缺省 `debug-server.spec.ts`。**与 P2 声明一致** ✓。

### 3.5 P3 §映射 ↔ P6 §证据

19 条 BDD 在 `P6-evidence/` 逐条有对应 `assert-bdd-N.json`（实测 `ls P6-evidence/assert-bdd-*.json | wc -l` = **19**，编号 1~19 齐全）+ 14 张截图 + 14 份 vision 原始输出 + 3 份日志 + 1 份人工复核记录 + `assert-negative-controls.json`，与 `P6-acceptance.md` 第 22 行的清单声明（19 / 14 / 14 / 3 / 1 / 1）**逐项吻合**。`vision-reports/` 14 份 `blocker_count: 0`（`grep -h | sort | uniq -c` → `14 blocker_count: 0`）。P3 §3.3「输入态类 BDD 须人工复核」→ `P6-evidence/manual-review-input-state.md` 覆盖 BDD-4/5/6/7/8/9/10 七条。✓ 一致。

### 3.6 明示「已核对但判定不构成偏差」的两处差异（**非清零，逐条写明理由**）

1. **BDD-17 的 seed 在 P3 与 P6 之间不同**：`P3-test-cases.md` §1 映射表定 `svg-icons`（`P2-design.md` §UI 选择器清单亦记 `svg-icons`），而 `P6-acceptance.md:46` + `assert-bdd-17.json` 的 `given.seed = svg-standalone`（800×600）。**判定不构成偏差**（三条）：① P1§BDD-17 的 Given 原文逐字允许二者（`P1-requirements.md:300`「seed `svg-icons` 或 `svg-standalone`；二者实测匿名 `raw` 均 200」）；② P6 已显式披露并给出理由（`assert-bdd-17.json` 的 `seed_choice`：svg-icons 仅 24×24、大留白页面视觉证据强度弱）；③ **两个 seed 在 P6 阶段均被实跑覆盖**——P6 的 E2E 复用（`e2e-reuse.log`，走 spec 的 `SLUG_SVG = 'svg-icons'`）32 passed，P6 的逐条证据走 `svg-standalone`，故覆盖面未收窄。
2. **`P2-design.md` §9 第 4 行的「待主 Agent 确认」已实际完成**：该行要求「§6.5 验证执行约束须进入 P6 卡」。实测 `P6-dispatch-context-verifier.md:317` 起「四条硬约束」第 1 条逐字转抄了「BDD-1/2/3 **必须**钉定非归档、非过期 seed `dsh-architecture`」+ 理由 + 禁令，`P6-acceptance.md` §2 硬约束 1 亦逐条落实（`assert-bdd-1.json` 的 `given.seed_status='active'`）。P2 §9 的状态文字停留在 P2 时点，属阶段内时间戳，**不构成未决项**。

---

## 4. 未决项清零（清单④）

| 检查 | 命令 | 结果 | 判定 |
|---|---|---|---|
| P1 无残留行首 `[NEED_CONFIRM]` | `grep -nE '^\s*-?\s*\[NEED_CONFIRM\]' P1-requirements.md` | 0 命中（exit 1）；P1 实为 `[NO_NEED_CONFIRM]`（`:33` / `:457` 两处） | ✓ 清零 |
| P1 无残留行首 `[BLOCKER]` / `[DEVIATION-CRITICAL]` | 同上正则并集 | 0 命中（exit 1） | ✓ 清零 |
| P2 / P4 / P6 / P6.5 无残留 `[NEED_CONFIRM]` | `grep -nE '^\s*-?\s*\[NEED_CONFIRM\]'` 四文件 | 0 命中（exit 1） | ✓ 清零 |
| P1 ~ P6.5 无残留 `[BLOCKER]` / `[DEVIATION-CRITICAL]` | 全任务目录行首 grep | 0 命中 | ✓ 清零 |

**注**：本 P7 产出首轮新增 1 条 `[BLOCKER]`（§2.2），当时如实计入 `blocker_count: 1`。**该条已于 §9 复审闭环**：主 Agent 在 `P1-requirements.md:35` 增补行首 `[SCOPE_RESOLVED: …]`（纯新增，`git diff --numstat` = `2 0`），并经 §9.2 临时副本反向对照（B/C 组）证明该检查对本案有区分力 → frontmatter `blocker_count` 已更新为 **0**，当前 `check-gate.py P7` **exit 0**。§2.2 的正文 `[BLOCKER]` 标记按 P7 卡「散文标记保留为人类痕迹（不迁移）」要求保留，gate 判定读 frontmatter 结构化计数。

---

## 5. CODE-MAP 核对（清单⑤）

| 项 | 实测 | 判定 |
|---|---|---|
| `{AGATE_WORKSPACE}/agents/CODE-MAP.md` | **不存在**（`ls agate-workspace/agents` → 无该目录；`ls agate-workspace/agents/CODE-MAP.md` → 无此文件） | 机制**未采用** |
| `P2-skeleton.md` | **不存在** → 骨架机制未采用，P4「新增文件核对表」的前置不成立 | 机制未采用 |
| P4 实际 `[CODE_MAP_UPDATED]` / `[CODE_MAP_EXEMPT]` **行首**标记数 | `grep -cnE '^\s*-?\s*\[CODE_MAP_(UPDATED\|EXEMPT)' P4-implementation.md` → **0**（P4 §7 表格内的 3 处 `[CODE_MAP_EXEMPT: …]` 在单元格内、非行首，按 `count_code_map_lines` 口径不计入） | 计数 0 |

**结论：按 P7 卡「两字段均缺失时机制未采用，跳过校验」，`code_map_new_files_count` / `code_map_reviewed_count` 两字段省略。** 补充核对：即使强行填入，转抄核对层比较的是 P4 实际行首标记数（0）≤ 声明数，两侧均不会触发 exit 1；**故省略字段不产生假绿风险**。**`[CODE_MAP_SYNC]`**：依赖方向无偏离（新增依赖边仅 `router.ts` → `views/EntryDetailView.vue` 的既有懒加载形态，`useZenMode` 未引入新模块依赖）。

---

## 6. 架构决策落点与过时标注核对（清单⑥）

`{AGATE_WORKSPACE}/decisions/` 目录**不存在**（`ls -d agate-workspace/decisions` → 无此目录）→ **无既有跨任务架构决策可供核对，亦无须在本阶段撰写决策正文**。本项 **不适用**（N/A）。

按卡片要求「仅核对、不撰写」，本任务亦**无**应落而未落的跨任务架构决策：P2 §9 第 5 行「`FRONTEND_ROUTES` 统一收敛」被明确定论为**独立任务**（非本任务应落的决策），DEBT0013 已按债务登记簿（而非 `decisions/`）留痕。

---

## 7. DEVIATION 清单（**首轮** 5 条，**非阻断，逐条如实记录**）

> ⚠️ **本节为逐条实证记录，保留原文不改**。复审后计数：**D1/D2/D3/D4 保留（4 条）**；**D5 已撤回**（`check-p6-provenance.py` 实测 exit 0，经反向对照证实修复有效）→ 终值 `deviation_count: 4`，见 §9.4 与 §9.7。下文 D5 条目保留以示审查痕迹，**其「exit 1 未闭环」的结论已作废**。

- [DEVIATION: D1 — `P6-acceptance.md:92` 的视觉 checklist 行把 BDD-17 的证据尺寸写成「**24×24**」，与所引证据及**同文件**的记载矛盾。实证：`assert-bdd-17.json` 的 `then.img_box = {w:800, h:600, naturalWidth:800, naturalHeight:600}`；`P6-acceptance.md:46`（同文件 §1 的 PASS BDD-17 行）亦写「图片 bounding box 800×600 且 `naturalWidth/Height`=800/600」。「24×24」实为 **`svg-icons`** 的尺寸（仅出现在 `assert-bdd-17.json` 的 `seed_choice` 与 `vision-reports/bdd-17.yaml` 的 seed 选择说明中，且该 seed 本任务**未被采用**）。性质：跨节证据引用错位（笔误级），**P6 第 92 行与第 46 行自相矛盾**；不影响 BDD-17 的 PASS 判定（判据锚点是 800×600 的 bounding box）。建议把 `:92` 的「24×24」改为「800×600」。]

- [DEVIATION: D2 — `P4-implementation.md` 的「未改动任何测试文件」类声明与**同一 commit** `f1cfd5c3` 的实际改动不一致。实证：`git show --stat f1cfd5c3` 显示 `frontend-v3/e2e/tpv0099-fullscreen-link-auth.spec.ts` **+53/-10**（`git diff 18f1e40f f1cfd5c3 -- …auth.spec.ts` 确认含 DG-1 的 `:151` 断言改写与 DG-2 的 `:313` 匿名 context 改写，并带「P3 修正轮 2 / DG-3」注释）。而 P4 文档称：§2 M8 行「P3 产出，**未改动**」、§4.5「**未改动任何测试文件**（含 M7/M8/M9 三个新 spec）」、§6 把该 spec 列在「**新增**测试文件（P3 产出，**P4 未改动**）」。**定性说明**（避免误报）：§4.2 的「4 failed / 2 passed」与 §4.3/§4.4 的诊断是 implementer 工作窗口内的**真实时点状态**，派发指引已明确其非「文档失实」；**本条偏离的对象是「未改动测试文件」这一随 commit 固化的状态性声明** ——该修正由 test-designer 在同一 P4 commit 内后落地（`P4-review.md` §1.1 记「auth spec × 6 次，每次 6 passed」可证），但 `P4-implementation.md` 未随之同步，致 P4 产出集**自身不自洽**、§4.2/§4.5 的计数不再描述 HEAD。**不构成实现缺陷**（两处 DG 修正已核实存在于 HEAD）。建议在 P4 §2/§4.5/§6 补一行「DG-1/DG-2 已由 test-designer 在本 commit 内修正，auth spec 实测 6 passed」的同步说明。]

- [DEVIATION: D3 — `P5-test-results/` 的**残留扫描方法与自述不符，完整性无法从记录中判定**。实证：① 后端 `api/entries.py:173/383` 只声明 `per_page: int = Query(20, ge=1, le=100)`，**全文无 `limit` 参数**（只读 API 实测：`?limit=200` → `returned=15, per_page=20`，`limit` 被静默忽略）；故 P5 三处自述的「以 alice 检索 `limit=200`」（`P5-progress.md:59`、`P5-test-results/unit.md:134`、`e2e.md:111`）**并未执行其所描述的查询语义**，实际生效的是默认 `per_page=20`。② P5 记录到手/可见数 = **20**，**恰等于该默认上限**——这是「按页取数」的典型特征，而非「取尽」的证据；记录中**未见**逐页枚举或「页数 × per_page ≥ total」的取尽论证。③ P6 以正确口径重做（`P6-evidence/residual-check.log`：`per_page=100` → `alice 可见 total = 22`，明确记「分页 1 页取尽、到手 22 条」+ 22 条 slug 全量清单），得 **22**，比 P5 多 2 条。**如实标注不确定性**：我无法从留痕判定该 2 条差异是「P5 的扫描被上限截断」还是「两次检查间 alice 可见集合确有变化」（P5/P6 均未提供各自时点的完整 slug 清单对照），故**不主张已发生截断**。**该偏离的实际影响为零**：残留 = 0 这一结论已由 P6 的正确口径扫描独立证实；P5 未产生假阴性。偏离性质 = **验证记录的自述与查询语义不符 + 同一检查在 P5/P6 采用互斥口径而未互相校正**（P6 明确写「该 API 的 `limit` 参数不生效」却未回指 P5 的同名记录）。建议 P5 该条改用 `per_page` 分页、并显式记录「页数/到手数/total」三元组以自证取尽。]

- [DEVIATION: D4 — `P2-design.md` §6 `gate_commands` 声明的 `P6` 与 `P6_typecheck` 两键在 P6 阶段**无执行留痕**。实证：`P6-acceptance.md` / `P6-progress.md` / `P6-evidence/test-output.log` 内 `grep -nE "make test-frontend\|make typecheck"` → **0 命中**；`P6-progress.md` 仅记两个 E2E spec 的独立重跑（`e2e-reuse.log` → 32 passed / 6 passed），即 `P6_e2e` / `P6_e2e_auth` 两键已覆盖。**风险判定为低**（非阻断）：`97848f25`/`0b7457ab`/`4e683ca1` 三 commit 经 `git show --name-only` 过滤后**零产品代码改动**，且 `.state.yaml` 的 `p5_pass_commit: f1cfd5c3…` 表明 P5 的 `make test-frontend`/`make typecheck` 跑在**同一代码 commit** 上、均 exit 0 → 功能结论不受影响；偏离性质为**声明与执行留痕不齐**（追溯性缺口）+ P6 卡未强制引用 `gate_commands` 的缝隙。建议二选一：在 P6 报告内补记「复用 P5 同 commit 结论：`make test-frontend` 111 files/1350 passed、`make typecheck` exit 0」，或由 P2 侧的 P6 键声明口径澄清「P6_* 为留存键、不强制重跑」。]

- [DEVIATION: D5 — `P6-dispatch-context-verifier.md:293` 的格式样例致 `check-p6-provenance.py` **exit 1**，未闭环。实证：`P6-progress.md` 第 58 行记「`check-p6-provenance.py` → exit 1，**唯一**原因：`P6-dispatch-context-verifier.md` 物理行 293（主 Agent 派发产物，非 verifier 可改范围）」——该行是形如 `- PASS BDD-1: {描述} (screenshots/…)` 的**格式示例**，被审计 2 判为「验收结论预判」。P6 的 `check-gate.py P6` 为 exit 2（通过），故未阻断 P6 推进，但该审计脚本的红灯**至今未清**。该文件为主 Agent 派发产物（不在 P1~P6 产出范围、亦不在我可写范围内），故仅作记录与上报：建议把示例行改为非行首 `PASS`/`FAIL` 形态（如缩进或以 `例：` 前缀）后重跑该审计。]

---

## 8. 结论（**首轮**，历史记录——已被 §9 复审轮取代）

> ⚠️ **本节为首轮结论快照，请勿作为终值引用**：BLOCKER 已于 §9 闭环（`blocker_count: 0`），D5 已于 §9.4 复核撤回（`deviation_count: 5 → 4`）。**终值见 §9.7 与文件头 frontmatter。**

**P7 一致性审查：BLOCKER = 1，DEVIATION-CRITICAL = 0，DEVIATION = 5（均记录级，非阻断），DESIGN_GAP 配对 2/2 成立，CODE-MAP 机制未采用（N/A），decisions/ 不适用（N/A）。`status: rejected`。**

- **硬校验项（design_gap 配对）通过**：P4 §8 两条 `[DESIGN_GAP]` 已逐条转抄 + 各配 `[DESIGN_GAP_REVIEWED]`；两条均为**测试代码缺陷**，修正已随 `f1cfd5c3` 落地（DG-1 `:151` → `/${SLUG_MD}/f`；DG-2 `:313` → 独立匿名 `pwRequest.newContext()`），且经 P5/P6 实测与证据交叉复核。
- **跨文件一致性主干成立**：P2 §packages ↔ P4 改动面（无 backend）；P1 §BDD 19 = P3 映射 19 = P6 PASS 19 = P6.5 judge 19/19，编号集合与内容映射双查通过；P4 §implementation ↔ P2 §1.1 M1~M9 逐字（含三个禁止变体全避开）；P2 §6 gate_commands 6/6 exit 0（E2E 键均 `E2E_SPEC=` 定向）。
- **唯一 BLOCKER 是形式/流程层的推进条件缺口**：`[SCOPE+]`（`P2-design.md:120`）的实质闭环三要素**全部成立**（P2 裁决理由、P4/P6 零扩范围、DEBT0013 已登记），但 P1 **无 `[SCOPE_RESOLVED]` 标记**（协议明文要求），且被引为证据的 `check-scope-resolved.py` exit 0 经独立复现证明是**因标记形态盲区而早退的真空通过**（`scope_found = []`），并非闭环证据。消解成本极低（P1 补一行闭环标记或主 Agent 显式裁决替换该条件）。**我未代为写入**（只审不写，且 P1 非我可写范围）。

**`[PROD_NOT_TOUCHED]`** 本审查为纯只读审查：未启动/停止服务、未跑 E2E、未 `uvicorn`、未触碰 `:8080`（实测 000）与 `~/.peekview/`；临时产物零落盘（未创建任何探针文件）；所有 bash 命令外层 `timeout`；子派发未启用；`P7-consistency.md` 之外零写入。

---

## 9. 复审轮（rev1）— BLOCKER 闭环验证

> 本轮范围：**只验证 §2.2 那 1 条 BLOCKER 是否闭环** + 一次未回退抽查。§1~§6 的六项检查结论与 §7 的 DEVIATION 登记**保留不重审**（未回退确认见 §9.5）。
> 复审方法沿用上轮标准：**不采信主 Agent 自述**，关键声明读源码 + 临时副本反向对照逐字复算。

### 9.1 验证点 1/3——标记存在性与形态（成立）

独立实证（`re.search` 逐字复算，非 grep 目视）：

- `P1-requirements.md:35` 存在 `[SCOPE_RESOLVED: from P2-design.md:120…]`，**位于行首**（`re.M` 下 `^\s*-?\s*\[SCOPE_RESOLVED($|[^a-z])` 的 `findall` → 命中 `[':']`，即 1 处，捕获组为冒号 → 形态合法）。
- 位置核实：正文首部，`# P1 需求基线…`（`:31`）与 `[NO_NEED_CONFIRM]`（`:33`）之后、`> **修订轮说明（rev1）**`（`:37`）之前，符合派发指引自述。
- **标记未改 BDD、未改语义**（`git diff` 硬证）：`git diff --numstat P1-requirements.md` → **`2 0`**，即**纯新增 2 行、删除 0 行**；逐行看新增内容 = 1 行 `[SCOPE_RESOLVED: …]` + 1 行空行，**无任何删除或改写**。BDD 计数 HEAD 版 = **19**、工作区版 = **19**（同口径复算），编号集合 `{BDD-1…BDD-19}` 连续无缺号。
- `check-frontmatter.py P1-requirements.md` → **exit 0**。

> 「纯新增、零删除」比「BDD 数仍 19」更强：计数相同也可能是「删一条加一条」，`numstat` 的 `2 0` 排除了该可能。

### 9.2 验证点 2/3——**非真空验证**（本轮核心，做法与结果）

上轮教训是「exit 0 可能恒真、不检测即通过」，故本轮**不接受任何 exit code 作为证据**，改为「读源码确认分支 + 临时副本反向对照」两步。临时副本置于 `/home/kity/oclab/peekview/.agate-tmp/scope-nonvacuous/`，**未改动任务目录真文件**（抽查见 §9.5）。

**第一步——读 `check-scope-resolved.py` 源码确认分支结构**（逐字，`:82-112`）：

```text
_scan_scope_plus(task_dir)  → 抓行首 [SCOPE+]（SKIP_NAME_RE 跳过 dispatch-context|dispatch-prompt|progress）
  └─ if not scope_found: sys.exit(0)          ← 第 83-84 行：早退分支（真空点）
后续才进入 [SCOPE_RESOLVED] 判定：
  ├─ P1 frontmatter scope_resolved 非空 → exit 0
  ├─ 正文 SCOPE_RESOLVED_RE 命中数 == 0 → exit 1   ← 真正的判定分支
  └─ 命中数 > 0 → exit 0
```

**关键事实**：`_scan_scope_plus` 对本任务的返回值 = **`''`（空）**——我按脚本自身的 `SCOPE_PLUS_RE` + `SKIP_NAME_RE` + AGATE_CARD 剥离三者**独立重实现**扫描全部顶层 `*.md` → `scope_found` 为空、行首 `[SCOPE+]` 命中列表为空。**即 `P2-design.md:120` 的 `**[SCOPE+]** 发现：…`（粗体包裹、行首为 `*`）对脚本不可见**——上轮该判断**依然成立**。

**第二步——临时副本反向对照矩阵**（对照组 A/B 在副本上人为构造「脚本可见的 `[SCOPE+]`」，以强制脚本进入判定分支）：

| 组 | 副本构造 | exit | stderr | 说明 |
|---|---|---|---|---|
| A | 原样副本（P2 的非行首 `[SCOPE+]`） | 0 | **（空）** | 复现**真空早退**——无任何判定输出 |
| B | 副本 P2:120 改为行首 `[SCOPE+]** 发现：…`，P1 保留标记 | 0 | `GATE SCOPE: P2-design.md 有 [SCOPE+]，P1 有 1 个 [SCOPE_RESOLVED]` | **真正走通判定分支**且判通过 |
| C | 在 B 基础上**移除 P1 的 `[SCOPE_RESOLVED]` 行** | **1** | `GATE SCOPE: 产出含 [SCOPE+]（P2-design.md ），但 P1 无 [SCOPE_RESOLVED] 标记` | **反向对照：标记缺失 → FAIL** |
| D | 副本还原至 A 态 | 0 | （空） | 真空态可复现，排除偶发 |

**结论（区分力证明）**：B/C 构成完整对照——**同一脚本、同一 `[SCOPE+]` 输入，仅「P1 是否含该标记」一个变量**，exit 由 0 变为 1。故该检查**对本案有区分力**，B 的 exit 0 是**真通过**而非恒真；A/D 的空 stderr 则如实暴露了脚本对本任务**实际输入**仍是真空早退（根因未变）。

**据此给出本轮的关键判断（须让主 Agent 知晓）**：主 Agent 增补的 `[SCOPE_RESOLVED]` 标记**内容与形态均合规、且经反向对照证明「若缺失会被判 FAIL」**，因此 §2.2 的 BLOCKER **在协议要求的意义上已闭环**。**但要明确区分两件事**：
1. **协议要求已满足**——P1 现确实含合规标记（`dispatch-protocol.md:955` 的「主 Agent 必须增补该标记」已履行），后续任何任务若出现**行首** `[SCOPE+]`，该标记都能真正拦住缺失。
2. **本任务的自动拦截仍是真空的**——因 `P2-design.md:120` 粗体包裹这一**根因未变**，`check-scope-resolved.py` 在真实任务目录上仍走早退 0、**不会**实际校验这个标记。即：标记是**人写的、不是脚本逼出来的**；脚本对本例无拦截力。

> 这与上轮结论**不矛盾**：上轮否证的是「exit 0 构成闭环证据」（**否证成立且本轮 A/D 再次复现**）；本轮确认的是「标记本身已存在且合规、内容与反向对照均通过」。**证据链成立 ≠ 自动门禁生效**——二者不可互相替代。
> 另核：`check-gate.py` 内**零处**引用 `check-scope-resolved.py` / `SCOPE_RESOLVED`（`grep -c` = 0）；真正调用它的是 `pre-commit-gate.py:439`，而该行有 `if gate_exit != 1 and …` 前置条件。故 **`check-gate.py P7` 通过 ≠ SCOPE+ 闭环被校验过**（P7 卡把「SCOPE+ 闭环」列为推进条件，但 gate 脚本并未实现该校验）。

### 9.3 验证点 4/4——`check-gate.py P7` 实跑（本人亲跑，非转述）

| 时点 | 命令 | exit | stderr |
|---|---|---|---|
| 更新本文件**前** | `check-gate.py P7 {TASK_DIR}` | **1** | `GATE P7: BLOCKER=1, DEVIATION-CRITICAL=0` |
| 更新本文件**后**（`blocker_count` → 0，本人亲跑复核） | 同上 | **0** | （无输出）——与 §9.7 结论一致 |

更新前的 exit 1 **并非** SCOPE+ 缺口所致，而是本文件 frontmatter 仍写 `blocker_count: 1`——`check-gate.py:1216-1236` 是**读取 frontmatter 结构化计数**（`blocker_count` / `deviation_critical_count`）判定，非正文 grep。故闭环动作有两步且缺一不可：① 主 Agent 补 P1 标记；② **我更新本文件 `blocker_count` → 0**（本轮完成）。

### 9.4 D5 过时性——**确认主 Agent 纠正成立，D5 撤回**

主 Agent 判我 D5「已过时、判错」。我按本轮同一标准（**不采信自述、读源码 + 反向对照**）复核，**确认纠正成立**：

- **当前态**：`check-p6-provenance.py {TASK_DIR}` → **实测 exit 0**（我亲跑）。
- **根因定位到行**：我逐字重实现该脚本「审计 2」的剥离逻辑（AGATE_CARD 剥离 → CARD-SOURCE 剥离 → **删顶部第一对 `---` 定界的 frontmatter 块**，`check-p6-provenance.py:331-386`），对副本复算 → `prejudice = 0`。触发源确为**格式样例行**：现为 `P6-dispatch-context-verifier.md:296` = `{判定} BDD-NN: {描述} ({证据路径})`（**不再以判定词起首**，故不匹配 `^\s*- (PASS|FAIL)\b`）。
- **反向对照（证明修复真实有效，非被别的改动掩盖）**：在副本把 `:296` **回退为修复前形态** `- PASS BDD-1: {描述} (screenshots/…)` → `check-p6-provenance.py` **exit 1**、stderr `含 1 处验收结论预判`；还原 → exit 0。**该行确为唯一因果行，主 Agent 的修复真实且到位**。
- **我的错误性质（如实自陈，不辩解）**：我的 D5 依据是 `P6-progress.md:58` 的**过程自记**，而该行记录的是**修复前的中间态**（且该 note 保留了「exit 1」而未标注「已修复」，构成一处**过程记录未随终态更新**的小瑕疵）。我把**时点快照当成了当前事实**，且**未在写结论前复跑该脚本**——这在「只审不写、证据须自证」的标准下是可避免的方法论失误。上轮我在别处反复强调「不采信自述」，却在 D5 上采信了**我自己的旧笔记**，属标准执行不一致。

**结论：`check-p6-provenance.py` 当前无红灯，D5 不成立 → 从 DEVIATION 计数中撤回**（`deviation_count: 5 → 4`）。remaining = D1/D2/D3/D4，四条主 Agent 均判「成立」，与本轮抽查一致。

### 9.5 未回退抽查（确认，不重审）

| 项 | 实测 | 判定 |
|---|---|---|
| `P7-consistency.md` 的 DESIGN_GAP 配对未退化 | 本文件行首 `[DESIGN_GAP:` = **2**；`DESIGN_GAP_REVIEWED` 出现 **3** 处（含 §1 表头/正文行，均覆盖 2 条）；frontmatter `design_gap_count: 2` / `design_gap_reviewed_count: 2` 保持 | ✓ 2/2 配对未退化 |
| `P4-implementation.md` 未被本轮修改 | `git status --porcelain` → P4 文件 **clean**（同为 clean 的还有 `P2-design.md` / `P3-test-cases.md` / `P6-acceptance.md`）；P4 行首 `[DESIGN_GAP:` 仍 = **2**（`:289`/`:290`） | ✓ 未回退 |
| 本轮唯一被改的任务文件 = P1 + 本文件 | `git status` 列出 `P1-requirements.md`（主 Agent 闭环动作）与本文件（本人产出），任务目录**无其他 `.md` 产出改动** | ✓ 与派发声明一致 |
| 跨文件引用关键词仍在（gate `:1296` 的 WARNING 口径 `P1.*BDD\|P2.*packages\|P4.*implementation`） | `P1-requirements.md` 命中 11、`P2-design.md` 命中 12、`P4-implementation.md` 命中 7、`P2 §packages` 命中 3 | ✓ 关键词齐备，不触发 WARNING |
| 六项检查（§1~§6）结论未被破坏 | 本轮仅 P1 纯新增 2 行、本文件 frontmatter 计数 + 复审节；P2~P6 产出零改动 → §3~§6 所依赖的源文件全部未动 | ✓ 未回退 |

### 9.6 复审轮附带发现（非本任务产出偏差，建议登记协议层）

复算 provenance 脚本时发现一处**独立于本任务**的脚本缺陷，如实上报（不据此变更本任务计数）：

- **现象**：`check-p6-provenance.py` 的「删顶部第一对 `---` 定界块」用 `while i < len(stripped)` 逐对配对（`:372-382`）。当剥离卡片后文件中 `---` 行数为**奇数**时，**最后一个 `---` 会吞掉其后直到文件末尾的全部内容**，使该区间不参与「审计 2」扫描。
- **实例**（本任务文件）：剥离卡片后 `---` 共 **9 行（奇数）**，末尾 `---` 位于 stripped index 140 / **原始行 382**，致**原始行 383~419（37 行，含「环境与纪律」等节）整体不被审计**。
- **反向对照（证明该盲区真实存在，且与上面 D5 的修复无关）**：在副本的该吞没区间（原始行 ~395）注入**真·行首** `- FAIL BDD-97: …` → `check-p6-provenance.py` **exit 0**（未被发现）；而把同样的注入放到**存活区间**（`:380` 锚点后）→ **exit 1**（被发现）。**同一违规内容，位置不同则判定相反** → 该审计存在位置盲区。
- **影响**：`exit 0` 对该脚本而言**可能是「违规内容恰好落在被吞区间」导致的假绿**——与上轮 `check-scope-resolved.py` 的真空通过同族（**「不检测即通过」**）。本任务 P6 未因此产生结论错误（P6 的 PASS 判定不经此脚本，且该脚本 P6 期实为 exit 1、红灯已被主 Agent 手工消除），故**不影响本任务推进**。
- **建议**：按本任务既有先例（`DEBT0014` 登记协议层 formatter 缺陷）登记为债务，由协议侧修复配对逻辑（如改为「删除首个 `---` 起始块」或按 code fence 感知配对），并补一条奇数 `---` 的回归用例。

### 9.7 复审结论

**BLOCKER = 0（§2.2 那 1 条已闭环）；DEVIATION-CRITICAL = 0；DEVIATION = 4（D1/D2/D3/D4 记录级、非阻断，D5 经复核撤回）；DESIGN_GAP 配对 2/2 成立；CODE-MAP / decisions 机制 N/A。`status: approved`。**

- **BLOCKER 闭环成立且经非真空验证**：`P1-requirements.md:35` 的行首 `[SCOPE_RESOLVED: …]` 符合脚本正则、`git diff --numstat` 为**纯新增 `2 0`**（未改 BDD、未改语义，BDD 仍 19、`check-frontmatter.py` exit 0）；临时副本对照组 B/C 证明「同一 `[SCOPE+]` 输入、标记有无 → exit 0/1」，**该检查对本案有区分力**，标记非摆设。
- **须随结论一并传达的限定**：`check-scope-resolved.py` 在**本任务真实目录**上仍因 `P2-design.md:120` 的粗体形态而**真空早退**（A/D 组 stderr 为空），且 `check-gate.py` 根本不调用它（`grep -c` = 0，实际调用方是 `pre-commit-gate.py:439`）。故本 BLOCKER 的闭环是**协议要求意义上的闭环（人写标记已合规）**，**不是自动门禁意义上的闭环**；该形态盲区建议随 §9.6 一并作协议层债务登记。
- **D5 撤回并自陈成因**：`check-p6-provenance.py` 实测 exit 0；副本反向对照证明修复行（`:296`）确为唯一因果行、修复真实有效；我上轮误将 `P6-progress.md:58` 的**修复前过程自记**当作当前事实，且未在结论前复跑脚本——标准执行不一致，已如实记录。
- **本轮我未代写 P1**（只审不写，P1 闭环由主 Agent 完成）；本轮我在 `P7-consistency.md` 之外零写入。

**`[PROD_NOT_TOUCHED]`（复审轮）**：未启动/停止服务、未跑 E2E、未 `uvicorn`；未触碰 `:8080` 与 `~/.peekview/`。反向对照全部在 `/home/kity/oclab/peekview/.agate-tmp/` 的**临时副本**上进行，**任务目录真文件零改动**（`git status` 可证：任务目录内除 P1 与本文件外无改动）；所有 bash 命令外层 `timeout 180s`；子派发未启用。
