---
phase: P1
task_id: T079-interaction-consistency
type: review
parent: P1-requirements.md
trace_id: T079-P1-20260731
status: approved
created: 2026-07-31
agent: requirements-review
---

# P1 Review — T079: 交互一致性修复（retry #1 终审）

## BDD 评审

### BDD 条件可二值判定性

- **BDD-01**: PASS（可二值判定）。Landing 匿名态，variant=primary + "Sign in"。覆盖维度：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-02**: PASS（可二值判定）。Explore 桌面端（>= 1024px），variant=secondary + "Sign in"。覆盖维度：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-03**: PASS（可二值判定）。Explore 平板端（641px-1023px），variant=secondary + "Sign in"。**上轮遗漏 1 已修正**：tablet 区间 variant 已明确补充。覆盖维度：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-04**: PASS（可二值判定）。Explore 移动端（<= 640px），variant=ghost + "Sign in"。覆盖维度：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-05**: PASS（可二值判定）。Detail 桌面端（>= 1024px），variant=secondary + "Sign in"。覆盖维度：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-06**: PASS（可二值判定）。Detail 移动端（<= 640px），variant=ghost + "Sign in"。覆盖维度：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-07**: PASS（可二值判定）。Landing 认证态 redirect 前，Settings + Logout 菜单。**上轮遗漏 2 已修正**：验证策略已明确（代码级验证 + vitest mock），解决了 Playwright 竞态窗口不可验证问题。覆盖维度：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-08**: PASS（可二值判定）。Explore 认证态，Settings + Logout 菜单。覆盖维度：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-09**: PASS（可二值判定）。Detail 桌面端认证态，Settings + Logout 菜单。覆盖维度：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-10**: PASS（可二值判定）。Detail 移动端认证态，Settings + Logout 菜单。覆盖维度：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-11**: PASS（可二值判定）。admin 用户菜单触发器显示 admin badge。覆盖维度：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-12**: PASS（可二值判定）。三页面菜单选项数量和文案一致。覆盖维度：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-13**: PASS（可二值判定）。Detail 桌面端 header actions-area 不含 CompassIcon "Explore" 按钮。覆盖维度：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-14**: PASS（可二值判定）。Detail 桌面端 tag 点击导航到 `/explore?tags=vue`。覆盖维度：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-15**: PASS（可二值判定）。Detail 移动端 tag 点击同上。覆盖维度：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-16**: PASS（可二值判定）。中文 tag "前端" 点击后 URL 含 URL 编码值。覆盖维度：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-17**: PASS（可二值判定）。点击 Settings 导航到 `/settings` 路由。覆盖维度：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓

### BDD 编号格式

- 编号格式 `#### BDD-NN:` 正确，BDD-01 到 BDD-17 连续不跳号。PASS。

### BDD 单场景拆分

- 每条 BDD 只有一条 Given-When-Then。PASS。

## 隐含需求覆盖

### 数据维度

- **覆盖**：§2 明确声明"无数据影响，后端无改动，无迁移"。与 P0-brief 约束一致。PASS。

### 前端维度

- **覆盖**：§2 识别了 AuthButton 组件需求（variant 区分 marketing/functional + desktop/tablet/mobile）、UserMenu 组件需求（avatar + username + admin badge + dropdown + closeUserMenu）、Detail 页认证态用户菜单缺失、Detail 页 tag 点击导航、Landing 认证态瞬时可见。
- **上轮遗漏 1 已修正**：Tablet 区间（641px-1023px）variant 已明确声明归入 desktop variant，补充了 BDD-03。
- **上轮遗漏 2 已修正**：BDD-07（原 BDD-06）验证策略已明确为代码级验证 + vitest mock，解决了 Playwright 竞态窗口问题。

### 多端维度

- **覆盖**：§2 明确声明"MCP / CLI / API 不受影响，纯前端改动"。PASS。

### 边界维度

- **覆盖**：§2 识别了空 tag 列表、含特殊字符的 tag（encodeURIComponent）、Landing 移动端登录按钮（primary）、Detail 移动端登录按钮（ghost）、Zen mode 隐藏、Share access 模式。
- **上轮遗漏 3 已修正**：Share link 场景已明确声明"与普通匿名访问在 auth 状态展示上无行为差异——匿名态均显示 AuthButton，认证态均显示 UserMenu，不因 share link 来源产生额外行为分支"。
- **上轮遗漏 5 已修正**：移除 Explore 按钮后布局回归已补充为隐含需求"actions-area 的间距、分隔线（action-sep）和剩余元素的布局不应出现错位或多余空白"。

### 兼容维度

- **覆盖**：§2 识别了 LandingView/EntryListView 重复逻辑迁移、navigateToApiKeys 改为 /settings、EntryDetailHeader overflowItems 布局。
- **上轮遗漏 4 已修正**：Settings 导航 URL 意图已通过 `[SCOPE_RESOLVED]` 裁定——文案改为 "Settings" + URL 保持 `/settings?tab=apikeys`，消除了行为退化风险。

## 裁剪评审

- **P1（需求基线）**：不可裁剪。正确。
- **P2（方案设计）**：保留，理由充分（跨组件改动，共享组件接口设计需评审）。正确。
- **P3（TDD 测试）**：保留，理由充分（risk=medium，共享组件需 vitest 覆盖）。正确。
- **P4（代码实现）**：保留。正确。
- **P5（技术验证）**：保留（make test-frontend + make typecheck）。正确。
- **P6（验收）**：保留，涉及 UI 交互需 Playwright。正确。
- **P7（一致性检查）**：保留，3 view + 1 header 子组件跨文件改动。正确。
- **P8（发布准备）**：保留，CHANGELOG 记录。正确。

裁剪合理，无跳过阶段。risk_level=medium 与实际风险匹配。PASS。

## P1 纯净性

- **解决方案设计混入**：§2 AuthButton/UserMenu 组件段落提到"组件需感知当前页面类型和设备类型"——属隐含需求识别的接口提示，处于边界但不构成 BLOCKER。
- **实现细节混入**：§2 提到"router.push"、"emit 或直接在子组件内处理路由跳转"——属实现方式建议，不构成 BLOCKER。
- **总体**：P1 基本保持问题定义层面。PASS。

## capability_requirements 评审

- browser-vision: supplementable（playwright-cdp + vision-engine）。正确。
- unit-test-framework: available（vitest + jsdom）。正确。
- 三态判断正确。PASS。

## 待确认清单评审

- §4 唯一项已标记 `[SCOPE_RESOLVED]`，决策明确（文案 "Settings" + URL `/settings?tab=apikeys`）。无未决 `[NEED_CONFIRM]`。PASS。

## 环境隔离

- `[PROD_NOT_TOUCHED]` 声明正确，纯前端改动。PASS。

## 非阻塞性建议（不影响 approved 判定）

1. **BDD-17 URL 精度**：BDD-17 Then 写"导航到 `/settings`"，而 §4 `[SCOPE_RESOLVED]` 裁定 URL 为 `/settings?tab=apikeys`。两者在路由层面一致（均为 `/settings` 路由），P6 可用路由匹配判定。建议 P2/P4 实现时确保 URL 含 `?tab=apikeys`，P6 验收时用路由级断言（`/\/settings/`）而非精确 URL 断言。
2. **§4 格式**：§4 条目以 `[NEED_CONFIRM]` 开头但以 `[SCOPE_RESOLVED]` 结尾，语义上已解决。如 gate 脚本做严格文本匹配可能误报，建议 P2 前将前缀改为 `[SCOPE_RESOLVED]` 以消除格式歧义。

## 评审结论

**Status: approved**

### 必须修改项落实确认

| # | 上轮需修正项 | 状态 | 证据 |
|---|------------|------|------|
| 1 | Tablet 区间 variant 未定义 | ✓ 已落实 | §2 L34 明确声明 tablet = desktop variant + BDD-03 补充 |
| 2 | BDD-06 可测试性 | ✓ 已落实 | BDD-07 L97 验证策略明确（代码级 + vitest mock） |
| 3 | Settings 导航 URL 意图不明确 | ✓ 已落实 | §4 L157 `[SCOPE_RESOLVED]` 裁定 |
| 4 | Share link 场景歧义 | ✓ 已落实 | §2 L49 明确声明无行为差异 |
| 5 | 移除 Explore 按钮后布局回归 | ✓ 已落实 | §2 L55 隐含需求已补充 |

### NEED_CONFIRM → SCOPE_RESOLVED 确认

- §4 唯一项已从 `[NEED_CONFIRM]` 转为 `[SCOPE_RESOLVED]`，决策明确，无未决项。PASS。

### 已通过项

- BDD-01 ~ BDD-17 编号格式正确、连续不跳号、单场景拆分正确
- BDD 条件均可二值判定
- 5 项必须修改全部落实
- 裁剪合理（无跳过阶段，risk_level 匹配）
- domains/packages 声明完整
- capability_requirements 三态正确
- P1 纯净性合规
- 环境隔离声明正确

### 覆盖维度汇总

| 维度 | 状态 |
|------|------|
| 数据 | ✓ 覆盖（无数据影响，声明正确） |
| 前端 | ✓ 覆盖（tablet variant 已补全、BDD-07 可测试性已解决） |
| 多端 | ✓ 覆盖（MCP/CLI/API 不受影响） |
| 边界 | ✓ 覆盖（share link 歧义已消除、布局回归已声明） |
| 兼容 | ✓ 覆盖（Settings 导航 URL 已裁定） |
