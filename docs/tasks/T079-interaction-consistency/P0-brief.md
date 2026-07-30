---
phase: P0
task_id: T079
task_name: interaction-consistency
trace_id: T079
created: 2026-07-30
status: pending
parent: null
---

# T079: 交互一致性修复

## 问题

DESIGN.md §6 定义了前端交互规则，但多处代码未遵守：

1. **登录按钮不一致**：Landing 用 `primary` + "Sign in"，Explore 用 `ghost` + "Login"，Detail 桌面用 `primary` + "Sign in"，Detail 移动用纯文本链接 + "Sign in"。规则：Marketing 页 primary，Functional 页桌面 secondary、移动 ghost，文案统一 "Sign in"
2. **用户菜单不一致**：Explore 有 API Keys + Logout，Landing 只有 Logout。规则：统一为 Settings + Logout，admin 用户显示 admin badge
3. **Explore 按钮冗余**：Detail 页桌面端有 CompassIcon "Explore" 按钮，但 logo 点击回 `/` 会 redirect 到 `/explore`。应移除
4. **详情页 tag 不可点击**：tag 是静态 `<span>`，规则要求 "Clickable tags must navigate to `/explore?tags=<encoded>`"

## 约束

- DESIGN.md §6 Navigation & Auth State 已定义规则，此 task 只需按规则实现，不讨论设计
- 抽共享组件 AuthButton（匿名态）和 UserMenu（认证态），各页面复用
- 后端无改动
- 需验证中文 tag 的 LIKE 查询是否正常工作（如正常则 scope 不含后端改动）

## 已知风险

- 各页面导航结构不同（Landing 无 sticky header，Explore 有搜索栏，Detail 有三栏布局），共享组件需适配不同布局
- 移动端适配需逐页面验证

## 四字段

```yaml
task: "修复 4 处前端交互不一致：AuthButton 共享组件 + UserMenu 共享组件 + 移除冗余 Explore 按钮 + Detail tag 可点击"
known_risks:
  - "各页面导航结构不同（Landing 无 sticky header，Explore 有搜索栏，Detail 有三栏布局），共享组件需适配"
  - "移动端适配需逐页面验证"
  - "Detail 页 tag 不可点击修为 BaseTag 可点击（复用 T076 的 BaseTag 组件）"
executor_env:
  platform: "opencode"
  has_task_tool: true
  has_local_runtime: true
  network: "full"
env_constraints:
  debug_env: "make debug（:8888，/tmp/peekview-debug/）；make test-frontend（vitest 非 watch）；make typecheck（vue-tsc）；make build-frontend（构建+复制 static/）"
```

## 关联

- DESIGN.md §6 Component & Pattern Rules / Navigation & Auth State
- T076（EntryCard/EntryListRow tag 可点击已修，此 task 修 Detail 页 tag）
- T083（中文 tag 过滤已修，json_each 精确匹配，tag 点击跳转后端正常工作）
