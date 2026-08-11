---
phase: P4
task_id: TPV0088-e2e-test-infra-hardening
type: implementation
parent: P5-test-results/e2e.md
trace_id: TPV0088-P4-retry1-20260812
status: draft
created: 2026-08-12
agent: implementer
---

# P4 实现（重试轮 1）— viewer.spec.ts E2E 失败修复

## 背景

P5 判定 18 failed + 1 flaky（19 用例 × 2 项目）均为确定性测试代码 bug，非环境问题。本轮按
`P5-test-results/e2e.md` 逐用例根因修复 `frontend-v3/e2e/viewer.spec.ts`。

## 诊断确认（对照当前 DOM 核实）

- **markdown-test 文件序**：`GET /api/v1/entries/markdown-test` → `files[0]=architecture.svg(id=17)`、`files[1]=rich-markdown.md(id=18)`。`loadEntry`（`entryDetail.ts:52`）默认取 `files[0]`，故 markdown 渲染/TOC 永不触发。
- **EntryDetailView.vue:203** 支持 `?firstFileId=` query，可绕过默认文件选择（t091 已验证该机制）。
- **`.toc-nav`/`.file-sidebar`/`.detail-header` 均为桌面专属**：`EntryDetailContent.vue:4/65`（isFileTreeOpen/isTocOpen）、`EntryDetailHeader.vue:13`（`v-if="isDesktop"`）。移动端文件树在 drawer 内（默认关闭），`.file-item` 不在 DOM。
- **TC-022 抽屉关闭**：`drawer z-index 201 > overlay 200`，`drawer-left` 宽 280px；375px 视口下 overlay 中心 x≈187 落在 drawer 内被 `.file-tree` 拦截。Escape 仅关闭 zen mode（`useZenMode.ts:14`），不关抽屉 → 用 `position` 点击 overlay 右缘（x=360 > 280）。
- **TC-050**：`EntryCard.vue:2` `.entry-card` 是 div，仅 `.card-title` anchor（:22）有 `navigateToEntry`。
- **TC-010 heading race**：`.markdown-body` 挂载先于异步渲染 headings（首轮 `waitForSelector('.markdown-body')` 即通过，但 count=0）→ 改等 `.markdown-body h1`。

## 修复清单落地（对应 dispatch 7 项）

| # | 用例 | 改动 |
|---|------|------|
| 1 | TC-005 | `.file-item .file-name` 严格模式违规（2 元素）→ `filter({ hasText: 'entry_service.py' })` + `toHaveText`；并强制桌面视口（移动端文件树在 drawer 内不在 DOM） |
| 2 | TC-010/011/012/020/023 | 新增 `openMarkdownFile(page)` helper：通过 API 查 `rich-markdown.md` 的 id → `?firstFileId=` 导航。TC-011/012/020 强制桌面视口（`.toc-nav`/`.toc-sidebar` 桌面专属）；TC-023 用 firstFileId 让 `mobile-bar-toc-btn` 渲染 |
| 3 | TC-022 | `.drawer-overlay` 中心点击被 drawer 内 file-tree 拦截 → `click({ position: { x: 360, y: 400 } })`（375px 视口、drawer 宽 280px，x>280 落在 overlay 上） |
| 4 | TC-030 | Mobile 无 `.detail-header` → 强制桌面视口 |
| 5 | TC-040 | Mobile `.file-item` 在 drawer 内默认关闭不在 DOM → 强制桌面视口 |
| 6 | TC-050 | `.entry-card` div 无导航 → 改点 `.entry-card .card-title`；并强制桌面视口（`.detail-header` 断言桌面专属） |
| 7 | TC-002 | `waitForShiki` 首轮 5s 超时（flaky）→ 15s |

## 自查结果

- `E2E_SPEC=e2e/viewer.spec.ts make debug-test`（debug backend :8888）：
  - 第一轮：**36 passed + 2 flaky**（TC-010 双项目，heading 渲染 race）
  - 第二轮（修复 TC-010/011 wait 目标后）：**38 passed，0 failed，0 flaky**（19 用例 × 2 项目全绿）
- `npx vue-tsc --noEmit` exit 0（e2e 不在 tsconfig 覆盖范围，作为参考）
- `git diff --stat`：仅改动 `frontend-v3/e2e/viewer.spec.ts`（另有 P4-progress.md 进度记录）
- 未删用例、未清空断言，所有断言保持原有强度（仅修正选择器与等待目标）

## 备注

- 文件中新增的注释遵循既有文件风格（原文件每用例均有中文注释），用于解释"为何强制视口/为何 firstFileId"，防止后续回归。
- `backend/zip-*.zip` 三个文件的 git 变更来自后端 pytest 的既有测试产物，非本轮改动。

## 产出

- 代码改动：`frontend-v3/e2e/viewer.spec.ts`
- 本文档：`docs/tasks/TPV0088-e2e-test-infra-hardening/P4-implementation.md`
