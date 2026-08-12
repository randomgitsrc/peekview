---
phase: P2
task_id: T049-mobile-header-diagram-sanitize
type: review
parent: P2-design.md
trace_id: T049-P2-20260708-review
status: approved
created: 2026-07-08
agent: plan-design-review
---

# P2 设计评审 — Mobile Header + 图表清洗 + 错误 UI

## 评分

| 维度 | 评分 | 摘要 |
|------|------|------|
| 交互状态覆盖率 | **6/10** | BDD 核心路径覆盖好，但 loading/empty/edge case 普遍缺失 |
| AI Slop 风险 | **7/10** | 溢出计算和"+N"方案各有一处"或"表述，其余明确 |
| 移动端考虑 | **6/10** | 核心场景覆盖，但桌面端 scroll 监听未隔离（CRITICAL），resize 未讨论 |
| 可访问性 | **3/10** | 几乎空白：无 aria 属性、无 keyboard nav、无 prefers-reduced-motion、错误 UI 无 role="alert" |

---

## 子域 1：移动端 Header 收缩 — 4 个缺口

### 缺口 1.1（CRITICAL）：桌面端 scroll 监听会错误触发收缩

P2-design §5.1：scroll 监听在 `onMounted` 中添加，不区分移动端/桌面端。监听器注册在组件层面，而 `@media` 限制只在 CSS 层面。桌面端（≥1024px）同样会触发 class 切换，导致 `.header-tags-hidden` 被错误添加（虽然 CSS 中 `.detail-header.header-tags-hidden .header-tags` 对桌面端没有 `max-height: 0` 限制——但如果有其他样式依赖此 class，会有意外）。

**要求**：scroll handler 内必须显式判断 `window.innerWidth > 768` 时跳过 class 切换。与 A-BDD-5 直接冲突。

### 缺口 1.2：溢出计算方案二选一未定

§5.1 说"`getComputedStyle` 或逐 child 计算可见性确定 N"。两种方案：
- `scrollHeight > clientHeight` 只能判断"是否有溢出"，不能算出 N。
- 逐 child 计算需要遍历 `.header-tags` 的子元素，检查 `offsetTop > container.clientHeight`，工作量不同。
- 如果使用 CSS `overflow: hidden` 自然截断，JS 只有判断有无溢出，不需要精确 N——那么 "+N" 指示器只需要显示 `+K` 其中 `K = tags.length - 1`（只保留第一个可见）。但 P1 A-BDD-1 说"被隐藏标签数量"，不一定是 `tags.length - 1`。

**要求**：明确溢出数量计算方案。建议：CSS 自然截断 + JS 遍历子元素 `offsetTop` 计算在可见行内的标签数作为 `visibleTags`。

### 缺口 1.3：初始滚动位置 > 50px 的边界条件

如果用户通过 URL 锚点或浏览器恢复页面位置直接落在 `scrollTop > 50` 的位置，scroll 事件监听在 `onMounted` 注册后不会立即触发。需要在 `onMounted` 中主动检查一次初始 scrollTop 值并设初始状态。

### 缺口 1.4：Resize 窗口（横竖屏旋转）后溢出需重新计算

移动设备横竖屏旋转时，viewport 宽度变化，header-tags 宽度变化可能导致溢出数量变化。需要在 `useResizeObserver` 或 `window.addEventListener('resize')` 中重新计算。与 `@media` 联动（横屏 > 768px 可能进入桌面端逻辑）。

### 缺口 1.5：空标签状态的 .header-tags 区域占位

`tags` 为空数组时 `.header-tags` 是否仍有高度（占位）？当前没有 `v-if` 守卫，可能导致空容器在 sticky header 中占位。虽然不是功能错误，但影响移动端空间。

---

## 子域 2：图表清洗模块 — 2 个缺口

### 缺口 2.1：Config 获取失败的 fallback 未定义

§5.2："config 就绪前跳过清洗"——但如果 API 请求超时或返回 500，前端应默认启用还是禁用清洗？需要定义 fallback 行为。建议：获取失败默认启用（安全侧），并在 console.warn 记录。

### 缺口 2.2：引擎不支持的 sanitize 行为

如果 `sanitize(code, 'unknown')` 调用，应返回原 code。registerRule 不应允许覆盖已注册引擎。目前设计只说了 "三个引擎"，未定义边界行为。

---

## 子域 3：配置后端 + CLI — 无缺口

参照 `PeekAuth.captcha_enabled` 模式，`follows_existing_pattern` 路径清晰，三处注册均定位准确。无问题。

---

## 子域 4：图表错误 UI — 4 个缺口

### 缺口 4.1（CRITICAL）：PlantUML 行为变更缺少详细规范

§5.4 说 "DiagramBlock 中 `onRenderError` 不再判断 `block.lang === 'plantuml'` 做特殊处理"。但：
- 当前 PlantUML 失败时自动 `isCodeMode=true`——移除这个逻辑后，PlantUML 失败应该走统一错误 UI（与 mermaid/svg 一致）。
- 统一错误 UI 的 "查看源码" 按钮 → `isCodeMode.value = true`，这与 PlantUML 当前行为功能等价。
- 但需要确认：在新的架构中，PlantUML 渲染失败时，`hasError` 是 true 还是 `isCodeMode`？建议：保持 `hasError` 的 viewer 隐藏 + error UI 显示，"查看源码" 按钮触发 `isCodeMode`。

### 缺口 4.2：清洗中（重试渲染）的 loading 状态

当 `sanitizeWithRetry` 触发第二轮渲染时，在渲染完成前 UI 无过渡状态。如果重渲染是异步（mermaid.render 是异步），用户可能看到"先显示错误 UI → 闪一下 → 成功渲染"的闪烁。建议：重试期间暂不更新 `hasError`，等最终结果决定。

### 缺口 4.3：空错误消息的边界情况

`String(err)` 当 `err` 为 `undefined` 或 `null` 时返回 `"undefined"` / `"null"` 文本，直接展示给用户。需要在截取前加守卫 `if (!err) return ''`。

### 缺口 4.4：exportPng 清理 ID 冲突可能

§5.4：`exportPng` 用 `crypto.randomUUID()` 生成 `export-{id}` 作为 render ID。但 mermaid 内部生成的错误 SVG ID 是 `dmermaid-{id}` 格式——如果 exportId 未传给 mermaid.render 的 `id` 参数，mermaid 不会生成 `dmermaid-export-xxx`。需要确认 exportPng 中 `mermaid.render(id, code)` 的 `id` 参数是否使用此 exportId。

---

## 可访问性：系统性缺失

当前 BDD 中无 a11y 需求，P2 设计中也无 a11y 考量。按设计角色要求必须评分：

| 需要 | 当前状态 | 建议 |
|------|----------|------|
| 隐藏标签区 aria-hidden | 未提及 | `.header-tags` 收缩时设 `aria-hidden="true"` |
| +N 指示器 aria-label | 未提及 | `aria-label="还有 N 个标签被隐藏"` |
| 错误 UI role="alert" | 未提及 | 错误容器设 `role="alert"` |
| 折叠详情 aria-expanded | 未提及 | 按钮设 `aria-expanded`，详情设 `aria-controls` |
| prefers-reduced-motion | 未提及 | 检测 `window.matchMedia('(prefers-reduced-motion: reduce)')`，匹配时跳过动画 |
| 颜色对比度 | 未提及 | 错误 UI 红色文字需符合 WCAG AA（4.5:1） |

非 BLOCKER（BDD 无 a11y 要求），但建议在实现时最低限度加 `aria-expanded` + `role="alert"` + `prefers-reduced-motion`（共 ~20 行，成本低、收益高）。

---

## 改进建议汇总

| 层级 | 问题 | 影响范围 | 建议 fix |
|------|------|----------|----------|
| **CRITICAL** | 桌面端 scroll 监听未隔离 | A-BDD-5 被违反 | scroll handler 加 `if (window.innerWidth > 768) return` |
| **CRITICAL** | PlantUML 行为变更缺少详细流程 | PlantUML 错误状态不确定 | 补充 `onRenderError` 流程图/伪代码 |
| 需补充 | 溢出计算方案二选一 | 实现不确定 | 明确选逐 child 遍历 + `offsetTop` |
| 需补充 | Config 获取失败 fallback | 生产异常行为 | 默认启用清洗 + console.warn |
| 需补充 | 初始 scrollTop > 50 的初始状态 | 页面恢复场景 | `onMounted` 主动调一次 check |
| 需补充 | Resize 后溢出重新计算 | 横竖屏旋转 | 加 `window.addEventListener('resize', recompute)` |
| 需补充 | 重试渲染中间 loading 闪烁 | 用户体验 | 重试期间暂不 set hasError |
| 需补充 | 空错误消息 | 边界崩溃 | `if (!err) return` |
| 建议 | a11y 四项基础 | 用户体验 | aria-expanded / role="alert" / prefers-reduced-motion / aria-hidden |
| 建议 | 动画 timing 值 | 一致性 | 指定 `transition: max-height 0.3s ease, opacity 0.3s ease` |

---

## 结论

P2-design.md 整体质量好：四字段齐全、候选方案权衡清晰、files_to_read 精准、实现顺序建议合理。两个 CRITICAL 缺口（桌面端 scroll 隔离缺失、PlantUML 流程不完整）需要在实现前补充。

**建议方案**：修复两个 CRITICAL 缺口 + 补充 6 个需补充项（总共 ~50 字补充），不需要重写设计。`needs-revision` 而非 `rejected` 是因为设计骨架正确，缺口都是有限的细节缺失。
