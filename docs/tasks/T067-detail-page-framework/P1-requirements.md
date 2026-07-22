---
phase: P1
task_id: T067-detail-page-framework
type: requirements
parent: P0-brief.md
trace_id: T067-P1-20260723
status: revised
created: 2026-07-23
agent: analyst
---

# P1 Requirements — T067 detail-page-framework

## 1. 需求复述

Entry 详情页框架补全，解决冷打开转化断层。6 个真实缺口（经 P0 代码核查纠正）：

1. **详情页无 Sign in 入口**：匿名用户（87%流量）在详情页想登录无处可点
2. **品牌字标缺失**：桌面端只有 SVG 图标无"PeekView"文字；移动端连图标都没有
3. **无 explore 导航**：读完条目后无法直接去浏览更多，返回箭头指向首页（/）而非 explore（/explore）
4. **移动端底栏文案**："Files 2" 应改为 "2 files"（数量在前，小写 files）
5. **reads 计数格式不统一**：桌面端条件复数 "1 read"/"2 reads"（无 readStats 时隐藏）；移动端固定 "N reads"（含 0 reads）
6. **首页 Sign in 视觉权重不足**：btn-ghost btn-sm 混在导航链接中；≤380px 移动端 Sign in 按钮完全消失

## 2. 隐含需求识别

### 数据维度
- **无**：纯前端展示改动，不涉及数据模型/迁移

### 前端维度
- **Sign in 绑定 authState**：详情页 Sign in 按钮必须响应 authState 变化——匿名时显示，登录后隐藏（或切换为用户菜单）。依赖 T065 修好的 authState 响应式
- **LoginDialog 复用**：详情页 Sign in 点击后应弹出 LoginDialog（已有组件，LandingView/EntryListView 均使用），不另造登录 UI
- **移动端 Sign in 位置**：移动端详情页无桌面端 actions-area，需决定 Sign in 放在 sticky-header 还是 bottom-bar
- **品牌条占空间**：P0 明确 ~36px 上限（参照 GitHub Gist），不能挤压内容区。移动端尤其敏感
- **品牌条形态未定**：极窄条 vs 浮动徽章 vs footer——P2 须出多方案对比，P1 不定方案

### 多端维度
- **MCP/CLI/API 无需同步**：纯前端 UI 改动，不改后端 API 契约
- **桌面端 tooltip 已存在**：代码层面 `.icon-btn .tooltip` 和 `.toggle-btn .tooltip` 的 CSS hover 逻辑完整（layout.css:198-265），P1 须实跑验证 hover 是否真显示，坏了才修

### 边界维度
- **authState='loading' 时**：Sign in 按钮应隐藏（避免闪烁），等 authState 确定为 anonymous 后再显示
- **zen mode**：zen mode 下品牌条/Sign in 随 header 隐藏（zen mode 隐藏 header，品牌条若在 header 内则自动隐藏）
- **移动端极窄屏（≤380px）**：LandingView 的 `.btn-ghost { display:none }` 导致 Sign in 消失——本任务须修复此问题

### 兼容维度
- **T065 边界**：T065 管"Sign in 显隐绑定 authState"（功能逻辑），本任务管"视觉权重"（样式）。改同一个按钮需协调：T065 先完成功能绑定，本任务再提升视觉权重
- **桌面端 logo/tooltip 不重做**：已存在，仅验证 tooltip hover 是否生效

## 3. BDD 验收条件

### BDD-1: 详情页 Sign in 入口（匿名用户）
```
Given 用户未登录（authState='anonymous'）且详情页已加载
When 用户查看详情页
Then 桌面端 header 区域可见 Sign in 按钮
And 移动端可见 Sign in 入口
And 点击 Sign in 弹出 LoginDialog
```

### BDD-2: 详情页 Sign in 隐藏（已登录用户）
```
Given 用户已登录（authState='authenticated'）且详情页已加载
When 用户查看详情页
Then Sign in 按钮不可见
```

### BDD-3: 详情页 Sign in 登录后响应式消失
```
Given 用户未登录且详情页已显示 Sign in 按钮
When 用户通过 LoginDialog 成功登录
Then Sign in 按钮消失（无需刷新页面）
```

### BDD-4: 品牌字标显示
```
Given 详情页已加载且视口宽度 >640px
When 用户查看桌面端 header
Then 可见 PeekView 品牌文字
And 品牌区域总高度不超过 36px
```

### BDD-5: 移动端品牌元素
```
Given 详情页已加载且视口宽度 ≤640px
When 用户查看移动端 sticky-header
Then 可见品牌标识元素
And 视口宽度 ≤380px 时品牌标识元素仍然可见
```

### BDD-6: Explore 导航入口
```
Given 详情页已加载
When 用户查看详情页
Then 存在可点击的导航元素指向 /explore
And 移动端存在可点击的导航元素指向 /explore
And 点击后导航到 explore 页面
```

### BDD-7: 移动端底栏文案修正
```
Given 详情页已加载且视口宽度 ≤640px 且条目有多文件
When 用户查看移动端底栏
Then 文件按钮文案格式为 "N files"（数量在前，files 小写）
```

### BDD-8: reads 计数格式统一
```
Given 详情页已加载且条目有 readStats（totalCount > 0）
When 用户查看 reads 计数
Then 桌面端和移动端显示格式一致：1 read（单数）/ N reads（复数，N>1）
And readStats 为 null 时桌面端和移动端均不显示 reads 计数
```

### BDD-9: 首页 Sign in 视觉权重
```
Given 用户未登录且在首页
When 用户查看导航栏
Then Sign in 按钮使用 btn-primary 或等效高视觉权重样式（非 btn-ghost）
And 视口宽度 ≤380px 时 Sign in 按钮仍然可见
And 视口宽度 640-860px 区间 Sign in 按钮可见且使用与桌面端相同的高视觉权重样式
```

### BDD-10: 桌面端 tooltip hover 验证
```
Given 详情页已加载且视口宽度 >640px
When 用户 hover 桌面端图标按钮（file tree / TOC / copy）
Then 出现文字 tooltip 提示
```

### BDD-11: authState loading 态无闪烁
```
Given 页面刚加载且 authState='loading'
When auth 尚未完成初始化
Then Sign in 按钮不可见（避免 anonymous→loading→anonymous 闪烁）
```

### BDD-12: zen mode 下品牌条/Sign in 隐藏
```
Given 详情页已加载且用户已开启 zen mode
When 用户查看详情页
Then 品牌标识元素不可见
And Sign in 按钮不可见
```

## 4. 待确认清单

无需确认项。所有缺口方向明确：
- 品牌条形态（极窄条 vs 浮动徽章 vs footer）留给 P2 设计决策，P1 只定义需求（须显示品牌字标、高度 ≤36px）
- 移动端 Sign in 位置（sticky-header vs bottom-bar）留给 P2 设计决策

## 5. 裁剪说明

```yaml
phases: [P1, P2, P3, P4, P5, P6, P7, P8]
```

- **P1**（需求基线）：不可裁
- **P2**（方案设计）：不可裁——品牌条形态需多方案对比，用户明确"没想好"
- **P3**（TDD 测试）：保留——涉及 authState 响应式绑定、多视口行为，risk=medium
- **P4**（代码实现）：保留
- **P5**（技术验证）：保留——前端单测 + typecheck
- **P6**（验收）：不可裁——UI 改动需 Playwright 截图验证桌面+移动两套视口
- **P7**（一致性检查）：保留——改动涉及 EntryDetailView + LandingView + layout.css，跨文件
- **P8**（发布准备）：保留——版本/CHANGELOG 更新

## 6. 范围声明

```yaml
domains:
  - frontend
packages:
  - frontend-v3/src/views/EntryDetailView.vue
  - frontend-v3/src/views/LandingView.vue
  - frontend-v3/src/styles/layout.css
  - frontend-v3/src/components/LoginDialog.vue  # 复用，不改
risk_level: medium
```

risk_level 理由：
- 涉及设计决策（品牌条形态），P2 须出多方案
- authState 响应式绑定依赖 T065 先完成
- 多视口（桌面+移动）需分别验证
- 不涉及后端/数据/安全，降级为 medium

## 7. 能力需求声明

```yaml
capability_requirements:
  - need: browser-vision
    why: P6 验收需要截图验证桌面+移动两套视口的 UI 渲染
    available:
      - "playwright-cdp skill（CDP 连接 Chrome :18800，截图+vision 分析）"
      - "vision-analyzer skill（截图后图片分析）"
    status: available

  - need: live-hover-verification
    why: BDD-10 需验证桌面端 tooltip hover 是否生效
    available:
      - "playwright-cdp skill（可模拟 hover 事件并截图）"
     status: available
   ```

## 8. SCOPE+ 增补

[SCOPE+ from P2] zen mode 未隐藏移动端 mobile-sticky-header 和 mobile-bottom-bar
必须做的理由: BDD-12 要求 zen mode 下品牌标识和 Sign in 不可见, 但当前 zen mode 只隐藏桌面端 header, 移动端 sticky-header (含品牌+Sign in) 和 bottom-bar (含 Explore) 仍可见
影响: layout.css 需新增 2 条 zen mode 规则; BDD-12 验收范围扩展到移动端
[SCOPE_RESOLVED] 已在 P2-design.md §2.8 和 §7 确认，新增 BDD-12 覆盖
