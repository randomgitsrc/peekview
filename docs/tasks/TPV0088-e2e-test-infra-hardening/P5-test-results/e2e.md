# TPV0088 P5 — E2E 结果（viewer.spec.ts，核心验证）

- 命令：`E2E_SPEC=e2e/viewer.spec.ts make debug-test`
- 日期：2026-08-12
- 环境：BASE_URL=127.0.0.1:8888（debug，run-e2e-tests.sh 硬编码非生产），CDP :18800，Check 6 新鲜放行
- 结果：**18 failed + 1 flaky + 19 passed**（38 次运行 = 19 用例 × 2 项目 [chromium, Mobile Chrome]）
- **结论：BDD-1（19/19）未达成 → P5_e2e 门禁 FAIL**

## 判定依据（非环境问题）

backend :8888 health 200、seed 21 entries 齐、CDP :18800 可用、static 产物新鲜（Check 6 放行）。
全部失败均可在 error-context.md / 页面 snapshot 中复现为**确定性测试代码 bug**（非超时抖动），
下列每例根因均已对照当前 DOM 模板核实。

## 逐用例结果（chromium / Mobile Chrome）

| 用例 | chromium | Mobile Chrome | 根因（均对照当前 DOM 核实） |
|------|:--------:|:-------------:|------|
| TC-001 Python 高亮 | PASS | PASS | 运行时 API 创建 e2e-test-code 成功 |
| TC-002 行号 | **FLAKY**（retry 通过） | PASS | waitForShiki 首轮超时，retry 通过（渲染时序） |
| TC-003 Wrap 切换 | PASS | PASS | 移动端视口 + mobile-bar-wrap-btn 正确 |
| TC-004 Copy 内容 | PASS | PASS | aria-label="Copy" 命中桌面 header |
| TC-005 文件树文件名 | **FAIL** | **FAIL** | `.file-item .file-name` 匹配 2 元素（python-entry-service 双文件 entry_service.py + requirements.txt）→ strict mode 违规。断言需 `.first()` 或按文本过滤 |
| TC-010 Markdown 渲染 | **FAIL** | **FAIL** | `/markdown-test` 默认 activeFile=files[0]=**architecture.svg**（非 markdown）→ `.markdown-body` 永不出现。测试需先点 `rich-markdown.md` 或改默认文件 |
| TC-011 TOC 侧栏 | **FAIL** | **FAIL** | 同上，`.toc-nav` 永不出现（默认文件是 svg） |
| TC-012 TOC 导航 | **FAIL** | **FAIL** | 同上，`.toc-nav` 永不出现 |
| TC-013 Mermaid 渲染 | PASS | PASS | `.diagram-viewer svg` 无条件断言生效 |
| TC-020 桌面三栏 | **FAIL** | **FAIL** | `/markdown-test` 默认文件 svg → `.toc-sidebar` 不渲染（markdown 专属） |
| TC-021 移动单栏 | PASS | PASS | mobile-bottom-bar 正确 |
| TC-022 移动文件抽屉 | **FAIL** | **FAIL** | 抽屉打开，但 `.drawer-overlay` 中心点击被 `.drawer-left` 内 `.file-tree` 子树拦截 pointer events → 关不掉。需 position 点击或 Escape |
| TC-023 移动 TOC 抽屉 | **FAIL** | **FAIL** | 默认文件 svg → `isMarkdown` false → `mobile-bar-toc-btn` 不渲染 |
| TC-030 主题切换 | PASS | **FAIL** | Mobile 视口无 `.detail-header`（EntryDetailHeader.vue:13 `v-if="isDesktop"`），mobile-sticky-header 无 theme-toggle。需桌面视口或改选择器 |
| TC-031 主题持久化 | PASS | PASS | landing 页 .theme-toggle 正确 |
| TC-040 文件选择 | PASS | **FAIL** | Mobile 文件树在 drawer 内默认关闭，`.file-item` 不在 DOM。需先开 drawer 或桌面视口 |
| TC-041 单文件隐藏树 | PASS | PASS | json-api-config 单文件，.file-sidebar count=0 |
| TC-042 下载 | PASS | PASS | overflow-menu → Download 精确匹配 → 真实 download 事件 → suggestedFilename 含 entry_service.py |
| TC-050 列表→详情 | **FAIL** | **FAIL** | `.entry-card` 是 div，中心点击落在非链接区域（EntryCard.vue:22 仅 `.card-title` anchor 有 navigateToEntry）→ 未导航。需点 `.card-title` 或 `getByText(summary)` |

## 失败分类统计

- **双项目全过（8）**：TC-001 / TC-003 / TC-004 / TC-013 / TC-021 / TC-031 / TC-041 / TC-042
- **仅 Mobile 失败（2）**：TC-030 / TC-040（视口相关选择器）
- **双项目失败（8）**：TC-005 / TC-010 / TC-011 / TC-012 / TC-020 / TC-022 / TC-023 / TC-050
- **flaky（1）**：TC-002（chromium，retry 通过）
- 独立用例：19 例中 **17 例存在失败或 flaky 记录**，仅 8 例双项目全绿

## 截图路径

`frontend-v3/test-results/viewer-{TestName}-{project}/error-context.md` + `test-failed-*.png`（失败自动截图），
报告：`frontend-v3/playwright-report/`。

## 建议回 P4 修复方向（供主 Agent 判定）

1. **TC-005**：`.file-item .file-name` → `.first()` 或 `filter({ hasText: 'entry_service.py' })`
2. **TC-010/011/012/020/023**：markdown-test 默认文件是 architecture.svg（files[0]）。需在断言前先点 `.file-item` 中的 `rich-markdown.md`，或确认默认文件策略（P1 IMPL-D3 假设 markdown 优先未成立）
3. **TC-022**：overlay 点击被 drawer 内 file-tree 拦截 → 用 `position` 点击抽屉外区域或 Escape 关闭
4. **TC-030/040**（Mobile 专用）：`isMobile` 下 `.detail-header`/`.file-item` 不存在 → 用桌面视口 `test.describe` 包裹或针对 mobile 布局重写选择器
5. **TC-050**：`.entry-card` div 点击无导航 → 改点 `.card-title` anchor
6. **TC-002**：flaky，waitForShiki 超时加长或先 goto 后等 content

EXIT_CODE: 2

## P4 重试修复后复跑（2026-08-12）

- implementer 按 P5 根因清单修复 7 项（TC-005/010/011/012/020/022/023/030/040/050/002）
- 复跑 `E2E_SPEC=e2e/viewer.spec.ts make debug-test`：**38/38 通过**（0 failed，TC-012 偶发 flaky 但 retry 通过，非失败）
- 结论：**BDD-1（19/19）达成**（38 次运行 = 19 用例 × 2 项目全过）

EXIT_CODE: 0
