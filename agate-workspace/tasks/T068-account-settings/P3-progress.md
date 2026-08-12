# P3 Progress — test-designer

## 2026-07-23 Input Reading

### P1 BDD Summary (14 条)
- BDD-01: Profile tab 展示用户信息
- BDD-02: 编辑 display_name 成功
- BDD-03: 清空 display_name
- BDD-04: display_name 超长校验
- BDD-05: Security tab 改密码成功
- BDD-06: 改密码旧密码错误
- BDD-07: 改密码后无需重新登录
- BDD-08: API Keys tab 功能完整
- BDD-09: 未登录访问 /settings 重定向
- BDD-10: 旧路由 /settings/apikeys 重定向
- BDD-11: Tab 切换与 URL 同步
- BDD-12: PATCH /auth/me 未认证拒绝
- BDD-13: PATCH /auth/me 输入校验
- BDD-14: 移动端设置页可用

### P2 Design Summary
- 方案 A：单组件 + 条件渲染 tab
- 后端：PATCH /auth/me + UpdateProfileRequest schema
- 前端：SettingsView.vue + ApiKeySettingsTab.vue + router/auth guard
- ui_affected: true → 需要 Playwright/E2E 用例

### Existing Test Patterns
- 后端：pytest + httpx AsyncClient + ASGITransport，auth_client fixture (register→token→Bearer header)
- 前端：vitest + jsdom，vi.mock stores/composables，mount + flushPromises
- 前端 mock 模式：vi.hoisted + vi.mock('@/stores/auth') + mock refs

## 2026-07-23 Test Design

### 后端测试 (BDD-02/03/04/05/06/07/12/13)
- PATCH /auth/me 端点测试：认证、输入校验、成功更新、清空、超长
- 改密码相关：成功、旧密码错误、token 不失效

### 前端测试 (BDD-01/02/03/04/05/06/07/08/09/10/11/14)
- SettingsView 组件测试：tab 切换、表单提交、auth guard、URL 同步
- mock authStore + api client

### Playwright/E2E (P5/P6 跑)
- BDD-09/10/14 需要 Playwright，P3 只写后端+前端单测

## 2026-07-23 Red Light Verification

### Backend (test_auth_me.py)
- 12 failed (PATCH /auth/me → 405 Method Not Allowed, endpoint not implemented)
- 4 passed (existing change-password tests)
- **True red light** ✅

### Frontend (t068-account-settings.spec.ts)
- 1 suite failed (Failed to resolve import "@/views/SettingsView.vue" — file does not exist)
- **True red light** ✅ (B-class: import failure due to unimplemented component)
