---
phase: P4
task_id: T084-detail-scroll-architecture
type: diagnosis
parent: P4-dispatch-context-implementer-retreat.md
trace_id: T084-P4-retreat-20260801
status: final
created: 2026-08-01
agent: implementer
---

# P4 回退诊断 — t049 A-BDD-3 & A-BDD-5 失败根因

## 失败摘要

从 P5 回退，两个测试失败：
- **A-BDD-3**（chromium + Mobile Chrome）：scroll down hides header tags — `.meta-tags-bar` 期望 hidden 但 visible
- **A-BDD-5**（chromium + Mobile Chrome）：desktop scroll has no effect on header tags — `.meta-tags-bar` 期望 visible 但 not found

## A-BDD-3 根因分析

### 失败现象

A-BDD-3 在 390x844 mobile viewport 下设置 `.content-area.scrollTop = 100`，期望 `.meta-tags-bar` 变为 hidden。实际 `.meta-tags-bar` 保持 visible。

### 3 个可能原因 + 证据

| # | 可能原因 | 证据 | 判定 |
|---|---------|------|------|
| 1 | **API schema 不匹配：测试用顶层 `content` 字段，但 API 期望 `files: [{ content }]`** | t049 spec L16 顶层 `content: '# Test...'`；CreateEntryRequest (models.py L547-558) 无 `content` 字段，只有 `files: list[FileCreate]`；FileCreate L400 有 `content` 字段。实测：`GET /api/v1/entries/t049-multi-tag` 返回 `files: []`（0 文件）。所有其他 E2E 测试（t057, t058, t069, search 等）均用 `files: [{ filename, content }]` 格式 | **✓ 根因** |
| 2 | setupScrollHide 未绑定到 `.content-area` | useResponsiveLayout.ts L26-37: `setupScrollHide(container)` 绑定传入 container 的 scroll 事件；EntryDetailView.vue L138 调用 `setupScrollHide`。composable 单测（useResponsiveLayout.spec.ts）全绿，证明绑定逻辑正确 | ✗ 排除 |
| 3 | `.meta-tags-bar.hidden` CSS class 未生效 | EntryDetailHeader.vue L180: `.meta-tags-bar.hidden { max-height: 0; padding: 0; overflow: hidden; border-bottom: none; opacity: 0; }` — CSS 正确。问题不在 class 不生效，而在 class 从未被添加（metaTagsHidden 保持 false） | ✗ 排除 |

### 验证步骤

1. 确认 t049 spec 使用顶层 `content` 字段（L16），而非 `files` 数组
2. 确认 CreateEntryRequest (models.py L547-558) 无 `content` 字段 — 顶层 `content` 被 Pydantic 忽略
3. 实测 `GET /api/v1/entries/t049-multi-tag` → `"files": []`（entry 创建时 0 文件）
4. 页面无文件内容 → `.content-area` 无内容 → scrollHeight == clientHeight → `scrollTop = 100` 是 no-op → scroll 事件不触发 → `metaTagsHidden` 保持 false
5. P5 报告 scrollHeight (697) == clientHeight (697) 与此一致：无文件内容导致 `.content-area` 为空

### P5 诊断修正

P5 报告将根因归结为"内容太短"，但实际根因是"无文件内容"（API schema 不匹配导致 content 被忽略）。修复方向也应从"加长 content"改为"使用正确的 `files` 格式 + 足够长的内容"。

### 修复方案

修改 t049 spec `beforeAll`：
1. 将顶层 `content` 改为 `files: [{ filename: 'README.md', content: '...' }]` 格式
2. content 内容足够长（多个段落），确保 mobile viewport 下 `.content-area` 可滚动
3. 添加 delete-first 逻辑（entry 可能已存在旧版本）

## A-BDD-5 根因分析

### 失败现象

A-BDD-5 在桌面端 (1280x800) 期望 `.meta-tags-bar` `toBeVisible()`，但元素 not found（不存在于 DOM）。

### 3 个可能原因 + 证据

| # | 可能原因 | 证据 | 判定 |
|---|---------|------|------|
| 1 | **`v-if="isMobile"` 桌面端不渲染 meta-tags-bar** | EntryDetailHeader.vue L67: `<div v-if="isMobile" class="meta-tags-bar" ...>`；useResponsiveLayout.ts L21: `isMobile = computed(() => viewportWidth.value <= 640)`；桌面端 1280 > 640 → isMobile=false → 元素不渲染 | **✓ 根因** |
| 2 | meta-tags-bar 被其他条件隐藏 | L67 只有 `v-if="isMobile"`，无 `v-show` 或其他条件。isMobile=false 时元素根本不在 DOM 中 | ✗ 排除 |
| 3 | CSS display:none 隐藏 | L179 `.meta-tags-bar` 无 display:none；L234 `.zen-mode :deep(.meta-tags-bar) { display: none }` 仅 zen-mode 生效，测试未触发 zen-mode | ✗ 排除 |

### 验证步骤

1. 确认 EntryDetailHeader.vue L67: `v-if="isMobile"` — 桌面端 isMobile=false，元素不渲染
2. 确认 BDD-06（P1-requirements.md L115-118）："桌面端不渲染 meta-tags-bar 且 scroll-hide 不触发" — "`.meta-tags-bar` 元素不在 DOM 中"
3. A-BDD-5 测试 L129-130: `await expect(metaTagsBar).toBeVisible()` — 期望元素 visible，但元素不在 DOM 中，`toBeVisible()` 对不存在元素报错

### 修复方案

修改 A-BDD-5 验证逻辑，使其与 BDD-06 一致：验证桌面端 `.meta-tags-bar` **不在 DOM 中**（`toHaveCount(0)`），而非期望 visible。

## 排除项清单

| 排除项 | 证据 |
|--------|------|
| setupScrollHide 绑定逻辑有误 | composable 单测全绿（useResponsiveLayout.spec.ts），绑定逻辑正确 |
| `.meta-tags-bar.hidden` CSS 不生效 | CSS 定义正确（L180），问题是 class 从未被添加 |
| EntryDetailHeader.vue 源码有 bug | `v-if="isMobile"` 是 BDD-06 的设计意图，非 bug |
| useResponsiveLayout isMobile 计算有误 | `viewportWidth.value <= 640` 逻辑正确，1280 > 640 → false |
| 滚动方式错误（window vs content-area） | P4 已修正为 `.content-area scrollTop`，正确 |

## 修复范围

- **只改 t049 spec**：
  - A-BDD-3: 将顶层 `content` 改为 `files: [{ filename, content }]` 格式 + 足够长的内容 + delete-first 逻辑
  - A-BDD-5: 修改断言从 `toBeVisible()` → `toHaveCount(0)`（与 BDD-06 一致）
- **不改源码**（CSS/composable/组件改动已正确）
- **不改其他测试**

[PROD_NOT_TOUCHED]
