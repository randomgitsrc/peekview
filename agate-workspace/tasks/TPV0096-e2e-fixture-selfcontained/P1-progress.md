# P1-progress — TPV0096（analyst 分阶段落盘）

## 2026-09-05

### 输入读取：P1-dispatch-context + P0-brief + analyst 角色文件
- 已核对 P0-brief 时效性：created 2026-09-05 = 当日立项当日启动，无间隔；3 个红灯 spec / seed 24 entry / 自建模式参照等核心事实待逐项复核（见下），暂无漂移迹象。

### 输入读取：frontend-v3/e2e/mermaid.spec.ts（依赖 test-mermaid-2）
- beforeEach：goto `/entries/test-mermaid-2` + networkidle + waitForTimeout(3000)
- 3 个 test 的断言反推 fixture 需求：
  1. "SVG fills container properly"：`.mermaid-content[data-mode="diagram"]` 可见；容器 height > 200px；svg 可见且 height > 100px
  2. "Code/Diagram toggle works"：`.diagram-block` 内 `.diagram-view-toggle` 可点击；切 code 后 codeMode 可见/diagramMode 隐藏；切回后 svg 可见 height > 100px
  3. "Fullscreen fills window"：`.mermaid-action-btn[title="Fullscreen"]` 可点击；`.diagram-modal-overlay` 可见且 height > 500px（viewport 内）
- 结论：fixture entry 必须是含 mermaid 代码块、渲染出可交互 diagram-block 的 entry

### 输入读取：frontend-v3/e2e/mermaid-check.spec.ts（依赖 playwright-test）
- 单 test：goto `/entries/playwright-test` + waitForTimeout(5000)
- 断言：`.diagram-block` count > 0；`.diagram-viewer` height > 200px；`.diagram-viewer svg` height > 100px
- 注意：选择器是 `.diagram-viewer`（与 mermaid.spec 的 `.mermaid-content` 不同类名，需在 frontend 组件中确认两者共存的渲染路径）

### 输入读取：frontend-v3/e2e/mermaid-visual.spec.ts（依赖 e2e-test）——dispatch 要求重点确认断言强度
- **P0 疑似"像素级对比"不成立**：全文无 toHaveScreenshot / 无图片 diff。实际断言 = 存在性 + boundingBox 尺寸（容器 height > 200 / svg height > 100 / modal height > 500）+ toggle/fullscreen 交互后 svg 仍可见
- **真实弱点**：test 1 的断言包在 `if (isVisible)` / `if (svgVisible)` 条件块内且 `.catch(() => false)`——diagram 不可见时 test 1 静默通过（假绿）。这是"长期红灯掩盖真回归"之外的第二类信号失真，BDD 需覆盖
- **结构性差异**：该 spec 不用 Playwright test fixture，每个 test 内 `chromium.launch({ headless: true })` 自起浏览器（viewport 1280x800 硬编码）+ `browser.close()`。P0 验收基线写"跑 3 spec（chromium+Mobile）"——自起 chromium 的 spec 在多 project 配置下会每个 project 各跑一遍（需查 playwright.config.ts 确认 project 列表）
- fixture 需求与 mermaid.spec 一致：含 mermaid 的 entry，容器/svg 高度满足阈值

### 输入读取：frontend-v3/e2e/render-regression.spec.ts（自建模式参照）
- 模式：`createEntry(request, slug, summary, files)`（POST /api/v1/entries，`is_public: true`，无认证头，`.catch(() => {})`）+ beforeAll 创建 + **无 afterEach 清理**（注释即 BDD-1~11 的 t085-* entry 留在 DB）
- teams-page.spec.ts 才是"创建+清理队列"完整模式（待读）
- 隐含依赖浮现：render-regression 的 createEntry 无认证即可创建成功（否则 t085-* 全 404）→ 需确认 debug 环境 POST /api/v1/entries 的认证要求
