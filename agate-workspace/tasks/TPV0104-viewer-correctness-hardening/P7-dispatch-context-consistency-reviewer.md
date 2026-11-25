---
phase: P7
generated_by: agate-inject-card.py + 主 Agent
task_id: TPV0104
role: consistency-reviewer
---

<dispatch_guide>
> ⚠️ 以下派发指引是本次任务的强制指令，不是参考信息。执行优先级：派发指引 > 客观查证信息 > 阶段卡片（参考规范）

### 目标

**P7 一致性检查**：对 P1–P6 的产出做跨文件一致性审查，产出 `P7-consistency.md`。

### ⚠️ 六项检查清单（缺一 gate 不过）

#### 1. DESIGN_GAP 配对（**最重要，gate 硬性要求**）

`P4-implementation.md` 中有 **6 条** `[DESIGN_GAP:` 声明（行首格式），你必须在 `P7-consistency.md` 中**逐条转抄 + 配 `[DESIGN_GAP_REVIEWED:` 标记**。

我已定位全部 6 条：
| # | 位置 | 内容摘要 |
|---|---|---|
| 1 | `P4-implementation.md:335` | P2 `:107` 称 `MarkdownViewer.vue` 需删 `select-heading` emit，但现仓从不存在该 emit |
| 2 | `:337` | P2 `:191` 的数据流（`EntryDetailContent` 透传 `@headings` → `EntryDetailView` 调 `setTocHeadings`）横跨两个批次，dispatch-context 未覆盖 |
| 3 | `:508` | P2 只规定 `normalizeFileQuery` 纯函数形态与 View 内时机表，未规定实现落点 → 为守 t082 行数契约抽到新 composable |
| 4 | `:509` | P2 D3 字面「fileId 命中就复用预取 content」未覆盖预取 id 与最终 targetFile 不一致 → 加 `targetFile.id === fileId` 守卫 |
| 5 | `:510` | P2 D5 的 `handleFullscreen` 伪码用 `{...route.query}` 手拼，与 `normalizeFileQuery` 双源 → 改为复用 |
| 6 | `:735` | C2 修复未照抄评审建议的 `re.search`（取首个），改为 `re.finditer` 取 `matches[-1]`（保 `rfind` 语义） |

> **转抄要求**：每条写成 `[DESIGN_GAP_REVIEWED: <你的独立裁定——合理/不合理/需补>]` + 你的核查依据。**不得只写"已复核"三个字**。

#### 2. SCOPE+ 闭环

`P4-implementation.md` 中有 **2 条真实 `[SCOPE+]`**（另 3 处 `### [SCOPE+]` 节的内容是「无」，不算）：
| # | 位置 | 内容 | 性质 |
|---|---|---|---|
| 1 | `:512` | `EntryDetailView.vue` 原 `:244` 的 `router.replace({query:{}})` 不只误删 file/share，也承担「消费 firstFileId」；白名单化后职责移到 `syncUrl()`，故切换 slug 时也会归一 query（P2 时机表未覆盖跨 entry 导航） | **实现时的必要连带，P4 已实现** |
| 2 | `:737` | 「同 entry 两份同名 sibling」根因是**存储层同名覆盖**（磁盘仅 1 个文件），非 `owners` 缺陷；修复需改 entry 写入命名策略，**超出 P1 范围，未处置** | **范围外新发现** |

**你要做的**：
- 核每条的**处置状态**（已实现 / 明确排除），并在 `P7-consistency.md` 里写清
- **P1 目前无 `SCOPE_RESOLVED` 标记**（我已核：`grep -c SCOPE_RESOLVED P1-requirements.md` = 0）。若你认为某条需要正式纳入基线 → **在 `P7-consistency.md` 里标注「待纳入 P1 基线」并说明理由**，**不要直接改 P1**（P1 是基线，P2–P8 禁改；改它须主 Agent 批准并标 `[BASELINE_CHANGE]`）
- 对 `:737` 那条：判断它应**登记为技术债**（`tech-debt.md`）还是**确实超出任务范围无需处理**。写清你的判断依据。

#### 3. 跨文件一致性

- **P2 声明的 packages 与 P8 的 bump 范围一致？**
  - P2 的 `packages` 声明 → 核 `VERSIONS.json` 与 P8（若 P8 未做则记为待办）
- **P1 的 BDD 数量与 P6 的验收结果数量匹配？**（应为 54 == 54）
- **P4 的实现路径与 P2 的方案设计吻合？** → 核 P2 的 `dispatch_plan.batches[].output` 与实际改动文件

#### 4. 未决项清零

- `P1-requirements.md` 无残留行首 `[NEED_CONFIRM]` / `[BLOCKER]` / `[DEVIATION-CRITICAL]`
- `P6-acceptance.md` 无 `[NEED_CONFIRM]`

#### 5. CODE-MAP 核对

- 对照 `{AGATE_WORKSPACE}/agents/CODE-MAP.md`（若不存在则记 WARNING 并跳过）与 P4「新增文件核对表」逐条核对
- 发现依赖方向偏离标 `[CODE_MAP_DRIFT:]`（WARNING 级，不阻断）
- 核对通过标 `[CODE_MAP_SYNC:]`

#### 6. 架构决策落点核对

- 核 `{AGATE_WORKSPACE}/decisions/`（若不存在则记 WARNING 并跳过）是否已写入本任务应落的跨任务架构决策
- 被本任务证伪的既有决策是否已就地标注「已过时 + 被什么取代」而非删除
- **仅核对，不在 P7 撰写决策正文**；缺失项记为待办

### ⚠️ 本任务已知的关键事实（用于交叉核对，不必重跑）

- **54 条 BDD**，P6 判 54/54 PASS，P6.5 judge 第 2 轮判 `passed`（54/54）
- **提交链**：`de03b466`(P3) → `4ec6b1b6`(P4) → `e11208ad`(P5) → `a918b092`(P6) → `660a4749`(P6 重验) → `5b8e831b`(P6.5)
- **P4 改动范围**：后端 `html_render_service.py` / `api/files.py` / `entry_service.py` / `docs/architecture/html-preview-security-modes.md`；前端 `useMarkdown` / `useEntryDetailComputed` / `useEntryDetailUrlSync`(新) / `default-file`(新) / `file-bytes`(新) / `TocNav` / `TableView` / `HtmlViewer` / `TreeView` / `EntryDetail*` / `EntryCard` / `EntryListRow` / `types/structured-data.ts`
- **P2 的 `[DESIGN_GAP_REVIEWED]` 已有 1 条**：我在 `P2-design.md:410` 附近追加了关于 `count_limit` 的更正（原判断「filename 可为 null」已被 P6.5 judge 证伪并修复）
- **工作区有一个未提交的源码改动**：`frontend-v3/e2e/tpv0104-viewer-hardening.spec.ts`（`EVIDENCE_DIR` 从相对 cwd 改为基于 `import.meta.url` 的绝对路径）。**这是我修的**（P5/P6 各踩一次证据误落到 `frontend-v3/agate-workspace/`）。P7 可核它是否合理，但**不要动它**，我会随 P7 commit 一并提交。
- **P8 尚未开始**（无 `P8-release.md`），故清单第 3 项的 P8 部分记「待办」

### 环境隔离（强制）
- **新代码在 `:8893`**（`:8888`/`:8890` 有宿主侧旧进程残留，**别用它们验证新行为**——这是 P6.5 judge 实测确认的）
- **严禁** `:8080`、**严禁** `~/.peekview/`
- 状态标记二值：`[PROD_TOUCHED]` / `[PROD_NOT_TOUCHED]`
- 临时文件放 `<项目根>/.agate-tmp/`（**不用 `/tmp`**）
- **不要 commit**；**不要改实现代码与测试**
- **不要改 `P1-requirements.md`**（基线）

### 产出规格（`P7-consistency.md`）

必须包含：
- **6 条 `[DESIGN_GAP_REVIEWED: ...]`**（逐条对应 P4 的 6 条 DESIGN_GAP，含独立裁定与依据）
- **2 条 `[SCOPE+]` 的处置状态**（含 `:737` 是登记技术债还是确属范围外）
- 六项检查清单的逐项结论
- 跨文件一致性核对表（BDD 数 54==54、packages、实现路径）
- 未决项清零结论
- CODE-MAP / decisions 核对结论（不存在则记 WARNING）
- 行首总结：`BLOCKER: 0` / `CRITICAL: 0`（若确实为 0）

### 输入文件
- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P1-requirements.md`（54 条 BDD 基线）
- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P2-design.md`（含 `dispatch_plan` 的 packages/batches、我追加的 `[DESIGN_GAP_REVIEWED]`）
- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P3-test-cases.md`
- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P4-implementation.md`（**6 条 DESIGN_GAP + 2 条 SCOPE+ 的来源**）
- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P4-review.md`（approved）
- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P5-test-results/`
- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P6-acceptance.md`
- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P6.5-judge-verdict.md`（passed 54/54）
- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/known-failures.md`
- `{project_root}/AGENTS.md`
- `{project_root}/VERSIONS.json`（核 packages）
- `{AGATE_WORKSPACE}/agents/CODE-MAP.md` / `{AGATE_WORKSPACE}/decisions/`（若不存在记 WARNING）

</dispatch_guide>

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P7

路径：phase-cards/P7-consistency.md
---
# P7 — 一致性检查

> 当前状态：[首次 / 重试 #N / 裁剪跳阶]
> 裁剪跳阶 → 确认 P1 phases 不含 P7 + 源文件数 ≤5 + 无 implicit_coupling + 有 coupling_checklist（须列出至少 2 个已检查的耦合点，空清单不合规）→ 跳过，读 P8 卡片
> ⑨ P7 subagent 化

## 如果是首次进入本阶段

1. 主 Agent 派发 consistency-reviewer subagent 执行交叉检查
   1.1 写 P7-dispatch-context-consistency-reviewer.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
2. 对照 P1-P6 产出做跨文件一致性审查
3. 产出 P7-consistency.md
4. 预跑 check-gate.py P7
5. git add {AGATE_WORKSPACE}/tasks/{Txxx}/（含 .state.yaml + 产出文件，若 .gitignore 忽略需 git add -f）
   ⚠️ 此时 .state.yaml 的 phase 保持 P7，不要提前写 P8——phase = 本 commit 的产出阶段
6. git commit -m "wf({Txxx}-P7): {摘要}"（phase=P7，P7 产出含 P7-consistency.md）
7. P7 commit 完成后进入 P8：**phase 推进 P8 随 P8 产出 commit 一起**（P8-release.md 就绪后），不是单独 phase commit

## 如果是重试

→ 读 agate/rules/state-transitions.md 确认 retry 上限（P7 MAX=2）

## 前置条件

- [ ] P1-P6 全部产出文件就绪

## 执行方式

consistency-reviewer subagent 执行。检查清单：

1. **DESIGN_GAP 配对**：P4-implementation.md 中的 DESIGN_GAP 声明 → 必须在 P7-consistency.md 中逐条转抄 + 配 REVIEWED 标记。未配对 → gate 不通过
2. **SCOPE+ 闭环**：P1-requirements.md 有 [SCOPE_RESOLVED] 标记，确认所有 SCOPE+ 增补已纳入基线
3. **跨文件一致性**：P2 声明的 packages 与 P8 release 的 bump 范围一致？P1 的 BDD 和 P6 的验收结果数量匹配？P4 的实现路径和 P2 的方案设计吻合？
4. **未决项清零**：P1-requirements.md 无残留行首 [NEED_CONFIRM]（P6 不再有 NEED_CONFIRM）、[BLOCKER]、[DEVIATION-CRITICAL]
5. **CODE-MAP 核对**：对照 `{AGATE_WORKSPACE}/agents/CODE-MAP.md` 与 P4「新增文件核对表」逐条核对，发现依赖方向偏离标 `[CODE_MAP_DRIFT:]`（WARNING 级，不阻断）；核对通过标 `[CODE_MAP_SYNC:]`
6. **架构决策落点与过时标注核对**：核对 `{AGATE_WORKSPACE}/decisions/` 是否已写入本任务应落的跨任务架构决策，且被本任务证伪的既有决策已就地标注「已过时 + 被什么取代」而非删除。仅核对，不在 P7 撰写决策正文（缺失项记为待办，由决策的提出方在下一次 P2 前补写入 `decisions/`；见 DEBT0039）

## 实质锚点要求（N3⑨）

| gate 断言 | 实质锚点（P7 产出须包含） |
|-----------|--------------------------|
| BLOCKER=0 | DESIGN_GAP 配对项 + REVIEWED 标记 |
| CRITICAL=0 | 跨文件检查项 + 源文件节名 |
| SCOPE+ 闭环 | 条目 + SCOPE_RESOLVED |

gate 脚本校验说明：
- DESIGN_GAP_REVIEWED：P4 声明的每条 DESIGN_GAP 在 P7 产出中须有对应行含 `DESIGN_GAP_REVIEWED`
- 跨文件引用关键词：P7 产出中须含源文件节名（如 `P2§packages`、`P4§impl-path`），否则 WARNING

## 产出规格

- P7-consistency.md：一致性审查结论
- 逐条检查结果，无 [BLOCKER] 标记

`blocker_count`/`deviation_count`/`deviation_critical_count`/`design_gap_count`/
`design_gap_reviewed_count`/`code_map_new_files_count`/`code_map_reviewed_count` 写在文件头
**frontmatter**（`---` 分隔块），不写正文；正文
`[BLOCKER]`/`[DEVIATION-CRITICAL]`/`[DESIGN_GAP]`/`[DESIGN_GAP_REVIEWED]` 散文标记保留为
人类痕迹（不迁移），gate 判定改读 frontmatter 结构化计数。**可直接复制的完整样例**：
```yaml
---
phase: P7
task_id: TAG0001           # 替换为实际任务编号
type: consistency
parent: P2-design.md
trace_id: T001-P7-20260101 # {task_id}-P7-{YYYYMMDD}
status: draft
created: 2026-01-01
agent: consistency-reviewer
# ── v2.0 机器计数 ──
blocker_count: 0                  # int ≥0
deviation_count: 0                # int ≥0
deviation_critical_count: 0       # int ≥0
design_gap_count: 0                # int ≥0
design_gap_reviewed_count: 0       # int ≥0
code_map_new_files_count: 0        # int ≥0（可选，仅骨架/CODE-MAP 机制已采用时填）
code_map_reviewed_count: 0         # int ≥0（可选，语义对应 design_gap_reviewed_count）
# ── TAG0050 批 E 成对声明（非 legacy 任务；跨文件聚合后逐条核对）──
# design_gap_reviews:
#   - {gap: DG1, verdict: accepted, checked_against: [P2 §3], basis: in_bdd}
# code_map_reviewed:
#   - {file: agate/scripts/x.py}
# findings:
#   - {id: F1, severity: note, text: "...", status: resolved, resolution: "...", evidence: "..."}
---
```

## gate 规则

```bash
check-gate.py P7 $TASK_DIR
```

- [BLOCKER] 存在 → exit 1
- [DEVIATION-CRITICAL] 存在 → exit 1
- DESIGN_GAP 未配对（P4 有但 P7 无 REVIEWED）→ exit 1
- CODE-MAP 未配对（code_map_reviewed_count < code_map_new_files_count，或 P4 实际标记数 > code_map_new_files_count）→ exit 1（两字段均缺失时机制未采用，跳过）
- 含 DESIGN_GAP_REVIEWED 但缺跨文件引用关键词 → WARNING（不改变 exit code）
- 全部通过 → exit 0

BLOCKER → consistency-reviewer 修改 → 再验 gate → … → 通过（⑩迭代循环，review 和 gate 重试共享 retry 预算）

## 推进条件（全部满足才写 phase: P8）

- [ ] P7-consistency.md 存在
- [ ] 无 [BLOCKER] / [DEVIATION-CRITICAL]
- [ ] DESIGN_GAP 全部 REVIEWED 配对
- [ ] SCOPE+ 闭环（P1 有 [SCOPE_RESOLVED]）

## P7 输入文件数量

P7 是输入文件数量限制的例外（模式 1 单发 + 输入数量豁免特例，见 dispatch-protocol「派发编排机制」全阶段适用表），不拆分。原因：
1. 跨文件一致性比较需要全部源文件同时可见
2. 角色文件（consistency-reviewer）已列出所需输入清单
3. dispatch-context 为 subagent 提供摘要，无需逐文件全文注入

## 常见错误

1. **漏转抄 P4 的 DESIGN_GAP**：P4 implementer 声明了实现偏差但 P7 没转抄 → gate 拦截
2. **一致性检查只看标题不对内容**：P1 BDD 数 = 15，P6 PASS 数 = 15 → 数量对，但 BDD-8 的内容在 P6 里被映射到错误的验收结果
3. **裸 'BLOCKER=0' 不引用锚点**：未做实质交叉检查，只写 '一致' → gate WARNING 提醒

gate 不过 ≠ 你失败了。红灯指向工作/设计的问题，不指向你。正确动作是诊断→退回/重试/PAUSED，不是修改产出让它变绿。

## 下游影响

- P8 发布前最后一道质量门——P7 通过后进入机械发布步骤

> 完成 → 读 phase-cards/P8-release.md
<!-- AGATE_CARD_END -->

<objective_info>
- **任务**：TPV0104 Viewer 正确性与资源边界加固（8 项缺陷 / 54 条 BDD / 跨前后端）。
- **状态**：P1–P6.5 全部完成。P6 判 54/54 PASS；P6.5 judge 第 2 轮判 `passed`（criteria 54/54，非 partial）。
- **环境**：`:8893` 在线且跑**修复后**新代码（`:8888`/`:8890` 是修复前进程，仅可用于只读探测）；生产 `:8080` 不可达（000）；`~/.peekview/` mtime **2026-11-12**（零写入）；git HEAD=`5b8e831b`。
- **测试基线**：后端 **1222P / 1F（预存 `test_cli_remote`，沙箱 `~/.peekview/` 只读）/ 3S**；前端 **127 files / 1514P / 4S / 0F**；`make typecheck`/`make lint`/`make check-docs` 全 exit 0。
- **P4 的 5 项真实缺陷（review 在全绿下找出 3 CRITICAL + 2 MAJOR，均已修）**：
  - C1 总预算记账单位错配（`len(data.content)` 字符数 vs `record.size` 字节数）→ 中文/emoji 素材下预算失效且报表自称合规
  - C2 `_append_inject_report` 在 `html.lower()` 上取下标却切原串 → `İ`(U+0130) 使 lower 变长、把 `</body>` 劈成两半
  - C3 `not_injectable` 缺 `file_id` 违反 P2 冻结 schema
  - M1 `overflow` 无界（`?inject=` 500 个假 id → 响应放大 13×）→ 加 `max_length=4096`
  - M2 `owners` 单命名空间致 text/binary 同名键互覆盖
- **P6.5 judge 抓到的第 6 项缺陷（否则会漏）**：BDD-38 Then③ 的 `count_limit` 项 `filename: null` —— P2 把「未查询」当「查不到」，实质削弱 P1 判据却未走 `[BASELINE_CHANGE]`。已修复（补一次批量查询 + 区分 `not_found`）+ 我在 `P2-design.md` 追加 `[DESIGN_GAP_REVIEWED]` 留痕。
- **冻结的 P2 设计值**：`_MAX_INJECT_IDS=40` / 单文件文本 2 MiB / 总字节 8 MiB / `REASONS` 六元闭集 / `skipped[]` 五字段（`file_id` 必填）
- 环境坑：临时产物落 `.agate-tmp/`（不用 `/tmp`）。
</objective_info>
