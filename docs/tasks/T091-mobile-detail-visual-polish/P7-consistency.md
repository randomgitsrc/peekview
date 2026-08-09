---
phase: P7
task_id: T091-mobile-detail-visual-polish
type: consistency
parent: P1-requirements.md / P2-design.md / P4-implementation.md / P6-acceptance.md
agent: consistency-reviewer
---

# P7-consistency — T091 移动端详情页视觉打磨

发布前最后一道质量门。对照 P1-P6 全部产出做跨文件一致性审查，逐条给出结论。

## 1. DESIGN_GAP 配对（核心必查项）

**转抄**（`P4-implementation.md` L39-62，"其余 46 passed 覆盖范围"章节之前）：

> [DESIGN_GAP: markdown-body 左侧 inset 断言的测量方法与 CSS box model 矛盾，导致 4 处测试恒定失败]
>
> 失败测试：`t090-mobile-detail-ux-polish.spec.ts::test_bdd_8_markdown_mobile_inset_symmetric_24px`、`t091-mobile-detail-visual-polish.spec.ts::test_bdd_3_markdown_body_16px_padding_24px_total_inset`（chromium + Mobile Chrome 各 2 条，共 4 条）。
>
> 根因：`getBoundingClientRect()`/`boundingBox()` 返回元素自身的 border-box 位置，由**父元素的 padding + 自身 margin-left** 决定，不受元素**自身 padding** 影响——这是标准 CSS 盒模型行为。P3 测试断言 `.markdown-body` 自身的 `boundingBox().x` 期望落在 24px±2 区间，但 `.markdown-body` 自身 padding 只会推动其**子内容**，不会移动它自己的 border-box 左边缘，因此该断言在任何合法实现下都无法达成（实测恒为 8px，即仅 `.content-area` 的父 padding）。implementer 判定这是 P2/P3 阶段固化下来的测试设计矛盾，不是 P4 实现问题（`padding: 16px` 的 CSS 断言已独立验证通过），按派发指引未擅自改测试或改实现，仅标记 `[DESIGN_GAP]` 并给出建议方向：改测 `.markdown-body` 内部第一个子元素的 `boundingBox().x`。

[DESIGN_GAP_REVIEWED] 该问题已被处理，未遗留为未决项。orchestrator 独立核实 implementer 的诊断成立（`P4§DESIGN_GAP`，L47-58 的盒模型推导正确），随即派发 test-designer 角色做定向修复（`.state.yaml` L120-123 `test_fix_dispatched`），修复范围严格限定为"改测量目标"，未触碰阈值/常量/其他断言。本 Agent 直接读取修复后的源码验证：`frontend-v3/e2e/t091-mobile-detail-visual-polish.spec.ts:105-113` 与 `frontend-v3/e2e/t090-mobile-detail-ux-polish.spec.ts:311-327`（对应函数 `test_bdd_3_markdown_body_16px_padding_24px_total_inset` / t090 的对应 BDD-8）均已把测量对象从 `md`/`.markdown-body` 自身改为 `md.locator('> *').first()`（第一个子元素），并附代码内注释 `// .markdown-body's own boundingBox().x sits at content-area's padding edge regardless of .markdown-body's own padding (CSS box model); measure the first child instead.`，与 implementer 建议的修复方向完全一致。修复后 `E2E_SPEC=e2e/t09 make debug-test` 由 orchestrator 独立重跑确认 50 passed/0 failed（`.state.yaml` L126-128 `main_verify_fix`），P4-implementation.md L64-66 "其余 46 passed" 一节所述测试范围随之收敛为全绿，P5 retry1（`.state.yaml` L188-193）、P6 retry1（`P6-acceptance.md` BDD-3 PASS 条目，L49）均在此修复后的代码上重新独立验证通过。**结论：该 DESIGN_GAP 已完整闭环，无遗留风险，`DESIGN_GAP_REVIEWED`。**

## 2. SCOPE+ 闭环

`P1-requirements.md` 全文 grep 确认无行首 `[SCOPE+]` 标记（实测命令 `grep -n "\[NEED_CONFIRM\]\|\[BLOCKER\]\|\[DEVIATION-CRITICAL\]" P1-requirements.md` 无匹配；`grep -n "SCOPE+" P1-requirements.md` 无匹配）。`P0-brief.md` L17 已明确"范围扩展（用户明确要求，P1 派发前已定型，非事后 `[SCOPE+]`）"——9 viewer 范围扩展是立项阶段（`.state.yaml` P0 `scope_expand` 记录，L35-37）与用户讨论后定型写入 P0-brief 的既定范围，不是 P1-P6 执行过程中新发现的隐含需求，因此不适用 `[SCOPE_RESOLVED]` 标记机制（该机制服务于"执行中发现→标记→回补基线"的场景，本任务不存在这一场景）。全程唯一一次"发现→处理"式的偏差是 P4 阶段的 `[DESIGN_GAP]`（见上一节），性质是测试设计矛盾而非需求范围增补，两者不应混同。

**结论：无 SCOPE+ 项，此项天然闭环，不需要 `[SCOPE_RESOLVED]` 标记。**

## 3. 跨文件一致性

### 3.1 P1 BDD 数与 P6 PASS 数的内容对应（非仅数字匹配）

`P1-requirements.md§3 BDD验收条件` 声明 13 条 BDD（BDD-1 至 BDD-13）。`P6-acceptance.md§BDD逐条对照` Summary 为 "13/13 PASS, 0 FAIL"（L103）。逐条核对内容对应关系（非仅数量吻合）：

| BDD | P1 判定要点 | P6 PASS 条目对应内容 | 内容匹配 |
|---|---|---|---|
| BDD-1 | `scrollWidth<=clientWidth`，纯 DOM 判定 | `scrollWidth(364)===clientWidth(364)`，实测于真实可滚动场景 | 是 |
| BDD-2 | (a) `offsetHeight>=71px` (b) vision 呼吸感 | `offsetHeight=89px` + vision 报告两行布局留白清晰 | 是 |
| BDD-3 | padding=16px，总留白24px，vision 对齐确认 | padding-left/right=16px + vision 确认对齐 | 是 |
| BDD-4 | padding-top===padding-bottom（4px/4px） | 实测 4px/4px | 是 |
| BDD-5 | Copy 图标化，无蓝底，对齐桌面端 | class=`icon-btn`，截图确认无背景色 | 是 |
| BDD-6 | Copy 44×44 触控热区 | `{width:44,height:44}` | 是 |
| BDD-7 | Wrap 两态视觉可辨识 | `toggle-btn`→`toggle-btn active`，灰→蓝 | 是 |
| BDD-8 | Wrap 44×44 触控热区 | `{width:44,height:44}` | 是 |
| BDD-9 | 10 viewer 一致性（Given 子句列出 10 个 entry） | 10 个 entry 全部复测，`clippedChildren:0` | 是 |
| BDD-10 | Image viewer 例外，首屏/可用尺寸/无冲突三点 | 三点逐一给出可解释的差值拆解 | 是 |
| BDD-11 | Html viewer 例外，同上三点 | 同上三点，含 iframe text-selection artifact 排查说明 | 是 |
| BDD-12 | 桌面端 padding 相等（非"不低于"） | 24px===24px（改动前后相等） | 是 |
| BDD-13 | 桌面端无 mobile 专属组件 | `.mobile-bottom-bar`/`.meta-tags-bar` 均不存在，`.meta-row` 存在 | 是 |

未发现"数量对但内容错位映射"问题（P7 派发指引"常见错误 2"所警示的情形不成立）。

### 3.2 P2 改动文件清单与 P4 实际改动的吻合度

`P2-design.md§1 改什么`（L31-38）列出：`EntryMetaTagsBar.vue`、`MarkdownViewer.vue`、`EntryDetailMobileBar.vue`、`DESIGN.md`、`t090-mobile-detail-ux-polish.spec.ts`（手术式改 BDD-7/8）、新增 `t091-mobile-detail-visual-polish.spec.ts`。

`P4-implementation.md§改动文件清单`（L19-24）与之逐项对应，且用 `git show --name-only` 核对两次实际 commit：
- `34015a81`（P4 首次实现）：`DESIGN.md`、`frontend-v3/e2e/t090-mobile-detail-ux-polish.spec.ts`、`frontend-v3/e2e/t091-mobile-detail-visual-polish.spec.ts`、`frontend-v3/src/components/EntryDetailMobileBar.vue`、`frontend-v3/src/components/EntryMetaTagsBar.vue`、`frontend-v3/src/components/MarkdownViewer.vue`、外加 `backend/peekview/static/index.html`（`make build-frontend` 的构建产物，2 行改动为资源哈希引用更新，非手工改动，不计入源码改动清单）——与 P2 声明的 6 个源文件完全一致。
- `25b035f0`（P4 重试#1，见 3.4 节）：仅 `frontend-v3/src/components/EntryMetaTagsBar.vue` + 同一构建产物文件。

`git diff` 实际内容核对（`.meta-tags-bar` padding 8/12→16/16 + `overflow-x:auto`→`flex-wrap:wrap`；Copy `.bottom-btn.primary`→`.icon-btn`；Wrap `.bottom-btn`→`.toggle-btn`+`WrapTextIcon`+`aria-label`/`aria-pressed`）与 `P2-design.md§1` 表格描述、`P4-implementation.md§改动文件清单` 描述三方逐字段吻合，无遗漏无越权改动。

### 3.3 packages 声明核实

`P2-design.md§0`（L20）声明 `packages: [frontend-v3]`。实际改动文件中 `frontend-v3/src/components/*.vue`、`frontend-v3/e2e/*.spec.ts` 均在 `frontend-v3/` 目录下；`DESIGN.md` 位于仓库根（非 `frontend-v3/` 内，P2-design.md 在文件清单表格下方已自行注明"DESIGN.md 位于仓库根，非上述目录，单独说明"，`P4-implementation.md` L15 同样显式标注这一点，非遗漏）；`backend/peekview/static/index.html` 是 `make build-frontend` 的自动生成产物（前端构建产物按项目约定复制到该路径供 pipx 打包），不是手工编辑的 backend 源码，`git show --stat` 确认该文件改动仅 2 行（资源引用哈希），两次 T091 相关 commit 均无其他 `backend/`、`packages/mcp-server/` 下的源码改动。**结论：本任务全部实质性源码改动确实都在 `frontend-v3/` 目录下，`DESIGN.md`（仓库根文档）与构建产物（`backend/peekview/static/`）是已知且文档化的例外，不构成对 `packages: [frontend-v3]` 声明的违背。**

## 4. 未决项清零

对 `P1-requirements.md`、`P2-design.md`、`P4-implementation.md`、`P6-acceptance.md` 四个正式产出文件执行 `grep -n "\[NEED_CONFIRM\]\|\[BLOCKER\]\|\[DEVIATION-CRITICAL\]"`，**无匹配**（exit code 1）。

进一步对全任务目录（含 dispatch-context 文件）执行 `grep -rln` 同一模式，命中的文件仅为 `P4-dispatch-context-*.md`、`P6-dispatch-context-*.md`、`P7-dispatch-context-consistency-reviewer.md` 这类"角色说明"文件，且命中行均是形如"- [ ] SCOPE+ 已处理（若本阶段产生）"、"2. 自行加范围外改动...→ 标 [SCOPE+]"这类**派发指引里对 subagent 的操作说明文字**，不是真实触发的标记（这些文件是给 subagent 的指令模板，不是产出物）。核对 `P1-requirements.md§4 待确认清单` 结尾为 `[NO_NEED_CONFIRM]`（L152），与上述 grep 结果一致。

**结论：确认派发指引第 24 条的判断成立——P1-P6 正式产出文件中无真实触发的 `[NEED_CONFIRM]`/`[BLOCKER]`/`[DEVIATION-CRITICAL]` 残留，全部命中均为角色说明文字。**

## 5. P6 退回重做的完整性核实

依据 `.retreat-history.md` 与 `.state.yaml` 交叉核实：

1. **归档完整性**：`docs/tasks/T091-mobile-detail-visual-polish/.archived/20260809-175444-P6/` 下确认存在 `P6-acceptance.md`（13743 字节）与 `P6-evidence/` 目录，与 `.retreat-history.md` 记录的归档路径一致，回退前的第一版 P6 产出已正确保留，未被覆盖丢失。
2. **失败详情记录**：`.retreat-history.md` 记录 FAIL BDD-2（`offsetHeight` 实测 33px < 71px 阈值）与 FAIL BDD-9（10 entry 中 5 个受同一根因影响，`clippedTags` 计数为证据主口径而非纯视觉判断），根因均归为 `EntryMetaTagsBar.vue` 的 scoped `flex-wrap` 规则未显式声明 `overflow-x`/`white-space`，被 `frontend-v3/src/styles/layout.css:466-478` 的全局遗留规则级联覆盖，与 `.state.yaml` L20-21（P5 retry）、L23-25（P4 retry）两处 retry 记录的 `reason` 字段描述逐字一致。
3. **重新验收的独立性**：`P6-acceptance.md`（`retry: 1`，L7）开篇明确声明"本轮为完整重新走 13 条 BDD，不复用上一轮任何 PASS/FAIL 结论，所有截图/DOM 测量均为本轮新产出"（L16），且给出具体佐证：11 个测试 entry 均重新通过 `GET /api/v1/entries/{slug}` 200 核实存在（L22），`markdown-test` 的可滚动状态本轮通过 `?firstFileId=18` 重新核实触发（L23），evidence 目录列出全新的 `dom-measurements.json`/`bdd9-clipcheck-10viewers.json`/`bdd10-image-zoom-swipe-assertions.json`/20 张去重截图/独立的 `P6-vision-20260810-retry1.yaml`（L28-32，文件名与时间戳均区别于归档版本），不是"挑几条改改"的局部复用。13 条逐一核对（本文件 3.1 节表格）内容均对应真实的本轮实测数据（如 BDD-9 明确写出此前受影响的 5 个 viewer 本轮逐一复核确认恢复），而非笼统带过。
4. **修复范围与诊断原因的对应**：`P4-implementation.md§P4重试#1`（L68-86）"退回原因摘要"与"改动"两节：诊断原因是 `EntryMetaTagsBar.vue` scoped 规则被 `layout.css:466-478` 全局同名规则覆盖；修复范围精确为该文件 `<style scoped>` 内 `.meta-tags-bar` 规则新增 `overflow-x: visible; white-space: normal;` 两条声明（L74-79 diff），且 L83-84 显式声明"未改动 `layout.css` 的全局规则本身"、"未改动 `MarkdownViewer.vue`/`EntryDetailMobileBar.vue`/`DESIGN.md`（上一轮已 approved，本轮不涉及）"。`git show --name-only 25b035f0` 实测确认改动文件仅 `EntryMetaTagsBar.vue` + 构建产物，无越界改动，诊断原因与修复范围精确对应，未借回退之机夹带其他改动。

**结论：P6 退回重做的完整性核实通过——归档完整、失败详情记录准确、重新验收独立且非局部复用、修复范围与诊断原因精确对应。**

## 总体结论

无 `[BLOCKER]`，无 `[DEVIATION-CRITICAL]`。DESIGN_GAP 已完整转抄并配对 `DESIGN_GAP_REVIEWED`。SCOPE+ 天然闭环（无增补项）。跨文件一致性五项检查（BDD↔PASS 内容对应、改动文件清单吻合、packages 范围核实、未决项清零、P6 退回重做完整性）均通过，逐条附源文件节名与实测证据。**T091 可进入 P8 发布准备阶段。**
