---
phase: P0
task_id: TPV0099
task_name: fullscreen-link
trace_id: TPV0099
created: 2026-09-16
status: pending
parent: 无
---

# P0-brief — TPV0099 全屏模式链接（`/{slug}/f`：直入锁定的纯内容视图）

## task

为分享场景提供「全屏模式链接」：接收者打开 `https://host/{slug}/f` 后**直接进入锁定的 zen 视图**——无 header/侧栏/移动端 chrome/元信息条，只剩 entry 主体内容（现有全部渲染格式：markdown/代码/表格/图表/图片等照常工作）。

三个设计决策已在 P0 阶段与用户确认锁定：

1. **URL 格式 = 路径后缀 `/{slug}/f`**（否决 `?f` query 形态）
2. **完全锁死**：f/Escape 均无效，无页内出口（用户裁决，P1 不再重开）
3. **元信息条一并隐藏**：zen 外观统一为「只剩纯内容」——**[P0_STALE: 该项在现有 zen 模式下已天然满足，本任务零 CSS 改动，见文末「P0 时效性自检」]**

> **[P0_STALE]（2026-09-28 开工实核）**：立项（09-16）与开工（09-28）间隔 12 天，按 P0 卡判据逐条核查后，`known_risks` 第 1 条与决策 ③ 的**前提为假**（非"已解决"而是"从未成立"）：见文末「P0 时效性自检」。判定为**局部前提更正（任务目标/URL 方案/锁死语义/后端零改动四项前提全部成立）**，不重开 P0；本字段已就地更新。

## 决策依据

**URL 格式**——三选一对比后定 path 后缀：

| | `/ab1234/f` ✅ | `/ab1234?f` ❌ |
|---|---|---|
| 先例 | `/{slug}/raw` 短链已是 mode 后缀家族（main.py:539） | `?share=`/`?firstFileId=` 是传参先例，非模式先例 |
| 剪参数风险 | 无 | 聊天客户端/链接工具 normalize URL 会剪未知 query——分享场景正是重灾区 |
| 内部导航保态 | mode 是路由一部分，切文件（firstFileId）天然不丢 | 每次内部跳转须手工带 `f`，丢一次即意外跳出全屏——恰是用户最不想要的 |

**行为复用**——现有 zen 模式（`useZenMode.ts`）CSS 已隐藏 `.detail-header/.file-sidebar/.toc-sidebar/.mobile-actions/.mobile-sticky-header/.mobile-bottom-bar`，与目标形态重合，**无需新造模式**，实现 = 「URL 预置 zen 且锁定」。

**后端零改动**——`serve_spa_catchall` 对未知两段路径返回 index.html（main.py:599），浏览器 Accept 不触发 JSON 分支；`?share=token` 与 mode 正交，`/{slug}/f?share=token` 组合天然可用。

## 实现要点（P1/P2 输入，非定稿）

- 路由：`{ path: '/:slug/f', name: 'detail-zen-locked', component: EntryDetailView, meta: { zen: 'locked' } }`，注册于 `/:slug` 之后、catch-all 之前
- 入口：`zenMode.value = route.meta.zen === 'locked'`；锁定时 `handleZenKeydown` 短路（f/Escape 不退出）
- 可访问性细节：锁死模式下 `zenAriaText` 不得宣告 "Press f or Escape to exit"
- **zen 外观统一的影响面（已实核更正，见文末 [P0_STALE]）**：`.entry-detail.zen-mode :deep(.meta-tags-bar) { display: none; }` **已存在**于 `EntryDetailView.vue:260`（T082-P4 于 2026-07-30 引入，早于本任务立项），且 `.meta-tags-bar` 仅移动端渲染（`EntryDetailContent.vue:24` 的 `v-if="isMobile"`）。故「元信息条一并隐藏」在现有 zen 下**已天然满足 → 本任务零 CSS 改动**，不存在"两套外观"取舍。P1 **无需**再向用户确认此项，只需回归确认既有 zen 外观未被破坏
- 后端边缘（P2 决策是否处理）：`/{slug}/f` 不在 `FRONTEND_ROUTES`，JSON-accept 客户端会走 `resolve_entry_raw("slug/f")` → 404；Agent 读路径本就走 `/{slug}/raw`，可接受
- E2E：按 TPV0096 编写规范（自建 entry + `e2e-` 前缀 slug + afterEach 清理 + BASE_URL 防生产护栏），双 project

## 关键约束

- **URL 契约是公开接口**：`/{slug}/f` 与 `/raw` 同级，发布即对外承诺——CHANGELOG + 文档（AGENTS.md 技术要点、README/upgrading 如涉及）必须同步
- 用户可见功能 → 完整 agate 流程；P8 bump（bump_type 由 P2 定，倾向 minor）
- E2E 双 project：移动端三件套隐藏后的布局正确性单独验证

## 验收基线（BDD 倾向，P1 细化）

1. Given 公开 entry `ab1234` When 访问 `/ab1234/f` Then 直接呈现纯内容视图：header/侧栏/移动端 chrome/元信息条均不可见，主体内容正常渲染
2. Given 全屏视图 When 按 f 或 Escape Then 视图不变（锁死）
3. Given 多文件 entry When 全屏视图内切换文件 Then 保持全屏且内容切换（mode 不丢）
4. Given markdown entry 带 TOC When 全屏链接打开 Then 无 toc 侧栏、正文锚点滚动正常
5. Given 私有 entry + share token When 访问 `/ab1234/f?share=token` Then 全屏且内容可见
6. Given 访问 `/ab1234`（无 f）When 正常打开 Then 现有行为不变（回归）
7. Given 移动端 When 全屏链接 Then 无 mobile-bar/sticky-header，内容区占满视口
8. Given 图表类 entry（mermaid/svg）When 全屏视图 Then 图表渲染与内置全屏按钮正常

## 已知风险

- ~~zen 外观统一改变现有 f 键 zen 行为（meta 条 可见→隐藏）~~ → **[P0_STALE] 该风险前提为假**：meta 条早已在 zen 下隐藏（`EntryDetailView.vue:260`，T082 起）。本任务不改 CSS，无外观回归面；需回归确认的是"既有 zen 外观保持不变"（BDD 化）
- slug 恰为 `f` 的 entry：`/f` 单段仍走 `/:slug`（slug=f），无冲突，P1 回归确认
- `/:slug/f` 占用两段路径空间：现存两段路由仅 `/settings/apikeys`（静态）与 `/users/:username`（前缀 `users/`），**无冲突**（`_is_frontend_route` 对非 `users/` 前缀返回 False）；未来新增 `/{slug}/xxx` 类第二段路由需检查冲突表
- 移动端 zen 布局此前未在锁死状态下验证，可能暴露 content-area 高度/滚动问题
- **新增风险（开工实核发现）**：`/{slug}/f` 当前返回 **HTTP 200 + NotFoundView**（SPA catch-all 放行但路由未注册）——即"错误链接静默 200"。实现后须回归确认不再命中 catch-all

## P0 时效性自检（2026-09-28 开工实核）

立项 2026-09-16 → 开工 2026-09-28（间隔 12 天）。按 P0 卡「漂移判据」逐条核查：

| 判据 | 核查结论 |
|------|---------|
| 1. `task` 目标方案是否仍成立 | ✅ 成立。`/{slug}/f` 路径后缀方案、复用 zen、后端零改动三项均经代码/实测复核 |
| 2. `executor_env` 平台前提是否仍成立 | ✅ 成立。debug :8888、pytest 9.1.1、vitest 1.6.1、vue-tsc 5.9.3、ruff 0.15.18、Chrome CDP 153 全可用 |
| 3. `known_risks` 的"已解决前提"是否仍未解决/已被他任务解决 | ⚠️ **命中（局部）**：第 1 条"zen 外观统一改变现有 f 键 zen 行为"的前提为假 |

**判定：局部前提更正，不重开 P0。** 理由——判据 3 的命中的是一条**被当作待决取舍的风险项**，实核后它并非"未解决前提"，而是**前提事实错误**（该行为自 T082 起就已存在）。更正后任务目标、URL 方案、锁死语义、影响面均不变，仅**范围缩小**（去掉无意义的 CSS 分支与用户确认项）。判据 1/2（任务方案、平台前提）均成立，不构成"目标方案不再成立"的严重漂移。

**实核证据**（2026-09-28，debug :8888 = v0.24.1，匿名可见 15 条——见下方 seed 计数口径）：

```
# DOM 实测（移动端 390×844，CDP Emulation）
BEFORE (mobile, 无 zen): {"exists":true,"display":"flex","visible":true,"h":89}
AFTER  (mobile, 按 f 键): {"zenClass":true,"barDisplay":"none","barVisible":false,"barH":0,
                           "aria":"Zen mode on. Press f or Escape to exit."}
# /{slug}/f 现状
GET /yaml-docker-compose/f → 200，渲染 NotFoundView（"Page not found"），zenClass=null
```

**vision 独立复核**（vision-engine，`mobile-zen.png`）：确认 zen 态截图"页面最顶部没有显示标题/作者/时间的窄横条"——与 DOM 实测一致。

**同时校正的一处叙述**：brief 称"实现复用现有 zen 模式…CSS 已隐藏 `.detail-header/.file-sidebar/.toc-sidebar/.mobile-actions/.mobile-sticky-header/.mobile-bottom-bar`"——`layout.css:649-654` 确为这 6 项（**不含** `.meta-tags-bar`）；第 7 项 `.meta-tags-bar` 在 `EntryDetailView.vue:260` 的 scoped 样式中。两处合起来才是完整的 zen 隐藏集，P1/P2 须注意这个**双文件分布**（改动任一处都可能漏改另一处）。

**带给 P1 的输入变更**：删去"zen 外观统一确认项"；新增"confirm 既有 zen 外观不被破坏"的回归 BDD；新增"/{slug}/f 不再静默落 NotFoundView"边界 BDD。

## 环境自检（2026-09-28，完整版 1-5）

- 工具链：pytest 9.1.1 / vitest 1.6.1 / vue-tsc 5.9.3 / ruff 0.15.18 / MCP node_modules ✅
- debug 服务：`make debug-quick` → :8888 健康（`{"status":"ok","version":"0.24.1"}`），seed 灌入成功 ✅
  - **seed 计数口径（三个数字都对，勿再混淆）**：`scripts/seed-data/` 目录数 **24**（`len(entry_dirs)`，seed 脚本自报）；以 alice 身份查 API 的 `total` = **19**（含私有/团队可见）；**匿名**可见 = **15**（实测）。差异来自部分 entry 非 public。写 BDD/证据时须写明以哪个身份计数
- 版本一致性：`VERSIONS.json` = 后端 `0.24.1` ✅；git 工作区仅 gate-events.jsonl 有 hook 写入（非人为改动）
- Chrome CDP 18800：Chrome/153.0.8010.53 ✅；Playwright 1.61.1（全局）✅
- Vision：vision-engine `quick` role 实调成功（**需 `HOME` 重定向至可写目录 + `PYTHONPATH` 指向 `~/.local/lib/python3.12/site-packages`**，因 DSH 沙箱下 `~/.local/share` 只读——此坑记入下方环境约束）
- **DSH 沙箱约束（本项目新发现）**：`/tmp` 与 `~/.local/share` 对 bash 调用**只读**，且 `/tmp` 每条调用独立（跨调用不共享文件）；后台服务须挂持续 running 的后台 job 托底。临时产物一律落 `{project_root}/.agate-tmp/`


## 裁剪倾向

- P1：不可裁（URL 契约 + 锁死语义是需求核心，BDD 需评审）
- P2：不可裁剪；决策点 = backend `*/f` 特判与否 / zen 外观统一确认；frontend 域 → plan-design-review
- P3：保留（路由/锁定逻辑有可单测行为，useZenMode 已有测试基础）
- P6：不可裁——BDD 逐条实跑 + 双 project E2E + 截图
- P7：保留（router/CSS/composable 多文件改动）
- P8：bump-version（用户可见功能），CHANGELOG [Unreleased]
