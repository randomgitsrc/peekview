---
phase: P3
task_id: T068-account-settings
type: test-cases
parent: P2-design.md
trace_id: T068-P3-20260723
status: draft
created: 2026-07-23
agent: test-designer
---

test_code_dir:
  backend: backend/tests/test_auth_me.py
  frontend: frontend-v3/src/components/__tests__/t068-account-settings.spec.ts

## BDD → 测试用例映射

| BDD | 测试 ID | 后端测试 | 前端测试 | Playwright |
|-----|---------|---------|---------|------------|
| BDD-01 | TC-01 | — | Profile tab shows username/display_name/role/member-since | P6 |
| BDD-02 | TC-02 | test_set_display_name_success | Edit display_name → toast + authStore update | P6 |
| BDD-03 | TC-03 | test_clear_display_name_with_empty_string, test_clear_display_name_with_whitespace_only | Clear display_name → toast + fallback | P6 |
| BDD-04 | TC-04 | test_display_name_exceeds_64_chars_returns_422, test_display_name_exactly_64_chars_succeeds | >64 chars → button disabled | P6 |
| BDD-05 | TC-05 | test_change_password_success | Change password → toast + fields cleared | P6 |
| BDD-06 | TC-06 | test_change_password_wrong_old_password | Wrong old password → error toast | P6 |
| BDD-07 | TC-07 | test_session_valid_after_password_change | authState remains authenticated | P6 |
| BDD-08 | TC-08 | — | API Keys tab renders content | P6 (regression) |
| BDD-09 | TC-09 | — | Unauthenticated → settings page not rendered | P6 |
| BDD-10 | TC-10 | — | (router redirect, Playwright only) | P6 |
| BDD-11 | TC-11 | — | Tab click → content switch | P6 |
| BDD-12 | TC-12 | test_unauthenticated_returns_401, test_invalid_token_returns_401 | — | — |
| BDD-13 | TC-13 | test_display_name_exceeds_64_chars_returns_422 | — | — |
| BDD-14 | TC-14 | — | Mobile layout container exists | P6 |

## 后端测试用例详情

### TestPatchMeAuth (BDD-12)
1. `test_unauthenticated_returns_401` — 无 token PATCH /auth/me → 401
2. `test_invalid_token_returns_401` — 无效 JWT PATCH /auth/me → 401

### TestPatchMeValidation (BDD-13 + BDD-04)
3. `test_display_name_exceeds_64_chars_returns_422` — 65 字符 → 422
4. `test_empty_body_returns_200_with_current_user` — `{}` → 200 + 当前 UserResponse

### TestPatchMeUpdateDisplayName (BDD-02/03)
5. `test_set_display_name_success` — "Alice Chen" → 200 + display_name="Alice Chen"
6. `test_clear_display_name_with_empty_string` — "" → 200 + display_name=null
7. `test_clear_display_name_with_whitespace_only` — "   " → 200 + display_name=null
8. `test_display_name_trimmed` — "  Bob  " → 200 + display_name="Bob"
9. `test_update_persists_on_get_me` — PATCH 后 GET /me 验证持久化
10. `test_response_includes_all_user_fields` — 返回含 id/username/display_name/is_active/is_admin/created_at
11. `test_display_name_exactly_64_chars_succeeds` — 64 字符 → 200
12. `test_unicode_display_name` — "张三" → 200 + display_name="张三"

### TestChangePasswordSession (BDD-05/06/07)
13. `test_change_password_success` — 正确旧密码 → 204
14. `test_change_password_wrong_old_password` — 错误旧密码 → 401
15. `test_session_valid_after_password_change` — 改密码后 GET /me → 200
16. `test_change_password_new_too_short` — 新密码 <8 → 422

## 前端测试用例详情

### BDD-01: Profile tab shows user info
1. shows username as readonly
2. shows display_name as editable input
3. shows role badge (Member)
4. shows admin badge for admin user
5. shows member since date

### BDD-02: Edit display_name success
6. updates display_name and shows toast on success

### BDD-03: Clear display_name
7. clears display_name and shows toast

### BDD-04: display_name too long validation
8. shows validation error for display_name > 64 chars (button disabled)

### BDD-05: Change password success
9. calls changePassword and shows toast on success

### BDD-06: Change password wrong old password
10. shows error when old password is incorrect

### BDD-07: Session valid after password change
11. authState remains authenticated after password change

### BDD-08: API Keys tab functionality
12. renders API Keys tab content

### BDD-09: Unauthenticated redirect
13. does not render settings when not authenticated

### BDD-11: Tab switching and URL sync
14. clicking Security tab updates URL query param

### BDD-14: Mobile layout
15. renders stacked layout container for mobile

### Submit protection (隐含需求 #10)
16. disables save button during profile submission
17. disables change password button during submission

### Security form validation
18. disables submit when new password < 8 chars
19. disables submit when confirm password does not match

## Playwright/E2E 用例（P5/P6 执行）

| ID | BDD | 场景 | viewport |
|----|-----|------|----------|
| E2E-01 | BDD-09 | 未登录访问 /settings → 重定向到 landing | desktop |
| E2E-02 | BDD-10 | /settings/apikeys → /settings?tab=apikeys | desktop |
| E2E-03 | BDD-10 | 未登录 /settings/apikeys → landing | desktop |
| E2E-04 | BDD-01 | Profile tab 展示完整用户信息 | desktop |
| E2E-05 | BDD-02 | 编辑 display_name 成功 | desktop |
| E2E-06 | BDD-03 | 清空 display_name | desktop |
| E2E-07 | BDD-05 | 改密码成功 | desktop |
| E2E-08 | BDD-06 | 改密码旧密码错误 | desktop |
| E2E-09 | BDD-08 | API Keys tab 全功能 | desktop |
| E2E-10 | BDD-11 | Tab 切换 URL 同步 | desktop |
| E2E-11 | BDD-14 | 移动端垂直分区布局 | mobile 390x844 |
| E2E-12 | BDD-14 | 移动端所有功能可操作 | mobile 390x844 |
