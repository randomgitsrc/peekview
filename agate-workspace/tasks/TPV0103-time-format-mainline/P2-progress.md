## P2 分阶段落盘（architect）

### 1. 读入完成
- 已读 architect.md 角色文件 + P2 派发卡（AGATE_CARD 含 P2 阶段卡片全文）
- 已读 P1-requirements.md（817 行，12 条 BDD + §5.1/§5.2 实测矩阵 + §6.1.1 改动面逐条判定）
- 已读 P1-review.md（approved，2 条非阻塞观察：①process.env.TZ 结论适用域收窄 ②longOffset 段数口径脚注）
- 已读 P0-brief.md（决策推翻声明：TPV0102 P0 决策 1.3「强制带时区名」被推翻）
- 已读 `frontend-v3/src/composables/useRelativeTime.ts`（93 行，唯一改动点：`FULL_DATE_OPTIONS` 六字段 + `formatOffsetDate(date, timeZoneName)` 共用函数）
- 已读 `frontend-v3/src/components/TimeDisplay.vue`（56 行，只透传 `absolute`/`full`，DOM 结构不动）

### 2. 影响面实测（grep 证据）
- `FULL_DATE_OPTIONS` / `formatOffsetDate` 使用点：`useRelativeTime.ts:3,17,18,50,57` —— 仅本文件，无外部引用 → 拆常量零外溢
- `TimeDisplay` 消费方实测 4 处：`EntryCard.vue:35` / `EntryListRow.vue:19` / `EntryDetailHeader.vue:62` / `EntryMetaTagsBar.vue:5`（与 BDD-05「四处」一致）
- 主显断言常量使用点（本次改动面）：
  - `time-display.spec.ts:27(SHORT_OFFSET) 28(FULL_OFFSET) 29(FOUR_DIGIT_YEAR)`，使用处 `:49 :50 :79`
  - `useRelativeTime.spec.ts:37(FULL_OFFSET) 39(SHORT_OFFSET) 40(FOUR_DIGIT_YEAR)`，使用处 `:54 :55 :84 :93`
  - `e2e/tpv0102-...spec.ts:45(GMT_OFFSET) 46(FULL_OFFSET) 47(FOUR_DIGIT_YEAR)`，使用处 `:257 :258 :266 :267 :290 :381 :401(second) :425 :426 :432 :438 :915`
- 与 P1 §6.1 清单逐条对齐：偏移 8 处（spec 2 + e2e 6）+ 秒级 1 处（e2e:401）+ FOUR_DIGIT_YEAR 5 处 + 常量 3 处 + tooltip 保留 5 处 → 实测数目与 P1 一致，0 新增
- 无关但易误伤（P1 §6.4 已提示）：`filter-tabs.test.ts:77` / `expired-warning.test.ts:77` 的 `toBe('2026-07-07 14:30')` 是 vi.mock 提供的 `absolute`，**已合新形态**，不得改动
- `header-layout.test.ts:72-76`（TC-D02）只判 `toBeTruthy()` + `typeof === 'string'` → 新形态下仍绿，不改

### 3. minimal_validation 实测（真实 vitest 1.6.1，三宿主 TZ）
探针：`.agate-tmp/p2/p2-probe.spec.ts` + `.agate-tmp/p2/vitest.p2.config.mjs`（`node_modules` 软链到 `frontend-v3/node_modules`），7 用例全绿 × 3 宿主。
- `TZ=UTC`：`impl=2026/11/10 09:43` / `ref=2026/11/10 09:43` / `equal=true`；`resolvedTimeZone=UTC`、`locale=zh-CN`
- `TZ=America/New_York`：`04:43 === 04:43` / `equal=true`
- `TZ=Asia/Shanghai`：`17:43 === 17:43` / `equal=true`
- 判别力（同判据下的错误变体）：`second` / 6 种 `timeZoneName` / `pinnedTZ` 全部 caught；`hour12:false` **escaped**（三宿主一致）→ 证实 P1「`hour12` 守护点是 BDD-04」为真方向
- **隐藏性证据**：`pinnedTZ` 变体在上海宿主 **escaped**（17:43 === 17:43）、在 UTC/NY **caught** → 与 P1 BLOCKER-C 描述逐条一致（本机绿不算证据）
- tooltip 未回归：`19h ago · 2026/11/10 GMT+00:00 09:43:00 · UTC` —— 三段、含秒、含完整偏移、段 3 等于 `resolvedOptions().timeZone`
- 无效值：`not-a-date` → `—`（不回退）

### 4. 浏览器侧 FIX-A 复验（真实 playwright-core 1.60 + 本地 Chromium）
探针：`.agate-tmp/p2/fixa.mjs` / `fixa2.mjs` / `hour12.mjs` / `dirs.mjs`
- 3 宿主 TZ × 5 locale：`page.evaluate` 内 locale/timeZone 均不传 → ref 恒等于同源 impl（15/15 `equal=true`），`segs` 恒 5
- **未 pin context 跟随宿主 TZ**（关键：证明 `TZ=UTC` 对 e2e 有效）：`TZ=UTC` → `ctxTZ=UTC`；`TZ=Asia/Shanghai` → `ctxTZ=Asia/Shanghai`
- **反例**：模板内 `timeZone:'Asia/Shanghai'` 在 `TZ=UTC` 下 `09:43` vs `17:43`（`equal=false`）→ P1 BLOCKER-C 复现，方案 5 正是消除该不同源
- `hour12:false` 逃逸 4/5（zh-CN/de-DE/ja-JP/sv-SE 逃逸，仅 en-US 抓到）→ 与 P1 数字一致，独立复现

### 5. UI 视觉契约实测（真实 debug 站点 :8888 + 四渲染点 DOM 度量）
探针：`.agate-tmp/p2/gaps2.mjs` / `tags_detail.mjs` / `dirs.mjs`（真实登录 + seed 数据；`page.evaluate` 内把主显 textContent 换成新形态字符串再测，不改源码）
- **四处渲染点 × 桌面1280×800 / 移动390×844 × zh-CN / en-US**：`scrollWidth <= clientWidth`（0 溢出）、同行元素 `gap >= 4px`（0 重叠）、间距集合与改前**完全一致**（卡片 4 / 列表行 11 / 详情 meta-row 4,8 / 移动 tags-bar 4,8）
- **卡片主显宽度**：`zh-CN` 178.7px → 114.4px（-64.3px，-36%）；`en-US` 207.3 → 143，且 **桌面 en-US 卡片 meta 行由 2 行折为 1 行**（高 43 → 19.5px）—— TPV0102 的 `flex-wrap` 压力被解除
- **移动 tags-bar 唯一形态变化（en-US）**：条高 99 → 107px（+8px）。根因实测：时间变短后 44×44 的 `visibility-menu-root` 从第 2 行回到第 1 行，第 1 行行高由 18 撑到 44。**这是向 zh-CN/sv-SE 的 107px 收敛**（两者改前改后均 107），即消除一个 locale 特异的高度差，非回归；行数仍 3、tags 仍 1 行、0 溢出、0 重叠
- 结论：主显变短**不产生新空隙**（间距值不变）；唯一可量化的变化是两个「变好」的方向（en-US 卡片少一行、移动 tags-bar 高度跨 locale 收敛）。VC-1（tooltip 不溢出）与 VC-3（卡片元信息行不溢出）**方向不受影响**

### 6. 产出与自检
- 产出 `P2-design.md`（520 行）：§1 影响面梳理（改 3 项 / 不改 11 项 N1-N11 / 风险 8 条 R1-R8，**均写在 §2 候选方案之前**）→ §2 单候选 A + 4 个被排除方向 B1-B4 + 权衡理由 → §3 实现契约（含参考值两轴同源表 + §3.3 逐落点断言反转契约）→ §4 测试策略与 BDD 落点映射 → §5 gate_commands（工具写入）→ §6 files_to_read（13 条）→ §7 env_constraints → §8 minimal_validation（V1-V8 全部真跑）→ §9 完成标志 → `## UI 设计`（裸标题 + `渲染形态: layout` + `适用维度:` 三维度 + 三类 checklist + VC-9~VC-12 新增可量化契约）→ §10 `[PROD_NOT_TOUCHED]`
- `gate_commands` 由 `agate-md-field-set-gate-commands.py` 写入（23 项，round-trip 自校验通过）：`P3` / `P3_formatter` / `P5` / **`P5_tz_utc`（`TZ=UTC make test-frontend`）** / **`P5_e2e`（`E2E_SPEC=e2e/tpv0102-explore-card-list-ux.spec.ts make debug-test`）** / `P5_e2e_tz_utc` / `P5_backend` / 两条 fitness / lint / typecheck / docs + 9 个 `_timeout_seconds` + `project_module`
- 自检：`check-frontmatter.py` **exit 0**；`check-gate.py P2` 仅因 **P2-review.md 尚未存在** exit 1（其余全部子检查独立验证通过：candidate_count=1、四字段=4、tradeoff/choice 关键词命中、UI 设计节校验 True、dispatch_plan=None 无错）
- 探针清理：`.agate-tmp/p2/` 整目录删除；`make debug-stop` 已执行且数据已清理；`git status --porcelain` 仅 3 个任务目录内 .md

### 7. 环境标记
[PROD_NOT_TOUCHED]
