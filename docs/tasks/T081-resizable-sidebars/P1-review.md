---
phase: P1
task_id: T081-resizable-sidebars
type: review
parent: P1-requirements.md
trace_id: T081-P1-20260804
status: approved
created: 2026-08-04
agent: requirements-review
---

# P1 需求基线评审

## 评审结论：approved

P1-requirements.md 需求基线完整、正确、可验证。16 条 BDD 编号连续、格式标准、二值可判定。10 条隐含需求覆盖全面。裁剪声明合理。无未决确认项。无解决方案设计混入。

**环境状态**：[PROD_NOT_TOUCHED]

## BDD 评审

### 格式与编号
- BDD 编号使用 `#### BDD-NN:` 标准格式 ✓
- BDD-01 到 BDD-16 连续不跳号 ✓
- 每条 BDD 只有一条 Given-When-Then（多场景已拆为独立编号）✓

### 逐条评审

- **BDD-01**: PASS — 拖拽 file-sidebar handle 改变宽度。Then "实际宽度比拖拽前增加 50px（误差 ±2px）" 可二值判定。覆盖维度：数据✗ 前端✓ 多端✗ 边界✗ 兼容✗
- **BDD-02**: PASS — 拖拽 toc-sidebar handle 改变宽度。Then "实际宽度比拖拽前增加 30px（误差 ±2px）" 可二值判定。覆盖维度：数据✗ 前端✓ 多端✗ 边界✗ 兼容✗
- **BDD-03**: PASS — 超最大宽度 clamp 到上限。Then "宽度固定在上限值（500px），不超过上限" 可二值判定。覆盖维度：数据✗ 前端✓ 多端✗ 边界✓ 兼容✗
- **BDD-04**: PASS — 超最小宽度 clamp 到下限。Then "宽度固定在下限值（150px），不低于下限" 可二值判定。覆盖维度：数据✗ 前端✓ 多端✗ 边界✓ 兼容✗
- **BDD-05**: PASS — 拖拽后刷新恢复宽度。Then "file-sidebar 宽度为 350px" 可二值判定。覆盖维度：数据✓ 前端✓ 多端✗ 边界✗ 兼容✗
- **BDD-06**: PASS — localStorage 非法值回退默认。Then "宽度为 --sidebar-width 默认值（260px）" 可二值判定。覆盖维度：数据✓ 前端✓ 多端✗ 边界✓ 兼容✗
- **BDD-07**: PASS — localStorage 超范围值回退默认。Then "宽度为 --toc-width 默认值（240px）" 可二值判定。覆盖维度：数据✓ 前端✓ 多端✗ 边界✓ 兼容✗
- **BDD-08**: PASS — <1024px 不显示 handle。Then "页面中不渲染任何 resize handle 元素" 可二值判定。覆盖维度：数据✗ 前端✓ 多端✓ 边界✗ 兼容✗
- **BDD-09**: PASS — zen mode 下 handle 不可见。Then "resize handle 随侧边栏一起消失" 可二值判定。覆盖维度：数据✗ 前端✓ 多端✗ 边界✗ 兼容✓
- **BDD-10**: PASS — file-sidebar 条件渲染关闭时 handle 不显示。Then "file-sidebar 的 resize handle 不渲染" 可二值判定。覆盖维度：数据✗ 前端✓ 多端✗ 边界✗ 兼容✗
- **BDD-11**: PASS — toc-sidebar 条件渲染关闭时 handle 不显示。Then "toc-sidebar 的 resize handle 不渲染" 可二值判定。覆盖维度：数据✗ 前端✓ 多端✗ 边界✗ 兼容✗
- **BDD-12**: PASS — 拖拽期间文字不被选中。Then "content-area 中的文字不被高亮选中" 可二值判定（检查 window.getSelection().isCollapsed）。覆盖维度：数据✗ 前端✓ 多端✗ 边界✗ 兼容✗
- **BDD-13**: PASS — 拖拽期间不触发内容区滚动。Then "content-area 不发生滚动位移" 可二值判定（比较 scrollTop 前后值）。覆盖维度：数据✗ 前端✓ 多端✗ 边界✓ 兼容✗
- **BDD-14**: PASS — 双击 file-sidebar handle 重置宽度。Then "file-sidebar 宽度恢复为 --sidebar-width 默认值（260px）" 可二值判定。覆盖维度：数据✓ 前端✓ 多端✗ 边界✗ 兼容✗
- **BDD-15**: PASS — 双击 toc-sidebar handle 重置宽度。Then "toc-sidebar 宽度恢复为 --toc-width 默认值（240px）" 可二值判定。覆盖维度：数据✓ 前端✓ 多端✗ 边界✗ 兼容✗
- **BDD-16**: PASS — handle 可键盘聚焦。Then "handle 显示可见的 focus 指示器（focus ring）" 可二值判定（检查 :focus-visible 样式或 computed outline）。"focus ring" 略偏主观但有明确视觉锚点，可接受。覆盖维度：数据✗ 前端✓ 多端✗ 边界✗ 兼容✗

### BDD Then 子句绑定检查

| 绑定类型 | 检查结果 |
|---------|---------|
| CSS 类名绑定 | 无（Then 子句未绑定 CSS 类名）✓ |
| HTML 属性名绑定 | 无（Then 子句未绑定 HTML 属性名）✓ |
| 主观形容词 | BDD-16 "可见的 focus 指示器" 略偏主观，但有 "focus ring" 作为视觉锚点，P6 可通过 :focus-visible 检查判定。不阻塞。 |
| 具体数值锚定 | BDD-01/02（50px/30px ±2px）、BDD-03/04（500px/150px）、BDD-05/06/07/14/15（260px/240px/350px）均有具体数值，可精确判定 ✓ |

## 隐含需求覆盖

### 数据维度
- **覆盖**：localStorage 新增两个 key（peekview-sidebar-width、peekview-toc-width），值校验（NaN/负数/超范围字符串→回退默认值），不破坏已有数据。IM-4 覆盖 localStorage 值校验 + clamp。BDD-06/07 覆盖非法值和超范围值回退。
- **遗漏**：无。

### 前端维度
- **覆盖**：UI 状态（resize handle 显示/隐藏）、交互（拖拽/双击 reset）、响应式（≥1024px 显示 / <1024px 不显示）、可访问性（focus ring + aria 属性）。IM-2（user-select 禁用）、IM-3（rAF 节流）、IM-5（z-index）、IM-7（focus + aria）、IM-8（min/max clamp）、IM-9（不触发滚动）、IM-10（双击 reset）全面覆盖。
- **遗漏**：无。

### 多端维度
- **覆盖**：明确声明纯前端任务，不涉及 MCP/CLI/API。
- **遗漏**：无（正确排除）。

### 边界维度
- **覆盖**：空值（localStorage 无值→CSS 变量默认值）、极值（clamp min/max）、并发（多 tab 同时拖拽→最后写入胜出，可接受）。
- **遗漏**：无。

### 兼容维度
- **覆盖**：默认宽度不变（移除 scoped 硬编码后回退到 variables.css 的 260px/240px）、zen mode 不受影响（display:none 与 width 正交）。
- **遗漏**：无。

### 隐含需求条目覆盖确认

| 隐含需求 | 覆盖 BDD | 评审 |
|---------|---------|------|
| IM-1 移除 scoped 硬编码 | 前提条件（非 BDD 直接覆盖，但 BDD-05/06/07 间接依赖） | 合理——前提条件不需要独立 BDD |
| IM-2 user-select 禁用 | BDD-12 | ✓ |
| IM-3 rAF 节流 | 无直接 BDD | 合理——性能优化是实现细节，P3 TDD 覆盖 |
| IM-4 localStorage 值校验 | BDD-06/07 | ✓ |
| IM-5 z-index | 无直接 BDD | 合理——z-index 不干扰是约束条件，非用户可感知行为 |
| IM-6 条件渲染联动 | BDD-10/11 | ✓ |
| IM-7 focus + aria | BDD-16 | ✓ |
| IM-8 min/max clamp | BDD-03/04 | ✓ |
| IM-9 不触发滚动 | BDD-13 | ✓ |
| IM-10 双击 reset | BDD-14/15 | ✓ |

## 裁剪评审

| 阶段 | 裁剪决定 | 理由 | 评审 |
|------|---------|------|------|
| P1 | 不可裁 | 核心阶段 | ✓ 正确 |
| P2 | 保留，可简化 | follows_existing_pattern（CSS 变量 + composable 模式已有先例 useViewMode.ts），1 候选方案 | ✓ 合理——源码验证 useViewMode.ts 确为 load/save + 校验模式，模式可复用 |
| P3 | 保留 | drag 交互有边界条件需测试 | ✓ 正确——drag/clamp/reset 有可测试行为 |
| P4 | 保留 | 代码实现 | ✓ |
| P5 | 保留 | vitest 单测 + 隔离验证 | ✓ |
| P6 | 不可跳 | UI 交互任务，必须 Playwright 实跑 | ✓ 正确——P0-brief 明确声明 |
| P7 | 保留 | 多文件改动需一致性检查 | ✓ 正确——涉及 5 个文件 |
| P8 | 保留 | 发布准备 | ✓ |

**risk_level: low** — 与 P0-brief 裁剪倾向一致（follows_existing_pattern）。源码验证确认 CSS 变量和 composable 模式确实已有先例，风险评级合理。

**capability_requirements** — 三项能力需求全部 `available`，均依赖 playwright-cdp skill，与 P0-brief 的 executor_env 一致。✓

## P1 纯净性检查

- **解决方案设计混入**：无。P1 只定义"做什么"（可拖拽、持久化、边界 clamp、双击 reset、可访问性），未指定"怎么做"（未指定具体组件结构、事件绑定方式、CSS 变量命名方案）。packages 声明中的文件路径是范围声明，非实现设计。✓
- **实现细节混入**：无。IM-3 提到 requestAnimationFrame 但作为隐含需求（"为什么必须"），非实现指令。P2 可选择其他节流方案。✓

## 源码验证（对照 P1 声明）

| P1 声明 | 源码位置 | 验证结果 |
|---------|---------|---------|
| scoped 硬编码 200px | EntryDetailContent.vue:174 `.file-sidebar { width: 200px }` | ✓ 确认 |
| scoped 硬编码 240px | EntryDetailContent.vue:177 `.toc-sidebar { width: 240px }` | ✓ 确认 |
| CSS 变量 --sidebar-width: 260px | variables.css:31 | ✓ 确认 |
| CSS 变量 --toc-width: 240px | variables.css:32 | ✓ 确认 |
| layout.css 用 var() | layout.css:101 `.file-sidebar { width: var(--sidebar-width) }` | ✓ 确认 |
| @media (min-width: 1024px) | layout.css:146 | ✓ 确认 |
| zen-mode display:none | layout.css:601-608 | ✓ 确认 |
| file-sidebar v-if 条件 | EntryDetailContent.vue:4 `v-if="isFileTreeOpen && isMultiFile"` | ✓ 确认 |
| toc-sidebar v-if 条件 | EntryDetailContent.vue:55 `v-if="isTocOpen && isMarkdown && !sourceViewMode && tocHeadings.length > 0"` | ✓ 确认 |
| useViewMode.ts 模式 | composables/useViewMode.ts（load/save + VALID_MODES 校验） | ✓ 确认 |

## 非阻塞性观察（供 P2 参考，不影响 P1 通过）

1. **断点差异**：`useResponsiveLayout.ts:21` 定义 `isMobile = viewportWidth <= 640`，而 CSS `@media (min-width: 1024px)` 控制侧边栏显示。641px-1023px 区间内 `isMobile` 为 false 但 CSS 侧边栏 `display: none`。P1 BDD-08 正确使用 `<1024px` 作为 handle 不显示条件（与 CSS 一致）。P2/P4 实现时需注意 handle 显示条件应基于 ≥1024px 而非 `isMobile`。这是实现考量，P1 需求层面正确。

2. **BDD-16 "可见的 focus 指示器"**：略偏主观，但 "focus ring" 是可接受的视觉检查锚点。P6 验收时可通过检查 `:focus-visible` computed style 或 `document.activeElement` 判定。不阻塞。

3. **IM-3 rAF 节流无直接 BDD**：合理——性能优化是内部实现细节，用户不可直接感知。P3 TDD 可通过性能测试覆盖。不阻塞。

4. **IM-5 z-index 无直接 BDD**：合理——z-index 不干扰是约束条件，非用户可感知行为。P4 代码审查覆盖。不阻塞。
