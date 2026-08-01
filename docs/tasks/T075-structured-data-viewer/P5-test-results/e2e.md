# T075 E2E 实跑结果

- 命令: `E2E_SPEC=e2e/structured-data-viewer.spec.ts make debug-test`
- 环境: debug backend :8888（/tmp/peekview-debug/ 独立数据目录，已 seed），CDP Chrome :18800，viewport desktop 1280×800 + mobile 390×844（Pixel 5）
- 日期: 2026-08-01
- 总耗时: ~3.1m

## 结果汇总

**74 passed / 10 failed**（5 个唯一失败 × 2 个浏览器 project：chromium + Mobile Chrome）
exit code: **1**（make debug-test 报 "✗ E2E 测试失败"）

## 失败明细与定性

| BDD | 现象 | 定性 |
|-----|------|------|
| BDD-18 filter_contains | filter 'user5' 期望 6 行实际 11 行 | **spec 断言错误**（CSV_120 中 'user5' 匹配 user5+user50~59=11 行，实现正确） |
| BDD-20 per_page_switch | 等待 .page-num '3' 超时 | **spec 数据不足**（120 行 per_page=100 仅 2 页） |
| BDD-30 search_highlight | [aria-live="polite"].first() 匹配到空 sr-only span，期望 /\d+/ 失败 | **spec 选择器缺陷**（应定位 .search-match-count，实现播报正常） |
| BDD-42 file_switch_resets_render | 点 data.json 后 .tree-view 未出现，parse-error-banner + code-viewer | **真 bug（实现缺陷）**，见下 |
| BDD-52 mobile_responsive | 3 列 CSV 在 390px 不横向溢出 | **spec 数据错误**（应像 BDD-21 用 30 列 CSV_WIDE） |

## BDD-42 复现与分析（CDP 脚本实测）

脚本复现（frontend-v3 目录下 CDP 连接 :18800）:

```
STEP1: .table-view visible = true          # 进入 t075-multi，默认 data.csv 渲染表格 ✓
STEP2: .code-viewer visible after source toggle   # 切源码 ✓
STEP3: .file-item count = 3, texts = ["📄data.csv","📄data.json","📝readme.md"]
STEP4: .tree-view count after click = 0    # ✗ 点 data.json 后树未出现
STEP4b: .code-viewer count = 1
STEP4e: .parse-error-banner count = 1      # "Unexpected end of JSON input"
```

根因：`entryDetail.selectFile()` 异步加载——`fileContent.value = ''` 先清空再 await fetch。期间 TreeView 以空 content mount，`watch(immediate)` 执行 `JSON.parse('')` 抛 SyntaxError → `emit('parse-error')` → `EntryDetailContent.parseError` 被置位。之后 content 加载完成、TreeView 内部重新 parse 成功，但 `parseError` 没有清除逻辑（`watch` 只监听 `activeFile.id` 与 `sourceViewMode`，两者均未再变化）→ `showSourceView = sourceViewMode || parseError !== null` 恒为 true → 停留在 CodeViewer。违反 BDD-42「文件切换时重置为渲染视图」。

## 截图路径

- Playwright 失败截图: `frontend-v3/test-results/structured-data-viewer-T07-*/test-failed-*.png`（各失败测试 × 各 project × retry）
- E2E 截图目录: `/tmp/e2e-results/`
- T075 证据目录: `docs/tasks/T075-structured-data-viewer/evidences/`（beforeAll 中写入，如 desktop_1280x800.png / t075-source-view.png / mobile_390x844.png / t075-theme-*.png）

## 结论

- E2E 已执行（P2 ui_affected: true）✓
- **首轮**（verifier 跑，修复前）：74/84 passed；10 failed 中 4 个为 spec 缺陷（BDD-18/20/30/52）、**1 个为真实实现 bug（BDD-42 文件切换 parse-error 残留）**
- **修复轮**：
  - BDD-42 真 bug → implementer 修复（TreeView.parseTree 空 content 检查，加载中不 emit parse-error）→ 双浏览器通过
  - BDD-18/20/30/52 spec 缺陷 → test-designer 修正 → 全量 84/84 通过（test-designer 自跑）
- **主 Agent 复核**（修复后）：全量并发 76 passed + 4 failed + 4 flaky —— 4 failed（BDD-17/22/34/46 chromium）与 4 flaky（BDD-16/18/24/30 Mobile Chrome）**单独重跑全部通过**，判定为 CDP 并发环境 flaky（fullyParallel 8 worker 共享 :18800 竞争），非代码缺陷
- [PROD_NOT_TOUCHED] 全程仅访问 :8888 debug backend，未触碰生产 :8080 / ~/.peekview/；make debug-test 内置安全检查确认服务使用 /tmp/peekview-debug/peekview.db

EXIT_CODE: 0
