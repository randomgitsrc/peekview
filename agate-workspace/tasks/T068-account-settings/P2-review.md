---
phase: P2
task_id: T068-account-settings
type: review
parent: P2-design.md
trace_id: T068-P2-review-20260723
status: approved
created: 2026-07-23
agent: plan-design-review
---

## 评分维度

### 1. 交互状态覆盖率：8/10

**覆盖良好的状态**：
- Loading：Profile tab 依赖 authStore（已加载）、Security tab 提交期间按钮 disabled、API Keys tab 有现有 loading 逻辑
- Error：旧密码错误提示（BDD-06）、422 校验错误（BDD-04/13）、401 未认证（BDD-09/12）
- Empty：API Keys 空状态（从 ApiKeyListView 继承）、display_name 清空语义
- Edge case：空请求体 `{}` 返回 200、纯空格 trim 为 null、超长输入 422

**缺失/薄弱**：
- Profile tab 初始加载状态未显式说明——authStore.user 在 `authState='loading'` 时 Profile tab 显示什么？应说明：SettingsView 整体在 `authState !== 'authenticated'` 时不渲染（auth guard 已拦截），所以 Profile tab 无独立 loading 状态。但需确认 auth guard 在 `authState='loading'` 时的行为——设计 §2 提到"须在 authStore.initializing 为 false 后判断"，这是正确的，但未说明 loading 期间页面显示什么（空白？spinner？）
- PATCH /auth/me 网络错误/超时的 UI 处理未提及
- Security tab 新密码与确认密码不匹配的前端校验错误提示未显式描述（只提了"前端校验"但未写错误文案）

**严重性**：中。auth guard loading 期间行为是实际会遇到的 UX 问题，但参照现有 EntryListView 的 authState 处理模式可补齐。

### 2. AI Slop 风险：9/10

**设计约束充分**：
- 后端 PATCH /auth/me 有完整伪代码，输入/输出/边界行为明确
- 前端组件结构有树形图，tab 切换逻辑有代码示例
- ApiKeySettingsTab 提取规则明确（保留什么/去掉什么）
- 移动端方案具体（<640px 隐藏 tab bar + 垂直堆叠）
- CSS 复用现有变量，不引入新设计系统

**微小风险**：
- SettingsView ~400 行的组件内部布局细节（间距、颜色、字体大小）未逐像素规定，但参照 EntryListView/EntryDetailView header 模式 + 现有 CSS 变量，AI 实现时偏离空间有限
- Profile tab 的"只读字段"展示样式未规定（badge 样式？日期格式？），但参照现有 EntryListView user menu 模式

**严重性**：低。设计给出了足够的结构约束和参照模式。

### 3. 移动端考虑：7/10

**已覆盖**：
- 明确断点 <640px（与 EntryDetailView isMobile 一致）
- 明确方案：隐藏 tab bar + 三个区域垂直堆叠
- BDD-14 验收条件覆盖移动端

**缺失**：
- 垂直堆叠时三个区域的视觉分隔方式未说明（分割线？间距？标题样式？）
- 移动端 display_name input 的交互细节（全宽？label 位置？）
- 移动端改密码表单的布局（三个密码字段的排列）
- 移动端 API Keys tab 的操作按钮（创建/撤销/清理）在小屏下的适配
- 移动端 tab 参数 `?tab=` 的行为——垂直堆叠模式下所有区域同时可见，tab 参数是否仍需滚动到对应区域？

**严重性**：中。核心布局方案已定，细节可在 P4 实现时参照现有移动端模式补齐，但移动端 `?tab=` 的行为需要明确（建议：移动端忽略 tab 参数，直接展示全部三个区域）。

### 4. 可访问性：5/10

**已提及**：
- 无

**缺失**：
- Tab 导航的键盘操作（Arrow Left/Right 切换 tab，Tab 键聚焦内容区）未提及
- Tab 导航的 ARIA 角色（`role="tablist"` / `role="tab"` / `role="tabpanel"` + `aria-selected` / `aria-controls`）未提及
- 表单字段的 `<label>` 关联方式未提及
- 密码字段的 `autocomplete` 属性（`autocomplete="current-password"` / `autocomplete="new-password"`）未提及
- 错误提示的 `aria-live` / `role="alert"` 未提及
- Save/Change Password 按钮的 `aria-disabled` 状态未提及
- 移动端垂直堆叠时 tab ARIA 角色应切换为 `role="region"` + `aria-labelledby`

**严重性**：中高。这是新增页面，应在设计阶段规定 ARIA 模式，否则 P4 实现时大概率遗漏。参照 WAI-ARIA Tabs Pattern 即可，工作量不大但必须显式要求。

## 综合评定

| 维度 | 评分 | 严重性 |
|------|------|--------|
| 交互状态覆盖率 | 8/10 | 中 |
| AI Slop 风险 | 9/10 | 低 |
| 移动端考虑 | 7/10 | 中 |
| 可访问性 | 5/10 | 中高 |

**总体**：7.25/10

## 判定：approved（附修订建议）

设计整体质量良好，方案选择合理，伪代码和结构约束充分。可访问性是主要短板，但不构成 BLOCKER——理由：

1. PeekView 现有页面的 ARIA 覆盖程度有限（非无障碍合规产品），此页面与现有页面保持同等水平即可
2. ARIA tabs pattern 是标准模式，P4 实现时补齐不困难
3. 其他三个维度均在可接受范围

**修订建议**（P4 实现时必须补齐，不阻塞 P2 gate）：

1. **可访问性**：Tab 导航须实现 WAI-ARIA Tabs Pattern（`role="tablist/tab/tabpanel"` + `aria-selected` + 键盘 Arrow 导航）；表单须有 `<label>` + `autocomplete`；错误提示须 `aria-live`
2. **移动端 ?tab= 行为**：垂直堆叠模式下忽略 tab 参数，直接展示全部区域（或滚动到对应区域）
3. **auth guard loading 期间**：SettingsView 在 `authState='loading'` 时显示空白或 spinner，不渲染表单内容
4. **网络错误处理**：PATCH /auth/me 和 change-password 的网络错误须 toast 提示
