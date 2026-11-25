---
phase: P7
task_id: TPV0104
type: consistency
parent: P2-design.md
trace_id: TPV0104-P7-20261126
status: approved
created: '2026-11-26'
agent: consistency-reviewer
prod_touched: false
# ── v2.0 机器计数 ──
blocker_count: 0
deviation_count: 0
deviation_critical_count: 0
design_gap_count: 6
design_gap_reviewed_count: 6
code_map_new_files_count: 2
code_map_reviewed_count: 2
# ── 成对声明（批 E 跨文件聚合面）──
design_gaps:
- id: DG1
  text: >-
    P2 `:107` 称 `MarkdownViewer.vue` 需「删除 defineEmits 里无用的 select-heading（父侧 @select-heading 一并删）」，
    但现仓 `MarkdownViewer.vue` 的 defineEmits（`:27-30`）只有 headings 与 navigate-file，从来不存在 select-heading；
    该 emit 只出现在父侧 `EntryDetailContent.vue:56` 的监听上（监听一个不存在的 emit，是无效绑定而非死 emit）。
    本批按「不改 MarkdownViewer.vue」处置；父侧的无效绑定在 detail-navigation 批一并删除。
- id: DG2
  text: >-
    P2 `:191` 的数据流把「EntryDetailContent 透传 @headings」与「EntryDetailView 调 setTocHeadings()」写成
    A 组（detail-outline）的落点，但 P2 `dispatch_plan`（`:859`）把这两个文件划给 detail-navigation 批。
    本批严格执行 dispatch_plan 的文件边界，因此本批产出的 setTocHeadings() 暂无消费者；接线以「跨批阻断缺口」
    节写明确切落点，交 detail-navigation 批闭环。
- id: DG3
  text: >-
    P2 只规定 normalizeFileQuery 的纯函数形态与 View 内时机表，未规定实现落点；为守住既有 t082 行数契约
    （EntryDetailView<300 / entryDetail.ts<150），把 URL 同步与 TOC 自动展开抽到新建
    composables/useEntryDetailUrlSync.ts，纯函数与非纯逻辑仍分层（default-file.ts 无 Vue 依赖）。
- id: DG4
  text: >-
    P2 D3 字面写「只要 fileId 命中就用预取的 content」，未覆盖 loadEntry 的预取 id 与最终 targetFile 不一致的情形；
    实现中加 targetFile.id === fileId 守卫，否则 ?file= 指向 A 时正文会错显 B。
- id: DG5
  text: >-
    P2 D5 的 handleFullscreen 伪码用 {...route.query} 手拼，与本批 normalizeFileQuery 双源；
    实现改为复用 normalizeFileQuery（P2 文字本身已建议复用，此处仅记录伪码与实现的形态差异）。
- id: DG6
  text: >-
    C2 修复未照抄评审建议的 re.search（取首个匹配），改为 re.finditer 取 matches[-1]——因原实现 rfind 语义是
    「最后一个 </body>」，照抄 search 会把正文含字面 </body> 的场景从「插错位」变成「插错位置且行为改变」。
design_gap_reviews:
- gap: DG1
  verdict: accepted
  checked_against:
  - P2 §B 前端改动表 :107
  - P4-implementation.md :262,:335
  - 源码 frontend-v3/src/components/MarkdownViewer.vue:27-30
  - 源码 frontend-v3/src/components/EntryDetailContent.vue:56,:187
  - git log -S 'select-heading'
  basis: in_bdd
- gap: DG2
  verdict: accepted
  checked_against:
  - P2 :191
  - P2 dispatch_plan :859
  - P4-implementation.md 「跨批阻断缺口」:308-331
  - 源码 frontend-v3/src/views/EntryDetailView.vue:81,:177
  basis: in_bdd
- gap: DG3
  verdict: accepted
  checked_against:
  - P2 D4 :305-332
  - frontend-v3/src/components/t082-error-format.spec.ts:15
  - frontend-v3/src/stores/t082-store-split.spec.ts:71
  - wc -l 实测 EntryDetailView.vue=295 / entryDetail.ts=145
  basis: in_bdd
- gap: DG4
  verdict: accepted
  checked_against:
  - P2 D3 :302
  - 源码 frontend-v3/src/stores/entryDetail.ts:55
  - .agate-tmp/p7-dg4-probe.py 实测
  basis: in_bdd
- gap: DG5
  verdict: accepted
  checked_against:
  - P2 D5 :355-358
  - 源码 frontend-v3/src/composables/useEntryDetailUrlSync.ts:44-47
  basis: in_bdd
- gap: DG6
  verdict: accepted
  checked_against:
  - P4-review.md §3-C2 :100-102, §6 :225
  - 源码 backend/peekview/api/files.py:459
  - python3 实测 len('İ'.lower())==2
  basis: in_bdd
scope_plus:
- id: SP1
  text: >-
    EntryDetailView.vue 原 :244 的 router.replace({query:{}}) 不只误删 file/share，也承担「消费 firstFileId」；
    白名单化后该职责移到 syncUrl()（每个出口都调它），故路由参数在切换 slug 时也会被归一
    （P2 时机表未覆盖跨 entry 导航，属必要连带）。
- id: SP2
  text: >-
    M2 复现中发现的「同 entry 两份同名 sibling」形态：根因是存储层同名覆盖（磁盘仅 1 个文件），非 owners 缺陷；
    报表 inlined 与事实一致。修复需改 entry 写入命名策略，超出 P1 范围，未在 P4 处置。
scope_resolved:
- id: SP1
  note: >-
    已实现并核验（非范围外）。P2 D4 时机表仅列「首次加载/加载后归一/一次性清理/页内切换/刷新」五行，确无跨 entry 导航行；
    syncUrl() 在 onMounted:247 与 watch(props.slug):266 两个出口均被调用，watch(activeFile.id) 亦调它 ⇒ 全部出口归一。
    与 BDD-22（share 保留）、BDD-19/20（页内同步）、BDD-51（firstFileId 清理）一致，未改任何 BDD 判据 ⇒ 无需增补 P1 基线。
- id: SP2
  note: >-
    确属 P1 范围外，且应登记技术债（判据 2：不威胁本次验收真实性，但抬高未来变更成本）。见正文 §2 SCOPE+ 闭环。
findings:
- id: F1
  severity: warning
  text: >-
    SP2「同 entry 两份同名 sibling」应登记技术债而非静默留白。独立复现证明后果不止「文件名重复」：
    磁盘仅 1 个 app.css（48 B，后者覆盖前者），两条 DB 记录读回同一份 PNG 内容，且 render 响应实际产出
    <style>/* injected from: app.css */\n<PNG 二进制></style> —— 文本 CSS 位置被二进制垃圾填充。
    未使任何 BDD 假绿（BDD-40② 的「未内联项可查」成立：id=3 已记 not_injectable），故不威胁本次验收。
  status: open
- id: F2
  severity: warning
  text: >-
    P4 §6（:684）「报表 inlined 与事实一致」表述在**计数/原因层**准确，但未点出**内容层**失真：
    响应体内联的是被覆盖后的二进制内容。措辞建议在登记 DEBT 时一并写明（否则后续读者会以为该形态完全无害）。
  status: open
- id: F3
  severity: warning
  text: >-
    P4 第 3 批 detail-navigation 缺「### 新增文件核对表」节，而该批实际新建 3 个文件
    （useEntryDetailUrlSync.ts / utils/default-file.ts / utils/__tests__/default-file.spec.ts）。
    第 1/2/4 批均有该表。因项目未采用 CODE-MAP 机制（agents/CODE-MAP.md 不存在）不构成 gate 失败，但属 P4 自身完备性缺口。
  status: open
- id: F4
  severity: warning
  text: >-
    P2 §133 声明的单测产物部分未落地：utils/__tests__/file-bytes.spec.ts 不存在（全仓无任何测试直接引 utils/file-bytes）；
    TreeView.spec.ts 无 size prop 用例；HtmlViewer.spec.ts 既有 31 处 mount 均不传 file prop。
    resolveFileSize 的回退分支仅经默认 props 隐式覆盖，无显式断言。BDD-42/43/44 本身由
    components/__tests__/tpv0104-real-file-bytes.spec.ts（7 例）覆盖 ⇒ 判据无缺口，仅 P2 声明与产物不齐。
  status: open
- id: F5
  severity: warning
  text: >-
    {AGATE_WORKSPACE}/decisions/ 不存在（工作区仅 agents/project.md），故本任务产生的跨任务架构决策无落点：
    ①render 超限反馈采用「机读 JSON 清单」而非可见 UI（P2 :617/:882 显式登记待裁）；
    ②requested - inlined == len(skipped) 势不变式与 skipped[] 逐项上限不可兼得（P4 §5 M1 决策 C 的直接结论）。
    项目侧另存在 docs/decisions/（3 条，均与本任务无关）。落点选择交主 Agent。
  status: open
- id: F6
  severity: note
  text: >-
    known-failures.md 未按 P6.5 §2 建议补逐 case 名称清单（三 legacy e2e spec 共 32 条失败）。
    P6.5 判其为 WARNING 且明确「不阻断」，转 P7/运营；本条不改变 BDD-50 判定。
  status: open
- id: F7
  severity: note
  text: >-
    :8888/:8890 仍是 P4 修复前进程（本次实测三端口 :8888/:8890/:8893 均在 LISTEN，其中 :8893 为新代码）。
    后续任何再取证必须走 :8893，否则会复现 filename:null 的旧行为（P6.5 §8 遗留项 2 的确认）。
  status: open
code_map:
- file: frontend-v3/src/utils/file-bytes.ts
  status: exempt
  reason: 项目未采用 CODE-MAP 机制（agate-workspace/agents/CODE-MAP.md 不存在），P4 标 CODE_MAP_EXEMPT
- file: docs/architecture/html-preview-security-modes.md
  status: exempt
  reason: 项目未采用 CODE-MAP 机制，P4 标 CODE_MAP_EXEMPT
code_map_reviewed:
- file: frontend-v3/src/utils/file-bytes.ts
- file: docs/architecture/html-preview-security-modes.md
---

# P7-consistency — TPV0104 Viewer 正确性与资源边界加固

**BLOCKER: 0**　**CRITICAL: 0**

> 跨文件一致性审查结论：**通过**。6 条 `[DESIGN_GAP]` 全部转抄并逐条配 `[DESIGN_GAP_REVIEWED]`（6/6，裁定均 accepted，无一条需退回）；
> 2 条真实 `[SCOPE+]` 均已闭环（1 条已实现 / 1 条确属范围外且应登记技术债）。
> 7 项 WARNING/NOTE 均为口径完备性与运营项，全部**不阻断**，逐条给了处置建议。

[PROD_NOT_TOUCHED] 全程未接触生产 `:8080`（实测 `curl --max-time 5` → **code=000 / exit 28 超时**，未监听）、
未读写 `~/.peekview/`（`stat` mtime 仍为 **2026-11-12 12:40:31**，与 P6.5 记录一致）、未跑任何 CLI 写命令、
未改实现代码与测试、未动 `frontend-v3/e2e/tpv0104-viewer-hardening.spec.ts`、未改 `P1-requirements.md`、未 commit。
自建探针全部落在 `.agate-tmp/`（`p7-m2-independent.py` / `p7-m2-detail.py` / `p7-dg4-probe.py` / `p7-verify-storage-overwrite.py`），
不必要的旧实例 `:8888`/`:8890` **零使用**（仅端口探测）；新代码只读探测走 `:8893`。

---

## 0. 本任务 gate 路径的实测判定（影响 P7 产出的合法形态）

```text
$ python3 -c "import agate_common as ac; print(ac.task_level('.../TPV0104-viewer-correctness-results...'))"
level: 2
```

`task_level=2`（非 legacy）⇒ `check-gate.py P7` 走 **`_gate_p7_structured`**（成对声明聚合判据），
**不是** frontmatter 标量路径。这决定了本文件的形态：

| 结构化判据（实测源码 `check-gate.py:1885-2044`） | 本文件对应 |
|---|---|
| `design_gaps` id 集合 == `design_gap_reviews` 的 `gap` 集合 | DG1–DG6 ↔ 6 条 review，集合相等 |
| P4 散文 `[DESIGN_GAP:` 数（实测 **6**）≤ review 数 | 6 ≤ 6 ✅ |
| 每条 review 必含 `checked_against`（非空）+ `basis ∈ {in_bdd, out_of_scope, followup:DEBT<n>}` + `verdict ∈ {accepted, rejected, followup}` | 6 条均齐备 |
| `scope_plus` id ⊆ `scope_resolved` id | SP1/SP2 ↔ SP1/SP2 |
| `code_map` 集合 == `code_map_reviewed` 集合 | 2 ↔ 2 |
| 正文行首 `[BLOCKER]` / `[DEVIATION-CRITICAL]` 绊线 = 0 | 本文件零处（行首总结用无括号形式） |
| `need_confirm` 无 open 项 | 本任务无 need_confirm 声明 |

> **`basis` 一律取 `in_bdd` 而非 `followup:DEBT<n>` 的理由**：后者要求 `tech-debt.md` 内**已存在**该 DEBT 且
> `source_ref` 回指 `TPV0104:DGn`（`check-gate.py:1990-2016` 双向绑定）。DEBT 登记属主 Agent 动作（见 §2），
> 在登记完成前用 `followup:` 会让 gate 报「DEBT 条目不存在」。

---

## 1. DESIGN_GAP 配对（6/6，gate 硬性要求项）

逐条转抄 P4 原文 + 独立裁定。**核查手段**：源码实读 + `git log -S` 起源追溯 + 进程内临时 app 实测；**未复用** P4/P4-review 的自建脚本。

### [`DESIGN_GAP_REVIEWED: DG1` — **合理（accepted）**] P2 `:107` 的 `select-heading` 描述与现仓不符

**P4 原文（`P4-implementation.md:335`）**：
> P2 `:107` 称 `MarkdownViewer.vue` 需「删除 `defineEmits` 里无用的 `select-heading`（父侧 `@select-heading` 一并删）」，但现仓 `MarkdownViewer.vue` 的 `defineEmits`（`:27-30`）只有 `headings` 与 `navigate-file`，从来不存在 `select-heading` —— 该 emit 只出现在父侧 `EntryDetailContent.vue:56` 的监听上（监听一个不存在的 emit，是无效绑定而非死 emit）。本批按「不改 `MarkdownViewer.vue`」处置；父侧的无效绑定按上节改法在 `detail-navigation` 批一并删除。

**我的独立核查**：

| 核查项 | 命令/位置 | 结果 |
|---|---|---|
| `MarkdownViewer.vue` 现状 emits | `MarkdownViewer.vue:26-30` | 只有 `headings` 与 `'navigate-file'` —— **确实无 `select-heading`** |
| 该 emit 是否曾存在于本文件 | `git log -S 'select-heading' -- frontend-v3/src/components/MarkdownViewer.vue` | **零提交命中**（该文件的完整历史里从未出现） |
| 它出现在哪 | `git grep -n 'select-heading' <commit> -- frontend-v3/src` | 只在 `EntryDetailView.vue:94`（`bcf6a71e` 单体版，已重构掉）与 `EntryDetailContent.vue:47`（`59ab6f7e`） |
| 父侧无效绑定是否已删 | `EntryDetailContent.vue:56` | ✅ 已改为 `@headings="$emit('toc-headings', $event)"`，`@select-heading` 与 `:headings` 均已删 |
| 本批是否真的没动该文件 | `git diff --stat de03b466^..HEAD -- MarkdownViewer.vue` | **空**（未改动） |

**裁定**：**accepted（合理）**。P2 `:107` 的描述建立在「该 emit 存在于 `MarkdownViewer`」这一失实前提上，
但**结论无实质损失**：真正需要删的无效绑定（父侧监听一个不存在的 emit）确实存在且已被删除。
逐字照抄 P2 会去「删一个不存在的东西」（no-op，无害）；P4 选择「核查后按现状处置 + 把真实缺陷点在的父侧绑定一并清掉」，
是**比照抄更忠实于设计意图**的处置。**无需退回 P2/P4，也无需增补 P1 基线**——BDD-01~05 的判据是
「TOC 条目与正文锚点同源、可比对」，与该 emit 存废正交，实测 6 例全绿。

### [`DESIGN_GAP_REVIEWED: DG2` — **合理（accepted），且跨批缺口已闭环**] P2 `:191` 数据流横跨两个批次

**P4 原文（`:337`）**：
> P2 `:191` 的数据流把「`EntryDetailContent` 透传 `@headings`」与「`EntryDetailView` 调 `setTocHeadings()`」写成 A 组（`detail-outline`）的落点，但 P2 `dispatch_plan`（`:859`）把这两个文件划给 `detail-navigation` 批。本批严格执行 `dispatch_plan` 的文件边界…因此本批产出的 `setTocHeadings()` **暂无消费者**；接线以「跨批阻断缺口」节写明确切落点，交 `detail-navigation` 批闭环。

**我的独立核查**：

| 核查项 | 位置 | 结果 |
|---|---|---|
| P2 `:191` 是否确实这样写 | `P2-design.md:191` | ✅ 原文即 `MarkdownViewer → EntryDetailContent 透传 @headings → EntryDetailView 调 setTocHeadings()` |
| P2 `:859` 的批次归属 | `P2-design.md:859-860` | ✅ `detail-outline` 只含 4 文件；`EntryDetailContent.vue`/`EntryDetailView.vue` 确在 `detail-navigation`（`:860`） |
| P2 是否早已预期此处置 | `P2-design.md:866` | ✅ 明写「通过**显式接口契约**（`tocHeadings: Ref<TocHeading[]>` + `setTocHeadings(list)`）解耦，串行执行消除类型缺口窗口」 |
| 缺口是否真的闭合 | `grep -rn 'setTocHeadings\|toc-headings\|@headings'` | ✅ 三处齐：`EntryDetailContent.vue:56` 转发 + `:187` 声明 emit；`EntryDetailView.vue:81` 接收 + `:177` 解构导入 |

**裁定**：**accepted（合理）**。这是**设计内部的两处陈述互相矛盾**（`:191` 的数据流落点 vs `dispatch_plan` 的文件边界），
P4 选择服从 `dispatch_plan`（可并行执行、文件边界无重叠）并把接线落点写成 5 步可照做的清单，是正确取舍。
**关键判断**：若只看到 `setTocHeadings()` 无人调用就结束，会造成 E2E 的 TOC 类 BDD 全红而 **vitest 全绿**（`t031`/`t067` 整体 mock 了该 composable）——
P4 显式标为「⛔ 跨批阻断缺口」并要求主 Agent 裁决，**正是这个申报动作避免了假绿**。实际已由 `detail-navigation` 批按清单接上，实测闭环。

### [`DESIGN_GAP_REVIEWED: DG3` — **合理（accepted），且是唯一能同时满足契约的落点**] 新增 composable `useEntryDetailUrlSync.ts`

**P4 原文（`:508`）**：
> P2 只规定 `normalizeFileQuery` 的纯函数形态与 View 内时机表，未规定实现落点；为守住既有 t082 行数契约（`EntryDetailView<300` / `entryDetail.ts<150`），我把 URL 同步与 TOC 自动展开抽到新建 `composables/useEntryDetailUrlSync.ts`，纯函数与非纯逻辑仍分层（`default-file.ts` 无 Vue 依赖）。

**我的独立核查**：

| 核查项 | 命令 | 结果 |
|---|---|---|
| P2 是否真的没定落点 | `P2-design.md:320` | ✅ 原文「放在 `src/utils/default-file.ts`（与 resolver 同文件）**或新建** `src/utils/file-query.ts`」——**给了两个候选但未定**，且都指 `utils/` 而非 `composables/` |
| 行数契约是否真实存在 | `t082-error-format.spec.ts:14-15` / `t082-store-split.spec.ts:70-71` | ✅ `expect(lineCount).toBeLessThan(300)` / `< 150`，均为**既有**契约 |
| 契约是否被守住 | `wc -l` | ✅ `EntryDetailView.vue` **295** < 300；`entryDetail.ts` **145** < 150 |
| 改动前行数 | `git show 4ec6b1b6^:...` | 289 / 147 —— 两者都只剩 **4/5 行**余量 |
| 分层是否真的保持 | `default-file.ts` import | ✅ 只 import `type {/* vue-router */}` + `type { File }`，**零 Vue 运行时依赖**；Vue 依赖全在 composable |

**裁定**：**accepted（合理），且判断为「不改既有契约的唯一可行解」**。P2 给的候选都是 `utils/` 纯函数层，
但 URL 同步需要 `watch` + `router` + `ref`（P2 `:331` 自己写明 `suppressUrlSync` 是「组件内 `ref`、未导出」）——
放 `utils/` 会违反「`default-file.ts` 无 Vue 依赖」这一 P2 自己的分层原则。在 View 只有 4 行余量的前提下，
抽 composable 是**同时**满足「P2 分层原则 + t082 行数契约」的唯一形状。
唯一可议之处：P2 `:320` 把落点候选指向 `utils/`，P4 落到 `composables/` 属**目录语义更正确但字面更远**的选择。
代价是新增了一个**生产代码文件**（P2 文件面未列），已由本文件 §5 的 CODE_MAP/新增文件节覆盖。

### [`DESIGN_GAP_REVIEWED: DG4` — **合理（accepted），但属防御性守卫：所述失效形态当前不可达**] `targetFile.id === fileId` 守卫

**P4 原文（`:509`）**：
> P2 D3 字面写「只要 fileId 命中就用预取的 content」，未覆盖 `loadEntry` 的预取 id 与最终 `targetFile` 不一致的情形；实现中加 `targetFile.id === fileId` 守卫，否则 `?file=` 指向 A 时正文会错显 B。

**我的独立核查**（`.agate-tmp/p7-dg4-probe.py`，进程内临时 app）：

```text
A files: [(1,'README.md'), (2,'other.md')]      B files: [(3,'README.md'), (4,'z.md')]
跨 entry id=3 -> 404 ;  id=4 -> 404              ← content 恒 null
不存在 id=999999 -> 404 ;  id=0（前端 fileId??0 回退）-> 404 ;  id=-1 -> 404 ;  id=abc -> 422
A 自己的 id=1 -> 200 '# A readme' ;  id=2 -> 200 '# A other'
```

**结论**：`api.getFileContent(slug, fileId).catch(() => null)` 在所有**不可达 id**（跨 entry / 不存在 / 0 / 负数）形态下都返回 `null`，
因此 `content != null` 蕴含「该 id 在本 entry 内真实存在」⇒ `entry.files.find(f => f.id === fileId)` 必然命中
（`get_entry` 返回**全量** `files`，实测无裁剪）。**即 P4 所述「`?file=` 指向 A 却展示 B」在当前代码中不可复现**。

**行为等价性核查**：守卫不引入多余请求——`content != null && ids 相等` → 直接用（0 额外请求，与旧代码同）；
`content == null` → 走 `else if` 分支取 `targetFile` 内容（与旧代码同）。**唯一差异只在不可达分支**。

**裁定**：**accepted（合理）**。P4 把「潜在契约歧义」写成了「已发生缺陷」，措辞偏强（`否则…错显 B` 应作「否则一旦将来
`getEntry` 对 `files` 做裁剪就会错显」），但**实现选择本身正确且零成本**：守卫是廉价的失效关闭（fail-closed），
在 share/team 可见性将来可能裁剪 `files` 的演进下是必要的。**不构成需要退回的问题**，仅在此改正因果表述，
避免后续读者误以为该缺陷曾被实测复现。

### [`DESIGN_GAP_REVIEWED: DG5` — **合理（accepted），实现严格优于伪码**] `handleFullscreen` 复用 `normalizeFileQuery`

**P4 原文（`:510`）**：
> P2 D5 的 `handleFullscreen` 伪码用 `{...route.query}` 手拼，与本批 `normalizeFileQuery` 双源；实现改为复用 `normalizeFileQuery`（P2 文字本身已建议复用，此处仅记录伪码与实现的形态差异）。

**我的独立核查**：

| 核查项 | 位置 | 结果 |
|---|---|---|
| P2 伪码确实手拼 | `P2-design.md:356-358` | ✅ `const query = { ...route.query }` + `if (isDefault) delete query.file; else query.file = String(...)` |
| 实现是否复用 | `useEntryDetailUrlSync.ts:44-47` | ✅ `router.push({ path: '/${slug}/f', query: normalizedQuery() })` |
| 两者差异 | 对比 | 实现**额外**经 `normalizedQuery()` 删 `firstFileId`（`:34`）——伪码不删 |
| 该额外差异是否合规 | P2 D4 `:311` + BDD-51 | ✅ P2 明令「一次性参数清理：**只删 `firstFileId`**」；BDD-51 要求旧 `?firstFileId=` 被清理 |

**裁定**：**accepted（合理），且实现比伪码更正确**。伪码 `{...route.query}` 会把 `firstFileId` 原样带进 `/f` URL，
与 P2 D4 `:311` 的白名单清理规则直接冲突（BDD-51 在这种情况下会红）。P4 选择单源 `normalizeFileQuery` 同时解决了
「双源漂移」与「`firstFileId` 泄漏」两个问题，且 P2 正文（`:320`「把上面『按 activeFile 归一 query』的规则抽成**纯函数**」）
本就倾向复用。**无任何退回理由。**

### [`DESIGN_GAP_REVIEWED: DG6` — **合理（accepted），且 P4 对评审建议的偏离经评审自认正确**] `re.finditer(...)[-1]` 而非 `re.search`

**P4 原文（`:735`）**：
> C2 修复未照抄评审建议的 `re.search`（取首个匹配），改为 `re.finditer` 取 `matches[-1]`——因原实现 `rfind` 语义是「最后一个 `</body>`」，照抄 `search` 会把 §3-4 已登记的 MINOR（正文含字面 `</body>`）从「插错位」变成「插错位置且行为改变」。根因（`lower()` 变形致下标偏移）已按评审处方消除。

**我的独立核查**：

| 核查项 | 命令/位置 | 结果 |
|---|---|---|
| 现实现 | `api/files.py:459` | ✅ `matches = list(re.finditer(r"</body\s*>", html, re.IGNORECASE))` → `idx = matches[-1].start()` |
| 根因是否真实 | `python3 -c "print(len('İ'), len('İ'.lower()))"` | ✅ **1 → 2**（U+0130 小写化为 `i`+U+0307，**非保长**）⇒ 在 `lower()` 上取下标而切原串必然错位 |
| 是否已消除 | 同上代码 | ✅ 匹配在**原始串**上做，`idx` 与切片对象同源 |
| 「取末个」是否确为原语义 | `P4-review.md:100-102` | ✅ 评审自述「原实现 `html.lower().rfind(marker)` 的语义是**最后**一个」 |
| 评审是否认同此偏离 | `P4-review.md:225` | ✅ 评审自评「**偏离正确，我上轮建议有缺陷**」——`search` 取首个会把字面 `</body>` 场景从「插错位」变成「插错位置且静默改变行为」 |
| 变体覆盖 | `regex` | ✅ `\s*` 覆盖 `</body >`，`IGNORECASE` 覆盖 `</BODY>`（P4 报 7 形态单测） |

**裁定**：**accepted（合理），且这是本轮 3 处「偏离评审建议」中**唯一**被评审明确自认为「原建议有缺陷」的一处**。
P4 在此做了正确的**独立技术判断**而非服从权威：`rfind` 的「最后一个」语义是**既有行为契约**，
照抄 `re.search` 会在修复根因的同时**改变行为**（把一条已接受的 MINOR 升级为行为变更，且是静默的）。
`finditer[-1]` 是唯一同时满足「消除根因」与「保持既有语义」的实现。**无退回理由。**

### 6 条配对小计

| # | P4 位置 | 主题 | 裁定 | 我的独立核查手段 | 是否需退回 |
|---|---|---|---|---|---|
| DG1 | `:335` | `select-heading` 描述失实 | accepted | `git log -S` 全史追溯 + 源码实读 | 否 |
| DG2 | `:337` | 数据流横跨批次 | accepted（已闭环） | 三处接线 grep + P2 `:866` 预期待核对 | 否 |
| DG3 | `:508` | 落点抽到新 composable | accepted（唯一可行解） | `wc -l` + t082 契约实读 + 改动前行数 | 否 |
| DG4 | `:509` | `targetFile.id === fileId` 守卫 | accepted（防御性，形态不可达） | 进程内 app 穷举 7 种 id 形态 | 否（附措辞更正） |
| DG5 | `:510` | 复用 `normalizeFileQuery` | accepted（优于伪码） | 伪码 vs 实现逐行对比 + BDD-51 交叉 | 否 |
| DG6 | `:735` | `finditer[-1]` vs `search` | accepted（评审自认原建议缺陷） | U+0130 变形实测 + 评审 §6 自评核对 | 否 |

**结论**：6/6 `accepted`，**零条需退回**。所有 6 条都不是「实现层擅自改设计」，而是
①设计陈述与现仓不符（DG1）、②设计内部两处自相矛盾（DG2）、③设计留白（DG3/DG4/DG5）、④设计/评审处方有缺陷（DG6）——
**四类共性是「P2/P4-review 的不完备」，P4 的处置方向全部正确**。

---

## 2. SCOPE+ 闭环（2/2）

### SP1（`P4-implementation.md:512`）— **已实现，必要连带，无需增补基线**

**P4 原文转抄**：
> 发现 `EntryDetailView.vue` 原 `:244` 的 `router.replace({query:{}})` 不只误删 file/share，也承担「消费 firstFileId」；白名单化后该职责移到 `syncUrl()`（每个出口都调它），故路由参数在切换 slug 时也会被归一（P2 时机表未覆盖跨 entry 导航，属必要连带）。

**独立核查**：

| 核查项 | 位置 | 结果 |
|---|---|---|
| 原 `:244` 确实是 `{query:{}}` 一锅端 | `git show 4ec6b1b6^:EntryDetailView.vue` | ✅ `if (firstFileId || shareToken) router.replace({ path: route.path, query: {} })` |
| `syncUrl()` 是否覆盖「每个出口」 | `EntryDetailView.vue:247`（onMounted）、`:266`（`watch(props.slug)`） | ✅ 两个出口都调 |
| 第三出口（页内切换） | `useEntryDetailUrlSync.ts:49-52` | ✅ `watch(activeFile.id)` 内调 `syncUrl()` |
| 第四个出口（全屏） | `useEntryDetailUrlSync.ts:44-47` | ✅ `handleFullscreen` 走 `normalizedQuery()` |
| P2 时机表确实漏了「跨 entry」 | `P2-design.md:307-313` | ✅ 仅 5 行：首次加载 / 加载后归一 / 一次性清理 / 页内切换 / 刷新 —— **无 slug 切换** |
| 是否与既有 BDD 冲突 | BDD-22 / BDD-19 / BDD-20 / BDD-51 | ✅ `normalizeFileQuery` 恒保留非 `file` 键（`:47` `{...query}` + 仅 `delete next.file`）⇒ `share` 不丢；`firstFileId` 被 `:34` 删 |

**处置状态**：**已实现（`syncUrl()` 在每个出口调用，含 slug 切换）**。

**是否需「待纳入 P1 基线」**：**不需要**。理由：① 该连带不改任何 BDD 的 Then 语义——BDD-22 要求 `share` 保留（满足）、
BDD-20 要求默认文件删 `file`（满足）、BDD-51 要求 `firstFileId` 被清理（满足）；② 它把 P2 时机表的**覆盖缺口**补成
「与既有规则一致」而非引入新规则；③ P1 是新需求基线（记录「系统应当做什么」），「P2 时机表少了第 6 行」是实现层完备性问题，
不属于基线增补。**建议**：若主 Agent 认为需留痕，可在 P8 的 `CHANGELOG` 里以「切换 entry 时 URL 参数一并归一」一句带过。

### SP2（`P4-implementation.md:737`）— **确属范围外，且应登记技术债**

**P4 原文转抄**：
> M2 复现中发现的「同 entry 两份同名 sibling」形态：根因是**存储层同名覆盖**（磁盘仅 1 个文件），非 `owners` 缺陷；报表 `inlined` 与事实一致。修复需改 entry 写入命名策略，超出 P1 范围，未在 P4 处置。

#### 判断一：根因确为存储层，不是 `owners` 缺陷 —— **成立**

我用**自建**探针（`.agate-tmp/p7-m2-independent.py`，未复用 P4 的 `m2-http-proof.py`）复现：

```text
create -> 201
DB 记录: [(1,'index.html',False), (2,'app.css',False), (3,'app.css',True)]     ← DB 保留两行
① 每条记录读回: id=2 head=b'\x89PNG\r\n\x1a\nzzzz...'   id=3 head=b'\x89PNG\r\n\x1a\nzzzz...'   ← 两条读到同一份
② 磁盘实际文件: 2 个 → data/default/1/app.css(48B) / data/default/1/index.html(87B)
   ⇒ 两个 app.css 只落 1 个文件
```

机制实读确认（`storage.py:36` `get_disk_path` 的 `:63-69` 段 → `rel_path = file_path or filename` → `target = (base / rel_path).resolve()` → `write_file_atomic`）：
**落盘路径只由 `path or filename` 决定，与 `File.id` 无关** ⇒ 同 entry 同 `path`/`filename` 必然写同一路径、后写覆盖前写。
`_mark_text` / `_mark_binary` 拆分（`html_render_service.py:210-223`，消费点 `:232` / `:255`）确实**修好了 `owners` 侧的计数缺陷**，但无法修存储层。

#### 判断二：它**确实超出 P1 范围**

P1 有两处硬约束指向范围外：
- `P1-requirements.md:59`「**明确不做**（P0 已定，P1 不改）：… 不做**文件版本管理/跨实例稳定文件身份**」——
  「同 entry 同名 sibling 各自保留内容」正是要求文件身份稳定，与这条正面冲突。
- `P1-requirements.md:528` 划定 `packages: [peekview, frontend-v3, docs]`，且 8 项缺陷（V-01~V-08）中无一项涉及
  entry 写入命名策略；全仓无任何 BDD 断言「同名 sibling 内容各自独立」（我逐条核过 BDD-38~40，只断言
  「未内联的每一个都可查」，不断言「同名不同内容可区分」）。

⇒ **修它需要改 entry 写入路径的命名策略（如 `<id>_<filename>` 或内容寻址），属 schema/存储契约变更，超出本任务基线。**

#### 判断三：**应当登记技术债**（而非「无需处理」）

用 `tech-debt.md` 的三分法判据逐条过（`agate-workspace/debt/tech-debt.md:7-13`）：

| 判据 | 是否命中 | 依据 |
|---|---|---|
| **判据 1**：不修它，当前任务的验收声明会不会变成假的？ | **不命中** | BDD-40② 要求「未内联的每一个都必须在清单或错误体中可查」。实测报表 `requested=2 inlined=1 skipped=[{file_id:3, reason:not_injectable}]`，**id=3 有记录**、势不变式 `2-1==1` 成立 ⇒ 无「静默缺少且无记录」⇒ **无假绿** |
| **判据 2**：会不会让未来变更更贵 / 更危险？ | **命中** | 见下 |
| 判据 3：都不影响 → 不登记 | — | 判据 2 已命中，不走此出口 |

**判据 2 命中的实证 —— 后果不止「文件名重复」，会污染渲染输出**：
我用第二条自建探针（`.agate-tmp/p7-m2-detail.py`）读取真实 render 响应：

```text
response has <style> = True
style body repr = '/* injected from: app.css */\n�PNG\r\n\x1a\nzzzzzzzzzzzz...'
  contains .TEXT{color:red} = False        ← 文本 CSS 内容根本没进响应
```

即：`<link rel=stylesheet href="app.css">` 位置上产出的是**一个 `<style>` 标签内装着被覆盖后的 PNG 二进制**。
这是**静默产出语义错误的 HTML**（浏览器解析为无效 CSS 声明、整段丢弃），而报表 `inlined=1` 在计数上「诚实」
（确实有 1 个 sibling 进了响应体）—— **报表越「准确」，越说明这条路径的问题不在记账而在存储**。

**加固判据 2 的第二点（未来变更成本）**：任何后续改 `owners` / `consumed` / sibling 注入逻辑的人，
都会在一个「磁盘内容 ≠ DB 记录内容」的隐式前提下做推理。这正是一类**不在代码注释里、只在复现素材里**的陷阱——
P4 自己就踩过一次（先判 `owners` 缺陷，实测后才发现是存储层）。把它写进债务登记簿，是让下一个人**先读到前提**。

**结论与建议**：**登记技术债（`category: technical`，`priority: medium`）**，理由取判据 2。
建议 id **DEBT0022**（现登记簿最后一条为 `DEBT0021`，实测 `grep -c '^## DEBT'` = 18 条、最大编号 0021）。
标题建议：「entry 存储层按 `path or filename` 落盘，同 entry 同名 sibling 后写覆盖前写——DB 保留多行但内容同源，
可致 render 注入 `<style>` 内填二进制」。`closure_criteria` 建议：「同 entry 两个同名 sibling（一 text 一 binary）
落盘为 2 个文件、`GET .../files/<id>/content` 各自返回自身内容、render 注入的 `<style>` 内为文本 CSS」。

> **本 P7 未直接写入 `tech-debt.md`**：① 派发指引对本条的要求是「判断…写清你的判断依据」，判断已在上文给出；
> ② 编号分配与是否随 P8 一并落账属主 Agent 决策面（P7 卡的架构决策节明令「仅核对，不撰写正文」）；
> ③ 未经批准的共享文件写入会与 P8 的 `git add` 范围交叉。**待办已登记在 §7，供主 Agent 直接取用。**

### SCOPE+ 小计

| # | P4 位置 | 性质 | P4 处置 | 我的裁定 | P1 基线动作 |
|---|---|---|---|---|---|
| SP1 | `:512` | 实现时的**必要连带** | ✅ 已实现 | **闭环**（4 个出口全覆盖，与 BDD-22/19/20/51 无冲突） | 无需增补 |
| SP2 | `:737` | **范围外新发现** | ⛔ 未处置 | **确属范围外 → 登记技术债**（判据 2 命中，实测后果含渲染污染） | 无需增补（不构成新需求） |

**P1 无 `[SCOPE_RESOLVED]` 标记的处理**：实测 `grep -c SCOPE_RESOLVED P1-requirements.md` = **0**，与派发指引一致。
按指引**未改 P1**；两条的闭环结论改由本文件 frontmatter 的 `scope_resolved:` 结构化声明承载
（level-2 契约的 `scope_plus ⊆ scope_resolved` 判据由它满足）。
**本 P7 无需「待纳入 P1 基线」项** —— 逐条理由已写在 SP1/SP2 正文中。

---

## 3. 跨文件一致性核对表

### 3.1 BDD 数量：54 == 54 == 54（三方一致）

| 来源 | 命令 | 结果 |
|---|---|---|
| `P1-requirements.md`（基线） | `grep -cE '^#### BDD-[0-9]+'` | **54** |
| 同上，id 去重集大小 | `grep -oE '^#### BDD-[0-9]+' \| sort -u \| wc -l` | **54**（01–54 连续无洞） |
| `P6-acceptance.md` frontmatter `pass` | 实读 `:11` | **54**，`fail: 0` |
| `P6-acceptance.md` 正文 `^- PASS BDD-` | `grep -c` | **54**（`^- (FAIL\|PARTIAL\|SKIP\|BLOCKED) BDD-` 命中 0） |
| `P6-acceptance.md` `results[].bdd` 集合 | `grep -oE "bdd: '[0-9]+'"` | **54**，与 P1 集合**逐项相等** |
| `P6.5-judge-verdict.md` `criteria[].bdd` 集合 | `grep -oE 'bdd: BDD-[0-9]+'` | **54**，逐项相等；`criteria_total: 54 / criteria_passed: 54 / status: passed` |

⇒ **数量匹配且集合相等（不是「数量对但某条被错映射」的情况）**。集合比对是我做的独立动作——
逐 id 取集合并求差为空，排除了 P7 卡「常见错误 2」描述的情形。

### 3.2 P2 `packages` vs P8 bump 范围

| 核查项 | 事实 |
|---|---|
| P2 声明 | `P2-design.md:11-14`：`packages: [peekview, frontend-v3, docs]`（另有 `domains: [frontend, backend]`） |
| 版本源 | `VERSIONS.json`：`peekview: 0.27.1` / `mcp_server: 0.12.0` |
| `frontend-v3` 有无独立版本 | `frontend-v3/package.json:3` = `0.27.1`；`scripts/sync_versions.py:47` 把 frontend-v3 的 version 同步为 **peekview** 的值 ⇒ **无独立版本号，随 peekview** |
| `docs` | 无独立版本，随 peekview 的 `CHANGELOG.md` |
| `mcp_server` 是否在范围 | **不在**。`P1-requirements.md:528` 明写「MCP 包（`packages/mcp-server`）**不在范围内**（见 §6.2/§6.4 不处理判定）」；`P1:579` 对 `getEntry.ts:90` 的字符/字节范式判「不处理，建议登记 roadmap」 |
| 实际改动面是否越界 | `git diff --stat de03b466^..HEAD -- packages/` → **空**（MCP 零改动）✅ |
| P8 状态 | **无 `P8-release.md`（实测 `ls \| grep -i p8` 无输出）⇒ P8 未开始，bump 范围核对记「待办」** |

⇒ **P2 的 `packages` 与「实际改动面」一致（peekview + frontend-v3 + docs 三处）；与 P8 的 bump 范围核对记待办**。
**P8 应 bump 的只有 `peekview`**（`frontend-v3` 随 `sync_versions.py` 联动，`docs` 只进 CHANGELOG，`mcp_server` 不在范围）。
建议 P8 显式声明「本次不 bump `mcp_server`」的理由引用 `P1:528`，避免 CI 的版本一致性检查误判漏 bump。

### 3.3 P4 实现路径 vs P2 `dispatch_plan.batches[].output`

以 `git show --name-status 4ec6b1b6`（P4 提交本身，含 `agate-workspace` 外的全部代码文件）逐批比对，
并用 `git diff --name-status de03b466^..HEAD` 交叉核对全任务面：
`[PROD_TOUCHED]` 判据二：P4 的 4 个批 id 与 P2 `:23-67` 的 4 个 batch 一一对应，无增删批次。

| P2 批 id | P2 声明的 `output` | `4ec6b1b6`(P4) 实际改动 | 结论 |
|---|---|---|---|
| `backend-render-budget` | `html_render_service.py` / `api/files.py` / `entry_service.py` / `tests/test_html_render.py` / `tests/test_entry_file_order.py` / `docs/architecture/html-preview-security-modes.md`（6） | **5 个命中**；`tests/test_entry_file_order.py` 由 `de03b466`(P3) 创建（P2 `:868` 明定测试产物归 P3） | ✅ 吻合 |
| `detail-outline` | `useMarkdown.ts` / `useEntryDetailComputed.ts` / `MarkdownViewer.vue` / `TocNav.vue`（4） | **3 个命中**；`MarkdownViewer.vue` **未改**（=`DG1`，经核查为 no-op） | ✅ 吻合（差异已申报为 DG1） |
| `detail-navigation` | `utils/default-file.ts` / `stores/entryDetail.ts` / `EntryDetailView.vue` / `EntryDetailContent.vue` / `EntryDetailHeader.vue` / `EntryDetailMobileBar.vue` / `EntryCard.vue` / `EntryListRow.vue`（8） | **8 个全部命中** | ✅ 完全吻合 |
| `data-viewers` | `utils/file-bytes.ts` / `types/structured-data.ts` / `useCsvParser.ts` / `TableView.vue` / `TreeView.vue` / `HtmlViewer.vue`（6） | **6 个全部命中** | ✅ 完全吻合 |

**`4ec6b1b6`(P4) 改动 26 个代码文件 = 上表 22 个命中 + 1 个 P3 已建（不属 P4）+ 4 个下表越界项**（实测 `git show --name-only` 计数）：

**超出批次 `output` 的 4 处（均已申报或已核）**：

| 越界文件 | 归属 | 性质 | 裁定 |
|---|---|---|---|
| `frontend-v3/src/composables/useEntryDetailUrlSync.ts`（新） | `detail-navigation` | **已申报 DG3** | accept（见 DG3） |
| `frontend-v3/src/utils/__tests__/default-file.spec.ts`（新） | `detail-navigation` | P2 `:133` **已声明**该单测（「`src/utils/__tests__/default-file.spec.ts`」）；P4 `:438` 列为本批第 11 项 | accept（P2 已授权） |
| `frontend-v3/src/components/__tests__/t031-*.spec.ts`、`t067-*.spec.ts`（各 1 行改 mock） | — | P2 `:133` 明写「`t031`/`t067` 的 `extractHeadings: vi.fn()` mock 同步删除」 | accept（P2 已授权） |

**测试产物（不占 P4 批次，P2 `:868` 明定归 P3）**：`tpv0104-*` 系列 spec、2 个新 e2e spec、3 个 legacy spec 的
`firstFileId → file` 迁移，均由 `de03b466`(P3) 提交。**实测 legacy 三 spec 的 `firstFileId` 字面量计数均为 0** ✅（BDD-50 ①）。

⇒ **P4 实现路径与 P2 方案设计的吻合度高**：4 批共 **24 个声明文件，22 个精确命中**
（未命中的 2 个：`MarkdownViewer.vue` = DG1 的 no-op；`test_entry_file_order.py` = P2 `:868` 明定归 P3 的测试产物）；
P4 实际改动 26 个代码文件，除 22 个命中外，余下 4 个（1 个新增生产 composable + 1 个 P2 已声明的单测 + 2 个 P2 已授权的 mock 改行）
**全部有据**。

### 3.4 其他跨文件交叉核对

| 核查项 | 事实 | 结论 |
|---|---|---|
| P4 的 5 项缺陷修复是否落到最终代码 | `files.py:407` `len(data.content.encode("utf-8"))`（C1）、`:459` `finditer`（C2）、`html_render_service.py` `file_ids` 旁路（C3）、`files.py:310` `max_length=4096`（M1）、`text_owners`/`binary_owners`（M2） | ✅ 5/5 在 HEAD 代码中 |
| P2 冻结值是否被改动 | `html_render_service.py:18-20`：`_MAX_INJECT_IDS=40` / `_MAX_INJECT_FILE_BYTES=2 MiB` / `_MAX_INJECT_TOTAL_BYTES=8 MiB`；`REASONS` 六元 frozenset | ✅ 全部未变 |
| `skipped[]` 五字段 + `file_id` 必填 | `html_render_service.py:477-485` 构造处恰 5 键含 `file_id` | ✅ 与 P2 冻结 schema 一致 |
| P4 报的调用点数（「13 处 `inject_resources` / 8 处 `_process_css_refs` 零改动」） | `grep -c` 实测：`test_html_render.py` 内 **13** / **8** | ✅ 与声明完全一致 |
| P2-design 的 `[DESIGN_GAP_REVIEWED]` 留痕（`count_limit` 更正） | `P2-design.md:411` 存在 | ✅ 主 Agent 已在 P2 追加，本次复核读确认（内容与我 P6.5 认知一致） |
| `known-failures.md` 与 P6/P6.5 基线是否一致 | `known-failures.md` 登记 3 项预存失败（后端 1 / viewer.spec 18 / t091 14）+ 1 项基线计数瑕疵 B1 | ✅ 与 P6.5 §2 所述一致（仅缺逐 case 名单，见 F6） |
| P4 §8 的「`:8888` 跑旧代码」是否已解决 | P4 `:895-903` 曾标为「唯一未闭环项」；P6/P6.5 改用 `:8893` | ✅ 已由取证路径切换解决；`:8893` 本次实测 `HTTP 200` |
| 未提交的 e2e 证据路径改动是否合理 | `git diff` 显示 `EVIDENCE_DIR` 从相对 cwd 改为 `path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../agate-workspace/...')`，注释说明了 P5/P6 各踩一次的 `frontend-v3/agate-workspace/` 误落 | ✅ **合理且必要**（`make debug-test` 的 cwd 是 `frontend-v3/`）；按派发指引**未改动**，留待 P7 commit 一并提交 |

---

## 4. 未决项清零

| 核查项 | 命令 | 结果 |
|---|---|---|
| P1 行首 `[NEED_CONFIRM]` | `grep -nE '^\[(NEED_CONFIRM\|BLOCKER\|DEVIATION-CRITICAL)'` | **exit 1，零命中** ✅ |
| P1 全文 `NEED_CONFIRM`/`BLOCKER`/`DEVIATION-CRITICAL` 任意位置 | `grep -cE` | **2 处，均为 `[NO_NEED_CONFIRM]`**（`:41`、`:503`）—— 是「无待确认项」的**肯定声明**，非残留 |
| P6 `[NEED_CONFIRM]` | `grep -n` | **exit 1，零命中** ✅ |
| P6/P6.5 行首 `[BLOCKER]`/`[DEVIATION*]` | `grep -nE '^\[?(BLOCKER\|DEVIATION)'` | **exit 1，零命中** ✅ |
| P1 的 `[BASELINE_CHANGE]` | `grep -n` | **3 处**（`:376`、`:589`、`:592`），均为 P2 第 2 轮实测更正后的**已批准留痕**，非未决项 ✅ |

⇒ **未决项清零：P1 / P6 / P6.5 三处均无残留。**

> 附带核实：`P1:503` 的 `[NO_NEED_CONFIRM]` 与 P6.5 判 `passed` 互证——本轮唯一 FAIL（BDD-38 Then③）是
> **判据被实现层削弱**而非「需求不明」，故不表现为 `NEED_CONFIRM`，与「清零」不矛盾。

---

## 5. CODE-MAP 核对

**机制状态**：`{AGATE_WORKSPACE}/agents/CODE-MAP.md` **不存在**（实测 `ls agate-workspace/agents/` 只有 `project.md`）。
⇒ 按派发指引**记 WARNING 并跳过**逐条依赖方向核对。

**P4「新增文件核对表」实况**：

| P4 批次 | 有无该节 | 标记内容 |
|---|---|---|
| 第 1 批 `backend-render-budget` | ✅ `:227` | `docs/architecture/html-preview-security-modes.md` → `[CODE_MAP_EXEMPT: 项目未采用 CODE-MAP 机制]` |
| 第 2 批 `detail-outline` | ✅ `:394` | 「本批无新增文件」 |
| 第 3 批 `detail-navigation` | ❌ **缺失**（见 F3） | 该批实际新建 3 个文件（`useEntryDetailUrlSync.ts` / `default-file.ts` / `default-file.spec.ts`） |
| 第 4 批 `data-viewers` | ✅ `:102` | `frontend-v3/src/utils/file-bytes.ts` → `[CODE_MAP_EXEMPT: ...]` |
| 重试 #1 / #2 | 无新增文件 | — |

`[CODE_MAP_EXEMPT]` 标记总数实测 = **2**（`count_code_map_lines(P4-implementation.md)` = 2）⇒
本文件 frontmatter 的 `code_map_new_files_count: 2` / `code_map_reviewed_count: 2` 与之精确对应，集合相等。

**结论**：

| 判据 | 结果 |
|---|---|
| CODE-MAP 机制是否采用 | **未采用**（`agents/CODE-MAP.md` 不存在，亦无 `P2-skeleton.md`） |
| P4 gate 是否会因此 WARNING | **不会**——`check-gate.py:1272` 的判据是「`P2-skeleton.md` **或** `CODE-MAP.md` 存在」，两者皆无 ⇒ 整段跳过（本次实测无该 WARNING） |
| 依赖方向偏离 | **无法判定（机制缺失）**，记 WARNING，不阻断 |
| 是否有 `[CODE_MAP_DRIFT:]` | **0 条** |

**WARNING 记录**：`CODE_MAP_MISSING` —— 工作区未采用 CODE-MAP 机制，本任务新增 6 个生产/文档文件
（`file-bytes.ts` / `useEntryDetailUrlSync.ts` / `default-file.ts` / `html-preview-security-modes.md` / 2 个 spec 基座）
的依赖方向只能靠人工判断。**我的替代核对**（不依赖 CODE-MAP 机制，逐条核 import）：

| 新增文件 | import 方向 | 是否越层 |
|---|---|---|
| `utils/file-bytes.ts` | 零 import（纯函数） | ✅ 无依赖，最底层 |
| `utils/default-file.ts` | 仅 `type` import（`vue-router` + `@/types`） | ✅ 纯函数层，无 Vue 运行时依赖（符合 DG3 的分层声明） |
| `composables/useEntryDetailUrlSync.ts` | `vue` / `vue-router` / `@/utils/default-file` / `@/types` | ✅ `composables → utils`，方向正确（utils 不反向依赖 composables） |
| `docs/architecture/html-preview-security-modes.md` | 无（文档） | ✅ |

⇒ **替代核对下依赖方向全部正确**，`[CODE_MAP_DRIFT:]` = 0。

---

## 6. 架构决策落点核对

**`{AGATE_WORKSPACE}/decisions/` 不存在**（实测 `ls agate-workspace/` → `agents` / `archived` / `debt` / `plans` / `tasks`，
**无 `decisions`**）⇒ 按派发指引**记 WARNING 并跳过**。

**项目侧另有 `docs/decisions/`**（3 条，均与本任务无关）：

| 文件 | 标题 | 与本任务关系 |
|---|---|---|
| `health-check-200-vs-503.md` | Health Check 503 vs 200 | 无关 |
| `mcp-no-update-entry.md` | 为什么 MCP 不暴露 `updateEntry` | 无关 |
| `mcp-vs-cli-positioning.md` | MCP vs CLI+Skill 的定位 | 无关 |

**被本任务证伪的既有决策**：逐条核 `docs/decisions/` 三条 —— **无一条被本任务证伪**，故「已过时 + 被什么取代」
的标注动作**无适用对象**（不是「漏标」，是「无对象」）。P2-design 中被证伪的那条（`:410` 的 `count_limit`
`filename` 可为 `null`）属**设计文档内部判断**，已在 `P2-design.md:411` 就地追加 `[DESIGN_GAP_REVIEWED]` 更正留痕（未删除原文）✅
——这符合「就地标注而非删除」的要求。

**缺失落点（F5，待办）**：本任务产生的 2 条跨任务架构决策**无落点可写**，建议主 Agent 二选一
（① 新建 `{AGATE_WORKSPACE}/decisions/`；② 落到 `docs/decisions/`）：

1. **render 超限反馈采用「机读 JSON 清单」而非可见 UI** —— P2 `:617` / `:882` 已显式登记该「机读 vs 可见语义落差」
   交主 Agent 判断；P4/P6 按机读实现。这是**跨任务**取向（后续任何「超限提示」需求都会撞同一取舍），
   不只是本任务的实现细节。
2. **`requested - inlined == len(skipped)` 势不变式与 `skipped[]` 逐项上限不可兼得** —— P4 §5（`:620-640`）
   的 M1 决策 C 的直接结论：B 的两种落法各撞一条（截断则势不成立；加汇总项则违反 `file_id` 必填）。
   P4 `:637` 明确建议「P7 转抄本决策，并把该契约级取舍登记」。**现予转抄**，正文见下：

> **契约级取舍（转抄 P4 §5）**：在 P2 冻结的三项（势不变式 / `file_id` 必填 / 六元 `REASONS`）同时成立的前提下，
> `?inject=` 的**响应放大无法压到 1×**。方案 C（`max_length=4096`）把「无界」降为「有界但残留 11.7–22.6×」
> （P4 实测；P4-review §4-1 复核）。彻底消除需 P2 授权改契约（放宽势不变式 **或** 允许汇总项无 `file_id`）。
> 本任务选择「保契约 + 收边界」，残留放大已由全局限速 60/min 与绝对量上界（≤ ~91 KB）约束为 MINOR。

---

## 7. 待主 Agent 处置（按优先级）

| # | 事项 | 级别 | 建议动作 | 依据 |
|---|---|---|---|---|
| 1 | **登记 DEBT（SP2 存储层同名覆盖）** | WARNING | 建议 `DEBT0022`，`category: technical`，`priority: medium`，标题与 `closure_criteria` 见 §2；**同时把「render 注入 `<style>` 内填二进制」写进 `impact`**（这是判据 2 命中的实证，也是 P4 原文未点出的部分） | 本文件 §2 + F1/F2 |
| 2 | **登记 DEBT（M1 放大残留 / 超长 int token / 字面 `</body>` 隐式依赖）** | WARNING | P4-review `:316` 明列为 P7 职责：`§5-1` 放大残留 11.7–22.6×、`§5-2` 超长 int token 500（既有面）、`§5-3` 字面 `</body>` 依赖「取末个」隐式约定 | P4-review §7 |
| 3 | **决策落点**：上述 §6 的 2 条跨任务架构决策写到哪里 | WARNING | 新建工作区 `decisions/` 或落 `docs/decisions/`；**不要**只写在 P7 里（会成为死文档） | F5 |
| 4 | `known-failures.md` 补逐 case 清单 | NOTE | P6.5 §2 建议的 32 条 case 名单（可从 `P6-evidence/logs/e2e-legacy-three.log` 抄录）；P6.5 判 WARNING 不阻断，若 P8 时间紧可留运营 | F6 |
| 5 | P8：显式声明「不 bump `mcp_server`」 | NOTE | 引用 `P1:528`（MCP 不在范围），避免版本一致性检查误判 | §3.2 |
| 6 | 随 P7 commit 提交 e2e 证据路径改动 | NOTE | `frontend-v3/e2e/tpv0104-viewer-hardening.spec.ts` 的 `EVIDENCE_DIR` 绝对化改动（我已核为合理，未改动） | 派发指引 |
| 7 | 环境：后续取证只用 `:8893` | NOTE | `:8888`/`:8890` 实测仍 LISTEN 但为 P4 修复前进程 | F7 |

---

## 8. 六项检查清单逐项结论

| # | 检查项 | 结论 | 锚点 |
|---|---|---|---|
| 1 | **DESIGN_GAP 配对** | ✅ **通过** 6/6。6 条全部转抄 P4 原文 + 配 `[DESIGN_GAP_REVIEWED]`，裁定均 `accepted`，零条需退回；每条含独立核查证据（`git log -S` / 实读源码 / 进程内实测） | §1（含 6 条 REVIEWED + 小计表） |
| 2 | **SCOPE+ 闭环** | ✅ **通过** 2/2。SP1 已实现（4 出口全覆盖）；SP2 确属范围外**且应登记技术债**（判据 2 命中，附独立复现的渲染污染证据）。**两条均无需增补 P1 基线**，理由逐条给出 | §2 |
| 3 | **跨文件一致性** | ✅ **通过**。BDD 54==54==54 且**集合逐项相等**；P2 `packages` 与实际改动面一致、P8 范围记待办（应只 bump `peekview`）；P4 实现路径 vs `batches[].output` **22/24 精确命中**（未命中 2 个均有据），超出项 4 个全部已申报/已授权 | §3（含 4 张核对表） |
| 4 | **未决项清零** | ✅ **通过**。P1 行首 `NEED_CONFIRM`/`BLOCKER`/`DEVIATION-CRITICAL` = 0（2 处全文命中均为 `[NO_NEED_CONFIRM]` 肯定声明）；P6/P6.5 零残留 | §4 |
| 5 | **CODE-MAP 核对** | ⚠️ **WARNING 跳过**（`agents/CODE-MAP.md` 不存在）。改用**替代 import 方向核对**，4 个新增文件依赖方向全部正确，`[CODE_MAP_DRIFT:]` = 0；P4 的 2 条 `[CODE_MAP_EXEMPT]` 已计入 frontmatter 并与 `code_map_reviewed` 集合相等 | §5 |
| 6 | **架构决策落点** | ⚠️ **WARNING 跳过**（`{AGATE_WORKSPACE}/decisions/` 不存在）。被证伪的既有决策**无对象**（`docs/decisions/` 3 条均未被证伪）；P2 `:410` 的证伪已就地标注未删除 ✅；**2 条跨任务决策无落点 → 待办**(F5) | §6 |

---

## 9. WARNING / NOTE 汇总

**BLOCKER: 0**　**CRITICAL: 0**　`[DEVIATION-CRITICAL]` 0　`[CODE_MAP_DRIFT:]` 0

| 级别 | 数量 | 内容 |
|---|---|---|
| WARNING | 5 | ①SP2 应登记技术债（F1）②P4「报表准确」措辞需补内容层失真（F2）③P4 第 3 批缺新增文件核对表（F3）④P2 声明的 `file-bytes.spec.ts`/spec 扩展未落地（F4）⑤`decisions/` 缺失致 2 条跨任务决策无落点（F5） |
| NOTE | 2 | ⑥`known-failures.md` 未补逐 case 名单（F6）⑦`:8888`/`:8890` 仍是旧进程（F7） |
| 机制缺失跳过 | 2 | CODE-MAP（§5，已用替代核对补偿）、`decisions/`（§6） |

**全部 WARNING/NOTE 均不阻断 P8**。其中 ①② 建议在 P8 前落账（它们指向同一 DEBT 条目）；③④ 属 P4/P2 自身完备性，
可在 P8 归档时留痕；⑤ 需主 Agent 裁决落点；⑥⑦ 可留运营。

---

## 10. 我做了什么 / 没做什么（供主 Agent 复核）

**做了**（独立取证，未复用 P4/P4-review 的自建脚本）：
- `git log -S 'select-heading'` 全史追溯，确认该 emit 从未在 `MarkdownViewer.vue` 存在（DG1）
- `wc -l` + 改动前 `git show` 对比，确认 t082 行数契约（300/150）真实存在且仅余 4/5 行（DG3）
- 进程内临时 app 穷举 7 种 file id 形态（0/负数/跨 entry/不存在/非整数），确认 DG4 所述失效形态不可达
- 两次自建探针（`p7-m2-independent.py` / `p7-m2-detail.py`）复现存储层同名覆盖，并**发现 P4 未记录的渲染污染**（`<style>` 内二进制）
- `storage.py:36`（`get_disk_path`，`rel_path` 逻辑在 `:63-69`）机制实读，确认落盘路径只由 `path or filename` 决定、与 `File.id` 无关
- `python3 -c "len('İ'.lower())"` = 2 验证 `lower()` 非保长（DG6 根因）
- BDD 三方集合逐项比对（非仅计数）
- `task_level=2` → 实测 `_gate_p7_structured` 路径（决定本文件形态）
- 端口/生产隔离：`:8080` code=000、`~/.peekview/` mtime 未变、`:8893` HTTP 200

**没做**（按红线）：
- 未改 `P1-requirements.md`（基线）—— SP1/SP2 的闭环结论改用本文件 `scope_resolved` 承载
- 未改任何实现代码 / 测试 / `frontend-v3/e2e/tpv0104-viewer-hardening.spec.ts`
- 未写入 `tech-debt.md`（判断已给出、条目内容已备好，编号分配留主 Agent，见 §7 #1）
- 未 commit
- 未用 `:8080`、未读写 `~/.peekview/`、未用 `/tmp` 存临时产物（全部落 `.agate-tmp/`）
- 未在 P7 撰写架构决策正文（§6 仅转抄 P4 结论 + 标待办）
