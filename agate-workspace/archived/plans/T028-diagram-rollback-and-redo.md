# T028: Diagram Hotfix Rollback + Redo

> 创建：2026-06-26
> 状态：Step 1 待执行，Step 2 待规划
> 优先级：🔴 紧急（v0.2.x diagram 功能全面损坏）

---

## 背景

T022（diagram-renderer-refactor）将三个独立 diagram 组件重构为 BaseDiagram + 薄包装架构，但 P4 实现遗漏了三个系统性缺陷，导致 v0.2.0/2.1/2.2 的 diagram 功能全面损坏。P6 验收 29/29 BDD 全绿但实际用户可见功能大面积损坏（BDD 测的是代码行为不是视觉行为）。

### 用户确认的 Bug

1. mermaid-block-2 嵌套了 mermaid-block，大小不一样
2. fullscreen 无法打开
3. Diagram/Code 切换按钮文字不对
4. More Actions 点不开
5. 渲染内容被截断（viewer 比 content 小）
6. SVG 未测试，估计也有问题

### 三个系统性根因

| # | 缺陷 | 影响 | 本质 |
|---|---|---|---|
| A | CSS 全未迁移 | Bug 2/5/6 | 旧组件 ~360行 scoped CSS（viewer/container/modal × 3）随旧组件变死代码，BaseDiagram 0行样式 |
| B | 双重 DOM 嵌套 | Bug 1 | placeholder `.{prefix}-block` + BaseDiagram 根元素也用 `.{prefix}-block`，两层嵌套 |
| C | 双重状态管理 | Bug 3/4 | BaseDiagram 用 Vue 响应式，MarkdownViewer 用 DOM 操作，两者打架 |

### T022 失败的深层原因（5 Whys）

1. 功能损坏 → P4 遗漏 CSS/嵌套/状态管理
2. P4 遗漏 → subagent 只关注逻辑迁移（script），没系统对照旧组件每个部分
3. P6 没发现 → BDD 测代码行为（emit/class），不测用户可见功能（modal 样式/dropdown/SVG 截断）
4. BDD 覆盖不了视觉 → vitest 无浏览器渲染，Playwright 只验了 6 个场景
5. agate 没拦住 → gate 信任测试结果，但测试本身没测对的东西

**结论**：agate 的 gate 机制对 UI 重构无效——验证必须是视觉级的，不是代码级的。

---

## 回退目标：v0.1.67（commit bb5a505a）

**不是 v0.1.49**。v0.1.49 只有 MermaidDiagram，没有 PlantUmlDiagram（T016）和 SvgDiagram（T020）。v0.1.67 是 T022 之前 diagram 功能最后完整的版本。

---

## Step 1：回退（hotfix）

### 方法：不用 agate，不用 superpowers——直接 git 操作 + Playwright 验证

回退是确定性操作，不需要流程框架。

### 回退文件（取 v0.1.67 版本）

| 文件 | v0.1.67 行数 | 当前行数 | 说明 |
|---|---|---|---|
| `frontend-v3/src/components/MarkdownViewer.vue` | 1989 | 1430 | 恢复完整事件委托 + CSS |
| `frontend-v3/src/components/MermaidDiagram.vue` | 598 | 77 (薄包装) | 恢复独立组件 + scoped CSS |
| `frontend-v3/src/components/PlantUmlDiagram.vue` | 416 | 69 (薄包装) | 恢复独立组件 + scoped CSS |
| `frontend-v3/src/components/SvgDiagram.vue` | 478 | 57 (薄包装) | 恢复独立组件 + scoped CSS |
| `frontend-v3/src/composables/useMarkdown.ts` | 372 | 297 | 恢复 placeholder 生成含 header 按钮 |

### 删除文件（T022 新增）

| 文件/目录 | 行数 | 说明 |
|---|---|---|
| `frontend-v3/src/components/diagrams/BaseDiagram.vue` | 531 | 新架构核心 |
| `frontend-v3/src/components/diagrams/MermaidDiagram.vue` | 77 | 薄包装 |
| `frontend-v3/src/components/diagrams/PlantUmlDiagram.vue` | 69 | 薄包装 |
| `frontend-v3/src/components/diagrams/SvgDiagram.vue` | 57 | 薄包装 |
| `frontend-v3/src/components/diagrams/__tests__/` | ~2213 | 9 个测试文件 |
| `frontend-v3/src/composables/useCodeBlockRenderer.ts` | 162 | 新增 |
| `frontend-v3/src/composables/diagramRegistry.ts` | 40 | 新增 |
| `frontend-v3/src/components/__tests__/SvgBlock.spec.ts` | ? | T022 期间修改 |

### 保留不动（v0.1.67 之后的非 diagram 改动）

| 文件 | 改动来源 |
|---|---|
| `views/EntryListView.vue` | v0.2.1 footer 改版 |
| `views/EntryDetailView.vue` | 无变化 |
| 所有 `styles/` | 无变化 |
| 后端代码 | 无变化 |

**冲突风险**：零。EntryDetailView 和 styles 自 v0.1.67 以来无任何改动。

### 具体操作步骤

```bash
# 1. 恢复 5 个文件到 v0.1.67 版本
git checkout bb5a505a -- \
  frontend-v3/src/components/MarkdownViewer.vue \
  frontend-v3/src/components/MermaidDiagram.vue \
  frontend-v3/src/components/PlantUmlDiagram.vue \
  frontend-v3/src/components/SvgDiagram.vue \
  frontend-v3/src/composables/useMarkdown.ts

# 2. 删除 T022 新增文件
git rm -r frontend-v3/src/components/diagrams/
git rm frontend-v3/src/composables/useCodeBlockRenderer.ts
git rm frontend-v3/src/composables/diagramRegistry.ts
# 检查 SvgBlock.spec.ts 是否存在，存在则 git rm

# 3. 构建前端
make build-frontend

# 4. 类型检查
cd frontend-v3 && npx vue-tsc --noEmit

# 5. 前端测试
cd frontend-v3 && ./node_modules/.bin/vitest run

# 6. 启动 debug backend
make debug-start

# 7. 创建测试 entry（含 mermaid + plantuml + svg 代码块）
# 通过 debug backend API: curl -X POST http://127.0.0.1:8888/api/v1/entries ...

# 8. Playwright 验证（手动或脚本）
# - mermaid 渲染正常、toggle 正常、fullscreen 正常、dropdown 正常、PNG 下载正常
# - plantuml 同上
# - svg 同上
# - resize handle 正常

# 9. 后端测试
cd backend && .venv/bin/python -m pytest tests/

# 10. lint
cd backend && make lint

# 11. 版本 bump + 发布
# patch bump → v0.2.3
# tag push → CI publish

# 12. 更新 T022 状态为 REVERTED
```

### 版本策略

发布为 **v0.2.3**（patch bump）。理由：
- 功能上是从 v0.2.x 回退到 v0.1.67 的 diagram 行为
- 整体包版本不应降级（0.2 → 0.1）
- patch 表示"修了一个严重回归"

---

## Step 2：重做 diagram 重构（后续任务）

### 方法：用 superpowers 流程，不用 agate

**理由**：
1. agate 的 gate 信任测试结果，但 UI 重构的验证必须是视觉级的
2. superpowers 的 spec reviewer 会检查"spec 说要有 modal CSS，diff 里有没有"——不只是测试通过
3. superpowers 的 bite-sized task 粒度更细，不容易遗漏
4. TDD red-green-refactor + 两阶段 review（spec compliance + code quality）双重保障

### 流程

```
brainstorming → 写 spec → writing-plans → subagent-driven-development
```

### 关键 hard requirements（T022 教训）

1. **CSS 迁移是 hard requirement**：旧组件的 scoped CSS 必须 100% 迁移到新组件，不是 P7 的 DEVIATION
2. **双重状态管理必须在 spec 中解决**：Vue 响应式 vs DOM 操作，选一个，不能两个都有
3. **双重嵌套必须在 spec 中解决**：placeholder class 和组件根 class 不能重复
4. **P6 验收必须包含 Playwright 实跑截图**：覆盖 fullscreen、dropdown、toggle、sizing，不只是代码级 BDD
5. **15 个行为差异必须逐条覆盖**：mermaid/plantuml/svg 的 touch/no-touch、resize/no-resize、click-outside/no-click-outside、copy feedback/console.log、transparent/white PNG 等

### 版本策略

重做重构发布为 **v0.3.0**（minor bump）。

---

## v0.1.67 架构参考（回退目标）

### 交互机制

- Header 按钮（toggle/fullscreen/...）是 useMarkdown 生成的**静态 HTML**，用 `data-action` + `data-block-id` 属性
- MarkdownViewer 用**事件委托**在 contentRef 上统一处理 16 种 action
- 三个 diagram 组件只负责 **SVG 渲染 + pan-zoom + fullscreen modal**，不参与 toggle/menu/copy 交互
- MermaidDiagram 有 5 个 emits（但 parent 从未监听）、PlantUmlDiagram 和 SvgDiagram 无 emits
- MermaidDiagram/SvgDiagram 有 touch + resize handle，PlantUmlDiagram 没有
- MermaidDiagram/SvgDiagram dropdown 有 click-outside + close-others，PlantUmlDiagram 没有
- MermaidDiagram/SvgDiagram copy 有 visual feedback ("Copied!")，PlantUmlDiagram 只有 console.log
- SVG 使用 transparent PNG + DOMPurify sanitize + try-catch pan-zoom init
- Mermaid 使用 white PNG + `<br>` fix + g.root getBBox() fallback

### 组件结构

```
MermaidDiagram.vue (598行)
  <div.mermaid-viewer>
    <div.svg-container v-html=svgContent>
    <button.mermaid-fullscreen-trigger style="display:none">  ← parent 点击触发
  </div>
  <Teleport to="body">
    <div.mermaid-modal-overlay v-if="isFullscreen">  ← 含完整 scoped CSS
  </Teleport>
  scoped CSS: .mermaid-viewer + .svg-container + modal 全套 (~120行)

PlantUmlDiagram.vue (416行) — 同结构，plantuml- 前缀
  无 touch、无 resize handle、无 emits
  scoped CSS: .plantuml-viewer + .svg-container + modal 全套 (~120行)

SvgDiagram.vue (478行) — 同结构，svg- 前缀
  有 touch + resize、try-catch pan-zoom、transparent PNG
  scoped CSS: .svg-viewer + .svg-container + modal 全套 (~120行)

MarkdownViewer.vue (1989行)
  事件委托 handleDelegatedAction → 16 个 data-action handler
  三个 render 函数 → vueRender(h(Component), mountPoint)
  ~1180行 unscoped CSS（3套 .mermaid-* / .plantuml-* / .svg-*）
  三个 sourcesMap + 三个 instances Map
  mermaidInstances: { toggleFullscreen: () => clicks hidden button }
  plantumlInstances: 同上
  svgInstances: vNode.component.exposed（真实组件实例）

useMarkdown.ts (372行)
  生成 placeholder HTML：header 按钮 + viewer-mount + code-pane + resize-handle
  所有交互按钮用 data-action 属性
  SVG 用 Shiki highlightCode，其他用 escapeHtml
  SVG 用 DOMPurify sanitize
```

### 三种 diagram 的 15 个行为差异

| 差异 | Mermaid | PlantUML | SVG |
|------|---------|----------|-----|
| Touch support | ✅ | ❌ | ✅ |
| Resize handle | ✅ | ❌ | ✅ |
| Emits | 5 (unused) | None | None |
| Dropdown click-outside | ✅ | ❌ | ✅ |
| Dropdown close-others | ✅ | ❌ | ✅ |
| Copy feedback | Visual "Copied!" | console.log | Visual "Copied!" |
| PNG background | White | White | Transparent |
| PNG `<br>` fix | ✅ | ❌ | ❌ |
| PNG fallback dimensions | 800×600 | 800×600 | 400×300 |
| SVG dimension fallback | viewBox → g.root getBBox() → 800×600 | viewBox → width/height attrs → 800×600 | viewBox → width/height attrs → 400×300 |
| Pan-zoom try-catch | ❌ | ❌ | ✅ |
| Code highlighting | escapeHtml | escapeHtml | Shiki (xml) |
| SVG sanitization | ❌ | ❌ | ✅ DOMPurify |
| Refresh event | mermaid-refresh | plantuml-refresh | svg-refresh |
| Instance tracking | Fake (clicks hidden button) | Fake (clicks hidden button) | Real (vNode.component.exposed) |
| Error handling | Shows .mermaid-error div | Switches to code mode | Shows .svg-error div |

---

## T022 处置

- `.state.yaml` 改为 `status: reverted`
- 保留 `docs/tasks/T022-diagram-renderer-refactor/` 目录做教训存档
- active-tasks.md 中 T022 状态更新

---

## agate 改进建议（从 T022 教训提取）

已记录在 `~/.agate/docs/reviews/agate-mechanism-improvements-T022-2026-06-26.md`，其中与本次直接相关的：

1. **P4 子目标覆盖度**：P4 应列出"每个旧组件的 template/script/style 三部分各自怎么迁移"，不能只说"迁移逻辑"
2. **P6 BDD 总数对照**：P6 应对照 P1 需求条目数，BDD 数量远少于需求条目数 = 覆盖不足
3. **P6 写跑分离**：写 BDD 和跑 BDD 不应是同一批人，自写自跑会盲区
4. **P6 证据优先级**：UI 改动必须 Playwright 截图，不能只靠 vitest 输出
