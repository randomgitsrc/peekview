---
phase: P1
task_id: T031-cold-open-performance
type: problems
parent: P0-brief.md
trace_id: T031-P1-20260722
status: draft
created: 2026-07-22
agent: analyst
---

# P1 需求基线 — Explore 列表页性能与交互优化

## 需求复述

Explore 列表页存在 5 个体验问题：(1) 点击卡片后详情页加载慢（串行 3 次网络请求无即时反馈）；(2) 卡片/列表项不是真链接（无右键菜单、无法新标签页打开）；(3) 元信息分隔符 `·` 在部分字体 fallback 下渲染为灰色方块；(4) 搜索框 placeholder 是中文，与全英文 UI 不一致；(5) 首页 "Explore" 按钮文案含义模糊。

## 隐含需求识别

1. **嵌套交互元素冲突**：EntryCard 的 card-actions（toggle/delete 按钮）和 meta-username（router-link）嵌套在卡片内。改为 `<a>` 后，HTML 规范禁止 `<a>` 内嵌套交互元素（button/a），必须重构 DOM 层级或用事件委托，否则浏览器行为未定义。为什么必须：不处理会导致嵌套按钮/链接在部分浏览器中不可点击。

2. **并行加载的错误边界**：当前 loadEntry 串行链中，getEntry 失败则不请求 fileContent。改为并行后，若 entry 请求失败但 fileContent 请求已发出，需丢弃后者的结果。为什么必须：否则会出现"entry 为空但 fileContent 有值"的脏状态。

3. **share token 兼容**：loadEntry 接受可选 shareToken 参数，并行改造不能丢失此参数传递路径。为什么必须：分享链接是核心功能，破坏则影响所有私有 entry 的分享访问。

4. **骨架屏需覆盖双视图模式**：EntryListView 有 grid（EntryCard）和 list（EntryListRow）两种布局，加载态需与对应布局形态一致。为什么必须：只做一个形态的骨架屏在另一模式下仍会布局跳动。

5. **`·` 修复范围**：分隔符出现在 EntryCard.vue、EntryListRow.vue、EntryListView.vue footer 三处（EntryDetailView 的 meta-dot 是 CSS 空 span，不受影响）。为什么必须：只改一处会导致视觉不一致。

6. **"Explore" 文案两处**：LandingView.vue 的 hero-cta 和 cta-band 各有一个 "Explore" 按钮，需同步修改。为什么必须：只改一处则首页内文案自相矛盾。

7. **键盘可访问性保持**：当前卡片有 `role="button"` + `tabindex="0"` + Enter/Space 键处理。改为 `<a>` 后原生支持 Enter，但需确认 Space 键行为（`<a>` 原生不响应 Space）是否需要保留。为什么必须：降级键盘可访问性违反 a11y 基线。

8. **详情页首屏即时反馈**：当前 EntryDetailView loading 态是纯文本 "Loading..."。并行加载减少等待时间，但用户点击后到详情页渲染之间仍需即时视觉反馈（骨架屏或 spinner）。为什么必须：即使并行化，网络延迟仍存在，无反馈则"点了像没反应"的问题只减轻不消除。

## BDD 验收条件

### BDD-1: 详情页并行加载

Given 用户在 Explore 列表页
When 用户点击一个包含单个文本文件的 entry 卡片
Then 详情页在 entry 元数据和首个文件内容两个请求均完成后渲染内容，且两个请求是并发发出的（非串行等待）

### BDD-2: 卡片为原生链接

Given 用户在 Explore 列表页（grid 或 list 视图）
When 用户右键点击一个 entry 卡片/列表项的标题区域
Then 浏览器显示包含"在新标签页中打开"和"复制链接地址"的原生链接上下文菜单

### BDD-3: 分隔符渲染

Given 用户在 Explore 列表页，存在一个有 username 且有多文件的 entry
When 页面渲染完成
Then 元信息行中各字段之间的分隔符在亮色和暗色主题下均显示为与周围文字同色系的可见字符，无灰色方块或 tofu 字符

### BDD-4: 搜索框 placeholder 语言

Given 用户在 Explore 列表页
When 搜索框为空且未聚焦
Then placeholder 文本为英文，且描述了搜索范围（标题、标签、文件内容）

### BDD-5: 导航按钮文案

Given 用户在首页（Landing 页）
When 页面渲染完成
Then 通往 /explore 的主按钮文案不是 "Explore"，而是更明确表达"浏览公开内容"含义的英文措辞

### BDD-6: 加载态即时反馈

Given 用户在 Explore 列表页或点击卡片进入详情页
When 数据请求尚未返回
Then 页面显示与真实内容布局形态一致的占位元素（骨架屏），而非纯文本 "Loading..."

### BDD-7: 嵌套交互元素可用

Given 用户是 entry 的 owner，在 grid 视图查看自己的 entry 卡片
When 用户点击卡片上的 visibility toggle 按钮或 delete 按钮
Then 对应操作正常触发，不触发卡片导航；用户点击 username 链接时导航到用户页，不触发卡片导航

## 待确认清单

无。所有子项在 P0 中已明确界定，隐含需求均为技术必然而非业务方向判断。

## 裁剪说明

```yaml
phases: [P1, P2, P3, P4, P5, P6, P7, P8]
```

## 范围声明

```yaml
domains: [frontend]
packages: [frontend-v3]
risk_level: medium
```

risk_level 理由：涉及 DOM 结构重构（`<a>` 改造影响 a11y 和事件模型）和加载链改造（并行化影响状态管理），但限于纯前端、不改后端契约。

## 能力需求声明

```yaml
capability_requirements:
  - need: browser-vision
    why: P6 验收需 Playwright 截图验证骨架屏布局、分隔符渲染、右键菜单行为（桌面+移动）
    available:
      - "vision-helper subagent（Task 工具派发）"
      - "playwright-cdp skill（CDP 连接 Windows Chrome :18800）"
    status: available
    requires_minimal_validation: true
```
