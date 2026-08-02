---
phase: P1
task_id: T085-render-regression-fix
type: problems
parent: P0-brief.md
trace_id: T085-P1-20260802
status: draft
created: 2026-08-02
agent: analyst
---

# P1 需求基线 — T085 详情页渲染回归修复

## 1. 需求复述

T075（structured-data-viewer v0.14.0）上线后，用户在详情页实际使用中发现 5 个渲染缺陷。主 Agent 已定位根因（3 个为 T084 detail-scroll-architecture 回归，2 个为 T075 新增缺陷）。本任务修复这 5 个缺陷并补齐对应验收，确保用户可见行为恢复正常且不引入新回归。

| # | 用户可见缺陷 | 当前行为 | 期望行为 |
|---|-------------|---------|---------|
| P1 | SVG 显示为树视图 | `.svg` 文件渲染为 XML 树 | 默认显示 SVG 图片预览 |
| P2 | 源码视图无法纵向滚动 | 富渲染格式切源码视图后内容被裁剪 | 可通过内容区纵向滚动看到全部内容 |
| P3 | Markdown 渲染边距丢失 | 内容紧贴容器边缘（桌面 16px/移动 8px） | 达到 DESIGN.md §6：桌面 32px/移动 16px |
| P4 | 滚动到底端抖动 | 底端继续滚动时页面弹跳 | 底端滚动不再引起头部元信息翻转/弹跳 |
| P5 | per-page 下拉框选不中 | 真实点击无法弹出/选中 | 真实点击可弹出并选中，遵循 DESIGN.md |

## 2. 隐含需求识别

| # | 隐含需求 | 为什么必须 |
|---|---------|-----------|
| IM-1 | **SVG 调度修复后源码/渲染切换按钮行为必须一致**（见 NC-1）。现状：toggle 按钮由 `isRichRenderable`（含 isXml）门控，而 isImage 分支不响应 sourceViewMode。P0-brief 声称「ImageViewer 已有可切换代码/预览」与代码事实不符——若只改调度链（`isXml && !isSvg`），SVG 落到图片分支后按钮仍可见但点击无效（死按钮），或需隐藏按钮导致现有「SVG 看源码」能力丢失 | 避免修复引入新的用户可见回归（死按钮或丢能力）；P0-brief 的假设错误，必须纠正后再定方向 |
| IM-2 | **CodeViewer 全路径滚动都要验证**：`<>` 切换路径、普通文本 fallback 路径、parse-error 降级路径共用 `.code-body` CSS | P0 known_risks 明确「两个路径都要验证」；只修 toggle 路径可能漏 fallback 路径的同类裁剪 |
| IM-3 | **Markdown 边距修复只影响 Markdown 渲染视图**，不改变 TableView/TreeView/CodeViewer 的现有内容间距 | 用户强调「不做不该做的事」；若走 content-area padding 方案会连带改变所有 viewer 布局，超出缺陷范围 |
| IM-4 | **scroll-hide 边界保护不得破坏正常滚动行为**：向上滚动仍显示头部元信息、向下滚动仍隐藏，仅禁止底端/顶端边界的无意义翻转 | 边界保护的目标是消除抖动，不能把 scroll-hide 的正常功能一起关掉 |
| IM-5 | **per-page 下拉框必须用真实点击验证**（点击打开 → 点击选项），禁用 `selectOption()` | 根因之一就是 E2E 用 `selectOption()` 绕过真实交互导致测试盲区（P0/P1 派发指引强制要求） |
| IM-6 | **现有 T075 E2E 断言防回归**：XML 文件仍显示树视图、CSV/JSON/表格/切换等 84 条 E2E 断言不受影响 | 修复调度链和公共 CSS，可能波及现有富渲染行为；vitest 1177 passed / E2E 84/84 基线必须保持 |
| IM-7 | SVG 走 ImageViewer 后继承其大文件策略（5MB 警告 / 10MB 手动加载），不应因此崩溃 | SVG 修复改变了 SVG 文件的渲染路径，需确认 ImageViewer 现有行为兼容 |

## 3. BDD 验收条件

### 缺陷 P1 — SVG 渲染调度

#### BDD-1: SVG 文件默认渲染为图片预览
- Given 打开包含 `.svg` 文件的 entry 并选中该文件
- When 详情页渲染该文件
- Then 默认显示该 SVG 的图片预览（可见的图片元素已成功加载、未显示加载失败提示），且不显示结构树节点列表或源码文本

#### BDD-2: 普通 XML 文件仍渲染为树视图（防回归）
- Given 打开包含 `.xml` 文件的 entry 并选中该文件
- When 详情页渲染该文件
- Then 仍显示结构树视图（树节点可见，非图片预览、非纯源码）

#### BDD-3: SVG 文件不显示源码/渲染切换按钮，保持图片预览
- Given 打开并选中 `.svg` 文件，处于图片预览状态
- When 检查详情页操作区
- Then 不显示源码/渲染切换按钮（SVG 走 ImageViewer，无源码切换能力，恢复 T075 之前行为）

### 缺陷 P2 — 源码视图滚动

#### BDD-4: 富渲染格式源码视图可纵向滚动到底
- Given 打开内容高度超过视口的富渲染格式文件（如长 CSV/JSON/Markdown）
- When 切换到源码视图（CodeViewer）并在内容区向下滚动
- Then 内容区可滚动到文件末尾，最后一行内容可见

#### BDD-5: 普通文本 fallback 源码视图可纵向滚动到底（防回归）
- Given 打开内容高度超过视口的普通文本文件（非富渲染格式，直接进入源码视图）
- When 在内容区向下滚动
- Then 内容区可滚动到文件末尾，最后一行内容可见

### 缺陷 P3 — Markdown 渲染边距

#### BDD-6: 桌面端 Markdown 渲染视图左右留白达到 DESIGN.md 标准
- Given 桌面视口（宽 ≥ 1024px）打开长 Markdown 文件渲染视图
- When 测量渲染内容左/右边缘与所在内容区域左/右边缘的水平距离
- Then 两侧留白均 ≥ 32px

#### BDD-7: 移动端 Markdown 渲染视图左右留白达到 DESIGN.md 标准
- Given 移动视口（宽 390px）打开 Markdown 文件渲染视图
- When 测量渲染内容左/右边缘与所在内容区域左/右边缘的水平距离
- Then 两侧留白均 ≥ 16px

### 缺陷 P4 — 底端滚动抖动

#### BDD-8: 滚动到底端后继续滚动不触发头部元信息状态翻转
- Given 详情页内容高度超过视口，将内容区滚动到最底端
- When 继续施加向下滚动输入（滚轮/触控板模拟）
- Then 页面不抖动：头部元信息区域（标题/日期等信息所在区域）的显示状态在持续滚动输入期间保持不变，不发生反复显示/隐藏切换，内容区不发生上下弹跳

### 缺陷 P5 — TableView per-page 下拉框

#### BDD-9: 真实点击可选中每页行数并回到第 1 页
- Given 渲染数据行数 > 100 的 CSV 表格，当前位于第 3 页
- When 真实点击「每页行数」控件打开选项列表 → 点击「50」
- Then 每页显示 50 行，且页码回到第 1 页（验证必须走真实点击流程，禁止 `selectOption()` 程序化设置）

#### BDD-10: 每页行数控件触达目标达标
- Given 移动视口渲染 CSV 表格
- When 测量「每页行数」控件的可点击区域
- Then 其最小边长 ≥ 44px（DESIGN.md §10 Touch targets）

#### BDD-11: 每页行数控件支持键盘操作
- Given CSV 表格渲染完成，每页行数为默认值
- When 键盘聚焦「每页行数」控件并通过键盘改变选项（方向键选择 + 回车确认）
- Then 每页行数随之改变，表格按新行数渲染

## 4. 待确认清单

- **NC-1 已确认（用户 2026-08-02）**：SVG 图片预览是原有能力（T075 之前 `.svg` 走 isImage → ImageViewer，T075 新增 isXml 截获是回归）。用户明确"以前能看 SVG 单文件 + Markdown 嵌入 SVG"。方向：SVG 恢复走 ImageViewer 图片预览，切换按钮对 SVG 隐藏。BDD-3 已按此更新。

[NO_NEED_CONFIRM]其余隐含需求（IM-2~IM-7）方向已明确，不需确认。

## 5. 裁剪说明

```yaml
risk_level: medium
phases: [P1, P2, P3, P4, P5, P6, P7, P8]
```

| 阶段 | 是否裁剪 | 理由 |
|------|---------|------|
| P1 | 不可裁剪 | 需求基线，含独立 requirements-review，所有任务必走 |
| P2 | 不可裁剪 | 5 修复横跨调度链/公共 CSS/组合式函数/组件，跨层交互多（code-body flex 与 content-area 滚动联动、scroll-hide 与 overscroll 联动），需设计评审 |
| P3 | 保留 | 缺陷均有明确可测行为（滚动可达、边距数值、真实点击），且需 1177 vitest / 84 E2E 防回归，应走 TDD 红灯 |
| P4 | 保留 | 前端实现 + 全量回归确认 |
| P5 | 保留 | 全量测试套件防回归（T084/T075 两次回归教训） |
| P6 | 不可裁剪 | 用户可见渲染缺陷，必须 Playwright 实跑 + 真实点击 + 截图/vision 验证（对应用户反馈） |
| P7 | 保留 | 涉及 9+ 文件跨组件改动，需一致性交叉核对 |
| P8 | 保留 | 用户可见修复，需版本记录 + CHANGELOG |

## 6. 范围声明

### 受影响的 domains / packages

```yaml
domains:
  - frontend
  - test/e2e
packages:
  - frontend-v3            # 调度链、CSS、组合式函数、组件
  - frontend-v3-e2e        # Playwright spec（per-page 真实点击）
```

### 涉及文件（P0 范围声明已列，此处确认影响面）

| 文件 | 缺陷 |
|------|------|
| `frontend-v3/src/composables/useEntryDetailComputed.ts` | P1 |
| `frontend-v3/src/components/EntryDetailContent.vue` | P1/P4 |
| `frontend-v3/src/styles/code.css` | P2 |
| `frontend-v3/src/components/MarkdownViewer.vue` / `src/styles/markdown.css` | P3 |
| `frontend-v3/src/composables/useResponsiveLayout.ts` | P4 |
| `frontend-v3/src/components/TableView.vue` | P5 |
| `frontend-v3/e2e/structured-data-viewer.spec.ts` | P5 |

### 明确不改（范围边界）

- 后端 `language.py`（.svg → xml 映射保持不变，SVG 确实是 XML）
- MCP Server、CLI、数据库 schema、路由
- TableView/TreeView/DataTreeNode 内部解析逻辑
- `useEntryDetailComputed` 的 isImage 语义（已正确识别 SVG）

### 兼容性

- 现有 53 BDD / 84 E2E 断言不得被破坏（BDD-2 显式守护 XML 树视图）
- 修复不改变 API 契约与数据模型

## 7. 能力需求声明

```yaml
capability_requirements:
  - need: browser-e2e
    why: P6 验收需 Playwright 实跑验证 SVG 图片渲染、源码视图滚动、per-page 真实点击（禁用 selectOption）、底端滚动抖动
    available:
      - "playwright-cdp skill（已注入，CDP 连接 127.0.0.1:18800）"
      - "make debug-test / E2E_SPEC=e2e/<spec> 定向执行"
    status: available

  - need: browser-vision
    why: P6 需截图验证 Markdown 边距达标（32px/16px 数值测量）、SVG 图片预览是否正常渲染
    available:
      - "vision-engine skill"
      - "vision-analyst（agate 内置执行角色）"
    status: available

  - need: test-data
    why: per-page 真实点击需 >100 行 CSV 数据（seed-data csv-employees 仅 30 行，需按 T075 模式由 E2E 通过 API 自建）
    available:
      - "scripts/seed-data/（markdown-test 624 行、svg-standalone、svg-icons）"
      - "E2E beforeAll 通过 /api/v1/entries 创建测试 entry"
    status: available
```

## 环境状态

```yaml
env_constraints: "make debug-quick (127.0.0.1:8888, 独立数据目录 /tmp/peekview-debug/)"
prod_touched: "[PROD_NOT_TOUCHED]"
```
