---
phase: P1
task_id: T036-detail-info-completeness
type: requirements
parent: P0-brief.md
trace_id: T036-P1-20260630
status: draft
created: 2026-06-30
---

# T036 需求基线：详情页信息完善

## 1. 需求复述

详情页（EntryDetailView）当前缺少 tags 显示，且时间展示信息密度不足。三项改动：

1. **Tags 显示**：在详情页标题下方添加 tags，复用 BaseTag 组件，遵循已有 EntryCard/EntryListRow 的 +N 折叠模式
2. **相对时间 + tooltip**：详情页的 createdAt 已用 `formatRelativeTime()`（手写，如 "2h ago"），但 hover 时无完整日期提示。需加 tooltip 显示完整日期时间
3. **时区统一**：EntryCard 和 EntryListRow 用 `toLocaleDateString()` 走浏览器时区；DetailView 用自定义 `formatRelativeTime()` 且无时区感知。需确认三处时间格式化逻辑一致且走浏览器时区

## 2. 隐含需求识别

### 数据维度
- **已有数据**：`Entry.tags: string[]` 已在 API 响应和类型定义中存在，`entryStore.currentEntry.tags` 可直接消费。无需后端改动。✅

### 前端维度
- **Tags 折叠阈值**：EntryCard/EntryListRow 已有 `TAG_LIMIT=3` + `+N` 溢出模式。详情页是全信息展示场景，折叠阈值应更宽松（或不折叠），但 header 横向空间有限需权衡。**隐含需求：详情页 tags 的折叠策略需明确**
- **Tags 位置**：P0 说"标题下方"，但当前 header 布局是横向 flex（logo | title | right-actions）。tags 放标题下方意味着需要换行或改布局结构
- **formatRelativeTime 重复**：`formatRelativeTime` 当前内联在 EntryDetailView 中（:599-618），与 `expires.ts` 的 `formatExpiresIn` 风格一致但未提取为共享工具。统一时区时需一并提取
- **Tooltip 实现**：当前项目无通用 tooltip 组件。需确认实现方式（原生 `title` 属性 vs 自建/引入 tooltip 组件）

### 多端维度
- **MCP / CLI / API**：三项改动均为前端展示层，不涉及 API 响应结构变更。无需同步。✅

### 边界维度
- **空 tags**：`entry.tags` 为空数组时，tags 区域不渲染（与 EntryCard/EntryListRow 行为一致）
- **超长 tag 名**：单个 tag 文本过长时的截断/换行行为
- **时间边界**：`formatRelativeTime` 对未来时间（createdAt 在未来）的处理——当前代码 `diffMs < 0` 时会走到 "just now" 分支（diffSec 为负，< 60 为 true），行为合理
- **tooltip 完整日期格式**：需明确格式（如 "Jun 30, 2026, 3:45 PM" vs "2026-06-30 15:45"）

### 兼容维度
- **不破坏现有行为**：EntryCard/EntryListRow 的时间格式保持 `toLocaleDateString()` 不变；DetailView 的相对时间逻辑不变，仅增加 tooltip 层
- **不引入新依赖**：项目未使用 date-fns/dayjs，`formatRelativeTime` 已手写且工作正常，无需引入外部库

## 3. BDD 验收条件

### BDD-1: 详情页显示 tags
```
Given 一个 entry 有 tags ["vue", "typescript", "pinia"]
When 用户访问该 entry 的详情页
Then 标题下方显示 3 个 BaseTag 组件，内容分别为 "vue"、"typescript"、"pinia"
```

### BDD-2: 详情页 tags 折叠（超过阈值）
```
Given 一个 entry 有 tags ["a", "b", "c", "d", "e"]（5 个）
When 用户访问该 entry 的详情页
Then 标题下方显示前 N 个 BaseTag 和一个 "+M" 溢出标识（N 为详情页折叠阈值，M = 5 - N）
```

### BDD-3: 无 tags 时不渲染 tags 区域
```
Given 一个 entry 的 tags 为空数组 []
When 用户访问该 entry 的详情页
Then 标题下方不显示任何 tags 区域
```

### BDD-4: 相对时间 hover 显示完整日期
```
Given 一个 entry 的 createdAt 为 "2026-06-28T10:30:00"
When 用户在详情页 hover 到相对时间文本（如 "2d ago"）上
Then 出现 tooltip 显示该时间的完整日期时间（浏览器本地时区格式）
```

### BDD-5: 时间格式化三处一致
```
Given 一个 entry 的 createdAt 为 UTC 时间
When 分别查看 EntryCard、EntryListRow、EntryDetailView 中的时间显示
Then 三处均使用浏览器本地时区进行格式化（toLocaleDateString 或其等价形式）
  And DetailView 的相对时间计算基于本地时间差（Date 构造自动处理时区偏移）
```

### BDD-6: formatRelativeTime 提取为共享工具函数
```
Given formatRelativeTime 当前内联在 EntryDetailView 中
When 完成时区统一重构
Then formatRelativeTime 被提取到共享 utils 文件（如 utils/time.ts）
  And EntryDetailView 从 utils/time.ts 导入使用
```

## 4. 待确认清单

无 [NEED_CONFIRM] 项。以下为已自决的设计决策及理由：

| 问题 | 决策 | 理由 |
|------|------|------|
| 详情页 tags 折叠阈值 | 与 EntryCard/EntryListRow 一致，TAG_LIMIT=3 | 详情页 header 空间比卡片更受限；超出部分用 +N 标识，点击可展开为完整方案但不在本任务范围 |
| Tooltip 实现方式 | 原生 `title` 属性 | 项目无 tooltip 组件，原生 title 满足"hover 显示完整日期"需求，无需引入额外复杂度 |
| 完整日期 tooltip 格式 | `toLocaleString()`（含日期+时间） | 与已有 `toLocaleDateString()` 风格一致，额外包含时间部分 |

## 5. 裁剪说明

```
phases: [P1, P4, P5, P6]
```

| 跳过阶段 | 理由 |
|----------|------|
| P2（方案设计） | 改动域明确（DetailView 模板+提取共享函数），无架构决策，EntryCard/EntryListRow 已有现成模式可复用 |
| P3（TDD 测试） | 纯 UI 模板改动（加 tags 渲染 + title 属性）+ 提取工具函数，现有 spec 文件覆盖 EntryListRow tags 行为，DetailView 无 spec 文件，改动量小不值得为此新增 |
| P7（一致性检查） | 单文件模板改动 + 单个新 utils 文件，无跨文件一致性风险 |
| P8（发布准备） | 无 schema/API 变更，无版本号需 bump |

## 6. 范围声明

```yaml
packages:
  - frontend-v3

domains:
  - frontend

ui_affected:
  - EntryDetailView.vue（header 区域：加 tags 行、时间元素加 title 属性）
  - utils/time.ts（新建：提取 formatRelativeTime 共享函数）

api_changes: none
```

## 7. 能力需求声明

```yaml
capability_requirements:
  - need: browser-vision
    why: P6 验收需截图验证详情页 tags 显示和 tooltip 行为
    available:
      - playwright-vision skill
      - vision-analyzer skill
    status: available
```
