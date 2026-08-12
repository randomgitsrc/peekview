---
phase: P1
task_id: T069
type: requirements
parent: P0-brief.md
trace_id: T069-P1-20260726
status: draft
created: 2026-07-26
agent: analyst
---

## 需求复述

T069 解决详情页三个问题：

1. **Auth guard 全页刷新 bug**：已登录用户全页刷新 `/settings` 时，`router.beforeEach` 在 `fetchMe()` 完成前运行，`authState='loading'` 被当作未认证，导致重定向到 `/`。SPA 内导航正常，仅全页刷新触发。
2. **品牌文字与标题视觉混淆**：桌面端 header 中 "PeekView" 品牌文字与 entry 标题字号字重接近、同色系、紧挨，视觉上像一句话。移动端 sticky header 中 "PeekView" 文字 + ← 箭头占空间，标题被挤压。
3. **移动端交互元素不协调**：Sign in 按钮视觉权重过大；Explore 按钮与 logo 功能重复；Files/TOC 按钮用文字样式与桌面端 toggle-btn 不统一；Share 按钮在底部 bar 占位应收入 Overflow。

## 隐含需求识别

### 数据维度
- 无已有数据受影响，无迁移需求

### 前端维度
- **桌面端 header 需新增分隔符元素**：品牌文字与标题之间需视觉分隔（1px 竖线），这是 P0-brief 设计方案中明确要求的，但当前模板中无此元素
- **桌面端 Files toggle 需显示文件数量 badge**：当前 toggle-btn 无 badge，需新增 badge 元素（复用 share-badge 样式）
- **FileTree.vue 面板头部需显示文件数量**：当前只有 "FILES" 文字，需改为 "FILES · N" 格式，需传入文件数量
- **移动端 drawer 头部需显示数量**：File drawer "Files · N"、TOC drawer "Table of Contents · N"，需传入对应数量
- **移动端 sticky header 高度变化**：52px → 56px，影响整体布局计算
- **移动端 Sign in 从实心按钮改为文本链接**：点击目标变小，需确保可点击区域足够（min 44px touch target）
- **移动端 bottom bar 按钮风格统一**：Files/TOC 从文字按钮改为 toggle-btn 28px + badge，需同步 active 状态与 drawer 开关

### 多端维度
- 仅前端改动，MCP/CLI/API 不受影响

### 边界维度
- **Auth guard 等待超时**：如果 `fetchMe()` 请求永远不返回（网络断开），守卫等待是否应有超时？当前 `fetchMe()` 无超时机制，守卫等待可能无限挂起
- **Auth guard 等待期间页面状态**：守卫等待 `initializing` 完成期间，页面可能短暂空白，需考虑是否显示 loading 指示
- **单文件 entry 的 Files toggle**：单文件 entry 不显示 Files toggle（`v-if="entryStore.isMultiFile"`），badge 逻辑需与 isMultiFile 一致
- **TOC 无标题时**：`tocHeadings.length === 0` 时不显示 TOC 按钮，drawer 头部 "Table of Contents · 0" 不应出现
- **移动端 drawer 关闭时 toggle-btn active 状态**：drawer 关闭时需取消 active，需同步状态

### 兼容维度
- **不破坏现有 SPA 内导航行为**：守卫修复只影响全页刷新场景，SPA 内导航必须保持现有行为
- **不改变 authStore 的 fetchMe 逻辑**：只改守卫的等待策略
- **桌面端 Explore 按钮保留**：P0-brief 设计方案中桌面端 header 仍有 Explore（CompassIcon），仅移动端移除

## BDD 验收条件

### Auth Guard 修复

#### BDD-1: 已登录用户全页刷新 /settings 时不被重定向
- Given 用户已登录且 authState 为 authenticated
- When 用户在 /settings 页面执行全页刷新（F5 / Ctrl+R）
- Then 页面加载后仍停留在 /settings，不被重定向到 /

#### BDD-2: 未登录用户全页刷新 /settings 时被重定向到首页
- Given 用户未登录且 authState 为 anonymous
- When 用户在 /settings 页面执行全页刷新
- Then 页面加载后被重定向到 /

#### BDD-3: 已登录用户 SPA 内导航到 /settings 正常
- Given 用户已登录
- When 用户从其他页面通过 SPA 导航（点击链接）进入 /settings
- Then 正常显示 /settings 页面

#### BDD-4: 已登录用户全页刷新 / 时重定向到 /explore
- Given 用户已登录
- When 用户在 / 页面执行全页刷新
- Then 页面加载后被重定向到 /explore

#### BDD-5: 未登录用户全页刷新 / 时停留在 /
- Given 用户未登录
- When 用户在 / 页面执行全页刷新
- Then 页面停留在 /（Landing 页）

#### BDD-6: Auth guard 等待期间不产生无限挂起
- Given fetchMe 请求发出但未返回
- When authState 为 loading 且守卫正在等待
- Then 守卫在合理时间内（≤5 秒）完成判定，不会无限阻塞导航

### 桌面端 Header 品牌与标题分离

#### BDD-7: 桌面端品牌文字颜色与标题颜色可区分
- Given 桌面端视口（>640px）且详情页已加载
- When 查看 header 区域
- Then "PeekView" 品牌文字颜色为弱化色（tertiary），entry 标题颜色为主文本色，两者视觉可区分

#### BDD-8: 桌面端品牌文字与标题之间有分隔符
- Given 桌面端视口且详情页已加载
- When 查看 header 区域
- Then "PeekView" 品牌文字与 entry 标题之间存在竖线分隔符

#### BDD-9: 桌面端品牌文字 hover 时变为 accent 色
- Given 桌面端视口且详情页已加载
- When 鼠标悬停在 "PeekView" 品牌文字上
- Then 品牌文字颜色变为 accent 色

### 桌面端 Files Toggle Badge

#### BDD-10: 桌面端多文件 entry 的 Files toggle 显示文件数量
- Given 桌面端视口且当前 entry 有 3 个文件
- When 查看 header 中 Files toggle 按钮
- Then 按钮上显示文件数量 badge（数字 3）

#### BDD-11: 桌面端单文件 entry 不显示 Files toggle
- Given 桌面端视口且当前 entry 只有 1 个文件
- When 查看 header 区域
- Then 不显示 Files toggle 按钮

### FileTree 面板头部

#### BDD-12: FileTree 面板头部显示文件数量
- Given 桌面端 FileTree 面板已打开且当前 entry 有 3 个文件
- When 查看面板头部
- Then 头部显示 "FILES · 3" 格式

### 移动端 Sticky Header

#### BDD-13: 移动端 sticky header 不显示 ← 箭头和 "PeekView" 文字
- Given 移动端视口（≤640px）且详情页已加载
- When 查看 sticky header
- Then 不显示 ← 箭头按钮和 "PeekView" 文字，只显示 logo icon 和标题

#### BDD-14: 移动端 sticky header 标题最多显示两行
- Given 移动端视口且 entry 标题较长
- When 查看 sticky header 中的标题
- Then 标题最多显示两行，超出部分省略

#### BDD-15: 移动端 logo icon 点击可返回首页
- Given 移动端视口且详情页已加载
- When 点击 sticky header 中的 logo icon
- Then 导航到首页

#### BDD-16: 移动端匿名用户 Sign in 显示为文本链接
- Given 移动端视口且用户未登录
- When 查看 sticky header
- Then Sign in 显示为文本链接样式（accent 色），非实心按钮

### 移动端 Bottom Bar

#### BDD-17: 移动端 Files 按钮使用 toggle-btn 风格
- Given 移动端视口且当前 entry 有多个文件
- When 查看 bottom bar 中 Files 按钮
- Then 按钮使用 toggle-btn 风格（28px icon + badge），非文字按钮

#### BDD-18: 移动端 TOC 按钮使用 toggle-btn 风格
- Given 移动端视口且当前 markdown entry 有 TOC 标题
- When 查看 bottom bar 中 TOC 按钮
- Then 按钮使用 toggle-btn 风格（28px icon），非文字按钮

#### BDD-19: 移动端 bottom bar 不显示 Explore 按钮
- Given 移动端视口且详情页已加载
- When 查看 bottom bar
- Then 不显示 Explore 按钮

#### BDD-20: 移动端 bottom bar 不显示 Share 按钮
- Given 移动端视口且详情页已加载
- When 查看 bottom bar
- Then 不显示 Share 按钮（Share 已收入 Overflow 菜单）

#### BDD-21: 移动端 Files toggle active 状态与 drawer 开关同步
- Given 移动端视口且 file drawer 已打开
- When 查看 bottom bar 中 Files 按钮
- Then 按钮显示 active 高亮状态
- When 关闭 file drawer
- Then Files 按钮取消 active 高亮

#### BDD-22: 移动端 TOC toggle active 状态与 drawer 开关同步
- Given 移动端视口且 TOC drawer 已打开
- When 查看 bottom bar 中 TOC 按钮
- Then 按钮显示 active 高亮状态
- When 关闭 TOC drawer
- Then TOC 按钮取消 active 高亮

### 移动端 Drawer 头部

#### BDD-23: 移动端 File drawer 头部显示文件数量
- Given 移动端视口且 file drawer 已打开且当前 entry 有 3 个文件
- When 查看 drawer 头部
- Then 头部显示 "Files · 3" 格式

#### BDD-24: 移动端 TOC drawer 头部显示标题数量
- Given 移动端视口且 TOC drawer 已打开且当前 markdown 有 12 个标题
- When 查看 drawer 头部
- Then 头部显示 "Table of Contents · 12" 格式

## 待确认清单

[NO_NEED_CONFIRM]

## 裁剪说明

```yaml
risk_level: medium
phases: [P1, P2, P3, P4, P5, P6, P7, P8]
```

- P1 不可裁（核心阶段）
- P2 不可省略（UI 设计需评审，涉及多端布局变更）
- P3 保留（auth guard 逻辑变更 + 多处 UI 交互变更，需 TDD 红灯）
- P4 保留（实现代码）
- P5 保留（多文件改动需全量验证）
- P6 不可裁（ui_affected=true，需 Playwright 验证）
- P7 保留（涉及 router.ts + EntryDetailView.vue + FileTree.vue + layout.css 四文件交叉改动）
- P8 保留（前端改动需版本同步）

## 范围声明

```yaml
domains:
  - frontend
packages:
  - frontend-v3/src/router.ts
  - frontend-v3/src/views/EntryDetailView.vue
  - frontend-v3/src/components/FileTree.vue
  - frontend-v3/src/styles/layout.css
```

## 能力需求声明

```yaml
capability_requirements:
  - need: browser-vision
    why: P6 验收需要 Playwright 截图验证 UI 布局和交互行为
    available:
      - "playwright-cdp skill（已配置，CDP 连接 Chrome :18800）"
      - "vision-analyzer skill（截图后分析）"
    status: available

  - need: playwright-e2e
    why: P6 验收需 Playwright 自动化测试 auth guard 刷新行为
    available:
      - "playwright-cdp skill（CDP 模式支持全页刷新模拟）"
    status: available
```
