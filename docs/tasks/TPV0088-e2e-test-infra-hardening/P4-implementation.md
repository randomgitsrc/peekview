---
phase: P4
task_id: TPV0088-e2e-test-infra-hardening
type: implementation
parent: P2-design.md
trace_id: TPV0088-P4-20260812
status: draft
created: 2026-08-12
agent: implementer
---

# P4 — 实现说明：viewer.spec.ts 修复（子任务 A）

`implementation_dir: frontend-v3/e2e/`

## 改动文件

- `frontend-v3/e2e/viewer.spec.ts`（唯一代码改动，19 用例全部保留）

## 逐条落实修复清单

### 路由（BDD-2，17 处 hash → history）
- 全部 `page.goto('/#/entry/{slug}')` → `page.goto('/{slug}')`。运行时创建 slug 保留（`/e2e-test-code`），TC-031 保留 `goto('/')`，TC-050 改 `goto('/explore')`。

### slug 映射（BDD-4，IMPL-D1~D4）
| 用例 | 原 → 新 |
|------|---------|
| TC-004/005/030/042 | `lu4prg` → `python-entry-service`（entry_service.py 含 `def`，多文件 public/alice）|
| TC-010/011/012/020/021/022/023/040 | `ngajri` → `markdown-test`（rich-markdown.md 含 h1-h3 + 2 文件）|
| TC-013 | `ngajri` → `mermaid-charts`（flowchart.md 含 mermaid 块）|
| TC-041 | `lu4prg` → `json-api-config`（单内容文件 config.json，isMultiFile=false）|

### 死选择器替换（BDD-3，IMPL-S1~S12）
- **S1**（TC-005）：删 `.code-header .filename`/`.lang`/`Wrap` 断言；新增 `.file-item .file-name` 含 `entry_service.py`（文件名渲染在文件树，TreeNodeItem.vue:23）
- **S2**（TC-021）：`.mobile-actions` → `[data-testid="mobile-bottom-bar"]`
- **S3**（TC-022）：`.mobile-actions .menu-btn` → `[data-testid="mobile-bar-filetree-btn"]`；`.drawer-left`/`.drawer-overlay` 保留
- **S4**（TC-023）：`.toc-btn` → `[data-testid="mobile-bar-toc-btn"]`；`.drawer-right` 保留
- **S5**（TC-030/031）：`.list-header/.detail-header .btn-icon` → TC-030 `.detail-header .theme-toggle`；TC-031 `.theme-toggle`（landing 页）
- **S6**（TC-004/005）：`button:has-text("Copy")` → `[aria-label="Copy"]`（桌面 header，EntryDetailHeader.vue:36）
- **S7**（TC-003）：桌面无 Wrap → 移动端视口 375×812 + `[data-testid="mobile-bar-wrap-btn"]`，断言 `.code-body` `wrap-enabled` class 切换（CodeViewer.vue:16）
- **S8**（TC-042）：`a[download]`（动态建 a 即移除，DOM 不存在）→ 点 `[data-testid="overflow-menu-trigger"]` → `getByText('Download', { exact: true })`（精确匹配，避免命中 `Download as Pack`）→ `page.waitForEvent('download')` → `suggestedFilename()` 含 `entry_service.py`
- **S9**（TC-050）：`goto('/')` → `goto('/explore')`（landing 不渲染 `.entry-card`，EntryListView grid 渲染）
- **S10**（TC-050）：`toHaveURL(/\/entry\//)` → `toHaveURL(/\/[^/]+$/)`（history 模式 URL 是 `/{slug}`）
- **S11**（TC-012）：删 `toHaveURL(/.*${href}$/)`（TocNav `@click.prevent` 不改 URL）→ 点 toc-item 后 `expect.poll(content-area scrollTop).toBeGreaterThan(0)`（`[data-testid="content-area"]` 是滚动容器，:227 `overflow-y:auto`）；不依赖 `.toc-item.active`（无 scroll-spy）
- **S12**（TC-013）：`if (mermaidExists)` 条件式断言 → 无条件断言 `.diagram-viewer svg` 可见（MermaidRenderer 渲染于 `.diagram-svg-container`，无 `.mermaid` 类）

## 自主决策（上报）

[DESIGN_GAP: TC-012 将点击目标从 P2/P3 默认的 `.toc-item a` first() 改为 last()——rich-markdown.md 首个 toc 项是文档顶部 h1，click first() 后 scrollTop 可能恒 0 导致断言不稳；last() 在折叠线以下，scrollTop>0 确定性成立。P3 清单仅写"点 .toc-item a"，未限定 first/last]

[DESIGN_GAP: TC-050 在 `toHaveURL(/\/([^/]+)$/)` 之外追加 `.detail-header` 可见断言——该正则同时匹配 `/explore`，单独使用在导航尚未发生时即可通过（假绿）；detail-header 可见才证明真实进入 detail 页。P2 S10 未覆盖此弱化点]

## 自查结果（≠P5 gate）

- `npx tsc --noEmit --skipLibCheck --target ES2020 --module esnext --moduleResolution bundler e2e/viewer.spec.ts` → **exit 0**（语法/类型通过）
- grep 确认无残留：`/#/entry/`、`lu4prg`、`ngajri`、`.code-header`、`.mobile-actions`、`.menu-btn`、`.toc-btn`、`.list-header`、`.btn-icon`、`has-text`（grep-exit=1 无匹配）
- `grep -c "test("` = **19**，未删任何用例
- **E2E 实跑（`E2E_SPEC=e2e/viewer.spec.ts make debug-test`）需 debug backend :8888 运行，本阶段未启动服务，留给 P5/P6 实跑**

## 环境隔离

[PROD_NOT_TOUCHED] 未启动任何服务、未触碰生产 :8080 / `~/.peekview/`，仅修改测试文件。

## 未改动文件

- Makefile / scripts/e2e-safety-check.sh 的改动来自子任务 B（implementer-b），本子任务未触碰。
