---
phase: P1
task_id: T076-entry-card-interaction
type: problems
parent: P0-brief.md
trace_id: T076-P1-20260730
status: draft
created: 2026-07-30
agent: analyst
domains: [frontend]
packages: [frontend-v3]
risk_level: low
phases: [P1, P2, P3, P4, P5, P6, P7, P8]
capability_requirements:
  - need: browser-vision
    why: P6 验收需要截图验证 hover 下划线、tag 点击跳转、tooltip 显示等交互行为
    available:
      - "vision-helper subagent（多模态模型，可读截图）"
      - "playwright-cdp skill（CDP Chrome :18800 可用）"
    status: available
    requires_minimal_validation: false
---

## 需求复述

修复 EntryCard / EntryListRow 的交互语义混乱（整 card-body 是 `<a>` 导致 hover 全下划线、右键复制链接错乱），并让 Tags 可点击跳转到按 tag 过滤的 Explore 页。具体：

- A. EntryCard：card-body 从 `<a>` 改为 `<div>`，title/username/tag 各自独立链接
- B. EntryListRow：同步修复相同结构问题
- C. Explore 页：读取 URL `?tags=` 参数过滤列表，UI 显示已选 tag 指示（可移除）
- D. tag-overflow：`+N` hover/tap 显示全部 tags 的 tooltip

**P0 路径修正**：P0 写 `/?tags=xxx`，但 router.ts 中 `/` 是 LandingView（匿名）或 redirect 到 `/explore`（已认证，redirect 不保留 query）。正确的 tag 过滤目标是 `/explore?tags=xxx`。

## 隐含需求识别

1. **SPA 导航保持**：card-body 从 `<a @click.prevent>` 改为 `<div>` 后，title 链接必须仍走 SPA 路由（router-link 或 @click.prevent + router.push），否则每次点击全页刷新。为什么必须：用户体验退化，且当前 `navigateToEntry` 逻辑附带 firstFileId query 参数。
2. **EntryListRow tag 截断对齐**：当前 EntryListRow 的 `visibleTags` 显示全部 tags（`remainingTagCount` 硬编码 0），与 EntryCard 的 TAG_LIMIT=3 不一致。改为可点击后若不截断，tags 多的 entry 会撑开行高。为什么必须：列表视图行高一致性。
3. **URL 同步**：tag 过滤状态需反映在 URL 中（如 `/explore?tags=python,cli`），支持刷新恢复、分享链接、浏览器前进/后退。为什么必须：与现有 q/owner/status/page 的 URL 同步模式一致。
4. **tag 过滤与现有过滤器组合**：tags 需与 owner/status/q/page 组合生效（如 `/explore?owner=me&tags=python`）。为什么必须：用户可能同时使用 tab 过滤和 tag 过滤。
5. **键盘 focus 样式**：title/username/tag 变为 `<a>` 后天然可 tab 聚焦，但需有可见 focus 指示（outline 或等效样式）。为什么必须：无 focus 样式 = 键盘用户无法知道当前焦点位置。
6. **移动端 tooltip 替代**：hover tooltip 在 touch 设备无 hover 事件，需 tap 可触发（如 tap 显示 tooltip 或展开全部 tags）。为什么必须：P0 明确要求移动端 tag-overflow 可用。
7. **BaseTag 组件改造**：BaseTag 当前是纯 `<span>` 无 props/events，被 EntryCard 和 EntryListRow 共用。改为可点击需传入 href 或 emit 事件。为什么必须：两个组件共用，改一处影响两处。

### 逐维度快速过

- **数据**：无。不改后端，不涉及数据迁移。
- **前端**：核心改动域。EntryCard、EntryListRow、BaseTag、EntryListView 四个文件。
- **多端**：MCP/CLI/API 无需同步（后端 tag 过滤已就绪）。
- **边界**：entry 无 tags 时不渲染 tag 区域（现有 v-if 已处理）；tags 含特殊字符（空格、中文）时 URL 编码需正确。
- **兼容**：card-body 点击区域缩小是有意行为变更（P0 已声明）；`@navigate` emit 移除后父组件 EntryListView 的 `navigateToEntry` 需确认无其他调用方。

## BDD 验收条件

### 卡片交互语义

#### BDD-01: 仅 title hover 显示下划线
- Given Explore 页 grid 视图显示含 title、username、tags 的 entry 卡片
- When 鼠标 hover 到 title 文字上
- Then title 文字出现下划线，其余区域（meta、tags、footer）无下划线

#### BDD-02: 点击 title 进入 entry 详情页
- Given Explore 页显示 entry 卡片，summary 为 "Hello World"
- When 点击 title "Hello World"
- Then 浏览器导航到该 entry 详情页（URL 为 /{slug}），无全页刷新（SPA 导航）

#### BDD-03: 点击 username 进入用户页
- Given Explore 页显示 entry 卡片，username 为 "alice"
- When 点击 "@alice"
- Then 浏览器导航到 /users/alice

#### BDD-04: 右键 title 复制 entry URL
- Given Explore 页显示 entry 卡片，slug 为 "my-post"
- When 右键 title → 复制链接地址
- Then 剪贴板内容为该 entry 的 URL（路径含 /my-post）

#### BDD-05: 右键 username 复制 user URL
- Given Explore 页显示 entry 卡片，username 为 "alice"
- When 右键 "@alice" → 复制链接地址
- Then 剪贴板内容为用户页 URL（路径含 /users/alice）

#### BDD-06: hover 非链接区域无下划线
- Given Explore 页显示 entry 卡片
- When 鼠标 hover 到时间戳或分隔符上
- Then 该文字无下划线，光标为默认箭头（非手型）

### Tag 交互

#### BDD-07: 点击 tag 跳转到 tag 过滤页
- Given Explore 页 grid 视图显示含 tag "python" 的 entry 卡片
- When 点击 tag "python"
- Then 浏览器导航到 /explore?tags=python，列表仅显示含 "python" tag 的 entries

#### BDD-08: tag hover 显示下划线
- Given Explore 页显示含 tags 的 entry 卡片
- When 鼠标 hover 到某个 tag 上
- Then 该 tag 出现下划线，光标为手型

#### BDD-09: tag-overflow hover 显示全部 tags
- Given entry 有 5 个 tags（超过显示上限 3 个），卡片显示 "+2"
- When 鼠标 hover 到 "+2" 上
- Then 出现 tooltip 列出全部 5 个 tags

#### BDD-10: 移动端 tag-overflow tap 可触发
- Given 在 touch 设备上，entry 有 5 个 tags，显示 "+2"
- When 点击（tap）"+2"
- Then 显示全部 tags 信息（tooltip 或展开形式）

### Explore 页 tag 过滤

#### BDD-11: URL 带 tags 参数时列表按 tag 过滤
- Given 用户访问 /explore?tags=python
- When 页面加载完成
- Then 列表仅显示含 "python" tag 的 entries

#### BDD-12: tag 过滤有视觉指示且可移除
- Given /explore?tags=python 已加载，列表显示过滤结果
- When 用户查看工具栏区域
- Then 显示 "python" 的过滤指示（chip），点击移除后列表恢复为无 tag 过滤

#### BDD-13: 多 tag 过滤
- Given 用户访问 /explore?tags=python,cli
- When 页面加载完成
- Then 列表仅显示同时含 "python" 和 "cli" tag 的 entries

#### BDD-14: tag 过滤与搜索组合
- Given /explore?tags=python&q=hello
- When 页面加载完成
- Then 列表仅显示含 "python" tag 且匹配搜索词 "hello" 的 entries

#### BDD-15: tag 过滤刷新后恢复
- Given /explore?tags=python 已加载
- When 用户刷新页面（F5）
- Then 页面重新加载后仍显示 python tag 过滤结果

### EntryListRow 同步

#### BDD-16: list 视图 title 点击进入详情
- Given Explore 页 list 视图显示 entry 行
- When 点击 title 文字
- Then 导航到该 entry 详情页（SPA 导航）

#### BDD-17: list 视图 tag 点击跳转过滤页
- Given Explore 页 list 视图显示含 tag "k8s" 的 entry 行
- When 点击 tag "k8s"
- Then 导航到 /explore?tags=k8s

#### BDD-18: list 视图 username 点击进入用户页
- Given Explore 页 list 视图显示 entry 行，username 为 "bob"
- When 点击 "@bob"
- Then 导航到 /users/bob

#### BDD-19: list 视图 hover 语义与 grid 一致
- Given Explore 页 list 视图显示 entry 行
- When 鼠标 hover 到时间戳区域
- Then 无下划线；hover 到 title/username/tag 时有下划线

### 键盘可访问性

#### BDD-20: Tab 键可聚焦 title/username/tag 链接
- Given Explore 页显示 entry 卡片
- When 用户按 Tab 键遍历
- Then title、username、tag 链接依次获得焦点，每个有可见 focus 指示

### 卡片整体 hover

#### BDD-21: 卡片 hover 边框高亮保持
- Given Explore 页 grid 视图显示 entry 卡片
- When 鼠标 hover 到卡片任意区域（包括非链接区域）
- Then 卡片边框高亮（颜色变化 + 阴影），与改动前行为一致

## 待确认清单

[NO_NEED_CONFIRM]

## 裁剪说明

phases: [P1, P2, P3, P4, P5, P6, P7, P8]

完整走 P1-P8，不裁剪。理由：
- 涉及 4 个组件文件改动 + URL 路由逻辑，非单点修复
- UI 交互变更需 Playwright 实跑验证（P6 不可跳）
- 多文件改动需 P7 一致性交叉核对
- P3 TDD：risk=low 但改动涉及路由逻辑（URL 同步、过滤器组合），有可测试行为，保留

## 范围声明

- domains: [frontend]
- packages: [frontend-v3]
- risk_level: low

复核 P0 的 risk=low 判断：同意。纯前端 UI 重构，不改后端/数据/权限/安全模型。最坏情况是交互回退（链接不工作），不影响数据安全。
