---
phase: P7
task_id: T090-mobile-detail-ux-polish
type: consistency
parent: P6-acceptance.md
trace_id: T090-P7-20260810
status: approved
created: 2026-08-10
agent: consistency-reviewer
---

# P7-consistency — T090 移动端详情页 UX 打磨

## 结论摘要

BLOCKER=0, CRITICAL=0, DESIGN_GAP 未配对=0（3/3 转抄并 REVIEWED），SCOPE+ 闭环=自动满足（无 SCOPE+ 声明），未决项=清零。**status: approved**，可进入 P8。

---

## 1. DESIGN_GAP 配对（P4-implementation.md「## [DESIGN_GAP] 声明」→ 本节标准格式转抄）

> 背景说明（继承自 dispatch-context）：P4-implementation.md 的 `## [DESIGN_GAP] 声明` 一节用带小标题的段落式写法记录了 3 处问题，未采用协议行首 `[DESIGN_GAP: 描述]` 单行 tag 格式，故 `grep -cE '^\s*-?\s*\[DESIGN_GAP:'` 在该文件里命中 0 条。本节按标准格式转抄，并逐条给出代码级复核证据（非仅采信 implementer/主 Agent 自述）。

### DESIGN_GAP 1 — T079-entry-detail-header.spec.ts 联动修改

[DESIGN_GAP: T079-entry-detail-header.spec.ts 未列入 P2 §0 files_to_read 清单，但因 EntryDetailHeader.vue 删除 .meta-tags-bar 模板/CSS 而必须联动修改（3 处既有单测：BDD-15 两条 + 空 tags 一条，均断言旧 DOM 位置）]

**来源**：P4-implementation.md「改动/新增文件清单 > 因删除 setupScrollHide/metaTagsHidden 而联动修改的既有单测」节 + 「[DESIGN_GAP] 声明」第 1 条。

**代码级复核**：
- `frontend-v3/src/components/__tests__/T079-entry-detail-header.spec.ts` 全文 grep `metaTagsHidden`/`meta-tags-bar`/`BDD-15` 均 0 命中——3 条断言旧 DOM 位置的测试确已按批准方案整体清理，未遗留失效断言。
- `frontend-v3/src/composables/__tests__/useResponsiveLayout.spec.ts`、`useResponsiveLayout.boundary.spec.ts` 两个文件路径均已确认不存在（已整体删除），与 P4 改动清单声明一致。
- P4-implementation.md「自查结果」：`make test-frontend` 92 个测试文件、1215 个测试全绿（4 skip，既有 skip 与本次无关）——功能未新增专门单测覆盖 `EntryMetaTagsBar.vue`，符合 P3-test-cases.md「不需要新增关于已删除功能的单元测试」精神，且 P1/P2 均未显式要求为新组件补单测（P2 §5 完成标志未列此项）。

[DESIGN_GAP_REVIEWED: T079-entry-detail-header.spec.ts 联动清理已在代码层面确认收口——3 条旧断言已删除、无残留失效引用，`make test-frontend` 全绿；未新增单测覆盖新组件不构成 P1/P2 要求的缺失，属可接受的最小改动范围。判定：非偏离，非阻断，PASS。]

---

### DESIGN_GAP 2 — BDD-8 计量口径不一致

[DESIGN_GAP: BDD-8（markdown 移动端留白缩减 ≥75%）P4 自查阶段实测卡在 60%，根因是 P1 BDD-8 文字表述"左右两侧间距之和"与 P0-brief/P2 §2 候选3-A 一贯使用的"单侧计量"口径不一致，P3 测试忠实按字面实现了两侧相加，导致基线(40,单侧)与实测(相加值)分母分子口径错配]

**来源**：P4-implementation.md「[DESIGN_GAP] 声明」第 2 条 + P4-gate-diagnosis.md「DESIGN_GAP 1」诊断与批准记录。

**批准处理方式**（P4-gate-diagnosis.md）：①P1-requirements.md BDD-8 追加 `[BASELINE_CHANGE]` 澄清注释，明确单侧口径，不改 Given/When/Then 语义；②E2E 测试改为单侧测量（`leftInset`，对称场景取左侧代表单侧值）。

**代码级复核**：
- `P1-requirements.md` BDD-8 节末尾确有 `[BASELINE_CHANGE: 澄清 BDD-8 计量口径——"基线约40px"与"目标10px或更小"均为单侧...]` 澄清注释（P1-requirements.md L114），未改动原 Given/When/Then 语义（BDD-8 主体文字未变，仅追加澄清）。
- `frontend-v3/e2e/t090-mobile-detail-ux-polish.spec.ts` L315-322：`leftInset`/`rightInset` 分别独立测量，先断言 `Math.abs(leftInset - rightInset) <= 2`（对称性检查），再用 `reductionRatio = (MARKDOWN_MOBILE_BASELINE_INSET_PX - leftInset) / MARKDOWN_MOBILE_BASELINE_INSET_PX`（单侧 `leftInset` 对比单侧基线 `40`），与批准方案②完全一致，不再是"两侧相加"。
- `P6-acceptance.md` BDD-8 条目：`left=8px, right=8px（对称，误差 0 ≤ 2px 阈值），相对基线单侧 40px 缩减比例 80%（≥75% 门槛）`，PASS。P6 还额外记录了一处独立发现的验证环境滚动条 artifact（CDP mobile emulation 布局滚动条 10px 干扰首次测量），已用注入 CSS 隐藏滚动条规避，复测后 8px 对称，与 P5 E2E（Playwright 自带浏览器无此 artifact）结果一致——此为 P6 verifier 独立发现并处理的验证环境问题，不影响本 DESIGN_GAP 的收口判断（口径不一致问题在 BDD-8 达标结果层面已确认解决）。

[DESIGN_GAP_REVIEWED: BDD-8 口径不一致已通过 P1 `[BASELINE_CHANGE]` 澄清 + E2E 测试改单侧测量两步收口，P6-acceptance.md BDD-8 记录实测 80% 缩减、PASS，达 75% 门槛且有余量。候选 3-A（P2 §2）物理实现未变（仍是"归零 markdown-body margin/padding，不改 content-area”），偏差纯粹是 P1 文字表述与 P3 测试实现口径错配，已按批准方案闭环，非设计缺陷。判定：非偏离，非阻断，PASS。]

---

### DESIGN_GAP 3 — BDD-6 file-tree 选择器歧义 + copy 断言假设错误

[DESIGN_GAP: BDD-6 file-tree 按钮测试因 `page.getByText(/^Files ·/)` 选择器歧义（命中 EntryDetailContent.vue 抽屉头部 span 与 FileTree.vue 内部既有 h3 两个元素）导致 strict-mode 失败，且修复选择器后进一步暴露 copy 步骤断言假设了实际不存在的 `role="status"` toast 反馈（既有行为，非本次改动引入）]

**来源**：P4-implementation.md「[DESIGN_GAP] 声明」第 3 条 + P4-gate-diagnosis.md「DESIGN_GAP 2」+「追加诊断」两段批准记录。

**批准处理方式**（P4-gate-diagnosis.md）：①选择器收窄到 `.drawer-header` 范围内；②copy 断言从等待 `role=status` 改为校验剪贴板实际内容（`clipboard-read/write` 权限 + `navigator.clipboard.readText()`），与项目既有测试惯例（`viewer.spec.ts`/`structured-data-viewer.spec.ts`/`html-render.spec.ts`）一致。

**代码级复核**：
- `frontend-v3/e2e/t090-mobile-detail-ux-polish.spec.ts` L250：`page.locator('.drawer-header').getByText(/^Files ·/)`，选择器已收窄，与批准方案①一致。
- 同文件 L241：`await context.grantPermissions(['clipboard-read', 'clipboard-write'])`；L273-274：`const clipboardText = await page.evaluate(() => navigator.clipboard.readText()); expect(clipboardText).toContain('Heading 1')`——与批准方案②一致，未采用 `role=status` 等待。
- `frontend-v3/src/components/EntryDetailMobileBar.vue`/`EntryDetailHeader.vue` 的 copy 按钮实现（`useEntryDetailComputed.ts` 的 `copyContent()`）本次未被 P4 触碰，问题根因（无 toast 反馈）确认属于既有行为而非本次改动引入的回归，未新增 toast 功能（避免 [SCOPE+] 未经确认扩权）。
- `P6-acceptance.md` BDD-6 条目：`copy（剪贴板内容含"Heading 1"）` PASS，且同时记录 file-tree/toc/source-toggle/overflow 四项均按新选择器/新断言验证通过。

[DESIGN_GAP_REVIEWED: BDD-6 选择器歧义与 copy 断言假设错误均已按批准方案在 E2E 测试代码层面收口（`.drawer-header` 收窄 + 剪贴板内容校验），P6-acceptance.md BDD-6 记录 5 项按钮功能全部 PASS。两处均为纯 P3 测试代码 bug，未涉及 P4 实现逻辑改动，也未在未经确认的情况下新增 toast 功能（避免隐性扩权）。判定：非偏离，非阻断，PASS。]

---

## 2. SCOPE+ 闭环

grep 全文确认 `P1-requirements.md` 与 `P4-implementation.md` 均无 `[SCOPE+]` 标记（0 命中）。**无 SCOPE+，闭环检查项自动满足**，不需要 `[SCOPE_RESOLVED]`。

---

## 3. 跨文件一致性检查（逐项引用具体锚点）

### 3.1 P2 §0 `packages: [frontend-v3]` 与 P4 实际改动文件范围

P2-design.md §0 声明字段：`packages: [frontend-v3]`。P4-implementation.md「改动/新增文件清单」逐一核对：

| 文件 | 是否在 frontend-v3 内 |
|---|---|
| `frontend-v3/src/components/EntryMetaTagsBar.vue`（新增） | 是 |
| `frontend-v3/src/composables/useResponsiveLayout.ts` | 是 |
| `frontend-v3/src/components/EntryDetailHeader.vue` | 是 |
| `frontend-v3/src/components/EntryDetailContent.vue` | 是 |
| `frontend-v3/src/components/EntryDetailMobileBar.vue` | 是 |
| `frontend-v3/src/views/EntryDetailView.vue` | 是 |
| `frontend-v3/src/components/MarkdownViewer.vue` | 是 |
| `frontend-v3/src/styles/variables.css` | 是 |
| `frontend-v3/src/composables/__tests__/useResponsiveLayout.spec.ts`（删除） | 是 |
| `frontend-v3/src/composables/__tests__/useResponsiveLayout.boundary.spec.ts`（删除） | 是 |
| `frontend-v3/src/components/__tests__/T079-entry-detail-header.spec.ts` | 是 |
| `DESIGN.md` | **否**（仓库根目录） |

唯一例外是 `DESIGN.md`，不在 `frontend-v3` 目录下。核实这不构成 packages 声明不一致：P1-requirements.md §6「范围声明」的「涉及文件（供 P2/P7 交叉核对）」清单本就显式把 `DESIGN.md` 单独列出（与 8 个 frontend-v3 源码文件并列），且 `packages` 字段在本项目语境下指代码包（供 P8 `bump-version`/`bump-mcp-version` 判定版本 bump 范围，参见 AGENTS.md「版本源」一节），不涵盖仓库级文档文件——`DESIGN.md` 改动是纯文档同步（P2 §3 已定稿修订文字），不产生代码行为，不影响 `frontend-v3` 包的功能边界判定。**结论：P2 §0 packages 声明与 P4 实际改动范围一致，DESIGN.md 为已知且被 P1/P2 双重显式声明的文档类例外，非遗漏。**

P8 尚未执行（`.state.yaml` 当前 `phase: P6`，未见 P8-release.md），P8 实际 bump 范围留待 P8 阶段核对是否仅 bump `peekview`（对应 frontend-v3 打包产物）版本、不涉及 `mcp_server`（`VERSIONS.json` 当前 `peekview: 0.18.0` / `mcp_server: 0.10.0`）——此项按 P2 声明的 `packages: [frontend-v3]` 应仅影响 `peekview` 版本线，供 P8 gate 核对。

### 3.2 P1 的 12 条 BDD 与 P6-acceptance.md 的 12 条 PASS 结果逐条编号对应

| BDD | P1-requirements.md 编号 & Given/When/Then 要点 | P6-acceptance.md 对应结果 | 内容匹配判定 |
|---|---|---|---|
| BDD-1 | markdown 视图移动端上滑无跳变（连续滑动，无一次性跳变位移） | PASS BDD-1：6 采样点，每步 60px scrollTop 对应 60px 位移，最大偏差 0px | 匹配——测的正是"连续位移、无跳变"这一断言目标 |
| BDD-2 | Code viewer 上滑行为与 markdown 一致（跨 viewer 覆盖） | PASS BDD-2：CodeViewer 渲染 .py 文件，6 采样点，模式与 BDD-1 完全一致 | 匹配——同一测量方法应用于 code viewer，验证跨 viewer 一致性 |
| BDD-3 | metadata 可见性完全由文档流位置决定，不做独立显示/隐藏切换 | PASS BDD-3：两条路径（直接滚动 vs 先滚过再回滚）到达同一 scrollTop=300，className/display/opacity/maxHeight 四项计算样式完全相同 | 匹配——直接验证"位置决定可见性、与滚动方向无关"这一核心断言 |
| BDD-4 | 底部操作栏在顶/中/底三个滚动位置屏幕坐标不变 | PASS BDD-4：scrollTop=0/9206/18412 三点，boundingBox x/y 完全相等 (x=0,y=780,390x64) | 匹配 |
| BDD-5 | 两种可视高度下操作栏均完全落在可视区域内、不被裁切 | PASS BDD-5：844px/700px 两种高度下均 `y>=0 且 y+height<=视口高度` | 匹配 |
| BDD-6 | markdown 场景 file-tree/toc/source-toggle/copy/overflow 五按钮功能不变 | PASS BDD-6：五项功能逐一验证（抽屉标题/aria-pressed 切换/剪贴板内容/aria-expanded） | 匹配——且与 §1 DESIGN_GAP 2/3 转抄的测试代码修复对应一致 |
| BDD-7 | 非 markdown/html 场景 wrap 按钮功能不变 | PASS BDD-7：.py 多文件 entry，wrap 按钮 class 切换 + 代码换行视觉确认 | 匹配 |
| BDD-8 | markdown 移动端留白相对基线（单侧40px）缩减≥75% | PASS BDD-8：left=right=8px，缩减比例 80% | 匹配——且与 §1 DESIGN_GAP 1 转抄的口径修复一致 |
| BDD-9 | 375px 极小屏无水平溢出、无文字截断 | PASS BDD-9：scrollWidth=375（等于视口宽度），markdown-body 边界 [8,367] 落在 [0,375] 内 | 匹配 |
| BDD-10 | 桌面端 header/meta-row 滚动行为与改动前一致 | PASS BDD-10：meta-tags-bar 元素计数 0（桌面端不渲染），markdown-body 位置随滚动线性变化 | 匹配 |
| BDD-11 | 桌面端 `.markdown-body` padding 保持 `--space-5`(24px) 不变，判定标准为"相等" | PASS BDD-11：computed style padding 精确等于 24px | 匹配——采用的是"相等"判定，与 BDD-11 消歧后的判定标准一致，未退化为"不低于" |
| BDD-12 | 桌面端不出现 `mobile-bottom-bar`，按钮保留在顶部 header | PASS BDD-12：移动端先正向确认 bar 存在（避免选择器未实现的假阳性），再切桌面端确认计数 0 | 匹配 |

**结论**：12 条 BDD 与 12 条 P6 PASS 结果逐条编号一一对应，且核对了 Given/When/Then 的具体断言内容（非仅比对数量或标题），未发现错位映射。

### 3.3 P4 实现改动与 P2 §2 选定候选方案吻合性（未偷偷换用被否决候选）

- **问题点 1（meta-tags-bar）**：P2 §2 选定候选 **1-B**（抽取为独立组件 `EntryMetaTagsBar.vue`，挂载在 content-area 内，非候选 1-A 的"内联到 EntryDetailContent.vue"）。P4-implementation.md「改动/新增文件清单 > 新增」确认新建了独立的 `frontend-v3/src/components/EntryMetaTagsBar.vue` 文件（非把模板直接塞进 `EntryDetailContent.vue`），代码复核确认该文件确实独立存在且被 `EntryDetailContent.vue` 引入渲染（`EntryDetailContent.vue` L123 `import EntryMetaTagsBar`，L24 `<EntryMetaTagsBar v-if=... />`）——与候选 1-B 一致，未退化为候选 1-A。
- **问题点 2（底部操作栏）**：P2 §2 选定候选 **2-A**（仅 `position:fixed`，`.entry-detail` 的 `min-height:100vh` 不变，不采用候选 2-B 的 `100dvh` 改造）。P4 改动清单及代码复核均确认 `EntryDetailMobileBar.vue` 只改了 `.mobile-bottom-bar` 自身 CSS（`position:fixed`+`env(safe-area-inset-bottom)`+`min-height`+`z-index`），未发现 `EntryDetailView.vue` 的 `.entry-detail { min-height: 100vh }` 被改为 `100dvh`（`grep`「zen-mode」时读到的该行仍是 `min-height: 100vh`）——与候选 2-A 一致，未误用候选 2-B。
- **问题点 3（markdown 边距）**：P2 §2 选定候选 **3-A**（`.markdown-body` mobile 断点 margin/padding 归零，完全依赖 content-area 已有 padding，不改 content-area 本身；非候选 3-B 的"content-area 按 viewer 类型条件应用更小 padding"）。代码复核确认 `MarkdownViewer.vue` mobile 断点是 `margin:0;padding:0`（归零），且 `EntryDetailContent.vue` 的 `.content-area` mobile 水平 padding 未见按 viewer 类型分支的条件 class（如候选 3-B 描述的 `content-area--dense`）——与候选 3-A 一致，未误用候选 3-B。

**结论**：三处实现均严格对应 P2 §2 选定候选（1-B/2-A/3-A），未发现偷换为被否决候选（1-A/2-B/3-B）的情况。

---

## 4. 未决项清零

- `grep -n "NEED_CONFIRM" P1-requirements.md`：仅命中 `[NO_NEED_CONFIRM]`（L142，含已采纳的 `[SUGGEST]` 说明），无残留行首 `[NEED_CONFIRM]`。
- `grep -n "BLOCKER" P1-requirements.md`：0 命中。
- `grep -n "DEVIATION-CRITICAL" P1-requirements.md`：0 命中。
- 全目录 grep `[BLOCKER`/`DEVIATION-CRITICAL` 仅命中 dispatch-context 自身的门槛描述文字（非实际标记），P0/P1/P2/P4/P4-gate-diagnosis/P6 各产出文件均无残留标记。
- P6-acceptance.md 全部 12 条为客观 PASS/FAIL 二值（Summary: PASS 12, FAIL 0），无 `NEED_CONFIRM` 残留。

**结论：未决项清零，PASS。**

---

## 5. [BASELINE_CHANGE] 落实核实（dispatch-context 额外要求项）

P1-requirements.md 共 2 处 `[BASELINE_CHANGE]`：

1. **DESIGN.md L219 滚动隐藏规则替换**（P1 §「[BASELINE_CHANGE] DESIGN.md L219...」节）：P2 §3.1 已产出替换文字（`### Scroll-Hide Meta Bar` → `### Meta Tags Bar (Mobile)`），代码复核确认 `DESIGN.md` 当前含 `### Meta Tags Bar (Mobile)`（L218）章节、grep 全文无 `Scroll-Hide`/`setupScrollHide` 残留字符串——P2 设计与 P4 实现均已落实该基线变更，DESIGN.md 文档与代码行为（`useResponsiveLayout.ts` 已移除 `setupScrollHide`）同步一致。
2. **BDD-8 计量口径澄清**（P1 BDD-8 节末尾追加注释）：已在本文档 §1 第 2 条 DESIGN_GAP 中核实落实（P3 测试改单侧测量，P6 验收 80% 达标）。

**结论：2 处 [BASELINE_CHANGE] 均已在 P2/P4/P6 中正确落实，无遗漏。**

---

## 6. 最终判定

- BLOCKER 标记计数：0（全目录 grep 未发现行首 `[BLOCKER:` 标记）
- DEVIATION-CRITICAL 标记计数：0（全目录 grep 未发现行首 `[DEVIATION-CRITICAL:` 标记）
- DESIGN_GAP 配对：3/3（P4 §「[DESIGN_GAP] 声明」全部 3 条已转抄为标准格式并逐条 REVIEWED，均附代码级复核证据）
- SCOPE+ 闭环：自动满足（无 SCOPE+ 声明）
- 跨文件一致性：3.1/3.2/3.3 三项均引用具体文件节名/编号完成核实，无发现偏离
- 未决项：清零

**status: approved**，建议进入 P8。
