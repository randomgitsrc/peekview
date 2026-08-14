---
phase: P7
task_id: TPV0094-treeview-default-expand
type: consistency
parent: P2-design.md
trace_id: TPV0094-P7-20260815
status: draft
created: 2026-08-15
agent: consistency-reviewer
# ── v2.0 机器计数 ──
blocker_count: 0
deviation_count: 1
deviation_critical_count: 0
design_gap_count: 0
design_gap_reviewed_count: 0
---

# P7 一致性审查 — TPV0094 TreeView 默认展开优化

> 审查方式：以批判的第三方视角，双向检查（设计→实现 / 实现→设计），假设 P2 设计可能有错。
> 状态标记：[PROD_NOT_TOUCHED]（只读审查，未修改任何产出文件，未触碰 :8080 / ~/.peekview/）

## 0. 审查范围与结论摘要

| 检查项 | 结论 |
|--------|------|
| DESIGN_GAP 配对 | P4 声明无 DESIGN_GAP → 无需配对（见 §1） |
| SCOPE+ 闭环 | 1 条非核心 [DEVIATION]（measure-treeview-perf.ts 未落地）+ [SUGGEST]（见 §2） |
| P1 8 BDD ↔ P6 8 PASS | 逐条内容匹配 ✓（见 §3） |
| P2 packages ↔ 实际改动 | 3/4 匹配，1 项偏差（perf 脚本）见 §2/§4 |
| P4 实现 ↔ P2 设计 | 逐条一致 ✓（见 §5） |
| 未决项清零 | SUGGEST 3 条定稿 ✓ / 无 NEED_CONFIRM ✓（见 §6） |
| 红线阈值 | 2000 与 P2 §8 判定标准一致 ✓（见 §7） |
| P6 BDD 二值规则 | 8 条全部 PASS，无中间态 ✓（见 §3） |

**结论：无 [BLOCKER] / 无 [DEVIATION-CRITICAL]，1 条非核心 [DEVIATION]（非阻塞，含处理建议）。P7 gate 应通过。**

---

## 1. DESIGN_GAP 配对

P4-implementation.md（P4§标注，L59）声明：

> `无 [DESIGN_GAP] / [SCOPE+] / [SCOPE_GAP] / [CLARIFY]。`

**P4 未声明任何 [DESIGN_GAP]**。P7 核对确认：实现路径与 P2 设计无歧义点，implementer 未做任何需回补设计的自主决策，因此 `design_gap_count = 0`，无配对要求。

[DESIGN_GAP_REVIEWED: 无 — P4 未声明 DESIGN_GAP，gate 无配对义务（check-gate.sh P7 的 P4/P7 交叉核对 grep 结果为 0，`P4_DESIGN_GAP_COUNT(0) > P7(0)` 不触发）]

---

## 2. SCOPE+ 闭环 — [DEVIATION]（非核心，非阻塞）

### 2.1 事实链

- **P2 声明**（P2§设计声明 L267）：`[SCOPE+] 新增 frontend-v3/scripts/measure-treeview-perf.ts（红线实测承载）`，frontmatter（P2§packages）含该新文件，§5 gate_commands.P6_redline 引用 `frontend-v3/scripts/measure-treeview-perf.ts`，§6 files_to_read 收录，§9 实现完成标志「红线脚本 scripts/measure-treeview-perf.ts：可对 5 量级输出耗时表」。
- **实际**：`frontend-v3/scripts/measure-treeview-perf.ts` **从未创建**（P4-implementation.md P4§impl L40 明确「P4 不触碰红线脚本」；git 工作树/历史均无该文件）。
- **P6 替代实现**：P6 用 `P6-evidence/scripts/p6-redline-bench.ts`（P6-dispatch-context L224 明确「不要放 frontend-v3/scripts/ 项目源码目录，P6 阶段不引入源码变更」）完成红线实测，产出 `redline-results.json`（5 量级 + decision）+ `redline-test-output.log`。
- **BDD-8 验收**：PASS（P6§验收 BDD-8，证据齐全）。

### 2.2 判定

- **是否构成 [DEVIATION]**：是。P2 设计声明了 `frontend-v3/scripts/measure-treeview-perf.ts`（packages/§1 改什么/§5 gate_commands/§6/§9 五处引用），该文件未落地，红线实测脚本实际位于 `P6-evidence/scripts/`。**这属于「P2 声明新增实现细节文件但落地位置/形态不同」的偏差。**
- **是否核心偏差**：**否**。判定依据——按 architect.md「核心设计目标」标准（P2 §1 改动方案节列出的设计目标 + 被 P1 BDD 引用为验收条件的）：红线实测的**目标**（BDD-8：据实测定阈值并记录证据）已完整达成，证据 `redline-results.json` 逐量级记录耗时、白屏状态、预算判定、阈值决策；**脚本位置是承载工具而非产品行为**，不属于 P1 BDD 验收条件。偏差仅涉及工具文件的位置与存在形式，不改变任何产品行为。
- **是否影响验收结论**：**否**。BDD-8 PASS 依赖的是实测数据（redline-results.json）与阈值决策，与脚本位于 `frontend-v3/scripts/` 还是 `P6-evidence/scripts/` 无关。P2 §9 完成标志「可对 5 量级输出耗时表 + 选定阈值 + 判定依据」由 p6-redline-bench.ts 功能等价满足。

[DEVIATION: P2§packages/P2§5/P2§6/P2§9 声明的 `frontend-v3/scripts/measure-treeview-perf.ts` 未创建；红线实测改由 `P6-evidence/scripts/p6-redline-bench.ts` 承担（P6-dispatch-context L224 主 Agent 派发时已重定向脚本位置）。涉及 P2 设计目标「红线实测承载工具」但目标本身（BDD-8）已达成 → 非核心、部分落地、非阻塞]

[SUGGEST: 保留 `P6-evidence/scripts/p6-redline-bench.ts` 作为红线实测工具（证据链完整，已随任务记录归档）。**P8 可不补 `frontend-v3/scripts/` 正式脚本**——理由：① 红线阈值已据实测定（2000）且 BDD-8 证据闭环，未来再调阈值时可直接复用 p6-redline-bench.ts；② P6-dispatch-context 已明确「P6 阶段不引入源码变更」，补脚本会引入未被任何测试引用的死代码；③ 若未来确有阈值复调需求，届时再落正式脚本，可标注从 P6-evidence/scripts/p6-redline-bench.ts 复制。另建议主 Agent 在 P8 打包/版本时注意：P2 §5 gate_commands.P6_redline 的路径 `frontend-v3/scripts/measure-treeview-perf.ts` 已失效，如未来复跑需改为 `P6-evidence/scripts/p6-redline-bench.ts`]

### 2.3 SCOPE_RESOLVED 说明

P1-requirements.md 无 `[SCOPE_RESOLVED]` 标记。原因：该 SCOPE+ 声明于 **P2** 设计声明（L267「幅度小：不影响 BDD 基线，仅新增实现细节文件」），P1 基线（8 BDD）未受影响、无需增补——P1 无需补记。闭环已由本节的 DEVIATION 判定 + SUGGEST 处理方案完成。主 Agent 可据本节决策（是否采纳 SUGGEST）关闭此条。

---

## 3. P1 BDD ↔ P6 验收逐条内容映射（非仅数量）

P1§BDD 8 条 ↔ P6§验收 8 PASS，逐条核对**内容**映射：

| P1 BDD | P1 验收条件（内容要点） | P6 PASS 内容 | 映射 |
|--------|------------------------|--------------|------|
| BDD-1 小 JSON 全展开 | 所有含子节点行 `aria-expanded=true`，`.tree-node` 数 = 节点总数 | `.tree-node`==9（==节点总数）、`[aria-expanded="true"]`==2（==分支节点数）、`false`==0，无 banner | ✓ 一致 |
| BDD-2 小 YAML/XML 全展开 | YAML 与 XML 各自全展开 | YAML `.tree-node`=9、XML=7，两者 `aria-expanded="false"` 均 0 | ✓ 一致 |
| BDD-3 超红线大 JSON 折叠+提示 | 出现折叠提示文案，`.tree-node` 数 < 总节点数 | 10021 节点渲染 `.tree-node`=1（<10021），banner 可见且含「已折叠部分」 | ✓ 一致 |
| BDD-4 大文件手动展开 | 点击未展开含子节点行 → `aria-expanded=true` 且子节点渲染可见 | 点根 `data` → 21 节点 `sub_0` 可见；点 `sub_0` → 521 节点 `leaf_0_499` 可见 | ✓ 一致 |
| BDD-5 切文件重置 | 切到小文件按自身节点数全展开，不继承大文件折叠态 | multi 默认 large（折叠+banner）→ 切 small.json → `.tree-node`==9 全展开、无折叠 toggle、banner 消失 | ✓ 一致 |
| BDD-6 手动折叠/再展开可逆 | 点一次折叠、再点恢复 | tags 行 `true`→点→`false` 子隐藏→点→`true` 子恢复 | ✓ 一致 |
| BDD-7 折叠态搜索计数 | 折叠态下搜索计数非零（遍历不依赖展开态） | 大 JSON 折叠态搜索 `leaf_3_250` → `.search-match-count` 显示 `1 match` | ✓ 一致 |
| BDD-8 红线实测 | 5 量级实测 + 阈值判定依据 + 5000 无白屏 | 100/500/1000/2000/5000 实测（见 §7），阈值保持 2000，5000 无白屏（787ms 完成） | ✓ 一致 |

**8/8 逐条内容匹配，无「数量对但内容错位」情形**（避免 gate 常见错误 #2）。

---

## 4. P2 packages ↔ 实际改动文件

| P2§packages 声明 | 实际改动 | 匹配 |
|------------------|---------|------|
| `frontend-v3/src/components/TreeView.vue` | P4 commit 唯一产品代码改动 | ✓ |
| `frontend-v3/src/components/__tests__/TreeView.spec.ts` | P3 commit（11 新增+4 更新用例，spec 实计 17 `it`） | ✓ |
| `frontend-v3/e2e/structured-data-viewer.spec.ts` | P3 commit + P4 retry1（3 处测试代码修复） | ✓ |
| `frontend-v3/scripts/measure-treeview-perf.ts` | **未创建**；红线实测由 `P6-evidence/scripts/p6-redline-bench.ts` 承担 | ✗（见 §2，非核心偏差） |

> 备注：P1 packages 另列了 `DataTreeNode.vue`，但 P2 明确「不改 DataTreeNode.vue」（P2§1 不改什么 + 隐含需求 #4），实现也未触碰（git diff 确认）——P1 列为潜在影响文件、P2 明确排除，不构成偏差。

---

## 5. P4 实现 ↔ P2 设计逐条核对（双向）

### 5.1 方向 1（设计→实现）

| P2 设计 | 实现（TreeView.vue） | 核对 |
|---------|----------------------|------|
| §2/§3：`export const DEFAULT_EXPAND_THRESHOLD = 2000` | L49（独立 `<script lang="ts">` 块） | ✓ |
| §2：`totalNodeCount` 递归计数 computed | L82-92 | ✓ 逐字一致 |
| §3：`hasBranchNode` 全树递归 | L94-98 | ✓ |
| §3：`shouldCollapse = 总数>阈值 && hasBranchNode` | L100-102 | ✓ |
| §2：`resetExpansion` 二分路径（≤阈值收集全部含子节点 path / >阈值空 Set 根折叠） | L164-178 | ✓ `expandedPaths.value = paths` 覆盖旧值 |
| §3：banner `data-testid="tree-collapse-banner"`、`role="status"`、文案「内容较大，已折叠部分」 | L21-29 | ✓ |
| §3/§4.1：banner 在非 truncated 分支（`v-else` 内、tree-list 前），与 TruncationBanner 互斥 | L3-9（`v-if=truncated` / `v-else`） | ✓ |
| §3：复用 warning-bg/warning-text/warning-border 视觉，不引组件本体 | L253-264 `.tree-collapse-banner` | ✓ |
| §1/隐含需求 #2：新逻辑落在 watch 重置路径 | L180-190（parseTree 先赋值 treeData 再 resetExpansion） | ✓ 时序安全 |
| P1 隐含需求 #4：DataTreeNode.vue 不改、toggle 契约不变 | 未改动（git diff 确认） | ✓ |

### 5.2 方向 2（实现→设计，僵尸需求检查）

- **watch 中 `expandedPaths.value = new Set()` 预清空（L184）+ `resetExpansion()`（L187）双路径**：resetExpansion 内 `expandedPaths.value = paths` 会覆盖预清空值，无双写冲突；watch 预清空是防御性冗余，与 P2 设计（resetExpansion 全量赋值）兼容，**不构成「设计未覆盖的实现扩展」**——逻辑等价，[OK]
- **实现新增 `scalarLeaf`/`emptyMessageFor` 空输入处理**：P2 §3 边界处理明确要求空输入/标量根安全（隐含需求 #8），实现与设计一致，非超范围扩展
- **无已废弃约束、无为否决方案写的 AC**：候选 B（DataTreeNode 下传）已彻底排除，实现无相关残留，[OK]

---

## 6. 未决项清零

| 项 | P1 声明 | 处理 | 状态 |
|----|---------|------|------|
| SUGGEST-1 单一可配置常量 `DEFAULT_EXPAND_THRESHOLD` | P1§4 | P2§3 采纳，`export const = 2000` 已实现，P6 实测后保持 | ✓ 定稿 |
| SUGGEST-2 折叠提示复用 TruncationBanner 视觉 | P1§4 | P2§3 采纳，内联 banner 同视觉模式 | ✓ 定稿 |
| SUGGEST-3 搜索命中自动展开留 backlog | P1§4 | P2§3 采纳「本次不做」 | ✓ 定稿 |
| NEED_CONFIRM | P1§4 `[NO_NEED_CONFIRM]` | P6§验收 亦声明 `[NO_NEED_CONFIRM]` | ✓ 无残留 |

无 `[BLOCKER]` / `[DEVIATION-CRITICAL]` 残留（P1/P4/P6 三文件 grep 均无）。

---

## 7. 红线阈值一致性（BDD-8 ↔ P2 §8）

P2§8 redline_protocol 判定标准（500ms 预算 + 取值规则 + 10s 白屏超时）与 P6 实测结果完全一致：

| 量级 | P6 实测 | P2§8 预算≤500ms | 判定 |
|------|---------|----------------|------|
| 100 | 45.8ms | ✓ | 满足 |
| 500 | 141.9ms | ✓ | 满足 |
| 1000 | 206.5ms | ✓ | 满足 |
| 2000 | 297.2ms | ✓ | 满足 |
| 5000 | 787.7ms | ✗ | 超预算 |

- P2§8 取值规则「5000 若超预算 → 降档取 2000」→ **实测 5000 超预算 → 阈值保持 2000**，与 `DEFAULT_EXPAND_THRESHOLD = 2000`（TreeView.vue:49）一致，**无需回 P4 改常量**。
- P2§8 ③「P6 据证据更新阈值并重跑 BDD-1/3 边界」：阈值未变（保持 2000），BDD-1（9 节点小文件）与 BDD-3（10021 大文件）均在 P6 重跑 PASS。
- P2§8 白屏判定「5000 无白屏」：实测 5000 量级 787ms 正常完成渲染、页面持续响应、无超时——满足「实测覆盖到 5000 节点且不白屏」。
- P2 §4.3 BDD-4 fixture 选型（根→20 子树 × 500 叶子，单次点击渲染受控）与 P6 BDD-4 实测路径（点根→21 节点、点子树→521 节点）一致。
- P2 §8 归一化口径（阈值以下先折叠再点击）与 p6-redline-bench.ts 实现（initialNodes>1 时先折叠根）一致。

---

## 8. 跨文件一致性附加检查

| 检查项 | 源文件节名 | 结论 |
|--------|-----------|------|
| P3 fixture ↔ P6 fixture | P3§映射 / P6§fixture | 一致：单测深层链 `buildDeepChain(THRESHOLD+2)`（P3）与 spec 实码（L300/329）匹配；E2E `t094-large`（10021，20×500）与 P6 fixture 同结构 |
| P3 单测 ↔ spec 实码 | P3§映射 / TreeView.spec.ts | 17 用例实存（含 test_bdd_27/28 更新 + 新增 test_bdd_1/3/6/7），与 P3 表逐条对应 |
| P3 E2E ↔ e2e spec | P3§映射 / structured-data-viewer.spec.ts | 新增 test_bdd_1~7 + 更新 27/28 实存，`SMALL_TOTAL`/`LARGE_TOTAL` 常量引用与 fixture 一致 |
| P4 retry1 修复 ↔ P5 失败根因 | P4§retry1 / P5§e2e | 3 处修复（:scope 限定 toggle / .search-match-count / toHaveCount）与 P5 3 个失败根因一一对应，重跑 98/98 全绿 |
| P4 单测自查 ↔ P5 独立验证 | P4§impl / P5§unit | P4 自查 17/17 → P5 独立复跑 1232 passed（含 TreeView 17 用例），不互信依赖 |
| 多文件 P5→P4→P5 回退链 | P5§e2e→P4§retry1→P5§e2e(复跑) | 闭环完整：P5 首轮 4 failed+1 flaky → P4 retry1 修复 → P5 重跑 98/98 EXIT_CODE 0 |
| P6 截图/证据存在性 | P6§验收 → P6-evidence/ | 9 截图 + test-output.log + redline-results.json + redline-test-output.log + 2 脚本 + vision-reports/bdd-1~7.yaml 全部实存且被引用 |
| P6 二值规则 | P6§验收 | 8 条 PASS 行，无「调整/跳过/覆盖」中间态 |

---

## 9. 门禁断言

| gate 断言 | 本产出 |
|-----------|--------|
| BLOCKER=0 | frontmatter `blocker_count: 0`；正文无 `[BLOCKER]` |
| DEVIATION-CRITICAL=0 | frontmatter `deviation_critical_count: 0`；正文无 `[DEVIATION-CRITICAL]` |
| DESIGN_GAP 配对 | P4 无 DESIGN_GAP 声明 → `design_gap_count: 0`，无配对义务（§1 已声明） |
| SCOPE+ 闭环 | §2 判定 + SUGGEST 处理方案（SCOPE+ 声明于 P2，不影响 P1 BDD 基线） |
| 跨文件引用 | §3/§4/§5/§8 引用 P1§BDD / P2§packages / P2§5 / P2§8 / P4§impl / P4§retry1 / P6§验收 节名锚点 |

**P7 gate 预判：exit 0**（`[DEVIATION]` 为普通级不阻塞；DEVIATION 处理为架构师角色标准流程，无 CRITICAL）。

---

## 10. 审查者说明

- 全程只读：未修改任何产出文件、未触碰生产环境（[PROD_NOT_TOUCHED]）。
- 本任务 commit 历史干净（P1→P6 六次 `wf(TPV0094-*)` commit），实现文件仅 TreeView.vue + 两个测试文件。
- working tree 有 4 个非本任务 dirty 文件（`backend/peekview/static/index.html` + 3 个 zip 测试产物），与 TPV0094 无关，为构建/既有测试残留，建议主 Agent 视情清理。
