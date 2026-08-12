---
phase: P1
task_id: T069
type: review
parent: P1-requirements.md
trace_id: T069-P1-review-20260726
status: approved
created: 2026-07-26
agent: requirements-review
---

## BDD 评审

### BDD-1: 已登录用户全页刷新 /settings 时不被重定向
- 判定: PASS 可二值判定
- 覆盖维度: 数据✓ 前端✓ 多端✗(仅前端) 边界✗(未覆盖 loading 超时场景，但 BDD-6 单独覆盖) 兼容✓(BDD-3 覆盖 SPA 导航不回归)

### BDD-2: 未登录用户全页刷新 /settings 时被重定向到首页
- 判定: PASS 可二值判定
- 覆盖维度: 数据✓ 前端✓ 多端✗ 边界✗(未覆盖 loading→anonymous 过渡，但 BDD-6 覆盖超时) 兼容✓

### BDD-3: 已登录用户 SPA 内导航到 /settings 正常
- 判定: PASS 可二值判定
- 覆盖维度: 数据✓ 前端✓ 多端✗ 边界✓ 兼容✓(回归保护)

### BDD-4: 已登录用户全页刷新 / 时重定向到 /explore
- 判定: PASS 可二值判定
- 覆盖维度: 数据✓ 前端✓ 多端✗ 边界✗(loading 态未覆盖) 兼容✓

### BDD-5: 未登录用户全页刷新 / 时停留在 /
- 判定: PASS 可二值判定
- 覆盖维度: 数据✓ 前端✓ 多端✗ 边界✗ 兼容✓

### BDD-6: Auth guard 等待期间不产生无限挂起
- 判定: PASS 可二值判定（"≤5 秒"是明确阈值）
- 覆盖维度: 数据✓ 前端✓ 多端✗ 边界✓(超时边界) 兼容✓
- **注意**: "合理时间内（≤5 秒）"是可二值判定的，但 5 秒阈值来源未说明。P0-brief 未指定超时值。建议 P2 设计阶段明确此值来源（是 fetchMe 的 timeout 还是守卫自身的 timeout）。不阻断 approved，标记为 P2 注意项。

### BDD-7: 桌面端品牌文字颜色与标题颜色可区分
- 判定: PASS 可二值判定（tertiary vs 主文本色，视觉可区分可通过截图判定）
- 覆盖维度: 数据✓ 前端✓ 多端✗ 边界✓ 兼容✓

### BDD-8: 桌面端品牌文字与标题之间有分隔符
- 判定: PASS 可二值判定
- 覆盖维度: 数据✓ 前端✓ 多端✗ 边界✓ 兼容✓

### BDD-9: 桌面端品牌文字 hover 时变为 accent 色
- 判定: PASS 可二值判定
- 覆盖维度: 数据✓ 前端✓ 多端✗ 边界✓ 兼容✓

### BDD-10: 桌面端多文件 entry 的 Files toggle 显示文件数量 badge
- 判定: PASS 可二值判定
- 覆盖维度: 数据✓ 前端✓ 多端✗ 边界✗(未覆盖 0 文件/极大文件数场景) 兼容✓

### BDD-11: 桌面端单文件 entry 不显示 Files toggle
- 判定: PASS 可二值判定
- 覆盖维度: 数据✓ 前端✓ 多端✗ 边界✓ 兼容✓

### BDD-12: FileTree 面板头部显示文件数量
- 判定: PASS 可二值判定
- 覆盖维度: 数据✓ 前端✓ 多端✗ 边界✗(未覆盖 0 文件/极大数) 兼容✓

### BDD-13: 移动端 sticky header 不显示 ← 箭头和 "PeekView" 文字
- 判定: PASS 可二值判定
- 覆盖维度: 数据✓ 前端✓ 多端✗ 边界✓ 兼容✓

### BDD-14: 移动端 sticky header 标题最多显示两行
- 判定: PASS 可二值判定
- 覆盖维度: 数据✓ 前端✓ 多端✗ 边界✓(长标题边界) 兼容✓

### BDD-15: 移动端 logo icon 点击可返回首页
- 判定: PASS 可二值判定
- 覆盖维度: 数据✓ 前端✓ 多端✗ 边界✓ 兼容✓

### BDD-16: 移动端匿名用户 Sign in 显示为文本链接
- 判定: PASS 可二值判定
- 覆盖维度: 数据✓ 前端✓ 多端✗ 边界✗(未覆盖 touch target ≥44px) 兼容✓
- **注意**: 隐含需求识别中提到"需确保可点击区域足够（min 44px touch target）"，但 BDD-16 未包含此验收条件。建议 P2 设计时确保实现满足 44px touch target，但 BDD 层面不阻断——这是实现约束而非行为定义。

### BDD-17: 移动端 Files 按钮使用 toggle-btn 风格
- 判定: PASS 可二值判定
- 覆盖维度: 数据✓ 前端✓ 多端✗ 边界✓ 兼容✓

### BDD-18: 移动端 TOC 按钮使用 toggle-btn 风格
- 判定: PASS 可二值判定
- 覆盖维度: 数据✓ 前端✓ 多端✗ 边界✗(未覆盖 TOC 无标题时不显示) 兼容✓
- **注意**: 隐含需求识别中提到"TOC 无标题时不显示 TOC 按钮"，但 BDD-18 Given 条件是"当前 markdown entry 有 TOC 标题"，未覆盖无标题场景。需补充 BDD 或在 BDD-18 增加反向条件。

### BDD-19: 移动端 bottom bar 不显示 Explore 按钮
- 判定: PASS 可二值判定
- 覆盖维度: 数据✓ 前端✓ 多端✗ 边界✓ 兼容✓

### BDD-20: 移动端 bottom bar 不显示 Share 按钮
- 判定: PASS 可二值判定
- 覆盖维度: 数据✓ 前端✓ 多端✗ 边界✓ 兼容✓

### BDD-21: 移动端 Files toggle active 状态与 drawer 开关同步
- 判定: PASS 可二值判定
- 覆盖维度: 数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **注意**: BDD-21 包含两个 When-Then 对（打开时 active + 关闭时取消 active），严格来说应拆为两条 BDD。但两者是同一交互的正反两面，拆分反而冗余。判定为可接受。

### BDD-22: 移动端 TOC toggle active 状态与 drawer 开关同步
- 判定: PASS 可二值判定
- 覆盖维度: 数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- 同 BDD-21 注释

### BDD-23: 移动端 File drawer 头部显示文件数量
- 判定: PASS 可二值判定
- 覆盖维度: 数据✓ 前端✓ 多端✗ 边界✗(未覆盖 0 文件) 兼容✓

### BDD-24: 移动端 TOC drawer 头部显示标题数量
- 判定: PASS 可二值判定
- 覆盖维度: 数据✓ 前端✓ 多端✗ 边界✗(未覆盖 0 标题) 兼容✓

### BDD 编号格式
- 全部使用 `#### BDD-NN:` 标准格式 ✓
- 编号 1-24 连续不跳号 ✓
- BDD-21/22 各含两个 When-Then（同一交互正反面），可接受，不阻断

## 隐含需求覆盖

### 数据维度
- 覆盖: 无数据迁移/格式变更，声明正确 ✓
- 遗漏: 无

### 前端维度
- 覆盖: 桌面端分隔符(BDD-8)、Files badge(BDD-10)、FileTree 面板头部(BDD-12)、移动端 sticky header(BDD-13-16)、bottom bar(BDD-17-22)、drawer 头部(BDD-23-24) ✓
- 遗漏: 
  - **移动端 drawer 头部数量为 0 时的显示**：隐含需求提到"TOC 无标题时不显示 TOC 按钮"，但未覆盖 drawer 头部 "Table of Contents · 0" 不应出现的场景。BDD-24 Given 条件是"12 个标题"，未覆盖 0 标题。**建议补充 BDD-25: TOC 无标题时不显示 TOC 按钮/drawer**。
  - **移动端 Sign in 44px touch target**：隐含需求识别中提到，但无对应 BDD。属于实现约束，P2 设计时确保即可，不阻断 P1。

### 多端维度
- 覆盖: 仅前端改动，MCP/CLI/API 不受影响，声明正确 ✓
- 遗漏: 无

### 边界维度
- 覆盖: Auth guard 超时(BDD-6)、单文件 entry(BDD-11)、SPA 导航回归(BDD-3) ✓
- 遗漏:
  - **TOC 无标题时不显示按钮**：隐含需求识别中提到但无 BDD 覆盖。**需补充**。
  - **Auth guard 等待期间页面状态**：隐含需求提到"页面可能短暂空白，需考虑是否显示 loading 指示"，但无 BDD 覆盖。P0-brief 也提到此风险。**建议补充 BDD 或在 BDD-6 Then 中增加"页面显示 loading 指示"条件**。当前 BDD-6 只说"不无限阻塞"，未说等待期间用户看到什么。

### 兼容维度
- 覆盖: SPA 导航不回归(BDD-3)、fetchMe 逻辑不改(声明)、桌面端 Explore 保留(声明) ✓
- 遗漏: 无

## 裁剪评审

- phases: [P1, P2, P3, P4, P5, P6, P7, P8] 全走，无裁剪 ✓
- risk_level: medium — 合理（auth guard 逻辑变更 + 多处 UI 交互变更 + 多文件交叉改动）✓
- capability_requirements: browser-vision + playwright-e2e 均为 available ✓

## P1 纯净性

- BDD 描述的是用户行为/系统表现，未掺入实现方案 ✓
- "toggle-btn 风格""28px icon + badge"是视觉规格描述（用户可见），非实现细节 ✓
- "tertiary 色""accent 色"是设计 token（用户可感知），非实现方案 ✓
- Auth guard BDD 只描述行为（等待/不重定向/超时），未指定 watch/await 实现方式 ✓
- **轻微问题**: BDD-6 Then 中"≤5 秒"是具体数值约束，P0-brief 未指定此值。这属于需求定义而非实现设计，可接受，但 P2 需确认此阈值来源。

## 综合判定

**status: approved**（附条件）

### 通过项
- 24 条 BDD 全部可二值判定 ✓
- 编号格式正确、连续 ✓
- 隐含需求识别全面（7 项前端 + 5 项边界 + 3 项兼容）✓
- 裁剪合理（全走、medium risk）✓
- P1 纯净性良好 ✓
- 无 [NEED_CONFIRM] ✓

### 建议项（不阻断 approved，但 P2 应处理）
1. **BDD-6 超时阈值来源**：5 秒需在 P2 设计阶段确认来源（fetchMe timeout vs 守卫独立 timeout）
2. **TOC 无标题场景**：隐含需求已识别但缺 BDD 覆盖，建议 P2 设计时确保实现覆盖此边界，或在 P1 迭代中补充 BDD-25
3. **Auth guard 等待期间页面状态**：隐含需求已识别但缺 BDD 覆盖，建议 P2 设计阶段明确等待期间 UI 表现（loading 指示 or 空白可接受）
