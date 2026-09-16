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
3. **元信息条一并隐藏**：zen 外观统一为「只剩纯内容」

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
- **zen 外观统一的影响面**：`.zen-mode .meta-tags-bar` 隐藏会同时改变现有 f 键 zen 模式的外观（统一一套而非两套）——推荐统一（两套外观维护贵且语义混乱），P1 与用户确认
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

- zen 外观统一改变现有 f 键 zen 行为（meta 条 可见→隐藏）——P1 确认（推荐统一）
- slug 恰为 `f` 的 entry：`/f` 单段仍走 `/:slug`（slug=f），无冲突，P1 回归确认
- `/:slug/f` 占用两段路径空间：未来新增 `/{slug}/xxx` 类第二段路由需检查冲突表
- 移动端 zen 布局此前未在锁死状态下验证，可能暴露 content-area 高度/滚动问题

## 裁剪倾向

- P1：不可裁（URL 契约 + 锁死语义是需求核心，BDD 需评审）
- P2：不可裁剪；决策点 = backend `*/f` 特判与否 / zen 外观统一确认；frontend 域 → plan-design-review
- P3：保留（路由/锁定逻辑有可单测行为，useZenMode 已有测试基础）
- P6：不可裁——BDD 逐条实跑 + 双 project E2E + 截图
- P7：保留（router/CSS/composable 多文件改动）
- P8：bump-version（用户可见功能），CHANGELOG [Unreleased]
