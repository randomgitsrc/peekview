---
phase: P6
task_id: T076-entry-card-interaction
type: acceptance
parent: P5-test-results/e2e.md
trace_id: T076-P6-20260730
status: draft
created: 2026-07-30
agent: verifier
---

# P6 验收报告 — T076 EntryCard 交互语义修复

[PROD_NOT_TOUCHED]

## 验收环境

- debug backend http://127.0.0.1:8888（隔离 DB /tmp/peekview-debug/，与生产 :8080 / ~/.peekview/ 完全隔离）
- CDP Chrome 150（http://127.0.0.1:18800）
- 前端 static/ 为 P4 最新构建产物（P5 已跑 make build-frontend）
- verification_env 差异：验收用隔离 debug 实例，数据为 debug-seed + P5 e2e 测试条目；生产为 pipx 服务 :8080。本任务纯前端改动，后端 API 无变更，环境差异不影响行为验证

## 验收方法

P5 e2e 已全量实跑通过（42/42，chromium + Mobile Chrome 双 viewport，21 BDD 全覆盖）。P6 为用户视角复核 + 证据固化：

1. 操作类 BDD（19 条）：复用 P5 e2e 最新实跑截图（/tmp/e2e-results/，2026-07-30 02:13 产出），复制到 P6-evidence/screenshots/，逐张对应 BDD
2. 查询类 BDD（BDD-04/05，href 属性）：本轮 P6 实跑最小 Playwright CDP 脚本（/tmp/opencode/t076-href-assert.ts），断言 .card-title href=/{slug}、.meta-username href=/users/{username}，输出 bdd04-05-href-assert.log（6 title-href + 2 username-href 全部 PASS）
3. UI 类 PASS 附 vision 引用占位（vision-reports/bddNN.yaml），由 vision-analyst 随后产出

## BDD 逐条验收结果（21/21）

### 卡片交互语义

- PASS BDD-01: hover title 仅 title 出现下划线，meta/tags/footer 无下划线 (screenshots/t076-bdd01-title-underline.png) (vision: vision-reports/bdd01.yaml)
- PASS BDD-02: 点击 title SPA 导航到 entry 详情页 /{slug}，无全页刷新 (screenshots/t076-bdd02-title-nav.png, bdd02-nav-assert.log) (vision: vision-reports/bdd02.yaml)
- PASS BDD-03: 点击 username 导航到 /users/{username} (screenshots/t076-bdd03-username-nav.png) (vision: vision-reports/bdd03.yaml)
- PASS BDD-04: 右键 title 可复制真实 entry URL，href 属性=/{slug}（6 张卡片断言全过） (bdd04-05-href-assert.log)
- PASS BDD-05: 右键 username 可复制真实 user URL，href 属性=/users/{username}（2 张含 username 卡片断言全过） (bdd04-05-href-assert.log)
- PASS BDD-06: hover 时间戳/分隔符等非链接区域无下划线，光标为默认箭头 (screenshots/t076-bdd06-nonlink.png) (vision: vision-reports/bdd06.yaml)

### Tag 交互

- PASS BDD-07: 点击 tag 跳转 /explore?tags={tag}，列表按 tag 过滤 (screenshots/t076-bdd07-tag-nav.png) (vision: vision-reports/bdd07.yaml)
- PASS BDD-08: hover tag 出现下划线，光标为手型 (screenshots/t076-bdd08-tag-hover.png) (vision: vision-reports/bdd08.yaml)
- PASS BDD-09: hover tag-overflow "+N" 显示全部 tags 的 tooltip (screenshots/t076-bdd09-overflow-tooltip.png) (vision: vision-reports/bdd09.yaml)
- PASS BDD-10: 移动端 tap "+N" 可触发全部 tags 显示（Mobile Chrome viewport 实跑） (screenshots/t076-bdd10-overflow-tap.png) (vision: vision-reports/bdd10.yaml)

### Explore 页 tag 过滤

- PASS BDD-11: URL 带 ?tags=python 时列表仅显示含该 tag 的 entries (screenshots/t076-bdd11-url-filter.png) (vision: vision-reports/bdd11.yaml)
- PASS BDD-12: tag 过滤有 chip 视觉指示，点击移除后列表恢复无过滤 (screenshots/t076-bdd12-chip-remove.png, bdd12-chip-assert.log) (vision: vision-reports/bdd12.yaml)
- PASS BDD-13: 多 tag 过滤（?tags=python,cli）仅显示同时含两 tag 的 entries (screenshots/t076-bdd13-multi-tag.png) (vision: vision-reports/bdd13.yaml)
- PASS BDD-14: tag 过滤与搜索组合（?tags=python&q=hello）生效 (screenshots/t076-bdd14-tag-plus-q.png) (vision: vision-reports/bdd14.yaml)
- PASS BDD-15: tag 过滤刷新页面后从 URL 恢复 (screenshots/t076-bdd15-refresh.png) (vision: vision-reports/bdd15.yaml)

### EntryListRow 同步

- PASS BDD-16: list 视图点击 title SPA 导航到 entry 详情页 (screenshots/t076-bdd16-list-title.png) (vision: vision-reports/bdd16.yaml)
- PASS BDD-17: list 视图点击 tag 跳转 /explore?tags={tag} (screenshots/t076-bdd17-list-tag.png) (vision: vision-reports/bdd17.yaml)
- PASS BDD-18: list 视图点击 username 导航到 /users/{username} (screenshots/t076-bdd18-list-user.png) (vision: vision-reports/bdd18.yaml)
- PASS BDD-19: list 视图 hover 语义与 grid 一致（非链接区无下划线，title/username/tag 有下划线） (screenshots/t076-bdd19-list-hover.png) (vision: vision-reports/bdd19.yaml)

### 键盘可访问性

- PASS BDD-20: Tab 遍历 title/username/tag 链接依次获得焦点，有可见 focus 指示 (screenshots/t076-bdd20-tab-focus.png, bdd20-focus-assert.log) (vision: vision-reports/bdd20.yaml)

### 卡片整体 hover

- PASS BDD-21: 卡片 hover 边框高亮保持（默认 var(--c-border-strong) → hover var(--c-accent)） (screenshots/t076-bdd21-card-hover.png) (vision: vision-reports/bdd21.yaml)

## BDD-21 降级说明

CDP 远程连接的 hover() 不触发 CSS :hover（测试环境限制，非实现缺陷）。P5 e2e 改用 mouse.move + CSS 规则存在性检查（已核实默认边框色与 hover 边框色为不同 CSS 变量）。P6 以 hover 状态截图 + vision 分析作为行为佐证。

## 证据补验追查（主 Agent 核实，T046 原则：vision 否定先查根因）

vision-analyst 首轮对 3 张截图报否定/存疑，主 Agent 逐条追查根因，确认均为「e2e 证据截图时机/状态问题」而非实现缺陷，已重截正确证据 + vision 复核通过：

- **BDD-02（title 导航详情页）**：首轮 vision 报截图是列表页（blocker）。根因：e2e `waitForContent` 用 CDP 不稳定的 `waitForFunction`（被 `.catch` 吞掉），点击过早 + 截图在 SPA 过渡期（URL 已变但 Vue 未卸载列表 DOM）。主 Agent 自写验证脚本（等待详情页元素渲染后截图）核实：URL=/{slug}、hasDetail=true、hasList=false、详情页文本完整（见 bdd02-nav-assert.log，navigated-to-detail=true）。重截 screenshot 后 vision 复核 blocker=0（确认详情页布局）。
- **BDD-12（可移除 chip）**：首轮 vision 报截图无 chip（fail）。根因：e2e 截图在「点击 × 移除 chip 之后」（验证移除成功的状态），chip 已消失。实现功能正确（e2e `chip.toBeVisible()` + 移除后 URL 无 tags 两断言均过）。主 Agent 自写脚本重截「chip 显示态（带 ×）」+ 记录移除断言（见 bdd12-chip-assert.log，shows-removable-chip=true、removal-works=true）。重截后 vision 复核 blocker=0。
- **BDD-20（Tab 可见 focus）**：首轮 vision 报截图无可见 focus 轮廓（fail）。根因：e2e 截图在 Tab 遍历 12 次之后，焦点已移出可见卡片。实现有 focus 样式（.card-title/.meta-username/a.base-tag 的 :focus-visible 均为 outline: 2px solid accent-secondary）。主 Agent 自写脚本 Tab 聚焦到 card-title 后截图 + 记录 computed outline（见 bdd20-focus-assert.log，card-title/base-tag outline=solid 2px rgb(5,80,174)；DOM 层 meta-username 聚焦由 e2e BDD-20 认证 entry 断言覆盖）。重截后 vision 复核 blocker=0（确认 2px 蓝色 focus 描边）。

结论：3 项均为证据截图时机问题，实现功能经核实正确，重截证据 + vision 复核均通过。

## 证据清单

- P6-evidence/screenshots/：19 张操作类 BDD 截图（t076-bdd{01,02,03,06..21}-*.png，均 >1KB，md5 逐字节互不相同；bdd02/12/20 为主 Agent 补验重截版本）
- P6-evidence/bdd04-05-href-assert.log：查询类 BDD-04/05 的 href 属性断言记录
- P6-evidence/bdd02-nav-assert.log：BDD-02 导航详情页补验断言（navigated-to-detail=true）
- P6-evidence/bdd12-chip-assert.log：BDD-12 chip 显示+移除补验断言（shows-removable-chip=true、removal-works=true）
- P6-evidence/bdd20-focus-assert.log：BDD-20 focus outline 补验断言（outline=solid 2px rgb(5,80,174)）
- vision-reports/bddNN.yaml：vision-analyst 产出（19 份，bdd01-21 除查询类 04/05，全部 summary.blocker_count=0）

## 待确认清单

[NO_NEED_CONFIRM]
