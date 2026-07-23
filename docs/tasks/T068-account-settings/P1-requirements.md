---
phase: P1
task_id: T068-account-settings
type: requirements
parent: P0-brief.md
trace_id: T068-P1-20260723
status: revised
created: 2026-07-23
agent: analyst
---

## 需求复述

新增账户设置页 `/settings`，单页 tab 导航（Profile / Security / API Keys），暴露 T011 已交付的后端用户管理能力：

- **Profile tab**：只读展示 username/role/member-since，可编辑 display_name（需新增 `PATCH /api/v1/auth/me` 端点）
- **Security tab**：改密码表单（调已有 `POST /auth/change-password`），成功后 toast 反馈
- **API Keys tab**：迁入现有 `ApiKeyListView.vue` 全部功能（创建/撤销/清理过期/空状态/错误状态）
- **路由**：新增 `/settings`，现有 `/settings/apikeys` → 302 重定向到 `/settings?tab=apikeys`
- **Auth guard**：未登录访问 `/settings` → 重定向到 landing

## 隐含需求识别

### 数据维度
1. **display_name 已存在于 User 模型**（`models.py:106`，nullable, max_length=64）——无需 DB 迁移，但需新增 Pydantic request schema（`UpdateProfileRequest`）和 `PATCH /auth/me` 端点
2. **PATCH /auth/me 返回 UserResponse**——前端须用返回值更新 `authStore.user`，否则 header 显示名不刷新
3. **display_name=null 语义**：前端展示时 fallback 到 username（现有逻辑 `EntryListView.vue:385` 已有 `user.value?.displayName || user.value?.username`），PATCH 端点须支持 `display_name: null` 清空

### 前端维度
4. **auth guard 缺失**：当前 `/settings/apikeys` 无显式守卫（`router.ts:58` beforeEach 只处理 `/ → /explore`），新 `/settings` 必须补——未登录访问会白屏
5. **EntryListView:377 断链**：`router.push('/settings/apikeys')` 须更新为 `/settings?tab=apikeys`，否则旧导航路径断链
6. **Tab URL 直接渲染**：访问 `/settings?tab=xxx` 时须直接渲染对应 tab（非默认 Profile），tab 参数无效时 fallback 到 Profile tab
7. **移动端响应式**：tab 在窄屏须改为垂直分区（3 个 tab 适合垂直堆叠，无需手风琴折叠），P2 须出适配方案
8. **Settings 页面布局**：须有统一 header（logo + theme toggle + user menu），与 EntryListView 一致。ApiKeyListView 迁入后复用 Settings 页统一 header，不保留独立 header
9. **Loading 状态**：Profile tab 加载用户信息时、Security tab 提交时、API Keys tab 加载列表时须显示 loading 指示
10. **重复提交防护**：display_name 提交按钮和改密码提交按钮在请求期间须 disable

### 多端维度
11. **MCP/CLI 不受影响**：display_name 编辑仅 Web 端，MCP 和 CLI 无需同步（MCP publish_files 不涉及 user profile，CLI 无 edit-profile 命令）
12. **API 兼容**：PATCH /auth/me 是新增端点，不破坏现有 API。空请求体 `{}` 返回 200 + 当前 UserResponse（无变更）

### 边界维度
13. **display_name 输入校验**：max_length=64（模型层已有），空字符串视为 null（清空 display_name），纯空格 trim 后为空则视为 null，允许任意 Unicode（后端 max_length=64 已限制长度，无需额外字符限制）
14. **改密码后 token 不失效**：JWT 只含 user_id + expiry（`auth.py:112-117`），不含密码哈希——改密码后旧 token 仍有效，不需要重新登录。前端改密码成功后只显示 toast，不跳转。新密码与旧密码相同时允许提交（后端无此校验）
15. **并发编辑**：display_name 无唯一约束，无并发冲突风险

### 兼容维度
16. **向后兼容**：`/settings/apikeys` 须 302 重定向到 `/settings?tab=apikeys`，保持书签/外链可用
17. **ApiKeyListView 功能完整迁移**：创建/撤销/清理过期/空状态/错误状态/创建后显示 key 一次性——所有现有功能不可丢失

## BDD 验收条件

### BDD-01: Profile tab 展示用户信息
```
Given 已登录用户访问 /settings
When 页面加载完成
Then Profile tab 展示 username（只读）、display_name（可编辑输入框）、role badge（Admin/Member 只读）、member since 日期（只读）
```

### BDD-02: 编辑 display_name 成功
```
Given 已登录用户在 Profile tab
When 用户在 display_name 输入框填入 "Alice Chen" 并提交
Then 页面显示成功 toast，header 用户名更新为 "Alice Chen"，输入框值保持 "Alice Chen"
```

### BDD-03: 清空 display_name
```
Given 已登录用户 display_name 为 "Alice Chen"
When 用户清空 display_name 输入框并提交
Then 页面显示成功 toast，header 用户名 fallback 到 username，后端存储 display_name=null
```

### BDD-04: display_name 超长校验
```
Given 已登录用户在 Profile tab
When 用户输入超过 64 字符的 display_name 并提交
Then 提交被拒绝，显示校验错误提示
```

### BDD-05: Security tab 改密码成功
```
Given 已登录用户在 Security tab
When 用户输入正确的旧密码和新密码（≥8字符）并提交
Then 页面显示成功 toast，所有密码字段清空
```

### BDD-06: 改密码旧密码错误
```
Given 已登录用户在 Security tab
When 用户输入错误的旧密码并提交
Then 页面显示错误提示 "Old password is incorrect"
```

### BDD-07: 改密码后无需重新登录
```
Given 已登录用户在 Security tab
When 用户成功修改密码
Then 当前会话保持有效（authState 仍为 authenticated），可继续操作
```

### BDD-08: API Keys tab 功能完整
```
Given 已登录用户在 API Keys tab
When 页面加载完成
Then 以下功能全部可用：创建 API key（对话框输入 name + 确认后显示 key 一次性）、撤销 key（确认后状态变为 revoked）、清理过期 key、key 列表展示（name/prefix/status/created/last_used）、空状态提示、错误状态提示
```

### BDD-09: 未登录访问 /settings 重定向
```
Given 未登录用户
When 直接访问 /settings
Then 被重定向到 landing 页面
```

### BDD-10: 旧路由 /settings/apikeys 重定向
```
Given 已登录用户访问 /settings/apikeys
When 路由处理
Then 被重定向到 /settings?tab=apikeys，页面展示 API Keys tab

Given 未登录用户访问 /settings/apikeys
When 路由处理
Then 先 302 到 /settings?tab=apikeys，再被 auth guard 重定向到 landing 页面
```

### BDD-11: Tab 切换与 URL 同步
```
Given 已登录用户在 /settings
When 点击 Security tab
Then URL 更新为 /settings?tab=security，页面展示改密码表单
```

### BDD-12: PATCH /auth/me 未认证拒绝
```
Given 未认证请求
When 发送 PATCH /api/v1/auth/me
Then 返回 401
```

### BDD-13: PATCH /auth/me 输入校验
```
Given 已认证请求
When 发送 PATCH /api/v1/auth/me body={"display_name": "A"*65}
Then 返回 422 校验错误
```

### BDD-14: 移动端设置页可用
```
Given 已登录用户在移动端视口（宽度 < 640px）
When 访问 /settings
Then 页面以垂直分区形式展示三个区域（Profile / Security / API Keys），所有功能可操作
```

## 待确认清单

[NO_NEED_CONFIRM]

## 裁剪说明

```yaml
phases: [P1, P2, P3, P4, P5, P6, P7, P8]
```

- P1（需求基线）：不可裁——核心阶段
- P2（方案设计）：不可裁——新页面 + 新端点 + 组件迁移涉及设计决策，`follows_existing_pattern` 可简化为 1 候选方案但不可省略
- P3（TDD）：保留——PATCH /auth/me 是安全敏感端点，须 TDD 红灯；前端组件迁移须回归测试
- P4（实现）：不可裁
- P5（技术验证）：保留——后端 pytest + 前端 typecheck 须全绿
- P6（验收）：不可裁——ui_affected=true，须 Playwright 截图验证桌面+移动
- P7（一致性检查）：保留——涉及后端+前端+路由多文件改动
- P8（发布准备）：保留——版本/CHANGELOG 须更新

## 范围声明

```yaml
domains:
  - backend
  - frontend
  - security

packages:
  backend:
    - peekview.api.auth
    - peekview.models
  frontend:
    - views/SettingsView.vue (新增)
    - views/ApiKeyListView.vue (重构为子组件或内联)
    - router.ts
    - stores/auth.ts
    - api/client.ts
    - views/EntryListView.vue (导航路径更新)

risk_level: medium

rationale: |
  PATCH /auth/me 是安全敏感端点（须 require_auth + 输入校验），
  ApiKeyListView 迁入是组件重构（须保持所有现有功能），
  但两者都有成熟参照模式（change-password 端点 / 现有 ApiKeyListView 实现），
  无架构创新。风险可控但不可忽视。
```

## 能力需求声明

```yaml
capability_requirements:
  - need: browser-vision
    why: P6 验收需 Playwright 截图验证设置页桌面+移动端交互
    available:
      - "playwright-cdp skill（CDP 连接 Chrome :18800）"
      - "vision-analyzer skill（截图分析）"
    status: available

  - need: mobile-viewport-testing
    why: BDD-14 移动端响应式验证
    available:
      - "playwright-cdp skill（支持 viewport 配置）"
     status: available
   ```

## coupling_checklist

```yaml
coupling_checklist:
  - [api-schema: checked] — 新增 PATCH /auth/me，向后兼容
  - [auth-state: checked] — Profile 编辑后更新 authStore.user，不重新登录
  - [router: checked] — 新增 /settings，旧 /settings/apikeys → 302
  - [component-migration: checked] — ApiKeyListView 功能等价迁移
  - [css-scope: checked] — SettingsView 新增 scoped style
```
