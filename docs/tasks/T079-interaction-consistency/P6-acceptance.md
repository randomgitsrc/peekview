---
phase: P6
task_id: T079-interaction-consistency
type: acceptance
parent: P1-requirements.md
trace_id: T079-P6-20260731
status: draft
created: 2026-07-31
agent: verifier
---

# P6 Acceptance — T079: 交互一致性修复

## 环境隔离声明

[PROD_NOT_TOUCHED] 本验收为纯前端 vitest 单元测试，不涉及后端、数据库、生产服务。测试在 frontend-v3 目录执行，使用 jsdom 环境，无网络请求。

## 验证方式

执行 3 个测试文件的 vitest 单元测试，覆盖 BDD-1~17 全部 17 条验收条件。测试通过 = BDD 验收通过。

执行命令：
```
cd /home/kity/oclab/peekview/frontend-v3 && npx vitest run \
  src/components/__tests__/AuthButton.spec.ts \
  src/components/__tests__/UserMenu.spec.ts \
  src/components/__tests__/T079-entry-detail-header.spec.ts
```

结果：47 tests passed, 0 failed, 0 skipped, EXIT_CODE: 0

## BDD 验收结果

### 登录按钮一致性

- PASS BDD-01: Landing 页匿名态显示 primary "Sign in" 按钮 — AuthButton 组件 marketing pageType 在桌面端和移动端均渲染 btn-primary class + "Sign in" 文案 (test-output.log)
- PASS BDD-02: Explore 页匿名态桌面端显示 secondary "Sign in" 按钮 — AuthButton 组件 functional pageType 在桌面端 >=641px 渲染 btn-secondary class + "Sign in" 文案 (test-output.log)
- PASS BDD-03: Explore 页匿名态平板端显示 secondary "Sign in" 按钮 — AuthButton 组件 functional pageType 在平板端 641px-1023px matchMedia matches=false 渲染 btn-secondary class + "Sign in" 文案 (test-output.log)
- PASS BDD-04: Explore 页匿名态移动端显示 ghost "Sign in" 按钮 — AuthButton 组件 functional pageType 在移动端 <=640px matchMedia matches=true 渲染 btn-ghost class + "Sign in" 文案 (test-output.log)
- PASS BDD-05: Detail 页匿名态桌面端显示 secondary "Sign in" 按钮 — AuthButton BDD-05 测试渲染 btn-secondary + "Sign in"; EntryDetailHeader BDD-05 测试验证桌面 header 包含 btn-secondary 且不包含 btn-primary (test-output.log, verbose-test-output.log)
- PASS BDD-06: Detail 页匿名态移动端显示 ghost "Sign in" 按钮 — AuthButton BDD-06 测试渲染 btn-ghost + "Sign in"; EntryDetailHeader BDD-06 测试验证移动端 sticky header 包含 btn-ghost + "Sign in" 且不含纯文本 mobile-signin-link (test-output.log, verbose-test-output.log)

### 用户菜单一致性

- PASS BDD-07: Landing 页认证态显示 Settings + Logout 用户菜单 — UserMenu 组件认证态渲染 trigger, 点击后下拉菜单含 2 个 dropdown-item: Settings + Logout (test-output.log)
- PASS BDD-08: Explore 页认证态显示 Settings + Logout 用户菜单 — UserMenu 组件在 Explore 页场景渲染相同 Settings + Logout 菜单, 2 items 文案一致 (test-output.log)
- PASS BDD-09: Detail 页桌面端认证态显示用户菜单 — UserMenu BDD-09 测试渲染 Settings + Logout; EntryDetailHeader BDD-09 测试验证桌面 header 认证态显示 user-menu-trigger, 点击后下拉菜单含 Settings + Logout, 且不显示 AuthButton (test-output.log, verbose-test-output.log)
- PASS BDD-10: Detail 页移动端认证态显示用户菜单 — UserMenu BDD-10 测试渲染 Settings + Logout; EntryDetailHeader BDD-10 测试验证移动端 sticky header 认证态显示 user-menu-trigger, 点击后下拉菜单含 Settings + Logout, 且不显示 AuthButton (test-output.log, verbose-test-output.log)
- PASS BDD-11: admin 用户在所有页面显示 admin badge — UserMenu BDD-11 测试: admin 用户 trigger 含 .admin-badge 文案 "admin", 非 admin 用户不含; EntryDetailHeader admin badge 测试验证 Detail 页认证态 admin 用户 header 含 .admin-badge (test-output.log, verbose-test-output.log)
- PASS BDD-12: 所有页面用户菜单内容一致 — UserMenu BDD-12 测试: 普通用户菜单项 ['Settings', 'Logout'], admin 用户菜单项同为 ['Settings', 'Logout'], 内容完全一致 (test-output.log)

### Explore 按钮移除

- PASS BDD-13: Detail 页桌面端无 Explore 按钮 — EntryDetailHeader BDD-13 测试: actions-area 中所有链接的 href 不为 /explore, title 不为 "Explore", 文案不为 "Explore"; 整个 header HTML 不含 "Explore" 文本 (test-output.log, verbose-test-output.log)

### Detail 页 tag 可点击

- PASS BDD-14: Detail 页桌面端 tag 可点击并跳转到 explore — EntryDetailHeader BDD-14 测试: meta-row 中 tag 使用 .base-tag 非 .meta-tag, href 指向 /explore?tags=vue 和 /explore?tags=typescript, 点击触发 navigate 事件 (test-output.log, verbose-test-output.log)
- PASS BDD-15: Detail 页移动端 tag 可点击并跳转到 explore — EntryDetailHeader BDD-15 测试: meta-tags-bar 中 tag 使用 .base-tag 非 .meta-tag, href 指向 /explore?tags=vue (test-output.log, verbose-test-output.log)
- PASS BDD-16: Detail 页中文 tag 可点击并正确跳转 — EntryDetailHeader BDD-16 测试: 中文 tag "前端" 的 href 含 tags= 但不含原始中文字符, decodeURIComponent 后等于 "前端", 显示文案正确为 "前端" (test-output.log, verbose-test-output.log)

### Settings 导航

- PASS BDD-17: 用户菜单点击 Settings 导航到设置页 — UserMenu BDD-17 测试: 点击 Settings dropdown-item 后 router.push 被调用, 参数为 /settings?tab=apikeys (test-output.log)

## 待确认清单

[NO_NEED_CONFIRM]

## 验证总结

- 17/17 BDD 全部 PASS
- 0 FAIL
- 0 NEED_CONFIRM
- 47 个测试用例全部通过, exit code 0
- 证据文件: test-output.log 含 EXIT_CODE: 0, verbose-test-output.log 含逐条测试名
