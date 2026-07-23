---
phase: P6
task_id: T068-account-settings
type: acceptance
parent: P1-requirements.md
trace_id: T068-P6R2-20260723
status: draft
created: 2026-07-23
agent: acceptor
round: 2
---

## Round 2 验收结果

P4 fix round 修了 3 个 bug 后，重新逐条实跑 P1 的 14 条 BDD。全部 PASS。

### 上一轮失败项重验

| BDD | Bug | Fix | 重验结果 |
|-----|-----|-----|----------|
| BDD-03 | display_name 清空发 null 前端不发送 | 前端改为发空字符串 `""` | PASS — `PATCH /auth/me body={display_name:""}` → 后端存 null，header fallback 到 username |
| BDD-08 | API key 创建 500 — `is None` 对 SQLAlchemy column 不生效 | `apikey_service.py` 改用 `.is_(None)` | PASS — 创建 key 成功，一次性 key 显示 `pv_` 前缀 |
| BDD-06 | 旧密码错误返回 401 → 前端 axios interceptor 登出 | 后端 `change-password` 旧密码错误改返回 400 | PASS — 错误提示显示，用户仍在 /settings 页面，未被登出 |

### BDD 逐条对照

- PASS BDD-01: Profile tab 展示用户信息 — username=alice(readonly), role=Admin, member since=2026年7月23日, display_name 输入框可见 (screenshots/bdd01-profile-tab.png) (vision: P6-evidence/vision/bdd01-profile-tab.yaml)
- PASS BDD-02: 编辑 display_name 成功 — 设置 "Alice Chen" 后 API 确认 display_name="Alice Chen" (screenshots/bdd02-display-name-saved.png) (vision: P6-evidence/vision/bdd02-display-name-saved.yaml)
- PASS BDD-03: 清空 display_name — 清空后 API 确认 display_name=null，header fallback 显示 "alice" (screenshots/bdd03-display-name-cleared.png) (vision: P6-evidence/vision/bdd03-display-name-cleared.yaml)
- PASS BDD-04: display_name 超长校验 — maxlength=64 阻止输入超过 64 字符，keyboard.type(65 A's) 被截断为 64 字符 (screenshots/bdd04-validation-error.png) (vision: P6-evidence/vision/bdd04-validation-error.yaml)
- PASS BDD-05: Security tab 改密码成功 — 改密后用新密码验证成功 (HTTP 204) (screenshots/bdd05-password-changed.png) (vision: P6-evidence/vision/bdd05-password-changed.yaml)
- PASS BDD-06: 改密码旧密码错误 — 仍停留在 /settings，错误提示可见 (screenshots/bdd06-wrong-old-password.png) (vision: P6-evidence/vision/bdd06-wrong-old-password.yaml)
- PASS BDD-07: 改密码后无需重新登录 — 改密后导航到 /explore 成功，会话有效 (screenshots/bdd07-session-valid.png) (vision: P6-evidence/vision/bdd07-session-valid.yaml)
- PASS BDD-08: API Keys tab 功能完整 — 列表显示、创建 key 成功、pv_ 前缀一次性 key 可见 (screenshots/bdd08-apikeys-tab.png, screenshots/bdd08-create-dialog.png, screenshots/bdd08-key-created.png) (vision: P6-evidence/vision/bdd08-apikeys-tab.yaml) (vision: P6-evidence/vision/bdd08-create-dialog.yaml) (vision: P6-evidence/vision/bdd08-key-created.yaml)
- PASS BDD-09: 未登录访问 /settings 重定向 — 重定向到 http://127.0.0.1:8888/ (screenshots/bdd09-redirect.png) (vision: P6-evidence/vision/bdd09-redirect.yaml)
- PASS BDD-10a: 旧路由 /settings/apikeys 重定向（已登录）— URL 变为 /settings?tab=apikeys (screenshots/bdd10a-loggedin-redirect.png) (vision: P6-evidence/vision/bdd10a-loggedin-redirect.yaml)
- PASS BDD-10b: 旧路由 /settings/apikeys 重定向（未登录）— 先 302 到 /settings?tab=apikeys，再被 auth guard 重定向到 / (screenshots/bdd10b-unauth-redirect.png) (vision: P6-evidence/vision/bdd10b-unauth-redirect.yaml)
- PASS BDD-11: Tab 切换与 URL 同步 — 点击 Security tab 后 URL 变为 /settings?tab=security (screenshots/bdd11-tab-url-sync.png) (vision: P6-evidence/vision/bdd11-tab-url-sync.yaml)
- PASS BDD-12: PATCH /auth/me 未认证拒绝 — 返回 401 (api/bdd12-unauth-patch.txt)
- PASS BDD-13: PATCH /auth/me 输入校验 — 65 字符 display_name 返回 422 (api/bdd13-validation.txt)
- PASS BDD-14: 移动端设置页可用 — 375×812 视口下 Profile/Security/API Keys 均可见 (screenshots/bdd14-mobile-settings.png) (vision: P6-evidence/vision/bdd14-mobile-settings.yaml)

[NO_NEED_CONFIRM]

### 已知限制

- **全页刷新 /settings 重定向 bug**：已登录用户在浏览器地址栏直接输入 /settings 后全页刷新，会被路由守卫重定向到 /explore。原因：`router.beforeEach` 在 `fetchMe()` 完成前运行，`authState='loading'` 被当作未认证。此 bug 在 P6 round 1 未被覆盖（BDD-09 只测未登录场景），属于新发现但不在 P1 BDD 验收范围内。SPA 内导航（菜单点击、router.push）正常工作。
