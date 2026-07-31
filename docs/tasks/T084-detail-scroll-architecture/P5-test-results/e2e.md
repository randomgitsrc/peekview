---
phase: P5
task_id: T084-detail-scroll-architecture
type: test-results
parent: P4-implementation.md
trace_id: T084-P5-20260731
status: draft
created: 2026-07-31
agent: verifier
---

# P5 E2E Test Results — Playwright

## 命令

```bash
cd frontend-v3 && npx playwright test --reporter=line e2e/t049-mobile-header-diagram-sanitize.spec.ts
```

## 结果

- **exit code**: 1（测试失败）
- **总测试数**: 26（13 个测试 × 2 个浏览器项目：chromium + Mobile Chrome）
- **失败**: 12 个测试实例（含 retries，最终未跑完因 5 分钟超时）
- **通过**: 部分测试通过（A-BDD-2, A-BDD-4, C-BDD-4, C-BDD-7 等在至少一个浏览器中通过）

## test runner 输出签名

```
Running 26 tests using 8 workers
... (12 failures recorded before timeout)
```

（E2E 套件在 5 分钟超时内未跑完所有 retries，最终汇总行未生成。以下为从输出中提取的失败清单。）

## 失败清单

### 与本次改动相关（A-BDD 系列）

| # | 浏览器 | 测试 | 失败原因 | 分类 |
|---|--------|------|----------|------|
| 4 | chromium | A-BDD-3: scroll down hides header tags | `.meta-tags-bar` 期望 hidden 但 visible | **本次改动引入** |
| 11 | Mobile Chrome | A-BDD-3: scroll down hides header tags | 同上 | **本次改动引入** |
| 6 | chromium | A-BDD-1: many tags truncated to single line | `.header-tags` 选择器不存在（超时 30s） | 预存（选择器过时，P4 未修正此测试） |
| 1 | chromium | A-BDD-6: body tags unaffected by header truncation | body tags count = 0 | 预存（`.header-tags` 选择器问题） |
| 9 | Mobile Chrome | A-BDD-6: body tags unaffected by header truncation | 同上 | 预存 |
| 10 | chromium | A-BDD-5: desktop scroll has no effect on header tags | `.meta-tags-bar` 期望 visible 但 not found | 需分析（桌面端 isMobile=false 时 meta-tags-bar 是否渲染） |

### 与本次改动无关（C-BDD 系列 — 预存失败）

| # | 浏览器 | 测试 | 失败原因 | 分类 |
|---|--------|------|----------|------|
| 2 | chromium | C-BDD-3+5: error UI shows engine name with collapsed details | `.diagram-error` 不可见 | 预存 |
| 3 | chromium | C-BDD-8: plantuml error uses unified error UI | `.diagram-error` 不可见 | 预存 |
| 5 | chromium | C-BDD-6: error details expand shows truncated message | expand button 超时 30s | 预存 |
| 7 | chromium | C-BDD-1: mermaid error cleans #dmermaid SVG from DOM | `.diagram-error` 不可见 | 预存 |
| 8 | chromium | C-BDD-2: mermaid suppressErrors is configured | `suppressErrors` 为 false | 预存 |
| 12 | Mobile Chrome | C-BDD-1: mermaid error cleans #dmermaid SVG from DOM | `.diagram-error` 不可见 | 预存 |

## 预存失败验证

### C-BDD 系列验证

在改动前代码（f41869a5）上运行 C-BDD-1：

```bash
# checkout 改动前源码 → 跑 C-BDD-1
npx playwright test -g "C-BDD-1: mermaid error cleans" e2e/t049-...spec.ts
# 结果：2 failed（chromium + Mobile Chrome 均失败，.diagram-error 不可见）
```

**结论**：C-BDD 系列失败是预存失败，与本次改动无关。`.diagram-error` 元素在 debug backend 上不存在，可能是测试数据（mermaid error entry）未创建或 DiagramBlock error UI 未渲染。

### A-BDD-1/A-BDD-6 验证

A-BDD-1 测试使用 `.header-tags` 选择器（L31），该 class 在 T079 重构后已改为 `.meta-tags-bar`。P4 修正了 A-BDD-3/4/5 的选择器，但 **A-BDD-1 和 A-BDD-6 的选择器未被 P4 修正**，导致 `.header-tags` 找不到元素 → 超时或 count=0。

**结论**：A-BDD-1/A-BDD-6 是预存失败（选择器过时），P4 遗漏了这两个测试的修正。

## 本次改动引入的失败分析（A-BDD-3）

### 根本原因

A-BDD-3 测试 `t049-multi-tag` entry 的内容为：
```
# Test\n\nThis entry has many tags for mobile header truncation testing.
```

在 390x844 mobile viewport 下，`.content-area` 的 **scrollHeight (697) == clientHeight (697)**，即内容不足以产生滚动。设置 `scrollTop = 100` 无效（保持 0），scroll 事件不触发，`metaTagsHidden` 保持 false，`.meta-tags-bar` 不添加 `.hidden` class。

### 改动前为何"通过"

改动前 A-BDD-3 使用 `.header-tags` 选择器（T079 后已过时）+ `window.scrollTo(0, 100)`。由于：
1. `.header-tags` 元素不存在 → `toBeHidden()` 对不存在元素返回 true（**虚假通过**）
2. `window.scrollTo(0, 100)` 无效（body 不超出视口）但不影响结果

### 改动后为何失败

P4 正确修正了选择器为 `.meta-tags-bar`（元素存在）和滚动方式为 `.content-area scrollTop`，但**测试数据内容太短**导致 `.content-area` 无法滚动，scroll-hide 功能无法被触发。

### 修复建议

P4 需补充：在 t049 E2E 测试的 `beforeAll` 中创建一个**长内容** entry（或修改 `t049-multi-tag` 的 content 使其在 mobile viewport 下超出 `.content-area` 的 clientHeight），确保 scroll-hide 可被验证。

## A-BDD-5 分析

A-BDD-5 在桌面端 (1280x800) 测试 "desktop scroll has no effect on header tags"，期望 `.meta-tags-bar` visible。失败原因：`.meta-tags-bar` 元素 not found。

可能原因：`meta-tags-bar` 有 `v-if="isMobile"` 条件渲染（EntryDetailHeader.vue），桌面端 `isMobile=false` 时不渲染。测试期望桌面端 `.meta-tags-bar` visible 是不合理的——这可能是测试逻辑错误（桌面端不应该有 meta-tags-bar），或是 P4 修正选择器时未考虑 `v-if` 条件。

## 结论

- E2E 失败: 12 个测试实例
- 预存失败: 8 个（C-BDD × 6 + A-BDD-1 × 1 + A-BDD-6 × 1，选择器过时或 diagram-error 不存在）
- 本次改动引入: 2 个（A-BDD-3 × 2，测试数据内容太短无法滚动）
- 需进一步分析: 2 个（A-BDD-5 × 1 桌面端 meta-tags-bar not found + A-BDD-6 Mobile Chrome × 1）
- **gate 判定**: E2E 不通过——A-BDD-3 是本次改动直接相关的真实失败

[PROD_NOT_TOUCHED]
