---
phase: P1
task_id: TPV0088-e2e-test-infra-hardening
type: review
parent: P1-requirements.md
trace_id: TPV0088-P1-review-rev2-20260812
status: approved
created: 2026-08-12
agent: requirements-review
---

# P1 需求基线评审（修订后复核）— TPV0088 E2E 测试基础设施加固

评审方式：依据 dispatch-context 修订核对清单逐项核对修订后 `P1-requirements.md`，对照上轮 `P1-review.md`（needs-revision）所列修订项，逐条确认落地情况。本轮为修订复核，不对 BDD 实质做全新重构式评审，仅核验修订是否落地 + 是否引入新问题。

**结论：approved。** 上轮 1 硬性 + 3 建议项全部落地，修订后全文档 19 用例计数一致，mtime 比对口径统一，未引入新的判定歧义或计数冲突。详见下。

## 修订核对清单（dispatch-context 强制项）

1. **修订项 1（硬性）"20 用例"→"19 用例"：已落地。**
   - BDD-1（P1-requirements.md:96-99）：标题"全部 19 用例在 debug backend 实跑通过"，Then 改为 `19/19 用例 PASS（非抽样，非 skipped 计数为假绿）`——字面可达，二值可判 ✓
   - §1 复述（:41）："19 用例全部预期失败"，并显式说明 P0 审计记为 20 但实际仅 19 条 `test()`（Code Viewer 5 + Markdown 4 + Responsive 4 + Theme 2 + File Ops 3 + Entry List 1），且"本基线以实际 19 为准"——对上轮"若 P0 曾有意计入 20 需显式声明"的要求做出了明确处理 ✓
   - P6 节（:150）："实跑 19 用例（非抽样）" ✓
   - 风险表（:167）："BDD-1 要求 19/19 实跑非抽样" ✓
   - capability_requirements（:19）："E2E 全部 19 用例" ✓
   - grep 全文档：无残留 `20/20` 或"20 用例"断言（仅 §1 :41 中"P0 审计记为 20 用例"的历史说明，非现状声明，语义正确）✓
2. **建议项 2 mtime 比对口径统一：已落地。**
   - IMPL-B2（:73）："校验基准统一为 `frontend-v3/src/` 最新 mtime vs `backend/peekview/static/index.html` mtime（即 `find frontend-v3/src -newer backend/peekview/static/index.html` 有输出即判过期）"，并明确 `dist/` 仅作 build 中间产物说明、不作为比对基准，"与 SUGGEST 表述口径一致" ✓
   - SUGGEST（:90）："比对用 find frontend-v3/src -newer backend/peekview/static/index.html" ✓
   - 两处表述完全对齐，上轮"src/dist 口径差"已消除 ✓
3. **建议项 3 debug-stop 清理范围示例：已落地。**
   - IMPL-B2（:73）："debug-stop 只清理 /tmp/peekview-debug（运行时数据目录），不涉及 static 产物"——与实际 Makefile 行为一致，不再出现"清 dist/static"的误导示例 ✓
4. **建议项 4 风险表引用同步：已落地。** 风险表首行（:167）已改为 "19/19 实跑"，无 20/20 残留 ✓
5. **BDD 编号连续 + frontmatter 机器字段：未破坏。**
   - BDD-1~BDD-9（:96/:101/:106/:111/:116/:123/:128/:133/:140）连续不跳号 ✓
   - frontmatter 完整：phase/task_id/type/parent/trace_id/status/created/agent/risk_level/phases/packages/domains/capability_requirements 均在，风险等级 medium、裁剪 phases、packages [frontend-v3, makefile, scripts]、domains [test-infra, frontend] 未变 ✓

## BDD 评审（修订后逐条判定）

- **BDD-1**（全部 19 用例实跑通过）：**PASS**。覆盖维度：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓。计数修正为 19/19，字面可达、非抽样、非 skipped 假绿措辞保留；Given（:8888 + seed 四 entry）与 When（`E2E_SPEC=e2e/viewer.spec.ts make debug-test`）可执行。✓
- **BDD-2**（路由 history 模式）：**PASS（未变，上轮已核）**。覆盖维度：前端✓。`无任何 /#/entry/ 残留，全部为 /{slug}` 可 grep 二值判定。✓
- **BDD-3**（死选择器替换）：**PASS（未变，上轮已核）**。覆盖维度：前端✓ 数据✓。禁止/允许双侧白黑清单保留，无中间态。✓
- **BDD-4**（slug 映射现存 seed entry）：**PASS（未变，上轮已核）**。覆盖维度：数据✓ 前端✓。TC→seed 映射保留且无 lu4prg/ngajri。✓
- **BDD-5**（TC-041 单文件断言）：**PASS（未变，上轮已核）**。覆盖维度：数据✓ 前端✓ 边界✓。json-api-config 单内容文件 + EntryDetailContent.vue:4 `v-if` 成立。✓
- **BDD-6**（过期 static 被拦截）：**PASS（未变）**。覆盖维度：边界✓ 兼容✓。Given/When/Then 三段可执行可判定；与修正后 IMPL-B2 基准（src vs static/index.html）一致。✓
- **BDD-7**（新鲜 static 放行）：**PASS（未变）**。覆盖维度：边界✓ 兼容✓。✓
- **BDD-8**（正常流程不误伤）：**PASS（未变）**。覆盖维度：边界✓ 兼容✓。✓
- **BDD-9**（数据隔离不被破坏）：**PASS（未变，附条件）**。覆盖维度：多端✗ 边界✓ 兼容✓。5 项既有检查保持 + 生产无 e2e- 前缀数据，可判定。✓

## 隐含需求覆盖（修订后核验）

- **数据维度：覆盖充分（IMPL-D1~D4）**，未变。✓
- **前端维度：覆盖充分（IMPL-S1~S12）**，未变。✓
- **多端维度：显式声明无影响（IMPL-M1）**，未变。✓
- **边界维度：覆盖充分（IMPL-B1~B3）**。B2 已按修订项 2/3 修正：基准统一为 src 最新 mtime vs static/index.html mtime，debug-stop 清理范围修正为仅 /tmp/peekview-debug、不涉 static。上轮两个口径问题已消除。✓
- **兼容维度：覆盖充分（IMPL-C1~C3）**，未变。✓

## 裁剪评审（未变，上轮已核）

- **P2 简化**：`follows_existing_pattern` 成立（修复既有 spec / 往既有 shell 脚本加一段逻辑）。✓
- **P3 最小 TDD（仅子任务 B）**：shell 校验逻辑可测；子任务 A 以 BDD-1 实跑为验收锚点。✓
- **P5 缩减**：后端无改动，`make test-quick` 全绿确认未波及即可。✓
- **P6 不可裁剪**：验收锚点明确（19 用例实跑非抽样 + mtime 两态实测，计数已同步为 19）。✓
- **P7 不可裁剪**：三文件跨文件一致性核对必要。✓
- **risk_level: medium**：与实际风险匹配。✓
- **capability_requirements 三态**：三项均 available，无 GAP。✓

## P1 纯净性（未变）

9 条 BDD 停留在"用户/系统行为可判定"层面，IMPL-S* 的方向性提示经事实核实、属需求级陈述，未越界到 P2 方案设计。✓

## 待确认处理（未变）

`[NO_NEED_CONFIRM]` 理由充分；`[SUGGEST]`（Check 6 集中放 e2e-safety-check.sh）方向合理，主 Agent 可自行采纳。✓

## 结论

上轮评审的全部修订项（1 硬性 + 3 建议）均已落地且未引入新问题：BDD-1 的 19/19 计数全文档一致、可二值判定；mtime 比对口径 src-vs-static 统一；debug-stop 清理范围示例与实际一致；风险表无 20/20 残留；BDD 编号连续、frontmatter 机器字段完整。**Verdict: approved**，可推进 P2。
