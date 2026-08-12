---
phase: P2
task_id: TPV0088-e2e-test-infra-hardening
type: review
parent: P2-design.md
trace_id: TPV0088-P2-review-rev2-20260812
status: approved
created: 2026-08-12
agent: plan-design-review
---

# P2 评审（修订后复核）— E2E 测试基础设施加固（TPV0088）

## 结论：approved

上轮评审（TPV0088-P2-review-20260812，needs-revision）提出的 2 个 BLOCKER（问题 1/2）+ 2 个 minor（问题 3/4）已全部修订落地，且本轮逐项对照当前源码复核修订后的断言/行号真实成立。方案骨架与 frontmatter 机器字段未被破坏。按角色门槛映射：approved。

---

## 一、修订核对清单逐项复核

### 问题 1（BLOCKER，S11/TC-012 断言双重不可成立）— 已修订 ✓

修订后 §2.1.3 S11（行 92）：滚动断言改为锚定**滚动容器** `.content-area`——
`expect.poll(() => page.locator('[data-testid="content-area"]').evaluate((el: HTMLElement) => el.scrollTop)).toBeGreaterThan(0)`，备选 `toBeInViewport()` 断言标题进入可视区；**删除** `.toc-item.active` 依赖，并新增修订说明（行 97）明确"不得依赖 `.toc-item.active`"。

本评审逐条复验源码，修订成立：
- `EntryDetailContent.vue:23` `<main class="content-area entry-content" data-testid="content-area" tabindex="-1">` ✓（`data-testid` 实际存在，非虚构）
- `EntryDetailContent.vue:227` `.content-area { flex: 1; overflow-y: auto; ... }` ✓（滚动容器确为 `.content-area`）
- `EntryDetailContent.vue:77` 与 `:107` 均硬编码 `:activeId="null"`；`TocNav.vue:8` active class 条件 `activeId === heading.id` → active 永不出现 ✓（设计说明与源码一致）
- `layout.css:2-8` `.entry-detail { height: 100dvh; overflow: hidden }` ✓（window 不可滚，`window.scrollY` 恒 0，设计弃用 window.scrollY 理由成立）

结论：原"双重不可成立"缺陷已消除。scrollTop>0 断言可成立（markdown-test 内容足够长，点击 toc-item 触发 scrollIntoView）；备选 `toBeInViewport()` 亦成立。不再依赖不存在的 scroll-spy。

### 问题 2（BLOCKER，`--test-mtime` 函数定义次序矛盾）— 已修订 ✓

修订后 §2.2.1（行 111/114/135-139）明确**次序约定**：`check_static_freshness` 函数定义与 `--test-mtime` 自检块**均置于脚本顶部、Check 1 之前**，自检块紧跟函数定义之后（行 136-139）；Check 6 的**调用**仍留在既有 Check 5 之后（行 142-148，只追加不移动，IMPL-C1）。

本评审复核：函数先定义后调用，`bash scripts/e2e-safety-check.sh --test-mtime` 不再出现 `command not found`，P3 gate 命令可正常命中函数并返回退出码（新鲜=0/过期=1/static 缺失=1）。原"两个位置描述只能保留一个"的矛盾已消解——定义+自检块在顶部，调用在尾部，语义自洽。

### 问题 3（minor，S8 `.overflow-item` 文本歧义）— 已修订 ✓

修订后 §2.1.3 S8（行 89）：菜单项改为**精确匹配** `getByText('Download', { exact: true })` 或 `hasText: /^Download$/`，并注明原因（OverflowMenu 含 `Download` 与 `Download as Pack` 两个 Download 开头项，子串匹配命中 2 个触发 strict mode）。

本评审复验：`useEntryDetailActions.ts:83` `label: 'Download'`、`:102` `label: 'Download as Pack'` ✓——两个 Download 前缀项确实存在，精确匹配修订必要且正确。

### 问题 4（minor，files_to_read 行号漂移）— 已修订 ✓

- `EntryDetailHeader.vue`：files_to_read 改为 `:13,36`，标注 `aria-label="Copy" 按钮（:36...）`。本评审复验 `EntryDetailHeader.vue:36` 确有 `aria-label="Copy"` ✓
- `EntryDetailMobileBar.vue`：files_to_read 改为 `:2-39`，标注 `mobile-bar-wrap-btn(:35)`。本评审复验 `EntryDetailMobileBar.vue:35` 确有 `data-testid="mobile-bar-wrap-btn"` ✓

### frontmatter / 方案骨架 — 未被破坏 ✓

- frontmatter 机器字段完整：`candidate_count: 1`、`packages: [frontend-v3, makefile, scripts]`、`domains: [test-infra, frontend]`、`ui_affected: false` ✓
- 四字段（gate_commands / files_to_read / env_constraints / minimal_validation）齐全，与上轮一致，仅 files_to_read 两处行号修正 ✓
- 方案骨架（slug 映射表、S1-S12 替换映射、Check 6 逻辑、Makefile Step 1 env 传递、三态验收、minimal_validation）无结构性改动 ✓

---

## 二、回归确认（上轮"通过项"未受影响）

- BDD-1 19/19 实跑路径、BDD-6/7/8 mtime 三态、BDD-2/3/4 grep 判定标志均保留 ✓
- §8 风险登记新增 TC-012 滚动断言项（行 272）已同步修订：不再依赖 `.toc-item.active`，与 S11 修订一致 ✓
- P3 gate 命令 `bash scripts/e2e-safety-check.sh --test-mtime` 在问题 2 修复后成立 ✓

---

## 三、评审门槛结论

**status: approved**

理由：上轮 2 BLOCKER + 2 minor 全部落地，且本评审对修订依赖的源码事实（`content-area` testid/overflow、activeId 硬编码、layout.css 溢出布局、aria-label 与 wrap-btn 行号、两个 Download 菜单项）逐条复验成立，无遗留、无新增问题。
