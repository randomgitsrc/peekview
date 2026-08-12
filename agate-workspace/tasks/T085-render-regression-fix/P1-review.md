---
phase: P1
task_id: T085-render-regression-fix
type: review
parent: P1-requirements.md
trace_id: T085-P1-review-20260802
status: approved
created: 2026-08-02
agent: requirements-review
---

# P1 需求基线评审 — T085 详情页渲染回归修复

**评审对象**：`docs/tasks/T085-render-regression-fix/P1-requirements.md`（agent: analyst）
**评审依据**：P0-brief.md + 代码事实核查（useEntryDetailComputed.ts / EntryDetailContent.vue / useResponsiveLayout.ts / TableView.vue / code.css / layout.css / markdown.css / DESIGN.md / E2E specs / seed-data）

## BDD 评审

### 逐条判定

#### BDD-1: SVG 文件默认渲染为图片预览 — **PASS 可二值判定**
- Given/When/Then 完整，单一场景
- 判定方式：打开 svg-standalone entry → 选中 architecture.svg → 检查是否存在 `<img>` 图片元素且无 tree 节点/源码文本
- 覆盖维度：数据✓（.svg 文件）前端✓（渲染输出）多端✗ 边界✓（加载成功/失败状态）兼容✓
- **可二值**：图片元素可见 = PASS，显示树/源码 = FAIL
- 核查：seed-data `svg-standalone/architecture.svg` 存在；`guessMimeType('.svg')` = `image/svg+xml`（mime.ts:3）；`isImage` computed 已含 SVG 检测（useEntryDetailComputed.ts:32）——但调度链 `isXml` 在 `isImage` 之前截获（EntryDetailContent.vue:40），修复后 SVG 应落到 `isImage` 分支（:45）。BDD 描述与代码事实一致

#### BDD-2: 普通 XML 文件仍渲染为树视图（防回归） — **PASS 可二值判定**
- Given/When/Then 完整，单一场景
- 判定方式：打开 xml-maven-pom entry → 选中 pom.xml → 检查树节点可见
- 覆盖维度：数据✓（.xml 文件）前端✓ 前端✓ 多端✗ 边界✗ 兼容✓
- **可二值**：树视图可见 = PASS，图片/纯源码 = FAIL
- 核查：seed-data `xml-maven-pom/pom.xml` 存在；`language.py` 将 .xml 映射为 'xml'，`isXml` computed 触发，调度链 `isCsv||isTsv||isJson||isYaml||isXml` 命中 TreeView（:43）。BDD 正确守护防回归

#### BDD-3: SVG 文件不显示源码/渲染切换按钮 — **PASS 可二值判定**
- Given/When/Then 完整，单一场景
- 判定方式：选中 .svg 文件 → 检查操作区无 toggle 按钮
- 覆盖维度：数据✓ 前端✓（按钮可见性）多端✗ 边界✗ 兼容✓
- **可二值**：无 toggle 按钮 = PASS，有按钮 = FAIL
- 核查：toggle 按钮由 `isRichRenderable` 门控（EntryDetailHeader.vue:30, EntryDetailMobileBar.vue:17），`isRichRenderable` 含 `isXml`（useEntryDetailComputed.ts:26）。SVG 修复后若 `isXml && !isSvg` 使 SVG 不再 rich-renderable，按钮消失——BDD-3 正确约束此行为。**NC-1 已由用户确认**（P1-requirements §4），方向明确

#### BDD-4: 富渲染格式源码视图可纵向滚动到底 — **PASS 可二值判定**
- Given/When/Then 完整，单一场景
- 判定方式：长 CSV/JSON/Markdown → 切源码视图 → 向下滚动 → 最后一行可见
- 覆盖维度：数据✓（超视口高度文件）前端✓（滚动行为）多端✗ 边界✓（滚动到底）兼容✓
- **可二值**：最后一行可见 = PASS，内容被裁剪不可达 = FAIL
- 核查：`.code-body` 当前为空规则（code.css:38-39），`.code-viewer` 有 `overflow: hidden`（P0-brief 述），flex 子元素无高度约束导致裁剪。BDD 正确描述期望行为

#### BDD-5: 普通文本 fallback 源码视图可纵向滚动到底（防回归） — **PASS 可二值判定**
- Given/When/Then 完整，单一场景
- 判定方式：普通文本文件（非富渲染）→ 直接源码视图 → 滚到底 → 最后一行可见
- 覆盖维度：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **可二值**：最后一行可见 = PASS，不可达 = FAIL
- 核查：fallback CodeViewer 共用 `.code-body` CSS（EntryDetailContent.vue:46），IM-2 正确识别此隐含需求。BDD-5 与 BDD-4 配对覆盖两条路径

#### BDD-6: 桌面端 Markdown 渲染视图左右留白 ≥ 32px — **PASS 可二值判定**
- Given/When/Then 完整，单一场景
- 判定方式：桌面视口（≥1024px）→ 测量渲染内容（文本）左/右边缘到内容区域左/右边缘水平距离 → ≥ 32px
- 覆盖维度：数据✓ 前端✓（边距数值）多端✗ 边界✓（数值阈值）兼容✓
- **可二值**：≥ 32px = PASS，< 32px = FAIL
- 核查：DESIGN.md §6 Container Padding "32px desktop, 16px mobile"（:113）。当前 content-area `padding: var(--space-4)` = 16px（EntryDetailContent.vue:174），markdown-body 无 padding（MarkdownViewer.vue:125-128 仅 max-width+margin）。当前 16px < 32px，BDD 正确描述差距。`--space-6` = 32px（variables.css:9），修复后可达标

#### BDD-7: 移动端 Markdown 渲染视图左右留白 ≥ 16px — **PASS 可二值判定**
- Given/When/Then 完整，单一场景（移动视口 390px）
- 判定方式同 BDD-6，阈值 ≥ 16px
- 覆盖维度：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **可二值**：≥ 16px = PASS，< 16px = FAIL
- 核查：当前移动端 content-area `padding: var(--space-3) var(--space-2)` = 12px/8px（:175），`--space-4` = 16px。BDD 正确描述期望

#### BDD-8: 滚动到底端后继续滚动不触发头部元信息状态翻转 — **PASS 可二值判定**
- Given/When/Then 完整，单一场景
- 判定方式：滚到底端 → 继续向下滚动输入 → 头部元信息显示状态不变 + 内容区不弹跳
- 覆盖维度：数据✓ 前端✓（滚动+状态）多端✗ 边界✓（底端边界）兼容✓
- **可二值**：状态不变 + 不弹跳 = PASS，状态翻转或弹跳 = FAIL
- 核查：`setupScrollHide`（useResponsiveLayout.ts:26-36）无底端边界保护，`current < lastScrollTop` 在 overscroll 时可能触发 `metaTagsHidden` 翻转。BDD 正确描述期望。**注意**：BDD 用"持续滚动输入期间保持不变"作为判定，可二值

#### BDD-9: 真实点击可选中每页行数并回到第 1 页 — **PASS 可二值判定**
- Given/When/Then 完整，单一场景
- 判定方式：>100 行 CSV → 第 3 页 → 真实点击打开 → 点击 50 → 50 行 + 回到第 1 页
- 覆盖维度：数据✓（>100 行）前端✓（点击交互）多端✗ 边界✓ 兼容✓
- **可二值**：50 行 + 第 1 页 = PASS，否则 FAIL
- 核查：E2E `t075-csv-300`（300 行，beforeAll 通过 API 创建）存在（structured-data-viewer.spec.ts:37,148）。当前测试用 `selectOption('50')` 绕过真实点击（:152），BDD 明确禁止 `selectOption()`——正确纠正测试盲区。**数据可用性确认**：capability_requirements 声明 "csv-employees 仅 30 行" 属实（31 行），但 E2E 通过 API 自建 t075-csv-300 满足需求

#### BDD-10: 每页行数控件触达目标 ≥ 44px — **PASS 可二值判定**
- Given/When/Then 完整，单一场景（移动视口）
- 判定方式：测量可点击区域最小边长 → ≥ 44px
- 覆盖维度：数据✓ 前端✓（尺寸）多端✗ 边界✓（数值阈值）兼容✓
- **可二值**：≥ 44px = PASS，< 44px = FAIL
- 核查：DESIGN.md §10 "Touch targets: minimum 44px"（:261）。当前 `.per-page-select` padding 仅 `var(--space-1) var(--space-2)` = 4px/8px（TableView.vue:278-285），远不达标。BDD 正确

#### BDD-11: 每页行数控件支持键盘操作 — **PASS 可二值判定**
- Given/When/Then 完整，单一场景
- 判定方式：键盘聚焦 → 方向键选择 → 回车 → 行数改变
- 覆盖维度：数据✓ 前端✓（键盘 a11y）多端✗ 边界✗ 兼容✓
- **可二值**：行数改变 = PASS，不变 = FAIL
- 核查：DESIGN.md §10 a11y 要求。当前原生 `<select>` 支持键盘，但若改为自定义组件需重新保证。BDD 正确约束

### BDD 编号格式核查
- 全部使用 `#### BDD-NN:` 标准格式 ✓
- 编号连续 BDD-1 到 BDD-11，无跳号 ✓
- 每条 BDD 仅一条 Given-When-Then，无多场景合并 ✓
- 无"⚠️ 调整""部分通过"等中间态描述 ✓

## 隐含需求覆盖

### 数据维度 — **覆盖**
- IM-7：SVG 走 ImageViewer 后继承大文件策略（5MB/10MB）——已识别
- BDD-1/BDD-2 分别覆盖 .svg 和 .xml 数据格式
- seed-data 核查：svg-standalone、xml-maven-pom、markdown-test（624 行）、csv-employees（30 行）均存在

### 前端维度 — **覆盖**
- IM-1：SVG 调度修复后 toggle 按钮行为——已识别并纠正 P0-brief 错误假设
- IM-3：Markdown 边距只影响 MarkdownViewer——已识别
- IM-4：scroll-hide 边界保护不破坏正常滚动——已识别
- BDD-3/BDD-8/BDD-6/BDD-7/BDD-10/BDD-11 覆盖 UI 状态/交互/响应式/可访问性

### 多端维度 — **覆盖**
- IM-6：现有 T075 E2E 84 断言防回归——已识别
- BDD-2 显式守护 XML 树视图
- BDD-5 显式守护 fallback CodeViewer 滚动
- domains 声明 frontend + test/e2e，packages 声明 frontend-v3 + frontend-v3-e2e ✓

### 边界维度 — **覆盖**
- IM-2：CodeViewer 全路径滚动（toggle + fallback + parse-error 降级）——已识别
- BDD-4/BDD-5 配对覆盖两条路径
- BDD-8 覆盖底端滚动边界
- BDD-6/BDD-7/BDD-10 覆盖数值阈值边界

### 兼容维度 — **覆盖**
- BDD-2 防回归 XML 树视图
- BDD-5 防回归 fallback 滚动
- IM-6 防回归 84 E2E 断言
- §6 兼容性声明：不改变 API 契约与数据模型 ✓

## 裁剪评审

```yaml
risk_level: medium
phases: [P1, P2, P3, P4, P5, P6, P7, P8]
```

| 阶段 | 裁剪判定 | 理由核查 |
|------|---------|---------|
| P1 | 不可裁 ✓ | 需求基线，所有任务必走 |
| P2 | 不可裁 ✓ | 5 修复横跨调度链/公共 CSS/组合式函数/组件，跨层交互多。核查：content-area padding + code-body flex + scroll-hide + overscroll + select 联动，确实需要设计评审 |
| P3 | 保留 ✓ | 缺陷均有明确可测行为，1177 vitest / 84 E2E 防回归需 TDD 红灯。risk=medium 不可跳 |
| P4 | 保留 ✓ | 前端实现 |
| P5 | 保留 ✓ | 全量测试套件防回归（T084/T075 回归教训） |
| P6 | 不可裁 ✓ | 用户可见渲染缺陷，必须 Playwright 实跑 + 真实点击 + vision 验证 |
| P7 | 保留 ✓ | 9+ 文件跨组件改动，需一致性交叉核对 |
| P8 | 保留 ✓ | 用户可见修复，需版本记录 + CHANGELOG |

- risk_level: medium 合理——涉及前端核心渲染链 + 跨组件交互，但不涉及 schema/安全/API 契约
- capability_requirements 三态判断：browser-e2e=available ✓ / browser-vision=available ✓ / test-data=available ✓（E2E 自建 + seed-data 组合满足）
- 无 status: GAP

## P1 纯净性核查

### 有无掺入解决方案设计？
- IM-1 提到"方向：SVG 恢复走 ImageViewer 图片预览，切换按钮对 SVG 隐藏"——这是**需求方向**（用户确认 NC-1），非解决方案设计。BDD-3 描述"不显示切换按钮"是行为约束，不规定实现方式
- §6 范围声明列"涉及文件"来自 P0-brief 确认的影响面，非 P1 设计的方案——可接受（P0 已划定，P1 确认）
- 无"用 isSvg computed""用 overscroll-behavior: none""用 BaseSelect 组件"等实现指令——P0-brief 有方案方向但 P1 未复制到 BDD，BDD 只描述期望行为 ✓

### 有无混入实现细节？
- BDD 全部描述用户可见行为（显示图片/可滚动/留白数值/不抖动/可点击选中），无 API 调用、组件名、CSS 属性 ✓
- 唯一接近的是 BDD-9 "禁止 selectOption() 程序化设置"——这是**测试方法约束**（纠正测试盲区），非实现细节。合理

## 待确认清单核查

- NC-1 已确认（用户 2026-08-02），BDD-3 已按确认结果更新 ✓
- `[NO_NEED_CONFIRM]` 标记其余隐含需求 ✓
- 无未决 `[NEED_CONFIRM]` ✓

## 实质锚点引用

| review 结论 | 引用锚点 |
|------------|---------|
| approved | BDD-1 ~ BDD-11（11 条全部可二值判定） |
| 隐含需求覆盖 OK | IM-1 ~ IM-7（7 条全部覆盖） |
| 裁剪合理 | P1 不可裁 / P2 不可裁 / P6 不可裁 + P3/P4/P5/P7/P8 保留（8 阶段全走，risk=medium） |

## 覆盖维度汇总

| BDD | 数据 | 前端 | 多端 | 边界 | 兼容 |
|-----|------|------|------|------|------|
| BDD-1 | ✓ | ✓ | ✗ | ✓ | ✓ |
| BDD-2 | ✓ | ✓ | ✗ | ✗ | ✓ |
| BDD-3 | ✓ | ✓ | ✗ | ✗ | ✓ |
| BDD-4 | ✓ | ✓ | ✗ | ✓ | ✓ |
| BDD-5 | ✓ | ✓ | ✗ | ✓ | ✓ |
| BDD-6 | ✓ | ✓ | ✗ | ✓ | ✓ |
| BDD-7 | ✓ | ✓ | ✗ | ✓ | ✓ |
| BDD-8 | ✓ | ✓ | ✗ | ✓ | ✓ |
| BDD-9 | ✓ | ✓ | ✗ | ✓ | ✓ |
| BDD-10 | ✓ | ✓ | ✗ | ✓ | ✓ |
| BDD-11 | ✓ | ✓ | ✗ | ✗ | ✓ |

**多端维度说明**：本任务无 API↔客户端契约变更（§6 明确不改后端/MCP/API），多端维度不适用（✗ = 无需覆盖），非遗漏。

## 结论

**status: approved**

P1-requirements.md 通过评审：
- 11 条 BDD（BDD-1 ~ BDD-11）全部可二值判定，编号格式合规，无多场景合并
- 7 条隐含需求（IM-1 ~ IM-7）全部覆盖，含对 P0-brief 错误假设的纠正（IM-1）
- 裁剪合理（8 阶段全走，risk=medium），capability_requirements 无 GAP
- P1 纯净——无解决方案设计掺入，BDD 描述用户行为不描述实现
- NC-1 已确认，无未决 NEED_CONFIRM
- 代码事实核查全部通过（调度链/CSS/scroll-hide/select/E2E/seed-data 均与 BDD 描述一致）
